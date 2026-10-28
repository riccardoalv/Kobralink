import { FAILURE_REASONS } from '@kobralink/shared';
import { describe, expect, it } from 'vitest';
import { m } from './i18n';
import { failureReasonLabel } from './labels';

describe('failureReasonLabel', () => {
    it('translates every reason and the special buckets', () => {
        const labels = FAILURE_REASONS.map(failureReasonLabel);
        expect(new Set(labels).size).toBe(FAILURE_REASONS.length);
        for (const label of labels) expect(label.trim().length).toBeGreaterThan(0);
        expect(failureReasonLabel('spaghetti')).toBe(m.failure_reason_spaghetti());
        expect(failureReasonLabel('')).toBe(m.failure_reason_none());
        expect(failureReasonLabel('unlabeled')).toBe(m.failure_reason_none());
        expect(failureReasonLabel('error')).toBe(m.failure_reason_error());
    });

    it('falls back to the raw value for an unknown reason', () => {
        expect(failureReasonLabel('gremlins')).toBe('gremlins');
    });
});
