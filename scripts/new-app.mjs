#!/usr/bin/env node
// Scaffolds apps/<name>/ from a template and writes its deploy config.
//
//   node scripts/new-app.mjs <name> [--template static-vite] [--type hosting|apphosting]
//                                   [--domain <host>] [--firestore] [--ttl-collections "<group> ..."]
//                                   [--config-only]
//
// --config-only writes app.json and the Firebase config into an existing folder (for apps
// copied in from another repo) without copying a template.
// The Google-side resources (site, backends, databases, DNS) are created by the create-app workflow.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const root = new URL('..', import.meta.url).pathname;

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    template: { type: 'string', default: 'static-vite' },
    type: { type: 'string', default: 'hosting' },
    domain: { type: 'string' },
    firestore: { type: 'boolean', default: false },
    'ttl-collections': { type: 'string' },
    'config-only': { type: 'boolean', default: false },
  },
});

const name = positionals[0];
if (!name || !/^[a-z][a-z0-9-]{1,28}[a-z0-9]$/.test(name)) {
  console.error('usage: new-app.mjs <name> [options]  (name: lowercase letters, digits and dashes, 3-30 chars)');
  process.exit(2);
}
if (!['hosting', 'apphosting'].includes(opts.type)) {
  console.error(`unknown --type ${opts.type}; use hosting or apphosting`);
  process.exit(2);
}

const dir = join(root, 'apps', name);
const configOnly = opts['config-only'];

if (configOnly) {
  if (!existsSync(dir)) {
    console.error(`apps/${name} does not exist; --config-only needs an existing folder`);
    process.exit(1);
  }
} else {
  if (existsSync(dir)) {
    console.error(`apps/${name} already exists`);
    process.exit(1);
  }
  const templateDir = join(root, 'templates', opts.template);
  if (!existsSync(templateDir)) {
    console.error(`no template templates/${opts.template}`);
    process.exit(1);
  }
  cpSync(templateDir, dir, {
    recursive: true,
    filter: (src) => !/[\\/](node_modules|dist)$/.test(src),
  });
  replacePlaceholders(dir);
}

const app = {
  name,
  type: opts.type,
  domain: opts.domain ?? `${name}.trom.dev`,
};
if (opts.type === 'hosting') {
  app.hostingSite = `trom-${name}`;
} else {
  app.backend = name;
  app.previewBackend = `${name}-preview`;
}
if (opts.firestore) {
  app.firestore = { prod: name, preview: `${name}-preview` };
  // Collection groups whose documents carry an expiresAt timestamp; create-app adds a TTL policy for each.
  const ttl = (opts['ttl-collections'] ?? '').split(/[\s,]+/).filter(Boolean);
  if (ttl.length) app.ttlCollections = ttl;
}
writeJson(join(dir, 'app.json'), app);

const firebase = {};
if (opts.type === 'hosting') {
  firebase.hosting = {
    site: app.hostingSite,
    public: 'dist',
    ignore: ['firebase.json', '**/.*', '**/node_modules/**'],
  };
}
if (opts.firestore) {
  firebase.firestore = [app.firestore.prod, app.firestore.preview].map((database) => ({
    database,
    rules: 'firestore.rules',
    indexes: 'firestore.indexes.json',
  }));
  writeIfMissing(
    join(dir, 'firestore.rules'),
    "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if false;\n    }\n  }\n}\n",
  );
  writeIfMissing(join(dir, 'firestore.indexes.json'), JSON.stringify({ indexes: [], fieldOverrides: [] }, null, 2) + '\n');
}
if (Object.keys(firebase).length) writeJson(join(dir, 'firebase.json'), firebase);

if (opts.type === 'apphosting') {
  writeIfMissing(join(dir, 'apphosting.yaml'), 'runConfig:\n  minInstances: 0\n  maxInstances: 2\n\nenv: []\n');
  writeIfMissing(join(dir, 'apphosting.preview.yaml'), '# Overrides for the preview backend (environment name: preview).\nenv: []\n');
}

if (!configOnly && existsSync(join(dir, 'package.json'))) {
  execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: dir, stdio: 'inherit' });
}

console.log(`\nWrote apps/${name}. Next:`);
console.log(`  Commit apps/${name} on a branch named ${name}/<short-description> and push. The preview run`);
console.log(`  creates the Google resources and DNS from app.json (create-app), then deploys a preview.`);

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

function writeIfMissing(path, text) {
  if (!existsSync(path)) writeFileSync(path, text);
}

function replacePlaceholders(folder) {
  for (const entry of readdirSync(folder)) {
    const path = join(folder, entry);
    if (statSync(path).isDirectory()) {
      replacePlaceholders(path);
    } else {
      const text = readFileSync(path, 'utf8');
      if (text.includes('__APP_NAME__')) writeFileSync(path, text.replaceAll('__APP_NAME__', name));
    }
  }
}
