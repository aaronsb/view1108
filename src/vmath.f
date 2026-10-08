C=======================================================================
C
C     V I E W - 1 1 0 8          VECTOR AND MATRIX
C
C     Core element.  3-vector and 3x3 utilities.  One relocatable
C     element of the kernel; see vdrive.f for the list.
C
C=======================================================================
C
      SUBROUTINE SETV(V, A, B, C)
      DOUBLE PRECISION V(3), A, B, C
      V(1) = A
      V(2) = B
      V(3) = C
      RETURN
      END
C
C=======================================================================
C     VECTOR AND MATRIX UTILITIES
C=======================================================================
      DOUBLE PRECISION FUNCTION VDOT(A, B)
      DOUBLE PRECISION A(3), B(3)
      VDOT = A(1) * B(1) + A(2) * B(2) + A(3) * B(3)
      RETURN
      END
C
      DOUBLE PRECISION FUNCTION VNRM(A)
      DOUBLE PRECISION A(3)
      VNRM = DSQRT(A(1) * A(1) + A(2) * A(2) + A(3) * A(3))
      RETURN
      END
C
      SUBROUTINE VCRS(A, B, C)
      DOUBLE PRECISION A(3), B(3), C(3)
      C(1) = A(2) * B(3) - A(3) * B(2)
      C(2) = A(3) * B(1) - A(1) * B(3)
      C(3) = A(1) * B(2) - A(2) * B(1)
      RETURN
      END
C
C     VORTH: B, a unit vector, made square to the unit vector A and
C     unit again (Gram-Schmidt); a B along A gives a perpendicular.  A
C     B already square to A within rounding (1.0D-12) is left as it
C     is, so a frame that was orthonormal stays bit for bit (ours).
      SUBROUTINE VORTH(A, B)
      DOUBLE PRECISION A(3), B(3), K, P(3), VDOT
      INTEGER I
      K = VDOT(A, B)
      IF (DABS(K) .LE. 1.0D-12) RETURN
      DO 10 I = 1, 3
        B(I) = B(I) - K * A(I)
   10 CONTINUE
      IF (VDOT(B, B) .LT. 1.0D-24) CALL PERP(A, B, P)
      CALL VUNIT(B)
      RETURN
      END
C
      SUBROUTINE VUNIT(A)
      DOUBLE PRECISION A(3), S
      S = DSQRT(A(1) * A(1) + A(2) * A(2) + A(3) * A(3))
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (S .GT. 0.0D0) THEN
        A(1) = A(1) / S
        A(2) = A(2) / S
        A(3) = A(3) / S
      END IF
C     RESTOMOD END
      RETURN
      END
C
C     MXV: B = M A.   MTXV: B = transpose(M) A.   MXM: C = A B.
      SUBROUTINE MXV(M, A, B)
      DOUBLE PRECISION M(3,3), A(3), B(3)
      INTEGER I
      DO 10 I = 1, 3
        B(I) = M(I,1) * A(1) + M(I,2) * A(2) + M(I,3) * A(3)
   10 CONTINUE
      RETURN
      END
C
      SUBROUTINE MTXV(M, A, B)
      DOUBLE PRECISION M(3,3), A(3), B(3)
      INTEGER I
      DO 10 I = 1, 3
        B(I) = M(1,I) * A(1) + M(2,I) * A(2) + M(3,I) * A(3)
   10 CONTINUE
      RETURN
      END
C
      SUBROUTINE MXM(A, B, C)
      DOUBLE PRECISION A(3,3), B(3,3), C(3,3)
      INTEGER I, J
      DO 20 J = 1, 3
        DO 10 I = 1, 3
          C(I,J) = A(I,1) * B(1,J) + A(I,2) * B(2,J) + A(I,3) * B(3,J)
   10   CONTINUE
   20 CONTINUE
      RETURN
      END
C
C     Active rotations by angle A (rad) about X, Y, Z.
      SUBROUTINE ROTX(A, M)
      DOUBLE PRECISION A, M(3,3)
      CALL MUNIT(M)
      M(2,2) = DCOS(A)
      M(2,3) = -DSIN(A)
      M(3,2) = DSIN(A)
      M(3,3) = DCOS(A)
      RETURN
      END
C
      SUBROUTINE ROTY(A, M)
      DOUBLE PRECISION A, M(3,3)
      CALL MUNIT(M)
      M(1,1) = DCOS(A)
      M(1,3) = DSIN(A)
      M(3,1) = -DSIN(A)
      M(3,3) = DCOS(A)
      RETURN
      END
C
      SUBROUTINE ROTZ(A, M)
      DOUBLE PRECISION A, M(3,3)
      CALL MUNIT(M)
      M(1,1) = DCOS(A)
      M(1,2) = -DSIN(A)
      M(2,1) = DSIN(A)
      M(2,2) = DCOS(A)
      RETURN
      END
C
      SUBROUTINE MUNIT(M)
      DOUBLE PRECISION M(3,3)
      INTEGER I, J
      DO 20 J = 1, 3
        DO 10 I = 1, 3
          M(I,J) = 0.0D0
   10   CONTINUE
        M(J,J) = 1.0D0
   20 CONTINUE
      RETURN
      END
C
C     PERP: unit vectors E1, E2 completing unit A to a right-handed set.
      SUBROUTINE PERP(A, E1, E2)
      DOUBLE PRECISION A(3), E1(3), E2(3), Z(3)
      Z(1) = 0.0D0
      Z(2) = 0.0D0
      Z(3) = 1.0D0
C     RESTOMOD BEGIN: block IF is FORTRAN 77 (1978)
      IF (DABS(A(3)) .GT. 0.9D0) THEN
        Z(1) = 1.0D0
        Z(3) = 0.0D0
      END IF
C     RESTOMOD END
      CALL VCRS(Z, A, E1)
      CALL VUNIT(E1)
      CALL VCRS(A, E1, E2)
      RETURN
      END
