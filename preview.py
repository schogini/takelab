#!/usr/bin/env python3
"""TakeLab Files: a loopback-only file browser and text editor. Python 3.10+."""
import argparse
import codecs
import json
import hashlib
import os
import stat
import tempfile
import mimetypes
import secrets
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlsplit

WEB = Path(__file__).resolve().parent / 'web'
MAX_TEXT = 2 * 1024 * 1024
IMAGES = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif'}
HTML_ASSETS = IMAGES | {'.html', '.htm', '.css', '.js', '.mjs', '.json', '.csv', '.txt',
                        '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp4', '.webm',
                        '.mp3', '.wav', '.ogg', '.m4a', '.wasm', '.map', '.webmanifest'}


def editable_text(data):
    if len(data) > MAX_TEXT:
        raise ValueError('Editing is limited to text files up to 2 MB.')
    if data.startswith(b'\xff\xfe'):
        encoding, bom = 'utf-16-le', b'\xff\xfe'
    elif data.startswith(b'\xfe\xff'):
        encoding, bom = 'utf-16-be', b'\xfe\xff'
    else:
        encoding, bom = 'utf-8', b'\xef\xbb\xbf' if data.startswith(b'\xef\xbb\xbf') else b''
    text = data[len(bom):].decode(encoding)
    if any(ord(char) < 32 and char not in '\t\r\n' for char in text):
        raise ValueError('This file contains binary control characters and cannot be edited.')
    newline = '\r\n' if '\r\n' in text and '\n' not in text.replace('\r\n', '') else '\n'
    return text.replace('\r\n', '\n'), encoding, bom, newline


def save_text_file(path, revision, text):
    original = path.read_bytes()
    if hashlib.sha256(original).hexdigest() != revision:
        return False
    _, encoding, bom, newline = editable_text(original)
    if not isinstance(text, str) or '\x00' in text:
        raise ValueError('Enter valid text without null characters.')
    data = bom + text.replace('\r\n', '\n').replace('\n', newline).encode(encoding)
    editable_text(data)  # Validate size and reject control characters before writing.
    mode = stat.S_IMODE(path.stat().st_mode)
    if not mode & 0o222 or not os.access(path, os.W_OK):
        raise PermissionError('This file is read-only.')
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix='.teleprompt-edit-', delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
            os.fchmod(stream.fileno(), mode)
        if hashlib.sha256(path.read_bytes()).hexdigest() != revision:
            return False
        os.replace(temporary, path)
        return True
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


class PreviewServer(ThreadingHTTPServer):
    # Multiple preview frames request their assets together during a reload.
    request_queue_size = 128
    daemon_threads = True

    def __init__(self, address, root, handler=None):
        self.root = root.resolve()
        self.token = secrets.token_urlsafe(32)
        self.apps = {}
        self.edit_lock = threading.Lock()
        super().__init__(address, handler or Handler)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def send(self, data, mime='application/json', status=200, attachment=False, html_preview=False, filename=None):
        if isinstance(data, (dict, list)):
            data = json.dumps(data).encode()
        elif isinstance(data, str):
            data = data.encode()
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        wasm = " 'wasm-unsafe-eval'" if urlsplit(self.path).path in {'/workspace/camera-vision-worker.js', '/vendor/pdfjs/pdf.worker.mjs', '/pdf-viewer.html'} else ''
        if html_preview:
            local = f'http://127.0.0.1:{self.server.server_port} http://localhost:{self.server.server_port}'
            # Opaque sandbox origin: page scripts cannot read workspace APIs/storage.
            policy = (f"default-src 'none'; script-src 'self' {local} https: 'unsafe-inline' 'wasm-unsafe-eval'; "
                      f"style-src 'self' {local} https: 'unsafe-inline'; img-src 'self' {local} https: data: blob:; "
                      f"font-src 'self' {local} https: data:; media-src 'self' {local} https: blob:; "
                      f"connect-src 'self' {local} https:; frame-src 'self' {local} https:; "
                      "object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts")
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), display-capture=()')
        elif mime == 'application/pdf':
            policy = "default-src 'none'; object-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"
        else:
            frame_sources = "'self' http: https:" if urlsplit(self.path).path == '/workspace/index.html' else "'self'"
            policy = f"default-src 'self'; script-src 'self'{wasm}; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-src {frame_sources}; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"
        self.send_header('Content-Security-Policy', policy)
        self.send_header('Referrer-Policy', 'no-referrer')
        if attachment or mime == 'application/pdf':
            disposition = 'attachment' if attachment else 'inline'
            if filename:
                disposition += "; filename*=UTF-8''" + quote(filename, safe='')
            self.send_header('Content-Disposition', disposition)
        self.end_headers()
        self.wfile.write(data)

    def safe_path(self, base, value):
        path = (base / value).resolve()
        if not path.is_relative_to(base):
            raise PermissionError('This path is outside the open folder.')
        return path

    def do_GET(self):
        if self.headers.get('Host') not in {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}:
            return self.send({'error': 'Invalid host'}, status=403)
        url = urlsplit(self.path)
        args = parse_qs(url.query)
        value = lambda key, default='': args.get(key, [default])[0]
        try:
            root = self.server.root
            if url.path == '/api/state':
                return self.send({'root': str(root), 'name': root.name, 'token': self.server.token, 'apps': self.server.apps})
            if url.path == '/api/edit':
                if not self.write_authorized():
                    return self.send({'error': 'Unauthorized'}, status=403)
                with self.server.edit_lock:
                    path = self.safe_path(self.server.root, value('path'))
                    if not path.is_file() or path.suffix.lower() in IMAGES | {'.pdf'}:
                        raise ValueError('Choose an existing text or script file to edit.')
                    if path.stat().st_size > MAX_TEXT:
                        raise ValueError('Editing is limited to text files up to 2 MB.')
                    data = path.read_bytes()
                    text, encoding, _, _ = editable_text(data)
                    return self.send({'path': value('path'), 'root': str(self.server.root), 'text': text, 'encoding': encoding, 'revision': hashlib.sha256(data).hexdigest()})
            if url.path == '/api/list':
                folder = self.safe_path(root, value('path'))
                entries = []
                for path in folder.iterdir():
                    if not value('hidden') and path.name.startswith('.'):
                        continue
                    try:
                        resolved = path.resolve()
                        if not resolved.is_relative_to(root):
                            continue
                        stat = path.stat()
                        entries.append({'name': path.name, 'path': path.relative_to(root).as_posix(), 'directory': path.is_dir(), 'size': stat.st_size, 'modified': stat.st_mtime})
                    except OSError:
                        continue
                return self.send(sorted(entries, key=lambda e: (not e['directory'], e['name'].casefold())))
            if url.path.startswith('/html-preview/'):
                path = self.safe_path(root, unquote(url.path[len('/html-preview/'):]))
                if not path.is_file():
                    raise FileNotFoundError('File not found.')
                if path.suffix.lower() not in HTML_ASSETS:
                    raise PermissionError('This file type is not a web preview asset.')
                if path.stat().st_size > 100 * 1024 * 1024:
                    raise ValueError('This file exceeds the 100 MB preview limit.')
                mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
                if path.suffix.lower() in {'.html', '.htm'}:
                    mime = 'text/html; charset=utf-8'
                elif path.suffix.lower() in {'.js', '.mjs'}:
                    mime = 'text/javascript; charset=utf-8'
                return self.send(path.read_bytes(), mime, html_preview=True)
            if url.path in {'/api/file', '/raw'}:
                path = self.safe_path(root, value('path'))
                if not path.is_file():
                    raise FileNotFoundError('File not found.')
                size = path.stat().st_size
                if url.path == '/raw':
                    if path.suffix.lower() not in IMAGES | {'.pdf'} and value('download') != '1':
                        raise PermissionError('Use the download action for this file.')
                    if size > 100 * 1024 * 1024:
                        raise ValueError('This file exceeds the 100 MB download/preview limit.')
                    mime = 'application/pdf' if path.suffix.lower() == '.pdf' else mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
                    return self.send(path.read_bytes(), mime, attachment=value('download') == '1', filename=path.name if path.suffix.lower() == '.pdf' else None)
                result = {'name': path.name, 'path': value('path'), 'size': size, 'modified': path.stat().st_mtime}
                if path.suffix.lower() == '.pdf':
                    result['kind'] = 'pdf'
                elif path.suffix.lower() in IMAGES:
                    result['kind'] = 'image'
                else:
                    with path.open('rb') as stream:
                        data = stream.read(MAX_TEXT + 1)
                    if b'\x00' in data[:8192] and not data.startswith((b'\xff\xfe', b'\xfe\xff')):
                        result['kind'] = 'binary'
                    else:
                        try:
                            encoding = 'utf-16' if data.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig'
                            decoder = codecs.getincrementaldecoder(encoding)()
                            result['text'] = decoder.decode(data[:MAX_TEXT], final=size <= MAX_TEXT)
                            result['kind'] = ('markdown' if path.suffix.lower() in {'.md', '.markdown', '.mdown'} else
                                              'html' if path.suffix.lower() in {'.html', '.htm'} else 'text')
                            result['truncated'] = size > MAX_TEXT
                        except UnicodeDecodeError:
                            result['kind'] = 'binary'
                result['editable'] = result['kind'] in {'text', 'html', 'markdown'} and not result.get('truncated', False)
                return self.send(result)
            if url.path.startswith('/api/'):
                return self.send({'error': 'Not found'}, status=404)
            asset = self.safe_path(WEB, url.path.lstrip('/') or 'index.html')
            return self.send(asset.read_bytes(), mimetypes.guess_type(asset.name)[0] or 'application/octet-stream')
        except PermissionError as error:
            self.send({'error': str(error)}, status=403)
        except (FileNotFoundError, NotADirectoryError):
            self.send({'error': 'File or folder no longer exists. Refresh the sidebar.'}, status=404)
        except (OSError, ValueError) as error:
            self.send({'error': str(error)}, status=400)

    def write_authorized(self):
        origins = {f'http://127.0.0.1:{self.server.server_port}', f'http://localhost:{self.server.server_port}'}
        return (self.headers.get('Host') in {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
                and self.headers.get('X-Preview-Token') == self.server.token
                and (not self.headers.get('Origin') or self.headers.get('Origin') in origins))

    def do_POST(self):
        if not self.write_authorized():
            return self.send({'error': 'Unauthorized'}, status=403)
        if self.path not in {'/api/root', '/api/edit'}:
            return self.send({'error': 'Not found'}, status=404)
        try:
            length = int(self.headers.get('Content-Length', 0))
            maximum = MAX_TEXT * 6 + 16384 if self.path == '/api/edit' else 16384
            if length < 1 or length > maximum:
                raise ValueError('Invalid request length.')
            data = json.loads(self.rfile.read(length))
            with self.server.edit_lock:
                if self.path == '/api/edit':
                    if data.get('root') != str(self.server.root):
                        return self.send({'error': 'The open folder changed. Reload the file before saving.'}, status=409)
                    path = self.safe_path(self.server.root, data['path'])
                    if not path.is_file() or path.suffix.lower() in IMAGES | {'.pdf'}:
                        raise ValueError('Choose an existing text or script file to edit.')
                    if not isinstance(data.get('revision'), str) or not isinstance(data.get('text'), str):
                        raise ValueError('Missing file revision or text.')
                    if path.stat().st_size > MAX_TEXT:
                        raise ValueError('Editing is limited to text files up to 2 MB.')
                    if not save_text_file(path, data['revision'], data['text']):
                        return self.send({'error': 'This file changed outside the editor. Your changes were not saved. Copy your draft, then cancel and reopen Edit to load the current file.'}, status=409)
                    return self.send({'saved': True})
                path = Path(data['path']).expanduser().resolve()
                if not path.is_dir():
                    raise ValueError('Enter the full path to an existing folder.')
                list(path.iterdir())
                self.server.root = path
                self.send({'root': str(path), 'name': path.name})
        except PermissionError as error:
            self.send({'error': str(error)}, status=403)
        except FileNotFoundError:
            self.send({'error': 'File no longer exists. Your draft has not been saved.'}, status=404)
        except (OSError, ValueError, KeyError, TypeError) as error:
            self.send({'error': str(error)}, status=400)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder', nargs='?', default='.', help='Folder to browse (default: current folder)')
    parser.add_argument('--port', type=int, default=0, help='Port number (default: choose an available port)')
    parser.add_argument('--no-open', action='store_true', help='Do not automatically open a browser')
    args = parser.parse_args()
    root = Path(args.folder).expanduser().resolve()
    if not root.is_dir():
        parser.error(f'Not a folder: {root}')
    try:
        server = PreviewServer(('127.0.0.1', args.port), root)
    except OSError as error:
        parser.exit(1, f'Cannot start server: {error}\n')
    url = f'http://127.0.0.1:{server.server_port}'
    print(f'TakeLab Files\nFolder: {root}\nBrowse: {url}\nPress Ctrl+C to stop.', flush=True)
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
