C=======================================================================
C
C     V I E W - 1 1 0 8          LAYER 1  PLOT FRAME
C
C     Layer element.  One relocatable element of
C     the kernel; see vdrive.f for the list.
C
C=======================================================================
C
C=======================================================================
C     PLOT FRAME.  Box at the field edge, ticks inward every 5 deg
C     up to a 25 deg field, 10 deg up to 60, else 20 deg, at
C     multiples of the step from 0 (the page letters those values).
C=======================================================================
      SUBROUTINE DFRAME(GET, VB, NV, SB, NS, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, VB(5,MAXV), SB(3,MAXS), LB(4,MAXL)
      INTEGER NV, NS, NL
      DOUBLE PRECISION ST, TL, B, X
      INTEGER K, N
C     Only when IFLG bit 1 (frame and ticks) is set.
      IF (MOD(IFLG / 2, 2) .NE. 1) RETURN
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
