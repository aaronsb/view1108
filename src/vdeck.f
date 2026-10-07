C     VDECK: the card reader (#26, slice 4), the kernel reading its own
C     run decks: a mission's cards (MISSION, EPOCH, SITE, PAD) and its
C     scenarios' (data/missions/*/*.scn), one card image at a time,
C     into the run tables BLOCK DATA fills today (/CSCEN/ to /CBRN/,
C     the situation tables, SITECH).  TN D-6853 printed p. 12 has VIEW
C     take its trajectory from the operational trajectory document per
C     mission; a deck read per run is that shape.  Which cards, their
C     keys and code words: tools/gen_data.py, which writes the
C     vocabulary (vdvoc.f) from the same tables it checks decks with.
C
C     CRDOPN empties the run tables; CRDIN reads one card; CRDEND ends
C     the deck (closes an open TABLE leg, resolves the burn cues, checks
C     the scenario and situation ids) and gives the first deck error,
C     its card number and the warnings.  CRDSUM is a hash total of the
C     run tables (ours), so two loads can be compared word for word.
C     The card semantics are in vdkscn.f.
C
C     A card: KIND KEY=VALUE ..., values in double quotes where they
C     hold blanks; a * in column 1 or a blank card is a comment.  Every
C     number is read exactly: its digits as an integer (15 at most),
C     then one multiply or divide by a power of ten up to 10**22, both
C     exact, so the double is the decimal correctly rounded, the value
C     a compiler gives the same digits as a constant (Clinger 1990,
C     the fast path).  A g.e.t. h:mm:ss.s folds h and mm into that
C     integer.  RESTOMOD: free-field input was a FORTRAN V extension
C     (UP-4046 sec. 10.4.1); this hand reader of KEY=VALUE cards stands
C     in for NAMELIST, which LFortran does not have.
C
C     Deck errors (IDKER; the first one stands, the deck is refused):
C      1 card longer than MXCRD     2 bad number
C      3 more than 15 digits, or exponent out of range
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
C     21 too many tokens, or an open quote
C     22 list of the wrong length        23 name too long
C
      SUBROUTINE CRDOPN
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
C     The deck in hand, and no scenario or tape left from the last.
      IDKER = 0
      IDKCD = 0
      NDKWN = 0
      NDKCD = 0
      CALL DKMSN
      ITBON = 0
      NTBR = 0
      NTNC = 0
      NCQ = 0
      NCQC = 0
      ISN = 0
      ITPSN = 0
      P10(1) = 1.0D0
      DO 30 K = 2, 23
        P10(K) = P10(K-1) * 10.0D0
   30 CONTINUE
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
      INTEGER I, J, K, W, DKLOOK
      NDKCD = NDKCD + 1
      IF (IDKER .NE. 0) RETURN
      IF (NC .LE. MXCRD) GO TO 5
      CALL DKERR(1)
      RETURN
    5 NCRD = NC
      DO 10 I = 1, NC
        ICRD(I) = IC(I)
   10 CONTINUE
C     Trailing blanks, tabs and carriage returns off; blank cards and
C     cards with * in column 1 are comments.
   20 IF (NCRD .EQ. 0) RETURN
      I = ICRD(NCRD)
      IF (I .NE. 32 .AND. I .NE. 9 .AND. I .NE. 13) GO TO 30
      NCRD = NCRD - 1
      GO TO 20
   30 IF (ICRD(1) .EQ. 42) RETURN
      CALL DKTOK
      IF (IDKER .NE. 0) RETURN
      DO 35 K = 1, NVOCW
        KSLT(K) = 0
   35 CONTINUE
      KCRD = 0
      W = DKLOOK(VCARD, TKS(1), TKL(1))
      IF (W .GT. 0) KCRD = VOCV(W)
      IF (KCRD .GT. 0) GO TO 40
      NDKWN = NDKWN + 1
      RETURN
C     The keys; an unknown key or a word without = is skipped.
   40 DO 50 J = 2, NTOK
        IF (TVL(J) .LT. 0) GO TO 45
        W = DKLOOK(VKEY, TKS(J), TVS(J) - 1 - TKS(J))
        IF (W .EQ. 0) GO TO 45
        KSLT(VOCV(W)) = J
        GO TO 50
   45   NDKWN = NDKWN + 1
   50 CONTINUE
      IF (ITBON .EQ. 1 .AND. KCRD .NE. QROW) CALL DKTBCL
      IF (IDKER .NE. 0) RETURN
      CALL DKCARD
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
      INTEGER IERR, ICARD, NWARN, K
      IF (IDKER .EQ. 0 .AND. ITBON .EQ. 1) CALL DKTBCL
      IF (IDKER .EQ. 0) CALL DKCUES
C     Scenarios 1..NSN and situations 1..NSIT, none missing.
      NSN = 0
      DO 10 K = 1, MXSN
        IF (ISNHV(K) .NE. 0) NSN = K
   10 CONTINUE
      DO 11 K = 1, NSN
        IF (ISNHV(K) .EQ. 0) CALL DKERR(20)
   11 CONTINUE
      NSIT = 0
      DO 12 K = 1, MXSIT
        IF (ISTHV(K) .NE. 0) NSIT = K
   12 CONTINUE
      DO 13 K = 1, NSIT
        IF (ISTHV(K) .LT. 3) CALL DKERR(20)
   13 CONTINUE
      IF (IDKER .EQ. 0) GO TO 20
      NSN = 0
      NLEG = 0
      NEVT = 0
      NSTART = 0
      NRF = 0
      NBN = 0
      NTL = 0
      NBR = 0
      NSIT = 0
   20 IERR = IDKER
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
      IF (IDKER .NE. 0) RETURN
      IDKER = K
      IDKCD = NDKCD
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
      IF (ICRD(I) .NE. 32 .AND. ICRD(I) .NE. 9) GO TO 20
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
      IF (C .EQ. 32 .OR. C .EQ. 9) GO TO 80
      IF (C .NE. 34 .AND. C .NE. 39) GO TO 50
      IQ = C
      GO TO 30
   40 IF (C .NE. IQ) GO TO 50
      IQ = 0
      GO TO 30
   50 J = J + 1
      ITKB(J) = C
      IF (IQ .EQ. 0 .AND. C .EQ. 61 .AND. TVL(NTOK) .LT. 0)
     &  TVL(NTOK) = 0
      IF (TVL(NTOK) .EQ. 0 .AND. TVS(NTOK) .EQ. 0) TVS(NTOK) = J + 1
      GO TO 30
   80 IF (IQ .NE. 0) CALL DKERR(21)
      TKL(NTOK) = J - TKS(NTOK) + 1
      IF (TVL(NTOK) .GE. 0) TVL(NTOK) = J - TVS(NTOK) + 1
      GO TO 10
      END
C
C     DKLOOK: the word of list L spelled by ITKB(IS) .. ITKB(IS+N-1),
C     its number in the vocabulary, or 0.
      INTEGER FUNCTION DKLOOK(L, IS, N)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER L, IS, N, W, I
      DKLOOK = 0
      DO 20 W = VOCLST(L), VOCLST(L+1) - 1
        IF (VOCN(W) .NE. N) GO TO 20
        DO 10 I = 1, N
          IF (VOCC(VOCS(W)+I-1) .NE. ITKB(IS+I-1)) GO TO 20
   10   CONTINUE
        DKLOOK = W
        RETURN
   20 CONTINUE
      RETURN
      END
C
C     DKWSP: the code of the word of list L at ITKB(IS) for N codes;
C     deck error 4 (and 0) if the list has no such word.
      INTEGER FUNCTION DKWSP(L, IS, N)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER L, IS, N, W, DKLOOK
      DKWSP = 0
      W = DKLOOK(L, IS, N)
      IF (W .EQ. 0) CALL DKERR(4)
      IF (W .GT. 0) DKWSP = VOCV(W)
      RETURN
      END
C
C     DKWRD: the code of key KY's word in list L; IDEF if the card has
C     no such key, or deck error 5 if IDEF is -1 (a required key).
      INTEGER FUNCTION DKWRD(L, KY, IDEF)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER L, KY, IDEF, J, DKWSP
      J = KSLT(KY)
      DKWRD = IDEF
      IF (J .GT. 0) DKWRD = DKWSP(L, TVS(J), TVL(J))
      IF (J .GT. 0 .OR. IDEF .NE. -1) RETURN
      DKWRD = 0
      CALL DKERR(5)
      RETURN
      END
C
C     DKREQ: the token of required key KY, or deck error 5 (and 0).
      INTEGER FUNCTION DKREQ(KY)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER KY
      DKREQ = KSLT(KY)
      IF (DKREQ .EQ. 0) CALL DKERR(5)
      RETURN
      END
C
C     DKNMS: the decimal number at ITKB(IS) for N codes into X: sign,
C     digits, a point, an exponent after E or D.
      SUBROUTINE DKNMS(IS, N, X)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER IS, N, I, IE, C, ND, NF, NDIG, IDOT, IEX, IES, NE, K
      DOUBLE PRECISION X, SG, AM
      X = 0.0D0
      SG = 1.0D0
      AM = 0.0D0
      ND = 0
      NF = 0
      NDIG = 0
      IDOT = 0
      IEX = 0
      I = IS
      IE = IS + N - 1
      IF (N .LE. 0) GO TO 90
      IF (ITKB(I) .EQ. 43) I = I + 1
      IF (ITKB(I) .NE. 45) GO TO 10
      SG = -1.0D0
      I = I + 1
   10 IF (I .GT. IE) GO TO 50
      C = ITKB(I)
      I = I + 1
      IF (C .GE. 48 .AND. C .LE. 57) GO TO 20
      IF (C .EQ. 46) GO TO 30
      IF (C .EQ. 69 .OR. C .EQ. 68 .OR. C .EQ. 101 .OR. C .EQ. 100)
     &  GO TO 40
      GO TO 90
   20 IF (ND .GT. 0 .OR. C .GT. 48) ND = ND + 1
      AM = AM * 10.0D0 + DBLE(C - 48)
      NDIG = NDIG + 1
      IF (IDOT .EQ. 1) NF = NF + 1
      IF (ND .GT. 15) GO TO 91
      GO TO 10
   30 IF (IDOT .EQ. 1) GO TO 90
      IDOT = 1
      GO TO 10
C     The exponent.
   40 IES = 1
      NE = 0
      IF (I .GT. IE) GO TO 90
      IF (ITKB(I) .EQ. 43) I = I + 1
      IF (I .GT. IE) GO TO 90
      IF (ITKB(I) .NE. 45) GO TO 45
      IES = -1
      I = I + 1
   45 IF (I .GT. IE) GO TO 48
      C = ITKB(I)
      I = I + 1
      IF (C .LT. 48 .OR. C .GT. 57) GO TO 90
      IF (IEX .GT. 999) GO TO 91
      IEX = IEX * 10 + (C - 48)
      NE = NE + 1
      GO TO 45
   48 IF (NE .EQ. 0) GO TO 90
      IEX = IES * IEX
   50 IF (NDIG .EQ. 0) GO TO 90
      K = IEX - NF
      IF (AM .EQ. 0.0D0) GO TO 60
      IF (K .GT. 22 .OR. K .LT. -22) GO TO 91
      IF (K .GE. 0) X = AM * P10(K+1)
      IF (K .LT. 0) X = AM / P10(1-K)
   60 X = SG * X
      RETURN
   90 CALL DKERR(2)
      RETURN
   91 CALL DKERR(3)
      X = 0.0D0
      RETURN
      END
C
C     DKGTS: a g.e.t. at ITKB(IS) for N codes into X (s): h:mm:ss.s,
C     h:mm, or a decimal number of seconds; a leading - counts down to
C     range zero.  h*3600 + mm*60 + ss is one exact integer of tenths
C     (or whatever ss's last place is), divided once.
      SUBROUTINE DKGTS(IS, N, X)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER IS, N, I, IE, C, NP, ND, NF, IDOT
      DOUBLE PRECISION X, SG, HM(3)
      X = 0.0D0
      IE = IS + N - 1
      DO 5 I = IS, IE
        IF (ITKB(I) .EQ. 58) GO TO 8
    5 CONTINUE
      CALL DKNMS(IS, N, X)
      RETURN
    8 SG = 1.0D0
      I = IS
      IF (ITKB(I) .NE. 45) GO TO 9
      SG = -1.0D0
      I = I + 1
C     Up to three fields: hours, minutes, seconds; ND digits in each,
C     NF of the seconds' after the point.
    9 NP = 1
      HM(1) = 0.0D0
      HM(2) = 0.0D0
      HM(3) = 0.0D0
      ND = 0
      NF = 0
      IDOT = 0
   10 IF (I .GT. IE) GO TO 50
      C = ITKB(I)
      I = I + 1
      IF (C .GE. 48 .AND. C .LE. 57) GO TO 20
      IF (C .EQ. 58) GO TO 30
      IF (C .EQ. 46 .AND. NP .EQ. 3 .AND. IDOT .EQ. 0) GO TO 40
      GO TO 90
   20 HM(NP) = HM(NP) * 10.0D0 + DBLE(C - 48)
      ND = ND + 1
      IF (IDOT .EQ. 1) NF = NF + 1
      IF (ND .GT. 15) GO TO 91
      GO TO 10
   30 IF (ND .EQ. 0 .OR. NP .EQ. 3) GO TO 90
      NP = NP + 1
      ND = 0
      GO TO 10
   40 IDOT = 1
      GO TO 10
   50 IF (ND .EQ. 0 .OR. NF .GT. 15) GO TO 90
      X = (HM(1) * 3600.0D0 + HM(2) * 60.0D0) * P10(NF+1) + HM(3)
      IF (X .GE. 9.0D15) GO TO 91
      X = SG * (X / P10(NF+1))
      RETURN
   90 CALL DKERR(2)
      X = 0.0D0
      RETURN
   91 CALL DKERR(3)
      X = 0.0D0
      RETURN
      END
C
C     DKINS: the whole number at ITKB(IS) for N codes, or deck error 2.
      INTEGER FUNCTION DKINS(IS, N)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER IS, N, I, C, ISG
      DKINS = 0
      ISG = 1
      I = IS
      IF (N .LE. 0) GO TO 90
      IF (ITKB(I) .NE. 45) GO TO 10
      ISG = -1
      I = I + 1
      IF (N .EQ. 1) GO TO 90
   10 IF (I .GT. IS + N - 1) GO TO 20
      C = ITKB(I)
      I = I + 1
      IF (C .LT. 48 .OR. C .GT. 57 .OR. DKINS .GT. 99999) GO TO 90
      DKINS = DKINS * 10 + (C - 48)
      GO TO 10
   20 DKINS = ISG * DKINS
      RETURN
   90 CALL DKERR(2)
      DKINS = 0
      RETURN
      END
C
C     Key KY's value: DKNUM a required number, DKNMD a number with the
C     default DEF, DKGET a required g.e.t., DKGTD a g.e.t. with DEF,
C     DKINT a whole number (IDEF -1: required).
      SUBROUTINE DKNUM(KY, X)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER KY, J, DKREQ
      DOUBLE PRECISION X
      X = 0.0D0
      J = DKREQ(KY)
      IF (J .GT. 0) CALL DKNMS(TVS(J), TVL(J), X)
      RETURN
      END
C
      SUBROUTINE DKNMD(KY, DEF, X)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER KY, J
      DOUBLE PRECISION DEF, X
      X = DEF
      J = KSLT(KY)
      IF (J .GT. 0) CALL DKNMS(TVS(J), TVL(J), X)
      RETURN
      END
C
      SUBROUTINE DKGET(KY, X)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER KY, J, DKREQ
      DOUBLE PRECISION X
      X = 0.0D0
      J = DKREQ(KY)
      IF (J .GT. 0) CALL DKGTS(TVS(J), TVL(J), X)
      RETURN
      END
C
      SUBROUTINE DKGTD(KY, DEF, X)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER KY, J
      DOUBLE PRECISION DEF, X
      X = DEF
      J = KSLT(KY)
      IF (J .GT. 0) CALL DKGTS(TVS(J), TVL(J), X)
      RETURN
      END
C
      INTEGER FUNCTION DKINT(KY, IDEF)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER KY, IDEF, J, DKINS
      J = KSLT(KY)
      DKINT = IDEF
      IF (J .GT. 0) DKINT = DKINS(TVS(J), TVL(J))
      IF (J .GT. 0 .OR. IDEF .NE. -1) RETURN
      DKINT = 0
      CALL DKERR(5)
      RETURN
      END
C
C     DKNLS: token J's value as a list of exactly N numbers separated by
C     commas, into X(1..N); deck error 22 for another count.
      SUBROUTINE DKNLS(J, N, X)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER J, N, I, IS, K
      DOUBLE PRECISION X(N)
      K = 0
      IS = TVS(J)
      DO 10 I = TVS(J), TVS(J) + TVL(J)
        IF (I .LT. TVS(J) + TVL(J) .AND. ITKB(I) .NE. 44) GO TO 10
        K = K + 1
        IF (K .GT. N) GO TO 20
        CALL DKNMS(IS, I - IS, X(K))
        IS = I + 1
   10 CONTINUE
      IF (K .EQ. N) RETURN
   20 CALL DKERR(22)
      RETURN
      END
C
C     DKWLS: token J's value as a list of words of list L separated by
C     commas, their codes into IV(1..N), N at most MX (deck error 22).
      SUBROUTINE DKWLS(J, L, MX, IV, N)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER J, L, MX, IV(MX), N, I, IS, DKWSP
      N = 0
      IS = TVS(J)
      DO 10 I = TVS(J), TVS(J) + TVL(J)
        IF (I .LT. TVS(J) + TVL(J) .AND. ITKB(I) .NE. 44) GO TO 10
        N = N + 1
        IF (N .GT. MX) GO TO 20
        IV(N) = DKWSP(L, IS, I - IS)
        IS = I + 1
   10 CONTINUE
      RETURN
   20 N = MX
      CALL DKERR(22)
      RETURN
      END
C
C     DKTXT: token J's value as text, its codes appended to the store
C     IST (MX codes, NU used): IS where they start, N how many.
      SUBROUTINE DKTXT(J, IST, MX, NU, IS, N)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER J, MX, IST(MX), NU, IS, N, I
      IS = NU + 1
      N = TVL(J)
      IF (NU + N .LE. MX) GO TO 5
      CALL DKERR(19)
      N = 0
      RETURN
    5 DO 10 I = 1, N
        IST(NU+I) = ITKB(TVS(J)+I-1)
   10 CONTINUE
      NU = NU + N
      RETURN
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
      DO 50 Q = 1, NCQ
        M = CQSN(Q)
        K1 = 0
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
   90 CALL DKERR(10)
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
      DO 10 I = 1, N
        IF (TNCH(TLNS(K)+I-1) .NE. CQCH(IS+I-1)) RETURN
   10 CONTINUE
      DKNMEQ = 1
      RETURN
      END
C
C     CRDSUM: a hash total of the run tables' used entries (ours), four
C     sums ISUM(1..4) over every 32-bit word, a double as its two
C     words, so two loads of a deck (or a deck and BLOCK DATA) can be
C     compared without listing the tables.
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
      DO 10 K = 1, NSN
        CALL DKHD(SNJD0(K), ISUM)
        CALL DKHD(SNSLA(K), ISUM)
        CALL DKHD(SNSLO(K), ISUM)
        CALL DKHD(SNSAZ(K), ISUM)
        CALL DKHD(SNPLA(K), ISUM)
        CALL DKHD(SNPLO(K), ISUM)
        CALL DKHI(SNPGC(K), ISUM)
   10 CONTINUE
      DO 11 K = 1, 8*NSN
        CALL DKHI(PADCH(K), ISUM)
   11 CONTINUE
      DO 12 K = 1, 22
        CALL DKHI(SITECH(K), ISUM)
   12 CONTINUE
      CALL DKHI(NLEG, ISUM)
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
      CALL DKHI(NEVT, ISUM)
      DO 15 K = 1, NEVT
        CALL DKHD(EVT(K), ISUM)
        CALL DKHI(EVSN(K), ISUM)
        CALL DKHI(EVKND(K), ISUM)
   15 CONTINUE
      CALL DKHI(NSTART, ISUM)
      DO 17 K = 1, NSTART
        DO 16 I = 1, NLGP
          CALL DKHD(STP(I,K), ISUM)
   16   CONTINUE
        CALL DKHI(STSN(K), ISUM)
        CALL DKHI(STBOD(K), ISUM)
        CALL DKHI(STGC(K), ISUM)
   17 CONTINUE
      CALL DKHI(NRF, ISUM)
      DO 19 K = 1, NRF
        DO 18 I = 1, NLGP
          CALL DKHD(RFP(I,K), ISUM)
   18   CONTINUE
        CALL DKHI(RFSN(K), ISUM)
        CALL DKHI(RFBOD(K), ISUM)
        CALL DKHI(RFGC(K), ISUM)
   19 CONTINUE
      CALL DKHI(NBN, ISUM)
      DO 20 K = 1, NBN
        CALL DKHD(BNT(K), ISUM)
        CALL DKHD(BNDV(K), ISUM)
        CALL DKHD(BNP(K), ISUM)
        CALL DKHD(BNR(K), ISUM)
        CALL DKHD(BNN(K), ISUM)
        CALL DKHI(BNSN(K), ISUM)
        CALL DKHI(BNBOD(K), ISUM)
   20 CONTINUE
      CALL DKHI(NTL, ISUM)
      DO 21 K = 1, NTL
        CALL DKHD(TLT(K), ISUM)
        CALL DKHI(TLK(K), ISUM)
        CALL DKHI(TLSN(K), ISUM)
   21 CONTINUE
      CALL DKHI(NBR, ISUM)
      DO 22 K = 1, NBR
        CALL DKHD(BRT1(K), ISUM)
        CALL DKHD(BRT2(K), ISUM)
        CALL DKHI(BRSN(K), ISUM)
        CALL DKHI(BRVH(K), ISUM)
        CALL DKHI(BREN(K), ISUM)
   22 CONTINUE
      CALL DKHI(NSIT, ISUM)
      DO 30 K = 1, NSIT
        CALL DKHSIT(K, ISUM)
   30 CONTINUE
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
