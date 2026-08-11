# Text Jellyfin

A personal, self-hosted document library inspired by Jellyfin — for text.

Point it at a folder of `.md`, `.txt`, `.docx`, and `.pdf` files. Text Jellyfin indexes titles, summaries, and tags, then renders each document as a native article instead of forcing you through a PDF viewer.

## Features

- Library browse with search, tags, format, and extraction status
- Markdown, plain text, Word (DOCX), and text-layer PDF ingestion
- Sidecar YAML metadata for non-Markdown files
- Cached, sanitized HTML article reader
- Original-file download fallback
- SQLite + FTS5 full-text search
- Full-app Basic Auth login (default `admin` / `admin`) and phone uploads for Markdown, text files, and pasted notes
- Docker-friendly self-hosting
- Always-on Windows Service with an optional attach-only Electron client

## Quick start

Requirements: Node.js 22–24 (22/24 recommended). Node 26 is not yet supported by the pinned SQLite driver.

```bash
npm install
cp .env.example .env
npm run scan
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

By default the library path is `fixtures/library` and app data lives in `data/`.

## Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `LIBRARY_PATH` | Folder of source documents | `./fixtures/library` |
| `DATA_PATH` | SQLite DB + generated article cache | `./data` |
| `MAX_FILE_BYTES` | Per-file size limit | `41943040` (40 MB) |
| `MAX_UPLOAD_BYTES` | Per-upload limit for phone uploads | `5242880` (5 MB) |
| `AUTH_USERNAME` | Full-app Basic Authentication username | `admin` |
| `AUTH_PASSWORD` | Full-app Basic Authentication password | `admin` |
| `ADAPTER_TIMEOUT_MS` | Per-document extraction timeout | `60000` |

## Phone uploads

Authentication defaults to `admin` / `admin`. Override `AUTH_USERNAME` and
`AUTH_PASSWORD` in the server environment, then restart the app. Your browser
will prompt for the credentials before it can read the library or upload. Once
authenticated, open the **Upload** page from your phone. Uploaded `.md`,
`.markdown`, and `.txt` files are saved under `uploads/` inside your library.
You can also paste text and choose whether to save it as Markdown or plain text.

On a trusted home network, open `http://SERVER_IP:3000/upload` from your
phone. Keep port 3000 private to that network—do not port-forward it to the
internet. The library volume must remain writable for uploads to work.

For a Docker deployment, credentials default to `admin` / `admin`. Override them
in a `.env` file next to `compose.yaml`:

```bash
AUTH_USERNAME=reader
AUTH_PASSWORD=use-a-strong-unique-password
```

Basic Authentication keeps the experience simple on a private network, but
HTTP does not encrypt its password. Use HTTPS when the network is not fully
trusted, and do not expose the app directly to the public internet.

## Metadata

Markdown can use YAML frontmatter:

```markdown
---
title: On Notes
summary: Why local text libraries beat PDFs.
tags: [notes, workflow]
---
```

Other formats use sidecar files next to the source:

```text
document.pdf.meta.yaml
document.docx.meta.yaml
notes.txt.meta.yaml
```

Editing metadata in the UI writes only the sidecar. Source files are never rewritten.

## Scripts

```bash
npm run scan      # index / refresh the library
npm run dev       # development server
npm run build     # production build
npm run start     # run production server
npm test          # unit / adapter tests
```

## Windows Service and optional desktop client

Version 0.10.0 is a per-machine installation. WinSW starts the packaged Node
24 runtime and Next.js standalone `server.js` as
`NT AUTHORITY\LocalService`, before any user signs in. Electron is only a
client: it reads the machine configuration, performs an authenticated
`/api/health` check, and attaches to `http://127.0.0.1:3000`. Closing Electron
exits the client by default and never stops the service. Tray mode and
start-at-login are optional and off by default.

Machine configuration is stored in
`%ProgramData%\TextJellyfin\server.json`:

```json
{
  "libraryPath": "C:\\Users\\Aaron\\Documents\\Text Jellyfin Library",
  "dataPath": "C:\\ProgramData\\TextJellyfin\\data",
  "port": 3000,
  "auth": {
    "username": "textjellyfin",
    "password": "installer-generated-secret"
  }
}
```

Port 3000 is fixed. Installation fails if another program owns it. The
installer grants LocalService Modify access to the configured library and
ProgramData tree, limits configuration-file access to LocalService,
Administrators, SYSTEM, and the installing user, and creates a Private-network
firewall rule. It never writes mutable state under Program Files.

Use an elevated shell to manage the service:

```powershell
sc.exe query TextJellyfin
sc.exe stop TextJellyfin
sc.exe start TextJellyfin
Get-Content "$env:ProgramData\TextJellyfin\server.json"
```

Uninstalling v0.10.0 removes the service and firewall rule but intentionally
keeps the configured library, uploads, sidecars, and ProgramData config/data.

### Build the machine installer

Build on Windows x64 with Node 24.19.0:

```powershell
npm ci
npm test
npm run lint
npm run build:desktop
```

The result is
`dist\Text-Jellyfin-Machine-Setup-0.10.0.exe`. The build downloads and verifies
Node 24.19.0 (`node-v24.19.0-win-x64.zip`, SHA-256
`57f71ab3652e797d84acddc79c81cc9ff1c6ddb2a1974cdb83f00fee9bff4c73`)
and WinSW 2.12.0 (`WinSW-x64.exe`, SHA-256
`05b82d46ad331cc16bdc00de5c6332c1ef818df8ceefcd49c726553209b3a0da`).
It rebuilds `better-sqlite3` from source under Node 24, then loads and queries
it with the exact packaged `node.exe` before creating the installer.

In GitHub, run **Actions → Build Windows release → Run workflow** on the
feature branch with `publish_prerelease` left off. Download the
`text-jellyfin-v0.10.0-machine-installer` workflow artifact. Enabling that
input is an explicit prerelease publish path, not a production release.

### Manual v0.9.0 → v0.10.0 migration test

This migration is assisted, manual, and reversible. v0.10.0 uses the distinct
`com.textjellyfin.machine` application identity and `machine.yml` update
channel, so v0.9.0's per-user `latest.yml` updater cannot install it silently.

1. Back up the complete existing
   `%USERPROFILE%\Documents\Text Jellyfin Library` folder, including
   `uploads\` and `*.meta.yaml` files.
2. In v0.9.0 choose Quit from its tray icon. Confirm no Text Jellyfin window or
   server remains and that port 3000 is free.
3. Run `Text-Jellyfin-Machine-Setup-0.10.0.exe` and approve UAC. Keep the
   preselected existing `Documents\Text Jellyfin Library`, or browse to the
   authoritative library.
4. The installer leaves v0.9.0 installed, removes its launch-at-login entry,
   creates fresh `%ProgramData%\TextJellyfin\data`, installs/starts the
   LocalService service, performs an authenticated health check, and runs a
   complete rescan. It does not copy the old SQLite/WAL files.
5. Open the optional client. Validate Settings shows service mode v0.10.0,
   compare total/ready/warning counts, open representative documents, verify
   sidecar metadata, and test an upload. Credentials for phones are readable
   by the installing user in `server.json`.
6. Keep v0.9.0 until this validation is complete. Do not run both generations
   at once against port 3000.

Rollback: uninstall **Text Jellyfin** v0.10.0 from Windows Settings (or stop
and uninstall the `TextJellyfin` service), then relaunch the retained v0.9.0
per-user app. It uses its original user-data database and the unchanged
library. If needed, restore only the library backup—not the v0.10.0 derived
ProgramData database.

### Machine updates after v0.10.0

Later machine-channel updates require UAC. The installer stops the service,
copies the derived SQLite/WAL files into a timestamped ProgramData backup,
replaces binaries, restarts the service, and requires an authenticated health
check. The Electron client uses only `machine.yml`; migration v0.10.0 is
published as a separately triggered prerelease. Code-sign installers before
public distribution to avoid Windows SmartScreen warnings.

## Docker

```bash
docker compose up --build
```

Mount your real library and a persistent data volume:

```yaml
volumes:
  - ./my-documents:/library
  - textjellyfin-data:/data
```

## PDF notes

- Text-layer PDFs are extracted into articles.
- Multi-column or design-heavy PDFs may have imperfect reading order and are marked with warnings.
- Image-only / scanned PDFs are marked `needs_ocr`. OCR is planned for a later phase.

## Security

This app is intended for personal/local or trusted LAN use. Basic Authentication
defaults to `admin` / `admin` — change those credentials before sharing the
network. Do not expose it to the public internet without HTTPS and a strong
password.
