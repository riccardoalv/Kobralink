import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { adoptLegacyDatabase, adoptLegacyEnv } from '../src/config/env';

const dirs: string[] = [];
const tmp = () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'farolprint-legacy-'));
    dirs.push(d);
    return d;
};

afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
    for (const k of Object.keys(process.env)) {
        if (k.startsWith('KOBRALINK_TEST') || k.startsWith('FAROLPRINT_TEST')) delete process.env[k];
    }
});

describe('legacy environment', () => {
    it('copies KOBRALINK_* variables to their FAROLPRINT_* names when those are unset', () => {
        process.env.KOBRALINK_TEST_A = 'old';
        process.env.KOBRALINK_TEST_B = 'old';
        process.env.FAROLPRINT_TEST_B = 'new';
        adoptLegacyEnv();
        expect(process.env.FAROLPRINT_TEST_A).toBe('old');
        expect(process.env.FAROLPRINT_TEST_B).toBe('new');
    });
});

describe('legacy database', () => {
    it('renames kobralink.db and its WAL files to farolprint.db', () => {
        const dir = tmp();
        fs.writeFileSync(path.join(dir, 'kobralink.db'), 'db');
        fs.writeFileSync(path.join(dir, 'kobralink.db-wal'), 'wal');
        adoptLegacyDatabase(dir);
        expect(fs.readFileSync(path.join(dir, 'farolprint.db'), 'utf8')).toBe('db');
        expect(fs.readFileSync(path.join(dir, 'farolprint.db-wal'), 'utf8')).toBe('wal');
        expect(fs.existsSync(path.join(dir, 'kobralink.db'))).toBe(false);
    });

    it('leaves an existing farolprint.db alone', () => {
        const dir = tmp();
        fs.writeFileSync(path.join(dir, 'kobralink.db'), 'old');
        fs.writeFileSync(path.join(dir, 'farolprint.db'), 'new');
        adoptLegacyDatabase(dir);
        expect(fs.readFileSync(path.join(dir, 'farolprint.db'), 'utf8')).toBe('new');
        expect(fs.existsSync(path.join(dir, 'kobralink.db'))).toBe(true);
    });

    it('does nothing in a fresh data dir', () => {
        const dir = tmp();
        adoptLegacyDatabase(dir);
        expect(fs.readdirSync(dir)).toEqual([]);
    });
});
