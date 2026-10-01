C=======================================================================
C
C     V I E W - 1 1 0 8          WINDOW MASK
C
C     Core element.  With in_flags bit 5 and a cabin interior drawn
C     (bit 4, the CM and LM station views), the outside is seen only
C     through the cabin's windows: every line of the sky, the Earth,
C     the Moon and the other vehicles is cut to the windows, and stars
C     and labels outside them are dropped.  The cabin's own lines, the
C     plot frame and the window overlays (LPD scale, COAS) are drawn
C     whole.  A modern addition (ours): VIEW drew the scene through
C     one window outline (TN D-6853, printed p. 3, "realistic
C     spacecraft-window outlines"), and no source we have says how.
C     One relocatable element of the kernel; see vdrive.f for the
C     list.
C
C     The windows are the cabin models' own window outlines (XWIN in
C     models.f: the CM's five, the LM's two front windows and its
C     docking window).  Each is a cone from the eye: the planes
C     through the eye and each edge, facing in, bound it, and a point
C     is in the window when it is on the inner side of all of them.
C     That needs the cone to be convex; every outline is, seen from
C     its eye (our check: each corner is inside the planes of the
C     edges it is not on).  A segment's points A + T (B - A) are on a
C     plane's inner side over one interval of T, so the cut is exact,
C     whatever the projection, for segments behind the eye or
C     across the projection's limit, and a segment seen through two
C     windows gives two pieces.
C
C     The pen's entry points SEG, MSEG and EMIT pass through here and
C     go on to SEG0, MSEG0 and EMIT0 in pen.f; with the mask off they
C     call them straight through, so frames are as before.
C=======================================================================
C
C-----------------------------------------------------------------------
C     WMSET: the window planes of this frame, after the models are
C     placed (VIEWPT).  Corners camera relative, metres: what MDRAW
C     does to a free line, without the 1.0D-3.
C-----------------------------------------------------------------------
      SUBROUTINE WMSET
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION V(3,MWV), B(3), C(3), N(3), S, VNRM, VDOT
      INTEGER J, K, L, I, KM
      IMSKON = 0
      IMSK = 0
      DO 50 J = 1, NWIN
        WACT(J) = 0
        KM = WMOD(J)
        IF (MDON(KM) .EQ. 0) GO TO 50
        CALL SETV(C, 0.0D0, 0.0D0, 0.0D0)
        DO 20 K = 1, NWV(J)
          DO 10 I = 1, 3
            B(I) = WBV(I,K,J) - MDBO(I,KM)
   10     CONTINUE
          CALL MXV(MDAT(1,1,KM), B, V(1,K))
          DO 15 I = 1, 3
            V(I,K) = V(I,K) + 1.0D3 * MDP(I,KM)
            C(I) = C(I) + V(I,K)
   15     CONTINUE
   20   CONTINUE
C       Edge K's plane; C, the sum of the corners, is inside.  A
C       plane through two corners in line with the eye bounds nothing.
        DO 40 K = 1, NWV(J)
          L = MOD(K, NWV(J)) + 1
          CALL VCRS(V(1,K), V(1,L), N)
          S = VNRM(N)
          IF (S .LE. 1.0D-12) S = 0.0D0
          IF (S .GT. 0.0D0) S = 1.0D0 / S
          IF (VDOT(N, C) .LT. 0.0D0) S = -S
          DO 30 I = 1, 3
            WPN(I,K,J) = S * N(I)
   30     CONTINUE
   40   CONTINUE
        WACT(J) = 1
        IF (MOD(IFLG / 32, 2) .EQ. 1) IMSKON = 1
   50 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     WMCUT: the parts of segment A-B (camera relative) seen through a
C     window: NP intervals TA(K) .. TB(K) of T along A + T (B - A),
C     in order, overlaps merged.  Cyrus-Beck against each window's
C     planes.
C-----------------------------------------------------------------------
      SUBROUTINE WMCUT(A, B, TA, TB, NP)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION A(3), B(3), TA(MWIN), TB(MWIN)
      INTEGER NP
      DOUBLE PRECISION T0, T1, T, FA, FB
      INTEGER J, K, I, M
C     RESTOMOD BEGIN: Cyrus-Beck clipping, published 1978
      NP = 0
      DO 50 J = 1, NWIN
        IF (WACT(J) .EQ. 0) GO TO 50
        T0 = 0.0D0
        T1 = 1.0D0
        DO 30 K = 1, NWV(J)
          FA = WPN(1,K,J) * A(1) + WPN(2,K,J) * A(2)
     &       + WPN(3,K,J) * A(3)
          FB = WPN(1,K,J) * B(1) + WPN(2,K,J) * B(2)
     &       + WPN(3,K,J) * B(3)
          IF (FA .GE. 0.0D0 .AND. FB .GE. 0.0D0) GO TO 30
          IF (FA .LT. 0.0D0 .AND. FB .LT. 0.0D0) GO TO 50
          T = FA / (FA - FB)
          IF (FA .LT. 0.0D0 .AND. T .GT. T0) T0 = T
          IF (FB .LT. 0.0D0 .AND. T .LT. T1) T1 = T
          IF (T0 .GE. T1) GO TO 50
   30   CONTINUE
C       Into the list, kept in order of TA.
        NP = NP + 1
        I = NP
   40   IF (I .EQ. 1) GO TO 45
        IF (TA(I-1) .LE. T0) GO TO 45
        TA(I) = TA(I-1)
        TB(I) = TB(I-1)
        I = I - 1
        GO TO 40
   45   TA(I) = T0
        TB(I) = T1
   50 CONTINUE
C     RESTOMOD END
      M = 0
      DO 60 I = 1, NP
        IF (M .EQ. 0) GO TO 55
        IF (TA(I) .GT. TB(M)) GO TO 55
        IF (TB(I) .GT. TB(M)) TB(M) = TB(I)
        GO TO 60
   55   M = M + 1
        TA(M) = TA(I)
        TB(M) = TB(I)
   60 CONTINUE
      NP = M
      RETURN
      END
C
C     WMIN: 1 if the direction of P (camera relative) is in a window.
      INTEGER FUNCTION WMIN(P)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION P(3)
      INTEGER J, K
      WMIN = 1
      DO 20 J = 1, NWIN
        IF (WACT(J) .EQ. 0) GO TO 20
        DO 10 K = 1, NWV(J)
          IF (WPN(1,K,J) * P(1) + WPN(2,K,J) * P(2)
     &      + WPN(3,K,J) * P(3) .LT. 0.0D0) GO TO 20
   10   CONTINUE
        RETURN
   20 CONTINUE
      WMIN = 0
      RETURN
      END
C
C     WMPT: the point of segment A-B at T (camera relative), the ends
C     themselves at T = 0 and T = 1.
      SUBROUTINE WMPT(A, B, T, P)
      DOUBLE PRECISION A(3), B(3), T, P(3)
      INTEGER I
      DO 10 I = 1, 3
        P(I) = A(I) + T * (B(I) - A(I))
        IF (T .GE. 1.0D0) P(I) = B(I)
   10 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     SEG, MSEG: the pen's 3-D segments (SEG0, MSEG0 in pen.f), cut to
C     the windows while the mask applies.
C-----------------------------------------------------------------------
      SUBROUTINE SEG(VB, NV, A, B)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), A(3), B(3)
      INTEGER NV
      DOUBLE PRECISION TA(MWIN), TB(MWIN), P(3), Q(3)
      INTEGER NP, K
      IF (IMSK .EQ. 1) GO TO 10
      CALL SEG0(VB, NV, A, B)
      RETURN
   10 CALL WMCUT(A, B, TA, TB, NP)
      DO 20 K = 1, NP
        CALL WMPT(A, B, TA(K), P)
        CALL WMPT(A, B, TB(K), Q)
        CALL SEG0(VB, NV, P, Q)
   20 CONTINUE
      RETURN
      END
C
      SUBROUTINE MSEG(VB, NV, A, B)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), A(3), B(3)
      INTEGER NV
      DOUBLE PRECISION TA(MWIN), TB(MWIN), P(3), Q(3)
      INTEGER NP, K
      IF (IMSK .EQ. 1) GO TO 10
      CALL MSEG0(VB, NV, A, B)
      RETURN
   10 CALL WMCUT(A, B, TA, TB, NP)
      DO 20 K = 1, NP
        CALL WMPT(A, B, TA(K), P)
        CALL WMPT(A, B, TB(K), Q)
        CALL MSEG0(VB, NV, P, Q)
   20 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     EMIT: a segment given in plot degrees (EMIT0 in pen.f), the Sun's
C     disc and the boxed X marks.  While the mask applies, its ends go
C     back to directions (UNPROJ) and the chord between them is cut;
C     the pieces' ends are projected again.  In the gnomonic plot a
C     straight line is a great circle, so this is exact; in the
C     stereographic plot it holds for these short marks.
C-----------------------------------------------------------------------
      SUBROUTINE EMIT(VB, NV, X1, Y1, X2, Y2)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), X1, Y1, X2, Y2
      INTEGER NV
      DOUBLE PRECISION TA(MWIN), TB(MWIN), A(3), B(3), P(3)
      DOUBLE PRECISION XA, YA, XB, YB
      INTEGER NP, K, IOK
      IF (IMSK .EQ. 1) GO TO 10
      CALL EMIT0(VB, NV, X1, Y1, X2, Y2)
      RETURN
   10 CALL UNPROJ(X1, Y1, 0, A)
      CALL UNPROJ(X2, Y2, 0, B)
      CALL WMCUT(A, B, TA, TB, NP)
      DO 20 K = 1, NP
        XA = X1
        YA = Y1
        XB = X2
        YB = Y2
        CALL WMPT(A, B, TA(K), P)
        IF (TA(K) .GT. 0.0D0) CALL PROJ(P, XA, YA, IOK)
        CALL WMPT(A, B, TB(K), P)
        IF (TB(K) .LT. 1.0D0) CALL PROJ(P, XB, YB, IOK)
        CALL EMIT0(VB, NV, XA, YA, XB, YB)
   20 CONTINUE
      RETURN
      END
