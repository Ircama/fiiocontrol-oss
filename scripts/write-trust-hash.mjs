import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DIST_DIR = path.resolve("dist");
const OUTPUT_FILE = path.resolve("dist/trust.json");
const IGNORED_FILES = new Set(["trust.json"]);

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listFiles(fullPath);
      return [fullPath];
    }),
  );

  return files.flat();
}

async function main() {
  const files = (await listFiles(DIST_DIR)).sort();
  const manifest = [];

  for (const file of files) {
    const relativePath = path.relative(DIST_DIR, file).replaceAll("\\", "/");
    if (IGNORED_FILES.has(relativePath)) continue;

    const contents = await readFile(file);
    const hash = createHash("sha256").update(contents).digest("hex");
    manifest.push({ path: relativePath, sha256: hash });
  }

  const bundleSha256 = createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
  const trust = {
    generatedAt: new Date().toISOString(),
    bundleSha256,
    assets: manifest,
    commitHash: process.argv[2],
  };

  await writeFile(OUTPUT_FILE, `${JSON.stringify(trust, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
