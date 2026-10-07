C     VDECK: the card reader (#26), the kernel reading its own run
C     decks: a mission's cards (MISSION, EPOCH, SITE, PAD) and its
C     scenarios' (data/missions/*/*.scn), one card image at a time,
C     into the run tables (/CSCEN/ to /CBRN/, the situation tables,
C     SITECH); they have no other source.  TN D-6853 printed p. 12 has VIEW
C     take its trajectory from the operational trajectory document per
C     mission; a deck read per run is that shape.  Which cards, their
C     keys and code words: tools/gen_data.py, which writes the
C     vocabulary (vdvoc.f) from the same tables it checks decks with.
C
C     CRDOPN empties the run tables; CRDIN reads one card; CRDEOF ends
C     a file (the open TABLE leg, the scenario in hand); CRDEND ends the
C     deck (resolves the burn cues, checks what the kernel needs: ids
C     1..N, a situation, each scenario's epoch, CSM leg and the events
C     its situations name) and gives the first deck error, its card
C     number and the warnings.  A refused deck leaves the run tables
C     empty, and VINIT then selects nothing.  CRDSUM is a hash total of
C     the run tables (ours; vdksum.f), so two loads can be compared
C     word for word.  The card semantics are in vdkscn.f (the
C     mission's and scenario's cards) and vdksit.f (the situation
C     cards), the field readers (words, numbers, lists, text) in
C     vdkfld.f, the tape cards (a TAPE card, then rows of numbers into
C     /CTAPE/) in vdktap.f.
C     tools/gen_data.py still checks the rest of a deck (each recipe's
C     keys, poses).
C
C     A card: KIND KEY=VALUE ..., values in double or single quotes
C     where they hold blanks (no escapes); a * in column 1 or a blank
C     card is a comment.  A number: one sign, digits with one point at
C     most, an E exponent.  A g.e.t.: h:mm:ss.s, h:mm or a number, one
C     leading - at most.  Every number is read exactly: its digits as
C     an integer (15 at most),
C     then one multiply or divide by a power of ten up to 10**22, both
C     exact, so the double is the decimal correctly rounded, the value
C     a compiler gives the same digits as a constant (Clinger 1990,
C     the fast path).  A number of 16 or 17 significant digits, as a
C     tape row carries (any double written with 17 digits reads back
C     the same), or with a power of ten down to 10**-44, is carried in
C     two doubles and rounded once (DKDD, vdkfld.f).  A g.e.t.
C     h:mm:ss.s folds h and mm into that integer (15 digits at most).  RESTOMOD: free-field input was a FORTRAN V extension
C     (UP-4046 sec. 10.4.1); this hand reader of KEY=VALUE cards stands
C     in for NAMELIST, which LFortran does not have.  Every DO here
C     whose count can be 0 is guarded: no FORTRAN V source we hold says
C     such a loop is skipped (#26; ours).
C
C     Deck errors (IDKER; the first one stands, the deck is refused):
C      1 card longer than MXCRD     2 bad number
C      3 more than 17 significant digits (15 in a g.e.t. h:mm:ss),
C        or a power of ten outside 10**-44 to 10**22
C      4 unknown word               5 a required key missing
C      6 card out of place          7 ID out of range
C      8 ID (or a scenario's START) given twice
C      9 TABLE leg: fewer than two ROW cards, or rows out of order
C     10 BURNCUE: no TIMELINE row by that name
C     11 legs full    12 events full    13 START full    14 BURN full
C     15 REF full     16 TIMELINE full  17 BURNCUE full
C     18 TABLE rows full                19 name store full
C     20 scenario or situation ids not 1..N, or a situation without
C        its RECIPE and VIEWS cards
C     21 too many tokens, an open quote, or a word without =
C     22 list of the wrong length, or a layer named twice
C     23 name too long or not plain ASCII, or a second SITE NAME
C     24 no situation               25 mission cards out of order (one
C        MISSION, then EPOCH, before the mission's scenarios)
C     26 a scenario without a CSM leg, or with an LM leg about the Moon
C        but no CSM leg about the Moon (the LM's legs are built on it)
C     27 a situation's GET= or AT= event not in its scenario
C     28 tape full (MXSAM samples on a channel)
C     29 tape rows out of time order, or a tape of fewer than two
C     30 TAPE: its scenario not read yet, or a second scenario's tape
C        (/CTAPE/ holds one)
C     A card that starts with a number is a tape row: deck error 6 if
C     no tape is open, 22 if it has not seven numbers.
C
      SUBROUTINE CRDOPN
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER K
      CALL DKCLR
C     The deck in hand, and no scenario or tape left from the last.
      IDKER = 0
      IDKCD = 0
      NDKWN = 0
      NDKCD = 0
      IMHV = 0
      CALL DKMSN
      ITBON = 0
      NTBR = 0
      NTNC = 0
      NCQ = 0
      NCQC = 0
      ITPON = 0
      ISN = 0
      ISCN = 0
      P10(1) = 1.0D0
      DO 30 K = 2, 23
        P10(K) = P10(K-1) * 10.0D0
   30 CONTINUE
      RETURN
      END
C
C     DKCLR: the run tables emptied, every row and count, SITECH, and
C     the tape (no scenario on it).
      SUBROUTINE DKCLR
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER I, K
      DO 10 K = 1, MXSN
        SNJD0(K) = 0.0D0
        SNSLA(K) = 0.0D0
        SNSLO(K) = 0.0D0
        SNSAZ(K) = 0.0D0
        SNPLA(K) = 0.0D0
        SNPLO(K) = 0.0D0
        SNPGC(K) = 0
        ISNHV(K) = 0
   10 CONTINUE
      DO 11 K = 1, 8*MXSN
        PADCH(K) = 0
   11 CONTINUE
      DO 12 K = 1, 22
        SITECH(K) = 0
   12 CONTINUE
      DO 14 K = 1, MXLEG
        DO 13 I = 1, NLGP
          LGP(I,K) = 0.0D0
   13   CONTINUE
        LGSN(K) = 0
        LGTYP(K) = 0
        LGN(K) = 0
        LGGC(K) = 0
        LGVEH(K) = 0
   14 CONTINUE
      DO 15 K = 1, MXEVT
        EVT(K) = 0.0D0
        EVSN(K) = 0
        EVKND(K) = 0
   15 CONTINUE
      DO 17 K = 1, MXSTRT
        DO 16 I = 1, NLGP
          STP(I,K) = 0.0D0
   16   CONTINUE
        STSN(K) = 0
        STBOD(K) = 0
        STGC(K) = 0
   17 CONTINUE
      DO 19 K = 1, MXREF
        DO 18 I = 1, NLGP
          RFP(I,K) = 0.0D0
   18   CONTINUE
        RFSN(K) = 0
        RFBOD(K) = 0
        RFGC(K) = 0
        RFOK(K) = 0
   19 CONTINUE
      DO 20 K = 1, MXBURN
        BNT(K) = 0.0D0
        BNDV(K) = 0.0D0
        BNP(K) = 0.0D0
        BNR(K) = 0.0D0
        BNN(K) = 0.0D0
        BNSN(K) = 0
        BNBOD(K) = 0
   20 CONTINUE
      DO 21 K = 1, MXTL
        TLT(K) = 0.0D0
        TLK(K) = 0
        TLSN(K) = 0
   21 CONTINUE
      DO 22 K = 1, MXCUE
        BRT1(K) = 0.0D0
        BRT2(K) = 0.0D0
        BRSN(K) = 0
        BRVH(K) = 0
        BREN(K) = 0
   22 CONTINUE
      DO 23 K = 1, MXSIT
        CALL DKSIZ(K)
        ISTHV(K) = 0
   23 CONTINUE
      NSN = 0
      NLEG = 0
      NEVT = 0
      NSTART = 0
      NRF = 0
      NBN = 0
      NTL = 0
      NBR = 0
      NSIT = 0
      CALL TPCLR
      ITPSN = 0
      RETURN
      END
C
C     CRDIN: one card image, NC character codes in IC.
      SUBROUTINE CRDIN(IC, NC)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER IC(MXCRD), NC
      INTEGER I, J, K, W, IB, C, DKLOOK
      NDKCD = NDKCD + 1
      IF (IDKER .NE. 0) RETURN
      IF (NC .GE. 0 .AND. NC .LE. MXCRD) GO TO 5
      CALL DKERR(1)
      RETURN
    5 NCRD = NC
      IF (NC .EQ. 0) RETURN
      DO 10 I = 1, NC
        ICRD(I) = IC(I)
   10 CONTINUE
C     Trailing blanks, tabs and carriage returns off; blank cards and
C     cards with * in column 1 are comments.
   20 IF (NCRD .EQ. 0) RETURN
      I = ICRD(NCRD)
      IF (I .NE. ICBLK .AND. I .NE. ICTAB .AND. I .NE. ICCR) GO TO 30
      NCRD = NCRD - 1
      GO TO 20
   30 IF (ICRD(1) .EQ. ICSTR) RETURN
      CALL DKTOK
      IF (IDKER .NE. 0) RETURN
C     A card that starts with a number: a row of the open tape.
      IF (TKL(1) .EQ. 0) GO TO 34
      C = ITKB(TKS(1))
      IF ((C .LT. ICD0 .OR. C .GT. ICD9) .AND. C .NE. ICPLS .AND.
     &    C .NE. ICMIN .AND. C .NE. ICPT) GO TO 34
      IF (ITPON .EQ. 1) GO TO 32
      CALL DKERR(6)
      RETURN
   32 CALL DKTROW
      RETURN
   34 CONTINUE
      DO 35 K = 1, NVOCK
        KSLT(K) = 0
   35 CONTINUE
      KCRD = 0
      W = DKLOOK(VCARD, TKS(1), TKL(1))
      IF (W .GT. 0) KCRD = VOCV(W)
      IF (KCRD .GT. 0) GO TO 40
      NDKWN = NDKWN + 1
      RETURN
C     The keys: a word without = is refused; an unknown key is skipped
C     and counted, and a key of another card kind counted and read.
   40 IF (NTOK .LT. 2) GO TO 60
      DO 50 J = 2, NTOK
        IF (TVL(J) .GE. 0) GO TO 42
        CALL DKERR(21)
        RETURN
   42   W = DKLOOK(VKEY, TKS(J), TVS(J) - 1 - TKS(J))
        IF (W .EQ. 0) GO TO 45
        KSLT(VOCV(W)) = J
C       Bit KCRD-1 of the key's card kinds.
        IB = KYCARD(VOCV(W))
        IF (KCRD .LT. 2) GO TO 44
        DO 43 I = 2, KCRD
          IB = IB / 2
   43   CONTINUE
   44   IF (MOD(IB, 2) .EQ. 1) GO TO 50
   45   NDKWN = NDKWN + 1
   50 CONTINUE
   60 CONTINUE
      IF (ITBON .EQ. 1 .AND. KCRD .NE. QROW) CALL DKTBCL
      IF (ITPON .EQ. 1) CALL DKTPCL
      IF (IDKER .NE. 0) RETURN
      CALL DKCARD
      RETURN
      END
C
C     CRDEOF: the end of a file of the deck.  Its open TABLE leg ends,
C     its open tape, and its scenario: the next file's cards start with
C     a SCENARIO card (or a MISSION card, or a TAPE card).
      SUBROUTINE CRDEOF
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      IF (IDKER .EQ. 0 .AND. ITBON .EQ. 1) CALL DKTBCL
      IF (IDKER .EQ. 0 .AND. ITPON .EQ. 1) CALL DKTPCL
      ITPON = 0
      IDSN = 0
      IDST = 0
      RETURN
      END
C
C     CRDEND: the end of the deck.  IERR the first deck error (0 none),
C     ICARD its card number, NWARN the cards and keys skipped.  A deck
C     with an error leaves the run tables empty.
      SUBROUTINE CRDEND(IERR, ICARD, NWARN)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER IERR, ICARD, NWARN, K, J, M, IHAS, ICML, ILML, DKEVOK
      CALL CRDEOF
      IF (IDKER .EQ. 0) CALL DKCUES
C     Scenarios 1..NSN and situations 1..NSIT, none missing.
      NSN = 0
      DO 10 K = 1, MXSN
        IF (ISNHV(K) .NE. 0) NSN = K
   10 CONTINUE
      IF (NSN .EQ. 0) GO TO 12
      DO 11 K = 1, NSN
        IF (ISNHV(K) .EQ. 0) CALL DKERRC(20, NDKCD)
   11 CONTINUE
   12 NSIT = 0
      DO 13 K = 1, MXSIT
        IF (ISTHV(K) .NE. 0) NSIT = K
   13 CONTINUE
      IF (NSIT .EQ. 0) CALL DKERRC(24, NDKCD)
      IF (NSIT .EQ. 0) GO TO 30
      DO 14 K = 1, NSIT
        IF (ISTHV(K) .LT. 3) CALL DKERRC(20, STCD(K))
   14 CONTINUE
C     Each scenario a CSM leg; each situation's events in its scenario.
      IF (NSN .EQ. 0 .OR. NLEG .EQ. 0) GO TO 20
      DO 16 M = 1, NSN
        IHAS = 0
        ICML = 0
        ILML = 0
        DO 15 J = 1, NLEG
          IF (LGSN(J) .NE. M) GO TO 15
          IF (LGVEH(J) .EQ. 1) IHAS = 1
          IF (LGTYP(J) .NE. KLUNAR .AND. LGTYP(J) .NE. KLCON) GO TO 15
          IF (LGVEH(J) .EQ. 1) ICML = 1
          IF (LGVEH(J) .EQ. 2) ILML = 1
   15   CONTINUE
        IF (IHAS .EQ. 0) CALL DKERRC(26, SNCD(M))
        IF (ILML .EQ. 1 .AND. ICML .EQ. 0) CALL DKERRC(26, SNCD(M))
   16 CONTINUE
      GO TO 21
   20 CALL DKERRC(26, NDKCD)
   21 DO 24 K = 1, NSIT
        IF (SIGK(K) .NE. 2) GO TO 22
        IF (DKEVOK(SISN(K), SIGE(K)) .EQ. 0) CALL DKERRC(27, STCD(K))
   22   IF (SIFE(K) .EQ. 0) GO TO 24
        IF (DKEVOK(SISN(K), SIFE(K)) .EQ. 0) CALL DKERRC(27, STCD(K))
   24 CONTINUE
   30 IF (IDKER .NE. 0) CALL DKCLR
      IERR = IDKER
      ICARD = IDKCD
      NWARN = NDKWN
      RETURN
      END
C
C     DKERR: deck error K on the card in hand, unless one stands.
      SUBROUTINE DKERR(K)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER K
      CALL DKERRC(K, NDKCD)
      RETURN
      END
C
C     DKERRC: deck error K on card ICARD, unless one stands.
      SUBROUTINE DKERRC(K, ICARD)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER K, ICARD
      IF (IDKER .NE. 0) RETURN
      IDKER = K
      IDKCD = ICARD
      RETURN
      END
C
C     DKEVOK: 1 if scenario M has an EVENT card of kind KIND, else 0.
      INTEGER FUNCTION DKEVOK(M, KIND)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER M, KIND, J
      DKEVOK = 0
      IF (NEVT .EQ. 0) RETURN
      DO 10 J = 1, NEVT
        IF (EVSN(J) .EQ. M .AND. EVKND(J) .EQ. KIND) DKEVOK = 1
   10 CONTINUE
      RETURN
      END
C
C     DKTOK: the card in hand into tokens, split at blanks outside
C     quotes, the quotes dropped (ITKB, TKS, TKL), and each token's
C     value after its first = outside quotes (TVS, TVL).
      SUBROUTINE DKTOK
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER I, J, C, IQ
      NTOK = 0
      J = 0
      I = 1
   10 IF (I .GT. NCRD) RETURN
      IF (ICRD(I) .NE. ICBLK .AND. ICRD(I) .NE. ICTAB) GO TO 20
      I = I + 1
      GO TO 10
   20 IF (NTOK .LT. MXTOK) GO TO 25
      CALL DKERR(21)
      RETURN
   25 NTOK = NTOK + 1
      TKS(NTOK) = J + 1
      TVS(NTOK) = 0
      TVL(NTOK) = -1
      IQ = 0
   30 IF (I .GT. NCRD) GO TO 80
      C = ICRD(I)
      I = I + 1
      IF (IQ .NE. 0) GO TO 40
      IF (C .EQ. ICBLK .OR. C .EQ. ICTAB) GO TO 80
      IF (C .NE. ICQUO .AND. C .NE. ICAPO) GO TO 50
      IQ = C
      GO TO 30
   40 IF (C .NE. IQ) GO TO 50
      IQ = 0
      GO TO 30
   50 J = J + 1
      ITKB(J) = C
      IF (IQ .EQ. 0 .AND. C .EQ. ICEQ .AND. TVL(NTOK) .LT. 0)
     &  TVL(NTOK) = 0
      IF (TVL(NTOK) .EQ. 0 .AND. TVS(NTOK) .EQ. 0) TVS(NTOK) = J + 1
      GO TO 30
   80 IF (IQ .NE. 0) CALL DKERR(21)
      TKL(NTOK) = J - TKS(NTOK) + 1
      IF (TVL(NTOK) .GE. 0) TVL(NTOK) = J - TVS(NTOK) + 1
      GO TO 10
      END
C
C     DKTBCL: close the open LEG TYPE=TABLE: one TABLE leg (KTABL) per
C     pair of its ROW cards in time order.  LGP 1, 2 the pair's times,
C     3-9 the first row's T LAT LON ALT V FPA HDG, 10-12 the second's T
C     LAT LON, 13-15 its V FPA HDG, 17 its ALT; LGN 1 the first row's
C     velocity Earth-fixed, plus 2 the second's.
      SUBROUTINE DKTBCL
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER J, K, I
      ITBON = 0
      IF (NTBR .LT. 2) GO TO 90
      DO 10 J = 1, NTBR - 1
        IF (TBR(1,J) .GE. TBR(1,J+1)) GO TO 90
   10 CONTINUE
      DO 30 J = 1, NTBR - 1
        IF (NLEG .LT. MXLEG) GO TO 15
        CALL DKERR(11)
        RETURN
   15   K = NLEG + 1
        NLEG = K
        LGP(1,K) = TBR(1,J)
        LGP(2,K) = TBR(1,J+1)
        DO 20 I = 1, 7
          LGP(2+I,K) = TBR(I,J)
   20   CONTINUE
        LGP(10,K) = TBR(1,J+1)
        LGP(11,K) = TBR(2,J+1)
        LGP(12,K) = TBR(3,J+1)
        LGP(13,K) = TBR(5,J+1)
        LGP(14,K) = TBR(6,J+1)
        LGP(15,K) = TBR(7,J+1)
        LGP(16,K) = 0.0D0
        LGP(17,K) = TBR(4,J+1)
        LGSN(K) = ITBSN
        LGTYP(K) = KTABL
        LGN(K) = TBEF(J) + 2 * TBEF(J+1)
        LGGC(K) = ITBGC
        LGVEH(K) = ITBVH
   30 CONTINUE
      NTBR = 0
      RETURN
   90 CALL DKERR(9)
      NTBR = 0
      RETURN
      END
C
C     DKCUES: the burn cues read, each paired with its scenario's
C     TIMELINE rows in time order: the first row named IGN=, then the
C     first after it named CUT=; into /CBRN/, sorted by scenario and
C     ignition (stably, in card order).
      SUBROUTINE DKCUES
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER Q, K, M, K1, K2, P, DKNMEQ
      DOUBLE PRECISION T1, T2
      NBR = 0
      IF (NCQ .EQ. 0) RETURN
      DO 50 Q = 1, NCQ
        M = CQSN(Q)
        K1 = 0
        IF (NTL .EQ. 0) GO TO 90
        DO 10 K = 1, NTL
          IF (TLSN(K) .NE. M) GO TO 10
          IF (DKNMEQ(K, CQIS(Q), CQIL(Q)) .EQ. 0) GO TO 10
          K1 = K
          GO TO 15
   10   CONTINUE
        GO TO 90
   15   T1 = TLT(K1)
        K2 = 0
        DO 20 K = 1, NTL
          IF (TLSN(K) .NE. M .OR. TLT(K) .LE. T1) GO TO 20
          IF (DKNMEQ(K, CQCS(Q), CQCL(Q)) .EQ. 0) GO TO 20
          K2 = K
          GO TO 25
   20   CONTINUE
        GO TO 90
   25   T2 = TLT(K2)
        P = NBR
   30   IF (P .LT. 1) GO TO 40
        IF (BRSN(P) .LT. M) GO TO 40
        IF (BRSN(P) .EQ. M .AND. BRT1(P) .LE. T1) GO TO 40
        BRT1(P+1) = BRT1(P)
        BRT2(P+1) = BRT2(P)
        BRSN(P+1) = BRSN(P)
        BRVH(P+1) = BRVH(P)
        BREN(P+1) = BREN(P)
        P = P - 1
        GO TO 30
   40   BRT1(P+1) = T1
        BRT2(P+1) = T2
        BRSN(P+1) = M
        BRVH(P+1) = CQVH(Q)
        BREN(P+1) = CQEN(Q)
        NBR = NBR + 1
   50 CONTINUE
      RETURN
   90 CALL DKERRC(10, CQCD(Q))
      RETURN
      END
C
C     DKNMEQ: 1 if timeline row K's name is the burn cue name at
C     CQCH(IS) for N codes, else 0.
      INTEGER FUNCTION DKNMEQ(K, IS, N)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER K, IS, N, I
      DKNMEQ = 0
      IF (TLNL(K) .NE. N) RETURN
      DKNMEQ = 1
      IF (N .EQ. 0) RETURN
      DKNMEQ = 0
      DO 10 I = 1, N
        IF (TNCH(TLNS(K)+I-1) .NE. CQCH(IS+I-1)) RETURN
   10 CONTINUE
      DKNMEQ = 1
      RETURN
      END
