C=======================================================================
C
C     V I E W - 1 1 0 8          LAUNCH COMPLEX MODELS
C
C     Core element.  The launch complex's part of the spacecraft model
C     library (models.f MLIB builds it): Launch Complex 39, Pad A, the
C     mobile launcher, its umbilical tower and service arms (#97), and
C     the box builders.  One relocatable element of the kernel; see
C     vdrive.f for the list.
C
C=======================================================================
C
C-----------------------------------------------------------------------
C     PADBLD: Launch Complex 39, Pad A, with the mobile launcher (#97;
C     the sizes and their sources in viewcom.inc, MNDH to ARM9H).  Body
C     axes X up the local vertical, -Z toward the umbilical tower, Y to
C     make them right handed; origin on the vehicle's axis at the foot
C     of the pad, on the drawn Earth (vdrive.f PADAX).  Feet below.
C       Pad: a truncated pyramid MNDH high, its top MNDT square, its
C         sides at the ramp's five percent all round (ours: the pad is
C         "roughly octagonal", printed p. 168, and its slopes are not
C         given).
C       Mobile launcher: six pedestals MLPED high (8 ft square, their
C         places ours) and the base on them, a box MLBW across Y and
C         MLBL along Z, MLBH high, its deck MNDH + MLPED + MLBH above
C         the foot of the pad; the vehicle stands on the deck at the
C         base's centre (ours: the 45-foot opening it stands over is not
C         drawn, nor the hold-down arms).
C       Umbilical tower: on the base's -Z end, its centre LUTZ from the
C         vehicle's axis, LUTW square (ours) and LUTH above the deck;
C         the lowest LUTFH flared to LUTFW square (ours); the hammerhead
C         crane a box along Y, LUTCR each side of the tower's centre, 10
C         ft deep and wide, the tower's top 10 ft (ours).
C     Plain primitives, none smooth: every edge is drawn where seen.
C-----------------------------------------------------------------------
      SUBROUTINE PADBLD
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION FT, HT, HB, XB, XD, ZT, PY(2), PZ(3)
      INTEGER I, J
      DATA PY / -50.0D0, 50.0D0 /
      DATA PZ / -60.0D0, 0.0D0, 60.0D0 /
      FT = 0.3048D0
      HT = 0.5D0 * MNDT * FT
      HB = HT + MNDH / MNDG * FT
      CALL MKBOX(0.0D0, MNDH * FT, 0.0D0, 0.0D0, HB, HB, HT / HB)
      XB = (MNDH + MLPED) * FT
      DO 20 I = 1, 2
        DO 10 J = 1, 3
          CALL MKBOX(MNDH * FT, MLPED * FT, PY(I) * FT, PZ(J) * FT,
     &               4.0D0 * FT, 4.0D0 * FT, 1.0D0)
   10   CONTINUE
   20 CONTINUE
      CALL MKBOX(XB, MLBH * FT, 0.0D0, 0.0D0, 0.5D0 * MLBW * FT,
     &           0.5D0 * MLBL * FT, 1.0D0)
      XD = XB + MLBH * FT
      ZT = -LUTZ * FT
      CALL MKBOX(XD, LUTFH * FT, 0.0D0, ZT, 0.5D0 * LUTFW * FT,
     &           0.5D0 * LUTFW * FT, LUTW / LUTFW)
      CALL MKBOX(XD + LUTFH * FT, (LUTH - LUTFH - 10.0D0) * FT, 0.0D0,
     &           ZT, 0.5D0 * LUTW * FT, 0.5D0 * LUTW * FT, 1.0D0)
      CALL MKBOX(XD + (LUTH - 10.0D0) * FT, 10.0D0 * FT, 0.0D0, ZT,
     &           LUTCR * FT, 5.0D0 * FT, 1.0D0)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     ARMBLD(K1, K2, TH): service arms K1 to K2 of the umbilical
C     tower's nine (press kit, printed p. 164), in PADBLD's frame, each
C     turned TH deg about a vertical hinge at its -Y side on the
C     tower's face: 0 swung out to the vehicle, 90 swung back along the
C     face toward -Y (the hinge, its side and the sense ours).  Each a
C     box 6 ft wide and 8 ft deep (ours), as long as the reach from the
C     tower's face to the vehicle's skin at its level, AH ft above the
C     deck, AR ft from the vehicle's axis: arm 9, the Apollo access
C     arm, "at the 320-foot level above the launcher base" (ARM9H;
C     printed p. 165) to the CM's side hatch; the others' levels ours,
C     two at the S-IC, three at the S-II, two at the S-IVB and one at
C     the instrument unit.  MLIB builds arms 1-8 out and back (KARE,
C     KARR) and arm 9 out, parked at 12 deg and back (KA9E, KA9P,
C     KA9R); vdrive.f PADPL says when.
C-----------------------------------------------------------------------
      SUBROUTINE ARMBLD(K1, K2, TH)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER K1, K2
      DOUBLE PRECISION TH, FT, AH(9), AR(9), XD, ZF, O(3), AX(3)
      DOUBLE PRECISION AW(3), AN(3), C, S
      INTEGER K
      DATA AH / 60.0D0, 120.0D0, 150.0D0, 185.0D0, 212.0D0, 228.0D0,
     &  262.0D0, 279.0D0, 0.0D0 /
      DATA AR / 16.5D0, 16.5D0, 16.5D0, 16.5D0, 16.5D0, 10.83D0,
     &  10.83D0, 10.83D0, 7.0D0 /
      AH(9) = ARM9H
      FT = 0.3048D0
      XD = (MNDH + MLPED + MLBH) * FT
      ZF = -(LUTZ - 0.5D0 * LUTW) * FT
      C = DCOS(TH * DR)
      S = DSIN(TH * DR)
      CALL SETV(AX, 1.0D0, 0.0D0, 0.0D0)
      CALL SETV(AN, 0.0D0, -S, C)
      CALL SETV(AW, 0.0D0, C, S)
      IF (K2 .LT. K1) RETURN
      DO 10 K = K1, K2
        CALL SETV(O, XD + (AH(K) + 4.0D0) * FT,
     &            -3.0D0 * FT + 3.0D0 * FT * C, ZF + 3.0D0 * FT * S)
        CALL MKBAR(O, AW, AX, AN, 3.0D0 * FT, 4.0D0 * FT,
     &             -ZF - AR(K) * FT)
   10 CONTINUE
      RETURN
      END
C
C     PADHC: the height (m) of the CSM's origin (CSMBLD) above the foot
C     of the pad, the vehicle standing on the mobile launcher's deck:
C     the pad, the pedestals and the base (MNDH, MLPED, MLBH), the
C     stages (SICH, SIIH, SIVBH, SIUH) and the SLA (SLAH), less the
C     SM's aft end below the origin (SMAFT).
      DOUBLE PRECISION FUNCTION PADHC()
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION SMAFT
      PADHC = (MNDH + MLPED + MLBH + SICH + SIIH + SIVBH + SIUH + SLAH)
     &  * 0.3048D0 - SMAFT()
      RETURN
      END
C
C     MKBOX: a box on the model's X axis, from X0 for H (m), centred on
C     (YC, ZC), HY by HZ (m) each side of it across, its top scaled by
C     SC (1 a box, below 1 a truncated pyramid).
      SUBROUTINE MKBOX(X0, H, YC, ZC, HY, HZ, SC)
      DOUBLE PRECISION X0, H, YC, ZC, HY, HZ, SC
      DOUBLE PRECISION O(3), A1(3), A2(3), AN(3), P(2,4)
      CALL SETV(O, X0, YC, ZC)
      CALL SETV(A1, 0.0D0, 1.0D0, 0.0D0)
      CALL SETV(A2, 0.0D0, 0.0D0, 1.0D0)
      CALL SETV(AN, 1.0D0, 0.0D0, 0.0D0)
      P(1,1) = HY
      P(2,1) = -HZ
      P(1,2) = HY
      P(2,2) = HZ
      P(1,3) = -HY
      P(2,3) = HZ
      P(1,4) = -HY
      P(2,4) = -HZ
      CALL MKFRU(4, P, O, A1, A2, AN, H, SC)
      RETURN
      END
C
C     MKBAR: a box along AN from O, the centre of its base, for H (m),
C     HA along A1 and HB along A2 each side of it.
      SUBROUTINE MKBAR(O, A1, A2, AN, HA, HB, H)
      DOUBLE PRECISION O(3), A1(3), A2(3), AN(3), HA, HB, H, P(2,4)
      P(1,1) = HA
      P(2,1) = -HB
      P(1,2) = HA
      P(2,2) = HB
      P(1,3) = -HA
      P(2,3) = HB
      P(1,4) = -HA
      P(2,4) = -HB
      CALL MKPRS(4, P, O, A1, A2, AN, H)
      RETURN
      END
