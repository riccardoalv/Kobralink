import { afterEach, describe, expect, it, setSystemTime } from 'bun:test';
import { type BridgePrinterConfig, PrinterBridge } from '../src/bridge/printer-bridge';
import type { GcodeService } from '../src/gcode/gcode.service';

function bridge() {
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
    const b = new PrinterBridge(config, {} as GcodeService, { cert: Buffer.alloc(0), key: Buffer.alloc(0) });
    let triggers = 0;
    b.on('light_trigger', () => {
        triggers += 1;
    });
    const internals = b as unknown as { onReport: (suffix: string, payload: Record<string, unknown>) => void };
    const tap = (status: number) => internals.onReport('light/report', { action: 'control', data: { status } });
    return { b, tap, triggers: () => triggers };
}

const t0 = new Date('2026-10-30T12:00:00.000Z').getTime();
const at = (sec: number) => setSystemTime(new Date(t0 + sec * 1000));

afterEach(() => setSystemTime());

describe('light trigger', () => {
    it('fires on three light switches from the printer screen within 20 s', () => {
        const h = bridge();
        at(0);
        h.tap(1);
        at(3);
        h.tap(0);
        expect(h.triggers()).toBe(0);
        at(6);
        h.tap(1);
        expect(h.triggers()).toBe(1);
        expect(h.b.snapshot().lightOn).toBe(true);
    });

    it('counts a switch even when the printer merges taps into the same state', () => {
        const h = bridge();
        at(0);
        h.tap(1);
        at(2);
        h.tap(1);
        at(4);
        h.tap(1);
        expect(h.triggers()).toBe(1);
    });

    it('forgets switches older than 20 s and starts over after firing', () => {
        const h = bridge();
        at(0);
        h.tap(1);
        at(15);
        h.tap(0);
        at(25);
        h.tap(1);
        expect(h.triggers()).toBe(0);
        at(30);
        h.tap(0);
        expect(h.triggers()).toBe(1);
        at(31);
        h.tap(1);
        at(32);
        h.tap(0);
        expect(h.triggers()).toBe(1);
    });

    it('ignores the replies to the light commands FarolPrint sends', () => {
        const h = bridge();
        (h.b as unknown as { client: { connected: boolean; setLight: () => void } }).client = {
            connected: true,
            setLight: () => undefined,
        };
        at(0);
        h.b.setLight(true);
        h.tap(1);
        at(2);
        h.b.setLight(false);
        h.tap(0);
        at(4);
        h.b.setLight(true);
        h.tap(1);
        expect(h.triggers()).toBe(0);
    });
});
