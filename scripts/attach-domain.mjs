#!/usr/bin/env node
// Attaches a custom domain to a Hosting site or App Hosting backend, writes the DNS records
// Firebase asks for into Cloud DNS, and adds the domain to Firebase Auth's authorized domains.
// Run by the create-app workflow with the deploy service account; safe to re-run.
//
//   node scripts/attach-domain.mjs --domain pong.trom.dev --hosting-site trom-pong
//   node scripts/attach-domain.mjs --domain news.trom.dev --backend news --region us-central1
//   node scripts/attach-domain.mjs --domain news-preview--apps-97595.us-central1.hosted.app --authorize-only
//
// Env: FIREBASE_PROJECT (default apps-97595), DNS_ZONE (Cloud DNS zone name, default trom-dev).
// Auth: an access token from `gcloud auth print-access-token`.
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const { values: opts } = parseArgs({
  options: {
    domain: { type: 'string' },
    'hosting-site': { type: 'string' },
    backend: { type: 'string' },
    region: { type: 'string', default: 'us-central1' },
    'authorize-only': { type: 'boolean', default: false },
  },
});

const project = process.env.FIREBASE_PROJECT ?? 'apps-97595';
const zone = process.env.DNS_ZONE ?? 'trom-dev';
const domain = opts.domain;
if (!domain || (!opts['authorize-only'] && !opts['hosting-site'] === !opts.backend)) {
  console.error('usage: attach-domain.mjs --domain <host> (--hosting-site <site> | --backend <id> [--region r] | --authorize-only)');
  process.exit(2);
}

const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-goog-user-project': project,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  return { status: res.status, ok: res.ok, json };
}

async function must(method, url, body) {
  const res = await api(method, url, body);
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${JSON.stringify(res.json)}`);
  return res.json;
}

// Logs a line; in GitHub Actions also as a notice annotation, which is readable without the raw log.
function report(message) {
  console.log(message);
  if (process.env.GITHUB_ACTIONS) console.log(`::notice title=attach-domain::${message.replaceAll('%', '%25')}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Creates the custom domain (ignoring "already exists") and polls until Firebase reports the DNS
// records it wants. Returns a flat list of { domainName, type, rdata, requiredAction }.
async function requiredRecords() {
  let base, createUrl, read;
  if (opts['hosting-site']) {
    base = `https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites/${opts['hosting-site']}/customDomains`;
    createUrl = `${base}?customDomainId=${domain}`;
    read = (d) => [d.requiredDnsUpdates];
  } else {
    base = `https://firebaseapphosting.googleapis.com/v1beta/projects/${project}/locations/${opts.region}/backends/${opts.backend}/domains`;
    createUrl = `${base}?domainId=${domain}`;
    read = (d) => d.customDomainStatus?.requiredDnsUpdates ?? [];
  }

  const created = await api('POST', createUrl, {});
  if (!created.ok && created.status !== 409) {
    if (opts.backend) {
      // Diagnostics for a backend the domains API can't find.
      const backendUrl = base.replace(/\/domains$/, '');
      for (const url of [backendUrl, base, backendUrl.replace('/v1beta/', '/v1/')]) {
        const res = await api('GET', url);
        report(`GET ${url} -> ${res.status} ${JSON.stringify(res.json).slice(0, 300)}`);
      }
    }
    throw new Error(`creating custom domain failed: ${created.status} ${JSON.stringify(created.json)}`);
  }
  report(created.ok ? `Created custom domain ${domain}` : `Custom domain ${domain} already exists`);

  // A domain that already existed may be fully set up, in which case Firebase lists no records
  // to add. Give it a short grace period, then treat that as nothing to do.
  const attempts = created.ok ? 30 : 3;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const res = await api('GET', `${base}/${domain}`);
    if (res.ok) {
      const records = read(res.json)
        .flatMap((u) => u?.desired ?? [])
        .flatMap((set) => set.records ?? []);
      if (records.length) return records;
    }
    await sleep(10_000);
  }
  if (!created.ok) {
    report(`Firebase lists no DNS changes for ${domain}; leaving DNS as it is`);
    return [];
  }
  throw new Error(`Firebase did not report DNS records for ${domain} within 5 minutes`);
}

const fqdn = (name) => (name.endsWith('.') ? name : `${name}.`);

function normalizeRdata(type, rdata) {
  if (type === 'TXT' && !rdata.startsWith('"')) return `"${rdata}"`;
  if (type === 'CNAME') return fqdn(rdata);
  return rdata;
}

// Applies ADD/REMOVE actions on top of whatever record sets already exist, so unrelated values
// (for example other TXT records at the apex) are kept. Address records (A, AAAA, CNAME) are
// replaced outright: a domain moving from another backend must not keep its old IPs.
async function writeDns(records) {
  const dns = `https://dns.googleapis.com/dns/v1/projects/${project}/managedZones/${zone}/rrsets`;
  const groups = new Map();
  for (const r of records) {
    const key = `${fqdn(r.domainName)} ${r.type}`;
    if (!groups.has(key)) groups.set(key, { name: fqdn(r.domainName), type: r.type, add: [], remove: [] });
    const g = groups.get(key);
    const value = normalizeRdata(r.type, r.rdata);
    if (r.requiredAction === 'REMOVE') g.remove.push(value);
    else g.add.push(value);
  }

  for (const { name, type, add, remove } of groups.values()) {
    const existing = await api('GET', `${dns}/${name}/${type}`);
    const current = existing.ok ? existing.json.rrdatas ?? [] : [];
    const replace = ['A', 'AAAA', 'CNAME'].includes(type) && add.length > 0;
    const next = replace ? [...new Set(add)] : [...new Set([...current.filter((v) => !remove.includes(v)), ...add])];
    const same = next.length === current.length && next.every((v) => current.includes(v));
    if (same) {
      report(`DNS ${type} ${name} already correct`);
    } else if (!next.length) {
      await must('DELETE', `${dns}/${name}/${type}`);
      report(`DNS ${type} ${name} deleted`);
    } else if (existing.ok) {
      await must('PATCH', `${dns}/${name}/${type}`, { name, type, ttl: existing.json.ttl ?? 300, rrdatas: next });
      report(`DNS ${type} ${name} updated: ${current.join(', ')} -> ${next.join(', ')}`);
    } else {
      await must('POST', dns, { name, type, ttl: 300, rrdatas: next });
      report(`DNS ${type} ${name} created: ${next.join(', ')}`);
    }
  }

  const final = await must('GET', `${dns}?name=${fqdn(domain)}`);
  for (const set of final.rrsets ?? []) report(`Now ${set.type} ${set.name} = ${set.rrdatas.join(', ')}`);
}

async function authorize(host) {
  const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;
  const config = await must('GET', url);
  const domains = config.authorizedDomains ?? [];
  if (domains.includes(host)) {
    report(`Auth already allows ${host}`);
    return;
  }
  await must('PATCH', `${url}?updateMask=authorizedDomains`, { authorizedDomains: [...domains, host] });
  report(`Auth now allows ${host}`);
}

if (!opts['authorize-only']) {
  await writeDns(await requiredRecords());
  console.log('DNS written. Firebase verifies the domain and issues a certificate, which can take up to an hour.');
}
await authorize(domain);
