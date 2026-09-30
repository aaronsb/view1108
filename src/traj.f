C=======================================================================
C
C     V I E W - 1 1 0 8          TRAJECTORY LEGS
C
C     Core element.  Where the spacecraft is at a GET.  One relocatable element of
C     the kernel; see vdrive.f for the list.
C
C     Our own simple models, keyed to Apollo 11 GETs.  VIEW itself
C     integrated trajectories (TN D-6853); the numbers below that are
C     not event times are our choices, not sources.
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
C=======================================================================
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
