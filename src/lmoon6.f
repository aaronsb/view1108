C=======================================================================
C
C     V I E W - 1 1 0 8          MOON VIEW
C
C     Part of layer 4: the whole-disc Moon view's extras,
C     called by DMOON in scene 6.  One relocatable element of
C     the kernel; see vdrive.f for the list.
C
C=======================================================================
C
C-----------------------------------------------------------------------
C     DMOON6: the whole-disc Moon view's extras.  Terminator; night
C     side shading as for the Earth (TN D-6853, printed p. 8); maria,
C     lacus, sinus and oceanus from the IAU gazetteer, which gives
C     only a centre and a diameter, so each is drawn as a circle of
C     that diameter, not its true outline; the Apollo 11 landing site
C     as a small boxed X.  Labels (LB kind 6 = mare, id its index;
C     kind 7 = landing site) when IFLG bit 0 is set.
C-----------------------------------------------------------------------
      SUBROUTINE DMOON6(VB, NV, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), LB(4,MAXL)
      INTEGER NV, NL
      DOUBLE PRECISION CM(3), P(3), X, Y, W, DCAM, HN, WD
      DOUBLE PRECISION XA(64), XB(64), YA(64), YB(64)
      INTEGER I, K, IOK, ISVIS, NP, NC
      IVMODE = 3
      CALL CIRCLE(VB, NV, MPOS, RM, SUNU, 0.5D0 * PI, 360)
      CALL SHADE(VB, NV, MPOS, RM, 6)
      DCAM = DSQRT(CAMF(1)**2 + CAMF(2)**2 + CAMF(3)**2)
C     Labels placed so far, as text rectangles in plot deg (0.7 name
C     height per character wide, one name height tall, the extents
C     TXALL will give them), for the clutter test: a label whose
C     rectangle meets one already placed is dropped.  Our rule.
      NP = 0
      HN = 0.028D0 * FOVH
C     Apollo 11 landing site, first so its label always wins.  The
C     1969 reports call it "landing site 2" (MSC IN 69-FM-197).  LM
C     position 0.67416 N, 23.47314 E, planetocentric Mean Earth/Polar
C     Axis (DE421), from LRO images: NSSDC, "Apollo Landing Site
C     Coordinates", https://nssdc.gsfc.nasa.gov/planetary/lunar/
C     lunar_sites.html, citing Wagner et al., Icarus 283, 92-103
C     (2017).  The same values are in the run deck's SITE card (for
C     the descent) and in the crater patch (lmoon.f).
      IVMODE = 3
      CALL LLUNIT(0.67416D0, 23.47314D0, CM)
      CALL SURFPT(CM, P)
      IF (ISVIS(P) .EQ. 0) GO TO 10
      CALL PROJ(P, X, Y, IOK)
      W = 0.012D0 * FOVH
      CALL BOXX(VB, NV, X, Y, W)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (MOD(IFLG, 2) .EQ. 1) THEN
        CALL LABEL(LB, NL, X + W, Y + W, 7, 0)
        NP = 1
        XA(1) = X + W + 0.4D0 * HN
        XB(1) = XA(1) + 0.7D0 * HN * 22.0D0
        YA(1) = Y + W + 0.4D0 * HN
        YB(1) = YA(1) + HN
      END IF
C     RESTOMOD END
C     Maria etc., largest first (the table is sorted by diameter).
C     All are drawn; only a mare or oceanus of any size, or another
C     feature of 150 km or more, is labelled (our clutter rule).
   10 DO 30 K = 1, NMARE
        CALL LLUNIT(MRLAT(K), MRLON(K), CM)
        CALL CRATER(VB, NV, CM, 0.5D0 * MRDIA(K) / RM, IOK)
        IF (MOD(IFLG, 2) .EQ. 0) GO TO 30
        IF (MRDIA(K) .LT. 150.0D0 .AND. MRCH((K - 1) * 24 + 1) .NE. 77
     &      .AND. MRCH((K - 1) * 24 + 1) .NE. 79) GO TO 30
        IF (CM(1)*CAMF(1) + CM(2)*CAMF(2) + CM(3)*CAMF(3)
     &      .LT. RM * RM / DCAM) GO TO 30
        CALL SURFPT(CM, P)
        CALL PROJ(P, X, Y, IOK)
C       Name length, then its rectangle, centred on the point.
        NC = 0
        DO 15 I = 1, 24
          IF (MRCH((K - 1) * 24 + I) .EQ. 0) GO TO 16
          NC = NC + 1
   15   CONTINUE
   16   WD = 0.35D0 * HN * DBLE(NC)
        DO 20 I = 1, NP
          IF (X - WD .LT. XB(I) .AND. X + WD .GT. XA(I) .AND.
     &        Y - 0.5D0 * HN .LT. YB(I) .AND. Y + 0.5D0 * HN .GT. YA(I))
     &      GO TO 30
   20   CONTINUE
        CALL LABEL(LB, NL, X, Y, 6, K)
        IF (NP .GE. 64) GO TO 30
        NP = NP + 1
        XA(NP) = X - WD
        XB(NP) = X + WD
        YA(NP) = Y - 0.5D0 * HN
        YB(NP) = Y + 0.5D0 * HN
   30 CONTINUE
      IVMODE = 0
      RETURN
      END
