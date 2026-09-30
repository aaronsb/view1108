C=======================================================================
C
C     V I E W - 1 1 0 8          LAYER 9  LPD AND LM WINDOW
C
C     Layer element.  One relocatable element of
C     the kernel; see vdrive.f for the list.
C
C=======================================================================
C
C=======================================================================
C     LM FRONT WINDOW OVERLAY.  Landing point designator scale and the
C     commander's window frame, fixed to the LM (drawn in reference
C     plot degrees, so they move with free-look).  TN D-6853 (printed
C     p. 7) says the LPD and scribe marks came from LM window
C     engineering drawings; we do not have them.  The geometry below
C     is our reading of the film's descent frames (film seconds 27-35,
C     reference/video_frames/descent_t*.png), taking 60 px per 10 deg
C     from the edge numbers and Y = 0 at the "0" labels:
C       scale line  X = 0 from Y = +36 to the sill, small marks every
C                   1.125 deg on alternate sides, a longer mark to the
C                   right every 9 deg down to the lower cross bar;
C       cross bars  upper at Y = +29.3, +-11 deg, ticks up at 5, 10;
C                   lower at Y = -18.8, +-6.5 deg, end ticks down;
C       window      sill near Y = -35, right edge two lines to the
C                   frame top (the film's frame is cut at Y = +41).
C=======================================================================
      SUBROUTINE OVLPD(GET, VB, NV, SB, NS, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, VB(5,MAXV), SB(3,MAXS), LB(4,MAXL)
      INTEGER NV, NS, NL
      DOUBLE PRECISION Y, WX(9), WY(9), YU, YL
      INTEGER K, J
      IVMODE = 0
      ISTYLE = 1
      YU = 29.3D0
      YL = -18.8D0
      CALL OVLINE(VB, NV, 0.0D0, 36.0D0, 0.0D0, -35.5D0)
      DO 10 J = -14, 48
        Y = YL + 1.125D0 * DBLE(J)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (MOD(J + 16, 8) .EQ. 0 .AND. J .GT. 0) THEN
          IF (Y .LT. YU) CALL OVLINE(VB, NV, 0.0D0, Y, 2.5D0, Y)
          GO TO 10
        END IF
        IF (MOD(J + 16, 2) .EQ. 0) THEN
          CALL OVLINE(VB, NV, -0.6D0, Y, 0.0D0, Y)
        ELSE
          CALL OVLINE(VB, NV, 0.0D0, Y, 0.6D0, Y)
        END IF
C     RESTOMOD END
   10 CONTINUE
C     Upper cross bar, ticks up at 5 and 10 deg each side and the ends.
      CALL OVLINE(VB, NV, -11.0D0, YU, 11.0D0, YU)
      DO 20 K = -2, 2
        IF (K .NE. 0) CALL OVLINE(VB, NV, 5.0D0 * DBLE(K), YU,
     &                            5.0D0 * DBLE(K), YU + 1.3D0)
   20 CONTINUE
C     Lower cross bar with end ticks down.
      CALL OVLINE(VB, NV, -6.5D0, YL, 6.5D0, YL)
      CALL OVLINE(VB, NV, -6.5D0, YL, -6.5D0, YL - 1.5D0)
      CALL OVLINE(VB, NV, 6.5D0, YL, 6.5D0, YL - 1.5D0)
C     Window frame: sill, then the right-hand edge as two lines.
      WX(1) = -60.0D0
      WY(1) = -34.8D0
      WX(2) = -30.0D0
      WY(2) = -34.5D0
      WX(3) = -12.0D0
      WY(3) = -35.3D0
      WX(4) = -1.0D0
      WY(4) = -35.7D0
      WX(5) = 13.4D0
      WY(5) = 38.0D0
      WX(6) = 10.0D0
      WY(6) = 40.5D0
      DO 40 K = 1, 5
        CALL OVLINE(VB, NV, WX(K), WY(K), WX(K+1), WY(K+1))
   40 CONTINUE
      WX(1) = -1.0D0
      WY(1) = -35.7D0
      WX(2) = 2.0D0
      WY(2) = -33.5D0
      WX(3) = 5.5D0
      WY(3) = -27.0D0
      WX(4) = 16.0D0
      WY(4) = 37.0D0
      WX(5) = 15.5D0
      WY(5) = 38.5D0
      WX(6) = 10.0D0
      WY(6) = 40.5D0
      DO 50 K = 1, 5
        CALL OVLINE(VB, NV, WX(K), WY(K), WX(K+1), WY(K+1))
   50 CONTINUE
      RETURN
      END
