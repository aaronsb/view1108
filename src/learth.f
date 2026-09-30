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
C     Night side shading (SHADE), not from low orbit, where the film
C     shows none.
      IF (ISCN .NE. 3) CALL SHADE(VB, NV, EPOS, RE, 4)
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
      RETURN
      END
