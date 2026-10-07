C     VTAPE: the tape in /CTAPE/, the engine's (sim.f) or one read from
C     the deck (src/vdktap.f), as a deck the card reader takes back
C     (#26 slice 6), on standard output.  Not a kernel element:
C     tools/build.sh links it into the native driver only
C     (build/viewsvg, VIEW_TAPEW=1).  For each channel with samples, a
C     TAPE card and one row per sample: g.e.t. (s), position (km) and
C     velocity (km/s), tab-separated, each with 17 significant digits,
C     so the reader reads back the same bits; it reads 17 digits from
C     about 10**-28 to 10**38 in magnitude (DKNMS), and a value outside
C     that, or no tape, stops the run with a message.  The marks are
C     not written (the engine makes its own).  Tool code, not period
C     code: the ES and I0 edit descriptors and character expressions
C     are Fortran 77 to 95.
      SUBROUTINE VTAPE
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INTEGER C, K, I, N, NS
      DOUBLE PRECISION X
      CHARACTER*25 F
      CHARACTER*200 L
      NS = 0
      DO 5 C = 1, MXCHN
        NS = NS + NTP(C)
    5 CONTINUE
      IF (ITPSN .EQ. 0 .OR. NS .EQ. 0) THEN
        WRITE (0, '(A)') 'VIEW_TAPEW: no tape (run the engine with '
     &    // 'VIEW_SIM, or load a tape deck)'
        STOP 2
      END IF
      WRITE (6, '(A)') '* A tape written by tools/vtape.f: g.e.t. s, '
     &  // 'then geocentric EQ r km, v km/s.'
      IF (ISIMF .GE. 0) WRITE (6, '(A,I0,A,I0)') '* scenario ', ITPSN,
     &  ', the engine''s, run flags ', ISIMF
      IF (ISIMF .LT. 0) WRITE (6, '(A,I0,A)') '* scenario ', ITPSN,
     &  ', read from a deck'
      DO 30 C = 1, MXCHN
        IF (NTP(C) .EQ. 0) GO TO 30
        WRITE (6, '(A,I0,A,I0)') 'TAPE SCN=', ITPSN, ' CHAN=', C
        DO 20 K = 1, NTP(C)
          L = ' '
          N = 0
          DO 10 I = 0, 6
            IF (I .EQ. 0) X = TPT(K,C)
            IF (I .GT. 0) X = TPS(I,K,C)
            IF (X .NE. 0.0D0 .AND. (DABS(X) .LT. 1.0D-28 .OR.
     &          DABS(X) .GE. 1.0D38)) THEN
              WRITE (0, '(A,I0,A,I0,A,ES25.16E3)') 'VIEW_TAPEW: '
     &          // 'channel ', C, ' sample ', K,
     &          ': a value the card reader cannot read back: ', X
              STOP 2
            END IF
            WRITE (F, '(ES25.16E3)') X
            IF (I .EQ. 0) L = ADJUSTL(F)
            IF (I .GT. 0) L = L(1:N) // CHAR(9) // ADJUSTL(F)
            N = LEN_TRIM(L)
   10     CONTINUE
          WRITE (6, '(A)') L(1:N)
   20   CONTINUE
   30 CONTINUE
      RETURN
      END
