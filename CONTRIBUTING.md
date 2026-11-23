# Contributing to TakeLab

Bug reports, documentation fixes and focused pull requests are welcome. For a larger feature, open an issue first to discuss the intended behavior.

## Development

Clone the repo and run `./takelab ./examples`. Core development needs Python 3.10+, Node.js 22+ for JavaScript tests, and macOS or Linux for PTY tests. FFmpeg plus ffprobe enable the real conversion tests; they are skipped when unavailable. There is no frontend build or core pip dependency.

```bash
python3 -m unittest discover -s tests -q
node --test tests/*.test.cjs
```

Run commands from the repository root. Python tests start ephemeral loopback servers, create temporary folders and owned shell processes, and clean them up. Do not point fixtures at personal files. Tests do not require real cameras, microphones, OAuth credentials or uploaded media.

For recording changes, also do a short manual Chrome take with your own consented devices: verify audio sync, pause/resume, separate-camera outputs, saved-take recovery and Camtasia conversion. Describe hardware/browser versions and any untested paths in your PR. Automated media tests alone cannot establish long-session sync or device compatibility.

For a credential scan, run `gitleaks dir .` with the checked-in configuration. The narrowly scoped allowlist covers only xterm.js's `FourKeyMap` export assignment, which resembles a key to the generic detector.

## Pull requests

Keep changes focused, explain the user-visible behavior and include relevant validation. Add a regression test for a behavior change when practical. Preserve compatibility with saved settings, browser recordings and the legacy launchers. Keep third-party license files with vendored assets; document source versions and hashes when updating them.

Do not commit `.env` files, tokens, recordings, browser profiles, local environments or personal paths. Report security issues privately through [SECURITY.md](SECURITY.md), rather than a public issue.

By submitting a contribution, you agree that your contribution can be distributed under the project's MIT license. Third-party material must retain its applicable license and attribution.
