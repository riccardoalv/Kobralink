import { type AppSettings, appSettingsSchema, printerSettingsSchema } from '@kobralink/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrinterSettingsForm } from '@/components/printer/settings-form';
import type { PrinterWithLive } from '@/lib/api';
import { renderWithProviders } from '@/test/render';
import { DetectionCard } from './detection-card';
import { DryPresetsCard } from './dry-presets-card';
import { GeneralCard } from './general-card';
import { HaMqttCard } from './ha-mqtt-card';
import { NotificationsCard } from './notifications-card';
import { SpoolmanCard } from './spoolman-card';

const mocks = vi.hoisted(() => ({
    save: vi.fn(),
    settingsUpdate: vi.fn(),
    printerUpdate: vi.fn(),
}));

vi.mock('@/hooks/use-save-settings', () => ({
    useSaveSettings: () => ({ mutateAsync: mocks.save, isPending: false }),
}));

vi.mock('@/lib/api', () => {
    const group = (fns: Record<string, unknown> = {}) =>
        new Proxy(fns, {
            get: (target, key: string) => {
                if (!(key in target)) target[key] = vi.fn().mockResolvedValue([]);
                return target[key];
            },
        });
    const known: Record<string, unknown> = {
        settings: { update: mocks.settingsUpdate },
        printers: {
            update: mocks.printerUpdate,
            connect: vi.fn(),
            disconnect: vi.fn(),
            reconnect: vi.fn(),
            refreshCredentials: vi.fn(),
            remove: vi.fn(),
        },
        spoolman: { health: vi.fn().mockResolvedValue({ reachable: true, configured: true }) },
        detection: {
            status: vi.fn().mockResolvedValue({
                model: { state: 'ready', progress: 1, downloadedBytes: 0, sizeBytes: 0, error: '' },
                runtimeAvailable: true,
                runtimeError: '',
                printers: {},
            }),
            download: vi.fn(),
            cancelDownload: vi.fn(),
            deleteModel: vi.fn(),
        },
        events: { test: vi.fn() },
    };
    return {
        api: new Proxy(known, {
            get: (target, key: string) => {
                if (!(key in target)) target[key] = {};
                return group(target[key] as Record<string, unknown>);
            },
        }),
    };
});

vi.mock('@/lib/queries', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/queries')>();
    return {
        ...actual,
        filamentVendorsQuery: { queryKey: ['vendors'], queryFn: async () => [] },
        detectionStatusQuery: {
            queryKey: ['detection'],
            queryFn: async () => ({
                model: { state: 'ready', progress: 1, downloadedBytes: 0, sizeBytes: 0, error: '' },
                runtimeAvailable: true,
                runtimeError: '',
                printers: {},
            }),
        },
    };
});

const stored: AppSettings = appSettingsSchema.parse({
    locale: 'en',
    currency: 'BRL',
    filamentPricePerKg: 89.41,
    updateCheck: false,
    verboseHttpLog: true,
    spoolmanUrl: 'http://spoolman.test:7912',
    spoolmanSyncRateSec: 30,
    notifications: {
        browser: false,
        discordUrl: 'https://discord.test/api/webhooks/1/abc',
        ntfyUrl: 'https://ntfy.test/printer',
        webhookUrl: 'https://hooks.test/print',
        telegramToken: '123:abc',
        telegramChatId: '42',
        events: { printStarted: false, printFinished: true, alerts: false },
    },
    haMqtt: {
        enabled: true,
        url: 'mqtt://broker.test:1883',
        username: 'ha',
        password: 'secret',
        topicPrefix: 'printers',
        discoveryPrefix: 'ha',
    },
    failureDetection: { enabled: true, action: 'pause', sensitivity: 1.4, intervalSec: 15 },
    aceDryPresets: [{ name: 'PETG', targetTemp: 55, duration: 300 }],
});

async function saveUnchanged(ui: ReactNode, submit: ReturnType<typeof vi.fn>) {
    await renderWithProviders(ui);
    await userEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    return submit.mock.calls[0][0] as Record<string, unknown>;
}

function expectSection(payload: Record<string, unknown>, keys: (keyof AppSettings)[]) {
    expect(Object.keys(payload).sort()).toEqual([...keys].sort());
    for (const key of keys) expect({ [key]: payload[key] }).toEqual({ [key]: stored[key] });
}

beforeEach(() => {
    mocks.save.mockReset().mockResolvedValue(stored);
    mocks.settingsUpdate.mockReset().mockResolvedValue(stored);
    mocks.printerUpdate.mockReset().mockResolvedValue({});
});

describe('saving a settings card without edits keeps every stored value', () => {
    it('general', async () => {
        const payload = await saveUnchanged(<GeneralCard settings={stored} />, mocks.save);
        expectSection(payload, ['locale', 'updateCheck', 'verboseHttpLog', 'currency', 'filamentPricePerKg']);
    });

    it('notifications', async () => {
        const payload = await saveUnchanged(<NotificationsCard settings={stored} />, mocks.save);
        expectSection(payload, ['notifications']);
    });

    it('Home Assistant', async () => {
        const payload = await saveUnchanged(<HaMqttCard settings={stored} />, mocks.save);
        expectSection(payload, ['haMqtt']);
    });

    it('failure detection', async () => {
        const payload = await saveUnchanged(<DetectionCard settings={stored} />, mocks.save);
        expectSection(payload, ['failureDetection']);
    });

    it('ACE drying presets', async () => {
        const payload = await saveUnchanged(<DryPresetsCard settings={stored} />, mocks.save);
        expectSection(payload, ['aceDryPresets']);
    });

    it('Spoolman', async () => {
        const payload = await saveUnchanged(<SpoolmanCard settings={stored} />, mocks.settingsUpdate);
        expectSection(payload, ['spoolmanUrl', 'spoolmanSyncRateSec']);
    });

    it('printer settings', async () => {
        const settings = printerSettingsSchema.parse({
            timelapseEnabled: true,
            timelapseFps: 60,
            vibrationCompensation: true,
            cameraOnPrint: true,
            cameraUrl: 'rtsp://camera.test/stream1',
            alerts: { spoolLowG: 100, offlineMinutes: 5 },
        });
        const printer = {
            id: 'p1',
            name: 'Kobra 4',
            ip: '192.168.1.235',
            httpPort: 7125,
            deviceId: 'abcdef123456',
            modeId: '20028',
            username: 'user',
            createdAt: '2026-10-20T00:00:00.000Z',
            model: 'Anycubic Kobra 4',
            settings,
            live: null,
        } as unknown as PrinterWithLive;
        await renderWithProviders(<PrinterSettingsForm printer={printer} onSaved={vi.fn()} onDeleted={vi.fn()} />);
        await userEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
        await waitFor(() => expect(mocks.printerUpdate).toHaveBeenCalledOnce());
        const [id, body] = mocks.printerUpdate.mock.calls[0];
        expect(id).toBe('p1');
        expect(body.settings).toEqual(settings);
    });
});
