import { describe, expect, it, mock } from 'bun:test';
import { schedulePrintSchema, updatePrintJobSchema } from '@kobralink/shared';
import { BadGatewayException, BadRequestException, NotFoundException } from '@nestjs/common';
import type { BridgeRegistry } from '../src/bridge/bridge.registry';
import { ZodPipe } from '../src/common/zod.pipe';
import { CoreController } from '../src/core/core.controller';
import type { GcodeService } from '../src/gcode/gcode.service';
import { MaintenanceController } from '../src/maintenance/maintenance.controller';
import type { MaintenanceService } from '../src/maintenance/maintenance.service';
import { QueueController } from '../src/queue/queue.controller';
import type { QueueService } from '../src/queue/queue.service';
import { ScheduledPrintController } from '../src/schedule/scheduled-print.controller';
import type { ScheduledPrintService } from '../src/schedule/scheduled-print.service';
import { StatsController } from '../src/stats/stats.controller';
import type { StatsService } from '../src/stats/stats.service';

describe('QueueController', () => {
    const queue = {
        status: mock(async () => ({ awaitingBedClear: true, nextFilename: 'a.gcode' })),
        confirmBedClear: mock(async () => ({ id: 'q1' })),
        startNext: mock(async () => ({ id: 'q1' })),
        add: mock(async () => ({ id: 'q2' })),
    };
    const ctrl = new QueueController(queue as unknown as QueueService);

    it('exposes the hold and confirms the bed is clear', async () => {
        expect(await ctrl.status('p1')).toEqual({ awaitingBedClear: true, nextFilename: 'a.gcode' });
        expect(await ctrl.bedClear('p1')).toEqual({ id: 'q1' });
        expect(queue.confirmBedClear).toHaveBeenCalledWith('p1');
    });

    it('turns a failed start into a 502', async () => {
        queue.confirmBedClear.mockImplementationOnce(async () => {
            throw new Error('printer busy');
        });
        await expect(ctrl.bedClear('p1')).rejects.toBeInstanceOf(BadGatewayException);
        queue.startNext.mockImplementationOnce(async () => {
            throw new Error('offline');
        });
        await expect(ctrl.start('p1')).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('defaults the excluded objects when adding', async () => {
        await ctrl.add('p1', { fileId: 'f1' });
        expect(queue.add).toHaveBeenCalledWith('p1', 'f1', []);
    });
});

describe('MaintenanceController', () => {
    const maintenance = {
        list: mock(async () => []),
        create: mock(async () => ({ id: 't1' })),
        update: mock(async () => ({ id: 't1' })),
        complete: mock(async () => ({ id: 't1' })),
        logs: mock(async () => []),
        remove: mock(async () => undefined),
    };
    const ctrl = new MaintenanceController(maintenance as unknown as MaintenanceService);

    it('delegates every route to the service', async () => {
        await ctrl.list('p1');
        await ctrl.create('p1', { name: 'Lube' });
        await ctrl.update('p1', 't1', { name: 'Lube', intervalHours: 50 });
        await ctrl.complete('p1', 't1', { note: 'done' });
        await ctrl.remove('p1', 't1');
        expect(maintenance.list).toHaveBeenCalledWith('p1');
        expect(maintenance.create).toHaveBeenCalledWith('p1', { name: 'Lube' });
        expect(maintenance.update).toHaveBeenCalledWith('p1', 't1', { name: 'Lube', intervalHours: 50 });
        expect(maintenance.complete).toHaveBeenCalledWith('p1', 't1', { note: 'done' });
        expect(maintenance.remove).toHaveBeenCalledWith('p1', 't1');
    });

    it('clamps the log limit', async () => {
        await ctrl.logs('p1', 't1');
        await ctrl.logs('p1', 't1', '500');
        await ctrl.logs('p1', 't1', 'abc');
        expect(maintenance.logs.mock.calls.map((c) => c[2])).toEqual([20, 200, 20]);
    });
});

describe('ScheduledPrintController', () => {
    const schedule = {
        list: mock(async () => []),
        create: mock(async () => ({ id: 's1' })),
        remove: mock(async () => undefined),
    };
    const ctrl = new ScheduledPrintController(schedule as unknown as ScheduledPrintService);

    it('delegates list, create and remove', async () => {
        const body = { fileId: 'f1', startAt: '2026-11-01T08:00:00.000Z' };
        await ctrl.list('p1');
        expect(await ctrl.create('p1', body)).toEqual({ id: 's1' });
        await ctrl.remove('p1', 's1');
        expect(schedule.list).toHaveBeenCalledWith('p1');
        expect(schedule.create).toHaveBeenCalledWith('p1', body);
        expect(schedule.remove).toHaveBeenCalledWith('p1', 's1');
    });
});

describe('StatsController', () => {
    const stats = { compute: mock(async () => ({})), exportCsv: mock(async () => 'csv') };
    const ctrl = new StatsController(stats as unknown as StatsService);

    it('parses the printer and period filters', async () => {
        await ctrl.get();
        await ctrl.get('', 'abc');
        await ctrl.get('p1', '7');
        await ctrl.get('p1', '-3');
        expect(stats.compute.mock.calls).toEqual([
            [undefined, 0],
            [undefined, 0],
            ['p1', 7],
            ['p1', 0],
        ]);
        expect(await ctrl.exportCsv('p1', '30')).toBe('csv');
        expect(stats.exportCsv).toHaveBeenCalledWith('p1', 30);
    });
});

describe('CoreController history routes', () => {
    const gcode = {
        updateJob: mock(async () => ({ id: 'j1' })),
        snapshotPath: mock(async () => '/data/failures/j1.jpg'),
    };
    const stats = { history: mock(async () => []) };
    const ctrl = new CoreController(
        {} as BridgeRegistry,
        gcode as unknown as GcodeService,
        stats as unknown as StatsService,
    );

    it('clamps the history pagination', async () => {
        await ctrl.history('p1');
        await ctrl.history('p1', '999', 'x');
        await ctrl.history('p1', '10', '20');
        expect(stats.history.mock.calls).toEqual([
            ['p1', 50, 0],
            ['p1', 200, 0],
            ['p1', 10, 20],
        ]);
    });

    it('labels a job and 404s when it belongs to another printer', async () => {
        expect(await ctrl.updateJob('p1', 'j1', { failureReason: 'clog' })).toEqual({ id: 'j1' });
        expect(gcode.updateJob).toHaveBeenCalledWith('p1', 'j1', { failureReason: 'clog' });
        gcode.updateJob.mockImplementationOnce(async () => null);
        await expect(ctrl.updateJob('p1', 'j2', {})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('serves the failure snapshot as a jpeg and 404s without one', async () => {
        const sendFile = mock(() => undefined);
        const res = { type: mock(() => ({ sendFile })) };
        await ctrl.jobSnapshot('p1', 'j1', res as never);
        expect(res.type).toHaveBeenCalledWith('image/jpeg');
        expect(sendFile).toHaveBeenCalledWith('/data/failures/j1.jpg');
        gcode.snapshotPath.mockImplementationOnce(async () => null);
        await expect(ctrl.jobSnapshot('p1', 'j2', res as never)).rejects.toBeInstanceOf(NotFoundException);
    });
});

describe('request validation of the new bodies', () => {
    it('accepts a known failure reason and rejects an unknown one', () => {
        const pipe = new ZodPipe(updatePrintJobSchema);
        expect(pipe.transform({ failureReason: 'spaghetti', note: '  x  ' })).toEqual({
            failureReason: 'spaghetti',
            note: 'x',
        });
        expect(pipe.transform({ failureReason: '' })).toEqual({ failureReason: '' });
        expect(() => pipe.transform({ failureReason: 'bogus' })).toThrow(BadRequestException);
        expect(() => pipe.transform({ note: 'x'.repeat(501) })).toThrow(BadRequestException);
    });

    it('requires a parseable start time for a scheduled print', () => {
        const pipe = new ZodPipe(schedulePrintSchema);
        expect(pipe.transform({ fileId: 'f1', startAt: '2026-11-01T08:00:00.000Z' })).toMatchObject({
            fileId: 'f1',
        });
        expect(() => pipe.transform({ fileId: 'f1', startAt: 'tomorrow' })).toThrow(BadRequestException);
        expect(() => pipe.transform({ startAt: '2026-11-01T08:00:00.000Z' })).toThrow(BadRequestException);
    });
});
