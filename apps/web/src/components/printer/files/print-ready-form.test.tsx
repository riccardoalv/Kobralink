import type { GcodeFileDto, PrinterLiveState } from '@farolprint/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { m } from '@/lib/i18n';
import { renderWithProviders } from '@/test/render';
import { PrintReadyForm } from './print-ready-form';

vi.mock('@/lib/queries', () => ({
    filamentSlotsQuery: () => ({ queryKey: ['slots'], queryFn: async () => [] }),
    fileObjectsQuery: () => ({ queryKey: ['objects'], queryFn: async () => ({ names: [], svgB64: '' }) }),
}));

vi.mock('./print-preview-3d', () => ({ PrintPreview3D: () => <div data-testid="preview-3d" /> }));

const mocks = vi.hoisted(() => ({
    live: { connected: true, printState: 'standby', amsSlots: [], filamentMode: 'single' },
    printer: {
        settings: { autoLeveling: true, vibrationCompensation: false, timelapseEnabled: true, failureDetection: false },
    },
}));

vi.mock('@/hooks/use-printers', () => ({
    useLiveState: () => mocks.live as unknown as PrinterLiveState,
    usePrinter: () => mocks.printer,
}));

const file = {
    id: 'f1',
    filename: '20261022-173630-Anti-Wobble+V2_plate(01)_PETG_0.28_1h19m.gcode',
    estPrintTimeSec: 4740,
    layerHeight: 0.28,
    thumbnail: '',
    filaments: [{ slotIndex: 0, material: 'PETG', colorHex: '#111111', isUsed: true }],
    objects: [],
} as unknown as GcodeFileDto;

describe('PrintReadyForm', () => {
    it('shows the 3D preview and the readable part name', async () => {
        await renderWithProviders(<PrintReadyForm printerId="p1" file={file} onPrint={vi.fn()} />);
        expect(screen.getByTestId('preview-3d')).toBeTruthy();
        expect(screen.getByText('Anti-Wobble V2')).toBeTruthy();
        expect(screen.getByText('Plate 1')).toBeTruthy();
    });

    it('starts each option from the printer settings', async () => {
        await renderWithProviders(<PrintReadyForm printerId="p1" file={file} onPrint={vi.fn()} />);
        const state = (name: RegExp) => screen.getByRole('switch', { name }).getAttribute('aria-checked');
        expect(state(/auto bed leveling/i)).toBe('true');
        expect(state(/vibration compensation/i)).toBe('false');
        expect(state(/record a timelapse/i)).toBe('true');
        expect(state(/failure detection/i)).toBe('false');
    });

    it('sends the options chosen for this print', async () => {
        const onPrint = vi.fn().mockResolvedValue(undefined);
        await renderWithProviders(<PrintReadyForm printerId="p1" file={file} onPrint={onPrint} />);
        await userEvent.click(screen.getByRole('switch', { name: /vibration compensation/i }));
        await userEvent.click(screen.getByRole('switch', { name: /record a timelapse/i }));
        await userEvent.click(screen.getByRole('button', { name: /print/i }));
        expect(onPrint).toHaveBeenCalledWith(
            expect.objectContaining({
                autoLeveling: true,
                vibrationCompensation: true,
                timelapse: false,
                failureDetection: false,
            }),
        );
    });
});

describe('PrintReadyForm scheduling', () => {
    it('offers no schedule button without a handler', async () => {
        await renderWithProviders(<PrintReadyForm printerId="p1" file={file} onPrint={vi.fn()} />);
        expect(screen.queryByRole('button', { name: m.schedule_button() })).toBeNull();
    });

    it('asks for a start time, ignores an empty one and schedules with the options', async () => {
        const onSchedule = vi.fn().mockResolvedValue(undefined);
        await renderWithProviders(
            <PrintReadyForm printerId="p1" file={file} onPrint={vi.fn()} onSchedule={onSchedule} />,
        );
        expect(screen.queryByLabelText(m.schedule_start_at())).toBeNull();
        await userEvent.click(screen.getByRole('button', { name: m.schedule_button() }));
        const input = screen.getByLabelText(m.schedule_start_at());
        await userEvent.click(screen.getByRole('button', { name: m.schedule_confirm() }));
        expect(onSchedule).not.toHaveBeenCalled();
        fireEvent.change(input, { target: { value: '2026-11-01T08:00' } });
        await userEvent.click(screen.getByRole('switch', { name: /record a timelapse/i }));
        await userEvent.click(screen.getByRole('button', { name: m.schedule_confirm() }));
        await waitFor(() => expect(onSchedule).toHaveBeenCalledOnce());
        const [options, startAt] = onSchedule.mock.calls[0];
        expect(options).toMatchObject({ autoLeveling: true, timelapse: false });
        expect(startAt).toBe(new Date('2026-11-01T08:00').toISOString());
    });
});
