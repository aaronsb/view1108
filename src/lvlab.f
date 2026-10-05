C=======================================================================
C
C     V I E W - 1 1 0 8          VEHICLE LABELS AND MARKERS
C
C     Part of layer 6: called by MDRALL after the placed models are
C     drawn.  One relocatable element of the kernel; see vdrive.f for
C     the list.
C
C     A modern addition throughout (ours).  VIEW drew "the vehicle
C     outlines of the CSM, LM, and the S-IVB" at their apparent size
C     (TN D-6853, printed p. 12); we have no source that it lettered
C     them or marked the ones too small to see.  Drawn only with a
C     label level set (in_lablv 1-3), so in_lablv 0 keeps the picture
C     it had.
C       Labels (LB kind 8; id 1 CM, 2 SM, 3 LM, 4 S-IVB, 5 CSM) beside
C         each placed model: off the model's projected X axis by the
C         model's projected half-width across that axis plus a gap,
C         so the name clears the model's lines.  The CSM gets CM and SM
C         labels beside its two modules, on the same side, or one CSM
C         label when those two would touch.  The CM alone (after CM/SM
C         separation) is CM, the ascent stage alone (after lunar
C         lift-off) LM.
C       Markers: a placed model whose picture spans less than 0.2
C         percent of the field (under about one plot pixel) gets the
C         small boxed X of the Moon view's landing site (DMOON6, BOXX)
C         at its centre instead, with its label beside the box.  So do
C         vehicles known only by their state (VSTATE): one not placed
C         as a model, which the camera does not ride (IRIDE), where it
C         has a state; the CSM's is CM from CM/SM separation on.  The LM has one only where LMSTAT's rules (traj.f)
C         give it one; docked to the CSM it is not marked (the CSM's
C         mark or model stands for both).
C       A label that would leave the frame or meet a name already
C         lettered (the other layers' labels, VLSEED, or a vehicle's)
C         tries the other side of its vehicle, then is dropped.
C=======================================================================
C
C-----------------------------------------------------------------------
C     VLABEL: label the placed models and mark the vehicles too small
C     to draw.  Order CSM, LM, S-IVB: the first placed label wins.
C-----------------------------------------------------------------------
      SUBROUTINE VLABEL(GET, VB, NV, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, VB(5,MAXV), LB(4,MAXL)
      INTEGER NV, NL
      DOUBLE PRECISION XA(64), XB(64), YA(64)
      DOUBLE PRECISION YB(64), XM(8), YM(8), H, TINY, C(3), P(3), Q(3)
      DOUBLE PRECISION R(3), V(3), XMN, XMX, YMN, YMX, X1, Y1, X2, Y2
      INTEGER KORD(6), IDM(6), NCH(5), M, K, N, J, NP, NP0, NM, IOK
      INTEGER ISD, IRIDE, KCSPL, KLMPL, ID
      DOUBLE PRECISION TS, EVGET
      DATA KORD / KCSM, KCMO, KLMD, KLMS, KLMA, KSIV /
      DATA IDM / 5, 1, 3, 3, 3, 4 /
      DATA NCH / 2, 2, 2, 5, 3 /
      NM = 0
C     The name height TXALL letters at, and 0.2 percent of the field.
      H = 0.028D0 * BOXH
      TINY = 0.004D0 * BOXH
C     The names already placed by the other layers are kept clear of.
      CALL VLSEED(LB, NL, H, XA, XB, YA, YB, NP)
      DO 50 M = 1, 6
        K = KORD(M)
        IF (MDON(K) .EQ. 0) GO TO 50
        CALL VLPTS(K, VLPX, VLPY, N)
        IF (N .EQ. 0) GO TO 50
        XMN = VLPX(1)
        XMX = VLPX(1)
        YMN = VLPY(1)
        YMX = VLPY(1)
        DO 10 J = 2, N
          XMN = DMIN1(XMN, VLPX(J))
          XMX = DMAX1(XMX, VLPX(J))
          YMN = DMIN1(YMN, VLPY(J))
          YMX = DMAX1(YMX, VLPY(J))
   10   CONTINUE
        CALL VLCEN(K, MDS1(K), MDS2(K), C)
        IF (DMAX1(XMX - XMN, YMX - YMN) .GE. TINY) GO TO 30
        CALL VLMARK(VB, NV, LB, NL, C, IDM(M), NCH(IDM(M)), 0, H,
     &              XA, XB, YA, YB, NP, XM, YM, NM)
        GO TO 50
C       The CSM: the CM (its first two solids, cone and tunnel), then
C       the SM (the rest) on the same side with the CM's box counted.
   30   IF (K .NE. KCSM) GO TO 40
        CALL VLCEN(K, MDS1(K), MDS1(K) + 1, P)
        ISD = 0
        CALL VLSIDE(K, P, VLPX, VLPY, N, 2, H, XA, XB, YA, YB, NP,
     &              X1, Y1, ISD, IOK)
        IF (IOK .EQ. 0) GO TO 40
        NP0 = NP
        CALL VLADD(X1, Y1, 1.4D0 * H, H, XA, XB, YA, YB, NP)
        CALL VLCEN(K, MDS1(K) + 2, MDS2(K), Q)
        CALL VLSIDE(K, Q, VLPX, VLPY, N, 2, H, XA, XB, YA, YB, NP,
     &              X2, Y2, ISD, IOK)
        NP = NP0
        IF (IOK .EQ. 0) GO TO 40
        CALL VLPUT(LB, NL, X1, Y1, H, 1, 2, XA, XB, YA, YB, NP)
        CALL VLPUT(LB, NL, X2, Y2, H, 2, 2, XA, XB, YA, YB, NP)
        GO TO 50
   40   ISD = 0
        CALL VLSIDE(K, C, VLPX, VLPY, N, NCH(IDM(M)), H, XA, XB, YA, YB,
     &              NP, X1, Y1, ISD, IOK)
        IF (IOK .EQ. 1) CALL VLPUT(LB, NL, X1, Y1, H, IDM(M),
     &    NCH(IDM(M)), XA, XB, YA, YB, NP)
   50 CONTINUE
C
C     The CSM and the LM from their states, where they are not placed
C     and the camera does not ride them; the LM not while docked.
      IF (KCSPL() .NE. 0 .OR. IRIDE() .EQ. 1) GO TO 60
      CALL VSTATE(GET, 1, 2, R, V, IOK)
      DO 55 J = 1, 3
        P(J) = MPOS(J) + R(J)
   55 CONTINUE
      ID = 5
      TS = EVGET(KECMS)
      IF (TS .GE. 0.0D0 .AND. GET .GE. TS) ID = 1
      CALL VLMARK(VB, NV, LB, NL, P, ID, NCH(ID), 1, H, XA, XB, YA, YB,
     &            NP, XM, YM, NM)
   60 IF (KLMPL() .NE. 0) RETURN
      IF (IRIDE() .EQ. 2) RETURN
      CALL VSTATE(GET, 2, 2, R, V, IOK)
      IF (IOK .NE. 1) RETURN
      DO 65 J = 1, 3
        P(J) = MPOS(J) + R(J)
   65 CONTINUE
      CALL VLMARK(VB, NV, LB, NL, P, 3, 2, 1, H, XA, XB, YA, YB, NP,
     &            XM, YM, NM)
      RETURN
      END
C
C     VPRES: IVBIT, the vehicles in this frame's world, for hdr(21): 1
C     the CSM, 2 the LM, 4 the S-IVB, each if placed as a model or
C     known by its state (VSTATE; the LM docked too); the vehicle the
C     camera rides in a window or station view (IRIDE) is not counted.
      SUBROUTINE VPRES(GET)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, R(3), V(3)
      INTEGER IRIDE, IOK, KCSPL, KLMPL
      IVBIT = 0
      IF (KCSPL() .NE. 0 .OR. IRIDE() .NE. 1) IVBIT = 1
      IOK = 0
      IF (IRIDE() .NE. 2) CALL VSTATE(GET, 2, 2, R, V, IOK)
      IF (KLMPL() .NE. 0 .OR. IOK .NE. 0) IVBIT = IVBIT + 2
      IF (MDON(KSIV) .EQ. 1) IVBIT = IVBIT + 4
      RETURN
      END
C
C     VLPTS: the plot points (PX, PY; N of them) of placed model K's
C     solid vertices and free-line ends in front of the camera.
      SUBROUTINE VLPTS(K, PX, PY, N)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER K, N
      DOUBLE PRECISION PX(2400), PY(2400), V(3), W(3), A(3)
      INTEGER I, J, L, IS
      N = 0
      IF (MDS2(K) .LT. MDS1(K)) GO TO 30
      DO 20 IS = MDS1(K), MDS2(K)
        DO 10 J = 1, NLV(IS)
          CALL VLPT1(LWV(1,J,IS), PX, PY, N)
   10   CONTINUE
   20 CONTINUE
   30 IF (MDX2(K) .LT. MDX1(K)) RETURN
      DO 50 J = MDX1(K), MDX2(K)
        DO 45 L = 0, 1
          DO 35 I = 1, 3
            V(I) = (LXL(I + 3 * L, J) - MDBO(I,K)) * 1.0D-3
   35     CONTINUE
          CALL MXV(MDAT(1,1,K), V, W)
          DO 40 I = 1, 3
            A(I) = MDP(I,K) + W(I)
   40     CONTINUE
          CALL VLPT1(A, PX, PY, N)
   45   CONTINUE
   50 CONTINUE
      RETURN
      END
C
C     VLPT1: add camera-relative point A's plot position, if it is in
C     front of the camera and projected, to PX, PY.
      SUBROUTINE VLPT1(A, PX, PY, N)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION A(3), PX(2400), PY(2400), X, Y
      INTEGER N, IOK
      IF (N .GE. 2400) RETURN
      IF (A(1)*CB(1) + A(2)*CB(2) + A(3)*CB(3) .LE. 0.0D0) RETURN
      CALL PROJ(A, X, Y, IOK)
      IF (IOK .EQ. 0) RETURN
      N = N + 1
      PX(N) = X
      PY(N) = Y
      RETURN
      END
C
C     VLCEN: P (km, camera relative), the centre of the body-axis box
C     around the vertices of placed model K's solids IS1..IS2.
      SUBROUTINE VLCEN(K, IS1, IS2, P)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER K, IS1, IS2
      DOUBLE PRECISION P(3), BMN(3), BMX(3), V(3), W(3)
      INTEGER I, J, IS
      DO 10 I = 1, 3
        BMN(I) = 1.0D30
        BMX(I) = -1.0D30
   10 CONTINUE
      DO 30 IS = IS1, IS2
        DO 25 J = 1, NLV(IS)
          DO 20 I = 1, 3
            BMN(I) = DMIN1(BMN(I), LMV(I,J,IS))
            BMX(I) = DMAX1(BMX(I), LMV(I,J,IS))
   20     CONTINUE
   25   CONTINUE
   30 CONTINUE
      DO 40 I = 1, 3
        V(I) = (0.5D0 * (BMN(I) + BMX(I)) - MDBO(I,K)) * 1.0D-3
   40 CONTINUE
      CALL MXV(MDAT(1,1,K), V, W)
      DO 50 I = 1, 3
        P(I) = MDP(I,K) + W(I)
   50 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     VLSIDE: where to letter NC characters (height H) for the part of
C     placed model K centred at P.  The side is square to the model's
C     projected X axis (right of it, or above it when the axis lies
C     across the frame; right of the model when it is seen near end
C     on); the text's near edge is the model's largest
C     projected distance from that axis (over PX, PY) plus half a
C     character height out.  ISD 0 tries that side then the other
C     and returns the one used (+1 or -1); ISD +-1 tries only that
C     side.  X0, Y0: the text's lower left.  IOK = 1 if it fits in the
C     frame clear of the labels placed so far (IVFREE).
C-----------------------------------------------------------------------
      SUBROUTINE VLSIDE(K, P, PX, PY, N, NC, H, XA, XB, YA, YB, NP,
     &                  X0, Y0, ISD, IOK)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER K, N, NC, NP, ISD, IOK
      DOUBLE PRECISION P(3), PX(2400), PY(2400), H, XA(64), XB(64)
      DOUBLE PRECISION YA(64), YB(64), X0, Y0
      DOUBLE PRECISION A(3), CX, CY, AX, AY, DX, DY, D, NX, NY, E, T
      DOUBLE PRECISION WD, UX, UY, G, S
      INTEGER I, J, L, L1, L2, IK, IVFREE
      IOK = 0
      IF (P(1)*CB(1) + P(2)*CB(2) + P(3)*CB(3) .LE. 0.0D0) RETURN
      CALL PROJ(P, CX, CY, IK)
      IF (IK .EQ. 0) RETURN
C     The model's X axis in the plot, 1 m of it from P.  Seen within
C     30 deg of end on, the axis says little: the label goes to the
C     right (or left) of the whole model instead.
      NX = 1.0D0
      NY = 0.0D0
      D = DSQRT(P(1) * P(1) + P(2) * P(2) + P(3) * P(3))
      IF (DABS(P(1) * MDAT(1,1,K) + P(2) * MDAT(2,1,K)
     &    + P(3) * MDAT(3,1,K)) .GT. 0.866D0 * D) GO TO 15
      DO 10 I = 1, 3
        A(I) = P(I) + 1.0D-3 * MDAT(I,1,K)
   10 CONTINUE
      IF (A(1)*CB(1) + A(2)*CB(2) + A(3)*CB(3) .LE. 0.0D0) GO TO 15
      CALL PROJ(A, AX, AY, IK)
      DX = AX - CX
      DY = AY - CY
      D = DSQRT(DX * DX + DY * DY)
      IF (IK .EQ. 0 .OR. D .LT. 1.0D-9) GO TO 15
      NX = -DY / D
      NY = DX / D
      IF (NX .GT. 0.0D0 .OR. (NX .EQ. 0.0D0 .AND. NY .GT. 0.0D0))
     &  GO TO 15
      NX = -NX
      NY = -NY
C     The model's half-width across the axis.
   15 E = 0.0D0
      DO 20 J = 1, N
        T = DABS((PX(J) - CX) * NX + (PY(J) - CY) * NY)
        IF (T .GT. E) E = T
   20 CONTINUE
      WD = 0.7D0 * H * DBLE(NC)
      L1 = 1
      L2 = 2
      IF (ISD .EQ. 1) L2 = 1
      IF (ISD .EQ. -1) L1 = 2
      DO 40 L = L1, L2
        S = DBLE(3 - 2 * L)
        UX = S * NX
        UY = S * NY
        IF (DABS(UX) .LT. 0.5D0) GO TO 30
C       Beside a steep axis: the text starts (or ends) G out.
        G = E + 0.5D0 * H + 0.5D0 * H * DABS(UY)
        X0 = CX + UX * G
        IF (UX .LT. 0.0D0) X0 = X0 - WD
        Y0 = CY + UY * G - 0.5D0 * H
        GO TO 35
C       Above or below a flat axis: the text centred G out.
   30   G = E + 0.5D0 * H + 0.5D0 * WD * DABS(UX)
        X0 = CX + UX * G - 0.5D0 * WD
        Y0 = CY + UY * G
        IF (UY .LT. 0.0D0) Y0 = Y0 - H
   35   IF (IVFREE(X0, Y0, WD, H, XA, XB, YA, YB, NP) .EQ. 0) GO TO 40
        IOK = 1
        ISD = 3 - 2 * L
        RETURN
   40 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     VLMARK: mark a vehicle at P (km, camera relative) with a boxed X,
C     and its label (id ID, NC characters, height H) at a corner of
C     the box, the first of four that fits.  Hidden behind the Earth
C     or Moon; ISOL = 1 also hidden behind placed models and, from the
C     LM window, below the sill (ISVIS mode 2), for a vehicle that is
C     not itself placed.  A second mark within a box of one already
C     made (a docked stack) is left out.
C-----------------------------------------------------------------------
      SUBROUTINE VLMARK(VB, NV, LB, NL, P, ID, NC, ISOL, H,
     &                  XA, XB, YA, YB, NP, XM, YM, NM)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), LB(4,MAXL), P(3), H, XA(64), XB(64)
      DOUBLE PRECISION YA(64), YB(64), XM(8), YM(8)
      INTEGER NV, NL, ID, NC, ISOL, NP, NM
      DOUBLE PRECISION X, Y, W, WD, X0, Y0, OCCL
      INTEGER J, IOK, ISVIS, IVFREE
      IOK = 1
      IF (P(1)*CB(1) + P(2)*CB(2) + P(3)*CB(3) .LE. 0.0D0) RETURN
      IF (OCCL(P, MPOS, RM) .GT. 0.0D0) RETURN
      IF (OCCL(P, EPOS, RE) .GT. 0.0D0) RETURN
      IVMODE = 2
      IF (ISOL .EQ. 1) IOK = ISVIS(P)
      IVMODE = 0
      IF (ISOL .EQ. 1 .AND. IOK .EQ. 0) RETURN
      CALL PROJ(P, X, Y, IOK)
      IF (IOK .EQ. 0) RETURN
      IF (DABS(X) .GT. BOXH .OR. DABS(Y) .GT. BOXH) RETURN
      W = 0.012D0 * FOVH
      DO 10 J = 1, NM
        IF (DABS(X - XM(J)) .LT. W .AND. DABS(Y - YM(J)) .LT. W)
     &    RETURN
   10 CONTINUE
      CALL BOXX(VB, NV, X, Y, W)
      IF (NM .GE. 8) GO TO 20
      NM = NM + 1
      XM(NM) = X
      YM(NM) = Y
C     The label at the box's upper right, upper left, lower right or
C     lower left, the first that is free.
   20 WD = 0.7D0 * H * DBLE(NC)
      DO 25 J = 1, 4
        X0 = X + W + 0.4D0 * H
        IF (J .EQ. 2 .OR. J .EQ. 4) X0 = X - W - 0.4D0 * H - WD
        Y0 = Y + W + 0.4D0 * H
        IF (J .GE. 3) Y0 = Y - W - 0.4D0 * H - H
        IF (IVFREE(X0, Y0, WD, H, XA, XB, YA, YB, NP) .EQ. 1) GO TO 30
   25 CONTINUE
      RETURN
   30 CALL VLPUT(LB, NL, X0, Y0, H, ID, NC, XA, XB, YA, YB, NP)
      RETURN
      END
C
C     IVFREE: 1 if a text box, lower left X0, Y0, WD wide and H high,
C     lies in the frame (with its label point 0.4 H below and left, as
C     TXALL letters it) and clear by 0.2 H of the NP boxes placed.
      INTEGER FUNCTION IVFREE(X0, Y0, WD, H, XA, XB, YA, YB, NP)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION X0, Y0, WD, H, XA(64), XB(64), YA(64), YB(64)
      DOUBLE PRECISION M
      INTEGER NP, J
      IVFREE = 0
      IF (X0 - 0.4D0 * H .LT. -BOXH .OR. X0 + WD .GT. BOXH) RETURN
      IF (Y0 - 0.4D0 * H .LT. -BOXH .OR. Y0 + H .GT. BOXH) RETURN
      M = 0.2D0 * H
      DO 10 J = 1, NP
        IF (X0 - M .LT. XB(J) .AND. X0 + WD + M .GT. XA(J) .AND.
     &      Y0 - M .LT. YB(J) .AND. Y0 + H + M .GT. YA(J)) RETURN
   10 CONTINUE
      IVFREE = 1
      RETURN
      END
C
C     VLSEED: the text boxes of the names the other layers have placed
C     (LB kinds 1, 3-7, 9) that TXALL letters at this level, height H,
C     as the first NP boxes.  Crater names (kind 2) are the page's.
      SUBROUTINE VLSEED(LB, NL, H, XA, XB, YA, YB, NP)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION LB(4,MAXL), H, XA(64), XB(64), YA(64), YB(64)
      DOUBLE PRECISION X0, Y0
      INTEGER NL, NP, I, J, K, ID, N
      NP = 0
      DO 50 I = 1, NL
        K = NINT(LB(3,I))
        ID = NINT(LB(4,I))
        N = 0
        IF ((K .EQ. 1 .OR. K .EQ. 6) .AND. ILEV .LT. 2) GO TO 50
        IF (K .NE. 1 .OR. ID .LT. 1 .OR. ID .GT. NNAV) GO TO 15
        DO 10 J = 1, 10
          IF (NAVCH((ID - 1) * 10 + J) .NE. 0) N = N + 1
   10   CONTINUE
   15   IF (K .LT. 3 .OR. K .GT. 5) GO TO 25
        DO 20 J = 1, 5
          IF (BODCH((K - 3) * 5 + J) .NE. 0) N = N + 1
   20   CONTINUE
   25   IF (K .NE. 6 .OR. ID .LT. 1 .OR. ID .GT. NMARE) GO TO 35
        DO 30 J = 1, 24
          IF (MRCH((ID - 1) * 24 + J) .NE. 0) N = N + 1
   30   CONTINUE
   35   IF (K .EQ. 7) N = 22
        IF (K .NE. 9) GO TO 45
        DO 40 J = 1, 8
          IF (PADCH(8 * (ISN - 1) + J) .NE. 0) N = N + 1
   40   CONTINUE
   45   IF (N .EQ. 0) GO TO 50
C       Mare names are centred on the point, the others up and right.
        X0 = LB(1,I) + 0.4D0 * H
        Y0 = LB(2,I) + 0.4D0 * H
        IF (K .EQ. 6) X0 = LB(1,I) - 0.35D0 * H * DBLE(N)
        IF (K .EQ. 6) Y0 = LB(2,I) - 0.5D0 * H
        CALL VLADD(X0, Y0, 0.7D0 * H * DBLE(N), H, XA, XB, YA, YB, NP)
   50 CONTINUE
      RETURN
      END
C
C     VLADD: count a text box (lower left X0, Y0, WD by H) as placed.
      SUBROUTINE VLADD(X0, Y0, WD, H, XA, XB, YA, YB, NP)
      DOUBLE PRECISION X0, Y0, WD, H, XA(64), XB(64), YA(64), YB(64)
      INTEGER NP
      IF (NP .GE. 64) RETURN
      NP = NP + 1
      XA(NP) = X0
      XB(NP) = X0 + WD
      YA(NP) = Y0
      YB(NP) = Y0 + H
      RETURN
      END
C
C     VLPUT: the vehicle label (LB kind 8, id ID) whose NC-character
C     name TXALL letters with its lower left at X0, Y0: the label
C     point is 0.4 H below and left of it.
      SUBROUTINE VLPUT(LB, NL, X0, Y0, H, ID, NC, XA, XB, YA, YB, NP)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION LB(4,MAXL), X0, Y0, H, XA(64), XB(64), YA(64)
      DOUBLE PRECISION YB(64)
      INTEGER NL, ID, NC, NP
      CALL LABEL(LB, NL, X0 - 0.4D0 * H, Y0 - 0.4D0 * H, 8, ID)
      CALL VLADD(X0, Y0, 0.7D0 * H * DBLE(NC), H, XA, XB, YA, YB, NP)
      RETURN
      END
