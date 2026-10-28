import { describe, expect, it } from 'bun:test';
import { printerSettingsSchema } from '../src/printer';
import { APP_LOCALES, appSettingsSchema, costSettingsSchema } from '../src/settings';

describe('cost settings', () => {
    it('default to zero so no cost is shown until the user sets a price', () => {
        expect(costSettingsSchema.parse({})).toEqual({ energyPricePerKwh: 0, printerPowerW: 0, hourlyRate: 0 });
        expect(appSettingsSchema.parse({}).costs).toEqual({ energyPricePerKwh: 0, printerPowerW: 0, hourlyRate: 0 });
    });

    it('accept realistic values and reject negative or absurd ones', () => {
        expect(costSettingsSchema.parse({ energyPricePerKwh: 0.21, printerPowerW: 180, hourlyRate: 0.5 })).toEqual({
            energyPricePerKwh: 0.21,
            printerPowerW: 180,
            hourlyRate: 0.5,
        });
        expect(costSettingsSchema.safeParse({ energyPricePerKwh: -1 }).success).toBe(false);
        expect(costSettingsSchema.safeParse({ printerPowerW: 6000 }).success).toBe(false);
        expect(costSettingsSchema.safeParse({ hourlyRate: 10001 }).success).toBe(false);
    });

    it('survive a partial patch of the app settings', () => {
        const parsed = appSettingsSchema.parse({ costs: { printerPowerW: 120 } });
        expect(parsed.costs).toEqual({ energyPricePerKwh: 0, printerPowerW: 120, hourlyRate: 0 });
    });
});

describe('locales', () => {
    it('include Brazilian Portuguese with French as the default', () => {
        expect(APP_LOCALES).toContain('pt-br');
        expect(APP_LOCALES[0]).toBe('fr');
        expect(appSettingsSchema.parse({}).locale).toBe('fr');
        expect(appSettingsSchema.parse({ locale: 'pt-br' }).locale).toBe('pt-br');
        expect(appSettingsSchema.safeParse({ locale: 'pt' }).success).toBe(false);
    });
});

describe('notification events', () => {
    it('turn the scheduled print and maintenance events on by default', () => {
        const events = appSettingsSchema.parse({}).notifications.events;
        expect(events.scheduledPrint).toBe(true);
        expect(events.maintenanceDue).toBe(true);
        const off = appSettingsSchema.parse({ notifications: { events: { maintenanceDue: false } } });
        expect(off.notifications.events.maintenanceDue).toBe(false);
        expect(off.notifications.events.scheduledPrint).toBe(true);
    });
});

describe('printer settings', () => {
    it('ask for a bed-clear confirmation by default', () => {
        expect(printerSettingsSchema.parse({}).queueBedClearConfirm).toBe(true);
        expect(printerSettingsSchema.parse({ queueBedClearConfirm: false }).queueBedClearConfirm).toBe(false);
    });
});
