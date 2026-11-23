#!/usr/bin/env python3
"""Open a unified file browser and teleprompter workspace."""
import argparse
import base64
import binascii
import json
import secrets
import shutil
import threading
import webbrowser
from pathlib import Path
from urllib.parse import parse_qs, quote, urlsplit
from preview import Handler, PreviewServer
from terminal_backend import TerminalManager
from recording_export import RecordingExporter


class WorkspaceServer(PreviewServer):
    def __init__(self, address, root):
        self.terminals = TerminalManager()
        self.recording_exporter = RecordingExporter()
        super().__init__(address, root, WorkspaceHandler)

    def server_close(self):
        self.recording_exporter.close()
        self.terminals.close()
        super().server_close()


class WorkspaceHandler(Handler):
    def terminal_authorized(self):
        host = self.headers.get('Host', '')
        return (host in {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
                and self.headers.get('Origin', f'http://{host}') == f'http://{host}'
                and secrets.compare_digest(self.headers.get('X-Preview-Token', '').encode(), self.server.token.encode()))

    def terminal_request(self, write=False):
        if not self.terminal_authorized():
            return self.send({'error': 'Unauthorized terminal request.'}, status=403)
        if not hasattr(self.server, 'terminals'):
            return self.send({'error': 'Restart with the workspace launcher to enable the terminal.'}, status=404)
        try:
            url = urlsplit(self.path)
            if write:
                length = int(self.headers.get('Content-Length', 0))
                if not 1 <= length <= 100000:
                    raise ValueError('Invalid terminal request length.')
                data = json.loads(self.rfile.read(length))
                if not isinstance(data, dict):
                    raise ValueError('Invalid terminal request.')
                if url.path == '/api/terminal/start':
                    cwd = self.safe_path(self.server.root, data.get('path', ''))
                    if not cwd.is_dir():
                        raise ValueError('Select an existing folder for the terminal.')
                    session = self.server.terminals.start(cwd, data.get('cols', 80), data.get('rows', 24))
                    return self.send({'id': session.id, 'cwd': session.cwd})
                session_id = data['id']
                if url.path == '/api/terminal/stop':
                    self.server.terminals.stop(session_id)
                    return self.send({'ok': True})
                session = self.server.terminals.get(session_id)
                if url.path == '/api/terminal/input':
                    content = base64.b64decode(data['data'], validate=True)
                    if len(content) > 65536:
                        raise ValueError('Terminal paste exceeds 64 KB.')
                    session.write(content)
                    return self.send({'ok': True})
                if url.path == '/api/terminal/resize':
                    session.resize(data['cols'], data['rows'])
                    return self.send({'ok': True})
            elif url.path == '/api/terminal/output':
                args = parse_qs(url.query)
                session = self.server.terminals.get(args.get('id', [''])[0])
                cursor = int(args.get('after', ['0'])[0])
                if cursor < 0:
                    raise ValueError('Invalid terminal output cursor.')
                return self.send(session.read(cursor))
            return self.send({'error': 'Terminal endpoint not found.'}, status=404)
        except PermissionError as error:
            self.send({'error': str(error)}, status=403)
        except KeyError as error:
            self.send({'error': str(error)}, status=404)
        except (OSError, ValueError, TypeError, binascii.Error) as error:
            self.send({'error': str(error)}, status=400)

    def export_request(self, write=False):
        url = urlsplit(self.path)
        host = self.headers.get('Host', '')
        download = not write and url.path == '/api/recording-export/download'
        # The native download uses an unguessable job capability. Creation and
        # polling also require the app token; reject cross-site requests throughout.
        if (not self.terminal_authorized() and not (download
                and host in {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
                and self.headers.get('Sec-Fetch-Site', 'same-origin') in {'same-origin', 'none'}
                and self.headers.get('Origin', f'http://{host}') == f'http://{host}')):
            return self.send({'error': 'Unauthorized recording export.'}, status=403)
        try:
            args = parse_qs(url.query)
            exporter = self.server.recording_exporter
            if write and url.path == '/api/recording-export':
                job = exporter.start(self.rfile, int(self.headers.get('Content-Length', 0)), int(args.get('fps', ['30'])[0]))
                return self.send(job)
            job_id = args.get('id', [''])[0]
            if not write and url.path == '/api/recording-export/status':
                return self.send(exporter.status(job_id))
            if download:
                with exporter.open_download(job_id) as source:
                    self.send_response(200)
                    self.send_header('Content-Type', 'video/mp4')
                    self.send_header('Content-Length', str(source.seek(0, 2)))
                    source.seek(0)
                    name = Path(args.get('name', ['recording-camtasia.mp4'])[0]).name[:200]
                    self.send_header('Content-Disposition', "attachment; filename*=UTF-8''" + quote(name, safe=''))
                    self.send_header('Cache-Control', 'no-store')
                    self.send_header('Referrer-Policy', 'no-referrer')
                    self.send_header('X-Content-Type-Options', 'nosniff')
                    self.end_headers()
                    shutil.copyfileobj(source, self.wfile, 1024 * 1024)
                return
            return self.send({'error': 'Export endpoint not found.'}, status=404)
        except (BrokenPipeError, ConnectionResetError):
            return
        except KeyError as error:
            self.send({'error': str(error)}, status=404)
        except (ValueError, OSError) as error:
            self.send({'error': str(error)}, status=400)

    def do_POST(self):
        if urlsplit(self.path).path.startswith('/api/recording-export'):
            return self.export_request(write=True)
        if urlsplit(self.path).path.startswith('/api/terminal/'):
            return self.terminal_request(write=True)
        super().do_POST()

    def do_GET(self):
        if urlsplit(self.path).path.startswith('/api/recording-export'):
            return self.export_request()
        if urlsplit(self.path).path.startswith('/api/terminal/'):
            return self.terminal_request()
        if urlsplit(self.path).path == '/':
            self.path = '/workspace/index.html'
        super().do_GET()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder', nargs='?', default='.', help='Folder to browse (default: current folder)')
    parser.add_argument('--port', '--browse-port', dest='port', type=int, default=8766, help='Local port (default: 8766; use 0 for an available port)')
    # Keep existing start-both commands compatible, including test/alternate ports.
    parser.add_argument('--teleprompt-port', type=int, help=argparse.SUPPRESS)
    parser.add_argument('--no-open', action='store_true', help='Print the URL without opening the browser')
    args = parser.parse_args()
    root = Path(args.folder).expanduser().resolve()
    if not root.is_dir():
        parser.error(f'Not a folder: {root}')
    port = args.teleprompt_port if args.teleprompt_port is not None else args.port
    try:
        server = WorkspaceServer(('127.0.0.1', port), root)
    except OSError as error:
        parser.exit(1, f'Cannot start workspace: {error}\nTry --port 0 to choose another port.\n')
    url = f'http://127.0.0.1:{server.server_port}/'
    print(f'TakeLab Workspace\nFolder: {root}\nBrowse: {url}\nPress Ctrl+C to stop.', flush=True)
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
