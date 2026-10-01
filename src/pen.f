C=======================================================================
C
C     V I E W - 1 1 0 8          PROJECTION AND PEN
C
C     Core element.  Directions to plot degrees,
C     clipping, visibility, and vectors to the plot buffer.  One
C     relocatable element of the kernel; see vdrive.f for the list.
C
C=======================================================================
C
C=======================================================================
C     THE PEN.  Points are camera-relative EQ vectors (km).
C     PROJ   direction to plot degrees
C     UNPROJ plot degrees to a direction (reference or live camera)
C     EMIT   clip a plot-degree segment to the frame and store it
C     SEG    project and emit a 3-D segment
C     EMIT, SEG and MSEG go through the window mask first (vmask.f),
C     which calls EMIT0, SEG0 and MSEG0 here.
C     PEN    move (IP=0) or draw (IP=1) with the visibility test
C            IVMODE; a segment crossing from seen to hidden is cut at
C            the boundary by bisection.
C=======================================================================
C-----------------------------------------------------------------------
C     PROJECTION.  Radially symmetric about the boresight: a direction
C     at angle T from the boresight and position angle P (from the
C     right axis toward up) lands at radius RHO = K TAN(T/K), taken
C     in degrees (times 180/PI, so RHO is T in degrees near the
C     centre), at X = RHO COS P, Y = RHO SIN P.  K = 1 (gnomonic, true
C     perspective) up to a 100 deg field, rising linearly to K = 2
C     (stereographic) at 170 deg (PK, set in VFRAME).  The frame box
C     half-width is RHO(FOV/2) (BOXH).
C     Evidence, and it is our inference, not stated in either report:
C     the film's descent frames (t28, t31, t35; FOV about 100) show
C     the lunar horizon as a straight line at every height, and MSC
C     IN 69-FM-197 (PDF p. 170, docking window, FOV 100) shows it
C     straight across +-50 at Y = -30: a gnomonic plot draws every
C     great circle straight.  The same page's 170 deg front-window
C     panel shows a fisheye dome, which a stereographic plot gives
C     (conformal, circles stay circles); a gnomonic plot cannot reach
C     90 deg off axis at all.  The film's evenly spaced ticks,
C     labelled in degrees, fit a tangent-plane plot marked in degrees
C     at the centre.  (An earlier angle-angle mapping drew off-axis
C     circles as rounded squares.)  PTH returns T (rad).
C-----------------------------------------------------------------------
      SUBROUTINE PROJ(D, X, Y, IOK)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION D(3), X, Y, A, B, C, S, T, R
      INTEGER IOK
      A = D(1)*CR(1) + D(2)*CR(2) + D(3)*CR(3)
      B = D(1)*CU(1) + D(2)*CU(2) + D(3)*CU(3)
      C = D(1)*CB(1) + D(2)*CB(2) + D(3)*CB(3)
      S = DSQRT(A * A + B * B)
      T = DATAN2(S, C)
      PTH = T
      IOK = 1
      IF (T / DR .GT. THLIM) IOK = 0
      IF (T / DR .GT. THLIM) T = THLIM * DR
      R = PK * DTAN(T / PK) / DR
      X = 0.0D0
      Y = 0.0D0
      IF (S .GT. 0.0D0) X = R * A / S
      IF (S .GT. 0.0D0) Y = R * B / S
      RETURN
      END
C
C     RHO: plot radius (deg) of a direction T (rad) off the boresight.
      DOUBLE PRECISION FUNCTION RHO(T)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION T
      RHO = PK * DTAN(T / PK) / DR
      RETURN
      END
C
C     UNPROJ: plot (X, Y) to a unit direction D.  IREF=1: reference
C     attitude with K = 1, for window overlays fixed to the vehicle
C     (their plot coordinates were read off the film's 100 deg,
C     gnomonic frames); IREF=0: the live camera and PK.
      SUBROUTINE UNPROJ(X, Y, IREF, D)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION X, Y, D(3), A, B, C, R, T, Q
      INTEGER IREF, I
      R = DSQRT(X * X + Y * Y)
      Q = PK
      IF (IREF .EQ. 1) Q = 1.0D0
      T = Q * DATAN(R * DR / Q)
      C = DCOS(T)
      A = 0.0D0
      B = 0.0D0
      IF (R .GT. 0.0D0) A = DSIN(T) * X / R
      IF (R .GT. 0.0D0) B = DSIN(T) * Y / R
      DO 10 I = 1, 3
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (IREF .EQ. 1) THEN
          D(I) = C * BREF(I) + A * RREF(I) + B * UREF(I)
        ELSE
          D(I) = C * CB(I) + A * CR(I) + B * CU(I)
        END IF
C     RESTOMOD END
   10 CONTINUE
      RETURN
      END
C
C     EMIT0: Liang-Barsky clip to the frame, then store.
      SUBROUTINE EMIT0(VB, NV, X1, Y1, X2, Y2)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), X1, Y1, X2, Y2
      INTEGER NV
      DOUBLE PRECISION DX, DY, T0, T1, P(4), Q(4), R
      INTEGER K
C     RESTOMOD BEGIN: Liang-Barsky line clipping, published 1984
      DX = X2 - X1
      DY = Y2 - Y1
      P(1) = -DX
      Q(1) = X1 + BOXH
      P(2) = DX
      Q(2) = BOXH - X1
      P(3) = -DY
      Q(3) = Y1 + BOXH
      P(4) = DY
      Q(4) = BOXH - Y1
      T0 = 0.0D0
      T1 = 1.0D0
      DO 10 K = 1, 4
        IF (P(K) .EQ. 0.0D0) THEN
          IF (Q(K) .LT. 0.0D0) RETURN
        ELSE
          R = Q(K) / P(K)
          IF (P(K) .LT. 0.0D0) THEN
            IF (R .GT. T1) RETURN
            IF (R .GT. T0) T0 = R
          ELSE
            IF (R .LT. T0) RETURN
            IF (R .LT. T1) T1 = R
          END IF
        END IF
   10 CONTINUE
      IF (NV .GE. MAXV) RETURN
      NV = NV + 1
      VB(1,NV) = X1 + T0 * DX
      VB(2,NV) = Y1 + T0 * DY
      VB(3,NV) = X1 + T1 * DX
      VB(4,NV) = Y1 + T1 * DY
      VB(5,NV) = DBLE(ISTYLE)
C     RESTOMOD END
      RETURN
      END
C
C     SEG0: 3-D segment A-B (camera relative) to the frame.  A segment
C     running past the projection's limit (THLIM off the boresight) is
C     cut at the limit by bisection.
      SUBROUTINE SEG0(VB, NV, A, B)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), A(3), B(3)
      INTEGER NV
      DOUBLE PRECISION X1, Y1, X2, Y2, P(3), Q(3), M(3), XM, YM
      INTEGER K1, K2, KM, I, IT
      CALL PROJ(A, X1, Y1, K1)
      CALL PROJ(B, X2, Y2, K2)
      IF (K1 .EQ. 0 .AND. K2 .EQ. 0) RETURN
      IF (K1 .EQ. 1 .AND. K2 .EQ. 1) GO TO 50
C     P inside the limit, Q outside.
      DO 10 I = 1, 3
        P(I) = A(I)
        Q(I) = B(I)
        IF (K1 .EQ. 0) P(I) = B(I)
        IF (K1 .EQ. 0) Q(I) = A(I)
   10 CONTINUE
      DO 30 IT = 1, 20
        DO 20 I = 1, 3
          M(I) = 0.5D0 * (P(I) + Q(I))
   20   CONTINUE
        CALL PROJ(M, XM, YM, KM)
        DO 25 I = 1, 3
          IF (KM .EQ. 1) P(I) = M(I)
          IF (KM .EQ. 0) Q(I) = M(I)
   25   CONTINUE
   30 CONTINUE
      CALL PROJ(P, XM, YM, KM)
      IF (K1 .EQ. 1) X2 = XM
      IF (K1 .EQ. 1) Y2 = YM
      IF (K1 .EQ. 0) X1 = XM
      IF (K1 .EQ. 0) Y1 = YM
   50 CALL EMIT0(VB, NV, X1, Y1, X2, Y2)
      RETURN
      END
C
      SUBROUTINE PEN(VB, NV, P, IP)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), P(3)
      INTEGER NV, IP
      DOUBLE PRECISION A(3), B(3), M(3)
      INTEGER IV, ISVIS, I, IT
      IV = ISVIS(P)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (IP .EQ. 1) THEN
        IF (IV .EQ. 1 .AND. IPV .EQ. 1) THEN
          CALL SEG(VB, NV, PPX, P)
        ELSE IF (IV .NE. IPV) THEN
C         Seen end in A, hidden end in B; home in on the boundary.
          DO 10 I = 1, 3
            IF (IV .EQ. 1) THEN
              A(I) = P(I)
              B(I) = PPX(I)
            ELSE
              A(I) = PPX(I)
              B(I) = P(I)
            END IF
   10     CONTINUE
          DO 30 IT = 1, 10
            DO 20 I = 1, 3
              M(I) = 0.5D0 * (A(I) + B(I))
   20       CONTINUE
            IF (ISVIS(M) .EQ. 1) THEN
              DO 22 I = 1, 3
                A(I) = M(I)
   22         CONTINUE
            ELSE
              DO 24 I = 1, 3
                B(I) = M(I)
   24         CONTINUE
            END IF
   30     CONTINUE
          IF (IV .EQ. 1) THEN
            CALL SEG(VB, NV, A, P)
          ELSE
            CALL SEG(VB, NV, PPX, A)
          END IF
        END IF
      END IF
C     RESTOMOD END
      DO 40 I = 1, 3
        PPX(I) = P(I)
   40 CONTINUE
      IPV = IV
      RETURN
      END
C
C-----------------------------------------------------------------------
C     ISVIS: 1 if camera-relative point P is seen, by IVMODE:
C       0 always
C       1 on the Earth's surface: facing us, not behind the Moon
C       2 on the Earth's limb: not behind the Moon
C       3 on the Moon's surface: facing us, not behind the Earth
C       4 as 1, and on the night side
C       5 on the Moon's limb: not behind the Earth
C       6 on the Moon's surface, facing us and on the night side
C-----------------------------------------------------------------------
      INTEGER FUNCTION ISVIS(P)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION P(3), N(3), OCCL, SILL
      INTEGER I, LMOCC
      ISVIS = 1
      IF (IVMODE .EQ. 0) RETURN
C     Placed spacecraft models hide what lies behind them.
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (NACT .GT. 0) THEN
        IF (LMOCC(P, 0) .EQ. 1) THEN
          ISVIS = 0
          RETURN
        END IF
      END IF
C     RESTOMOD END
C     From the LM the window sill hides everything below it.
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF ((ISCN .EQ. 5 .AND. IVUSE .EQ. 0) .OR. IVUSE .EQ. 3) THEN
        IF (SILL(P) .GT. 0.0D0) THEN
          ISVIS = 0
          RETURN
        END IF
      END IF
C     RESTOMOD END
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (IVMODE .EQ. 1 .OR. IVMODE .EQ. 4) THEN
        DO 10 I = 1, 3
          N(I) = P(I) - EPOS(I)
   10   CONTINUE
        IF (N(1)*P(1) + N(2)*P(2) + N(3)*P(3) .GE. 0.0D0) ISVIS = 0
        IF (IVMODE .EQ. 4 .AND. ISVIS .EQ. 1) THEN
          IF (N(1)*SUNU(1) + N(2)*SUNU(2) + N(3)*SUNU(3) .GT. 0.0D0)
     &      ISVIS = 0
        END IF
        IF (ISVIS .EQ. 1) THEN
          IF (OCCL(P, MPOS, RM) .GT. 0.0D0) ISVIS = 0
        END IF
      ELSE IF (IVMODE .EQ. 2) THEN
        IF (OCCL(P, MPOS, RM) .GT. 0.0D0) ISVIS = 0
      ELSE IF (IVMODE .EQ. 3) THEN
        DO 20 I = 1, 3
          N(I) = P(I) - MPOS(I)
   20   CONTINUE
        IF (N(1)*P(1) + N(2)*P(2) + N(3)*P(3) .GE. 0.0D0) ISVIS = 0
        IF (ISVIS .EQ. 1) THEN
          IF (OCCL(P, EPOS, RE) .GT. 0.0D0) ISVIS = 0
        END IF
      ELSE IF (IVMODE .EQ. 5) THEN
        IF (OCCL(P, EPOS, RE) .GT. 0.0D0) ISVIS = 0
      ELSE IF (IVMODE .EQ. 6) THEN
        DO 30 I = 1, 3
          N(I) = P(I) - MPOS(I)
   30   CONTINUE
        IF (N(1)*P(1) + N(2)*P(2) + N(3)*P(3) .GE. 0.0D0) ISVIS = 0
        IF (N(1)*SUNU(1) + N(2)*SUNU(2) + N(3)*SUNU(3) .GT. 0.0D0)
     &    ISVIS = 0
      END IF
C     RESTOMOD END
      RETURN
      END
C
C     SILL: > 0 if P lies below the LM window sill, 35 deg below the
C     centre of the reference (vehicle-fixed) frame.
      DOUBLE PRECISION FUNCTION SILL(P)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION P(3), B, C
      B = P(1)*UREF(1) + P(2)*UREF(2) + P(3)*UREF(3)
      C = P(1)*BREF(1) + P(2)*BREF(2) + P(3)*BREF(3)
C     Reference plot Y with K = 1 is TAN(T) SIN(P) = B / C (deg).
      SILL = 1.0D0
      IF (C .GT. 0.0D0) SILL = -35.0D0 - B / C / DR
      IF (C .LE. 0.0D0 .AND. B .GE. 0.0D0) SILL = -1.0D0
      RETURN
      END
C
C     OCCL: > 0 if the sight line from the camera to P passes inside
C     the sphere of centre S (camera relative) and radius R.
      DOUBLE PRECISION FUNCTION OCCL(P, S, R)
      DOUBLE PRECISION P(3), S(3), R, T, PP, D1, D2, D3
      PP = P(1)*P(1) + P(2)*P(2) + P(3)*P(3)
      T = (P(1)*S(1) + P(2)*S(2) + P(3)*S(3)) / PP
      IF (T .LT. 0.0D0) T = 0.0D0
      IF (T .GT. 1.0D0) T = 1.0D0
      D1 = T * P(1) - S(1)
      D2 = T * P(2) - S(2)
      D3 = T * P(3) - S(3)
      OCCL = R * R - (D1 * D1 + D2 * D2 + D3 * D3)
      RETURN
      END
C
C     RAYHIT: > 0 if the ray from the camera along unit U meets the
C     sphere of centre S, radius R.
      DOUBLE PRECISION FUNCTION RAYHIT(U, S, R)
      DOUBLE PRECISION U(3), S(3), R, B
      B = U(1)*S(1) + U(2)*S(2) + U(3)*S(3)
      RAYHIT = -1.0D0
      IF (B .LE. 0.0D0) RETURN
      RAYHIT = R * R - (S(1)*S(1) + S(2)*S(2) + S(3)*S(3) - B * B)
      RETURN
      END
C
      SUBROUTINE LABEL(LB, NL, X, Y, KIND, ID)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION LB(4,MAXL), X, Y, D(3)
      INTEGER NL, KIND, ID, WMIN
      IF (NL .GE. MAXL) RETURN
C     With a label level set, the last 8 places are kept for the
C     vehicle and pad labels (kinds 8, 9), which come after the sky's
C     (ours: a full buffer of crater labels would crowd them out).
      IF (ILABL .GE. 1 .AND. KIND .LT. 8 .AND. NL .GE. MAXL - 8) RETURN
      IF (DABS(X) .GT. BOXH .OR. DABS(Y) .GT. BOXH) RETURN
C     Outside the windows when the window mask applies (vmask.f).
      IF (IMSK .EQ. 0) GO TO 10
      CALL UNPROJ(X, Y, 0, D)
      IF (WMIN(D) .EQ. 0) RETURN
   10 NL = NL + 1
      LB(1,NL) = X
      LB(2,NL) = Y
      LB(3,NL) = DBLE(KIND)
      LB(4,NL) = DBLE(ID)
      RETURN
      END
C
C     BOXX: a small boxed X of half-width W (plot deg) about (X, Y),
C     the mark of the Moon view's landing site (DMOON6), also used for
C     the launch pad (DPAD) and vehicle markers (VLMARK).
      SUBROUTINE BOXX(VB, NV, X, Y, W)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), X, Y, W
      INTEGER NV
      CALL EMIT(VB, NV, X - W, Y - W, X + W, Y - W)
      CALL EMIT(VB, NV, X + W, Y - W, X + W, Y + W)
      CALL EMIT(VB, NV, X + W, Y + W, X - W, Y + W)
      CALL EMIT(VB, NV, X - W, Y + W, X - W, Y - W)
      CALL EMIT(VB, NV, X - W, Y - W, X + W, Y + W)
      CALL EMIT(VB, NV, X - W, Y + W, X + W, Y - W)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     SHADE: night side of the sphere (centre S camera relative, radius
C     R) as straight parallel lines (TN D-6853, printed p. 8, fig. 6).
C     Each is cut from the sphere by a plane through the eye that
C     contains the Sun's direction across the line of sight, so it
C     draws as a straight line along the light; 15 span the disc.
C     IVM is the visibility test for the night-side points.
C-----------------------------------------------------------------------
      SUBROUTINE SHADE(VB, NV, S, R, IVM)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), S(3), R
      INTEGER NV, IVM
      DOUBLE PRECISION D, AE, U(3), Q(3), C(3), P(3), CF, LA, SF
      INTEGER I, J
      D = DSQRT(S(1)**2 + S(2)**2 + S(3)**2)
      IF (D .LE. R) RETURN
      AE = DASIN(R / D)
      DO 10 I = 1, 3
        U(I) = S(I) / D
   10 CONTINUE
      CF = SUNU(1)*U(1) + SUNU(2)*U(2) + SUNU(3)*U(3)
      DO 20 I = 1, 3
        Q(I) = SUNU(I) - CF * U(I)
   20 CONTINUE
      IF (Q(1)**2 + Q(2)**2 + Q(3)**2 .LT. 1.0D-12) RETURN
      CALL VUNIT(Q)
      CALL VCRS(U, Q, C)
      IVMODE = IVM
      DO 40 J = -7, 7
        LA = DBLE(J) * AE / 7.5D0
        DO 30 I = 1, 3
          P(I) = C(I) * DCOS(LA) - U(I) * DSIN(LA)
   30   CONTINUE
        SF = D * DSIN(LA) / R
        IF (DABS(SF) .LT. 1.0D0)
     &    CALL CIRCLE(VB, NV, S, R, P, DACOS(SF), 180)
   40 CONTINUE
      IVMODE = 0
      RETURN
      END
C
C-----------------------------------------------------------------------
C     CIRCLE: small circle on the sphere (centre S camera relative,
C     radius R), at angle G from the unit axis A, N points, drawn with
C     the current IVMODE.
C-----------------------------------------------------------------------
      SUBROUTINE CIRCLE(VB, NV, S, R, A, G, N)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), S(3), R, A(3), G
      INTEGER NV, N
      DOUBLE PRECISION E1(3), E2(3), P(3), T, CG, SG, CT, ST
      INTEGER I, K
      CALL PERP(A, E1, E2)
      CG = DCOS(G)
      SG = DSIN(G)
      DO 20 K = 0, N
        T = DBLE(K) * 2.0D0 * PI / DBLE(N)
        CT = DCOS(T) * SG
        ST = DSIN(T) * SG
        DO 10 I = 1, 3
          P(I) = S(I) + R * (CG * A(I) + CT * E1(I) + ST * E2(I))
   10   CONTINUE
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (K .EQ. 0) THEN
          CALL PEN(VB, NV, P, 0)
        ELSE
          CALL PEN(VB, NV, P, 1)
        END IF
C     RESTOMOD END
   20 CONTINUE
      RETURN
      END
C
C     PERP: unit vectors E1, E2 completing unit A to a right-handed set.
      SUBROUTINE PERP(A, E1, E2)
      DOUBLE PRECISION A(3), E1(3), E2(3), Z(3)
      Z(1) = 0.0D0
      Z(2) = 0.0D0
      Z(3) = 1.0D0
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (DABS(A(3)) .GT. 0.9D0) THEN
        Z(1) = 1.0D0
        Z(3) = 0.0D0
      END IF
C     RESTOMOD END
      CALL VCRS(Z, A, E1)
      CALL VUNIT(E1)
      CALL VCRS(A, E1, E2)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     MSEG0: 3-D segment A-B (camera relative) to the frame, for model
C     edges, which may pass beside or behind the camera or very close
C     to it (a cabin seen from inside).  Without recursion, a stack of
C     pieces:
C       both ends projected: one vector if the projected midpoint is
C         within 0.1 percent of the box half-width of the chord (always
C         so in the gnomonic plot, where lines stay straight), else
C         split in two (a line bends in the stereographic plot, and
C         can pass behind the camera between two seen ends);
C       one end past the limit (THLIM, 90 deg times k): cut at the
C         limit by bisection, keep the seen part;
C       both ends past it: the limit cone is convex only up to 90 deg,
C         so the piece can still cross the view: find its point
C         nearest the boresight (the angle off it has one minimum along
C         a line, so a ternary search) and split there if it is seen.
C     Pieces are split at most 10 deep.  A point at the camera itself
C     projects to the centre (PROJ); nothing divides by the range.
C-----------------------------------------------------------------------
      SUBROUTINE MSEG0(VB, NV, A, B)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), A(3), B(3)
      INTEGER NV
      DOUBLE PRECISION SP(3,32), SQ(3,32), P(3), Q(3), M(3), T(3), W(3)
      DOUBLE PRECISION XP, YP, XQ, YQ, XM, YM, DEV, TOL, T0, T1, TA, TB
      DOUBLE PRECISION FA, FB, MSCOS
      INTEGER SD(32), NS, D, KP, KQ, KM, I, IT
      TOL = 1.0D-3 * BOXH
      NS = 1
      SD(1) = 0
      DO 5 I = 1, 3
        SP(I,1) = A(I)
        SQ(I,1) = B(I)
    5 CONTINUE
   10 IF (NS .EQ. 0) RETURN
      DO 12 I = 1, 3
        P(I) = SP(I,NS)
        Q(I) = SQ(I,NS)
   12 CONTINUE
      D = SD(NS)
      NS = NS - 1
      CALL PROJ(P, XP, YP, KP)
      CALL PROJ(Q, XQ, YQ, KQ)
      IF (KP .EQ. 0 .AND. KQ .EQ. 0) GO TO 40
      IF (KP .EQ. 0 .OR. KQ .EQ. 0) GO TO 30
C     Both ends seen.
      DO 14 I = 1, 3
        M(I) = 0.5D0 * (P(I) + Q(I))
   14 CONTINUE
      CALL PROJ(M, XM, YM, KM)
C     Distance of the projected midpoint off the chord's line (the
C     midpoint in space need not project to the chord's midpoint).
      T0 = DSQRT((XQ - XP)**2 + (YQ - YP)**2)
      DEV = DSQRT((XM - XP)**2 + (YM - YP)**2)
      IF (T0 .GT. 1.0D-9) DEV = DABS((XM - XP) * (YQ - YP)
     &  - (YM - YP) * (XQ - XP)) / T0
      IF (D .GE. 10) GO TO 20
      IF (KM .EQ. 1 .AND. DEV .LE. TOL) GO TO 20
      IF (NS .GE. 31) GO TO 20
      CALL MSPUSH(SP, SQ, SD, NS, M, Q, D + 1)
      CALL MSPUSH(SP, SQ, SD, NS, P, M, D + 1)
      GO TO 10
   20 CALL EMIT0(VB, NV, XP, YP, XQ, YQ)
      GO TO 10
C     One end past the limit: bisect for the crossing (T seen, M not),
C     keep the order A to B.
   30 DO 32 I = 1, 3
        T(I) = P(I)
        M(I) = Q(I)
        IF (KP .EQ. 0) T(I) = Q(I)
        IF (KP .EQ. 0) M(I) = P(I)
   32 CONTINUE
      DO 36 IT = 1, 20
        CALL MSMID(T, M, W, KM)
   36 CONTINUE
      IF (KP .EQ. 1) CALL MSPUSH(SP, SQ, SD, NS, P, T, D)
      IF (KP .EQ. 0) CALL MSPUSH(SP, SQ, SD, NS, T, Q, D)
      GO TO 10
C     Both ends past the limit.
   40 IF (D .GE. 10) GO TO 10
      TA = 0.0D0
      TB = 1.0D0
      DO 44 IT = 1, 40
        T0 = TA + (TB - TA) / 3.0D0
        T1 = TB - (TB - TA) / 3.0D0
        FA = MSCOS(P, Q, T0)
        FB = MSCOS(P, Q, T1)
        IF (FA .LT. FB) TA = T0
        IF (FA .GE. FB) TB = T1
   44 CONTINUE
      T0 = 0.5D0 * (TA + TB)
      DO 46 I = 1, 3
        T(I) = P(I) + T0 * (Q(I) - P(I))
   46 CONTINUE
      CALL PROJ(T, XM, YM, KM)
      IF (KM .EQ. 0 .OR. NS .GE. 31) GO TO 10
      CALL MSPUSH(SP, SQ, SD, NS, T, Q, D + 1)
      CALL MSPUSH(SP, SQ, SD, NS, P, T, D + 1)
      GO TO 10
      END
C
C     MSPUSH: push the piece P-Q, depth D, on the MSEG stack.
      SUBROUTINE MSPUSH(SP, SQ, SD, NS, P, Q, D)
      DOUBLE PRECISION SP(3,32), SQ(3,32), P(3), Q(3)
      INTEGER SD(32), NS, D, I
      NS = NS + 1
      DO 10 I = 1, 3
        SP(I,NS) = P(I)
        SQ(I,NS) = Q(I)
   10 CONTINUE
      SD(NS) = D
      RETURN
      END
C
C     MSMID: one bisection step between seen T and unseen U; P is
C     scratch.  The midpoint replaces whichever end it matches.
      SUBROUTINE MSMID(T, U, P, KM)
      DOUBLE PRECISION T(3), U(3), P(3), X, Y
      INTEGER KM, I
      DO 10 I = 1, 3
        P(I) = 0.5D0 * (T(I) + U(I))
   10 CONTINUE
      CALL PROJ(P, X, Y, KM)
      DO 20 I = 1, 3
        IF (KM .EQ. 1) T(I) = P(I)
        IF (KM .EQ. 0) U(I) = P(I)
   20 CONTINUE
      RETURN
      END
C
C     MSCOS: cosine of the angle off the boresight of the point a
C     fraction F from P to Q (-1 at the camera itself).
      DOUBLE PRECISION FUNCTION MSCOS(P, Q, F)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION P(3), Q(3), F, X(3), R
      INTEGER I
      DO 10 I = 1, 3
        X(I) = P(I) + F * (Q(I) - P(I))
   10 CONTINUE
      R = DSQRT(X(1) * X(1) + X(2) * X(2) + X(3) * X(3))
      MSCOS = -1.0D0
      IF (R .GT. 0.0D0) MSCOS = (X(1) * CB(1) + X(2) * CB(2)
     &  + X(3) * CB(3)) / R
      RETURN
      END
C
C     OVLINE: straight line in reference plot degrees, carried to the
C     live camera through its 3-D directions in 1 deg steps.
      SUBROUTINE OVLINE(VB, NV, X1, Y1, X2, Y2)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), X1, Y1, X2, Y2
      INTEGER NV
      DOUBLE PRECISION D(3), F, L
      INTEGER K, N
      L = DSQRT((X2 - X1)**2 + (Y2 - Y1)**2)
      N = 1 + INT(L)
      DO 10 K = 0, N
        F = DBLE(K) / DBLE(N)
        CALL UNPROJ(X1 + F * (X2 - X1), Y1 + F * (Y2 - Y1), 1, D)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (K .EQ. 0) THEN
          CALL PEN(VB, NV, D, 0)
        ELSE
          CALL PEN(VB, NV, D, 1)
        END IF
C     RESTOMOD END
   10 CONTINUE
      RETURN
      END
