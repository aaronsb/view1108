C=======================================================================
C
C     V I E W - 1 1 0 8          LAYER 4  MOON AND CRATERS
C
C     Layer element.  One relocatable element of
C     the kernel; see vdrive.f for the list.
C
C=======================================================================
C
C=======================================================================
C     MOON.  Limb (the horizon when close), gazetteer craters, and
C     near the surface seeded small craters.
C=======================================================================
      SUBROUTINE DMOON(GET, VB, NV, SB, NS, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, VB(5,MAXV), SB(3,MAXS), LB(4,MAXL)
      INTEGER NV, NS, NL
      DOUBLE PRECISION D, AM, C(3), U(3), H, HOR, X, Y, OCCL, VNRM
      DOUBLE PRECISION G(3), Q(3), CA
      INTEGER I, IOK, K
      D = VNRM(MPOS)
      IF (D .LE. RM * 1.000001D0) RETURN
      AM = DASIN(RM / D)
      DO 10 I = 1, 3
        U(I) = MPOS(I) / D
        C(I) = -U(I)
   10 CONTINUE
      IF (U(1)*CB(1) + U(2)*CB(2) + U(3)*CB(3) .LT.
     &    DCOS(DMIN1(THVIEW * DR + AM, PI))) RETURN
      H = D - RM
      HOR = DACOS(RM / D)
C
C     Limb.
      IVMODE = 5
      CALL CIRCLE(VB, NV, MPOS, RM, C, HOR, 720)
C
C     Gazetteer craters inside the visible cap.
      IVMODE = 3
      CA = DCOS(DMIN1(HOR + 0.05D0, PI))
      DO 20 K = 1, NCRAT
        IF (CRV(1,K)*CAMF(1) + CRV(2,K)*CAMF(2) + CRV(3,K)*CAMF(3)
     &      .LT. CA * D) GO TO 20
C       Whole-disc view: gazetteer craters of 25 km and up only (our
C       floor, so the disc is not a solid mass), unlabelled.
        IF (MOD(JDRW / 2, 2) .EQ. 1 .AND. CRDIA(K) .LT. 25.0D0)
     &    GO TO 20
        CALL CRATER(VB, NV, CRV(1,K), 0.5D0 * CRDIA(K) / RM, IOK)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (IOK .EQ. 1 .AND. CRDIA(K) .GE. 20.0D0 .AND.
     &      MOD(IFLG, 2) .EQ. 1 .AND. MOD(JDRW / 2, 2) .EQ. 0) THEN
          DO 15 I = 1, 3
            G(I) = RM * CRV(I,K)
   15     CONTINUE
          CALL MXV(MMF, G, Q)
          DO 16 I = 1, 3
            Q(I) = Q(I) + MPOS(I)
   16     CONTINUE
          CALL PROJ(Q, X, Y, IOK)
          CALL LABEL(LB, NL, X, Y, 2, K)
        END IF
C     RESTOMOD END
   20 CONTINUE
C
C     Seeded craters, a FIXED set on the ground (no level of detail
C     by range).  Sources: VIEW had "two-dimensional crater models"
C     built from photographs of the area near Apollo landing site 2
C     (TN D-6853, printed p. 7), and "the smallest craters depicted
C     ... have a size of 1 minute of arc (1658 ft)" (MSC IN
C     69-FM-197, sec. 3.1).  Our model of that, not the original:
C       regional patch, site 2 (see DMOON6) +-5 deg, cells of
C       0.1 deg, craters 1658 ft (0.505 km) to 4 km, where the
C       gazetteer takes over;
C       global fill elsewhere, cells of 0.5 deg, 2.5 to 25 km, so
C       orbital views keep the density the film shows (t04).
C     The IN (sec. 3.6, 3.7) notes few craters near the site, from
C     the flat approach, the oblique look and few large craters;
C     the patch density is set low to match.  Cells are seeded from
C     their indices, so craters stay put from frame to frame.
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (MOD(JDRW / 2, 2) .EQ. 1) THEN
        CALL DMOON6(VB, NV, LB, NL)
      ELSE
        CALL PCRAT(VB, NV, 0.5D0, 1.2D0, 2.5D0, 25.0D0, 1,
     &             -90.0D0, 90.0D0, -180.0D0, 180.0D0, 1)
        CALL PCRAT(VB, NV, 0.1D0, 0.8D0, 0.505D0, 4.0D0, 2,
     &             0.67416D0 - 5.0D0, 0.67416D0 + 5.0D0,
     &             23.47314D0 - 5.0D0, 23.47314D0 + 5.0D0, 0)
      END IF
C     RESTOMOD END
      IVMODE = 0
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (MOD(IFLG, 2) .EQ. 1 .AND. AM .LT. 0.3D0 * FOVH * DR) THEN
        CALL PROJ(MPOS, X, Y, IOK)
        IF (IOK .EQ. 1) THEN
          IF (OCCL(MPOS, EPOS, RE) .LE. 0.0D0)
     &      CALL LABEL(LB, NL, X, Y, 5, 0)
        END IF
      END IF
C     RESTOMOD END
      RETURN
      END
C
C     LLUNIT: selenographic latitude, east longitude (deg) to a unit
C     vector (MF).  SURFPT: unit MF direction to the surface point,
C     camera relative EQ.
      SUBROUTINE LLUNIT(FI, LA, U)
      DOUBLE PRECISION FI, LA, U(3), DR
      DR = 3.141592653589793D0 / 180.0D0
      U(1) = DCOS(FI * DR) * DCOS(LA * DR)
      U(2) = DCOS(FI * DR) * DSIN(LA * DR)
      U(3) = DSIN(FI * DR)
      RETURN
      END
C
      SUBROUTINE SURFPT(CM, P)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION CM(3), P(3), G(3)
      INTEGER I
      DO 10 I = 1, 3
        G(I) = RM * CM(I)
   10 CONTINUE
      CALL MXV(MMF, G, P)
      DO 20 I = 1, 3
        P(I) = P(I) + MPOS(I)
   20 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     CRATER: rim circle of angular radius A (rad) about unit centre
C     CM (MF).  Culled when off frame, beyond the horizon or too small
C     to see.  IOK = 1 if drawn.
C-----------------------------------------------------------------------
      SUBROUTINE CRATER(VB, NV, CM, A, IOK)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), CM(3), A
      INTEGER NV, IOK
      DOUBLE PRECISION D(3), DD, RA, CS, E1(3), E2(3), G(3), P(3)
      DOUBLE PRECISION CA, SA, T, CT, ST, SIZ
      INTEGER I, K, N
      IOK = 0
      DO 10 I = 1, 3
        D(I) = RM * CM(I) - CAMF(I)
   10 CONTINUE
      DD = DSQRT(D(1)*D(1) + D(2)*D(2) + D(3)*D(3))
      RA = RM * A / DD
C     Apparent diameter against the field.  Rims under 1.2 percent
C     of the frame (about 12 points of a 1024-point recorder raster,
C     docs/univac-1108.md) are not drawn: our choice of floor.
      SIZ = 2.0D0 * RA / DR / (2.0D0 * FOVH)
      IF (SIZ .LT. 0.012D0) RETURN
C     Outside the cone through the frame corners (COS(T+RA) is at
C     least COS(T) - RA).
      CS = (D(1)*CBMF(1) + D(2)*CBMF(2) + D(3)*CBMF(3)) / DD
      IF (CS .LT. CSVIEW - RA) RETURN
      N = 10 + INT(SIZ * 60.0D0)
      IF (N .GT. 36) N = 36
      CALL PERP(CM, E1, E2)
      CA = DCOS(A) * RM
      SA = DSIN(A) * RM
      DO 30 K = 0, N
        T = DBLE(K) * 2.0D0 * PI / DBLE(N)
        CT = DCOS(T) * SA
        ST = DSIN(T) * SA
        DO 20 I = 1, 3
          G(I) = CA * CM(I) + CT * E1(I) + ST * E2(I)
   20   CONTINUE
        CALL MXV(MMF, G, P)
        DO 25 I = 1, 3
          P(I) = P(I) + MPOS(I)
   25   CONTINUE
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (K .EQ. 0) THEN
          CALL PEN(VB, NV, P, 0)
        ELSE
          CALL PEN(VB, NV, P, 1)
        END IF
C     RESTOMOD END
   30 CONTINUE
      IOK = 1
      RETURN
      END
C
C-----------------------------------------------------------------------
C     PCRAT: seeded craters on a latitude-longitude grid of GC deg,
C     inside the fixed box F1..F2 lat, L1..L2 east lon (deg); IEXC=1
C     skips cells inside the site 2 patch (drawn by its own level).
C     AVG mean craters per cell, diameters DMIN..DMAX km with a -2
C     power law.  Only cells under a 7 x 7 grid of sight lines across
C     the frame are visited, and only craters on the near side of the
C     horizon are drawn: culling by visibility, not by range.  More
C     than 40000 cells in view is taken as "Moon too small to show
C     seeded craters" (every one would fall under the size floor in
C     CRATER).  Random numbers: Park-Miller minimal standard
C     generator, exact in double precision.
C-----------------------------------------------------------------------
      SUBROUTINE PCRAT(VB, NV, GC, AVG, DMIN, DMAX, LEV,
     &                 F1, F2, L1, L2, IEXC)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), GC, AVG, DMIN, DMAX
      DOUBLE PRECISION F1, F2, L1, L2, P1, CH, DCAM, FC, LC, CFR
      INTEGER NV, LEV, IEXC
      DOUBLE PRECISION U(3), W(3), GP(3), B, C, DS, T, FI, DL, LO0
      DOUBLE PRECISION FMIN, FMAX, LMIN, LMAX, MARG, SEED, RND
      DOUBLE PRECISION CLAT0, CLON0, CF, DIA, CM(3), Q
      INTEGER I, J, K, IA, IB, JA, JB, NLON, JJ, NC, IOK, IFLR
C
C     The size floor of CRATER applied to the largest crater of this
C     level at the nearest ground: if even that is too small, stop.
      DCAM = DSQRT(CAMF(1)**2 + CAMF(2)**2 + CAMF(3)**2)
      IF (DMAX / (DCAM - RM) / DR / (2.0D0 * FOVH) .LT. 0.012D0) RETURN
      LO0 = DATAN2(CAMF(2), CAMF(1)) / DR
      FMIN = 90.0D0
      FMAX = -90.0D0
      LMIN = 180.0D0
      LMAX = -180.0D0
      C = CAMF(1)**2 + CAMF(2)**2 + CAMF(3)**2 - RM * RM
      DO 20 I = 0, 6
        DO 10 J = 0, 6
          CALL UNPROJ(BOXH * DBLE(I - 3) / 3.0D0,
     &                BOXH * DBLE(J - 3) / 3.0D0, 0, W)
          CALL MTXV(MMF, W, U)
          B = U(1) * CAMF(1) + U(2) * CAMF(2) + U(3) * CAMF(3)
          DS = B * B - C
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
          IF (DS .GE. 0.0D0 .AND. -B - DSQRT(DS) .GT. 0.0D0) THEN
            T = -B - DSQRT(DS)
          ELSE
            T = -B
            IF (T .LT. 0.0D0) T = 0.0D0
          END IF
C     RESTOMOD END
          DO 5 K = 1, 3
            GP(K) = CAMF(K) + T * U(K)
    5     CONTINUE
          CALL VUNIT(GP)
          FI = DASIN(GP(3)) / DR
          DL = DATAN2(GP(2), GP(1)) / DR - LO0
          IF (DL .GT. 180.0D0) DL = DL - 360.0D0
          IF (DL .LT. -180.0D0) DL = DL + 360.0D0
          FMIN = DMIN1(FMIN, FI)
          FMAX = DMAX1(FMAX, FI)
          LMIN = DMIN1(LMIN, DL)
          LMAX = DMAX1(LMAX, DL)
   10   CONTINUE
   20 CONTINUE
C     Take in the ground under the camera too, then pad.
      FI = DASIN(CAMF(3) / DSQRT(C + RM * RM)) / DR
      FMIN = DMIN1(FMIN, FI)
      FMAX = DMAX1(FMAX, FI)
      LMIN = DMIN1(LMIN, 0.0D0)
      LMAX = DMAX1(LMAX, 0.0D0)
      MARG = 0.5D0 * DMAX / RM / DR + GC
      FMIN = DMAX1(FMIN - MARG, -89.0D0)
      FMAX = DMIN1(FMAX + MARG, 89.0D0)
      LMIN = LMIN - MARG / DMAX1(DCOS(DMAX1(DABS(FMIN),
     &       DABS(FMAX)) * DR), 0.05D0)
      LMAX = LMAX + MARG /
     &       DMAX1(DCOS(DMAX1(DABS(FMIN), DABS(FMAX)) * DR), 0.05D0)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (LMAX - LMIN .GT. 360.0D0) THEN
        LMIN = -180.0D0
        LMAX = 180.0D0
      END IF
C     RESTOMOD END
C     Clip to the fixed box of this level.
      FMIN = DMAX1(FMIN, F1)
      FMAX = DMIN1(FMAX, F2)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (L2 - L1 .LT. 360.0D0) THEN
        P1 = DMOD(L1 - LO0 + 540.0D0, 360.0D0) - 180.0D0
        LMIN = DMAX1(LMIN, P1)
        LMAX = DMIN1(LMAX, P1 + (L2 - L1))
      END IF
C     RESTOMOD END
      IF (FMIN .GT. FMAX .OR. LMIN .GT. LMAX) RETURN
      DCAM = DSQRT(C + RM * RM)
      CH = RM / DCAM
      IA = IFLR((FMIN + 90.0D0) / GC)
      IB = IFLR((FMAX + 90.0D0) / GC)
      JA = IFLR((LO0 + LMIN + 180.0D0) / GC)
      JB = IFLR((LO0 + LMAX + 180.0D0) / GC)
      IF (DBLE(IB - IA + 1) * DBLE(JB - JA + 1) .GT. 40000.0D0) RETURN
      NLON = NINT(360.0D0 / GC)
      DO 60 I = IA, IB
C       Thin the cells toward the poles, where they shrink in area.
        CFR = DCOS((DBLE(I) + 0.5D0) * GC * DR - 0.5D0 * PI)
        DO 50 J = JA, JB
          JJ = MOD(J, NLON)
          IF (JJ .LT. 0) JJ = JJ + NLON
C         Seed from both cell indices through a nonlinear mix (the
C         fraction of a square), so neighbouring cells do not start the
C         linear generator on a lattice (that showed as crater rows).
          Q = DBLE(I) * 0.6180339887D0 + DBLE(JJ) * 0.7548776662D0
     &      + DBLE(LEV) * 0.5698402910D0
          Q = DMOD(Q * Q * 7919.0D0, 1.0D0)
C     RESTOMOD: seed for the Park-Miller generator (1988)
          SEED = 1.0D0 + DBLE(INT(Q * 2147483645.0D0))
          Q = RND(SEED)
          NC = INT(RND(SEED) * (2.0D0 * AVG + 1.0D0))
          CLAT0 = DBLE(I) * GC - 90.0D0
          CLON0 = DBLE(JJ) * GC - 180.0D0
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
          IF (IEXC .EQ. 1) THEN
            FC = CLAT0 + 0.5D0 * GC - 0.67416D0
            LC = CLON0 + 0.5D0 * GC - 23.47314D0
            IF (DABS(FC) .LT. 5.0D0 .AND. DABS(LC) .LT. 5.0D0) GO TO 50
          END IF
C     RESTOMOD END
          DO 40 K = 1, NC
            FI = (CLAT0 + RND(SEED) * GC) * DR
            DL = (CLON0 + RND(SEED) * GC) * DR
            Q = RND(SEED)
            CF = RND(SEED)
            IF (Q .GT. CFR) GO TO 40
            DIA = DMIN / DSQRT(1.0D0 - CF * (1.0D0 - (DMIN/DMAX)**2))
            CM(1) = DCOS(FI) * DCOS(DL)
            CM(2) = DCOS(FI) * DSIN(DL)
            CM(3) = DSIN(FI)
C           Near side of the horizon only (centre within the cap
C           seen from the camera, padded by the crater's radius).
            IF ((CM(1)*CAMF(1) + CM(2)*CAMF(2) + CM(3)*CAMF(3)) / DCAM
     &          .LT. CH - 0.5D0 * DIA / RM) GO TO 40
            CALL CRATER(VB, NV, CM, 0.5D0 * DIA / RM, IOK)
   40     CONTINUE
   50   CONTINUE
   60 CONTINUE
      RETURN
      END
C
      DOUBLE PRECISION FUNCTION RND(SEED)
      DOUBLE PRECISION SEED
C     RESTOMOD BEGIN: Park-Miller minimal standard generator, 1988
      SEED = DMOD(16807.0D0 * SEED, 2147483647.0D0)
      RND = SEED / 2147483647.0D0
C     RESTOMOD END
      RETURN
      END
C
      INTEGER FUNCTION IFLR(X)
      DOUBLE PRECISION X
      IFLR = INT(X)
      IF (DBLE(IFLR) .GT. X) IFLR = IFLR - 1
      RETURN
      END
