import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { parseMarkdownFile } from '../src/indexer/parser.js';

test('parseMarkdownFile uses local file modification date when frontmatter date is missing', async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lifeos-parser-date-'));
  const filePath = path.join(tempDir, 'note.md');

  t.after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  await fs.writeFile(filePath, '# note without date\n');
  const fileMtime = new Date(2026, 2, 22, 23, 45, 0);
  await fs.utimes(filePath, fileMtime, fileMtime);

  const result = await parseMarkdownFile(filePath);
  assert.equal(result.success, true);
  assert.equal(result.data?.frontmatter.date, '2026-03-22');
});
