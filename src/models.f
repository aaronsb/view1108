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
C     CSM, an outline (MDHL = 0).
      CALL MODBEG(KCSM)
      CALL CSMBLD
      CALL MODEND(KCSM)
      MDHL(KCSM) = 0
C     CM cabin: the commander's window outlines about the design eye,
C     an outline (station view only).
      CALL MODBEG(KCMC)
      CALL CMCAB
      CALL MODEND(KCMC)
      MDHL(KCMC) = 0
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
      MDHL(K) = 1
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
C     descent stage base at X = 0.  Solids IS0+1 .. IS0+8; the hatch
C     is a mark on the lower cabin's front (solid IS0+2, face 10, its
C     +Z cap), the windows on the upper cabin's (IS0+8, face 8).
C     The ascent stage is placed by Grumman's LM inch stations (Lunar
C     Module Structures ... Study Guide, course 30915, 2-15-67, "SG"):
C     "a design reference point given as the X 200.00 inch station"
C     (SG p. 5), drawn at the top of the descent stage (SG Fig. 3, p.
C     4), is our 1.7 m, so X = 1.7 + 0.0254 (XSTA - 200) m; Y and Z
C     stations are Y and Z, 0 on the thrust axis, "+Z being forward"
C     (SG p. 5).  "The aft bulkhead/frame of the crew
C     compartment, which mates with the midsection, is designated as
C     station +Z27.000.  The front face assembly is mounted ... at an
C     angle; the lower end at station +Z64.557 angling to ... 86.180
C     at the top" (SG p. 10); midsection decks at "+X294.643 and
C     +X233,500" (same page); the cabin "cylindrical (92 inches in
C     diameter and 42 inches deep)" (Grumman, Apollo News Reference:
C     Lunar Module, 1969, "LMNR", p. LV-3).  Ours: the cabin's axis
C     at X 3.0 m (from SG Fig. 13), the front's knee at X 3.021, the
C     octagons and the outside of the midsection and aft bay.
C-----------------------------------------------------------------------
      SUBROUTINE LMBODY
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION O(3), A1(3), A2(3), AN(3), P(2,8), W(2,3)
      DOUBLE PRECISION Q(2,6), C(2), F, ZF, LMWIN
      INTEGER IS0, IC, IU, K, J
      DATA Q / 1.168D0, 0.0D0, 1.168D0, 0.463D0, 0.484D0, 1.147D0,
     &  -0.484D0, 1.147D0, -1.168D0, 0.463D0, -1.168D0, 0.0D0 /
      IS0 = NSOL
      IC = IS0 + 2
      IU = IS0 + 8
C
C     1  descent stage: octagon 4.2 m across, X 0 .. 1.7.
      CALL OCTAG(2.1D0, 2.1D0, 0.9D0, P)
      CALL SETV(O, 0.0D0, 0.0D0, 0.0D0)
      CALL SETV(A1, 0.0D0, 1.0D0, 0.0D0)
      CALL SETV(A2, 0.0D0, 0.0D0, 1.0D0)
      CALL SETV(AN, 1.0D0, 0.0D0, 0.0D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 1.7D0)
C     2  crew cabin, an octagon about the 92 in cylinder, from the aft
C        bulkhead (Z27) to the lower front face (Z64.557).
      CALL OCTAG(1.168D0, 1.168D0, 0.684D0, P)
      CALL SETV(O, 3.0D0, 0.0D0, 0.686D0)
      CALL SETV(A1, 0.0D0, 1.0D0, 0.0D0)
      CALL SETV(A2, 1.0D0, 0.0D0, 0.0D0)
      CALL SETV(AN, 0.0D0, 0.0D0, 1.0D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 0.954D0)
C     3  midsection, Z27 aft to Z27 forward, its top the upper deck
C        (X294.643).
      CALL OCTAG(1.2D0, 1.102D0, 0.3D0, P)
      CALL SETV(O, 3.002D0, 0.0D0, -0.686D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 1.372D0)
C     4  aft equipment bay, behind the aft bulkhead to Z-65.515 (SG
C        Fig. 10, "-Z65.515 (REF)").
      CALL OCTAG(1.55D0, 0.5D0, 0.05D0, P)
      CALL SETV(O, 3.1D0, 0.0D0, -1.664D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 0.978D0)
C     5  docking tunnel on the thrust axis, "32 inches in diameter and
C        16 inches long" (LMNR p. LV-6) above the upper deck; its base
C        sunk 0.1 m into the midsection.
      CALL OCTAG(0.406D0, 0.406D0, 0.168D0, P)
      CALL SETV(O, 4.0D0, 0.0D0, 0.0D0)
      CALL SETV(A1, 0.0D0, 1.0D0, 0.0D0)
      CALL SETV(A2, 0.0D0, 0.0D0, 1.0D0)
      CALL SETV(AN, 1.0D0, 0.0D0, 0.0D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 0.51D0)
C     6, 7  propellant tank bulges, left and right.
      CALL OCTAG(0.6D0, 0.6D0, 0.25D0, P)
      CALL SETV(O, 2.55D0, -1.2D0, 0.0D0)
      CALL SETV(A1, 1.0D0, 0.0D0, 0.0D0)
      CALL SETV(A2, 0.0D0, 0.0D0, 1.0D0)
      CALL SETV(AN, 0.0D0, -1.0D0, 0.0D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 0.65D0)
      CALL SETV(O, 2.55D0, 1.2D0, 0.0D0)
      CALL SETV(AN, 0.0D0, 1.0D0, 0.0D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 0.65D0)
C     8  the cabin's upper front, above the knee, out to the slanted
C        face (Z64.557 at the knee to Z86.180 at the top); its base
C        inside solid 2.
      CALL SETV(O, 3.021D0, 0.0D0, 1.2D0)
      CALL SETV(A1, 0.0D0, 1.0D0, 0.0D0)
      CALL SETV(A2, 1.0D0, 0.0D0, 0.0D0)
      CALL SETV(AN, 0.0D0, 0.0D0, 1.0D0)
      CALL MKWDG(6, Q, O, A1, A2, AN, 0.44D0, 0.4784D0)
C
C     Windows: two triangles on the upper front, "approximately 2
C     square feet of viewing area" each (LMNR p. LV-4): the window
C     frames (LMWIN) grown to that area about their centre and carried
C     forward onto the face (ours).
      DO 20 J = -1, 1, 2
        DO 10 K = 1, 3
          W(1,K) = DBLE(J) * LMWIN(2,K)
          W(2,K) = LMWIN(1,K)
   10   CONTINUE
        C(1) = (W(1,1) + W(1,2) + W(1,3)) / 3.0D0
        C(2) = (W(2,1) + W(2,2) + W(2,3)) / 3.0D0
        F = 1.265D0
        DO 15 K = 1, 3
          W(1,K) = C(1) + F * (W(1,K) - C(1))
          W(2,K) = C(2) + F * (W(2,K) - C(2))
   15   CONTINUE
        DO 18 K = 1, 3
          CALL XLINE(W(1,K), W(2,K), ZF(W(2,K)),
     &      W(1,MOD(K,3)+1), W(2,MOD(K,3)+1), ZF(W(2,MOD(K,3)+1)), IU)
          LXF(NXL) = 8
   18   CONTINUE
   20 CONTINUE
C     Hatch on the lower front, "approximately 32 inches square"
C     (LMNR p. LV-4), its sill at the cabin floor (ours).
      CALL XLINE(-0.406D0, 2.094D0, 1.64D0, 0.406D0, 2.094D0, 1.64D0,
     &  IC)
      CALL XLINE(0.406D0, 2.094D0, 1.64D0, 0.406D0, 2.906D0, 1.64D0,
     &  IC)
      CALL XLINE(0.406D0, 2.906D0, 1.64D0, -0.406D0, 2.906D0, 1.64D0,
     &  IC)
      CALL XLINE(-0.406D0, 2.906D0, 1.64D0, -0.406D0, 2.094D0, 1.64D0,
     &  IC)
      RETURN
      END
C
C     ZF: Z of the LM's front face at height X (m): Z64.557 up to the
C     knee at X 3.021 (ours), then slanting to Z86.180 at the cabin's
C     top (SG p. 10).
      DOUBLE PRECISION FUNCTION ZF(X)
      DOUBLE PRECISION X
      ZF = 1.64D0
      IF (X .GT. 3.021D0) ZF = 1.64D0 + 0.4784D0 * (X - 3.021D0)
      RETURN
      END
C
C     LMWIN: corner K (1 inboard top, 2 bottom, 3 outboard) of the
C     commander's window frame, coordinate I (X, Y, Z) in LM body
C     metres; the LM pilot's is its mirror in Y.  Rays from the design
C     eye (LDEYE) along the corners of SG Fig. 25 (p. 35, "visual
C     elevation" +10 to -65 deg, heading 12 deg inboard to about 80
C     outboard), ended where they meet the window's outline on SG Fig.
C     7 (p. 11; corners read by eye): our construction.
      DOUBLE PRECISION FUNCTION LMWIN(I, K)
      INTEGER I, K
      DOUBLE PRECISION W(3,3)
      DATA W / 3.778D0, -0.483D0, 1.730D0, 3.249D0, -0.533D0, 1.585D0,
     &  3.727D0, -0.813D0, 1.425D0 /
      LMWIN = W(I,K)
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
C     midsection = its solid 3, of 8).
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
      IT = NSOL - 3
      IM = NSOL - 5
      DO 70 K = 0, 11
        C = DCOS(DBLE(K) * PI / 6.0D0)
        S = DSIN(DBLE(K) * PI / 6.0D0)
        C2 = DCOS(DBLE(K + 1) * PI / 6.0D0)
        S2 = DSIN(DBLE(K + 1) * PI / 6.0D0)
        CALL XLINE(0.4D0 * C, 4.51D0, 0.4D0 * S,
     &             0.4D0 * C2, 4.51D0, 0.4D0 * S2, IT)
        CALL XLINE(0.06D0 * C, 4.21D0, 0.06D0 * S,
     &             0.06D0 * C2, 4.21D0, 0.06D0 * S2, IT)
        IF (MOD(K, 3) .EQ. 0) CALL XLINE(0.4D0 * C, 4.51D0,
     &    0.4D0 * S, 0.06D0 * C, 4.21D0, 0.06D0 * S, IT)
   70 CONTINUE
      DO 80 K = 0, 11
        C = 0.18D0 * DCOS(DBLE(K) * PI / 6.0D0)
        S = 0.18D0 * DSIN(DBLE(K) * PI / 6.0D0)
        C2 = 0.18D0 * DCOS(DBLE(K + 1) * PI / 6.0D0)
        S2 = 0.18D0 * DSIN(DBLE(K + 1) * PI / 6.0D0)
        CALL XLINE(-0.72D0 + C, 4.104D0, S,
     &             -0.72D0 + C2, 4.104D0, S2, IM)
        LXF(NXL) = 3
   80 CONTINUE
      CALL XLINE(-0.82D0, 4.554D0, 0.0D0, -0.62D0, 4.554D0, 0.0D0, 0)
      CALL XLINE(-0.72D0, 4.554D0, -0.1D0, -0.72D0, 4.554D0, 0.1D0, 0)
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
C
C-----------------------------------------------------------------------
C     MKFRU: frustum over polygon P (NP points in axes A1, A2 about O),
C     reaching H along AN with the top polygon scaled by SC; faces and
C     edges numbered as MKPRS's (1..NP sides, NP+1 base, NP+2 top).
C-----------------------------------------------------------------------
      SUBROUTINE MKFRU(NP, P, O, A1, A2, AN, H, SC)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER NP
      DOUBLE PRECISION P(2,NP), O(3), A1(3), A2(3), AN(3), H, SC
      DOUBLE PRECISION CEN(3), E1(3), E2(3), N(3), D, VDOT
      INTEGER I, K, K2, IS, IA, IB, IC, NE
      NSOL = NSOL + 1
      IS = NSOL
      NLV(IS) = 2 * NP
      NLF(IS) = NP + 2
      DO 20 K = 1, NP
        DO 10 I = 1, 3
          LMV(I,K,IS) = O(I) + P(1,K) * A1(I) + P(2,K) * A2(I)
          LMV(I,K+NP,IS) = O(I) + H * AN(I)
     &      + SC * (P(1,K) * A1(I) + P(2,K) * A2(I))
   10   CONTINUE
   20 CONTINUE
      DO 25 I = 1, 3
        CEN(I) = O(I) + 0.5D0 * H * AN(I)
   25 CONTINUE
      DO 40 K = 1, NP + 2
        K2 = MOD(K, NP) + 1
        IA = K
        IB = K2
        IC = K + NP
        IF (K .EQ. NP + 1) IA = 1
        IF (K .EQ. NP + 1) IB = 3
        IF (K .EQ. NP + 1) IC = 6
        IF (K .EQ. NP + 2) IA = 1 + NP
        IF (K .EQ. NP + 2) IB = 3 + NP
        IF (K .EQ. NP + 2) IC = 6 + NP
        DO 30 I = 1, 3
          E1(I) = LMV(I,IB,IS) - LMV(I,IA,IS)
          E2(I) = LMV(I,IC,IS) - LMV(I,IA,IS)
   30   CONTINUE
        CALL VCRS(E1, E2, N)
        CALL VUNIT(N)
        D = VDOT(N, LMV(1,IA,IS))
        IF (D - VDOT(N, CEN) .GE. 0.0D0) GO TO 36
        DO 35 I = 1, 3
          N(I) = -N(I)
   35   CONTINUE
        D = -D
   36   DO 38 I = 1, 3
          LMN(I,K,IS) = N(I)
   38   CONTINUE
        LMD(K,IS) = D
   40 CONTINUE
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
C
C     MKWDG: a prism as MKPRS's, its cap tilted: top point K lies H +
C     G P(2,K) along AN.  The cap stays a plane, so the solid stays
C     convex; the sides keep their planes.
      SUBROUTINE MKWDG(NP, P, O, A1, A2, AN, H, G)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER NP
      DOUBLE PRECISION P(2,NP), O(3), A1(3), A2(3), AN(3), H, G
      DOUBLE PRECISION E1(3), E2(3), N(3), VDOT
      INTEGER I, K, IS
      CALL MKPRS(NP, P, O, A1, A2, AN, H)
      IS = NSOL
      DO 20 K = 1, NP
        DO 10 I = 1, 3
          LMV(I,K+NP,IS) = LMV(I,K+NP,IS) + G * P(2,K) * AN(I)
   10   CONTINUE
   20 CONTINUE
C     The cap's plane again, facing along AN.
      DO 30 I = 1, 3
        E1(I) = LMV(I,3+NP,IS) - LMV(I,1+NP,IS)
        E2(I) = LMV(I,6+NP,IS) - LMV(I,1+NP,IS)
   30 CONTINUE
      CALL VCRS(E1, E2, N)
      CALL VUNIT(N)
      IF (VDOT(N, AN) .GE. 0.0D0) GO TO 36
      DO 35 I = 1, 3
        N(I) = -N(I)
   35 CONTINUE
   36 DO 38 I = 1, 3
        LMN(I,NP+2,IS) = N(I)
   38 CONTINUE
      LMD(NP+2,IS) = VDOT(N, LMV(1,1+NP,IS))
      RETURN
      END
C
C-----------------------------------------------------------------------
C     CSMBLD: the command and service module.  Body axes X along the
C     stack toward the CM apex, Y and Z across (Apollo CSM convention:
C     the RCS quads sit near +-Y and +-Z, below); origin at the centre
C     of the CM's base, metres.  Sources (CSM News Reference, North
C     American Rockwell 1969, "NR"; Apollo Operations Handbook SM2A-
C     03-Block II-(1), 1969, "AOH"; Apollo 11 press kit, "PK"), where
C     they disagree the one used is named:
C       CM: "Height 10ft 7 in.", "Diameter 12ft 10in." (NR p. 39; PK
C         p. 87 has 11 ft 5 in high, AOH p. 1-4 11 ft 1.5 in).  The
C         cone's shape is ours: a 16-sided frustum to 0.55 m radius at
C         2.25 m (about 32 deg half-angle), then a tunnel 0.45 m in
C         radius to the 10 ft 7 in height (tunnel size ours).
C       Fairing: "22 inches high" (NR p. 54; AOH p. 1-50 has 26 in),
C         drawn as a short cylinder of the SM's diameter.
C       SM: the cylinder "12 feet 11 inches long (high) and 12 feet 10
C         inches in diameter" (AOH p. 1-50).
C       SPS nozzle: an extension "protruding more than 9 feet below
C         the aft bulkhead" (NR p. 58); we take 9 ft 8 in, the NR p. 3
C         "22ft,7 in. excluding fairing" less the AOH's 12 ft 11 in
C         (ours), and "an exit diameter of 7 feet 10-1/2 inches" (NR
C         p. 162); the throat end (0.5 m radius) is ours.
C       RCS quads: "four clusters of 90 degrees apart around the upper
C         portion" (NR p. 58), "offset about 7 degrees from the Y and Z
C         axes" (NR p. 148); each "eight feet long and nearly three feet
C         wide" (NR p. 59), 0.3 m proud of the skin and centred 1.5 m
C         below the SM's top (ours).
C       High-gain antenna: on the aft bulkhead; "four 31-inch diameter
C         parabolas" (NR p. 177); the boom "swings out at right angles
C         to the spacecraft longitudinal axis, with the boom pointing 52
C         degrees below the heads-up horizontal" (PK p. 90).  Our
C         reading: the boom leaves the SM's aft edge in the Y-Z plane,
C         52 deg from +Y toward -Z; its length (2.4 m) and the dishes'
C         arrangement (2 by 2, square to the boom) are ours.
C-----------------------------------------------------------------------
      SUBROUTINE CSMBLD
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION O(3), A1(3), A2(3), AN(3), P(2,24), Q(2,8)
      DOUBLE PRECISION FT, RB, XF, XS, HS, XN, RN, C, S, C2, S2
      DOUBLE PRECISION BR(3), BD(3), BU(3), T(3), CX, CY, HA, R
      INTEGER K, J, I
      FT = 0.3048D0
      RB = 0.5D0 * (12.0D0 + 10.0D0 / 12.0D0) * FT
      DO 10 K = 1, 16
        P(1,K) = RB * DCOS(DBLE(K) * PI / 8.0D0)
        P(2,K) = RB * DSIN(DBLE(K) * PI / 8.0D0)
   10 CONTINUE
      CALL SETV(A1, 0.0D0, 1.0D0, 0.0D0)
      CALL SETV(A2, 0.0D0, 0.0D0, 1.0D0)
      CALL SETV(AN, 1.0D0, 0.0D0, 0.0D0)
C     CM cone and tunnel.
      CALL SETV(O, 0.0D0, 0.0D0, 0.0D0)
      CALL MKFRU(16, P, O, A1, A2, AN, 2.25D0, 0.55D0 / RB)
      DO 12 K = 1, 16
        P(1,K) = 0.45D0 * DCOS(DBLE(K) * PI / 8.0D0)
        P(2,K) = 0.45D0 * DSIN(DBLE(K) * PI / 8.0D0)
   12 CONTINUE
      CALL SETV(O, 2.25D0, 0.0D0, 0.0D0)
      CALL MKPRS(16, P, O, A1, A2, AN,
     &           (10.0D0 + 7.0D0 / 12.0D0) * FT - 2.25D0)
C     SM and fairing, one cylinder of the SM's diameter up to the CM.
      XF = 22.0D0 / 12.0D0 * FT
      HS = (12.0D0 + 11.0D0 / 12.0D0) * FT
      XS = -XF - HS
      DO 14 K = 1, 16
        P(1,K) = RB * DCOS(DBLE(K) * PI / 8.0D0)
        P(2,K) = RB * DSIN(DBLE(K) * PI / 8.0D0)
   14 CONTINUE
      CALL SETV(O, XS, 0.0D0, 0.0D0)
      CALL MKPRS(16, P, O, A1, A2, AN, HS + XF)
C     The fairing's joint to the SM, a ring of free lines.
      DO 16 K = 1, 16
        CALL XLINE(P(1,K), -XF, P(2,K), P(1,MOD(K,16)+1), -XF,
     &             P(2,MOD(K,16)+1), 0)
   16 CONTINUE
C     SPS nozzle extension, from its throat end at the aft bulkhead.
      XN = (9.0D0 + 8.0D0 / 12.0D0) * FT
      RN = 0.5D0 * (7.0D0 + 10.5D0 / 12.0D0) * FT
      DO 18 K = 1, 16
        P(1,K) = 0.5D0 * DCOS(DBLE(K) * PI / 8.0D0)
        P(2,K) = 0.5D0 * DSIN(DBLE(K) * PI / 8.0D0)
   18 CONTINUE
      CALL SETV(O, XS, 0.0D0, 0.0D0)
      CALL SETV(AN, -1.0D0, 0.0D0, 0.0D0)
      CALL MKFRU(16, P, O, A1, A2, AN, XN, RN / 0.5D0)
      CALL SETV(AN, 1.0D0, 0.0D0, 0.0D0)
C     RCS quad housings.
      DO 30 J = 0, 3
        C = DCOS((7.0D0 + 90.0D0 * DBLE(J)) * DR)
        S = DSIN((7.0D0 + 90.0D0 * DBLE(J)) * DR)
        CALL SETV(BR, 0.0D0, C, S)
        CALL SETV(T, 0.0D0, -S, C)
        CALL OCTAG(0.5D0 * 3.0D0 * FT, 0.15D0, 0.0D0, Q)
        CALL SETV(O, -XF - 1.5D0 - 0.5D0 * 8.0D0 * FT,
     &            (RB + 0.15D0) * C, (RB + 0.15D0) * S)
        CALL MKPRS(8, Q, O, T, BR, AN, 8.0D0 * FT)
   30 CONTINUE
C     High-gain antenna: boom and four dishes.
      C = DCOS(-52.0D0 * DR)
      S = DSIN(-52.0D0 * DR)
      CALL SETV(BD, 0.0D0, C, S)
      CALL SETV(BU, 1.0D0, 0.0D0, 0.0D0)
      CALL VCRS(BD, BU, T)
      CALL XLINE(RB * C, XS, RB * S, (RB + 2.4D0) * C, XS,
     &           (RB + 2.4D0) * S, 0)
      HA = 0.5D0 * 31.0D0 * 0.0254D0
      DO 50 I = 0, 3
        CX = (DBLE(MOD(I, 2)) - 0.5D0) * 2.0D0 * HA
        CY = (DBLE(I / 2) - 0.5D0) * 2.0D0 * HA
        DO 40 K = 0, 11
          C2 = DCOS(DBLE(K) * PI / 6.0D0) * HA
          S2 = DSIN(DBLE(K) * PI / 6.0D0) * HA
          R = RB + 2.4D0
          CALL XLINE(R * C + (CX + C2) * T(2) + (CY + S2) * BU(2),
     &      XS + (CX + C2) * T(1) + (CY + S2) * BU(1),
     &      R * S + (CX + C2) * T(3) + (CY + S2) * BU(3),
     &      R * C + (CX + DCOS(DBLE(K + 1) * PI / 6.0D0) * HA) * T(2)
     &        + (CY + DSIN(DBLE(K + 1) * PI / 6.0D0) * HA) * BU(2),
     &      XS + (CX + DCOS(DBLE(K + 1) * PI / 6.0D0) * HA) * T(1)
     &        + (CY + DSIN(DBLE(K + 1) * PI / 6.0D0) * HA) * BU(1),
     &      R * S + (CX + DCOS(DBLE(K + 1) * PI / 6.0D0) * HA) * T(3)
     &        + (CY + DSIN(DBLE(K + 1) * PI / 6.0D0) * HA) * BU(3), 0)
   40   CONTINUE
   50 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     CMCAB: the CM cabin as the station view shows it: the left
C     rendezvous window's outlines as VIEW drew them, in CSM body
C     metres about the eye point CMEYE.  MSC IN 69-FM-197, figure 9.0-3
C     (PDF p. 263): "View as seen along CM X-axis during the PTC
C     attitudes (X-axis in center of view)", gimbal angles 90, 0, 0,
C     and "The CM left rendezvous window outline is shown for a zero
C     roll attitude" (p. 17).  The report draws two outlines; we read
C     both off the plot by eye (to about 1 deg), in its plot degrees,
C     where a point at plot radius R lies ATAN(R in radians) off the
C     centre (as OVLPD).  Our reading of the plot's axes: right is the
C     CM's +Y, up its -Z (the rendezvous windows are on the -Z half,
C     TN D-7439 p. 3), which puts the left window up and to the left.
C     The x at the centre marks the CM X-axis, as in the report's CSM
C     maneuver views ("the x also denotes the projection of the CM X-
C     axis", MSC IN 69-FM-197 PDF p. 24, where "The CM left rendezvous
C     window has been superimposed on these views").  The eye point is
C     ours; the lines
C     sit 0.5 m from it, so they are seen exactly along the outlines.
C     Other windows: no outline we can read, so none drawn.
C-----------------------------------------------------------------------
      SUBROUTINE CMCAB
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION WA(2,15), WB(2,13), E(3), A(3), B(3)
      INTEGER K
      DATA WA / -20.9D0, 11.5D0, -18.9D0, 16.9D0, -16.7D0, 22.6D0,
     &  -13.5D0, 28.4D0, -10.7D0, 33.4D0, -6.6D0, 38.6D0,
     &  -2.5D0, 38.8D0, -0.4D0, 34.5D0, 1.0D0, 30.5D0,
     &  2.5D0, 25.5D0, 3.2D0, 20.5D0, -14.6D0, 4.3D0,
     &  -18.7D0, 8.3D0, -20.9D0, 10.4D0, -20.9D0, 11.5D0 /
      DATA WB / -13.8D0, 10.4D0, -11.1D0, 16.9D0, -8.6D0, 21.9D0,
     &  -5.4D0, 26.9D0, -1.4D0, 32.7D0, 3.5D0, 38.4D0,
     &  7.5D0, 38.8D0, 8.0D0, 34.5D0, 9.0D0, 34.2D0,
     &  9.6D0, 29.1D0, 11.7D0, 19.0D0, -7.1D0, 4.3D0,
     &  -13.8D0, 10.4D0 /
      CALL CMEYE(E)
      DO 10 K = 1, 14
        CALL CMDIR(E, WA(1,K), WA(2,K), A)
        CALL CMDIR(E, WA(1,K+1), WA(2,K+1), B)
        CALL XLINE(A(2), A(1), A(3), B(2), B(1), B(3), 0)
   10 CONTINUE
      DO 20 K = 1, 12
        CALL CMDIR(E, WB(1,K), WB(2,K), A)
        CALL CMDIR(E, WB(1,K+1), WB(2,K+1), B)
        CALL XLINE(A(2), A(1), A(3), B(2), B(1), B(3), 0)
   20 CONTINUE
      CALL CMDIR(E, -0.7D0, -0.7D0, A)
      CALL CMDIR(E, 0.7D0, 0.7D0, B)
      CALL XLINE(A(2), A(1), A(3), B(2), B(1), B(3), 0)
      CALL CMDIR(E, -0.7D0, 0.7D0, A)
      CALL CMDIR(E, 0.7D0, -0.7D0, B)
      CALL XLINE(A(2), A(1), A(3), B(2), B(1), B(3), 0)
      RETURN
      END
C
C     CMEYE: the CM eye point, CSM body metres: 1.2 m above the CM's
C     base, 0.5 m to -Y, 0.3 m to -Z (ours: no design-eye position
C     found in our sources).
      SUBROUTINE CMEYE(E)
      DOUBLE PRECISION E(3)
      E(1) = 1.2D0
      E(2) = -0.5D0
      E(3) = -0.3D0
      RETURN
      END
C
C     LDEYE: the LM eye point, LM body metres: "CMDR'S DESIGN EYE
C     X=279.25, Y=22, Z=54" (SG Fig. 25, p. 35; see LMBODY), the
C     commander on the left, so Y -22.
      SUBROUTINE LDEYE(E)
      DOUBLE PRECISION E(3)
      E(1) = 1.7D0 + 0.0254D0 * (279.25D0 - 200.0D0)
      E(2) = 0.0254D0 * (-22.0D0)
      E(3) = 0.0254D0 * 54.0D0
      RETURN
      END
C
C     CMDIR: the point 0.5 m from the eye E toward plot point (X, Y)
C     of the station view (right +Y, up -Z, centre +X).
      SUBROUTINE CMDIR(E, X, Y, P)
      DOUBLE PRECISION E(3), X, Y, P(3), U(3), DR
      DR = 3.141592653589793D0 / 180.0D0
      U(1) = 1.0D0
      U(2) = X * DR
      U(3) = -Y * DR
      CALL VUNIT(U)
      P(1) = E(1) + 0.5D0 * U(1)
      P(2) = E(2) + 0.5D0 * U(2)
      P(3) = E(3) + 0.5D0 * U(3)
      RETURN
      END

