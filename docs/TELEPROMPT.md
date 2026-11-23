# TakeLab Prompt

A separate local Markdown teleprompter, alongside TakeLab Files. Requires Python 3.10+. No installation, internet, or Python packages needed.

From any folder, run:

```bash
/path/to/takelab/teleprompt
```

Or choose a script folder:

```bash
/path/to/takelab/teleprompt ~/Documents
```

The app opens at http://127.0.0.1:8766. Stop it with **Ctrl+C** in the terminal. If that port is busy, add `--port 0` for an available port, or choose a port with `--port 8767`. `--no-open` skips automatically opening the browser.

## Reading

- Select a Markdown file from the left sidebar. Nested folders are navigable; other file types are excluded. Supported extensions: `.md`, `.markdown`, `.mdown` (case insensitive).
- Click the folder name to switch folders by path. **Home** in the folder breadcrumbs returns to the open folder's root. Refresh updates the script list; reselect a script to reload changes.
- **Settings** controls font size (16–96 px), auto-scroll speed (5–160 px/second), line spacing, reading width, countdown, mirror mode, reading guide, and light/dark theme. Preferences are saved in this browser for this local URL.
- **Start / Pause** controls smooth auto-scroll. Scroll speed is independent of font size. A countdown gives you time to get ready. Auto-scroll stops at the end and pauses when you scroll manually or switch tabs.
- Scroll with your mouse/trackpad or use the keyboard. After manually scrolling, **click the script once** to resume auto-scroll immediately, without a countdown. Selecting text does not resume playback. You can also use Space or the Resume button. **↺** returns to the beginning.
- **Focus** hides the sidebar and settings for a compact reading view. Text is aligned toward the top left.
- **Pop out** requests a resizable 560 × 640 window at the screen's top left with the current script. Browser window-position policies may override this; you can drag and resize the window yourself. Allow pop-ups for the local app if needed. The main window pauses before opening it. The new window starts the selected script from its beginning.
- Mirror mode flips the script horizontally for use with teleprompter glass.

| Shortcut | Action |
| --- | --- |
| Space | Start / pause (or cancel countdown) |
| ↑ / ↓ | Scroll one line; pause auto-scroll |
| Page Up / Page Down | Scroll most of a page |
| ← / → | Slower / faster auto-scroll |
| + / − | Larger / smaller text |
| Home | Back to beginning |
| End | End of script |
| F | Enter / exit focus view |
| Esc | Exit focus view |

Shortcuts apply while the reading area has focus; click the script if you were adjusting a control. Buttons and form fields retain their standard keyboard behavior.

Markdown headings, lists, emphasis, tables, and code are rendered. Images and embedded media are omitted to keep the reading view focused on spoken text. Links are displayed as text. Scripts over 2 MB are rejected rather than silently cut off. Files are never modified or executed. The local server and folder access protections are shared with Folder Preview; switching folders applies to all tabs/pop-outs of this TakeLab Prompt server. Run TakeLab Files separately with `browse`.

For a short Terminal command, add to your shell configuration:

```bash
alias tp='/path/to/takelab/teleprompt'
```

Then use `tp` or `tp ~/Documents`.

## Combined workspace

Use `./workspace` (or the existing `./start-both`) for a single window with the collapsible file list on the left, a resizable teleprompter in the middle, and file previews on the right. The script stays pinned while you browse references. Drag its right edge to make it narrow, and use **▶** beside a Markdown file to replace the script. See [README.md](USER_GUIDE.md#combined-workspace-recommended).
