import io
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from recording_export import RecordingExporter


class RecordingExportTests(unittest.TestCase):
    def setUp(self):
        self.exporter = RecordingExporter()
        self.addCleanup(self.exporter.close)

    def test_invalid_requests_and_missing_ffmpeg_do_not_create_jobs(self):
        for length, fps in [(0, 30), (8 * 1024**3 + 1, 30), (1, 24)]:
            with self.assertRaises(ValueError):
                self.exporter.start(io.BytesIO(b'x'), length, fps)
        with patch('recording_export.shutil.which', return_value=None):
            with self.assertRaisesRegex(ValueError, 'brew install ffmpeg'):
                self.exporter.start(io.BytesIO(b'x'), 1, 30)
        self.assertIsNone(self.exporter.job)

    def test_interrupted_upload_is_removed(self):
        with patch('recording_export.shutil.which', return_value='/ffmpeg'):
            with self.assertRaisesRegex(ValueError, 'interrupted'):
                self.exporter.start(io.BytesIO(b'x'), 2, 30)
        self.assertEqual(list(Path(self.exporter.temp.name).iterdir()), [])
        with self.assertRaises(KeyError):
            self.exporter.status('../../etc/passwd')

    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'FFmpeg tools required')
    def test_real_vfr_recording_becomes_cfr_h264_aac_without_changing_original(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / 'source.mp4'
            subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=30:duration=3',
                            '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=44100:duration=3',
                            '-vf', r'select=if(lt(t\,1)\,1\,not(mod(n\,3)))', '-fps_mode', 'vfr',
                            '-c:v', 'libx264', '-c:a', 'aac', str(source)], check=True)
            original = source.read_bytes()
            def probe(path):
                return json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-of', 'json', str(path)]))['streams']
            before = probe(source)
            self.assertNotEqual(before[0]['r_frame_rate'], before[0]['avg_frame_rate'])
            for fps in (30, 60):
                with source.open('rb') as stream:
                    job = self.exporter.start(stream, source.stat().st_size, fps)
                self.exporter.worker.join(timeout=30)
                self.assertEqual(self.exporter.status(job['id'])['state'], 'ready')
                with self.exporter.open_download(job['id']) as output:
                    streams = probe(output.name)
                    frames = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
                              '-show_entries', 'frame=best_effort_timestamp_time', '-of', 'json', output.name]))['frames']
                self.assertEqual(streams[0]['codec_name'], 'h264')
                self.assertEqual(streams[0]['avg_frame_rate'], f'{fps}/1')
                self.assertEqual(streams[0]['pix_fmt'], 'yuv420p')
                self.assertEqual(streams[1]['codec_name'], 'aac')
                self.assertEqual(streams[1]['sample_rate'], '48000')
                times = [float(frame['best_effort_timestamp_time']) for frame in frames]
                for a, b in zip(times, times[1:]):
                    self.assertAlmostEqual(b-a, 1/fps, places=5)
                self.assertLess(abs(float(streams[0]['duration']) - float(streams[1]['duration'])), .06)
            self.assertEqual(source.read_bytes(), original)

    @unittest.skipUnless(shutil.which('ffmpeg'), 'FFmpeg required')
    def test_invalid_media_reports_failure_without_a_download(self):
        job = self.exporter.start(io.BytesIO(b'not video'), 9, 30)
        self.exporter.worker.join(timeout=20)
        self.assertEqual(self.exporter.status(job['id'])['state'], 'failed')
        with self.assertRaises(ValueError):
            self.exporter.open_download(job['id'])
