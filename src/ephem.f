C=======================================================================
C
C     V I E W - 1 1 0 8          EPHEMERIS
C
C     Core element.  Time, Sun, Moon and their orientation.  One relocatable element of
C     the kernel; see vdrive.f for the list.
C
C     WORLD MODEL (low precision on purpose)
C       Moon and Sun: the low precision series of the Astronomical
C       Almanac (Meeus ch. 25 and 47 truncated), ecliptic of date,
C       carried to the J2000 equinox by the general precession in
C       longitude.  Moon orientation: IAU (Archinal et al.) with its
C       periodic terms.  Earth rotation: GMST, pole fixed.
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
C-----------------------------------------------------------------------
      SUBROUTINE MOONG(GET, P)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, P(3)
      DOUBLE PRECISION T, L, B, HP, R, CE, SE, X, Y, Z, SND
C     RESTOMOD BEGIN: Astronomical Almanac low-precision Moon, 1980s
      T = (TJD0 + GET / 86400.0D0 - 2451545.0D0) / 36525.0D0
      L = 218.32D0 + 481267.881D0 * T
     &  + 6.29D0 * SND(135.0D0 + 477198.87D0 * T)
     &  - 1.27D0 * SND(259.3D0 - 413335.36D0 * T)
     &  + 0.66D0 * SND(235.7D0 + 890534.22D0 * T)
     &  + 0.21D0 * SND(269.9D0 + 954397.74D0 * T)
     &  - 0.19D0 * SND(357.5D0 + 35999.05D0 * T)
     &  - 0.11D0 * SND(186.5D0 + 966404.03D0 * T)
      B = 5.13D0 * SND(93.3D0 + 483202.02D0 * T)
     &  + 0.28D0 * SND(228.2D0 + 960400.89D0 * T)
     &  - 0.28D0 * SND(318.3D0 + 6003.15D0 * T)
     &  - 0.17D0 * SND(217.6D0 - 407332.21D0 * T)
      HP = 0.9508D0
     &  + 0.0518D0 * SND(225.0D0 + 477198.87D0 * T)
     &  + 0.0095D0 * SND(349.3D0 - 413335.36D0 * T)
     &  + 0.0078D0 * SND(325.7D0 + 890534.22D0 * T)
     &  + 0.0028D0 * SND(359.9D0 + 954397.74D0 * T)
      R = 6378.14D0 / DSIN(HP * DR)
C     Equinox of date to J2000: general precession in longitude.
      L = (L - 1.3969713D0 * T) * DR
      B = B * DR
      CE = DCOS(23.4392911D0 * DR)
      SE = DSIN(23.4392911D0 * DR)
      X = DCOS(B) * DCOS(L)
      Y = DCOS(B) * DSIN(L)
      Z = DSIN(B)
      P(1) = R * X
      P(2) = R * (CE * Y - SE * Z)
      P(3) = R * (SE * Y + CE * Z)
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
