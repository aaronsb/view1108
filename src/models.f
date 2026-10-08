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
C     MKPRS; frusta, MKFRU) and free lines (XLINE), in its own body
C     frame, in metres.  A solid standing for a curved surface (the
C     CSM's cone, cylinder, nozzles) is smooth (LSMO): the edges
C     between its sides are drawn only where they are its outline.
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
      DOUBLE PRECISION OFF(3)
      NSOL = 0
      NXL = 0
      NMOD = 0
      NWIN = 0
      NOC = 0
      NOCX = 0
      NMODX = 0
      NSOLX = 0
      NXLX = 0
C     LM, landing gear deployed (scene 4).
      CALL MODBEG(KLMD)
      CALL LMBODY
      CALL LMGEAR(0)
      CALL LMRCS
      CALL LMANT
      CALL MODEND(KLMD)
C     LM, landing gear stowed, with drogue and docking target, in its
C     place on the S-IVB (scene 7).
      CALL MODBEG(KLMS)
      CALL LMBODY
      CALL LMGEAR(1)
      CALL LMDOCK
      CALL LMRCS
      CALL LMANT
      CALL MODEND(KLMS)
C     LM ascent stage alone, after lunar lift-off, with the drogue and
C     docking target (LMDOCK) kept for the lunar-orbit docking (ours).
      CALL MODBEG(KLMA)
      CALL LMASC
      CALL LMDOCK
      CALL LMRCS
      CALL LMANT
      CALL MODEND(KLMA)
C     S-IVB with the instrument unit and the stub of the SLA.
      CALL MODBEG(KSIV)
      CALL SIVBMD
      CALL MODEND(KSIV)
C     CSM, with the docking probe.
      CALL MODBEG(KCSM)
      CALL CSMBLD
      CALL MODEND(KCSM)
C     CM alone, after CM/SM separation.
      CALL MODBEG(KCMO)
      CALL CMBLD
      CALL MODEND(KCMO)
C     CM cabin: the commander's window outlines about the design eye,
C     an outline (station view only).
      CALL MODBEG(KCMC)
      CALL CMCAB
      CALL MODEND(KCMC)
      MDHL(KCMC) = 0
C     CM and LM crew compartments, outlines (in_flags bit 4).
      CALL MODBEG(KCMI)
      CALL CMINT
      CALL MODEND(KCMI)
      MDHL(KCMI) = 0
      CALL MODBEG(KLMI)
      CALL LMINT
      CALL MODEND(KLMI)
      MDHL(KLMI) = 0
C     Their hidden lines, for the design eyes (vmask.f CBCUT; ours).
      CALL SETV(OFF, 0.0D0, 0.0D0, 0.0D0)
      KCOK(1) = 0
      KCOK(2) = 0
      CALL CBCUT(KCMI, OFF)
      CALL CBCUT(KLMI, OFF)
C     The launch stack behind the CSM before separation: S-IVB, IU
C     and the closed SLA, the LM hidden inside (not built).
      CALL MODBEG(KSTK)
      CALL LVSTK
      CALL MODEND(KSTK)
C     Below it the S-II and the S-IC, and on the CM the launch escape
C     system, each dropped at its own event (vdrive.f LVPL; #97).
      CALL MODBEG(KSII)
      CALL LVSII
      CALL MODEND(KSII)
      CALL MODBEG(KSIC)
      CALL LVSIC
      CALL MODEND(KSIC)
      CALL MODBEG(KLES)
      CALL LESBLD
      CALL MODEND(KLES)
C     The launch complex fixed to the Earth at the pad, with the
C     umbilical tower's arms swung out and swung back, the access
C     arm also parked (mpad.f; vdrive.f PADPL).
      CALL MODBEG(KPAD)
      CALL PADBLD
      CALL MODEND(KPAD)
      CALL MODBEG(KARE)
      CALL ARMBLD(1, 8, 0.0D0)
      CALL MODEND(KARE)
      CALL MODBEG(KARR)
      CALL ARMBLD(1, 8, 90.0D0)
      CALL MODEND(KARR)
      CALL MODBEG(KA9E)
      CALL ARMBLD(9, 9, 0.0D0)
      CALL MODEND(KA9E)
      CALL MODBEG(KA9P)
      CALL ARMBLD(9, 9, 12.0D0)
      CALL MODEND(KA9P)
      CALL MODBEG(KA9R)
      CALL ARMBLD(9, 9, 90.0D0)
      CALL MODEND(KA9R)
      RETURN
      END
C
C     MODBEG, MODEND: open and close model K in the table.  A model
C     number past MMOD is refused and counted (NMODX): its builder's
C     solids and lines are still made, but no model holds them.
      SUBROUTINE MODBEG(K)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER K
      IF (K .GT. MMOD .OR. K .LT. 1) NMODX = NMODX + 1
      IF (K .GT. MMOD .OR. K .LT. 1) RETURN
      MDS1(K) = NSOL + 1
      MDX1(K) = NXL + 1
      MDHL(K) = 1
      MDBLD = K
      RETURN
      END
C
      SUBROUTINE MODEND(K)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER K
      IF (K .GT. MMOD .OR. K .LT. 1) RETURN
      MDS2(K) = NSOL
      MDX2(K) = NXL
      IF (K .GT. NMOD) NMOD = K
      RETURN
      END
C
C     KLMPL: the LM model placed this frame (KLMD, KLMS or KLMA), else
C     0.  KCSPL: the same for the CSM (KCSM, or the CM alone, KCMO);
C     KSIVPL the S-IVB (KSIV, or the launch stack before separation,
C     KSTK; both in SIVBMD's body frame).
      INTEGER FUNCTION KLMPL()
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      KLMPL = 0
      IF (MDON(KLMD) .EQ. 1) KLMPL = KLMD
      IF (MDON(KLMS) .EQ. 1) KLMPL = KLMS
      IF (MDON(KLMA) .EQ. 1) KLMPL = KLMA
      RETURN
      END
C
      INTEGER FUNCTION KCSPL()
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      KCSPL = 0
      IF (MDON(KCSM) .EQ. 1) KCSPL = KCSM
      IF (MDON(KCMO) .EQ. 1) KCSPL = KCMO
      RETURN
      END
C
      INTEGER FUNCTION KSIVPL()
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      KSIVPL = 0
      IF (MDON(KSIV) .EQ. 1) KSIVPL = KSIV
      IF (MDON(KSTK) .EQ. 1) KSIVPL = KSTK
      RETURN
      END
C
C-----------------------------------------------------------------------
C     LMBODY: the LM's stages, body axes X up, Y right, Z forward, the
C     descent stage base at X = 0: the descent stage (LMDSC, solid
C     IS0+1), then the ascent stage (LMASC, solids IS0+2 .. IS0+8).
C     LMASC alone is the ascent stage after lift-off (KLMA), in the
C     same body frame.  The hatch is a mark on the lower cabin's front
C     (ascent solid 1, face 10, its +Z cap), the windows on the upper
C     cabin's (ascent solid 7, face 8).
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
      CALL LMDSC
      CALL LMASC
      RETURN
      END
C
C     LMDSC: the descent stage, solid 1 of LMBODY.
      SUBROUTINE LMDSC
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION O(3), A1(3), A2(3), AN(3), P(2,8)
C     1  descent stage: octagon 4.2 m across, X 0 .. 1.7.
      CALL OCTAG(2.1D0, 2.1D0, 0.9D0, P)
      CALL SETV(O, 0.0D0, 0.0D0, 0.0D0)
      CALL SETV(A1, 0.0D0, 1.0D0, 0.0D0)
      CALL SETV(A2, 0.0D0, 0.0D0, 1.0D0)
      CALL SETV(AN, 1.0D0, 0.0D0, 0.0D0)
      CALL MKPRS(8, P, O, A1, A2, AN, 1.7D0)
      RETURN
      END
C
C     LMASC: the ascent stage, solids 2 .. 8 of LMBODY (1 .. 7 here),
C     with its window and hatch marks.
      SUBROUTINE LMASC
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
      IC = IS0 + 1
      IU = IS0 + 7
C
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
C     on the LM model LMBODY (or LMASC) has just built (tunnel = its
C     solid 5, midsection = its solid 3, of 8; of LMASC's 7, 4 and 2).
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
C     LMRCS: the four RCS thruster clusters, after LMBODY (and LMGEAR,
C     LMDOCK, which count back from LMBODY's last solid).  "The four
C     reaction control engine clusters are mounted on truss members
C     extending from both sides of the crew compartment (two forward
C     clusters) and both sides of the midsection (two aft clusters)"
C     (SG p. 8).  The forward ones on "tubular truss members bolted to
C     both sides of the front face assembly.  A truss member extends
C     aft and is secured to a longeron located at the compartment's
C     maximum breadth" (SG p. 10); the aft ones on "truss members
C     bolted to the upper and lower corners of the equipment rack
C     assembly and to the -Z27 bulkhead" (SG p. 16).  Each cluster
C     has four nozzles, up, down, outboard and fore (forward pair) or
C     aft (aft pair): our reading of SG Fig. 1 (p. 2), "RCS thruster
C     assembly", and of MSC IN 69-FM-197, fig. 6.1-1(c) (printed p.
C     97), where each cluster is a circle (a nozzle seen end on) and
C     two horns.  Cluster centres, heights read off SG Fig. 1 (about
C     the cabin's axis), the housing (a 0.3 m block) and the nozzles
C     (0.35 m long, 0.09 to 0.22 m across) are ours; so are the truss
C     ends, put on our LMBODY solids where the text puts them.
C     Solids: a housing and four frusta per cluster, 20 in all.
C-----------------------------------------------------------------------
      SUBROUTINE LMRCS
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION O(3), A1(3), A2(3), AN(3), P(2,8)
      DOUBLE PRECISION CX(4), CY(4), CZ(4), SY, SZ, HB, YI
      INTEGER J
      DATA CX / 3.0D0, 3.0D0, 3.1D0, 3.1D0 /
      DATA CY / 1.55D0, -1.55D0, 1.85D0, -1.85D0 /
      DATA CZ / 1.30D0, 1.30D0, -1.25D0, -1.25D0 /
      HB = 0.15D0
      CALL OCTAG(HB, HB, 0.03D0, P)
      CALL SETV(A1, 0.0D0, 1.0D0, 0.0D0)
      CALL SETV(A2, 0.0D0, 0.0D0, 1.0D0)
      CALL SETV(AN, 1.0D0, 0.0D0, 0.0D0)
      DO 40 J = 1, 4
        SY = DSIGN(1.0D0, CY(J))
        SZ = DSIGN(1.0D0, CZ(J))
        CALL SETV(O, CX(J) - HB, CY(J), CZ(J))
        CALL MKPRS(8, P, O, A1, A2, AN, 2.0D0 * HB)
        CALL RCSNZ(CX(J), CY(J), CZ(J), 1, 1.0D0, HB)
        CALL RCSNZ(CX(J), CY(J), CZ(J), 1, -1.0D0, HB)
        CALL RCSNZ(CX(J), CY(J), CZ(J), 2, SY, HB)
        CALL RCSNZ(CX(J), CY(J), CZ(J), 3, SZ, HB)
C       Trusses from the housing's inboard face.
        YI = CY(J) - SY * HB
        IF (J .GT. 2) GO TO 30
        CALL XLINE(YI, CX(J), CZ(J), SY * 1.168D0, 2.8D0, 1.6D0, 0)
        CALL XLINE(YI, CX(J), CZ(J), SY * 1.168D0, 3.2D0, 1.6D0, 0)
        CALL XLINE(YI, CX(J), CZ(J), SY * 1.168D0, 3.0D0, 0.7D0, 0)
        GO TO 40
   30   CALL XLINE(YI, CX(J), CZ(J), SY * 1.55D0, 3.6D0, -1.664D0, 0)
        CALL XLINE(YI, CX(J), CZ(J), SY * 1.55D0, 2.6D0, -1.664D0, 0)
        CALL XLINE(YI, CX(J), CZ(J), SY * 1.2D0, 3.1D0, -0.686D0, 0)
   40 CONTINUE
      RETURN
      END
C
C     RCSNZ: one RCS nozzle (RCSNV) from the LM cluster housing (half
C     size HB) about X, Y, Z (m), firing along body axis IA (1 X, 2 Y,
C     3 Z) with sign SG.
      SUBROUTINE RCSNZ(X, Y, Z, IA, SG, HB)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION X, Y, Z, SG, HB
      INTEGER IA
      DOUBLE PRECISION A1(3), A2(3), AN(3)
      INTEGER I1, I2
      CALL SETV(AN, 0.0D0, 0.0D0, 0.0D0)
      CALL SETV(A1, 0.0D0, 0.0D0, 0.0D0)
      CALL SETV(A2, 0.0D0, 0.0D0, 0.0D0)
      I1 = MOD(IA, 3) + 1
      I2 = MOD(IA + 1, 3) + 1
      AN(IA) = SG
      A1(I1) = 1.0D0
      A2(I2) = 1.0D0
      CALL RCSNV(X, Y, Z, AN, A1, A2, HB)
      RETURN
      END
C
C     RCSNV: one RCS nozzle, an 8-sided frustum from the face of a
C     cluster housing (half size HB) about X, Y, Z (m), firing along
C     unit AN, its octagon in axes A1, A2.  Sizes: ours.
      SUBROUTINE RCSNV(X, Y, Z, AN, A1, A2, HB)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION X, Y, Z, AN(3), A1(3), A2(3), HB
      DOUBLE PRECISION O(3), Q(2,8)
      INTEGER K
      DO 10 K = 1, 8
        Q(1,K) = 0.045D0 * DCOS(DBLE(K) * PI / 4.0D0)
        Q(2,K) = 0.045D0 * DSIN(DBLE(K) * PI / 4.0D0)
   10 CONTINUE
      CALL SETV(O, X, Y, Z)
      DO 20 K = 1, 3
        O(K) = O(K) + AN(K) * (HB - 0.01D0)
   20 CONTINUE
      CALL MKFRU(8, Q, O, A1, A2, AN, 0.35D0, 0.11D0 / 0.045D0)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     LMANT: the ascent stage's two dish antennas as free lines, each a
C     rim and a hub ring facing +X on a post, as MSC IN 69-FM-197 draws
C     them from above (fig. 6.1-1(c), printed p. 97: a circle in a
C     circle).  Rendezvous radar: "Attached to a movable mounting
C     secured to the curved bulkhead top side of the crew compartment
C     just above the front face assembly" (SG p. 44), "on the upper
C     structural beams of the crew compartment" (LMNR p. LV-3); a
C     little right of the centreline, our reading of SG Fig. 1 (p. 2).
C     S-band steerable: "On extended truss members secured to the
C     upper right structure of the Midsection" (SG p. 44).  Dish sizes
C     (0.6 and 0.66 m), heights, the trusses' ends and the dishes
C     facing +X (stowed, or turned to the CSM) are ours.
C-----------------------------------------------------------------------
      SUBROUTINE LMANT
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION C(3)
C     Rendezvous radar on a post from the cabin top.
      CALL XLINE(0.3D0, 4.168D0, 1.85D0, 0.3D0, 4.45D0, 1.85D0, 0)
      CALL SETV(C, 4.55D0, 0.3D0, 1.85D0)
      CALL XRING(C, 1, 0.3D0, 16)
      CALL SETV(C, 4.45D0, 0.3D0, 1.85D0)
      CALL XRING(C, 1, 0.08D0, 8)
C     S-band steerable: three truss members to a gimbal, a post, dish.
      CALL XLINE(1.2D0, 3.804D0, 0.0D0, 1.45D0, 4.35D0, -0.3D0, 0)
      CALL XLINE(1.2D0, 3.804D0, -0.6D0, 1.45D0, 4.35D0, -0.3D0, 0)
      CALL XLINE(0.9D0, 4.104D0, -0.3D0, 1.45D0, 4.35D0, -0.3D0, 0)
      CALL XLINE(1.45D0, 4.35D0, -0.3D0, 1.45D0, 4.5D0, -0.3D0, 0)
      CALL SETV(C, 4.6D0, 1.45D0, -0.3D0)
      CALL XRING(C, 1, 0.33D0, 16)
      CALL SETV(C, 4.5D0, 1.45D0, -0.3D0)
      CALL XRING(C, 1, 0.08D0, 8)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     SIVBMD: S-IVB with the instrument unit on top, body axes X
C     forward along the stage, origin at the centre of the top of the
C     IU.  One prism of 24 sides: both 21.7 ft across, 58.3 ft and
C     3 ft high (Apollo 11 press kit, printed p. 109; SIVBH, SIUH and
C     SLVD in viewcom.inc).
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
      RIU = 0.5D0 * SLVD * 0.0254D0
      DO 50 K = 1, 24
        P24(1,K) = RIU * DCOS(DBLE(K) * PI / 12.0D0)
        P24(2,K) = RIU * DSIN(DBLE(K) * PI / 12.0D0)
   50 CONTINUE
      Q = (SIVBH + SIUH) * 0.3048D0
      CALL SETV(O, -Q, 0.0D0, 0.0D0)
      CALL SETV(A1, 0.0D0, 1.0D0, 0.0D0)
      CALL SETV(A2, 0.0D0, 0.0D0, 1.0D0)
      CALL SETV(AN, 1.0D0, 0.0D0, 0.0D0)
      CALL MKPRS(24, P24, O, A1, A2, AN, Q)
      XSL = 7.0D0 * 0.3048D0
      RSL = 0.5D0 * (SLVD - (SLVD - SLATD) * 7.0D0 / SLAH) * 0.0254D0
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
C-----------------------------------------------------------------------
C     LVSTK: the launch vehicle's stack above the S-II, as the CSM rode
C     it from launch to the separation (SEP): the S-IVB, the IU and the
C     closed SLA, which housed the LM ("a housing for the lunar module",
C     press kit, printed p. 86).  SIVBMD's body frame: X forward along
C     the vehicle, origin at the centre of the top of the IU, metres.
C     Plain primitives from the published overall sizes (viewcom.inc;
C     press kit, printed pp. 88, 109, 113), each its own solid along X
C     (LVCYL, LVFRU), the stages below it models of their own (LVSII,
C     LVSIC):
C       S-IVB and IU, one cylinder SIVBH + SIUH ft long, SLVD in
C         across, X from -(SIVBH + SIUH) ft to 0;
C       SLA, a frustum SLAH ft long from SLVD in across at X 0 to
C         SLATD in, the SM's own 154 in (12 ft 10 in, press kit printed
C         p. 88), at its top, where it meets the SM's aft end (SMAFT).
C     Rough by design (the operator's call, #70): no panel joints, LM
C     supports or antennas; the LM inside is hidden, so not built.
C     Smooth solids (LSMO), as the CSM's: only outlines and rims show.
C-----------------------------------------------------------------------
      SUBROUTINE LVSTK
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION FT
      FT = 0.3048D0
      CALL LVCYL(-(SIVBH + SIUH) * FT, (SIVBH + SIUH) * FT, SLVD)
      CALL LVFRU(0.0D0, SLAH * FT, SLVD, SLATD / SLVD)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     LVSII, LVSIC: the S-II and the S-IC below the stack (#97), each
C     its own model so that it drops at its separation (vdrive.f LVPL),
C     in SIVBMD's body frame as LVSTK: smooth cylinders SICD in across,
C     SIIH and SICH ft long (Apollo 11 press kit, printed p. 109;
C     viewcom.inc).  The S-II/S-IVB interstage, the taper from 33 ft to
C     21 ft 8 in, is left out: no source we hold gives its length, so
C     the step from the S-II's top to the S-IVB is drawn flat (ours).
C     No fins, engines or fairings.
C-----------------------------------------------------------------------
      SUBROUTINE LVSII
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION FT
      FT = 0.3048D0
      CALL LVCYL(-(SIVBH + SIUH + SIIH) * FT, SIIH * FT, SICD)
      RETURN
      END
C
      SUBROUTINE LVSIC
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION FT
      FT = 0.3048D0
      CALL LVCYL(-(SIVBH + SIUH + SIIH + SICH) * FT, SICH * FT, SICD)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     LESBLD: the launch escape system on the CM (#97), in CSMBLD's
C     body frame, by the Apollo Operations Handbook's stations (Fig.
C     1-2, p. 1-5; LESXC to LESTP in viewcom.inc): the LES-CM
C     separation plane at CM station 83.476 in (X = 0.0254 (Xc - 18)
C     m, as CMINT), the tower to LES station 118.3, the skirt to 138.0,
C     the motor to 363.7 and the tip at 400.762, "33 feet tall, four
C     feet in diameter at the base" (press kit, printed p. 86).  Plain
C     primitives: the open-frame tower a square frustum, 48 in (LESBD)
C     across at its base to 36 in at its top; the skirt a frustum from
C     48 in to the motor's 27 in; the motor a cylinder 27 in across;
C     the nose a frustum to the Q-ball, 4 in.  The widths but LESBD
C     are ours, measured on the handbook's figure; the canards and the
C     boost protective cover over the CM are not drawn.
C-----------------------------------------------------------------------
      SUBROUTINE LESBLD
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION X0, HB, DM
      X0 = 0.0254D0 * (LESXC - 18.0D0)
      HB = 0.5D0 * LESBD * 0.0254D0
      DM = 27.0D0
      CALL MKBOX(X0, LESTW * 0.0254D0, 0.0D0, 0.0D0, HB, HB,
     &           36.0D0 / LESBD)
      CALL LVFRU(X0 + LESTW * 0.0254D0, (LESSK - LESTW) * 0.0254D0,
     &           LESBD, DM / LESBD)
      CALL LVCYL(X0 + LESSK * 0.0254D0, (LESMO - LESSK) * 0.0254D0,
     &           DM)
      CALL LVFRU(X0 + LESMO * 0.0254D0, (LESTP - LESMO) * 0.0254D0,
     &           DM, 4.0D0 / DM)
      RETURN
      END
C
C     LVFRU: a smooth 24-sided frustum on the X axis from X0 for H (m),
C     D inches across at X0, its top scaled by SC.
      SUBROUTINE LVFRU(X0, H, D, SC)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION X0, H, D, SC, O(3), A1(3), A2(3), AN(3), P(2,24)
      DOUBLE PRECISION R
      INTEGER K
      R = 0.5D0 * D * 0.0254D0
      DO 10 K = 1, 24
        P(1,K) = R * DCOS(DBLE(K) * PI / 12.0D0)
        P(2,K) = R * DSIN(DBLE(K) * PI / 12.0D0)
   10 CONTINUE
      CALL SETV(O, X0, 0.0D0, 0.0D0)
      CALL SETV(A1, 0.0D0, 1.0D0, 0.0D0)
      CALL SETV(A2, 0.0D0, 0.0D0, 1.0D0)
      CALL SETV(AN, 1.0D0, 0.0D0, 0.0D0)
      CALL MKFRU(24, P, O, A1, A2, AN, H, SC)
      IF (LBOK .EQ. 1) LSMO(NSOL) = 1
      RETURN
      END
C
C     LVCYL: one stage of the stack, a smooth 24-sided prism on the X
C     axis from X0 for H (m), D inches across.
      SUBROUTINE LVCYL(X0, H, D)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION X0, H, D, O(3), A1(3), A2(3), AN(3), P(2,24)
      DOUBLE PRECISION R
      INTEGER K
      R = 0.5D0 * D * 0.0254D0
      DO 10 K = 1, 24
        P(1,K) = R * DCOS(DBLE(K) * PI / 12.0D0)
        P(2,K) = R * DSIN(DBLE(K) * PI / 12.0D0)
   10 CONTINUE
      CALL SETV(O, X0, 0.0D0, 0.0D0)
      CALL SETV(A1, 0.0D0, 1.0D0, 0.0D0)
      CALL SETV(A2, 0.0D0, 0.0D0, 1.0D0)
      CALL SETV(AN, 1.0D0, 0.0D0, 0.0D0)
      CALL MKPRS(24, P, O, A1, A2, AN, H)
      IF (LBOK .EQ. 1) LSMO(NSOL) = 1
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
      LXOK = 0
      IF (NXL .GE. MXL) NXLX = NXLX + 1
      IF (NXL .GE. MXL) RETURN
      LXOK = 1
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
C     extruded H along AN.  Faces 1..NP sides, NP+1 base, NP+2 cap,
C     the base's plane through its points 1, 3 and 6 (4 for a box).
C     Its edges are all real (LSMO = 0); a caller building a curved
C     surface sets LSMO(NSOL) = 1 after the call (as MKFRU's), if
C     the call added it (LBOK).
      SUBROUTINE MKPRS(NP, P, O, A1, A2, AN, H)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER NP
      DOUBLE PRECISION P(2,NP), O(3), A1(3), A2(3), AN(3), H
      DOUBLE PRECISION CEN(3), E1(3), E2(3), N(3), D, VDOT
      INTEGER I, K, K2, IS, IA, IB, IC, NE
C     A full model table takes no more solids (as XLINE takes no more
C     lines).
      LBOK = 0
      IF (NSOL .GE. MSOL) NSOLX = NSOLX + 1
      IF (NSOL .GE. MSOL) RETURN
      LBOK = 1
      NSOL = NSOL + 1
      IS = NSOL
      NLV(IS) = 2 * NP
      NLF(IS) = NP + 2
      LSMO(IS) = 0
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
          IC = MIN0(NP, 6)
        ELSE
          IA = 1 + NP
          IB = 3 + NP
          IC = MIN0(NP, 6) + NP
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
C     A full model table takes no more solids (as XLINE takes no more
C     lines).
      LBOK = 0
      IF (NSOL .GE. MSOL) NSOLX = NSOLX + 1
      IF (NSOL .GE. MSOL) RETURN
      LBOK = 1
      NSOL = NSOL + 1
      IS = NSOL
      NLV(IS) = 2 * NP
      NLF(IS) = NP + 2
      LSMO(IS) = 0
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
        IF (K .EQ. NP + 1) IC = MIN0(NP, 6)
        IF (K .EQ. NP + 2) IA = 1 + NP
        IF (K .EQ. NP + 2) IB = 3 + NP
        IF (K .EQ. NP + 2) IC = MIN0(NP, 6) + NP
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
      LBOK = 0
      IF (NSOL .GE. MSOL) NSOLX = NSOLX + 1
      IF (NSOL .GE. MSOL) RETURN
      LBOK = 1
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
        E2(I) = LMV(I,MIN0(NP, 6)+NP,IS) - LMV(I,1+NP,IS)
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
C     CSMBLD: the command and service module, hidden-line solids like
C     the LM's.  Body axes X along the stack toward the CM apex, Y and
C     Z across (Apollo CSM convention: the RCS quads sit near +-Y and
C     +-Z, below); origin on the axis where the CM is widest, X =
C     0.0254 (Xc - 18) m as CMINT, metres.  Sources (CSM News
C     Reference, North American Rockwell 1969, "NR"; Apollo Operations
C     Handbook SM2A-03-Block II-(1), 1969, "AOH"; Apollo 11 press kit,
C     "PK"), where they disagree the one used is named:
C       CM: CMBLD (solids 1 to 3, its windows and hatch), then the
C         docking probe: an 8-sided frustum 0.3 m proud of the docking
C         ring, as deep as the LM's drogue (LMDOCK), so docked it sits
C         in the LM's tunnel and is hidden there; three support arms.
C         Sizes ours.
C       SM and fairing, one 24-sided prism of the SM's diameter up to
C         the CM: the SM "12 feet 11 inches long (high) and 12 feet 10
C         inches in diameter" (AOH p. 1-50); the fairing "22 inches
C         high" (NR p. 55; AOH p. 1-50 has 26 in), "composed of 16
C         pieces; eight electrical power subsystem radiators alternated
C         with eight aluminum honeycomb panels" (NR p. 55): its joint
C         to the SM a ring, the 16 pieces' joints marks.
C       Sectors: "two 50-degree (Sectors 1 and 4), two 60-degree
C         (Sectors 3 and 6), and two 70-degree (Sectors 2 and 5)" (NR
C         p. 56), the RCS packages in sectors II (+Y), III (+Z), V (-Y)
C         and VI (-Z) (AOH Fig. 1-28, p. 1-49); the sector panels "are
C         bolted to the radial beams" (NR p. 55), so the six beams are
C         seams on the skin.  Their angles allow sector 1 to start
C         anywhere 0 to 40 deg before +Y (toward -Z); we take 20.
C       ECS radiators: "bonded to the sector panels on opposite sides
C         of the module ... each about 30 square feet in area" (NR p.
C         55), across sectors II/III and V/VI (AOH Fig. 1-28): two
C         panels 1.39 by 2.0 m centred on those sector joints, their
C         height on the SM ours.
C       SPS nozzle: an extension "protruding more than 9 feet below
C         the aft bulkhead" (NR p. 58); we take 9 ft 8 in, the NR p. 3
C         "22ft,7 in. excluding fairing" less the AOH's 12 ft 11 in
C         (ours), and "an exit diameter of 7 feet 10-1/2 inches" (NR
C         p. 162); the throat end (0.5 m radius) is ours.
C       RCS quads: "four clusters of 90 degrees apart around the upper
C         portion" (NR p. 58), "offset about 7 degrees from the Y and Z
C         axes" (NR p. 147); each package "eight feet long and nearly
C         three feet wide" (NR p. 59), a panel marked on the skin,
C         centred 1.5 m below the SM's top (ours).  Its engines,
C         "mounted with two pointed up and down and two pointed to the
C         sides in opposite directions" (NR p. 59), "canted 10 degrees
C         outward" (NR p. 147), on a housing 0.3 m proud; housing and
C         nozzle sizes are the LM's (LMRCS, ours).  Five solids a quad.
C       VHF scimitar antennas: two, "mounted 180 degrees apart on the
C         service module" (NR p. 175), "approximately 13-3/4 inches
C         long" (NR p. 59), free lines; their place on the SM (between
C         the quads, near the top) and the blade's outline are ours.
C       High-gain antenna: on the aft bulkhead; "four 31-inch diameter
C         reflectors surrounding an 11-inch square reflector" (NR p.
C         59); the boom "swings out at right angles to the spacecraft
C         longitudinal axis, with the boom pointing 52 degrees below
C         the heads-up horizontal" (PK p. 90).  Our reading: the boom
C         leaves the SM's aft edge in the Y-Z plane, 52 deg from +Y
C         toward -Z; its length (2.4 m) and the dishes' arrangement (2
C         by 2, square to the boom) are ours.  Free lines.
C     Curved surfaces (cone, cylinder, nozzle, probe) are smooth
C     solids (LSMO): only their outlines and rims are drawn.
C-----------------------------------------------------------------------
      SUBROUTINE CSMBLD
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION O(3), A1(3), A2(3), AN(3), P(2,24), Q(2,8)
      DOUBLE PRECISION FT, RB, XF, XS, HS, XN, RN, C, S, CMTOP, XT
      DOUBLE PRECISION SMAFT
      DOUBLE PRECISION BR(3), BD(3), BU(3), T(3), CX, CY, HA, R, XQ
      DOUBLE PRECISION B0, SA(6), HB, CS, SN, U(3), W(3), D, XB
      DOUBLE PRECISION BL(2,6)
      INTEGER K, J, I, ISM
      DATA SA / 0.0D0, 70.0D0, 130.0D0, 180.0D0, 250.0D0, 310.0D0 /
      DATA BL / 0.0D0, 0.0D0, 0.05D0, 0.11D0, 0.17D0, 0.17D0,
     &  0.34D0, 0.15D0, 0.20D0, 0.10D0, 0.10D0, 0.0D0 /
      FT = 0.3048D0
      RB = 0.5D0 * (12.0D0 + 10.0D0 / 12.0D0) * FT
      XT = CMTOP()
C     CM: cone, apex, docking ring, windows and hatch.
      CALL CMBLD
C     Docking probe and its three arms.
      DO 10 K = 1, 8
        Q(1,K) = 0.06D0 * DCOS(DBLE(K) * PI / 4.0D0)
        Q(2,K) = 0.06D0 * DSIN(DBLE(K) * PI / 4.0D0)
   10 CONTINUE
      CALL SETV(A1, 0.0D0, 1.0D0, 0.0D0)
      CALL SETV(A2, 0.0D0, 0.0D0, 1.0D0)
      CALL SETV(AN, 1.0D0, 0.0D0, 0.0D0)
      CALL SETV(O, XT, 0.0D0, 0.0D0)
      CALL MKFRU(8, Q, O, A1, A2, AN, 0.3D0, 0.5D0)
      IF (LBOK .EQ. 1) LSMO(NSOL) = 1
      DO 12 K = 0, 2
        C = DCOS(DBLE(K) * 2.0D0 * PI / 3.0D0)
        S = DSIN(DBLE(K) * 2.0D0 * PI / 3.0D0)
        CALL XLINE(0.36D0 * C, XT, 0.36D0 * S, 0.06D0 * C,
     &             XT + 0.12D0, 0.06D0 * S, 0)
   12 CONTINUE
C
C     SM and fairing.
      XF = 22.0D0 / 12.0D0 * FT
      HS = (12.0D0 + 11.0D0 / 12.0D0) * FT
      XS = SMAFT()
      DO 14 K = 1, 24
        P(1,K) = RB * DCOS(DBLE(K) * PI / 12.0D0)
        P(2,K) = RB * DSIN(DBLE(K) * PI / 12.0D0)
   14 CONTINUE
      CALL SETV(O, XS, 0.0D0, 0.0D0)
      CALL MKPRS(24, P, O, A1, A2, AN, HS + XF)
      IF (LBOK .EQ. 1) LSMO(NSOL) = 1
      IF (LBOK .EQ. 1) ISM = NSOL
C     The fairing's joint to the SM and its 16 pieces.
      CALL XARC(-XF, RB, 0.0D0, 360.0D0, ISM, 24)
      DO 16 K = 0, 15
        C = DCOS(DBLE(K) * PI / 8.0D0 + PI / 16.0D0)
        S = DSIN(DBLE(K) * PI / 8.0D0 + PI / 16.0D0)
        CALL XMK(RB * C, -XF, RB * S, RB * C, 0.0D0, RB * S, ISM, 24)
   16 CONTINUE
C     Sector joints, sector 1 from B0 (deg from +Y toward +Z).
      B0 = -20.0D0
      DO 18 K = 1, 6
        C = DCOS((B0 + SA(K)) * DR)
        S = DSIN((B0 + SA(K)) * DR)
        CALL XMK(RB * C, XS, RB * S, RB * C, -XF, RB * S, ISM, 24)
   18 CONTINUE
C     ECS radiators on the joints of sectors II/III and V/VI.
      D = 0.695D0 / RB / DR
      DO 20 K = 0, 1
        XB = B0 + 70.0D0 + 180.0D0 * DBLE(K)
        CALL XARC(-XF - 0.6D0, RB, XB - D, XB + D, ISM, 24)
        CALL XARC(-XF - 2.6D0, RB, XB - D, XB + D, ISM, 24)
        DO 19 J = -1, 1, 2
          C = DCOS((XB + DBLE(J) * D) * DR)
          S = DSIN((XB + DBLE(J) * D) * DR)
          CALL XMK(RB * C, -XF - 0.6D0, RB * S, RB * C, -XF - 2.6D0,
     &             RB * S, ISM, 24)
   19   CONTINUE
   20 CONTINUE
C
C     SPS nozzle extension, from its throat end at the aft bulkhead.
      XN = (9.0D0 + 8.0D0 / 12.0D0) * FT
      RN = 0.5D0 * (7.0D0 + 10.5D0 / 12.0D0) * FT
      DO 22 K = 1, 24
        P(1,K) = 0.5D0 * DCOS(DBLE(K) * PI / 12.0D0)
        P(2,K) = 0.5D0 * DSIN(DBLE(K) * PI / 12.0D0)
   22 CONTINUE
      CALL SETV(O, XS, 0.0D0, 0.0D0)
      CALL SETV(AN, -1.0D0, 0.0D0, 0.0D0)
      CALL MKFRU(24, P, O, A1, A2, AN, XN, RN / 0.5D0)
      IF (LBOK .EQ. 1) LSMO(NSOL) = 1
      CALL SETV(AN, 1.0D0, 0.0D0, 0.0D0)
C
C     RCS quads: panel marks, housing, four nozzles.
      HB = 0.15D0
      XQ = -XF - 1.5D0
      CS = DCOS(10.0D0 * DR)
      SN = DSIN(10.0D0 * DR)
      CALL OCTAG(HB, HB, 0.03D0, Q)
      D = 0.5D0 * 3.0D0 * FT / RB / DR
      DO 30 J = 0, 3
        XB = 7.0D0 + 90.0D0 * DBLE(J)
        C = DCOS(XB * DR)
        S = DSIN(XB * DR)
        CALL SETV(BR, 0.0D0, C, S)
        CALL SETV(T, 0.0D0, -S, C)
        CALL XARC(XQ + 4.0D0 * FT, RB, XB - D, XB + D, ISM, 24)
        CALL XARC(XQ - 4.0D0 * FT, RB, XB - D, XB + D, ISM, 24)
        DO 25 K = -1, 1, 2
          CX = DCOS((XB + DBLE(K) * D) * DR)
          CY = DSIN((XB + DBLE(K) * D) * DR)
          CALL XMK(RB * CX, XQ + 4.0D0 * FT, RB * CY, RB * CX,
     &             XQ - 4.0D0 * FT, RB * CY, ISM, 24)
   25   CONTINUE
        R = RB + HB - 0.05D0
        CALL SETV(O, XQ - HB, R * C, R * S)
        CALL MKPRS(8, Q, O, T, BR, AN, 2.0D0 * HB)
        DO 28 K = 1, 4
          DO 26 I = 1, 3
            IF (K .EQ. 1) U(I) = CS * AN(I) + SN * BR(I)
            IF (K .EQ. 2) U(I) = -CS * AN(I) + SN * BR(I)
            IF (K .EQ. 3) U(I) = CS * T(I) + SN * BR(I)
            IF (K .EQ. 4) U(I) = -CS * T(I) + SN * BR(I)
   26     CONTINUE
          CALL PERP(U, W, BU)
          CALL RCSNV(XQ, R * C, R * S, U, W, BU, HB)
          IF (LBOK .EQ. 1) LSMO(NSOL) = 1
   28   CONTINUE
   30 CONTINUE
C
C     VHF scimitars, 180 deg apart, between the quads (BL: the
C     blade's outline, down the SM and out from it, m).
      DO 34 J = 0, 1
        C = DCOS((142.0D0 + 180.0D0 * DBLE(J)) * DR)
        S = DSIN((142.0D0 + 180.0D0 * DBLE(J)) * DR)
        DO 32 K = 1, 6
          I = MOD(K, 6) + 1
          CALL XLINE((RB + BL(2,K)) * C, -XF - 0.25D0 - BL(1,K),
     &      (RB + BL(2,K)) * S, (RB + BL(2,I)) * C,
     &      -XF - 0.25D0 - BL(1,I), (RB + BL(2,I)) * S, 0)
   32   CONTINUE
   34 CONTINUE
C
C     High-gain antenna: boom, four dishes, the square horn, drawn
C     deployed.  Before the separation it was "Nested alongside the
C     service propulsion system engine nozzle until deployment"
C     (Apollo 11 press kit, printed p. 90), inside the closed SLA, so
C     MDRAW leaves its lines (LHGA1 to LHGA2) out while the launch
C     stack is placed (KSTK).
      LHGA1 = NXL + 1
      C = DCOS(-52.0D0 * DR)
      S = DSIN(-52.0D0 * DR)
      CALL SETV(BD, 0.0D0, C, S)
      CALL SETV(BU, 1.0D0, 0.0D0, 0.0D0)
      CALL VCRS(BD, BU, T)
      CALL XLINE(RB * C, XS, RB * S, (RB + 2.4D0) * C, XS,
     &           (RB + 2.4D0) * S, 0)
      HA = 0.5D0 * 31.0D0 * 0.0254D0
      R = RB + 2.4D0
      DO 50 I = 0, 3
        CX = (DBLE(MOD(I, 2)) - 0.5D0) * 2.0D0 * HA
        CY = (DBLE(I / 2) - 0.5D0) * 2.0D0 * HA
        CALL HGARNG(R, C, S, XS, CX, CY, HA, T, BU, 12)
   50 CONTINUE
C     The horn, a square ring (a 4-sided ring turned 45 deg).
      HA = 0.5D0 * 11.0D0 * 0.0254D0 * DSQRT(2.0D0)
      CALL HGARNG(R, C, S, XS, 0.0D0, 0.0D0, HA, T, BU, 4)
      LHGA2 = NXL
      RETURN
      END
C
C     HGARNG: a ring on the high-gain antenna, N sides (12 a dish rim,
C     4 the horn, corners at 45 deg) of radius HA about (CX, CY) in the
C     plane of T and BU at the boom's end (R out along (C, S) in Y-Z,
C     at X = XS).
      SUBROUTINE HGARNG(R, C, S, XS, CX, CY, HA, T, BU, N)
      DOUBLE PRECISION R, C, S, XS, CX, CY, HA, T(3), BU(3)
      INTEGER N
      DOUBLE PRECISION PI, A, B, A2, B2, H, F
      INTEGER K
      PI = 3.141592653589793D0
      H = 2.0D0 * PI / DBLE(N)
      F = 0.0D0
      IF (N .EQ. 4) F = 0.25D0 * PI
      DO 10 K = 0, N - 1
        A = CX + DCOS(DBLE(K) * H + F) * HA
        B = CY + DSIN(DBLE(K) * H + F) * HA
        A2 = CX + DCOS(DBLE(K + 1) * H + F) * HA
        B2 = CY + DSIN(DBLE(K + 1) * H + F) * HA
        CALL XLINE(R * C + A * T(2) + B * BU(2),
     &    XS + A * T(1) + B * BU(1), R * S + A * T(3) + B * BU(3),
     &    R * C + A2 * T(2) + B2 * BU(2),
     &    XS + A2 * T(1) + B2 * BU(1), R * S + A2 * T(3) + B2 * BU(3),
     &    0)
   10 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     CMBLD: the CM, solids 1 to 3 of CSMBLD, same body frame; alone it
C     is the CM after CM/SM separation (KCMO), without the probe (the
C     probe is "removed from the vehicle tunnels and stowed" for crew
C     transfer, PK p. 88; that the CM comes home without it is ours).
C       Cone: the afterbody's "33 deg" half-angle (NASA TM X-1243, Fig.
C         1(a)) from the "12ft 10in." diameter (NR p. 39) at X = 0 up
C         to X 2.3 m, a 24-sided smooth frustum; then the forward heat
C         shield's top, flattened to the docking ring (a frustum to
C         0.43 m, ours), and the docking ring, 0.40 m in radius (ours)
C         to CMTOP.  The forward heat shield's seam a ring at X 1.75,
C         above the crew compartment's forward bulkhead (CMINT; ours).
C       Windows 1 to 5 (TN D-7439, p. 3): CMINT's inner outlines (CMWIN)
C         carried out along rays from the eye they were read for (the
C         commander's, mirrored for 4 and 5; the centre couch's, Y 0,
C         DB Fig. 4.4-7, for the hatch window 3) to the outer cone, so
C         from the eye the outer and inner outlines agree (ours).
C         Marks on the cone, hidden with their face.
C       Side hatch: CMINT's outline ("about 29 inches high and 34
C         inches wide", NR p. 45) carried out square to the wall.
C-----------------------------------------------------------------------
      SUBROUTINE CMBLD
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION O(3), A1(3), A2(3), AN(3), P(2,24), FT, RB, TC
      DOUBLE PRECISION W(3,8), E(3), F(3), V(3), G(3,8), XK, RK, CMTOP
      DOUBLE PRECISION SY, CN, SNN, R
      INTEGER K, J, I, IC, N, NW
      FT = 0.3048D0
      RB = 0.5D0 * (12.0D0 + 10.0D0 / 12.0D0) * FT
      TC = DTAN(33.0D0 * DR)
      XK = 2.3D0
      RK = RB - TC * XK
      DO 10 K = 1, 24
        P(1,K) = RB * DCOS(DBLE(K) * PI / 12.0D0)
        P(2,K) = RB * DSIN(DBLE(K) * PI / 12.0D0)
   10 CONTINUE
      CALL SETV(A1, 0.0D0, 1.0D0, 0.0D0)
      CALL SETV(A2, 0.0D0, 0.0D0, 1.0D0)
      CALL SETV(AN, 1.0D0, 0.0D0, 0.0D0)
      CALL SETV(O, 0.0D0, 0.0D0, 0.0D0)
      CALL MKFRU(24, P, O, A1, A2, AN, XK, RK / RB)
      IF (LBOK .EQ. 1) LSMO(NSOL) = 1
      IC = NSOL
      DO 12 K = 1, 24
        P(1,K) = RK * DCOS(DBLE(K) * PI / 12.0D0)
        P(2,K) = RK * DSIN(DBLE(K) * PI / 12.0D0)
   12 CONTINUE
      CALL SETV(O, XK, 0.0D0, 0.0D0)
      CALL MKFRU(24, P, O, A1, A2, AN, 0.25D0, 0.43D0 / RK)
      IF (LBOK .EQ. 1) LSMO(NSOL) = 1
      DO 14 K = 1, 16
        P(1,K) = 0.40D0 * DCOS(DBLE(K) * PI / 8.0D0)
        P(2,K) = 0.40D0 * DSIN(DBLE(K) * PI / 8.0D0)
   14 CONTINUE
      CALL SETV(O, XK + 0.25D0, 0.0D0, 0.0D0)
      CALL MKPRS(16, P, O, A1, A2, AN, CMTOP() - XK - 0.25D0)
      IF (LBOK .EQ. 1) LSMO(NSOL) = 1
C     Forward heat shield seam.
      CALL XARC(1.75D0, RB - TC * 1.75D0, 0.0D0, 360.0D0, IC, 24)
C     Windows 1, 2 (and mirrored 5, 4), 3, then the side hatch.
      CN = DCOS(33.0D0 * DR)
      SNN = DSIN(33.0D0 * DR)
      DO 40 J = 1, 6
        I = J
        IF (J .GT. 2) I = J - 2
        SY = 1.0D0
        IF (J .EQ. 3 .OR. J .EQ. 4) SY = -1.0D0
        CALL CMWIN(I, N, W)
        CALL CMEYE(E)
        E(2) = SY * E(2)
        IF (I .EQ. 3) E(2) = 0.0D0
        DO 30 K = 1, N
          DO 20 NW = 1, 3
            F(NW) = W(NW,K)
   20     CONTINUE
          F(2) = SY * F(2)
C         The hatch: from a point inside, square to the wall.
          IF (I .NE. 4) GO TO 28
          R = DSQRT(F(2) * F(2) + F(3) * F(3))
          E(1) = F(1) - SNN
          E(2) = F(2) - CN * F(2) / R
          E(3) = F(3) - CN * F(3) / R
   28     CALL CONHIT(E, F, RB, TC, V)
          DO 25 NW = 1, 3
            G(NW,K) = V(NW)
   25     CONTINUE
   30   CONTINUE
        DO 35 K = 1, N
          NW = MOD(K, N) + 1
          CALL XMK(G(2,K), G(1,K), G(3,K), G(2,NW), G(1,NW), G(3,NW),
     &             IC, 24)
   35   CONTINUE
   40 CONTINUE
      RETURN
      END
C
C     CMTOP: X (m) of the top of the CM's docking ring, where the LM's
C     tunnel meets it docked: the CM's "Height 10ft 7 in." (NR p. 39)
C     above Xc 0, the bottom of the aft heat shield (AOH Fig. 1-2, p.
C     1-5), with X = 0.0254 (Xc - 18) as CMINT.
      DOUBLE PRECISION FUNCTION CMTOP()
      CMTOP = 0.0254D0 * (127.0D0 - 18.0D0)
      RETURN
      END
C
C     SMAFT: X (m) of the SM's aft end in CSMBLD's frame, below its
C     fairing ("22 inches high", NR p. 55) and the SM ("12 feet 11
C     inches long", AOH p. 1-50; see CSMBLD), where the SLA's top met
C     it before the separation (press kit, printed p. 88; LVPL).
      DOUBLE PRECISION FUNCTION SMAFT()
      DOUBLE PRECISION FT
      FT = 0.3048D0
      SMAFT = -(22.0D0 / 12.0D0 * FT) - (12.0D0 + 11.0D0 / 12.0D0) * FT
      RETURN
      END
C
C     CMWIN: CM window I (1 left side, 2 left rendezvous, 3 hatch) or,
C     I = 4, the side hatch: N corners W (X, Y, Z, CSM body metres) on
C     CMINT's inner wall; see CMINT for their sources.
      SUBROUTINE CMWIN(I, N, W)
      INTEGER I, N, K, J
      DOUBLE PRECISION W(3,8), W1(3,5), W2(3,5), W3(3,8), HS(3,4)
      DATA W1 / 0.742D0, -1.020D0, -0.851D0, 0.879D0, -0.939D0,
     &  -0.808D0, 0.902D0, -0.945D0, -0.778D0, 0.909D0, -1.016D0,
     &  -0.675D0, 0.744D0, -1.120D0, -0.711D0 /
      DATA W2 / 0.924D0, -0.629D0, -1.034D0, 0.929D0, -0.611D0,
     &  -1.040D0, 1.036D0, -0.577D0, -0.979D0, 1.058D0, -0.690D0,
     &  -0.885D0, 0.996D0, -0.715D0, -0.917D0 /
      DATA W3 / 0.986D0, 0.089D0, -1.166D0, 0.942D0, 0.052D0,
     &  -1.197D0, 0.926D0, 0.0D0, -1.208D0, 0.942D0, -0.052D0,
     &  -1.197D0, 0.986D0, -0.089D0, -1.166D0, 1.044D0, -0.075D0,
     &  -1.129D0, 1.073D0, 0.0D0, -1.113D0, 1.044D0, 0.075D0,
     &  -1.129D0 /
      DATA HS / 0.688D0, -0.425D0, -1.295D0, 1.306D0, -0.417D0,
     &  -0.866D0, 1.306D0, 0.417D0, -0.866D0, 0.688D0, 0.425D0,
     &  -1.295D0 /
      N = 5
      IF (I .EQ. 3) N = 8
      IF (I .EQ. 4) N = 4
      DO 20 K = 1, N
        DO 10 J = 1, 3
          IF (I .EQ. 1) W(J,K) = W1(J,K)
          IF (I .EQ. 2) W(J,K) = W2(J,K)
          IF (I .EQ. 3) W(J,K) = W3(J,K)
          IF (I .EQ. 4) W(J,K) = HS(J,K)
   10   CONTINUE
   20 CONTINUE
      RETURN
      END
C
C     CONHIT: P, where the ray from E through F (CSM body metres) meets
C     the CM's outer cone, radius RB at X = 0 narrowing by TC a metre
C     (the nearest crossing ahead of E); F itself if it never does.
      SUBROUTINE CONHIT(E, F, RB, TC, P)
      DOUBLE PRECISION E(3), F(3), RB, TC, P(3)
      DOUBLE PRECISION D(3), A, B, C, Q, T, T1, T2, H
      INTEGER I
      DO 10 I = 1, 3
        D(I) = F(I) - E(I)
        P(I) = F(I)
   10 CONTINUE
      H = RB - TC * E(1)
      A = D(2) * D(2) + D(3) * D(3) - TC * TC * D(1) * D(1)
      B = 2.0D0 * (E(2) * D(2) + E(3) * D(3) + TC * D(1) * H)
      C = E(2) * E(2) + E(3) * E(3) - H * H
      Q = B * B - 4.0D0 * A * C
      IF (Q .LT. 0.0D0 .OR. DABS(A) .LT. 1.0D-12) RETURN
      T1 = (-B + DSQRT(Q)) / (2.0D0 * A)
      T2 = (-B - DSQRT(Q)) / (2.0D0 * A)
      T = T1
      IF (T2 .GT. 0.0D0 .AND. (T2 .LT. T .OR. T .LE. 0.0D0)) T = T2
      IF (T .LE. 0.0D0) RETURN
      DO 20 I = 1, 3
        P(I) = E(I) + T * D(I)
   20 CONTINUE
      RETURN
      END
C
C     KFACE: the side face of an N-sided solid about the body X axis
C     (MKPRS, MKFRU with axes Y, Z; vertex K at K 360/N deg from +Y
C     toward +Z, face K from vertex K to K+1) that holds the point at
C     Y, Z.
      INTEGER FUNCTION KFACE(Y, Z, N)
      DOUBLE PRECISION Y, Z, A
      INTEGER N
      A = DATAN2(Z, Y)
      IF (A .LT. 0.0D0) A = A + 2.0D0 * 3.141592653589793D0
      KFACE = INT(A / (2.0D0 * 3.141592653589793D0 / DBLE(N)))
      IF (KFACE .LT. 1) KFACE = N
      IF (KFACE .GT. N) KFACE = N
      RETURN
      END
C
C     XMK: a mark from (Y1, X1, Z1) to (Y2, X2, Z2) on the sides of
C     solid IS, N-sided about the body X axis: cut where it would span
C     more than half a face, each piece on the face it lies over.
      SUBROUTINE XMK(Y1, X1, Z1, Y2, X2, Z2, IS, N)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION Y1, X1, Z1, Y2, X2, Z2
      INTEGER IS, N
      DOUBLE PRECISION A, F0, F1, YM, ZM
      INTEGER K, M, KFACE
      A = DABS(DATAN2(Y1 * Z2 - Z1 * Y2, Y1 * Y2 + Z1 * Z2))
      M = 1 + INT(A / (PI / DBLE(N)))
      DO 10 K = 1, M
        F0 = DBLE(K - 1) / DBLE(M)
        F1 = DBLE(K) / DBLE(M)
        CALL XLINE(Y1 + F0 * (Y2 - Y1), X1 + F0 * (X2 - X1),
     &    Z1 + F0 * (Z2 - Z1), Y1 + F1 * (Y2 - Y1),
     &    X1 + F1 * (X2 - X1), Z1 + F1 * (Z2 - Z1), IS)
        YM = Y1 + 0.5D0 * (F0 + F1) * (Y2 - Y1)
        ZM = Z1 + 0.5D0 * (F0 + F1) * (Z2 - Z1)
        IF (LXOK .EQ. 1) LXF(NXL) = KFACE(YM, ZM, N)
   10 CONTINUE
      RETURN
      END
C
C     XARC: a mark on the sides of solid IS (as XMK), the arc at X of
C     radius R from D1 to D2 deg (from +Y toward +Z), in pieces of
C     half a face.
      SUBROUTINE XARC(X, R, D1, D2, IS, N)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION X, R, D1, D2
      INTEGER IS, N
      DOUBLE PRECISION A0, A1
      INTEGER K, M, KFACE
      M = 1 + INT((D2 - D1) / (180.0D0 / DBLE(N)))
      DO 10 K = 1, M
        A0 = (D1 + (D2 - D1) * DBLE(K - 1) / DBLE(M)) * DR
        A1 = (D1 + (D2 - D1) * DBLE(K) / DBLE(M)) * DR
        CALL XLINE(R * DCOS(A0), X, R * DSIN(A0),
     &             R * DCOS(A1), X, R * DSIN(A1), IS)
        IF (LXOK .EQ. 1) LXF(NXL) = KFACE(DCOS(0.5D0 * (A0 + A1)),
     &                   DSIN(0.5D0 * (A0 + A1)), N)
   10 CONTINUE
      RETURN
      END
C-----------------------------------------------------------------------
C     CMCAB: the CM cabin as the station view shows it: the left
C     rendezvous window's outlines as VIEW drew them, in CSM body
C     metres about the eye point CMEYE.  MSC IN 69-FM-197, figure 9.0-3
C     (PDF p. 263): "View as seen along CM X-axis during the PTC
C     attitudes (X-axis in center of view)", gimbal angles 90, 0, 0,
C     and "The CM left rendezvous window outline is shown for a zero
C     roll attitude" (p. 17).  The report draws two outlines; we read
C     both off the plot by eye (to about 1 deg), in its plot degrees,
C     where a point at plot radius R lies R deg off the centre (an
C     azimuthal equidistant plot): the named stars of figures 9.0-3
C     and 5.1-1(a) (PDF pp. 263, 53, both with a 100 deg field) lie
C     there to 0.11 and 0.25 deg rms, where a tangent plot misses by
C     7 to 25 deg (our fits).  Over the window this agrees to 0.5 deg
C     with the CSM Data Book's look angles (azimuth, elevation; SNA-
C     8-D-027(I), Fig. 4.4-5), whose Fig. 4.4-6 has the same two
C     outlines for the commander's right and left eyes.  Our reading
C     of the plot's axes: right is the
C     CM's +Y, up its -Z (the rendezvous windows are on the -Z half,
C     TN D-7439 p. 3), which puts the left window up and to the left.
C     The x at the centre marks the CM X-axis, as in the report's CSM
C     maneuver views ("the x also denotes the projection of the CM X-
C     axis", MSC IN 69-FM-197 PDF p. 24, where "The CM left rendezvous
C     window has been superimposed on these views").  The lines sit
C     0.5 m from the eye (CMEYE), so they are seen exactly along the
C     outlines wherever the eye is.
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
C     CMEYE: the CM eye point, CSM body metres: the commander's eye,
C     80th percentile, between his two eyes ("CYCLOPS"), "XE = 45.7",
C     "YCY = -24.5", "ZE = -33.8" in (CSM/LM Spacecraft Operational
C     Data Book Vol. I, SNA-8-D-027(I) Rev 3, 1970, Fig. 4.4-8,
C     printed p. 4.4-65), with X = 0.0254 (Xc - 18) as CMINT.
      SUBROUTINE CMEYE(E)
      DOUBLE PRECISION E(3)
      E(1) = 0.0254D0 * (45.7D0 - 18.0D0)
      E(2) = 0.0254D0 * (-24.5D0)
      E(3) = 0.0254D0 * (-33.8D0)
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
C     of the report's CSM views (right +Y, up -Z, centre +X), which
C     lies SQRT(X**2 + Y**2) deg off the centre (see CMCAB).
      SUBROUTINE CMDIR(E, X, Y, P)
      DOUBLE PRECISION E(3), X, Y, P(3), U(3), DR, R, S
      DR = 3.141592653589793D0 / 180.0D0
      R = DSQRT(X * X + Y * Y)
      S = 0.0D0
      IF (R .GT. 0.0D0) S = DSIN(R * DR) / R
      U(1) = DCOS(R * DR)
      U(2) = X * S
      U(3) = -Y * S
      P(1) = E(1) + 0.5D0 * U(1)
      P(2) = E(2) + 0.5D0 * U(2)
      P(3) = E(3) + 0.5D0 * U(3)
      RETURN
      END

C
C-----------------------------------------------------------------------
C     CMINT: the CM's crew compartment about the station eye, free
C     lines in CSM body metres (X = 0 at the CM's widest diameter, as
C     CSMBLD; Y toward the LM pilot, Z toward the crew's feet).  An
C     outline model (MDHL = 0), drawn with in_flags bit 4: the camera
C     is inside it, and stars, Earth and Moon show through its walls
C     unless the window mask (bit 5) cuts them to the windows.
C     Stations are Xc of the Apollo Operations Handbook (SM2A-03-Block
C     II-(1), 1969, "AOH", Fig. 1-2, "XC = 0" below the aft heat
C     shield), X = 0.0254 (Xc - 18) m, the 18 in read off that figure
C     (ours).  "DB": CSM/LM Spacecraft Operational Data Book Vol. I,
C     SNA-8-D-027(I) Rev 3, 1970; "NR": CSM News Reference, NAA 1969.
C       Windows 1 to 5 from -Y to +Y (TN D-7439, p. 3): 1, 2, 3 (left
C         side, left rendezvous, hatch) are rays from the eye along
C         DB's outlines for the 80th percentile commander (Figs.
C         4.4-8, 4.4-6, 4.4-7, printed pp. 4.4-63 to 4.4-65), read by
C         eye to about 1 deg as DB's look angles (Fig. 4.4-5: azimuth
C         from +X toward +Y, elevation toward -Z), ended on our inner
C         wall; 4 and 5 mirror 2 and 1 (ours).  Window 2's corners are
C         the means of the two eyes' corners in CMCAB's outlines, along
C         CMDIR, so from the eye it lies between those outlines.
C       Inner wall: the outer cone's "33 deg" half-angle (NASA TM X-
C         1243, Fig. 1(a)) set in 4 in, from the floor's rim to the
C         forward bulkhead; floor dish, bulkhead and tunnel are ours,
C         sized to hold about the "10.4 cubic meters" of TN D-8178
C         (printed p. 10).
C       Hatches: the forward one "about 30 inches in diameter" at "the
C         top of the docking tunnel" (NR p. 47); the side one "about
C         29 inches high and 34 inches wide" (NR p. 45), about window
C         3 (ours).
C       Couches CDR, CMP, LMP from -Y, their back pans "32 by 22
C         inches" (NR p. 79) under the eyes (DB's Y), the seat at the
C         "85-degree position" (NR p. 72); leg pans and heights ours.
C       Main display console, lower equipment bay, left and right hand
C         equipment bays: placed by eye from AOH Figs. 1-26 and 1-27
C         (ours).
C       Opaque (ours): the console, the couches' pans, the bays' faces
C         and the forward bulkhead about the tunnel hide the cabin's
C         lines behind them (OCPOLY, XOCC, OCSTRP; vmask.f CBCUT).
C         The windows and hatches are not opaque: nothing of the
C         cabin is behind them.
C-----------------------------------------------------------------------
      SUBROUTINE CMINT
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION W1(3,8), W2(3,8), W3(3,8), HS(3,8), D1(3,4)
      DOUBLE PRECISION D2(3,4), CX(5), CZ(5), EB(3,6), HB(3,4), C(3)
      DOUBLE PRECISION GA(7), CA, SA, YC, YA, YB, QC(3,4), RI(3,16)
      DOUBLE PRECISION RO(3,16)
      INTEGER K, J, L, N1, N2, N3, N4
C     Main display console: left wing (panel 1; panel 3 its mirror)
C     and centre (panel 2), hung from the wall above the side hatch.
      DATA D1 / 1.372D0, -0.388D0, -0.833D0, 1.016D0, -0.508D0,
     &  -0.203D0, 0.914D0, -1.118D0, 0.0D0, 1.168D0, -0.953D0,
     &  -0.444D0 /
      DATA D2 / 1.372D0, -0.388D0, -0.833D0, 1.372D0, 0.388D0,
     &  -0.833D0, 1.016D0, 0.508D0, -0.203D0, 1.016D0, -0.508D0,
     &  -0.203D0 /
C     A couch's side, X and Z: head, hip, knee, heel, foot.
      DATA CX / 0.483D0, 0.483D0, 0.940D0, 0.813D0, 0.813D0 /
      DATA CZ / -1.067D0, 0.025D0, 0.076D0, 0.508D0, 0.610D0 /
C     Lower equipment bay face (+Z) and left hand bay face (-Y).
      DATA EB / 0.102D0, -0.965D0, 1.067D0, 0.102D0, 0.965D0, 1.067D0,
     &  0.762D0, 0.762D0, 1.067D0, 1.016D0, 0.305D0, 1.067D0,
     &  1.016D0, -0.305D0, 1.067D0, 0.762D0, -0.762D0, 1.067D0 /
      DATA HB / 0.102D0, -1.27D0, -0.559D0, 0.635D0, -1.27D0,
     &  -0.559D0, 0.635D0, -1.27D0, 0.559D0, 0.102D0, -1.27D0,
     &  0.559D0 /
C     Wall lines, deg from +Y toward +Z; none across the side hatch.
      DATA GA / 0.0D0, 45.0D0, 90.0D0, 135.0D0, 180.0D0, 225.0D0,
     &  315.0D0 /
C
C     Wall: rings at the floor's rim and the forward bulkhead, lines
C     between them.
      CALL SETV(C, 0.051D0, 0.0D0, 0.0D0)
      CALL XRING(C, 1, 1.777D0, 24)
      CALL SETV(C, 1.626D0, 0.0D0, 0.0D0)
      CALL XRING(C, 1, 0.754D0, 24)
      DO 10 K = 1, 7
        CA = DCOS(GA(K) * DR)
        SA = DSIN(GA(K) * DR)
        CALL XLINE(1.777D0 * CA, 0.051D0, 1.777D0 * SA,
     &             0.754D0 * CA, 1.626D0, 0.754D0 * SA, 0)
   10 CONTINUE
C     Floor, a shallow dish down to X -0.254 at the centre.
      CALL SETV(C, -0.178D0, 0.0D0, 0.0D0)
      CALL XRING(C, 1, 0.889D0, 24)
      DO 20 K = 0, 7
        CA = DCOS(DBLE(K) * PI / 4.0D0)
        SA = DSIN(DBLE(K) * PI / 4.0D0)
        CALL XLINE(1.777D0 * CA, 0.051D0, 1.777D0 * SA,
     &             0.889D0 * CA, -0.178D0, 0.889D0 * SA, 0)
        CALL XLINE(0.889D0 * CA, -0.178D0, 0.889D0 * SA,
     &             0.0D0, -0.254D0, 0.0D0, 0)
   20 CONTINUE
C     Forward bulkhead, tunnel and forward hatch.
      DO 30 K = 0, 7
        CA = DCOS(DBLE(K) * PI / 4.0D0)
        SA = DSIN(DBLE(K) * PI / 4.0D0)
        IF (MOD(K, 2) .EQ. 0) CALL XLINE(0.754D0 * CA, 1.626D0,
     &    0.754D0 * SA, 0.419D0 * CA, 1.626D0, 0.419D0 * SA, 0)
        CALL XLINE(0.419D0 * CA, 1.626D0, 0.419D0 * SA,
     &             0.419D0 * CA, 2.286D0, 0.419D0 * SA, 0)
   30 CONTINUE
      CALL SETV(C, 1.626D0, 0.0D0, 0.0D0)
      CALL XRING(C, 1, 0.419D0, 16)
      CALL SETV(C, 2.286D0, 0.0D0, 0.0D0)
      CALL XRING(C, 1, 0.419D0, 16)
      CALL XRING(C, 1, 0.381D0, 16)
C     The forward bulkhead is opaque about the tunnel's mouth: a strip
C     from the tunnel's ring out to the wall's (OCSTRP; ours).
      DO 35 K = 1, 16
        CA = DCOS(DBLE(K - 1) * PI / 8.0D0)
        SA = DSIN(DBLE(K - 1) * PI / 8.0D0)
        CALL SETV(RI(1,K), 1.626D0, 0.419D0 * CA, 0.419D0 * SA)
        CALL SETV(RO(1,K), 1.626D0, 0.754D0 * CA, 0.754D0 * SA)
   35 CONTINUE
      CALL OCSTRP(16, RI, RO)
C     Windows (XWIN: also the window mask's) and the side hatch, on
C     the inner wall (CMWIN): 1, left side; 2, left rendezvous; 3,
C     hatch; the side hatch, 29 in along the cone, 34 in around.
C     Window 2 is kept for the mask only (WKEEP): CMCAB draws its two
C     outlines, one for each of the commander's eyes, and window 2
C     lies between them.
      CALL CMWIN(1, N1, W1)
      CALL CMWIN(2, N2, W2)
      CALL CMWIN(3, N3, W3)
      CALL CMWIN(4, N4, HS)
      CALL XWIN(N1, W1, 1.0D0)
      CALL XWIN(N1, W1, -1.0D0)
      CALL WKEEP(N2, W2, 1.0D0)
      CALL XWIN(N2, W2, -1.0D0)
      CALL XWIN(N3, W3, 1.0D0)
      CALL XPOLY(N4, HS, 1, 1.0D0)
C     Main display console, opaque (XOCC).
      CALL XOCC(4, D2, 1.0D0)
      CALL XOCC(4, D1, 1.0D0)
      CALL XOCC(4, D1, -1.0D0)
C     Couches: two sides, cross members at each joint, each pan
C     between two joints opaque (OCPOLY).  The eye is 0.22 m above the
C     commander's back pan, which hides what is behind his head.
      DO 50 J = -1, 1
        YC = 0.622D0 * DBLE(J)
        YA = YC - 0.279D0
        YB = YC + 0.279D0
        DO 40 K = 1, 5
          IF (K .EQ. 5) GO TO 38
          L = K + 1
          CALL SETV(QC(1,1), CX(K), YA, CZ(K))
          CALL SETV(QC(1,2), CX(K), YB, CZ(K))
          CALL SETV(QC(1,3), CX(L), YB, CZ(L))
          CALL SETV(QC(1,4), CX(L), YA, CZ(L))
          CALL OCPOLY(4, QC, 1.0D0)
   38     CALL XLINE(YA, CX(K), CZ(K), YB, CX(K), CZ(K), 0)
          IF (K .EQ. 5) GO TO 40
          CALL XLINE(YA, CX(K), CZ(K), YA, CX(L), CZ(L), 0)
          CALL XLINE(YB, CX(K), CZ(K), YB, CX(L), CZ(L), 0)
   40   CONTINUE
   50 CONTINUE
C     Equipment bays' faces, opaque.
      CALL XOCC(6, EB, 1.0D0)
      CALL XOCC(4, HB, 1.0D0)
      CALL XOCC(4, HB, -1.0D0)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     LMINT: the LM's crew compartment and midsection about the
C     commander's station, free lines in LM body metres, the stations
C     and sources of LMBODY ("SG", "LMNR").  An outline model, drawn
C     with in_flags bit 4.
C       Eye: LDEYE.
C       Cabin: the 92 in cylinder about our X 3.0 m axis, from the aft
C         bulkhead to the front face (ZF); floor at X 215.5, the lower
C         deck less the "18-inch step up into the midsection" (LMNR p.
C         LV-5), "approximately 36 by 55 inches" (LMNR p. LV-4).
C       Midsection: "54 inches deep and approximately 5 feet high.
C         The internal shape is elliptical, with a minor axis of
C         approximately 56 inches" (LMNR p. LV-5), between the decks;
C         the ellipse's major axis (82.7 in, across the decks, so the
C         overhead hatch fits the upper one) is ours.  The engine
C         cover "cylindrical" (LMNR p. LV-6), its size ours.
C       Hatches: overhead "approximately 33 inches in diameter, ... at
C         the top centerline of the midsection", under the tunnel;
C         forward "approximately 32 inches square" (LMNR pp. LV-6,
C         LV-4), its sill at the floor (ours).
C       Windows: the commander's (LMWIN), the LM pilot's its mirror;
C         the docking window above the commander from rays along SG
C         Fig. 25's docking outline from the docking eye (X280.375,
C         Z37.75), ended on the shell: our construction.
C       Panels: "two main display panels (1 & 2), cantered forward
C         10 deg; two lower center panels (3 & 4), sloping down and aft
C         45 deg ...; two bottom side panels (5 & 6)" (SG p. 27); the
C         side consoles run "from the front face assembly to the aft
C         bulkhead", tiers "cantered up 15 deg", "36.5 deg" (same
C         page); the alignment optical telescope "between and above
C         the flight stations" (LMNR p. CD-2).  Sizes and cross-
C         sections from SG Figs. 12 and 13 by eye (ours).
C       Opaque (ours): the floor, the panels, the side consoles' tiers,
C         the engine cover, the aft bulkhead about the midsection and
C         the upper deck about the overhead hatch hide the cabin's
C         lines behind them (vmask.f CBCUT).
C-----------------------------------------------------------------------
      SUBROUTINE LMINT
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION FL(3,4), FH(3,4), DW(3,4), P1(3,4), P3(3,4)
      DOUBLE PRECISION P4(3,4), P5(3,4), CN(2,6), WN(3,3), EM(3,14)
      DOUBLE PRECISION C(3), A, CA, SA, X1, X2, T1, T2, T, ZF, LMWIN
      DOUBLE PRECISION SY, QC(3,4), RI(3,16), RO(3,16), YH, R
      INTEGER K, J, I
      DATA FL / 2.094D0, -0.699D0, 0.724D0, 2.094D0, 0.699D0, 0.724D0,
     &  2.094D0, 0.699D0, 1.638D0, 2.094D0, -0.699D0, 1.638D0 /
      DATA FH / 2.094D0, -0.406D0, 1.64D0, 2.094D0, 0.406D0, 1.64D0,
     &  2.906D0, 0.406D0, 1.64D0, 2.906D0, -0.406D0, 1.64D0 /
      DATA DW / 4.027D0, -0.640D0, 1.224D0, 4.027D0, -0.490D0,
     &  1.224D0, 4.027D0, -0.508D0, 0.925D0, 4.027D0, -0.620D0,
     &  0.925D0 /
C     Panels 1, 3, 4, 5 (2 and 6 are the mirrors of 1 and 5).
      DATA P1 / 3.351D0, -0.483D0, 1.562D0, 3.351D0, 0.0D0, 1.562D0,
     &  3.961D0, 0.0D0, 1.669D0, 3.961D0, -0.483D0, 1.669D0 /
      DATA P3 / 3.351D0, -0.406D0, 1.562D0, 3.351D0, 0.406D0,
     &  1.562D0, 3.122D0, 0.406D0, 1.333D0, 3.122D0, -0.406D0,
     &  1.333D0 /
      DATA P4 / 3.122D0, -0.203D0, 1.333D0, 3.122D0, 0.203D0,
     &  1.333D0, 2.945D0, 0.203D0, 1.156D0, 2.945D0, -0.203D0,
     &  1.156D0 /
      DATA P5 / 2.894D0, -0.711D0, 1.575D0, 2.894D0, -0.406D0,
     &  1.575D0, 3.046D0, -0.406D0, 1.575D0, 3.046D0, -0.711D0,
     &  1.575D0 /
C     Commander's side console, X and Y: lower tier, riser, centre
C     tier, upper (circuit breaker) tier.
      DATA CN / 2.868D0, -0.787D0, 2.922D0, -0.991D0, 3.072D0,
     &  -0.991D0, 3.138D0, -1.079D0, 3.275D0, -1.041D0, 3.935D0,
     &  -0.622D0 /
C
C     Shell: the aft bulkhead's ring, the front's rim, and lines along
C     the cylinder every 45 deg but under the floor.
      CALL SETV(C, 3.0D0, 0.0D0, 0.686D0)
      CALL XRING(C, 3, 1.168D0, 24)
      DO 10 K = 0, 23
        A = DBLE(K) * PI / 12.0D0
        X1 = 3.0D0 + 1.168D0 * DCOS(A)
        X2 = 3.0D0 + 1.168D0 * DCOS(A + PI / 12.0D0)
        CALL XLINE(1.168D0 * DSIN(A), X1, ZF(X1),
     &    1.168D0 * DSIN(A + PI / 12.0D0), X2, ZF(X2), 0)
        IF (MOD(K, 3) .NE. 0 .OR. K .EQ. 12) GO TO 10
        CALL XLINE(1.168D0 * DSIN(A), X1, 0.686D0,
     &             1.168D0 * DSIN(A), X1, ZF(X1), 0)
   10 CONTINUE
C     The front's knee, floor, forward hatch.
      CALL XLINE(-1.168D0, 3.021D0, 1.64D0, 1.168D0, 3.021D0, 1.64D0,
     &  0)
      CALL XOCC(4, FL, 1.0D0)
      CALL XPOLY(4, FH, 1, 1.0D0)
C     Windows (XWIN: also the window mask's).
      DO 15 K = 1, 3
        DO 12 I = 1, 3
          WN(I,K) = LMWIN(I,K)
   12   CONTINUE
   15 CONTINUE
C     The commander's window is kept for the mask (WKEEP) with only
C     its outboard edge drawn (corner 3 to 1): OVLPD (llpd.f) draws
C     its sill and inboard edge, the period frame.  The LM pilot's is
C     drawn whole.
      CALL WKEEP(3, WN, 1.0D0)
      CALL XLINE(WN(2,3), WN(1,3), WN(3,3), WN(2,1), WN(1,1), WN(3,1),
     &  0)
      CALL XWIN(3, WN, -1.0D0)
      CALL XWIN(4, DW, 1.0D0)
C     Midsection: its section at both ends, the decks' edges and the
C     sides joined along it.
      T1 = DACOS((4.104D0 - 3.327D0) / 1.05D0)
      T2 = DACOS((2.551D0 - 3.327D0) / 1.05D0)
      DO 20 K = 1, 7
        T = T1 + DBLE(K - 1) * (T2 - T1) / 6.0D0
        EM(1,K) = 3.327D0 + 1.05D0 * DCOS(T)
        EM(2,K) = 0.711D0 * DSIN(T)
        EM(1,15-K) = EM(1,K)
        EM(2,15-K) = -EM(2,K)
   20 CONTINUE
      DO 30 J = -1, 1, 2
        DO 25 K = 1, 14
          EM(3,K) = 0.686D0 * DBLE(J)
   25   CONTINUE
        CALL XPOLY(14, EM, 1, 1.0D0)
   30 CONTINUE
C     The aft bulkhead is opaque about the midsection's mouth, EM at
C     its last (forward) end: a strip from EM out to the bulkhead's
C     ring along rays from the ring's centre (OCSTRP; ours).
      DO 32 K = 1, 14
        R = DSQRT((EM(1,K) - 3.0D0)**2 + EM(2,K)**2)
        CALL SETV(RI(1,K), EM(1,K), EM(2,K), EM(3,K))
        CALL SETV(RO(1,K), 3.0D0 + 1.168D0 * (EM(1,K) - 3.0D0) / R,
     &            1.168D0 * EM(2,K) / R, EM(3,K))
   32 CONTINUE
      CALL OCSTRP(14, RI, RO)
      DO 35 K = 1, 14
        IF (K .EQ. 1 .OR. K .EQ. 4 .OR. K .EQ. 7 .OR. K .EQ. 8
     &    .OR. K .EQ. 11 .OR. K .EQ. 14) CALL XLINE(EM(2,K), EM(1,K),
     &    -0.686D0, EM(2,K), EM(1,K), 0.686D0, 0)
   35 CONTINUE
C     The step up from the floor to the lower deck.
      DO 38 J = -1, 1, 2
        SY = DBLE(J) * EM(2,7)
        CALL XLINE(SY, 2.094D0, 0.724D0, SY, 2.551D0, 0.686D0, 0)
   38 CONTINUE
C     Ascent engine cover, overhead hatch, docking tunnel.  The cover
C     is opaque, its top and sides; so is the upper deck about the
C     hatch, a strip from the hatch's ring out to the deck's edges,
C     EM(2,1) either side and the midsection's ends (ours).
      YH = EM(2,1)
      DO 37 K = 1, 16
        CA = DCOS(DBLE(K - 1) * PI / 8.0D0)
        SA = DSIN(DBLE(K - 1) * PI / 8.0D0)
        CALL SETV(RI(1,K), 2.551D0, 0.356D0 * CA, 0.356D0 * SA)
        CALL SETV(RO(1,K), 3.249D0, 0.356D0 * CA, 0.356D0 * SA)
   37 CONTINUE
      CALL OCSTRP(16, RI, RO)
      CALL OCPOLY(16, RO, 1.0D0)
      DO 39 K = 1, 16
        CA = DCOS(DBLE(K - 1) * PI / 8.0D0)
        SA = DSIN(DBLE(K - 1) * PI / 8.0D0)
        R = 1.0D3
        IF (DABS(CA) .GT. 1.0D-9) R = YH / DABS(CA)
        IF (DABS(SA) .GT. 1.0D-9 .AND. 0.686D0 / DABS(SA) .LT. R)
     &    R = 0.686D0 / DABS(SA)
        CALL SETV(RI(1,K), 4.104D0, 0.419D0 * CA, 0.419D0 * SA)
        CALL SETV(RO(1,K), 4.104D0, R * CA, R * SA)
   39 CONTINUE
      CALL OCSTRP(16, RI, RO)
      CALL SETV(C, 2.551D0, 0.0D0, 0.0D0)
      CALL XRING(C, 1, 0.356D0, 16)
      CALL SETV(C, 3.249D0, 0.0D0, 0.0D0)
      CALL XRING(C, 1, 0.356D0, 16)
      CALL SETV(C, 4.104D0, 0.0D0, 0.0D0)
      CALL XRING(C, 1, 0.419D0, 16)
      CALL SETV(C, 4.51D0, 0.0D0, 0.0D0)
      CALL XRING(C, 1, 0.406D0, 16)
      DO 40 K = 0, 3
        CA = DCOS(DBLE(K) * PI / 2.0D0)
        SA = DSIN(DBLE(K) * PI / 2.0D0)
        CALL XLINE(0.356D0 * CA, 2.551D0, 0.356D0 * SA,
     &             0.356D0 * CA, 3.249D0, 0.356D0 * SA, 0)
        CA = DCOS((DBLE(K) + 0.5D0) * PI / 2.0D0)
        SA = DSIN((DBLE(K) + 0.5D0) * PI / 2.0D0)
        CALL XLINE(0.406D0 * CA, 4.104D0, 0.406D0 * SA,
     &             0.406D0 * CA, 4.51D0, 0.406D0 * SA, 0)
   40 CONTINUE
C     Panels, opaque.
      CALL XOCC(4, P1, 1.0D0)
      CALL XOCC(4, P1, -1.0D0)
      CALL XOCC(4, P3, 1.0D0)
      CALL XOCC(4, P4, 1.0D0)
      CALL XOCC(4, P5, 1.0D0)
      CALL XOCC(4, P5, -1.0D0)
C     Side consoles, aft bulkhead to the panels' plane; each tier and
C     riser opaque (OCPOLY).
      DO 60 J = -1, 1, 2
        SY = DBLE(J)
        DO 55 K = 1, 6
          CALL XLINE(SY * CN(2,K), CN(1,K), 0.686D0,
     &               SY * CN(2,K), CN(1,K), 1.575D0, 0)
          IF (K .EQ. 6) GO TO 55
          CALL SETV(QC(1,1), CN(1,K), CN(2,K), 0.686D0)
          CALL SETV(QC(1,2), CN(1,K+1), CN(2,K+1), 0.686D0)
          CALL SETV(QC(1,3), CN(1,K+1), CN(2,K+1), 1.575D0)
          CALL SETV(QC(1,4), CN(1,K), CN(2,K), 1.575D0)
          CALL OCPOLY(4, QC, SY)
          CALL XLINE(SY * CN(2,K), CN(1,K), 0.686D0,
     &               SY * CN(2,K+1), CN(1,K+1), 0.686D0, 0)
          CALL XLINE(SY * CN(2,K), CN(1,K), 1.575D0,
     &               SY * CN(2,K+1), CN(1,K+1), 1.575D0, 0)
   55   CONTINUE
   60 CONTINUE
C     Alignment optical telescope.
      CALL SETV(C, 3.757D0, 0.0D0, 1.016D0)
      CALL XRING(C, 1, 0.1D0, 8)
      CALL SETV(C, 4.169D0, 0.0D0, 1.016D0)
      CALL XRING(C, 1, 0.1D0, 8)
      DO 70 K = 0, 3
        CA = 0.1D0 * DCOS(DBLE(K) * PI / 2.0D0)
        SA = 0.1D0 * DSIN(DBLE(K) * PI / 2.0D0)
        CALL XLINE(CA, 3.757D0, 1.016D0 + SA, CA, 4.169D0,
     &             1.016D0 + SA, 0)
   70 CONTINUE
      RETURN
      END
C
C     XPOLY: free lines through the N points P (X, Y, Z, body metres),
C     back to the first if ICL = 1; Y is multiplied by SY (-1 mirrors).
      SUBROUTINE XPOLY(N, P, ICL, SY)
      INTEGER N, ICL
      DOUBLE PRECISION P(3,N), SY
      INTEGER K, J, M
      M = N - 1
      IF (ICL .EQ. 1) M = N
      DO 10 K = 1, M
        J = MOD(K, N) + 1
        CALL XLINE(SY * P(2,K), P(1,K), P(3,K),
     &             SY * P(2,J), P(1,J), P(3,J), 0)
   10 CONTINUE
      RETURN
      END
C
C     XWIN: a window of the cabin being built, its N corners P as
C     XPOLY takes them: drawn as a closed outline, and kept (WKEEP).
      SUBROUTINE XWIN(N, P, SY)
      INTEGER N
      DOUBLE PRECISION P(3,N), SY
      CALL XPOLY(N, P, 1, SY)
      CALL WKEEP(N, P, SY)
      RETURN
      END
C
C     WKEEP: a window of the cabin being built, kept in /CWIN/ for the
C     window mask (vmask.f), not drawn.
      SUBROUTINE WKEEP(N, P, SY)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER N
      DOUBLE PRECISION P(3,N), SY
      INTEGER K
      IF (NWIN .GE. MWIN .OR. N .GT. MWV) RETURN
      NWIN = NWIN + 1
      NWV(NWIN) = N
      WMOD(NWIN) = MDBLD
      DO 10 K = 1, N
        WBV(1,K,NWIN) = P(1,K)
        WBV(2,K,NWIN) = SY * P(2,K)
        WBV(3,K,NWIN) = P(3,K)
   10 CONTINUE
      RETURN
      END
C
C     XOCC: an opaque face of the cabin being built, its N corners P
C     as XPOLY takes them: drawn as a closed outline, and kept as an
C     occluder (OCPOLY).
      SUBROUTINE XOCC(N, P, SY)
      INTEGER N
      DOUBLE PRECISION P(3,N), SY
      CALL XPOLY(N, P, 1, SY)
      CALL OCPOLY(N, P, SY)
      RETURN
      END
C
C     OCPOLY: an opaque face of the cabin being built, not drawn: the
C     N corners P (X, Y, Z, body metres, Y times SY), convex, kept in
C     /COCC/ as a fan of triangles for the cabin's hidden lines
C     (vmask.f CBCUT).  A triangle is plane whatever its corners, so a
C     face need not be quite plane.
      SUBROUTINE OCPOLY(N, P, SY)
      INTEGER N
      DOUBLE PRECISION P(3,N), SY
      DOUBLE PRECISION A(3), B(3), C(3)
      INTEGER K, I
      DO 20 K = 2, N - 1
        DO 10 I = 1, 3
          A(I) = P(I,1)
          B(I) = P(I,K)
          C(I) = P(I,K+1)
   10   CONTINUE
        A(2) = SY * A(2)
        B(2) = SY * B(2)
        C(2) = SY * C(2)
        CALL OCTRI(A, B, C)
   20 CONTINUE
      RETURN
      END
C
C     OCSTRP: an opaque ring, not drawn: the strip between the closed
C     outlines PIN and POUT of N corners each (body metres), corner K
C     of one facing corner K of the other, as triangles (OCTRI).  A
C     face with a hole: the forward bulkhead about the CM's tunnel.
      SUBROUTINE OCSTRP(N, PIN, POUT)
      INTEGER N
      DOUBLE PRECISION PIN(3,N), POUT(3,N)
      DOUBLE PRECISION A(3), B(3), C(3), D(3)
      INTEGER K, L, I
      DO 20 K = 1, N
        L = MOD(K, N) + 1
        DO 10 I = 1, 3
          A(I) = PIN(I,K)
          B(I) = PIN(I,L)
          C(I) = POUT(I,L)
          D(I) = POUT(I,K)
   10   CONTINUE
        CALL OCTRI(A, B, C)
        CALL OCTRI(A, C, D)
   20 CONTINUE
      RETURN
      END
C
C     OCTRI: triangle A, B, C (body metres) of the cabin being built
C     (MDBLD), into /COCC/; counted in NOCX if the table is full.
      SUBROUTINE OCTRI(A, B, C)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION A(3), B(3), C(3)
      INTEGER I
      IF (NOC .LT. MOC) GO TO 5
      NOCX = NOCX + 1
      RETURN
    5 NOC = NOC + 1
      OCMOD(NOC) = MDBLD
      DO 10 I = 1, 3
        OCV(I,1,NOC) = A(I)
        OCV(I,2,NOC) = B(I)
        OCV(I,3,NOC) = C(I)
   10 CONTINUE
      RETURN
      END
C
C     XRING: a free-line circle, N sides, radius R about C (X, Y, Z,
C     body metres) square to body axis IA (1 X, 2 Y, 3 Z).
      SUBROUTINE XRING(C, IA, R, N)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION C(3), R
      INTEGER IA, N
      DOUBLE PRECISION A(3), B(3), T1, T2
      INTEGER K, I, I1, I2
      I1 = MOD(IA, 3) + 1
      I2 = MOD(IA + 1, 3) + 1
      DO 20 K = 1, N
        T1 = 2.0D0 * PI * DBLE(K - 1) / DBLE(N)
        T2 = 2.0D0 * PI * DBLE(K) / DBLE(N)
        DO 10 I = 1, 3
          A(I) = C(I)
          B(I) = C(I)
   10   CONTINUE
        A(I1) = C(I1) + R * DCOS(T1)
        A(I2) = C(I2) + R * DSIN(T1)
        B(I1) = C(I1) + R * DCOS(T2)
        B(I2) = C(I2) + R * DSIN(T2)
        CALL XLINE(A(2), A(1), A(3), B(2), B(1), B(3), 0)
   20 CONTINUE
      RETURN
      END

