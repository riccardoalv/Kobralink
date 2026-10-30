import { describe, expect, it } from 'bun:test';
import { ACTIVE_PRINT_STATES, isCalibrating, KOBRA_TO_KLIPPER_STATE, PRE_PRINT_STATES } from '../src/state';

describe('isCalibrating', () => {
    it('is true while a print levels, compensates vibrations or heats up', () => {
        for (const kobraState of ['auto_leveling', 'vibrating', 'preheating', 'checking']) {
            expect(isCalibrating({ printState: 'printing', kobraState })).toBe(true);
        }
    });

    it('is false once the print really runs, or outside a print', () => {
        expect(isCalibrating({ printState: 'printing', kobraState: 'printing' })).toBe(false);
        expect(isCalibrating({ printState: 'standby', kobraState: 'preheating' })).toBe(false);
        expect(isCalibrating({ printState: 'paused', kobraState: 'paused' })).toBe(false);
    });
});

describe('vibration compensation', () => {
    it('counts as part of an active print, before printing starts', () => {
        expect(KOBRA_TO_KLIPPER_STATE.vibrating).toBe('printing');
        expect(PRE_PRINT_STATES.has('vibrating')).toBe(true);
        expect(ACTIVE_PRINT_STATES.has('vibrating')).toBe(true);
    });
});
