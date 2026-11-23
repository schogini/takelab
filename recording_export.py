"""Local, disk-backed CFR exports for video editors. Originals stay in the browser."""
import secrets
import shutil
import subprocess
import tempfile
import threading
from pathlib import Path

MAX_EXPORT_BYTES = 8 * 1024**3


class RecordingExporter:
    def __init__(self):
        self.lock = threading.RLock()
        self.job = None
        self.closed = False
        self.worker = None
        self.process = None
        self.temp = tempfile.TemporaryDirectory(prefix='teleprompt-export-')

    def start(self, source, length, fps):
        if fps not in (30, 60):
            raise ValueError('Export frame rate must be 30 or 60.')
        if not 0 < length <= MAX_EXPORT_BYTES:
            raise ValueError('Recording must be between 1 byte and 8 GB.')
        ffmpeg = shutil.which('ffmpeg')
        if not ffmpeg:
            raise ValueError('FFmpeg is required. Install it with brew install ffmpeg, then restart the workspace.')
        with self.lock:
            if self.closed:
                raise ValueError('Workspace is shutting down.')
            if self.job and self.job['state'] in ('uploading', 'converting'):
                raise ValueError('Another Camtasia export is already running.')
            for path in Path(self.temp.name).iterdir():
                path.unlink()
            job = {'id': secrets.token_urlsafe(32), 'state': 'uploading', 'fps': fps, 'error': ''}
            self.job = job
            input_path = Path(self.temp.name) / 'input.media'
            try:
                with input_path.open('wb') as output:
                    remaining = length
                    while remaining:
                        chunk = source.read(min(1024 * 1024, remaining))
                        if not chunk:
                            raise ValueError('Recording transfer was interrupted. Try again.')
                        output.write(chunk)
                        remaining -= len(chunk)
            except Exception:
                job['state'] = 'failed'
                input_path.unlink(missing_ok=True)
                raise
            job['state'] = 'converting'
            self.worker = threading.Thread(target=self._convert, args=(job, ffmpeg, input_path), daemon=True)
            self.worker.start()
            return dict(job)

    def _convert(self, job, ffmpeg, input_path):
        output = Path(self.temp.name) / 'camtasia.mp4'
        log = Path(self.temp.name) / 'ffmpeg.log'
        # Keep original presentation timestamps: fps duplicates/drops frames along
        # that timeline. Never derive timestamps from frame count or stretch audio.
        command = [ffmpeg, '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
                   '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'mov,matroska,webm',
                   '-i', str(input_path), '-map', '0:v:0', '-map', '0:a:0?',
                   '-vf', f'fps={job["fps"]},pad=ceil(iw/2)*2:ceil(ih/2)*2',
                   '-fps_mode', 'cfr', '-c:v', 'libx264', '-preset', 'medium',
                   '-crf', '18', '-pix_fmt', 'yuv420p', '-threads', '2',
                   '-c:a', 'aac', '-ar', '48000', '-b:a', '192k',
                   '-map_metadata', '-1', '-movflags', '+faststart', str(output)]
        result, message = 'ready', ''
        try:
            with log.open('wb') as errors:
                with self.lock:
                    if self.closed:
                        return
                    self.process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=errors)
                    process = self.process
                try:
                    code = process.wait(timeout=6 * 60 * 60)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
                    raise ValueError('Conversion timed out. Download the original and convert it with FFmpeg directly.')
            if code or not output.exists() or not output.stat().st_size:
                raise ValueError('FFmpeg could not convert this recording. The original is unchanged; try downloading it directly.')
        except (OSError, ValueError) as error:
            result, message = 'failed', str(error)
            output.unlink(missing_ok=True)
        finally:
            input_path.unlink(missing_ok=True)
            log.unlink(missing_ok=True)
            with self.lock:
                self.process = None
                job.update(state=result, error=message)

    def status(self, job_id):
        with self.lock:
            if not self.job or not secrets.compare_digest(self.job['id'].encode(), job_id.encode()):
                raise KeyError('Export expired. Click Download for Camtasia to convert again.')
            return dict(self.job)

    def open_download(self, job_id):
        with self.lock:
            if self.status(job_id)['state'] != 'ready':
                raise ValueError('Export is not ready.')
            return (Path(self.temp.name) / 'camtasia.mp4').open('rb')

    def close(self):
        with self.lock:
            self.closed = True
            if self.process and self.process.poll() is None:
                self.process.kill()
        if self.worker:
            self.worker.join(timeout=10)
        self.temp.cleanup()
