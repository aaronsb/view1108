C=======================================================================
C
C     V I E W - 1 1 0 8          SPACECRAFT MODELS
C
C     Core element.  The wireframe model library
C     (data built once) that the vehicles layer draws.  One
C     relocatable element of the kernel; see vdrive.f for the list.
C
C=======================================================================
C
C=======================================================================
C     SPACECRAFT MODELS.  A library of wireframe models in /CLM/,
C     built once (MLIB).  Each model is data: convex solids (prisms,
C     MKPRS) and free lines (XLINE), in its own body frame, in metres.
C     A free line with IS = 0 is a stand-alone line (legs, rims); with
C     IS > 0 it is a mark on face LXF of solid IS (windows, target),
C     hidden when that face is turned away.  The model table /CMODI/
C     gives each model's range of solids and lines.
C
C     Per frame: MCLEAR, then MPLACE for each model in view (body axes,
C     where a body point sits, camera relative), then MDRALL after the
C     sky and bodies.  Hidden parts: an edge between two faces turned
C     away is hidden; any piece whose sight line passes through a
C     placed solid is hidden (Cyrus-Beck, LMOCC); placed solids also
C     hide stars, Sun, Earth and Moon (ISVIS, DSTARS, DSUN).  Hidden
C     pieces are dropped, as on the film, or drawn dashed (style 2)
C     when IFLG bit 2 is set.  TN D-6853 (printed p. 12): "Hidden-line
C     models of the LM and the S-IVB can be produced".
C
C     To add a model: a builder routine between MODBEG(K) and
C     MODEND(K) in MLIB, a model number in viewcom.inc, and one MPLACE
C     call in the scene's part of SCNMOD.
C=======================================================================
      SUBROUTINE MLIB
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      NSOL = 0
      NXL = 0
      NMOD = 0
C     LM, landing gear deployed (scene 4).
      CALL MODBEG(KLMD)
      CALL LMBODY
      CALL LMGEAR(0)
      CALL MODEND(KLMD)
C     LM, landing gear stowed, with drogue and docking target, in its
C     place on the S-IVB (scene 7).
      CALL MODBEG(KLMS)
      CALL LMBODY
      CALL LMGEAR(1)
      CALL LMDOCK
      CALL MODEND(KLMS)
C     S-IVB with the instrument unit and the stub of the SLA.
      CALL MODBEG(KSIV)
      CALL SIVBMD
      CALL MODEND(KSIV)
      RETURN
      END
C
C     MODBEG, MODEND: open and close model K in the table.
      SUBROUTINE MODBEG(K)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER K
      MDS1(K) = NSOL + 1
      MDX1(K) = NXL + 1
      RETURN
      END
C
      SUBROUTINE MODEND(K)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER K
      MDS2(K) = NSOL
      MDX2(K) = NXL
      IF (K .GT. NMOD) NMOD = K
      RETURN
      END
C
C-----------------------------------------------------------------------
C     LMBODY: the LM's stages, body axes X up, Y right, Z forward, the
C     descent stage base at X = 0.  Solids IS0+1 .. IS0+7; windows and
C     hatch are marks on the cabin front (solid IS0+2, face 10 is its
C     +Z cap).
C-----------------------------------------------------------------------
      SUBROUTINE LMBODY
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION O(3), A1(3), A2(3), AN(3), P(2,8)
      INTEGER IS0, IC
      IS0 = NSOL
      IC = IS0 + 2
C
C     1  descent stage: octagon 4.2 m across, X 0 .. 1.7.
      CALL OCTAG(2.1D0, 2.1D0, 0.9D0, P)
      CALL SETV(O, 0.0D0, 0.0D0, 0.0D0)
      CALL SETV(A1, 0.0D0, 1.0D0, 0.0D0)
      CALL SETV(A2, 0.0D0, 0.0D0, 1.0D0)
      CALL SETV(AN, 1.0D0, 0.0D0, 0.0D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 1.7D0)
C     2  crew cabin, faceted, facing +Z.
      CALL OCTAG(1.25D0, 1.0D0, 0.45D0, P)
      CALL SETV(O, 2.9D0, 0.0D0, -0.2D0)
      CALL SETV(A1, 0.0D0, 1.0D0, 0.0D0)
      CALL SETV(A2, 1.0D0, 0.0D0, 0.0D0)
      CALL SETV(AN, 0.0D0, 0.0D0, 1.0D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 1.35D0)
C     3  midsection behind the cabin.
      CALL OCTAG(1.2D0, 1.05D0, 0.3D0, P)
      CALL SETV(O, 2.95D0, 0.0D0, -1.5D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 1.3D0)
C     4  aft equipment bay.
      CALL OCTAG(1.55D0, 0.5D0, 0.05D0, P)
      CALL SETV(O, 3.1D0, 0.0D0, -2.2D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 0.7D0)
C     5  docking tunnel on top.
      CALL OCTAG(0.5D0, 0.5D0, 0.2D0, P)
      CALL SETV(O, 3.9D0, 0.0D0, -0.6D0)
      CALL SETV(A1, 0.0D0, 1.0D0, 0.0D0)
      CALL SETV(A2, 0.0D0, 0.0D0, 1.0D0)
      CALL SETV(AN, 1.0D0, 0.0D0, 0.0D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 0.45D0)
C     6, 7  propellant tank bulges, left and right.
      CALL OCTAG(0.6D0, 0.6D0, 0.25D0, P)
      CALL SETV(O, 2.55D0, -1.2D0, -0.85D0)
      CALL SETV(A1, 1.0D0, 0.0D0, 0.0D0)
      CALL SETV(A2, 0.0D0, 0.0D0, 1.0D0)
      CALL SETV(AN, 0.0D0, -1.0D0, 0.0D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 0.65D0)
      CALL SETV(O, 2.55D0, 1.2D0, -0.85D0)
      CALL SETV(AN, 0.0D0, 1.0D0, 0.0D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 0.65D0)
C
C     Windows: two triangles on the cabin front.
      CALL XLINE(-1.05D0, 3.55D0, 1.16D0, -0.35D0, 3.65D0, 1.16D0, IC)
      CALL XLINE(-0.35D0, 3.65D0, 1.16D0, -0.55D0, 2.75D0, 1.16D0, IC)
      CALL XLINE(-0.55D0, 2.75D0, 1.16D0, -1.05D0, 3.55D0, 1.16D0, IC)
      CALL XLINE(1.05D0, 3.55D0, 1.16D0, 0.35D0, 3.65D0, 1.16D0, IC)
      CALL XLINE(0.35D0, 3.65D0, 1.16D0, 0.55D0, 2.75D0, 1.16D0, IC)
      CALL XLINE(0.55D0, 2.75D0, 1.16D0, 1.05D0, 3.55D0, 1.16D0, IC)
C     Hatch on the cabin front.
      CALL XLINE(-0.4D0, 2.0D0, 1.16D0, 0.4D0, 2.0D0, 1.16D0, IC)
      CALL XLINE(0.4D0, 2.0D0, 1.16D0, 0.4D0, 2.6D0, 1.16D0, IC)
      CALL XLINE(0.4D0, 2.6D0, 1.16D0, -0.4D0, 2.6D0, 1.16D0, IC)
      CALL XLINE(-0.4D0, 2.6D0, 1.16D0, -0.4D0, 2.0D0, 1.16D0, IC)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     LMGEAR: landing gear as free lines.  ISTOW = 0 deployed: on the
C     diagonals a primary strut, two secondaries and a pad.
C     ISTOW = 1 stowed.  "In a retracted position until after the
C     crew mans the LM, the landing gear struts are explosively
C     extended" (Apollo 11 press kit, NASA release 69-83K, printed
C     p. 103).  How the folded gear lay is our guess: each primary
C     strut runs up from its outrigger to a pad beside the ascent
C     stage, the pad (37 in across, same page) square to the LM X
C     axis; the secondaries are left out.
C-----------------------------------------------------------------------
      SUBROUTINE LMGEAR(ISTOW)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER ISTOW
      DOUBLE PRECISION SX, SZ, R0, R1, X0, X1, Q, C, S, C2, S2
      INTEGER I, K
      IF (ISTOW .EQ. 1) GO TO 30
      DO 20 K = 0, 3
        C = DCOS((45.0D0 + 90.0D0 * DBLE(K)) * DR)
        S = DSIN((45.0D0 + 90.0D0 * DBLE(K)) * DR)
        R0 = 2.33D0
        R1 = 4.3D0
        X0 = 1.5D0
        X1 = -1.0D0
        CALL XLINE(R0 * C, X0, R0 * S, R1 * C, X1, R1 * S, 0)
        Q = 3.5D0
        SX = Q * C
        SZ = Q * S
        CALL XLINE(SX, -0.45D0, SZ, 2.1D0 * DSIGN(1.0D0, C), 0.2D0,
     &             1.2D0 * DSIGN(1.0D0, S), 0)
        CALL XLINE(SX, -0.45D0, SZ, 1.2D0 * DSIGN(1.0D0, C), 0.2D0,
     &             2.1D0 * DSIGN(1.0D0, S), 0)
        DO 10 I = 0, 7
          CALL XLINE(R1 * C + 0.45D0 * DCOS(DBLE(I) * PI / 4.0D0),
     &      X1 - 0.1D0, R1 * S + 0.45D0 * DSIN(DBLE(I) * PI / 4.0D0),
     &      R1 * C + 0.45D0 * DCOS(DBLE(I + 1) * PI / 4.0D0),
     &      X1 - 0.1D0,
     &      R1 * S + 0.45D0 * DSIN(DBLE(I + 1) * PI / 4.0D0), 0)
   10   CONTINUE
   20 CONTINUE
      RETURN
   30 DO 40 K = 0, 3
        C = DCOS((45.0D0 + 90.0D0 * DBLE(K)) * DR)
        S = DSIN((45.0D0 + 90.0D0 * DBLE(K)) * DR)
        CALL XLINE(2.33D0 * C, 1.5D0, 2.33D0 * S,
     &             2.3D0 * C, 2.2D0, 2.3D0 * S, 0)
        DO 35 I = 0, 11
          C2 = DCOS(DBLE(I) * PI / 6.0D0) * 0.47D0
          S2 = DSIN(DBLE(I) * PI / 6.0D0) * 0.47D0
          CALL XLINE(2.3D0 * C + C2, 2.2D0, 2.3D0 * S + S2,
     &      2.3D0 * C + DCOS(DBLE(I + 1) * PI / 6.0D0) * 0.47D0, 2.2D0,
     &      2.3D0 * S + DSIN(DBLE(I + 1) * PI / 6.0D0) * 0.47D0, 0)
   35   CONTINUE
   40 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     LMDOCK: docking drogue and CSM-active docking target, as marks
C     on the LM model LMBODY has just built (tunnel = its solid 5,
C     midsection = its solid 3).
C     Drogue, a cone in the tunnel's +X cap (face 10): "a conical
C     drogue mounted in the LM docking tunnel", which is 32 in across
C     (press kit, printed p. 88 and p. 101).  Depth: ours.
C     Target for the CSM's crewman optical alignment sight (COAS): a
C     disc on the midsection top (face 3) with a cross on a standoff
C     above it, set off from the tunnel axis by as much as the COAS
C     line of sight is from the CSM's docking axis (S7POSE), so it
C     sits on the boresight.  Size, standoff and offset: our guess.
C-----------------------------------------------------------------------
      SUBROUTINE LMDOCK
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION C, S, C2, S2
      INTEGER K, IT, IM
      IT = NSOL - 2
      IM = NSOL - 4
      DO 70 K = 0, 11
        C = DCOS(DBLE(K) * PI / 6.0D0)
        S = DSIN(DBLE(K) * PI / 6.0D0)
        C2 = DCOS(DBLE(K + 1) * PI / 6.0D0)
        S2 = DSIN(DBLE(K + 1) * PI / 6.0D0)
        CALL XLINE(0.4D0 * C, 4.35D0, -0.6D0 + 0.4D0 * S,
     &             0.4D0 * C2, 4.35D0, -0.6D0 + 0.4D0 * S2, IT)
        CALL XLINE(0.06D0 * C, 4.05D0, -0.6D0 + 0.06D0 * S,
     &             0.06D0 * C2, 4.05D0, -0.6D0 + 0.06D0 * S2, IT)
        IF (MOD(K, 3) .EQ. 0) CALL XLINE(0.4D0 * C, 4.35D0,
     &    -0.6D0 + 0.4D0 * S, 0.06D0 * C, 4.05D0, -0.6D0 + 0.06D0 * S,
     &    IT)
   70 CONTINUE
      DO 80 K = 0, 11
        C = 0.18D0 * DCOS(DBLE(K) * PI / 6.0D0)
        S = 0.18D0 * DSIN(DBLE(K) * PI / 6.0D0)
        C2 = 0.18D0 * DCOS(DBLE(K + 1) * PI / 6.0D0)
        S2 = 0.18D0 * DSIN(DBLE(K + 1) * PI / 6.0D0)
        CALL XLINE(-0.72D0 + C, 4.0D0, -0.6D0 + S,
     &             -0.72D0 + C2, 4.0D0, -0.6D0 + S2, IM)
        LXF(NXL) = 3
   80 CONTINUE
      CALL XLINE(-0.82D0, 4.45D0, -0.6D0, -0.62D0, 4.45D0, -0.6D0, 0)
      CALL XLINE(-0.72D0, 4.45D0, -0.7D0, -0.72D0, 4.45D0, -0.5D0, 0)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     SIVBMD: S-IVB with the instrument unit on top, body axes X
C     forward along the stage, origin at the centre of the top of the
C     IU.  One prism of 24 sides: both 21.7 ft across, 58.3 ft and
C     3 ft high (Apollo 11 press kit, printed p. 109).
C     The SLA's fixed lower ring, left on the IU when the four upper
C     panels were jettisoned at separation (AS-506 launch vehicle
C     flight evaluation report, MPR-SAT-FE-69-9, p. xxiii; Apollo 11
C     Flight Journal, 003:18:19).  The SLA "is a truncated cone 28
C     feet long tapering from 260 inches diameter at the base to 154
C     inches at the forward end" (press kit, printed p. 88).  The
C     fixed panels are 7 ft high (secondary source: Wikipedia, "Apollo
C     (spacecraft)"), so the ring's top is 233.5 in across.  The
C     jettisoned panels are not drawn; by the approach they had drifted
C     off (our choice).  Rim and four panel joints, the joints on the
C     Y and Z axes (our guess).
C-----------------------------------------------------------------------
      SUBROUTINE SIVBMD
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION O(3), A1(3), A2(3), AN(3), P24(2,24)
      DOUBLE PRECISION RIU, XSL, RSL, Q, C, S, C2, S2
      INTEGER K
      RIU = 0.5D0 * 260.0D0 * 0.0254D0
      DO 50 K = 1, 24
        P24(1,K) = RIU * DCOS(DBLE(K) * PI / 12.0D0)
        P24(2,K) = RIU * DSIN(DBLE(K) * PI / 12.0D0)
   50 CONTINUE
      Q = (58.3D0 + 3.0D0) * 0.3048D0
      CALL SETV(O, -Q, 0.0D0, 0.0D0)
      CALL SETV(A1, 0.0D0, 1.0D0, 0.0D0)
      CALL SETV(A2, 0.0D0, 0.0D0, 1.0D0)
      CALL SETV(AN, 1.0D0, 0.0D0, 0.0D0)
      CALL MKPRS(24, P24, O, A1, A2, AN, Q)
      XSL = 7.0D0 * 0.3048D0
      RSL = 0.5D0 * (260.0D0 - 106.0D0 * 7.0D0 / 28.0D0) * 0.0254D0
      DO 60 K = 0, 23
        C = DCOS(DBLE(K) * PI / 12.0D0)
        S = DSIN(DBLE(K) * PI / 12.0D0)
        C2 = DCOS(DBLE(K + 1) * PI / 12.0D0)
        S2 = DSIN(DBLE(K + 1) * PI / 12.0D0)
        CALL XLINE(RSL * C, XSL, RSL * S, RSL * C2, XSL, RSL * S2, 0)
        IF (MOD(K, 6) .EQ. 0) CALL XLINE(0.99D0 * RIU * C, 0.01D0,
     &    0.99D0 * RIU * S, RSL * C, XSL, RSL * S, 0)
   60 CONTINUE
      RETURN
      END
C
C     XLINE: free line (IS=0) or mark on face LXF (10 unless set
C     after the call: the cap of an 8-sided prism) of solid IS, given
C     as Y, X, Z in the model's body metres.
      SUBROUTINE XLINE(Y1, X1, Z1, Y2, X2, Z2, IS)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION Y1, X1, Z1, Y2, X2, Z2
      INTEGER IS
      IF (NXL .GE. MXL) RETURN
      NXL = NXL + 1
      LXL(1,NXL) = X1
      LXL(2,NXL) = Y1
      LXL(3,NXL) = Z1
      LXL(4,NXL) = X2
      LXL(5,NXL) = Y2
      LXL(6,NXL) = Z2
      LXS(NXL) = IS
      LXF(NXL) = 10
      RETURN
      END
C
C     OCTAG: chamfered rectangle, half sizes A by B, chamfer C, as 8
C     points counter-clockwise (duplicates when C = 0 are harmless).
      SUBROUTINE OCTAG(A, B, C, P)
      DOUBLE PRECISION A, B, C, P(2,8)
      P(1,1) = A
      P(2,1) = -B + C
      P(1,2) = A
      P(2,2) = B - C
      P(1,3) = A - C
      P(2,3) = B
      P(1,4) = -A + C
      P(2,4) = B
      P(1,5) = -A
      P(2,5) = B - C
      P(1,6) = -A
      P(2,6) = -B + C
      P(1,7) = -A + C
      P(2,7) = -B
      P(1,8) = A - C
      P(2,8) = -B
      RETURN
      END
C
C     MKPRS: prism over polygon P (NP points in axes A1, A2 about O),
C     extruded H along AN.  Faces 1..NP sides, NP+1 base, NP+2 cap.
      SUBROUTINE MKPRS(NP, P, O, A1, A2, AN, H)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER NP
      DOUBLE PRECISION P(2,NP), O(3), A1(3), A2(3), AN(3), H
      DOUBLE PRECISION CEN(3), E1(3), E2(3), N(3), D, VDOT
      INTEGER I, K, K2, IS, IA, IB, IC, NE
      NSOL = NSOL + 1
      IS = NSOL
      NLV(IS) = 2 * NP
      NLF(IS) = NP + 2
      DO 20 K = 1, NP
        DO 10 I = 1, 3
          LMV(I,K,IS) = O(I) + P(1,K) * A1(I) + P(2,K) * A2(I)
          LMV(I,K+NP,IS) = LMV(I,K,IS) + H * AN(I)
   10   CONTINUE
   20 CONTINUE
      DO 25 I = 1, 3
        CEN(I) = O(I) + 0.5D0 * H * AN(I)
   25 CONTINUE
C     Face planes, oriented away from the centre.
      DO 40 K = 1, NP + 2
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (K .LE. NP) THEN
          K2 = MOD(K, NP) + 1
          IA = K
          IB = K2
          IC = K + NP
        ELSE IF (K .EQ. NP + 1) THEN
          IA = 1
          IB = 3
          IC = 6
        ELSE
          IA = 1 + NP
          IB = 3 + NP
          IC = 6 + NP
        END IF
C     RESTOMOD END
        DO 30 I = 1, 3
          E1(I) = LMV(I,IB,IS) - LMV(I,IA,IS)
          E2(I) = LMV(I,IC,IS) - LMV(I,IA,IS)
   30   CONTINUE
        CALL VCRS(E1, E2, N)
        CALL VUNIT(N)
        D = VDOT(N, LMV(1,IA,IS))
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (D - VDOT(N, CEN) .LT. 0.0D0) THEN
          DO 35 I = 1, 3
            N(I) = -N(I)
   35     CONTINUE
          D = -D
        END IF
C     RESTOMOD END
        DO 38 I = 1, 3
          LMN(I,K,IS) = N(I)
   38   CONTINUE
        LMD(K,IS) = D
   40 CONTINUE
C     Edges: base, top, uprights.
      NE = 0
      DO 50 K = 1, NP
        K2 = MOD(K, NP) + 1
        NE = NE + 1
        LME(1,NE,IS) = K
        LME(2,NE,IS) = K2
        LME(3,NE,IS) = K
        LME(4,NE,IS) = NP + 1
        NE = NE + 1
        LME(1,NE,IS) = K + NP
        LME(2,NE,IS) = K2 + NP
        LME(3,NE,IS) = K
        LME(4,NE,IS) = NP + 2
        NE = NE + 1
        LME(1,NE,IS) = K
        LME(2,NE,IS) = K + NP
        LME(3,NE,IS) = K
        LME(4,NE,IS) = MOD(K + NP - 2, NP) + 1
   50 CONTINUE
      NLE(IS) = NE
      RETURN
      END
