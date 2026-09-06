#!/usr/bin/env node

import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_API = 'http://127.0.0.1:23119/api';
const DEFAULT_APP_NAME = 'Codex Zotero Paper Import';

function usage() {
  console.log('Usage: import_to_zotero.mjs --manifest FILE [--config FILE] [--validate-only] [--api URL]');
}

function parseArgs(argv) {
  const result = { validateOnly: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--manifest') result.manifest = argv[++i];
    else if (arg === '--config') result.config = argv[++i];
    else if (arg === '--api') result.api = argv[++i];
    else if (arg === '--validate-only') result.validateOnly = true;
    else if (arg === '--help' || arg === '-h') result.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

function expandHome(value) {
  if (typeof value !== 'string') return value;
  if (value === '~') return os.homedir();
  if (value.startsWith(`~${path.sep}`) || value.startsWith('~/')) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

function normalize(value) {
  return String(value || '').normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function normalizeDoi(value) {
  return String(value || '').trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
}

function ensureObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

async function loadJson(filename, label) {
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(filename, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${label} ${filename}: ${error.message}`);
  }
  ensureObject(parsed, label);
  return parsed;
}

async function loadManifest(filename) {
  if (!filename) throw new Error('--manifest is required');
  const parsed = await loadJson(filename, 'manifest');
  ensureObject(parsed, 'manifest');
  ensureObject(parsed.item, 'manifest.item');
  if (!parsed.item.itemType) throw new Error('manifest.item.itemType is required');
  if (!parsed.item.title) throw new Error('manifest.item.title is required');
  if (!Array.isArray(parsed.attachments) || parsed.attachments.length === 0) {
    throw new Error('manifest.attachments must contain at least one file');
  }
  return parsed;
}

async function loadConfig(explicitPath) {
  const configuredPath = explicitPath || process.env.ZOTERO_PAPER_IMPORT_CONFIG;
  const filename = expandHome(configuredPath || '~/.config/zotero-paper-import/config.json');
  try {
    return { filename, data: await loadJson(filename, 'configuration') };
  } catch (error) {
    if (!configuredPath && error.message.includes('ENOENT')) return { filename, data: {} };
    throw error;
  }
}

function mergeSettings(config, manifest) {
  const merged = {
    ...manifest,
    basePath: expandHome(manifest.basePath || config.basePath),
    destinationRoot: expandHome(manifest.destinationRoot || config.destinationRoot),
    collection: {
      ...(config.collection || {}),
      ...(manifest.collection || {}),
    },
    zoteroApi: manifest.zoteroApi || config.zoteroApi,
    appName: manifest.appName || config.appName,
  };
  if (!merged.basePath) throw new Error('basePath is required in the manifest or configuration');
  if (!path.isAbsolute(merged.basePath)) throw new Error('basePath must be absolute');
  if (!merged.collection.key && !merged.collection.name) {
    throw new Error('collection.key or collection.name is required in the manifest or configuration');
  }
  if (merged.destinationRoot) {
    if (!path.isAbsolute(merged.destinationRoot)) throw new Error('destinationRoot must be absolute');
    const relative = path.relative(merged.basePath, merged.destinationRoot);
    if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error('destinationRoot must be inside basePath');
    }
  }
  return merged;
}

function portableToAbsolute(portable, basePath) {
  if (!portable.startsWith('attachments:')) return path.resolve(portable);
  return path.resolve(basePath, portable.slice('attachments:'.length));
}

async function sha256(filename) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

async function validateAttachment(entry, basePath) {
  ensureObject(entry, 'attachment');
  if (!entry.title || !entry.path) throw new Error('Every attachment needs title and path');
  const baseReal = await fs.realpath(basePath);
  const absolute = portableToAbsolute(entry.path, basePath);
  const fileReal = await fs.realpath(absolute);
  const relative = path.relative(baseReal, fileReal);
  if (relative === '' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Attachment is outside basePath: ${absolute}`);
  }
  const stat = await fs.stat(fileReal);
  if (!stat.isFile() || stat.size === 0) throw new Error(`Attachment is empty or not a file: ${fileReal}`);
  const contentType = entry.contentType || 'application/pdf';
  if (contentType === 'application/pdf') {
    const handle = await fs.open(fileReal, 'r');
    try {
      const signature = Buffer.alloc(5);
      await handle.read(signature, 0, 5, 0);
      if (signature.toString('ascii') !== '%PDF-') throw new Error(`Not a valid PDF: ${fileReal}`);
    } finally {
      await handle.close();
    }
  }
  return {
    title: entry.title,
    absolute: fileReal,
    portable: `attachments:${relative.split(path.sep).join('/')}`,
    contentType,
    bytes: stat.size,
    sha256: await sha256(fileReal),
  };
}

async function parseResponse(response) {
  const text = await response.text();
  if (!response.ok) {
    const hint = response.status === 403
      ? ' Zotero local API may be disabled or awaiting authorization.'
      : '';
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 800)}${hint}`);
  }
  return text ? JSON.parse(text) : null;
}

async function discoverServerID(api) {
  const response = await fetch(`${api}/users/0/items?limit=1`);
  const serverID = response.headers.get('zotero-server-id');
  if (!response.ok) await parseResponse(response);
  if (!serverID) throw new Error('Zotero local API did not provide Zotero-Server-ID');
  return serverID;
}

async function authorize(api, serverID, appName) {
  const response = await fetch(`${api}/local/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Zotero-Server-ID': serverID },
    body: JSON.stringify({ appName }),
  });
  const result = await parseResponse(response);
  if (!result?.key) throw new Error('Zotero authorization did not return an API key');
  return result.key;
}

function apiHeaders(key, serverID, extra = {}) {
  return {
    'Zotero-API-Key': key,
    'Zotero-Server-ID': serverID,
    'Zotero-API-Version': '3',
    ...extra,
  };
}

async function request(api, endpoint, key, serverID, options = {}) {
  return parseResponse(await fetch(`${api}${endpoint}`, {
    ...options,
    headers: apiHeaders(key, serverID, options.headers || {}),
  }));
}

async function listAllItems(api, key, serverID) {
  const output = [];
  const limit = 100;
  for (let start = 0; start < 5000; start += limit) {
    const page = await request(api, `/users/0/items?itemType=-attachment&include=data&limit=${limit}&start=${start}`, key, serverID);
    output.push(...page);
    if (page.length < limit) break;
  }
  return output;
}

async function findCollection(api, key, serverID, requested) {
  if (requested.key) {
    try {
      const entry = await request(api, `/users/0/collections/${encodeURIComponent(requested.key)}?include=data`, key, serverID);
      return { key: entry.key, name: entry.data.name };
    } catch (error) {
      if (!requested.name) throw error;
    }
  }
  const collections = await request(api, '/users/0/collections?include=data&limit=1000', key, serverID);
  const match = collections.find(entry => entry.data?.name === requested.name);
  if (!match) throw new Error(`Target Zotero collection not found: ${requested.name || requested.key}`);
  return { key: match.key, name: match.data.name };
}

async function createItem(api, payload, key, serverID) {
  const result = await request(api, '/users/0/items', key, serverID, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Zotero-Write-Token': crypto.randomBytes(12).toString('hex'),
    },
    body: JSON.stringify([payload]),
  });
  const created = result?.successful?.['0'];
  const itemKey = created?.key || created?.data?.key;
  if (!itemKey) throw new Error(`Unable to create Zotero item: ${JSON.stringify(result).slice(0, 800)}`);
  return itemKey;
}

async function ensureCollectionMembership(api, item, collectionKey, key, serverID) {
  const collections = item.data?.collections || [];
  if (collections.includes(collectionKey)) return false;
  await request(api, `/users/0/items/${item.key}`, key, serverID, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'If-Unmodified-Since-Version': String(item.version),
      'Zotero-Write-Token': crypto.randomBytes(12).toString('hex'),
    },
    body: JSON.stringify({ collections: [...collections, collectionKey] }),
  });
  return true;
}

async function ensureParent(api, itemData, collectionKey, key, serverID) {
  const items = await listAllItems(api, key, serverID);
  const targetDoi = normalizeDoi(itemData.DOI);
  const existing = items.find(item => {
    const data = item.data || {};
    return (targetDoi && normalizeDoi(data.DOI) === targetDoi)
      || normalize(data.title) === normalize(itemData.title);
  });
  if (existing) {
    const collectionAdded = await ensureCollectionMembership(api, existing, collectionKey, key, serverID);
    return { key: existing.key, status: 'already_present', collectionAdded };
  }
  const payload = {
    ...itemData,
    collections: Array.from(new Set([...(itemData.collections || []), collectionKey])),
    relations: itemData.relations || {},
  };
  return { key: await createItem(api, payload, key, serverID), status: 'created', collectionAdded: false };
}

async function ensureAttachments(api, parentKey, requested, key, serverID) {
  let children = await request(api, `/users/0/items/${parentKey}/children?include=data`, key, serverID);
  const results = [];
  for (const file of requested) {
    const existing = children.find(item => item.data?.path === file.portable
      || normalize(item.data?.title) === normalize(file.title));
    if (existing) {
      results.push({ title: file.title, key: existing.key, status: 'already_present', path: existing.data?.path });
      continue;
    }
    const attachmentKey = await createItem(api, {
      itemType: 'attachment',
      parentItem: parentKey,
      linkMode: 'linked_file',
      title: file.title,
      accessDate: '',
      url: '',
      note: '',
      tags: [],
      relations: {},
      contentType: file.contentType,
      charset: '',
      path: file.portable,
    }, key, serverID);
    results.push({ title: file.title, key: attachmentKey, status: 'created', path: file.portable });
    children = await request(api, `/users/0/items/${parentKey}/children?include=data`, key, serverID);
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  const config = await loadConfig(args.config);
  const manifest = mergeSettings(config.data, await loadManifest(args.manifest));
  const validated = [];
  for (const entry of manifest.attachments) {
    validated.push(await validateAttachment(entry, manifest.basePath));
  }
  if (args.validateOnly) {
    console.log(JSON.stringify({ status: 'valid', title: manifest.item.title, attachments: validated }, null, 2));
    return;
  }

  const api = args.api || process.env.ZOTERO_LOCAL_API || manifest.zoteroApi || DEFAULT_API;
  let serverID;
  try {
    serverID = await discoverServerID(api);
  } catch (error) {
    throw new Error(`Cannot reach Zotero Desktop at ${api}. Open Zotero and enable its local API. ${error.message}`);
  }
  console.error('AUTHORIZE_IN_ZOTERO_IF_PROMPTED');
  const key = await authorize(api, serverID, manifest.appName || DEFAULT_APP_NAME);
  const collection = await findCollection(api, key, serverID, manifest.collection);
  const parent = await ensureParent(api, manifest.item, collection.key, key, serverID);
  const attachments = await ensureAttachments(api, parent.key, validated, key, serverID);
  console.log(JSON.stringify({
    status: 'ok',
    collection,
    parent,
    attachments,
  }, null, 2));
}

main().catch(error => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
