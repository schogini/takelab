# TakeLab

**Your script, demos and cameras. One recording workspace.**

TakeLab is a local browser studio for technical creators. Read your script near the camera, demonstrate code or a web app, and record your screen with up to three cameras—all from the folder you are working in.

[![CI](https://github.com/schogini/takelab/actions/workflows/ci.yml/badge.svg)](https://github.com/schogini/takelab/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

![TakeLab workspace](docs/assets/workspace.jpg)

[Watch the short workspace tour](https://github.com/schogini/takelab/releases/download/v0.1.0/takelab-tour.mp4) · [User guide](docs/USER_GUIDE.md) · [Latest release](https://github.com/schogini/takelab/releases/latest)

## Start in a minute

You need **macOS, Python 3.10+ and desktop Chrome**. The core app uses Python's standard library: no pip install, npm install or build step.

```bash
git clone https://github.com/schogini/takelab.git
cd takelab
./takelab ./examples
```

Your browser opens automatically. Select `script.md` for the teleprompter and open a reference file on the right. Stop the local server with **Ctrl+C** in the terminal that launched it.

To open any working folder:

```bash
/path/to/takelab/takelab /path/to/your/project
```

Omit the folder argument to use your terminal's current directory. Add `--no-open` to print the URL, `--port 0` to select an available port, or `--port 8766` for a stable address. Use the same address, port and browser profile to access saved settings and recordings.

## Built for explaining while doing

- **Read:** resizable teleprompter, auto-scroll, keyboard controls and an optional compact pop-out with controls at the bottom.
- **Demonstrate:** Markdown, images, highlighted code, text editing, PDF, HTML source/rendered views, URL tabs and multiple real terminals in your working folder.
- **Present:** stable preview frame, aspect ratios, laser pointer, drawing/highlighting and customizable colors and borders.
- **Show your work:** Head, Project and Top cameras with movable/resizable views, quick maximize, effects and native-resolution separate recording.
- **Record:** browse area plus overlays, microphone and optional shared-tab audio; pause/resume; optional separate camera files with a clean screen recording.
- **Keep your setup:** settings export/import, local saved takes, chunk checkpoints for recovery and individual/bulk recording deletion.

## Recording and editing

Open **Record**, choose your microphone and quality, then share the **TakeLab tab** when Chrome asks. Keep the tab visible during recording. Stop normally, then download your take from **Saved takes**.

For Camtasia, install FFmpeg separately and use the **Camtasia** download to convert browser recordings to constant-frame-rate H.264/AAC MP4:

```bash
brew install ffmpeg
```

FFmpeg is optional and is not bundled. The original recording remains available. Camera resolution depends on the device, browser and effects; the settings panel reports actual capture and output dimensions.

Recordings stay in this browser's local storage until you download or delete them. Chunk checkpoints reduce crash loss, but the latest footage can be lost and recovery is not guaranteed. Keep downloaded copies of important takes. Clearing browser/site data deletes stored recordings and settings.

## Scope and limitations

- macOS and Chrome are the primary target. CI also exercises backend tests on Linux; Windows and other browsers are not supported releases.
- Remote websites can block embedded viewing. Streamlit localhost apps may need their embedding configuration adjusted; see the [user guide](docs/USER_GUIDE.md).
- Chrome controls its own sharing notification; the app cannot remove browser security UI. Popup placement and window chrome are also controlled by the browser/OS.
- This is a local development tool with real shell and file-edit access. Open trusted folders and content. It binds to `127.0.0.1`; do not expose it through a public tunnel or reverse proxy. See [SECURITY.md](SECURITY.md).
- Automated tests use synthetic media and mocks. They do not certify every camera or long recording session; run a short test take with your own setup before recording something important.

## More

[Full user guide](docs/USER_GUIDE.md) · [Standalone teleprompter](docs/TELEPROMPT.md) · [Contributing](CONTRIBUTING.md) · [Third-party notices](docs/THIRD_PARTY.md)

The compatibility launchers `workspace`, `start-both`, `browse` and `teleprompt` remain available. Existing settings and recording storage retain their original internal identifiers.

## License

TakeLab's original code is [MIT licensed](LICENSE), copyright © 2026 [Schogini Systems Private Limited](https://www.schogini.com). Bundled third-party libraries and models retain their own licenses and notices.
