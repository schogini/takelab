# TakeLab

A local recording workspace for technical creators: teleprompter, file previews, browser tabs, terminals, cameras and recording in one app on your Mac.

Start TakeLab from the folder you want to work in:

```bash
/path/to/takelab/takelab
```

Or, from this project folder:

```bash
./takelab /path/to/your/files
```

Existing `workspace`, `browse` and `teleprompt` commands still work. Settings, recording storage, URLs and settings backups remain compatible.

The sections below also cover the standalone file browser and teleprompter.

## Launch

Requires Python 3.10 or newer. No packages or build step to install.

```bash
./browse
```

Your default browser opens automatically. Stop the server with **Ctrl+C** in the terminal.

From **any folder**, use the launcher's full path. It opens your terminal's current folder:

```bash
/path/to/takelab/browse
```

Or pass the folder you want to browse:

```bash
/path/to/takelab/browse ~/Documents
```

For a shorter command, add this line to `~/.zshrc` (or `~/.bashrc` if you use Bash), then open a new terminal:

```bash
alias fp='/path/to/takelab/browse'
```

Then run `fp` from any folder, or `fp ~/Documents`.

You can also run `python3 /path/to/preview.py /path/to/folder`. Options: `--port 8000` to use a fixed port; `--no-open` to print the URL without opening the browser.

## Use

- Click a file to preview it. Click a folder to enter it; use the breadcrumbs or **Parent folder** to go back.
- Click the folder name at the top left to enter another absolute folder path. `~/` works. In Finder, **Option + Command + C** copies the selected folder's path.
- Filter the current folder with the search box (**Command + K**). Toggle **Hidden** to show dotfiles. **↻** refreshes files and the current preview.
- Markdown renders headings, tables, lists, links, code blocks, and relative images. **Source** switches to the original Markdown. Local document links open their previews. External links open a new tab; remote images are intentionally not fetched, so the app stays local.
- Images fit the available space and show their dimensions. Supports formats your browser can display, including PNG, JPEG, GIF, WebP, SVG, and AVIF. Convert HEIC images to JPEG/PNG first.
- Python and other common code formats get syntax highlighting. UTF-8 and UTF-16 text uses a monospace font. Unsupported binary files offer a download.
- Text previews stop at 2 MB; syntax highlighting is skipped above 200,000 characters to keep the UI responsive. Image/download limit: 100 MB.

## Local access

The server binds only to `127.0.0.1`. It serves files inside the selected folder, rejects paths and symlinks escaping it, does not run Python or shell scripts, and never edits your files. HTML pages can render with client-side JavaScript in an isolated browser frame, or show syntax-highlighted source. The folder picker changes the server's current root for all tabs connected to that server. Only open folders you intend to browse.

## Checks

```bash
python3 -m unittest discover -s tests -v
node --check web/app.js
```

Vendored browser libraries are in `web/vendor`; see [third-party notices](THIRD_PARTY.md).

## Teleprompter

A separate Markdown-only teleprompter is also available:

```bash
./teleprompt ~/Documents
```

Includes adjustable type size, auto-scroll speed, manual scrolling, countdown, focus view, mirror mode, and a compact pop-out window. See [standalone prompt guide](TELEPROMPT.md).

## Combined workspace (recommended)

Open the file list, teleprompter, and preview side by side in **one window**:

```bash
/path/to/takelab/workspace
```

Pass a folder if needed: `./workspace ~/Documents`. The existing `start-both` command also opens this combined workspace. Stop an existing launcher with **Ctrl+C** before starting the updated app.

- Left: all files, with folder navigation, filtering, hidden files, and a collapsible sidebar. Use **☷** at the top left to hide or show it.
- Middle: the Markdown teleprompter, with its existing font, speed, countdown, mirror, and manual-scroll controls.
- Right: the file browser preview, supporting Markdown, images, highlighted code, and text.
- Click a file to preview it. The first Markdown selection also loads the teleprompter. The script then stays pinned while you preview other files.
- Click **▶** beside any Markdown file, or **Use in teleprompter** in its **⋯** menu, to change the script.
- Drag either vertical divider to resize the columns. The teleprompter can be as narrow as **180 px**; its font size is separately adjustable in Settings or with A− / A+.
- Dividers also support keyboard resizing: Tab to a divider, then use Left / Right (10 px), Shift + Left / Right (40 px), or Home / End for its width limits.
- Column widths and sidebar visibility are saved in this browser. **Reset layout** restores the default widths.
- Open another folder using the folder selector in the left column. This clears both panes; entering a subfolder keeps the current script and preview open.

The app opens at `http://127.0.0.1:8766/`. Press **Ctrl+C** in the terminal to stop. If that port is busy, use `--port 0` for an available port. Other options: `--port 8000`, `--no-open`. `--browse-port` and `--teleprompt-port` remain accepted for older launcher commands, but only one local server is now used.

The individual `browse` and `teleprompt` launchers remain available for standalone use.

## Terminal for live demonstrations

In the combined workspace, click **Terminal** above the right-hand preview. It opens an interactive local shell in the folder currently shown in the left file list. Check the location with `pwd` or `echo "$PWD"`, then run commands such as `python3 demo.py`. No extra Python packages are required; the terminal renderer is bundled for offline use. Supported on macOS and Linux.

- **File tabs / Terminal** switches the right pane; the shell keeps running while you preview files, and the teleprompter stays independent.
- Use normal shell commands, Tab completion, arrow-key history, and **Ctrl+C** to interrupt a running program. Interactive programs receive a real terminal that resizes with the pane.
- **A− / A+** adjusts terminal text independently of the teleprompter. **Clear** clears terminal scrollback.
- Changing the browsed folder does not change or interrupt a running shell. **Started in** shows its initial location; the footer shows the folder that **Restart here** will use. Click **Restart here** to end the current terminal and open a fresh shell in the new folder, or use `cd` inside the terminal.
- **End** closes the current terminal. Refreshing the page and reopening Terminal reconnects to the same session while this workspace server remains running. Closing a browser tab leaves its shell alive; stopping the workspace with **Ctrl+C** closes its terminal sessions. Up to four sessions can run across browser tabs.

This is a real terminal running as your Mac user: commands can modify files just as they can in Terminal.app. Python and shell files can be previewed or edited; commands run through the terminal. HTML Browse mode runs client-side JavaScript in an isolated page. The terminal API is available only through the workspace launcher on localhost and requires the app's per-process token.

After updating, stop the old workspace and restart it:

```bash
/path/to/takelab/workspace /path/to/demo-folder
```

## File tabs

Clicking a file now opens its own tab in the right-hand pane, alongside **Terminal**. Python, images, Markdown, and text can all stay open together. Selecting an already-open file switches to its existing tab. Each tab keeps its own preview scroll position and Markdown Source/Preview setting while you switch between files. Close a file with **×**; Terminal stays available and its shell keeps running. Long tab lists scroll horizontally.

Use Left/Right or Home/End while a tab has keyboard focus to switch tabs; Delete closes a focused file tab. Local Markdown links open or select another file tab. Opening a different root folder clears the file tabs, while a running terminal stays in its existing directory until restarted.

## Consistent recording area

The right-hand pane goes directly from the tab strip to the inset recording stage. There are no permanent action or file-details rows. Images, code, Markdown, and terminal content share an inset inside the recording stage, including when resizing or switching tabs. The recording frame stays at its fixed top-left corner. Images fit inside the available bounds with their aspect ratio preserved, and the terminal resizes to the same stage.

Click **⋯ (View options)** beside the tabs for Download, Markdown Source/Preview, Use in teleprompter, and the terminal's Restart here, End, Clear, and font-size controls. File details and the terminal's starting folder are shown inside that menu. The menu overlays the page without moving the recording area. Source, download, and terminal lifecycle actions dismiss the menu; font-size controls stay available for repeated adjustments. Close it with Done, ×, Escape, or a click outside.

Use the **aspect ratio selector** beside **⋯** above the browse area to choose **Free**, **16:9**, **16:10**, **4:3**, **1:1**, **9:16**, or **3:4**. Fixed ratios fit within the available space and stay anchored at the recording area's top-left corner. The border marks the selected recording area; images, code, terminal, and expanded cameras share those bounds. The choice saves in this browser. **Free** fills the available area again; **Reset layout** also restores Free.

Content has **24 px of inner spacing** by default to keep letters clear of the frame border and rounded corners. Adjust it under **Appearance → Inner spacing** (0–64 px). Spacing saves in this browser and reduces automatically in small views. Changing it preserves the recording frame's outer bounds and aspect ratio; long documents scroll normally inside the frame.

## Appearance settings

Click **Appearance ⚙** at the top right of the workspace to choose an overall workspace/preview background (a custom color or one of the presets), the right-pane border color, border thickness from 0–10 px, and rounded corners from 0–24 px. Changes apply live and are saved in this browser for the workspace URL. **Restore defaults** resets just these appearance choices.

The frame is painted over the pane edge, so changing its thickness or rounding does not move or resize the recording area. Interface and Markdown text colors adapt to the background for readability. The teleprompter, code highlighting, and terminal retain their own readable surface themes.

## Floating cameras

Click **Cameras** at the top of the combined workspace. Choose a source for **Head camera**, **DIY project camera**, and **Top**, then click **Start** for each. Allow camera access when your browser asks. Camera names may appear only after the first permission grant; use **Refresh cameras** to update the list.

- Use the tiny **person** and **project cube** icons in the top bar to show either camera and bring it to the front. The selected icon is highlighted; switching preserves each view's size and position and does not start a stopped feed.
- Drag a window by its title and resize it from the bottom-right corner. Both windows float over the workspace without moving the recording area.
- Click **⛶** in either camera title bar to fill the browse recording area; click **❐** to return to its previous floating position and size. The feed keeps running. Expanded mode follows browse-column resizing and leaves the saved floating layout intact.
- Positions and sizes save automatically in this browser for the workspace URL. **Save positions** explicitly saves the current arrangement; **Reset positions** restores the default sizes and placement.
- Each camera has independent source, mirror, and framing settings. Head camera defaults to mirrored **Fill window**; project and Top cameras default to unmirrored **Fit whole frame** to keep the project visible.
- Focus a move or resize handle and use arrow keys for 5 px adjustments, or Shift + arrows for 20 px.
- **Show all windows** opens paused windows. Closing a window stops its camera; **Stop all** releases all three. Reloading restores the layout and settings, with cameras off until you click Start again.

Use separate devices for the three views, such as a built-in webcam and a USB camera. Camera previews stay in the browser and do not capture microphone audio themselves. Use the workspace recorder to capture overlays inside the browse frame with narration, or include them in an external screen recorder's capture area.

Camera lifecycle checks: `node --test tests/camera-stream.test.cjs`.

## Camera picture settings

Click **⚙** on a camera window, or **Cameras → Adjust picture**, to open that camera's settings. The panel opens on the left so you can watch the camera on the right while adjusting it. Select Head, DIY, or Top at the top to switch cameras.

- **Lighting:** brightness, contrast, saturation, and warm/cool color adjustment. These are software adjustments to the displayed picture.
- **Framing:** digital zoom, horizontal/vertical offsets, 90° rotation steps, and rectangle, rounded rectangle, or circle shape. Mirror and Fit/Fill remain in the Cameras menu.
- **Border:** independent color, thickness (0–16 px), solid/dashed/dotted style, and rounded-rectangle corners (0–60 px). Circle uses a circular border; Rectangle stays square. Set thickness to 0 to hide the border. Borders overlay the picture and keep camera bounds and framing fixed. These settings save automatically and are included in presets.
- **Auto-center:** optional local face detection with a smooth crop. When no face is detected, it holds the last framing. Tracking and face touch-up default to off for all cameras; keep them off on the DIY view for fixed framing.
- **Touch-up:** adjustable, subtle cheek softening on a detected face, leaving the eyes and mouth sharp.
- **Background:** off, person/background blur, transparent removal, solid color, or a local PNG/JPEG/WebP image. Background segmentation is intended for people, not objects or entire DIY projects. Transparency reveals the workspace underneath. A replacement image is saved locally in browser storage, resized to a maximum 1920 px edge. Clear image removes that saved image; image mode then uses the chosen solid color.
- **Quality:** request Highest available (native), 4K, 1080p, 720p or 480p and 15/24/30/60 fps. New camera defaults use Highest available; existing saved quality selections are preserved. Changes apply to the live camera without restarting it when supported. The panel shows actual capture dimensions and frame rate. Normal preview processing scales to the displayed canvas size (at least a 1280 px processing budget) and up to 30 fps. Separate recordings process original camera pixels at the selected camera/recording frame-rate limit; face/background analysis still uses a smaller image up to 10 fps. Processing speed and segmentation quality vary with hardware, lighting, motion, and hair edges.
- **Device controls:** focus, exposure, white balance, or optical zoom appear only when the running camera exposes them. These hardware controls apply for the current session and are separate from saved picture presets.
- **Presets:** name and save up to 12 picture presets per camera; saving an existing name updates it. Apply recalls effects and quality. Each camera has one shared saved background image. Camera source, window placement, visibility, and mirror/Fit settings remain separate. **Reset adjustments** restores picture defaults and keeps the window layout and source.

All picture settings and presets save in this browser for the workspace URL. Reloading preserves settings while leaving camera feeds off. Face detection and segmentation run in a local worker using bundled MediaPipe models; no camera frames are sent to a server or cloud service. If a background effect cannot load, it leaves the picture blank with a status message; select Background **Off** to return to the normal feed. Camera adjustments do not create a virtual camera device. Use the workspace recorder or your normal screen recorder to capture the displayed result.

Restart the workspace server after updating to enable the local vision worker's WebAssembly policy. Models and runtime are bundled for offline use; third-party provenance is in `web/vendor/mediapipe/README.md`.

Verify camera settings and lifecycle: `node --test tests/camera-*.test.cjs`.

## Record the browse area with audio

Use current **Chrome** on your Mac and click **● Record** at the top. Choose **4K**, **1080p** or **720p**, 30 or 60 fps, a countdown, and your microphone. **Use 16:9 browse frame** sets the browse aspect ratio for standard 1920 × 1080 or 1280 × 720 output. Portrait and other ratios retain their proportions within the selected HD bounds.

1. Start your camera views and place them inside the browse frame. Their effects, shapes, borders, and stacking are captured as displayed. Parts outside the frame are excluded.
2. Click **Start recording**. In Chrome's share picker, choose **this workspace tab**. A screen, window, or another tab is rejected instead of silently recording the wrong area. Allow microphone access when asked.
3. To include shared-tab audio, enable the option in the app and the share picker's audio checkbox. Availability depends on the browser and macOS. When unavailable, the app reports that it is recording the microphone only. Microphone and shared audio are mixed into one audio track; your microphone is not played through your speakers.
4. The panel closes when recording begins. A large red **RECORDING** badge and timer stay in the top bar; pausing changes the badge to amber **PAUSED** and freezes the timer. A matching colored line runs below the header. Use the clearly labeled top controls to **Pause / Resume**, **Stop**, or **Mute mic**. Setup and saving use a blue badge. These indicators stay outside the captured browse frame and keep the recording coordinates fixed. Pausing excludes that time from the take; the live microphone and camera previews remain on. Muting the microphone leaves shared-tab audio enabled.
5. On Stop, the take appears under **Saved takes** with a video preview and **Download recording**. MP4 with H.264/AAC is preferred when supported, with other MP4 or WebM encoders as fallbacks. The download extension matches the actual container.

**Optional separate camera videos:** In Record settings, enable **Save cameras separately · clean screen video** before Start. Each camera already live at the start produces its own Head camera, Project camera, or Top take, alongside a clean browse recording without camera overlays. Camera windows temporarily disappear during capture and return on Stop, cancellation, or failure; their feeds and processed canvases keep running. With the option off, the browse recording includes visible camera overlays as before. Camera videos include the processed picture, effects, framing, shape and border, plus microphone audio; shared-tab audio stays in the browse take. Start, Pause/Resume, Stop and Mute mic apply to all outputs. Choose each file under **Saved takes** to preview and download it. Separate camera output uses the native capture resolution and the camera view’s aspect ratio, independently of the preview window size and combined-video quality. Fill crops at native detail; Fit can add letterboxing to preserve the full sensor picture. Dimensions are fixed at Start. The camera settings panel shows capture dimensions, separate recording dimensions and preview dimensions. Transparent areas are filled dark. Keep this tab visible. Starting a camera mid-take does not add a file; stopping or changing a camera finalizes its current file while the browse recording continues. Recording Stop leaves live camera previews on. Recording multiple HD streams increases CPU and storage use.

The teleprompter and top controls are outside the cropped recording. Keep the workspace tab visible while recording. Anything covering the browse frame, including a settings popup or camera controls you reveal, appears in the recording. Output dimensions remain fixed throughout a take; resizing or changing the frame ratio letterboxes the source to preserve its proportions. Resolution and frame rate are targets: source detail depends on the browse viewport, display scaling, and capture resolution, and actual frame rate depends on hardware load. The panel displays source and output dimensions. The combined video contains the camera as displayed in the browse frame; separate camera files retain native camera detail.

Video chunks are checkpointed to the browser's private local file storage as the encoder delivers them (requested roughly every second). Each chunk is closed independently, so a browser crash does not discard the entire open take. After an interruption, reopen the **same browser profile and workspace URL, including port**, then open **Record → Saved takes**. Interrupted takes are assembled automatically and marked **Recovered**, including separate camera files. Other tabs cannot recover a take that is still actively recording. Recovery applies to new recordings made with this version. The latest uncheckpointed footage may be lost; browsers can delay chunk delivery, and interrupted media is not guaranteed playable and may need external repair. Browser storage deletion/eviction or disk failure can still destroy saved data. Use Stop normally whenever possible. During final assembly, allow room for both the chunks and the finished file; if assembly fails, checkpoints remain for a later retry. Completed takes survive a reload at the same workspace URL and remain listed for download. They are separate from your browsed folder and are never uploaded. Download important takes independently of browser storage, which can be cleared or evicted. If disk storage is unavailable, the panel reports a session-only memory fallback with a 512 MB total limit and **no crash protection**. Quota or encoder errors stop capture and offer any usable saved data; an empty take is reported as a failure. Finish recording before closing or reloading the page.

Microphone and screen-sharing resources are released on Stop, setup cancellation, or failure. Stopping recording does not stop your independent camera previews. If Chrome or macOS blocks capture, check permissions and retry. Audio/device preferences save in this browser; screen-sharing permission is requested again for each take.

Recorder validation: `node --test tests/recorder*.test.cjs tests/recording-library.test.cjs`. Browser verification uses synthetic video and microphone/tab tones; physical microphone and screen-sharing permissions must be granted by you when recording.

## HTML Browse and Source

Click a `.html` or `.htm` file to open its rendered page in the browse column. Use **Browse / Source** above the recording frame to switch between the page and syntax-highlighted HTML. The same switch is available through **⋯ → Source / Browse**. Each open tab keeps its mode, and switching modes preserves the page state and source scroll position. The standalone file browser uses its existing Source/Browse button.

Relative local CSS, images, scripts, JavaScript modules, fonts, and JSON assets load from the selected folder. HTTPS resources such as CDN scripts and fonts can also load. Use project-relative asset URLs; root-relative URLs such as `/style.css` refer to the app server root. Applications requiring their own backend or development server still need that server.

Rendered HTML is sandboxed separately from the workspace: browser storage such as localStorage is unavailable, and page scripts cannot read app storage, access the parent document or workspace APIs, open popups, submit forms, or request camera/microphone access. Local web assets remain restricted to the selected folder. The Source view displays the original file, not the page's modified live DOM.

After updating, restart the workspace server to enable the HTML preview route, then refresh the browser.

## Settings backups

Click **Settings** in the main top bar, then **Save settings backup** to download a versioned JSON backup. Use **Load settings backup** to restore it. Loading replaces saved preferences and reloads the workspace; finish recording first. The backup includes camera positions/sizes/sources, effects and presets for Head, Project and Top, background images, column layout, appearance and borders, browse aspect ratio, recording preferences, terminal font size and teleprompter settings. Cameras remain off after loading until started. Permissions, session-only device hardware adjustments, open files and recording files are excluded. Missing camera devices can be reassigned after import. Keep backup files locally if they include private background images.

Use **+ ›_** beside the reference tabs (or **⋯ → New terminal**) to open another independent terminal in the currently browsed folder. Up to four terminal tabs can coexist, each preserving its shell, working directory, output and running command while switching to another tab. Every terminal tab has an **×** button that ends that shell; **End**, **Restart here**, **Clear** and font controls in **⋯** apply to the selected terminal. Tabs reconnect to their sessions after a refresh while the workspace server remains running. The terminal footer is removed so its space is available for output.

New or restarted terminals automatically set their normal and continuation prompts to `Schogini1> `, `Schogini2> `, etc., matching the terminal tab number. Existing running sessions keep their prompt until restarted.

### Paste as typing

Select a terminal, then click **Paste as typing** beside its tabs (also in **⋯**). Click **Read clipboard**, or paste into the editable text box with **⌘V**, review it, select a speed, and click **Start typing**. Text is sent to that shell one Unicode character at a time with small timing variations. Speed choices are 5, 12, 25 and 50 characters per second; network latency can slow the actual rate. Speed saves with workspace preferences. Clipboard text is not saved in the settings backup.

By default, line breaks become spaces so a multiline paste does not execute commands automatically. Optionally enable **Press Enter between lines** to run completed lines as typing proceeds. Trailing newlines are removed in either mode; press the final Enter yourself. Tabs become spaces and control characters/ANSI color sequences are stripped. Use **Stop typing** to cancel. Switching tabs, closing/restarting/ending/clearing the terminal, or typing directly into it also cancels the remaining text. Characters already sent remain in the shell. Up to 20,000 characters can be typed per operation.

For recording, use **Paste clipboard** beside the selected terminal’s tabs. It reads the clipboard and immediately types into that terminal at the chosen speed without opening the popup. It follows the popup’s newline option and leaves the final Enter manual. **Paste as typing** remains available for editing text and changing options. If clipboard permission is unavailable, the button reports failure; use the popup to paste with **⌘V**. Switching or restarting the destination while clipboard permission is pending cancels the paste.

## Editing text and scripts

Open a TXT, HTML, Python, Markdown, or other text/script file and click **Edit** above the browse view. The standalone file browser also has an **Edit** button. Edit the raw source in the monospace text area, then click **Save** or press **⌘S / Ctrl+S**. **Cancel** or **Escape** returns to preview; unsaved edits require confirmation before discarding. Switching tabs keeps the draft in its own file tab. Closing a dirty tab, switching folders, or leaving the app protects unsaved changes. Drafts are held in the current browser tab, not backed up automatically.

Save updates the original existing file, then refreshes the preview, including rendered HTML. A Markdown script currently loaded into the teleprompter is refreshed too. Text files up to 2 MB are supported. Binary files, images, unsupported encodings, and truncated previews cannot be edited. UTF-8/UTF-16 byte order and BOM, CRLF line endings, and file permissions (including executable bits) are preserved. Saves use a temporary file in the same directory and replace the destination atomically. Files must stay inside the open folder and be writable. A content revision check refuses to overwrite external changes; copy your draft, cancel, and reopen Edit to load the current file before retrying. Saving requires the app’s process token and a valid local origin. Restart the workspace launcher after updating to enable the edit API.

## URL browser tabs

Click **+ Web** beside the reference tabs, enter an HTTP/HTTPS URL and press **Go**. Bare domains default to HTTPS; localhost/loopback addresses default to HTTP. Each site opens in its own closable tab alongside files and terminals. Switching tabs preserves the page and scroll state while the workspace remains open. The same browse frame, aspect ratio, inner spacing and recording coordinates apply; no address-bar row is added inside the recording area. Use **URL ▾** to enter another address, **↻ Refresh** (also **URL ▾ → Refresh page**) to reload the entered address, or **↗** to open that address in a full browser tab.

Enable **URL ▾ → App mode · Streamlit / interactive apps** for apps that need their own cookies, storage or WebSocket origin. This is selected automatically when you enter localhost:8501, 127.0.0.1:8501, [::1]:8501 or a *.streamlit.app address. Hosted Streamlit URLs also receive `embed=true`. A different Streamlit port can use App mode manually. Click Go to apply a changed mode. App mode preserves the separate app server’s origin; it cannot be used with the workspace’s own URL. Camera, microphone and clipboard permissions remain disabled in embedded web tabs.

Websites may refuse framing through their own policies; sign-in, storage-dependent features, popups and some scripts may also require a full browser. Use **↗** in those cases. The workspace cannot reliably detect framing refusal. Web pages normally run with an opaque origin; App mode retains the separate app’s own origin for storage and server connections. Both modes keep scripts and forms enabled, with microphone, camera, clipboard and top-level navigation disabled. The URL control, reload and external-open actions use the last address entered in the app; links followed within a site cannot always be reflected there. Browser tabs are not restored after a page refresh or included in settings backups. Restart the workspace launcher after updating to enable external web frames.

To remove an old take, open **Record → Saved takes**, select the file, and click **Delete selected recording**. Confirm the filename to remove only that browser-stored video, its metadata, and any remaining recovery chunks for that take. Deletion is permanent and is disabled while recording or saving. Other takes, downloaded copies, camera preferences, settings backups and workspace settings are preserved. A file still being recorded in another tab cannot be deleted. Each separate camera video is its own take and must be selected individually.

## PDF previews

Click a `.pdf` file in the left file list to open it in its own browse tab. The bundled offline PDF.js viewer supports scrolling, selectable text, previous/next page controls, a page-number box, Fit width/Fit page, zoom buttons, and Download. Each file tab keeps its PDF page and zoom while switching to files, web tabs, or terminals. PDFs use the same recording frame and aspect-ratio layout as other previews. **View options → Open PDF ↗** opens the original in a full browser tab; Download also remains available there.

PDF previews work offline using the vendored Mozilla PDF.js runtime and assets; documents are never uploaded. PDF scripting and XFA are disabled. The PDF preview/download limit is 100 MB, and PDF files cannot be edited as text. Restart the workspace launcher after updating, then refresh the browser.

## Laser pointer and browse annotations

Use **Annotate ▾** above the browse area to choose **Laser**, **Pen**, or **Highlighter**. The **●** button toggles the laser directly. Move the laser to point with a glowing dot and a short fading trail; drag the pen or translucent highlighter to leave marks. Adjust each tool’s color and thickness in the menu. **↶** undoes the last mark; **×** clears the active tab’s marks, and Undo can restore that clear. **Done** or **Escape** returns to normal clicking, scrolling, text selection and terminal input. **⌘Z / Ctrl+Z** undoes while a drawing tool is active.

Annotations work over images, Markdown, code, PDFs, web pages and terminals. Marks belong to each open tab, scale with the browse viewport, and stay while switching tabs. Switching tabs returns to Interact mode. These are screen overlays: they do not attach to words or follow scrolled content, and they do not modify source files. Clear marks before scrolling to a different part of a document. Saving an edited file or reloading/navigating a web tab clears its marks. Closing a tab or reloading the app discards its marks; colors and thickness save in the settings backup. Up to 500 marks per tab and the last 100 undo actions are retained.

The laser and marks are drawn inside the browse recording frame, so they appear in the main video without changing the recording coordinates. Separate camera videos contain their processed camera picture and do not include browse annotations. Tool controls stay outside the capture area; the settings popup should be closed during recording.

Chrome’s sharing strip is browser UI. During capture, the workspace compensates for up to 96 px of added browser chrome by reducing its own header and, for taller strips, moving the layout upward, preserving the browse frame’s screen position and available height. Recording controls dock at the lower left, outside the browse capture, until the strip disappears. Normal window resizing still resizes the workspace.

### Camtasia-compatible download

Under **Record → Saved takes**, select a take and click **Download for Camtasia**. The local workspace server uses FFmpeg to make a constant-frame-rate H.264 MP4 with 48 kHz AAC audio, at the take’s saved 30 or 60 fps (older takes default to 30). The download starts when conversion finishes; a download link remains available. Import that converted file into a matching-frame-rate Camtasia project. The original recording, other takes and settings stay unchanged. This also works for separate camera takes.

Requires FFmpeg (`brew install ffmpeg`) and a restarted workspace launcher after this update. Conversion stays on this Mac, uses temporary disk space for the input and output, and can take several minutes. Keep the page open. Start recording, delete and take selection are disabled during export. Inputs up to 8 GB are accepted. The previous temporary export is cleared when the next export starts; temporary files are also removed when the workspace server shuts down. The original browser recording remains available if conversion fails.

**Delete all recordings** under Saved takes removes all currently listed screen and separate camera takes from this browser after confirmation. Settings and downloaded copies are preserved. The action is disabled while recording, converting or deleting. Recordings locked by another tab are kept; any failures are reported and remaining takes stay listed.

**Record → Sharing bar offset** defaults to Automatic and rechecks while sharing is active. If Chrome reports no height change or the frame still shifts, select a pixel offset while recording (for example 64 px); larger values move the frame upward. The choice is saved with recording preferences and settings backups. Off disables compensation. Large offsets can partly hide the upper tabs behind browser chrome; the recording controls dock at the lower left. This adjusts workspace layout; it does not hide Chrome’s sharing indicator.

The workspace teleprompter starts directly at the top of its column. The former title and filename rows are removed; **Prompt ⚙** in the main toolbar opens reading settings as an overlay. Hover that button to see the current script path. The standalone teleprompter retains its own toolbar.

The main workspace toolbar is docked at the bottom, leaving the teleprompter at the page’s top edge. Record, Prompt, Cameras, Settings, Appearance and layout controls stay in that bottom row; their workspace popovers open above it. Browser-owned sharing notifications remain outside the app.

### Floating teleprompter near the camera

Click **Pop out ↗** in the bottom workspace toolbar to open an optional compact teleprompter. It requests a position centered near the camera at the screen’s top usable edge. The page has no title row, sidebar, border or top padding; play/pause, restart, font size, speed, Settings, width, Top and Close controls are along the bottom. Drag the window edge or use **W− / W+** to change its width; **Top ↑** requests the screen’s top usable edge again. Size and horizontal position save in this browser and are included in settings backups.

Selecting another script in the workspace’s teleprompter updates the popup. Opening it pauses the embedded teleprompter; playback in the popup is independent. Allow pop-ups for the local workspace if needed. Chrome/macOS control window placement, minimum size, title bars and stacking: a web page can remove its own chrome but cannot guarantee an OS-borderless, always-on-top window or overlap the macOS menu bar.

For maximum camera detail, choose **Cameras → Adjust picture → Quality → Highest available · native**, start the camera, and check its reported capture dimensions. Enable separate camera files in Record for native-resolution output. **Record → Quality → 4K** controls the combined screen video; it does not cap the separate cameras. Native capture is requested without browser resizing and negotiated against device capabilities at the chosen frame rate. Hardware, USB bandwidth, browser codecs and CPU load can limit what is available; no upscaling can recover missing capture detail. Higher resolutions increase CPU, disk use and file size.
