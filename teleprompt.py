#!/usr/bin/env python3
"""A local Markdown teleprompter. Python 3.10+."""
import argparse
import threading
import webbrowser
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from preview import Handler, PreviewServer

MARKDOWN = {'.md', '.markdown', '.mdown'}


class TelepromptHandler(Handler):
    def send(self, data, *args, **kwargs):
        if urlsplit(self.path).path == '/api/list' and isinstance(data, list):
            data = [entry for entry in data if entry['directory'] or Path(entry['name']).suffix.lower() in MARKDOWN]
        super().send(data, *args, **kwargs)

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path == '/raw':
            return self.send({'error': 'This app opens Markdown scripts only.'}, status=403)
        if url.path == '/api/file':
            path = parse_qs(url.query).get('path', [''])[0]
            if Path(path).suffix.lower() not in MARKDOWN:
                return self.send({'error': 'Select a Markdown file.'}, status=403)
        if url.path == '/':
            self.path = '/teleprompt/index.html'
        super().do_GET()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder', nargs='?', default='.', help='Script folder (default: current folder)')
    parser.add_argument('--port', type=int, default=8766, help='Port (default: 8766; use 0 for any available port)')
    parser.add_argument('--no-open', action='store_true')
    args = parser.parse_args()
    root = Path(args.folder).expanduser().resolve()
    if not root.is_dir():
        parser.error(f'Not a folder: {root}')
    try:
        server = PreviewServer(('127.0.0.1', args.port), root, TelepromptHandler)
    except OSError as error:
        parser.exit(1, f'Cannot start TakeLab Prompt: {error}\nTry --port 0 to choose another port.\n')
    url = f'http://127.0.0.1:{server.server_port}'
    print(f'TakeLab Prompt\nFolder: {root}\nBrowse: {url}\nPress Ctrl+C to stop.', flush=True)
    if not args.no_open:
        threading.Timer(0.3, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
