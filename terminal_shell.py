#!/usr/bin/env python3
"""Give the spawned session its controlling terminal, then replace it with a shell."""
import fcntl
import os
import sys
import termios

if __name__ == '__main__':
    fcntl.ioctl(0, termios.TIOCSCTTY, 0)
    os.execv(sys.argv[1], [sys.argv[1], '-i'])
