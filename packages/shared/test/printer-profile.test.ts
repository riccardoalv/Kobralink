import { describe, expect, it } from 'bun:test';
import {
    depreciationPerHour,
    PRINTER_TAG_MAX,
    printerProfileSchema,
    printerSettingsSchema,
    updatePrinterSchema,
} from '../src/printer';

describe('printerProfileSchema', () => {
    it('starts empty, with nothing invented', () => {
        expect(printerProfileSchema.parse({})).toEqual({
            location: '',
            tags: [],
            nozzleMm: null,
            powerW: null,
            purchasePrice: null,
            lifespanHours: null,
        });
        expect(printerSettingsSchema.parse({}).profile).toEqual(printerProfileSchema.parse({}));
    });

    it('normalises tags to trimmed lowercase and drops duplicates', () => {
        expect(printerProfileSchema.parse({ tags: [' PLA ', 'pla', 'Farm-A'] }).tags).toEqual(['pla', 'farm-a']);
    });

    it('rejects empty, long and too many tags', () => {
        expect(printerProfileSchema.safeParse({ tags: ['  '] }).success).toBe(false);
        expect(printerProfileSchema.safeParse({ tags: ['x'.repeat(33)] }).success).toBe(false);
        const many = Array.from({ length: PRINTER_TAG_MAX + 1 }, (_, i) => `t${i}`);
        expect(printerProfileSchema.safeParse({ tags: many }).success).toBe(false);
    });

    it('bounds the numbers and accepts clearing them', () => {
        expect(printerProfileSchema.safeParse({ nozzleMm: 0.05 }).success).toBe(false);
        expect(printerProfileSchema.safeParse({ powerW: -1 }).success).toBe(false);
        expect(printerProfileSchema.safeParse({ lifespanHours: 1.5 }).success).toBe(false);
        expect(printerProfileSchema.parse({ nozzleMm: 0.6, powerW: null }).nozzleMm).toBe(0.6);
    });

    it('can be patched one field at a time', () => {
        const patch = updatePrinterSchema.parse({ settings: { profile: { location: 'Garage' } } });
        expect(patch.settings?.profile).toEqual({ location: 'Garage' });
    });
});

describe('depreciationPerHour', () => {
    it('spreads the purchase price over the expected lifespan', () => {
        expect(depreciationPerHour({ purchasePrice: 3000, lifespanHours: 6000 })).toBe(0.5);
    });

    it('is zero when either value is missing', () => {
        expect(depreciationPerHour({ purchasePrice: 3000, lifespanHours: null })).toBe(0);
        expect(depreciationPerHour({ purchasePrice: null, lifespanHours: 6000 })).toBe(0);
        expect(depreciationPerHour({ purchasePrice: 3000, lifespanHours: 0 })).toBe(0);
    });
});
