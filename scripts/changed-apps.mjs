#!/usr/bin/env node
// Lists the apps under apps/ that need a deploy, as a JSON array of names.
//
//   node scripts/changed-apps.mjs --base <ref>   apps changed between the merge-base of <ref> and HEAD (previews)
//   node scripts/changed-apps.mjs --deployed     apps changed since their deployed/<name> tag; no tag means changed (prod)
//   node scripts/changed-apps.mjs --all          every app
//
// Only folders with an app.json count as apps. Apps deleted on HEAD are never listed.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const appsDir = join(root, 'apps');

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function listApps() {
  if (!existsSync(appsDir)) return [];
  return readdirSync(appsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(appsDir, d.name, 'app.json')))
    .map((d) => d.name)
    .sort();
}

function changedSince(ref, app) {
  return git('diff', '--name-only', ref, 'HEAD', '--', `apps/${app}/`) !== '';
}

function tagExists(tag) {
  try {
    git('rev-parse', '--verify', '--quiet', `refs/tags/${tag}`);
    return true;
  } catch {
    return false;
  }
}

const [mode, ref] = process.argv.slice(2);
const apps = listApps();
let result;

if (mode === '--all') {
  result = apps;
} else if (mode === '--deployed') {
  result = apps.filter((app) => {
    const tag = `deployed/${app}`;
    return !tagExists(tag) || changedSince(tag, app);
  });
} else if (mode === '--base' && ref) {
  const base = git('merge-base', ref, 'HEAD');
  result = apps.filter((app) => changedSince(base, app));
} else {
  console.error('usage: changed-apps.mjs --base <ref> | --deployed | --all');
  process.exit(2);
}

console.log(JSON.stringify(result));
