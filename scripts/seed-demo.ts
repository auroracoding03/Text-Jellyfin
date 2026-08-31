import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { DEMO_COVER_JPEGS } from "./seed-cover-images";

const library = path.join(process.cwd(), "fixtures", "library");
const pasted = path.join(library, "uploads", "pasted");

type ArticleSeed = {
  filename: string;
  body: string;
  meta: Record<string, unknown>;
  cover?: Buffer;
};

const articles: ArticleSeed[] = [
  {
    filename: "morning-pages.md",
    body: `# Morning Pages

Three pages before breakfast. No editing, no judgment.

The habit is not about quality. It is about clearing the static so the rest of the day has room to breathe.

## Why it works

- Lowers the cost of starting
- Captures half-formed ideas before they evaporate
- Builds a private archive of mood and weather

> Write badly on purpose. Edit never.`,
    meta: {
      title: "Morning Pages",
      summary: "A short note on the daily writing ritual and why messy first drafts matter.",
      author: "Aaron",
      tags: ["notes", "habits", "writing"],
      origin: "paste",
      cover: true,
    },
    cover: DEMO_COVER_JPEGS.sage,
  },
  {
    filename: "weekend-bread.md",
    body: `# Weekend Bread

Saturday dough, Sunday crumb.

1. Mix flour, water, salt, and a pinch of yeast the night before.
2. Fold twice, bake when the kitchen smells like patience.

The crust should sing when you tap it.`,
    meta: {
      title: "Weekend Bread",
      summary: "Loaf notes from a slow Saturday bake — crust, crumb, and timing.",
      author: "Kitchen log",
      tags: ["food", "weekend"],
      origin: "paste",
      cover: true,
    },
    cover: DEMO_COVER_JPEGS.terracotta,
  },
  {
    filename: "harbor-lights-01.md",
    body: `# Harbor Lights — Chapter 1

The ferry horn cut through fog thick enough to taste.

Mara kept her hands on the rail and watched the town blink on one pier light at a time.`,
    meta: {
      title: "Harbor Lights — The Arrival",
      summary: "Chapter 1: Mara reaches the island as the pier lights come on through the fog.",
      author: "Demo series",
      series: "Harbor Lights",
      chapter: 1,
      tags: ["fiction", "series"],
      origin: "paste",
      cover: true,
    },
    cover: DEMO_COVER_JPEGS.harbor,
  },
  {
    filename: "harbor-lights-02.md",
    body: `# Harbor Lights — Chapter 2

The innkeeper did not ask why Mara had no luggage.

"You will hear the bell at midnight," she said. "Ignore it unless the light is red."`,
    meta: {
      title: "Harbor Lights — The Inn",
      summary: "Chapter 2: A warning about the midnight bell and a room above the harbor.",
      author: "Demo series",
      series: "Harbor Lights",
      chapter: 2,
      tags: ["fiction", "series"],
      origin: "paste",
    },
  },
  {
    filename: "harbor-lights-03.md",
    body: `# Harbor Lights — Chapter 3

Red light meant someone was still out on the water.

Mara stood at the window and counted the seconds between bell and answer.`,
    meta: {
      title: "Harbor Lights — Red Light",
      summary: "Chapter 3: The bell rings and Mara learns what the red light means.",
      author: "Demo series",
      series: "Harbor Lights",
      chapter: 3,
      tags: ["fiction", "series"],
      origin: "paste",
    },
  },
  {
    filename: "desk-setup.txt",
    body: `Desk setup notes

- Monitor at arm's length, top bezel at eye level
- Key light from the left for video calls
- Keep one analog notebook for capture, one app for archive

The goal is fewer decisions before real work starts.`,
    meta: {
      title: "Desk Setup Notes",
      summary: "Ergonomic and lighting checklist for a home office that does not fight you.",
      tags: ["workflow", "home-office"],
      origin: "paste",
    },
  },
  {
    filename: "reading-queue.md",
    body: `# Reading Queue

Articles saved for slow evenings.

- Local-first software essays
- A long interview about small libraries
- Notes on typography in long-form reading apps`,
    meta: {
      title: "Reading Queue",
      summary: "Saved articles and essays to read when there is time to sit down.",
      tags: ["reading", "queue"],
      origin: "paste",
      cover: true,
    },
    cover: DEMO_COVER_JPEGS.plum,
  },
  {
    filename: "garden-log.md",
    body: `# Garden Log — Late August

Tomatoes finally turned. Basil bolted.

Water in the morning, pinch flowers on the herbs, accept that the zucchini lied about how much it would produce.`,
    meta: {
      title: "Garden Log — Late August",
      summary: "Tomatoes, basil, and the eternal optimism of zucchini.",
      tags: ["garden", "seasonal"],
      origin: "paste",
    },
  },
];

function yamlValue(value: unknown): string {
  const text = String(value);
  if (
    text.includes(":") ||
    text.includes("#") ||
    text.startsWith(" ") ||
    text.includes("\n") ||
    text === "true" ||
    text === "false"
  ) {
    return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return text;
}

function writeSidecar(filePath: string, meta: Record<string, unknown>): void {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(meta)) {
    if (value == null || value === "") continue;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${item}`);
      continue;
    }
    lines.push(`${key}: ${yamlValue(value)}`);
  }
  fs.writeFileSync(`${filePath}.meta.yaml`, `${lines.join("\n")}\n`, "utf8");
}

function writeCover(sourcePath: string, cover: Buffer): void {
  const stem = path.basename(sourcePath, path.extname(sourcePath));
  const coverPath = path.join(path.dirname(sourcePath), `${stem}.cover.jpg`);
  fs.writeFileSync(coverPath, cover);
}

function seedArticles(): void {
  fs.mkdirSync(pasted, { recursive: true });
  const touchedAt = new Date();
  for (const article of articles) {
    const filePath = path.join(pasted, article.filename);
    fs.writeFileSync(filePath, article.body, "utf8");
    writeSidecar(filePath, article.meta);
    if (article.cover) writeCover(filePath, article.cover);
    fs.utimesSync(filePath, touchedAt, touchedAt);
  }
}

function main(): void {
  seedArticles();
  console.log(`Seeded ${articles.length} demo articles under uploads/pasted/`);

  const scan = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "scan"], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (scan.status !== 0) {
    process.exit(scan.status ?? 1);
  }
}

main();
