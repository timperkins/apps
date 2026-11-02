#!/usr/bin/env node
// Lists the apps added on this branch (app.json on HEAD but not at the merge-base with <ref>),
// with the create-app inputs read from each app.json, as a JSON array:
//
//   node scripts/new-apps.mjs --base origin/main
//   [{"name":"news-v2","type":"apphosting","firestore":false,"ttl_collections":"","domain":"news-v2.trom.dev"}]
//
// preview.yml runs create-app for each one before its first deploy.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const appsDir = join(root, 'apps');

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function existsAt(ref, path) {
  try {
    git('cat-file', '-e', `${ref}:${path}`);
    return true;
  } catch {
    return false;
  }
}

const [mode, ref] = process.argv.slice(2);
if (mode !== '--base' || !ref) {
  console.error('usage: new-apps.mjs --base <ref>');
  process.exit(2);
}
const base = git('merge-base', ref, 'HEAD');

const result = [];
const dirs = existsSync(appsDir) ? readdirSync(appsDir, { withFileTypes: true }).filter((d) => d.isDirectory()) : [];
for (const { name } of dirs.sort((a, b) => a.name.localeCompare(b.name))) {
  const path = `apps/${name}/app.json`;
  if (!existsSync(join(root, path)) || existsAt(base, path)) continue;
  const app = JSON.parse(readFileSync(join(root, path), 'utf8'));
  const ttl = app.ttlCollections ?? [];
  if (!Array.isArray(ttl) || !ttl.every((g) => /^[A-Za-z][A-Za-z0-9_-]*$/.test(g))) {
    console.error(`${path}: ttlCollections must be a list of collection group names`);
    process.exit(1);
  }
  result.push({
    name,
    type: app.type,
    firestore: Boolean(app.firestore),
    ttl_collections: ttl.join(' '),
    domain: app.domain ?? '',
  });
}

console.log(JSON.stringify(result));
