C=======================================================================
C
C     V I E W - 1 1 0 8          LAYER 7  COAS RETICLE
C
C     Layer element.  One relocatable element of
C     the kernel; see vdrive.f for the list.
C
C=======================================================================
C
C     S7COAS: the COAS cross hairs, fixed to the CSM.  TN D-6853
C     (printed p. 12): "Command module and LM windows and optics
C     outlines can be simulated."  The reticle's pattern and size here
C     are our guess: a cross +-6 deg, open in the middle so the target
C     shows.
      SUBROUTINE S7COAS(GET, VB, NV, SB, NS, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, VB(5,MAXV), SB(3,MAXS), LB(4,MAXL)
      INTEGER NV, NS, NL
      IVMODE = 0
      ISTYLE = 1
      CALL OVLINE(VB, NV, -6.0D0, 0.0D0, -1.0D0, 0.0D0)
      CALL OVLINE(VB, NV, 1.0D0, 0.0D0, 6.0D0, 0.0D0)
      CALL OVLINE(VB, NV, 0.0D0, -6.0D0, 0.0D0, -1.0D0)
      CALL OVLINE(VB, NV, 0.0D0, 1.0D0, 0.0D0, 6.0D0)
      RETURN
      END
