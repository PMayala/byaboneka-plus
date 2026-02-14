/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

// ─── CONFIG ────────────────────────────────────────────────────────────
const OUTPUT_FILE = "project-dump-frontend.txt";
const PROJECT_NAME = "Byaboneka+ Frontend";
const MAX_FILE_SIZE = 150 * 1024; // Frontend can have bigger TSX; 150KB is safe

const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "coverage",
  ".vite", ".next", ".turbo", ".cache", ".nyc_output",
  "__pycache__", ".vscode", ".idea"
]);

const IGNORE_FILES = new Set([
  // env/secrets
  ".env", ".env.local", ".env.development", ".env.production", ".env.staging",
  ".env.test", ".env.preview",

  // lock files + noise
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  ".DS_Store", "Thumbs.db",

  // output + generator
  OUTPUT_FILE, "generate-dump.js"
]);

const ALLOWED_EXTENSIONS = new Set([
  ".ts", ".js", ".tsx", ".jsx",
  ".json", ".md",
  ".yml", ".yaml",
  ".css", ".scss", ".sass",
  ".html",
  ".svg"
]);

const SPECIAL_FILES = new Set([
  "Dockerfile", "Procfile", "Makefile",
  ".gitignore", ".dockerignore",
  ".prettierrc", ".eslintrc", ".eslintignore",
  "vite.config.ts", "tailwind.config.js", "postcss.config.js",
  "vercel.json", "tsconfig.json", "tsconfig.node.json",
  "index.html"
]);

// ─── HELPERS ───────────────────────────────────────────────────────────

function isBinary(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    const checkLength = Math.min(buf.length, 8000);
    for (let i = 0; i < checkLength; i++) {
      if (buf[i] === 0) return true;
    }
    return false;
  } catch {
    return true;
  }
}

function shouldInclude(filePath) {
  const name = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (IGNORE_FILES.has(name)) return false;
  if (SPECIAL_FILES.has(name)) return true;
  if (name === ".env.example") return true;

  if (!ALLOWED_EXTENSIONS.has(ext)) return false;

  try {
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) return false;
    if (stats.size === 0) return false;
  } catch {
    return false;
  }

  if (isBinary(filePath)) return false;

  // Extra safety: never include real env files even if renamed
  if (name.startsWith(".env") && name !== ".env.example") return false;

  return true;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function countLines(content) {
  return content.split("\n").length;
}

function getLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".ts": "TypeScript",
    ".js": "JavaScript",
    ".tsx": "TSX",
    ".jsx": "JSX",
    ".json": "JSON",
    ".md": "Markdown",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sass": "SASS",
    ".html": "HTML",
    ".svg": "SVG"
  };
  return map[ext] || "Text";
}

// ─── COLLECTOR ─────────────────────────────────────────────────────────

function collectFiles(dir, rootDir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  // Sort: directories first, then files alphabetically
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      results.push(...collectFiles(fullPath, rootDir));
      continue;
    }

    if (!shouldInclude(fullPath)) continue;

    const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
    const stats = fs.statSync(fullPath);
    const content = fs.readFileSync(fullPath, "utf8");

    results.push({
      path: relativePath,
      size: stats.size,
      lines: countLines(content),
      language: getLanguage(fullPath),
      content
    });
  }

  return results;
}

// ─── DIRECTORY TREE ────────────────────────────────────────────────────

function buildTree(dir, prefix = "", rootDir = dir, depth = 0, maxDepth = 6) {
  if (depth > maxDepth) return [];
  const lines = [];
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => !IGNORE_DIRS.has(e.name) && !e.name.startsWith(".git"))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  entries.forEach((entry, i) => {
    const isLast = i === entries.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      lines.push(`${prefix}${connector}${entry.name}/`);
      const newPrefix = prefix + (isLast ? "    " : "│   ");
      lines.push(...buildTree(fullPath, newPrefix, rootDir, depth + 1, maxDepth));
    } else if (!IGNORE_FILES.has(entry.name)) {
      const stats = fs.statSync(fullPath);
      lines.push(`${prefix}${connector}${entry.name} (${formatSize(stats.size)})`);
    }
  });

  return lines;
}

// ─── MAIN ──────────────────────────────────────────────────────────────

function main() {
  const rootDir = process.cwd();

  const files = collectFiles(rootDir, rootDir);

  // Group files by top-level directory
  const groups = {};
  for (const file of files) {
    const topDir = file.path.includes("/") ? file.path.split("/")[0] : "(root)";
    if (!groups[topDir]) groups[topDir] = [];
    groups[topDir].push(file);
  }

  // Stats
  const totalFiles = files.length;
  const totalLines = files.reduce((sum, f) => sum + f.lines, 0);
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const langCounts = {};
  files.forEach((f) => {
    langCounts[f.language] = (langCounts[f.language] || 0) + 1;
  });

  const out = [];

  // ── HEADER ──
  out.push("╔══════════════════════════════════════════════════════════════╗");
  out.push(`║  ${PROJECT_NAME.padEnd(58)}║`);
  out.push(`║  Project Code Dump — AI Review Edition                      ║`);
  out.push(`║  Generated: ${new Date().toISOString().padEnd(47)}║`);
  out.push("╚══════════════════════════════════════════════════════════════╝");
  out.push("");

  // ── SUMMARY ──
  out.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  out.push("  PROJECT SUMMARY");
  out.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  out.push(`  Files included:  ${totalFiles}`);
  out.push(`  Total lines:     ${totalLines.toLocaleString()}`);
  out.push(`  Total size:      ${formatSize(totalSize)}`);
  out.push(
    `  Languages:       ${Object.entries(langCounts)
      .map(([k, v]) => `${k} (${v})`)
      .join(", ")}`
  );
  out.push("");

  // ── DIRECTORY TREE ──
  out.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  out.push("  DIRECTORY STRUCTURE");
  out.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  out.push(`  ${path.basename(rootDir)}/`);
  buildTree(rootDir, "  ", rootDir).forEach((line) => out.push(line));
  out.push("");

  // ── TABLE OF CONTENTS ──
  out.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  out.push("  TABLE OF CONTENTS");
  out.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  for (const [group, groupFiles] of Object.entries(groups)) {
    out.push(`\n  📁 ${group}/`);
    groupFiles.forEach((f, i) => {
      const num = String(i + 1).padStart(2, " ");
      out.push(`     ${num}. ${f.path}  [${f.lines} lines | ${f.language}]`);
    });
  }
  out.push("");

  // ── FILE CONTENTS ──
  out.push("\n\n");
  out.push("╔══════════════════════════════════════════════════════════════╗");
  out.push("║                      SOURCE CODE FILES                      ║");
  out.push("╚══════════════════════════════════════════════════════════════╝");

  for (const [group, groupFiles] of Object.entries(groups)) {
    out.push(`\n\n${"─".repeat(62)}`);
    out.push(`  SECTION: ${group}/`);
    out.push(`${"─".repeat(62)}`);

    for (const file of groupFiles) {
      out.push(`\n┌${"─".repeat(60)}┐`);
      out.push(`│ FILE: ${file.path}`);
      out.push(`│ Language: ${file.language} | Lines: ${file.lines} | Size: ${formatSize(file.size)}`);
      out.push(`└${"─".repeat(60)}┘`);
      out.push("");
      out.push(file.content);
      out.push("");
    }
  }

  // ── FOOTER ──
  out.push("\n" + "═".repeat(62));
  out.push(`  END OF DUMP — ${totalFiles} files | ${totalLines.toLocaleString()} lines`);
  out.push("═".repeat(62));

  fs.writeFileSync(OUTPUT_FILE, out.join("\n"), "utf8");

  console.log("");
  console.log("  ✅ Frontend project dump created successfully!");
  console.log(`  📄 Output: ${OUTPUT_FILE}`);
  console.log(`  📊 ${totalFiles} files | ${totalLines.toLocaleString()} lines | ${formatSize(totalSize)}`);
  console.log("  🔒 Secrets excluded (.env*, except .env.example)");
  console.log("  🗑️  Junk excluded (node_modules, dist, coverage, etc.)");
  console.log("");
}

main();
