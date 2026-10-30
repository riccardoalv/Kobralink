import { describe, expect, it } from 'bun:test';
import { jobCost } from '../src/cost';

const costs = { energyPricePerKwh: 0.8, printerPowerW: 150, hourlyRate: 2 };

describe('jobCost', () => {
    it('adds filament, energy and machine time', () => {
        const c = jobCost(2 * 3600, 1.5, costs);
        expect(c.filament).toBe(1.5);
        expect(c.energy).toBe(0.24);
        expect(c.machine).toBe(4);
        expect(c.total).toBe(5.74);
    });

    it('ignores energy and machine when the settings are zero', () => {
        const c = jobCost(3600, 0.42, { energyPricePerKwh: 0, printerPowerW: 0, hourlyRate: 0 });
        expect(c).toEqual({ filament: 0.42, energy: 0, machine: 0, total: 0.42 });
    });

    it('never goes negative', () => {
        const c = jobCost(-10, -1, costs);
        expect(c.total).toBe(0);
    });
});

describe('jobCost with a printer profile', () => {
    it('uses the printer power draw instead of the default one', () => {
        expect(jobCost(3600, 0, costs, { powerW: 300 }).energy).toBe(0.24);
        expect(jobCost(3600, 0, costs, { powerW: 0 }).energy).toBe(0);
        expect(jobCost(3600, 0, costs, { powerW: null }).energy).toBe(0.12);
    });

    it('adds the printer depreciation to the machine time', () => {
        const c = jobCost(2 * 3600, 0, costs, { depreciationPerHour: 0.5 });
        expect(c.machine).toBe(5);
        expect(jobCost(3600, 0, costs, { depreciationPerHour: -3 }).machine).toBe(2);
    });
});
