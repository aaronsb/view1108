C=======================================================================
C
C     V I E W - 1 1 0 8          LAYER 3  SUN
C
C     Layer element.  One relocatable element of
C     the kernel; see vdrive.f for the list.
C
C=======================================================================
C
C=======================================================================
C     SUN.  A circle of the Sun's apparent size where it is in view.
C=======================================================================
      SUBROUTINE DSUN(GET, VB, NV, SB, NS, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, VB(5,MAXV), SB(3,MAXS), LB(4,MAXL)
      INTEGER NV, NS, NL
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
