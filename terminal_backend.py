"""Local POSIX pseudo-terminal sessions for the workspace (macOS / Linux)."""
import base64
import fcntl
import os
import pty
import secrets
import select
import signal
import struct
import subprocess
import sys
import termios
import threading
import time
from pathlib import Path

MAX_OUTPUT = 1024 * 1024


class TerminalSession:
    def __init__(self, cwd, cols=80, rows=24, shell=None):
        self.cwd = str(cwd)
        self.id = secrets.token_urlsafe(24)
        self.lock = threading.Lock()
        self.io_lock = threading.Lock()
        self.output = bytearray()
        self.base = 0
        self.ended = False
        self.closed = threading.Event()
        self.master, slave = pty.openpty()
        try:
            self.resize(cols, rows)
            shell = shell or os.environ.get('SHELL') or '/bin/zsh'
            if not Path(shell).is_file() or not os.access(shell, os.X_OK):
                shell = '/bin/bash'
            env = dict(os.environ, TERM='xterm-256color', COLORTERM='truecolor', PWD=self.cwd)
            self.process = subprocess.Popen(
                [sys.executable, str(Path(__file__).with_name('terminal_shell.py')), shell],
                stdin=slave, stdout=slave, stderr=slave, cwd=self.cwd, env=env,
                start_new_session=True, close_fds=True,
            )
            os.set_blocking(self.master, False)
        except BaseException:
            os.close(self.master)
            raise
        finally:
            os.close(slave)
        self.reader = threading.Thread(target=self._read, daemon=True)
        self.reader.start()

    def _read(self):
        try:
            while not self.closed.is_set():
                ready, _, _ = select.select([self.master], [], [], .1)
                if not ready:
                    continue
                with self.io_lock:
                    if self.closed.is_set():
                        break
                    try:
                        data = os.read(self.master, 65536)
                    except BlockingIOError:
                        continue
                if not data:
                    break
                with self.lock:
                    self.output.extend(data)
                    if len(self.output) > MAX_OUTPUT:
                        count = len(self.output) - MAX_OUTPUT
                        del self.output[:count]
                        self.base += count
        except (OSError, ValueError):
            pass  # PTYs report EIO when their shell exits.
        finally:
            with self.lock:
                self.ended = True

    def read(self, after):
        with self.lock:
            reset = after < self.base or after > self.base + len(self.output)
            start = self.base if reset else after
            data = bytes(self.output[start - self.base:start - self.base + 65536])
            cursor = start + len(data)
            return {'data': base64.b64encode(data).decode(), 'cursor': cursor,
                    'trimmed': reset, 'ended': self.ended and cursor == self.base + len(self.output),
                    'exit_code': self.process.poll(), 'cwd': self.cwd}

    def write(self, data):
        with self.io_lock:
            if self.closed.is_set() or self.process.poll() is not None:
                raise ValueError('This terminal has exited. Start a new terminal.')
            deadline = time.monotonic() + 2
            while data:
                remaining = deadline - time.monotonic()
                if remaining <= 0 or not select.select([], [self.master], [], remaining)[1]:
                    raise ValueError('Terminal input is busy. Try a smaller paste.')
                try:
                    count = os.write(self.master, data)
                    data = data[count:]
                except BlockingIOError:
                    continue

    def resize(self, cols, rows):
        cols, rows = max(10, min(500, int(cols))), max(2, min(200, int(rows)))
        with self.io_lock:
            if self.closed.is_set():
                raise ValueError('Terminal is closed.')
            fcntl.ioctl(self.master, termios.TIOCSWINSZ, struct.pack('HHHH', rows, cols, 0, 0))

    def stop(self):
        if self.closed.is_set():
            return
        self.closed.set()
        with self.io_lock:
            os.close(self.master)  # Hang up the controlling terminal / foreground job.
        if self.process.poll() is None:
            try:
                os.killpg(self.process.pid, signal.SIGHUP)
            except (ProcessLookupError, PermissionError):
                # Closing the PTY already hangs up its foreground job. On macOS,
                # killpg can race with that exit and report EPERM instead of ESRCH.
                pass
        try:
            self.process.wait(timeout=1.5)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(self.process.pid, signal.SIGKILL)
            except PermissionError:
                try:
                    self.process.kill()  # Fall back to signaling our owned child.
                except ProcessLookupError:
                    pass
            except ProcessLookupError:
                pass
            self.process.wait()
        self.reader.join(timeout=.5)


class TerminalManager:
    def __init__(self):
        self.sessions = {}
        self.lock = threading.Lock()

    def start(self, cwd, cols=80, rows=24, shell=None):
        with self.lock:
            for key, session in list(self.sessions.items()):
                if session.process.poll() is not None:
                    session.stop()
                    del self.sessions[key]
            if len(self.sessions) >= 4:
                raise ValueError('Four terminals are already open. End an existing terminal first.')
            session = TerminalSession(cwd, cols, rows, shell)
            self.sessions[session.id] = session
            return session

    def get(self, session_id):
        with self.lock:
            if session_id not in self.sessions:
                raise KeyError('Terminal session no longer exists. Start a new terminal.')
            return self.sessions[session_id]

    def stop(self, session_id):
        with self.lock:
            session = self.sessions.pop(session_id, None)
        if session:
            session.stop()

    def close(self):
        with self.lock:
            sessions = list(self.sessions.values())
            self.sessions.clear()
        for session in sessions:
            session.stop()
