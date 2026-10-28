import type { StatsBucket, StatsDto } from '@kobralink/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { formatMoney } from '@/lib/format';
import { m } from '@/lib/i18n';
import { renderWithProviders } from '@/test/render';
import { StatsBody } from './stats-body';

vi.mock('recharts', () => ({
    Bar: () => null,
    BarChart: ({ children }: { children?: React.ReactNode }) => <div data-testid="chart">{children}</div>,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
}));

vi.mock('@/components/ui/chart', () => ({
    ChartContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    ChartLegend: () => null,
    ChartLegendContent: () => null,
    ChartTooltip: () => null,
    ChartTooltipContent: () => null,
}));

const bucket = (key: string, jobs = 0): StatsBucket => ({
    key,
    jobs,
    completed: jobs,
    durationSec: 0,
    filamentMm: 0,
    cost: 0,
});

const data: StatsDto = {
    totalJobs: 4,
    completed: 2,
    cancelled: 1,
    errored: 1,
    inProgress: 0,
    successRate: 0.5,
    totalDurationSec: 7200,
    completedDurationSec: 7200,
    avgDurationSec: 3600,
    longestDurationSec: 3600,
    estimatedDurationSec: 0,
    estimateRatio: null,
    totalFilamentMm: 12000,
    totalFilamentG: 36,
    totalCost: 1.65,
    filamentCost: 0,
    energyCost: 0.15,
    machineCost: 1.5,
    unpricedG: 0,
    currency: 'EUR',
    firstJobAt: '2026-10-01T00:00:00.000Z',
    lastJobAt: '2026-10-20T00:00:00.000Z',
    daily: [],
    months: [bucket('2026-10', 4)],
    weekdays: Array.from({ length: 7 }, (_, i) => bucket(String(i))),
    hours: Array.from({ length: 24 }, (_, i) => bucket(String(i))),
    printers: [],
    topFiles: [],
    materials: [{ material: 'PLA', filamentMm: 12000, weightG: 36, cost: 0, jobs: 4 }],
    failures: [
        { reason: 'spaghetti', count: 1 },
        { reason: 'error', count: 1 },
    ],
};

describe('StatsBody', () => {
    it('shows the cost tile with its breakdown and the failures by reason', async () => {
        await renderWithProviders(<StatsBody data={data} days={30} />);
        expect(screen.getByText(formatMoney(1.65, 'EUR'))).toBeTruthy();
        expect(
            screen.getByText(
                m.stats_cost_breakdown({
                    filament: formatMoney(0, 'EUR'),
                    energy: formatMoney(0.15, 'EUR'),
                    machine: formatMoney(1.5, 'EUR'),
                }),
            ),
        ).toBeTruthy();
        expect(screen.getByText(m.stats_failures())).toBeTruthy();
        expect(screen.getByText(m.failure_reason_spaghetti())).toBeTruthy();
        expect(screen.getByText(m.failure_reason_error())).toBeTruthy();
        expect(screen.getAllByText('1 · 50%')).toHaveLength(2);
    });

    it('hides the cost tile and the failures card when there is nothing to show', async () => {
        await renderWithProviders(
            <StatsBody data={{ ...data, totalCost: 0, energyCost: 0, machineCost: 0, failures: [] }} days={30} />,
        );
        expect(screen.queryByText(m.stats_failures())).toBeNull();
        expect(screen.queryByText(formatMoney(0, 'EUR'))).toBeNull();
    });

    it('tells when all filament is priced and when some is not', async () => {
        await renderWithProviders(
            <StatsBody data={{ ...data, totalCost: 2, energyCost: 0, machineCost: 0, filamentCost: 2 }} days={30} />,
        );
        expect(screen.getByText(m.stats_cost_all_priced())).toBeTruthy();
    });

    it('mentions unpriced filament', async () => {
        await renderWithProviders(
            <StatsBody
                data={{ ...data, totalCost: 2, energyCost: 0, machineCost: 0, filamentCost: 2, unpricedG: 12 }}
                days={30}
            />,
        );
        expect(screen.getByText(m.stats_cost_unpriced({ g: 12 }))).toBeTruthy();
    });
});
