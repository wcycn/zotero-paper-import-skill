import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const importer = path.join(repositoryRoot, 'zotero-paper-import', 'scripts', 'import_to_zotero.mjs');

async function createFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zotero-paper-import-'));
  const basePath = path.join(root, 'Papers');
  const destinationRoot = path.join(basePath, 'Research');
  const pdfPath = path.join(destinationRoot, 'sample', 'PDFs', 'paper.pdf');
  await fs.mkdir(path.dirname(pdfPath), { recursive: true });
  await fs.writeFile(pdfPath, '%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n');

  const configPath = path.join(root, 'config.json');
  await fs.writeFile(configPath, JSON.stringify({
    basePath,
    destinationRoot,
    collection: { name: 'Research Papers' },
    includeSupportingInformation: true,
  }));

  const manifestPath = path.join(root, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify({
    item: {
      itemType: 'journalArticle',
      title: 'A Test Paper',
      DOI: '10.0000/example',
    },
    attachments: [{
      title: 'Full Text PDF',
      path: pdfPath,
      contentType: 'application/pdf',
    }],
  }));

  return { root, basePath, pdfPath, configPath, manifestPath };
}

function validate(configPath, manifestPath) {
  return spawnSync(process.execPath, [
    importer,
    '--validate-only',
    '--config',
    configPath,
    '--manifest',
    manifestPath,
  ], { encoding: 'utf8' });
}

test('merges configuration and produces a portable linked path', async () => {
  const fixture = await createFixture();
  try {
    const result = validate(fixture.configPath, fixture.manifestPath);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.status, 'valid');
    assert.equal(output.attachments.length, 1);
    assert.match(output.attachments[0].portable, /^attachments:Research\/sample\/PDFs\/paper\.pdf$/);
    assert.match(output.attachments[0].sha256, /^[a-f0-9]{64}$/);
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});
test('rejects attachments outside the configured base path', async () => {
  const fixture = await createFixture();
  try {
    const outside = path.join(fixture.root, 'outside.pdf');
    await fs.writeFile(outside, '%PDF-1.4\n%%EOF\n');
    const manifest = JSON.parse(await fs.readFile(fixture.manifestPath, 'utf8'));
    manifest.attachments[0].path = outside;
    await fs.writeFile(fixture.manifestPath, JSON.stringify(manifest));
    const result = validate(fixture.configPath, fixture.manifestPath);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /outside basePath/);
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

test('rejects non-PDF content with a PDF media type', async () => {
  const fixture = await createFixture();
  try {
    await fs.writeFile(fixture.pdfPath, '<html>login required</html>');
    const result = validate(fixture.configPath, fixture.manifestPath);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Not a valid PDF/);
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});
