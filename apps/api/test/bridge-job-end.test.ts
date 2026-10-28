import { describe, expect, it, mock } from 'bun:test';
import { type BridgePrinterConfig, PrinterBridge } from '../src/bridge/printer-bridge';
import type { GcodeService } from '../src/gcode/gcode.service';

type Failure = { errorCode?: number; errorMsg?: string; snapshot?: Buffer | null };
type FinishArgs = [string, string, number, unknown[], number, Failure];

function harness() {
    const finishJob = mock(async (..._args: FinishArgs) => undefined);
    const gcode = {
        getByFilename: async () => null,
        findOpenJob: async () => null,
        startJob: async () => 'job-1',
        closeOpenJobs: async () => 0,
        finishJob,
    } as unknown as GcodeService;
    const config = {
        id: 'printer-1',
        name: 'Kobra 4',
        ip: '127.0.0.1',
        mqttPort: 9883,
        username: 'u',
        password: 'p',
        deviceId: 'd',
        modeId: '20028',
        httpPort: 7125,
        settings: {},
    } as unknown as BridgePrinterConfig;
    const bridge = new PrinterBridge(config, gcode, { cert: Buffer.alloc(0), key: Buffer.alloc(0) });
    const internals = bridge as unknown as {
        s: { connected: boolean };
        onReport: (suffix: string, payload: Record<string, unknown>) => void;
    };
    internals.s.connected = true;
    const jobs: unknown[][] = [];
    bridge.on('job', (...args: unknown[]) => jobs.push(args));
    const report = async (payload: Record<string, unknown>) => {
        internals.onReport('print/report', payload);
        await new Promise((r) => setTimeout(r, 0));
    };
    const start = () => report({ state: 'printing', data: { filename: 'part.gcode', print_time: 10 } });
    const last = () => finishJob.mock.calls[finishJob.mock.calls.length - 1] as unknown as FinishArgs;
    return { bridge, report, start, finishJob, jobs, last };
}

const frame = Buffer.from('jpeg');

describe('job end', () => {
    it('closes a finished print as completed without any failure data', async () => {
        const h = harness();
        await h.start();
        h.bridge.camera.latestJpeg = frame;
        h.bridge.camera.latestJpegAt = Date.now();
        await h.report({ state: 'finished', data: { filename: 'part.gcode' } });
        const [jobId, status, , , durationSec, failure] = h.last();
        expect([jobId, status, durationSec]).toEqual(['job-1', 'completed', 600]);
        expect(failure).toEqual({ errorCode: 0, errorMsg: '', snapshot: null });
        expect(h.jobs).toEqual([
            ['start', 'job-1', 'part.gcode', null],
            ['end', 'job-1', 'part.gcode', 'completed'],
        ]);
        expect(h.bridge.snapshot().errorCode).toBe(0);
    });

    it('keeps the pause error and a fresh camera frame when the print is cancelled', async () => {
        const h = harness();
        await h.start();
        await h.report({ state: 'pause', code: 20001, msg: 'Filament runout', data: { filename: 'part.gcode' } });
        expect(h.bridge.snapshot()).toMatchObject({ errorCode: 20001, pauseMsg: 'Filament runout' });
        h.bridge.camera.latestJpeg = frame;
        h.bridge.camera.latestJpegAt = Date.now() - 30_000;
        await h.report({ state: 'stoped', data: { filename: 'part.gcode' } });
        const [, status, , , , failure] = h.last();
        expect(status).toBe('cancelled');
        expect(failure).toEqual({ errorCode: 20001, errorMsg: 'Filament runout', snapshot: frame });
        expect(h.jobs[1]).toEqual(['end', 'job-1', 'part.gcode', 'cancelled']);
        expect(h.bridge.snapshot()).toMatchObject({ errorCode: 0, pauseMsg: '' });
    });

    it('ignores a camera frame older than two minutes', async () => {
        const h = harness();
        await h.start();
        h.bridge.camera.latestJpeg = frame;
        h.bridge.camera.latestJpegAt = Date.now() - 130_000;
        await h.report({ state: 'canceled', data: { filename: 'part.gcode' } });
        const [, status, , , , failure] = h.last();
        expect(status).toBe('cancelled');
        expect(failure.snapshot).toBeNull();
    });

    it('forgets the pause error once the print resumes', async () => {
        const h = harness();
        await h.start();
        await h.report({ state: 'pause', code: 7, msg: 'Door open', data: { filename: 'part.gcode' } });
        await h.report({ state: 'resuming', data: { filename: 'part.gcode' } });
        await h.report({ state: 'stoped', data: { filename: 'part.gcode' } });
        const [, , , , , failure] = h.last();
        expect(failure).toEqual({ errorCode: 0, errorMsg: '', snapshot: null });
    });

    it('does nothing when no job is open', async () => {
        const h = harness();
        await h.report({ state: 'stoped', data: { filename: 'part.gcode' } });
        expect(h.finishJob).not.toHaveBeenCalled();
        expect(h.jobs).toEqual([]);
    });
});
