import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { type AppSettings, appSettingsSchema } from '@farolprint/shared';
import type { SettingsService } from '../src/settings/settings.service';
import { StatsService } from '../src/stats/stats.service';
import { seedFile, seedJob, seedPrinter, type TestDb, testDb } from './helpers/db';

let db: TestDb;
let current: AppSettings;
const settings = { get: () => current } as unknown as SettingsService;
const priced = appSettingsSchema.parse({
    currency: 'EUR',
    costs: { energyPricePerKwh: 0.5, printerPowerW: 200, hourlyRate: 1 },
});
const unpriced = appSettingsSchema.parse({ currency: 'EUR' });
const day = 86_400_000;
const at = (daysAgo: number, hour = 0) => new Date(Date.now() - daysAgo * day + hour * 3_600_000);

beforeAll(async () => {
    db = await testDb();
    await seedPrinter(db.client, 'p1', 'Kobra');
    await seedPrinter(db.client, 'p2', 'Other');
    await seedFile(db.client, 'f1', 'bracket.gcode');
    await seedJob(db.client, 'p1', { fileId: 'f1', filename: 'bracket.gcode', durationSec: 3600, startedAt: at(3) });
    await seedJob(db.client, 'p1', {
        filename: 'lid.gcode',
        status: 'cancelled',
        durationSec: 1800,
        failureReason: 'spaghetti',
        startedAt: at(2),
    });
    await seedJob(db.client, 'p1', {
        filename: 'cube.gcode',
        status: 'error',
        durationSec: 0,
        errorCode: 20001,
        startedAt: at(1),
    });
    await seedJob(db.client, 'p1', {
        filename: 'vase.gcode',
        status: 'cancelled',
        durationSec: 0,
        startedAt: at(0, 1),
    });
    await seedJob(db.client, 'p1', { filename: 'live.gcode', status: 'printing', durationSec: 0, startedAt: at(0, 2) });
    await seedJob(db.client, 'p1', { filename: 'old.gcode', durationSec: 60, startedAt: at(40) });
});

afterAll(() => db.close());

describe('StatsService.compute', () => {
    it('counts failures by reason with fallbacks for errors and unlabeled cancels', async () => {
        current = priced;
        const stats = await new StatsService(db.prisma, settings).compute('p1', 30);
        expect(stats).toMatchObject({ totalJobs: 4, completed: 1, cancelled: 2, errored: 1, inProgress: 1 });
        expect(stats.failures).toEqual([
            { reason: 'spaghetti', count: 1 },
            { reason: 'error', count: 1 },
            { reason: 'unlabeled', count: 1 },
        ]);
    });

    it('breaks the cost down into energy and machine time', async () => {
        current = priced;
        const stats = await new StatsService(db.prisma, settings).compute('p1', 30);
        expect(stats.filamentCost).toBe(0);
        expect(stats.energyCost).toBe(0.15);
        expect(stats.machineCost).toBe(1.5);
        expect(stats.totalCost).toBe(1.65);
        expect(stats.currency).toBe('EUR');
        expect(stats.printers).toEqual([expect.objectContaining({ printerId: 'p1', name: 'Kobra', cost: 1.65 })]);
    });

    it('reports zero cost without any pricing', async () => {
        current = unpriced;
        const stats = await new StatsService(db.prisma, settings).compute('p1', 30);
        expect(stats.totalCost).toBe(0);
        expect(stats.energyCost).toBe(0);
        expect(stats.machineCost).toBe(0);
    });

    it('filters by printer and by period', async () => {
        current = priced;
        const svc = new StatsService(db.prisma, settings);
        expect((await svc.compute('p2', 0)).totalJobs).toBe(0);
        expect((await svc.compute('p1', 0)).totalJobs).toBe(5);
        expect((await svc.compute('p1', 2)).totalJobs).toBe(2);
        expect((await svc.compute(undefined, 0)).totalJobs).toBe(5);
    });
});

describe('StatsService.history', () => {
    it('prices finished jobs and leaves the running one unpriced', async () => {
        current = priced;
        const rows = await new StatsService(db.prisma, settings).history('p1', 50, 0);
        expect(rows.map((r) => r.filename)).toEqual([
            'live.gcode',
            'vase.gcode',
            'cube.gcode',
            'lid.gcode',
            'bracket.gcode',
            'old.gcode',
        ]);
        expect(rows[0].cost).toBeNull();
        expect(rows[4].cost).toEqual({ filament: 0, energy: 0.1, machine: 1, total: 1.1 });
        expect(rows[4].thumbnail).toBeNull();
    });

    it('paginates and omits the cost without pricing', async () => {
        current = unpriced;
        const svc = new StatsService(db.prisma, settings);
        const page = await svc.history('p1', 2, 1);
        expect(page.map((r) => r.filename)).toEqual(['vase.gcode', 'cube.gcode']);
        expect(page.every((r) => r.cost === null)).toBe(true);
    });
});

describe('StatsService.exportCsv', () => {
    it('writes one row per job with the printer name, the failure reason and the costs', async () => {
        current = priced;
        const csv = await new StatsService(db.prisma, settings).exportCsv('p1', 30);
        const lines = csv.trimEnd().split('\r\n');
        expect(lines).toHaveLength(6);
        expect(lines[0]).toContain('printer');
        expect(lines.some((l) => l.includes('Kobra') && l.includes('spaghetti'))).toBe(true);
        expect(lines.some((l) => l.includes('bracket.gcode') && l.includes('1.1'))).toBe(true);
    });

    it('covers every printer when none is given', async () => {
        current = priced;
        const csv = await new StatsService(db.prisma, settings).exportCsv(undefined, 0);
        expect(csv.trimEnd().split('\r\n')).toHaveLength(7);
    });
});

describe('StatsService.compute wasted filament', () => {
    let waste: TestDb;
    const pricedFilament = appSettingsSchema.parse({ currency: 'EUR', filamentPricePerKg: 20 });

    beforeAll(async () => {
        waste = await testDb();
        await seedPrinter(waste.client, 'w1', 'Waste');
        const paused = new Date(Date.now() - 3_600_000);
        await seedJob(waste.client, 'w1', { filename: 'ok.gcode', filamentMm: 5000, startedAt: at(1) });
        await seedJob(waste.client, 'w1', { filename: 'cancel.gcode', status: 'cancelled', filamentMm: 2000 });
        await seedJob(waste.client, 'w1', { filename: 'lost.gcode', status: 'error', filamentMm: 500 });
        await seedJob(waste.client, 'w1', {
            filename: 'runout.gcode',
            status: 'cancelled',
            filamentMm: 3000,
            pausedAt: paused,
        });
        await seedJob(waste.client, 'w1', {
            filename: 'abandoned.gcode',
            status: 'error',
            filamentMm: 0,
            pausedAt: paused,
        });
        await seedJob(waste.client, 'w1', {
            filename: 'resumed.gcode',
            filamentMm: 4000,
            pausedAt: paused,
        });
        await seedJob(waste.client, 'w1', {
            filename: 'live.gcode',
            status: 'printing',
            filamentMm: 100,
            pausedAt: paused,
        });
    });

    afterAll(() => waste.close());

    it('splits the filament of unfinished prints between paused and cancelled ones', async () => {
        current = pricedFilament;
        const stats = await new StatsService(waste.prisma, settings).compute('w1', 30);
        expect(stats.waste.paused).toMatchObject({ jobs: 2, filamentMm: 3000 });
        expect(stats.waste.cancelled).toMatchObject({ jobs: 2, filamentMm: 2500 });
    });

    it('weighs and prices the waste like the rest of the filament', async () => {
        current = pricedFilament;
        const stats = await new StatsService(waste.prisma, settings).compute('w1', 30);
        const perMm = stats.totalFilamentG / stats.totalFilamentMm;
        expect(stats.waste.paused.weightG).toBeCloseTo(3000 * perMm, 0);
        expect(stats.waste.cancelled.weightG).toBeCloseTo(2500 * perMm, 0);
        expect(stats.waste.paused.filamentCost).toBeCloseTo((stats.waste.paused.weightG * 20) / 1000, 1);
        expect(stats.waste.cancelled.filamentCost).toBeGreaterThan(0);
    });

    it('reports no waste without unfinished prints', async () => {
        current = unpriced;
        const stats = await new StatsService(db.prisma, settings).compute('p2', 30);
        expect(stats.waste).toEqual({
            paused: { jobs: 0, filamentMm: 0, weightG: 0, filamentCost: 0 },
            cancelled: { jobs: 0, filamentMm: 0, weightG: 0, filamentCost: 0 },
        });
    });

    it('leaves the waste unpriced without a filament price', async () => {
        current = unpriced;
        const stats = await new StatsService(waste.prisma, settings).compute('w1', 30);
        expect(stats.waste.paused.filamentCost).toBe(0);
        expect(stats.waste.paused.weightG).toBeGreaterThan(0);
    });
});

describe('StatsService.compute with printer profiles', () => {
    let profiled: TestDb;

    beforeAll(async () => {
        profiled = await testDb();
        await seedPrinter(profiled.client, 'pp', 'Profiled');
        await profiled.client.printer.update({
            where: { id: 'pp' },
            data: {
                settings: JSON.stringify({ profile: { powerW: 400, purchasePrice: 2000, lifespanHours: 4000 } }),
            },
        });
        await seedJob(profiled.client, 'pp', { durationSec: 7200 });
    });

    afterAll(() => profiled.close());

    it('prices energy and machine time with the printer power draw and depreciation', async () => {
        current = appSettingsSchema.parse({
            currency: 'EUR',
            costs: { energyPricePerKwh: 0.5, printerPowerW: 100, hourlyRate: 1 },
        });
        const stats = await new StatsService(profiled.prisma, settings).compute('pp', 30);
        expect(stats.energyCost).toBe(0.4);
        expect(stats.machineCost).toBe(3);
    });

    it('prices a printer with only a depreciation even without other costs', async () => {
        current = unpriced;
        const stats = await new StatsService(profiled.prisma, settings).compute('pp', 30);
        expect(stats.machineCost).toBe(1);
        expect(stats.totalCost).toBe(1);
    });
});
