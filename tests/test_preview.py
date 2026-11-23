import json
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from preview import PreviewServer


class PreviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.base = Path(cls.temp.name).resolve()
        cls.root = cls.base / 'files'
        cls.root.mkdir()
        (cls.root / 'notes.md').write_text('# Hello\n\n![image](sample.svg)')
        (cls.root / 'hello.py').write_text('print("hello")\n')
        (cls.root / 'site').mkdir()
        (cls.root / 'site' / 'demo page.HTML').write_text('<!doctype html><h1>Rendered demo</h1><script>document.title="Demo"</script>')
        (cls.root / 'site' / 'styles.css').write_text('h1 { color: green; }')
        (cls.root / 'site' / 'app.mjs').write_text('document.body.dataset.ready="yes";')
        (cls.root / 'site' / 'data.json').write_text('{"value": 42}')
        (cls.root / '.hidden').write_text('hidden')
        (cls.root / 'folder').mkdir()
        (cls.root / 'sample.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg"/>')
        (cls.root / 'binary.bin').write_bytes(b'\x00\x01\x02')
        (cls.base / 'secret.txt').write_text('outside')
        (cls.root / 'escape').symlink_to(cls.base / 'secret.txt')
        cls.server = PreviewServer(('127.0.0.1', 0), cls.root)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.temp.cleanup()

    def request(self, path, **kwargs):
        return urlopen(Request(self.url + path, **kwargs))

    def data(self, path):
        with self.request(path) as response:
            return json.load(response)

    def test_listing_and_hidden_files(self):
        entries = self.data('/api/list')
        self.assertTrue(entries[0]['directory'])
        self.assertNotIn('.hidden', [e['name'] for e in entries])
        self.assertNotIn('escape', [e['name'] for e in entries])
        self.assertIn('.hidden', [e['name'] for e in self.data('/api/list?hidden=1')])

    def test_file_previews(self):
        self.assertEqual(self.data('/api/file?path=notes.md')['kind'], 'markdown')
        self.assertEqual(self.data('/api/file?path=hello.py')['text'], 'print("hello")\n')
        self.assertEqual(self.data('/api/file?path=sample.svg')['kind'], 'image')
        self.assertEqual(self.data('/api/file?path=binary.bin')['kind'], 'binary')
        self.assertEqual(self.data('/api/file?path=site/demo%20page.HTML')['kind'], 'html')

    def test_escape_paths_and_symlinks(self):
        for path in ('../secret.txt', '%2Fetc%2Fpasswd', 'escape'):
            with self.assertRaises(HTTPError) as error:
                self.request('/api/file?path=' + path)
            self.assertEqual(error.exception.code, 403)

    def test_raw_and_download(self):
        with self.request('/raw?path=sample.svg') as response:
            self.assertEqual(response.headers['Content-Type'], 'image/svg+xml')
        with self.assertRaises(HTTPError):
            self.request('/raw?path=notes.md')
        with self.request('/raw?path=hello.py&download=1') as response:
            self.assertEqual(response.headers['Content-Disposition'], 'attachment')

    def test_rendered_html_and_local_assets_are_isolated(self):
        with self.request('/html-preview/site/demo%20page.HTML') as response:
            self.assertEqual(response.headers['Content-Type'], 'text/html; charset=utf-8')
            self.assertIn(b'<h1>Rendered demo</h1>', response.read())
            policy = response.headers['Content-Security-Policy']
            self.assertIn('sandbox allow-scripts', policy)
            self.assertNotIn('allow-same-origin', policy)
            self.assertIn("form-action 'none'", policy)
            self.assertIn('microphone=()', response.headers['Permissions-Policy'])
        for name in ['styles.css', 'app.mjs', 'data.json']:
            with self.request('/html-preview/site/' + name) as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(response.headers['Access-Control-Allow-Origin'], '*')
                if name.endswith('.mjs'):
                    self.assertIn('javascript', response.headers['Content-Type'])
        with self.request('/api/state') as response:
            self.assertIsNone(response.headers.get('Access-Control-Allow-Origin'))
            scripts = response.headers['Content-Security-Policy'].split('script-src', 1)[1].split(';', 1)[0]
            self.assertNotIn("'unsafe-inline'", scripts)

    def test_render_route_keeps_folder_and_asset_boundaries(self):
        for path in ['%2e%2e/secret.txt', '%2Fetc%2Fpasswd', 'escape', 'hello.py']:
            with self.assertRaises(HTTPError) as error:
                self.request('/html-preview/' + path)
            self.assertEqual(error.exception.code, 403)
        with self.assertRaises(HTTPError) as error:
            self.request('/html-preview/site/missing.html')
        self.assertEqual(error.exception.code, 404)
        with self.assertRaises(HTTPError):
            self.request('/raw?path=site/demo%20page.HTML')

    def test_root_switch_requires_token(self):
        payload = json.dumps({'path': str(self.root / 'folder')}).encode()
        with self.assertRaises(HTTPError) as error:
            self.request('/api/root', data=payload)
        self.assertEqual(error.exception.code, 403)
        try:
            with self.request('/api/root', data=payload, headers={'X-Preview-Token': self.server.token}) as response:
                self.assertEqual(json.load(response)['root'], str(self.root / 'folder'))
        finally:
            self.server.root = self.root

    def test_host_validation_and_missing_file(self):
        with self.assertRaises(HTTPError) as error:
            self.request('/api/state', headers={'Host': 'evil.example'})
        self.assertEqual(error.exception.code, 403)
        with self.assertRaises(HTTPError) as error:
            self.request('/api/file?path=missing')
        self.assertEqual(error.exception.code, 404)

    def test_large_unicode_text(self):
        path = self.root / 'large.txt'
        path.write_text('a' + '\u20ac' * 700000)
        result = self.data('/api/file?path=large.txt')
        self.assertEqual(result['kind'], 'text')
        self.assertTrue(result['truncated'])
        self.assertTrue(result['text'].startswith('a\u20ac'))

    def test_frontend_assets(self):
        for path in ('/', '/app.js', '/style.css', '/vendor/marked.js', '/vendor/purify.js', '/vendor/highlight.js'):
            with self.request(path) as response:
                self.assertEqual(response.status, 200)
                self.assertIn("object-src 'none'", response.headers['Content-Security-Policy'])


if __name__ == '__main__':
    unittest.main()
