C     VIEW-1108 KERNEL COMMON.  Included by every kernel routine
C     after viewdims.inc.  Hand written (viewdims.inc is generated).
C
C     Units: km, km/s, seconds of GET, radians inside, degrees at the
C     edges (plot coordinates, inputs).  Frame: J2000 equatorial (EQ)
C     unless a name says MF (Moon fixed, IAU) or EF (Earth fixed).
C
      DOUBLE PRECISION PI, DR, RE, RM, GME, GMM, JD0, LPDDN, LPDK
C     RESTOMOD BEGIN: real-valued PARAMETERs; FORTRAN V PARAMETER was
C     integer-only, written PARAMETER I = 2 (UP-4046 Rev 3, sec. 10.4.1)
      PARAMETER (PI=3.141592653589793D0, DR=PI/180.0D0)
      PARAMETER (RE=6378.137D0, RM=1737.4D0)
      PARAMETER (GME=398600.4418D0, GMM=4902.800D0)
C     Apollo 11 range zero 1969-07-16 13:32:00 UTC, the page's clock
C     base: hdr(16) is each scenario's epoch offset from it.
      PARAMETER (JD0=2440419.063889D0)
C     LM window view: the boresight LPDDN deg below the LM's +Z in the
C     X-Z plane, and the LPD scale's plot constant LPDK; both fitted
C     to the film's LPD marks (llpd.f).
      PARAMETER (LPDDN=30.2D0, LPDK=49.8D0)
C     RESTOMOD END
C     RESTOMOD BEGIN: 60000x5 DP buffer is 600K words, core 262,144
C     (docs/univac-1108.md); VIEW would stream vectors to plot tape.
C     Also the parenthesised PARAMETER list (FORTRAN 77, 1978).
      INTEGER MAXV, MAXS, MAXL, MAXT, MAXTC
      PARAMETER (MAXV=60000, MAXS=4000, MAXL=200)
      PARAMETER (MAXT=300, MAXTC=6000)
C     RESTOMOD END
      INTEGER MSOL, MVX, MFC, MED, MXL, MMOD, KLMD, KLMS, KSIV, KCSM
      INTEGER KCMC, KCMI, KLMI, KLMA, KCMO
C     RESTOMOD BEGIN: parenthesised PARAMETER list is FORTRAN 77
C     (1978); FORTRAN V wrote PARAMETER I = 2 (UP-4046 Rev 3, sec.
C     10.4.1).  And 120 solids (the LM's RCS clusters are 20 a model,
C     in three LM models; the CSM's quads 20 more) make /CLM/ and
C     /CLMI/ about 176K words (our count: 1,294 words a solid, 21,000
C     for the free lines, 2 words a DP number), two thirds of the
C     1108's 262,144 (docs/univac-1108.md).
      PARAMETER (MSOL=120, MVX=48, MFC=26, MED=72, MXL=1500, MMOD=10)
C     RESTOMOD END
C     Model numbers (MLIB): LM gear down, LM gear stowed with docking
C     aids, S-IVB with IU and SLA ring, CSM, CM cabin (window), CM
C     interior, LM interior (in_flags bit 4), LM ascent stage alone
C     (after lunar lift-off), CM alone (after CM/SM separation).
C     RESTOMOD: parenthesised PARAMETER list is FORTRAN 77 (1978)
      PARAMETER (KLMD=1, KLMS=2, KSIV=3, KCSM=4, KCMC=5, KCMI=6,
     &           KLMI=7, KLMA=8, KCMO=9)
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
C     The run tables' fixed maxima (ours, #26): headroom over today's
C     two scenarios for a few more missions' decks; the card reader
C     (vdeck.f) refuses a deck that needs more, never truncates.
C     Scenarios, trajectory legs, events, START, BURN and REF cards,
C     TIMELINE rows, burn cues (MXSIT, situations: viewsit.inc).
      INTEGER MXSN, MXLEG, MXEVT, MXSTRT, MXBURN, MXREF, MXTL, MXCUE
C     RESTOMOD: parenthesised PARAMETER list is FORTRAN 77 (1978)
      PARAMETER (MXSN=8, MXLEG=200, MXEVT=100, MXSTRT=8, MXBURN=50,
     &           MXREF=80, MXTL=1500, MXCUE=64)
C
C     /CSCEN/, /CSCENI/ the scenarios, one mission's data each, run
C     decks in 1969 terms, filled by the card reader (vdeck.f) from
C     data/missions; NSN scenarios, NLEG legs and NEVT events used.
C     Scenario M: epoch SNJD0 (JD of range zero), landing site SNSLA
C     lat, SNSLO east lon, SNSAZ descent azimuth (deg).
C     Leg K of scenario LGSN(K), type LGTYP, whole revolutions LGN
C     (LUNAR), latitude geocentric if LGGC = 1, and LGP: 1 FROM, 2 TO,
C     3 T (g.e.t. s), 4 LAT, 5 LON (deg), 6 ALT (n mi), 7 V (ft/s),
C     8 FPA, 9 HDG (deg), 10 TB (s), 11 LATB, 12 LONB (deg), LCONIC
C     13 DV (ft/s), 14 P, 15 R, 16 N, 17 ALTB (n mi; LUNAR, the
C     altitude at TB).  TABLE (one leg per pair of rows): 3-9 row A,
C     10-12 row B's T LAT LON, 13-15 its V FPA HDG, 17 its ALT; LGN
C     1 A's, 2 B's velocity Earth fixed.
C     Event J of scenario EVSN(J), kind EVKND, g.e.t. EVT (s).
      DOUBLE PRECISION SNJD0(MXSN), SNSLA(MXSN), SNSLO(MXSN)
      DOUBLE PRECISION SNSAZ(MXSN)
      DOUBLE PRECISION LGP(NLGP,MXLEG), EVT(MXEVT)
C     Launch pad (PAD card): SNPLA, SNPLO lat, east lon (deg),
C     geocentric latitude if SNPGC = 1; PADCH its name, 8 codes per
C     scenario, zero padded (none if the first is 0).
      DOUBLE PRECISION SNPLA(MXSN), SNPLO(MXSN)
      INTEGER LGSN(MXLEG), LGTYP(MXLEG), LGN(MXLEG), LGGC(MXLEG)
      INTEGER EVSN(MXEVT), EVKND(MXEVT), SNPGC(MXSN), PADCH(8*MXSN)
C     LGVEH(K): the vehicle leg K carries, 1 the CSM, 2 the LM, 3 the
C     S-IVB.
      INTEGER LGVEH(MXLEG), NSN, NLEG, NEVT
      COMMON /CSCEN/ SNJD0, SNSLA, SNSLO, SNSAZ, LGP, EVT,
     &               SNPLA, SNPLO
      COMMON /CSCENI/ LGSN, LGTYP, LGN, LGGC, EVSN, EVKND,
     &                SNPGC, PADCH, LGVEH, NSN, NLEG, NEVT
C
C     /CMEEUS/ the Moon's periodic terms, Meeus tables 47.A and 47.B
C     (BLOCK DATA from data/meeus47.txt): MMA(6*(K-1)+1..6) = D M M' F
C     sigma_l sigma_r of table 47.A row K, MMB(5*(K-1)+1..5) = D M M' F
C     sigma_b of table 47.B.
C     RESTOMOD: ELP-2000/82 (1982) as abridged by Meeus (1991, 1998)
      INTEGER MMA(360), MMB(300)
      COMMON /CMEEUS/ MMA, MMB
C
C     /CSIM/, /CSIMI/ the scenarios' simulation cards: START, the
C     SCORE (BURN) and the REFERENCE rows; NSTART, NBN and NRF used.
C     START of scenario STSN (one at most), REF rows: state STP / RFP
C     as LGP (2 = END for START), body STBOD / RFBOD (1 Earth, 2
C     Moon), geocentric latitude if STGC / RFGC = 1.  BURN: mid-burn
C     g.e.t. BNT (s), BNDV (ft/s), direction BNP, BNR, BNN in the
C     BNBOD body's frame (along the velocity, radial in the orbit
C     plane, orbit normal).
      DOUBLE PRECISION STP(NLGP,MXSTRT), RFP(NLGP,MXREF)
      DOUBLE PRECISION BNT(MXBURN), BNDV(MXBURN), BNP(MXBURN)
      DOUBLE PRECISION BNR(MXBURN), BNN(MXBURN)
      INTEGER STSN(MXSTRT), STBOD(MXSTRT), STGC(MXSTRT), NSTART
      INTEGER RFSN(MXREF), RFBOD(MXREF), RFGC(MXREF), NRF
      INTEGER BNSN(MXBURN), BNBOD(MXBURN), NBN
      COMMON /CSIM/ STP, RFP, BNT, BNDV, BNP, BNR, BNN
      COMMON /CSIMI/ STSN, STBOD, STGC, NSTART, RFSN, RFBOD, RFGC,
     &               NRF, BNSN, BNBOD, NBN
C
C     /CTLN/, /CTLNI/ the scenarios' timelines (TIMELINE cards, from
C     SP-4029's mission timelines): row K of scenario TLSN(K) at
C     g.e.t. TLT(K) (s), kind TLK(K): 1 LAUNCH, 2 BURN, 3 STAGING,
C     4 ORBIT, 5 SEP, 6 SURFACE, 7 TV, 8 CREW, 9 PHOTO, 10 ENTRY,
C     11 MARK (CLAUDE.md); sorted by scenario and g.e.t.  The names
C     are the page's (build/names.js).  NTL rows.
      DOUBLE PRECISION TLT(MXTL)
      INTEGER TLK(MXTL), TLSN(MXTL), NTL
      COMMON /CTLN/ TLT
      COMMON /CTLNI/ TLK, TLSN, NTL
C
C     /CBRN/, /CBRNI/ the burn cue's main-engine firings (lburn.f; a
C     modern addition), from the TIMELINE rows by the scenarios'
C     BURNCUE cards: row K of scenario BRSN(K) burns from g.e.t. BRT1(K)
C     to BRT2(K) (s), vehicle BRVH(K) (1 CSM, 2 LM, 3 S-IVB), engine
C     BREN(K) (1 SPS, 2 DPS, 3 APS, 4 J-2); NBR rows.  IBRTX: the
C     engine whose BURN text TXALL letters this frame (DBURN), 0 none.
      DOUBLE PRECISION BRT1(MXCUE), BRT2(MXCUE)
      INTEGER BRSN(MXCUE), BRVH(MXCUE), BREN(MXCUE), NBR, IBRTX
      COMMON /CBRN/ BRT1, BRT2
      COMMON /CBRNI/ BRSN, BRVH, BREN, NBR
      COMMON /CBRNT/ IBRTX
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
C     (0 replay, 1 sim with updates, 2 sim free, 3 a tape read from
C     the deck).  A tape read from the deck (vdktap.f) sets ITPSN to
C     its scenario and ISIMF to -1; it has no reference errors (the
C     card reader empties RFOK, and sets ISIMF to 0 with no tape).
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
      DOUBLE PRECISION RFERR(2,MXREF)
      INTEGER ITPSN, ISIMF, RFOK(MXREF), ISRC, ISRCU
      COMMON /CSIMR/ RFERR
      COMMON /CSIMRI/ ITPSN, ISIMF, RFOK, ISRC, ISRCU
C
C     /CSN/ the current scenario (SNSET): id ISN, epoch TJD0
C     (Julian date of its range zero; g.e.t. counts from it), and the
C     elements of its legs, LGEL(1..11, K):
C       CONIC, LCONIC  1-3 perigee unit P, 4-6 Q, 7 eccentricity,
C              8 semi-major axis (km), 9 perigee time (s);
C       CIRC, LUNAR  1-3 position unit at 9, 4-6 direction of motion
C              there, 9 time (s), 10 radius (km) at 9, 11 mean motion
C              (rad/s); LUNAR 7 the radius's rate (km/s).
      DOUBLE PRECISION TJD0, LGEL(11,MXLEG)
      COMMON /CSN/ TJD0, LGEL
      INTEGER ISN
      COMMON /CSNI/ ISN
C
C     /CVIEW/ the view inputs of this frame (VSETIN): IVIEW 0 window,
C     1 external, 2 CM station, 3 LM station; ITARG camera target 0
C     scene default, 1 Earth, 2 Moon, 3 Sun, 4 CSM, 5 LM, 6 S-IVB;
C     ILABL label level 0-3 (0: in_flags bit 0 decides).
C     IVUSE the view this frame actually uses (VIEWPT).  ILEV the
C     label level this frame applies (VFRAME): 0 none, 1 primary, 2
C     secondary, 3 all; with ILABL 0 it is 3 if in_flags bit 0 is
C     set, else 0.  IVBIT the vehicles in this frame's world (VPRES,
C     hdr 21).  ITGST the target's status this frame (VIEWPT, hdr 23):
C     0 none asked (in_target 0) or none applies (the LM station, a
C     FIXED situation), 1 aimed at a point of its own, 2 the vehicle
C     the camera rides, 3 docked to or carried with another vehicle
C     (its point is that vehicle's: aimed only from outside), 4 no
C     point here (no state; the Sun from outside), 5 as 3, the LM in
C     the SLA before the separation (SEP).
      INTEGER IVIEW, ITARG, ILABL, IVUSE, ILEV, IVBIT, ITGST
      COMMON /CVIEW/ IVIEW, ITARG, ILABL, IVUSE, ILEV, IVBIT, ITGST
C
C     /CSCN/ scene number (the situation, row ISCN of the situation
C     tables), flags of this frame, init done.
      INTEGER ISCN, IFLG, INITD
      COMMON /CSCN/ ISCN, IFLG, INITD
C
C     /CSITU/, /CSITUI/ the current situation, row ISCN of the tables
C     in viewsit.inc (filled from the SITUATION cards), copied by
C     SITSET when VINIT selects it.  All codes ours.
C     JRCP the camera recipe: 1 LOCALVERT (local-vertical platform),
C       2 INERTIAL (inertially fixed), 3 CREWSTN (a crew station's
C       eye), 4 BODYCTR (body-centred), 5 EXTSEED (external, seeded
C       on a vehicle).  JBOD its body, 1 Earth, 2 Moon.  JMOD
C       (LOCALVERT) 1 FORWARD, 2 NORMAL.  JTRN 1 if the reference is
C       turned by QTRN (yaw, pitch, roll, deg; REFTRN).  JFAL 1 if,
C       where no LUNAR leg holds the GET, the camera is FORWARD about
C       the Earth QFEL deg above its horizon instead.  QELV: FORWARD
C       about the Earth, deg above the horizon.  JATT attitude source,
C       1 the Earth's sightline (FXB, FXU), 2 S7ATT, 3 S8ATT.  JVEH
C       (CREWSTN) 1 CM, 2 LM.  QDST (EXTSEED) the camera's distance
C       from the vehicle (km).
C     JWIN window code (hdr 8): 1 CSM window, 2 LM front window.
C     JPOS the pose routine placing the situation's models: 0 none,
C       1 LMPIRO, 2 S7POSE, 3 S8POSE.  JDRW drawing switches, bits:
C       1 no Earth night shading, 2 the whole-disc Moon, 4 no LM
C       marker while landed.  JLL the layers in order, ended by 0
C       (12: MXLAY of viewsit.inc, which is included after this file).
C     JVW the view used when in_view is 0 (0 window, 1 external,
C       2 CM station, 3 LM station).  JTGT the external view's
C       default target (as ITARG), JTGF the same where JFAL applies.
C       JRID the vehicle the camera rides in its own view, 0 none,
C       1 the CSM, 2 the LM.  JSCM, JSLM the CM and LM stations: 0
C       not offered, 1 where that vehicle is placed, 2 always.  JFIX 1
C       if in_view and in_target are ignored.  JXOF 1 if the external
C       view starts QXY (yaw, pitch, deg) round.
C     JHRK the header's reference object (hdr 11-14): 0 the body, 1
C       the placed LM, 2 S7POSE's docking target QHOF km to the LM's
C       -Y, 3 the placed CSM's tunnel QHOF km along its +X; QHRR its
C       radius (km).
      INTEGER JRCP, JBOD, JMOD, JTRN, JFAL, JATT, JVEH, JWIN, JPOS
      INTEGER JDRW, JLL(12), JVW, JTGT, JTGF, JRID, JSCM, JSLM, JFIX
      INTEGER JXOF, JHRK
      DOUBLE PRECISION QELV, QTRN(3), QFEL, QDST, QXY(2), QHOF, QHRR
      COMMON /CSITU/ QELV, QTRN, QFEL, QDST, QXY, QHOF, QHRR
      COMMON /CSITUI/ JRCP, JBOD, JMOD, JTRN, JFAL, JATT, JVEH, JWIN,
     &                JPOS, JDRW, JLL, JVW, JTGT, JTGF, JRID, JSCM,
     &                JSLM, JFIX, JXOF, JHRK
C
C     /CLM/ spacecraft wireframe models (MLIB), each in its own body
C     axes (m); for the LM X up, Y right, Z forward.
C     Solid K is convex: vertices LMV, outward face planes N.x = D
C     (LMN, LMD), edges LME(1..4,J) = vertex, vertex, face, face.
C     Free lines LXL (legs, pads) and face marks LXS/LXF (windows).
C     LSMO(K) = 1: solid K stands for a curved surface (MKPRS, MKFRU
C     sides about its axis); an edge between two of its sides is drawn
C     only where one is turned toward the camera and the other away.
C     LWV, LWN, LWD: the same in camera-relative EQ for this frame,
C     with LWC, LWR the centre and radius of a sphere holding it.
      DOUBLE PRECISION LMV(3,MVX,MSOL), LMN(3,MFC,MSOL), LMD(MFC,MSOL)
      DOUBLE PRECISION LWV(3,MVX,MSOL), LWN(3,MFC,MSOL), LWD(MFC,MSOL)
      DOUBLE PRECISION LXL(6,MXL), LWC(3,MSOL), LWR(MSOL)
      COMMON /CLM/ LMV, LMN, LMD, LWV, LWN, LWD, LXL, LWC, LWR
      INTEGER NSOL, NLV(MSOL), NLF(MSOL), NLE(MSOL), LME(4,MED,MSOL)
      INTEGER NXL, LXS(MXL), LXF(MXL), LSMO(MSOL)
      COMMON /CLMI/ NSOL, NLV, NLF, NLE, LME, NXL, LXS, LXF, LSMO
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
C     nothing hidden by it (the cabins about the eye).  TN D-6853 p. 12
C     names hidden-line models of the LM and S-IVB only; the CSM's is
C     ours.
      INTEGER MDHL(MMOD)
      COMMON /CMODH/ MDHL
C     LBOK 1 if the last solid builder (MKPRS, MKFRU, MKWDG) added a
C     solid, 0 if the table was full; LXOK the same for XLINE.  Code
C     that marks the solid or line just built tests them first.
      INTEGER LBOK, LXOK
      COMMON /CMOK/ LBOK, LXOK
      COMMON /CMOD/ MDAT, MDP, MDBO
C
C     /CWIN/ the cabin windows, for the window mask (vmask.f): window
C     J of model WMOD(J) has NWV(J) corners WBV(1..3, K, J) in that
C     model's body metres (XWIN, as MLIB builds the cabins; MDBLD is
C     the model being built).  This frame: WACT(J) = 1 if its model is
C     placed, with WPN(1..3, K, J) the unit normal, camera relative
C     EQ, of the plane through the eye and edge K, facing into the
C     window.  IMSKON = 1 if in_flags bit 5 asks for the mask and a
C     cabin with windows is placed; IMSK = 1 while the outside draws
C     and is masked (LAYERS, MDRALL).
      INTEGER MWIN, MWV
C     RESTOMOD: parenthesised PARAMETER list is FORTRAN 77 (1978)
      PARAMETER (MWIN=8, MWV=8)
      DOUBLE PRECISION WBV(3,MWV,MWIN), WPN(3,MWV,MWIN)
      INTEGER NWIN, NWV(MWIN), WMOD(MWIN), WACT(MWIN), MDBLD
      INTEGER IMSKON, IMSK
      COMMON /CWIN/ WBV, WPN
      COMMON /CWINI/ NWIN, NWV, WMOD, WACT, MDBLD, IMSKON, IMSK
C
C     /CVLAB/ work area of the vehicle labels (lvlab.f): the plot
C     points of the model being labelled (VLPTS).
      DOUBLE PRECISION VLPX(2400), VLPY(2400)
      COMMON /CVLAB/ VLPX, VLPY
