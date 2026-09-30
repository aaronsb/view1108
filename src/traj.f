C=======================================================================
C
C     V I E W - 1 1 0 8          TRAJECTORY LEGS
C
C     Core element.  Where the spacecraft is at a GET.  One relocatable
C     element of the kernel; see vdrive.f for the list.
C
C     The scenario (data/scenarios, BLOCK DATA /CSCEN/: one mission's
C     data, a run deck in 1969 terms) gives the
C     epoch, the trajectory legs and the events.  VIEW itself
C     integrated trajectories from the state vectors of the operational
C     trajectory document (TN D-6853, p. 3, 12); we put each leg on
C     one simple model instead, fixed by sourced states:
C       CIRC   Earth circular orbit through a state (parking orbit);
C       CONIC  Earth-centred Kepler conic from a state, no lunar
C              gravity (translunar and transearth coast);
C       LUNAR  circle about the Moon through two states, its plane
C              and mean motion from those states (lunar orbit).
C     A g.e.t. outside every leg takes the nearest leg.
C       LM descent: P64 approach from 7200 ft altitude and 25600 ft
C         range at GET 102:41:30 down to the site at touchdown.
C
C=======================================================================
C
C-----------------------------------------------------------------------
C     SNSET: make scenario IM current: its epoch TJD0 (the ephemeris
C     keys on it), the elements of each of its legs (LGEL), and the
C     event times the scenes use.
C-----------------------------------------------------------------------
      SUBROUTINE SNSET(IM)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER IM
      DOUBLE PRECISION R(3), V(3), A(3), B(3), H(3), Y(3), M(3,3)
      DOUBLE PRECISION S(3), E(3), EV, AX, RR, VV, CN, SN, NU, EA, AN
      DOUBLE PRECISION EVGET, VDOT, VNRM, ANG
      INTEGER K, I
      ISN = IM
      TJD0 = SNJD0(IM)
      DO 90 K = 1, NLEG
        IF (LGSN(K) .NE. IM) GO TO 90
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (LGTYP(K) .EQ. KCIRC) THEN
C         Circle through the state's position, along its heading.
          CALL STATEV(LGP(1,K), LGGC(K), R, V)
          CALL VUNIT(R)
          CALL VUNIT(V)
          DO 10 I = 1, 3
            LGEL(I,K) = R(I)
            LGEL(I+3,K) = V(I)
   10     CONTINUE
          LGEL(9,K) = LGP(3,K)
          LGEL(10,K) = RE + LGP(6,K) * 1.852D0
          LGEL(11,K) = DSQRT(GME / LGEL(10,K)**3)
        ELSE IF (LGTYP(K) .EQ. KCONIC) THEN
C         Conic elements from the state: perigee unit P (1-3), Q 90
C         deg ahead (4-6), eccentricity (7), semi-major axis (8),
C         perigee time (9).
          CALL STATEV(LGP(1,K), LGGC(K), R, V)
          CALL VCRS(R, V, H)
          RR = VNRM(R)
          VV = VDOT(V, V)
          CALL VCRS(V, H, E)
          DO 20 I = 1, 3
            E(I) = E(I) / GME - R(I) / RR
   20     CONTINUE
          EV = VNRM(E)
          AX = 1.0D0 / (2.0D0 / RR - VV / GME)
          CALL VUNIT(H)
          CALL VUNIT(E)
          CALL VCRS(H, E, Y)
          CN = VDOT(R, E) / RR
          SN = VDOT(R, Y) / RR
          NU = DATAN2(SN, CN)
          EA = 2.0D0 * DATAN(DSQRT((1.0D0 - EV) / (1.0D0 + EV))
     &       * DTAN(0.5D0 * NU))
          AN = DSQRT(GME / AX**3)
          DO 30 I = 1, 3
            LGEL(I,K) = E(I)
            LGEL(I+3,K) = Y(I)
   30     CONTINUE
          LGEL(7,K) = EV
          LGEL(8,K) = AX
          LGEL(9,K) = LGP(3,K) - (EA - EV * DSIN(EA)) / AN
        ELSE
C         Lunar circle through state A at T and state B at TB, both
C         selenographic, carried to EQ by the Moon's orientation at
C         their times.  Sense: retrograde (LGGC = 0), the westward
C         motion of MR Table 7-II's lunar rows, or prograde (1).
          CALL LLUNIT(LGP(4,K), LGP(5,K), S)
          CALL MOONRT(LGP(3,K), M)
          CALL MXV(M, S, A)
          CALL LLUNIT(LGP(11,K), LGP(12,K), S)
          CALL MOONRT(LGP(10,K), M)
          CALL MXV(M, S, B)
          CALL VCRS(A, B, H)
          CALL VUNIT(H)
          DO 40 I = 1, 3
            S(I) = M(I,3)
   40     CONTINUE
          IF ((VDOT(H, S) .GT. 0.0D0) .EQV. (LGGC(K) .EQ. 0)) THEN
            DO 45 I = 1, 3
              H(I) = -H(I)
   45       CONTINUE
          END IF
          CALL VCRS(H, A, Y)
          ANG = DATAN2(VDOT(B, Y), VDOT(B, A))
          IF (ANG .LT. 0.0D0) ANG = ANG + 2.0D0 * PI
          DO 50 I = 1, 3
            LGEL(I,K) = A(I)
            LGEL(I+3,K) = Y(I)
   50     CONTINUE
          LGEL(9,K) = LGP(3,K)
          LGEL(10,K) = RM + LGP(6,K) * 1.852D0
          LGEL(11,K) = (ANG + 2.0D0 * PI * DBLE(LGN(K)))
     &               / (LGP(10,K) - LGP(3,K))
        END IF
C     RESTOMOD END
   90 CONTINUE
      LUT0 = EVGET(KETD)
      TETP = EVGET(KEEI)
      RETURN
      END
C
C     EVGET: g.e.t. (s) of the current scenario's event of kind KIND,
C     or -1 if it has none.
      DOUBLE PRECISION FUNCTION EVGET(KIND)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER KIND, J
      EVGET = -1.0D0
      DO 10 J = 1, NEVT
        IF (EVSN(J) .EQ. ISN .AND. EVKND(J) .EQ. KIND) EVGET = EVT(J)
   10 CONTINUE
      RETURN
      END
C
C     LEGAT: the current scenario's leg about the Earth (ICLS = 1: CIRC
C     or CONIC) or the Moon (ICLS = 2: LUNAR) whose span holds GET,
C     else the one whose span ends nearest it; 0 if there is none.
      INTEGER FUNCTION LEGAT(GET, ICLS)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, D, DBEST
      INTEGER ICLS, K, IC
      LEGAT = 0
      DBEST = 1.0D30
      DO 10 K = 1, NLEG
        IF (LGSN(K) .NE. ISN) GO TO 10
        IC = 1
        IF (LGTYP(K) .EQ. KLUNAR) IC = 2
        IF (IC .NE. ICLS) GO TO 10
        D = 0.0D0
        IF (GET .LT. LGP(1,K)) D = LGP(1,K) - GET
        IF (GET .GT. LGP(2,K)) D = GET - LGP(2,K)
        IF (D .GE. DBEST) GO TO 10
        DBEST = D
        LEGAT = K
   10 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     STATEV: the state in card fields P (the layout of LGP), geocentric
C     EQ km and km/s.  Latitude
C     geodetic (MR Table 7-I, p. 7-8) or geocentric (IGC = 1, as in
C     SP-4029's ascent table); altitude above the ellipsoid (ours:
C     equatorial radius RE, flattening 1/298.257); longitude Earth
C     fixed, turned by GMST at the state's time to the equator and
C     equinox of date, then to J2000 by PRECM's transpose.  Speed,
C     flight-
C     path angle and heading are space-fixed, against the geocentric
C     horizontal (MR Table 7-I).
C-----------------------------------------------------------------------
      SUBROUTINE STATEV(P, IGC, R, V)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER IGC
      DOUBLE PRECISION P(NLGP), R(3), V(3)
      DOUBLE PRECISION F, E2, FI, LA, H, SF, CF, XN, U(3), N(3), E(3)
      DOUBLE PRECISION G, HD, SP, GMSTAT, PSI, RA, PM(3,3), W(3)
      INTEGER I
      F = 1.0D0 / 298.257D0
      E2 = F * (2.0D0 - F)
      FI = P(4) * DR
      LA = P(5) * DR + GMSTAT(P(3))
      H = P(6) * 1.852D0
      SF = DSIN(FI)
      CF = DCOS(FI)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (IGC .EQ. 1) THEN
        RA = RE * (1.0D0 - F * SF * SF) + H
        R(1) = RA * CF * DCOS(LA)
        R(2) = RA * CF * DSIN(LA)
        R(3) = RA * SF
      ELSE
        XN = RE / DSQRT(1.0D0 - E2 * SF * SF)
        R(1) = (XN + H) * CF * DCOS(LA)
        R(2) = (XN + H) * CF * DSIN(LA)
        R(3) = (XN * (1.0D0 - E2) + H) * SF
      END IF
C     RESTOMOD END
C     Geocentric horizontal at R.
      DO 10 I = 1, 3
        U(I) = R(I)
   10 CONTINUE
      CALL VUNIT(U)
      PSI = DASIN(U(3))
      N(1) = -DSIN(PSI) * DCOS(LA)
      N(2) = -DSIN(PSI) * DSIN(LA)
      N(3) = DCOS(PSI)
      E(1) = -DSIN(LA)
      E(2) = DCOS(LA)
      E(3) = 0.0D0
      SP = P(7) * 0.3048D-3
      G = P(8) * DR
      HD = P(9) * DR
      DO 20 I = 1, 3
        V(I) = SP * (DSIN(G) * U(I) + DCOS(G) * (DCOS(HD) * N(I)
     &       + DSIN(HD) * E(I)))
   20 CONTINUE
C     Equator of date to J2000.
      CALL PRECM((TJD0 + P(3) / 86400.0D0 - 2451545.0D0) / 36525.0D0,
     &           PM)
      CALL MTXV(PM, R, W)
      CALL MTXV(PM, V, U)
      DO 30 I = 1, 3
        R(I) = W(I)
        V(I) = U(I)
   30 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     ERTORB: spacecraft about the Earth, geocentric EQ km and km/s,
C     on the current scenario's Earth leg for GET.
C-----------------------------------------------------------------------
      SUBROUTINE ERTORB(GET, R, V)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, R(3), V(3), TH, C, S
      INTEGER K, I, LEGAT
      K = LEGAT(GET, 1)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (LGTYP(K) .EQ. KCONIC) THEN
        CALL KEPLER(LGEL(1,K), LGEL(4,K), LGEL(7,K), LGEL(8,K),
     &              LGEL(9,K), GET, R, V)
      ELSE
        TH = LGEL(11,K) * (GET - LGEL(9,K))
        C = DCOS(TH)
        S = DSIN(TH)
        DO 10 I = 1, 3
          R(I) = LGEL(10,K) * (C * LGEL(I,K) + S * LGEL(I+3,K))
          V(I) = LGEL(10,K) * LGEL(11,K)
     &         * (C * LGEL(I+3,K) - S * LGEL(I,K))
   10   CONTINUE
      END IF
C     RESTOMOD END
      RETURN
      END
C
C-----------------------------------------------------------------------
C     LUNORB: CSM relative to the Moon, EQ km and km/s, on the current
C     scenario's lunar leg for GET.
C-----------------------------------------------------------------------
      SUBROUTINE LUNORB(GET, R, V)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, R(3), V(3), TH, C, S
      INTEGER K, I, LEGAT
      K = LEGAT(GET, 2)
      TH = LGEL(11,K) * (GET - LGEL(9,K))
      C = DCOS(TH)
      S = DSIN(TH)
      DO 10 I = 1, 3
        R(I) = LGEL(10,K) * (C * LGEL(I,K) + S * LGEL(I+3,K))
        V(I) = LGEL(10,K) * LGEL(11,K)
     &       * (C * LGEL(I+3,K) - S * LGEL(I,K))
   10 CONTINUE
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
C     LMDESC: LM on the P64 approach.  PMF (Moon centred, MF, km) is
C     the commander's eye, the camera; body axes XB (thrust, up), YB
C     (right), ZB (forward); LMALT the footpads' altitude (km).
C     Range and footpad altitude fall as the square of the time to go
C     to touchdown (the scenario's TOUCH event, LUT0), reaching 0 there;
C     after it the LM stands landed.  The line of sight to the site
C     stays near 16 deg below the horizontal; the LM pitches up from
C     40 to 5 deg off vertical.  This profile is ours, fitted to the
C     film's descent frames (VIEW's pre-flight output).  It is NOT the
C     flown one: the altitude calls (Apollo Lunar Surface Journal,
C     apollojournals.org/alsj/a11/a11.landing.html) have 1000 ft at
C     102:42:37, 300 at 102:43:46, 100 at 102:44:45, 40 at 102:45:17,
C     20 at 102:45:25 and "Contact Light" at 102:45:40; ours has
C     about 3850, 1490, 350, 60 and 26 ft at those times.  In the last
C     minute ours falls about 350 ft where the flown descent fell
C     about 100 ft, mostly a hover.
C     Eye height above the footpads, LMEYE: ours, 5.1 m.  The LM
C     "stands 22 feet 11 inches high" with the gear out, the ascent
C     stage is 12 feet 4 inches and the descent stage 10 feet 7 inches
C     high (Apollo 11 press kit, printed pp. 96, 101), so the ascent
C     stage's base is 3.23 m above the pads; we add 0.3 m to the cabin
C     floor and 1.6 m for a standing man's eye (our estimates).
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
C     The landing site and descent azimuth from the scenario.
      FI = SNSLA(ISN) * DR
      LA = SNSLO(ISN) * DR
      AZ = SNSAZ(ISN) * DR
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
      LMEYE = 5.1D-3
      TAU = LUT0 - GET
      IF (TAU .LT. 0.0D0) TAU = 0.0D0
      IF (TAU .GT. 600.0D0) TAU = 600.0D0
      Q = TAU / 250.0D0
      X = 7.80D0 * Q * Q
      H = 2.19D0 * Q * Q
      LMALT = H
      DO 20 I = 1, 3
        G(I) = S(I) - (X / RM) * F(I)
   20 CONTINUE
      CALL VUNIT(G)
      DO 30 I = 1, 3
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
C       The eye, LMEYE above the footpads along the LM's up axis.
        PMF(I) = (RM + H) * G(I) + LMEYE * XB(I)
   50 CONTINUE
      CALL VCRS(ZB, XB, YB)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     ERFIND: time TERISE at which the Earth's disc clears the lunar
C     horizon, on the revolution ending at touchdown (the scenario's
C     TOUCH event), or at its PHOTO event if it has no landing.
C-----------------------------------------------------------------------
      SUBROUTINE ERFIND
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION T, T1, T2, TM, F1, FM, P, ERCLR, TR, EVGET
      INTEGER I, LEGAT
C     The revolution ends at touchdown, or, in a scenario with no
C     landing (Apollo 8), at its PHOTO event.
      TR = LUT0
      IF (TR .LE. 0.0D0) TR = EVGET(KEPHO)
      P = 2.0D0 * PI / LGEL(11, LEGAT(TR, 2))
      T1 = TR - P
      F1 = ERCLR(T1)
      DO 10 I = 1, 720
        T = TR - P + DBLE(I) * P / 720.0D0
        FM = ERCLR(T)
        IF (F1 .LT. 0.0D0 .AND. FM .GE. 0.0D0) GO TO 20
        T1 = T
        F1 = FM
   10 CONTINUE
      TERISE = TR - 1800.0D0
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
      CALL VSTATE(T, 2, R, V)
      CALL MOONG(T, PM)
      DO 10 I = 1, 3
        E(I) = -PM(I) - R(I)
        DN(I) = -R(I)
   10 CONTINUE
      DE = DSQRT(VDOT(E, E))
      CALL VUNIT(E)
      CALL VUNIT(DN)
      ERCLR = DACOS(VDOT(E, DN)) - DASIN(RM / DSQRT(VDOT(R, R)))
     &      - DASIN(RE / DE)
      RETURN
      END
