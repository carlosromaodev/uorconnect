#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hasSameOrigin, preparePrivateDirectory, writePrivateFile } from './inspection-security.mjs';

const baseUrl = 'https://moodle.uor.edu.ao';
assert.equal(hasSameOrigin('/course/view.php?id=1', baseUrl), true);
assert.equal(hasSameOrigin('https://moodle.uor.edu.ao/my/', baseUrl), true);
assert.equal(hasSameOrigin('https://moodle.uor.edu.ao.evil.example/my/', baseUrl), false);
assert.equal(hasSameOrigin('https://evil.example/?next=https://moodle.uor.edu.ao', baseUrl), false);
assert.equal(hasSameOrigin('http://moodle.uor.edu.ao/my/', baseUrl), false);

const testRoot = await mkdtemp(join(tmpdir(), 'uor-moodle-inspector-test-'));
try {
  const evidenceDirectory = join(testRoot, 'evidence');
  await preparePrivateDirectory(evidenceDirectory);
  assert.equal((await stat(evidenceDirectory)).mode & 0o777, 0o700);

  const evidenceFile = join(evidenceDirectory, 'evidence.json');
  await writePrivateFile(evidenceFile, '{"safe":true}\n');
  assert.equal((await stat(evidenceFile)).mode & 0o777, 0o600);
  assert.equal(await readFile(evidenceFile, 'utf8'), '{"safe":true}\n');

  const target = join(testRoot, 'target.txt');
  const maliciousLink = join(evidenceDirectory, 'linked-evidence.json');
  await writeFile(target, 'não substituir');
  await symlink(target, maliciousLink);
  await assert.rejects(() => writePrivateFile(maliciousLink, 'substituído'));
  assert.equal(await readFile(target, 'utf8'), 'não substituir');
} finally {
  await rm(testRoot, { recursive: true, force: true });
}

console.log('Segurança do inspetor Moodle verificada: same-origin, 0700, 0600 e no-follow.');
