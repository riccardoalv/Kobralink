import { describe, expect, it, mock } from 'bun:test';
import { EventEmitter } from 'node:events';
import type { PrinterBridge } from '../src/bridge/printer-bridge';
import type { GcodeService } from '../src/gcode/gcode.service';
import type { NotificationService } from '../src/notifications/notification.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';

const row = {
    id: 'q1',
    printerId: 'p1',
    fileId: 'f1',
    position: 1,
    excludedObjects: '[]',
    createdAt: new Date(),
    file: { filename: 'bracket.gcode', thumbnail: null, estPrintTimeSec: 600 },
};

function harness(settings: { queueAutoStart: boolean; queueBedClearConfirm: boolean }) {
    const prisma = {
        client: {
            queueItem: {
                findFirst: mock(async () => row),
                findMany: mock(async () => [row]),
                delete: mock(async () => row),
                deleteMany: mock(async () => ({ count: 1 })),
            },
        },
    } as unknown as PrismaService;
    const notifications = { emitCustom: mock(() => undefined) } as unknown as NotificationService;
    const service = new QueueService(prisma, {} as GcodeService, notifications);
    const emitter = new EventEmitter();
    let snapshot = { connected: true, printState: 'standby', kobraState: 'free' };
    const printStoredFile = mock(async () => ({}));
    const bridge = Object.assign(emitter, {
        id: 'p1',
        config: { name: 'Kobra', ip: '127.0.0.1', httpPort: 7125 },
        settings,
        snapshot: () => snapshot,
        printStoredFile,
    }) as unknown as PrinterBridge;
    service.attach(bridge);
    const state = async (kobraState: string, connected = true) => {
        snapshot = { connected, printState: kobraState === 'printing' ? 'printing' : 'standby', kobraState };
        emitter.emit('state', { kobraState, connected });
        await new Promise((r) => setTimeout(r, 5));
    };
    return { service, state, printStoredFile, notifications, detach: () => service.detach('p1') };
}

describe('queue bed-clear confirmation', () => {
    it('holds the auto-start until the bed is confirmed clear', async () => {
        const h = harness({ queueAutoStart: true, queueBedClearConfirm: true });
        await h.state('printing');
        await h.state('finished');
        await h.state('free');
        expect(await h.service.status('p1')).toEqual({ awaitingBedClear: true, nextFilename: 'bracket.gcode' });
        expect(h.printStoredFile).not.toHaveBeenCalled();
        expect(h.notifications.emitCustom).toHaveBeenCalledWith('p1', 'Kobra', 'queue_next', {
            filename: 'bracket.gcode',
            bedClear: true,
        });
        const started = await h.service.confirmBedClear('p1');
        expect(started.filename).toBe('bracket.gcode');
        expect(h.printStoredFile).toHaveBeenCalledTimes(1);
        expect((await h.service.status('p1')).awaitingBedClear).toBe(false);
        h.detach();
    });

    it('only notifies when auto-start is off', async () => {
        const h = harness({ queueAutoStart: false, queueBedClearConfirm: true });
        await h.state('finished');
        await h.state('free');
        expect((await h.service.status('p1')).awaitingBedClear).toBe(false);
        expect(h.notifications.emitCustom).toHaveBeenCalledWith('p1', 'Kobra', 'queue_next', {
            filename: 'bracket.gcode',
            bedClear: false,
        });
        h.detach();
    });

    it('drops the hold when a print starts by other means', async () => {
        const h = harness({ queueAutoStart: true, queueBedClearConfirm: true });
        await h.state('finished');
        await h.state('free');
        expect((await h.service.status('p1')).awaitingBedClear).toBe(true);
        await h.state('printing');
        expect((await h.service.status('p1')).awaitingBedClear).toBe(false);
        h.detach();
    });
});
