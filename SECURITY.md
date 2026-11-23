# Security

## Supported versions

Security fixes target the latest release on the main branch. Update before reproducing a report.

## Report privately

Use [GitHub private vulnerability reporting](https://github.com/schogini/takelab/security/advisories/new). Include the affected version, reproduction steps, expected impact and a minimal example without credentials or private recordings. Please allow maintainers time to investigate before publishing details. No response-time guarantee is offered.

If the private reporting form is unavailable, use the contact options on [Schogini's website](https://www.schogini.com) to request a private reporting channel; do not post exploit details in public issues.

## Local trust boundary

TakeLab runs on loopback (`127.0.0.1`) and can edit files and launch terminals with your user permissions. It is intended for one trusted local user, not remote hosting or multiple users. Do not expose its port through tunnels, reverse proxies or a LAN bind. Launch it in folders you trust, and inspect scripts before executing them. A terminal is a real shell, not a sandbox.

Write, terminal and export endpoints use local token/origin protections. Browser restrictions on embedded pages are not a guarantee against hostile content. Only browse trusted HTML/PDF/web content while the workspace has file and terminal access.

Camera and microphone access follows browser permission prompts. Saved recordings and settings live in browser storage and are not encrypted by TakeLab; other users of the same browser profile may access them. Never include private media or credentials in bug reports.
