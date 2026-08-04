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
- Optional full-app login and phone uploads for Markdown, text files, and pasted notes
- Docker-friendly self-hosting
- Windows desktop installer with startup and in-app update support

## Quick start

Requirements: Node.js 20–24 (22/24 recommended). Node 26 is not yet supported by the pinned SQLite driver.

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
| `AUTH_USERNAME` | Enables full-app Basic Authentication with `AUTH_PASSWORD` | Disabled |
| `AUTH_PASSWORD` | Password for the full-app Basic Authentication login | Disabled |
| `ADAPTER_TIMEOUT_MS` | Per-document extraction timeout | `60000` |

## Phone uploads

Set both `AUTH_USERNAME` and `AUTH_PASSWORD` in the server environment, then
restart the app. Your browser will prompt for the credentials before it can
read the library or upload. Once authenticated, open the **Upload** page from
your phone. Uploaded `.md`, `.markdown`, and `.txt` files are saved under
`uploads/` inside your library. You can also paste text and choose whether to
save it as Markdown or plain text.

On a trusted home network, open `http://SERVER_IP:3000/upload` from your
phone. Keep port 3000 private to that network—do not port-forward it to the
internet. The library volume must remain writable for uploads to work.

For a Docker deployment, add the credentials to a `.env` file next to
`compose.yaml`:

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

## Windows desktop app

The desktop build packages the local server with the app, so the target PC does
not need Node.js, Docker, or a separate service. On first run it creates a
`Text Jellyfin Library` folder in the signed-in user's Documents folder and
stores the database under the app's Windows user-data directory. You can point
it at another library by setting `LIBRARY_PATH` before starting the app.

Build the 64-bit Windows installer from a clean checkout on a Windows x64
machine (or a Windows CI runner). The SQLite driver is native code, so this
must not be cross-compiled from macOS:

```bash
npm install
npm run build:desktop
```

The resulting `dist/Text Jellyfin Setup <version>.exe` is the one-click
per-user installer. It adds a Start Menu and Desktop shortcut, uses the ink
quill icon, and starts the application after installation. The Settings page
lets each user enable or disable launch at Windows sign-in.

### Release updates

The desktop app uses GitHub Releases as its update feed. Publish a Windows
release with a GitHub token that has `contents: write` permission:

```bash
set GH_TOKEN=your_github_token
npm run build:desktop:publish
```

This creates a GitHub release containing the installer and update metadata.
The installed app checks it at startup and from Settings. When it finds a newer
release, the user can download it, then choose **Restart & install update**.
This shuts down the bundled localhost server, applies the installer, and
launches the new server version automatically. Increment the `version` in
`package.json` for each release. Code-sign the installer before public
distribution to avoid Windows SmartScreen warnings.

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

This v1 app is intended for personal/local use and has no authentication. Do not expose it to the public internet without putting it behind your own auth layer.
