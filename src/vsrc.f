C=======================================================================
C
C     V I E W - 1 1 0 8          STATE SOURCE
C
C     The one place the display side gets the CSM's state.  It reads
C     the replay (the scenario's legs, traj.f) or, when the frame asks
C     for it (in_src, which the chassis passes as in_flags bit 3) and
C     the tape covers the time, the tape
C     the engine wrote (tape.f, sim.f).  Scene cameras and layers do
C     not know which.  One relocatable element of the kernel; see
C     vdrive.f for the list.
C
C=======================================================================
C
C     VSTATE: the CSM at GET, about the Earth (IBODY = 1, geocentric
C     EQ) or the Moon (IBODY = 2, selenocentric EQ), km and km/s.
C     ISRCU records the source used: 0 replay, 1 sim with state
C     vector updates, 2 sim without.
      SUBROUTINE VSTATE(GET, IBODY, R, V)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, R(3), V(3), PM(3), VM(3)
      INTEGER IBODY, IOK, I
      ISRCU = 0
      IF (ISRC .NE. 1 .OR. ITPSN .NE. ISN) GO TO 20
      CALL TPGET(1, GET, R, V, IOK)
      IF (IOK .EQ. 0) GO TO 20
      ISRCU = 2 - MOD(ISIMF, 2)
      IF (IBODY .EQ. 1) RETURN
      CALL MOONV(GET, PM, VM)
      DO 10 I = 1, 3
        R(I) = R(I) - PM(I)
        V(I) = V(I) - VM(I)
   10 CONTINUE
      RETURN
   20 IF (IBODY .EQ. 1) CALL ERTORB(GET, R, V)
      IF (IBODY .EQ. 2) CALL LUNORB(GET, R, V)
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
      DO 10 J = 1, NREF
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
