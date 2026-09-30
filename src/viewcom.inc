C     VIEW-1108 KERNEL COMMON.  Included by every kernel routine
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
C     Apollo 11 range zero 1969-07-16 13:32:00 UTC, the page's clock
C     base: hdr(16) is each scenario's epoch offset from it.
      PARAMETER (JD0=2440419.063889D0)
C     RESTOMOD END
C     RESTOMOD BEGIN: 60000x5 DP buffer is 600K words, core 262,144
C     (docs/univac-1108.md); VIEW would stream vectors to plot tape.
C     Also the parenthesised PARAMETER list (FORTRAN 77, 1978).
      INTEGER MAXV, MAXS, MAXL, MAXT, MAXTC
      PARAMETER (MAXV=60000, MAXS=4000, MAXL=200)
      PARAMETER (MAXT=300, MAXTC=6000)
C     RESTOMOD END
      INTEGER MSOL, MVX, MFC, MED, MXL, MMOD, KLMD, KLMS, KSIV, KCSM
      INTEGER KCMC
C     RESTOMOD: parenthesised PARAMETER list is FORTRAN 77 (1978);
C     FORTRAN V wrote PARAMETER I = 2 (UP-4046 Rev 3, sec. 10.4.1)
      PARAMETER (MSOL=32, MVX=48, MFC=26, MED=72, MXL=400, MMOD=8)
C     Model numbers (MLIB): LM gear down, LM gear stowed with docking
C     aids, S-IVB with IU and SLA ring, CSM, CM cabin (window).
C     RESTOMOD: parenthesised PARAMETER list is FORTRAN 77 (1978)
      PARAMETER (KLMD=1, KLMS=2, KSIV=3, KCSM=4, KCMC=5)
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
C     /CORB/ trajectories and scene set-up.
C     LUT0, TETP: the current scenario's touchdown and entry interface
C       g.e.t. (s) (SNSET).  LMALT, LMEYE: the descending LM's
C       footpad altitude and the commander's eye above the pads (km),
C       set by LMDESC.
C     AZOFF, ELOFF: scene reference offsets (deg); TERISE: Earthrise.
C     FXB, FXU: inertially held boresight and up (scene 2), fixed at
C     FXDT seconds before entry interface.
C     S6LAT, S6LON, S6DST: scene 6 sub-observer point (deg) and
C     camera distance from the Moon's centre (km).
      DOUBLE PRECISION LUT0, TETP, LMALT, LMEYE
      DOUBLE PRECISION AZOFF, ELOFF, TERISE, FXB(3), FXU(3), FXDT
      DOUBLE PRECISION S6LAT, S6LON, S6DST
      COMMON /CORB/ LUT0, TETP, LMALT, LMEYE, AZOFF, ELOFF, TERISE,
     &              FXB, FXU, FXDT, S6LAT, S6LON, S6DST
C
C     /CSCEN/, /CSCENI/ the scenarios, one mission's data each, run
C     decks in 1969 terms (BLOCK DATA from data/scenarios by
C     tools/gen_data.py; field layout in src/viewdata.f).
      DOUBLE PRECISION SNJD0(NSN), SNSLA(NSN), SNSLO(NSN)
      DOUBLE PRECISION SNSAZ(NSN)
      DOUBLE PRECISION LGP(NLGP,NLEG), EVT(NEVT)
C     Launch pad (PAD card): SNPLA, SNPLO lat, east lon (deg),
C     geocentric latitude if SNPGC = 1; PADCH its name, 8 codes per
C     scenario, zero padded (none if the first is 0).
      DOUBLE PRECISION SNPLA(NSN), SNPLO(NSN)
      INTEGER LGSN(NLEG), LGTYP(NLEG), LGN(NLEG), LGGC(NLEG)
      INTEGER EVSN(NEVT), EVKND(NEVT), SNPGC(NSN), PADCH(8*NSN)
      COMMON /CSCEN/ SNJD0, SNSLA, SNSLO, SNSAZ, LGP, EVT,
     &               SNPLA, SNPLO
      COMMON /CSCENI/ LGSN, LGTYP, LGN, LGGC, EVSN, EVKND,
     &                SNPGC, PADCH
C
C     /CMEEUS/ the Moon's periodic terms, Meeus tables 47.A and 47.B
C     (BLOCK DATA from data/meeus47.txt; layout in src/viewdata.f).
C     RESTOMOD: ELP-2000/82 (1982) as abridged by Meeus (1991, 1998)
      INTEGER MMA(360), MMB(300)
      COMMON /CMEEUS/ MMA, MMB
C
C     /CSIM/, /CSIMI/ the scenarios' simulation cards: START, the
C     SCORE (BURN) and the REFERENCE rows (layout in src/viewdata.f).
      DOUBLE PRECISION STP(NLGP,NSTRT), RFP(NLGP,NREF)
      DOUBLE PRECISION BNT(NBURN), BNDV(NBURN), BNP(NBURN)
      DOUBLE PRECISION BNR(NBURN), BNN(NBURN)
      INTEGER STSN(NSTRT), STBOD(NSTRT), STGC(NSTRT), NSTART
      INTEGER RFSN(NREF), RFBOD(NREF), RFGC(NREF), NRF
      INTEGER BNSN(NBURN), BNBOD(NBURN), NBN
      COMMON /CSIM/ STP, RFP, BNT, BNDV, BNP, BNR, BNN
      COMMON /CSIMI/ STSN, STBOD, STGC, NSTART, RFSN, RFBOD, RFGC,
     &               NRF, BNSN, BNBOD, NBN
C
C     /CTAPE/ the TAPE (tape.f): per vehicle channel C (1 = CSM; up to
C     four, TN D-6853 p. 12), NTP(C) samples of g.e.t. TPT and state
C     TPS (geocentric EQ r km, v km/s), in time order; a burn or a
C     state vector update leaves two samples at one time, before and
C     after.
C     Marks: NMK of them, g.e.t. TMKT, kind TMKK (1 burn, 2 reference
C     row), channel TMKC, index TMKI (burn or reference row).
C     RESTOMOD BEGIN: 1.1 M words of tape in core; the 1108 would
C     have written it to drum or tape (docs/univac-1108.md).
      INTEGER MXSAM, MXCHN, MXMRK
      PARAMETER (MXSAM=30000, MXCHN=4, MXMRK=64)
      DOUBLE PRECISION TPT(MXSAM,MXCHN), TPS(6,MXSAM,MXCHN)
      DOUBLE PRECISION TMKT(MXMRK)
      INTEGER NTP(MXCHN), NMK, TMKK(MXMRK), TMKC(MXMRK), TMKI(MXMRK)
      COMMON /CTAPE/ TPT, TPS, TMKT
      COMMON /CTAPEI/ NTP, NMK, TMKK, TMKC, TMKI
C     RESTOMOD END
C
C     /CSIMR/ the last engine run (sim.f): ITPSN the scenario on the
C     tape (0 none yet), ISIMF the run's flags (bit 0 state vector
C     updates on), and for each reference row the error of the
C     simulated state against it just before any update, RFERR(1,J)
C     position (km) and RFERR(2,J) velocity (ft/s), valid if RFOK(J)
C     = 1.  ISRC the state source asked for this frame (in_src,
C     passed as in_flags bit 3: 0 replay, 1 tape), ISRCU the one used
C     (0 replay, 1 sim with updates, 2 sim free).
C     /CSIMM/ the Moon for the engine: geocentric position and
C     velocity every MQDT seconds from MQT0, NMQ nodes (SIMRUN),
C     read by cubic Hermite interpolation (MOONQ); the series is too
C     slow to call at every integration step.
      INTEGER MXMQ
      PARAMETER (MXMQ=800)
      DOUBLE PRECISION MQ(6,MXMQ), MQT0, MQDT
      INTEGER NMQ
      COMMON /CSIMM/ MQ, MQT0, MQDT
      COMMON /CSIMMI/ NMQ
      DOUBLE PRECISION RFERR(2,NREF)
      INTEGER ITPSN, ISIMF, RFOK(NREF), ISRC, ISRCU
      COMMON /CSIMR/ RFERR
      COMMON /CSIMRI/ ITPSN, ISIMF, RFOK, ISRC, ISRCU
C
C     /CSN/ the current scenario (SNSET): id ISN, epoch TJD0
C     (Julian date of its range zero; g.e.t. counts from it), and the
C     elements of its legs, LGEL(1..11, K):
C       CONIC  1-3 perigee unit P, 4-6 Q, 7 eccentricity, 8 semi-major
C              axis (km), 9 perigee time (s);
C       CIRC, LUNAR  1-3 position unit at 9, 4-6 direction of motion
C              there, 9 time (s), 10 radius (km), 11 mean motion
C              (rad/s).
      DOUBLE PRECISION TJD0, LGEL(11,NLEG)
      COMMON /CSN/ TJD0, LGEL
      INTEGER ISN
      COMMON /CSNI/ ISN
C
C     /CVIEW/ the view inputs of this frame (VSETIN): IVIEW 0 window,
C     1 external, 2 CM station, 3 LM station; ITARG camera target 0
C     scene default, 1 Earth, 2 Moon, 3 Sun, 4 CSM, 5 LM; ILABL label
C     level 0-3 (0: in_flags bit 0 decides).
C     IVUSE the view this frame actually uses (VIEWPT).  ILEV the
C     label level this frame applies (VFRAME): 0 none, 1 primary, 2
C     secondary, 3 all; with ILABL 0 it is 3 if in_flags bit 0 is
C     set, else 0.  IVBIT the vehicles in this frame's world (VPRES,
C     hdr 21).
      INTEGER IVIEW, ITARG, ILABL, IVUSE, ILEV, IVBIT
      COMMON /CVIEW/ IVIEW, ITARG, ILABL, IVUSE, ILEV, IVBIT
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
C     S8AT: scene 8's stack attitude, CSM body axes in EQ (S8ATT).
      DOUBLE PRECISION S8AT(3,3)
      COMMON /CS8/ S8AT
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
C     MDHL(K) = 1: model K is drawn with hidden lines removed and its
C     solids hide other things; 0: an outline, every edge drawn and
C     nothing hidden by it (the CSM; TN D-6853 p. 12 names hidden-line
C     models of the LM and S-IVB only: our reading).
      INTEGER MDHL(MMOD)
      COMMON /CMODH/ MDHL
      COMMON /CMOD/ MDAT, MDP, MDBO
C
C     /CVLAB/ work area of the vehicle labels (lvlab.f): the plot
C     points of the model being labelled (VLPTS).
      DOUBLE PRECISION VLPX(2400), VLPY(2400)
      COMMON /CVLAB/ VLPX, VLPY
