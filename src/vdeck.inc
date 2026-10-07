C     The card reader's state (vdeck.f, vdkscn.f; #26), included after
C     viewdims.inc, viewcom.inc, viewsit.inc and vdvoc.inc.  Maxima are
C     ours.
C
C     /CDECK/ the card in hand: ICRD(1..NCRD) its character codes;
C     ITKB its tokens with their quotes removed, token J at
C     ITKB(TKS(J)) for TKL(J) codes, its value (after the first =) at
C     TVS(J) for TVL(J) (TVL -1: no =); KCRD the card kind (Q...,
C     vdvoc.inc), 0 if unknown; KSLT(K) the token holding key K
C     (Y...), 0 if the card has none.
C     The deck: IDKER the first deck error (0 none; codes in vdeck.f),
C     IDKCD its card number, NDKWN warnings (unknown cards and keys,
C     skipped), NDKCD cards read.
C     The mission in hand (MISSION, EPOCH, SITE, PAD cards), copied into
C     each scenario that follows: IMHV 0 none, 1 its MISSION card read,
C     2 its EPOCH too; MJD epoch, MSIT landing site lat, lon, azimuth,
C     MPAD pad lat, lon, MPGC its latitude geocentric, MPCH its name (8
C     codes).  IDSN the scenario in hand (0 none), ISNHV(M) 1 once
C     scenario M is read, SNCD(M) its SCENARIO card's number.  IDST the situation in hand (0 none);
C     ISTHV(K) the cards situation K has: 0 none, 1 its SITUATION, 2 its
C     RECIPE, 3 its VIEWS, 4 its HDRREF; STCD(K) its SITUATION card's
C     number.
C     The open LEG TYPE=TABLE (ITBON 1): its scenario ITBSN, latitude
C     type ITBGC, vehicle ITBVH, and NTBR ROW cards, TBR(1..7, J) T LAT
C     LON ALT V FPA HDG and TBEF(J) 1 for VEL=EF.
C     Timeline names, for the burn cues: row K's at TNCH(TLNS(K)) for
C     TLNL(K) codes, NTNC used (MXTNC: MXTL names of 60 codes, today's
C     longest).  Burn cues read, resolved by CRDEND: NCQ of them,
C     scenario CQSN, vehicle CQVH, engine CQEN, ignition row name at
C     CQCH(CQIS) for CQIL codes, cutoff at CQCH(CQCS) for CQCL, card
C     number CQCD; NCQC used.  P10(K+1) = 10**K, K = 0 .. 22, exact.
      INTEGER MXCRD, MXTOK, MXTBR, MXTNC, MXCQC
      INTEGER ICBLK, ICTAB, ICCR, ICQUO, ICAPO, ICEQ, ICCOL, ICCOM
      INTEGER ICPLS, ICMIN, ICPT, ICSTR, ICD0, ICD9, ICUA, ICUZ, ICUE
      INTEGER ICLE, ICTIL
C     RESTOMOD BEGIN: card images longer than 80 columns, in ASCII
C     codes one per word (FIELDATA packed six to a 36-bit word, and had
C     no lower case, tab or carriage return); the parenthesised
C     PARAMETER list is FORTRAN 77 (1978).
      PARAMETER (MXCRD=1024, MXTOK=48, MXTBR=60, MXTNC=90000,
     &           MXCQC=4000)
      PARAMETER (ICBLK=32, ICTAB=9, ICCR=13, ICQUO=34, ICAPO=39,
     &           ICEQ=61, ICCOL=58, ICCOM=44, ICPLS=43, ICMIN=45,
     &           ICPT=46, ICSTR=42, ICD0=48, ICD9=57, ICUA=65, ICUZ=90,
     &           ICUE=69, ICLE=101, ICTIL=126)
C     RESTOMOD END
      INTEGER ICRD(MXCRD), NCRD, ITKB(MXCRD), NTOK, TKS(MXTOK)
      INTEGER TKL(MXTOK), TVS(MXTOK), TVL(MXTOK), KCRD, KSLT(NVOCK)
      INTEGER IDKER, IDKCD, NDKWN, NDKCD
      INTEGER IMHV, MPGC, MPCH(8), IDSN, ISNHV(MXSN), SNCD(MXSN), IDST
      INTEGER ISTHV(MXSIT), STCD(MXSIT)
      INTEGER ITBON, ITBSN, ITBGC, ITBVH, NTBR, TBEF(MXTBR)
      INTEGER TLNS(MXTL), TLNL(MXTL), NTNC, TNCH(MXTNC)
      INTEGER NCQ, CQSN(MXCUE), CQVH(MXCUE), CQEN(MXCUE), CQIS(MXCUE)
      INTEGER CQIL(MXCUE), CQCS(MXCUE), CQCL(MXCUE), CQCD(MXCUE), NCQC
      INTEGER CQCH(MXCQC)
      DOUBLE PRECISION MJD, MSIT(3), MPAD(2), TBR(7,MXTBR), P10(23)
      COMMON /CDECK/ ICRD, NCRD, ITKB, NTOK, TKS, TKL, TVS, TVL, KCRD,
     &               KSLT, IDKER, IDKCD, NDKWN, NDKCD, IMHV, MPGC, MPCH,
     &               IDSN, ISNHV, SNCD, IDST, ISTHV, STCD, ITBON, ITBSN,
     &               ITBGC, ITBVH, NTBR, TBEF, TLNS, TLNL, NTNC, TNCH,
     &               NCQ, CQSN, CQVH, CQEN, CQIS, CQIL, CQCS, CQCL,
     &               CQCD, NCQC, CQCH
      COMMON /CDECKD/ MJD, MSIT, MPAD, TBR, P10
