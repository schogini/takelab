import io
import unittest
from types import SimpleNamespace
from preview import Handler


class BrowserPolicyTests(unittest.TestCase):
    def policy(self, path):
        handler = object.__new__(Handler)
        handler.path = path
        handler.server = SimpleNamespace(server_port=1234)
        handler.wfile = io.BytesIO()
        headers = {}
        handler.send_response = lambda status: None
        handler.send_header = lambda key, value: headers.update({key: value})
        handler.end_headers = lambda: None
        handler.send('test', 'text/html')
        return headers['Content-Security-Policy']

    def test_only_workspace_entry_allows_external_frames(self):
        self.assertIn("frame-src 'self' http: https:;", self.policy('/workspace/index.html'))
        self.assertIn("frame-src 'self';", self.policy('/index.html'))
        self.assertIn("frame-src 'self';", self.policy('/api/state'))
        self.assertIn("script-src 'self';", self.policy('/workspace/index.html'))
        self.assertIn("frame-ancestors 'self'", self.policy('/workspace/index.html'))
