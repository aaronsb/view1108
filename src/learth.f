C=======================================================================
C
C     V I E W - 1 1 0 8          LAYER 5  EARTH
C
C     Layer element.  One relocatable element of
C     the kernel; see vdrive.f for the list.
C
C=======================================================================
C
C=======================================================================
C     EARTH.  Limb, coastlines (Natural Earth, turned by GMST), the
C     terminator, and the night side hatched with meridians every
C     10 deg.  Everything behind the Moon is dropped.
C=======================================================================
      SUBROUTINE DEARTH(GET, VB, NV, SB, NS, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, VB(5,MAXV), SB(3,MAXS), LB(4,MAXL)
      INTEGER NV, NS, NL
      DOUBLE PRECISION D, AE, C(3), U(3), P(3), Q(3), X, Y, VNRM
      DOUBLE PRECISION OCCL
      INTEGER I, K, J, IOK, IP, LMOCC
      D = VNRM(EPOS)
      IF (D .LE. RE * 1.0001D0) RETURN
      AE = DASIN(RE / D)
      DO 10 I = 1, 3
        U(I) = EPOS(I) / D
        C(I) = -U(I)
   10 CONTINUE
      IF (U(1)*CB(1) + U(2)*CB(2) + U(3)*CB(3) .LT.
     &    DCOS(DMIN1(THVIEW * DR + AE, PI))) RETURN
C
C     Limb.
      IVMODE = 2
      CALL CIRCLE(VB, NV, EPOS, RE, C, DACOS(RE / D), 360)
C
C     Coastlines.
      IVMODE = 1
      DO 30 K = 1, NCST
        IP = 0
        DO 20 J = KCST(K), KCST(K+1) - 1
          CALL MXV(MEF, CEV(1,J), Q)
          DO 15 I = 1, 3
            P(I) = EPOS(I) + RE * Q(I)
   15     CONTINUE
          CALL PEN(VB, NV, P, IP)
          IP = 1
   20   CONTINUE
   30 CONTINUE
C
C     Terminator.
      CALL CIRCLE(VB, NV, EPOS, RE, SUNU, 0.5D0 * PI, 180)
C
C     Night side shading (SHADE), unless the situation turns it off
C     (JDRW bit 1: from low orbit, where the film shows none).
      IF (MOD(JDRW, 2) .EQ. 0) CALL SHADE(VB, NV, EPOS, RE, 4)
      IVMODE = 0
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (MOD(IFLG, 2) .EQ. 1 .AND. AE .LT. 0.3D0 * FOVH * DR) THEN
        CALL PROJ(EPOS, X, Y, IOK)
        IF (IOK .EQ. 1) THEN
          IF (OCCL(EPOS, MPOS, RM) .LE. 0.0D0) THEN
            IF (NACT .EQ. 0 .OR. LMOCC(EPOS, 0) .EQ. 0)
     &        CALL LABEL(LB, NL, X, Y, 4, 0)
          END IF
        END IF
      END IF
C     RESTOMOD END
C     The launch pad, with a label level set, once the disc is too big
C     to carry the EARTH name (DPAD; the rule is ours).
      IF (ILABL .GE. 1 .AND. AE .GE. 0.3D0 * FOVH * DR)
     &  CALL DPAD(VB, NV, LB, NL)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     DPAD: the scenario's launch pad (its PAD card) as a small boxed
C     X, the mark the Moon view gives the Apollo 11 landing site
C     (DMOON6), and its name (LB kind 9) beside it.  A modern
C     addition (ours), drawn only with a label level set (in_lablv
C     1-3; DEARTH), at the pad's place on the drawn Earth (PADEF).
C     Hidden on the Earth's far side and behind the Moon or a placed
C     model (ISVIS mode 1).
C-----------------------------------------------------------------------
      SUBROUTINE DPAD(VB, NV, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), LB(4,MAXL)
      INTEGER NV, NL
      DOUBLE PRECISION U(3), EN(3), Q(3), P(3), X, Y, W, H, D, R(3)
      DOUBLE PRECISION C(3), AT(3,3)
      INTEGER I, IOK, ISVIS
      CALL PADEF(U, EN, IOK)
      IF (IOK .EQ. 0) RETURN
      CALL MXV(MEF, U, Q)
      DO 10 I = 1, 3
        P(I) = EPOS(I) + RE * Q(I)
   10 CONTINUE
C     Where the launch complex is placed (vdrive.f PADPL) it stands for
C     the mark: the name alone, 20 ft above the umbilical tower's top,
C     on the complex's own foot (PADAX; ours).
      IF (MDON(KPAD) .EQ. 0) GO TO 20
      DO 12 I = 1, 3
        C(I) = -EPOS(I)
   12 CONTINUE
      CALL PADAX(C, AT, R, IOK)
      H = (MNDH + MLPED + MLBH + LUTH + 20.0D0) * 0.3048D-3
      D = LUTZ * 0.3048D-3
      DO 15 I = 1, 3
        P(I) = R(I) + H * AT(I,1) - D * AT(I,3)
   15 CONTINUE
   20 CONTINUE
      IF (P(1)*CB(1) + P(2)*CB(2) + P(3)*CB(3) .LE. 0.0D0) RETURN
      IVMODE = 1
      IF (ISVIS(P) .EQ. 0) GO TO 90
      CALL PROJ(P, X, Y, IOK)
      IF (IOK .EQ. 0) GO TO 90
      W = 0.012D0 * FOVH
      IF (MDON(KPAD) .EQ. 0) CALL BOXX(VB, NV, X, Y, W)
      IF (ILEV .GE. 1) CALL LABEL(LB, NL, X + W, Y + W, 9, 0)
   90 IVMODE = 0
      RETURN
      END
C
C-----------------------------------------------------------------------
C     PADEF: the scenario's launch pad (its PAD card) on the drawn
C     Earth, Earth fixed: U the unit vector up to it, EN the unit
C     vector north there; IOK 0 if the scenario has no pad.  The
C     coastlines are geodetic latitudes placed on a sphere and turned
C     with the Earth (MEF, VFRAME), so the pad goes on the same
C     footing: a geocentric latitude is made geodetic first, TAN(GD) =
C     TAN(GC) / (1 - F)**2, F the flattening STATEV uses.  DPAD's mark
C     and the launch complex (vdrive.f PADAX) stand there.
C-----------------------------------------------------------------------
      SUBROUTINE PADEF(U, EN, IOK)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION U(3), EN(3), F, FI, LA
      INTEGER IOK
      IOK = 0
      IF (PADCH(8 * (ISN - 1) + 1) .EQ. 0) RETURN
      IOK = 1
      F = 1.0D0 / 298.257D0
      FI = SNPLA(ISN) * DR
      IF (SNPGC(ISN) .EQ. 1) FI = DATAN(DTAN(FI) / (1.0D0 - F)**2)
      LA = SNPLO(ISN) * DR
      U(1) = DCOS(FI) * DCOS(LA)
      U(2) = DCOS(FI) * DSIN(LA)
      U(3) = DSIN(FI)
      EN(1) = -DSIN(FI) * DCOS(LA)
      EN(2) = -DSIN(FI) * DSIN(LA)
      EN(3) = DCOS(FI)
      RETURN
      END
