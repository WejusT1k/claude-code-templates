// File helpers for the sync engine: walk packs, map to target paths, hash,
// stamp markers, and write/delete atomically. Pure Node, no dependencies.

import {
  readdirSync, statSync, existsSync, readFileSync,
  writeFileSync, mkdirSync, rmSync, rmdirSync, renameSync, readdirSync as readdir,
} from 'node:fs';
import { join, dirname, relative, sep, posix } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';

// The four asset kinds we map from a pack into a target's .claude/ dir.
export const ASSET_KINDS = ['skills', 'agents', 'commands', 'prompts'];

const MARKER_PREFIX = '<!-- managed by claude-code-templates';
const markerFor = (pack) =>
  `${MARKER_PREFIX} · pack=${pack} · do not edit by hand · edit in the template repo -->`;

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/** Recursively list file paths under `dir`, relative to `dir`, using POSIX separators. */
function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const child of walk(abs)) out.push(posix.join(entry.name, child));
    } else if (entry.isFile()) {
      out.push(entry.name);
    }
  }
  return out;
}

/**
 * Add our "managed" marker to markdown content. Frontmatter-aware: if the file
 * opens with a `---` YAML block, the marker goes right after it (so frontmatter
 * stays at the very top where Claude Code expects it); otherwise at the top.
 * Non-markdown files are returned untouched. Idempotent for fixed source input.
 */
function withMarker(targetRelPath, content, pack) {
  if (!targetRelPath.endsWith('.md')) return content;
  const text = content.toString('utf8');
  if (text.includes(MARKER_PREFIX)) return content; // already marked at source

  const marker = markerFor(pack);
  if (text.startsWith('---\n') || text.startsWith('---\r\n')) {
    // Insert after the closing frontmatter fence.
    const lines = text.split('\n');
    let end = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') { end = i; break; }
    }
    if (end !== -1) {
      lines.splice(end + 1, 0, '', marker);
      return Buffer.from(lines.join('\n'), 'utf8');
    }
  }
  return Buffer.from(`${marker}\n\n${text}`, 'utf8');
}

/**
 * Build the desired file set for a target from its selected packs.
 * Returns Map<targetRelPath, { pack, content: Buffer, hash }>.
 * targetRelPath is POSIX-style and rooted at ".claude/...".
 * Throws if two packs map to the same target path (ambiguous).
 */
export function collectDesiredFiles(sourceDir, packs) {
  const desired = new Map();
  for (const pack of packs) {
    for (const kind of ASSET_KINDS) {
      const kindDir = join(sourceDir, 'packs', pack, kind);
      for (const rel of walk(kindDir)) {
        const base = posix.basename(rel);
        if (base === '.gitkeep') continue;
        const targetRelPath = posix.join('.claude', kind, rel);
        const raw = readFileSync(join(kindDir, rel.split('/').join(sep)));
        const content = withMarker(targetRelPath, raw, pack);
        if (desired.has(targetRelPath)) {
          const prev = desired.get(targetRelPath);
          throw new Error(
            `pack collision: "${targetRelPath}" is provided by both "${prev.pack}" and "${pack}". ` +
            `Each target path must come from exactly one pack.`,
          );
        }
        desired.set(targetRelPath, { pack, content, hash: sha256(content) });
      }
    }
  }
  return desired;
}

/** Hash of the file currently at targetDir/relPath, or null if absent. */
export function existingHash(targetDir, relPath) {
  const abs = join(targetDir, relPath.split('/').join(sep));
  if (!existsSync(abs)) return null;
  return sha256(readFileSync(abs));
}

export function fileExists(targetDir, relPath) {
  return existsSync(join(targetDir, relPath.split('/').join(sep)));
}

/** Atomic write: write to a temp file in the same dir, then rename over. */
export function writeFileAtomic(targetDir, relPath, content) {
  const abs = join(targetDir, relPath.split('/').join(sep));
  mkdirSync(dirname(abs), { recursive: true });
  const tmp = `${abs}.${randomBytes(6).toString('hex')}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, abs);
}

/** Remove a file and prune now-empty parent dirs up to (but not including) targetDir. */
export function removeFile(targetDir, relPath) {
  const abs = join(targetDir, relPath.split('/').join(sep));
  if (existsSync(abs)) rmSync(abs);
  let dir = dirname(abs);
  const root = join(targetDir, '.claude');
  while (dir.startsWith(root) && dir !== root) {
    if (existsSync(dir) && readdir(dir).length === 0) {
      rmdirSync(dir);
      dir = dirname(dir);
    } else break;
  }
}

export { relative, sep };
