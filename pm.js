/* eslint-disable no-console */
/**
 * generate-dump-root.js
 * Put this file in the project root (byaboneka-plus/) and run:
 *   node generate-dump-root.js
 *
 * Output: project-dump.txt
 */

const fs = require("fs");
const path = require("path");

// ─── CONFIG ────────────────────────────────────────────────────────────
const OUTPUT_FILE = "project-dump.txt";
const PROJECT_NAME = "Byaboneka+ (Root Dump)";
const MAX_FILE_SIZE = 200 * 1024; // 200KB: good balance for TS/TSX projects
const TREE_MAX_DEPTH = 6;

// ⚠️ WARNING: .env files contain secrets (tokens/passwords).
// Turn OFF if you will share the dump publicly.
const INCLUDE_ENV_FILES = true;

// Skip these directories anywhere in the project
const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
  ".nyc_output",
  ".vite",
  "uploads",
  "__pycache__",
  ".vscode",
  ".idea",
]);

// Skip these files by exact name
const IGNORE_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  ".DS_Store",
  "Thumbs.db",
  OUTPUT_FILE,
  "generate-dump.js",
  "generate-dump-root.js", // avoid dumping itself
]);

// Files we always include by name even if extension doesn’t match
const SPECIAL_FILES = new Set([
  "Dockerfile",
  "Procfile",
  "Makefile",
  ".gitignore",
  ".dockerignore",
  ".prettierrc",
  ".eslintrc",
  ".eslintignore",
  "docker-compose.yml",
  "docker-compose.yaml",
  "docker-compose.production.yml",
  "docker-compose.production.yaml",
  "render.yaml",
  "vercel.json",
  "netlify.toml",
  "tsconfig.json",
  "tsconfig.node.json",
  "vite.config.ts",
  "tailwind.config.js",
  "tailwind.config.ts",
  "postcss.config.js",
  "postcss.config.cjs",
  "index.html",
]);

// Extensions we include
const ALLOWED_EXTENSIONS = new Set([
  ".ts",
  ".js",
  ".tsx",
  ".jsx",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".sql",
  ".graphql",
  ".gql",
  ".sh",
  ".css",
  ".scss",
  ".sass",
  ".html",
  ".ejs",
  ".hbs",
  ".svg",
  ".txt",
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

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function countLines(content) {
  return content.split("\n").length;
}

function getLanguage(filePath) {
  const name = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (name === ".env" || name.startsWith(".env.")) return "Env";
  if (name === ".env.example") return "Env";

  const map = {
    ".ts": "TypeScript",
    ".js": "JavaScript",
    ".tsx": "TSX",
    ".jsx": "JSX",
    ".json": "JSON",
    ".md": "Markdown",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".sql": "SQL",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sass": "SASS",
    ".html": "HTML",
    ".sh": "Shell",
    ".svg": "SVG",
    ".txt": "Text",
    ".graphql": "GraphQL",
    ".gql": "GraphQL",
    ".ejs": "EJS",
    ".hbs": "Handlebars",
  };

  return map[ext] || "Text";
}

function shouldInclude(filePath) {
  const name = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  const isEnvFile = name === ".env" || name.startsWith(".env.");
  const isEnvExample = name === ".env.example";

  if (IGNORE_FILES.has(name)) return false;
  if (SPECIAL_FILES.has(name)) return true;

  // Env rules
  if (isEnvExample) return true;
  if (isEnvFile) return INCLUDE_ENV_FILES;

  // Extension rule
  if (!ALLOWED_EXTENSIONS.has(ext)) return false;

  // Size + empties
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) return false;
    if (stats.size === 0) return false;
  } catch {
    return false;
  }

  // Binary check
  if (isBinary(filePath)) return false;

  return true;
}

// ─── COLLECTOR ─────────────────────────────────────────────────────────

function collectFiles(dir, rootDir) {
  const results = [];
  let entries;

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  // Sort: directories first, then files alphabetically
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      results.push(...collectFiles(fullPath, rootDir));
      continue;
    }

    if (!shouldInclude(fullPath)) continue;

    const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

    let stats;
    let content;
    try {
      stats = fs.statSync(fullPath);
      content = fs.readFileSync(fullPath, "utf8");
    } catch {
      continue;
    }

    results.push({
      path: relativePath,
      size: stats.size,
      lines: countLines(content),
      language: getLanguage(fullPath),
      content,
    });
  }

  return results;
}

// ─── DIRECTORY TREE ────────────────────────────────────────────────────

function buildTree(dir, prefix = "", depth = 0, maxDepth = TREE_MAX_DEPTH) {
  if (depth > maxDepth) return [];
  const lines = [];

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return lines;
  }

  entries = entries
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
      lines.push(...buildTree(fullPath, newPrefix, depth + 1, maxDepth));
    } else if (!IGNORE_FILES.has(entry.name)) {
      try {
        const stats = fs.statSync(fullPath);
        lines.push(`${prefix}${connector}${entry.name} (${formatSize(stats.size)})`);
      } catch {
        lines.push(`${prefix}${connector}${entry.name}`);
      }
    }
  });

  return lines;
}

// ─── MAIN ──────────────────────────────────────────────────────────────

function main() {
  const rootDir = process.cwd();
  const files = collectFiles(rootDir, rootDir);

  // Group by top-level directory (backend/, frontend/, docs/, etc.)
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

  // Header
  out.push("╔══════════════════════════════════════════════════════════════╗");
  out.push(`║  ${PROJECT_NAME.padEnd(58)}║`);
  out.push("║  Project Code Dump — AI Review Edition                      ║");
  out.push(`║  Generated: ${new Date().toISOString().padEnd(47)}║`);
  out.push("╚══════════════════════════════════════════════════════════════╝");
  out.push("");

  // Summary
  out.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  out.push("  PROJECT SUMMARY");
  out.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  out.push(`  Root:           ${rootDir}`);
  out.push(`  Files included: ${totalFiles}`);
  out.push(`  Total lines:    ${totalLines.toLocaleString()}`);
  out.push(`  Total size:     ${formatSize(totalSize)}`);
  out.push(`  Env included:   ${INCLUDE_ENV_FILES ? "YES (.env*)" : "NO (only .env.example)"}`);
  out.push(
    `  Languages:      ${Object.entries(langCounts)
      .map(([k, v]) => `${k} (${v})`)
      .join(", ")}`
  );
  out.push("");

  // Directory tree
  out.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  out.push("  DIRECTORY STRUCTURE");
  out.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  out.push(`  ${path.basename(rootDir)}/`);
  buildTree(rootDir, "  ").forEach((line) => out.push(line));
  out.push("");

  // TOC
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

  // File contents
  out.push("");
  out.push("╔══════════════════════════════════════════════════════════════╗");
  out.push("║                      SOURCE CODE FILES                      ║");
  out.push("╚══════════════════════════════════════════════════════════════╝");

  const sortedGroups = Object.keys(groups).sort((a, b) => a.localeCompare(b));
  for (const group of sortedGroups) {
    const groupFiles = groups[group].sort((a, b) => a.path.localeCompare(b.path));

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

  // Footer
  out.push("\n" + "═".repeat(62));
  out.push(`  END OF DUMP — ${totalFiles} files | ${totalLines.toLocaleString()} lines`);
  out.push("═".repeat(62));

  fs.writeFileSync(path.join(rootDir, OUTPUT_FILE), out.join("\n"), "utf8");

  console.log("");
  console.log("  ✅ Project dump created successfully!");
  console.log(`  📄 Output: ${OUTPUT_FILE}`);
  console.log(`  📊 ${totalFiles} files | ${totalLines.toLocaleString()} lines | ${formatSize(totalSize)}`);
  console.log(`  🔐 Env files included: ${INCLUDE_ENV_FILES ? "YES" : "NO"}`);
  console.log("  🗑️  Junk excluded (node_modules, dist, build, coverage, .git, etc.)");
  console.log("");
}

main();