C=======================================================================
C
C     V I E W - 1 1 0 8          THE ENGINE
C
C     Core element.  Flies the CSM through the current scenario: from
C     its START state it integrates the motion, plays the SCORE (the
C     BURN cards) as impulses, and at each REFERENCE row either resets
C     the state to the sourced one (state vector updates on; our
C     "delta correction") or only measures how far it has drifted
C     (off).  It writes the TAPE
C     (tape.f) and knows nothing about drawing.  One relocatable
C     element of the kernel; see vdrive.f for the list.
C
C     Period terms (docs/simulation.md).  This plays the part of the
C     RTACF integrator, "the Apollo Reference Mission Program", which
C     wrote the trajectory ephemeris tape (Allday, TN D-6855, pp. 7-
C     8); the RTACF programs were taken over "without change to the
C     basic logic and equations" and "run in a batch-processing mode"
C     during missions (p. 7).  A reset at a reference row plays a
C     "CSM/LM STATE VECTOR UPDATE", uplinked to program P27 with verb
C     71 (Comanche 055, UPDATE_PROGRAM.agc).  Fig. 2 of TN D-6855
C     (p. 6) draws a "Vector transmit" line from the RTCC (IBM
C     360/75s, NASA-TM-X-64290, p. 113) to the RTACF, whose fig. 3
C     computers are two Univac 1108s.  The mapping is ours.
C     VIEW's own integrator was Encke/Cowell (TN D-6853, p. 3).
C
C     Physics (ours): Cowell's method, the CSM's geocentric position
C     and velocity integrated directly, with the Earth, the Moon and
C     the Sun as point masses (the Moon and Sun from ephem.f, the Moon
C     through a half-hourly table, MOONQ; the Sun at 1 AU).  Fourth-
C     order Runge-Kutta; the step is 1/50 of the
C     shorter of sqrt(r**3/mu) about the Earth and about the Moon,
C     from 1 to 600 s, and it lands exactly on every burn and
C     reference row.  Burns are impulses at mid-burn.  No Earth or
C     Moon oblateness, no venting or attitude thrusting.
C
C=======================================================================
C
C-----------------------------------------------------------------------
C     SIMRUN: run the engine over the current scenario and fill the
C     tape.  IFL bit 0: state vector updates on.
C-----------------------------------------------------------------------
      SUBROUTINE SIMRUN(IFL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER IFL
      DOUBLE PRECISION R(3), V(3), RR(3), VR(3), T, TEND, TN, H
      DOUBLE PRECISION SIMDT
      INTEGER K, J, I, IST, IDB(NBURN), IDR(NREF), ICOR
      IF (ISN .EQ. 0) CALL SNSET(1)
      CALL TPCLR
      ISIMF = IFL
      ITPSN = ISN
      ICOR = MOD(IFL, 2)
      DO 5 J = 1, NREF
        RFOK(J) = 0
    5 CONTINUE
      IST = 0
      DO 10 K = 1, NSTART
        IF (STSN(K) .EQ. ISN) IST = K
   10 CONTINUE
      IF (IST .EQ. 0) RETURN
C     Done flags: set for cards of other scenarios and unused slots.
      DO 12 K = 1, NBURN
        IDB(K) = 1
        IF (K .LE. NBN) IDB(K) = 0
   12 CONTINUE
      DO 13 K = 1, NBN
        IF (BNSN(K) .NE. ISN) IDB(K) = 1
   13 CONTINUE
      DO 14 K = 1, NREF
        IDR(K) = 1
        IF (K .LE. NRF) IDR(K) = 0
   14 CONTINUE
      DO 15 K = 1, NRF
        IF (RFSN(K) .NE. ISN) IDR(K) = 1
   15 CONTINUE
      T = STP(3,IST)
      TEND = STP(2,IST)
C     The Moon at nodes every half hour over the run, for MOONQ.
      MQDT = 1800.0D0
      MQT0 = T - MQDT
      NMQ = INT((TEND - MQT0) / MQDT) + 3
      IF (NMQ .GT. MXMQ) NMQ = MXMQ
      DO 16 K = 1, NMQ
        CALL MOONV(MQT0 + DBLE(K - 1) * MQDT, MQ(1,K), MQ(4,K))
   16 CONTINUE
      CALL STATEV(STP(1,IST), STGC(IST), R, V)
      CALL TPPUT(1, T, R, V)
C
C     Step to the next event, or by the dynamic step.
   20 IF (T .GE. TEND) RETURN
      TN = TEND
      DO 22 K = 1, NBURN
        IF (IDB(K) .EQ. 0 .AND. BNT(K) .GT. T .AND. BNT(K) .LT. TN)
     &    TN = BNT(K)
   22 CONTINUE
      DO 24 K = 1, NREF
        IF (IDR(K) .EQ. 0 .AND. RFP(3,K) .GT. T .AND. RFP(3,K) .LT. TN)
     &    TN = RFP(3,K)
   24 CONTINUE
      H = SIMDT(T, R)
      IF (T + H .GE. TN) H = TN - T
      CALL RK4(T, H, R, V)
      T = T + H
      IF (T .GE. TN) T = TN
      CALL TPPUT(1, T, R, V)
      IF (T .LT. TN) GO TO 20
C
C     Reference rows at this time: measure, then correct if asked.
      DO 40 J = 1, NREF
        IF (IDR(J) .NE. 0 .OR. RFP(3,J) .NE. T) GO TO 40
        IDR(J) = 1
        CALL REFST(J, RR, VR)
        RFERR(1,J) = DSQRT((R(1)-RR(1))**2 + (R(2)-RR(2))**2
     &             + (R(3)-RR(3))**2)
        RFERR(2,J) = DSQRT((V(1)-VR(1))**2 + (V(2)-VR(2))**2
     &             + (V(3)-VR(3))**2) * 1.0D3 / 0.3048D0
        RFOK(J) = 1
        CALL TPMARK(T, 2, 1, J)
        IF (ICOR .EQ. 0) GO TO 40
        DO 30 I = 1, 3
          R(I) = RR(I)
          V(I) = VR(I)
   30   CONTINUE
        CALL TPPUT(1, T, R, V)
   40 CONTINUE
C     Burns at this time, as impulses.
      DO 50 K = 1, NBURN
        IF (IDB(K) .NE. 0 .OR. BNT(K) .NE. T) GO TO 50
        IDB(K) = 1
        CALL BURN(K, T, R, V)
        CALL TPMARK(T, 1, 1, K)
        CALL TPPUT(1, T, R, V)
   50 CONTINUE
      GO TO 20
      END
C
C     SIMDT: the integration step (s) at T, R: 1/50 of the local
C     dynamical time about the nearer-acting body, 1 to 600 s.
      DOUBLE PRECISION FUNCTION SIMDT(T, R)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION T, R(3), PM(3), VM(3), RE3, RM3
      CALL MOONQ(T, PM, VM)
      RE3 = R(1)**2 + R(2)**2 + R(3)**2
      RE3 = RE3 * DSQRT(RE3)
      RM3 = (R(1)-PM(1))**2 + (R(2)-PM(2))**2 + (R(3)-PM(3))**2
      RM3 = RM3 * DSQRT(RM3)
      SIMDT = 0.02D0 * DMIN1(DSQRT(RE3 / GME), DSQRT(RM3 / GMM))
      IF (SIMDT .LT. 1.0D0) SIMDT = 1.0D0
      IF (SIMDT .GT. 600.0D0) SIMDT = 600.0D0
      RETURN
      END
C
C     MOONQ: the Moon's geocentric position P and velocity V at T from
C     the engine's node table (cubic Hermite; the series itself where
C     T is off the table).
      SUBROUTINE MOONQ(T, P, V)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION T, P(3), V(3), S, H00, H10, H01, H11
      DOUBLE PRECISION D00, D10, D01, D11
      INTEGER K, I
      K = INT((T - MQT0) / MQDT) + 1
      IF (NMQ .LT. 2 .OR. K .LT. 1 .OR. K .GE. NMQ) GO TO 20
      S = (T - MQT0) / MQDT - DBLE(K - 1)
      H00 = (1.0D0 + 2.0D0 * S) * (1.0D0 - S)**2
      H10 = S * (1.0D0 - S)**2
      H01 = S * S * (3.0D0 - 2.0D0 * S)
      H11 = S * S * (S - 1.0D0)
      D00 = 6.0D0 * S * (S - 1.0D0)
      D10 = (1.0D0 - S) * (1.0D0 - 3.0D0 * S)
      D01 = -D00
      D11 = S * (3.0D0 * S - 2.0D0)
      DO 10 I = 1, 3
        P(I) = H00 * MQ(I,K) + H10 * MQDT * MQ(I+3,K)
     &       + H01 * MQ(I,K+1) + H11 * MQDT * MQ(I+3,K+1)
        V(I) = (D00 * MQ(I,K) + D10 * MQDT * MQ(I+3,K)
     &       + D01 * MQ(I,K+1) + D11 * MQDT * MQ(I+3,K+1)) / MQDT
   10 CONTINUE
      RETURN
   20 CALL MOONV(T, P, V)
      RETURN
      END
C
C     RK4: one Runge-Kutta step of H seconds from T for R, V.
      SUBROUTINE RK4(T, H, R, V)
      DOUBLE PRECISION T, H, R(3), V(3)
      DOUBLE PRECISION A1(3), A2(3), A3(3), A4(3), R2(3), R3(3), R4(3)
      DOUBLE PRECISION V2(3), V3(3), V4(3)
      INTEGER I
      CALL ACCEL(T, R, A1)
      DO 10 I = 1, 3
        R2(I) = R(I) + 0.5D0 * H * V(I)
        V2(I) = V(I) + 0.5D0 * H * A1(I)
   10 CONTINUE
      CALL ACCEL(T + 0.5D0 * H, R2, A2)
      DO 20 I = 1, 3
        R3(I) = R(I) + 0.5D0 * H * V2(I)
        V3(I) = V(I) + 0.5D0 * H * A2(I)
   20 CONTINUE
      CALL ACCEL(T + 0.5D0 * H, R3, A3)
      DO 30 I = 1, 3
        R4(I) = R(I) + H * V3(I)
        V4(I) = V(I) + H * A3(I)
   30 CONTINUE
      CALL ACCEL(T + H, R4, A4)
      DO 40 I = 1, 3
        R(I) = R(I) + H / 6.0D0 * (V(I) + 2.0D0 * V2(I)
     &       + 2.0D0 * V3(I) + V4(I))
        V(I) = V(I) + H / 6.0D0 * (A1(I) + 2.0D0 * A2(I)
     &       + 2.0D0 * A3(I) + A4(I))
   40 CONTINUE
      RETURN
      END
C
C     ACCEL: geocentric acceleration (km/s**2) at T, R: the Earth, and
C     the Moon and the Sun as third bodies (direct minus indirect).
      SUBROUTINE ACCEL(T, R, A)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION T, R(3), A(3), PM(3), PS(3), D(3), R3, D3, P3
      DOUBLE PRECISION GMS, AU, VM(3)
      INTEGER I
      GMS = 1.32712440018D11
      AU = 1.495978707D8
      CALL MOONQ(T, PM, VM)
      CALL SUNG(T, PS)
      R3 = R(1)**2 + R(2)**2 + R(3)**2
      R3 = R3 * DSQRT(R3)
      DO 10 I = 1, 3
        A(I) = -GME * R(I) / R3
        PS(I) = AU * PS(I)
        D(I) = PM(I) - R(I)
   10 CONTINUE
      D3 = D(1)**2 + D(2)**2 + D(3)**2
      D3 = D3 * DSQRT(D3)
      P3 = PM(1)**2 + PM(2)**2 + PM(3)**2
      P3 = P3 * DSQRT(P3)
      DO 20 I = 1, 3
        A(I) = A(I) + GMM * (D(I) / D3 - PM(I) / P3)
        D(I) = PS(I) - R(I)
   20 CONTINUE
      D3 = D(1)**2 + D(2)**2 + D(3)**2
      D3 = D3 * DSQRT(D3)
      P3 = PS(1)**2 + PS(2)**2 + PS(3)**2
      P3 = P3 * DSQRT(P3)
      DO 30 I = 1, 3
        A(I) = A(I) + GMS * (D(I) / D3 - PS(I) / P3)
   30 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     BURN: apply burn K at T to R, V as an impulse: BNDV (ft/s) along
C     BNP, BNR, BNN, the direction's components against the velocity,
C     the in-plane radial and the orbit normal relative to the body
C     BNBOD (1 Earth, 2 Moon).
C-----------------------------------------------------------------------
      SUBROUTINE BURN(K, T, R, V)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER K, I
      DOUBLE PRECISION T, R(3), V(3), RB(3), VB(3), PM(3), VM(3)
      DO 10 I = 1, 3
        RB(I) = R(I)
        VB(I) = V(I)
   10 CONTINUE
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (BNBOD(K) .EQ. 2) THEN
        CALL MOONV(T, PM, VM)
        DO 20 I = 1, 3
          RB(I) = R(I) - PM(I)
          VB(I) = V(I) - VM(I)
   20   CONTINUE
      END IF
C     RESTOMOD END
      CALL IMPULS(RB, VB, BNDV(K), BNP(K), BNR(K), BNN(K), V)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     REFST: reference row J as a geocentric EQ state.  About the Earth
C     from its card as a CONIC leg's state (STATEV).  About the Moon:
C     its selenographic position at its altitude above the mean
C     radius RM, its speed and flight-path angle, and the horizontal
C     direction of the lunar leg's plane at that time (LCST, traj.f;
C     our choice), then the Moon's own state added.
C-----------------------------------------------------------------------
      SUBROUTINE REFST(J, R, V)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER J, I
      DOUBLE PRECISION R(3), V(3), PM(3), VM(3)
      IF (RFBOD(J) .EQ. 2) GO TO 10
      CALL STATEV(RFP(1,J), RFGC(J), R, V)
      RETURN
   10 CALL LCST(RFP(1,J), R, V)
      CALL MOONV(RFP(3,J), PM, VM)
      DO 20 I = 1, 3
        R(I) = PM(I) + R(I)
        V(I) = VM(I) + V(I)
   20 CONTINUE
      RETURN
      END
