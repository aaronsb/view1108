C=======================================================================
C
C     V I E W - 1 1 0 8          WINDOW VIEW KERNEL: FRAME DRIVER
C
C     Draws what an Apollo 11 crewman would see out of a window, as
C     line vectors and star points in plot degrees, for a film
C     recorder to expose.  After the MSC program VIEW (G. B. Roush;
C     documented by A. N. Lunde and C. T. Hyle).  New code; the target
C     is the surviving output, MSC IN 69-FM-197 and the film clip.
C
C     ENTRY POINTS (called by the chassis, shell.f90; also SIMRUN in
C     sim.f, which runs the engine and fills the tape)
C       VINIT  (ISC, GET, YAW, PIT, ROL, FOV)
C              select situation ISC (the scene number; its SITUATION
C              card, read by the card reader) and return its defaults.
C       VFRAME (GET, YAW, PIT, ROL, FOV, IFLAG,
C               VB, NV, SB, NS, LB, NL, HD, TB, NT, TC, NCH)
C              draw one frame.  VB(5,MAXV) line vectors X1 Y1 X2 Y2
C              STYLE, SB(3,MAXS) points X Y MAG, LB(4,MAXL) labels
C              X Y KIND ID, HD(24) header values, TB/TC text records.
C
C     ELEMENTS.  The kernel is a set of separately compiled elements,
C     linked by the build, as an 1108 program was put together by
C     the Collector, which "is a system processor designed to provide
C     the user with a means of gathering (collecting) and
C     interconnecting one or more relocatable elements to produce a
C     program" (UE-637 sec. 5.1; docs/batch-pipeline.md).
C       vdrive.f  this driver: situations, camera recipes, model
C                 placement
C       vlayer.f  the layer dispatcher over the situation's layer list
C       Core:  ephem.f (time, Sun, Moon), traj.f (trajectory legs,
C              the replay), sim.f (the engine), tape.f (the tape it
C              writes), vsrc.f (the state source: replay or tape),
C              vview.f (camera target and external view),
C              pen.f (projection, clipping, visibility, vectors),
C              vmask.f (the outside cut to the cabin's windows),
C              vtext.f (text records), vmath.f (vectors, matrices),
C              models.f (spacecraft model library), vdeck.f, vdkscn.f,
C              vdksit.f, vdkfld.f, vdksum.f (the card reader: run
C              decks into the tables)
C       Layers, one per drawable, all called as
C              LAYER(GET, VB, NV, SB, NS, LB, NL) by LAYERS:
C              lframe.f 1 plot frame, lstars.f 2 stars, lsun.f 3 Sun,
C              lmoon.f 4 Moon and craters (lmoon6.f its whole-disc
C              extras), learth.f 5 Earth, lvehic.f 6 vehicles
C              (lvlab.f their labels and markers),
C              lcoas.f 7 COAS reticle, lshad.f 8 LM shadow,
C              llpd.f 9 LPD and LM window, lburn.f 10 burn cue
C       Data:  viewdata.f (BLOCK DATA, the catalogs, generated),
C              vdvoc.f (the card reader's words, generated), the run
C              decks (data/missions, read at load), viewcom.inc and
C              viewsit.inc COMMON
C
C     THE ELEMENTS AGAINST TN D-6853, printed p. 3 (our reading).  "The
C     program consists of two basic parts: the integrator portion and
C     the graphic-display portion"; the Apollo modifications "were
C     associated with the input/output options, coordinate
C     transformations, lunar- and solar-ephemeris installation, three-
C     dimensional-display problems, and realistic spacecraft-window
C     outlines".
C       integrator portion           sim.f (and traj.f's replay)
C       graphic-display portion      pen.f, the layers via vlayer.f
C       ephemeris installation       ephem.f
C       coordinate transformations   vmath.f, the frames in vdrive.f
C       three-dimensional display    pen.f, models.f
C       window outlines              window and cabin models (to come)
C       input/output                 vtext.f, the plot-tape buffers,
C                                    the scenarios (data/missions) and
C                                    their card reader (vdeck.f), the
C                                    tape (tape.f)
C     OUR READING: THE REPORT NAMES FUNCTIONS, NOT FILES.
C
C     PROJECTION
C       Radially symmetric about the boresight, gnomonic to
C       stereographic with the field; see PROJ (pen.f).
C
C=======================================================================
      SUBROUTINE VINIT(ISC, GET, YAW, PIT, ROL, FOV)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
C     RESTOMOD END
      INTEGER ISC
      DOUBLE PRECISION GET, YAW, PIT, ROL, FOV
      DOUBLE PRECISION R(3), V(3), PM(3), E(3), S(3), X, Y, TFIX
      INTEGER I, IVS
      DOUBLE PRECISION VDOT, EVGET
C
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (INITD .NE. 1) THEN
        CALL TABSET
        CALL MLIB
        ISN = 0
        INITD = 1
      END IF
C     RESTOMOD END
C     No situation (a deck the card reader refused, vdeck.f): nothing
C     selected, all defaults 0, and VFRAME draws an empty frame.
      IF (NSIT .GE. 1) GO TO 5
      ISCN = 0
      GET = 0.0D0
      YAW = 0.0D0
      PIT = 0.0D0
      ROL = 0.0D0
      FOV = 0.0D0
      RETURN
C     The situation (its SITUATION card) and its scenario.
    5 ISCN = ISC
      IF (ISCN .LT. 1 .OR. ISCN .GT. NSIT) ISCN = 1
      CALL SITSET(ISCN)
      IF (SISN(ISCN) .NE. ISN) CALL SNSET(SISN(ISCN))
      YAW = SILK(1,ISCN)
      PIT = SILK(2,ISCN)
      ROL = SILK(3,ISCN)
C
C     The Earthrise search (ERFIND) for a view turned to the Earth's
C     sightline: its time is the GET rule's Earthrise (gen_data.py
C     allows that rule only there).  Without that turn, no azimuth
C     offset: AZOFF is not left from the last situation.
      IF (JRCP .EQ. 1 .AND. SIAZ(ISCN) .EQ. 1) CALL ERFIND
      IF (SIAZ(ISCN) .EQ. 0) AZOFF = 0.0D0
C     Default GET: a g.e.t., an event plus an offset, or the
C     Earthrise plus an offset.
      GET = SIGT(ISCN)
      IF (SIGK(ISCN) .EQ. 2) GET = EVGET(SIGE(ISCN)) + SIGT(ISCN)
      IF (SIGK(ISCN) .EQ. 3) GET = TERISE + SIGT(ISCN)
      IF (SIFK(ISCN) .EQ. 1) FOV = SIFV(ISCN)
C
C     The recipe's set-up at the default GET.
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (JRCP .EQ. 1 .AND. SIAZ(ISCN) .EQ. 1) THEN
C       FORWARD about the Moon, turned in azimuth (AZOFF) to the
C       Earth's sightline at the default GET, so the Earth rises
C       mid-frame.
        CALL VSTATE(GET, 1, 2, R, V, IVS)
        CALL MOONG(GET, PM)
        E(1) = -PM(1) - R(1)
        E(2) = -PM(2) - R(2)
        E(3) = -PM(3) - R(3)
        CALL VUNIT(R)
        CALL VUNIT(V)
        CALL VCRS(V, R, S)
        X = VDOT(E, V)
        Y = VDOT(E, S)
        AZOFF = DATAN2(Y, X) / DR
      ELSE IF (JRCP .EQ. 2 .AND. JATT .EQ. 1) THEN
C       INERTIAL from the Earth's sightline.  The attitude is held
C       inertially: boresight ELOFF deg ahead of the Earth's centre as
C       seen FXDT before the event (TFIX), up against the Earth's
C       drift across the sky from then to SIDT before the event.
        FXDT = SIFT(ISCN)
        TFIX = EVGET(SIFE(ISCN)) - FXDT
        ELOFF = SIEO(ISCN)
        CALL VSTATE(TFIX, 1, 1, R, V, IVS)
        CALL VSTATE(EVGET(SIFE(ISCN)) - SIDT(ISCN), 1, 1, E, S, IVS)
        DO 22 I = 1, 3
          PM(I) = -R(I)
          E(I) = -E(I)
   22   CONTINUE
        CALL VUNIT(PM)
        CALL VUNIT(E)
C       Net drift of the Earth centre across the line of sight.
        X = VDOT(E, PM)
        DO 24 I = 1, 3
          S(I) = E(I) - X * PM(I)
   24   CONTINUE
        CALL VUNIT(S)
        Y = ELOFF * DR
        DO 26 I = 1, 3
          FXB(I) = DCOS(Y) * PM(I) + DSIN(Y) * S(I)
          FXU(I) = -(DCOS(Y) * S(I) - DSIN(Y) * PM(I))
   26   CONTINUE
      ELSE IF (JRCP .EQ. 4) THEN
C       BODYCTR: the camera SIAL km above the Moon's surface.
        S6DST = RM + SIAL(ISCN)
      END IF
C     RESTOMOD END
C     The disc rule: the body's disc fills SIFV of the frame, rounded
C     to 0.1 deg (BODYCTR's distance).
      IF (SIFK(ISCN) .EQ. 2) FOV = DBLE(NINT(20.0D0
     &  * DASIN(RM / S6DST) / DR / SIFV(ISCN))) / 10.0D0
      RETURN
      END
C
C-----------------------------------------------------------------------
C     SITSET: copy situation K's row of the tables (viewsit.inc, BLOCK
C     DATA VIEWSB) into the current situation, /CSITU/ (viewcom.inc).
C-----------------------------------------------------------------------
      SUBROUTINE SITSET(K)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
C     RESTOMOD END
      INTEGER K, I
      JRCP = SIRC(K)
      JBOD = SIBD(K)
      JMOD = SIMD(K)
      JTRN = SITR(K)
      JFAL = SIFB(K)
      JATT = SIAT(K)
      JVEH = SIVH(K)
      JWIN = SIWN(K)
      JPOS = SIPS(K)
      JDRW = SIDW(K)
      JVW = SIVW(K)
      JTGT = SITG(K)
      JTGF = SITF(K)
      JRID = SIRD(K)
      JSCM = SICM(K)
      JSLM = SILM(K)
      JFIX = SIFX(K)
      JXOF = SIXO(K)
      JHRK = SIHK(K)
      QELV = SIEL(K)
      QFEL = SIFL(K)
      QDST = SIDS(K)
      QHOF = SIHO(K)
      QHRR = SIHR(K)
      DO 10 I = 1, 3
        QTRN(I) = SITN(I,K)
   10 CONTINUE
      QXY(1) = SIXY(1,K)
      QXY(2) = SIXY(2,K)
      DO 20 I = 1, 12
        JLL(I) = SILY(I,K)
   20 CONTINUE
      RETURN
      END
C
C=======================================================================
      SUBROUTINE VFRAME(GET, YAW, PIT, ROL, FOV, IFLAG,
     &                  VB, NV, SB, NS, LB, NL, HD, TB, NT, TC, NCH)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, YAW, PIT, ROL, FOV
      INTEGER IFLAG, NV, NS, NL
      DOUBLE PRECISION VB(5,MAXV), SB(3,MAXS), LB(4,MAXL), HD(24)
      DOUBLE PRECISION TB(4,MAXT)
      INTEGER NT, TC(MAXTC), NCH
      DOUBLE PRECISION PM(3), CG(3), CV(3), RB, RNG, D1, D2, D3, D4
      DOUBLE PRECISION PB(3), RR, VNRM, VDOT, RHO, RC(3), RL(3), VX(3)
      INTEGER I, IREF, IWIN, IOK, J, LOOKD, KLMPL, KCSPL
      DOUBLE PRECISION MR1(3,3), MR2(3,3)
C
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (INITD .NE. 1 .OR. ISCN .EQ. 0) THEN
        CALL VINIT(1, D1, D2, D3, D4, RB)
      END IF
C     RESTOMOD END
      NV = 0
      NS = 0
      NL = 0
      DO 10 I = 1, 24
        HD(I) = 0.0D0
   10 CONTINUE
      IF (ISCN .GE. 1) GO TO 12
      NT = 0
      NCH = 0
      RETURN
   12 IFLG = IFLAG
C     Label level (VSETIN).  With in_lablv 0, in_flags bit 0 means all
C     labels, as before; with 1 or more the level decides and bit 0
C     is set here, so the names are lettered (TXALL).
      ILEV = 3 * MOD(IFLG, 2)
      IF (ILABL .GE. 1) ILEV = ILABL
      IF (ILABL .GE. 1 .AND. MOD(IFLG, 2) .EQ. 0) IFLG = IFLG + 1
C     State source: in_flags bit 3, the tape if the engine has run.
      ISRC = MOD(IFLG / 8, 2)
      ISRCU = 0
      FOVH = 0.5D0 * FOV
      IF (FOVH .LT. 0.05D0) FOVH = 0.05D0
      IF (FOVH .GT. 89.0D0) FOVH = 89.0D0
C     Projection constant (see PROJ), box half-width in plot deg, the
C     angle to the frame corner, and the projection's usable limit.
      PK = 1.0D0 + DMIN1(1.0D0, DMAX1(0.0D0, (2.0D0*FOVH - 100.0D0)
     &     / 70.0D0))
      BOXH = PK * DTAN(FOVH * DR / PK) / DR
      THVIEW = PK * DATAN(1.4143D0 * BOXH * DR / PK) / DR + 0.5D0
      THLIM = 90.0D0 * PK - 0.5D0
      IF (THVIEW .GT. THLIM) THVIEW = THLIM
      CSVIEW = DCOS(THVIEW * DR)
C
C     World at this GET.
      CALL TSET(GET)
      CALL MOONG(GET, PM)
      CALL SUNG(GET, SUNU)
      CALL MOONRT(GET, MMF)
C     Earth fixed to J2000: GMST about the pole of date, then the
C     precession back to J2000 (PRECM).
      CALL ROTZ(GMST, MR1)
      CALL PRECM(TCEN, MR2)
      DO 18 I = 1, 3
        DO 17 J = 1, 3
          MEF(I,J) = MR2(1,I) * MR1(1,J) + MR2(2,I) * MR1(2,J)
     &             + MR2(3,I) * MR1(3,J)
   17   CONTINUE
   18 CONTINUE
C
C     Camera position CG (geocentric), velocity CV relative to the
C     reference body IREF, window code IWIN, reference attitude.
      S6LAT = PIT
      S6LON = YAW
      CALL SCNCAM(GET, PM, CG, CV, IREF, IWIN)
C     Spacecraft models first: they hide stars and bodies.
      CALL SCNMOD(GET, PM, CG)
C     The camera target and the external view (vview.f).
      CALL VIEWPT(GET, PM, CG, YAW, PIT, ROL, LOOKD)
      DO 20 I = 1, 3
        EPOS(I) = -CG(I)
        MPOS(I) = PM(I) - CG(I)
   20 CONTINUE
      CALL MTXV(MMF, MPOS, CAMF)
      DO 30 I = 1, 3
        CAMF(I) = -CAMF(I)
   30 CONTINUE
C
C     Free look, then the boresight in the Moon frame.  BODYCTR's
C     yaw and pitch moved the sub-observer point (SCNCAM): roll only.
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (JRCP .EQ. 4) THEN
        CALL LOOK(0.0D0, 0.0D0, ROL)
      ELSE IF (LOOKD .EQ. 0) THEN
        CALL LOOK(YAW, PIT, ROL)
      END IF
C     RESTOMOD END
      CALL MTXV(MMF, CB, CBMF)
C
      ISTYLE = 1
C     No burn text until the burn cue (lburn.f) asks for one.
      IBRTX = 0
C     The cabin's windows for the window mask (vmask.f).
      CALL WMSET
C     The situation's layers, in order (vlayer.f).
      CALL LAYERS(GET, VB, NV, SB, NS, LB, NL)
C
C     Header.
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (IREF .EQ. 1) THEN
        RNG = VNRM(EPOS)
        RB = RE
      ELSE
        RNG = VNRM(MPOS)
        RB = RM
      END IF
C     RESTOMOD END
      HD(1) = GET
      HD(2) = 2.0D0 * FOVH
      HD(3) = RNG / 1.852D0
      HD(4) = (RNG - RB) / 1.609344D0
      HD(5) = VNRM(CV) * 1000.0D0 / 0.3048D0
      HD(6) = DBLE(IREF)
      HD(7) = DBLE(ISCN)
      HD(8) = DBLE(IWIN)
C     The LM crew station riding the descending LM: the footpads'
C     altitude (LMDESC), 0 at touchdown.
      IF (JRCP .EQ. 3) HD(10) = LMALT * 1000.0D0 / 0.3048D0
C     Reference body in the picture, for the page's camera steering:
C     centre X, Y (deg, even off frame), angular radius, in front flag.
C     Or the situation's header object (HDRREF): the placed LM, the
C     LM's docking target (S7POSE), the placed CSM's tunnel.
      DO 40 I = 1, 3
        PB(I) = EPOS(I)
        IF (IREF .EQ. 2) PB(I) = MPOS(I)
        IF (JHRK .EQ. 1 .AND. KLMPL() .NE. 0) PB(I) = MDP(I,KLMPL())
        IF (JHRK .EQ. 2) PB(I) = S7LP(I) - QHOF * S7AT(I,2)
        IF (JHRK .EQ. 3) PB(I) = MDP(I,KCSM) + QHOF * MDAT(I,1,KCSM)
   40 CONTINUE
      RR = RE
      IF (IREF .EQ. 2) RR = RM
      IF (JHRK .EQ. 1 .AND. KLMPL() .NE. 0) RR = QHRR
      IF (JHRK .EQ. 2 .OR. JHRK .EQ. 3) RR = QHRR
      CALL PROJ(PB, HD(11), HD(12), IOK)
      HD(13) = RHO(DASIN(DMIN1(1.0D0, RR / VNRM(PB))))
      HD(15) = BOXH
C     The scenario's epoch as an offset (s) from Apollo 11 range zero,
C     for the page's clock: UTC = 1969-07-16 13:32:00 + HD(16) + GET.
      HD(16) = (TJD0 - JD0) * 86400.0D0
C     The state source used (0 replay, 1 sim corrected, 2 sim free),
C     and the last engine run's error at the reference row nearest
C     GET: position (km), velocity (ft/s), that row's g.e.t. (s).
      HD(17) = DBLE(ISRCU)
      CALL SIMERR(GET, J, HD(20), HD(18), HD(19))
C     The CSM to LM range (ft) where both states are known (VSTATE;
C     0 docked), kept from HD(17)'s record of the source; with S7POSE
C     the docking ring's range of its closing law.
      I = ISRCU
      CALL CSMSL(GET, RC, VX)
      CALL VSTATE(GET, 2, 2, RL, VX, IOK)
      ISRCU = I
      IF (IOK .NE. 0) HD(9) = DSQRT((RL(1) - RC(1))**2
     &  + (RL(2) - RC(2))**2 + (RL(3) - RC(3))**2) * 1.0D3 / 0.3048D0
      IF (JPOS .EQ. 2) HD(9) = S7RNG
      HD(14) = 0.0D0
      IF (VDOT(PB, CB) .GT. 0.0D0) HD(14) = 1.0D0
C     The vehicles in this frame's world (VPRES): 1 CSM, 2 LM, 4 S-IVB.
      CALL VPRES(GET)
      HD(21) = DBLE(IVBIT)
C     The crew stations this situation offers (its VIEWS card; STATCM,
C     STATLM): 1 the CM, 2 the LM, each always or where that vehicle
C     is placed (in a station the camera's own vehicle is not placed,
C     the camera being inside it), and 4 always, so the page can tell
C     this from a kernel without HD(22).  The page enables its station
C     buttons from these; HD(21) leaves out the vehicle the camera
C     rides, so it cannot.
      HD(22) = 4.0D0
      IF (JSCM .EQ. 2 .OR. (JSCM .EQ. 1 .AND. (KCSPL() .NE. 0
     &  .OR. IVUSE .EQ. 2))) HD(22) = HD(22) + 1.0D0
      IF (JSLM .EQ. 2 .OR. (JSLM .EQ. 1 .AND. (KLMPL() .NE. 0
     &  .OR. IVUSE .EQ. 3))) HD(22) = HD(22) + 2.0D0
C     Text for the recorder's character generator.
      CALL TXALL(LB, NL, TB, NT, TC, NCH)
      RETURN
      END
C
C=======================================================================
C     CAMERA RECIPES.  Position, velocity, reference body and the
C     reference attitude RREF, UREF, BREF of the situation's recipe
C     (JRCP, its parameters in /CSITU/) at GET.  Each branch is the
C     camera code of the scenes it came from, unchanged.
C=======================================================================
      SUBROUTINE SCNCAM(GET, PM, CG, CV, IREF, IWIN)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, PM(3), CG(3), CV(3)
      INTEGER IREF, IWIN
      DOUBLE PRECISION R(3), V(3), RU(3), VU(3), SU(3), H(3), E(3)
      DOUBLE PRECISION DIP, CA, SA, CD, SD, P2(3), R2(3), K, VDOT
      DOUBLE PRECISION XB(3), YB(3), ZB(3), PMF(3), VNRM, ELV
      INTEGER I, LB, LUNIN, IVS
C
      IWIN = JWIN
C     The platform's body and elevation, but where the recipe has an
C     off-leg fallback (JFAL) and no LUNAR leg holds the GET, FORWARD
C     about the Earth instead (scene 9, Apollo 8, away from lunar
C     orbit; our choice: no Apollo 8 view survives, TN D-6853 printed
C     p. 3).
      LB = JBOD
      ELV = QELV
      IF (JFAL .EQ. 1 .AND. LUNIN(GET) .EQ. 0) LB = 1
      IF (LB .NE. JBOD) ELV = QFEL
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (JRCP .EQ. 1 .AND. LB .EQ. 2) THEN
C       LOCALVERT about the Moon: the CSM in lunar orbit.
        IREF = 2
        CALL VSTATE(GET, 1, 2, R, V, IVS)
        DO 10 I = 1, 3
          CG(I) = PM(I) + R(I)
          CV(I) = V(I)
          RU(I) = R(I)
          VU(I) = V(I)
   10   CONTINUE
        CALL VUNIT(RU)
        CALL VUNIT(VU)
        IF (JMOD .EQ. 1) THEN
C         FORWARD along the orbit, turned AZOFF in azimuth, down to
C         the horizon by the dip angle.
          CALL VCRS(VU, RU, SU)
          CA = DCOS(AZOFF * DR)
          SA = DSIN(AZOFF * DR)
          DIP = DACOS(RM / VNRM(R))
          CD = DCOS(DIP)
          SD = DSIN(DIP)
          DO 20 I = 1, 3
            H(I) = CA * VU(I) + SA * SU(I)
            BREF(I) = CD * H(I) - SD * RU(I)
            UREF(I) = SD * H(I) + CD * RU(I)
   20     CONTINUE
C         The situation's reference turn (REFTRN).
          IF (JTRN .EQ. 1) CALL REFTRN
        ELSE
C         NORMAL: out of plane toward the LM, local vertical up.
          CALL VCRS(RU, VU, BREF)
          DO 30 I = 1, 3
            UREF(I) = RU(I)
   30     CONTINUE
        END IF
      ELSE IF (JRCP .EQ. 2 .AND. JATT .EQ. 1) THEN
C       INERTIAL from the Earth's sightline, the coast.  Attitude held
C       inertially (FXB, FXU, set by VINIT).
        IREF = 1
        CALL VSTATE(GET, 1, 1, R, V, IVS)
        DO 40 I = 1, 3
          CG(I) = R(I)
          CV(I) = V(I)
          BREF(I) = FXB(I)
          UREF(I) = FXU(I)
   40   CONTINUE
      ELSE IF (JRCP .EQ. 1) THEN
C       LOCALVERT about the Earth (parking orbit, and the off-leg
C       fallback).  FORWARD, boresight ELV deg above the horizon.
        IREF = 1
        CALL VSTATE(GET, 1, 1, R, V, IVS)
        DO 70 I = 1, 3
          CG(I) = R(I)
          CV(I) = V(I)
          RU(I) = R(I)
          VU(I) = V(I)
   70   CONTINUE
        CALL VUNIT(RU)
        CALL VUNIT(VU)
        DIP = DACOS(RE / VNRM(R)) - ELV * DR
        CD = DCOS(DIP)
        SD = DSIN(DIP)
        DO 80 I = 1, 3
          BREF(I) = CD * VU(I) - SD * RU(I)
          UREF(I) = SD * VU(I) + CD * RU(I)
   80   CONTINUE
      ELSE IF (JRCP .EQ. 4) THEN
C       BODYCTR, the Moon view: looking at the centre from above the
C       sub-observer point (S6LAT, S6LON), selenographic north up (our
C       choice; a J2000-north layout would do as well).
        IREF = 2
        E(1) = DCOS(S6LAT * DR) * DCOS(S6LON * DR)
        E(2) = DCOS(S6LAT * DR) * DSIN(S6LON * DR)
        E(3) = DSIN(S6LAT * DR)
        CALL MXV(MMF, E, H)
        DO 95 I = 1, 3
          CG(I) = PM(I) + S6DST * H(I)
          CV(I) = 0.0D0
          BREF(I) = -H(I)
          UREF(I) = MMF(I,3)
   95   CONTINUE
        K = VDOT(UREF, BREF)
        DO 96 I = 1, 3
          UREF(I) = UREF(I) - K * BREF(I)
   96   CONTINUE
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (VDOT(UREF, UREF) .LT. 1.0D-12) THEN
          DO 97 I = 1, 3
            UREF(I) = MMF(I,1)
   97     CONTINUE
        END IF
C     RESTOMOD END
        CALL VUNIT(UREF)
      ELSE IF (JRCP .EQ. 5) THEN
C       EXTSEED, the docked stack (S8ATT) from QDST on its far side
C       from the Earth, looking at it with the Earth behind; the
C       stack's X axis up.  Its own view is external (JVW, VIEWPT),
C       which yaw and pitch carry around the stack.
        IREF = 1
        CALL VSTATE(GET, 1, 1, R, V, IVS)
        CALL S8ATT(GET)
        DO 120 I = 1, 3
          BREF(I) = -R(I)
  120   CONTINUE
        CALL VUNIT(BREF)
        K = VDOT(S8AT(1,1), BREF)
        DO 125 I = 1, 3
          UREF(I) = S8AT(I,1) - K * BREF(I)
          CG(I) = R(I) - QDST * BREF(I)
          CV(I) = V(I)
  125   CONTINUE
        CALL VUNIT(UREF)
      ELSE IF (JRCP .EQ. 2) THEN
C       INERTIAL from a vehicle, transposition and docking.  The CSM
C       on the translunar ellipse (30 m from the S-IVB, nothing at
C       this scale), turned around to face the stack, which holds an
C       inertial attitude (S7ATT).  Boresight along the CSM +X axis,
C       which is down the LM's -X axis; the LM front (+Z) up.
        IREF = 1
        CALL VSTATE(GET, 1, 1, R, V, IVS)
        CALL S7ATT
        DO 110 I = 1, 3
          CG(I) = R(I)
          CV(I) = V(I)
          BREF(I) = -S7AT(I,1)
          UREF(I) = S7AT(I,3)
  110   CONTINUE
      ELSE
C       CREWSTN, the LM (JVEH 2; gen_data.py refuses the CM until it
C       has an axes source): the LM descent.  Boresight LPDDN (30.2)
C       deg down from the LM +Z axis in the X-Z plane, the LPD's
C       plane; the film's LPD marks give the angle (llpd.f).
        IREF = 2
        CALL LMDESC(GET, PMF, XB, YB, ZB)
        CALL LMDESC(GET + 1.0D0, P2, H, E, R2)
        CALL MXV(MMF, PMF, R)
        CALL MXV(MMF, P2, R2)
        DO 90 I = 1, 3
          CG(I) = PM(I) + R(I)
          CV(I) = R2(I) - R(I)
   90   CONTINUE
        CALL MXV(MMF, XB, H)
        CALL MXV(MMF, ZB, E)
        CD = DCOS(LPDDN * DR)
        SD = DSIN(LPDDN * DR)
        DO 100 I = 1, 3
          BREF(I) = CD * E(I) - SD * H(I)
          UREF(I) = SD * E(I) + CD * H(I)
  100   CONTINUE
      END IF
C     RESTOMOD END
      CALL VCRS(BREF, UREF, RREF)
      CALL VUNIT(RREF)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     FREE LOOK.  Camera axes from the reference attitude turned by
C     yaw (+ right), pitch (+ up) and roll (+ camera clockwise as the
C     viewer sees it, so the picture turns counter-clockwise).
C-----------------------------------------------------------------------
      SUBROUTINE LOOK(YAW, PIT, ROL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION YAW, PIT, ROL
      DOUBLE PRECISION B1(3), R1(3), U2(3), C, S
      INTEGER I
      C = DCOS(YAW * DR)
      S = DSIN(YAW * DR)
      DO 10 I = 1, 3
        B1(I) = C * BREF(I) + S * RREF(I)
        R1(I) = C * RREF(I) - S * BREF(I)
   10 CONTINUE
      C = DCOS(PIT * DR)
      S = DSIN(PIT * DR)
      DO 20 I = 1, 3
        CB(I) = C * B1(I) + S * UREF(I)
        U2(I) = C * UREF(I) - S * B1(I)
   20 CONTINUE
      C = DCOS(ROL * DR)
      S = DSIN(ROL * DR)
      DO 30 I = 1, 3
        CU(I) = C * U2(I) + S * R1(I)
        CR(I) = C * R1(I) - S * U2(I)
   30 CONTINUE
      RETURN
      END
C
C=======================================================================
C     TABLES.  Crater centres and coastline points to unit vectors.
C=======================================================================
      SUBROUTINE TABSET
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION A, B
      INTEGER I
      DO 10 I = 1, NCRAT
        A = CRLAT(I) * DR
        B = CRLON(I) * DR
        CRV(1,I) = DCOS(A) * DCOS(B)
        CRV(2,I) = DCOS(A) * DSIN(B)
        CRV(3,I) = DSIN(A)
   10 CONTINUE
      DO 20 I = 1, NCPT
        A = CLAT(I) * DR
        B = CLON(I) * DR
        CEV(1,I) = DCOS(A) * DCOS(B)
        CEV(2,I) = DCOS(A) * DSIN(B)
        CEV(3,I) = DSIN(A)
   20 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     SCNMOD: place this frame's models (after SCNCAM, before the sky
C     is drawn, since placed solids hide stars and bodies): the
C     situation's own (its pose, JPOS), then the vehicles near the
C     camera at their states (VEHPL, SIVPL).  PM the Moon, CG the
C     camera (geocentric, km).
C-----------------------------------------------------------------------
      SUBROUTINE SCNMOD(GET, PM, CG)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, PM(3), CG(3)
      CALL MCLEAR
      IF (JPOS .EQ. 1) CALL LMPIRO(GET, PM, CG)
      IF (JPOS .EQ. 2) CALL S7POSE(GET)
      IF (JPOS .EQ. 3) CALL S8POSE
      CALL VEHPL(GET, PM, CG)
      CALL SIVPL(GET, CG)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     LMREL: the LM's position LP (km) relative to the camera CG, from
C     its state (VSTATE); IOK = 0 if it has none of its own (docked,
C     or none at all) or is within 15 m of the camera, where its model
C     would hold the camera (ours).
C-----------------------------------------------------------------------
      SUBROUTINE LMREL(GET, PM, CG, LP, V, IOK)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, PM(3), CG(3), LP(3), V(3), R(3), VNRM
      INTEGER IOK, I
      CALL VSTATE(GET, 2, 2, R, V, IOK)
      IF (IOK .NE. 1) IOK = 0
      IF (IOK .EQ. 0) RETURN
      DO 10 I = 1, 3
        LP(I) = PM(I) + R(I) - CG(I)
   10 CONTINUE
      IF (VNRM(LP) .LT. 15.0D-6) IOK = 0
      RETURN
      END
C
C-----------------------------------------------------------------------
C     VEHPL: the LM at its state (LMSTAT), placed when it is within 5
C     km of the camera (where its model spans more than about 0.1 deg;
C     ours), not already placed by the situation and not carrying the
C     camera (JRID, the LM descent): before touchdown with its descent stage, the
C     gear-down model (KLMD); from lift-off (the LIFT event) the ascent
C     stage alone (KLMA).  Landed, from touchdown to lift-off, it is
C     not placed (the marker of lvlab.f stands for it).  Attitude ours:
C     +X along the local vertical, +Z along the motion; the ascent
C     stage from TPF (terminal phase finalize) on, braking to the CSM,
C     turns its +X, the docking tunnel's axis, toward the CSM.
C-----------------------------------------------------------------------
      SUBROUTINE VEHPL(GET, PM, CG)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, PM(3), CG(3), LP(3), V(3), AT(3,3), BO(3)
      DOUBLE PRECISION RL(3), RC(3), VC(3), TL, TF, C, VDOT, VNRM
      DOUBLE PRECISION EVGET
      INTEGER IOK, I, J, K, KLMPL
      IF (JRID .EQ. 2 .OR. KLMPL() .NE. 0) RETURN
      K = KLMD
      TL = EVGET(KELFT)
      IF (TL .GE. 0.0D0 .AND. GET .GE. TL) K = KLMA
      IF (K .EQ. KLMD .AND. LUT0 .GT. 0.0D0 .AND. GET .GE. LUT0)
     &  RETURN
      CALL LMREL(GET, PM, CG, LP, V, IOK)
      IF (IOK .EQ. 0) RETURN
      IF (VNRM(LP) .GT. 5.0D0) RETURN
C     Up: from the Moon's centre to the LM.
      DO 10 I = 1, 3
        AT(I,1) = CG(I) + LP(I) - PM(I)
   10 CONTINUE
      TF = EVGET(KETPF)
      IF (K .NE. KLMA .OR. TF .LT. 0.0D0 .OR. GET .LT. TF) GO TO 15
C     The ascent stage braking to docking: up toward the CSM (the
C     source used, ISRCU, kept as the camera's).
      J = ISRCU
      CALL VSTATE(GET, 2, 2, RL, V, IOK)
      CALL VSTATE(GET, 1, 2, RC, VC, IOK)
      ISRCU = J
      DO 12 I = 1, 3
        AT(I,1) = RC(I) - RL(I)
   12 CONTINUE
   15 CALL VUNIT(AT(1,1))
      C = VDOT(V, AT(1,1))
      DO 20 I = 1, 3
        AT(I,3) = V(I) - C * AT(I,1)
   20 CONTINUE
      CALL VUNIT(AT(1,3))
      CALL VCRS(AT(1,3), AT(1,1), AT(1,2))
      CALL SETV(BO, 2.3D0, 0.0D0, 0.0D0)
      CALL MPLACE(K, AT, LP, BO)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     SIVPL: the S-IVB at its state (traj.f SIVST), placed as the LM is
C     (VEHPL): within 5 km of the camera, not within 15 m of it, not
C     already placed by the scene (scene 7), and only on a state of its
C     own (IOK 1: not with the CSM before separation, nor docked to the
C     stack, as the docked LM).  Attitude: the stack's, held inertially
C     for the docking (S7ATT); the S-IVB's turn to its slingshot
C     attitude from 4:41:07.6 (SP p. 106) is not modelled (ours).
C     Before the ejection (EJECT) the LM, gear stowed (KLMS), stands in
C     it as S7POSE puts it.  The source used, ISRCU, kept as the
C     camera's (S7ATT reads a state).
C-----------------------------------------------------------------------
      SUBROUTINE SIVPL(GET, CG)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, CG(3), R(3), V(3), LP(3), BO(3), D, VNRM
      DOUBLE PRECISION EVGET
      INTEGER IOK, I, J, KLMPL
      IF (MDON(KSIV) .EQ. 1) RETURN
      CALL VSTATE(GET, 3, 1, R, V, IOK)
      IF (IOK .NE. 1) RETURN
      DO 10 I = 1, 3
        LP(I) = R(I) - CG(I)
   10 CONTINUE
      D = VNRM(LP)
      IF (D .GT. 5.0D0 .OR. D .LT. 15.0D-6) RETURN
      J = ISRCU
      CALL S7ATT
      ISRCU = J
C     The state's point: the stage's centre (S7SIV).
      CALL SETV(BO, -0.5D0 * (58.3D0 + 3.0D0) * 0.3048D0, 0.0D0,
     &          0.0D0)
      CALL MPLACE(KSIV, S7AT, LP, BO)
      IF (GET .GE. EVGET(KEEJC) .OR. KLMPL() .NE. 0) RETURN
C     The LM's tunnel top 1.5 + 4.51 m above the IU's top (S7POSE).
      D = (1.5D0 + 4.51D0 - BO(1)) * 1.0D-3
      DO 20 I = 1, 3
        LP(I) = LP(I) + D * S7AT(I,1)
   20 CONTINUE
      CALL SETV(BO, 4.51D0, 0.0D0, 0.0D0)
      CALL MPLACE(KLMS, S7AT, LP, BO)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     LMPIRO: the LM at its state (LMSTAT: 300 ft out along the orbit
C     normal from undocking to the separation burn), turning slowly for
C     inspection (scene 4); not placed where it has no state of its
C     own (LMREL), nor from touchdown on, as in VEHPL (the gear-down
C     model is the LM with its descent stage).
C-----------------------------------------------------------------------
      SUBROUTINE LMPIRO(GET, PM, CG)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, PM(3), CG(3)
      DOUBLE PRECISION AT(3,3), R1(3,3), R2(3,3), R3(3,3), R4(3,3)
      DOUBLE PRECISION BX(3,3), LP(3), BO(3), V(3), T, PS, TH, PH, C
      DOUBLE PRECISION EVGET, VDOT
      INTEGER I, IOK, K
C     Nothing between touchdown and lift-off (VEHPL's rule): the LM
C     stands at the landing site, below any scene 4 camera.
      IF (LUT0 .GT. 0.0D0 .AND. GET .GE. LUT0 .AND. (EVGET(KELFT)
     &  .LT. 0.0D0 .OR. GET .LT. EVGET(KELFT))) RETURN
      CALL LMREL(GET, PM, CG, LP, V, IOK)
      IF (IOK .EQ. 0) RETURN
C     Body axes: X up (the reference up made square to the line of
C     sight), Z toward the camera.
      DO 10 I = 1, 3
        BX(I,3) = -LP(I)
   10 CONTINUE
      CALL VUNIT(BX(1,3))
      C = VDOT(UREF, BX(1,3))
      DO 15 I = 1, 3
        BX(I,1) = UREF(I) - C * BX(I,3)
   15 CONTINUE
      CALL VUNIT(BX(1,1))
      CALL VCRS(BX(1,3), BX(1,1), BX(1,2))
      T = GET - EVGET(KEUND)
      PS = (35.0D0 + 1.5D0 * T) * DR
      TH = -(20.0D0 + 15.0D0 * DSIN(T * 2.0D0 * PI / 300.0D0)) * DR
      PH = (10.0D0 * DSIN(T * 2.0D0 * PI / 420.0D0)) * DR
C     Yaw about body X, tilt toward the camera about body Y, then
C     turn in the picture about body Z (toward the camera).
      CALL ROTX(PS, R1)
      CALL ROTY(TH, R2)
      CALL ROTZ(PH, R3)
      CALL MXM(R3, R2, R4)
      CALL MXM(R4, R1, R2)
      CALL MXM(BX, R2, AT)
C     Centred on the stage joint, the state's point (LMSTAT).  From
C     lift-off (the LIFT event) the ascent stage alone (KLMA).
      CALL SETV(BO, 2.3D0, 0.0D0, 0.0D0)
      K = KLMD
      IF (EVGET(KELFT) .GE. 0.0D0 .AND. GET .GE. EVGET(KELFT)) K = KLMA
      CALL MPLACE(K, AT, LP, BO)
      RETURN
      END
C
C=======================================================================
C     TRANSPOSITION AND DOCKING (scene 7).  TN D-6853 (printed p. 12)
C     lists among VIEW's capabilities integrating trajectories "after
C     separation of the LM and the CSM or the CSM/LM and S-IVB
C     vehicles", drawing "the vehicle outlines of the CSM, LM, and the
C     S-IVB" at their apparent size, and "hidden-line models of the LM
C     and the S-IVB".  The contents and OCR of the Apollo 11 report
C     (MSC IN 69-FM-197) list no such views: no answer key.
C
C     Apollo 11 times (Mission Report MSC-00171, table 7-II, printed
C     p. 7-9): command module/S-IVB separation 3:17:04.6, docking
C     3:24:03.1.  The crew expected to be "out about 66 feet", and
C     Collins guessed "around 100 or so" (Apollo 11 Flight Journal,
C     003:38:07); the report has "a maximum separation distance of at
C     least 100 feet" and contact "at an estimated 0.1 ft/sec"
C     (printed p. 4-2).  Our closing law: 100 ft until 3:20:30 (the
C     turnaround is not modelled; the time is our guess, between the
C     separation and Collins' "I'm still quite a ways" at 3:22:25),
C     then range = 100 (A U + (1-A) U**2) ft, U the fraction of the
C     closing time left, A set so the range rate at contact is 0.1
C     ft/s.
C-----------------------------------------------------------------------
      SUBROUTINE S7POSE(GET)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, D, V(3), W(3), Z(3)
      DOUBLE PRECISION PS(3), AC(3,3), S7RF, CMTOP
      INTEGER I
      S7RNG = S7RF(GET)
C     The camera is the COAS in the CSM's left rendezvous window,
C     looking parallel to the docking axis 0.72 m to the LM's -Y side
C     of it and 2 m behind the CSM's docking ring (our guesses; the
C     target is set off to match, LMDOCK).  S7BO: the tunnel top.
      CALL SETV(S7BO, 4.51D0, 0.0D0, 0.0D0)
      D = (S7RNG * 0.3048D0 + 2.0D0) * 1.0D-3
      DO 10 I = 1, 3
        S7LP(I) = D * BREF(I) + 0.72D-3 * S7AT(I,2)
   10 CONTINUE
      CALL MPLACE(KLMS, S7AT, S7LP, S7BO)
C     The S-IVB on the same axes, the top of its IU 1.5 m below the
C     LM's base on the descent stage's axis (Y = Z = 0), which puts
C     the LM tunnel near the top of the 28 ft SLA (press kit, printed
C     p. 88) with room for the SPS nozzle: our guess.
      CALL SETV(V, (-1.5D0 - S7BO(1)) * 1.0D-3, -S7BO(2) * 1.0D-3,
     &          -S7BO(3) * 1.0D-3)
      CALL MXV(S7AT, V, W)
      DO 20 I = 1, 3
        PS(I) = S7LP(I) + W(I)
   20 CONTINUE
      CALL SETV(Z, 0.0D0, 0.0D0, 0.0D0)
      CALL MPLACE(KSIV, S7AT, PS, Z)
C     Seen from outside (IVIEW 1; SCNMOD runs before VIEWPT sets
C     IVUSE), the CSM itself, coaxial with the LM and facing it: its
C     axes S7AT's with X and Y turned over (STKPL's half turn about Z),
C     the CSM's origin CMTOP (models.f; STKPL) plus the range S7RNG
C     behind the LM's tunnel top S7LP, so the two tunnels' tops meet
C     at docking and the camera, 2 m behind that top (above), sits in
C     the CM 0.77 m above the CSM's origin, near the eye's X 0.70
C     (CMEYE).  Placed, it replaces VIEWPT's CSM around the camera
C     (CSMCAM); the window view keeps the camera in the CSM and draws
C     no CSM (ours).
      IF (IVIEW .NE. 1) RETURN
      DO 30 I = 1, 3
        AC(I,1) = -S7AT(I,1)
        AC(I,2) = -S7AT(I,2)
        AC(I,3) = S7AT(I,3)
   30 CONTINUE
      D = S7RNG * 0.3048D-3 + CMTOP() * 1.0D-3
      DO 40 I = 1, 3
        PS(I) = S7LP(I) - D * AC(I,1)
   40 CONTINUE
      CALL MPLACE(KCSM, AC, PS, Z)
      RETURN
      END
C
C     S7RF: scene 7's range (ft) from the CSM's docking ring to the
C     LM's at GET, S7POSE's closing law, between the approach start and
C     the docking from the scenario (APPR, DOCK); 100 without them.
      DOUBLE PRECISION FUNCTION S7RF(GET)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, TCLS, TDOK, U, A, EVGET
      TCLS = EVGET(KEAPR)
      TDOK = EVGET(KEDOK)
      S7RF = 100.0D0
      IF (TDOK .LE. TCLS) RETURN
      U = (TDOK - GET) / (TDOK - TCLS)
      IF (U .GT. 1.0D0) U = 1.0D0
      IF (U .LT. 0.0D0) U = 0.0D0
      A = 0.1D0 * (TDOK - TCLS) / 100.0D0
      S7RF = 100.0D0 * (A * U + (1.0D0 - A) * U * U)
      RETURN
      END
C
C     S7SIV: the S-IVB's centre, the point of its state (traj.f SIVST),
C     from the CSM's eye in scene 7's geometry at range RNG (ft), EQ km:
C     S7POSE's LM tunnel top RNG ft plus 2 m down the docking axis and
C     0.72 m to the LM's -Y side, the IU's top 6.01 m below that, the
C     centre half the stage's 61.3 ft (SIVBMD) below the IU's top, on
C     the axes S7AT (S7ATT must have set them).
      SUBROUTINE S7SIV(RNG, P)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION RNG, P(3), D
      INTEGER I
      D = (RNG * 0.3048D0 + 2.0D0 + 1.5D0 + 4.51D0
     &  + 0.5D0 * (58.3D0 + 3.0D0) * 0.3048D0) * 1.0D-3
      DO 10 I = 1, 3
        P(I) = -D * S7AT(I,1) + 0.72D-3 * S7AT(I,2)
   10 CONTINUE
      RETURN
      END
C
C     S7ATT: the stack's attitude, LM (and S-IVB) body axes in S7AT.
C     The S-IVB held "a fixed inertial attitude to provide a stable
C     docking platform" (MPR-SAT-FE-69-9, printed p. 11-1), reached by
C     a manoeuvre that was to be "completed at plus 09 plus 20", so
C     "the Sun will shine across the top of the LM after separation"
C     (Apollo 11 Flight Journal, 002:54:09 and commentary).  The
C     attitude itself is our guess: the stack's X axis square to the
C     Sun and in the plane of the trajectory, pointing along the
C     motion, frozen at 3:09:20; the LM front (+Z) toward the Sun.
      SUBROUTINE S7ATT
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION T, R(3), V(3), S(3), H(3), X(3), Y(3), VDOT
      DOUBLE PRECISION EVGET
      INTEGER I
C     The attitude time from the scenario (TDATT).
      T = EVGET(KETDA)
      CALL CSMST(T, 1, R, V)
      CALL SUNG(T, S)
      CALL VCRS(R, V, H)
      CALL VUNIT(H)
      CALL VCRS(S, H, X)
      CALL VUNIT(X)
      IF (VDOT(X, V) .LT. 0.0D0) CALL SETV(X, -X(1), -X(2), -X(3))
      CALL VCRS(S, X, Y)
      DO 10 I = 1, 3
        S7AT(I,1) = X(I)
        S7AT(I,2) = Y(I)
        S7AT(I,3) = S(I)
   10 CONTINUE
      RETURN
      END
C
C     VSETIN: the view inputs for the next frame (the chassis calls it
C     before VFRAME): view, camera target, label level.  Out-of-range
C     values fall back to 0.
      SUBROUTINE VSETIN(IV, IT, IL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER IV, IT, IL
      IVIEW = IV
      ITARG = IT
      ILABL = IL
      IF (IVIEW .LT. 0 .OR. IVIEW .GT. 3) IVIEW = 0
      IF (ITARG .LT. 0 .OR. ITARG .GT. 6) ITARG = 0
      IF (ILABL .LT. 0 .OR. ILABL .GT. 3) ILABL = 0
      RETURN
      END
C
C-----------------------------------------------------------------------
C     S8ATT: the docked stack's attitude in passive thermal control,
C     CSM body axes in S8AT.  "In this attitude the spacecraft will be
C     rotated at a rate of about 3 revolutions per hour" (Apollo 11
C     Flight Journal, commentary after 008:11:00); "rotated about its
C     X axis" (same, Apollo Control at 8 hours 59 minutes); "PTC is
C     started now" (Collins, 010:58:19).  The axis is ours: square to
C     the ecliptic, so the Sun stays square to it (J2000 ecliptic pole);
C     the roll starts with +Z toward the Sun.  Before PTC, no roll.
C-----------------------------------------------------------------------
      SUBROUTINE S8ATT(GET)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, X(3), Y(3), Z(3), EP, PH, C, S, EVGET
      INTEGER I
      EP = 23.4392911D0 * DR
      CALL SETV(X, 0.0D0, -DSIN(EP), DCOS(EP))
      CALL VCRS(X, SUNU, Y)
      CALL VUNIT(Y)
      CALL VCRS(X, Y, Z)
      PH = 0.0D0
      IF (GET .GT. EVGET(KEPTC)) PH = 3.0D0 * 2.0D0 * PI / 3600.0D0
     &  * (GET - EVGET(KEPTC))
      C = DCOS(PH)
      S = DSIN(PH)
      DO 10 I = 1, 3
        S8AT(I,1) = X(I)
        S8AT(I,2) = C * Y(I) + S * Z(I)
        S8AT(I,3) = C * Z(I) - S * Y(I)
   10 CONTINUE
      RETURN
      END
C
C     S8POSE: place the docked stack (STKPL), the LM with its gear
C     stowed (KLMS) as in translunar coast (press kit p. 103), QDST
C     (EXTSEED's distance, 60 m) along the reference boresight from
C     the camera.
      SUBROUTINE S8POSE
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION P(3)
      INTEGER I
      DO 10 I = 1, 3
        P(I) = QDST * BREF(I)
   10 CONTINUE
      CALL STKPL(S8AT, P, KLMS)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     REFTRN: the recipe's reference attitude turned by the situation's
C     TURN angles, QTRN: yaw, pitch, roll offsets in LOOK's sense.
C     Situation 9 (Apollo 8 Earthrise) turns the forward horizon view
C     to the framing of the photograph AS08-14-2383 as it is usually
C     shown (the film frame turned a quarter turn clockwise, the lunar
C     horizon at the bottom), with three angles FITTED by us (not
C     sourced; see its SITUATION card): they put the Earth's centre
C     where the photograph has it and the horizon at its tilt,
C     measured on the ASU scan; the Earth's size, its height above the
C     horizon and its phase are then checks, not inputs.
C-----------------------------------------------------------------------
      SUBROUTINE REFTRN
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER I
      CALL VCRS(BREF, UREF, RREF)
      CALL VUNIT(RREF)
      CALL LOOK(QTRN(1), QTRN(2), QTRN(3))
      DO 10 I = 1, 3
        BREF(I) = CB(I)
        UREF(I) = CU(I)
        RREF(I) = CR(I)
   10 CONTINUE
      RETURN
      END
