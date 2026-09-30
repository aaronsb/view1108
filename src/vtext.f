C=======================================================================
C
C     V I E W - 1 1 0 8          TEXT
C
C     Core element.  Records for the recorder's character
C     generator.  One relocatable element of
C     the kernel; see vdrive.f for the list.
C
C=======================================================================
C
C=======================================================================
C     TEXT.  Records for the recorder's character generator (the SC-4020
C     class had a "type character" order; docs/univac-1108.md): X, Y
C     of the first character's lower left (plot deg), height (plot
C     deg), start index in TC; each string is character codes ending
C     in 0.  Tick numbers when IFLG bit 1 is set, at the ticks DFRAME
C     draws, OUTSIDE the box: left edge right-aligned, right edge,
C     bottom edge centred below, 1.0 percent of the field high (read
C     from the film, descent_t29.png, and the report's plot pages).
C     Names of nav stars, Sun, Earth and Moon beside their labels when
C     bit 0 is set, 1.4 percent of the field high, by the label level
C     (ILEV): primary Sun, Earth, Moon, the landing site, vehicles and
C     the pad; secondary also nav stars and maria; all, everything.
C     The labels (LB) themselves are not filtered.  Also vehicles (LB
C     kind 8: CM, SM, LM, S-IVB, CSM by id) and the launch pad (kind 9,
C     its name from the PAD card), both modern additions.  Crater
C     names stay with the page (LB kind 2).  Character width 0.7 of
C     the height, used for alignment: ours.
C=======================================================================
      SUBROUTINE TXALL(LB, NL, TB, NT, TC, NCH)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION LB(4,MAXL), TB(4,MAXT)
      INTEGER NL, NT, TC(MAXTC), NCH
      DOUBLE PRECISION B, ST, TL, H, V
      INTEGER I, J, K, N, ID, IC(24), VEHCH(25)
C     Vehicle names, 5 codes each, zero padded: CM, SM, LM, S-IVB, CSM.
      DATA VEHCH / 67, 77, 0, 0, 0, 83, 77, 0, 0, 0, 76, 77, 0, 0, 0,
     &             83, 45, 73, 86, 66, 67, 83, 77, 0, 0 /
      NT = 0
      NCH = 0
      B = BOXH
      H = 0.02D0 * B
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (MOD(IFLG / 2, 2) .EQ. 1) THEN
        ST = 20.0D0
        IF (2.0D0 * B .LE. 60.0D0) ST = 10.0D0
        IF (2.0D0 * B .LE. 25.0D0) ST = 5.0D0
        TL = 0.02D0 * B
        N = INT(B / ST + 1.0D-9)
        DO 10 K = -N, N
          V = DBLE(K) * ST
          IF (DABS(V) .GE. B - 1.0D-9) GO TO 10
          CALL ITOC(NINT(V), IC, J)
          CALL TXPUT(TB, NT, TC, NCH, V - 0.35D0 * H * DBLE(J),
     &               -B - 1.5D0 * H, H, IC, J)
          CALL TXPUT(TB, NT, TC, NCH, -B - 0.5D0 * H
     &               - 0.7D0 * H * DBLE(J), V - 0.5D0 * H, H, IC, J)
          CALL TXPUT(TB, NT, TC, NCH, B + 0.5D0 * H,
     &               V - 0.5D0 * H, H, IC, J)
   10   CONTINUE
      END IF
C     RESTOMOD END
      IF (MOD(IFLG, 2) .EQ. 0) RETURN
      H = 0.028D0 * B
      DO 40 I = 1, NL
        K = NINT(LB(3,I))
        ID = NINT(LB(4,I))
        N = 0
        IF ((K .EQ. 1 .OR. K .EQ. 6) .AND. ILEV .LT. 2) GO TO 40
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (K .EQ. 1 .AND. ID .GE. 1 .AND. ID .LE. NNAV) THEN
          DO 20 J = 1, 10
            IF (NAVCH((ID - 1) * 10 + J) .EQ. 0) GO TO 30
            N = N + 1
            IC(N) = NAVCH((ID - 1) * 10 + J)
   20     CONTINUE
        ELSE IF (K .GE. 3 .AND. K .LE. 5) THEN
          DO 25 J = 1, 5
            IF (BODCH((K - 3) * 5 + J) .EQ. 0) GO TO 30
            N = N + 1
            IC(N) = BODCH((K - 3) * 5 + J)
   25     CONTINUE
        ELSE IF (K .EQ. 6 .AND. ID .GE. 1 .AND. ID .LE. NMARE) THEN
C         Mare names centred on the mare's centre.
          DO 26 J = 1, 24
            IF (MRCH((ID - 1) * 24 + J) .EQ. 0) GO TO 27
            N = N + 1
            IC(N) = MRCH((ID - 1) * 24 + J)
   26     CONTINUE
   27     IF (N .GT. 0) CALL TXPUT(TB, NT, TC, NCH,
     &      LB(1,I) - 0.35D0 * H * DBLE(N), LB(2,I) - 0.5D0 * H,
     &      H, IC, N)
          GO TO 40
        ELSE IF (K .EQ. 7) THEN
          DO 28 J = 1, 22
            N = N + 1
            IC(N) = SITECH(J)
   28     CONTINUE
        ELSE IF (K .EQ. 8 .AND. ID .GE. 1 .AND. ID .LE. 5) THEN
          DO 29 J = 1, 5
            IF (VEHCH((ID - 1) * 5 + J) .EQ. 0) GO TO 30
            N = N + 1
            IC(N) = VEHCH((ID - 1) * 5 + J)
   29     CONTINUE
        ELSE IF (K .EQ. 9) THEN
          DO 32 J = 1, 8
            IF (PADCH(8 * (ISN - 1) + J) .EQ. 0) GO TO 30
            N = N + 1
            IC(N) = PADCH(8 * (ISN - 1) + J)
   32     CONTINUE
        END IF
C     RESTOMOD END
   30   IF (N .GT. 0) CALL TXPUT(TB, NT, TC, NCH, LB(1,I) + 0.4D0 * H,
     &                         LB(2,I) + 0.4D0 * H, H, IC, N)
   40 CONTINUE
      RETURN
      END
C
C     TXPUT: append a text record of N codes IC.
      SUBROUTINE TXPUT(TB, NT, TC, NCH, X, Y, H, IC, N)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION TB(4,MAXT), X, Y, H
      INTEGER NT, TC(MAXTC), NCH, IC(24), N, K
      IF (NT .GE. MAXT .OR. NCH + N + 1 .GT. MAXTC) RETURN
      NT = NT + 1
      TB(1,NT) = X
      TB(2,NT) = Y
      TB(3,NT) = H
      TB(4,NT) = DBLE(NCH + 1)
      DO 10 K = 1, N
        TC(NCH + K) = IC(K)
   10 CONTINUE
      NCH = NCH + N + 1
      TC(NCH) = 0
      RETURN
      END
C
C     ITOC: integer IV to character codes IC(1..N), ASCII digits.
      SUBROUTINE ITOC(IV, IC, N)
      INTEGER IV, IC(24), N, M, K, D(10), ND
      M = IABS(IV)
      ND = 0
   10 ND = ND + 1
      D(ND) = MOD(M, 10)
      M = M / 10
      IF (M .GT. 0 .AND. ND .LT. 10) GO TO 10
      N = 0
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (IV .LT. 0) THEN
        N = 1
        IC(1) = 45
      END IF
C     RESTOMOD END
      DO 20 K = ND, 1, -1
        N = N + 1
        IC(N) = 48 + D(K)
   20 CONTINUE
      RETURN
      END
