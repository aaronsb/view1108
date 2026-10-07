C=======================================================================
C
C     V I E W - 1 1 0 8          STATE SOURCE
C
C     The one place the display side gets the CSM's, the LM's and
C     the S-IVB's states.  It reads
C     the replay (the scenario's legs, traj.f) or, when the frame asks
C     for it (in_src, which the chassis passes as in_flags bit 3) and
C     the tape covers the time, the tape the engine wrote (tape.f,
C     sim.f) or the deck held (vdktap.f).  Scene cameras and layers do
C     not know which.  One relocatable element of the kernel; see
C     vdrive.f for the list.
C
C=======================================================================
C
C     VSTATE: vehicle IVEH (1 the CSM, 2 the LM, 3 the S-IVB) at GET,
C     about the Earth (IBODY = 1, geocentric EQ) or the Moon (IBODY =
C     2, selenocentric EQ), km and km/s.  IOK = 0 if there is no state
C     for it (the LM outside LMSTAT's rules, the S-IVB outside SIVST's,
C     traj.f), 1 if there is, 2 for the LM docked to the CSM (the
C     CSM's state) or the S-IVB with the CSM (SIVST).  The CSM always
C     has one.
C     The CSM's from CSMST.
      SUBROUTINE VSTATE(GET, IVEH, IBODY, R, V, IOK)
      DOUBLE PRECISION GET, R(3), V(3), PM(3), VM(3)
      INTEGER IVEH, IBODY, IOK, I
      IOK = 1
      IF (IVEH .EQ. 2) GO TO 30
      IF (IVEH .EQ. 3) GO TO 50
      CALL CSMST(GET, IBODY, R, V)
      RETURN
C     The LM: relative to the Moon (LMSTAT), then geocentric if asked.
   30 CALL LMSTAT(GET, R, V, IOK)
      IF (IOK .EQ. 0 .OR. IBODY .EQ. 2) RETURN
      CALL MOONV(GET, PM, VM)
      DO 40 I = 1, 3
        R(I) = R(I) + PM(I)
        V(I) = V(I) + VM(I)
   40 CONTINUE
      RETURN
C     The S-IVB: geocentric (SIVST), then relative to the Moon if asked.
   50 CALL SIVST(GET, R, V, IOK)
      IF (IOK .EQ. 0 .OR. IBODY .EQ. 1) RETURN
      CALL MOONV(GET, PM, VM)
      DO 60 I = 1, 3
        R(I) = R(I) - PM(I)
        V(I) = V(I) - VM(I)
   60 CONTINUE
      RETURN
      END
C
C     CSMST: the CSM at GET about the Earth (IBODY = 1) or the Moon
C     (IBODY = 2), as VSTATE.  ISRCU records the source used: 0
C     replay, 1 sim with state vector updates, 2 sim without, 3 a tape
C     read from the deck (vdktap.f).  The LM's
C     own legs are read from the replay only (the tape carries the
C     CSM).  From the scenario's entry interface (its EI event, TETP)
C     on, the CSM is the replay's too: the engine flies in a vacuum,
C     the entry leg (a TABLE, traj.f) through the atmosphere (ours).
C     The LM's and the S-IVB's rules (LMSTAT, SIVST) call this, not
C     VSTATE, which calls them: FORTRAN V has no recursion.
      SUBROUTINE CSMST(GET, IBODY, R, V)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, R(3), V(3), PM(3), VM(3)
      INTEGER IBODY, I, ITP
      ISRCU = 0
      IF (ISRC .NE. 1 .OR. ITPSN .NE. ISN) GO TO 20
      IF (TETP .GE. 0.0D0 .AND. GET .GT. TETP) GO TO 20
      CALL TPGET(1, GET, R, V, ITP)
      IF (ITP .EQ. 0) GO TO 20
      ISRCU = 2 - MOD(ISIMF, 2)
      IF (ISIMF .LT. 0) ISRCU = 3
      IF (IBODY .EQ. 1) RETURN
      CALL MOONV(GET, PM, VM)
      DO 10 I = 1, 3
        R(I) = R(I) - PM(I)
        V(I) = V(I) - VM(I)
   10 CONTINUE
      RETURN
   20 IF (IBODY .EQ. 1) CALL ERTORB(GET, R, V)
      IF (IBODY .EQ. 2) CALL LUNORB(GET, 1, R, V)
      RETURN
      END
C
C     CSMSL: the CSM relative to the Moon (EQ km, km/s) on whichever leg
C     holds GET: a lunar one (LUNIN), else from its state about the
C     Earth less the Moon's (CSMST about the Moon alone would take the
C     nearest lunar leg).  For the LM's CSM-relative states and ranges.
      SUBROUTINE CSMSL(GET, R, V)
      DOUBLE PRECISION GET, R(3), V(3), PM(3), VM(3)
      INTEGER I, LUNIN
      IF (LUNIN(GET) .EQ. 0) GO TO 10
      CALL CSMST(GET, 2, R, V)
      RETURN
   10 CALL CSMST(GET, 1, R, V)
      CALL MOONV(GET, PM, VM)
      DO 20 I = 1, 3
        R(I) = R(I) - PM(I)
        V(I) = V(I) - VM(I)
   20 CONTINUE
      RETURN
      END
C
C     SIMERR: for the header, the reference row nearest GET that the
C     last engine run passed: its g.e.t. and the position (km) and
C     velocity (ft/s) error there.  JN = 0 if there is none.
      SUBROUTINE SIMERR(GET, JN, TR, EP, EV)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, TR, EP, EV, D, DB
      INTEGER JN, J
      JN = 0
      TR = 0.0D0
      EP = 0.0D0
      EV = 0.0D0
      IF (ITPSN .NE. ISN) RETURN
      DB = 1.0D30
      DO 10 J = 1, NRF
        IF (RFOK(J) .EQ. 0) GO TO 10
        D = DABS(RFP(3,J) - GET)
        IF (D .GE. DB) GO TO 10
        DB = D
        JN = J
   10 CONTINUE
      IF (JN .EQ. 0) RETURN
      TR = RFP(3,JN)
      EP = RFERR(1,JN)
      EV = RFERR(2,JN)
      RETURN
      END
