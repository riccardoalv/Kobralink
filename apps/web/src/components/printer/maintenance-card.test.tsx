import type { MaintenanceTaskDto } from '@kobralink/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { MaintenanceCard } from './maintenance-card';

const { tasks } = vi.hoisted(() => {
    const tasks: MaintenanceTaskDto[] = [
        {
            id: 't1',
            printerId: 'p1',
            name: 'Clean the nozzle',
            note: 'Cold pull',
            intervalHours: 50,
            intervalJobs: 0,
            intervalDays: 0,
            lastDoneAt: null,
            usage: { hours: 62.5, jobs: 10, days: 3 },
            progress: 1.25,
            due: true,
            createdAt: '2026-10-01T00:00:00.000Z',
        },
        {
            id: 't2',
            printerId: 'p1',
            name: 'Lubricate the axes',
            note: '',
            intervalHours: 100,
            intervalJobs: 20,
            intervalDays: 0,
            lastDoneAt: '2026-10-10T12:00:00.000Z',
            usage: { hours: 10, jobs: 2, days: 1 },
            progress: 0.1,
            due: false,
            createdAt: '2026-10-01T00:00:00.000Z',
        },
    ];
    return { tasks };
});

vi.mock('@/lib/api', () => ({
    api: new Proxy(
        {
            maintenance: {
                list: vi.fn().mockResolvedValue(tasks),
                remove: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
                complete: vi.fn(),
                logs: vi.fn().mockResolvedValue([]),
            },
        } as Record<string, unknown>,
        { get: (target, key: string) => target[key] ?? new Proxy({}, { get: () => vi.fn().mockResolvedValue([]) }) },
    ),
}));

describe('MaintenanceCard', () => {
    it('lists the tasks and flags the due ones', async () => {
        await renderWithProviders(<MaintenanceCard printerId="p1" />);
        expect(await screen.findByText('Clean the nozzle')).toBeTruthy();
        expect(screen.getByText('Lubricate the axes')).toBeTruthy();
        expect(screen.getByText('1 due')).toBeTruthy();
        expect(screen.getByText('Due')).toBeTruthy();
        expect(screen.getByText('every 50 h')).toBeTruthy();
        expect(screen.getByText('every 100 h · every 20 prints')).toBeTruthy();
        expect(screen.getByText('Never done')).toBeTruthy();
        expect(screen.getByText('Cold pull')).toBeTruthy();
    });
});
