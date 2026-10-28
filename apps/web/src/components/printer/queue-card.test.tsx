import type { PrinterLiveState, QueueItemDto } from '@farolprint/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { m } from '@/lib/i18n';
import { renderWithProviders } from '@/test/render';
import { QueueCard } from './queue-card';

const { item, queue, schedule, printer } = vi.hoisted(() => {
    const item: QueueItemDto = {
        id: 'q1',
        printerId: 'p1',
        fileId: 'f1',
        filename: 'bracket.gcode',
        thumbnail: null,
        estPrintTimeSec: 600,
        position: 1,
        excludedObjects: [],
        options: {},
        createdAt: '2026-10-01T00:00:00.000Z',
    };
    return {
        item,
        queue: {
            list: vi.fn(),
            status: vi.fn(),
            bedClear: vi.fn(),
            start: vi.fn(),
            remove: vi.fn(),
            clear: vi.fn(),
            reorder: vi.fn(),
        },
        schedule: { list: vi.fn(), remove: vi.fn() },
        printer: { settings: { queueAutoStart: true, queueBedClearConfirm: true } },
    };
});

vi.mock('@/lib/api', () => ({
    api: new Proxy({ queue, schedule } as Record<string, unknown>, {
        get: (target, key: string) => target[key] ?? new Proxy({}, { get: () => vi.fn().mockResolvedValue([]) }),
    }),
}));

vi.mock('@/hooks/use-printers', () => ({
    useLiveState: () => ({ connected: true, printState: 'standby', kobraState: 'free' }) as PrinterLiveState,
    usePrinter: () => printer,
}));

const scheduled = {
    id: 's1',
    printerId: 'p1',
    fileId: 'f2',
    filename: 'lid.gcode',
    thumbnail: null,
    estPrintTimeSec: 300,
    startAt: '2026-10-29T08:00:00.000Z',
    excludedObjects: [],
    createdAt: '2026-10-28T00:00:00.000Z',
};

beforeEach(() => {
    queue.list.mockReset().mockResolvedValue([item]);
    queue.status.mockReset().mockResolvedValue({ awaitingBedClear: true, nextFilename: 'bracket.gcode' });
    queue.bedClear.mockReset().mockResolvedValue({ filename: 'bracket.gcode' });
    queue.start.mockReset().mockResolvedValue({ filename: 'bracket.gcode' });
    queue.remove.mockReset().mockResolvedValue(undefined);
    schedule.list.mockReset().mockResolvedValue([scheduled]);
    schedule.remove.mockReset().mockResolvedValue(undefined);
    printer.settings = { queueAutoStart: true, queueBedClearConfirm: true };
});

describe('QueueCard', () => {
    it('asks to confirm the bed is clear and starts the next file', async () => {
        await renderWithProviders(<QueueCard printerId="p1" />);
        expect(await screen.findByText('Bed clear?')).toBeTruthy();
        expect(screen.getByText('Auto-start after confirming the bed is clear.')).toBeTruthy();
        expect(screen.getByText(/lid\.gcode/)).toBeTruthy();
        await userEvent.click(screen.getByRole('button', { name: /Bed is clear, start/ }));
        expect(queue.bedClear).toHaveBeenCalledWith('p1');
    });

    it('shows no banner when nothing is on hold', async () => {
        queue.status.mockResolvedValue({ awaitingBedClear: false, nextFilename: 'bracket.gcode' });
        await renderWithProviders(<QueueCard printerId="p1" />);
        expect(await screen.findByText('bracket.gcode')).toBeTruthy();
        expect(screen.queryByText('Bed clear?')).toBeNull();
    });

    it('explains the auto-start mode from the printer settings', async () => {
        printer.settings = { queueAutoStart: true, queueBedClearConfirm: false };
        await renderWithProviders(<QueueCard printerId="p1" />);
        expect(await screen.findByText(m.queue_auto_on())).toBeTruthy();
    });

    it('says when auto-start is off', async () => {
        printer.settings = { queueAutoStart: false, queueBedClearConfirm: true };
        await renderWithProviders(<QueueCard printerId="p1" />);
        expect(await screen.findByText(m.queue_auto_off())).toBeTruthy();
    });

    it('removes a scheduled print', async () => {
        await renderWithProviders(<QueueCard printerId="p1" />);
        await screen.findByText(/lid\.gcode/);
        await userEvent.click(screen.getAllByRole('button', { name: m.common_delete() })[0]);
        expect(schedule.remove).toHaveBeenCalledWith('p1', 's1');
    });

    it('shows the empty state without items or schedules', async () => {
        queue.list.mockResolvedValue([]);
        schedule.list.mockResolvedValue([]);
        await renderWithProviders(<QueueCard printerId="p1" />);
        expect(await screen.findByText(m.queue_empty())).toBeTruthy();
        expect(screen.queryByText('Bed clear?')).toBeNull();
    });

    it('starts the next file by hand', async () => {
        queue.status.mockResolvedValue({ awaitingBedClear: false, nextFilename: 'bracket.gcode' });
        await renderWithProviders(<QueueCard printerId="p1" />);
        await screen.findByText('bracket.gcode');
        await userEvent.click(screen.getByRole('button', { name: new RegExp(m.queue_start_next()) }));
        expect(queue.start).toHaveBeenCalledWith('p1');
    });
});
