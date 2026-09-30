C=======================================================================
C
C     V I E W - 1 1 0 8          THE TAPE
C
C     Core element.  Time-tagged vehicle states written by the engine
C     (sim.f) and read by the state source (vsrc.f); it knows nothing
C     of how they were made or how they are drawn.  One relocatable
C     element of the kernel; see vdrive.f for the list.
C
C     Up to four vehicle channels (TN D-6853, printed p. 12: "As many
C     as four vehicle trajectories can be integrated simultaneously");
C     only channel 1, the CSM, is written now.  A burn or a state
C     vector update writes two samples at one time, before and after,
C     and the reader never interpolates across such a pair.  Reading
C     is by cubic Hermite interpolation on the positions and
C     velocities of the two samples around the time (ours).
C     Period term: the "trajectory ephemeris tape", which "contained
C     position and velocity-vector data and spacecraft-attitude
C     information for one or two spacecraft" and was written by the
C     RTACF integrator for programs "that contained no integrator"
C     (Allday, TN D-6855, pp. 7-8).  That VIEW read such a tape is our
C     guess (TN D-6853 p. 3 names only the two parts).
C
C=======================================================================
C
C     TPCLR: empty the tape.
      SUBROUTINE TPCLR
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER C
      DO 10 C = 1, MXCHN
        NTP(C) = 0
   10 CONTINUE
      NMK = 0
      RETURN
      END
C
C     TPPUT: append a sample of channel C at g.e.t. T, state R, V.
C     A full channel keeps its last sample slot for the latest state.
      SUBROUTINE TPPUT(C, T, R, V)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER C, I, K
      DOUBLE PRECISION T, R(3), V(3)
      K = NTP(C) + 1
      IF (K .GT. MXSAM) K = MXSAM
      NTP(C) = K
      TPT(K,C) = T
      DO 10 I = 1, 3
        TPS(I,K,C) = R(I)
        TPS(I+3,K,C) = V(I)
   10 CONTINUE
      RETURN
      END
C
C     TPMARK: append an event mark (kind KIND, channel C, index IX).
      SUBROUTINE TPMARK(T, KIND, C, IX)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION T
      INTEGER KIND, C, IX
      IF (NMK .GE. MXMRK) RETURN
      NMK = NMK + 1
      TMKT(NMK) = T
      TMKK(NMK) = KIND
      TMKC(NMK) = C
      TMKI(NMK) = IX
      RETURN
      END
C
C-----------------------------------------------------------------------
C     TPGET: state of channel C at g.e.t. T.  IOK = 0 if T is outside
C     the tape.  At a time with two samples (a burn or an update)
C     the later one is read.
C-----------------------------------------------------------------------
      SUBROUTINE TPGET(C, T, R, V, IOK)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER C, IOK, LO, HI, MI, I
      DOUBLE PRECISION T, R(3), V(3), H, S, H00, H10, H01, H11
      DOUBLE PRECISION D00, D10, D01, D11
      IOK = 0
      IF (NTP(C) .LT. 2) RETURN
      IF (T .LT. TPT(1,C) .OR. T .GT. TPT(NTP(C),C)) RETURN
      IOK = 1
C     The last sample LO with TPT(LO) <= T, by bisection.
      LO = 1
      HI = NTP(C)
   10 IF (HI - LO .LE. 1) GO TO 20
      MI = (LO + HI) / 2
      IF (TPT(MI,C) .LE. T) LO = MI
      IF (TPT(MI,C) .GT. T) HI = MI
      GO TO 10
   20 IF (TPT(HI,C) .LE. T) LO = HI
      IF (LO .EQ. NTP(C)) LO = NTP(C) - 1
      HI = LO + 1
      H = TPT(HI,C) - TPT(LO,C)
C     A zero-length step is a burn or an update: read its later side.
      IF (H .GT. 0.0D0) GO TO 30
      DO 25 I = 1, 3
        R(I) = TPS(I,HI,C)
        V(I) = TPS(I+3,HI,C)
   25 CONTINUE
      RETURN
   30 S = (T - TPT(LO,C)) / H
      IF (S .GT. 1.0D0) S = 1.0D0
C     Cubic Hermite basis and its derivative (per unit S).
      H00 = (1.0D0 + 2.0D0 * S) * (1.0D0 - S)**2
      H10 = S * (1.0D0 - S)**2
      H01 = S * S * (3.0D0 - 2.0D0 * S)
      H11 = S * S * (S - 1.0D0)
      D00 = 6.0D0 * S * (S - 1.0D0)
      D10 = (1.0D0 - S) * (1.0D0 - 3.0D0 * S)
      D01 = -D00
      D11 = S * (3.0D0 * S - 2.0D0)
      DO 40 I = 1, 3
        R(I) = H00 * TPS(I,LO,C) + H10 * H * TPS(I+3,LO,C)
     &       + H01 * TPS(I,HI,C) + H11 * H * TPS(I+3,HI,C)
        V(I) = (D00 * TPS(I,LO,C) + D10 * H * TPS(I+3,LO,C)
     &       + D01 * TPS(I,HI,C) + D11 * H * TPS(I+3,HI,C)) / H
   40 CONTINUE
      RETURN
      END
