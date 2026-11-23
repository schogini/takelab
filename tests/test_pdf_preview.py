import io
import json
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import quote
from preview import Handler


def sample_pdf():
    streams = [b'BT /F1 26 Tf 56 720 Td (PDF browse preview) Tj 0 -50 Td /F1 16 Tf (Page 1 - zoom and scroll in the browse area.) Tj ET',
               b'BT /F1 26 Tf 56 720 Td (Second page) Tj 0 -50 Td /F1 16 Tf (PDF page navigation is available here.) Tj ET']
    objects = [b'<< /Type /Catalog /Pages 2 0 R >>',
               b'<< /Type /Pages /Count 2 /Kids [3 0 R 5 0 R] >>',
               b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>',
               b'<< /Length '+str(len(streams[0])).encode()+b' >>\nstream\n'+streams[0]+b'\nendstream',
               b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',
               b'<< /Length '+str(len(streams[1])).encode()+b' >>\nstream\n'+streams[1]+b'\nendstream',
               b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
    data = b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'
    offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(data))
        data += str(index).encode()+b' 0 obj\n'+obj+b'\nendobj\n'
    xref = len(data)
    data += b'xref\n0 8\n0000000000 65535 f \n'
    data += b''.join(f'{offset:010d} 00000 n \n'.encode() for offset in offsets[1:])
    data += b'trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n'+str(xref).encode()+b'\n%%EOF\n'
    return data


class PDFPreviewTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name).resolve()
        self.root = self.base / 'files'
        self.root.mkdir()
        self.name = 'sample report.PDF'
        (self.root / self.name).write_bytes(sample_pdf())
        (self.base / 'outside.pdf').write_bytes(sample_pdf())
        (self.root / 'escape.pdf').symlink_to(self.base / 'outside.pdf')
        self.server = SimpleNamespace(root=self.root, token='secret', server_port=1234, edit_lock=threading.Lock())

    def tearDown(self):
        self.temp.cleanup()

    def call(self, route, method='GET', body=None):
        handler = object.__new__(Handler)
        handler.server = self.server
        handler.path = route
        data = json.dumps(body).encode() if body else b''
        handler.headers = {'Host': '127.0.0.1:1234', 'X-Preview-Token': 'secret', 'Content-Length': str(len(data))}
        handler.rfile = io.BytesIO(data)
        handler.wfile = io.BytesIO()
        result = {'headers': {}}
        handler.send_response = lambda status: result.update(status=status)
        handler.send_header = lambda key, value: result['headers'].update({key: value})
        handler.end_headers = lambda: None
        getattr(handler, 'do_' + method)()
        result['body'] = handler.wfile.getvalue()
        return result

    def test_pdf_metadata_is_distinct_and_not_editable(self):
        result = self.call('/api/file?path='+quote(self.name))
        data = json.loads(result['body'])
        self.assertEqual(result['status'], 200)
        self.assertEqual(data['kind'], 'pdf')
        self.assertFalse(data['editable'])
        self.assertNotIn('text', data)

    def test_inline_pdf_and_download_have_correct_mime_and_disposition(self):
        route = '/raw?path='+quote(self.name)
        inline = self.call(route)
        self.assertEqual(inline['status'], 200)
        self.assertEqual(inline['headers']['Content-Type'], 'application/pdf')
        self.assertTrue(inline['headers']['Content-Disposition'].startswith('inline;'))
        self.assertIn('sample%20report.PDF', inline['headers']['Content-Disposition'])
        self.assertEqual(inline['headers']['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(inline['body'], sample_pdf())
        self.assertIn("frame-ancestors 'self'", inline['headers']['Content-Security-Policy'])
        self.assertTrue(self.call(route+'&download=1')['headers']['Content-Disposition'].startswith('attachment;'))

    def test_pdf_paths_and_editing_keep_existing_restrictions(self):
        for path in ('../outside.pdf', 'escape.pdf'):
            self.assertEqual(self.call('/raw?path='+quote(path))['status'], 403)
        self.assertEqual(self.call('/api/edit?path='+quote(self.name))['status'], 400)
        data = {'root': str(self.root), 'path': self.name, 'revision': 'irrelevant', 'text': 'do not edit'}
        self.assertEqual(self.call('/api/edit', 'POST', data)['status'], 400)
        self.assertEqual((self.root / self.name).read_bytes(), sample_pdf())

    def test_oversized_pdf_is_rejected_before_reading_its_contents(self):
        path = self.root / 'huge.pdf'
        with path.open('wb') as stream:
            stream.truncate(100 * 1024 * 1024 + 1)
        result = self.call('/raw?path=huge.pdf')
        self.assertEqual(result['status'], 400)
        self.assertIn('100 MB', json.loads(result['body'])['error'])

    def test_offline_viewer_assets_and_worker_policy(self):
        page = self.call('/pdf-viewer.html')
        self.assertEqual(page['status'], 200)
        self.assertIn(b'/pdf-viewer.js', page['body'])
        self.assertIn("'wasm-unsafe-eval'", page['headers']['Content-Security-Policy'])
        for path in ['/pdf-viewer.js', '/vendor/pdfjs/pdf.mjs', '/vendor/pdfjs/pdf.worker.mjs', '/vendor/pdfjs/pdf_viewer.mjs', '/vendor/pdfjs/pdf_viewer.css']:
            asset = self.call(path)
            self.assertEqual(asset['status'], 200)
            self.assertGreater(len(asset['body']), 100)
        worker = self.call('/vendor/pdfjs/pdf.worker.mjs')
        self.assertIn("'wasm-unsafe-eval'", worker['headers']['Content-Security-Policy'])

    def test_bundled_runtime_matches_integrity_manifest(self):
        import hashlib
        from preview import WEB
        base = WEB / 'vendor' / 'pdfjs'
        for line in (base / 'SHA256SUMS').read_text().splitlines():
            expected, name = line.split('  ', 1)
            self.assertEqual(hashlib.sha256((base / name).read_bytes()).hexdigest(), expected, name)
