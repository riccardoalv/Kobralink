import { describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { applyMigrations } from '../src/prisma/migrator';
import { MIGRATIONS_DIR, testDb } from './helpers/db';

async function columns(file: string, table: string): Promise<string[]> {
    const db = createClient({ url: `file:${file}` });
    try {
        const res = await db.execute(`PRAGMA table_info("${table}")`);
        return res.rows.map((r) => String(r.name));
    } finally {
        db.close();
    }
}

async function tables(file: string): Promise<string[]> {
    const db = createClient({ url: `file:${file}` });
    try {
        const res = await db.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
        return res.rows.map((r) => String(r.name));
    } finally {
        db.close();
    }
}

describe('migrations', () => {
    it('create the single-printer workflow tables and columns on a fresh database', async () => {
        const db = await testDb();
        try {
            const names = await tables(db.file);
            expect(names).toEqual(
                expect.arrayContaining(['print_job', 'scheduled_print', 'maintenance_task', 'maintenance_log']),
            );
            expect(await columns(db.file, 'print_job')).toEqual(
                expect.arrayContaining(['errorCode', 'errorMsg', 'failureReason', 'note', 'snapshot']),
            );
            expect(await columns(db.file, 'scheduled_print')).toEqual(
                expect.arrayContaining(['printerId', 'fileId', 'startAt', 'options']),
            );
            expect(await columns(db.file, 'maintenance_task')).toEqual(
                expect.arrayContaining([
                    'intervalHours',
                    'intervalJobs',
                    'intervalDays',
                    'lastDoneAt',
                    'dueNotifiedAt',
                ]),
            );
            expect(await columns(db.file, 'maintenance_log')).toEqual(
                expect.arrayContaining(['taskId', 'doneAt', 'note', 'hours', 'jobs']),
            );
        } finally {
            await db.close();
        }
    });

    it('give print jobs a pause time that starts empty', async () => {
        const db = await testDb();
        try {
            expect(await columns(db.file, 'print_job')).toContain('pausedAt');
            await db.client.printer.create({
                data: {
                    id: 'p1',
                    name: 'Kobra',
                    ip: '127.0.0.1',
                    username: 'u',
                    password: 'p',
                    deviceId: 'd1',
                    httpPort: 7125,
                },
            });
            const job = await db.client.printJob.create({ data: { printerId: 'p1', filename: 'part.gcode' } });
            expect(job.pausedAt).toBeNull();
        } finally {
            await db.close();
        }
    });

    it('give queue items print options that default to none', async () => {
        const db = await testDb();
        try {
            expect(await columns(db.file, 'queue_item')).toContain('options');
            await db.client.printer.create({
                data: {
                    id: 'p1',
                    name: 'Kobra',
                    ip: '127.0.0.1',
                    username: 'u',
                    password: 'p',
                    deviceId: 'd',
                    httpPort: 17998,
                },
            });
            await db.client.gcodeFile.create({ data: { id: 'f1', filename: 'a.gcode', sizeBytes: 1, md5: 'f1' } });
            const item = await db.client.queueItem.create({ data: { printerId: 'p1', fileId: 'f1', position: 1 } });
            expect(item.options).toBe('{}');
        } finally {
            await db.close();
        }
    });

    it('are idempotent and recorded once each', async () => {
        const db = await testDb();
        try {
            const logs: string[] = [];
            await applyMigrations(`file:${db.file}`, MIGRATIONS_DIR, (msg) => logs.push(msg));
            expect(logs).toEqual([]);
            const rows = await db.client.$queryRawUnsafe<{ migration_name: string }[]>(
                'SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name',
            );
            const names = rows.map((r) => r.migration_name);
            expect(new Set(names).size).toBe(names.length);
            expect(names).toContain('20261028000000_single_printer_features');
            expect(names).toContain('20261029000000_queue_print_options');
        } finally {
            await db.close();
        }
    });

    it('cascade scheduled prints and maintenance tasks when their printer is deleted', async () => {
        const db = await testDb();
        try {
            await db.client.printer.create({
                data: {
                    id: 'p1',
                    name: 'Kobra',
                    ip: '127.0.0.1',
                    username: 'u',
                    password: 'p',
                    deviceId: 'd',
                    httpPort: 17999,
                },
            });
            await db.client.gcodeFile.create({ data: { id: 'f1', filename: 'a.gcode', sizeBytes: 1, md5: 'f1' } });
            await db.client.scheduledPrint.create({
                data: { printerId: 'p1', fileId: 'f1', startAt: new Date(), options: '{}' },
            });
            const task = await db.client.maintenanceTask.create({ data: { printerId: 'p1', name: 'Lube' } });
            await db.client.maintenanceLog.create({ data: { taskId: task.id } });
            await db.client.printer.delete({ where: { id: 'p1' } });
            expect(await db.client.scheduledPrint.count()).toBe(0);
            expect(await db.client.maintenanceTask.count()).toBe(0);
            expect(await db.client.maintenanceLog.count()).toBe(0);
        } finally {
            await db.close();
        }
    });
});

describe('maintenance preset key migration', () => {
    it('recognises tasks created from a recommendation in any language', async () => {
        const db = await testDb();
        try {
            expect(await columns(db.file, 'maintenance_task')).toContain('presetKey');
            const sql = fs.readFileSync(
                path.join(import.meta.dir, '../prisma/migrations/20261030010000_maintenance_preset_key/migration.sql'),
                'utf8',
            );
            const updates = sql.split('\n').filter((l) => l.startsWith('UPDATE'));
            await db.client.printer.create({
                data: {
                    id: 'p1',
                    name: 'K',
                    ip: '1.1.1.1',
                    username: 'u',
                    password: 'p',
                    deviceId: 'd',
                    httpPort: 17997,
                },
            });
            for (const name of ['Limpar o bico', 'Nettoyer la buse', ' Clean the fans ', 'My own task']) {
                await db.client.maintenanceTask.create({ data: { printerId: 'p1', name } });
            }
            for (const statement of updates) await db.client.$executeRawUnsafe(statement);
            const rows = await db.client.maintenanceTask.findMany({ orderBy: { name: 'asc' } });
            expect(Object.fromEntries(rows.map((r) => [r.name, r.presetKey]))).toEqual({
                ' Clean the fans ': 'clean_fans',
                'Limpar o bico': 'clean_nozzle',
                'My own task': '',
                'Nettoyer la buse': 'clean_nozzle',
            });
        } finally {
            await db.close();
        }
    });
});
