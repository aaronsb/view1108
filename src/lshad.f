C=======================================================================
C
C     V I E W - 1 1 0 8          LAYER 8  LM SHADOW
C
C     Layer element.  One relocatable element of
C     the kernel; see vdrive.f for the list.
C
C=======================================================================
C
C-----------------------------------------------------------------------
C     LMSHAD: the LM's shadow on the ground in the descent.  Every
C     vertex of the LM wireframe (model KLMD, MLIB) is carried along the Sun's
C     direction to the lunar sphere and the edges are drawn there as a
C     surface feature (facing test, so it hides below the horizon and
C     foreshortens like a crater).  The film shows a small LM-shaped
C     figure below the horizon late in the descent (descent_t35.png);
C     that it is the shadow is our reading.  Eye 3 m above the base.
C-----------------------------------------------------------------------
      SUBROUTINE LMSHAD(GET, VB, NV, SB, NS, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, VB(5,MAXV), SB(3,MAXS), LB(4,MAXL)
      INTEGER NV, NS, NL
      DOUBLE PRECISION PMF(3), XB(3), YB(3), ZB(3), SMF(3), V(3)
      DOUBLE PRECISION A(3), B(3)
      INTEGER IS, J, K, IOK
      CALL LMDESC(GET, PMF, XB, YB, ZB)
      CALL MTXV(MMF, SUNU, SMF)
      IVMODE = 3
      ISTYLE = 1
      DO 20 IS = MDS1(KLMD), MDS2(KLMD)
        DO 10 J = 1, NLE(IS)
          DO 5 K = 1, 3
            V(K) = LMV(K,LME(1,J,IS),IS)
    5     CONTINUE
          CALL SHADPT(V, PMF, XB, YB, ZB, SMF, A, IOK)
          IF (IOK .EQ. 0) GO TO 10
          DO 6 K = 1, 3
            V(K) = LMV(K,LME(2,J,IS),IS)
    6     CONTINUE
          CALL SHADPT(V, PMF, XB, YB, ZB, SMF, B, IOK)
          IF (IOK .EQ. 0) GO TO 10
          CALL PEN(VB, NV, A, 0)
          CALL PEN(VB, NV, B, 1)
   10   CONTINUE
   20 CONTINUE
      DO 30 J = MDX1(KLMD), MDX2(KLMD)
        IF (LXS(J) .NE. 0) GO TO 30
        CALL SHADPT(LXL(1,J), PMF, XB, YB, ZB, SMF, A, IOK)
        IF (IOK .EQ. 0) GO TO 30
        CALL SHADPT(LXL(4,J), PMF, XB, YB, ZB, SMF, B, IOK)
        IF (IOK .EQ. 0) GO TO 30
        CALL PEN(VB, NV, A, 0)
        CALL PEN(VB, NV, B, 1)
   30 CONTINUE
      IVMODE = 0
      RETURN
      END
C
C     SHADPT: LM body point V (m; X up, Y right, Z forward) to its
C     shadow on the Moon, returned camera relative EQ in P.
      SUBROUTINE SHADPT(V, PMF, XB, YB, ZB, SMF, P, IOK)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION V(3), PMF(3), XB(3), YB(3), ZB(3), SMF(3), P(3)
      DOUBLE PRECISION W(3), G(3), B, C, DS, T
      INTEGER IOK, K
      IOK = 0
      DO 10 K = 1, 3
        W(K) = PMF(K) + ((V(1) - 3.0D0) * XB(K) + V(2) * YB(K)
     &       + V(3) * ZB(K)) * 1.0D-3
   10 CONTINUE
      B = W(1) * SMF(1) + W(2) * SMF(2) + W(3) * SMF(3)
      C = W(1)**2 + W(2)**2 + W(3)**2 - RM * RM
      DS = B * B - C
      IF (DS .LT. 0.0D0) RETURN
      T = B - DSQRT(DS)
      IF (T .LT. 0.0D0) RETURN
      DO 20 K = 1, 3
        G(K) = W(K) - T * SMF(K)
   20 CONTINUE
      CALL MXV(MMF, G, P)
      DO 30 K = 1, 3
        P(K) = P(K) + MPOS(K)
   30 CONTINUE
      IOK = 1
      RETURN
      END
