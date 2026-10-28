import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';
import { EventEmitter } from 'node:events';
import { NotFoundException } from '@nestjs/common';
import type { PrinterBridge } from '../src/bridge/printer-bridge';
import type { GcodeService } from '../src/gcode/gcode.service';
import type { NotificationService } from '../src/notifications/notification.service';
import { parseQueueOptions, QueueService } from '../src/queue/queue.service';
import { seedFile, seedPrinter, type TestDb, testDb } from './helpers/db';

let db: TestDb;
let svc: QueueService;
const printStoredFile = mock(async () => ({}));
const emitCustom = mock(() => undefined);
const gcode = {
    getByFilename: async (name: string) => (name === 'lid.gcode' ? { id: 'f2' } : null),
} as unknown as GcodeService;

function attach(settings: { queueAutoStart: boolean; queueBedClearConfirm: boolean }) {
    const emitter = new EventEmitter();
    let snapshot = { connected: true, printState: 'standby', kobraState: 'free' };
    const bridge = Object.assign(emitter, {
        id: 'p1',
        config: { name: 'Kobra', ip: '127.0.0.1', httpPort: 7125 },
        settings,
        snapshot: () => snapshot,
        printStoredFile,
    }) as unknown as PrinterBridge;
    svc.attach(bridge);
    return {
        state: async (kobraState: string, connected = true) => {
            snapshot = { connected, printState: kobraState === 'printing' ? 'printing' : 'standby', kobraState };
            emitter.emit('state', { kobraState, connected });
            await new Promise((r) => setTimeout(r, 5));
        },
        detach: () => svc.detach('p1'),
    };
}

beforeAll(async () => {
    db = await testDb();
    await seedPrinter(db.client, 'p1', 'Kobra');
    await seedFile(db.client, 'f1', 'bracket.gcode');
    await seedFile(db.client, 'f2', 'lid.gcode');
    svc = new QueueService(db.prisma, gcode, { emitCustom } as unknown as NotificationService);
});

afterAll(() => db.close());

describe('queue items', () => {
    it('appends at the end and inserts at the front on demand', async () => {
        const a = await svc.add('p1', 'f1', []);
        const b = await svc.add('p1', 'f2', ['cube']);
        const c = await svc.add('p1', 'f1', [], true);
        const list = await svc.list('p1');
        expect(list.map((i) => i.id)).toEqual([c.id, a.id, b.id]);
        expect(list.map((i) => i.position)).toEqual([0, 1, 2]);
        expect(list[2].excludedObjects).toEqual(['cube']);
        expect(list[0]).toMatchObject({ filename: 'bracket.gcode', estPrintTimeSec: 600 });
        expect((await svc.peek('p1'))?.id).toBe(c.id);
        await svc.clear('p1');
        expect(await svc.list('p1')).toEqual([]);
        expect(await svc.peek('p1')).toBeNull();
    });

    it('rejects unknown files and filenames', async () => {
        await expect(svc.add('p1', 'nope', [])).rejects.toBeInstanceOf(NotFoundException);
        await expect(svc.addByFilename('p1', 'nope.gcode')).rejects.toBeInstanceOf(NotFoundException);
        const item = await svc.addByFilename('p1', 'lid.gcode');
        expect(item.fileId).toBe('f2');
        await svc.remove('p1', item.id);
        await svc.remove('p1', 'missing');
        expect(await svc.list('p1')).toEqual([]);
    });

    it('reorders by the given ids', async () => {
        const a = await svc.add('p1', 'f1', []);
        const b = await svc.add('p1', 'f2', []);
        const next = await svc.reorder('p1', [b.id, a.id]);
        expect(next.map((i) => i.id)).toEqual([b.id, a.id]);
        expect((await svc.list('p1')).map((i) => i.id)).toEqual([b.id, a.id]);
        await svc.clear('p1');
    });

    it('stores the print options of each item and defaults them to none', async () => {
        const plain = await svc.add('p1', 'f1', []);
        const tuned = await svc.add('p1', 'f2', [], false, {
            autoLeveling: false,
            vibrationCompensation: false,
            timelapse: true,
            failureDetection: false,
            filamentAssignments: [{ paintIndex: 0, slotIndex: 2 }],
        });
        expect(plain.options).toEqual({});
        expect(tuned.options).toEqual({
            autoLeveling: false,
            vibrationCompensation: false,
            timelapse: true,
            failureDetection: false,
            filamentAssignments: [{ paintIndex: 0, slotIndex: 2, isUsed: true }],
        });
        expect((await svc.list('p1'))[1].options).toEqual(tuned.options);
        await svc.clear('p1');
    });
});

describe('parseQueueOptions', () => {
    it('reads stored options and ignores invalid or unknown values', () => {
        expect(parseQueueOptions('{"vibrationCompensation":false,"other":1}')).toEqual({
            vibrationCompensation: false,
        });
        expect(parseQueueOptions('{"vibrationCompensation":"no"}')).toEqual({});
        expect(parseQueueOptions('not json')).toEqual({});
        expect(parseQueueOptions('{}')).toEqual({});
    });
});

describe('queue status', () => {
    it('reports no hold without a watch or without a next file', async () => {
        expect(await svc.status('p1')).toEqual({ awaitingBedClear: false, nextFilename: null });
        await svc.add('p1', 'f1', []);
        expect(await svc.status('p1')).toEqual({ awaitingBedClear: false, nextFilename: 'bracket.gcode' });
        await svc.clear('p1');
    });

    it('holds after a print until the bed is confirmed clear, then starts the next file', async () => {
        const h = attach({ queueAutoStart: true, queueBedClearConfirm: true });
        printStoredFile.mockClear();
        await svc.add('p1', 'f1', ['cube']);
        await h.state('printing');
        await h.state('finished');
        await h.state('free');
        expect(await svc.status('p1')).toEqual({ awaitingBedClear: true, nextFilename: 'bracket.gcode' });
        expect(printStoredFile).not.toHaveBeenCalled();
        const started = await svc.confirmBedClear('p1');
        expect(started.filename).toBe('bracket.gcode');
        expect(printStoredFile).toHaveBeenCalledTimes(1);
        const [fileId, opts] = printStoredFile.mock.calls[0] as unknown as [string, Record<string, unknown>];
        expect(fileId).toBe('f1');
        expect(opts.excludedObjects).toEqual(['cube']);
        expect(await svc.status('p1')).toEqual({ awaitingBedClear: false, nextFilename: null });
        h.detach();
    });

    it('starts the next file with the options chosen in the dialog', async () => {
        const h = attach({ queueAutoStart: false, queueBedClearConfirm: false });
        printStoredFile.mockClear();
        await svc.add('p1', 'f1', ['cube'], false, {
            vibrationCompensation: false,
            autoLeveling: false,
            timelapse: true,
        });
        await svc.startNext('p1');
        const [, opts] = printStoredFile.mock.calls[0] as unknown as [string, Record<string, unknown>];
        expect(opts).toMatchObject({
            vibrationCompensation: false,
            autoLeveling: false,
            timelapse: true,
            excludedObjects: ['cube'],
        });
        expect(String(opts.serveBase)).toMatch(/:7125$/);
        h.detach();
    });

    it('leaves the options to the printer settings for items queued without any', async () => {
        const h = attach({ queueAutoStart: false, queueBedClearConfirm: false });
        printStoredFile.mockClear();
        await svc.add('p1', 'f1', []);
        await svc.startNext('p1');
        const [, opts] = printStoredFile.mock.calls[0] as unknown as [string, Record<string, unknown>];
        expect(opts.vibrationCompensation).toBeUndefined();
        expect(opts.autoLeveling).toBeUndefined();
        h.detach();
    });

    it('drops the hold when the queue is cleared', async () => {
        const h = attach({ queueAutoStart: true, queueBedClearConfirm: true });
        await svc.add('p1', 'f1', []);
        await h.state('printing');
        await h.state('finished');
        await h.state('free');
        expect((await svc.status('p1')).awaitingBedClear).toBe(true);
        await svc.clear('p1');
        expect((await svc.status('p1')).awaitingBedClear).toBe(false);
        h.detach();
    });

    it('refuses to start when the printer is busy or the queue is empty', async () => {
        const h = attach({ queueAutoStart: false, queueBedClearConfirm: false });
        await svc.clear('p1');
        await expect(svc.startNext('p1')).rejects.toBeInstanceOf(NotFoundException);
        await svc.add('p1', 'f1', []);
        await h.state('printing');
        await expect(svc.startNext('p1')).rejects.toBeInstanceOf(Error);
        await svc.clear('p1');
        h.detach();
    });
});
