C     VTAPE: the tape the engine wrote, as a deck the card reader takes
C     back (src/vdktap.f; #26 slice 6), on standard output.  Not a
C     kernel element: tools/build.sh links it into the native driver
C     only (build/viewsvg, VIEW_TAPEW=1 after VIEW_SIM=n).  For each
C     channel with samples, a TAPE card and one row per sample: g.e.t.
C     (s), position (km) and velocity (km/s), tab-separated, each with
C     17 significant digits, which carry any double, so the reader
C     reads back the same bits.  The marks are not written (the engine
C     makes its own).  Tool code, not period code: the ES and I0 edit
C     descriptors and character concatenation are Fortran 77 to 95.
      SUBROUTINE VTAPE
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INTEGER C, K, I, N
      CHARACTER*25 F
      CHARACTER*200 L
      WRITE (6, '(A)') '* The engine''s tape (sim.f), written by '
     &  // 'tools/vtape.f: g.e.t. s, then geocentric EQ r km, v km/s.'
      WRITE (6, '(A,I0,A,I0)') '* scenario ', ITPSN,
     &  ', engine run flags ', ISIMF
      DO 30 C = 1, MXCHN
        IF (NTP(C) .EQ. 0) GO TO 30
        WRITE (6, '(A,I0,A,I0)') 'TAPE SCN=', ITPSN, ' CHAN=', C
        DO 20 K = 1, NTP(C)
          WRITE (F, '(ES25.16E3)') TPT(K,C)
          L = ADJUSTL(F)
          N = LEN_TRIM(L)
          DO 10 I = 1, 6
            WRITE (F, '(ES25.16E3)') TPS(I,K,C)
            L = L(1:N) // CHAR(9) // ADJUSTL(F)
            N = LEN_TRIM(L)
   10     CONTINUE
          WRITE (6, '(A)') L(1:N)
   20   CONTINUE
   30 CONTINUE
      RETURN
      END
