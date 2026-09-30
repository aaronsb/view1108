! VIEW-1108 chassis.  Modern Fortran that the 1108 never had: C-bound
! globals and entry points so a WebAssembly host (the page) can drive the
! kernel.  All geometry lives in the kernel elements (src/*.f); this file only moves numbers.
!
! Exports (see CLAUDE.md, "Interface contract"):
!   view_init(scene), view_frame(), sim_run(flags)
!   in_get, in_yaw, in_pitch, in_roll, in_fov, in_flags, in_src,
!   in_view, in_target, in_lablv
!   vbuf, nvec, sbuf, nstar, lbuf, nlab, hdr, tbuf, ntxt, tchr, nchr
module view_shell
  use iso_c_binding, only: c_double, c_int
  implicit none
  integer, parameter :: MAXV = 60000, MAXS = 4000, MAXL = 200, MAXT = 300, MAXTC = 6000

  real(c_double), bind(c, name="in_get")   :: in_get = 0
  real(c_double), bind(c, name="in_yaw")   :: in_yaw = 0
  real(c_double), bind(c, name="in_pitch") :: in_pitch = 0
  real(c_double), bind(c, name="in_roll")  :: in_roll = 0
  real(c_double), bind(c, name="in_fov")   :: in_fov = 8
  integer(c_int), bind(c, name="in_flags") :: in_flags = 0
  ! State source: 0 replay, 1 the tape the engine wrote (sim_run).  The
  ! kernel takes it as in_flags bit 3.
  integer(c_int), bind(c, name="in_src") :: in_src = 0
  ! View (0 window, 1 external, 2 CM station, 3 LM station), camera
  ! target (0 default, 1 Earth, 2 Moon, 3 Sun, 4 CSM, 5 LM), label level
  ! (0-3; 0 leaves in_flags bit 0 in charge).  See CLAUDE.md.
  integer(c_int), bind(c, name="in_view") :: in_view = 0
  integer(c_int), bind(c, name="in_target") :: in_target = 0
  integer(c_int), bind(c, name="in_lablv") :: in_lablv = 0

  real(c_double), bind(c, name="vbuf") :: vbuf(5, MAXV)
  integer(c_int), bind(c, name="nvec") :: nvec = 0
  real(c_double), bind(c, name="sbuf") :: sbuf(3, MAXS)
  integer(c_int), bind(c, name="nstar") :: nstar = 0
  real(c_double), bind(c, name="lbuf") :: lbuf(4, MAXL)
  integer(c_int), bind(c, name="nlab") :: nlab = 0
  real(c_double), bind(c, name="hdr") :: hdr(24)
  real(c_double), bind(c, name="tbuf") :: tbuf(4, MAXT)
  integer(c_int), bind(c, name="ntxt") :: ntxt = 0
  integer(c_int), bind(c, name="tchr") :: tchr(MAXTC)
  integer(c_int), bind(c, name="nchr") :: nchr = 0

  interface
    subroutine vinit(isc, get, yaw, pit, rol, fov)
      integer :: isc
      double precision :: get, yaw, pit, rol, fov
    end subroutine vinit
    subroutine vframe(get, yaw, pit, rol, fov, iflag, vb, nv, sb, ns, &
                      lb, nl, hd, tb, nt, tc, nch)
      double precision :: get, yaw, pit, rol, fov
      integer :: iflag, nv, ns, nl, nt, nch
      double precision :: vb(5, 60000), sb(3, 4000), lb(4, 200), hd(24)
      double precision :: tb(4, 300)
      integer :: tc(6000)
    end subroutine vframe
    subroutine vsetin(iview, itarg, ilabl)
      integer :: iview, itarg, ilabl
    end subroutine vsetin
    subroutine simrun(ifl)
      integer :: ifl
    end subroutine simrun
  end interface

contains

  subroutine view_init(scene) bind(c, name="view_init")
    integer(c_int), value :: scene
    integer :: isc
    double precision :: get, yaw, pit, rol, fov
    isc = scene
    call vinit(isc, get, yaw, pit, rol, fov)
    in_get = get
    in_yaw = yaw
    in_pitch = pit
    in_roll = rol
    in_fov = fov
  end subroutine view_init

  subroutine view_frame() bind(c, name="view_frame")
    integer :: iflag, nv, ns, nl, nt, nch, iv, it, il
    double precision :: get, yaw, pit, rol, fov
    get = in_get
    yaw = in_yaw
    pit = in_pitch
    rol = in_roll
    fov = in_fov
    iflag = in_flags
    if (in_src == 1 .and. mod(iflag / 8, 2) == 0) iflag = iflag + 8
    iv = in_view
    it = in_target
    il = in_lablv
    call vsetin(iv, it, il)
    call vframe(get, yaw, pit, rol, fov, iflag, vbuf, nv, sbuf, ns, &
                lbuf, nl, hdr, tbuf, nt, tchr, nch)
    ntxt = nt
    nchr = nch
    nvec = nv
    nstar = ns
    nlab = nl
  end subroutine view_frame

  ! Run the engine over the current scenario and fill the tape; flags
  ! bit 0 = delta correction on.
  subroutine sim_run(flags) bind(c, name="sim_run")
    integer(c_int), value :: flags
    integer :: ifl
    ifl = flags
    call simrun(ifl)
  end subroutine sim_run

end module view_shell
