import type { PrinterLiveState } from '@kobralink/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { ControlsCard } from './controls-card';

const { live, light, printer } = vi.hoisted(() => ({
    live: {
        connected: true,
        printState: 'standby',
        kobraState: 'free',
        fanSpeed: 40,
        lightOn: true,
        lightBrightness: 80,
        printSpeedMode: 2,
    },
    light: vi.fn().mockResolvedValue(undefined),
    printer: { settings: { powerOnUrl: 'http://plug/on', powerOffUrl: 'http://plug/off' } },
}));

vi.mock('@/lib/api', () => ({
    api: new Proxy(
        {
            control: { light, fan: vi.fn(), speed: vi.fn() },
            printers: { power: vi.fn(), powerStatus: vi.fn().mockResolvedValue({ state: 'off' }) },
        } as Record<string, unknown>,
        { get: (target, key: string) => target[key] ?? new Proxy({}, { get: () => vi.fn().mockResolvedValue([]) }) },
    ),
}));

vi.mock('@/hooks/use-printers', () => ({
    useLiveState: () => live as unknown as PrinterLiveState,
    usePrinter: () => printer,
}));

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
        expect(light).toHaveBeenCalledWith('p1', { on: false });
    });

    it('locks the speed modes outside a print', async () => {
        await renderWithProviders(<ControlsCard printerId="p1" />);
        const standard = screen.getByRole('button', { name: /Standard/ });
        expect(standard.hasAttribute('disabled')).toBe(true);
        expect(standard.getAttribute('aria-pressed')).toBe('true');
    });
});
