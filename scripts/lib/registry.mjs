// Load and validate registry.json — the central mapping of target repos -> packs.
// Pure Node, no dependencies.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO_SLUG = /^[\w.-]+\/[\w.-]+$/;

/**
 * Read and parse registry.json from the source dir.
 * @param {string} sourceDir - root of the claude-code-templates repo.
 */
export function loadRegistry(sourceDir) {
  const file = join(sourceDir, 'registry.json');
  if (!existsSync(file)) {
    throw new Error(`registry.json not found at ${file}`);
  }
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`registry.json is not valid JSON: ${err.message}`);
  }
  return data;
}

/**
 * Validate registry shape and that every referenced pack exists on disk.
 * Returns an array of human-readable error strings (empty = valid).
 * @param {object} registry
 * @param {string} sourceDir
 */
export function validateRegistry(registry, sourceDir) {
  const errors = [];

  if (!registry || typeof registry !== 'object') {
    return ['registry.json must be a JSON object'];
  }
  if (!Array.isArray(registry.targets) || registry.targets.length === 0) {
    errors.push('registry.targets must be a non-empty array');
    return errors;
  }

  const seen = new Set();
  for (const [i, t] of registry.targets.entries()) {
    const where = `targets[${i}]`;
    if (!t || typeof t !== 'object') {
      errors.push(`${where} must be an object`);
      continue;
    }
    if (typeof t.repo !== 'string' || !REPO_SLUG.test(t.repo)) {
      errors.push(`${where}.repo must be an "owner/name" slug (got ${JSON.stringify(t.repo)})`);
    } else if (seen.has(t.repo)) {
      errors.push(`${where}.repo "${t.repo}" is listed more than once`);
    } else {
      seen.add(t.repo);
    }
    if (!Array.isArray(t.packs) || t.packs.length === 0) {
      errors.push(`${where}.packs must be a non-empty array`);
    } else {
      for (const pack of t.packs) {
        const dir = join(sourceDir, 'packs', pack);
        if (!existsSync(dir) || !statSync(dir).isDirectory()) {
          errors.push(`${where} references unknown pack "${pack}" (no packs/${pack}/ dir)`);
        }
      }
    }
    if (t.branch !== undefined && typeof t.branch !== 'string') {
      errors.push(`${where}.branch must be a string when present`);
    }
  }

  return errors;
}

/**
 * Find a single target entry by repo slug. Throws if absent.
 */
export function findTarget(registry, repo) {
  const target = registry.targets.find((t) => t.repo === repo);
  if (!target) {
    const known = registry.targets.map((t) => t.repo).join(', ');
    throw new Error(`repo "${repo}" is not in registry.json. Known targets: ${known}`);
  }
  return target;
}

/** Resolve the branch for a target, falling back to the registry default. */
export function targetBranch(registry, target) {
  return target.branch || registry.defaultBranch || 'main';
}
