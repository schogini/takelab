import json
import sys
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from preview import PreviewServer
from teleprompt import TelepromptHandler


class TelepromptTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = Path(__file__).resolve().parent / 'fixtures'
        cls.server = PreviewServer(('127.0.0.1', 0), cls.root, TelepromptHandler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def test_markdown_only_library(self):
        with urlopen(self.url + '/api/list') as response:
            entries = json.load(response)
        self.assertEqual([e['name'] for e in entries], ['note.md'])
        with urlopen(self.url + '/api/file?path=note.md') as response:
            self.assertEqual(json.load(response)['kind'], 'markdown')
        for path in ('/api/file?path=sample.py', '/api/file?path=notes.txt', '/raw?path=landscape.svg'):
            with self.assertRaises(HTTPError) as error:
                urlopen(self.url + path)
            self.assertEqual(error.exception.code, 403)
            error.exception.close()

    def test_teleprompt_entry_and_shared_assets(self):
        with urlopen(self.url + '/') as response:
            self.assertIn(b'<title>TakeLab Prompt</title>', response.read())
        for path in ('/teleprompt/app.js', '/teleprompt/style.css', '/vendor/marked.js', '/vendor/purify.js'):
            with urlopen(self.url + path) as response:
                self.assertEqual(response.status, 200)

    def test_access_boundaries_still_apply(self):
        with self.assertRaises(HTTPError) as error:
            urlopen(self.url + '/api/file?path=../../TELEPROMPT.md')
        self.assertEqual(error.exception.code, 403)
        error.exception.close()
        with self.assertRaises(HTTPError) as error:
            urlopen(Request(self.url + '/api/state', headers={'Host': 'foreign.example'}))
        self.assertEqual(error.exception.code, 403)
        error.exception.close()


if __name__ == '__main__':
    unittest.main()
