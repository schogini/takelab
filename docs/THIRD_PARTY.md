# Third-party browser libraries

Included locally for offline use. Copyright notices are retained in the library source files.

- Marked 15.0.12 — MIT — https://github.com/markedjs/marked
- DOMPurify 3.2.6 — Apache-2.0 OR MPL-2.0 — https://github.com/cure53/DOMPurify
- Highlight.js 11.11.1 and GitHub Dark theme — BSD-3-Clause — https://github.com/highlightjs/highlight.js

- xterm.js (`@xterm/xterm`) 5.5.0 — MIT — https://github.com/xtermjs/xterm.js
- xterm.js FitAddon (`@xterm/addon-fit`) 0.10.0 — MIT — https://github.com/xtermjs/xterm.js/tree/master/addons/addon-fit

## Camera effects

- MediaPipe Tasks Vision 1.2.0 — Apache-2.0. Runtime notices are retained in `web/vendor/mediapipe/LICENSE`; upstream URLs and checksums are in `web/vendor/mediapipe/README.md`.
- The bundled BlazeFace short-range detector and Selfie Segmentation landscape models are Apache-2.0, as stated in Google's [BlazeFace short-range model card](https://storage.googleapis.com/mediapipe-assets/MediaPipe%20BlazeFace%20Model%20Card%20%28Short%20Range%29.pdf) and [Selfie Segmentation model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Selfie%20Segmentation.pdf). Exact artifact URLs and checksums are in `web/vendor/mediapipe/README.md`; their Apache license is retained in that directory.

## PDF viewer

- PDF.js 6.5.438 — Apache-2.0. See `web/vendor/pdfjs/LICENSE` and `web/vendor/pdfjs/README.md`.
- PDF.js includes additional font, color-profile and WebAssembly components. Their individual notices remain in `standard_fonts/`, `cmaps/`, `iccs/` and `wasm/` inside `web/vendor/pdfjs/`. Keep these files when redistributing; TakeLab's own license does not replace them.

## Optional external programs

FFmpeg is invoked as a separately installed local executable for Camtasia exports; no FFmpeg executable is bundled here. FFmpeg build licensing varies with enabled components. If a future release bundles FFmpeg, review the exact build and its distribution obligations first: https://ffmpeg.org/legal.html.
