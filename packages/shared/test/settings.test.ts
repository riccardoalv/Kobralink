import { describe, expect, it } from 'bun:test';
import { appSettingsSchema, updateAppSettingsSchema } from '../src/settings';

describe('updateAppSettingsSchema', () => {
    it('keeps only the keys present in the body', () => {
        const parsed = updateAppSettingsSchema.parse({ spoolmanUrl: 'http://spoolman:8000' });
        expect(parsed).toEqual({ spoolmanUrl: 'http://spoolman:8000' });
    });

    it('does not fill omitted sections with defaults', () => {
        const parsed = updateAppSettingsSchema.parse({ notifications: { discordUrl: 'https://discord.test/hook' } });
        expect(Object.keys(parsed)).toEqual(['notifications']);
        expect(parsed.locale).toBeUndefined();
        expect(parsed.spoolmanUrl).toBeUndefined();
        expect(parsed.failureDetection).toBeUndefined();
    });

    it('accepts an empty body', () => {
        expect(updateAppSettingsSchema.parse({})).toEqual({});
    });

    it('still validates the values that are sent', () => {
        expect(updateAppSettingsSchema.safeParse({ locale: 'xx' }).success).toBe(false);
        expect(updateAppSettingsSchema.safeParse({ spoolmanSyncRateSec: -1 }).success).toBe(false);
    });

    it('preserves earlier settings when merged with a single card save', () => {
        const stored = appSettingsSchema.parse({ locale: 'en', currency: 'BRL', spoolmanUrl: 'http://spoolman:8000' });
        const patch = updateAppSettingsSchema.parse({ failureDetection: { enabled: true } });
        const next = appSettingsSchema.parse({ ...stored, ...patch });
        expect(next.locale).toBe('en');
        expect(next.currency).toBe('BRL');
        expect(next.spoolmanUrl).toBe('http://spoolman:8000');
        expect(next.failureDetection.enabled).toBe(true);
    });
});

describe('publicUrl', () => {
    it('is empty until the address of FarolPrint is set', () => {
        expect(appSettingsSchema.parse({}).publicUrl).toBe('');
    });

    it('accepts a URL and rejects anything else', () => {
        expect(appSettingsSchema.parse({ publicUrl: 'http://farol.local:7100' }).publicUrl).toBe(
            'http://farol.local:7100',
        );
        expect(appSettingsSchema.safeParse({ publicUrl: 'farol.local' }).success).toBe(false);
        expect(updateAppSettingsSchema.parse({ publicUrl: '' })).toEqual({ publicUrl: '' });
    });
});
