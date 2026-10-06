C=======================================================================
C
C     V I E W - 1 1 0 8          LAYER DISPATCHER
C
C     Walks the situation's layer list (JLL, from its SITUATION card)
C     and calls each layer by its id.
C     Every layer is a subroutine of one file with the same argument
C     list, (GET, VB, NV, SB, NS, LB, NL), and draws into the plot
C     buffers in list order.  FORTRAN 66 has no procedure variables,
C     so the call is chosen by a computed GO TO over the id.  One
C     relocatable element of the kernel; see vdrive.f for the list.
C
C     To add a layer: a new file with its subroutine, the next id, one
C     GO TO target and CALL below, a name for it in tools/gen_data.py
C     (LAYER_IDS), and the name in the SITUATION cards' LAYERS.
C
C       id  layer                       element
C        1  plot frame and ticks        lframe.f   DFRAME
C        2  stars                       lstars.f   DSTARS
C        3  Sun                         lsun.f     DSUN
C        4  Moon and craters            lmoon.f    DMOON
C        5  Earth                       learth.f   DEARTH
C        6  vehicles (placed models)    lvehic.f   MDRALL
C           their labels and markers    lvlab.f    VLABEL
C        7  COAS reticle                lcoas.f    S7COAS
C        8  LM shadow                   lshad.f    LMSHAD
C        9  LPD and LM window           llpd.f     OVLPD
C       10  burn cue (exhaust, text)    lburn.f    DBURN
C
C=======================================================================
      SUBROUTINE LAYERS(GET, VB, NV, SB, NS, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, VB(5,MAXV), SB(3,MAXS), LB(4,MAXL)
      INTEGER NV, NS, NL
      INTEGER K, L
C     The situation's layer list, JLL, ended by 0 (its SITUATION
C     card's LAYERS, copied by SITSET).
      DO 90 K = 1, 12
        L = JLL(K)
        IF (L .LT. 1 .OR. L .GT. 10) GO TO 95
C       Window overlays (COAS, LPD) only in the scene's window view.
        IF (IVUSE .NE. 0 .AND. (L .EQ. 7 .OR. L .EQ. 9)) GO TO 90
C       The window mask (vmask.f) is for the outside: not the frame
C       and the window overlays.
        IMSK = IMSKON
        IF (L .EQ. 1 .OR. L .EQ. 7 .OR. L .EQ. 9) IMSK = 0
        GO TO (11, 12, 13, 14, 15, 16, 17, 18, 19, 20), L
   11   CALL DFRAME(GET, VB, NV, SB, NS, LB, NL)
        GO TO 90
   12   CALL DSTARS(GET, VB, NV, SB, NS, LB, NL)
        GO TO 90
   13   CALL DSUN(GET, VB, NV, SB, NS, LB, NL)
        GO TO 90
   14   CALL DMOON(GET, VB, NV, SB, NS, LB, NL)
        GO TO 90
   15   CALL DEARTH(GET, VB, NV, SB, NS, LB, NL)
        GO TO 90
   16   CALL MDRALL(GET, VB, NV, SB, NS, LB, NL)
        GO TO 90
   17   CALL S7COAS(GET, VB, NV, SB, NS, LB, NL)
        GO TO 90
   18   CALL LMSHAD(GET, VB, NV, SB, NS, LB, NL)
        GO TO 90
   19   CALL OVLPD(GET, VB, NV, SB, NS, LB, NL)
        GO TO 90
   20   CALL DBURN(GET, VB, NV, SB, NS, LB, NL)
   90 CONTINUE
C     The LM station view (in_view 3) carries the LM window overlay.
   95 IMSK = 0
      IF (IVUSE .EQ. 3) CALL OVLPD(GET, VB, NV, SB, NS, LB, NL)
      RETURN
      END
