C=======================================================================
C
C     V I E W - 1 1 0 8          WINDOW MASK, CABIN HIDDEN LINES
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
C
C     The cabins' hidden lines (CBCUT, below; ours) use the same plane
C     test the other way round: a cabin line is cut where the cabin's
C     opaque faces hide it from the eye, once, when MLIB builds the
C     cabins.
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
C
C-----------------------------------------------------------------------
C     CABIN HIDDEN LINES (ours).  A cabin's lines are hidden by its
C     opaque faces (the triangles OCPOLY and OCSTRP keep in /COCC/:
C     the consoles, couches, equipment bays and panels, the bulkheads
C     about the tunnel and the midsection).  The cabin is placed about
C     its eye (STATCM, STATLM, LDCAB), so what hides what does not
C     change as the view turns: CBCUT cuts each line once, when MLIB
C     builds the cabins, and MDRAW draws the pieces left.  For an eye
C     moved in the cabin, CBCUT again with its offset; the cut is
C     kept with the offset it was made for, and asking again for the
C     same offset costs nothing.  The cut is exact: a point of a line
C     is hidden by a triangle when its direction is inside the planes
C     through the eye and the triangle's edges (as WMCUT's windows)
C     and it is beyond the triangle's plane.  A line on a face's own
C     plane is not hidden by it, so a face's outline and the lines
C     along its edges stay.  TN D-6853 (printed p. 12) names hidden-
C     line models of the LM and the S-IVB only; VIEW drew no cabin.
C-----------------------------------------------------------------------
C
C     ICABN: the cabin number of model K, 1 the CM's (KCMI), 2 the
C     LM's (KLMI), else 0.
      INTEGER FUNCTION ICABN(K)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER K
      ICABN = 0
      IF (K .EQ. KCMI) ICABN = 1
      IF (K .EQ. KLMI) ICABN = 2
      RETURN
      END
C
C-----------------------------------------------------------------------
C     CBCUT: cut cabin model K's free lines (MDX1(K)..MDX2(K)) for its
C     eye (CMEYE, LDEYE) moved by OFF (body metres) into the pieces
C     CPL of /COCC/ that MDRAW draws.  Nothing to do when the cabin is
C     already cut for OFF.  Pieces past MCP are counted in NCPX.
C-----------------------------------------------------------------------
      SUBROUTINE CBCUT(K, OFF)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER K
      DOUBLE PRECISION OFF(3)
      DOUBLE PRECISION E(3), A(3), B(3), T0, T1
      DOUBLE PRECISION D, VNRM
      INTEGER IC, I, J, L, NP, ICABN
C     RESTOMOD BEGIN: the cabins and their hidden lines are ours, a
C     modern addition (VIEW drew no cabin; TN D-6853, printed p. 12)
      IC = ICABN(K)
      IF (IC .EQ. 0) RETURN
      IF (KCOK(IC) .EQ. 0) GO TO 5
      IF (OFF(1) .EQ. COFF(1,IC) .AND. OFF(2) .EQ. COFF(2,IC) .AND.
     &    OFF(3) .EQ. COFF(3,IC)) RETURN
    5 IF (IC .EQ. 1) CALL CMEYE(E)
      IF (IC .EQ. 2) CALL LDEYE(E)
      DO 10 I = 1, 3
        E(I) = E(I) + OFF(I)
        COFF(I,IC) = OFF(I)
   10 CONTINUE
      NCP(IC) = 0
      NCPX(IC) = 0
      IF (MDX2(K) .LT. MDX1(K)) GO TO 90
      DO 80 J = MDX1(K), MDX2(K)
        DO 20 I = 1, 3
          A(I) = LXL(I,J) - E(I)
          B(I) = LXL(I + 3,J) - E(I)
   20   CONTINUE
        CALL OCCUT(A, B, E, K, OCTA, OCTB, NP)
C       The pieces between the hidden runs, but none under 1 mm.
        DO 25 I = 1, 3
          B(I) = B(I) - A(I)
   25   CONTINUE
        D = VNRM(B)
        T0 = 0.0D0
        DO 60 L = 1, NP + 1
          T1 = 1.0D0
          IF (L .LE. NP) T1 = OCTA(L)
          IF ((T1 - T0) * D .LE. 1.0D-3) GO TO 50
          IF (NCP(IC) .LT. MCP) GO TO 30
          NCPX(IC) = NCPX(IC) + 1
          GO TO 50
   30     NCP(IC) = NCP(IC) + 1
          DO 40 I = 1, 3
            CPL(I,NCP(IC),IC) = LXL(I,J)
     &        + T0 * (LXL(I + 3,J) - LXL(I,J))
            CPL(I + 3,NCP(IC),IC) = LXL(I,J)
     &        + T1 * (LXL(I + 3,J) - LXL(I,J))
            IF (T1 .GE. 1.0D0) CPL(I + 3,NCP(IC),IC) = LXL(I + 3,J)
   40     CONTINUE
   50     IF (L .LE. NP) T0 = OCTB(L)
   60   CONTINUE
   80 CONTINUE
   90 KCOK(IC) = 1
C     RESTOMOD END
      RETURN
      END
C
C-----------------------------------------------------------------------
C     OCCUT: the parts of segment A-B (body metres, relative to the
C     eye E) that model K's opaque triangles hide: NP intervals TA(L)
C     .. TB(L) of T along A + T (B - A), in order, overlaps merged.
C     For each triangle four planes, as WMCUT's: three through the
C     eye and an edge, facing in, and the triangle's own, facing away
C     from the eye, 0.1 mm past it, so nothing on it is hidden by it.
C     The edges' planes are let out by 1.0D-9 m so that two triangles
C     of one face leave no gap along the edge they share.
C-----------------------------------------------------------------------
      SUBROUTINE OCCUT(A, B, E, K, TA, TB, NP)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION A(3), B(3), E(3), TA(MOC), TB(MOC)
      INTEGER K, NP
      DOUBLE PRECISION V(3,3), U(3), W(3), C(3), PN(3,4), PD(4)
      DOUBLE PRECISION S, T0, T1, T, FA, FB, VNRM, VDOT
      INTEGER J, I, L, M, IV
C     RESTOMOD BEGIN: the cabins' hidden lines are ours (see CBCUT);
C     and Cyrus-Beck clipping, published 1978
      NP = 0
      DO 50 J = 1, NOC
        IF (OCMOD(J) .NE. K) GO TO 50
        DO 5 IV = 1, 3
          DO 4 I = 1, 3
            V(I,IV) = OCV(I,IV,J) - E(I)
    4     CONTINUE
    5   CONTINUE
C       The triangle's plane, facing away from the eye; none when the
C       eye is in it (the triangle is seen edge on).
        DO 8 I = 1, 3
          U(I) = V(I,2) - V(I,1)
          W(I) = V(I,3) - V(I,1)
          C(I) = V(I,1) + V(I,2) + V(I,3)
    8   CONTINUE
        CALL VCRS(U, W, PN(1,4))
        S = VNRM(PN(1,4))
        IF (S .LE. 1.0D-12) GO TO 50
        PD(4) = VDOT(PN(1,4), V(1,1)) / S
        IF (DABS(PD(4)) .LE. 1.0D-6) GO TO 50
        IF (PD(4) .LT. 0.0D0) S = -S
        DO 10 I = 1, 3
          PN(I,4) = PN(I,4) / S
   10   CONTINUE
        PD(4) = DABS(PD(4)) + 1.0D-4
C       The edges' planes, facing in.
        DO 20 M = 1, 3
          L = MOD(M, 3) + 1
          CALL VCRS(V(1,M), V(1,L), PN(1,M))
          S = VNRM(PN(1,M))
          IF (S .LE. 1.0D-12) GO TO 50
          IF (VDOT(PN(1,M), C) .LT. 0.0D0) S = -S
          DO 15 I = 1, 3
            PN(I,M) = PN(I,M) / S
   15     CONTINUE
          PD(M) = -1.0D-9
   20   CONTINUE
        T0 = 0.0D0
        T1 = 1.0D0
        DO 30 M = 1, 4
          FA = VDOT(PN(1,M), A) - PD(M)
          FB = VDOT(PN(1,M), B) - PD(M)
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
      IF (NP .EQ. 0) RETURN
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
C     RESTOMOD END
      RETURN
      END
