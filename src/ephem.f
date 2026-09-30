C=======================================================================
C
C     V I E W - 1 1 0 8          EPHEMERIS
C
C     Core element.  Time, Sun, Moon and their orientation.  One
C     relocatable element of the kernel; see vdrive.f for the list.
C
C     WORLD MODEL
C       Moon: Meeus ch. 47 (ELP-2000/82 abridged, 60 + 60 terms),
C       within about 15 km of JPL Horizons over Apollo 8 and 11
C       (docs/simulation.md); precessed to J2000 (PRECM).  Sun: the
C       low-precision series of the Astronomical Almanac, ecliptic of
C       date carried to the J2000 equinox by the general precession in
C       longitude.  Moon orientation: IAU (Archinal et al.) with its
C       periodic terms.  Earth rotation: GMST about the pole of date,
C       carried to J2000 by the IAU 1976 precession (PRECM).
C
C=======================================================================
C
C=======================================================================
C     TIME AND EPHEMERIDES
C=======================================================================
      SUBROUTINE TSET(GET)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET
C     RESTOMOD BEGIN: J2000 epoch (IAU 1976/1984), GMST of Aoki 1982
      TJD = TJD0 + GET / 86400.0D0
      TDAY = TJD - 2451545.0D0
      TCEN = TDAY / 36525.0D0
      GMST = DMOD(280.46061837D0 + 360.98564736629D0 * TDAY, 360.0D0)
      GMST = GMST * DR
C     RESTOMOD END
      RETURN
      END
C
C-----------------------------------------------------------------------
C     MOONG: geocentric Moon, EQ km.
C
C     Meeus, Astronomical Algorithms (2nd ed., 1998), ch. 47: the
C     ELP-2000/82 lunar theory (Chapront-Touze and Chapront, 1982)
C     abridged to the 60 + 60 periodic terms of tables 47.A and 47.B,
C     with the E factor for terms in M and the additive terms A1-A3.
C     The tables are data (data/meeus47.txt, BLOCK DATA /CMEEUS/).
C     Mean ecliptic and equinox of date to J2000 equatorial: mean
C     obliquity of date, then the IAU 1976 precession (Lieske 1977;
C     Meeus eqs. 22.2 and 21.3, PRECM).  Time is TT: UTC plus 32.184 s
C     plus
C     TAI-UTC by the USNO formula for 1968-02-01 to 1972-01-01,
C     4.21317 s + (MJD - 39126) x 0.002592 s (maia.usno.navy.mil,
C     ser7/tai-utc.dat); ours outside that span too.
C     Checked against JPL Horizons, docs/simulation.md.  MSC's RTCC
C     did not compute its ephemeris from a short series: its
C     "ephemeris subroutines used in the RTCC will be system
C     subroutines", reading "an ephemeris tape" (Analytical Mechanics
C     Associates Report 68-4, NAS 9-4036, April 1968, p. 17),
C     so a precise Moon is nearer period practice than the
C     low-precision formula this replaces.
C-----------------------------------------------------------------------
      SUBROUTINE MOONG(GET, P)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, P(3)
      DOUBLE PRECISION T, TJ, XMJD, LP, DD, AM, AMP, F, A1, A2, A3, E
      DOUBLE PRECISION SL, SR, SB, ARG, EK, L, B, R, EPS, CE, SE
      DOUBLE PRECISION X, Y, Z, Q(3), PR(3,3), SND, CSD
      INTEGER K, J, M
C     RESTOMOD BEGIN: ELP-2000/82 (1982) as abridged by Meeus (1991,
C     1998); IAU 1976 precession; TT and TAI-UTC (1970s definitions)
      XMJD = TJD0 + GET / 86400.0D0 - 2400000.5D0
      TJ = TJD0 + (GET + 32.184D0 + 4.21317D0
     &   + (XMJD - 39126.0D0) * 0.002592D0) / 86400.0D0
      T = (TJ - 2451545.0D0) / 36525.0D0
      LP = 218.3164477D0 + 481267.88123421D0 * T
     &   - 0.0015786D0 * T**2 + T**3 / 538841.0D0 - T**4 / 65194000.0D0
      DD = 297.8501921D0 + 445267.1114034D0 * T
     &   - 0.0018819D0 * T**2 + T**3 / 545868.0D0
     &   - T**4 / 113065000.0D0
      AM = 357.5291092D0 + 35999.0502909D0 * T
     &   - 0.0001536D0 * T**2 + T**3 / 24490000.0D0
      AMP = 134.9633964D0 + 477198.8675055D0 * T
     &    + 0.0087414D0 * T**2 + T**3 / 69699.0D0
     &    - T**4 / 14712000.0D0
      F = 93.2720950D0 + 483202.0175233D0 * T
     &  - 0.0036539D0 * T**2 - T**3 / 3526000.0D0
     &  + T**4 / 863310000.0D0
      A1 = 119.75D0 + 131.849D0 * T
      A2 = 53.09D0 + 479264.290D0 * T
      A3 = 313.45D0 + 481266.484D0 * T
      E = 1.0D0 - 0.002516D0 * T - 0.0000074D0 * T**2
      LP = DMOD(LP, 360.0D0)
      DD = DMOD(DD, 360.0D0)
      AM = DMOD(AM, 360.0D0)
      AMP = DMOD(AMP, 360.0D0)
      F = DMOD(F, 360.0D0)
      SL = 0.0D0
      SR = 0.0D0
      SB = 0.0D0
      DO 10 K = 1, 60
        J = 6 * (K - 1)
        M = IABS(MMA(J + 2))
        EK = 1.0D0
        IF (M .EQ. 1) EK = E
        IF (M .EQ. 2) EK = E * E
        ARG = DBLE(MMA(J + 1)) * DD + DBLE(MMA(J + 2)) * AM
     &      + DBLE(MMA(J + 3)) * AMP + DBLE(MMA(J + 4)) * F
        SL = SL + DBLE(MMA(J + 5)) * EK * SND(ARG)
        SR = SR + DBLE(MMA(J + 6)) * EK * CSD(ARG)
   10 CONTINUE
      DO 20 K = 1, 60
        J = 5 * (K - 1)
        M = IABS(MMB(J + 2))
        EK = 1.0D0
        IF (M .EQ. 1) EK = E
        IF (M .EQ. 2) EK = E * E
        ARG = DBLE(MMB(J + 1)) * DD + DBLE(MMB(J + 2)) * AM
     &      + DBLE(MMB(J + 3)) * AMP + DBLE(MMB(J + 4)) * F
        SB = SB + DBLE(MMB(J + 5)) * EK * SND(ARG)
   20 CONTINUE
      SL = SL + 3958.0D0 * SND(A1) + 1962.0D0 * SND(LP - F)
     &   + 318.0D0 * SND(A2)
      SB = SB - 2235.0D0 * SND(LP) + 382.0D0 * SND(A3)
     &   + 175.0D0 * SND(A1 - F) + 175.0D0 * SND(A1 + F)
     &   + 127.0D0 * SND(LP - AMP) - 115.0D0 * SND(LP + AMP)
      L = (LP + SL * 1.0D-6) * DR
      B = SB * 1.0D-6 * DR
      R = 385000.56D0 + SR * 1.0D-3
C     Ecliptic of date to equator of date, mean obliquity (eq. 22.2).
      EPS = (23.4392911D0 - 0.0130041667D0 * T
     &    - 1.6388889D-7 * T**2 + 5.0361111D-7 * T**3) * DR
      CE = DCOS(EPS)
      SE = DSIN(EPS)
      X = R * DCOS(B) * DCOS(L)
      Y = R * DCOS(B) * DSIN(L)
      Z = R * DSIN(B)
      Q(1) = X
      Q(2) = CE * Y - SE * Z
      Q(3) = SE * Y + CE * Z
C     Equator and equinox of date to J2000: PRECM's transpose.
      CALL PRECM(T, PR)
      CALL MTXV(PR, Q, P)
C     RESTOMOD END
      RETURN
      END
C
C-----------------------------------------------------------------------
C     SND: sine of an angle in degrees, reduced first.
C-----------------------------------------------------------------------
      DOUBLE PRECISION FUNCTION SND(A)
      DOUBLE PRECISION A
      DOUBLE PRECISION PI, DR
C     RESTOMOD: real-valued PARAMETER; FORTRAN V PARAMETER was
C     integer-only (UP-4046 Rev 3, sec. 10.4.1, p. 10-8)
      PARAMETER (PI=3.141592653589793D0, DR=PI/180.0D0)
      SND = DSIN(DMOD(A, 360.0D0) * DR)
      RETURN
      END
C
C-----------------------------------------------------------------------
C     SUNG: unit vector Earth to Sun, EQ.
C-----------------------------------------------------------------------
      SUBROUTINE SUNG(GET, U)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, U(3)
      DOUBLE PRECISION D, T, G, L, CE, SE, SND
C     RESTOMOD BEGIN: Astronomical Almanac low-precision Sun, 1980s
      D = TJD0 + GET / 86400.0D0 - 2451545.0D0
      T = D / 36525.0D0
      G = 357.528D0 + 0.9856003D0 * D
      L = 280.460D0 + 0.9856474D0 * D + 1.915D0 * SND(G)
     &  + 0.020D0 * SND(2.0D0 * G)
      L = DMOD(L - 1.3969713D0 * T, 360.0D0) * DR
      CE = DCOS(23.4392911D0 * DR)
      SE = DSIN(23.4392911D0 * DR)
      U(1) = DCOS(L)
      U(2) = CE * DSIN(L)
      U(3) = SE * DSIN(L)
C     RESTOMOD END
      RETURN
      END
C
C-----------------------------------------------------------------------
C     MOONRT: Moon-fixed to EQ rotation, IAU pole and prime meridian
C     with the periodic terms E1..E13.  M = RZ(A0+90) RX(90-D0) RZ(W).
C-----------------------------------------------------------------------
      SUBROUTINE MOONRT(GET, M)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, M(3,3)
      DOUBLE PRECISION D, T, E(13), A0, D0, W, SND, CSD
      DOUBLE PRECISION R1(3,3), R2(3,3), R3(3,3), R4(3,3)
C     RESTOMOD BEGIN: IAU WGCCRE lunar orientation, 1980s-2010s
      D = TJD0 + GET / 86400.0D0 - 2451545.0D0
      T = D / 36525.0D0
      E(1) = 125.045D0 - 0.0529921D0 * D
      E(2) = 250.089D0 - 0.1059842D0 * D
      E(3) = 260.008D0 + 13.0120009D0 * D
      E(4) = 176.625D0 + 13.3407154D0 * D
      E(5) = 357.529D0 + 0.9856003D0 * D
      E(6) = 311.589D0 + 26.4057084D0 * D
      E(7) = 134.963D0 + 13.0649930D0 * D
      E(8) = 276.617D0 + 0.3287146D0 * D
      E(9) = 34.226D0 + 1.7484877D0 * D
      E(10) = 15.134D0 - 0.1589763D0 * D
      E(11) = 119.743D0 + 0.0036096D0 * D
      E(12) = 239.961D0 + 0.1643573D0 * D
      E(13) = 25.053D0 + 12.9590088D0 * D
      A0 = 269.9949D0 + 0.0031D0 * T - 3.8787D0 * SND(E(1))
     &   - 0.1204D0 * SND(E(2)) + 0.0700D0 * SND(E(3))
     &   - 0.0172D0 * SND(E(4)) + 0.0072D0 * SND(E(6))
     &   - 0.0052D0 * SND(E(10)) + 0.0043D0 * SND(E(13))
      D0 = 66.5392D0 + 0.0130D0 * T + 1.5419D0 * CSD(E(1))
     &   + 0.0239D0 * CSD(E(2)) - 0.0278D0 * CSD(E(3))
     &   + 0.0068D0 * CSD(E(4)) - 0.0029D0 * CSD(E(6))
     &   + 0.0009D0 * CSD(E(7)) + 0.0008D0 * CSD(E(10))
     &   - 0.0009D0 * CSD(E(13))
      W = 38.3213D0 + 13.17635815D0 * D - 1.4D-12 * D * D
     &  + 3.5610D0 * SND(E(1)) + 0.1208D0 * SND(E(2))
     &  - 0.0642D0 * SND(E(3)) + 0.0158D0 * SND(E(4))
     &  + 0.0252D0 * SND(E(5)) - 0.0066D0 * SND(E(6))
     &  - 0.0047D0 * SND(E(7)) - 0.0046D0 * SND(E(8))
     &  + 0.0028D0 * SND(E(9)) + 0.0052D0 * SND(E(10))
     &  + 0.0040D0 * SND(E(11)) + 0.0019D0 * SND(E(12))
     &  - 0.0044D0 * SND(E(13))
      CALL ROTZ((A0 + 90.0D0) * DR, R1)
      CALL ROTX((90.0D0 - D0) * DR, R2)
      CALL ROTZ(DMOD(W, 360.0D0) * DR, R3)
      CALL MXM(R1, R2, R4)
      CALL MXM(R4, R3, M)
C     RESTOMOD END
      RETURN
      END
C
      DOUBLE PRECISION FUNCTION CSD(A)
      DOUBLE PRECISION A
      DOUBLE PRECISION PI, DR
C     RESTOMOD: real-valued PARAMETER; FORTRAN V PARAMETER was
C     integer-only (UP-4046 Rev 3, sec. 10.4.1, p. 10-8)
      PARAMETER (PI=3.141592653589793D0, DR=PI/180.0D0)
      CSD = DCOS(DMOD(A, 360.0D0) * DR)
      RETURN
      END
C
C     GMSTAT: Greenwich mean sidereal time (rad) at GET of the current
C     scenario; the formula of TSET.
      DOUBLE PRECISION FUNCTION GMSTAT(GET)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET
C     RESTOMOD BEGIN: GMST of Aoki 1982
      GMSTAT = DMOD(280.46061837D0 + 360.98564736629D0 *
     &  (TJD0 + GET / 86400.0D0 - 2451545.0D0), 360.0D0) * DR
C     RESTOMOD END
      RETURN
      END
C
C     MOONV: the Moon's geocentric position P (km) and velocity V
C     (km/s) at GET, the velocity by a central difference over 2 s.
      SUBROUTINE MOONV(GET, P, V)
      DOUBLE PRECISION GET, P(3), V(3), A(3), B(3)
      INTEGER I
      CALL MOONG(GET, P)
      CALL MOONG(GET - 1.0D0, A)
      CALL MOONG(GET + 1.0D0, B)
      DO 10 I = 1, 3
        V(I) = 0.5D0 * (B(I) - A(I))
   10 CONTINUE
      RETURN
      END
C
C-----------------------------------------------------------------------
C     PRECM: the IAU 1976 precession matrix P for T Julian centuries
C     from J2000 (Lieske 1977; Meeus, Astronomical Algorithms, 2nd ed.,
C     eq. 21.3): P carries J2000 equatorial vectors to the mean
C     equator and equinox of date, and its transpose (MTXV) back.
C     The Earth-fixed frame turns about the pole of date by GMST, so
C     Earth-fixed positions (coastlines, the reports' latitudes and
C     longitudes) need the transpose to meet our J2000 stars and Moon:
C     about 0.43 deg of precession between 1969 and 2000.
C-----------------------------------------------------------------------
      SUBROUTINE PRECM(T, P)
      DOUBLE PRECISION T, P(3,3), ZT, ZZ, TH, C1, S1, C2, S2, C3, S3
      DOUBLE PRECISION AS
C     RESTOMOD BEGIN: IAU 1976 precession (Lieske 1977)
      AS = 3.141592653589793D0 / 180.0D0 / 3600.0D0
      ZT = (2306.2181D0 * T + 0.30188D0 * T**2 + 0.017998D0 * T**3) * AS
      ZZ = (2306.2181D0 * T + 1.09468D0 * T**2 + 0.018203D0 * T**3) * AS
      TH = (2004.3109D0 * T - 0.42665D0 * T**2 - 0.041833D0 * T**3) * AS
C     RESTOMOD END
      C1 = DCOS(ZT)
      S1 = DSIN(ZT)
      C2 = DCOS(ZZ)
      S2 = DSIN(ZZ)
      C3 = DCOS(TH)
      S3 = DSIN(TH)
      P(1,1) = C1 * C3 * C2 - S1 * S2
      P(1,2) = -S1 * C3 * C2 - C1 * S2
      P(1,3) = -S3 * C2
      P(2,1) = C1 * C3 * S2 + S1 * C2
      P(2,2) = -S1 * C3 * S2 + C1 * C2
      P(2,3) = -S3 * S2
      P(3,1) = C1 * S3
      P(3,2) = -S1 * S3
      P(3,3) = C3
      RETURN
      END
