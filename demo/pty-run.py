#!/usr/bin/env python3
"""Run a command on a real pty of a known size.

Two problems this solves, both found while recording the tour:

1. asciinema records in "headless mode" with no controlling terminal, and that
   mode does not carry wall-clock gaps: a tour with ~30s of deliberate pauses
   came out as a 3.6s cast, far too fast to read. `script -q` is the usual fix
   but cannot allocate a pty in every sandbox.
2. A bare pty has a 0x0 window, which asciinema faithfully records and `agg`
   then refuses with "invalid terminal size: 0x0". The size has to be set on the
   pty itself before the child starts.

Usage:  pty-run.py <cols> <rows> <command> [args...]
"""
import fcntl, os, pty, select, struct, sys, termios

cols, rows = int(sys.argv[1]), int(sys.argv[2])
argv = sys.argv[3:]

pid, fd = pty.fork()
if pid == 0:
    os.execvp(argv[0], argv)

# TIOCSWINSZ on the master before the child draws anything.
fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))

try:
    while True:
        ready, _, _ = select.select([fd], [], [], 0.2)
        if fd in ready:
            try:
                data = os.read(fd, 65536)
            except OSError:
                break
            if not data:
                break
            # Mirror to our stdout so progress stays visible.
            os.write(1, data)
        if os.waitpid(pid, os.WNOHANG)[0] == pid:
            break
except KeyboardInterrupt:
    pass

_, status = os.waitpid(pid, 0) if os.waitpid(pid, os.WNOHANG)[0] == 0 else (0, 0)
sys.exit(os.waitstatus_to_exitcode(status) if status else 0)
