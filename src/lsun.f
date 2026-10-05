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
C     SUN.  The report's Sun symbol where the Sun is in view: a ring of
C     rays round a clear centre, the same size on the screen whatever
C     the field (MSC IN 69-FM-197 PDF p. 89, printed 71, 50 deg field;
C     PDF p. 137, printed 119, 100 deg).  Our measurements on those
C     pages: the rays reach 0.056-0.062 of the plot's half-width, the
C     centre is clear to about 0.4 of that, about 36 rays, each a thin
C     wedge.  We draw each ray out and back (two vectors); the wedge's
C     width (3 deg of position angle) is ours.  Where the field is
C     narrow enough to show the true disc (radius 0.267 deg) larger than
C     the clear centre, the disc is drawn and the rays start at its rim
C     (ours; the report's Sun views are 50 deg and wider).
C=======================================================================
      SUBROUTINE DSUN(GET, VB, NV, SB, NS, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, VB(5,MAXV), SB(3,MAXS), LB(4,MAXL)
      INTEGER NV, NS, NL
      DOUBLE PRECISION X, Y, RAYHIT, A, C, S, R0, R1, R2, DW
      INTEGER IOK, K, LMOCC
      IF (SUNU(1)*CB(1) + SUNU(2)*CB(2) + SUNU(3)*CB(3) .LT. CSVIEW)
     &  RETURN
      IF (RAYHIT(SUNU, EPOS, RE) .GT. 0.0D0) RETURN
      IF (RAYHIT(SUNU, MPOS, RM) .GT. 0.0D0) RETURN
      IF (NACT .EQ. 0) GO TO 5
      IF (LMOCC(SUNU, 0) .EQ. 1) RETURN
    5 CALL PROJ(SUNU, X, Y, IOK)
      IF (IOK .EQ. 0) RETURN
C     R0 the true disc, R1 the clear centre, R2 the rays' tips.
      R0 = 0.267D0
      R1 = 0.024D0 * BOXH
      R2 = 0.059D0 * BOXH
      IF (R0 .LE. R1) GO TO 15
      DO 10 K = 0, 23
        A = DBLE(K) * PI / 12.0D0
        C = DCOS(A) * R0
        S = DSIN(A) * R0
        CALL EMIT(VB, NV, X + C, Y + S,
     &    X + DCOS(A + PI / 12.0D0) * R0,
     &    Y + DSIN(A + PI / 12.0D0) * R0)
   10 CONTINUE
      R2 = R0 + R2 - R1
      R1 = R0
   15 DW = 1.5D0 * PI / 180.0D0
      DO 20 K = 0, 35
        A = DBLE(K) * PI / 18.0D0
        C = X + DCOS(A) * R2
        S = Y + DSIN(A) * R2
        CALL EMIT(VB, NV, X + DCOS(A - DW) * R1, Y + DSIN(A - DW) * R1,
     &    C, S)
        CALL EMIT(VB, NV, C, S,
     &    X + DCOS(A + DW) * R1, Y + DSIN(A + DW) * R1)
   20 CONTINUE
      IF (MOD(IFLG, 2) .EQ. 1) CALL LABEL(LB, NL, X, Y, 3, 0)
      RETURN
      END
