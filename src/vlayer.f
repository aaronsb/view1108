C=======================================================================
C
C     V I E W - 1 1 0 8          LAYER DISPATCHER
C
C     Walks the scene's layer list and calls each layer by its id.
C     Every layer is a subroutine of one file with the same argument
C     list, (GET, VB, NV, SB, NS, LB, NL), and draws into the plot
C     buffers in list order.  FORTRAN 66 has no procedure variables,
C     so the call is chosen by a computed GO TO over the id.  One
C     relocatable element of the kernel; see vdrive.f for the list.
C
C     To add a layer: a new file with its subroutine, the next id, one
C     GO TO target and CALL below, and the id in the scene lists.
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
C
C=======================================================================
      SUBROUTINE LAYERS(GET, VB, NV, SB, NS, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, VB(5,MAXV), SB(3,MAXS), LB(4,MAXL)
      INTEGER NV, NS, NL
      INTEGER LL(12,9), K, L
C     Layer lists, one column per scene, ended by 0.  Scene 8 (the
C     stack in translunar coast) has the sky and the vehicles.  Scene 4
C     (the LM pirouette) has no stars, as on the film (t22.png,
C     t25.png).  Scene 9 (Apollo 8 Earthrise) has scene 1's.
      DATA LL / 1, 2, 3, 4, 5, 6, 0, 0, 0, 0, 0, 0,
     &          1, 2, 3, 4, 5, 6, 0, 0, 0, 0, 0, 0,
     &          1, 2, 3, 4, 5, 6, 0, 0, 0, 0, 0, 0,
     &          1, 3, 4, 5, 6, 0, 0, 0, 0, 0, 0, 0,
     &          1, 2, 3, 4, 5, 6, 8, 9, 0, 0, 0, 0,
     &          1, 2, 3, 4, 5, 6, 0, 0, 0, 0, 0, 0,
     &          1, 2, 3, 4, 5, 6, 7, 0, 0, 0, 0, 0,
     &          1, 2, 3, 4, 5, 6, 0, 0, 0, 0, 0, 0,
     &          1, 2, 3, 4, 5, 6, 0, 0, 0, 0, 0, 0 /
      DO 90 K = 1, 12
        L = LL(K, ISCN)
        IF (L .LT. 1 .OR. L .GT. 9) GO TO 95
C       Window overlays (COAS, LPD) only in the scene's window view.
        IF (IVUSE .NE. 0 .AND. (L .EQ. 7 .OR. L .EQ. 9)) GO TO 90
        GO TO (11, 12, 13, 14, 15, 16, 17, 18, 19), L
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
   90 CONTINUE
C     The LM station view (in_view 3) carries the LM window overlay.
   95 IF (IVUSE .EQ. 3) CALL OVLPD(GET, VB, NV, SB, NS, LB, NL)
      RETURN
      END
