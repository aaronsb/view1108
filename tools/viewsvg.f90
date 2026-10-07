! Native check driver: render one VIEW-1108 frame to SVG on stdout.
!
!   viewsvg SCENE [GET|-] [YAW PITCH ROLL FOV] [FLAGS]
!
! GET in seconds from lift-off, "-" for the scene default.  Angles in
! degrees; FOV "-" keeps the default.  FLAGS as in_flags (default 3:
! labels and plot frame; add 4 for dashed hidden lines).
! With VIEW_TIME set in the environment, also times 200 frames and
! prints the mean to stderr.  With VIEW_SIM=n, runs the engine first
! (sim_run flags n: bit 0 correction on); add 8 to FLAGS to draw from
! the tape.  VIEW_VIEW, VIEW_TARGET and VIEW_LABLV set in_view,
! in_target and in_lablv (default 0).  With VIEW_HDR set, prints
! hdr(1..24) to stderr.  With VIEW_DUMP set, writes the run tables
! (tools/vdump.f: every scenario-specific COMMON table's used entries,
! doubles as hex bit patterns) to stdout instead and stops.
! With VIEW_DECK set to deck paths separated by colons, the kernel's
! card reader (src/vdeck.f) loads them, in that order, over the BLOCK
! DATA tables first; a deck error is printed to stderr and stops the
! run (exit 2).  With VIEW_DKSUM set, prints the run tables' hash
! total (CRDSUM, four numbers) to stdout and stops.
program viewsvg
  implicit none
  integer, parameter :: MAXV = 60000, MAXS = 4000, MAXL = 200
  double precision :: vb(5, MAXV), sb(3, MAXS), lb(4, MAXL), hd(24), tb(4, 300)
  integer :: tc(6000), nt, nch, j, j0
  character(len=64) :: txt
  double precision :: get, yaw, pit, rol, fov, b, s, r
  integer :: isc, iflag, nv, ns, nl, i, na, k, c0, c1, crate
  character(len=64) :: arg
  character(len=16) :: tv
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
    subroutine simrun(ifl)
      integer :: ifl
    end subroutine simrun
    subroutine vsetin(iv, it, il)
      integer :: iv, it, il
    end subroutine vsetin
    subroutine vdump()
    end subroutine vdump
    subroutine crdopn()
    end subroutine crdopn
    subroutine crdin(ic, nc)
      integer :: ic(1024), nc
    end subroutine crdin
    subroutine crdend(ierr, icard, nwarn)
      integer :: ierr, icard, nwarn
    end subroutine crdend
    subroutine crdsum(isum)
      integer :: isum(4)
    end subroutine crdsum
  end interface
  character(len=4096) :: decks
  integer :: isum(4)

  call get_environment_variable('VIEW_DECK', decks)
  if (len_trim(decks) > 0) call loaddk(trim(decks))
  call get_environment_variable('VIEW_DKSUM', tv)
  if (len_trim(tv) > 0) then
    call crdsum(isum)
    write (*, '(4(i0,1x))') isum
    stop
  end if

  call get_environment_variable('VIEW_DUMP', tv)
  if (len_trim(tv) > 0) then
    call vdump()
    stop
  end if

  na = command_argument_count()
  isc = 1
  if (na >= 1) then
    call get_command_argument(1, arg)
    read (arg, *) isc
  end if
  call vinit(isc, get, yaw, pit, rol, fov)
  if (na >= 2) then
    call get_command_argument(2, arg)
    if (trim(arg) /= '-') read (arg, *) get
  end if
  if (na >= 6) then
    call get_command_argument(3, arg); read (arg, *) yaw
    call get_command_argument(4, arg); read (arg, *) pit
    call get_command_argument(5, arg); read (arg, *) rol
    call get_command_argument(6, arg)
    if (trim(arg) /= '-') read (arg, *) fov
  end if
  iflag = 3
  if (na >= 7) then
    call get_command_argument(7, arg); read (arg, *) iflag
  end if

  call get_environment_variable('VIEW_SIM', tv)
  if (len_trim(tv) > 0) then
    read (tv, *) k
    call simrun(k)
  end if

  call vsetin(envint('VIEW_VIEW'), envint('VIEW_TARGET'), envint('VIEW_LABLV'))
  call vframe(get, yaw, pit, rol, fov, iflag, vb, nv, sb, ns, lb, nl, hd, tb, nt, tc, nch)

  call get_environment_variable('VIEW_HDR', tv)
  if (len_trim(tv) > 0) then
    do k = 1, 24
      write (0, '(a,i0,a,es24.15)') 'hdr(', k, ') = ', hd(k)
    end do
  end if

  call get_environment_variable('VIEW_TIME', tv)
  if (len_trim(tv) > 0) then
    call system_clock(c0, crate)
    do k = 1, 200
      call vframe(get, yaw, pit, rol, fov, iflag, vb, nv, sb, ns, lb, nl, hd, tb, nt, tc, nch)
    end do
    call system_clock(c1)
    write (0, '(a,i0,a,f8.3,a,i0,a,i0)') 'scene ', isc, ': ', &
      1000.0d0 * dble(c1 - c0) / dble(crate) / 200.0d0, ' ms/frame  nvec ', &
      nv, '  nstar ', ns
  end if

  b = hd(15)
  if (b <= 0d0) b = 0.5d0 * fov
  s = 400.0d0 / b
  write (*, '(a)') '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="-40 -10 880 850">'
  write (*, '(a)') '<rect x="-40" y="-10" width="880" height="850" fill="black"/>'
  write (*, '(a)') '<g stroke="white" stroke-width="1.6" fill="none" stroke-linecap="round">'
  do i = 1, nv
    if (vb(5, i) > 1.5d0) then
      write (*, '(a,4(f0.2,a))') '<line stroke-dasharray="6 5" x1="', px(vb(1, i)), '" y1="', &
        py(vb(2, i)), '" x2="', px(vb(3, i)), '" y2="', py(vb(4, i)), '"/>'
    else
      write (*, '(a,4(f0.2,a))') '<line x1="', px(vb(1, i)), '" y1="', py(vb(2, i)), &
        '" x2="', px(vb(3, i)), '" y2="', py(vb(4, i)), '"/>'
    end if
  end do
  write (*, '(a)') '</g><g fill="white">'
  do i = 1, ns
    r = max(0.8d0, 3.2d0 - 0.45d0 * sb(3, i))
    write (*, '(a,3(f0.2,a))') '<circle cx="', px(sb(1, i)), '" cy="', py(sb(2, i)), &
      '" r="', r, '"/>'
  end do
  write (*, '(a)') '</g><g fill="#9cf" font-family="monospace" font-size="11">'
  do i = 1, nl
    write (*, '(a,2(f0.2,a),i0,a,i0,a)') '<text x="', px(lb(1, i)) + 4, '" y="', &
      py(lb(2, i)) - 4, '">', nint(lb(3, i)), ':', nint(lb(4, i)), '</text>'
  end do
  write (*, '(a)') '</g><g fill="white" font-family="monospace">'
  do i = 1, nt
    j0 = nint(tb(4, i))
    txt = ''
    do j = j0, j0 + 60
      if (tc(j) == 0) exit
      txt(j - j0 + 1:j - j0 + 1) = achar(tc(j))
    end do
    write (*, '(a,3(f0.2,a),a,a)') '<text x="', px(tb(1, i)), '" y="', py(tb(2, i)), &
      '" font-size="', tb(3, i) * s * 1.35d0, '">', trim(txt), '</text>'
  end do
  write (*, '(a)') '</g><g fill="#fc6" font-family="monospace" font-size="13">'
  write (*, '(a,i0,a,f0.1,a,f0.1,a,f0.1,a,f0.1,a,f0.0,a,i0)') '<text x="8" y="16">scene ', &
    nint(hd(7)), '  GET ', hd(1) / 3600.0d0, ' h  FOV ', hd(2), '  range ', hd(3), &
    ' nmi  alt ', hd(4), ' smi  v ', hd(5), ' ft/s  nvec ', nv
  if (hd(17) > 0d0) write (*, '(a,i0,a,f0.1,a,f0.1,a,f0.1)') '  source ', nint(hd(17)), &
    '  err ', hd(18), ' km ', hd(19), ' ft/s at ', hd(20)
  write (*, '(a)') '</text></g></svg>'

contains

  ! The decks named in list (paths separated by colons) through the card
  ! reader, one line a card.
  subroutine loaddk(list)
    character(len=*), intent(in) :: list
    character(len=2048) :: line
    integer :: ic(1024), i0, i1, u, ios, n, k, ierr, icard, nwarn
    call crdopn()
    i0 = 1
    do while (i0 <= len(list))
      i1 = index(list(i0:), ':')
      if (i1 == 0) then
        i1 = len(list) + 1
      else
        i1 = i0 + i1 - 1
      end if
      open (newunit=u, file=list(i0:i1 - 1), status='old', action='read', iostat=ios)
      if (ios /= 0) then
        write (0, '(a,a)') 'VIEW_DECK: cannot open ', list(i0:i1 - 1)
        stop 2
      end if
      do
        read (u, '(a)', iostat=ios) line
        if (ios /= 0) exit
        n = len_trim(line)
        do k = 1, min(n, 1024)
          ic(k) = iachar(line(k:k))
        end do
        call crdin(ic, n)
      end do
      close (u)
      i0 = i1 + 1
    end do
    call crdend(ierr, icard, nwarn)
    if (ierr /= 0) then
      write (0, '(a,i2.2,a,i0)') 'DECK ERROR ', ierr, ' CARD ', icard
      stop 2
    end if
  end subroutine loaddk

  integer function envint(name)
    character(len=*), intent(in) :: name
    character(len=16) :: v
    envint = 0
    call get_environment_variable(name, v)
    if (len_trim(v) > 0) read (v, *) envint
  end function envint

  double precision function px(x)
    double precision, intent(in) :: x
    px = 400.0d0 + x * s
  end function px

  double precision function py(y)
    double precision, intent(in) :: y
    py = 400.0d0 - y * s
  end function py

end program viewsvg
