C     VDKFLD: the card reader's field readers (#26; the reader is
C     vdeck.f): a card's words looked up in the vocabulary (vdvoc.f),
C     its numbers and g.e.t.s read exactly, its lists and its text.
C     The grammar is in vdeck.f's header.
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
C     digits, a point, an exponent of three digits at most after E or
C     e.  Up to 15 significant digits and a power of ten within
C     10**22 the fast path (vdeck.f); 16 or 17 digits, enough to carry
C     any double, or a power down to 10**-44, through DKDD.
      SUBROUTINE DKNMS(IS, N, X)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER IS, N, I, IE, C, ND, NF, NDIG, IDOT, IEX, IES, NE, K, NX
      DOUBLE PRECISION X, SG, AM, AX
      X = 0.0D0
      SG = 1.0D0
      AM = 0.0D0
      AX = 0.0D0
      NX = 0
      ND = 0
      NF = 0
      NDIG = 0
      IDOT = 0
      IEX = 0
      I = IS
      IE = IS + N - 1
      IF (N .LE. 0) GO TO 90
      IF (ITKB(I) .EQ. ICPLS) GO TO 5
      IF (ITKB(I) .NE. ICMIN) GO TO 10
      SG = -1.0D0
    5 I = I + 1
   10 IF (I .GT. IE) GO TO 50
      C = ITKB(I)
      I = I + 1
      IF (C .GE. ICD0 .AND. C .LE. ICD9) GO TO 20
      IF (C .EQ. ICPT) GO TO 30
      IF (C .EQ. ICUE .OR. C .EQ. ICLE) GO TO 40
      GO TO 90
   20 IF (ND .GT. 0 .OR. C .GT. ICD0) ND = ND + 1
      NDIG = NDIG + 1
      IF (IDOT .EQ. 1) NF = NF + 1
      IF (ND .GT. 17) GO TO 91
      IF (ND .GT. 15) GO TO 25
      AM = AM * 10.0D0 + DBLE(C - ICD0)
      GO TO 10
C     The 16th and 17th significant digits, held apart (AX, NX).
   25 AX = AX * 10.0D0 + DBLE(C - ICD0)
      NX = NX + 1
      GO TO 10
   30 IF (IDOT .EQ. 1) GO TO 90
      IDOT = 1
      GO TO 10
C     The exponent.
   40 IES = 1
      NE = 0
      IF (I .GT. IE) GO TO 90
      IF (ITKB(I) .EQ. ICPLS) GO TO 44
      IF (ITKB(I) .NE. ICMIN) GO TO 45
      IES = -1
   44 I = I + 1
   45 IF (I .GT. IE) GO TO 48
      C = ITKB(I)
      I = I + 1
      IF (C .LT. ICD0 .OR. C .GT. ICD9) GO TO 90
      IF (NE .GE. 3) GO TO 91
      IEX = IEX * 10 + (C - ICD0)
      NE = NE + 1
      GO TO 45
   48 IF (NE .EQ. 0) GO TO 90
      IEX = IES * IEX
   50 IF (NDIG .EQ. 0) GO TO 90
      K = IEX - NF
      IF (AM .EQ. 0.0D0) GO TO 60
      IF (K .GT. 22 .OR. K .LT. -44) GO TO 91
      IF (NX .GT. 0 .OR. K .LT. -22) GO TO 55
      IF (K .GE. 0) X = AM * P10(K+1)
      IF (K .LT. 0) X = AM / P10(1-K)
      GO TO 60
   55 CALL DKDD(AM, NX, AX, K, X)
   60 X = SG * X
      RETURN
   90 CALL DKERR(2)
      RETURN
   91 CALL DKERR(3)
      X = 0.0D0
      RETURN
      END
C
C     DKDD: X = (A * 10**NX + B) * 10**K, correctly rounded, for A a
C     whole number below 10**15 (at least 10**14 if NX > 0), B below
C     10**NX, NX 0 to 2, K -44 to 22.  The integer of 17 digits at most
C     is held exactly as the sum of two doubles, then multiplied by
C     10**K or divided by 10**-K (exact powers, in two steps below
C     10**-22) carrying about 106 bits, and rounded once (Dekker 1971,
C     the exact product by splitting).  Correct unless the decimal lies within about
C     2**-103 of halfway between two doubles; a double written with 17
C     digits lies near a double, never near halfway.  Ours.  RESTOMOD:
C     the 1108's double had a 60-bit fraction, "18-digit precision"
C     (UP-4046 Rev 3, pp. 4-10; docs/univac-1108.md), and would hold 17
C     digits outright; IEEE's 53 bits need this.  It counts on each
C     operation rounded alone: no fused multiply-add (wasm has none;
C     gfortran makes none for x86-64 without -mfma).
      SUBROUTINE DKDD(A, NX, B, K, X)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER NX, K, KR, KD
      DOUBLE PRECISION A, B, X, H, E, S, T, L, D, Q, PH, PL
C     The integer as H + L, exactly: A * 10**NX as H + E, then B added
C     (H is at least 10**15, above B, so the sum's error T is exact).
      CALL DKTWOP(A, P10(NX+1), H, E)
      S = H + B
      T = B - (S - H)
      L = E + T
      H = S + L
      L = L - (H - S)
      IF (K .LT. 0) GO TO 20
      CALL DKTWOP(H, P10(K+1), PH, PL)
      X = PH + (PL + L * P10(K+1))
      RETURN
C     Division by D = 10**22 at most: the quotient Q, its remainder
C     from the exact product Q * D, and the remainder's quotient, the
C     new H + L; again while KR, the power left, is not 0.
   20 KR = -K
   25 KD = KR
      IF (KD .GT. 22) KD = 22
      D = P10(KD+1)
      KR = KR - KD
      Q = H / D
      CALL DKTWOP(Q, D, PH, PL)
      L = (((H - PH) - PL) + L) / D
      H = Q
      IF (KR .GT. 0) GO TO 25
      X = H + L
      RETURN
      END
C
C     DKTWOP: P + E = A * B exactly, P the rounded product (Dekker's
C     split of each factor into halves of 26 bits, 134217729 = 2**27 +
C     1).
      SUBROUTINE DKTWOP(A, B, P, E)
      DOUBLE PRECISION A, B, P, E, C, AH, AL, BH, BL
      C = 134217729.0D0 * A
      AH = C - (C - A)
      AL = A - AH
      C = 134217729.0D0 * B
      BH = C - (C - B)
      BL = B - BH
      P = A * B
      E = ((AH * BH - P) + AH * BL + AL * BH) + AL * BL
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
      INTEGER IS, N, I, IE, C, NP, ND, NS, NF, IDOT
      DOUBLE PRECISION X, SG, HM(3)
      X = 0.0D0
      IE = IS + N - 1
      IF (N .LE. 0) GO TO 7
      DO 5 I = IS, IE
        IF (ITKB(I) .EQ. ICCOL) GO TO 8
    5 CONTINUE
    7 CALL DKNMS(IS, N, X)
      RETURN
    8 SG = 1.0D0
      I = IS
      IF (ITKB(I) .NE. ICMIN) GO TO 9
      SG = -1.0D0
      I = I + 1
C     Up to three fields: hours, minutes, seconds; ND digits in each,
C     NS of them significant (15 at most), NF of the seconds' after the
C     point.
    9 NP = 1
      HM(1) = 0.0D0
      HM(2) = 0.0D0
      HM(3) = 0.0D0
      ND = 0
      NS = 0
      NF = 0
      IDOT = 0
   10 IF (I .GT. IE) GO TO 50
      C = ITKB(I)
      I = I + 1
      IF (C .GE. ICD0 .AND. C .LE. ICD9) GO TO 20
      IF (C .EQ. ICCOL) GO TO 30
      IF (C .EQ. ICPT .AND. NP .EQ. 3 .AND. IDOT .EQ. 0) GO TO 40
      GO TO 90
   20 HM(NP) = HM(NP) * 10.0D0 + DBLE(C - ICD0)
      ND = ND + 1
      IF (NS .GT. 0 .OR. C .GT. ICD0) NS = NS + 1
      IF (IDOT .EQ. 1) NF = NF + 1
      IF (NS .GT. 15 .OR. NF .GT. 15) GO TO 91
      GO TO 10
   30 IF (ND .EQ. 0 .OR. NP .EQ. 3) GO TO 90
      NP = NP + 1
      ND = 0
      NS = 0
      GO TO 10
   40 IDOT = 1
      GO TO 10
   50 IF (ND .EQ. 0) GO TO 90
      X = (HM(1) * 3600.0D0 + HM(2) * 60.0D0) * P10(NF+1) + HM(3)
      IF (X .GE. 1.0D15) GO TO 91
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
      IF (ITKB(I) .NE. ICMIN) GO TO 10
      ISG = -1
      I = I + 1
      IF (N .EQ. 1) GO TO 90
   10 IF (I .GT. IS + N - 1) GO TO 20
      C = ITKB(I)
      I = I + 1
      IF (C .LT. ICD0 .OR. C .GT. ICD9 .OR. DKINS .GT. 99999) GO TO 90
      DKINS = DKINS * 10 + (C - ICD0)
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
        IF (I .LT. TVS(J) + TVL(J) .AND. ITKB(I) .NE. ICCOM) GO TO 10
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
        IF (I .LT. TVS(J) + TVL(J) .AND. ITKB(I) .NE. ICCOM) GO TO 10
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
    5 IF (N .EQ. 0) RETURN
      DO 10 I = 1, N
        IST(NU+I) = ITKB(TVS(J)+I-1)
   10 CONTINUE
      NU = NU + N
      RETURN
      END
C
