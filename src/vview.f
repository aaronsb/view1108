C=======================================================================
C
C     V I E W - 1 1 0 8          CAMERA POINTING
C
C     Core element.  The camera target and the external view, applied
C     after the scene has set its own camera (SCNCAM) and placed its
C     models (SCNMOD).  One relocatable element of the kernel; see
C     vdrive.f for the list.
C
C     TN D-6853 (printed p. 13) offers "an inertially fixed platform
C     or a local-vertical platform".  Pointing at a target and flying
C     the camera around one are a third and fourth mode: ours.
C       Window view (in_view 0) with a target: the reference boresight
C         points from the scene's camera at the target; free-look
C         yaw, pitch and roll are offsets from it.
C       External view (in_view 1): the camera sits D from the target
C         and looks at it; yaw and pitch carry it around the target
C         (starting from the side the scene's own camera is on), roll
C         turns the picture, the field of view zooms.  D is ours: 60 m
C         for the CSM or the docked stack, 40 m for the LM, 60,000 km
C         for the Earth, 36,737 km (35,000 km up, as scene 6) for the
C         Moon.  The Sun is a target only for the window view.
C     Scene 6 keeps its own Moon-centred camera and ignores both.
C=======================================================================
C
C-----------------------------------------------------------------------
C     VIEWPT: apply the view and target to the camera: CG (geocentric,
C     km) may move, BREF, UREF, RREF may turn, and placed models are
C     carried along.  LOOKD = 1 if the camera axes are already set
C     (external view), so VFRAME skips its free-look step.
C-----------------------------------------------------------------------
      SUBROUTINE VIEWPT(GET, PM, CG, YAW, PIT, ROL, LOOKD)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, PM(3), CG(3), YAW, PIT, ROL
      INTEGER LOOKD
      DOUBLE PRECISION TG(3), D(3), DIST, DS(3), CG0(3), P(3), VDOT
      DOUBLE PRECISION AT(3,3), BO(3), C
      INTEGER IT, IOK, I, J, K, KP(MMOD)
      LOOKD = 0
      IVUSE = IVIEW
C     Scene 8's own view is the external one.
      IF (ISCN .EQ. 8 .AND. IVUSE .EQ. 0) IVUSE = 1
C     Stations (2, 3) come with the cabins; until then, the window.
      IF (IVUSE .GE. 2) IVUSE = 0
      IF (ISCN .EQ. 6) IVUSE = 0
      IT = ITARG
      IF (ISCN .EQ. 6) RETURN
      IF (IVUSE .EQ. 0 .AND. IT .EQ. 0) RETURN
C     The external view's default target is the scene's subject.
      IF (IVUSE .EQ. 1 .AND. (IT .EQ. 0 .OR. IT .EQ. 3))
     &  CALL TGTDEF(IT)
C     Seen from outside, a camera riding the CSM (scenes 1, 2, 3, 4,
C     7) shows the CSM: its outline with the CM's base 1.2 m behind
C     the eye along the scene's boresight, its X axis along that
C     boresight (ours).
      IF (IVUSE .EQ. 1 .AND. MDON(KCSM) .EQ. 0 .AND. ISCN .NE. 5
     &    .AND. ISCN .NE. 8) CALL CSMCAM
      CALL TGTPOS(GET, IT, PM, CG, TG, DIST, IOK)
      IF (IOK .EQ. 0) RETURN
      DO 10 I = 1, 3
        CG0(I) = CG(I)
        D(I) = TG(I) - CG(I)
   10 CONTINUE
C     Reference boresight at the target, up kept as near the scene's
C     as it can be.
      IF (VDOT(D, D) .LE. 1.0D-18) GO TO 22
      CALL VUNIT(D)
      DO 20 I = 1, 3
        BREF(I) = D(I)
   20 CONTINUE
   22 CONTINUE
      C = VDOT(UREF, BREF)
      DO 25 I = 1, 3
        UREF(I) = UREF(I) - C * BREF(I)
   25 CONTINUE
      IF (VDOT(UREF, UREF) .LT. 1.0D-12) CALL PERP(BREF, UREF, P)
      CALL VUNIT(UREF)
      CALL VCRS(BREF, UREF, RREF)
      CALL VUNIT(RREF)
      IF (IVUSE .EQ. 0) RETURN
C
C     External: free-look sets the direction, the camera backs off
C     along it to DIST from the target.
      CALL LOOK(YAW, PIT, ROL)
      LOOKD = 1
      DO 30 I = 1, 3
        CG(I) = TG(I) - DIST * CB(I)
        DS(I) = CG0(I) - CG(I)
   30 CONTINUE
C     Carry the placed models: place them again, shifted by DS.
      DO 40 K = 1, NMOD
        KP(K) = MDON(K)
   40 CONTINUE
      CALL MCLEAR
      DO 60 K = 1, NMOD
        IF (KP(K) .EQ. 0) GO TO 60
        DO 50 I = 1, 3
          P(I) = MDP(I,K) + DS(I)
          BO(I) = MDBO(I,K)
          DO 45 J = 1, 3
            AT(I,J) = MDAT(I,J,K)
   45     CONTINUE
   50   CONTINUE
        CALL MPLACE(K, AT, P, BO)
   60 CONTINUE
      RETURN
      END
C
C     TGTDEF: the scene's default external target: the reference body
C     (Moon in scenes 1, 5, 6; Earth in 2, 3), the LM (4, 7), the CSM
C     (8).
      SUBROUTINE TGTDEF(IT)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER IT, ID(8)
      DATA ID / 2, 1, 1, 5, 2, 2, 5, 4 /
      IT = ID(ISCN)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     TGTPOS: target IT's geocentric position TG (km) and the external
C     view's distance DIST (km).  IOK = 0 if the scene has no such
C     target, or it is the camera itself in a window view.  Vehicles:
C     the placed models (the CSM, KCSM; the LM, KLMD or KLMS), else
C     the CSM from the state source (VSTATE) where the camera is not
C     the CSM (scenes 5, 6).
C-----------------------------------------------------------------------
      SUBROUTINE TGTPOS(GET, IT, PM, CG, TG, DIST, IOK)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, PM(3), CG(3), TG(3), DIST, R(3), V(3)
      DOUBLE PRECISION D
      INTEGER IT, IOK, I, KL
      IOK = 1
      DIST = 0.0D0
      DO 5 I = 1, 3
        TG(I) = 0.0D0
    5 CONTINUE
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (IT .EQ. 1) THEN
        DIST = 60000.0D0
      ELSE IF (IT .EQ. 2) THEN
        DO 10 I = 1, 3
          TG(I) = PM(I)
   10   CONTINUE
        DIST = RM + 35000.0D0
      ELSE IF (IT .EQ. 3) THEN
        DO 20 I = 1, 3
          TG(I) = CG(I) + 1.495978707D8 * SUNU(I)
   20   CONTINUE
        IF (IVUSE .EQ. 1) IOK = 0
      ELSE IF (IT .EQ. 4) THEN
        DIST = 0.060D0
        IF (MDON(KCSM) .EQ. 1) THEN
C         The placed CSM: aim at the top of its tunnel.
          DO 30 I = 1, 3
            TG(I) = CG(I) + MDP(I,KCSM) + 3.2D-3 * MDAT(I,1,KCSM)
   30     CONTINUE
        ELSE IF (ISCN .EQ. 5 .OR. ISCN .EQ. 6) THEN
          CALL VSTATE(GET, 1, R, V)
          DO 35 I = 1, 3
            TG(I) = R(I)
   35     CONTINUE
        ELSE
          IOK = 0
        END IF
      ELSE
        DIST = 0.040D0
        KL = 0
        IF (MDON(KLMD) .EQ. 1) KL = KLMD
        IF (MDON(KLMS) .EQ. 1) KL = KLMS
        IF (KL .EQ. 0) THEN
          IOK = 0
        ELSE
          DO 50 I = 1, 3
            TG(I) = CG(I) + MDP(I,KL)
   50     CONTINUE
        END IF
      END IF
C     RESTOMOD END
      IF (IOK .EQ. 0 .OR. IVUSE .EQ. 1) RETURN
C     A window view cannot aim at its own camera.
      D = 0.0D0
      DO 60 I = 1, 3
        D = D + (TG(I) - CG(I))**2
   60 CONTINUE
      IF (D .LT. 1.0D-10) IOK = 0
      RETURN
      END
C
C     CSMCAM: place the CSM outline around the scene's camera, the CM's
C     base 1.2 m behind the eye, X along the reference boresight, Z
C     along its up (ours).
      SUBROUTINE CSMCAM
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION AT(3,3), P(3), Z(3)
      INTEGER I
      DO 10 I = 1, 3
        AT(I,1) = BREF(I)
        AT(I,3) = UREF(I)
        P(I) = -1.2D-3 * BREF(I)
        Z(I) = 0.0D0
   10 CONTINUE
      CALL VCRS(AT(1,3), AT(1,1), AT(1,2))
      CALL MPLACE(KCSM, AT, P, Z)
      RETURN
      END

