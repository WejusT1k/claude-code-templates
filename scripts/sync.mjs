#!/usr/bin/env node
// Sync a single target repo's .claude/ assets from the central packs.
//
// Usage:
//   node scripts/sync.mjs --repo ORG/spa-1 --target-dir <checkout> \
//        [--source-dir .] [--source-sha <sha>] [--dry-run] [--summary-file <path>]
//
// Pure Node, no dependencies — runs anywhere with Node >= 18.

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadRegistry, validateRegistry, findTarget } from './lib/registry.mjs';
import {
  collectDesiredFiles, existingHash, fileExists, writeFileAtomic, removeFile,
} from './lib/files.mjs';
import { loadLock, managedPaths, writeLock } from './lib/lock.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--repo': args.repo = argv[++i]; break;
      case '--target-dir': args.targetDir = argv[++i]; break;
      case '--source-dir': args.sourceDir = argv[++i]; break;
      case '--source-sha': args.sourceSha = argv[++i]; break;
      case '--summary-file': args.summaryFile = argv[++i]; break;
      case '--dry-run': args.dryRun = true; break;
      case '-h': case '--help': args.help = true; break;
      default: throw new Error(`unknown argument: ${a}`);
    }
  }
  return args;
}

const HELP = `Sync a target repo's .claude/ assets from the central packs.

Required:
  --repo ORG/name        target repo slug (must exist in registry.json)
  --target-dir <path>    path to the checked-out target repo

Optional:
  --source-dir <path>    templates repo root (default: this repo)
  --source-sha <sha>     source commit recorded in the lockfile
  --summary-file <path>  write a markdown change summary for a PR body
  --dry-run              report planned changes without writing
`;

function plan(sourceDir, targetDir, packs) {
  const desired = collectDesiredFiles(sourceDir, packs);
  const lock = loadLock(targetDir);
  const owned = new Set(managedPaths(lock));

  // Conflict guard: a desired path that exists locally but we don't own = hand-written.
  const collisions = [];
  for (const path of desired.keys()) {
    if (!owned.has(path) && fileExists(targetDir, path)) collisions.push(path);
  }
  if (collisions.length) {
    const list = collisions.map((p) => `  - ${p}`).join('\n');
    throw new Error(
      `refusing to overwrite ${collisions.length} unmanaged file(s) in the target:\n${list}\n` +
      `These exist in the target but are not tracked in the lockfile. Remove or rename ` +
      `them in the target, or move them into a pack, then re-run.`,
    );
  }

  const added = [], updated = [], removed = [], unchanged = [];
  for (const [path, { hash }] of desired) {
    const cur = existingHash(targetDir, path);
    if (cur === null) added.push(path);
    else if (cur !== hash) updated.push(path);
    else unchanged.push(path);
  }
  for (const path of owned) {
    if (!desired.has(path)) removed.push(path);
  }
  return { desired, added, updated, removed, unchanged };
}

function apply(targetDir, desired, { added, updated, removed }) {
  for (const path of [...added, ...updated]) {
    writeFileAtomic(targetDir, path, desired.get(path).content);
  }
  for (const path of removed) removeFile(targetDir, path);
}

function renderSummary(repo, packs, sourceSha, { added, updated, removed }) {
  const lines = [];
  lines.push(`## Claude Code template sync`);
  lines.push('');
  lines.push(`Synced from \`claude-code-templates\`${sourceSha ? ` @ \`${sourceSha.slice(0, 12)}\`` : ''}.`);
  lines.push(`Target: \`${repo}\` · packs: ${packs.map((p) => `\`${p}\``).join(', ')}`);
  lines.push('');
  const section = (title, items) =>
    items.length ? [`### ${title} (${items.length})`, '', ...items.map((p) => `- \`${p}\``), ''] : [];
  lines.push(...section('Added', added));
  lines.push(...section('Updated', updated));
  lines.push(...section('Removed', removed));
  if (!added.length && !updated.length && !removed.length) {
    lines.push('No changes — target already up to date.');
  }
  return lines.join('\n') + '\n';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { process.stdout.write(HELP); return; }
  if (!args.repo) throw new Error('--repo is required');
  if (!args.targetDir) throw new Error('--target-dir is required');

  const sourceDir = resolve(args.sourceDir || REPO_ROOT);
  const targetDir = resolve(args.targetDir);

  const registry = loadRegistry(sourceDir);
  const errors = validateRegistry(registry, sourceDir);
  if (errors.length) {
    throw new Error(`registry.json is invalid:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }

  const target = findTarget(registry, args.repo);
  const packs = target.packs;

  const result = plan(sourceDir, targetDir, packs);
  const { added, updated, removed, unchanged } = result;
  const changed = added.length + updated.length + removed.length;

  const tag = args.dryRun ? '[dry-run] ' : '';
  console.log(
    `${tag}${args.repo}: +${added.length} added, ~${updated.length} updated, ` +
    `-${removed.length} removed, =${unchanged.length} unchanged`,
  );
  for (const p of added) console.log(`  + ${p}`);
  for (const p of updated) console.log(`  ~ ${p}`);
  for (const p of removed) console.log(`  - ${p}`);

  if (args.summaryFile) {
    writeFileSync(resolve(args.summaryFile), renderSummary(args.repo, packs, args.sourceSha, result));
  }

  if (args.dryRun) {
    console.log(changed ? `${tag}would change ${changed} file(s).` : `${tag}up to date.`);
    return;
  }

  if (changed === 0) {
    console.log('up to date — nothing written.');
    return;
  }

  apply(targetDir, result.desired, result);
  const files = Object.fromEntries([...result.desired].map(([p, v]) => [p, v.hash]));
  writeLock(targetDir, { source: registry.source, sourceSha: args.sourceSha, packs, files });
  console.log(`done — wrote ${added.length + updated.length}, removed ${removed.length}.`);
}

try {
  main();
} catch (err) {
  console.error(`sync failed: ${err.message}`);
  process.exit(1);
}
