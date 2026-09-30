C=======================================================================
C
C     V I E W - 1 1 0 8          WINDOW VIEW KERNEL
C
C     Draws what an Apollo 11 crewman would see out of a window, as
C     line vectors and star points in plot degrees, for a film
C     recorder to expose.  After the MSC program VIEW (G. B. Roush;
C     documented by A. N. Lunde and C. T. Hyle).  New code; the target
C     is the surviving output, MSC IN 69-FM-197 and the film clip.
C
C     ENTRY POINTS (called by the chassis, shell.f90)
C       VINIT  (ISC, GET, YAW, PIT, ROL, FOV)
C              select scene ISC and return its default inputs.
C       VFRAME (GET, YAW, PIT, ROL, FOV, IFLAG,
C               VB, NV, SB, NS, LB, NL, HD)
C              draw one frame.  VB(5,MAXV) line vectors X1 Y1 X2 Y2
C              STYLE, SB(3,MAXS) points X Y MAG, LB(4,MAXL) labels
C              X Y KIND ID, HD(16) header values.
C
C     WORLD MODEL (low precision on purpose)
C       Moon and Sun: the low precision series of the Astronomical
C       Almanac (Meeus ch. 25 and 47 truncated), ecliptic of date,
C       carried to the J2000 equinox by the general precession in
C       longitude.  Moon orientation: IAU (Archinal et al.) with its
C       periodic terms.  Earth rotation: GMST, pole fixed.
C
C     TRAJECTORIES.  Our own simple models, keyed to Apollo 11 GETs.
C     VIEW itself integrated trajectories (TN D-6853); the numbers
C     below that are not event times are our choices, not sources.
C       Parking orbit: 100 n.mi. circle, plane through KSC at lift-off
C         with launch azimuth 72 deg, insertion at 0:11:49.
C       Translunar coast: Kepler ellipse, perigee 185 km at TLI cutoff
C         2:50:02, in the Moon's orbit plane, reaching the Moon's
C         distance at GET 76:00:00 where the Moon then is.
C       Lunar orbit: 60 n.mi. circle, retrograde, heading 268.8 deg
C         over the landing site at touchdown, GET 102:45:40.
C       LM descent: P64 approach from 7200 ft altitude and 25600 ft
C         range at GET 102:41:30 down to the site at touchdown.
C
C     PROJECTION
C       Angle-angle about the window's lateral axis; see PROJ.
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
      INTEGER I
      DOUBLE PRECISION VDOT
C
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (INITD .NE. 1) THEN
        CALL TABSET
        CALL ORBSET
        CALL MLIB
        INITD = 1
      END IF
C     RESTOMOD END
      ISCN = ISC
      IF (ISCN .LT. 1 .OR. ISCN .GT. 7) ISCN = 1
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
        CALL LUNORB(GET, R, V)
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
        TFIX = TETP - FXDT
        GET = TETP - 5.0D0 * 3600.0D0
        FOV = 60.0D0
        ELOFF = 0.0D0
        CALL TLIORB(TFIX, R, V)
        CALL TLIORB(TETP - 3600.0D0, E, S)
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
C       LM RENDEZVOUS / INSPECTION after undocking at 100:12.
        GET = 100.0D0*3600.0D0 + 14.0D0*60.0D0
        FOV = 12.0D0
      ELSE IF (ISCN .EQ. 7) THEN
C       TRANSPOSITION AND DOCKING.  Mid-approach, about 56 ft out
C       (see S7POSE for the closing law), looking along the CSM +X
C       axis at the LM docking target.  Field of view: ours.
        GET = 3.0D0*3600.0D0 + 21.0D0*60.0D0 + 30.0D0
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
      DOUBLE PRECISION VB(5,MAXV), SB(3,MAXS), LB(4,MAXL), HD(16)
      DOUBLE PRECISION TB(4,MAXT)
      INTEGER NT, TC(MAXTC), NCH
      DOUBLE PRECISION PM(3), CG(3), CV(3), RB, RNG, D1, D2, D3, D4
      DOUBLE PRECISION PB(3), RR, VNRM, VDOT, RHO
      INTEGER I, IREF, IWIN, IOK
C
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (INITD .NE. 1 .OR. ISCN .EQ. 0) THEN
        CALL VINIT(1, D1, D2, D3, D4, RB)
      END IF
C     RESTOMOD END
      NV = 0
      NS = 0
      NL = 0
      DO 10 I = 1, 16
        HD(I) = 0.0D0
   10 CONTINUE
      IFLG = IFLAG
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
      CALL ROTZ(GMST, MEF)
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
      IF (MOD(IFLG/2, 2) .EQ. 1) CALL DFRAME(VB, NV)
      IF (ISCN .NE. 4) CALL DSTARS(SB, NS, LB, NL)
      CALL DSUN(VB, NV, LB, NL)
      CALL DMOON(VB, NV, LB, NL)
      CALL DEARTH(VB, NV, LB, NL)
      CALL MDRALL(VB, NV)
      IF (ISCN .EQ. 7) CALL S7COAS(VB, NV)
      IF (ISCN .EQ. 5) CALL LMSHAD(VB, NV, GET)
      IF (ISCN .EQ. 5) CALL OVLPD(VB, NV)
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
      IF (ISCN .EQ. 5) HD(10) = (RNG - RB) * 1000.0D0 / 0.3048D0
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
      HD(14) = 0.0D0
      IF (VDOT(PB, CB) .GT. 0.0D0) HD(14) = 1.0D0
C     Text for the recorder's character generator.
      CALL TXALL(LB, NL, TB, NT, TC, NCH)
      RETURN
      END
C
C=======================================================================
C     TEXT.  Records for the recorder's character generator (the SC-4020
C     class had a "type character" order; docs/univac-1108.md): X, Y
C     of the first character's lower left (plot deg), height (plot
C     deg), start index in TC; each string is character codes ending
C     in 0.  Tick numbers when IFLG bit 1 is set, at the ticks DFRAME
C     draws, OUTSIDE the box: left edge right-aligned, right edge,
C     bottom edge centred below, 1.0 percent of the field high (read
C     from the film, descent_t29.png, and the report's plot pages).
C     Names of nav stars, Sun, Earth and Moon beside their labels when
C     bit 0 is set, 1.4 percent of the field high.  Crater names stay
C     with the page (LB kind 2).  Character width 0.7 of the height,
C     used for alignment: ours.
C=======================================================================
      SUBROUTINE TXALL(LB, NL, TB, NT, TC, NCH)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION LB(4,MAXL), TB(4,MAXT)
      INTEGER NL, NT, TC(MAXTC), NCH
      DOUBLE PRECISION B, ST, TL, H, V
      INTEGER I, J, K, N, ID, IC(24)
      NT = 0
      NCH = 0
      B = BOXH
      H = 0.02D0 * B
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (MOD(IFLG / 2, 2) .EQ. 1) THEN
        ST = 20.0D0
        IF (2.0D0 * B .LE. 60.0D0) ST = 10.0D0
        IF (2.0D0 * B .LE. 25.0D0) ST = 5.0D0
        TL = 0.02D0 * B
        N = INT(B / ST + 1.0D-9)
        DO 10 K = -N, N
          V = DBLE(K) * ST
          IF (DABS(V) .GE. B - 1.0D-9) GO TO 10
          CALL ITOC(NINT(V), IC, J)
          CALL TXPUT(TB, NT, TC, NCH, V - 0.35D0 * H * DBLE(J),
     &               -B - 1.5D0 * H, H, IC, J)
          CALL TXPUT(TB, NT, TC, NCH, -B - 0.5D0 * H
     &               - 0.7D0 * H * DBLE(J), V - 0.5D0 * H, H, IC, J)
          CALL TXPUT(TB, NT, TC, NCH, B + 0.5D0 * H,
     &               V - 0.5D0 * H, H, IC, J)
   10   CONTINUE
      END IF
C     RESTOMOD END
      IF (MOD(IFLG, 2) .EQ. 0) RETURN
      H = 0.028D0 * B
      DO 40 I = 1, NL
        K = NINT(LB(3,I))
        ID = NINT(LB(4,I))
        N = 0
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (K .EQ. 1 .AND. ID .GE. 1 .AND. ID .LE. NNAV) THEN
          DO 20 J = 1, 10
            IF (NAVCH((ID - 1) * 10 + J) .EQ. 0) GO TO 30
            N = N + 1
            IC(N) = NAVCH((ID - 1) * 10 + J)
   20     CONTINUE
        ELSE IF (K .GE. 3 .AND. K .LE. 5) THEN
          DO 25 J = 1, 5
            IF (BODCH((K - 3) * 5 + J) .EQ. 0) GO TO 30
            N = N + 1
            IC(N) = BODCH((K - 3) * 5 + J)
   25     CONTINUE
        ELSE IF (K .EQ. 6 .AND. ID .GE. 1 .AND. ID .LE. NMARE) THEN
C         Mare names centred on the mare's centre.
          DO 26 J = 1, 24
            IF (MRCH((ID - 1) * 24 + J) .EQ. 0) GO TO 27
            N = N + 1
            IC(N) = MRCH((ID - 1) * 24 + J)
   26     CONTINUE
   27     IF (N .GT. 0) CALL TXPUT(TB, NT, TC, NCH,
     &      LB(1,I) - 0.35D0 * H * DBLE(N), LB(2,I) - 0.5D0 * H,
     &      H, IC, N)
          GO TO 40
        ELSE IF (K .EQ. 7) THEN
          DO 28 J = 1, 22
            N = N + 1
            IC(N) = SITECH(J)
   28     CONTINUE
        END IF
C     RESTOMOD END
   30   IF (N .GT. 0) CALL TXPUT(TB, NT, TC, NCH, LB(1,I) + 0.4D0 * H,
     &                         LB(2,I) + 0.4D0 * H, H, IC, N)
   40 CONTINUE
      RETURN
      END
C
C     TXPUT: append a text record of N codes IC.
      SUBROUTINE TXPUT(TB, NT, TC, NCH, X, Y, H, IC, N)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION TB(4,MAXT), X, Y, H
      INTEGER NT, TC(MAXTC), NCH, IC(24), N, K
      IF (NT .GE. MAXT .OR. NCH + N + 1 .GT. MAXTC) RETURN
      NT = NT + 1
      TB(1,NT) = X
      TB(2,NT) = Y
      TB(3,NT) = H
      TB(4,NT) = DBLE(NCH + 1)
      DO 10 K = 1, N
        TC(NCH + K) = IC(K)
   10 CONTINUE
      NCH = NCH + N + 1
      TC(NCH) = 0
      RETURN
      END
C
C     ITOC: integer IV to character codes IC(1..N), ASCII digits.
      SUBROUTINE ITOC(IV, IC, N)
      INTEGER IV, IC(24), N, M, K, D(10), ND
      M = IABS(IV)
      ND = 0
   10 ND = ND + 1
      D(ND) = MOD(M, 10)
      M = M / 10
      IF (M .GT. 0 .AND. ND .LT. 10) GO TO 10
      N = 0
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (IV .LT. 0) THEN
        N = 1
        IC(1) = 45
      END IF
C     RESTOMOD END
      DO 20 K = ND, 1, -1
        N = N + 1
        IC(N) = 48 + D(K)
   20 CONTINUE
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
        CALL LUNORB(GET, R, V)
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
        CALL TLIORB(GET, R, V)
        DO 40 I = 1, 3
          CG(I) = R(I)
          CV(I) = V(I)
          BREF(I) = FXB(I)
          UREF(I) = FXU(I)
   40   CONTINUE
      ELSE IF (ISCN .EQ. 3) THEN
C       Parking orbit.  Forward, boresight 8 deg above the horizon.
        IREF = 1
        CALL PARKOR(GET, R, V)
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
        CALL TLIORB(GET, R, V)
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
C     TIME AND EPHEMERIDES
C=======================================================================
      SUBROUTINE TSET(GET)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET
C     RESTOMOD BEGIN: J2000 epoch (IAU 1976/1984), GMST of Aoki 1982
      TJD = JD0 + GET / 86400.0D0
      TDAY = TJD - 2451545.0D0
      TCEN = TDAY / 36525.0D0
      GMST = DMOD(280.46061837D0 + 360.98564736629D0 * TDAY, 360.0D0)
      GMST = GMST * DR
C     RESTOMOD END
      RETURN
      END
C
C-----------------------------------------------------------------------
C     MOONG: geocentric Moon, EQ km.
C-----------------------------------------------------------------------
      SUBROUTINE MOONG(GET, P)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, P(3)
      DOUBLE PRECISION T, L, B, HP, R, CE, SE, X, Y, Z, SND
C     RESTOMOD BEGIN: Astronomical Almanac low-precision Moon, 1980s
      T = (JD0 + GET / 86400.0D0 - 2451545.0D0) / 36525.0D0
      L = 218.32D0 + 481267.881D0 * T
     &  + 6.29D0 * SND(135.0D0 + 477198.87D0 * T)
     &  - 1.27D0 * SND(259.3D0 - 413335.36D0 * T)
     &  + 0.66D0 * SND(235.7D0 + 890534.22D0 * T)
     &  + 0.21D0 * SND(269.9D0 + 954397.74D0 * T)
     &  - 0.19D0 * SND(357.5D0 + 35999.05D0 * T)
     &  - 0.11D0 * SND(186.5D0 + 966404.03D0 * T)
      B = 5.13D0 * SND(93.3D0 + 483202.02D0 * T)
     &  + 0.28D0 * SND(228.2D0 + 960400.89D0 * T)
     &  - 0.28D0 * SND(318.3D0 + 6003.15D0 * T)
     &  - 0.17D0 * SND(217.6D0 - 407332.21D0 * T)
      HP = 0.9508D0
     &  + 0.0518D0 * SND(225.0D0 + 477198.87D0 * T)
     &  + 0.0095D0 * SND(349.3D0 - 413335.36D0 * T)
     &  + 0.0078D0 * SND(325.7D0 + 890534.22D0 * T)
     &  + 0.0028D0 * SND(359.9D0 + 954397.74D0 * T)
      R = 6378.14D0 / DSIN(HP * DR)
C     Equinox of date to J2000: general precession in longitude.
      L = (L - 1.3969713D0 * T) * DR
      B = B * DR
      CE = DCOS(23.4392911D0 * DR)
      SE = DSIN(23.4392911D0 * DR)
      X = DCOS(B) * DCOS(L)
      Y = DCOS(B) * DSIN(L)
      Z = DSIN(B)
      P(1) = R * X
      P(2) = R * (CE * Y - SE * Z)
      P(3) = R * (SE * Y + CE * Z)
C     RESTOMOD END
      RETURN
      END
C
C-----------------------------------------------------------------------
C     SND: sine of an angle in degrees, reduced first.
C-----------------------------------------------------------------------
      DOUBLE PRECISION FUNCTION SND(A)
      DOUBLE PRECISION A
      DOUBLE PRECISION PI, DR
C     RESTOMOD: real-valued PARAMETER; FORTRAN V PARAMETER was
C     integer-only (UP-4046 Rev 3, sec. 10.4.1, p. 10-8)
      PARAMETER (PI=3.141592653589793D0, DR=PI/180.0D0)
      SND = DSIN(DMOD(A, 360.0D0) * DR)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     SUNG: unit vector Earth to Sun, EQ.
C-----------------------------------------------------------------------
      SUBROUTINE SUNG(GET, U)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, U(3)
      DOUBLE PRECISION D, T, G, L, CE, SE, SND
C     RESTOMOD BEGIN: Astronomical Almanac low-precision Sun, 1980s
      D = JD0 + GET / 86400.0D0 - 2451545.0D0
      T = D / 36525.0D0
      G = 357.528D0 + 0.9856003D0 * D
      L = 280.460D0 + 0.9856474D0 * D + 1.915D0 * SND(G)
     &  + 0.020D0 * SND(2.0D0 * G)
      L = DMOD(L - 1.3969713D0 * T, 360.0D0) * DR
      CE = DCOS(23.4392911D0 * DR)
      SE = DSIN(23.4392911D0 * DR)
      U(1) = DCOS(L)
      U(2) = CE * DSIN(L)
      U(3) = SE * DSIN(L)
C     RESTOMOD END
      RETURN
      END
C
C-----------------------------------------------------------------------
C     MOONRT: Moon-fixed to EQ rotation, IAU pole and prime meridian
C     with the periodic terms E1..E13.  M = RZ(A0+90) RX(90-D0) RZ(W).
C-----------------------------------------------------------------------
      SUBROUTINE MOONRT(GET, M)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, M(3,3)
      DOUBLE PRECISION D, T, E(13), A0, D0, W, SND, CSD
      DOUBLE PRECISION R1(3,3), R2(3,3), R3(3,3), R4(3,3)
C     RESTOMOD BEGIN: IAU WGCCRE lunar orientation, 1980s-2010s
      D = JD0 + GET / 86400.0D0 - 2451545.0D0
      T = D / 36525.0D0
      E(1) = 125.045D0 - 0.0529921D0 * D
      E(2) = 250.089D0 - 0.1059842D0 * D
      E(3) = 260.008D0 + 13.0120009D0 * D
      E(4) = 176.625D0 + 13.3407154D0 * D
      E(5) = 357.529D0 + 0.9856003D0 * D
      E(6) = 311.589D0 + 26.4057084D0 * D
      E(7) = 134.963D0 + 13.0649930D0 * D
      E(8) = 276.617D0 + 0.3287146D0 * D
      E(9) = 34.226D0 + 1.7484877D0 * D
      E(10) = 15.134D0 - 0.1589763D0 * D
      E(11) = 119.743D0 + 0.0036096D0 * D
      E(12) = 239.961D0 + 0.1643573D0 * D
      E(13) = 25.053D0 + 12.9590088D0 * D
      A0 = 269.9949D0 + 0.0031D0 * T - 3.8787D0 * SND(E(1))
     &   - 0.1204D0 * SND(E(2)) + 0.0700D0 * SND(E(3))
     &   - 0.0172D0 * SND(E(4)) + 0.0072D0 * SND(E(6))
     &   - 0.0052D0 * SND(E(10)) + 0.0043D0 * SND(E(13))
      D0 = 66.5392D0 + 0.0130D0 * T + 1.5419D0 * CSD(E(1))
     &   + 0.0239D0 * CSD(E(2)) - 0.0278D0 * CSD(E(3))
     &   + 0.0068D0 * CSD(E(4)) - 0.0029D0 * CSD(E(6))
     &   + 0.0009D0 * CSD(E(7)) + 0.0008D0 * CSD(E(10))
     &   - 0.0009D0 * CSD(E(13))
      W = 38.3213D0 + 13.17635815D0 * D - 1.4D-12 * D * D
     &  + 3.5610D0 * SND(E(1)) + 0.1208D0 * SND(E(2))
     &  - 0.0642D0 * SND(E(3)) + 0.0158D0 * SND(E(4))
     &  + 0.0252D0 * SND(E(5)) - 0.0066D0 * SND(E(6))
     &  - 0.0047D0 * SND(E(7)) - 0.0046D0 * SND(E(8))
     &  + 0.0028D0 * SND(E(9)) + 0.0052D0 * SND(E(10))
     &  + 0.0040D0 * SND(E(11)) + 0.0019D0 * SND(E(12))
     &  - 0.0044D0 * SND(E(13))
      CALL ROTZ((A0 + 90.0D0) * DR, R1)
      CALL ROTX((90.0D0 - D0) * DR, R2)
      CALL ROTZ(DMOD(W, 360.0D0) * DR, R3)
      CALL MXM(R1, R2, R4)
      CALL MXM(R4, R3, M)
C     RESTOMOD END
      RETURN
      END
C
      DOUBLE PRECISION FUNCTION CSD(A)
      DOUBLE PRECISION A
      DOUBLE PRECISION PI, DR
C     RESTOMOD: real-valued PARAMETER; FORTRAN V PARAMETER was
C     integer-only (UP-4046 Rev 3, sec. 10.4.1, p. 10-8)
      PARAMETER (PI=3.141592653589793D0, DR=PI/180.0D0)
      CSD = DCOS(DMOD(A, 360.0D0) * DR)
      RETURN
      END
C
C=======================================================================
C     TRAJECTORIES
C=======================================================================
      SUBROUTINE ORBSET
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION M(3,3), S(3), N(3), E(3), H(3)
      DOUBLE PRECISION FI, LA, AZ, TH0
      INTEGER I
C
C     Lunar orbit.  Over the landing site (see DMOON6) at touchdown
C     heading 268.8 deg (westward, 1.2 deg south of west).
      LUT0 = 102.0D0*3600.0D0 + 45.0D0*60.0D0 + 40.0D0
      FI = 0.67416D0 * DR
      LA = 23.47314D0 * DR
      AZ = 268.8D0 * DR
      S(1) = DCOS(FI) * DCOS(LA)
      S(2) = DCOS(FI) * DSIN(LA)
      S(3) = DSIN(FI)
      N(1) = -DSIN(FI) * DCOS(LA)
      N(2) = -DSIN(FI) * DSIN(LA)
      N(3) = DCOS(FI)
      E(1) = -DSIN(LA)
      E(2) = DCOS(LA)
      E(3) = 0.0D0
      DO 10 I = 1, 3
        H(I) = DCOS(AZ) * N(I) + DSIN(AZ) * E(I)
   10 CONTINUE
      CALL MOONRT(LUT0, M)
      CALL MXV(M, S, LUP0)
      CALL MXV(M, H, LUV0)
      LURAD = RM + 60.0D0 * 1.852D0
      LUN = DSQRT(GMM / LURAD**3)
C
C     Parking orbit.  KSC 28.6083 N 80.6041 W, azimuth 72 deg, plane
C     fixed in inertial space at lift-off; insertion at 0:11:49 about
C     18 deg down range.
      TH0 = DMOD(280.46061837D0 + 360.98564736629D0 *
     &      (JD0 - 2451545.0D0), 360.0D0) * DR
      FI = 28.6083D0 * DR
      LA = TH0 - 80.6041D0 * DR
      AZ = 72.0D0 * DR
      PKP0(1) = DCOS(FI) * DCOS(LA)
      PKP0(2) = DCOS(FI) * DSIN(LA)
      PKP0(3) = DSIN(FI)
      N(1) = -DSIN(FI) * DCOS(LA)
      N(2) = -DSIN(FI) * DSIN(LA)
      N(3) = DCOS(FI)
      E(1) = -DSIN(LA)
      E(2) = DCOS(LA)
      E(3) = 0.0D0
      DO 20 I = 1, 3
        PKV0(I) = DCOS(AZ) * N(I) + DSIN(AZ) * E(I)
   20 CONTINUE
      PKRAD = RE + 100.0D0 * 1.852D0
      PKN = DSQRT(GME / PKRAD**3)
      PKT0 = 11.0D0 * 60.0D0 + 49.0D0
      PKU0 = 18.0D0 * DR
C
C     Translunar ellipse: perigee 185 km at TLI cutoff, reaching the
C     Moon's position at 76 h.  Transearth ellipse: perigee at entry
C     interface (122 km, 195:03) coming from the Moon's position at
C     TEI, 135:24.  Both in the plane of the Moon's orbit.
      TLTP = 2.0D0*3600.0D0 + 50.0D0*60.0D0 + 2.0D0
      CALL CONSOL(76.0D0 * 3600.0D0, TLTP, RE + 185.0D0, 1,
     &            TLP, TLQ, TLE, TLA)
      TETP = 195.0D0*3600.0D0 + 3.0D0*60.0D0 + 6.0D0
      FXDT = 10.0D0 * 3600.0D0
      CALL CONSOL(135.0D0*3600.0D0 + 24.0D0*60.0D0, TETP,
     &            RE + 122.0D0, -1, TEP, TEQ, TEE, TEA)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     CONSOL: Earth-centred ellipse with perigee radius RP at time TP
C     that passes through the Moon's position at time TA, in the
C     plane of the Moon's orbit.  ISGN = 1 outbound (TA after TP),
C     -1 inbound (TA before TP).  The true anomaly of the Moon point
C     is found by bisection on the time of flight.  Returns perigee
C     unit P, Q (90 deg ahead), eccentricity E, semi-major axis A.
C-----------------------------------------------------------------------
      SUBROUTINE CONSOL(TA, TP, RP, ISGN, P, Q, E, A)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION TA, TP, RP, P(3), Q(3), E, A
      INTEGER ISGN
      DOUBLE PRECISION PM(3), PM2(3), VM(3), MU(3), HM(3), V(3)
      DOUBLE PRECISION RMAG, TOFT, NLO, NHI, NU, EA, TOF, SG, VDOT
      INTEGER I, IT
      CALL MOONG(TA, PM)
      CALL MOONG(TA + 600.0D0, PM2)
      DO 10 I = 1, 3
        VM(I) = PM2(I) - PM(I)
        MU(I) = PM(I)
   10 CONTINUE
      RMAG = DSQRT(VDOT(PM, PM))
      CALL VUNIT(MU)
      CALL VCRS(MU, VM, HM)
      CALL VUNIT(HM)
      TOFT = DABS(TA - TP)
      NLO = DACOS((2.0D0 * RP - RMAG) / RMAG) + 1.0D-3
      NHI = PI - 1.0D-4
      DO 20 IT = 1, 60
        NU = 0.5D0 * (NLO + NHI)
        E = (RMAG - RP) / (RP - RMAG * DCOS(NU))
        A = RP / (1.0D0 - E)
        EA = 2.0D0 * DATAN(DSQRT((1.0D0 - E) / (1.0D0 + E))
     &     * DTAN(0.5D0 * NU))
        TOF = (EA - E * DSIN(EA)) * DSQRT(A**3 / GME)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (TOF .GT. TOFT) THEN
          NHI = NU
        ELSE
          NLO = NU
        END IF
C     RESTOMOD END
   20 CONTINUE
C     Perigee lies NU behind the Moon point (outbound) or ahead of it
C     (inbound), measured in the direction of motion about HM.
      SG = DBLE(ISGN)
      CALL VCRS(HM, MU, V)
      DO 30 I = 1, 3
        P(I) = MU(I) * DCOS(NU) - SG * V(I) * DSIN(NU)
   30 CONTINUE
      CALL VCRS(HM, P, Q)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     KEPLER: position and velocity at GET on the ellipse P, Q, E, A
C     with perigee at time TP.
C-----------------------------------------------------------------------
      SUBROUTINE KEPLER(P, Q, E, A, TP, GET, R, V)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION P(3), Q(3), E, A, TP, GET, R(3), V(3)
      DOUBLE PRECISION AM, EA, F, RR, B, C, S, VF
      INTEGER I, IT
      AM = DSQRT(GME / A**3) * (GET - TP)
      EA = AM
      IF (E .GT. 0.8D0) EA = PI * DSIGN(1.0D0, AM)
      IF (DABS(AM) .GT. PI) EA = AM
      DO 10 IT = 1, 50
        F = (EA - E * DSIN(EA) - AM) / (1.0D0 - E * DCOS(EA))
        EA = EA - F
        IF (DABS(F) .LT. 1.0D-12) GO TO 20
   10 CONTINUE
   20 C = DCOS(EA)
      S = DSIN(EA)
      B = DSQRT(1.0D0 - E * E)
      RR = A * (1.0D0 - E * C)
      VF = DSQRT(GME * A) / RR
      DO 30 I = 1, 3
        R(I) = A * ((C - E) * P(I) + B * S * Q(I))
        V(I) = VF * (-S * P(I) + B * C * Q(I))
   30 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     LUNORB: CSM relative to the Moon, EQ km and km/s.
C-----------------------------------------------------------------------
      SUBROUTINE LUNORB(GET, R, V)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, R(3), V(3), TH, C, S
      INTEGER I
      TH = LUN * (GET - LUT0)
      C = DCOS(TH)
      S = DSIN(TH)
      DO 10 I = 1, 3
        R(I) = LURAD * (C * LUP0(I) + S * LUV0(I))
        V(I) = LURAD * LUN * (C * LUV0(I) - S * LUP0(I))
   10 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     PARKOR: spacecraft in Earth parking orbit, geocentric EQ.
C-----------------------------------------------------------------------
      SUBROUTINE PARKOR(GET, R, V)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, R(3), V(3), TH, C, S
      INTEGER I
      TH = PKU0 + PKN * (GET - PKT0)
      C = DCOS(TH)
      S = DSIN(TH)
      DO 10 I = 1, 3
        R(I) = PKRAD * (C * PKP0(I) + S * PKV0(I))
        V(I) = PKRAD * PKN * (C * PKV0(I) - S * PKP0(I))
   10 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     TLIORB: spacecraft coasting between Earth and Moon, geocentric
C     EQ.  Translunar ellipse before 100 h, transearth after.
C-----------------------------------------------------------------------
      SUBROUTINE TLIORB(GET, R, V)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, R(3), V(3)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (GET .LT. 100.0D0 * 3600.0D0) THEN
        CALL KEPLER(TLP, TLQ, TLE, TLA, TLTP, GET, R, V)
      ELSE
        CALL KEPLER(TEP, TEQ, TEE, TEA, TETP, GET, R, V)
      END IF
C     RESTOMOD END
      RETURN
      END
C
C-----------------------------------------------------------------------
C     LMDESC: LM on the P64 approach.  Position PMF (Moon centred, MF,
C     km) and body axes XB (thrust, up), YB (right), ZB (forward).
C     Range and altitude fall as the square of time to go, so the line
C     of sight to the site stays near 16 deg below the horizontal;
C     the LM pitches up from 40 to 5 deg off vertical.
C-----------------------------------------------------------------------
      SUBROUTINE LMDESC(GET, PMF, XB, YB, ZB)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, PMF(3), XB(3), YB(3), ZB(3)
      DOUBLE PRECISION S(3), N(3), E(3), F(3), U(3), G(3)
      DOUBLE PRECISION FI, LA, AZ, TAU, Q, X, H, TP, C, SN
      INTEGER I
      FI = 0.67416D0 * DR
      LA = 23.47314D0 * DR
      AZ = 268.8D0 * DR
      S(1) = DCOS(FI) * DCOS(LA)
      S(2) = DCOS(FI) * DSIN(LA)
      S(3) = DSIN(FI)
      N(1) = -DSIN(FI) * DCOS(LA)
      N(2) = -DSIN(FI) * DSIN(LA)
      N(3) = DCOS(FI)
      E(1) = -DSIN(LA)
      E(2) = DCOS(LA)
      E(3) = 0.0D0
      DO 10 I = 1, 3
        F(I) = DCOS(AZ) * N(I) + DSIN(AZ) * E(I)
   10 CONTINUE
      TAU = LUT0 - GET
      IF (TAU .LT. 1.0D0) TAU = 1.0D0
      IF (TAU .GT. 600.0D0) TAU = 600.0D0
      Q = TAU / 250.0D0
      X = 7.80D0 * Q * Q
      H = 0.012D0 + 2.19D0 * Q * Q
      DO 20 I = 1, 3
        G(I) = S(I) - (X / RM) * F(I)
   20 CONTINUE
      CALL VUNIT(G)
      DO 30 I = 1, 3
        PMF(I) = (RM + H) * G(I)
        U(I) = G(I)
   30 CONTINUE
C     Forward direction made horizontal at the LM.
      C = F(1) * U(1) + F(2) * U(2) + F(3) * U(3)
      DO 40 I = 1, 3
        F(I) = F(I) - C * U(I)
   40 CONTINUE
      CALL VUNIT(F)
      TP = (5.0D0 + 35.0D0 * Q) * DR
      IF (TP .GT. 60.0D0 * DR) TP = 60.0D0 * DR
      C = DCOS(TP)
      SN = DSIN(TP)
      DO 50 I = 1, 3
        XB(I) = C * U(I) - SN * F(I)
        ZB(I) = SN * U(I) + C * F(I)
   50 CONTINUE
      CALL VCRS(ZB, XB, YB)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     ERFIND: time TERISE at which the Earth's disc clears the lunar
C     horizon, on the revolution ending at touchdown.
C-----------------------------------------------------------------------
      SUBROUTINE ERFIND
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION T, T1, T2, TM, F1, FM, P, ERCLR
      INTEGER I
      P = 2.0D0 * PI / LUN
      T1 = LUT0 - P
      F1 = ERCLR(T1)
      DO 10 I = 1, 720
        T = LUT0 - P + DBLE(I) * P / 720.0D0
        FM = ERCLR(T)
        IF (F1 .LT. 0.0D0 .AND. FM .GE. 0.0D0) GO TO 20
        T1 = T
        F1 = FM
   10 CONTINUE
      TERISE = LUT0 - 1800.0D0
      RETURN
   20 T2 = T
      DO 30 I = 1, 40
        TM = 0.5D0 * (T1 + T2)
        FM = ERCLR(TM)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (FM .LT. 0.0D0) THEN
          T1 = TM
        ELSE
          T2 = TM
        END IF
C     RESTOMOD END
   30 CONTINUE
      TERISE = T2
      RETURN
      END
C
C     ERCLR: angle (rad) of the Earth's lower limb above the lunar
C     horizon as seen from the CSM.
      DOUBLE PRECISION FUNCTION ERCLR(T)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION T, R(3), V(3), PM(3), E(3), DN(3), DE, VDOT
      INTEGER I
      CALL LUNORB(T, R, V)
      CALL MOONG(T, PM)
      DO 10 I = 1, 3
        E(I) = -PM(I) - R(I)
        DN(I) = -R(I)
   10 CONTINUE
      DE = DSQRT(VDOT(E, E))
      CALL VUNIT(E)
      CALL VUNIT(DN)
      ERCLR = DACOS(VDOT(E, DN)) - DASIN(RM / LURAD) - DASIN(RE / DE)
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
C=======================================================================
C     THE PEN.  Points are camera-relative EQ vectors (km).
C     PROJ   direction to plot degrees
C     UNPROJ plot degrees to a direction (reference or live camera)
C     EMIT   clip a plot-degree segment to the frame and store it
C     SEG    project and emit a 3-D segment
C     PEN    move (IP=0) or draw (IP=1) with the visibility test
C            IVMODE; a segment crossing from seen to hidden is cut at
C            the boundary by bisection.
C=======================================================================
C-----------------------------------------------------------------------
C     PROJECTION.  Radially symmetric about the boresight: a direction
C     at angle T from the boresight and position angle P (from the
C     right axis toward up) lands at radius RHO = K TAN(T/K), taken
C     in degrees (times 180/PI, so RHO is T in degrees near the
C     centre), at X = RHO COS P, Y = RHO SIN P.  K = 1 (gnomonic, true
C     perspective) up to a 100 deg field, rising linearly to K = 2
C     (stereographic) at 170 deg (PK, set in VFRAME).  The frame box
C     half-width is RHO(FOV/2) (BOXH).
C     Evidence, and it is our inference, not stated in either report:
C     the film's descent frames (t28, t31, t35; FOV about 100) show
C     the lunar horizon as a straight line at every height, and MSC
C     IN 69-FM-197 (PDF p. 170, docking window, FOV 100) shows it
C     straight across +-50 at Y = -30: a gnomonic plot draws every
C     great circle straight.  The same page's 170 deg front-window
C     panel shows a fisheye dome, which a stereographic plot gives
C     (conformal, circles stay circles); a gnomonic plot cannot reach
C     90 deg off axis at all.  The film's evenly spaced ticks,
C     labelled in degrees, fit a tangent-plane plot marked in degrees
C     at the centre.  (An earlier angle-angle mapping drew off-axis
C     circles as rounded squares.)  PTH returns T (rad).
C-----------------------------------------------------------------------
      SUBROUTINE PROJ(D, X, Y, IOK)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION D(3), X, Y, A, B, C, S, T, R
      INTEGER IOK
      A = D(1)*CR(1) + D(2)*CR(2) + D(3)*CR(3)
      B = D(1)*CU(1) + D(2)*CU(2) + D(3)*CU(3)
      C = D(1)*CB(1) + D(2)*CB(2) + D(3)*CB(3)
      S = DSQRT(A * A + B * B)
      T = DATAN2(S, C)
      PTH = T
      IOK = 1
      IF (T / DR .GT. THLIM) IOK = 0
      IF (T / DR .GT. THLIM) T = THLIM * DR
      R = PK * DTAN(T / PK) / DR
      X = 0.0D0
      Y = 0.0D0
      IF (S .GT. 0.0D0) X = R * A / S
      IF (S .GT. 0.0D0) Y = R * B / S
      RETURN
      END
C
C     RHO: plot radius (deg) of a direction T (rad) off the boresight.
      DOUBLE PRECISION FUNCTION RHO(T)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION T
      RHO = PK * DTAN(T / PK) / DR
      RETURN
      END
C
C     UNPROJ: plot (X, Y) to a unit direction D.  IREF=1: reference
C     attitude with K = 1, for window overlays fixed to the vehicle
C     (their plot coordinates were read off the film's 100 deg,
C     gnomonic frames); IREF=0: the live camera and PK.
      SUBROUTINE UNPROJ(X, Y, IREF, D)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION X, Y, D(3), A, B, C, R, T, Q
      INTEGER IREF, I
      R = DSQRT(X * X + Y * Y)
      Q = PK
      IF (IREF .EQ. 1) Q = 1.0D0
      T = Q * DATAN(R * DR / Q)
      C = DCOS(T)
      A = 0.0D0
      B = 0.0D0
      IF (R .GT. 0.0D0) A = DSIN(T) * X / R
      IF (R .GT. 0.0D0) B = DSIN(T) * Y / R
      DO 10 I = 1, 3
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (IREF .EQ. 1) THEN
          D(I) = C * BREF(I) + A * RREF(I) + B * UREF(I)
        ELSE
          D(I) = C * CB(I) + A * CR(I) + B * CU(I)
        END IF
C     RESTOMOD END
   10 CONTINUE
      RETURN
      END
C
C     EMIT: Liang-Barsky clip to the frame, then store.
      SUBROUTINE EMIT(VB, NV, X1, Y1, X2, Y2)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), X1, Y1, X2, Y2
      INTEGER NV
      DOUBLE PRECISION DX, DY, T0, T1, P(4), Q(4), R
      INTEGER K
C     RESTOMOD BEGIN: Liang-Barsky line clipping, published 1984
      DX = X2 - X1
      DY = Y2 - Y1
      P(1) = -DX
      Q(1) = X1 + BOXH
      P(2) = DX
      Q(2) = BOXH - X1
      P(3) = -DY
      Q(3) = Y1 + BOXH
      P(4) = DY
      Q(4) = BOXH - Y1
      T0 = 0.0D0
      T1 = 1.0D0
      DO 10 K = 1, 4
        IF (P(K) .EQ. 0.0D0) THEN
          IF (Q(K) .LT. 0.0D0) RETURN
        ELSE
          R = Q(K) / P(K)
          IF (P(K) .LT. 0.0D0) THEN
            IF (R .GT. T1) RETURN
            IF (R .GT. T0) T0 = R
          ELSE
            IF (R .LT. T0) RETURN
            IF (R .LT. T1) T1 = R
          END IF
        END IF
   10 CONTINUE
      IF (NV .GE. MAXV) RETURN
      NV = NV + 1
      VB(1,NV) = X1 + T0 * DX
      VB(2,NV) = Y1 + T0 * DY
      VB(3,NV) = X1 + T1 * DX
      VB(4,NV) = Y1 + T1 * DY
      VB(5,NV) = DBLE(ISTYLE)
C     RESTOMOD END
      RETURN
      END
C
C     SEG: 3-D segment A-B (camera relative) to the frame.  A segment
C     running past the projection's limit (THLIM off the boresight) is
C     cut at the limit by bisection.
      SUBROUTINE SEG(VB, NV, A, B)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), A(3), B(3)
      INTEGER NV
      DOUBLE PRECISION X1, Y1, X2, Y2, P(3), Q(3), M(3), XM, YM
      INTEGER K1, K2, KM, I, IT
      CALL PROJ(A, X1, Y1, K1)
      CALL PROJ(B, X2, Y2, K2)
      IF (K1 .EQ. 0 .AND. K2 .EQ. 0) RETURN
      IF (K1 .EQ. 1 .AND. K2 .EQ. 1) GO TO 50
C     P inside the limit, Q outside.
      DO 10 I = 1, 3
        P(I) = A(I)
        Q(I) = B(I)
        IF (K1 .EQ. 0) P(I) = B(I)
        IF (K1 .EQ. 0) Q(I) = A(I)
   10 CONTINUE
      DO 30 IT = 1, 20
        DO 20 I = 1, 3
          M(I) = 0.5D0 * (P(I) + Q(I))
   20   CONTINUE
        CALL PROJ(M, XM, YM, KM)
        DO 25 I = 1, 3
          IF (KM .EQ. 1) P(I) = M(I)
          IF (KM .EQ. 0) Q(I) = M(I)
   25   CONTINUE
   30 CONTINUE
      CALL PROJ(P, XM, YM, KM)
      IF (K1 .EQ. 1) X2 = XM
      IF (K1 .EQ. 1) Y2 = YM
      IF (K1 .EQ. 0) X1 = XM
      IF (K1 .EQ. 0) Y1 = YM
   50 CALL EMIT(VB, NV, X1, Y1, X2, Y2)
      RETURN
      END
C
      SUBROUTINE PEN(VB, NV, P, IP)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), P(3)
      INTEGER NV, IP
      DOUBLE PRECISION A(3), B(3), M(3)
      INTEGER IV, ISVIS, I, IT
      IV = ISVIS(P)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (IP .EQ. 1) THEN
        IF (IV .EQ. 1 .AND. IPV .EQ. 1) THEN
          CALL SEG(VB, NV, PPX, P)
        ELSE IF (IV .NE. IPV) THEN
C         Seen end in A, hidden end in B; home in on the boundary.
          DO 10 I = 1, 3
            IF (IV .EQ. 1) THEN
              A(I) = P(I)
              B(I) = PPX(I)
            ELSE
              A(I) = PPX(I)
              B(I) = P(I)
            END IF
   10     CONTINUE
          DO 30 IT = 1, 10
            DO 20 I = 1, 3
              M(I) = 0.5D0 * (A(I) + B(I))
   20       CONTINUE
            IF (ISVIS(M) .EQ. 1) THEN
              DO 22 I = 1, 3
                A(I) = M(I)
   22         CONTINUE
            ELSE
              DO 24 I = 1, 3
                B(I) = M(I)
   24         CONTINUE
            END IF
   30     CONTINUE
          IF (IV .EQ. 1) THEN
            CALL SEG(VB, NV, A, P)
          ELSE
            CALL SEG(VB, NV, PPX, A)
          END IF
        END IF
      END IF
C     RESTOMOD END
      DO 40 I = 1, 3
        PPX(I) = P(I)
   40 CONTINUE
      IPV = IV
      RETURN
      END
C
C-----------------------------------------------------------------------
C     ISVIS: 1 if camera-relative point P is seen, by IVMODE:
C       0 always
C       1 on the Earth's surface: facing us, not behind the Moon
C       2 on the Earth's limb: not behind the Moon
C       3 on the Moon's surface: facing us, not behind the Earth
C       4 as 1, and on the night side
C       5 on the Moon's limb: not behind the Earth
C       6 on the Moon's surface, facing us and on the night side
C-----------------------------------------------------------------------
      INTEGER FUNCTION ISVIS(P)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION P(3), N(3), OCCL, SILL
      INTEGER I, LMOCC
      ISVIS = 1
      IF (IVMODE .EQ. 0) RETURN
C     Placed spacecraft models hide what lies behind them.
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (NACT .GT. 0) THEN
        IF (LMOCC(P, 0) .EQ. 1) THEN
          ISVIS = 0
          RETURN
        END IF
      END IF
C     RESTOMOD END
C     From the LM the window sill hides everything below it.
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (ISCN .EQ. 5) THEN
        IF (SILL(P) .GT. 0.0D0) THEN
          ISVIS = 0
          RETURN
        END IF
      END IF
C     RESTOMOD END
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (IVMODE .EQ. 1 .OR. IVMODE .EQ. 4) THEN
        DO 10 I = 1, 3
          N(I) = P(I) - EPOS(I)
   10   CONTINUE
        IF (N(1)*P(1) + N(2)*P(2) + N(3)*P(3) .GE. 0.0D0) ISVIS = 0
        IF (IVMODE .EQ. 4 .AND. ISVIS .EQ. 1) THEN
          IF (N(1)*SUNU(1) + N(2)*SUNU(2) + N(3)*SUNU(3) .GT. 0.0D0)
     &      ISVIS = 0
        END IF
        IF (ISVIS .EQ. 1) THEN
          IF (OCCL(P, MPOS, RM) .GT. 0.0D0) ISVIS = 0
        END IF
      ELSE IF (IVMODE .EQ. 2) THEN
        IF (OCCL(P, MPOS, RM) .GT. 0.0D0) ISVIS = 0
      ELSE IF (IVMODE .EQ. 3) THEN
        DO 20 I = 1, 3
          N(I) = P(I) - MPOS(I)
   20   CONTINUE
        IF (N(1)*P(1) + N(2)*P(2) + N(3)*P(3) .GE. 0.0D0) ISVIS = 0
        IF (ISVIS .EQ. 1) THEN
          IF (OCCL(P, EPOS, RE) .GT. 0.0D0) ISVIS = 0
        END IF
      ELSE IF (IVMODE .EQ. 5) THEN
        IF (OCCL(P, EPOS, RE) .GT. 0.0D0) ISVIS = 0
      ELSE IF (IVMODE .EQ. 6) THEN
        DO 30 I = 1, 3
          N(I) = P(I) - MPOS(I)
   30   CONTINUE
        IF (N(1)*P(1) + N(2)*P(2) + N(3)*P(3) .GE. 0.0D0) ISVIS = 0
        IF (N(1)*SUNU(1) + N(2)*SUNU(2) + N(3)*SUNU(3) .GT. 0.0D0)
     &    ISVIS = 0
      END IF
C     RESTOMOD END
      RETURN
      END
C
C     SILL: > 0 if P lies below the LM window sill, 35 deg below the
C     centre of the reference (vehicle-fixed) frame.
      DOUBLE PRECISION FUNCTION SILL(P)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION P(3), B, C
      B = P(1)*UREF(1) + P(2)*UREF(2) + P(3)*UREF(3)
      C = P(1)*BREF(1) + P(2)*BREF(2) + P(3)*BREF(3)
C     Reference plot Y with K = 1 is TAN(T) SIN(P) = B / C (deg).
      SILL = 1.0D0
      IF (C .GT. 0.0D0) SILL = -35.0D0 - B / C / DR
      IF (C .LE. 0.0D0 .AND. B .GE. 0.0D0) SILL = -1.0D0
      RETURN
      END
C
C     OCCL: > 0 if the sight line from the camera to P passes inside
C     the sphere of centre S (camera relative) and radius R.
      DOUBLE PRECISION FUNCTION OCCL(P, S, R)
      DOUBLE PRECISION P(3), S(3), R, T, PP, D1, D2, D3
      PP = P(1)*P(1) + P(2)*P(2) + P(3)*P(3)
      T = (P(1)*S(1) + P(2)*S(2) + P(3)*S(3)) / PP
      IF (T .LT. 0.0D0) T = 0.0D0
      IF (T .GT. 1.0D0) T = 1.0D0
      D1 = T * P(1) - S(1)
      D2 = T * P(2) - S(2)
      D3 = T * P(3) - S(3)
      OCCL = R * R - (D1 * D1 + D2 * D2 + D3 * D3)
      RETURN
      END
C
C     RAYHIT: > 0 if the ray from the camera along unit U meets the
C     sphere of centre S, radius R.
      DOUBLE PRECISION FUNCTION RAYHIT(U, S, R)
      DOUBLE PRECISION U(3), S(3), R, B
      B = U(1)*S(1) + U(2)*S(2) + U(3)*S(3)
      RAYHIT = -1.0D0
      IF (B .LE. 0.0D0) RETURN
      RAYHIT = R * R - (S(1)*S(1) + S(2)*S(2) + S(3)*S(3) - B * B)
      RETURN
      END
C
C=======================================================================
C     PLOT FRAME.  Box at the field edge, ticks inward every 5 deg
C     up to a 25 deg field, 10 deg up to 60, else 20 deg, at
C     multiples of the step from 0 (the page letters those values).
C=======================================================================
      SUBROUTINE DFRAME(VB, NV)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV)
      INTEGER NV
      DOUBLE PRECISION ST, TL, B, X
      INTEGER K, N
      B = BOXH
      ST = 20.0D0
      IF (2.0D0 * B .LE. 60.0D0) ST = 10.0D0
      IF (2.0D0 * B .LE. 25.0D0) ST = 5.0D0
      TL = 0.02D0 * B
      CALL EMIT(VB, NV, -B, -B, B, -B)
      CALL EMIT(VB, NV, B, -B, B, B)
      CALL EMIT(VB, NV, B, B, -B, B)
      CALL EMIT(VB, NV, -B, B, -B, -B)
      N = INT(B / ST + 1.0D-9)
      DO 30 K = -N, N
        X = DBLE(K) * ST
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (DABS(X) .LT. B - 1.0D-9) THEN
          CALL EMIT(VB, NV, X, -B, X, -B + TL)
          CALL EMIT(VB, NV, X, B, X, B - TL)
          CALL EMIT(VB, NV, -B, X, -B + TL, X)
          CALL EMIT(VB, NV, B, X, B - TL, X)
        END IF
C     RESTOMOD END
   30 CONTINUE
      RETURN
      END
C
C=======================================================================
C     STARS.  Points inside the frame not behind the Earth or Moon.
C     Nav stars (1..37) labelled when IFLG bit 0 is set.
C=======================================================================
      SUBROUTINE DSTARS(SB, NS, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION SB(3,MAXS), LB(4,MAXL)
      INTEGER NS, NL
      DOUBLE PRECISION U(3), X, Y, RAYHIT
      INTEGER I, IOK, LMOCC
      DO 10 I = 1, NSTAR
        U(1) = STX(I)
        U(2) = STY(I)
        U(3) = STZ(I)
        IF (U(1)*CB(1) + U(2)*CB(2) + U(3)*CB(3) .LT. CSVIEW) GO TO 10
        CALL PROJ(U, X, Y, IOK)
        IF (DABS(X) .GT. BOXH .OR. DABS(Y) .GT. BOXH) GO TO 10
        IF (RAYHIT(U, EPOS, RE) .GT. 0.0D0) GO TO 10
        IF (RAYHIT(U, MPOS, RM) .GT. 0.0D0) GO TO 10
C       Behind a placed spacecraft model (U taken as a point 1 km out).
        IF (NACT .EQ. 0) GO TO 8
        IF (LMOCC(U, 0) .EQ. 1) GO TO 10
    8   IF (NS .GE. MAXS) RETURN
        NS = NS + 1
        SB(1,NS) = X
        SB(2,NS) = Y
        SB(3,NS) = STM(I)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (I .LE. NNAV .AND. MOD(IFLG, 2) .EQ. 1) THEN
          CALL LABEL(LB, NL, X, Y, 1, I)
        END IF
C     RESTOMOD END
   10 CONTINUE
      RETURN
      END
C
      SUBROUTINE LABEL(LB, NL, X, Y, KIND, ID)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION LB(4,MAXL), X, Y
      INTEGER NL, KIND, ID
      IF (NL .GE. MAXL) RETURN
      IF (DABS(X) .GT. BOXH .OR. DABS(Y) .GT. BOXH) RETURN
      NL = NL + 1
      LB(1,NL) = X
      LB(2,NL) = Y
      LB(3,NL) = DBLE(KIND)
      LB(4,NL) = DBLE(ID)
      RETURN
      END
C
C=======================================================================
C     SUN.  A circle of the Sun's apparent size where it is in view.
C=======================================================================
      SUBROUTINE DSUN(VB, NV, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), LB(4,MAXL)
      INTEGER NV, NL
      DOUBLE PRECISION X, Y, RAYHIT, A, C, S
      INTEGER IOK, K, LMOCC
      IF (SUNU(1)*CB(1) + SUNU(2)*CB(2) + SUNU(3)*CB(3) .LT. CSVIEW)
     &  RETURN
      IF (RAYHIT(SUNU, EPOS, RE) .GT. 0.0D0) RETURN
      IF (RAYHIT(SUNU, MPOS, RM) .GT. 0.0D0) RETURN
      IF (NACT .EQ. 0) GO TO 5
      IF (LMOCC(SUNU, 0) .EQ. 1) RETURN
    5 CALL PROJ(SUNU, X, Y, IOK)
      IF (IOK .EQ. 0) RETURN
      DO 10 K = 0, 23
        A = DBLE(K) * PI / 12.0D0
        C = DCOS(A) * 0.267D0
        S = DSIN(A) * 0.267D0
        CALL EMIT(VB, NV, X + C, Y + S,
     &    X + DCOS(A + PI / 12.0D0) * 0.267D0,
     &    Y + DSIN(A + PI / 12.0D0) * 0.267D0)
   10 CONTINUE
      IF (MOD(IFLG, 2) .EQ. 1) CALL LABEL(LB, NL, X, Y, 3, 0)
      RETURN
      END
C
C=======================================================================
C     EARTH.  Limb, coastlines (Natural Earth, turned by GMST), the
C     terminator, and the night side hatched with meridians every
C     10 deg.  Everything behind the Moon is dropped.
C=======================================================================
      SUBROUTINE DEARTH(VB, NV, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), LB(4,MAXL)
      INTEGER NV, NL
      DOUBLE PRECISION D, AE, C(3), U(3), P(3), Q(3), X, Y, VNRM
      DOUBLE PRECISION OCCL
      INTEGER I, K, J, IOK, IP, LMOCC
      D = VNRM(EPOS)
      IF (D .LE. RE * 1.0001D0) RETURN
      AE = DASIN(RE / D)
      DO 10 I = 1, 3
        U(I) = EPOS(I) / D
        C(I) = -U(I)
   10 CONTINUE
      IF (U(1)*CB(1) + U(2)*CB(2) + U(3)*CB(3) .LT.
     &    DCOS(DMIN1(THVIEW * DR + AE, PI))) RETURN
C
C     Limb.
      IVMODE = 2
      CALL CIRCLE(VB, NV, EPOS, RE, C, DACOS(RE / D), 360)
C
C     Coastlines.
      IVMODE = 1
      DO 30 K = 1, NCST
        IP = 0
        DO 20 J = KCST(K), KCST(K+1) - 1
          CALL MXV(MEF, CEV(1,J), Q)
          DO 15 I = 1, 3
            P(I) = EPOS(I) + RE * Q(I)
   15     CONTINUE
          CALL PEN(VB, NV, P, IP)
          IP = 1
   20   CONTINUE
   30 CONTINUE
C
C     Terminator.
      CALL CIRCLE(VB, NV, EPOS, RE, SUNU, 0.5D0 * PI, 180)
C
C     Night side shading (SHADE), not from low orbit, where the film
C     shows none.
      IF (ISCN .NE. 3) CALL SHADE(VB, NV, EPOS, RE, 4)
      IVMODE = 0
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (MOD(IFLG, 2) .EQ. 1 .AND. AE .LT. 0.3D0 * FOVH * DR) THEN
        CALL PROJ(EPOS, X, Y, IOK)
        IF (IOK .EQ. 1) THEN
          IF (OCCL(EPOS, MPOS, RM) .LE. 0.0D0) THEN
            IF (NACT .EQ. 0 .OR. LMOCC(EPOS, 0) .EQ. 0)
     &        CALL LABEL(LB, NL, X, Y, 4, 0)
          END IF
        END IF
      END IF
C     RESTOMOD END
      RETURN
      END
C
C-----------------------------------------------------------------------
C     SHADE: night side of the sphere (centre S camera relative, radius
C     R) as straight parallel lines (TN D-6853, printed p. 8, fig. 6).
C     Each is cut from the sphere by a plane through the eye that
C     contains the Sun's direction across the line of sight, so it
C     draws as a straight line along the light; 15 span the disc.
C     IVM is the visibility test for the night-side points.
C-----------------------------------------------------------------------
      SUBROUTINE SHADE(VB, NV, S, R, IVM)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), S(3), R
      INTEGER NV, IVM
      DOUBLE PRECISION D, AE, U(3), Q(3), C(3), P(3), CF, LA, SF
      INTEGER I, J
      D = DSQRT(S(1)**2 + S(2)**2 + S(3)**2)
      IF (D .LE. R) RETURN
      AE = DASIN(R / D)
      DO 10 I = 1, 3
        U(I) = S(I) / D
   10 CONTINUE
      CF = SUNU(1)*U(1) + SUNU(2)*U(2) + SUNU(3)*U(3)
      DO 20 I = 1, 3
        Q(I) = SUNU(I) - CF * U(I)
   20 CONTINUE
      IF (Q(1)**2 + Q(2)**2 + Q(3)**2 .LT. 1.0D-12) RETURN
      CALL VUNIT(Q)
      CALL VCRS(U, Q, C)
      IVMODE = IVM
      DO 40 J = -7, 7
        LA = DBLE(J) * AE / 7.5D0
        DO 30 I = 1, 3
          P(I) = C(I) * DCOS(LA) - U(I) * DSIN(LA)
   30   CONTINUE
        SF = D * DSIN(LA) / R
        IF (DABS(SF) .LT. 1.0D0)
     &    CALL CIRCLE(VB, NV, S, R, P, DACOS(SF), 180)
   40 CONTINUE
      IVMODE = 0
      RETURN
      END
C
C-----------------------------------------------------------------------
C     CIRCLE: small circle on the sphere (centre S camera relative,
C     radius R), at angle G from the unit axis A, N points, drawn with
C     the current IVMODE.
C-----------------------------------------------------------------------
      SUBROUTINE CIRCLE(VB, NV, S, R, A, G, N)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), S(3), R, A(3), G
      INTEGER NV, N
      DOUBLE PRECISION E1(3), E2(3), P(3), T, CG, SG, CT, ST
      INTEGER I, K
      CALL PERP(A, E1, E2)
      CG = DCOS(G)
      SG = DSIN(G)
      DO 20 K = 0, N
        T = DBLE(K) * 2.0D0 * PI / DBLE(N)
        CT = DCOS(T) * SG
        ST = DSIN(T) * SG
        DO 10 I = 1, 3
          P(I) = S(I) + R * (CG * A(I) + CT * E1(I) + ST * E2(I))
   10   CONTINUE
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (K .EQ. 0) THEN
          CALL PEN(VB, NV, P, 0)
        ELSE
          CALL PEN(VB, NV, P, 1)
        END IF
C     RESTOMOD END
   20 CONTINUE
      RETURN
      END
C
C     PERP: unit vectors E1, E2 completing unit A to a right-handed set.
      SUBROUTINE PERP(A, E1, E2)
      DOUBLE PRECISION A(3), E1(3), E2(3), Z(3)
      Z(1) = 0.0D0
      Z(2) = 0.0D0
      Z(3) = 1.0D0
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (DABS(A(3)) .GT. 0.9D0) THEN
        Z(1) = 1.0D0
        Z(3) = 0.0D0
      END IF
C     RESTOMOD END
      CALL VCRS(Z, A, E1)
      CALL VUNIT(E1)
      CALL VCRS(A, E1, E2)
      RETURN
      END
C
C=======================================================================
C     MOON.  Limb (the horizon when close), gazetteer craters, and
C     near the surface seeded small craters.
C=======================================================================
      SUBROUTINE DMOON(VB, NV, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), LB(4,MAXL)
      INTEGER NV, NL
      DOUBLE PRECISION D, AM, C(3), U(3), H, HOR, X, Y, OCCL, VNRM
      DOUBLE PRECISION G(3), Q(3), CA
      INTEGER I, IOK, K
      D = VNRM(MPOS)
      IF (D .LE. RM * 1.000001D0) RETURN
      AM = DASIN(RM / D)
      DO 10 I = 1, 3
        U(I) = MPOS(I) / D
        C(I) = -U(I)
   10 CONTINUE
      IF (U(1)*CB(1) + U(2)*CB(2) + U(3)*CB(3) .LT.
     &    DCOS(DMIN1(THVIEW * DR + AM, PI))) RETURN
      H = D - RM
      HOR = DACOS(RM / D)
C
C     Limb.
      IVMODE = 5
      CALL CIRCLE(VB, NV, MPOS, RM, C, HOR, 720)
C
C     Gazetteer craters inside the visible cap.
      IVMODE = 3
      CA = DCOS(DMIN1(HOR + 0.05D0, PI))
      DO 20 K = 1, NCRAT
        IF (CRV(1,K)*CAMF(1) + CRV(2,K)*CAMF(2) + CRV(3,K)*CAMF(3)
     &      .LT. CA * D) GO TO 20
C       Whole-disc view: gazetteer craters of 25 km and up only (our
C       floor, so the disc is not a solid mass), unlabelled.
        IF (ISCN .EQ. 6 .AND. CRDIA(K) .LT. 25.0D0) GO TO 20
        CALL CRATER(VB, NV, CRV(1,K), 0.5D0 * CRDIA(K) / RM, IOK)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (IOK .EQ. 1 .AND. CRDIA(K) .GE. 20.0D0 .AND.
     &      MOD(IFLG, 2) .EQ. 1 .AND. ISCN .NE. 6) THEN
          DO 15 I = 1, 3
            G(I) = RM * CRV(I,K)
   15     CONTINUE
          CALL MXV(MMF, G, Q)
          DO 16 I = 1, 3
            Q(I) = Q(I) + MPOS(I)
   16     CONTINUE
          CALL PROJ(Q, X, Y, IOK)
          CALL LABEL(LB, NL, X, Y, 2, K)
        END IF
C     RESTOMOD END
   20 CONTINUE
C
C     Seeded craters, a FIXED set on the ground (no level of detail
C     by range).  Sources: VIEW had "two-dimensional crater models"
C     built from photographs of the area near Apollo landing site 2
C     (TN D-6853, printed p. 7), and "the smallest craters depicted
C     ... have a size of 1 minute of arc (1658 ft)" (MSC IN
C     69-FM-197, sec. 3.1).  Our model of that, not the original:
C       regional patch, site 2 (see DMOON6) +-5 deg, cells of
C       0.1 deg, craters 1658 ft (0.505 km) to 4 km, where the
C       gazetteer takes over;
C       global fill elsewhere, cells of 0.5 deg, 2.5 to 25 km, so
C       orbital views keep the density the film shows (t04).
C     The IN (sec. 3.6, 3.7) notes few craters near the site, from
C     the flat approach, the oblique look and few large craters;
C     the patch density is set low to match.  Cells are seeded from
C     their indices, so craters stay put from frame to frame.
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (ISCN .EQ. 6) THEN
        CALL DMOON6(VB, NV, LB, NL)
      ELSE
        CALL PCRAT(VB, NV, 0.5D0, 1.2D0, 2.5D0, 25.0D0, 1,
     &             -90.0D0, 90.0D0, -180.0D0, 180.0D0, 1)
        CALL PCRAT(VB, NV, 0.1D0, 0.8D0, 0.505D0, 4.0D0, 2,
     &             0.67416D0 - 5.0D0, 0.67416D0 + 5.0D0,
     &             23.47314D0 - 5.0D0, 23.47314D0 + 5.0D0, 0)
      END IF
C     RESTOMOD END
      IVMODE = 0
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (MOD(IFLG, 2) .EQ. 1 .AND. AM .LT. 0.3D0 * FOVH * DR) THEN
        CALL PROJ(MPOS, X, Y, IOK)
        IF (IOK .EQ. 1) THEN
          IF (OCCL(MPOS, EPOS, RE) .LE. 0.0D0)
     &      CALL LABEL(LB, NL, X, Y, 5, 0)
        END IF
      END IF
C     RESTOMOD END
      RETURN
      END
C
C-----------------------------------------------------------------------
C     DMOON6: the whole-disc Moon view's extras.  Terminator; night
C     side shading as for the Earth (TN D-6853, printed p. 8); maria,
C     lacus, sinus and oceanus from the IAU gazetteer, which gives
C     only a centre and a diameter, so each is drawn as a circle of
C     that diameter, not its true outline; the Apollo 11 landing site
C     as a small boxed X.  Labels (LB kind 6 = mare, id its index;
C     kind 7 = landing site) when IFLG bit 0 is set.
C-----------------------------------------------------------------------
      SUBROUTINE DMOON6(VB, NV, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), LB(4,MAXL)
      INTEGER NV, NL
      DOUBLE PRECISION CM(3), P(3), X, Y, W, DCAM, HN, WD
      DOUBLE PRECISION XA(64), XB(64), YA(64), YB(64)
      INTEGER I, K, IOK, ISVIS, NP, NC
      IVMODE = 3
      CALL CIRCLE(VB, NV, MPOS, RM, SUNU, 0.5D0 * PI, 360)
      CALL SHADE(VB, NV, MPOS, RM, 6)
      DCAM = DSQRT(CAMF(1)**2 + CAMF(2)**2 + CAMF(3)**2)
C     Labels placed so far, as text rectangles in plot deg (0.7 name
C     height per character wide, one name height tall, the extents
C     TXALL will give them), for the clutter test: a label whose
C     rectangle meets one already placed is dropped.  Our rule.
      NP = 0
      HN = 0.028D0 * FOVH
C     Apollo 11 landing site, first so its label always wins.  The
C     1969 reports call it "landing site 2" (MSC IN 69-FM-197).  LM
C     position 0.67416 N, 23.47314 E, planetocentric Mean Earth/Polar
C     Axis (DE421), from LRO images: NSSDC, "Apollo Landing Site
C     Coordinates", https://nssdc.gsfc.nasa.gov/planetary/lunar/
C     lunar_sites.html, citing Wagner et al., Icarus 283, 92-103
C     (2017).  The same values are used for the orbit, the descent and
C     the crater patch.
      IVMODE = 3
      CALL LLUNIT(0.67416D0, 23.47314D0, CM)
      CALL SURFPT(CM, P)
      IF (ISVIS(P) .EQ. 0) GO TO 10
      CALL PROJ(P, X, Y, IOK)
      W = 0.012D0 * FOVH
      CALL EMIT(VB, NV, X - W, Y - W, X + W, Y - W)
      CALL EMIT(VB, NV, X + W, Y - W, X + W, Y + W)
      CALL EMIT(VB, NV, X + W, Y + W, X - W, Y + W)
      CALL EMIT(VB, NV, X - W, Y + W, X - W, Y - W)
      CALL EMIT(VB, NV, X - W, Y - W, X + W, Y + W)
      CALL EMIT(VB, NV, X - W, Y + W, X + W, Y - W)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (MOD(IFLG, 2) .EQ. 1) THEN
        CALL LABEL(LB, NL, X + W, Y + W, 7, 0)
        NP = 1
        XA(1) = X + W + 0.4D0 * HN
        XB(1) = XA(1) + 0.7D0 * HN * 22.0D0
        YA(1) = Y + W + 0.4D0 * HN
        YB(1) = YA(1) + HN
      END IF
C     RESTOMOD END
C     Maria etc., largest first (the table is sorted by diameter).
C     All are drawn; only a mare or oceanus of any size, or another
C     feature of 150 km or more, is labelled (our clutter rule).
   10 DO 30 K = 1, NMARE
        CALL LLUNIT(MRLAT(K), MRLON(K), CM)
        CALL CRATER(VB, NV, CM, 0.5D0 * MRDIA(K) / RM, IOK)
        IF (MOD(IFLG, 2) .EQ. 0) GO TO 30
        IF (MRDIA(K) .LT. 150.0D0 .AND. MRCH((K - 1) * 24 + 1) .NE. 77
     &      .AND. MRCH((K - 1) * 24 + 1) .NE. 79) GO TO 30
        IF (CM(1)*CAMF(1) + CM(2)*CAMF(2) + CM(3)*CAMF(3)
     &      .LT. RM * RM / DCAM) GO TO 30
        CALL SURFPT(CM, P)
        CALL PROJ(P, X, Y, IOK)
C       Name length, then its rectangle, centred on the point.
        NC = 0
        DO 15 I = 1, 24
          IF (MRCH((K - 1) * 24 + I) .EQ. 0) GO TO 16
          NC = NC + 1
   15   CONTINUE
   16   WD = 0.35D0 * HN * DBLE(NC)
        DO 20 I = 1, NP
          IF (X - WD .LT. XB(I) .AND. X + WD .GT. XA(I) .AND.
     &        Y - 0.5D0 * HN .LT. YB(I) .AND. Y + 0.5D0 * HN .GT. YA(I))
     &      GO TO 30
   20   CONTINUE
        CALL LABEL(LB, NL, X, Y, 6, K)
        IF (NP .GE. 64) GO TO 30
        NP = NP + 1
        XA(NP) = X - WD
        XB(NP) = X + WD
        YA(NP) = Y - 0.5D0 * HN
        YB(NP) = Y + 0.5D0 * HN
   30 CONTINUE
      IVMODE = 0
      RETURN
      END
C
C     LLUNIT: selenographic latitude, east longitude (deg) to a unit
C     vector (MF).  SURFPT: unit MF direction to the surface point,
C     camera relative EQ.
      SUBROUTINE LLUNIT(FI, LA, U)
      DOUBLE PRECISION FI, LA, U(3), DR
      DR = 3.141592653589793D0 / 180.0D0
      U(1) = DCOS(FI * DR) * DCOS(LA * DR)
      U(2) = DCOS(FI * DR) * DSIN(LA * DR)
      U(3) = DSIN(FI * DR)
      RETURN
      END
C
      SUBROUTINE SURFPT(CM, P)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION CM(3), P(3), G(3)
      INTEGER I
      DO 10 I = 1, 3
        G(I) = RM * CM(I)
   10 CONTINUE
      CALL MXV(MMF, G, P)
      DO 20 I = 1, 3
        P(I) = P(I) + MPOS(I)
   20 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     CRATER: rim circle of angular radius A (rad) about unit centre
C     CM (MF).  Culled when off frame, beyond the horizon or too small
C     to see.  IOK = 1 if drawn.
C-----------------------------------------------------------------------
      SUBROUTINE CRATER(VB, NV, CM, A, IOK)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), CM(3), A
      INTEGER NV, IOK
      DOUBLE PRECISION D(3), DD, RA, CS, E1(3), E2(3), G(3), P(3)
      DOUBLE PRECISION CA, SA, T, CT, ST, SIZ
      INTEGER I, K, N
      IOK = 0
      DO 10 I = 1, 3
        D(I) = RM * CM(I) - CAMF(I)
   10 CONTINUE
      DD = DSQRT(D(1)*D(1) + D(2)*D(2) + D(3)*D(3))
      RA = RM * A / DD
C     Apparent diameter against the field.  Rims under 1.2 percent
C     of the frame (about 12 points of a 1024-point recorder raster,
C     docs/univac-1108.md) are not drawn: our choice of floor.
      SIZ = 2.0D0 * RA / DR / (2.0D0 * FOVH)
      IF (SIZ .LT. 0.012D0) RETURN
C     Outside the cone through the frame corners (COS(T+RA) is at
C     least COS(T) - RA).
      CS = (D(1)*CBMF(1) + D(2)*CBMF(2) + D(3)*CBMF(3)) / DD
      IF (CS .LT. CSVIEW - RA) RETURN
      N = 10 + INT(SIZ * 60.0D0)
      IF (N .GT. 36) N = 36
      CALL PERP(CM, E1, E2)
      CA = DCOS(A) * RM
      SA = DSIN(A) * RM
      DO 30 K = 0, N
        T = DBLE(K) * 2.0D0 * PI / DBLE(N)
        CT = DCOS(T) * SA
        ST = DSIN(T) * SA
        DO 20 I = 1, 3
          G(I) = CA * CM(I) + CT * E1(I) + ST * E2(I)
   20   CONTINUE
        CALL MXV(MMF, G, P)
        DO 25 I = 1, 3
          P(I) = P(I) + MPOS(I)
   25   CONTINUE
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (K .EQ. 0) THEN
          CALL PEN(VB, NV, P, 0)
        ELSE
          CALL PEN(VB, NV, P, 1)
        END IF
C     RESTOMOD END
   30 CONTINUE
      IOK = 1
      RETURN
      END
C
C-----------------------------------------------------------------------
C     PCRAT: seeded craters on a latitude-longitude grid of GC deg,
C     inside the fixed box F1..F2 lat, L1..L2 east lon (deg); IEXC=1
C     skips cells inside the site 2 patch (drawn by its own level).
C     AVG mean craters per cell, diameters DMIN..DMAX km with a -2
C     power law.  Only cells under a 7 x 7 grid of sight lines across
C     the frame are visited, and only craters on the near side of the
C     horizon are drawn: culling by visibility, not by range.  More
C     than 40000 cells in view is taken as "Moon too small to show
C     seeded craters" (every one would fall under the size floor in
C     CRATER).  Random numbers: Park-Miller minimal standard
C     generator, exact in double precision.
C-----------------------------------------------------------------------
      SUBROUTINE PCRAT(VB, NV, GC, AVG, DMIN, DMAX, LEV,
     &                 F1, F2, L1, L2, IEXC)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), GC, AVG, DMIN, DMAX
      DOUBLE PRECISION F1, F2, L1, L2, P1, CH, DCAM, FC, LC, CFR
      INTEGER NV, LEV, IEXC
      DOUBLE PRECISION U(3), W(3), GP(3), B, C, DS, T, FI, DL, LO0
      DOUBLE PRECISION FMIN, FMAX, LMIN, LMAX, MARG, SEED, RND
      DOUBLE PRECISION CLAT0, CLON0, CF, DIA, CM(3), Q
      INTEGER I, J, K, IA, IB, JA, JB, NLON, JJ, NC, IOK, IFLR
C
C     The size floor of CRATER applied to the largest crater of this
C     level at the nearest ground: if even that is too small, stop.
      DCAM = DSQRT(CAMF(1)**2 + CAMF(2)**2 + CAMF(3)**2)
      IF (DMAX / (DCAM - RM) / DR / (2.0D0 * FOVH) .LT. 0.012D0) RETURN
      LO0 = DATAN2(CAMF(2), CAMF(1)) / DR
      FMIN = 90.0D0
      FMAX = -90.0D0
      LMIN = 180.0D0
      LMAX = -180.0D0
      C = CAMF(1)**2 + CAMF(2)**2 + CAMF(3)**2 - RM * RM
      DO 20 I = 0, 6
        DO 10 J = 0, 6
          CALL UNPROJ(BOXH * DBLE(I - 3) / 3.0D0,
     &                BOXH * DBLE(J - 3) / 3.0D0, 0, W)
          CALL MTXV(MMF, W, U)
          B = U(1) * CAMF(1) + U(2) * CAMF(2) + U(3) * CAMF(3)
          DS = B * B - C
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
          IF (DS .GE. 0.0D0 .AND. -B - DSQRT(DS) .GT. 0.0D0) THEN
            T = -B - DSQRT(DS)
          ELSE
            T = -B
            IF (T .LT. 0.0D0) T = 0.0D0
          END IF
C     RESTOMOD END
          DO 5 K = 1, 3
            GP(K) = CAMF(K) + T * U(K)
    5     CONTINUE
          CALL VUNIT(GP)
          FI = DASIN(GP(3)) / DR
          DL = DATAN2(GP(2), GP(1)) / DR - LO0
          IF (DL .GT. 180.0D0) DL = DL - 360.0D0
          IF (DL .LT. -180.0D0) DL = DL + 360.0D0
          FMIN = DMIN1(FMIN, FI)
          FMAX = DMAX1(FMAX, FI)
          LMIN = DMIN1(LMIN, DL)
          LMAX = DMAX1(LMAX, DL)
   10   CONTINUE
   20 CONTINUE
C     Take in the ground under the camera too, then pad.
      FI = DASIN(CAMF(3) / DSQRT(C + RM * RM)) / DR
      FMIN = DMIN1(FMIN, FI)
      FMAX = DMAX1(FMAX, FI)
      LMIN = DMIN1(LMIN, 0.0D0)
      LMAX = DMAX1(LMAX, 0.0D0)
      MARG = 0.5D0 * DMAX / RM / DR + GC
      FMIN = DMAX1(FMIN - MARG, -89.0D0)
      FMAX = DMIN1(FMAX + MARG, 89.0D0)
      LMIN = LMIN - MARG / DMAX1(DCOS(DMAX1(DABS(FMIN),
     &       DABS(FMAX)) * DR), 0.05D0)
      LMAX = LMAX + MARG /
     &       DMAX1(DCOS(DMAX1(DABS(FMIN), DABS(FMAX)) * DR), 0.05D0)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (LMAX - LMIN .GT. 360.0D0) THEN
        LMIN = -180.0D0
        LMAX = 180.0D0
      END IF
C     RESTOMOD END
C     Clip to the fixed box of this level.
      FMIN = DMAX1(FMIN, F1)
      FMAX = DMIN1(FMAX, F2)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (L2 - L1 .LT. 360.0D0) THEN
        P1 = DMOD(L1 - LO0 + 540.0D0, 360.0D0) - 180.0D0
        LMIN = DMAX1(LMIN, P1)
        LMAX = DMIN1(LMAX, P1 + (L2 - L1))
      END IF
C     RESTOMOD END
      IF (FMIN .GT. FMAX .OR. LMIN .GT. LMAX) RETURN
      DCAM = DSQRT(C + RM * RM)
      CH = RM / DCAM
      IA = IFLR((FMIN + 90.0D0) / GC)
      IB = IFLR((FMAX + 90.0D0) / GC)
      JA = IFLR((LO0 + LMIN + 180.0D0) / GC)
      JB = IFLR((LO0 + LMAX + 180.0D0) / GC)
      IF (DBLE(IB - IA + 1) * DBLE(JB - JA + 1) .GT. 40000.0D0) RETURN
      NLON = NINT(360.0D0 / GC)
      DO 60 I = IA, IB
C       Thin the cells toward the poles, where they shrink in area.
        CFR = DCOS((DBLE(I) + 0.5D0) * GC * DR - 0.5D0 * PI)
        DO 50 J = JA, JB
          JJ = MOD(J, NLON)
          IF (JJ .LT. 0) JJ = JJ + NLON
C         Seed from both cell indices through a nonlinear mix (the
C         fraction of a square), so neighbouring cells do not start the
C         linear generator on a lattice (that showed as crater rows).
          Q = DBLE(I) * 0.6180339887D0 + DBLE(JJ) * 0.7548776662D0
     &      + DBLE(LEV) * 0.5698402910D0
          Q = DMOD(Q * Q * 7919.0D0, 1.0D0)
C     RESTOMOD: seed for the Park-Miller generator (1988)
          SEED = 1.0D0 + DBLE(INT(Q * 2147483645.0D0))
          Q = RND(SEED)
          NC = INT(RND(SEED) * (2.0D0 * AVG + 1.0D0))
          CLAT0 = DBLE(I) * GC - 90.0D0
          CLON0 = DBLE(JJ) * GC - 180.0D0
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
          IF (IEXC .EQ. 1) THEN
            FC = CLAT0 + 0.5D0 * GC - 0.67416D0
            LC = CLON0 + 0.5D0 * GC - 23.47314D0
            IF (DABS(FC) .LT. 5.0D0 .AND. DABS(LC) .LT. 5.0D0) GO TO 50
          END IF
C     RESTOMOD END
          DO 40 K = 1, NC
            FI = (CLAT0 + RND(SEED) * GC) * DR
            DL = (CLON0 + RND(SEED) * GC) * DR
            Q = RND(SEED)
            CF = RND(SEED)
            IF (Q .GT. CFR) GO TO 40
            DIA = DMIN / DSQRT(1.0D0 - CF * (1.0D0 - (DMIN/DMAX)**2))
            CM(1) = DCOS(FI) * DCOS(DL)
            CM(2) = DCOS(FI) * DSIN(DL)
            CM(3) = DSIN(FI)
C           Near side of the horizon only (centre within the cap
C           seen from the camera, padded by the crater's radius).
            IF ((CM(1)*CAMF(1) + CM(2)*CAMF(2) + CM(3)*CAMF(3)) / DCAM
     &          .LT. CH - 0.5D0 * DIA / RM) GO TO 40
            CALL CRATER(VB, NV, CM, 0.5D0 * DIA / RM, IOK)
   40     CONTINUE
   50   CONTINUE
   60 CONTINUE
      RETURN
      END
C
      DOUBLE PRECISION FUNCTION RND(SEED)
      DOUBLE PRECISION SEED
C     RESTOMOD BEGIN: Park-Miller minimal standard generator, 1988
      SEED = DMOD(16807.0D0 * SEED, 2147483647.0D0)
      RND = SEED / 2147483647.0D0
C     RESTOMOD END
      RETURN
      END
C
      INTEGER FUNCTION IFLR(X)
      DOUBLE PRECISION X
      IFLR = INT(X)
      IF (DBLE(IFLR) .GT. X) IFLR = IFLR - 1
      RETURN
      END
C
C=======================================================================
C     SPACECRAFT MODELS.  A library of wireframe models in /CLM/,
C     built once (MLIB).  Each model is data: convex solids (prisms,
C     MKPRS) and free lines (XLINE), in its own body frame, in metres.
C     A free line with IS = 0 is a stand-alone line (legs, rims); with
C     IS > 0 it is a mark on face LXF of solid IS (windows, target),
C     hidden when that face is turned away.  The model table /CMODI/
C     gives each model's range of solids and lines.
C
C     Per frame: MCLEAR, then MPLACE for each model in view (body axes,
C     where a body point sits, camera relative), then MDRALL after the
C     sky and bodies.  Hidden parts: an edge between two faces turned
C     away is hidden; any piece whose sight line passes through a
C     placed solid is hidden (Cyrus-Beck, LMOCC); placed solids also
C     hide stars, Sun, Earth and Moon (ISVIS, DSTARS, DSUN).  Hidden
C     pieces are dropped, as on the film, or drawn dashed (style 2)
C     when IFLG bit 2 is set.  TN D-6853 (printed p. 12): "Hidden-line
C     models of the LM and the S-IVB can be produced".
C
C     To add a model: a builder routine between MODBEG(K) and
C     MODEND(K) in MLIB, a model number in viewcom.inc, and one MPLACE
C     call in the scene's part of SCNMOD.
C=======================================================================
      SUBROUTINE MLIB
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      NSOL = 0
      NXL = 0
      NMOD = 0
C     LM, landing gear deployed (scene 4).
      CALL MODBEG(KLMD)
      CALL LMBODY
      CALL LMGEAR(0)
      CALL MODEND(KLMD)
C     LM, landing gear stowed, with drogue and docking target, in its
C     place on the S-IVB (scene 7).
      CALL MODBEG(KLMS)
      CALL LMBODY
      CALL LMGEAR(1)
      CALL LMDOCK
      CALL MODEND(KLMS)
C     S-IVB with the instrument unit and the stub of the SLA.
      CALL MODBEG(KSIV)
      CALL SIVBMD
      CALL MODEND(KSIV)
      RETURN
      END
C
C     MODBEG, MODEND: open and close model K in the table.
      SUBROUTINE MODBEG(K)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER K
      MDS1(K) = NSOL + 1
      MDX1(K) = NXL + 1
      RETURN
      END
C
      SUBROUTINE MODEND(K)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER K
      MDS2(K) = NSOL
      MDX2(K) = NXL
      IF (K .GT. NMOD) NMOD = K
      RETURN
      END
C
C-----------------------------------------------------------------------
C     LMBODY: the LM's stages, body axes X up, Y right, Z forward, the
C     descent stage base at X = 0.  Solids IS0+1 .. IS0+7; windows and
C     hatch are marks on the cabin front (solid IS0+2, face 10 is its
C     +Z cap).
C-----------------------------------------------------------------------
      SUBROUTINE LMBODY
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION O(3), A1(3), A2(3), AN(3), P(2,8)
      INTEGER IS0, IC
      IS0 = NSOL
      IC = IS0 + 2
C
C     1  descent stage: octagon 4.2 m across, X 0 .. 1.7.
      CALL OCTAG(2.1D0, 2.1D0, 0.9D0, P)
      CALL SETV(O, 0.0D0, 0.0D0, 0.0D0)
      CALL SETV(A1, 0.0D0, 1.0D0, 0.0D0)
      CALL SETV(A2, 0.0D0, 0.0D0, 1.0D0)
      CALL SETV(AN, 1.0D0, 0.0D0, 0.0D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 1.7D0)
C     2  crew cabin, faceted, facing +Z.
      CALL OCTAG(1.25D0, 1.0D0, 0.45D0, P)
      CALL SETV(O, 2.9D0, 0.0D0, -0.2D0)
      CALL SETV(A1, 0.0D0, 1.0D0, 0.0D0)
      CALL SETV(A2, 1.0D0, 0.0D0, 0.0D0)
      CALL SETV(AN, 0.0D0, 0.0D0, 1.0D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 1.35D0)
C     3  midsection behind the cabin.
      CALL OCTAG(1.2D0, 1.05D0, 0.3D0, P)
      CALL SETV(O, 2.95D0, 0.0D0, -1.5D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 1.3D0)
C     4  aft equipment bay.
      CALL OCTAG(1.55D0, 0.5D0, 0.05D0, P)
      CALL SETV(O, 3.1D0, 0.0D0, -2.2D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 0.7D0)
C     5  docking tunnel on top.
      CALL OCTAG(0.5D0, 0.5D0, 0.2D0, P)
      CALL SETV(O, 3.9D0, 0.0D0, -0.6D0)
      CALL SETV(A1, 0.0D0, 1.0D0, 0.0D0)
      CALL SETV(A2, 0.0D0, 0.0D0, 1.0D0)
      CALL SETV(AN, 1.0D0, 0.0D0, 0.0D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 0.45D0)
C     6, 7  propellant tank bulges, left and right.
      CALL OCTAG(0.6D0, 0.6D0, 0.25D0, P)
      CALL SETV(O, 2.55D0, -1.2D0, -0.85D0)
      CALL SETV(A1, 1.0D0, 0.0D0, 0.0D0)
      CALL SETV(A2, 0.0D0, 0.0D0, 1.0D0)
      CALL SETV(AN, 0.0D0, -1.0D0, 0.0D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 0.65D0)
      CALL SETV(O, 2.55D0, 1.2D0, -0.85D0)
      CALL SETV(AN, 0.0D0, 1.0D0, 0.0D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 0.65D0)
C
C     Windows: two triangles on the cabin front.
      CALL XLINE(-1.05D0, 3.55D0, 1.16D0, -0.35D0, 3.65D0, 1.16D0, IC)
      CALL XLINE(-0.35D0, 3.65D0, 1.16D0, -0.55D0, 2.75D0, 1.16D0, IC)
      CALL XLINE(-0.55D0, 2.75D0, 1.16D0, -1.05D0, 3.55D0, 1.16D0, IC)
      CALL XLINE(1.05D0, 3.55D0, 1.16D0, 0.35D0, 3.65D0, 1.16D0, IC)
      CALL XLINE(0.35D0, 3.65D0, 1.16D0, 0.55D0, 2.75D0, 1.16D0, IC)
      CALL XLINE(0.55D0, 2.75D0, 1.16D0, 1.05D0, 3.55D0, 1.16D0, IC)
C     Hatch on the cabin front.
      CALL XLINE(-0.4D0, 2.0D0, 1.16D0, 0.4D0, 2.0D0, 1.16D0, IC)
      CALL XLINE(0.4D0, 2.0D0, 1.16D0, 0.4D0, 2.6D0, 1.16D0, IC)
      CALL XLINE(0.4D0, 2.6D0, 1.16D0, -0.4D0, 2.6D0, 1.16D0, IC)
      CALL XLINE(-0.4D0, 2.6D0, 1.16D0, -0.4D0, 2.0D0, 1.16D0, IC)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     LMGEAR: landing gear as free lines.  ISTOW = 0 deployed: on the
C     diagonals a primary strut, two secondaries and a pad.
C     ISTOW = 1 stowed.  "In a retracted position until after the
C     crew mans the LM, the landing gear struts are explosively
C     extended" (Apollo 11 press kit, NASA release 69-83K, printed
C     p. 103).  How the folded gear lay is our guess: each primary
C     strut runs up from its outrigger to a pad beside the ascent
C     stage, the pad (37 in across, same page) square to the LM X
C     axis; the secondaries are left out.
C-----------------------------------------------------------------------
      SUBROUTINE LMGEAR(ISTOW)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER ISTOW
      DOUBLE PRECISION SX, SZ, R0, R1, X0, X1, Q, C, S, C2, S2
      INTEGER I, K
      IF (ISTOW .EQ. 1) GO TO 30
      DO 20 K = 0, 3
        C = DCOS((45.0D0 + 90.0D0 * DBLE(K)) * DR)
        S = DSIN((45.0D0 + 90.0D0 * DBLE(K)) * DR)
        R0 = 2.33D0
        R1 = 4.3D0
        X0 = 1.5D0
        X1 = -1.0D0
        CALL XLINE(R0 * C, X0, R0 * S, R1 * C, X1, R1 * S, 0)
        Q = 3.5D0
        SX = Q * C
        SZ = Q * S
        CALL XLINE(SX, -0.45D0, SZ, 2.1D0 * DSIGN(1.0D0, C), 0.2D0,
     &             1.2D0 * DSIGN(1.0D0, S), 0)
        CALL XLINE(SX, -0.45D0, SZ, 1.2D0 * DSIGN(1.0D0, C), 0.2D0,
     &             2.1D0 * DSIGN(1.0D0, S), 0)
        DO 10 I = 0, 7
          CALL XLINE(R1 * C + 0.45D0 * DCOS(DBLE(I) * PI / 4.0D0),
     &      X1 - 0.1D0, R1 * S + 0.45D0 * DSIN(DBLE(I) * PI / 4.0D0),
     &      R1 * C + 0.45D0 * DCOS(DBLE(I + 1) * PI / 4.0D0),
     &      X1 - 0.1D0,
     &      R1 * S + 0.45D0 * DSIN(DBLE(I + 1) * PI / 4.0D0), 0)
   10   CONTINUE
   20 CONTINUE
      RETURN
   30 DO 40 K = 0, 3
        C = DCOS((45.0D0 + 90.0D0 * DBLE(K)) * DR)
        S = DSIN((45.0D0 + 90.0D0 * DBLE(K)) * DR)
        CALL XLINE(2.33D0 * C, 1.5D0, 2.33D0 * S,
     &             2.3D0 * C, 2.2D0, 2.3D0 * S, 0)
        DO 35 I = 0, 11
          C2 = DCOS(DBLE(I) * PI / 6.0D0) * 0.47D0
          S2 = DSIN(DBLE(I) * PI / 6.0D0) * 0.47D0
          CALL XLINE(2.3D0 * C + C2, 2.2D0, 2.3D0 * S + S2,
     &      2.3D0 * C + DCOS(DBLE(I + 1) * PI / 6.0D0) * 0.47D0, 2.2D0,
     &      2.3D0 * S + DSIN(DBLE(I + 1) * PI / 6.0D0) * 0.47D0, 0)
   35   CONTINUE
   40 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     LMDOCK: docking drogue and CSM-active docking target, as marks
C     on the LM model LMBODY has just built (tunnel = its solid 5,
C     midsection = its solid 3).
C     Drogue, a cone in the tunnel's +X cap (face 10): "a conical
C     drogue mounted in the LM docking tunnel", which is 32 in across
C     (press kit, printed p. 88 and p. 101).  Depth: ours.
C     Target for the CSM's crewman optical alignment sight (COAS): a
C     disc on the midsection top (face 3) with a cross on a standoff
C     above it, set off from the tunnel axis by as much as the COAS
C     line of sight is from the CSM's docking axis (S7POSE), so it
C     sits on the boresight.  Size, standoff and offset: our guess.
C-----------------------------------------------------------------------
      SUBROUTINE LMDOCK
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION C, S, C2, S2
      INTEGER K, IT, IM
      IT = NSOL - 2
      IM = NSOL - 4
      DO 70 K = 0, 11
        C = DCOS(DBLE(K) * PI / 6.0D0)
        S = DSIN(DBLE(K) * PI / 6.0D0)
        C2 = DCOS(DBLE(K + 1) * PI / 6.0D0)
        S2 = DSIN(DBLE(K + 1) * PI / 6.0D0)
        CALL XLINE(0.4D0 * C, 4.35D0, -0.6D0 + 0.4D0 * S,
     &             0.4D0 * C2, 4.35D0, -0.6D0 + 0.4D0 * S2, IT)
        CALL XLINE(0.06D0 * C, 4.05D0, -0.6D0 + 0.06D0 * S,
     &             0.06D0 * C2, 4.05D0, -0.6D0 + 0.06D0 * S2, IT)
        IF (MOD(K, 3) .EQ. 0) CALL XLINE(0.4D0 * C, 4.35D0,
     &    -0.6D0 + 0.4D0 * S, 0.06D0 * C, 4.05D0, -0.6D0 + 0.06D0 * S,
     &    IT)
   70 CONTINUE
      DO 80 K = 0, 11
        C = 0.18D0 * DCOS(DBLE(K) * PI / 6.0D0)
        S = 0.18D0 * DSIN(DBLE(K) * PI / 6.0D0)
        C2 = 0.18D0 * DCOS(DBLE(K + 1) * PI / 6.0D0)
        S2 = 0.18D0 * DSIN(DBLE(K + 1) * PI / 6.0D0)
        CALL XLINE(-0.72D0 + C, 4.0D0, -0.6D0 + S,
     &             -0.72D0 + C2, 4.0D0, -0.6D0 + S2, IM)
        LXF(NXL) = 3
   80 CONTINUE
      CALL XLINE(-0.82D0, 4.45D0, -0.6D0, -0.62D0, 4.45D0, -0.6D0, 0)
      CALL XLINE(-0.72D0, 4.45D0, -0.7D0, -0.72D0, 4.45D0, -0.5D0, 0)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     SIVBMD: S-IVB with the instrument unit on top, body axes X
C     forward along the stage, origin at the centre of the top of the
C     IU.  One prism of 24 sides: both 21.7 ft across, 58.3 ft and
C     3 ft high (Apollo 11 press kit, printed p. 109).
C     The SLA's fixed lower ring, left on the IU when the four upper
C     panels were jettisoned at separation (AS-506 launch vehicle
C     flight evaluation report, MPR-SAT-FE-69-9, p. xxiii; Apollo 11
C     Flight Journal, 003:18:19).  The SLA "is a truncated cone 28
C     feet long tapering from 260 inches diameter at the base to 154
C     inches at the forward end" (press kit, printed p. 88).  The
C     fixed panels are 7 ft high (secondary source: Wikipedia, "Apollo
C     (spacecraft)"), so the ring's top is 233.5 in across.  The
C     jettisoned panels are not drawn; by the approach they had drifted
C     off (our choice).  Rim and four panel joints, the joints on the
C     Y and Z axes (our guess).
C-----------------------------------------------------------------------
      SUBROUTINE SIVBMD
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION O(3), A1(3), A2(3), AN(3), P24(2,24)
      DOUBLE PRECISION RIU, XSL, RSL, Q, C, S, C2, S2
      INTEGER K
      RIU = 0.5D0 * 260.0D0 * 0.0254D0
      DO 50 K = 1, 24
        P24(1,K) = RIU * DCOS(DBLE(K) * PI / 12.0D0)
        P24(2,K) = RIU * DSIN(DBLE(K) * PI / 12.0D0)
   50 CONTINUE
      Q = (58.3D0 + 3.0D0) * 0.3048D0
      CALL SETV(O, -Q, 0.0D0, 0.0D0)
      CALL SETV(A1, 0.0D0, 1.0D0, 0.0D0)
      CALL SETV(A2, 0.0D0, 0.0D0, 1.0D0)
      CALL SETV(AN, 1.0D0, 0.0D0, 0.0D0)
      CALL MKPRS(24, P24, O, A1, A2, AN, Q)
      XSL = 7.0D0 * 0.3048D0
      RSL = 0.5D0 * (260.0D0 - 106.0D0 * 7.0D0 / 28.0D0) * 0.0254D0
      DO 60 K = 0, 23
        C = DCOS(DBLE(K) * PI / 12.0D0)
        S = DSIN(DBLE(K) * PI / 12.0D0)
        C2 = DCOS(DBLE(K + 1) * PI / 12.0D0)
        S2 = DSIN(DBLE(K + 1) * PI / 12.0D0)
        CALL XLINE(RSL * C, XSL, RSL * S, RSL * C2, XSL, RSL * S2, 0)
        IF (MOD(K, 6) .EQ. 0) CALL XLINE(0.99D0 * RIU * C, 0.01D0,
     &    0.99D0 * RIU * S, RSL * C, XSL, RSL * S, 0)
   60 CONTINUE
      RETURN
      END
C
C     XLINE: free line (IS=0) or mark on face LXF (10 unless set
C     after the call: the cap of an 8-sided prism) of solid IS, given
C     as Y, X, Z in the model's body metres.
      SUBROUTINE XLINE(Y1, X1, Z1, Y2, X2, Z2, IS)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION Y1, X1, Z1, Y2, X2, Z2
      INTEGER IS
      IF (NXL .GE. MXL) RETURN
      NXL = NXL + 1
      LXL(1,NXL) = X1
      LXL(2,NXL) = Y1
      LXL(3,NXL) = Z1
      LXL(4,NXL) = X2
      LXL(5,NXL) = Y2
      LXL(6,NXL) = Z2
      LXS(NXL) = IS
      LXF(NXL) = 10
      RETURN
      END
C
      SUBROUTINE SETV(V, A, B, C)
      DOUBLE PRECISION V(3), A, B, C
      V(1) = A
      V(2) = B
      V(3) = C
      RETURN
      END
C
C     OCTAG: chamfered rectangle, half sizes A by B, chamfer C, as 8
C     points counter-clockwise (duplicates when C = 0 are harmless).
      SUBROUTINE OCTAG(A, B, C, P)
      DOUBLE PRECISION A, B, C, P(2,8)
      P(1,1) = A
      P(2,1) = -B + C
      P(1,2) = A
      P(2,2) = B - C
      P(1,3) = A - C
      P(2,3) = B
      P(1,4) = -A + C
      P(2,4) = B
      P(1,5) = -A
      P(2,5) = B - C
      P(1,6) = -A
      P(2,6) = -B + C
      P(1,7) = -A + C
      P(2,7) = -B
      P(1,8) = A - C
      P(2,8) = -B
      RETURN
      END
C
C     MKPRS: prism over polygon P (NP points in axes A1, A2 about O),
C     extruded H along AN.  Faces 1..NP sides, NP+1 base, NP+2 cap.
      SUBROUTINE MKPRS(NP, P, O, A1, A2, AN, H)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER NP
      DOUBLE PRECISION P(2,NP), O(3), A1(3), A2(3), AN(3), H
      DOUBLE PRECISION CEN(3), E1(3), E2(3), N(3), D, VDOT
      INTEGER I, K, K2, IS, IA, IB, IC, NE
      NSOL = NSOL + 1
      IS = NSOL
      NLV(IS) = 2 * NP
      NLF(IS) = NP + 2
      DO 20 K = 1, NP
        DO 10 I = 1, 3
          LMV(I,K,IS) = O(I) + P(1,K) * A1(I) + P(2,K) * A2(I)
          LMV(I,K+NP,IS) = LMV(I,K,IS) + H * AN(I)
   10   CONTINUE
   20 CONTINUE
      DO 25 I = 1, 3
        CEN(I) = O(I) + 0.5D0 * H * AN(I)
   25 CONTINUE
C     Face planes, oriented away from the centre.
      DO 40 K = 1, NP + 2
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (K .LE. NP) THEN
          K2 = MOD(K, NP) + 1
          IA = K
          IB = K2
          IC = K + NP
        ELSE IF (K .EQ. NP + 1) THEN
          IA = 1
          IB = 3
          IC = 6
        ELSE
          IA = 1 + NP
          IB = 3 + NP
          IC = 6 + NP
        END IF
C     RESTOMOD END
        DO 30 I = 1, 3
          E1(I) = LMV(I,IB,IS) - LMV(I,IA,IS)
          E2(I) = LMV(I,IC,IS) - LMV(I,IA,IS)
   30   CONTINUE
        CALL VCRS(E1, E2, N)
        CALL VUNIT(N)
        D = VDOT(N, LMV(1,IA,IS))
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (D - VDOT(N, CEN) .LT. 0.0D0) THEN
          DO 35 I = 1, 3
            N(I) = -N(I)
   35     CONTINUE
          D = -D
        END IF
C     RESTOMOD END
        DO 38 I = 1, 3
          LMN(I,K,IS) = N(I)
   38   CONTINUE
        LMD(K,IS) = D
   40 CONTINUE
C     Edges: base, top, uprights.
      NE = 0
      DO 50 K = 1, NP
        K2 = MOD(K, NP) + 1
        NE = NE + 1
        LME(1,NE,IS) = K
        LME(2,NE,IS) = K2
        LME(3,NE,IS) = K
        LME(4,NE,IS) = NP + 1
        NE = NE + 1
        LME(1,NE,IS) = K + NP
        LME(2,NE,IS) = K2 + NP
        LME(3,NE,IS) = K
        LME(4,NE,IS) = NP + 2
        NE = NE + 1
        LME(1,NE,IS) = K
        LME(2,NE,IS) = K + NP
        LME(3,NE,IS) = K
        LME(4,NE,IS) = MOD(K + NP - 2, NP) + 1
   50 CONTINUE
      NLE(IS) = NE
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
      INTEGER I
C     Body axes in the reference frame: X up, Z toward the camera.
      DO 10 I = 1, 3
        BX(I,1) = UREF(I)
        BX(I,2) = -RREF(I)
        BX(I,3) = -BREF(I)
   10 CONTINUE
      T = GET - (100.0D0 * 3600.0D0 + 12.0D0 * 60.0D0)
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
C     MCLEAR: no model placed.
      SUBROUTINE MCLEAR
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER K
      DO 10 K = 1, MMOD
        MDON(K) = 0
   10 CONTINUE
      DO 20 K = 1, MSOL
        LACT(K) = 0
        LINS(K) = 0
   20 CONTINUE
      NACT = 0
      RETURN
      END
C
C-----------------------------------------------------------------------
C     MPLACE: place model K for this frame.  AT: its body axes in EQ
C     (columns X, Y, Z).  Body point BO (m) goes to P (km, camera
C     relative).  Its solids go to camera-relative EQ km (LWV, LWN,
C     LWD) and join the solids that hide things.
C     A model can ride on the observer's own vehicle, a cabin seen
C     from inside: AT the vehicle's body axes, BO the eye point in
C     body metres, P = 0.  A solid with the camera inside it (every
C     face turned away) does not hide anything and its edges are all
C     drawn (LINS); a cabin is better built of free lines anyway.
C-----------------------------------------------------------------------
      SUBROUTINE MPLACE(K, AT, P, BO)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER K
      DOUBLE PRECISION AT(3,3), P(3), BO(3), V(3), W(3)
      INTEGER I, J, IS
      DO 10 I = 1, 3
        MDP(I,K) = P(I)
        MDBO(I,K) = BO(I)
        DO 5 J = 1, 3
          MDAT(I,J,K) = AT(I,J)
    5   CONTINUE
   10 CONTINUE
      MDON(K) = 1
      IF (MDS2(K) .LT. MDS1(K)) RETURN
      DO 60 IS = MDS1(K), MDS2(K)
        DO 40 J = 1, NLV(IS)
          DO 30 I = 1, 3
            V(I) = (LMV(I,J,IS) - BO(I)) * 1.0D-3
   30     CONTINUE
          CALL MXV(AT, V, W)
          DO 35 I = 1, 3
            LWV(I,J,IS) = P(I) + W(I)
   35     CONTINUE
   40   CONTINUE
        LINS(IS) = 1
        DO 50 J = 1, NLF(IS)
          CALL MXV(AT, LMN(1,J,IS), W)
          DO 45 I = 1, 3
            LWN(I,J,IS) = W(I)
   45     CONTINUE
          LWD(J,IS) = (LMD(J,IS) - LMN(1,J,IS) * BO(1)
     &      - LMN(2,J,IS) * BO(2) - LMN(3,J,IS) * BO(3)) * 1.0D-3
     &      + W(1) * P(1) + W(2) * P(2) + W(3) * P(3)
          IF (LWD(J,IS) .LE. 0.0D0) LINS(IS) = 0
   50   CONTINUE
        LACT(IS) = 1
        NACT = NACT + 1
   60 CONTINUE
      RETURN
      END
C
C     MDRALL: draw every placed model.
      SUBROUTINE MDRALL(VB, NV)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV)
      INTEGER NV, K
      DO 10 K = 1, NMOD
        IF (MDON(K) .EQ. 1) CALL MDRAW(VB, NV, K)
   10 CONTINUE
      ISTYLE = 1
      RETURN
      END
C
C     MDRAW: draw placed model K: solid edges, then free lines and
C     face marks, each against every placed solid.
      SUBROUTINE MDRAW(VB, NV, K)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV)
      INTEGER NV, K
      DOUBLE PRECISION V(3), W(3), A(3), B(3)
      INTEGER I, J, L, IS, IH
C     Solid edges.  Hidden when both faces are turned away, unless
C     the camera is inside the solid.
      IF (MDS2(K) .LT. MDS1(K)) GO TO 90
      DO 80 IS = MDS1(K), MDS2(K)
        DO 70 J = 1, NLE(IS)
          DO 65 I = 1, 3
            A(I) = LWV(I,LME(1,J,IS),IS)
            B(I) = LWV(I,LME(2,J,IS),IS)
   65     CONTINUE
          IH = 0
          IF (LWD(LME(3,J,IS),IS) .GE. 0.0D0 .AND.
     &        LWD(LME(4,J,IS),IS) .GE. 0.0D0) IH = 1
          IF (LINS(IS) .EQ. 1) IH = 0
          CALL LMSEG(VB, NV, A, B, IS, IH)
   70   CONTINUE
   80 CONTINUE
C     Free lines and face marks.
   90 IF (MDX2(K) .LT. MDX1(K)) RETURN
      DO 100 J = MDX1(K), MDX2(K)
        DO 85 L = 0, 1
          DO 82 I = 1, 3
            V(I) = (LXL(I + 3 * L, J) - MDBO(I,K)) * 1.0D-3
   82     CONTINUE
          CALL MXV(MDAT(1,1,K), V, W)
          DO 84 I = 1, 3
            IF (L .EQ. 0) A(I) = MDP(I,K) + W(I)
            IF (L .EQ. 1) B(I) = MDP(I,K) + W(I)
   84     CONTINUE
   85   CONTINUE
        IS = LXS(J)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (IS .GT. 0) THEN
          IF (LWD(LXF(J),IS) .GE. 0.0D0 .AND. LINS(IS) .EQ. 0)
     &      GO TO 100
        END IF
C     RESTOMOD END
        CALL LMSEG(VB, NV, A, B, IS, 0)
  100 CONTINUE
      ISTYLE = 1
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
      DOUBLE PRECISION PS(3)
      INTEGER I
      TCLS = 3.0D0 * 3600.0D0 + 20.0D0 * 60.0D0 + 30.0D0
      TDOK = 3.0D0 * 3600.0D0 + 24.0D0 * 60.0D0 + 3.1D0
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
      INTEGER I
      T = 3.0D0 * 3600.0D0 + 9.0D0 * 60.0D0 + 20.0D0
      CALL TLIORB(T, R, V)
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
C     S7COAS: the COAS cross hairs, fixed to the CSM.  TN D-6853
C     (printed p. 12): "Command module and LM windows and optics
C     outlines can be simulated."  The reticle's pattern and size here
C     are our guess: a cross +-6 deg, open in the middle so the target
C     shows.
      SUBROUTINE S7COAS(VB, NV)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV)
      INTEGER NV
      IVMODE = 0
      ISTYLE = 1
      CALL OVLINE(VB, NV, -6.0D0, 0.0D0, -1.0D0, 0.0D0)
      CALL OVLINE(VB, NV, 1.0D0, 0.0D0, 6.0D0, 0.0D0)
      CALL OVLINE(VB, NV, 0.0D0, -6.0D0, 0.0D0, -1.0D0)
      CALL OVLINE(VB, NV, 0.0D0, 1.0D0, 0.0D0, 6.0D0)
      RETURN
      END
C
C     LMSEG: edge A-B of solid IS (0 for a free line) in 12 pieces,
C     each tested against the other solids.  IHID = 1: the whole edge
C     is known hidden.
      SUBROUTINE LMSEG(VB, NV, A, B, IS, IHID)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), A(3), B(3)
      INTEGER NV, IS, IHID
      DOUBLE PRECISION P0(3), P1(3), M(3), F0, F1
      INTEGER I, K, NP, IV, IV0, LMOCC
      INTEGER IDSH
      NP = 12
      IDSH = MOD(IFLG / 4, 2)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (IHID .EQ. 1) THEN
        IF (IDSH .EQ. 1) THEN
          ISTYLE = 2
          CALL MSEG(VB, NV, A, B)
          ISTYLE = 1
        END IF
        RETURN
      END IF
C     RESTOMOD END
C     Runs of equal visibility are merged into one vector.
      IV0 = -1
      DO 30 K = 1, NP
        F0 = DBLE(K - 1) / DBLE(NP)
        F1 = DBLE(K) / DBLE(NP)
        DO 10 I = 1, 3
          M(I) = A(I) + 0.5D0 * (F0 + F1) * (B(I) - A(I))
   10   CONTINUE
        IV = 1 - LMOCC(M, IS)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (IV .NE. IV0) THEN
          IF (IV0 .GE. 0) CALL LMRUN(VB, NV, P0, P1, IV0, IDSH)
          DO 15 I = 1, 3
            P0(I) = A(I) + F0 * (B(I) - A(I))
   15     CONTINUE
          IV0 = IV
        END IF
C     RESTOMOD END
        DO 20 I = 1, 3
          P1(I) = A(I) + F1 * (B(I) - A(I))
   20   CONTINUE
   30 CONTINUE
      CALL LMRUN(VB, NV, P0, P1, IV0, IDSH)
      RETURN
      END
C
      SUBROUTINE LMRUN(VB, NV, P0, P1, IV, IDSH)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), P0(3), P1(3)
      INTEGER NV, IV, IDSH
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (IV .EQ. 1) THEN
        ISTYLE = 1
        CALL MSEG(VB, NV, P0, P1)
      ELSE IF (IDSH .EQ. 1) THEN
        ISTYLE = 2
        CALL MSEG(VB, NV, P0, P1)
        ISTYLE = 1
      END IF
C     RESTOMOD END
      RETURN
      END
C
C     LMOCC: 1 if the sight line to P passes through a placed solid
C     other than IS (Cyrus-Beck against the face planes).  Solids with
C     the camera inside do not count (MPLACE).
      INTEGER FUNCTION LMOCC(P, IS)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION P(3), T0, T1, DEN, T
      INTEGER IS, K, J
C     RESTOMOD BEGIN: Cyrus-Beck ray/convex test, published 1978
      LMOCC = 0
      DO 20 K = 1, NSOL
        IF (K .EQ. IS) GO TO 20
        IF (LACT(K) .EQ. 0 .OR. LINS(K) .EQ. 1) GO TO 20
        T0 = 0.0D0
        T1 = 0.999D0
        DO 10 J = 1, NLF(K)
          DEN = LWN(1,J,K)*P(1) + LWN(2,J,K)*P(2) + LWN(3,J,K)*P(3)
          IF (DEN .EQ. 0.0D0) THEN
            IF (LWD(J,K) .LT. 0.0D0) GO TO 20
          ELSE
            T = LWD(J,K) / DEN
            IF (DEN .GT. 0.0D0) THEN
              IF (T .LT. T1) T1 = T
            ELSE
              IF (T .GT. T0) T0 = T
            END IF
          END IF
          IF (T0 .GE. T1) GO TO 20
   10   CONTINUE
        LMOCC = 1
        RETURN
   20 CONTINUE
C     RESTOMOD END
      RETURN
      END
C
C-----------------------------------------------------------------------
C     MSEG: 3-D segment A-B (camera relative) to the frame, for model
C     edges, which may pass beside or behind the camera or very close
C     to it (a cabin seen from inside).  Without recursion, a stack of
C     pieces:
C       both ends projected: one vector if the projected midpoint is
C         within 0.1 percent of the box half-width of the chord (always
C         so in the gnomonic plot, where lines stay straight), else
C         split in two (a line bends in the stereographic plot, and
C         can pass behind the camera between two seen ends);
C       one end past the limit (THLIM, 90 deg times k): cut at the
C         limit by bisection, keep the seen part;
C       both ends past it: the limit cone is convex only up to 90 deg,
C         so the piece can still cross the view: find its point
C         nearest the boresight (the angle off it has one minimum along
C         a line, so a ternary search) and split there if it is seen.
C     Pieces are split at most 10 deep.  A point at the camera itself
C     projects to the centre (PROJ); nothing divides by the range.
C-----------------------------------------------------------------------
      SUBROUTINE MSEG(VB, NV, A, B)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), A(3), B(3)
      INTEGER NV
      DOUBLE PRECISION SP(3,32), SQ(3,32), P(3), Q(3), M(3), T(3), W(3)
      DOUBLE PRECISION XP, YP, XQ, YQ, XM, YM, DEV, TOL, T0, T1, TA, TB
      DOUBLE PRECISION FA, FB, MSCOS
      INTEGER SD(32), NS, D, KP, KQ, KM, I, IT
      TOL = 1.0D-3 * BOXH
      NS = 1
      SD(1) = 0
      DO 5 I = 1, 3
        SP(I,1) = A(I)
        SQ(I,1) = B(I)
    5 CONTINUE
   10 IF (NS .EQ. 0) RETURN
      DO 12 I = 1, 3
        P(I) = SP(I,NS)
        Q(I) = SQ(I,NS)
   12 CONTINUE
      D = SD(NS)
      NS = NS - 1
      CALL PROJ(P, XP, YP, KP)
      CALL PROJ(Q, XQ, YQ, KQ)
      IF (KP .EQ. 0 .AND. KQ .EQ. 0) GO TO 40
      IF (KP .EQ. 0 .OR. KQ .EQ. 0) GO TO 30
C     Both ends seen.
      DO 14 I = 1, 3
        M(I) = 0.5D0 * (P(I) + Q(I))
   14 CONTINUE
      CALL PROJ(M, XM, YM, KM)
C     Distance of the projected midpoint off the chord's line (the
C     midpoint in space need not project to the chord's midpoint).
      T0 = DSQRT((XQ - XP)**2 + (YQ - YP)**2)
      DEV = DSQRT((XM - XP)**2 + (YM - YP)**2)
      IF (T0 .GT. 1.0D-9) DEV = DABS((XM - XP) * (YQ - YP)
     &  - (YM - YP) * (XQ - XP)) / T0
      IF (D .GE. 10) GO TO 20
      IF (KM .EQ. 1 .AND. DEV .LE. TOL) GO TO 20
      IF (NS .GE. 31) GO TO 20
      CALL MSPUSH(SP, SQ, SD, NS, M, Q, D + 1)
      CALL MSPUSH(SP, SQ, SD, NS, P, M, D + 1)
      GO TO 10
   20 CALL EMIT(VB, NV, XP, YP, XQ, YQ)
      GO TO 10
C     One end past the limit: bisect for the crossing (T seen, M not),
C     keep the order A to B.
   30 DO 32 I = 1, 3
        T(I) = P(I)
        M(I) = Q(I)
        IF (KP .EQ. 0) T(I) = Q(I)
        IF (KP .EQ. 0) M(I) = P(I)
   32 CONTINUE
      DO 36 IT = 1, 20
        CALL MSMID(T, M, W, KM)
   36 CONTINUE
      IF (KP .EQ. 1) CALL MSPUSH(SP, SQ, SD, NS, P, T, D)
      IF (KP .EQ. 0) CALL MSPUSH(SP, SQ, SD, NS, T, Q, D)
      GO TO 10
C     Both ends past the limit.
   40 IF (D .GE. 10) GO TO 10
      TA = 0.0D0
      TB = 1.0D0
      DO 44 IT = 1, 40
        T0 = TA + (TB - TA) / 3.0D0
        T1 = TB - (TB - TA) / 3.0D0
        FA = MSCOS(P, Q, T0)
        FB = MSCOS(P, Q, T1)
        IF (FA .LT. FB) TA = T0
        IF (FA .GE. FB) TB = T1
   44 CONTINUE
      T0 = 0.5D0 * (TA + TB)
      DO 46 I = 1, 3
        T(I) = P(I) + T0 * (Q(I) - P(I))
   46 CONTINUE
      CALL PROJ(T, XM, YM, KM)
      IF (KM .EQ. 0 .OR. NS .GE. 31) GO TO 10
      CALL MSPUSH(SP, SQ, SD, NS, T, Q, D + 1)
      CALL MSPUSH(SP, SQ, SD, NS, P, T, D + 1)
      GO TO 10
      END
C
C     MSPUSH: push the piece P-Q, depth D, on the MSEG stack.
      SUBROUTINE MSPUSH(SP, SQ, SD, NS, P, Q, D)
      DOUBLE PRECISION SP(3,32), SQ(3,32), P(3), Q(3)
      INTEGER SD(32), NS, D, I
      NS = NS + 1
      DO 10 I = 1, 3
        SP(I,NS) = P(I)
        SQ(I,NS) = Q(I)
   10 CONTINUE
      SD(NS) = D
      RETURN
      END
C
C     MSMID: one bisection step between seen T and unseen U; P is
C     scratch.  The midpoint replaces whichever end it matches.
      SUBROUTINE MSMID(T, U, P, KM)
      DOUBLE PRECISION T(3), U(3), P(3), X, Y
      INTEGER KM, I
      DO 10 I = 1, 3
        P(I) = 0.5D0 * (T(I) + U(I))
   10 CONTINUE
      CALL PROJ(P, X, Y, KM)
      DO 20 I = 1, 3
        IF (KM .EQ. 1) T(I) = P(I)
        IF (KM .EQ. 0) U(I) = P(I)
   20 CONTINUE
      RETURN
      END
C
C     MSCOS: cosine of the angle off the boresight of the point a
C     fraction F from P to Q (-1 at the camera itself).
      DOUBLE PRECISION FUNCTION MSCOS(P, Q, F)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION P(3), Q(3), F, X(3), R
      INTEGER I
      DO 10 I = 1, 3
        X(I) = P(I) + F * (Q(I) - P(I))
   10 CONTINUE
      R = DSQRT(X(1) * X(1) + X(2) * X(2) + X(3) * X(3))
      MSCOS = -1.0D0
      IF (R .GT. 0.0D0) MSCOS = (X(1) * CB(1) + X(2) * CB(2)
     &  + X(3) * CB(3)) / R
      RETURN
      END
C
C=======================================================================
C     LM FRONT WINDOW OVERLAY.  Landing point designator scale and the
C     commander's window frame, fixed to the LM (drawn in reference
C     plot degrees, so they move with free-look).  TN D-6853 (printed
C     p. 7) says the LPD and scribe marks came from LM window
C     engineering drawings; we do not have them.  The geometry below
C     is our reading of the film's descent frames (film seconds 27-35,
C     reference/video_frames/descent_t*.png), taking 60 px per 10 deg
C     from the edge numbers and Y = 0 at the "0" labels:
C       scale line  X = 0 from Y = +36 to the sill, small marks every
C                   1.125 deg on alternate sides, a longer mark to the
C                   right every 9 deg down to the lower cross bar;
C       cross bars  upper at Y = +29.3, +-11 deg, ticks up at 5, 10;
C                   lower at Y = -18.8, +-6.5 deg, end ticks down;
C       window      sill near Y = -35, right edge two lines to the
C                   frame top (the film's frame is cut at Y = +41).
C=======================================================================
      SUBROUTINE OVLPD(VB, NV)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV)
      INTEGER NV
      DOUBLE PRECISION Y, WX(9), WY(9), YU, YL
      INTEGER K, J
      IVMODE = 0
      ISTYLE = 1
      YU = 29.3D0
      YL = -18.8D0
      CALL OVLINE(VB, NV, 0.0D0, 36.0D0, 0.0D0, -35.5D0)
      DO 10 J = -14, 48
        Y = YL + 1.125D0 * DBLE(J)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (MOD(J + 16, 8) .EQ. 0 .AND. J .GT. 0) THEN
          IF (Y .LT. YU) CALL OVLINE(VB, NV, 0.0D0, Y, 2.5D0, Y)
          GO TO 10
        END IF
        IF (MOD(J + 16, 2) .EQ. 0) THEN
          CALL OVLINE(VB, NV, -0.6D0, Y, 0.0D0, Y)
        ELSE
          CALL OVLINE(VB, NV, 0.0D0, Y, 0.6D0, Y)
        END IF
C     RESTOMOD END
   10 CONTINUE
C     Upper cross bar, ticks up at 5 and 10 deg each side and the ends.
      CALL OVLINE(VB, NV, -11.0D0, YU, 11.0D0, YU)
      DO 20 K = -2, 2
        IF (K .NE. 0) CALL OVLINE(VB, NV, 5.0D0 * DBLE(K), YU,
     &                            5.0D0 * DBLE(K), YU + 1.3D0)
   20 CONTINUE
C     Lower cross bar with end ticks down.
      CALL OVLINE(VB, NV, -6.5D0, YL, 6.5D0, YL)
      CALL OVLINE(VB, NV, -6.5D0, YL, -6.5D0, YL - 1.5D0)
      CALL OVLINE(VB, NV, 6.5D0, YL, 6.5D0, YL - 1.5D0)
C     Window frame: sill, then the right-hand edge as two lines.
      WX(1) = -60.0D0
      WY(1) = -34.8D0
      WX(2) = -30.0D0
      WY(2) = -34.5D0
      WX(3) = -12.0D0
      WY(3) = -35.3D0
      WX(4) = -1.0D0
      WY(4) = -35.7D0
      WX(5) = 13.4D0
      WY(5) = 38.0D0
      WX(6) = 10.0D0
      WY(6) = 40.5D0
      DO 40 K = 1, 5
        CALL OVLINE(VB, NV, WX(K), WY(K), WX(K+1), WY(K+1))
   40 CONTINUE
      WX(1) = -1.0D0
      WY(1) = -35.7D0
      WX(2) = 2.0D0
      WY(2) = -33.5D0
      WX(3) = 5.5D0
      WY(3) = -27.0D0
      WX(4) = 16.0D0
      WY(4) = 37.0D0
      WX(5) = 15.5D0
      WY(5) = 38.5D0
      WX(6) = 10.0D0
      WY(6) = 40.5D0
      DO 50 K = 1, 5
        CALL OVLINE(VB, NV, WX(K), WY(K), WX(K+1), WY(K+1))
   50 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     LMSHAD: the LM's shadow on the ground in the descent.  Every
C     vertex of the LM wireframe (model KLMD, MLIB) is carried along the Sun's
C     direction to the lunar sphere and the edges are drawn there as a
C     surface feature (facing test, so it hides below the horizon and
C     foreshortens like a crater).  The film shows a small LM-shaped
C     figure below the horizon late in the descent (descent_t35.png);
C     that it is the shadow is our reading.  Eye 3 m above the base.
C-----------------------------------------------------------------------
      SUBROUTINE LMSHAD(VB, NV, GET)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), GET
      INTEGER NV
      DOUBLE PRECISION PMF(3), XB(3), YB(3), ZB(3), SMF(3), V(3)
      DOUBLE PRECISION A(3), B(3)
      INTEGER IS, J, K, IOK
      CALL LMDESC(GET, PMF, XB, YB, ZB)
      CALL MTXV(MMF, SUNU, SMF)
      IVMODE = 3
      ISTYLE = 1
      DO 20 IS = MDS1(KLMD), MDS2(KLMD)
        DO 10 J = 1, NLE(IS)
          DO 5 K = 1, 3
            V(K) = LMV(K,LME(1,J,IS),IS)
    5     CONTINUE
          CALL SHADPT(V, PMF, XB, YB, ZB, SMF, A, IOK)
          IF (IOK .EQ. 0) GO TO 10
          DO 6 K = 1, 3
            V(K) = LMV(K,LME(2,J,IS),IS)
    6     CONTINUE
          CALL SHADPT(V, PMF, XB, YB, ZB, SMF, B, IOK)
          IF (IOK .EQ. 0) GO TO 10
          CALL PEN(VB, NV, A, 0)
          CALL PEN(VB, NV, B, 1)
   10   CONTINUE
   20 CONTINUE
      DO 30 J = MDX1(KLMD), MDX2(KLMD)
        IF (LXS(J) .NE. 0) GO TO 30
        CALL SHADPT(LXL(1,J), PMF, XB, YB, ZB, SMF, A, IOK)
        IF (IOK .EQ. 0) GO TO 30
        CALL SHADPT(LXL(4,J), PMF, XB, YB, ZB, SMF, B, IOK)
        IF (IOK .EQ. 0) GO TO 30
        CALL PEN(VB, NV, A, 0)
        CALL PEN(VB, NV, B, 1)
   30 CONTINUE
      IVMODE = 0
      RETURN
      END
C
C     SHADPT: LM body point V (m; X up, Y right, Z forward) to its
C     shadow on the Moon, returned camera relative EQ in P.
      SUBROUTINE SHADPT(V, PMF, XB, YB, ZB, SMF, P, IOK)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION V(3), PMF(3), XB(3), YB(3), ZB(3), SMF(3), P(3)
      DOUBLE PRECISION W(3), G(3), B, C, DS, T
      INTEGER IOK, K
      IOK = 0
      DO 10 K = 1, 3
        W(K) = PMF(K) + ((V(1) - 3.0D0) * XB(K) + V(2) * YB(K)
     &       + V(3) * ZB(K)) * 1.0D-3
   10 CONTINUE
      B = W(1) * SMF(1) + W(2) * SMF(2) + W(3) * SMF(3)
      C = W(1)**2 + W(2)**2 + W(3)**2 - RM * RM
      DS = B * B - C
      IF (DS .LT. 0.0D0) RETURN
      T = B - DSQRT(DS)
      IF (T .LT. 0.0D0) RETURN
      DO 20 K = 1, 3
        G(K) = W(K) - T * SMF(K)
   20 CONTINUE
      CALL MXV(MMF, G, P)
      DO 30 K = 1, 3
        P(K) = P(K) + MPOS(K)
   30 CONTINUE
      IOK = 1
      RETURN
      END
C
C     OVLINE: straight line in reference plot degrees, carried to the
C     live camera through its 3-D directions in 1 deg steps.
      SUBROUTINE OVLINE(VB, NV, X1, Y1, X2, Y2)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), X1, Y1, X2, Y2
      INTEGER NV
      DOUBLE PRECISION D(3), F, L
      INTEGER K, N
      L = DSQRT((X2 - X1)**2 + (Y2 - Y1)**2)
      N = 1 + INT(L)
      DO 10 K = 0, N
        F = DBLE(K) / DBLE(N)
        CALL UNPROJ(X1 + F * (X2 - X1), Y1 + F * (Y2 - Y1), 1, D)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (K .EQ. 0) THEN
          CALL PEN(VB, NV, D, 0)
        ELSE
          CALL PEN(VB, NV, D, 1)
        END IF
C     RESTOMOD END
   10 CONTINUE
      RETURN
      END
C
C=======================================================================
C     VECTOR AND MATRIX UTILITIES
C=======================================================================
      DOUBLE PRECISION FUNCTION VDOT(A, B)
      DOUBLE PRECISION A(3), B(3)
      VDOT = A(1) * B(1) + A(2) * B(2) + A(3) * B(3)
      RETURN
      END
C
      DOUBLE PRECISION FUNCTION VNRM(A)
      DOUBLE PRECISION A(3)
      VNRM = DSQRT(A(1) * A(1) + A(2) * A(2) + A(3) * A(3))
      RETURN
      END
C
      SUBROUTINE VCRS(A, B, C)
      DOUBLE PRECISION A(3), B(3), C(3)
      C(1) = A(2) * B(3) - A(3) * B(2)
      C(2) = A(3) * B(1) - A(1) * B(3)
      C(3) = A(1) * B(2) - A(2) * B(1)
      RETURN
      END
C
      SUBROUTINE VUNIT(A)
      DOUBLE PRECISION A(3), S
      S = DSQRT(A(1) * A(1) + A(2) * A(2) + A(3) * A(3))
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (S .GT. 0.0D0) THEN
        A(1) = A(1) / S
        A(2) = A(2) / S
        A(3) = A(3) / S
      END IF
C     RESTOMOD END
      RETURN
      END
C
C     MXV: B = M A.   MTXV: B = transpose(M) A.   MXM: C = A B.
      SUBROUTINE MXV(M, A, B)
      DOUBLE PRECISION M(3,3), A(3), B(3)
      INTEGER I
      DO 10 I = 1, 3
        B(I) = M(I,1) * A(1) + M(I,2) * A(2) + M(I,3) * A(3)
   10 CONTINUE
      RETURN
      END
C
      SUBROUTINE MTXV(M, A, B)
      DOUBLE PRECISION M(3,3), A(3), B(3)
      INTEGER I
      DO 10 I = 1, 3
        B(I) = M(1,I) * A(1) + M(2,I) * A(2) + M(3,I) * A(3)
   10 CONTINUE
      RETURN
      END
C
      SUBROUTINE MXM(A, B, C)
      DOUBLE PRECISION A(3,3), B(3,3), C(3,3)
      INTEGER I, J
      DO 20 J = 1, 3
        DO 10 I = 1, 3
          C(I,J) = A(I,1) * B(1,J) + A(I,2) * B(2,J) + A(I,3) * B(3,J)
   10   CONTINUE
   20 CONTINUE
      RETURN
      END
C
C     Active rotations by angle A (rad) about X, Y, Z.
      SUBROUTINE ROTX(A, M)
      DOUBLE PRECISION A, M(3,3)
      CALL MUNIT(M)
      M(2,2) = DCOS(A)
      M(2,3) = -DSIN(A)
      M(3,2) = DSIN(A)
      M(3,3) = DCOS(A)
      RETURN
      END
C
      SUBROUTINE ROTY(A, M)
      DOUBLE PRECISION A, M(3,3)
      CALL MUNIT(M)
      M(1,1) = DCOS(A)
      M(1,3) = DSIN(A)
      M(3,1) = -DSIN(A)
      M(3,3) = DCOS(A)
      RETURN
      END
C
      SUBROUTINE ROTZ(A, M)
      DOUBLE PRECISION A, M(3,3)
      CALL MUNIT(M)
      M(1,1) = DCOS(A)
      M(1,2) = -DSIN(A)
      M(2,1) = DSIN(A)
      M(2,2) = DCOS(A)
      RETURN
      END
C
      SUBROUTINE MUNIT(M)
      DOUBLE PRECISION M(3,3)
      INTEGER I, J
      DO 20 J = 1, 3
        DO 10 I = 1, 3
          M(I,J) = 0.0D0
   10   CONTINUE
        M(J,J) = 1.0D0
   20 CONTINUE
      RETURN
      END
