import type { PrinterLiveState } from '@kobralink/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { m } from '@/lib/i18n';
import { renderWithProviders } from '@/test/render';
import { ControlsCard } from './controls-card';

const { live, control, printers, printer } = vi.hoisted(() => ({
    live: {
        connected: true,
        printState: 'standby',
        kobraState: 'free',
        fanSpeed: 40,
        lightOn: true,
        lightBrightness: 80,
        printSpeedMode: 2,
    },
    control: { light: vi.fn(), fan: vi.fn(), speed: vi.fn() },
    printers: { power: vi.fn(), powerStatus: vi.fn() },
    printer: { settings: { powerOnUrl: 'http://plug/on', powerOffUrl: 'http://plug/off' } },
}));

vi.mock('@/lib/api', () => ({
    api: new Proxy({ control, printers } as Record<string, unknown>, {
        get: (target, key: string) => target[key] ?? new Proxy({}, { get: () => vi.fn().mockResolvedValue([]) }),
    }),
}));

vi.mock('@/hooks/use-printers', () => ({
    useLiveState: () => live as unknown as PrinterLiveState,
    usePrinter: () => printer,
}));

beforeEach(() => {
    Object.assign(live, {
        connected: true,
        printState: 'standby',
        fanSpeed: 40,
        lightOn: true,
        lightBrightness: 80,
        printSpeedMode: 2,
    });
    printer.settings = { powerOnUrl: 'http://plug/on', powerOffUrl: 'http://plug/off' };
    control.light.mockReset().mockResolvedValue(undefined);
    control.speed.mockReset().mockResolvedValue(undefined);
    printers.power.mockReset().mockResolvedValue({ state: 'on' });
    printers.powerStatus.mockReset().mockResolvedValue({ state: 'off' });
});

describe('ControlsCard', () => {
    it('shows the light and power tiles and toggles the light', async () => {
        await renderWithProviders(<ControlsCard printerId="p1" />);
        const lightTile = screen.getByRole('button', { name: /Light/ });
        expect(lightTile.getAttribute('aria-pressed')).toBe('true');
        expect(screen.getByText('On · 80 %')).toBeTruthy();
        expect(screen.getByText('Brightness')).toBeTruthy();
        expect(screen.getByText('40 %')).toBeTruthy();
        expect(await screen.findByText('Plug off')).toBeTruthy();
        expect(screen.getByRole('button', { name: /Power/ }).getAttribute('aria-pressed')).toBe('false');
        await userEvent.click(lightTile);
        expect(control.light).toHaveBeenCalledWith('p1', { on: false });
    });

    it('hides the brightness slider while the light is off', async () => {
        live.lightOn = false;
        await renderWithProviders(<ControlsCard printerId="p1" />);
        expect(screen.getByText('Off')).toBeTruthy();
        expect(screen.queryByText('Brightness')).toBeNull();
        await userEvent.click(screen.getByRole('button', { name: /Light/ }));
        expect(control.light).toHaveBeenCalledWith('p1', { on: true });
    });

    it('switches the smart plug on and hides the tile when none is configured', async () => {
        await renderWithProviders(<ControlsCard printerId="p1" />);
        await screen.findByText('Plug off');
        await userEvent.click(screen.getByRole('button', { name: /Power/ }));
        expect(printers.power).toHaveBeenCalledWith('p1', 'on');
    });

    it('shows no power tile without a plug', async () => {
        printer.settings = { powerOnUrl: '', powerOffUrl: '' };
        await renderWithProviders(<ControlsCard printerId="p1" />);
        expect(screen.queryByRole('button', { name: /Power/ })).toBeNull();
        expect(printers.powerStatus).not.toHaveBeenCalled();
    });

    it('locks the speed modes outside a print and the plug while printing', async () => {
        await renderWithProviders(<ControlsCard printerId="p1" />);
        const standard = screen.getByRole('button', { name: /Standard/ });
        expect(standard.hasAttribute('disabled')).toBe(true);
        expect(standard.getAttribute('aria-pressed')).toBe('true');
        expect(screen.getByText(m.controls_speed_hint())).toBeTruthy();
    });

    it('changes the speed mode while printing', async () => {
        live.printState = 'printing';
        await renderWithProviders(<ControlsCard printerId="p1" />);
        await userEvent.click(screen.getByRole('button', { name: /Sport/ }));
        expect(control.speed).toHaveBeenCalledWith('p1', { mode: 3 });
        expect(screen.getByRole('button', { name: /Power/ }).hasAttribute('disabled')).toBe(true);
        expect(screen.getByText(/locked while printing/)).toBeTruthy();
    });

    it('disables the tiles while offline', async () => {
        live.connected = false;
        await renderWithProviders(<ControlsCard printerId="p1" />);
        expect(screen.getByRole('button', { name: /Light/ }).hasAttribute('disabled')).toBe(true);
    });
});
