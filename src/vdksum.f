C     VDKSUM: the run tables' hash total (#26; ours), CRDSUM, so the
C     tables the card reader (vdeck.f) fills natively and in
C     WebAssembly can be compared word for word without listing them.
C
C     CRDSUM: a hash total of the run tables' used entries (ours), four
C     sums ISUM(1..4) over every 32-bit word, a double as its two
C     words, so two loads of a deck can be compared without listing
C     the tables.
      SUBROUTINE CRDSUM(ISUM)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER ISUM(4), I, K
      DO 5 I = 1, 4
        ISUM(I) = 0
    5 CONTINUE
      CALL DKHI(NSN, ISUM)
      IF (NSN .EQ. 0) GO TO 110
      DO 10 K = 1, NSN
        CALL DKHD(SNJD0(K), ISUM)
        CALL DKHD(SNSLA(K), ISUM)
        CALL DKHD(SNSLO(K), ISUM)
        CALL DKHD(SNSAZ(K), ISUM)
        CALL DKHD(SNPLA(K), ISUM)
        CALL DKHD(SNPLO(K), ISUM)
        CALL DKHI(SNPGC(K), ISUM)
   10 CONTINUE
  110 CONTINUE
      IF (NSN .EQ. 0) GO TO 111
      DO 11 K = 1, 8*NSN
        CALL DKHI(PADCH(K), ISUM)
   11 CONTINUE
  111 CONTINUE
      DO 12 K = 1, 22
        CALL DKHI(SITECH(K), ISUM)
   12 CONTINUE
      CALL DKHI(NLEG, ISUM)
      IF (NLEG .EQ. 0) GO TO 114
      DO 14 K = 1, NLEG
        DO 13 I = 1, NLGP
          CALL DKHD(LGP(I,K), ISUM)
   13   CONTINUE
        CALL DKHI(LGSN(K), ISUM)
        CALL DKHI(LGTYP(K), ISUM)
        CALL DKHI(LGN(K), ISUM)
        CALL DKHI(LGGC(K), ISUM)
        CALL DKHI(LGVEH(K), ISUM)
   14 CONTINUE
  114 CONTINUE
      CALL DKHI(NEVT, ISUM)
      IF (NEVT .EQ. 0) GO TO 115
      DO 15 K = 1, NEVT
        CALL DKHD(EVT(K), ISUM)
        CALL DKHI(EVSN(K), ISUM)
        CALL DKHI(EVKND(K), ISUM)
   15 CONTINUE
  115 CONTINUE
      CALL DKHI(NSTART, ISUM)
      IF (NSTART .EQ. 0) GO TO 117
      DO 17 K = 1, NSTART
        DO 16 I = 1, NLGP
          CALL DKHD(STP(I,K), ISUM)
   16   CONTINUE
        CALL DKHI(STSN(K), ISUM)
        CALL DKHI(STBOD(K), ISUM)
        CALL DKHI(STGC(K), ISUM)
   17 CONTINUE
  117 CONTINUE
      CALL DKHI(NRF, ISUM)
      IF (NRF .EQ. 0) GO TO 119
      DO 19 K = 1, NRF
        DO 18 I = 1, NLGP
          CALL DKHD(RFP(I,K), ISUM)
   18   CONTINUE
        CALL DKHI(RFSN(K), ISUM)
        CALL DKHI(RFBOD(K), ISUM)
        CALL DKHI(RFGC(K), ISUM)
   19 CONTINUE
  119 CONTINUE
      CALL DKHI(NBN, ISUM)
      IF (NBN .EQ. 0) GO TO 120
      DO 20 K = 1, NBN
        CALL DKHD(BNT(K), ISUM)
        CALL DKHD(BNDV(K), ISUM)
        CALL DKHD(BNP(K), ISUM)
        CALL DKHD(BNR(K), ISUM)
        CALL DKHD(BNN(K), ISUM)
        CALL DKHI(BNSN(K), ISUM)
        CALL DKHI(BNBOD(K), ISUM)
   20 CONTINUE
  120 CONTINUE
      CALL DKHI(NTL, ISUM)
      IF (NTL .EQ. 0) GO TO 121
      DO 21 K = 1, NTL
        CALL DKHD(TLT(K), ISUM)
        CALL DKHI(TLK(K), ISUM)
        CALL DKHI(TLSN(K), ISUM)
   21 CONTINUE
  121 CONTINUE
      CALL DKHI(NBR, ISUM)
      IF (NBR .EQ. 0) GO TO 122
      DO 22 K = 1, NBR
        CALL DKHD(BRT1(K), ISUM)
        CALL DKHD(BRT2(K), ISUM)
        CALL DKHI(BRSN(K), ISUM)
        CALL DKHI(BRVH(K), ISUM)
        CALL DKHI(BREN(K), ISUM)
   22 CONTINUE
  122 CONTINUE
      CALL DKHI(NSIT, ISUM)
      IF (NSIT .EQ. 0) GO TO 130
      DO 30 K = 1, NSIT
        CALL DKHSIT(K, ISUM)
   30 CONTINUE
  130 CONTINUE
      RETURN
      END
C
C     DKHSIT: situation row K into the hash total.
      SUBROUTINE DKHSIT(K, ISUM)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
C     RESTOMOD END
      INTEGER K, ISUM(4), I
      CALL DKHD(SIGT(K), ISUM)
      CALL DKHD(SIFV(K), ISUM)
      CALL DKHD(SIEL(K), ISUM)
      CALL DKHD(SIFL(K), ISUM)
      CALL DKHD(SIFT(K), ISUM)
      CALL DKHD(SIDT(K), ISUM)
      CALL DKHD(SIEO(K), ISUM)
      CALL DKHD(SIAL(K), ISUM)
      CALL DKHD(SIDS(K), ISUM)
      CALL DKHD(SIHO(K), ISUM)
      CALL DKHD(SIHR(K), ISUM)
      DO 10 I = 1, 3
        CALL DKHD(SILK(I,K), ISUM)
        CALL DKHD(SITN(I,K), ISUM)
   10 CONTINUE
      CALL DKHD(SIXY(1,K), ISUM)
      CALL DKHD(SIXY(2,K), ISUM)
      CALL DKHI(SISN(K), ISUM)
      CALL DKHI(SIGK(K), ISUM)
      CALL DKHI(SIGE(K), ISUM)
      CALL DKHI(SIFK(K), ISUM)
      CALL DKHI(SIWN(K), ISUM)
      CALL DKHI(SIPS(K), ISUM)
      CALL DKHI(SIDW(K), ISUM)
      CALL DKHI(SIRC(K), ISUM)
      CALL DKHI(SIBD(K), ISUM)
      CALL DKHI(SIMD(K), ISUM)
      CALL DKHI(SIAZ(K), ISUM)
      CALL DKHI(SITR(K), ISUM)
      CALL DKHI(SIFB(K), ISUM)
      CALL DKHI(SIAT(K), ISUM)
      CALL DKHI(SIFE(K), ISUM)
      CALL DKHI(SIVH(K), ISUM)
      CALL DKHI(SIVW(K), ISUM)
      CALL DKHI(SITG(K), ISUM)
      CALL DKHI(SITF(K), ISUM)
      CALL DKHI(SIRD(K), ISUM)
      CALL DKHI(SICM(K), ISUM)
      CALL DKHI(SILM(K), ISUM)
      CALL DKHI(SIFX(K), ISUM)
      CALL DKHI(SIXO(K), ISUM)
      CALL DKHI(SIHK(K), ISUM)
      DO 20 I = 1, 12
        CALL DKHI(SILY(I,K), ISUM)
   20 CONTINUE
      RETURN
      END
C
C     DKHD: a double into the hash total, as its two 32-bit words.
      SUBROUTINE DKHD(X, ISUM)
      DOUBLE PRECISION X, D
      INTEGER ISUM(4), IW(2)
      EQUIVALENCE (D, IW(1))
      D = X
      CALL DKHI(IW(1), ISUM)
      CALL DKHI(IW(2), ISUM)
      RETURN
      END
C
C     DKHI: a 32-bit word into the hash total, as two 16-bit pieces,
C     each sum kept below its prime so no product overflows 2**31.
      SUBROUTINE DKHI(IW, ISUM)
      INTEGER IW, ISUM(4), LO, IHI, I, IPR(4)
      DATA IPR / 32749, 32719, 32717, 32713 /
      LO = MOD(IW, 65536)
      IF (LO .LT. 0) LO = LO + 65536
      IHI = (IW - LO) / 65536 + 32768
      DO 10 I = 1, 4
        ISUM(I) = MOD(ISUM(I) * 65536 + LO, IPR(I))
        ISUM(I) = MOD(ISUM(I) * 65536 + IHI, IPR(I))
   10 CONTINUE
      RETURN
      END
