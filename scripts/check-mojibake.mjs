import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const INCLUDE_DIRS = ["src", "supabase", "public", "scripts"];
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".sql",
  ".md",
  ".txt",
  ".css",
  ".html",
  ".toml",
]);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".tmp", ".opencode", ".agent"]);
const SKIP_FILES = new Set([
  path.normalize("scripts/fix-utf8-mojibake.mjs"),
  path.normalize("scripts/fix-cadastros-fechamento.mjs"),
]);

const UTF8_FATAL = new TextDecoder("utf-8", { fatal: true });
const SUSPICIOUS_PATTERN =
  /\uFFFD|\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E2\u20AC[\u0080-\u00BF]/u;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    out.push(fullPath);
  }

  return out;
}

function getLineAndColumn(text, index) {
  const slice = text.slice(0, index);
  const lines = slice.split(/\r?\n/);
  const line = lines.length;
  const column = lines.at(-1).length + 1;
  return { line, column };
}

function main() {
  const files = INCLUDE_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));
  const issues = [];

  for (const file of files) {
    const relativePath = path.relative(ROOT, file);
    if (SKIP_FILES.has(path.normalize(relativePath))) continue;

    const bytes = fs.readFileSync(file);

    try {
      UTF8_FATAL.decode(bytes);
    } catch {
      issues.push({
        file: relativePath,
        line: 1,
        column: 1,
        type: "invalid-utf8",
        sample: "arquivo não está em UTF-8 válido",
      });
      continue;
    }

    const text = bytes.toString("utf8");
    const lines = text.split(/\r?\n/);

    lines.forEach((lineText, index) => {
      const match = lineText.match(SUSPICIOUS_PATTERN);
      if (!match || match.index === undefined) return;

      const absoluteIndex = text.indexOf(lineText) + match.index;
      const { line, column } = getLineAndColumn(text, absoluteIndex);
      issues.push({
        file: relativePath,
        line,
        column,
        type: "mojibake",
        sample: lineText.trim().slice(0, 140),
      });
    });
  }

  if (issues.length === 0) {
    console.log("Encoding OK: nenhum padrao de mojibake encontrado.");
    return;
  }

  console.error("Encoding check falhou. Corrija os arquivos abaixo:");
  for (const issue of issues) {
    console.error(`- ${issue.file}:${issue.line}:${issue.column} [${issue.type}] ${issue.sample}`);
  }

  process.exitCode = 1;
}

main();
