import { describe, expect, it, mock } from 'bun:test';
import { type AppSettings, appSettingsSchema } from '@kobralink/shared';
import { installI18n } from '../src/i18n/locale';
import { NotificationService } from '../src/notifications/notification.service';
import type { SettingsService } from '../src/settings/settings.service';

installI18n();

function service(overrides: Record<string, unknown> = {}) {
    const current: AppSettings = appSettingsSchema.parse({ locale: 'en', ...overrides });
    const svc = new NotificationService({ get: () => current } as unknown as SettingsService);
    const deliver = mock(async () => ({ delivered: [], failed: [] }));
    (svc as unknown as { deliver: typeof deliver }).deliver = deliver;
    return { svc, deliver };
}

describe('notification texts', () => {
    it('describes the queue hold with and without the bed-clear confirmation', () => {
        const { svc } = service();
        const held = svc.build('p1', 'Kobra', 'queue_next', { filename: 'a.gcode', bedClear: true });
        expect(held.title).toBe('Kobra — queue');
        expect(held.body).toBe('Next file ready: a.gcode. Confirm the bed is clear to start it.');
        const plain = svc.build('p1', 'Kobra', 'queue_next', { filename: 'a.gcode', bedClear: false });
        expect(plain.body).toBe('Next file ready: a.gcode. Clear the bed, then start it.');
    });

    it('describes the three outcomes of a scheduled print', () => {
        const { svc } = service();
        const base = { filename: 'lid.gcode' };
        expect(svc.build('p1', 'Kobra', 'scheduled_print', { ...base, result: 'started' })).toMatchObject({
            title: 'Kobra — scheduled print',
            body: 'lid.gcode started as scheduled.',
        });
        expect(svc.build('p1', 'Kobra', 'scheduled_print', { ...base, result: 'queued' }).body).toBe(
            'lid.gcode could not start (printer busy or offline): added to the front of the queue.',
        );
        expect(svc.build('p1', 'Kobra', 'scheduled_print', { ...base, result: 'failed', error: 'boom' }).body).toBe(
            'lid.gcode could not start: boom',
        );
        expect(svc.build('p1', 'Kobra', 'scheduled_print', base).body).toBe('lid.gcode started as scheduled.');
    });

    it('describes a due maintenance task with its usage', () => {
        const { svc } = service();
        const ev = svc.build('p1', 'Kobra', 'maintenance_due', { task: 'Clean the nozzle', hours: 52, jobs: 9 });
        expect(ev.title).toBe('Kobra — maintenance due');
        expect(ev.body).toBe('Clean the nozzle: 52 h and 9 prints since the last time.');
        expect(svc.build('p1', 'Kobra', 'maintenance_due', {}).body).toBe(': 0 h and 0 prints since the last time.');
    });

    it('follows the configured locale', () => {
        const { svc } = service({ locale: 'fr' });
        expect(svc.build('p1', 'Kobra', 'queue_next', { filename: 'a.gcode' }).title).toBe("Kobra — file d'attente");
        expect(svc.build('p1', 'Kobra', 'maintenance_due', { task: 'x' }).title).toBe('Kobra — entretien à faire');
    });
});

describe('notification delivery flags', () => {
    it('delivers the new events only when their switch is on', () => {
        const { svc, deliver } = service({
            notifications: { events: { scheduledPrint: false, maintenanceDue: true, queueNext: true } },
        });
        const seen: string[] = [];
        svc.on('notification', (ev) => seen.push(ev.type));
        svc.emitCustom('p1', 'Kobra', 'scheduled_print', { filename: 'a', result: 'started' });
        svc.emitCustom('p1', 'Kobra', 'maintenance_due', { task: 't' });
        svc.emitCustom('p1', 'Kobra', 'queue_next', { filename: 'a', bedClear: true });
        expect(seen).toEqual(['scheduled_print', 'maintenance_due', 'queue_next']);
        expect(deliver).toHaveBeenCalledTimes(2);
        const types = deliver.mock.calls.map((c) => (c as unknown as [{ type: string }])[0].type);
        expect(types).toEqual(['maintenance_due', 'queue_next']);
    });

    it('turns both new events on by default', () => {
        const { svc, deliver } = service();
        svc.emitCustom('p1', 'Kobra', 'scheduled_print', { filename: 'a' });
        svc.emitCustom('p1', 'Kobra', 'maintenance_due', { task: 't' });
        expect(deliver).toHaveBeenCalledTimes(2);
    });
});
