#!/usr/bin/env node
// Validate the central repo: registry shape, pack structure, and that every
// target dry-runs cleanly. Exits non-zero on any problem. Run in CI.

import { existsSync, readdirSync, readFileSync, statSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import { loadRegistry, validateRegistry } from './lib/registry.mjs';
import { ASSET_KINDS } from './lib/files.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const err = (m) => errors.push(m);

/** Parse a leading YAML frontmatter block; returns the map of top-level keys or null. */
function frontmatter(text) {
  if (!(text.startsWith('---\n') || text.startsWith('---\r\n'))) return null;
  const lines = text.split('\n');
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { end = i; break; }
  }
  if (end === -1) return null;
  const keys = {};
  for (const line of lines.slice(1, end)) {
    const m = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (m) keys[m[1]] = m[2].trim();
  }
  return keys;
}

function checkPacks() {
  const packsDir = join(REPO_ROOT, 'packs');
  if (!existsSync(packsDir)) { err('packs/ directory is missing'); return; }

  for (const pack of readdirSync(packsDir)) {
    const packDir = join(packsDir, pack);
    if (!statSync(packDir).isDirectory()) continue;

    // skills/<name>/SKILL.md with name + description.
    const skillsDir = join(packDir, 'skills');
    if (existsSync(skillsDir)) {
      for (const name of readdirSync(skillsDir)) {
        const sd = join(skillsDir, name);
        if (name === '.gitkeep' || !statSync(sd).isDirectory()) continue;
        const skillFile = join(sd, 'SKILL.md');
        if (!existsSync(skillFile)) { err(`${pack}/skills/${name}: missing SKILL.md`); continue; }
        const fm = frontmatter(readFileSync(skillFile, 'utf8'));
        if (!fm) err(`${pack}/skills/${name}/SKILL.md: missing YAML frontmatter`);
        else {
          if (!fm.name) err(`${pack}/skills/${name}/SKILL.md: frontmatter missing "name"`);
          if (!fm.description) err(`${pack}/skills/${name}/SKILL.md: frontmatter missing "description"`);
        }
      }
    }

    // agents/*.md with name + description.
    const agentsDir = join(packDir, 'agents');
    if (existsSync(agentsDir)) {
      for (const f of readdirSync(agentsDir)) {
        if (!f.endsWith('.md')) continue;
        const fm = frontmatter(readFileSync(join(agentsDir, f), 'utf8'));
        if (!fm) err(`${pack}/agents/${f}: missing YAML frontmatter`);
        else {
          if (!fm.name) err(`${pack}/agents/${f}: frontmatter missing "name"`);
          if (!fm.description) err(`${pack}/agents/${f}: frontmatter missing "description"`);
        }
      }
    }

    // commands/*.md must be markdown (frontmatter optional in Claude Code).
    const commandsDir = join(packDir, 'commands');
    if (existsSync(commandsDir)) {
      for (const f of readdirSync(commandsDir)) {
        if (f === '.gitkeep') continue;
        if (!f.endsWith('.md')) err(`${pack}/commands/${f}: commands must be .md files`);
      }
    }
  }
}

function checkDryRuns(registry) {
  const tmp = mkdtempSync(join(tmpdir(), 'cct-validate-'));
  for (const t of registry.targets) {
    try {
      execFileSync('node', [
        join(REPO_ROOT, 'scripts', 'sync.mjs'),
        '--repo', t.repo,
        '--target-dir', join(tmp, t.repo.replace('/', '__')),
        '--source-dir', REPO_ROOT,
        '--dry-run',
      ], { stdio: 'pipe' });
    } catch (e) {
      err(`dry-run failed for ${t.repo}: ${e.stderr?.toString().trim() || e.message}`);
    }
  }
}

function main() {
  const registry = loadRegistry(REPO_ROOT);
  for (const e of validateRegistry(registry, REPO_ROOT)) err(e);
  checkPacks();
  if (errors.length === 0) checkDryRuns(registry); // only meaningful if registry/packs are sane

  if (errors.length) {
    console.error(`✗ validation failed (${errors.length}):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`✓ registry, packs, and ${registry.targets.length} target dry-runs are valid.`);
}

main();
