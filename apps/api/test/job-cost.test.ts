import { describe, expect, it } from 'bun:test';
import { hasAnyPricing, type PricingContext, priceJob } from '../src/stats/job-cost';

const noCosts = { energyPricePerKwh: 0, printerPowerW: 0, hourlyRate: 0 };

function ctx(over: Partial<PricingContext> = {}): PricingContext {
    return { spools: new Map(), filamentPricePerKg: 0, costs: noCosts, ...over };
}

const job = {
    status: 'completed',
    durationSec: 3600,
    filamentMm: 10_000,
    spoolUsage: '[]',
    filename: 'bracket_PLA_0.2.gcode',
    file: null,
};

describe('priceJob', () => {
    it('weighs the filament from the file material when no spool is known', () => {
        const p = priceJob(job, ctx());
        expect(p.weightG).toBeCloseTo(29.8, 0);
        expect(p.unpricedG).toBeCloseTo(p.weightG, 5);
        expect(p.cost.total).toBe(0);
    });

    it('uses the default price per kg when the spool has none', () => {
        const p = priceJob(job, ctx({ filamentPricePerKg: 20 }));
        expect(p.cost.filament).toBeCloseTo(0.6, 2);
        expect(p.unpricedG).toBe(0);
    });

    it('prefers the spool price and density', () => {
        const spools = new Map([
            ['s1', { diameterMm: 1.75, densityGcm3: 1.0, material: 'PETG', price: 30, initialWeightG: 1000 }],
        ]);
        const usage = JSON.stringify([{ slotIndex: 0, mm: 10_000, material: '', spoolId: 's1' }]);
        const p = priceJob({ ...job, spoolUsage: usage }, ctx({ spools, filamentPricePerKg: 999 }));
        expect(p.usage[0]?.material).toBe('PETG');
        expect(p.weightG).toBeCloseTo(24.05, 1);
        expect(p.cost.filament).toBeCloseTo(0.72, 2);
    });

    it('adds energy and machine time from the cost settings', () => {
        const p = priceJob(job, ctx({ costs: { energyPricePerKwh: 1, printerPowerW: 100, hourlyRate: 3 } }));
        expect(p.cost.energy).toBe(0.1);
        expect(p.cost.machine).toBe(3);
        expect(p.cost.total).toBe(3.1);
    });
});

describe('hasAnyPricing', () => {
    it('is false with no price anywhere and true as soon as one source is set', () => {
        expect(hasAnyPricing(ctx())).toBe(false);
        expect(hasAnyPricing(ctx({ filamentPricePerKg: 1 }))).toBe(true);
        expect(hasAnyPricing(ctx({ costs: { ...noCosts, hourlyRate: 1 } }))).toBe(true);
        expect(hasAnyPricing(ctx({ costs: { ...noCosts, energyPricePerKwh: 1 } }))).toBe(false);
        expect(hasAnyPricing(ctx({ costs: { ...noCosts, energyPricePerKwh: 1, printerPowerW: 50 } }))).toBe(true);
    });
});
