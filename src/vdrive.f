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
C              select scene ISC and return its default inputs.
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
C       vdrive.f  this driver: scenes, cameras, model placement
C       vlayer.f  the layer dispatcher and each scene's layer list
C       Core:  ephem.f (time, Sun, Moon), traj.f (trajectory legs,
C              the replay), sim.f (the engine), tape.f (the tape it
C              writes), vsrc.f (the state source: replay or tape),
C              pen.f (projection, clipping, visibility, vectors),
C              vtext.f (text records), vmath.f (vectors, matrices),
C              models.f (spacecraft model library)
C       Layers, one per drawable, all called as
C              LAYER(GET, VB, NV, SB, NS, LB, NL) by LAYERS:
C              lframe.f 1 plot frame, lstars.f 2 stars, lsun.f 3 Sun,
C              lmoon.f 4 Moon and craters (lmoon6.f its whole-disc
C              extras), learth.f 5 Earth, lvehic.f 6 vehicles,
C              lcoas.f 7 COAS reticle, lshad.f 8 LM shadow,
C              llpd.f 9 LPD and LM window
C       Data:  viewdata.f (BLOCK DATA, generated), viewcom.inc COMMON
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
C                                    the scenarios (data/scenarios),
C                                    the tape (tape.f)
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
C     RESTOMOD END
      INTEGER ISC
      DOUBLE PRECISION GET, YAW, PIT, ROL, FOV
      DOUBLE PRECISION R(3), V(3), PM(3), E(3), S(3), X, Y, TFIX
      INTEGER I, ISNSC(7)
      DOUBLE PRECISION VDOT, EVGET
C     The scenario of each scene: all Apollo 11 as flown for now.
      DATA ISNSC / 1, 1, 1, 1, 1, 1, 1 /
C
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (INITD .NE. 1) THEN
        CALL TABSET
        CALL MLIB
        ISN = 0
        INITD = 1
      END IF
C     RESTOMOD END
      ISCN = ISC
      IF (ISCN .LT. 1 .OR. ISCN .GT. 7) ISCN = 1
      IF (ISNSC(ISCN) .NE. ISN) CALL SNSET(ISNSC(ISCN))
      YAW = 0.0D0
      PIT = 0.0D0
      ROL = 0.0D0
C
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (ISCN .EQ. 1) THEN
C       EARTHRISE.  One minute before the Earth's disc clears the
C       lunar horizon on the revolution before the landing.  The view
C       is turned in azimuth (AZOFF) so the Earth rises mid-frame.
        CALL ERFIND
        GET = TERISE - 60.0D0
        FOV = 8.0D0
        CALL VSTATE(GET, 2, R, V)
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
      ELSE IF (ISCN .EQ. 2) THEN
C       EARTH APPROACH on the transearth coast.  The attitude is
C       held inertially: boresight ELOFF deg ahead of the Earth's
C       centre as seen at TFIX, up against the Earth's drift across
C       the sky, so the disc climbs in from below, grows, and leaves
C       only its limb arc as the spacecraft closes on entry.
        FXDT = 10.0D0 * 3600.0D0
        TFIX = TETP - FXDT
        GET = TETP - 5.0D0 * 3600.0D0
        FOV = 60.0D0
        ELOFF = 0.0D0
        CALL VSTATE(TFIX, 1, R, V)
        CALL VSTATE(TETP - 3600.0D0, 1, E, S)
        DO 22 I = 1, 3
          PM(I) = -R(I)
          E(I) = -E(I)
   22   CONTINUE
        CALL VUNIT(PM)
        CALL VUNIT(E)
C       Net drift of the Earth centre across the line of sight from
C       TFIX to an hour before entry.
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
      ELSE IF (ISCN .EQ. 3) THEN
C       EARTH PARKING ORBIT, looking forward at the horizon.
        GET = 1.5D0 * 3600.0D0
        FOV = 70.0D0
      ELSE IF (ISCN .EQ. 4) THEN
C       LM RENDEZVOUS / INSPECTION, two minutes after undocking.
        GET = EVGET(KEUND) + 120.0D0
        FOV = 12.0D0
      ELSE IF (ISCN .EQ. 7) THEN
C       TRANSPOSITION AND DOCKING.  Mid-approach, about 56 ft out
C       (see S7POSE for the closing law), looking along the CSM +X
C       axis at the LM docking target.  Field of view: ours.
        GET = EVGET(KEAPR) + 60.0D0
        FOV = 30.0D0
      ELSE IF (ISCN .EQ. 6) THEN
C       MOON VIEW (a modern addition, not a 1969 plot type we have a
C       source for).  The camera sits 35,000 km above the sub-observer
C       point, our choice, which with the field below puts the disc at
C       85 percent of the frame; yaw and pitch then move the
C       sub-observer point (see SCNCAM).  GET at touchdown, so the
C       terminator falls as it did for the landing.
        GET = LUT0
        S6DST = RM + 35000.0D0
        FOV = DBLE(NINT(20.0D0 * DASIN(RM / S6DST) / DR / 0.85D0))
     &      / 10.0D0
      ELSE
C       LM DESCENT, commander's front window, P64 approach.
        GET = 102.0D0*3600.0D0 + 42.0D0*60.0D0
C       The film's descent frame is numbered to +-50 at its edges; in
C       the gnomonic plot (see PROJ) that is a physical field of
C       2 ATAN(50 deg in radians) = 82.4 deg.
        FOV = 82.4D0
      END IF
C     RESTOMOD END
      RETURN
      END
C
C=======================================================================
      SUBROUTINE VFRAME(GET, YAW, PIT, ROL, FOV, IFLAG,
     &                  VB, NV, SB, NS, LB, NL, HD, TB, NT, TC, NCH)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, YAW, PIT, ROL, FOV
      INTEGER IFLAG, NV, NS, NL
      DOUBLE PRECISION VB(5,MAXV), SB(3,MAXS), LB(4,MAXL), HD(24)
      DOUBLE PRECISION TB(4,MAXT)
      INTEGER NT, TC(MAXTC), NCH
      DOUBLE PRECISION PM(3), CG(3), CV(3), RB, RNG, D1, D2, D3, D4
      DOUBLE PRECISION PB(3), RR, VNRM, VDOT, RHO
      INTEGER I, IREF, IWIN, IOK, J
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
      IFLG = IFLAG
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
      CALL SCNMOD(GET)
      DO 20 I = 1, 3
        EPOS(I) = -CG(I)
        MPOS(I) = PM(I) - CG(I)
   20 CONTINUE
      CALL MTXV(MMF, MPOS, CAMF)
      DO 30 I = 1, 3
        CAMF(I) = -CAMF(I)
   30 CONTINUE
C
C     Free look, then the boresight in the Moon frame.
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (ISCN .EQ. 6) THEN
        CALL LOOK(0.0D0, 0.0D0, ROL)
      ELSE
        CALL LOOK(YAW, PIT, ROL)
      END IF
C     RESTOMOD END
      CALL MTXV(MMF, CB, CBMF)
C
      ISTYLE = 1
C     The scene's layers, in order (vlayer.f).
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
      IF (ISCN .EQ. 4) HD(9) = 300.0D0
C     Scene 5: the footpads' altitude (LMDESC), 0 at touchdown.
      IF (ISCN .EQ. 5) HD(10) = LMALT * 1000.0D0 / 0.3048D0
      IF (ISCN .EQ. 7) HD(9) = S7RNG
C     Reference body in the picture, for the page's camera steering:
C     centre X, Y (deg, even off frame), angular radius, in front flag.
C     Scene 4: the LM.  Scene 7: the LM's docking target (S7POSE).
      DO 40 I = 1, 3
        PB(I) = EPOS(I)
        IF (IREF .EQ. 2) PB(I) = MPOS(I)
        IF (ISCN .EQ. 4) PB(I) = 300.0D0 * 0.3048D-3 * BREF(I)
        IF (ISCN .EQ. 7) PB(I) = S7LP(I) - 0.72D-3 * S7AT(I,2)
   40 CONTINUE
      RR = RE
      IF (IREF .EQ. 2) RR = RM
      IF (ISCN .EQ. 4) RR = 4.5D-3
C     Scene 7: the LM, half its 14 ft 1 in width (Apollo 11 press kit,
C     printed p. 96).
      IF (ISCN .EQ. 7) RR = 2.15D-3
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
      HD(14) = 0.0D0
      IF (VDOT(PB, CB) .GT. 0.0D0) HD(14) = 1.0D0
C     Text for the recorder's character generator.
      CALL TXALL(LB, NL, TB, NT, TC, NCH)
      RETURN
      END
C
C=======================================================================
C     SCENE CAMERAS.  Position, velocity, reference body and the
C     reference attitude RREF, UREF, BREF for scene ISCN at GET.
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
      DOUBLE PRECISION XB(3), YB(3), ZB(3), PMF(3), VNRM
      INTEGER I
C
      IWIN = 1
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (ISCN .EQ. 1 .OR. ISCN .EQ. 4) THEN
C       CSM in lunar orbit.
        IREF = 2
        CALL VSTATE(GET, 2, R, V)
        DO 10 I = 1, 3
          CG(I) = PM(I) + R(I)
          CV(I) = V(I)
          RU(I) = R(I)
          VU(I) = V(I)
   10   CONTINUE
        CALL VUNIT(RU)
        CALL VUNIT(VU)
        IF (ISCN .EQ. 1) THEN
C         Forward along the orbit, turned AZOFF in azimuth, down to
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
        ELSE
C         Out of plane toward the LM, local vertical up.
          CALL VCRS(RU, VU, BREF)
          DO 30 I = 1, 3
            UREF(I) = RU(I)
   30     CONTINUE
        END IF
      ELSE IF (ISCN .EQ. 2) THEN
C       Coast.  Attitude held inertially (FXB, FXU, set by VINIT).
        IREF = 1
        CALL VSTATE(GET, 1, R, V)
        DO 40 I = 1, 3
          CG(I) = R(I)
          CV(I) = V(I)
          BREF(I) = FXB(I)
          UREF(I) = FXU(I)
   40   CONTINUE
      ELSE IF (ISCN .EQ. 3) THEN
C       Parking orbit.  Forward, boresight 8 deg above the horizon.
        IREF = 1
        CALL VSTATE(GET, 1, R, V)
        DO 70 I = 1, 3
          CG(I) = R(I)
          CV(I) = V(I)
          RU(I) = R(I)
          VU(I) = V(I)
   70   CONTINUE
        CALL VUNIT(RU)
        CALL VUNIT(VU)
        DIP = DACOS(RE / VNRM(R)) - 8.0D0 * DR
        CD = DCOS(DIP)
        SD = DSIN(DIP)
        DO 80 I = 1, 3
          BREF(I) = CD * VU(I) - SD * RU(I)
          UREF(I) = SD * VU(I) + CD * RU(I)
   80   CONTINUE
      ELSE IF (ISCN .EQ. 6) THEN
C       Moon view: looking at the centre from above the sub-observer
C       point (S6LAT, S6LON), selenographic north up (our choice; a
C       J2000-north layout would do as well).
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
      ELSE IF (ISCN .EQ. 7) THEN
C       Transposition and docking.  The CSM on the translunar ellipse
C       (30 m from the S-IVB, nothing at this scale), turned around to
C       face the stack, which holds an inertial attitude (S7ATT).
C       Boresight along the CSM +X axis, which is down the LM's -X
C       axis; the LM front (+Z) up.
        IREF = 1
        CALL VSTATE(GET, 1, R, V)
        CALL S7ATT
        DO 110 I = 1, 3
          CG(I) = R(I)
          CV(I) = V(I)
          BREF(I) = -S7AT(I,1)
          UREF(I) = S7AT(I,3)
  110   CONTINUE
      ELSE
C       LM descent.  Boresight 46 deg down from the LM +Z axis in
C       the X-Z plane, so the LPD scale 0..80 deg runs top to bottom.
        IREF = 2
        IWIN = 2
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
        CD = DCOS(46.0D0 * DR)
        SD = DSIN(46.0D0 * DR)
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
C     is drawn, since placed solids hide stars and bodies).
C-----------------------------------------------------------------------
      SUBROUTINE SCNMOD(GET)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET
      CALL MCLEAR
      IF (ISCN .EQ. 4) CALL LMPIRO(GET)
      IF (ISCN .EQ. 7) CALL S7POSE(GET)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     LMPIRO: the LM 300 ft from the CSM along the reference
C     boresight, turning slowly for inspection (scene 4).
C-----------------------------------------------------------------------
      SUBROUTINE LMPIRO(GET)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET
      DOUBLE PRECISION AT(3,3), R1(3,3), R2(3,3), R3(3,3), R4(3,3)
      DOUBLE PRECISION BX(3,3), LP(3), BO(3), T, PS, TH, PH, DIST
      DOUBLE PRECISION EVGET
      INTEGER I
C     Body axes in the reference frame: X up, Z toward the camera.
      DO 10 I = 1, 3
        BX(I,1) = UREF(I)
        BX(I,2) = -RREF(I)
        BX(I,3) = -BREF(I)
   10 CONTINUE
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
      DIST = 300.0D0 * 0.3048D-3
      DO 20 I = 1, 3
        LP(I) = DIST * BREF(I)
   20 CONTINUE
C     Centred on the stage joint.
      CALL SETV(BO, 2.3D0, 0.0D0, 0.0D0)
      CALL MPLACE(KLMD, AT, LP, BO)
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
      DOUBLE PRECISION GET, TCLS, TDOK, U, A, D, V(3), W(3), Z(3)
      DOUBLE PRECISION PS(3), EVGET
      INTEGER I
C     Approach start and docking from the scenario (APPR, DOCK).
      TCLS = EVGET(KEAPR)
      TDOK = EVGET(KEDOK)
      U = (TDOK - GET) / (TDOK - TCLS)
      IF (U .GT. 1.0D0) U = 1.0D0
      IF (U .LT. 0.0D0) U = 0.0D0
      A = 0.1D0 * (TDOK - TCLS) / 100.0D0
      S7RNG = 100.0D0 * (A * U + (1.0D0 - A) * U * U)
C     The camera is the COAS in the CSM's left rendezvous window,
C     looking parallel to the docking axis 0.72 m to the LM's -Y side
C     of it and 2 m behind the CSM's docking ring (our guesses; the
C     target is set off to match, LMDOCK).  S7BO: the tunnel top.
      CALL SETV(S7BO, 4.35D0, 0.0D0, -0.6D0)
      D = (S7RNG * 0.3048D0 + 2.0D0) * 1.0D-3
      DO 10 I = 1, 3
        S7LP(I) = D * BREF(I) + 0.72D-3 * S7AT(I,2)
   10 CONTINUE
      CALL MPLACE(KLMS, S7AT, S7LP, S7BO)
C     The S-IVB on the same axes, the top of its IU 1.5 m below the
C     LM's base on the descent stage's axis (Y = Z = 0), which puts
C     the LM tunnel near the top of the 28 ft SLA (press kit, printed
C     p. 88) with room for the SPS nozzle: our guess.  Our LM model
C     has its tunnel 0.6 m aft of that axis.
      CALL SETV(V, (-1.5D0 - S7BO(1)) * 1.0D-3, -S7BO(2) * 1.0D-3,
     &          -S7BO(3) * 1.0D-3)
      CALL MXV(S7AT, V, W)
      DO 20 I = 1, 3
        PS(I) = S7LP(I) + W(I)
   20 CONTINUE
      CALL SETV(Z, 0.0D0, 0.0D0, 0.0D0)
      CALL MPLACE(KSIV, S7AT, PS, Z)
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
      CALL VSTATE(T, 1, R, V)
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
