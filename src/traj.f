C=======================================================================
C
C     V I E W - 1 1 0 8          TRAJECTORY LEGS
C
C     Core element.  Where the spacecraft is at a GET.  One relocatable
C     element of the kernel; see vdrive.f for the list.
C
C     The scenario (data/missions, BLOCK DATA /CSCEN/: one mission's
C     data, a run deck in 1969 terms) gives the
C     epoch, the trajectory legs and the events.  VIEW itself
C     integrated trajectories from the state vectors of the operational
C     trajectory document (TN D-6853, p. 3, 12); we put each leg on
C     one simple model instead, fixed by sourced states:
C       CIRC   Earth circular orbit through a state (parking orbit);
C       CONIC  Earth-centred Kepler conic from a state, no lunar
C              gravity (translunar and transearth coast);
C       LUNAR  circle about the Moon through two states, its plane
C              and mean motion from those states (lunar orbit); its
C              radius may change steadily from the one to the other;
C       LCONIC Moon-centred Kepler conic from a state, or from the
C              vehicle's leg before it plus an impulse (the LM's
C              descent orbit and rendezvous);
C       TABLE  states listed at their g.e.t.s about the Earth, joined
C              by cubic Hermite arcs (TABRV): the powered ascent from
C              lift-off to S-IVB cutoff and the entry from entry
C              interface to splashdown.  Before its first row and
C              after its last a table holds that row's place on the
C              turning Earth (the pad, the splash point).
C     Each leg carries one vehicle, the CSM, the LM or the S-IVB.  For
C     the CSM a g.e.t. outside every leg takes the nearest leg; the LM
C     and the S-IVB have a state only where LMSTAT's and SIVST's rules
C     give them one.
C       LM descent: P64 approach from 7200 ft altitude and 25600 ft
C         range at GET 102:41:30 down to the site at touchdown.
C
C=======================================================================
C
C-----------------------------------------------------------------------
C     SNSET: make scenario IM current: its epoch TJD0 (the ephemeris
C     keys on it), the elements of each of its legs (LGEL), and the
C     event times the scenes use.  The LCONIC legs go last, as they
C     take their plane from the CSM's lunar legs and, with an impulse,
C     their start from the LM's leg before them.
C-----------------------------------------------------------------------
      SUBROUTINE SNSET(IM)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER IM
      DOUBLE PRECISION R(3), V(3), A(3), B(3), H(3), Y(3), M(3,3)
      DOUBLE PRECISION S(3)
      DOUBLE PRECISION EVGET, VDOT, ANG
      INTEGER K, I, IP, KP
      ISN = IM
      TJD0 = SNJD0(IM)
      DO 95 IP = 1, 2
      DO 90 K = 1, NLEG
        IF (LGSN(K) .NE. IM) GO TO 90
        IF (IP .EQ. 1 .AND. LGTYP(K) .EQ. KLCON) GO TO 90
        IF (IP .EQ. 2 .AND. LGTYP(K) .NE. KLCON) GO TO 90
C       A TABLE leg is read from its rows each time (TABRV).
        IF (LGTYP(K) .EQ. KTABL) GO TO 90
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
          CALL STATEV(LGP(1,K), LGGC(K), R, V)
          CALL CONEL(R, V, GME, LGP(3,K), LGEL(1,K))
        ELSE IF (LGTYP(K) .EQ. KLCON) THEN
C         A Moon-centred conic: from the same vehicle's leg before
C         this one at T with the impulse DV, or from a selenographic
C         state at T (LCST).
          KP = 0
          DO 20 I = 1, K - 1
            IF (LGSN(I) .EQ. IM .AND. LGVEH(I) .EQ. LGVEH(K)) KP = I
   20     CONTINUE
          IF (LGP(13,K) .NE. 0.0D0 .AND. KP .GT. 0) THEN
            CALL LEGRV(KP, LGP(3,K), R, A)
            DO 25 I = 1, 3
              V(I) = A(I)
   25       CONTINUE
            CALL IMPULS(R, A, LGP(13,K), LGP(14,K), LGP(15,K),
     &                  LGP(16,K), V)
          ELSE
            CALL LCST(LGP(1,K), R, V)
          END IF
          CALL CONEL(R, V, GMM, LGP(3,K), LGEL(1,K))
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
C         Radius changing at a steady rate from ALT at T to ALTB at TB
C         (km/s; 0 for a circle).
          LGEL(7,K) = (LGP(17,K) - LGP(6,K)) * 1.852D0
     &              / (LGP(10,K) - LGP(3,K))
        END IF
C     RESTOMOD END
   90 CONTINUE
   95 CONTINUE
      LUT0 = EVGET(KETD)
      TETP = EVGET(KEEI)
      RETURN
      END
C
C     CONEL: conic elements EL of the state R, V (km, km/s, about a
C     body of GM) at time T: perigee unit P (1-3), Q 90 deg ahead
C     (4-6), eccentricity (7), semi-major axis (8), perigee time (9).
      SUBROUTINE CONEL(R, V, GM, T, EL)
      DOUBLE PRECISION R(3), V(3), GM, T, EL(11)
      DOUBLE PRECISION H(3), E(3), Y(3), EV, AX, RR, VV, CN, SN, NU
      DOUBLE PRECISION EA, AN, VDOT, VNRM
      INTEGER I
      CALL VCRS(R, V, H)
      RR = VNRM(R)
      VV = VDOT(V, V)
      CALL VCRS(V, H, E)
      DO 20 I = 1, 3
        E(I) = E(I) / GM - R(I) / RR
   20 CONTINUE
      EV = VNRM(E)
      AX = 1.0D0 / (2.0D0 / RR - VV / GM)
      CALL VUNIT(H)
      CALL VUNIT(E)
      CALL VCRS(H, E, Y)
      CN = VDOT(R, E) / RR
      SN = VDOT(R, Y) / RR
      NU = DATAN2(SN, CN)
      EA = 2.0D0 * DATAN(DSQRT((1.0D0 - EV) / (1.0D0 + EV))
     &   * DTAN(0.5D0 * NU))
      AN = DSQRT(GM / AX**3)
      DO 30 I = 1, 3
        EL(I) = E(I)
        EL(I+3) = Y(I)
   30 CONTINUE
      EL(7) = EV
      EL(8) = AX
      EL(9) = T - (EA - EV * DSIN(EA)) / AN
      RETURN
      END
C
C     LCST: an LCONIC card's state (P, the layout of LGP) about the
C     Moon, EQ km and km/s: its selenographic position at its altitude
C     above the mean radius RM, its speed and flight-path angle, and
C     the horizontal direction of the CSM's lunar leg's plane at that
C     time (our choice; REFST, sim.f, puts the lunar REF rows so too).
      SUBROUTINE LCST(P, R, V)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION P(NLGP), R(3), V(3), S(3), U(3), M(3,3), HN(3)
      DOUBLE PRECISION W(3), RA, SP, G
      INTEGER K, I, LEGAT
      CALL LLUNIT(P(4), P(5), S)
      CALL MOONRT(P(3), M)
      CALL MXV(M, S, U)
      K = LEGAT(P(3), 2, 1)
      CALL VCRS(LGEL(1,K), LGEL(4,K), HN)
      CALL VCRS(HN, U, W)
      CALL VUNIT(W)
      RA = RM + P(6) * 1.852D0
      SP = P(7) * 0.3048D-3
      G = P(8) * DR
      DO 10 I = 1, 3
        R(I) = RA * U(I)
        V(I) = SP * (DSIN(G) * U(I) + DCOS(G) * W(I))
   10 CONTINUE
      RETURN
      END
C
C     IMPULS: add DV (ft/s) to VO along P, RD, N: the components
C     along the velocity, the in-plane radial and the orbit normal of
C     the state R, V (relative to the body whose frame they are in).
      SUBROUTINE IMPULS(R, V, DV, P, RD, N, VO)
      DOUBLE PRECISION R(3), V(3), DV, P, RD, N, VO(3)
      DOUBLE PRECISION X(3), Y(3), Z(3), DN, D
      INTEGER I
      DO 10 I = 1, 3
        X(I) = V(I)
   10 CONTINUE
      CALL VUNIT(X)
      CALL VCRS(R, V, Z)
      CALL VUNIT(Z)
      CALL VCRS(Z, X, Y)
      DN = DSQRT(P * P + RD * RD + N * N)
      IF (DN .LE. 0.0D0) RETURN
      D = DV * 0.3048D-3 / DN
      DO 20 I = 1, 3
        VO(I) = VO(I) + D * (P * X(I) + RD * Y(I) + N * Z(I))
   20 CONTINUE
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
C     LEGAT: the current scenario's leg of vehicle IVEH (1 CSM, 2 LM,
C     3 S-IVB)
C     about the Earth (ICLS = 1: CIRC, CONIC or TABLE) or the Moon
C     (ICLS = 2: LUNAR or LCONIC) whose span holds GET, else the one
C     whose span ends nearest it; 0 if there is none.
      INTEGER FUNCTION LEGAT(GET, ICLS, IVEH)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, D, DBEST
      INTEGER ICLS, IVEH, K, IC
      LEGAT = 0
      DBEST = 1.0D30
      DO 10 K = 1, NLEG
        IF (LGSN(K) .NE. ISN .OR. LGVEH(K) .NE. IVEH) GO TO 10
        IC = 1
        IF (LGTYP(K) .EQ. KLUNAR .OR. LGTYP(K) .EQ. KLCON) IC = 2
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
C     LUNIN: 1 if a CSM lunar leg of the current scenario holds GET in its
C     span, else 0 (between the lunar legs, or before or after them,
C     LEGAT still gives the nearest circle; a scene that rides the
C     CSM only in lunar orbit asks this first).  It follows the legs
C     even when the tape is the state source: the engine's impulsive
C     LOI and TEI sit at mid-burn, so for a minute or two at each edge
C     the tape's CSM and this test disagree (ours, accepted).
      INTEGER FUNCTION LUNIN(GET)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET
      INTEGER K, LEGAT
      LUNIN = 0
      K = LEGAT(GET, 2, 1)
      IF (K .EQ. 0) RETURN
      IF (GET .GE. LGP(1,K) .AND. GET .LE. LGP(2,K)) LUNIN = 1
      RETURN
      END
C
C-----------------------------------------------------------------------
C     STATEV: the state in card fields P (the layout of LGP), geocentric
C     EQ km and km/s.  Latitude
C     geodetic (MR Table 7-I, p. 7-8) or geocentric (IGC = 1 or 3, as in
C     SP-4029's ascent table); altitude above the ellipsoid (ours:
C     equatorial radius RE, flattening 1/298.257); longitude Earth
C     fixed, turned by GMST at the state's time to the equator and
C     equinox of date, then to J2000 by PRECM's transpose.  Speed,
C     flight-
C     path angle and heading are space-fixed, against the geocentric
C     horizontal (MR Table 7-I), or, with IGC 2 or 3, relative to the
C     turning Earth (a TABLE row's VEL=EF), the Earth's turning added.
C-----------------------------------------------------------------------
      SUBROUTINE STATEV(P, IGC, R, V)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER IGC
      DOUBLE PRECISION P(NLGP), R(3), V(3)
      DOUBLE PRECISION F, E2, FI, LA, H, SF, CF, XN, U(3), N(3), E(3)
      DOUBLE PRECISION G, HD, SP, GMSTAT, PSI, RA, PM(3,3), W(3), OM
      INTEGER I
C     The Earth's turning, rad/s: the rate of GMSTAT.
      OM = 360.98564736629D0 * DR / 86400.0D0
      F = 1.0D0 / 298.257D0
      E2 = F * (2.0D0 - F)
      FI = P(4) * DR
      LA = P(5) * DR + GMSTAT(P(3))
      H = P(6) * 1.852D0
      SF = DSIN(FI)
      CF = DCOS(FI)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (MOD(IGC, 2) .EQ. 1) THEN
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
      IF (IGC .LT. 2) GO TO 25
      V(1) = V(1) - OM * R(2)
      V(2) = V(2) + OM * R(1)
   25 CONTINUE
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
C     ERTORB: the CSM about the Earth, geocentric EQ km and km/s, on
C     the current scenario's Earth leg for GET.
C-----------------------------------------------------------------------
      SUBROUTINE ERTORB(GET, R, V)
      DOUBLE PRECISION GET, R(3), V(3)
      INTEGER LEGAT
      CALL LEGRV(LEGAT(GET, 1, 1), GET, R, V)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     LUNORB: vehicle IVEH (1 CSM, 2 LM) relative to the Moon, EQ km
C     and km/s, on the current scenario's lunar leg of that vehicle
C     for GET (the nearest one: LMSTAT decides where the LM has one).
C-----------------------------------------------------------------------
      SUBROUTINE LUNORB(GET, IVEH, R, V)
      DOUBLE PRECISION GET, R(3), V(3)
      INTEGER IVEH, LEGAT
      CALL LEGRV(LEGAT(GET, 2, IVEH), GET, R, V)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     LEGRV: position and velocity on leg K at GET, about its body (the
C     Earth for CIRC, CONIC and TABLE, the Moon for LUNAR and LCONIC),
C     EQ km and km/s.
C-----------------------------------------------------------------------
      SUBROUTINE LEGRV(K, GET, R, V)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, R(3), V(3), TH, C, S, GM, RA
      INTEGER K, I
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (LGTYP(K) .EQ. KCONIC .OR. LGTYP(K) .EQ. KLCON) THEN
        GM = GME
        IF (LGTYP(K) .EQ. KLCON) GM = GMM
        CALL KEPLER(LGEL(1,K), LGEL(4,K), LGEL(7,K), LGEL(8,K),
     &              LGEL(9,K), GM, GET, R, V)
      ELSE IF (LGTYP(K) .EQ. KTABL) THEN
        CALL TABRV(K, GET, R, V)
      ELSE IF (LGTYP(K) .EQ. KCIRC) THEN
        TH = LGEL(11,K) * (GET - LGEL(9,K))
        C = DCOS(TH)
        S = DSIN(TH)
        DO 10 I = 1, 3
          R(I) = LGEL(10,K) * (C * LGEL(I,K) + S * LGEL(I+3,K))
          V(I) = LGEL(10,K) * LGEL(11,K)
     &         * (C * LGEL(I+3,K) - S * LGEL(I,K))
   10   CONTINUE
      ELSE
C       LUNAR: the radius RA moves at LGEL(7) km/s.
        TH = LGEL(11,K) * (GET - LGEL(9,K))
        C = DCOS(TH)
        S = DSIN(TH)
        RA = LGEL(10,K) + LGEL(7,K) * (GET - LGEL(9,K))
        DO 20 I = 1, 3
          R(I) = RA * (C * LGEL(I,K) + S * LGEL(I+3,K))
          V(I) = RA * LGEL(11,K)
     &         * (C * LGEL(I+3,K) - S * LGEL(I,K))
     &         + LGEL(7,K) * (C * LGEL(I,K) + S * LGEL(I+3,K))
   20   CONTINUE
      END IF
C     RESTOMOD END
      RETURN
      END
C
C-----------------------------------------------------------------------
C     TABRV: position and velocity at GET on TABLE leg K, the arc
C     between two listed states A (at TA) and B (at TB), geocentric EQ
C     km and km/s.  Each row is made inertial at its own time
C     (STATEV), and the arc is the cubic Hermite through the two
C     positions with the two velocities as end slopes, as the tape is
C     read (TPGET): ours, VIEW integrated (TN D-6853, p. 3).  Before TA
C     the vehicle stands at A's place on the turning Earth, after TB
C     at B's (LEGAT hands a table its times outside every leg: before
C     lift-off and after splashdown).
C     The rows' altitudes are above the ellipsoid, but the Earth is
C     drawn as a sphere of radius RE, which the pad and the splash
C     point lie up to 6 km inside.  Near the ground a row is lifted
C     onto the sphere, by its ellipsoid's depth there times
C     1 - ALT/HB, nothing from HB (50 n mi, ours) up: the vehicle
C     stands on the drawn pad, and the rows at orbit and at entry
C     interface keep their true radius, where the legs either side
C     meet them.
C-----------------------------------------------------------------------
      SUBROUTINE TABRV(K, GET, R, V)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER K
      DOUBLE PRECISION GET, R(3), V(3)
      DOUBLE PRECISION PA(NLGP), PB(NLGP), RA(3), VA(3), RB(3), VB(3)
      DOUBLE PRECISION TA, TB, H, S, H00, H10, H01, H11, D00, D10, D01
      DOUBLE PRECISION D11, HB, SF
      INTEGER I, IGA, IGB
      HB = 50.0D0
      DO 10 I = 1, NLGP
        PA(I) = LGP(I,K)
        PB(I) = LGP(I,K)
   10 CONTINUE
      TA = LGP(3,K)
      TB = LGP(10,K)
      PB(3) = TB
      PB(4) = LGP(11,K)
      PB(5) = LGP(12,K)
      PB(6) = LGP(17,K)
      PB(7) = LGP(13,K)
      PB(8) = LGP(14,K)
      PB(9) = LGP(15,K)
      SF = DSIN(PA(4) * DR)
      IF (PA(6) .LT. HB) PA(6) = PA(6)
     &  + RE * SF * SF / (298.257D0 * 1.852D0) * (1.0D0 - PA(6) / HB)
      SF = DSIN(PB(4) * DR)
      IF (PB(6) .LT. HB) PB(6) = PB(6)
     &  + RE * SF * SF / (298.257D0 * 1.852D0) * (1.0D0 - PB(6) / HB)
      IGA = LGGC(K) + 2 * MOD(LGN(K), 2)
      IGB = LGGC(K) + 2 * (LGN(K) / 2)
C     Outside the arc: the end row's place at GET, at rest on the
C     Earth.
      IF (GET .GE. TA) GO TO 20
      PA(3) = GET
      PA(7) = 0.0D0
      CALL STATEV(PA, LGGC(K) + 2, R, V)
      RETURN
   20 IF (GET .LE. TB) GO TO 30
      PB(3) = GET
      PB(7) = 0.0D0
      CALL STATEV(PB, LGGC(K) + 2, R, V)
      RETURN
   30 CALL STATEV(PA, IGA, RA, VA)
      CALL STATEV(PB, IGB, RB, VB)
      H = TB - TA
      S = (GET - TA) / H
      H00 = (1.0D0 + 2.0D0 * S) * (1.0D0 - S)**2
      H10 = S * (1.0D0 - S)**2
      H01 = S * S * (3.0D0 - 2.0D0 * S)
      H11 = S * S * (S - 1.0D0)
      D00 = 6.0D0 * S * (S - 1.0D0) / H
      D10 = (1.0D0 - S) * (1.0D0 - 3.0D0 * S) / H
      D01 = -D00
      D11 = S * (3.0D0 * S - 2.0D0) / H
      DO 40 I = 1, 3
        R(I) = H00 * RA(I) + H10 * H * VA(I) + H01 * RB(I)
     &       + H11 * H * VB(I)
        V(I) = D00 * RA(I) + D10 * H * VA(I) + D01 * RB(I)
     &       + D11 * H * VB(I)
   40 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     KEPLER: position and velocity at GET on the ellipse P, Q, E, A
C     about a body of GM, with perigee at time TP.
C-----------------------------------------------------------------------
      SUBROUTINE KEPLER(P, Q, E, A, TP, GM, GET, R, V)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION P(3), Q(3), E, A, TP, GM, GET, R(3), V(3)
      DOUBLE PRECISION AM, EA, F, RR, B, C, S, VF
      INTEGER I, IT
      AM = DSQRT(GM / A**3) * (GET - TP)
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
      VF = DSQRT(GM * A) / RR
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
C     24 deg off vertical 250 s out to upright 77 s out, and stays
C     upright.  The film's horizon gives the boresight's depression,
C     and the pitch is LPDDN less that.  This profile is ours, fitted
C     to the film's descent frames (VIEW's pre-flight output).  It is
C     NOT the flown one: the altitude calls (Apollo Lunar Surface
C     Journal, apollojournals.org/alsj/a11/a11.landing.html) have
C     1000 ft at 102:42:37, 300 at 102:43:46, 100 at 102:44:45, 40 at
C     102:45:17, 20 at 102:45:25 and "Contact Light" at 102:45:40;
C     ours has about 3850, 1490, 350, 60 and 26 ft at those times.
C     In the last minute ours falls about 350 ft where the flown
C     descent fell about 100 ft, mostly a hover.
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
      TP = (35.0D0 * Q - 10.8D0) * DR
      IF (TP .GT. 44.2D0 * DR) TP = 44.2D0 * DR
      IF (TP .LT. 0.0D0) TP = 0.0D0
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
C     LMSTAT: the LM at GET relative to the Moon, EQ km and km/s: the
C     point of its body axes 2.3 m up the thrust axis from the descent
C     stage's base, the stage joint MPLACE centres it on (LMLOC, ours).
C     IOK = 0 where we have no state for it, 1 its own state, 2 docked
C     (the CSM's state).  The rules, in the scenario's events (ours
C     where marked):
C       before UNDOCK, and from LMDOK to JETT: docked;
C       UNDOCK to LMSEP: 300 ft from the CSM along the orbit normal,
C         the pirouette's distance (scene 4; ours);
C       LMSEP to LMSEP + 300 s: its first leg plus its offset from that
C         leg at LMSEP, dying away linearly, so the LM leaves the 300 ft
C         point without a jump (ours).  The range then opens at about
C         16 ft/s, 21 ft/s once on the leg (measured): faster than the
C         separation burn's 1.4 ft/s (MR Table 7-V p. 7-11), the leg
C         sinking toward the DOI row from separation on (ours);
C       TOUCH - 600 s to TOUCH: the modelled descent (LMDESC);
C       TOUCH to LIFT: landed at the site;
C       TPF to LMDOK: the CSM plus the LM's offset from it at TPF on
C         its last leg, closing linearly to nothing at docking (ours);
C       otherwise on a VEH=LM leg whose span holds GET, or across a
C         gap of 60 s or less between two of them (a burn; ours);
C       else none: the powered descent before LMDESC, the powered
C         ascent, after JETT, and a scenario without an UNDOCK event.
C     The CSM's state comes from the state source (CSMSL, CSMST:
C     replay or tape); the LM's own legs from the replay only.
C-----------------------------------------------------------------------
      SUBROUTINE LMSTAT(GET, R, V, IOK)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, R(3), V(3)
      INTEGER IOK
      DOUBLE PRECISION TU, TS, TF, TD, TJ, TL, F, D(3), DV(3), H(3)
      DOUBLE PRECISION PMF(3), P2(3), XB(3), YB(3), ZB(3), M(3,3)
      DOUBLE PRECISION SALT, SEYE, W, LMLOC, TBL, EVGET
      INTEGER I, K, LMLEG
C     Body point of the state above the footpads (km): the stage joint
C     at X = 2.3 m, the gear's pads at X = -1.1 m (LMGEAR).
      LMLOC = 3.4D-3
C     The separation's blend time (s; ours).
      TBL = 300.0D0
      IOK = 0
      TU = EVGET(KEUND)
      IF (TU .LT. 0.0D0) RETURN
      TS = EVGET(KELMS)
      TF = EVGET(KETPF)
      TD = EVGET(KELDK)
      TJ = EVGET(KEJET)
      TL = EVGET(KELFT)
      IF (TJ .GE. 0.0D0 .AND. GET .GE. TJ) RETURN
      IF (GET .LT. TU .OR. (TD .GE. 0.0D0 .AND. GET .GE. TD)) GO TO 10
      IF (TS .GE. 0.0D0 .AND. GET .LT. TS) GO TO 20
      IF (TF .GE. 0.0D0 .AND. TD .GT. TF .AND. GET .GE. TF) GO TO 30
      IF (LUT0 .GT. 0.0D0 .AND. GET .GE. LUT0 - 600.0D0
     &    .AND. GET .LT. LUT0) GO TO 40
      IF (LUT0 .GT. 0.0D0 .AND. GET .GE. LUT0
     &    .AND. (TL .LT. 0.0D0 .OR. GET .LT. TL)) GO TO 50
      K = LMLEG(GET)
      IF (K .EQ. 0) RETURN
      CALL LEGRV(K, GET, R, V)
      IOK = 1
      IF (TS .LT. 0.0D0 .OR. GET .GE. TS + TBL) RETURN
      IF (LMLEG(TS) .NE. K) RETURN
C     Just after the separation: the offset at LMSEP of the 300 ft
C     point (label 20) from the leg, dying away over TBL.
      CALL LEGRV(K, TS, D, DV)
      CALL CSMSL(TS, P2, XB)
      CALL VCRS(P2, XB, H)
      CALL VUNIT(H)
      F = 1.0D0 - (GET - TS) / TBL
      DO 5 I = 1, 3
        D(I) = P2(I) + 300.0D0 * 0.3048D-3 * H(I) - D(I)
        R(I) = R(I) + F * D(I)
        V(I) = V(I) - D(I) / TBL
    5 CONTINUE
      RETURN
C     Docked: the CSM.
   10 CALL CSMSL(GET, R, V)
      IOK = 2
      RETURN
C     Undocked, before the separation burn.
   20 CALL CSMSL(GET, R, V)
      CALL VCRS(R, V, H)
      CALL VUNIT(H)
      DO 25 I = 1, 3
        R(I) = R(I) + 300.0D0 * 0.3048D-3 * H(I)
   25 CONTINUE
      IOK = 1
      RETURN
C     Braking to docking: the offset at TPF, closing.
   30 K = LMLEG(TF)
      IF (K .EQ. 0) RETURN
      CALL LEGRV(K, TF, D, DV)
      CALL CSMSL(TF, H, XB)
      DO 32 I = 1, 3
        D(I) = D(I) - H(I)
   32 CONTINUE
      F = (TD - GET) / (TD - TF)
      CALL CSMSL(GET, R, V)
      DO 35 I = 1, 3
        R(I) = R(I) + F * D(I)
        V(I) = V(I) - D(I) / (TD - TF)
   35 CONTINUE
      IOK = 1
      RETURN
C     The modelled descent: LMDESC's eye less its height above the
C     state's point; velocity over one second, as scene 5 takes it.
C     LMDESC's LMALT and LMEYE belong to scene 5's frame: kept.
   40 SALT = LMALT
      SEYE = LMEYE
      CALL LMDESC(GET, PMF, XB, YB, ZB)
      CALL LMDESC(GET + 1.0D0, P2, YB, ZB, H)
      DO 42 I = 1, 3
        PMF(I) = PMF(I) - (LMEYE - LMLOC) * XB(I)
        P2(I) = P2(I) - (LMEYE - LMLOC) * YB(I)
   42 CONTINUE
      LMALT = SALT
      LMEYE = SEYE
      CALL MOONRT(GET, M)
      CALL MXV(M, PMF, R)
      CALL MOONRT(GET + 1.0D0, M)
      CALL MXV(M, P2, H)
      DO 45 I = 1, 3
        V(I) = H(I) - R(I)
   45 CONTINUE
      IOK = 1
      RETURN
C     Landed: the site, LMLOC above the mean radius, carried by the
C     Moon's turning (the IAU rate MOONRT uses, 13.17635815 deg/day).
   50 CALL LLUNIT(SNSLA(ISN), SNSLO(ISN), H)
      CALL MOONRT(GET, M)
      CALL MXV(M, H, PMF)
      W = 13.17635815D0 * DR / 86400.0D0
      DO 55 I = 1, 3
        R(I) = (RM + LMLOC) * PMF(I)
        XB(I) = M(I,3)
   55 CONTINUE
      CALL VCRS(XB, R, V)
      DO 58 I = 1, 3
        V(I) = W * V(I)
   58 CONTINUE
      IOK = 1
      RETURN
      END
C
C-----------------------------------------------------------------------
C     SIVST: the S-IVB at GET, geocentric EQ km and km/s: the centre of
C     the stage with its IU (half SIVBMD's 61.3 ft below the IU's top,
C     on its axis).  IOK = 0 where we have no state for it, 1 its own,
C     2 with the CSM (the CSM's state before separation; the stack's
C     place, docked).  The rules, in the scenario's events (ours where
C     marked):
C       before SEP: with the CSM, which it carries (IOK 2);
C       SEP to EJECT: the CSM plus scene 7's geometry (vdrive.f S7SIV
C         at S7RF's range, as S7POSE places it), IOK 1 to DOCK and 2
C         from it;
C       EJECT to SLING: the CSM plus its offset from the CSM at EJECT,
C         less the separation the CSM made from then on: the ejection
C         springs' "about one fps velocity to the spacecraft" (Apollo
C         11 press kit, printed p. 30) along the stack's axis, and each
C         of the scenario's BURN cards about the Earth in the span (the
C         evasive manoeuvre), an impulse at its time in the CSM leg's
C         frame there (IMPULS).  Straight lines (ours: the half hour's
C         gravity gradient, 25,000 km and more from the Earth's
C         centre, bends them by a few percent);
C       otherwise on a VEH=SIVB leg whose span holds GET, else none:
C         after SEP in a scenario without an EJECT event (Apollo 8,
C         see its scenario), and from SLING on (the slingshot: no
C         velocity change we hold).
C     The CSM's state is the state source's (CSMST: replay or tape).
C     The offsets are relative, so the range between the two is the
C     same from either; the replay's CSM leg has no evasive burn, so
C     there both are off their own paths by the burn's drift (ours).
C     ISRCU is left as it was (S7ATT and CSMST set it).
C-----------------------------------------------------------------------
      SUBROUTINE SIVST(GET, R, V, IOK)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, R(3), V(3)
      INTEGER IOK
      DOUBLE PRECISION TS, TE, TG, TD, T, P(3), DV(3), RB(3), VB(3)
      DOUBLE PRECISION VEJ, EVGET, S7RF
      INTEGER I, K, J, LEGAT
      J = ISRCU
      IOK = 0
      TS = EVGET(KESEP)
      TE = EVGET(KEEJC)
      TG = EVGET(KESLG)
      TD = EVGET(KEDOK)
      IF (TS .GE. 0.0D0 .AND. GET .LT. TS) GO TO 10
      IF (TE .LT. 0.0D0) GO TO 80
      IF (TG .GE. 0.0D0 .AND. GET .GE. TG) GO TO 80
      CALL S7ATT
      IF (GET .GE. TE) GO TO 30
C     Separated, docking, docked: scene 7's geometry.
      CALL S7SIV(S7RF(GET), P)
      CALL CSMST(GET, 1, R, V)
      DO 5 I = 1, 3
        R(I) = R(I) + P(I)
    5 CONTINUE
      IOK = 1
      IF (TD .GE. 0.0D0 .AND. GET .GE. TD) IOK = 2
      GO TO 90
C     Before the separation: with the CSM.
   10 CALL CSMST(GET, 1, R, V)
      IOK = 2
      GO TO 90
C     Ejected: the offset at EJECT, the springs' drift (1 ft/s, the
C     S-IVB down the stack's -X), then the CSM's burns taken back.
   30 CALL S7SIV(S7RF(TE), P)
      VEJ = 0.3048D-3
      T = GET - TE
      CALL CSMST(GET, 1, R, V)
      DO 35 I = 1, 3
        R(I) = R(I) + P(I) - VEJ * T * S7AT(I,1)
        V(I) = V(I) - VEJ * S7AT(I,1)
   35 CONTINUE
      DO 50 K = 1, NBN
        IF (BNSN(K) .NE. ISN .OR. BNBOD(K) .NE. 1) GO TO 50
        IF (BNT(K) .LE. TE .OR. BNT(K) .GT. GET) GO TO 50
        CALL ERTORB(BNT(K), RB, VB)
        CALL SETV(DV, 0.0D0, 0.0D0, 0.0D0)
        CALL IMPULS(RB, VB, BNDV(K), BNP(K), BNR(K), BNN(K), DV)
        DO 45 I = 1, 3
          R(I) = R(I) - (GET - BNT(K)) * DV(I)
          V(I) = V(I) - DV(I)
   45   CONTINUE
   50 CONTINUE
      IOK = 1
      GO TO 90
C     A VEH=SIVB leg (none in our scenarios).
   80 K = LEGAT(GET, 1, 3)
      IF (K .EQ. 0) GO TO 90
      IF (GET .LT. LGP(1,K) .OR. GET .GT. LGP(2,K)) GO TO 90
      CALL LEGRV(K, GET, R, V)
      IOK = 1
   90 ISRCU = J
      RETURN
      END
C
C     LMLEG: the LM leg (VEH=LM) of the current scenario whose span
C     holds GET, or, in a gap of 60 s or less between two of them (a
C     burn), the nearer of the two; 0 if none.
      INTEGER FUNCTION LMLEG(GET)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, DA, DB
      INTEGER K, KA, KB
      LMLEG = 0
      KA = 0
      KB = 0
      DA = 61.0D0
      DB = 61.0D0
      DO 10 K = 1, NLEG
        IF (LGSN(K) .NE. ISN .OR. LGVEH(K) .NE. 2) GO TO 10
        IF (GET .GE. LGP(1,K) .AND. GET .LE. LGP(2,K)) LMLEG = K
        IF (GET .GT. LGP(2,K) .AND. GET - LGP(2,K) .LT. DA) KA = K
        IF (GET .GT. LGP(2,K) .AND. GET - LGP(2,K) .LT. DA)
     &    DA = GET - LGP(2,K)
        IF (GET .LT. LGP(1,K) .AND. LGP(1,K) - GET .LT. DB) KB = K
        IF (GET .LT. LGP(1,K) .AND. LGP(1,K) - GET .LT. DB)
     &    DB = LGP(1,K) - GET
   10 CONTINUE
      IF (LMLEG .NE. 0 .OR. KA .EQ. 0 .OR. KB .EQ. 0) RETURN
      IF (DA + DB .GT. 60.0D0) RETURN
      LMLEG = KA
      IF (DB .LT. DA) LMLEG = KB
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
      P = 2.0D0 * PI / LGEL(11, LEGAT(TR, 2, 1))
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
      CALL VSTATE(T, 1, 2, R, V, I)
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
