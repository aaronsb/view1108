C=======================================================================
C
C     V I E W - 1 1 0 8          LAYER 2  STARS
C
C     Layer element.  One relocatable element of
C     the kernel; see vdrive.f for the list.
C
C=======================================================================
C
C=======================================================================
C     STARS.  Points inside the frame not behind the Earth or Moon.
C     Nav stars (1..37) labelled when IFLG bit 0 is set.
C=======================================================================
      SUBROUTINE DSTARS(GET, VB, NV, SB, NS, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, VB(5,MAXV), SB(3,MAXS), LB(4,MAXL)
      INTEGER NV, NS, NL
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
