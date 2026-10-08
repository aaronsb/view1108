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
C         yaw, pitch and roll are offsets from it.  A target with no
C         point of its own here (the camera's own vehicle, one docked
C         to it or carried with it, one with no state) leaves the
C         scene's aim; hdr 23 says which (TGTPOS), for the page.
C       Stations (in_view 2, 3): the camera at the CM or LM eye, the
C         cabin around it (STATCM, STATLM), its interior with in_flags
C         bit 4 (CMINT, LMINT; the LM descent too, LDCAB).
C       External view (in_view 1): the camera sits D from the target
C         and looks at it; yaw and pitch carry it around the target
C         (starting from the side the scene's own camera is on), roll
C         turns the picture, the field of view zooms.  D is ours: 60 m
C         for the CSM, the docked stack or the S-IVB, 40 m for the
C         LM, 60,000 km for the Earth, 36,737 km (35,000 km up, as
C         scene 6) for the Moon.  The Sun is a target only for the
C         window view.  A docked or carried vehicle is flown round at
C         the point of the vehicle it is with; a target with no point
C         gives way to the situation's subject, else the Earth.
C     A situation with FIXED=YES (the Moon view's body-centred camera)
C     keeps its own camera and ignores both.
C=======================================================================
C
C-----------------------------------------------------------------------
C     VIEWPT: apply the view and target to the camera: CG (geocentric,
C     km) may move, BREF, UREF, RREF may turn, and placed models are
C     carried along.  LOOKD = 1 if the camera axes are already set
C     (external view), so VFRAME skips its free-look step.  ITGST, the
C     target's status (hdr 23; see TGTPOS), is taken before anything
C     is placed for the external view.
C-----------------------------------------------------------------------
      SUBROUTINE VIEWPT(GET, PM, CG, YAW, PIT, ROL, LOOKD)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, PM(3), CG(3), YAW, PIT, ROL
      INTEGER LOOKD
      DOUBLE PRECISION TG(3), D(3), DIST, DS(3), CG0(3), P(3), VDOT
      DOUBLE PRECISION C
      INTEGER IT, IST, IOK, I, KCSPL
      LOOKD = 0
      ITGST = 0
      IVUSE = IVIEW
C     The situation's own view where in_view is 0 (JVW; the docked
C     stack's is the external one).
      IF (IVUSE .EQ. 0) IVUSE = JVW
C     A crew-station recipe is that station already; asked for as
C     one, it gets the cabin (the LM's: JVEH 2, in_view 3).
      IF (JRCP .EQ. 3 .AND. IVUSE .EQ. JVEH + 1) CALL LDCAB(GET)
      IF (JRCP .EQ. 3 .AND. IVUSE .EQ. JVEH + 1) IVUSE = 0
      IF (JFIX .EQ. 1) IVUSE = 0
      IT = ITARG
      IF (JFIX .EQ. 1) RETURN
C     Stations: the camera moves to the eye, the cabin goes around it.
C     Where the scene has no such vehicle, the window view.
      IF (IVUSE .EQ. 2) CALL STATCM(CG, IOK)
      IF (IVUSE .EQ. 2 .AND. IOK .EQ. 0) IVUSE = 0
      IF (IVUSE .EQ. 3) CALL STATLM(CG, IOK)
      IF (IVUSE .EQ. 3 .AND. IOK .EQ. 0) IVUSE = 0
C     The LM station keeps its window's own aim (its overlay is drawn in
C     the reference frame, OVLPD).
      IF (IVUSE .EQ. 3) RETURN
      IF (IVUSE .NE. 1 .AND. IT .EQ. 0) RETURN
      IF (IT .NE. 0) CALL TGTPOS(GET, IT, PM, CG, TG, DIST, ITGST)
      IF (IVUSE .EQ. 1) GO TO 5
C     A window or the CM station aims only at a point of the target's
C     own: not its own vehicle, nor one docked to it or carried with
C     it, nor one with no state.
      IF (ITGST .NE. 1) RETURN
      GO TO 8
C     External: a target with no point to fly round (no state, the
C     Sun) gives way to the situation's subject, and that, where it
C     has none either, to the Earth (ours), so the camera always
C     leaves the eye before the CSM is placed around it.
    5 IF (IT .EQ. 0 .OR. ITGST .EQ. 4) CALL TGTDEF(GET, IT)
      CALL TGTPOS(GET, IT, PM, CG, TG, DIST, IST)
      IF (IST .EQ. 4) IT = 1
C     Seen from outside, a camera riding the CSM in its own view (JRID
C     1: situations 1, 2, 3, 4, 7, 9) shows the CSM: its origin
C     (CSMBLD) 1.2 m behind the eye along the reference boresight, its
C     X axis along that boresight (ours); after CM/SM separation the
C     CM alone.  The target's point is then taken again: the CSM's is
C     the top of the tunnel of the CSM placed here.
      IF (KCSPL() .EQ. 0 .AND. JRID .EQ. 1) CALL CSMCAM(GET)
      CALL TGTPOS(GET, IT, PM, CG, TG, DIST, IST)
    8 DO 10 I = 1, 3
        CG0(I) = CG(I)
        D(I) = TG(I) - CG(I)
   10 CONTINUE
C     Reference boresight at the target, up kept as near the scene's
C     as it can be.
      IF (VDOT(D, D) .LE. 1.0D-18) GO TO 21
      CALL VUNIT(D)
      DO 20 I = 1, 3
        BREF(I) = D(I)
   20 CONTINUE
      GO TO 22
C     A target at the camera's own point (a vehicle docked to it or
C     carried with it, seen from outside) keeps the scene's boresight,
C     made unit: LOCALVERT about the Earth builds it from the velocity's
C     direction, which off a circular orbit is not square to the radius,
C     so after TLI it is short (0.64 at 4:00), and the external camera
C     backed off along it sat too close and looked nowhere (#70).
   21 CALL VUNIT(BREF)
   22 CONTINUE
      C = VDOT(UREF, BREF)
      DO 25 I = 1, 3
        UREF(I) = UREF(I) - C * BREF(I)
   25 CONTINUE
      IF (VDOT(UREF, UREF) .LT. 1.0D-12) CALL PERP(BREF, UREF, P)
      CALL VUNIT(UREF)
      CALL VCRS(BREF, UREF, RREF)
      CALL VUNIT(RREF)
      IF (IVUSE .NE. 1) RETURN
C
C     External: free-look sets the direction, the camera backs off
C     along it to DIST from the target.  A situation with XSTART (JXOF;
C     the docking, whose reference looks down the docking axis, where
C     the CSM's solids hide the LM it docks with) starts QXY round:
C     there 60 deg round and 25 deg up (ours).
      IF (JXOF .EQ. 1) CALL LOOK(YAW + QXY(1), PIT + QXY(2), ROL)
      IF (JXOF .NE. 1) CALL LOOK(YAW, PIT, ROL)
      LOOKD = 1
      DO 30 I = 1, 3
        CG(I) = TG(I) - DIST * CB(I)
        DS(I) = CG0(I) - CG(I)
   30 CONTINUE
C     Carry the placed models, shifted by DS.
      CALL MSHIFT(DS, 0)
      RETURN
      END
C
C     TGTDEF: the situation's default external target at GET (its
C     VIEWS card): JTGT, or JTGF where the recipe's off-leg fallback
C     applies (no LUNAR leg holds the GET, LUNIN).
      SUBROUTINE TGTDEF(GET, IT)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET
      INTEGER IT, LUNIN
      IT = JTGT
      IF (JFAL .EQ. 1 .AND. LUNIN(GET) .EQ. 0) IT = JTGF
      RETURN
      END
C
C-----------------------------------------------------------------------
C     TGTPOS: target IT's geocentric position TG (km), the external
C     view's distance DIST (km) and its status IST (hdr 23, ITGST):
C       1 a point of its own: a body, a placed model (the CSM, KCSPL;
C         the LM, KLMPL; the S-IVB), or a vehicle's own state (VSTATE
C         IOK 1);
C       2 the vehicle the camera rides (IRIDE), unplaced;
C       3 docked to or carried with another vehicle (VSTATE IOK 2: the
C         LM docked, the S-IVB with the CSM before SEP or docked to the
C         stack), TG that vehicle's point; in a window view also a
C         point at the camera itself;
C       4 no point here: no state, or the Sun from outside;
C       5 as 3, the LM before the separation (SEP): stowed in the SLA
C         on the S-IVB, docked to nothing yet.
C     The caller aims at 1, and from outside at 3 and 5 too.
C-----------------------------------------------------------------------
      SUBROUTINE TGTPOS(GET, IT, PM, CG, TG, DIST, IST)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, PM(3), CG(3), TG(3), DIST, R(3), V(3)
      DOUBLE PRECISION D, C(3), W(3), EVGET
      INTEGER IT, IST, I, IOK, KL, IRIDE, KC, KCSPL, KLMPL, IVEH
      IST = 1
      DIST = 0.0D0
      IVEH = 0
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
        IF (IVUSE .EQ. 1) IST = 4
      ELSE IF (IT .EQ. 4) THEN
        DIST = 0.060D0
        KC = KCSPL()
        IF (KC .NE. 0) THEN
C         The placed CSM (or CM): aim at the top of its tunnel.
          DO 30 I = 1, 3
            TG(I) = CG(I) + MDP(I,KC) + 3.2D-3 * MDAT(I,1,KC)
   30     CONTINUE
        ELSE IF (IRIDE() .NE. 1) THEN
          IVEH = 1
        ELSE
          IST = 2
        END IF
      ELSE IF (IT .EQ. 5) THEN
        DIST = 0.040D0
        KL = KLMPL()
        IF (KL .NE. 0) THEN
          DO 50 I = 1, 3
            TG(I) = CG(I) + MDP(I,KL)
   50     CONTINUE
        ELSE IF (IRIDE() .NE. 2) THEN
          IVEH = 2
        ELSE
          IST = 2
        END IF
      ELSE
        DIST = 0.060D0
        IF (MDON(KSIV) .EQ. 1) THEN
C         The placed S-IVB: aim at its centre, the point of its state
C         (SIVST), half its 61.3 ft below the IU's top (SIVBMD).
          CALL SETV(C, (-0.5D0 * (58.3D0 + 3.0D0) * 0.3048D0
     &      - MDBO(1,KSIV)) * 1.0D-3, -MDBO(2,KSIV) * 1.0D-3,
     &      -MDBO(3,KSIV) * 1.0D-3)
          CALL MXV(MDAT(1,1,KSIV), C, W)
          DO 70 I = 1, 3
            TG(I) = CG(I) + MDP(I,KSIV) + W(I)
   70     CONTINUE
        ELSE
          IVEH = 3
        END IF
      END IF
C     RESTOMOD END
C     An unplaced vehicle: its state, its own (1), another's (3: the
C     CSM's before SEP or docked; 5 the LM in the SLA), or none (4).
      IF (IVEH .EQ. 0) GO TO 80
      CALL VSTATE(GET, IVEH, 1, R, V, IOK)
      IST = 4
      IF (IOK .EQ. 1) IST = 1
      IF (IOK .EQ. 2) IST = 3
      IF (IVEH .EQ. 2 .AND. IST .EQ. 3 .AND. GET .LT. EVGET(KESEP))
     &  IST = 5
      DO 75 I = 1, 3
        TG(I) = R(I)
   75 CONTINUE
   80 IF (IST .NE. 1 .OR. IVUSE .EQ. 1) RETURN
C     A window view cannot aim at its own camera.
      D = 0.0D0
      DO 60 I = 1, 3
        D = D + (TG(I) - CG(I))**2
   60 CONTINUE
      IF (D .LT. 1.0D-10) IST = 3
      RETURN
      END
C
C     IRIDE: the vehicle the camera rides this frame (after VIEWPT has
C     set IVUSE): in the situation's own view JRID (1 the CSM in
C     situations 1, 2, 3, 4, 7 and 9, 2 the LM in 5, 0 none in 6 and
C     8), 1 in the CM station, 2 in the LM station, 0 in the external
C     views.
      INTEGER FUNCTION IRIDE()
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      IRIDE = JRID
      IF (IVUSE .EQ. 1) IRIDE = 0
      IF (IVUSE .EQ. 2) IRIDE = 1
      IF (IVUSE .EQ. 3) IRIDE = 2
      RETURN
      END
C
C     CSMCAM: place the CSM around the scene's camera, its origin
C     (CSMBLD) 1.2 m behind the eye, X along the reference boresight, Z
C     along its up (ours).  From CM/SM separation (the scenario's
C     CMSEP event) the CM alone (KCMO).
      SUBROUTINE CSMCAM(GET)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, AT(3,3), P(3), Z(3), TS, EVGET
      INTEGER I, K
      K = KCSM
      TS = EVGET(KECMS)
      IF (TS .GE. 0.0D0 .AND. GET .GE. TS) K = KCMO
      DO 10 I = 1, 3
        AT(I,1) = BREF(I)
        AT(I,3) = UREF(I)
        P(I) = -1.2D-3 * BREF(I)
        Z(I) = 0.0D0
   10 CONTINUE
      CALL VCRS(AT(1,3), AT(1,1), AT(1,2))
      CALL MPLACE(K, AT, P, Z)
      RETURN
      END
C
C     MSHIFT: place every placed model again, shifted by DS (km); model
C     KX (0 for none) is left out, as the one the camera is inside.
      SUBROUTINE MSHIFT(DS, KX)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION DS(3), AT(3,3), P(3), BO(3)
      INTEGER KX, KP(MMOD), I, J, K
      DO 10 K = 1, NMOD
        KP(K) = MDON(K)
   10 CONTINUE
      CALL MCLEAR
      DO 30 K = 1, NMOD
        IF (KP(K) .EQ. 0 .OR. K .EQ. KX) GO TO 30
        DO 20 I = 1, 3
          P(I) = MDP(I,K) + DS(I)
          BO(I) = MDBO(I,K)
          DO 15 J = 1, 3
            AT(I,J) = MDAT(I,J,K)
   15     CONTINUE
   20   CONTINUE
        CALL MPLACE(K, AT, P, BO)
   30 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     STATCM: the CM station.  The camera at the CM eye (CMEYE), looking
C     along the CSM's +X axis with its -Z up, the view of MSC IN 69-FM-
C     197's CSM maneuver plots (see CMCAB); the cabin (KCMC) around it,
C     and with in_flags bit 4 its interior (KCMI).
C     The CSM's axes: the placed CSM's (scene 8), else X along the
C     reference boresight and Z against its up, so the station looks
C     where the window view looked (ours).  Only where the situation
C     offers it (JSCM: always, or where the CSM is placed).
C-----------------------------------------------------------------------
      SUBROUTINE STATCM(CG, IOK)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION CG(3), AT(3,3), E(3), V(3), W(3), DS(3), Z(3)
      INTEGER IOK, I, J, KC, KCSPL
      IOK = 0
      IF (JSCM .EQ. 0 .OR. (JSCM .EQ. 1 .AND. KCSPL() .EQ. 0)) RETURN
      IOK = 1
      CALL CMEYE(E)
      CALL SETV(Z, 0.0D0, 0.0D0, 0.0D0)
      KC = KCSPL()
      IF (KC .EQ. 0) GO TO 20
      DO 10 I = 1, 3
        V(I) = (E(I) - MDBO(I,KC)) * 1.0D-3
        DO 5 J = 1, 3
          AT(I,J) = MDAT(I,J,KC)
    5   CONTINUE
   10 CONTINUE
      CALL MXV(AT, V, W)
      DO 15 I = 1, 3
        W(I) = W(I) + MDP(I,KC)
        CG(I) = CG(I) + W(I)
        DS(I) = -W(I)
   15 CONTINUE
      CALL MSHIFT(DS, KC)
      GO TO 30
   20 DO 25 I = 1, 3
        AT(I,1) = BREF(I)
        AT(I,3) = -UREF(I)
   25 CONTINUE
      CALL VCRS(AT(1,3), AT(1,1), AT(1,2))
   30 DO 35 I = 1, 3
        BREF(I) = AT(I,1)
        UREF(I) = -AT(I,3)
   35 CONTINUE
      CALL VCRS(BREF, UREF, RREF)
      CALL MPLACE(KCMC, AT, Z, E)
      IF (MOD(IFLG / 16, 2) .EQ. 1) CALL MPLACE(KCMI, AT, Z, E)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     STATLM: the LM station.  The camera at the commander's design eye
C     (LDEYE) in the placed LM (scenes 4, 7, 8), looking as scene 5
C     does, LPDDN deg down from the LM's +Z in the X-Z plane; the LM
C     window and LPD overlay (OVLPD) is drawn about that aim, and with
C     in_flags bit 4 the interior (KLMI) around the eye.  Only where
C     the situation offers it (JSLM) and an LM is placed.
C-----------------------------------------------------------------------
      SUBROUTINE STATLM(CG, IOK)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION CG(3), AT(3,3), E(3), V(3), W(3), DS(3), C, S
      DOUBLE PRECISION Z(3)
      INTEGER IOK, I, J, KL, KLMPL
      IOK = 0
      KL = KLMPL()
      IF (KL .EQ. 0 .OR. JSLM .EQ. 0) RETURN
      IOK = 1
      CALL LDEYE(E)
      DO 10 I = 1, 3
        V(I) = (E(I) - MDBO(I,KL)) * 1.0D-3
        DO 5 J = 1, 3
          AT(I,J) = MDAT(I,J,KL)
    5   CONTINUE
   10 CONTINUE
      CALL MXV(AT, V, W)
      DO 15 I = 1, 3
        W(I) = W(I) + MDP(I,KL)
        CG(I) = CG(I) + W(I)
        DS(I) = -W(I)
   15 CONTINUE
      CALL MSHIFT(DS, KL)
      C = DCOS(LPDDN * DR)
      S = DSIN(LPDDN * DR)
      DO 20 I = 1, 3
        BREF(I) = C * AT(I,3) - S * AT(I,1)
        UREF(I) = S * AT(I,3) + C * AT(I,1)
   20 CONTINUE
      CALL VCRS(BREF, UREF, RREF)
      CALL VUNIT(RREF)
      CALL SETV(Z, 0.0D0, 0.0D0, 0.0D0)
      IF (MOD(IFLG / 16, 2) .EQ. 1) CALL MPLACE(KLMI, AT, Z, E)
      RETURN
      END
C
C     LDCAB: the LM crew-station recipe's camera is the commander's
C     eye; asked for as the LM station, with in_flags bit 4 the LM
C     interior goes around it, on the descending LM's axes (LMDESC).
      SUBROUTINE LDCAB(GET)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, PMF(3), XB(3), YB(3), ZB(3), AT(3,3)
      DOUBLE PRECISION E(3), Z(3)
      IF (MOD(IFLG / 16, 2) .EQ. 0) RETURN
      CALL LMDESC(GET, PMF, XB, YB, ZB)
      CALL MXV(MMF, XB, AT(1,1))
      CALL MXV(MMF, YB, AT(1,2))
      CALL MXV(MMF, ZB, AT(1,3))
      CALL LDEYE(E)
      CALL SETV(Z, 0.0D0, 0.0D0, 0.0D0)
      CALL MPLACE(KLMI, AT, Z, E)
      RETURN
      END

