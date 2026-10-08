C=======================================================================
C
C     V I E W - 1 1 0 8          THE MOVED EYE
C
C     Core element.  The viewer moves the eye (#72, #31): in a crew
C     station (in_view 2, 3, and the LM descent asked for as the LM
C     station) the eye leaves the design eye (CMEYE, LDEYE) by an
C     offset in the vehicle's body frame, clamped inside the cabin's
C     walls; in the external view the point the camera flies round
C     leaves the target.  The offset is in_eyeo (VSETEY); the one used,
C     clamped, goes back to the chassis with the camera's axes in the
C     offset's frame (VGETEY), so the page can step the eye along
C     where it looks.  One relocatable element of the kernel; see
C     vdrive.f for the list.
C
C     RESTOMOD: all of this is ours, a modern addition.  VIEW drew from
C     fixed eye points ("as seen through the spacecraft windows", TN
C     D-6853 printed p. 3), and the cabins are ours (models.f CMINT,
C     LMINT).  With the offset 0 every frame is what it was: nothing
C     here moves the camera, the cabins or the external centre unless
C     the offset is nonzero.
C=======================================================================
C
C     VSETEY: the eye offset asked for the next frame (the chassis
C     calls it before VFRAME, from in_eyeo).
      SUBROUTINE VSETEY(EO)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION EO(3)
      INTEGER I
      DO 10 I = 1, 3
        EYOI(I) = EO(I)
   10 CONTINUE
      RETURN
      END
C
C     VGETEY: after VFRAME, the offset the frame used (clamped; the
C     one asked where the frame used none), its kind K (IEYK) and the
C     camera's axes in its frame, AX (EYAX).
      SUBROUTINE VGETEY(EO, K, AX)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION EO(3), AX(3,3)
      INTEGER K, I, J
      K = IEYK
      DO 20 J = 1, 3
        EO(J) = EYOI(J)
        IF (IEYK .NE. 0) EO(J) = EYOF(J)
        DO 10 I = 1, 3
          AX(I,J) = EYAX(I,J)
   10   CONTINUE
   20 CONTINUE
      RETURN
      END
C
C     EYCLR: no offset used yet this frame (VFRAME, first).
      SUBROUTINE EYCLR
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER I, J
      IEYK = 0
      DO 20 J = 1, 3
        EYOF(J) = 0.0D0
        DO 10 I = 1, 3
          EYAT(I,J) = 0.0D0
          EYAX(I,J) = 0.0D0
   10   CONTINUE
   20 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     EYUSE: this frame's view takes the offset: kind IK (1 external,
C     2 CM station, 3 LM station), its frame's axes AT (columns, EQ:
C     the vehicle's body axes, or the target's reference axes).  OFF
C     the offset asked, clamped (EYCLMP); NZ 1 if it is not 0.
C-----------------------------------------------------------------------
      SUBROUTINE EYUSE(IK, AT, OFF, NZ)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION AT(3,3), OFF(3)
      INTEGER IK, NZ, I, J
      IEYK = IK
      DO 10 J = 1, 3
        DO 5 I = 1, 3
          EYAT(I,J) = AT(I,J)
    5   CONTINUE
   10 CONTINUE
      CALL EYCLMP(IK, OFF)
      NZ = 0
      DO 20 I = 1, 3
        EYOF(I) = OFF(I)
        IF (OFF(I) .NE. 0.0D0) NZ = 1
   20 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     EYCLMP: the offset asked (EYOI), clamped for view kind IK, in
C     OFF.  All bounds ours, from the cabin models' own walls:
C       CM (2): the eye between the floor's rim and the forward
C         bulkhead, X 0.10 to 1.50 m, and 0.15 m (about half a head)
C         inside the cone wall CMINT draws, from radius 1.777 m at X
C         0.051 to 0.754 m at X 1.626 (the couches and the console are
C         not walls: the eye can enter them);
C       LM (3): Z 0.85 to 1.45 m, between the aft bulkhead's ring (Z
C         0.686) and the front panels (Z 1.56 and up, LMINT), X 2.40
C         m and up, above the floor (X 2.094), and 0.15 m inside the
C         cabin's cylinder, radius 1.168 m about X 3.0, Y 0;
C       external (1): each component -1 to 1, the camera's distance.
C     The design eyes are inside both, so 0 stays 0.
C-----------------------------------------------------------------------
      SUBROUTINE EYCLMP(IK, OFF)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION OFF(3)
      INTEGER IK, I
      DOUBLE PRECISION E(3), P(3), R, RMAX, DX, DY
      DO 5 I = 1, 3
        OFF(I) = EYOI(I)
    5 CONTINUE
      IF (OFF(1) .EQ. 0.0D0 .AND. OFF(2) .EQ. 0.0D0 .AND.
     &    OFF(3) .EQ. 0.0D0) RETURN
      IF (IK .EQ. 2) GO TO 20
      IF (IK .EQ. 3) GO TO 40
      DO 10 I = 1, 3
        OFF(I) = DMAX1(-1.0D0, DMIN1(1.0D0, OFF(I)))
   10 CONTINUE
      RETURN
C     The CM.
   20 CALL CMEYE(E)
      DO 25 I = 1, 3
        P(I) = E(I) + OFF(I)
   25 CONTINUE
      P(1) = DMAX1(0.10D0, DMIN1(1.50D0, P(1)))
      RMAX = 1.777D0 + (0.754D0 - 1.777D0) * (P(1) - 0.051D0)
     &  / (1.626D0 - 0.051D0) - 0.15D0
      R = DSQRT(P(2) * P(2) + P(3) * P(3))
      IF (R .LE. RMAX) GO TO 60
      P(2) = P(2) * RMAX / R
      P(3) = P(3) * RMAX / R
      GO TO 60
C     The LM.
   40 CALL LDEYE(E)
      DO 45 I = 1, 3
        P(I) = E(I) + OFF(I)
   45 CONTINUE
      P(3) = DMAX1(0.85D0, DMIN1(1.45D0, P(3)))
      IF (P(1) .LT. 2.40D0) P(1) = 2.40D0
      RMAX = 1.168D0 - 0.15D0
      DX = P(1) - 3.0D0
      DY = P(2)
      R = DSQRT(DX * DX + DY * DY)
      IF (R .LE. RMAX) GO TO 60
      P(1) = 3.0D0 + DX * RMAX / R
      P(2) = DY * RMAX / R
   60 DO 65 I = 1, 3
        OFF(I) = P(I) - E(I)
   65 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     EYAXES: the camera's right, up and boresight (CR, CU, CB, after
C     free-look) in the offset's frame (EYAT), as EYAX's columns, for
C     the page to step the eye along them.  None where no view took
C     the offset.
C-----------------------------------------------------------------------
      SUBROUTINE EYAXES
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER I
      DOUBLE PRECISION VDOT
      IF (IEYK .EQ. 0) RETURN
      DO 10 I = 1, 3
        EYAX(I,1) = VDOT(EYAT(1,I), CR)
        EYAX(I,2) = VDOT(EYAT(1,I), CU)
        EYAX(I,3) = VDOT(EYAT(1,I), CB)
   10 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     EYMOVE: carry the camera CG (km) by the body offset OFF (metres)
C     in axes AT, and the placed models but KX with it, so the world
C     stays where it was (MSHIFT).
C-----------------------------------------------------------------------
      SUBROUTINE EYMOVE(AT, OFF, CG, KX)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION AT(3,3), OFF(3), CG(3)
      INTEGER KX, I
      DOUBLE PRECISION V(3), W(3), DS(3)
      DO 10 I = 1, 3
        V(I) = OFF(I) * 1.0D-3
   10 CONTINUE
      CALL MXV(AT, V, W)
      DO 20 I = 1, 3
        CG(I) = CG(I) + W(I)
        DS(I) = -W(I)
   20 CONTINUE
      CALL MSHIFT(DS, KX)
      RETURN
      END
