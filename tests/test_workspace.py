import threading
import unittest
from pathlib import Path
from urllib.request import urlopen
from launch import WorkspaceHandler
from preview import PreviewServer


class WorkspaceTests(unittest.TestCase):
    def test_workspace_routes_and_embedded_policy(self):
        server = PreviewServer(('127.0.0.1', 0), Path(__file__).parent / 'fixtures', WorkspaceHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_port}'
        try:
            for path, title in [('/', b'<title>TakeLab Workspace</title>'),
                                ('/index.html?embedded=1', b'<title>TakeLab Files</title>'),
                                ('/teleprompt/index.html?embedded=1', b'<title>TakeLab Prompt</title>')]:
                with urlopen(base + path) as response:
                    self.assertIn(title, response.read())
                    self.assertNotIn("'wasm-unsafe-eval'", response.headers['Content-Security-Policy'])
                    self.assertIn("frame-src 'self'", response.headers['Content-Security-Policy'])
                    self.assertIn("frame-ancestors 'self'", response.headers['Content-Security-Policy'])
            for path in ['/workspace/app.js', '/workspace/style.css', '/workspace/embedded.css',
                         '/workspace/camera-settings.js', '/workspace/camera-controls.js',
                         '/workspace/camera-effects.js', '/workspace/recorder-core.js',
                         '/workspace/recorder-browser.js', '/workspace/recorder-ui.js',
                         '/workspace/recording-library.js']:
                with urlopen(base + path) as response:
                    self.assertEqual(response.status, 200)
            with urlopen(base + '/workspace/camera-vision-worker.js') as response:
                self.assertIn("'wasm-unsafe-eval'", response.headers['Content-Security-Policy'])
                self.assertIn("worker-src 'self'", response.headers['Content-Security-Policy'])
                self.assertIn(b'importScripts', response.read())
            with urlopen(base + '/vendor/mediapipe/wasm/vision_wasm_internal.wasm') as response:
                self.assertEqual(response.headers['Content-Type'], 'application/wasm')
                self.assertTrue(response.read().startswith(b'\x00asm'))
            for model in ['face', 'person']:
                with urlopen(base + f'/vendor/mediapipe/models/{model}.tflite') as response:
                    self.assertIn(b'TFL3', response.read()[:16])
        finally:
            server.shutdown()
            server.server_close()
            thread.join()
