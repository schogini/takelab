import base64
import json
import os
import shlex
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from launch import WorkspaceServer


class TerminalTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.folder = self.root / 'demo folder'
        self.folder.mkdir()
        (self.folder / 'hello.py').write_text('import os\nprint("RUN_OK:" + os.getcwd())\n')
        self.environment = patch.dict(os.environ, {'SHELL': '/bin/sh'})
        self.environment.start()
        self.server = WorkspaceServer(('127.0.0.1', 0), self.root)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f'http://127.0.0.1:{self.server.server_port}'

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.environment.stop()
        self.temp.cleanup()

    def request(self, route, body=None, authorized=True, headers=None):
        request_headers = {'Content-Type': 'application/json'}
        if authorized:
            request_headers['X-Preview-Token'] = self.server.token
        request_headers.update(headers or {})
        data = json.dumps(body).encode() if body is not None else None
        with urlopen(Request(self.url + '/api/terminal/' + route, data=data, headers=request_headers)) as response:
            return json.load(response)

    def start(self, path='demo folder'):
        return self.request('start', {'path': path, 'cols': 80, 'rows': 24})

    def write(self, session, content):
        self.request('input', {'id': session['id'], 'data': base64.b64encode(content).decode()})

    def wait_for(self, session, expected, timeout=5):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            data = self.request('output?id=' + session['id'])
            output = base64.b64decode(data['data'])
            if expected in output:
                return output
            time.sleep(.03)
        self.fail(f'Terminal never produced {expected!r}; last output: {output!r}')

    def assert_http_error(self, code, route, body=None, **kwargs):
        with self.assertRaises(HTTPError) as caught:
            self.request(route, body, **kwargs)
        self.assertEqual(caught.exception.code, code)
        caught.exception.close()

    def test_real_tty_correct_pwd_and_script_execution(self):
        session = self.start()
        self.assertEqual(session['cwd'], str(self.folder))
        self.write(session, b'test -t 0 && test -t 1 && printf "\\nTTY_OK\\n"\n')
        self.wait_for(session, b'\r\nTTY_OK\r\n')
        self.write(session, b'printf "\\nDEMO_PWD=%s\\n" "$PWD"\n')
        self.wait_for(session, ('\r\nDEMO_PWD=' + str(self.folder) + '\r\n').encode())
        self.write(session, (shlex.quote(sys.executable) + ' hello.py\n').encode())
        self.wait_for(session, ('\r\nRUN_OK:' + str(self.folder) + '\r\n').encode())

    def test_resize_and_ctrl_c_interrupt_foreground_job(self):
        session = self.start()
        self.request('resize', {'id': session['id'], 'cols': 67, 'rows': 19})
        self.write(session, b'printf "\\nSIZE="; stty size\n')
        self.wait_for(session, b'\r\nSIZE=19 67\r\n')
        command = shlex.quote(sys.executable) + ' -c ' + shlex.quote('import time; print("JOB_READY", flush=True); time.sleep(30)') + '\n'
        self.write(session, command.encode())
        self.wait_for(session, b'\r\nJOB_READY\r\n')
        self.write(session, b'\x03')
        self.write(session, b'printf "\\nINTERRUPT_OK\\n"\n')
        self.wait_for(session, b'\r\nINTERRUPT_OK\r\n')
        self.assertIsNone(self.server.terminals.get(session['id']).process.poll())

    def test_terminal_endpoints_require_token_and_same_origin(self):
        self.assert_http_error(403, 'start', {'path': ''}, authorized=False)
        self.assert_http_error(403, 'output?id=missing', authorized=False)
        self.assert_http_error(403, 'start', {'path': ''}, headers={'Origin': 'https://elsewhere.example'})
        self.assert_http_error(403, 'start', {'path': ''}, headers={'Host': 'elsewhere.example'})
        self.assertFalse(self.server.terminals.sessions)
        self.assert_http_error(403, 'start', {'path': '..'})
        self.assertFalse(self.server.terminals.sessions)

    def test_input_validation_output_cursors_and_stop(self):
        session = self.start()
        self.assert_http_error(400, 'input', {'id': session['id'], 'data': '!not-base64'})
        self.write(session, b'printf "\\nCURSOR_TEST\\n"\n')
        self.wait_for(session, b'\r\nCURSOR_TEST\r\n')
        first = self.request('output?id=' + session['id'])
        next_output = self.request('output?id=' + session['id'] + '&after=' + str(first['cursor']))
        self.assertNotIn(b'CURSOR_TEST', base64.b64decode(next_output['data']))
        process = self.server.terminals.get(session['id']).process
        self.request('stop', {'id': session['id']})
        self.assertIsNotNone(process.poll())
        self.assert_http_error(404, 'output?id=' + session['id'])

    def test_server_close_stops_shell(self):
        session = self.start()
        process = self.server.terminals.get(session['id']).process
        self.server.terminals.close()
        self.assertIsNotNone(process.poll())
        self.assertFalse(self.server.terminals.sessions)

    def test_independent_sessions_and_closing_one_keeps_other_running(self):
        first = self.start()
        second = self.start('')
        self.write(first, b'export TELEPROMPT_TEST=one\n')
        self.write(first, b'printf "\\nFIRST=%s\\n" "$TELEPROMPT_TEST"\n')
        self.wait_for(first, b'\r\nFIRST=one\r\n')
        self.write(second, b'printf "\\nSECOND=%s\\n" "${TELEPROMPT_TEST:-independent}"\n')
        self.wait_for(second, b'\r\nSECOND=independent\r\n')
        self.request('stop', {'id': second['id']})
        self.write(first, b'printf "\\nSTILL_RUNNING\\n"\n')
        self.wait_for(first, b'\r\nSTILL_RUNNING\r\n')

    def test_hangup_signal_permission_race_does_not_fail_close(self):
        session = self.start()
        process = self.server.terminals.get(session['id']).process
        self.wait_for(session, b'$')
        with patch('terminal_backend.os.killpg', side_effect=PermissionError()):
            self.request('stop', {'id': session['id']})
        self.assertIsNotNone(process.poll())
