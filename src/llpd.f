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
C     engineering drawings; we do not have them.
C     The LPD marks "elevation angles measured sequentially down from
C     a reference line that is parallel to the LEM axis" (MSC IN
C     65-EG-52, Cheatham and Steele, NTRS 19700024922, printed p. 1);
C     its Fig. 2(b) draws that 0 deg line along the Z axis.  Grumman's
C     drawing (LM structures study guide, 1967, printed p. 36, Fig.
C     26, "LANDING POINT DESIGNATOR") numbers it 0 to 60 every 10 deg
C     with a mark every 2, and crosses it at 0 with a bar marked 5 and
C     10 each side.  The film's scale (film seconds 29-35, reference/
C     video_frames/descent_t*.png, 60 px per 10 deg from the edge
C     numbers, Y = 0 at the left "0" labels) is that scale: symmetric
C     marks every 2 deg, a longer mark to the right every 10, a bar
C     with marks at 5 and 10 at the top.  Its 29 marks from 0 to 58
C     lie at
C       Y = LPDK tan(LPDDN - L),  LPDDN 30.2 deg, LPDK 49.8,
C     to 0.05 deg rms (our fit), so the boresight is 30.2 deg below
C     the LM's +Z.  A gnomonic plot from the eye would have LPDK
C     57.3; 0.87 of it is what an eye about 15 per cent further from
C     the window than the scale's design eye would see (our guess).
C     Ours from the film: the lower bar at 50 (the film's sits 0.7
C     deg lower), +-7.5 deg with end ticks down; the scale line from
C     -6 to the sill; the window, sill near Y = -35 and the right
C     edge as two lines to the frame top (the film's frame is cut at
C     Y = +41).
C=======================================================================
      SUBROUTINE OVLPD(GET, VB, NV, SB, NS, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, VB(5,MAXV), SB(3,MAXS), LB(4,MAXL)
      INTEGER NV, NS, NL
      DOUBLE PRECISION Y, WX(9), WY(9), YU, YL, XT, A, YLPD
      INTEGER K, J
C     Plot Y of LPD angle A (deg).
      YLPD(A) = LPDK * DTAN((LPDDN - A) * DR)
      IVMODE = 0
      ISTYLE = 1
      YU = YLPD(0.0D0)
      YL = YLPD(50.0D0)
      CALL OVLINE(VB, NV, 0.0D0, YLPD(-6.0D0), 0.0D0, -35.5D0)
      DO 10 J = -3, 32
        IF (J .EQ. 0 .OR. J .EQ. 25) GO TO 10
        Y = YLPD(2.0D0 * DBLE(J))
        IF (Y .LT. -35.0D0) GO TO 10
        IF (MOD(J, 5) .NE. 0 .OR. J .LT. 0) GO TO 8
        CALL OVLINE(VB, NV, 0.0D0, Y, 2.5D0, Y)
        GO TO 10
    8   CALL OVLINE(VB, NV, -0.6D0, Y, 0.6D0, Y)
   10 CONTINUE
C     Upper bar at 0, marks up at 5 and 10 deg each side of the LPD's
C     plane, its ends at 10.
      XT = LPDK * DTAN(10.0D0 * DR) / DCOS(LPDDN * DR)
      CALL OVLINE(VB, NV, -XT, YU, XT, YU)
      DO 20 K = -2, 2
        XT = LPDK * DTAN(5.0D0 * DBLE(K) * DR) / DCOS(LPDDN * DR)
        IF (K .NE. 0) CALL OVLINE(VB, NV, XT, YU, XT, YU + 1.3D0)
   20 CONTINUE
C     Lower bar with end ticks down.
      CALL OVLINE(VB, NV, -7.5D0, YL, 7.5D0, YL)
      CALL OVLINE(VB, NV, -7.5D0, YL, -7.5D0, YL - 1.5D0)
      CALL OVLINE(VB, NV, 7.5D0, YL, 7.5D0, YL - 1.5D0)
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
