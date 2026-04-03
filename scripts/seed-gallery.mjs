#!/usr/bin/env node
/**
 * Seed the community gallery with all built-in MOLTamp skins.
 *
 * Usage:
 *   node scripts/seed-gallery.mjs \
 *     --url https://moltamp.com \
 *     --email you@example.com \
 *     --key MOLT-XXXX-XXXX-XXXX-XXXX \
 *     --skins-dir ../moltamp/skins
 *
 * Requirements: Node 18+ (native fetch + FormData + Blob)
 */

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const TAGS_MAP = {
  'blade-runner': 'retro,cyberpunk,crt,amber',
  'phosphor': 'retro,crt,green,monochrome',
  'deep-space': 'sci-fi,blue,space',
  'neon-horizon': 'synthwave,cyberpunk,neon',
  'ice-nine': 'blue,cold,minimal',
  'biodiagnostic': 'sci-fi,medical,green',
  'lunar': 'red,monochrome,minimal',
  'lcars': 'sci-fi,warm,trek',
  'obsidian': 'dark,amber,minimal',
  'kosmos': 'retro,crt,soviet,amber',
};

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    opts[key] = args[i + 1];
  }
  return opts;
}

async function login(baseUrl, email, key) {
  console.log(`Logging in as ${email}...`);
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, license_key: key, display_name: 'Moltamp' }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(`Login failed: ${data.error || 'unknown'}`);
  }
  // Extract session cookie
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/moltamp_session=([a-f0-9]{64})/);
  if (!match) throw new Error('No session cookie in login response');
  console.log('Logged in successfully.');
  return match[1];
}

function zipSkin(skinDir) {
  const tmp = join(tmpdir(), `${Date.now()}.moltamp`);
  execSync(`cd "${skinDir}" && zip -r "${tmp}" . -x "*.DS_Store"`, { stdio: 'pipe' });
  return tmp;
}

async function uploadSkin(baseUrl, sessionId, zipPath, skinId) {
  const fileBytes = readFileSync(zipPath);
  const blob = new Blob([fileBytes], { type: 'application/zip' });
  const formData = new FormData();
  formData.append('file', blob, `${skinId}.moltamp`);
  const tags = TAGS_MAP[skinId] || '';
  if (tags) formData.append('tags', tags);

  const res = await fetch(`${baseUrl}/api/skins`, {
    method: 'POST',
    headers: { Cookie: `moltamp_session=${sessionId}` },
    body: formData,
  });

  const data = await res.json();
  return data;
}

async function main() {
  const opts = parseArgs();
  const baseUrl = (opts.url || 'https://moltamp.com').replace(/\/$/, '');
  const email = opts.email;
  const key = opts.key;
  const skinsDir = resolve(opts['skins-dir'] || '../moltamp/skins');

  if (!email || !key) {
    console.error('Usage: node scripts/seed-gallery.mjs --url <url> --email <email> --key <license-key> [--skins-dir <path>]');
    process.exit(1);
  }

  if (!existsSync(skinsDir)) {
    console.error(`Skins directory not found: ${skinsDir}`);
    process.exit(1);
  }

  const sessionId = await login(baseUrl, email, key);

  const skinDirs = readdirSync(skinsDir).filter(d => {
    const full = join(skinsDir, d);
    return statSync(full).isDirectory() && existsSync(join(full, 'skin.json'));
  });

  console.log(`Found ${skinDirs.length} skins to upload.\n`);

  let success = 0;
  let failed = 0;

  for (const dir of skinDirs) {
    const skinPath = join(skinsDir, dir);
    const manifest = JSON.parse(readFileSync(join(skinPath, 'skin.json'), 'utf8'));
    process.stdout.write(`  ${manifest.name} (${manifest.id})... `);

    try {
      const zipPath = zipSkin(skinPath);
      const result = await uploadSkin(baseUrl, sessionId, zipPath, manifest.id);

      if (result.success) {
        console.log('OK');
        success++;
      } else {
        const msg = result.errors?.join('; ') || result.error || 'unknown error';
        console.log(`WARN: ${msg}`);
        // Count as success if it's a duplicate (already uploaded)
        if (msg.includes('already taken')) {
          console.log('    (already exists, skipping)');
          success++;
        } else {
          failed++;
        }
      }
    } catch (err) {
      console.log(`FAIL: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} uploaded, ${failed} failed.`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
