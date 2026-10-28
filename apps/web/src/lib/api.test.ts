import { describe, expect, it } from 'vitest';
import { api } from './api';

describe('api url builders', () => {
    it('builds the CSV export link with the current filters', () => {
        expect(api.statsCsvUrl()).toBe('/api/v1/stats/export.csv?printerId=&days=0');
        expect(api.statsCsvUrl('p 1', 30)).toBe('/api/v1/stats/export.csv?printerId=p%201&days=30');
    });

    it('points at the failure snapshot of a job', () => {
        expect(api.files.snapshotUrl('p1', 'j1')).toBe('/api/v1/printers/p1/history/j1/snapshot');
    });
});
