import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { zipFolder, getFolderSizeBytes } from '../../utils/zipper';

suite('Zipper Tests', () => {
  let tempDir: string;

  setup(() => {
    // Create a temporary folder with some test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folderdrop-test-'));
    fs.writeFileSync(path.join(tempDir, 'hello.txt'), 'Hello, FolderDrop!');
    fs.writeFileSync(path.join(tempDir, 'data.json'), JSON.stringify({ key: 'value' }));
    const subDir = path.join(tempDir, 'subdir');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, 'nested.txt'), 'Nested file content');
  });

  teardown(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('zipFolder returns a non-empty Buffer', async () => {
    const buffer = await zipFolder(tempDir);
    assert.ok(buffer instanceof Buffer, 'Result should be a Buffer');
    assert.ok(buffer.length > 0, 'ZIP buffer should not be empty');
  });

  test('zipFolder produces a valid ZIP (starts with PK magic bytes)', async () => {
    const buffer = await zipFolder(tempDir);
    // ZIP files start with PK (0x50 0x4B)
    assert.strictEqual(buffer[0], 0x50, 'First byte should be 0x50 (P)');
    assert.strictEqual(buffer[1], 0x4B, 'Second byte should be 0x4B (K)');
  });

  test('getFolderSizeBytes returns correct size', () => {
    const size = getFolderSizeBytes(tempDir);
    assert.ok(size > 0, 'Folder size should be greater than 0');
    // Our test files are small — should be well under 1 KB
    assert.ok(size < 1024, 'Test folder should be under 1 KB');
  });

  test('getFolderSizeBytes returns 0 for empty folder', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folderdrop-empty-'));
    try {
      const size = getFolderSizeBytes(emptyDir);
      assert.strictEqual(size, 0, 'Empty folder should have size 0');
    } finally {
      fs.rmdirSync(emptyDir);
    }
  });
});
