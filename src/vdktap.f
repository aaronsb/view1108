C     VDKTAP: the card reader's tape cards (#26 slice 6; the reader is
C     vdeck.f): a tape read from the deck into /CTAPE/, as the engine
C     (sim.f) would have written it.  A TAPE card names the scenario
C     and the vehicle channel; each card after it that starts with a
C     number is one sample, seven numbers: g.e.t. (s, or h:mm:ss.s),
C     then geocentric EQ position (km) and velocity (km/s), as TPPUT
C     takes them.  The tape ends at the next card with a card word, or
C     at the end of its file.  tools/vtape.f writes the engine's tape
C     in this form, every number with 17 digits so it reads back to
C     the same double (DKNMS, vdkfld.f).
C     Period term: the "trajectory ephemeris tape" of position and
C     velocity vectors that the RTACF integrator wrote for programs
C     "that contained no integrator" (Allday, TN D-6855, pp. 7-8; see
C     tape.f).  A tape of card images, its layout and its numbers'
C     digits are ours.  /CTAPE/ holds one scenario's tape: the tape
C     the engine writes, or the deck's, whichever came last (SIMRUN
C     empties it first).  The marks (TPMARK) are the engine's own and
C     are not read from a deck.  A deck tape's samples are read as
C     the engine's (vsrc.f CSMST), the source reported as 3 (ISRCU).
C
C     DKTAP: TAPE SCN= (the scenario, already read) CHAN= (1 to MXCHN,
C     default 1; channel 1 the CSM, the one vsrc.f reads).
      SUBROUTINE DKTAP
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER M, C, DKINT
      M = DKINT(YSCN, -1)
      C = DKINT(YCHAN, 1)
      IF (IDKER .NE. 0) RETURN
      IF (M .GE. 1 .AND. M .LE. MXSN .AND. C .GE. 1 .AND.
     &    C .LE. MXCHN) GO TO 10
      CALL DKERR(7)
      RETURN
   10 IF (ISNHV(M) .EQ. 0) GO TO 90
      IF (ITPSN .NE. 0 .AND. ITPSN .NE. M) GO TO 90
      IF (NTP(C) .EQ. 0) GO TO 20
      CALL DKERR(8)
      RETURN
   20 ITPSN = M
      ISIMF = -1
      ITPON = 1
      ITPCH = C
      ITPCD = NDKCD
      RETURN
   90 CALL DKERR(30)
      RETURN
      END
C
C     DKTROW: a sample of the open tape, the card's seven tokens, in
C     time order (two at one time are a burn or an update: before,
C     then after; tape.f).
      SUBROUTINE DKTROW
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER I, C
      DOUBLE PRECISION T, R(3), V(3)
      C = ITPCH
      IF (NTOK .EQ. 7) GO TO 10
      CALL DKERR(22)
      RETURN
   10 CALL DKGTS(TKS(1), TKL(1), T)
      DO 20 I = 1, 3
        CALL DKNMS(TKS(I+1), TKL(I+1), R(I))
        CALL DKNMS(TKS(I+4), TKL(I+4), V(I))
   20 CONTINUE
      IF (IDKER .NE. 0) RETURN
      IF (NTP(C) .LT. MXSAM) GO TO 30
      CALL DKERR(28)
      RETURN
   30 IF (NTP(C) .EQ. 0) GO TO 40
      IF (T .GE. TPT(NTP(C),C)) GO TO 40
      CALL DKERR(29)
      RETURN
   40 CALL TPPUT(C, T, R, V)
      RETURN
      END
C
C     DKTPCL: close the open tape; it needs two samples at least.
      SUBROUTINE DKTPCL
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      ITPON = 0
      IF (NTP(ITPCH) .GE. 2) RETURN
      CALL DKERRC(29, ITPCD)
      RETURN
      END
