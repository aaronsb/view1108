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
        CALL LMBILD
        INITD = 1
      END IF
C     RESTOMOD END
      ISCN = ISC
      IF (ISCN .LT. 1 .OR. ISCN .GT. 5) ISCN = 1
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
      ELSE
C       LM DESCENT, commander's front window, P64 approach.
        GET = 102.0D0*3600.0D0 + 42.0D0*60.0D0
        FOV = 100.0D0
      END IF
C     RESTOMOD END
      RETURN
      END
C
C=======================================================================
      SUBROUTINE VFRAME(GET, YAW, PIT, ROL, FOV, IFLAG,
     &                  VB, NV, SB, NS, LB, NL, HD)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, YAW, PIT, ROL, FOV
      INTEGER IFLAG, NV, NS, NL
      DOUBLE PRECISION VB(5,MAXV), SB(3,MAXS), LB(4,MAXL), HD(16)
      DOUBLE PRECISION PM(3), CG(3), CV(3), RB, RNG, D1, D2, D3, D4
      DOUBLE PRECISION PB(3), RR, VNRM, VDOT
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
      BOXH = FOVH
      THVIEW = FOVH * 1.4143D0 + 0.5D0
      IF (THVIEW .GT. 179.0D0) THVIEW = 179.0D0
      CSVIEW = DCOS(THVIEW * DR)
      THLIM = THVIEW + 10.0D0
      IF (THLIM .GT. 170.0D0) THLIM = 170.0D0
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
      CALL SCNCAM(GET, PM, CG, CV, IREF, IWIN)
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
      CALL LOOK(YAW, PIT, ROL)
      CALL MTXV(MMF, CB, CBMF)
C
      ISTYLE = 1
      IF (MOD(IFLG/2, 2) .EQ. 1) CALL DFRAME(VB, NV)
      IF (ISCN .NE. 4) CALL DSTARS(SB, NS, LB, NL)
      CALL DSUN(VB, NV, LB, NL)
      CALL DMOON(VB, NV, LB, NL)
      CALL DEARTH(VB, NV, LB, NL)
      IF (ISCN .EQ. 4) CALL LMDRAW(VB, NV, GET)
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
C     Reference body in the picture, for the page's camera steering:
C     centre X, Y (deg, even off frame), angular radius, in front flag.
      DO 40 I = 1, 3
        PB(I) = EPOS(I)
        IF (IREF .EQ. 2) PB(I) = MPOS(I)
        IF (ISCN .EQ. 4) PB(I) = 300.0D0 * 0.3048D-3 * BREF(I)
   40 CONTINUE
      RR = RE
      IF (IREF .EQ. 2) RR = RM
      IF (ISCN .EQ. 4) RR = 4.5D-3
      CALL PROJ(PB, HD(11), HD(12), IOK)
      HD(13) = DASIN(DMIN1(1.0D0, RR / VNRM(PB))) / DR
      HD(14) = 0.0D0
      IF (VDOT(PB, CB) .GT. 0.0D0) HD(14) = 1.0D0
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
      DOUBLE PRECISION DIP, CA, SA, CD, SD, P2(3), R2(3)
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
C     Lunar orbit.  Over the landing site 0.674 N 23.473 E at touchdown
C     heading 268.8 deg (westward, 1.2 deg south of west).
      LUT0 = 102.0D0*3600.0D0 + 45.0D0*60.0D0 + 40.0D0
      FI = 0.674D0 * DR
      LA = 23.473D0 * DR
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
      FI = 0.674D0 * DR
      LA = 23.473D0 * DR
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
C     PROJECTION.  Angle-angle about the window's lateral axis:
C       X = angle out of the window's vertical (pitch) plane, deg
C       Y = angle within that plane, above the boresight, deg
C     so X = ASIN(D.R), Y = ATAN2(D.U, D.B) for unit D.
C     Evidence (our inference, not stated in either report): in the
C     film's LM descent frames (t28, t31, t35; FOV about 100) the lunar
C     horizon is a straight horizontal line at every height from +12 to
C     +36 deg, and in MSC IN 69-FM-197 (PDF p. 170, docking window, FOV
C     100) it is straight across +-50 deg at Y = -30.  A horizon under a
C     level (unrolled) window is a near-great circle through the
C     lateral axis, which this mapping draws straight at any pitch;
C     azimuthal equidistant and azimuth-elevation about the window's
C     up axis both bow it.  Near the edges of a 170 deg field
C     (PDF p. 170, front windows) horizons curve, as they do here when
C     COS(X) is small.  At small fields all three agree.
C     The page and the report label the axes "X, deg" and "Y, deg".
C-----------------------------------------------------------------------
      SUBROUTINE PROJ(D, X, Y, IOK)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION D(3), X, Y, A, B, C, S
      INTEGER IOK
      A = D(1)*CR(1) + D(2)*CR(2) + D(3)*CR(3)
      B = D(1)*CU(1) + D(2)*CU(2) + D(3)*CU(3)
      C = D(1)*CB(1) + D(2)*CB(2) + D(3)*CB(3)
      S = DSQRT(A * A + B * B + C * C)
      IOK = 1
      IF (DATAN2(DSQRT(A * A + B * B), C) / DR .GT. THLIM) IOK = 0
      X = DASIN(A / S) / DR
      Y = DATAN2(B, C) / DR
      RETURN
      END
C
C     UNPROJ: plot (X, Y) degrees to a unit direction D.  IREF=1 uses
C     the reference attitude (for window overlays fixed to the
C     vehicle), IREF=0 the live camera.
      SUBROUTINE UNPROJ(X, Y, IREF, D)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION X, Y, D(3), A, B, C
      INTEGER IREF, I
      A = DSIN(X * DR)
      B = DCOS(X * DR) * DSIN(Y * DR)
      C = DCOS(X * DR) * DCOS(Y * DR)
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
C     SEG: 3-D segment A-B (camera relative) to the frame.  Segments
C     whose picture is far longer than their true angular length
C     straddle the point opposite the boresight and are dropped.
      SUBROUTINE SEG(VB, NV, A, B)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), A(3), B(3)
      INTEGER NV
      DOUBLE PRECISION X1, Y1, X2, Y2, CA, PL, VDOT
      INTEGER K1, K2
      CALL PROJ(A, X1, Y1, K1)
      IF (K1 .EQ. 0) RETURN
      CALL PROJ(B, X2, Y2, K2)
      IF (K2 .EQ. 0) RETURN
      PL = DSQRT((X2 - X1)**2 + (Y2 - Y1)**2)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (PL .GT. 20.0D0) THEN
        CA = VDOT(A, B) / DSQRT(VDOT(A, A) * VDOT(B, B))
        IF (CA .GT. 1.0D0) CA = 1.0D0
        IF (CA .LT. -1.0D0) CA = -1.0D0
        IF (PL .GT. 4.0D0 * DACOS(CA) / DR + 5.0D0) RETURN
      END IF
C     RESTOMOD END
      CALL EMIT(VB, NV, X1, Y1, X2, Y2)
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
C-----------------------------------------------------------------------
      INTEGER FUNCTION ISVIS(P)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION P(3), N(3), OCCL, SILL
      INTEGER I
      ISVIS = 1
      IF (IVMODE .EQ. 0) RETURN
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
      END IF
C     RESTOMOD END
      RETURN
      END
C
C     SILL: > 0 if P lies below the LM window sill, 33 deg below the
C     centre of the reference (vehicle-fixed) frame.
      DOUBLE PRECISION FUNCTION SILL(P)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION P(3), B, C
      B = P(1)*UREF(1) + P(2)*UREF(2) + P(3)*UREF(3)
      C = P(1)*BREF(1) + P(2)*BREF(2) + P(3)*BREF(3)
      SILL = -33.0D0 - DATAN2(B, C) / DR
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
      INTEGER I, IOK
      DO 10 I = 1, NSTAR
        U(1) = STX(I)
        U(2) = STY(I)
        U(3) = STZ(I)
        IF (U(1)*CB(1) + U(2)*CB(2) + U(3)*CB(3) .LT. CSVIEW) GO TO 10
        CALL PROJ(U, X, Y, IOK)
        IF (DABS(X) .GT. BOXH .OR. DABS(Y) .GT. BOXH) GO TO 10
        IF (RAYHIT(U, EPOS, RE) .GT. 0.0D0) GO TO 10
        IF (RAYHIT(U, MPOS, RM) .GT. 0.0D0) GO TO 10
        IF (NS .GE. MAXS) RETURN
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
      INTEGER IOK, K
      IF (SUNU(1)*CB(1) + SUNU(2)*CB(2) + SUNU(3)*CB(3) .LT. CSVIEW)
     &  RETURN
      IF (RAYHIT(SUNU, EPOS, RE) .GT. 0.0D0) RETURN
      IF (RAYHIT(SUNU, MPOS, RM) .GT. 0.0D0) RETURN
      CALL PROJ(SUNU, X, Y, IOK)
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
      DOUBLE PRECISION LA, CF, SF, OCCL
      INTEGER I, K, J, IOK, IP
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
C     Night side shading: straight parallel lines (TN D-6853, printed
C     p. 8, fig. 6).  Each
C     is cut from the sphere by a plane through the eye containing
C     the Sun's direction across the line of sight, so it draws as a
C     straight line along the light; 15 of them span the disc.  Not
C     from low orbit, where the film shows none.
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (ISCN .NE. 3) THEN
        K = 0
        CF = SUNU(1)*U(1) + SUNU(2)*U(2) + SUNU(3)*U(3)
        DO 32 I = 1, 3
          Q(I) = SUNU(I) - CF * U(I)
   32   CONTINUE
        IF (Q(1)**2 + Q(2)**2 + Q(3)**2 .LT. 1.0D-12) K = 1
        IF (K .EQ. 0) THEN
          CALL VUNIT(Q)
          CALL VCRS(U, Q, C)
          IVMODE = 4
          DO 50 J = -7, 7
            LA = DBLE(J) * AE / 7.5D0
            DO 35 I = 1, 3
              P(I) = C(I) * DCOS(LA) - U(I) * DSIN(LA)
   35       CONTINUE
            SF = D * DSIN(LA) / RE
            IF (DABS(SF) .LT. 1.0D0) THEN
              CALL CIRCLE(VB, NV, EPOS, RE, P, DACOS(SF), 180)
            END IF
   50     CONTINUE
        END IF
      END IF
C     RESTOMOD END
      IVMODE = 0
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (MOD(IFLG, 2) .EQ. 1 .AND. AE .LT. 0.3D0 * FOVH * DR) THEN
        CALL PROJ(EPOS, X, Y, IOK)
        IF (IOK .EQ. 1) THEN
          IF (OCCL(EPOS, MPOS, RM) .LE. 0.0D0)
     &      CALL LABEL(LB, NL, X, Y, 4, 0)
        END IF
      END IF
C     RESTOMOD END
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
        CALL CRATER(VB, NV, CRV(1,K), 0.5D0 * CRDIA(K) / RM, IOK)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (IOK .EQ. 1 .AND. CRDIA(K) .GE. 20.0D0 .AND.
     &      MOD(IFLG, 2) .EQ. 1) THEN
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
C     Seeded craters below the gazetteer's 4 km floor.  The gazetteer
C     is far too sparse to fill a window at orbital height; the film
C     shows dozens of rims.  Cells are fixed in latitude and
C     longitude and seeded from their indices, so the craters stay
C     put on the ground from frame to frame.
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (H .LT. 400.0D0) THEN
        CALL PCRAT(VB, NV, 0.5D0, 1.2D0, 2.5D0, 25.0D0, 1200.0D0, 1)
      END IF
C     RESTOMOD END
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (H .LT. 30.0D0) THEN
        CALL PCRAT(VB, NV, 0.1D0, 0.6D0, 0.8D0, 3.0D0, 80.0D0, 2)
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
      CS = (D(1)*CBMF(1) + D(2)*CBMF(2) + D(3)*CBMF(3)) / DD
      IF (CS .LT. DCOS(DMIN1(THVIEW * DR + RA, PI))) RETURN
C     Apparent diameter against the field.
      SIZ = 2.0D0 * RA / DR / (2.0D0 * FOVH)
      IF (SIZ .LT. 0.012D0) RETURN
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
C     PCRAT: seeded craters on a latitude-longitude grid of GC deg.
C     AVG mean craters per cell, diameters DMIN..DMAX km with a -2
C     power law, cells farther than RLIM km from the camera skipped.
C     The cells searched are those under a 7 x 7 grid of sight lines
C     across the frame.  Random numbers: Park-Miller minimal standard
C     generator, exact in double precision.
C-----------------------------------------------------------------------
      SUBROUTINE PCRAT(VB, NV, GC, AVG, DMIN, DMAX, RLIM, LEV)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), GC, AVG, DMIN, DMAX, RLIM
      INTEGER NV, LEV
      DOUBLE PRECISION U(3), W(3), GP(3), B, C, DS, T, FI, DL, LO0
      DOUBLE PRECISION FMIN, FMAX, LMIN, LMAX, MARG, SEED, RND
      DOUBLE PRECISION CLAT0, CLON0, CF, DIA, CM(3), Q, DC, RL2
      INTEGER I, J, K, IA, IB, JA, JB, NLON, JJ, NC, IOK, IFLR
C
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
          IF (T .GT. RLIM) T = RLIM
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
      IA = IFLR((FMIN + 90.0D0) / GC)
      IB = IFLR((FMAX + 90.0D0) / GC)
      JA = IFLR((LO0 + LMIN + 180.0D0) / GC)
      JB = IFLR((LO0 + LMAX + 180.0D0) / GC)
      IF (DBLE(IB - IA + 1) * DBLE(JB - JA + 1) .GT. 40000.0D0) RETURN
      NLON = NINT(360.0D0 / GC)
      RL2 = RLIM * RLIM
      DO 60 I = IA, IB
        DO 50 J = JA, JB
          JJ = MOD(J, NLON)
          IF (JJ .LT. 0) JJ = JJ + NLON
C     RESTOMOD: seed for the Park-Miller generator (1988)
          SEED = DMOD(DBLE(I) * 92821.0D0 + DBLE(JJ) * 68917.0D0
     &         + DBLE(LEV) * 1000003.0D0 + 12345.0D0,
     &           2147483646.0D0) + 1.0D0
          Q = RND(SEED)
          Q = RND(SEED)
          NC = INT(RND(SEED) * (2.0D0 * AVG + 1.0D0))
          CLAT0 = DBLE(I) * GC - 90.0D0
          CLON0 = DBLE(JJ) * GC - 180.0D0
          DO 40 K = 1, NC
            FI = (CLAT0 + RND(SEED) * GC) * DR
            DL = (CLON0 + RND(SEED) * GC) * DR
            Q = RND(SEED)
            CF = RND(SEED)
            IF (Q .GT. DCOS(FI)) GO TO 40
            DIA = DMIN / DSQRT(1.0D0 - CF * (1.0D0 - (DMIN/DMAX)**2))
            CM(1) = DCOS(FI) * DCOS(DL)
            CM(2) = DCOS(FI) * DSIN(DL)
            CM(3) = DSIN(FI)
            DC = (RM * CM(1) - CAMF(1))**2 + (RM * CM(2) - CAMF(2))**2
     &         + (RM * CM(3) - CAMF(3))**2
            IF (DC .GT. RL2) GO TO 40
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
C     LM WIREFRAME.  Convex prisms for the stages, lines for the legs.
C     Hidden parts: an edge between two faces turned away is hidden;
C     any piece whose sight line passes through another solid is
C     hidden.  Hidden pieces are dropped, as on the film, or drawn
C     dashed (style 2) when IFLG bit 2 is set.
C=======================================================================
      SUBROUTINE LMBILD
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION O(3), A1(3), A2(3), AN(3), P(2,8)
      DOUBLE PRECISION SX, SZ, R0, R1, X0, X1, Q, C, S
      INTEGER I, K
      NSOL = 0
      NXL = 0
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
C     Windows: two triangles on the cabin front (solid 2, face 10 is
C     the +Z cap).
      CALL XLINE(-1.05D0, 3.55D0, 1.16D0, -0.35D0, 3.65D0, 1.16D0, 2)
      CALL XLINE(-0.35D0, 3.65D0, 1.16D0, -0.55D0, 2.75D0, 1.16D0, 2)
      CALL XLINE(-0.55D0, 2.75D0, 1.16D0, -1.05D0, 3.55D0, 1.16D0, 2)
      CALL XLINE(1.05D0, 3.55D0, 1.16D0, 0.35D0, 3.65D0, 1.16D0, 2)
      CALL XLINE(0.35D0, 3.65D0, 1.16D0, 0.55D0, 2.75D0, 1.16D0, 2)
      CALL XLINE(0.55D0, 2.75D0, 1.16D0, 1.05D0, 3.55D0, 1.16D0, 2)
C     Hatch on the cabin front.
      CALL XLINE(-0.4D0, 2.0D0, 1.16D0, 0.4D0, 2.0D0, 1.16D0, 2)
      CALL XLINE(0.4D0, 2.0D0, 1.16D0, 0.4D0, 2.6D0, 1.16D0, 2)
      CALL XLINE(0.4D0, 2.6D0, 1.16D0, -0.4D0, 2.6D0, 1.16D0, 2)
      CALL XLINE(-0.4D0, 2.6D0, 1.16D0, -0.4D0, 2.0D0, 1.16D0, 2)
C
C     Legs on the diagonals: primary strut, two secondaries, pad.
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
      END
C
C     XLINE: free line (IS=0) or mark on the front cap of solid IS,
C     given as Y, X, Z in LM body metres.
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
      DOUBLE PRECISION P(2,8), O(3), A1(3), A2(3), AN(3), H
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
C     LMDRAW: the LM 300 ft from the CSM along the reference
C     boresight, turning slowly for inspection.
C-----------------------------------------------------------------------
      SUBROUTINE LMDRAW(VB, NV, GET)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), GET
      INTEGER NV
      DOUBLE PRECISION AT(3,3), R1(3,3), R2(3,3), R3(3,3), R4(3,3)
      DOUBLE PRECISION BX(3,3), LP(3), T, PS, TH, PH, V(3), W(3)
      DOUBLE PRECISION A(3), B(3), DIST
      INTEGER I, J, K, IS
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
C     Body metres to camera-relative km, centred on the stage joint.
      DO 60 IS = 1, NSOL
        DO 40 K = 1, NLV(IS)
          DO 30 I = 1, 3
            V(I) = LMV(I,K,IS) * 1.0D-3
   30     CONTINUE
          V(1) = V(1) - 2.3D-3
          CALL MXV(AT, V, W)
          DO 35 I = 1, 3
            LWV(I,K,IS) = LP(I) + W(I)
   35     CONTINUE
   40   CONTINUE
        DO 50 K = 1, NLF(IS)
          CALL MXV(AT, LMN(1,K,IS), W)
          DO 45 I = 1, 3
            LWN(I,K,IS) = W(I)
   45     CONTINUE
          LWD(K,IS) = (LMD(K,IS) - 2.3D0 * LMN(1,K,IS)) * 1.0D-3
     &      + W(1) * LP(1) + W(2) * LP(2) + W(3) * LP(3)
   50   CONTINUE
   60 CONTINUE
C     Solid edges.
      DO 80 IS = 1, NSOL
        DO 70 J = 1, NLE(IS)
          DO 65 I = 1, 3
            A(I) = LWV(I,LME(1,J,IS),IS)
            B(I) = LWV(I,LME(2,J,IS),IS)
   65     CONTINUE
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
          IF (LWD(LME(3,J,IS),IS) .GE. 0.0D0 .AND.
     &        LWD(LME(4,J,IS),IS) .GE. 0.0D0) THEN
            CALL LMSEG(VB, NV, A, B, IS, 1)
          ELSE
            CALL LMSEG(VB, NV, A, B, IS, 0)
          END IF
C     RESTOMOD END
   70   CONTINUE
   80 CONTINUE
C     Free lines and face marks.
      DO 100 J = 1, NXL
        DO 85 K = 0, 1
          DO 82 I = 1, 3
            V(I) = LXL(I + 3 * K, J) * 1.0D-3
   82     CONTINUE
          V(1) = V(1) - 2.3D-3
          CALL MXV(AT, V, W)
          DO 84 I = 1, 3
            IF (K .EQ. 0) A(I) = LP(I) + W(I)
            IF (K .EQ. 1) B(I) = LP(I) + W(I)
   84     CONTINUE
   85   CONTINUE
        IS = LXS(J)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (IS .GT. 0) THEN
          IF (LWD(LXF(J),IS) .GE. 0.0D0) GO TO 100
        END IF
C     RESTOMOD END
        CALL LMSEG(VB, NV, A, B, IS, 0)
  100 CONTINUE
      ISTYLE = 1
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
          CALL SEG(VB, NV, A, B)
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
        CALL SEG(VB, NV, P0, P1)
      ELSE IF (IDSH .EQ. 1) THEN
        ISTYLE = 2
        CALL SEG(VB, NV, P0, P1)
        ISTYLE = 1
      END IF
C     RESTOMOD END
      RETURN
      END
C
C     LMOCC: 1 if the sight line to P passes through a solid other
C     than IS (Cyrus-Beck against the face planes).
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
C=======================================================================
C     LM FRONT WINDOW OVERLAY.  Landing point designator scale and the
C     commander's window frame, fixed to the LM (drawn in reference
C     plot degrees, so they move with free-look).  LPD angle L lies at
C     plot Y = 46 - L on the reference vertical.
C=======================================================================
      SUBROUTINE OVLPD(VB, NV)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV)
      INTEGER NV
      DOUBLE PRECISION Y, W, WX(9), WY(9)
      INTEGER K
      IVMODE = 0
      ISTYLE = 1
      CALL OVLINE(VB, NV, 0.0D0, 46.0D0, 0.0D0, -34.0D0)
      DO 10 K = 0, 78, 2
        Y = 46.0D0 - DBLE(K)
        W = 0.6D0
        IF (MOD(K, 10) .EQ. 0) W = 1.5D0
        CALL OVLINE(VB, NV, -W, Y, W, Y)
   10 CONTINUE
C     Cross bars at LPD 10 and 60, marked every 5 deg to 10 deg.
      DO 30 K = 1, 2
        Y = 36.0D0
        IF (K .EQ. 2) Y = -14.0D0
        CALL OVLINE(VB, NV, -11.0D0, Y, 11.0D0, Y)
        CALL OVLINE(VB, NV, -11.0D0, Y - 1.2D0, -11.0D0, Y + 1.2D0)
        CALL OVLINE(VB, NV, -5.0D0, Y - 0.8D0, -5.0D0, Y + 0.8D0)
        CALL OVLINE(VB, NV, 5.0D0, Y - 0.8D0, 5.0D0, Y + 0.8D0)
        CALL OVLINE(VB, NV, 11.0D0, Y - 1.2D0, 11.0D0, Y + 1.2D0)
   30 CONTINUE
C     Window frame: lower sill, and the double right-hand edge.
      WX(1) = -60.0D0
      WY(1) = -32.6D0
      WX(2) = -30.0D0
      WY(2) = -32.2D0
      WX(3) = -12.0D0
      WY(3) = -33.0D0
      WX(4) = -1.1D0
      WY(4) = -33.5D0
      WX(5) = 14.6D0
      WY(5) = 46.4D0
      WX(6) = 11.0D0
      WY(6) = 51.0D0
      DO 40 K = 1, 5
        CALL OVLINE(VB, NV, WX(K), WY(K), WX(K+1), WY(K+1))
   40 CONTINUE
      WX(1) = -1.1D0
      WY(1) = -33.5D0
      WX(2) = 0.6D0
      WY(2) = -32.8D0
      WX(3) = 1.4D0
      WY(3) = -30.5D0
      WX(4) = 17.7D0
      WY(4) = 46.0D0
      WX(5) = 11.0D0
      WY(5) = 51.0D0
      DO 50 K = 1, 4
        CALL OVLINE(VB, NV, WX(K), WY(K), WX(K+1), WY(K+1))
   50 CONTINUE
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
