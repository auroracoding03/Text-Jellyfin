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
- Docker-friendly self-hosting

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
| `ADAPTER_TIMEOUT_MS` | Per-document extraction timeout | `60000` |

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
