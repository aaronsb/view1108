C=======================================================================
C
C     V I E W - 1 1 0 8          LAYER 6  VEHICLES
C
C     Layer element.  Placing and drawing the
C     spacecraft models, with hidden lines.  One relocatable element of
C     the kernel; see vdrive.f for the list.
C
C=======================================================================
C
C     MCLEAR: no model placed.
      SUBROUTINE MCLEAR
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER K
      DO 10 K = 1, MMOD
        MDON(K) = 0
   10 CONTINUE
      DO 20 K = 1, MSOL
        LACT(K) = 0
        LINS(K) = 0
   20 CONTINUE
      NACT = 0
      RETURN
      END
C
C-----------------------------------------------------------------------
C     MPLACE: place model K for this frame.  AT: its body axes in EQ
C     (columns X, Y, Z).  Body point BO (m) goes to P (km, camera
C     relative).  Its solids go to camera-relative EQ km (LWV, LWN,
C     LWD) and join the solids that hide things.
C     A model can ride on the observer's own vehicle, a cabin seen
C     from inside: AT the vehicle's body axes, BO the eye point in
C     body metres, P = 0.  A solid with the camera inside it (every
C     face turned away) does not hide anything and its edges are all
C     drawn (LINS); a cabin is better built of free lines anyway.
C-----------------------------------------------------------------------
      SUBROUTINE MPLACE(K, AT, P, BO)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      INTEGER K
      DOUBLE PRECISION AT(3,3), P(3), BO(3), V(3), W(3)
      INTEGER I, J, IS
      DO 10 I = 1, 3
        MDP(I,K) = P(I)
        MDBO(I,K) = BO(I)
        DO 5 J = 1, 3
          MDAT(I,J,K) = AT(I,J)
    5   CONTINUE
   10 CONTINUE
      MDON(K) = 1
      IF (MDS2(K) .LT. MDS1(K)) RETURN
      DO 60 IS = MDS1(K), MDS2(K)
        DO 40 J = 1, NLV(IS)
          DO 30 I = 1, 3
            V(I) = (LMV(I,J,IS) - BO(I)) * 1.0D-3
   30     CONTINUE
          CALL MXV(AT, V, W)
          DO 35 I = 1, 3
            LWV(I,J,IS) = P(I) + W(I)
   35     CONTINUE
   40   CONTINUE
        LINS(IS) = 1
        DO 50 J = 1, NLF(IS)
          CALL MXV(AT, LMN(1,J,IS), W)
          DO 45 I = 1, 3
            LWN(I,J,IS) = W(I)
   45     CONTINUE
          LWD(J,IS) = (LMD(J,IS) - LMN(1,J,IS) * BO(1)
     &      - LMN(2,J,IS) * BO(2) - LMN(3,J,IS) * BO(3)) * 1.0D-3
     &      + W(1) * P(1) + W(2) * P(2) + W(3) * P(3)
          IF (LWD(J,IS) .LE. 0.0D0) LINS(IS) = 0
   50   CONTINUE
C       An outline model's solids hide nothing (MDHL = 0).
        IF (MDHL(K) .EQ. 0) GO TO 60
        LACT(IS) = 1
        NACT = NACT + 1
   60 CONTINUE
      RETURN
      END
C
C     MDRALL: draw every placed model, then their labels and the
C     markers of vehicles too small to see (VLABEL).
      SUBROUTINE MDRALL(GET, VB, NV, SB, NS, LB, NL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION GET, VB(5,MAXV), SB(3,MAXS), LB(4,MAXL)
      INTEGER NV, NS, NL
      INTEGER K
      DO 10 K = 1, NMOD
        IF (MDON(K) .EQ. 1) CALL MDRAW(VB, NV, K)
   10 CONTINUE
      ISTYLE = 1
C     Vehicle labels and markers, with a label level set (lvlab.f).
      IF (ILABL .GE. 1) CALL VLABEL(GET, VB, NV, LB, NL)
      RETURN
      END
C
C     MDRAW: draw placed model K: solid edges, then free lines and
C     face marks, each against every placed solid.
      SUBROUTINE MDRAW(VB, NV, K)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV)
      INTEGER NV, K
      DOUBLE PRECISION V(3), W(3), A(3), B(3)
      INTEGER I, J, L, IS, IH
C     Solid edges.  Hidden when both faces are turned away, unless
C     the camera is inside the solid.
      IF (MDS2(K) .LT. MDS1(K)) GO TO 90
      DO 80 IS = MDS1(K), MDS2(K)
        DO 70 J = 1, NLE(IS)
          DO 65 I = 1, 3
            A(I) = LWV(I,LME(1,J,IS),IS)
            B(I) = LWV(I,LME(2,J,IS),IS)
   65     CONTINUE
          IH = 0
          IF (LWD(LME(3,J,IS),IS) .GE. 0.0D0 .AND.
     &        LWD(LME(4,J,IS),IS) .GE. 0.0D0) IH = 1
          IF (LINS(IS) .EQ. 1) IH = 0
C         An outline model (MDHL = 0): every edge, nothing hidden.
          IF (MDHL(K) .EQ. 0) GO TO 68
          CALL LMSEG(VB, NV, A, B, IS, IH)
          GO TO 70
   68     ISTYLE = 1
          CALL MSEG(VB, NV, A, B)
   70   CONTINUE
   80 CONTINUE
C     Free lines and face marks.
   90 IF (MDX2(K) .LT. MDX1(K)) RETURN
      DO 100 J = MDX1(K), MDX2(K)
        DO 85 L = 0, 1
          DO 82 I = 1, 3
            V(I) = (LXL(I + 3 * L, J) - MDBO(I,K)) * 1.0D-3
   82     CONTINUE
          CALL MXV(MDAT(1,1,K), V, W)
          DO 84 I = 1, 3
            IF (L .EQ. 0) A(I) = MDP(I,K) + W(I)
            IF (L .EQ. 1) B(I) = MDP(I,K) + W(I)
   84     CONTINUE
   85   CONTINUE
        IS = LXS(J)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (IS .GT. 0) THEN
          IF (LWD(LXF(J),IS) .GE. 0.0D0 .AND. LINS(IS) .EQ. 0)
     &      GO TO 100
        END IF
C     RESTOMOD END
        IF (MDHL(K) .EQ. 0) GO TO 95
        CALL LMSEG(VB, NV, A, B, IS, 0)
        GO TO 100
   95   ISTYLE = 1
        CALL MSEG(VB, NV, A, B)
  100 CONTINUE
      ISTYLE = 1
      RETURN
      END
C
C     LMSEG: edge A-B of solid IS (0 for a free line) in 12 pieces,
C     each tested against the other solids.  IHID = 1: the whole edge
C     is known hidden.
      SUBROUTINE LMSEG(VB, NV, A, B, IS, IHID)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), A(3), B(3)
      INTEGER NV, IS, IHID
      DOUBLE PRECISION P0(3), P1(3), M(3), F0, F1
      INTEGER I, K, NP, IV, IV0, LMOCC
      INTEGER IDSH
      NP = 12
      IDSH = MOD(IFLG / 4, 2)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (IHID .EQ. 1) THEN
        IF (IDSH .EQ. 1) THEN
          ISTYLE = 2
          CALL MSEG(VB, NV, A, B)
          ISTYLE = 1
        END IF
        RETURN
      END IF
C     RESTOMOD END
C     Runs of equal visibility are merged into one vector.
      IV0 = -1
      DO 30 K = 1, NP
        F0 = DBLE(K - 1) / DBLE(NP)
        F1 = DBLE(K) / DBLE(NP)
        DO 10 I = 1, 3
          M(I) = A(I) + 0.5D0 * (F0 + F1) * (B(I) - A(I))
   10   CONTINUE
        IV = 1 - LMOCC(M, IS)
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
        IF (IV .NE. IV0) THEN
          IF (IV0 .GE. 0) CALL LMRUN(VB, NV, P0, P1, IV0, IDSH)
          DO 15 I = 1, 3
            P0(I) = A(I) + F0 * (B(I) - A(I))
   15     CONTINUE
          IV0 = IV
        END IF
C     RESTOMOD END
        DO 20 I = 1, 3
          P1(I) = A(I) + F1 * (B(I) - A(I))
   20   CONTINUE
   30 CONTINUE
      CALL LMRUN(VB, NV, P0, P1, IV0, IDSH)
      RETURN
      END
C
      SUBROUTINE LMRUN(VB, NV, P0, P1, IV, IDSH)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION VB(5,MAXV), P0(3), P1(3)
      INTEGER NV, IV, IDSH
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (IV .EQ. 1) THEN
        ISTYLE = 1
        CALL MSEG(VB, NV, P0, P1)
      ELSE IF (IDSH .EQ. 1) THEN
        ISTYLE = 2
        CALL MSEG(VB, NV, P0, P1)
        ISTYLE = 1
      END IF
C     RESTOMOD END
      RETURN
      END
C
C     LMOCC: 1 if the sight line to P passes through a placed solid
C     other than IS (Cyrus-Beck against the face planes).  Solids with
C     the camera inside do not count (MPLACE).
      INTEGER FUNCTION LMOCC(P, IS)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION P(3), T0, T1, DEN, T
      INTEGER IS, K, J
C     RESTOMOD BEGIN: Cyrus-Beck ray/convex test, published 1978
      LMOCC = 0
      DO 20 K = 1, NSOL
        IF (K .EQ. IS) GO TO 20
        IF (LACT(K) .EQ. 0 .OR. LINS(K) .EQ. 1) GO TO 20
        T0 = 0.0D0
        T1 = 0.999D0
        DO 10 J = 1, NLF(K)
          DEN = LWN(1,J,K)*P(1) + LWN(2,J,K)*P(2) + LWN(3,J,K)*P(3)
          IF (DEN .EQ. 0.0D0) THEN
            IF (LWD(J,K) .LT. 0.0D0) GO TO 20
          ELSE
            T = LWD(J,K) / DEN
            IF (DEN .GT. 0.0D0) THEN
              IF (T .LT. T1) T1 = T
            ELSE
              IF (T .GT. T0) T0 = T
            END IF
          END IF
          IF (T0 .GE. T1) GO TO 20
   10   CONTINUE
        LMOCC = 1
        RETURN
   20 CONTINUE
C     RESTOMOD END
      RETURN
      END
C
C-----------------------------------------------------------------------
C     STKPL: place the docked CSM and LM.  AT: the CSM's body axes in
C     EQ; P (km, camera relative): where the centre of the CM's base
C     is.  The LM (model KL: KLMD gear down, KLMS stowed) faces it,
C     its X axis against the CSM's and its Z axis along the CSM's (a
C     half turn about Z; the roll between them is ours), tunnel top
C     to tunnel top on the CSM's axis.  The two tunnels' tops meet at
C     the CSM tunnel's top, 10 ft 7 in above the CM's base (CSMBLD).
C-----------------------------------------------------------------------
      SUBROUTINE STKPL(AT, P, KL)
C     RESTOMOD BEGIN: file INCLUDE; FORTRAN V's named PDP elements
      INCLUDE 'viewdims.inc'
      INCLUDE 'viewcom.inc'
C     RESTOMOD END
      DOUBLE PRECISION AT(3,3), P(3), AL(3,3), PL(3), BO(3), Z(3)
      INTEGER KL, I
      CALL SETV(Z, 0.0D0, 0.0D0, 0.0D0)
      CALL MPLACE(KCSM, AT, P, Z)
      DO 10 I = 1, 3
        AL(I,1) = -AT(I,1)
        AL(I,2) = -AT(I,2)
        AL(I,3) = AT(I,3)
        PL(I) = P(I) + (10.0D0 + 7.0D0 / 12.0D0) * 0.3048D-3 * AT(I,1)
   10 CONTINUE
      CALL SETV(BO, 4.51D0, 0.0D0, 0.0D0)
      CALL MPLACE(KL, AL, PL, BO)
      RETURN
      END

