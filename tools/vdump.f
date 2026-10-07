C     VDUMP: the run tables as data, for the golden gate (#26 slice 0).
C     Not a kernel element: tools/build.sh links it into the native
C     driver only (build/viewsvg, VIEW_DUMP=1), and it reads the same
C     COMMON through the same INCLUDE files the kernel does.  Every
C     scenario-specific table's used entries, one per line: the name
C     and index, then for a double its bit pattern in hex (the value
C     the gate compares) and the value in decimal (for reading); for
C     an integer its value.  The static catalogs (stars, coastlines,
C     craters, maria, the Moon series, NAVCH, BODCH) are not dumped:
C     they are not run data.  Tool code, not period code: TRANSFER and
C     the Z edit descriptor are Fortran 90 and gfortran.
      SUBROUTINE VDUMP
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INTEGER I, K
C     Scenarios: /CSCEN/, /CSCENI/.
      CALL VDI('NSN', 0, 0, NSN)
      DO 10 K = 1, NSN
        CALL VDD('SNJD0', K, 0, SNJD0(K))
        CALL VDD('SNSLA', K, 0, SNSLA(K))
        CALL VDD('SNSLO', K, 0, SNSLO(K))
        CALL VDD('SNSAZ', K, 0, SNSAZ(K))
        CALL VDD('SNPLA', K, 0, SNPLA(K))
        CALL VDD('SNPLO', K, 0, SNPLO(K))
        CALL VDI('SNPGC', K, 0, SNPGC(K))
   10 CONTINUE
      DO 11 K = 1, 8*NSN
        CALL VDI('PADCH', K, 0, PADCH(K))
   11 CONTINUE
      DO 12 K = 1, 22
        CALL VDI('SITECH', K, 0, SITECH(K))
   12 CONTINUE
C     Trajectory legs (LEG cards and TABLE legs from ROW cards).
      CALL VDI('NLEG', 0, 0, NLEG)
      DO 21 K = 1, NLEG
        DO 20 I = 1, NLGP
          CALL VDD('LGP', I, K, LGP(I,K))
   20   CONTINUE
        CALL VDI('LGSN', K, 0, LGSN(K))
        CALL VDI('LGTYP', K, 0, LGTYP(K))
        CALL VDI('LGN', K, 0, LGN(K))
        CALL VDI('LGGC', K, 0, LGGC(K))
        CALL VDI('LGVEH', K, 0, LGVEH(K))
   21 CONTINUE
C     Events.
      CALL VDI('NEVT', 0, 0, NEVT)
      DO 30 K = 1, NEVT
        CALL VDD('EVT', K, 0, EVT(K))
        CALL VDI('EVSN', K, 0, EVSN(K))
        CALL VDI('EVKND', K, 0, EVKND(K))
   30 CONTINUE
C     Simulation cards: START, REF and BURN rows, used rows only.
      CALL VDI('NSTART', 0, 0, NSTART)
      CALL VDI('NRF', 0, 0, NRF)
      CALL VDI('NBN', 0, 0, NBN)
      DO 41 K = 1, NSTART
        DO 40 I = 1, NLGP
          CALL VDD('STP', I, K, STP(I,K))
   40   CONTINUE
        CALL VDI('STSN', K, 0, STSN(K))
        CALL VDI('STBOD', K, 0, STBOD(K))
        CALL VDI('STGC', K, 0, STGC(K))
   41 CONTINUE
      DO 43 K = 1, NRF
        DO 42 I = 1, NLGP
          CALL VDD('RFP', I, K, RFP(I,K))
   42   CONTINUE
        CALL VDI('RFSN', K, 0, RFSN(K))
        CALL VDI('RFBOD', K, 0, RFBOD(K))
        CALL VDI('RFGC', K, 0, RFGC(K))
   43 CONTINUE
      DO 44 K = 1, NBN
        CALL VDD('BNT', K, 0, BNT(K))
        CALL VDD('BNDV', K, 0, BNDV(K))
        CALL VDD('BNP', K, 0, BNP(K))
        CALL VDD('BNR', K, 0, BNR(K))
        CALL VDD('BNN', K, 0, BNN(K))
        CALL VDI('BNSN', K, 0, BNSN(K))
        CALL VDI('BNBOD', K, 0, BNBOD(K))
   44 CONTINUE
C     Timeline rows.
      CALL VDI('NTL', 0, 0, NTL)
      DO 50 K = 1, NTL
        CALL VDD('TLT', K, 0, TLT(K))
        CALL VDI('TLK', K, 0, TLK(K))
        CALL VDI('TLSN', K, 0, TLSN(K))
   50 CONTINUE
C     Burn cues, used rows only.
      CALL VDI('NBR', 0, 0, NBR)
      DO 60 K = 1, NBR
        CALL VDD('BRT1', K, 0, BRT1(K))
        CALL VDD('BRT2', K, 0, BRT2(K))
        CALL VDI('BRSN', K, 0, BRSN(K))
        CALL VDI('BRVH', K, 0, BRVH(K))
        CALL VDI('BREN', K, 0, BREN(K))
   60 CONTINUE
C     Situations: /CSIT/, /CSITI/.
      CALL VDI('NSIT', 0, 0, NSIT)
      DO 72 K = 1, NSIT
        CALL VDD('SIGT', K, 0, SIGT(K))
        CALL VDD('SIFV', K, 0, SIFV(K))
        CALL VDD('SIEL', K, 0, SIEL(K))
        CALL VDD('SIFL', K, 0, SIFL(K))
        CALL VDD('SIFT', K, 0, SIFT(K))
        CALL VDD('SIDT', K, 0, SIDT(K))
        CALL VDD('SIEO', K, 0, SIEO(K))
        CALL VDD('SIAL', K, 0, SIAL(K))
        CALL VDD('SIDS', K, 0, SIDS(K))
        CALL VDD('SIHO', K, 0, SIHO(K))
        CALL VDD('SIHR', K, 0, SIHR(K))
        DO 70 I = 1, 3
          CALL VDD('SILK', I, K, SILK(I,K))
          CALL VDD('SITN', I, K, SITN(I,K))
   70   CONTINUE
        CALL VDD('SIXY', 1, K, SIXY(1,K))
        CALL VDD('SIXY', 2, K, SIXY(2,K))
        CALL VDI('SISN', K, 0, SISN(K))
        CALL VDI('SIGK', K, 0, SIGK(K))
        CALL VDI('SIGE', K, 0, SIGE(K))
        CALL VDI('SIFK', K, 0, SIFK(K))
        CALL VDI('SIWN', K, 0, SIWN(K))
        CALL VDI('SIPS', K, 0, SIPS(K))
        CALL VDI('SIDW', K, 0, SIDW(K))
        CALL VDI('SIRC', K, 0, SIRC(K))
        CALL VDI('SIBD', K, 0, SIBD(K))
        CALL VDI('SIMD', K, 0, SIMD(K))
        CALL VDI('SIAZ', K, 0, SIAZ(K))
        CALL VDI('SITR', K, 0, SITR(K))
        CALL VDI('SIFB', K, 0, SIFB(K))
        CALL VDI('SIAT', K, 0, SIAT(K))
        CALL VDI('SIFE', K, 0, SIFE(K))
        CALL VDI('SIVH', K, 0, SIVH(K))
        CALL VDI('SIVW', K, 0, SIVW(K))
        CALL VDI('SITG', K, 0, SITG(K))
        CALL VDI('SITF', K, 0, SITF(K))
        CALL VDI('SIRD', K, 0, SIRD(K))
        CALL VDI('SICM', K, 0, SICM(K))
        CALL VDI('SILM', K, 0, SILM(K))
        CALL VDI('SIFX', K, 0, SIFX(K))
        CALL VDI('SIXO', K, 0, SIXO(K))
        CALL VDI('SIHK', K, 0, SIHK(K))
        DO 71 I = 1, 12
          CALL VDI('SILY', I, K, SILY(I,K))
   71   CONTINUE
   72 CONTINUE
      RETURN
      END
C
C     One double: NAME(I) or NAME(I,K) (K 0: one index), hex, decimal.
      SUBROUTINE VDD(NAME, I, K, X)
      CHARACTER*(*) NAME
      INTEGER I, K
      DOUBLE PRECISION X
      INTEGER*8 IB
      IB = TRANSFER(X, IB)
      IF (K .EQ. 0) THEN
        WRITE (6, '(A,''('',I0,'') '',Z16.16,1X,ES25.17)') NAME, I,
     &    IB, X
      ELSE
        WRITE (6, '(A,''('',I0,'','',I0,'') '',Z16.16,1X,ES25.17)')
     &    NAME, I, K, IB, X
      END IF
      RETURN
      END
C
C     One integer: NAME, NAME(I) or NAME(I,K), value.
      SUBROUTINE VDI(NAME, I, K, N)
      CHARACTER*(*) NAME
      INTEGER I, K, N
      IF (I .EQ. 0) THEN
        WRITE (6, '(A,1X,I0)') NAME, N
      ELSE IF (K .EQ. 0) THEN
        WRITE (6, '(A,''('',I0,'') '',I0)') NAME, I, N
      ELSE
        WRITE (6, '(A,''('',I0,'','',I0,'') '',I0)') NAME, I, K, N
      END IF
      RETURN
      END
