import type { PrinterLiveState, QueueItemDto } from '@kobralink/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { QueueCard } from './queue-card';

const { item, bedClear } = vi.hoisted(() => {
    const item: QueueItemDto = {
        id: 'q1',
        printerId: 'p1',
        fileId: 'f1',
        filename: 'bracket.gcode',
        thumbnail: null,
        estPrintTimeSec: 600,
        position: 1,
        excludedObjects: [],
        createdAt: '2026-10-01T00:00:00.000Z',
    };
    return { item, bedClear: vi.fn().mockResolvedValue({ filename: 'bracket.gcode' }) };
});

vi.mock('@/lib/api', () => ({
    api: new Proxy(
        {
            queue: {
                list: vi.fn().mockResolvedValue([item]),
                status: vi.fn().mockResolvedValue({ awaitingBedClear: true, nextFilename: 'bracket.gcode' }),
                bedClear,
                start: vi.fn(),
                remove: vi.fn(),
                clear: vi.fn(),
                reorder: vi.fn(),
            },
            schedule: {
                list: vi.fn().mockResolvedValue([
                    {
                        id: 's1',
                        printerId: 'p1',
                        fileId: 'f2',
                        filename: 'lid.gcode',
                        thumbnail: null,
                        estPrintTimeSec: 300,
                        startAt: '2026-10-29T08:00:00.000Z',
                        excludedObjects: [],
                        createdAt: '2026-10-28T00:00:00.000Z',
                    },
                ]),
                remove: vi.fn(),
            },
        } as Record<string, unknown>,
        { get: (target, key: string) => target[key] ?? new Proxy({}, { get: () => vi.fn().mockResolvedValue([]) }) },
    ),
}));

vi.mock('@/hooks/use-printers', () => ({
    useLiveState: () => ({ connected: true, printState: 'standby', kobraState: 'free' }) as PrinterLiveState,
    usePrinter: () => ({ settings: { queueAutoStart: true, queueBedClearConfirm: true } }),
}));

describe('QueueCard', () => {
    it('asks to confirm the bed is clear and starts the next file', async () => {
        await renderWithProviders(<QueueCard printerId="p1" />);
        expect(await screen.findByText('Bed clear?')).toBeTruthy();
        expect(screen.getByText('Auto-start after confirming the bed is clear.')).toBeTruthy();
        expect(screen.getByText(/lid\.gcode/)).toBeTruthy();
        await userEvent.click(screen.getByRole('button', { name: /Bed is clear, start/ }));
        expect(bedClear).toHaveBeenCalledWith('p1');
    });
});
