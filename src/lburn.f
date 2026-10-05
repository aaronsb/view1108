C=======================================================================
C
C     V I E W - 1 1 0 8          LAYER 10  BURN CUE
C
C     Layer element.  One relocatable element of the kernel; see
C     vdrive.f for the list.
C
C     A modern addition throughout (ours).  No source we hold shows
C     VIEW marking an engine firing: its burn plots (MSC IN 69-FM-197,
C     figures 5.1-1, 6.1-1, 7.1-1, PDF pp. 53, 113, 203) show only the
C     view out of the window.  While a vehicle fires a main engine
C     (the firings of /CBRN/: SP-4029's ignition and cutoff rows of the
C     scenario's timeline, paired by tools/gen_data.py's BURN_CUES):
C       Exhaust: its placed model gets NPL lines out of the engine's
C         exit rim, along the model's -X, opening at APL each side and
C         three of the model's lengths long, hidden by the placed solids
C         like a free line (LMSEG).  Exit planes and radii: the SPS
C         nozzle's, as CSMBLD builds it; the others ours (the models
C         have no engine bells): the descent engine at the descent
C         stage's base, the ascent engine at its top, the J-2 at the
C         S-IVB model's aft end.
C       Text: in a window or station view from the burning vehicle
C         (IRIDE), "SPS BURN", "DPS BURN", "APS BURN" or "S-IVB BURN"
C         (the S-IVB's while the CSM rides on it, before the SEP
C         event), lettered in the frame's top left corner by TXALL
C         with a label level set (in_lablv 1-3), so in_lablv 0 keeps
C         the picture it had.
C     No burn attitude is modelled: the exhaust leaves -X of the model
C     as the scene places it.
C=======================================================================
      SUBROUTINE DBURN(GET, VB, NV, SB, NS, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, VB(5,MAXV), SB(3,MAXS), LB(4,MAXL)
      INTEGER NV, NS, NL
      DOUBLE PRECISION XE(4), RE0(4), PL(4), FT, TS, EVGET
      INTEGER K, KM, IV, IE, IRIDE, KCSPL, KLMPL
      FT = 0.3048D0
C     Per engine (SPS, DPS, APS, J-2): exit plane X and radius (m, in
C     the model's body frame), plume length (m).  SPS: CSMBLD's nozzle
C     exit, 22 in + 12 ft 11 in + 9 ft 8 in aft of the CM's base,
C     radius 3 ft 11.25 in; the CSM 35 ft long (CSMBLD).  DPS, APS:
C     the descent stage's base (X 0) and top (X 1.7, LMBODY), radii
C     0.75 and 0.4 m, ours; the LM model 4.51 m to its tunnel's top
C     (STKPL), the ascent stage 2.81 m of it.  J-2: the S-IVB model's
C     aft end, 61.3 ft (SIVBMD), radius 1.0 m, ours.
      XE(1) = -(22.0D0 / 12.0D0 + 12.0D0 + 11.0D0 / 12.0D0 + 9.0D0
     &  + 8.0D0 / 12.0D0) * FT
      RE0(1) = 0.5D0 * (7.0D0 + 10.5D0 / 12.0D0) * FT
      PL(1) = 3.0D0 * 35.0D0 * FT
      XE(2) = 0.0D0
      RE0(2) = 0.75D0
      PL(2) = 3.0D0 * 4.51D0
      XE(3) = 1.7D0
      RE0(3) = 0.4D0
      PL(3) = 3.0D0 * 2.81D0
      XE(4) = -(58.3D0 + 3.0D0) * FT
      RE0(4) = 1.0D0
      PL(4) = 3.0D0 * (58.3D0 + 3.0D0) * FT
      IBRTX = 0
      DO 50 K = 1, NBR
        IF (BRSN(K) .NE. ISN) GO TO 50
        IF (GET .LT. BRT1(K) .OR. GET .GE. BRT2(K)) GO TO 50
        IV = BRVH(K)
        IE = BREN(K)
C       The text, from the vehicle the camera rides.
        IF (IVUSE .EQ. 1) GO TO 20
        IF (IV .EQ. IRIDE()) IBRTX = IE
        TS = EVGET(KESEP)
        IF (IV .EQ. 3 .AND. IRIDE() .EQ. 1 .AND. TS .GE. 0.0D0
     &      .AND. GET .LT. TS) IBRTX = IE
C       The exhaust, from the vehicle's placed model.
   20   KM = 0
        IF (IV .EQ. 1) KM = KCSPL()
        IF (KM .EQ. KCMO) KM = 0
        IF (IV .EQ. 2) KM = KLMPL()
        IF (IV .EQ. 3 .AND. MDON(KSIV) .EQ. 1) KM = KSIV
        IF (KM .NE. 0) CALL PLUME(VB, NV, KM, XE(IE), RE0(IE), PL(IE))
   50 CONTINUE
      ISTYLE = 1
      RETURN
      END
C
C-----------------------------------------------------------------------
C     PLUME: the exhaust of placed model K: NPL lines from the rim of
C     radius R0 in the plane X = XE of its body frame (m) back along
C     -X for length PLEN, opening at APL deg (ours: 8 lines, 10 deg).
C-----------------------------------------------------------------------
      SUBROUTINE PLUME(VB, NV, K, XE, R0, PLEN)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), XE, R0, PLEN
      INTEGER NV, K
      DOUBLE PRECISION APL, C, S, R1, BA(3), BB(3), A(3), B(3), W(3)
      INTEGER NPL, J, I
      NPL = 8
      APL = 10.0D0
      R1 = R0 + PLEN * DTAN(APL * DR)
      DO 30 J = 1, NPL
        C = DCOS(2.0D0 * PI * DBLE(J) / DBLE(NPL))
        S = DSIN(2.0D0 * PI * DBLE(J) / DBLE(NPL))
        CALL SETV(BA, XE - MDBO(1,K), R0 * C - MDBO(2,K),
     &            R0 * S - MDBO(3,K))
        CALL SETV(BB, XE - PLEN - MDBO(1,K), R1 * C - MDBO(2,K),
     &            R1 * S - MDBO(3,K))
        CALL MXV(MDAT(1,1,K), BA, W)
        DO 10 I = 1, 3
          A(I) = MDP(I,K) + W(I) * 1.0D-3
   10   CONTINUE
        CALL MXV(MDAT(1,1,K), BB, W)
        DO 20 I = 1, 3
          B(I) = MDP(I,K) + W(I) * 1.0D-3
   20   CONTINUE
        CALL LMSEG(VB, NV, A, B, 0, 0)
   30 CONTINUE
      RETURN
      END
