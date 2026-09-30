C     VIEW-1108 KERNEL COMMON.  Included by every routine in view.f
C     after viewdims.inc.  Hand written (viewdims.inc is generated).
C
C     Units: km, km/s, seconds of GET, radians inside, degrees at the
C     edges (plot coordinates, inputs).  Frame: J2000 equatorial (EQ)
C     unless a name says MF (Moon fixed, IAU) or EF (Earth fixed).
C
      DOUBLE PRECISION PI, DR, RE, RM, GME, GMM, JD0
C     RESTOMOD BEGIN: real-valued PARAMETERs; FORTRAN V PARAMETER was
C     integer-only, written PARAMETER I = 2 (UP-4046 Rev 3, sec. 10.4.1)
      PARAMETER (PI=3.141592653589793D0, DR=PI/180.0D0)
      PARAMETER (RE=6378.137D0, RM=1737.4D0)
      PARAMETER (GME=398600.4418D0, GMM=4902.800D0)
C     Lift-off 1969-07-16 13:32:00 UTC
      PARAMETER (JD0=2440419.063889D0)
C     RESTOMOD END
C     RESTOMOD BEGIN: 60000x5 DP buffer is 600K words, core 262,144
C     (docs/univac-1108.md); VIEW would stream vectors to plot tape.
C     Also the parenthesised PARAMETER list (FORTRAN 77, 1978).
      INTEGER MAXV, MAXS, MAXL, MAXT, MAXTC
      PARAMETER (MAXV=60000, MAXS=4000, MAXL=200)
      PARAMETER (MAXT=300, MAXTC=6000)
C     RESTOMOD END
      INTEGER MSOL, MVX, MFC, MED, MXL, MMOD, KLMD, KLMS, KSIV
C     RESTOMOD: parenthesised PARAMETER list is FORTRAN 77 (1978);
C     FORTRAN V wrote PARAMETER I = 2 (UP-4046 Rev 3, sec. 10.4.1)
      PARAMETER (MSOL=32, MVX=48, MFC=26, MED=72, MXL=400, MMOD=8)
C     Model numbers (MLIB): LM gear down, LM gear stowed with docking
C     aids, S-IVB with IU and SLA ring.
C     RESTOMOD: parenthesised PARAMETER list is FORTRAN 77 (1978)
      PARAMETER (KLMD=1, KLMS=2, KSIV=3)
C
C     Tables loaded by BLOCK DATA VIEWBD (viewdata.f)
C     RESTOMOD BEGIN: post-1969 data: Natural Earth coast (2009),
C     IAU crater gazetteer (names from 1970 on), 37K words of tables.
      DOUBLE PRECISION STX(NSTAR), STY(NSTAR), STZ(NSTAR), STM(NSTAR)
      DOUBLE PRECISION CLON(NCPT), CLAT(NCPT)
      INTEGER KCST(NCST+1)
      DOUBLE PRECISION CRLAT(NCRAT), CRLON(NCRAT), CRDIA(NCRAT)
      COMMON /CSTAR/ STX, STY, STZ, STM
      COMMON /CCOST/ CLON, CLAT, KCST
      COMMON /CCRAT/ CRLAT, CRLON, CRDIA
C     RESTOMOD END
C     Label text for the recorder's character generator: ASCII codes,
C     10 per nav star (NAVCH), 5 each for SUN, EARTH, MOON (BODCH),
C     zero padded.  Loaded by VIEWBD.
      INTEGER NAVCH(370), BODCH(15), SITECH(22)
      COMMON /CNAME/ NAVCH, BODCH, SITECH
C     RESTOMOD BEGIN: post-1969 data: IAU gazetteer maria (centres and
C     diameters only, so drawn as circles), names as character codes.
      DOUBLE PRECISION MRLAT(NMARE), MRLON(NMARE), MRDIA(NMARE)
      INTEGER MRCH(24*NMARE)
      COMMON /CMARE/ MRLAT, MRLON, MRDIA, MRCH
C     RESTOMOD END
C
C     /CTAB/ unit vectors built from the tables at first call:
C     crater centres (MF) and coastline points (EF).
      DOUBLE PRECISION CRV(3,NCRAT), CEV(3,NCPT)
      COMMON /CTAB/ CRV, CEV
C
C     /CTIM/ current frame time.  TDAY days and TCEN Julian centuries
C     from J2000.0, GMST radians.
      DOUBLE PRECISION TJD, TDAY, TCEN, GMST
      COMMON /CTIM/ TJD, TDAY, TCEN, GMST
C
C     /CBOD/ bodies seen from the camera.  EPOS, MPOS: Earth and Moon
C     centres relative to the camera (EQ).  SUNU: unit vector to the
C     Sun.  MMF: MF -> EQ.  MEF: EF -> EQ.  CAMF: camera relative to
C     the Moon centre, MF.  CBMF: boresight in MF.
      DOUBLE PRECISION EPOS(3), MPOS(3), SUNU(3), MMF(3,3), MEF(3,3)
      DOUBLE PRECISION CAMF(3), CBMF(3)
      COMMON /CBOD/ EPOS, MPOS, SUNU, MMF, MEF, CAMF, CBMF
C
C     /CCAM/ camera.  CR, CU, CB: right, up, boresight (EQ).  RREF,
C     UREF, BREF: the scene reference attitude before free-look.
C     FOVH half field (deg), BOXH clip half size (deg), THVIEW angle
C     from boresight to the frame corner (deg), THLIM the largest
C     angle from the boresight that is projected at all (deg).  PK
C     projection constant (1 gnomonic .. 2 stereographic), PTH the last
C     angle off the boresight PROJ saw (rad).
      DOUBLE PRECISION CR(3), CU(3), CB(3), RREF(3), UREF(3), BREF(3)
      DOUBLE PRECISION FOVH, BOXH, THVIEW, THLIM, CSVIEW, PK, PTH
      COMMON /CCAM/ CR, CU, CB, RREF, UREF, BREF,
     &              FOVH, BOXH, THVIEW, THLIM, CSVIEW, PK, PTH
C
C     /CPEN/ the pen.  PPX last point, IPV its visibility, IVMODE the
C     visibility test for points now being drawn (see ISVIS), ISTYLE
C     line style written to VBUF.
      DOUBLE PRECISION PPX(3)
      COMMON /CPEN/ PPX
      INTEGER IPV, IVMODE, ISTYLE
      COMMON /CPENI/ IPV, IVMODE, ISTYLE
C
C     /CORB/ trajectories.
C     Lunar orbit: LUP0, LUV0 unit position and velocity directions at
C       LUT0 (EQ), radius LURAD, mean motion LUN.
C     Parking orbit: PKP0, PKV0 at the launch site, radius PKRAD,
C       mean motion PKN, argument PKU0 at insertion time PKT0.
C     Translunar ellipse: perigee unit TLP, TLQ, eccentricity TLE,
C       semi-major axis TLA, perigee time TLTP.  Transearth: TE*.
C     AZOFF, ELOFF: scene reference offsets (deg); TERISE: Earthrise.
C     FXB, FXU: inertially held boresight and up (scene 2), fixed at
C     FXDT seconds before entry interface.
C     S6LAT, S6LON, S6DST: scene 6 sub-observer point (deg) and
C     camera distance from the Moon's centre (km).
      DOUBLE PRECISION LUP0(3), LUV0(3), LURAD, LUN, LUT0
      DOUBLE PRECISION PKP0(3), PKV0(3), PKRAD, PKN, PKU0, PKT0
      DOUBLE PRECISION TLP(3), TLQ(3), TLE, TLA, TLTP
      DOUBLE PRECISION TEP(3), TEQ(3), TEE, TEA, TETP
      DOUBLE PRECISION AZOFF, ELOFF, TERISE, FXB(3), FXU(3), FXDT
      DOUBLE PRECISION S6LAT, S6LON, S6DST
      COMMON /CORB/ LUP0, LUV0, LURAD, LUN, LUT0,
     &              PKP0, PKV0, PKRAD, PKN, PKU0, PKT0,
     &              TLP, TLQ, TLE, TLA, TLTP,
     &              TEP, TEQ, TEE, TEA, TETP, AZOFF, ELOFF, TERISE,
     &              FXB, FXU, FXDT, S6LAT, S6LON, S6DST
C
C     /CSCN/ scene number, flags of this frame, init done.
      INTEGER ISCN, IFLG, INITD
      COMMON /CSCN/ ISCN, IFLG, INITD
C
C     /CLM/ spacecraft wireframe models (MLIB), each in its own body
C     axes (m); for the LM X up, Y right, Z forward.
C     Solid K is convex: vertices LMV, outward face planes N.x = D
C     (LMN, LMD), edges LME(1..4,J) = vertex, vertex, face, face.
C     Free lines LXL (legs, pads) and face marks LXS/LXF (windows).
C     LWV, LWN, LWD: the same in camera-relative EQ for this frame.
      DOUBLE PRECISION LMV(3,MVX,MSOL), LMN(3,MFC,MSOL), LMD(MFC,MSOL)
      DOUBLE PRECISION LWV(3,MVX,MSOL), LWN(3,MFC,MSOL), LWD(MFC,MSOL)
      DOUBLE PRECISION LXL(6,MXL)
      COMMON /CLM/ LMV, LMN, LMD, LWV, LWN, LWD, LXL
      INTEGER NSOL, NLV(MSOL), NLF(MSOL), NLE(MSOL), LME(4,MED,MSOL)
      INTEGER NXL, LXS(MXL), LXF(MXL)
      COMMON /CLMI/ NSOL, NLV, NLF, NLE, LME, NXL, LXS, LXF
C
C     /CS7/ scene 7, transposition and docking.  S7AT: LM body axes
C     (columns X, Y, Z) in EQ, held inertially.  S7LP: the LM tunnel
C     top centre, camera relative, km.  S7BO: that point in LM body
C     metres.  S7RNG: CSM to LM docking ring range, ft.
      DOUBLE PRECISION S7AT(3,3), S7LP(3), S7BO(3), S7RNG
      COMMON /CS7/ S7AT, S7LP, S7BO, S7RNG
C
C     /CMOD/ model table.  Model K is solids MDS1(K)..MDS2(K) and free
C     lines MDX1(K)..MDX2(K) of /CLM/.  This frame: MDON(K) = 1 if
C     placed (MPLACE), with body axes MDAT (EQ), body point MDBO (m)
C     at MDP (km, camera relative).  LACT(IS) = 1 if solid IS is
C     placed, LINS(IS) = 1 if the camera is inside it; NACT solids
C     placed.
      INTEGER NMOD, MDS1(MMOD), MDS2(MMOD), MDX1(MMOD), MDX2(MMOD)
      INTEGER MDON(MMOD), LACT(MSOL), LINS(MSOL), NACT
      COMMON /CMODI/ NMOD, MDS1, MDS2, MDX1, MDX2, MDON, LACT, LINS,
     &               NACT
      DOUBLE PRECISION MDAT(3,3,MMOD), MDP(3,MMOD), MDBO(3,MMOD)
      COMMON /CMOD/ MDAT, MDP, MDBO
