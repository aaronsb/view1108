C     VDKSIT: the card reader's situation cards (#26; the reader is
C     vdeck.f, the scenario cards vdkscn.f): SITUATION and the RECIPE,
C     VIEWS and HDRREF cards that follow it, into the situation tables
C     (src/viewsit.inc), as tools/gen_data.py wrote them into BLOCK
C     DATA before the reader took over (#26).
C
C     DKSIT: SITUATION ID= GET= FOV= LOOK= WINDOW= LAYERS= POSE= DRAW=
C     opens situation row ID of the scenario in hand; its RECIPE, VIEWS
C     and (optional) HDRREF cards follow in that order.  GET: a g.e.t.
C     (SIGK 1, SIGT), EVENT+-offset (2, SIGE the event, SIGT the
C     offset) or a rule+-offset (VGRUL: 3 the Earthrise search).  FOV:
C     degrees (SIFK 1) or DISC:f (2).  A layer named twice is refused.
      SUBROUTINE DKSIT
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER K, J, I, L, N, IW(12), DKINT, DKREQ, DKWRD, DKWSP
      IDST = 0
      K = DKINT(YID, -1)
      IF (IDKER .NE. 0) RETURN
      IF (K .GE. 1 .AND. K .LE. MXSIT) GO TO 5
      CALL DKERR(7)
      RETURN
    5 IF (ISTHV(K) .EQ. 0) GO TO 10
      CALL DKERR(8)
      RETURN
   10 CALL DKSIZ(K)
      ISTHV(K) = 1
      STCD(K) = NDKCD
      IDST = K
      SISN(K) = IDSN
      J = DKREQ(YGET)
      IF (J .GT. 0) CALL DKGRL(TVS(J), TVL(J), SIGK(K), SIGE(K),
     &                         SIGT(K))
      J = DKREQ(YFOV)
      IF (J .EQ. 0) RETURN
      SIFK(K) = 1
      IF (TVL(J) .EQ. 0) GO TO 22
      DO 20 I = TVS(J), TVS(J) + TVL(J) - 1
        IF (ITKB(I) .NE. ICCOL) GO TO 20
        SIFK(K) = DKWSP(VFOVR, TVS(J), I - TVS(J))
        CALL DKNMS(I + 1, TVS(J) + TVL(J) - 1 - I, SIFV(K))
        GO TO 25
   20 CONTINUE
   22 CALL DKNMS(TVS(J), TVL(J), SIFV(K))
   25 J = KSLT(YLOOK)
      IF (J .GT. 0) CALL DKNLS(J, 3, SILK(1,K))
      SIWN(K) = DKWRD(VWIN, YWINDO, -1)
      J = DKREQ(YLAYER)
      IF (J .EQ. 0) GO TO 28
      CALL DKWLS(J, VLAYR, MXLAY, SILY(1,K), N)
      IF (N .LT. 2) GO TO 28
      DO 27 I = 2, N
        DO 26 L = 1, I - 1
          IF (SILY(L,K) .EQ. SILY(I,K)) CALL DKERR(22)
   26   CONTINUE
   27 CONTINUE
   28 SIPS(K) = DKWRD(VPOSE, YPOSE, 0)
      J = KSLT(YDRAW)
      IF (J .EQ. 0) RETURN
      CALL DKWLS(J, VDRAW, 12, IW, N)
      IF (N .EQ. 0) RETURN
      DO 30 I = 1, N
        SIDW(K) = SIDW(K) + IW(I)
   30 CONTINUE
      RETURN
      END
C
C     DKGRL: a SITUATION's GET= at ITKB(IS) for N codes: its rule KG,
C     event KE and g.e.t. or offset T (DKSIT).
      SUBROUTINE DKGRL(IS, N, KG, KE, T)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER IS, N, KG, KE, I, IE, C, W, DKLOOK
      DOUBLE PRECISION T
      KG = 1
      KE = 0
      T = 0.0D0
      IE = IS + N - 1
      C = ITKB(IS)
      IF (N .GT. 0 .AND. C .GE. ICUA .AND. C .LE. ICUZ) GO TO 10
      CALL DKGTS(IS, N, T)
      RETURN
C     A word (letters, then letters or digits), then +- an offset.
   10 I = IS + 1
   15 IF (I .GT. IE) GO TO 20
      C = ITKB(I)
      IF ((C .GE. ICUA .AND. C .LE. ICUZ) .OR.
     &    (C .GE. ICD0 .AND. C .LE. ICD9)) GO TO 18
      GO TO 20
   18 I = I + 1
      GO TO 15
   20 W = DKLOOK(VGRUL, IS, I - IS)
      IF (W .EQ. 0) GO TO 25
      KG = VOCV(W)
      GO TO 30
   25 W = DKLOOK(VEVK, IS, I - IS)
      IF (W .EQ. 0) GO TO 90
      KG = 2
      KE = VOCV(W)
C     One sign: the offset itself takes none.
   30 IF (I .GT. IE) RETURN
      C = ITKB(I)
      IF (C .NE. ICPLS .AND. C .NE. ICMIN) GO TO 91
      IF (I .EQ. IE) GO TO 91
      IF (ITKB(I+1) .EQ. ICPLS .OR. ITKB(I+1) .EQ. ICMIN) GO TO 91
      CALL DKGTS(I + 1, IE - I, T)
      IF (C .EQ. ICMIN) T = -T
      RETURN
   90 CALL DKERR(4)
      RETURN
   91 CALL DKERR(2)
      RETURN
      END
C
C     DKRCP: RECIPE NAME= and its parameters (the keys each recipe
C     takes are tools/gen_data.py's RECIPE_KEYS), into the situation in
C     hand.  CREWSTN and BODYCTR take the Moon as their body, EXTSEED
C     the Earth.
      SUBROUTINE DKRCP
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER K, J, DKWRD, DKWSP
      IF (IDST .EQ. 0) GO TO 90
      K = IDST
      IF (ISTHV(K) .NE. 1) GO TO 90
      ISTHV(K) = 2
      SIRC(K) = DKWRD(VRCP, YNAME, -1)
      J = KSLT(YBODY)
      IF (J .GT. 0) SIBD(K) = DKWSP(VBODY, TVS(J), TVL(J))
      SIMD(K) = DKWRD(VMODE, YMODE, 0)
      SIAZ(K) = DKWRD(VAZ, YAZ, 0)
      CALL DKNMD(YELEV, 0.0D0, SIEL(K))
      J = KSLT(YTURN)
      IF (J .EQ. 0) GO TO 10
      SITR(K) = 1
      CALL DKNLS(J, 3, SITN(1,K))
   10 SIFB(K) = DKWRD(VOFFL, YOFFLE, 0)
      IF (SIFB(K) .NE. 0) CALL DKNUM(YOFFEL, SIFL(K))
      SIAT(K) = DKWRD(VATT, YATT, 0)
      SIFE(K) = DKWRD(VEVK, YAT, 0)
      CALL DKGTD(YFIX, 0.0D0, SIFT(K))
      CALL DKGTD(YDRIFT, 0.0D0, SIDT(K))
      CALL DKNMD(YELOFF, 0.0D0, SIEO(K))
      SIVH(K) = DKWRD(VCRV, YVEH, 0)
      CALL DKNMD(YALT, 0.0D0, SIAL(K))
      CALL DKNMD(YDIST, 0.0D0, SIDS(K))
      IF (SIRC(K) .EQ. 3 .OR. SIRC(K) .EQ. 4) SIBD(K) = 2
      IF (SIRC(K) .EQ. 5) SIBD(K) = 1
      RETURN
   90 CALL DKERR(6)
      RETURN
      END
C
C     DKVWS: VIEWS VIEW= TARGET= OFFTARGET= RIDES= CM= LM= FIXED=
C     XSTART=, into the situation in hand.
      SUBROUTINE DKVWS
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER K, J, DKWRD
      IF (IDST .EQ. 0) GO TO 90
      K = IDST
      IF (ISTHV(K) .NE. 2) GO TO 90
      ISTHV(K) = 3
      SIVW(K) = DKWRD(VVIEW, YVIEW, 0)
      SITG(K) = DKWRD(VTGT, YTARGE, -1)
      SITF(K) = DKWRD(VTGT, YOFFTA, 0)
      SIRD(K) = DKWRD(VRIDE, YRIDES, -1)
      SICM(K) = DKWRD(VSTN, YCM, -1)
      SILM(K) = DKWRD(VSTN, YLM, -1)
      SIFX(K) = DKWRD(VYN, YFIXED, 0)
      J = KSLT(YXSTAR)
      IF (J .EQ. 0) RETURN
      SIXO(K) = 1
      CALL DKNLS(J, 2, SIXY(1,K))
      RETURN
   90 CALL DKERR(6)
      RETURN
      END
C
C     DKHDR: HDRREF OBJ= OFFSET= RADIUS=, into the situation in hand.
      SUBROUTINE DKHDR
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
      INCLUDE 'viewsit.inc'
      INCLUDE 'vdvoc.inc'
      INCLUDE 'vdeck.inc'
C     RESTOMOD END
      INTEGER K, DKWRD
      IF (IDST .EQ. 0) GO TO 90
      K = IDST
      IF (ISTHV(K) .NE. 3) GO TO 90
      ISTHV(K) = 4
      SIHK(K) = DKWRD(VHDR, YOBJ, -1)
      CALL DKNMD(YOFFSE, 0.0D0, SIHO(K))
      CALL DKNMD(YRADIU, 0.0D0, SIHR(K))
      RETURN
   90 CALL DKERR(6)
      RETURN
      END
C
C     DKSIZ: situation row K emptied.
      SUBROUTINE DKSIZ(K)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewsit.inc'
C     RESTOMOD END
      INTEGER K, I
      SIGT(K) = 0.0D0
      SIFV(K) = 0.0D0
      SIEL(K) = 0.0D0
      SIFL(K) = 0.0D0
      SIFT(K) = 0.0D0
      SIDT(K) = 0.0D0
      SIEO(K) = 0.0D0
      SIAL(K) = 0.0D0
      SIDS(K) = 0.0D0
      SIHO(K) = 0.0D0
      SIHR(K) = 0.0D0
      DO 10 I = 1, 3
        SILK(I,K) = 0.0D0
        SITN(I,K) = 0.0D0
   10 CONTINUE
      SIXY(1,K) = 0.0D0
      SIXY(2,K) = 0.0D0
      SISN(K) = 0
      SIGK(K) = 0
      SIGE(K) = 0
      SIFK(K) = 0
      SIWN(K) = 0
      SIPS(K) = 0
      SIDW(K) = 0
      SIRC(K) = 0
      SIBD(K) = 0
      SIMD(K) = 0
      SIAZ(K) = 0
      SITR(K) = 0
      SIFB(K) = 0
      SIAT(K) = 0
      SIFE(K) = 0
      SIVH(K) = 0
      SIVW(K) = 0
      SITG(K) = 0
      SITF(K) = 0
      SIRD(K) = 0
      SICM(K) = 0
      SILM(K) = 0
      SIFX(K) = 0
      SIXO(K) = 0
      SIHK(K) = 0
      DO 20 I = 1, MXLAY
        SILY(I,K) = 0
   20 CONTINUE
      RETURN
      END
