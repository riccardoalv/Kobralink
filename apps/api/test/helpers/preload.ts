import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'farolprint-test-'));
process.env.FAROLPRINT_DATA_DIR = dir;
process.env.BETTER_AUTH_SECRET = 'test-secret-test-secret-test-secret-1234';
process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }));
