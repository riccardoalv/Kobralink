import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { EventEmitter } from 'node:events';
import type { SpoolmanSpool } from '@farolprint/shared';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { PrinterBridge } from '../src/bridge/printer-bridge';
import type { GcodeService } from '../src/gcode/gcode.service';
import type { NotificationService } from '../src/notifications/notification.service';
import { filamentFit, parseQueueOptions, parseTags, QueueService, type SlotFilament } from '../src/queue/queue.service';
import type { SpoolmanService } from '../src/spoolman/spoolman.service';
import type { LocalSpoolService } from '../src/spools/local-spool.service';
import { seedFile, seedJob, seedPrinter, type TestDb, testDb } from './helpers/db';

let db: TestDb;
let svc: QueueService;
const printStoredFile = mock(async () => ({}));
const emitCustom = mock(() => undefined);
let spools: SpoolmanSpool[] | null = null;
const spoolmanMaps = new Map<string, Map<number, number>>();

const gcode = {
    getByFilename: async (name: string) => (name === 'lid.gcode' ? { id: 'f3' } : null),
} as unknown as GcodeService;
const spoolman = {
    spools: async () => spools,
    slotMap: (id: string) => spoolmanMaps.get(id) ?? new Map(),
} as unknown as SpoolmanService;
const localSpools = { active: false, list: async () => [], slotMap: () => new Map() } as unknown as LocalSpoolService;

interface FakeBridge {
    emitter: EventEmitter;
    state: (kobraState: string, extra?: Record<string, unknown>) => Promise<void>;
    settings: Record<string, unknown>;
}

const bridges: string[] = [];

function attach(id: string, settings: Record<string, unknown> = {}): FakeBridge {
    const emitter = new EventEmitter();
    let snapshot: Record<string, unknown> = {
        connected: true,
        printState: 'standby',
        kobraState: 'free',
        amsSlots: [],
        externalSpoolOnly: true,
        filamentMode: 'toolhead',
    };
    const all = { queueAutoStart: false, queueBedClearConfirm: true, lightTrigger: false, ...settings };
    const bridge = Object.assign(emitter, {
        id,
        config: { name: `Kobra ${id}`, ip: '127.0.0.1', httpPort: 7125 },
        settings: all,
        snapshot: () => snapshot,
        printStoredFile,
    }) as unknown as PrinterBridge;
    svc.attach(bridge);
    bridges.push(id);
    return {
        emitter,
        settings: all,
        state: async (kobraState: string, extra = {}) => {
            snapshot = {
                ...snapshot,
                connected: true,
                printState: kobraState === 'printing' ? 'printing' : 'standby',
                kobraState,
                ...extra,
            };
            emitter.emit('state', snapshot);
            await new Promise((r) => setTimeout(r, 10));
        },
    };
}

const black = { slotIndex: 0, colorHex: '#111111', material: 'PETG', isUsed: true, usedG: 50 };

async function file(id: string, data: Record<string, unknown> = {}, filaments = [black]) {
    await seedFile(db.client, id, `${id}.gcode`);
    await db.client.gcodeFile.update({
        where: { id },
        data: {
            printerModel: 'Anycubic Kobra 4',
            nozzleMm: 0.4,
            extentX: 100,
            extentY: 100,
            maxZ: 20,
            filaments: JSON.stringify(filaments),
            ...data,
        },
    });
}

beforeAll(async () => {
    db = await testDb();
    for (const id of ['p1', 'p2']) {
        await seedPrinter(db.client, id, `Kobra ${id}`);
        await db.client.printer.update({
            where: { id },
            data: {
                model: 'Anycubic Kobra 4',
                modeId: '20028',
                settings: JSON.stringify({ profile: { tags: id === 'p1' ? ['petg'] : [] } }),
            },
        });
    }
    await file('f1');
    await file('f2', { printerModel: 'Anycubic Kobra S1' });
    await file('f3', { printerModel: '' });
    await file('f4', {}, [{ ...black, material: 'PLA', colorHex: '#FFFFFF' }]);
    svc = new QueueService(db.prisma, gcode, { emitCustom } as unknown as NotificationService, spoolman, localSpools);
});

afterAll(() => db.close());

beforeEach(async () => {
    for (const id of bridges.splice(0)) svc.detach(id);
    await db.client.queueItem.deleteMany();
    await db.client.printer.updateMany({ data: { awaitingBedClear: false, maintenance: false } });
    printStoredFile.mockClear();
    emitCustom.mockClear();
    spools = null;
    spoolmanMaps.clear();
});

describe('queue items', () => {
    it('keeps one ordered queue with the target of each item', async () => {
        const a = await svc.add('f1', []);
        const b = await svc.add('f3', ['cube'], false, {}, { printerId: 'p2', targetTags: [] });
        const c = await svc.add('f1', [], true, {}, { printerId: null, targetTags: ['petg'] });
        const list = await svc.list();
        expect(list.map((i) => i.id)).toEqual([c.id, a.id, b.id]);
        expect(list.map((i) => [i.printerId, i.targetTags])).toEqual([
            [null, ['petg']],
            [null, []],
            ['p2', []],
        ]);
        expect(list[2].excludedObjects).toEqual(['cube']);
        expect(list[0]).toMatchObject({ filename: 'f1.gcode', estPrintTimeSec: 600 });
    });

    it('lists for a printer only what it can take', async () => {
        const forP1 = await svc.add('f1', [], false, {}, { printerId: null, targetTags: ['petg'] });
        const forP2 = await svc.add('f1', [], false, {}, { printerId: 'p2', targetTags: [] });
        expect((await svc.listFor('p1')).map((i) => i.id)).toEqual([forP1.id]);
        expect((await svc.listFor('p2')).map((i) => i.id)).toEqual([forP2.id]);
        expect((await svc.nextFor('p2'))?.id).toBe(forP2.id);
    });

    it('rejects unknown files and adds by filename for a printer without checking', async () => {
        await expect(svc.add('nope', [])).rejects.toBeInstanceOf(NotFoundException);
        await expect(svc.addByFilename('p1', 'nope.gcode')).rejects.toBeInstanceOf(NotFoundException);
        const item = await svc.addByFilename('p1', 'lid.gcode');
        expect(item).toMatchObject({ fileId: 'f3', printerId: 'p1' });
    });

    it('reorders, removes and clears all or one printer', async () => {
        const a = await svc.add('f1', []);
        const b = await svc.add('f3', [], false, {}, { printerId: 'p1', targetTags: [] });
        expect((await svc.reorder([b.id, a.id])).map((i) => i.id)).toEqual([b.id, a.id]);
        await svc.clear('p1');
        expect((await svc.list()).map((i) => i.id)).toEqual([a.id]);
        await svc.remove(a.id);
        await svc.remove('missing');
        expect(await svc.list()).toEqual([]);
        await svc.add('f1', []);
        await svc.clear();
        expect(await svc.list()).toEqual([]);
    });

    it('stores the print options and defaults them to none', async () => {
        await svc.add('f1', [], false, { autoLeveling: false, timelapse: true });
        await svc.add('f3', []);
        const [withOptions, without] = await svc.list();
        expect(withOptions.options).toEqual({ autoLeveling: false, timelapse: true });
        expect(without.options).toEqual({});
        expect(parseQueueOptions('{broken')).toEqual({});
        expect(parseTags('nope')).toEqual([]);
    });
});

describe('compatibility', () => {
    it('explains which printers can take a file and refuses a file nobody can print', async () => {
        const ok = await svc.check('f1', { printerId: null, targetTags: ['petg'] });
        expect(ok.ok).toBe(true);
        expect(ok.printers).toEqual([
            { printerId: 'p1', name: 'Kobra p1', reasons: [] },
            { printerId: 'p2', name: 'Kobra p2', reasons: ['target'] },
        ]);
        const wrong = await svc.check('f2', { printerId: null, targetTags: [] });
        expect(wrong.ok).toBe(false);
        expect(wrong.printers[0].reasons).toEqual(['model']);
        await expect(svc.add('f2', [])).rejects.toBeInstanceOf(UnprocessableEntityException);
        expect((await svc.add('f2', [], false, {}, { printerId: 'p1', targetTags: [] }, false)).fileId).toBe('f2');
    });

    it('checks the material and the colour against the spools in stock', async () => {
        spools = [{ id: 1, filament: { id: 1, material: 'PETG', color_hex: '000000' } }];
        expect((await svc.check('f1', { printerId: null, targetTags: [] })).ok).toBe(true);
        const pla = await svc.check('f4', { printerId: null, targetTags: [] });
        expect(pla.ok).toBe(false);
        expect(pla.printers[0].reasons).toEqual(['material']);
    });

    it('refuses another nozzle and parts bigger than the bed', async () => {
        await db.client.gcodeFile.update({ where: { id: 'f3' }, data: { nozzleMm: 0.6, extentX: 300 } });
        const check = await svc.check('f3', { printerId: 'p1', targetTags: [] });
        expect(check.printers[0].reasons).toEqual(['nozzle', 'size']);
        await db.client.gcodeFile.update({ where: { id: 'f3' }, data: { nozzleMm: 0.4, extentX: 100 } });
    });
});

describe('waiting reasons', () => {
    it('says why each item waits', async () => {
        const p1 = attach('p1');
        attach('p2');
        await svc.add('f1', [], false, {}, { printerId: 'p1', targetTags: [] }, false);
        expect((await svc.list())[0].waiting).toBe('manual');
        await p1.state('printing');
        expect((await svc.list())[0].waiting).toBe('busy');
        await p1.state('free');
        await db.client.printer.update({ where: { id: 'p1' }, data: { awaitingBedClear: true } });
        expect((await svc.list())[0].waiting).toBe('bed_clear');
        await db.client.printer.update({ where: { id: 'p1' }, data: { awaitingBedClear: false, maintenance: true } });
        expect((await svc.list())[0].waiting).toBe('maintenance');
    });

    it('waits for no printer, an offline printer or the filament', async () => {
        await svc.add('f1', [], false, {}, { printerId: null, targetTags: ['abs'] }, false);
        expect((await svc.list())[0].waiting).toBe('no_printer');
        await svc.clear();
        await svc.add('f1', [], false, {}, { printerId: 'p2', targetTags: [] }, false);
        expect((await svc.list())[0].waiting).toBe('offline');
        attach('p2');
        spools = [{ id: 7, remaining_weight: 30, filament: { id: 1, material: 'PETG', color_hex: '111111' } }];
        spoolmanMaps.set('p2', new Map([[0, 7]]));
        expect((await svc.list())[0].waiting).toBe('filament');
    });

    it('runs the spools down in queue order', async () => {
        attach('p1');
        spools = [{ id: 7, remaining_weight: 80, filament: { id: 1, material: 'PETG', color_hex: '111111' } }];
        spoolmanMaps.set('p1', new Map([[0, 7]]));
        await svc.add('f1', [], false, {}, { printerId: 'p1', targetTags: [] }, false);
        await svc.add('f1', [], false, {}, { printerId: 'p1', targetTags: [] }, false);
        expect((await svc.list()).map((i) => i.waiting)).toEqual(['manual', 'filament']);
    });
});

describe('dispatch', () => {
    it('starts the first item the printer can take, with its options', async () => {
        attach('p1');
        await svc.add('f2', [], false, {}, { printerId: 'p1', targetTags: [] }, false);
        await svc.add('f1', [], false, {}, { printerId: 'p2', targetTags: [] }, false);
        const mine = await svc.add('f1', ['cube'], false, { timelapse: true }, { printerId: null, targetTags: [] });
        const started = await svc.dispatch('p1');
        expect(started.id).toBe(mine.id);
        expect(printStoredFile).toHaveBeenCalledWith(
            'f1',
            expect.objectContaining({ timelapse: true, excludedObjects: ['cube'] }),
        );
        expect((await svc.list()).map((i) => i.fileId)).toEqual(['f2', 'f1']);
    });

    it('refuses to start when busy, in maintenance or with nothing to print', async () => {
        const p1 = attach('p1');
        await expect(svc.startNext('p1')).rejects.toBeInstanceOf(NotFoundException);
        await expect(svc.dispatch('nope')).rejects.toBeInstanceOf(NotFoundException);
        await svc.add('f1', []);
        await p1.state('printing');
        await expect(svc.dispatch('p1')).rejects.toThrow();
        await p1.state('free');
        await svc.setMaintenance('p1', true);
        await expect(svc.dispatch('p1')).rejects.toThrow();
        expect(printStoredFile).not.toHaveBeenCalled();
    });

    it('holds an item that would run out of filament and notifies it once', async () => {
        attach('p1');
        spools = [{ id: 7, remaining_weight: 30, filament: { id: 1, material: 'PETG', color_hex: '111111' } }];
        spoolmanMaps.set('p1', new Map([[0, 7]]));
        await svc.add('f1', [], false, {}, { printerId: 'p1', targetTags: [] }, false);
        await expect(svc.dispatch('p1')).rejects.toBeInstanceOf(NotFoundException);
        await expect(svc.dispatch('p1')).rejects.toBeInstanceOf(NotFoundException);
        expect(printStoredFile).not.toHaveBeenCalled();
        expect(emitCustom).toHaveBeenCalledTimes(1);
        expect(emitCustom).toHaveBeenCalledWith('p1', 'Kobra p1', 'queue_filament', { filename: 'f1.gcode' });
        spools = [{ id: 7, remaining_weight: 500, filament: { id: 1, material: 'PETG', color_hex: '111111' } }];
        expect((await svc.dispatch('p1')).fileId).toBe('f1');
    });

    it('keeps a printer in maintenance out until it comes back', async () => {
        attach('p1', { queueAutoStart: true });
        expect((await svc.setMaintenance('p1', true)).maintenance).toBe(true);
        await svc.add('f1', [], false, {}, { printerId: 'p1', targetTags: [] }, false);
        expect(printStoredFile).not.toHaveBeenCalled();
        await svc.setMaintenance('p1', false);
        await new Promise((r) => setTimeout(r, 20));
        expect(printStoredFile).toHaveBeenCalledTimes(1);
        await expect(svc.setMaintenance('ghost', true)).rejects.toBeInstanceOf(NotFoundException);
    });
});

describe('bed clear', () => {
    it('holds a finished printer until the bed is cleared, then starts the next print', async () => {
        const p1 = attach('p1', { queueAutoStart: true });
        await svc.add('f1', [], false, {}, { printerId: 'p1', targetTags: [] }, false);
        await p1.state('printing');
        await p1.state('finished');
        await p1.state('free');
        expect((await svc.status('p1')).awaitingBedClear).toBe(true);
        expect(emitCustom).toHaveBeenCalledWith('p1', 'Kobra p1', 'queue_next', {
            filename: 'f1.gcode',
            bedClear: true,
        });
        expect(printStoredFile).not.toHaveBeenCalled();
        const started = await svc.confirmBedClear('p1');
        expect(started?.fileId).toBe('f1');
        expect((await svc.status('p1')).awaitingBedClear).toBe(false);
    });

    it('marks a rejected print as failed and puts it back first', async () => {
        attach('p1');
        await seedJob(db.client, 'p1', { fileId: 'f3', filename: 'f3.gcode', startedAt: new Date() });
        await svc.add('f1', [], false, {}, { printerId: 'p1', targetTags: [] }, false);
        expect(await svc.confirmBedClear('p1', 'bad')).toBeNull();
        const job = await db.client.printJob.findFirstOrThrow({ where: { printerId: 'p1', filename: 'f3.gcode' } });
        expect(job).toMatchObject({ status: 'error', failureReason: 'quality' });
        expect((await svc.list()).map((i) => [i.fileId, i.printerId])).toEqual([
            ['f3', 'p1'],
            ['f1', 'p1'],
        ]);
    });

    it('drops the hold when a print starts by other means', async () => {
        const p1 = attach('p1');
        await db.client.printer.update({ where: { id: 'p1' }, data: { awaitingBedClear: true } });
        await p1.state('printing');
        expect((await svc.status('p1')).awaitingBedClear).toBe(false);
    });

    it('confirms the bed from three light toggles when the printer allows it', async () => {
        const off = attach('p1');
        await db.client.printer.update({ where: { id: 'p1' }, data: { awaitingBedClear: true } });
        off.emitter.emit('light_trigger');
        await new Promise((r) => setTimeout(r, 10));
        expect((await svc.status('p1')).awaitingBedClear).toBe(true);
        svc.detach('p1');
        const on = attach('p1', { lightTrigger: true });
        on.emitter.emit('light_trigger');
        await new Promise((r) => setTimeout(r, 10));
        expect((await svc.status('p1')).awaitingBedClear).toBe(false);
    });
});

describe('filamentFit', () => {
    const external = (left: number | null, material = 'PETG', colorHex = '#111111') =>
        new Map<string, SlotFilament>([['0', { material, colorHex, remainingG: left }]]);
    const need = (usedG: number | null) => [{ ...black, usedG }];

    it('fits a print in the external spool and spends from it', () => {
        const res = filamentFit(need(50), undefined, external(200), new Map());
        expect(res.fit).toBe('ok');
        expect(res.spend.get('0')).toBe(50);
    });

    it('is short when the spool runs out, counting what the queue already spent', () => {
        expect(filamentFit(need(50), undefined, external(30), new Map()).fit).toBe('short');
        expect(filamentFit(need(50), undefined, external(200), new Map([['0', 40]])).fit).toBe('short');
    });

    it('does not match another material or a far colour', () => {
        expect(filamentFit(need(10), undefined, external(200, 'PLA'), new Map()).fit).toBe('mismatch');
        expect(filamentFit(need(10), undefined, external(200, 'PETG', '#FFFFFF'), new Map()).fit).toBe('mismatch');
    });

    it('trusts unknown spools and unknown amounts', () => {
        expect(filamentFit(need(10), undefined, external(null, '', ''), new Map()).fit).toBe('ok');
        expect(filamentFit(need(null), undefined, external(1), new Map()).fit).toBe('ok');
    });

    it('follows the slots chosen in the print dialog', () => {
        const slots = new Map<string, SlotFilament>([
            ['0', { material: 'PLA', colorHex: '#FFFFFF', remainingG: 500 }],
            ['2', { material: 'PETG', colorHex: '#101010', remainingG: 20 }],
        ]);
        const assignments = [{ paintIndex: 0, slotIndex: 2, isUsed: true }];
        expect(filamentFit(need(50), assignments, slots, new Map()).fit).toBe('short');
        expect(filamentFit(need(10), [{ paintIndex: 0, slotIndex: 0, isUsed: true }], slots, new Map()).fit).toBe(
            'mismatch',
        );
    });
});
