import type { PrinterLiveState } from '@farolprint/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
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
    control: { light: vi.fn(), fan: vi.fn(), speed: vi.fn(), axis: vi.fn(), axisOff: vi.fn() },
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
    for (const fn of Object.values(control)) fn.mockReset().mockResolvedValue(undefined);
    printers.power.mockReset().mockResolvedValue({ state: 'on' });
    printers.powerStatus.mockReset().mockResolvedValue({ state: 'off' });
});

const lightSwitch = () => screen.getByRole('switch', { name: m.controls_light() });
const powerSwitch = () => screen.getByRole('switch', { name: m.controls_power() });
const openAxes = () => userEvent.click(screen.getByRole('button', { name: m.axes_title() }));

describe('ControlsCard', () => {
    it('shows the light and power switches and toggles the light off', async () => {
        await renderWithProviders(<ControlsCard printerId="p1" />);
        expect(lightSwitch().getAttribute('aria-checked')).toBe('true');
        expect(screen.getByText('On · 80 %')).toBeTruthy();
        expect(screen.getByRole('slider', { name: m.controls_brightness() })).toBeTruthy();
        expect(screen.getByText('40 %')).toBeTruthy();
        expect(await screen.findByText('Plug off')).toBeTruthy();
        expect(powerSwitch().getAttribute('aria-checked')).toBe('false');
        await userEvent.click(lightSwitch());
        expect(control.light).toHaveBeenCalledWith('p1', { on: false });
    });

    it('hides the brightness slider while the light is off and turns it on', async () => {
        live.lightOn = false;
        await renderWithProviders(<ControlsCard printerId="p1" />);
        expect(screen.getByText('Off')).toBeTruthy();
        expect(screen.queryByRole('slider', { name: m.controls_brightness() })).toBeNull();
        await userEvent.click(lightSwitch());
        expect(control.light).toHaveBeenCalledWith('p1', { on: true });
    });

    it('commits the brightness and the fan speed from their sliders', async () => {
        await renderWithProviders(<ControlsCard printerId="p1" />);
        const brightness = screen.getByRole('slider', { name: m.controls_brightness() });
        fireEvent.keyDown(brightness, { key: 'ArrowRight' });
        await waitFor(() => expect(control.light).toHaveBeenCalledWith('p1', { on: true, brightness: 85 }));
        const fan = screen.getByRole('slider', { name: m.controls_part_fan() });
        fireEvent.keyDown(fan, { key: 'ArrowRight' });
        await waitFor(() => expect(control.fan).toHaveBeenCalledWith('p1', { speed: 45 }));
    });

    it('switches the smart plug on', async () => {
        await renderWithProviders(<ControlsCard printerId="p1" />);
        await screen.findByText('Plug off');
        await userEvent.click(powerSwitch());
        expect(printers.power).toHaveBeenCalledWith('p1', 'on');
    });

    it('shows no power switch without a plug', async () => {
        printer.settings = { powerOnUrl: '', powerOffUrl: '' };
        await renderWithProviders(<ControlsCard printerId="p1" />);
        expect(screen.queryByRole('switch', { name: m.controls_power() })).toBeNull();
        expect(printers.powerStatus).not.toHaveBeenCalled();
    });

    it('locks the speed modes outside a print', async () => {
        await renderWithProviders(<ControlsCard printerId="p1" />);
        const standard = screen.getByRole('button', { name: /Standard/ });
        expect(standard.hasAttribute('disabled')).toBe(true);
        expect(standard.getAttribute('aria-pressed')).toBe('true');
        expect(screen.getByText(m.controls_speed_hint())).toBeTruthy();
    });

    it('changes the speed mode while printing and locks the plug and the axes', async () => {
        live.printState = 'printing';
        await renderWithProviders(<ControlsCard printerId="p1" />);
        await userEvent.click(screen.getByRole('button', { name: /Sport/ }));
        expect(control.speed).toHaveBeenCalledWith('p1', { mode: 3 });
        expect(powerSwitch().hasAttribute('disabled')).toBe(true);
        expect(screen.getByText(/locked while printing/)).toBeTruthy();
        await openAxes();
        expect(screen.getByRole('button', { name: m.axes_home() }).hasAttribute('disabled')).toBe(true);
        expect(screen.getByRole('button', { name: m.axes_motors_off() }).hasAttribute('disabled')).toBe(true);
    });

    it('disables the switches and the axes while offline', async () => {
        live.connected = false;
        await renderWithProviders(<ControlsCard printerId="p1" />);
        expect(lightSwitch().hasAttribute('disabled')).toBe(true);
        await openAxes();
        expect(screen.getByRole('button', { name: 'Z+' }).hasAttribute('disabled')).toBe(true);
    });

    it('switches to the axes tab, jogs with the selected distance and homes', async () => {
        await renderWithProviders(<ControlsCard printerId="p1" />);
        expect(screen.queryByRole('button', { name: m.axes_home() })).toBeNull();
        expect(screen.getByRole('button', { name: m.controls_title() }).getAttribute('aria-pressed')).toBe('true');
        await openAxes();
        expect(screen.getByRole('button', { name: m.axes_title() }).getAttribute('aria-pressed')).toBe('true');
        expect(screen.queryByRole('switch', { name: m.controls_light() })).toBeNull();
        expect(screen.getByRole('button', { name: '10 mm' }).getAttribute('aria-pressed')).toBe('true');
        await userEvent.click(screen.getByRole('button', { name: `X+ · ${m.axes_nozzle()}` }));
        expect(control.axis).toHaveBeenLastCalledWith('p1', { axis: 1, moveType: 1, distance: 10 });
        await userEvent.click(screen.getByRole('button', { name: '50 mm' }));
        await userEvent.click(screen.getByRole('button', { name: `Y- · ${m.axes_bed()}` }));
        expect(control.axis).toHaveBeenLastCalledWith('p1', { axis: 2, moveType: 0, distance: 50 });
        await userEvent.click(screen.getByRole('button', { name: '1 mm' }));
        await userEvent.click(screen.getByRole('button', { name: 'Z-' }));
        expect(control.axis).toHaveBeenLastCalledWith('p1', { axis: 3, moveType: 0, distance: 1 });
        await userEvent.click(screen.getByRole('button', { name: m.axes_home() }));
        expect(control.axis).toHaveBeenLastCalledWith('p1', { axis: 4, moveType: 2, distance: 1 });
    });

    it('disables the motors', async () => {
        await renderWithProviders(<ControlsCard printerId="p1" />);
        await openAxes();
        await userEvent.click(screen.getByRole('button', { name: m.axes_motors_off() }));
        expect(control.axisOff).toHaveBeenCalledWith('p1');
    });
});
