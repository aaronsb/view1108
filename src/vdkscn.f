C     VDKSCN: the card reader's card semantics (#26; the reader is
C     vdeck.f): what each card of a run deck writes into the run
C     tables.  The field layouts are in src/viewcom.inc and
C     src/viewsit.inc; the defaults and orderings are the ones
C     tools/gen_data.py wrote into BLOCK DATA before the reader took
C     over (#26), so the tables are word for word what they were.
C
C     DKCARD: the card in hand (KCRD) to its routine.  A mission's
C     cards come first, MISSION once and then EPOCH (SITE and PAD
C     anywhere among them), before its scenarios; a scenario's cards
C     after its SCENARIO card.  SPAN, REEL and SHOT are the page's and
C     are passed over.
      SUBROUTINE DKCARD
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      IF (KCRD .EQ. QSPAN .OR. KCRD .EQ. QREEL .OR. KCRD .EQ. QSHOT)
     &  RETURN
      IF (KCRD .NE. QMISSI) GO TO 10
      IF (IMHV .EQ. 1 .OR. IMHV .EQ. 2) GO TO 91
      CALL DKMSN
      IMHV = 1
      RETURN
   10 IF (KCRD .NE. QEPOCH .AND. KCRD .NE. QSITE .AND.
     &    KCRD .NE. QPAD) GO TO 20
      IF (IDSN .NE. 0) GO TO 90
      IF (IMHV .NE. 1 .AND. IMHV .NE. 2) GO TO 91
      IF (KCRD .EQ. QEPOCH) CALL DKNUM(YJD, MJD)
      IF (KCRD .EQ. QEPOCH) IMHV = 2
      IF (KCRD .EQ. QSITE) CALL DKSITE
      IF (KCRD .EQ. QPAD) CALL DKPAD
      RETURN
   20 IF (KCRD .NE. QSCENA) GO TO 30
      CALL DKSCN
      RETURN
   30 IF (IDSN .EQ. 0) GO TO 90
      IF (KCRD .EQ. QLEG) CALL DKLEG
      IF (KCRD .EQ. QROW) CALL DKROW
      IF (KCRD .EQ. QEVENT) CALL DKEVT
      IF (KCRD .EQ. QTIMEL) CALL DKTLN
      IF (KCRD .EQ. QSTART) CALL DKSTR(1)
      IF (KCRD .EQ. QREF) CALL DKSTR(2)
      IF (KCRD .EQ. QBURN) CALL DKBRN
      IF (KCRD .EQ. QBURNC) CALL DKCUE
      IF (KCRD .EQ. QSITUA) CALL DKSIT
      IF (KCRD .EQ. QRECIP) CALL DKRCP
      IF (KCRD .EQ. QVIEWS) CALL DKVWS
      IF (KCRD .EQ. QHDRRE) CALL DKHDR
      RETURN
   90 CALL DKERR(6)
      RETURN
   91 CALL DKERR(25)
      RETURN
      END
C
C     DKMSN: a MISSION card starts a mission: no scenario in hand, and
C     its epoch, landing site and pad zero until its cards give them
C     (IMHV, the mission's state, is the caller's).
      SUBROUTINE DKMSN
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER I
      MJD = 0.0D0
      DO 10 I = 1, 3
        MSIT(I) = 0.0D0
   10 CONTINUE
      MPAD(1) = 0.0D0
      MPAD(2) = 0.0D0
      MPGC = 0
      DO 20 I = 1, 8
        MPCH(I) = 0
   20 CONTINUE
      IDSN = 0
      IDST = 0
      RETURN
      END
C
C     DKSITE: SITE LAT= LON= AZ= (deg) and NAME=, the name lettered in
C     the whole-disc Moon view (SITECH, 22 codes, zero padded): one for
C     the deck, so a second, different name is refused.
      SUBROUTINE DKSITE
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER J, I, IW(22), DKNMOK
      CALL DKNUM(YLAT, MSIT(1))
      CALL DKNUM(YLON, MSIT(2))
      CALL DKNUM(YAZ, MSIT(3))
      J = KSLT(YNAME)
      IF (J .EQ. 0) RETURN
      IF (DKNMOK(J, 22) .EQ. 0) RETURN
      DO 10 I = 1, 22
        IW(I) = 0
        IF (I .LE. TVL(J)) IW(I) = ITKB(TVS(J)+I-1)
        IF (SITECH(1) .NE. 0 .AND. IW(I) .NE. SITECH(I)) GO TO 90
   10 CONTINUE
      DO 20 I = 1, 22
        SITECH(I) = IW(I)
   20 CONTINUE
      RETURN
   90 CALL DKERR(23)
      RETURN
      END
C
C     DKNMOK: 1 if token J's value is a name of MX codes at most, each
C     a printable ASCII character, else deck error 23 and 0.
      INTEGER FUNCTION DKNMOK(J, MX)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER J, MX, I
      DKNMOK = 0
      IF (TVL(J) .GT. MX) GO TO 90
      IF (TVL(J) .EQ. 0) GO TO 20
      DO 10 I = TVS(J), TVS(J) + TVL(J) - 1
        IF (ITKB(I) .LT. ICBLK .OR. ITKB(I) .GT. ICTIL) GO TO 90
   10 CONTINUE
   20 DKNMOK = 1
      RETURN
   90 CALL DKERR(23)
      RETURN
      END
C
C     DKPAD: PAD NAME= (7 codes at most) LAT= LON= (deg) LATTYPE=.
      SUBROUTINE DKPAD
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER J, I, DKREQ, DKWRD, DKNMOK
      CALL DKNUM(YLAT, MPAD(1))
      CALL DKNUM(YLON, MPAD(2))
      MPGC = DKWRD(VLATT, YLATTY, 0)
      J = DKREQ(YNAME)
      IF (J .EQ. 0) RETURN
      IF (DKNMOK(J, 7) .EQ. 0) RETURN
      DO 10 I = 1, 8
        MPCH(I) = 0
        IF (I .LE. TVL(J)) MPCH(I) = ITKB(TVS(J)+I-1)
   10 CONTINUE
      RETURN
      END
C
C     DKSCN: SCENARIO ID=, the row of /CSCEN/ it fills with the
C     mission's epoch, site and pad; the mission's MISSION and EPOCH
C     cards come first (deck error 25).
      SUBROUTINE DKSCN
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER K, I, DKINT
      IDSN = 0
      IDST = 0
      IF (IMHV .GE. 2) GO TO 2
      CALL DKERR(25)
      RETURN
    2 IMHV = 3
      K = DKINT(YID, -1)
      IF (IDKER .NE. 0) RETURN
      IF (K .GE. 1 .AND. K .LE. MXSN) GO TO 5
      CALL DKERR(7)
      RETURN
    5 IF (ISNHV(K) .EQ. 0) GO TO 10
      CALL DKERR(8)
      RETURN
   10 SNJD0(K) = MJD
      SNSLA(K) = MSIT(1)
      SNSLO(K) = MSIT(2)
      SNSAZ(K) = MSIT(3)
      SNPLA(K) = MPAD(1)
      SNPLO(K) = MPAD(2)
      SNPGC(K) = MPGC
      DO 20 I = 1, 8
        PADCH(8*(K-1)+I) = MPCH(I)
   20 CONTINUE
      ISNHV(K) = 1
      SNCD(K) = NDKCD
      IDSN = K
      RETURN
      END
C
C     DKLEG: LEG TYPE= (opening a TABLE leg, whose ROW cards follow, or
C     one leg): LGP 1 FROM, 2 TO, 3 T (g.e.t. s), 4 LAT, 5 LON, 6 ALT,
C     7 V, 8 FPA, 9 HDG, 10 TB, 11 LATB, 12 LONB, 13 DV, 14 P, 15 R,
C     16 N (LCONIC: the impulse's direction; otherwise LGN, whole
C     revolutions), 17 ALTB (default ALT); absent keys 0.
      SUBROUTINE DKLEG
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER IT, IVH, IGC, K, DKWRD, DKINT
      IT = DKWRD(VLEGT, YTYPE, -1)
      IVH = DKWRD(VLVEH, YVEH, 1)
      IGC = DKWRD(VLATT, YLATTY, 0)
      IF (IDKER .NE. 0) RETURN
      IF (IT .NE. KTABL) GO TO 10
      ITBON = 1
      ITBSN = IDSN
      ITBGC = IGC
      ITBVH = IVH
      NTBR = 0
      RETURN
   10 IF (NLEG .LT. MXLEG) GO TO 20
      CALL DKERR(11)
      RETURN
   20 K = NLEG + 1
      NLEG = K
      CALL DKGET(YFROM, LGP(1,K))
      CALL DKGET(YTO, LGP(2,K))
      CALL DKGET(YT, LGP(3,K))
      CALL DKNMD(YLAT, 0.0D0, LGP(4,K))
      CALL DKNMD(YLON, 0.0D0, LGP(5,K))
      CALL DKNMD(YALT, 0.0D0, LGP(6,K))
      CALL DKNMD(YV, 0.0D0, LGP(7,K))
      CALL DKNMD(YFPA, 0.0D0, LGP(8,K))
      CALL DKNMD(YHDG, 0.0D0, LGP(9,K))
      CALL DKGTD(YTB, 0.0D0, LGP(10,K))
      CALL DKNMD(YLATB, 0.0D0, LGP(11,K))
      CALL DKNMD(YLONB, 0.0D0, LGP(12,K))
      CALL DKNMD(YDV, 0.0D0, LGP(13,K))
      CALL DKNMD(YP, 0.0D0, LGP(14,K))
      CALL DKNMD(YR, 0.0D0, LGP(15,K))
      LGP(16,K) = 0.0D0
      LGN(K) = 0
      IF (IT .EQ. KLCON) CALL DKNMD(YN, 0.0D0, LGP(16,K))
      IF (IT .NE. KLCON) LGN(K) = DKINT(YN, 0)
      CALL DKNMD(YALTB, LGP(6,K), LGP(17,K))
      LGSN(K) = IDSN
      LGTYP(K) = IT
      LGGC(K) = IGC
      LGVEH(K) = IVH
      RETURN
      END
C
C     DKROW: a ROW of the open TABLE leg: T LAT LON ALT V FPA HDG, VEL=.
      SUBROUTINE DKROW
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER J, DKWRD
      IF (ITBON .EQ. 1) GO TO 10
      CALL DKERR(6)
      RETURN
   10 IF (NTBR .LT. MXTBR) GO TO 20
      CALL DKERR(18)
      RETURN
   20 J = NTBR + 1
      NTBR = J
      CALL DKGET(YT, TBR(1,J))
      CALL DKNUM(YLAT, TBR(2,J))
      CALL DKNUM(YLON, TBR(3,J))
      CALL DKNUM(YALT, TBR(4,J))
      CALL DKNUM(YV, TBR(5,J))
      CALL DKNUM(YFPA, TBR(6,J))
      CALL DKNUM(YHDG, TBR(7,J))
      TBEF(J) = DKWRD(VVEL, YVEL, 0)
      RETURN
      END
C
C     DKEVT: EVENT KIND= T=.
      SUBROUTINE DKEVT
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER K, DKWRD
      IF (NEVT .LT. MXEVT) GO TO 10
      CALL DKERR(12)
      RETURN
   10 K = NEVT + 1
      NEVT = K
      EVKND(K) = DKWRD(VEVK, YKIND, -1)
      CALL DKGET(YT, EVT(K))
      EVSN(K) = IDSN
      RETURN
      END
C
C     DKTLN: TIMELINE T= KIND= NAME=, put in its place by scenario and
C     g.e.t. (after any row of the same time, so the cards' order
C     stands); its name kept for the burn cues.
      SUBROUTINE DKTLN
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER J, KK, P, IS, N, DKWRD, DKREQ
      DOUBLE PRECISION T
      IF (NTL .LT. MXTL) GO TO 10
      CALL DKERR(16)
      RETURN
   10 CALL DKGET(YT, T)
      KK = DKWRD(VTLK, YKIND, -1)
      J = DKREQ(YNAME)
      IF (IDKER .NE. 0) RETURN
      CALL DKTXT(J, TNCH, MXTNC, NTNC, IS, N)
      IF (IDKER .NE. 0) RETURN
      P = NTL
   20 IF (P .LT. 1) GO TO 30
      IF (TLSN(P) .LT. IDSN) GO TO 30
      IF (TLSN(P) .EQ. IDSN .AND. TLT(P) .LE. T) GO TO 30
      TLT(P+1) = TLT(P)
      TLK(P+1) = TLK(P)
      TLSN(P+1) = TLSN(P)
      TLNS(P+1) = TLNS(P)
      TLNL(P+1) = TLNL(P)
      P = P - 1
      GO TO 20
   30 TLT(P+1) = T
      TLK(P+1) = KK
      TLSN(P+1) = IDSN
      TLNS(P+1) = IS
      TLNL(P+1) = N
      NTL = NTL + 1
      RETURN
      END
C
C     DKSTR: START (IS 1, one per scenario) or REF (IS 2): T= END=
C     (START: the run's end) BODY= LATTYPE= LAT= LON= ALT= V= FPA= HDG=
C     into STP or RFP laid out as LGP: 1 T, 2 END, 3 T, 4-9 LAT .. HDG.
      SUBROUTINE DKSTR(IS)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER IS, K, I, DKWRD
      DOUBLE PRECISION P(9)
      CALL DKGET(YT, P(1))
      CALL DKGTD(YEND, 0.0D0, P(2))
      P(3) = P(1)
      CALL DKNUM(YLAT, P(4))
      CALL DKNUM(YLON, P(5))
      CALL DKNUM(YALT, P(6))
      CALL DKNUM(YV, P(7))
      CALL DKNUM(YFPA, P(8))
      CALL DKNMD(YHDG, 0.0D0, P(9))
      IF (IS .EQ. 2) GO TO 50
      IF (NSTART .EQ. 0) GO TO 15
      DO 10 K = 1, NSTART
        IF (STSN(K) .EQ. IDSN) GO TO 91
   10 CONTINUE
   15 IF (NSTART .GE. MXSTRT) GO TO 92
      K = NSTART + 1
      NSTART = K
      DO 20 I = 1, NLGP
        STP(I,K) = 0.0D0
        IF (I .LE. 9) STP(I,K) = P(I)
   20 CONTINUE
      STSN(K) = IDSN
      STBOD(K) = DKWRD(VBODY, YBODY, -1)
      STGC(K) = DKWRD(VLATT, YLATTY, 0)
      RETURN
   50 IF (NRF .GE. MXREF) GO TO 93
      K = NRF + 1
      NRF = K
      DO 60 I = 1, NLGP
        RFP(I,K) = 0.0D0
        IF (I .LE. 9) RFP(I,K) = P(I)
   60 CONTINUE
      RFSN(K) = IDSN
      RFBOD(K) = DKWRD(VBODY, YBODY, -1)
      RFGC(K) = DKWRD(VLATT, YLATTY, 0)
      RETURN
   91 CALL DKERR(8)
      RETURN
   92 CALL DKERR(13)
      RETURN
   93 CALL DKERR(15)
      RETURN
      END
C
C     DKBRN: BURN T= (mid-burn) DV= P= R= N= BODY=.
      SUBROUTINE DKBRN
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER K, DKWRD
      IF (NBN .LT. MXBURN) GO TO 10
      CALL DKERR(14)
      RETURN
   10 K = NBN + 1
      NBN = K
      CALL DKGET(YT, BNT(K))
      CALL DKNUM(YDV, BNDV(K))
      CALL DKNUM(YP, BNP(K))
      CALL DKNUM(YR, BNR(K))
      CALL DKNUM(YN, BNN(K))
      BNSN(K) = IDSN
      BNBOD(K) = DKWRD(VBODY, YBODY, -1)
      RETURN
      END
C
C     DKCUE: BURNCUE IGN= CUT= (TIMELINE row names) VEH= ENG=, kept
C     until CRDEND pairs it with the rows (DKCUES).
      SUBROUTINE DKCUE
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER Q, J1, J2, DKREQ, DKWRD
      IF (NCQ .LT. MXCUE) GO TO 10
      CALL DKERR(17)
      RETURN
   10 J1 = DKREQ(YIGN)
      J2 = DKREQ(YCUT)
      IF (IDKER .NE. 0) RETURN
      Q = NCQ + 1
      NCQ = Q
      CQSN(Q) = IDSN
      CQCD(Q) = NDKCD
      CQVH(Q) = DKWRD(VBVEH, YVEH, -1)
      CQEN(Q) = DKWRD(VBENG, YENG, -1)
      CALL DKTXT(J1, CQCH, MXCQC, NCQC, CQIS(Q), CQIL(Q))
      CALL DKTXT(J2, CQCH, MXCQC, NCQC, CQCS(Q), CQCL(Q))
      RETURN
      END
