// Read/write the per-target lockfile that records which files we manage.
// The lockfile is the source of truth for "what claude-code-templates owns"
// in a consuming repo, so local hand-written assets are never touched.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeFileAtomic } from './files.mjs';

export const LOCK_PATH = '.claude/.templates-lock.json';

/** Load the lockfile, or an empty shell if the target has never been synced. */
export function loadLock(targetDir) {
  const abs = join(targetDir, '.claude', '.templates-lock.json');
  if (!existsSync(abs)) return { files: {} };
  try {
    const data = JSON.parse(readFileSync(abs, 'utf8'));
    if (!data.files || typeof data.files !== 'object') data.files = {};
    return data;
  } catch (err) {
    throw new Error(`${LOCK_PATH} in target is corrupt: ${err.message}`);
  }
}

/** Paths previously managed by us (array of target-relative POSIX paths). */
export function managedPaths(lock) {
  return Object.keys(lock.files || {});
}

/** Persist the lockfile atomically. */
export function writeLock(targetDir, { source, sourceSha, packs, files }) {
  const lock = {
    source,
    sourceSha: sourceSha || null,
    packs,
    generatedAt: new Date().toISOString(),
    files,
  };
  writeFileAtomic(targetDir, LOCK_PATH, Buffer.from(JSON.stringify(lock, null, 2) + '\n', 'utf8'));
  return lock;
}
