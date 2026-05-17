import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".sql",
  ".md",
  ".css",
  ".html",
  ".txt",
  ".toml",
]);

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".vercel",
  ".opencode",
]);

// Common mojibake sequences seen when UTF-8 text is decoded as Latin-1/Windows-1252.
// We only transform suspicious runs and keep logic/punctuation untouched.
const MOJIBAKE_RUN = /(?:Ã.|Â.|â[\u0080-\u00BF]{1,2})+/g;

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") && ![".env.example"].includes(entry.name)) {
      // Keep standard hidden dirs skipped unless explicitly needed.
      if (SKIP_DIRS.has(entry.name)) continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    out.push(full);
  }
  return out;
}

function toUtf8NoBom(text) {
  // Strip UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

function latin1ToUtf8(fragment) {
  return Buffer.from(fragment, "latin1").toString("utf8");
}

function fixMojibake(text) {
  let next = text;
  // A couple of passes handle double-encoded fragments.
  for (let i = 0; i < 3; i += 1) {
    const prev = next;
    next = prev.replace(MOJIBAKE_RUN, (frag) => {
      const fixed = latin1ToUtf8(frag);
      // Keep only if it improved suspicious chars.
      const beforeScore = (frag.match(/[ÃÂâ�]/g) || []).length;
      const afterScore = (fixed.match(/[ÃÂâ�]/g) || []).length;
      return afterScore < beforeScore ? fixed : frag;
    });
    if (next === prev) break;
  }

  // Small deterministic cleanup for known leftovers.
  next = next
    .replaceAll("—", "—")
    .replaceAll("–", "–")
    .replaceAll("•", "•")
    .replaceAll("‘", "‘")
    .replaceAll("’", "’")
    .replaceAll("“", "“")
    .replaceAll("”", "”")
    .replaceAll("—", "—")
    .replaceAll("ÃO", "ÃO");

  return next;
}

function main() {
  const files = walk(ROOT);
  let changed = 0;

  for (const file of files) {
    const original = fs.readFileSync(file, "utf8");
    const noBom = toUtf8NoBom(original);
    const fixed = fixMojibake(noBom);
    if (fixed !== original) {
      try {
        fs.writeFileSync(file, fixed, "utf8");
        changed += 1;
        console.log(`fixed: ${path.relative(ROOT, file)}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`skip(write-failed): ${path.relative(ROOT, file)} :: ${msg}`);
      }
    }
  }

  console.log(`done: ${changed} file(s) updated`);
}

main();
