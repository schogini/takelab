import hashlib
import io
import json
import os
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from preview import Handler, MAX_TEXT


class EditorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.path = self.root / 'demo.py'
        self.path.write_bytes(b'print("original")\r\n')
        self.server = SimpleNamespace(root=self.root, token='secret', server_port=1234, edit_lock=threading.Lock())

    def tearDown(self):
        self.temp.cleanup()

    def call(self, method='GET', route='/api/edit?path=demo.py', data=None, headers=None):
        handler = object.__new__(Handler)
        handler.server = self.server
        handler.path = route
        body = json.dumps(data).encode() if data is not None else b''
        handler.headers = {'Host': '127.0.0.1:1234', 'X-Preview-Token': 'secret', 'Content-Length': str(len(body)), **(headers or {})}
        handler.rfile = io.BytesIO(body)
        result = {}
        def send(value, mime='application/json', status=200, **kwargs):
            result.update(data=value, status=status)
        handler.send = send
        getattr(handler, 'do_' + method)()
        return result

    def save(self, edit, text, **kwargs):
        return self.call('POST', '/api/edit', {**edit['data'], 'text': text}, **kwargs)

    def test_edit_and_save_existing_script_preserves_crlf_and_executable_mode(self):
        self.path.chmod(0o755)
        edit = self.call()
        self.assertEqual(edit['status'], 200)
        self.assertEqual(edit['data']['text'], 'print("original")\n')
        saved = self.save(edit, 'print("updated")\n')
        self.assertEqual(saved['status'], 200)
        self.assertEqual(self.path.read_bytes(), b'print("updated")\r\n')
        self.assertEqual(self.path.stat().st_mode & 0o777, 0o755)
        self.assertFalse(list(self.root.glob('.teleprompt-edit-*')))

    def test_external_change_returns_conflict_and_keeps_external_contents(self):
        edit = self.call()
        self.path.write_text('external change\n')
        result = self.save(edit, 'my draft\n')
        self.assertEqual(result['status'], 409)
        self.assertEqual(self.path.read_text(), 'external change\n')

    def test_root_switch_cannot_save_to_another_folder(self):
        edit = self.call()
        with tempfile.TemporaryDirectory() as other:
            target = Path(other).resolve() / 'demo.py'
            target.write_text('other folder')
            self.server.root = target.parent
            self.assertEqual(self.save(edit, 'draft')['status'], 409)
            self.assertEqual(target.read_text(), 'other folder')

    def test_edit_routes_require_token_host_and_same_origin(self):
        edit = self.call()
        for headers in ({'X-Preview-Token': ''}, {'Host': 'evil.example'}, {'Origin': 'https://evil.example'}, {'Origin': 'null'}):
            self.assertEqual(self.call(headers=headers)['status'], 403)
            self.assertEqual(self.save(edit, 'bad', headers=headers)['status'], 403)
        self.assertEqual(self.path.read_bytes(), b'print("original")\r\n')

    def test_outside_paths_and_symlinks_are_rejected(self):
        with tempfile.TemporaryDirectory() as outside:
            target = Path(outside) / 'outside.txt'
            target.write_text('outside')
            (self.root / 'link.txt').symlink_to(target)
            self.assertEqual(self.call(route='/api/edit?path=link.txt')['status'], 403)
            data = {'root': str(self.root), 'path': str(target), 'revision': hashlib.sha256(b'outside').hexdigest(), 'text': 'changed'}
            self.assertEqual(self.call('POST', '/api/edit', data)['status'], 403)
            self.assertEqual(target.read_text(), 'outside')

    def test_bom_and_utf16_byte_order_are_preserved(self):
        for bom, encoding in ((b'\xef\xbb\xbf', 'utf-8'), (b'\xff\xfe', 'utf-16-le'), (b'\xfe\xff', 'utf-16-be')):
            self.path.write_bytes(bom + 'café\n'.encode(encoding))
            self.assertEqual(self.save(self.call(), 'hello 🌍\n')['status'], 200)
            self.assertEqual(self.path.read_bytes(), bom + 'hello 🌍\n'.encode(encoding))

    def test_binary_oversized_images_and_read_only_files_cannot_be_overwritten(self):
        self.path.write_bytes(b'\x00binary')
        self.assertEqual(self.call()['status'], 400)
        self.path.write_bytes(b'a' * (MAX_TEXT + 1))
        self.assertEqual(self.call()['status'], 400)
        self.path.write_bytes(b'normal')
        edit = self.call()
        self.assertEqual(self.save(edit, 'a' * (MAX_TEXT + 1))['status'], 400)
        self.path.chmod(0o444)
        self.assertEqual(self.save(edit, 'changed')['status'], 403)
        self.assertEqual(self.path.read_bytes(), b'normal')
        self.path.chmod(0o644)
        (self.root / 'picture.png').write_bytes(b'fake image')
        self.assertEqual(self.call(route='/api/edit?path=picture.png')['status'], 400)
