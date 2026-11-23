import io
import json
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from launch import WorkspaceServer


class ExportHTTPTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.server = WorkspaceServer(('127.0.0.1', 0), Path(self.temp.name))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f'http://127.0.0.1:{self.server.server_port}'

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def request(self, route, data=None, headers=None):
        return urlopen(Request(self.url+route, data=data, headers=headers or {}))

    def test_creation_and_status_require_token_and_same_origin(self):
        for route, data, headers in [('/api/recording-export', b'x', {}),
                                     ('/api/recording-export/status?id=x', None, {}),
                                     ('/api/recording-export', b'x', {'X-Preview-Token': self.server.token, 'Origin': 'https://evil.example'}),
                                     ('/api/recording-export/download?id=x', None, {'Sec-Fetch-Site': 'cross-site'})]:
            with self.assertRaises(HTTPError) as error:
                self.request(route, data, headers)
            self.assertEqual(error.exception.code, 403)
            error.exception.close()

    def test_validation_and_download_streaming(self):
        headers = {'X-Preview-Token': self.server.token}
        with self.assertRaises(HTTPError) as error:
            self.request('/api/recording-export?fps=24', b'x', headers)
        self.assertEqual(error.exception.code, 400)
        error.exception.close()
        exporter = self.server.recording_exporter
        exporter.job = {'id': 'secret', 'state': 'ready', 'fps': 30, 'error': ''}
        video = b'mp4-content-for-streaming-test'
        (Path(exporter.temp.name) / 'camtasia.mp4').write_bytes(video)
        with self.request('/api/recording-export/status?id=secret', headers=headers) as response:
            self.assertEqual(json.load(response)['state'], 'ready')
        with self.request('/api/recording-export/download?id=secret&name=demo-camtasia.mp4') as response:
            self.assertEqual(response.read(), video)
            self.assertEqual(response.headers['Content-Type'], 'video/mp4')
            self.assertIn('demo-camtasia.mp4', response.headers['Content-Disposition'])
        for bad_id in ('wrong', '%C3%A9', '..%2Finput.media'):
            with self.assertRaises(HTTPError) as error:
                self.request('/api/recording-export/download?id='+bad_id)
            self.assertEqual(error.exception.code, 404)
            error.exception.close()
