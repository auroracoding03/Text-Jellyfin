#!/usr/bin/env tsx
import { scanLibrary } from "../src/lib/ingest/scanner";

async function main() {
  const result = await scanLibrary();
  console.log(result.message);
  console.log(result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
