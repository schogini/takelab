# Record the TakeLab walkthrough

Load [`demo/02-takelab-tour.md`](../../demo/02-takelab-tour.md) into the teleprompter using its ▶ button. Its section headings are navigation cues, not words you need to read aloud. Speak the paragraphs and leave a short pause at each section change.

The narration is designed for a relaxed product walkthrough. Allow about **12–15 minutes**, including clicks, terminal commands and pauses. Rehearse once; the narration's word count alone does not include demonstration time.

## Before the take

1. Run `./takelab ./demo --port 8766` from the repository root. Keep that port and browser profile for later access to saved takes.
2. Load `02-takelab-tour.md` into the teleprompter, open `slide.svg`, and adjust text size and column widths.
3. Choose 16:9 for the main recording. Use Free temporarily if a page needs more vertical space.
4. Start the cameras you will use and check capture/output dimensions. Choose combined overlays or separate camera files before starting.
5. Choose the microphone, record ten seconds, and check audio level, framing and lip sync. Use 1080p/30 fps as a practical first take; choose quality appropriate to your hardware.
6. Close unrelated notifications, tabs and files. Copy only the commands you intend to demonstrate.

If TakeLab is recording this walkthrough itself, start the main take **before the opening narration**. Do not start another recording or click Stop in the middle of the tour. Explain the current recording controls as you show them. Capture idle recording settings and the completed Saved takes/download controls as short supplemental shots, then insert them during editing. Settings panels that overlap the browse area will appear in the capture; use them deliberately as instructional shots, then close them for the demonstration. Stop the main take **after** the closing sentence.

## Shot guide

| Narration section | What to show and do | What the viewer should notice |
| --- | --- | --- |
| Opening | Head camera, then the full workspace with `slide.svg` open. | Script and demonstration can share one workspace. |
| Start with a folder | Show the file list and column dividers. Explain `./takelab ./demo`; film launching as a separate opening shot if necessary. | The selected working folder supplies the references and terminal location. |
| Keep the script close to the camera | Keep `02-takelab-tour.md` pinned. Click `01-script.md` **by its filename** to demonstrate Markdown preview, then return to `slide.svg`. Show Prompt settings and briefly the Pop out view. | Clicking a filename changes the reference; clicking ▶ changes the script. Do not replace the narration with `01-script.md` during the main take. |
| Explain the code, then run it | Open `demo.py`, then Terminal. Run the three commands below, pausing after each output. Show Paste as typing without unintentionally executing a command twice. | Same data, different threshold; JSON output is optional. |
| Turn the result into a visual explanation | `dashboard.html` → Browse → Show threshold → Source → Browse. Show `handout.pdf`, then `field-notes.txt` → Edit. Cancel an unchanged edit or intentionally save a harmless note. | Rendering, source, PDFs and editing are available in the browse area. The dashboard is a static example, not a live CSV consumer. |
| Guide the viewer’s attention | Open `slide.svg`; Annotate → Highlighter; drag over its heading; Done. Show the aspect-ratio selector and Appearance. | Marks are overlays; the recording frame is adjustable. |
| Add your cameras | Show Head, Project and Top, one at a time. Maximize and restore a live view, then show the picture controls and Quality. | Present real device results; do not claim 4K if the reported capture is lower. Use only the cameras you actually have. |
| Choose how to record | Explain the current recording indicator and controls. Insert a separate idle-settings shot for quality, audio and separate-camera options; insert Saved takes after the main take is complete. | Combined and separate-camera outputs serve different editing workflows. |
| Keep your setup and your takes | Settings → Save settings backup. Show the recovery explanation and downloads in a supplemental shot. | Settings backups and recordings are separate. |
| Closing | Return to a clear reference or head camera; keep the GitHub URL visible in the video description. Leave a two-second tail, then Stop. | Clear invitation to try the demo and offer feedback. |

### Commands to demonstrate

Run these **inside TakeLab's demo-folder terminal**, one at a time:

```bash
python3 demo.py
python3 demo.py --limit 28
python3 demo.py --json
```

Expected results: 6 samples, 26.5 C average, 31.2 C peak; 1 alert at the default 30 C limit and 2 alerts at 28 C. The data is fictional. The HTML dashboard and PDF are fixed presentation examples; they do not automatically change when the CSV or command-line limit changes.

## Suggested YouTube packaging

**Title:** TakeLab: Record Coding Tutorials with a Teleprompter & Cameras

**Alternative:** A Local Recording Studio for Your Code, Script and Cameras

**Description:**

```text
TakeLab brings your teleprompter, code previews, real terminals, browser tabs and up to three cameras into one local recording workspace.

In this walkthrough I use the included sensor-project demo to show the complete flow: read a script, run Python, present an HTML dashboard, annotate a slide, configure cameras and prepare a recording.

Try TakeLab: https://github.com/schogini/takelab
Visual setup guide: https://github.com/schogini/takelab#readme
Demo files: https://github.com/schogini/takelab/tree/main/demo

Core requirements: macOS, Python 3.10+ and desktop Chrome.
Optional: FFmpeg for constant-frame-rate Camtasia exports.
MIT licensed. By Schogini Systems Private Limited: https://www.schogini.com

The sensor data is fictional. Actual camera resolution and frame rate depend on your hardware and browser. Make a short test take before recording an important session.

#TakeLab #CodingTutorial #ScreenRecording
```

Use the narration's section names as chapters, but add **actual timestamps after editing**. Do not paste estimated timestamps into the published video.

After YouTube publication, send the final public/watch URL. It can then replace the old tour link near the top of the repository README with a thumbnail and **Watch the full walkthrough** link. No placeholder video URL has been added.
