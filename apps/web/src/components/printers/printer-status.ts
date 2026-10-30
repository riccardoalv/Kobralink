import type { PrinterWithLive } from '@/lib/api';
import { m } from '@/lib/i18n';

export const HOME_STATUSES = ['printing', 'paused', 'ready', 'error', 'offline'] as const;
export type HomeStatus = (typeof HOME_STATUSES)[number];

export const HOME_STATUS_LABEL: Record<HomeStatus, () => string> = {
    printing: m.home_count_printing,
    paused: m.home_count_paused,
    ready: m.home_count_ready,
    error: m.home_count_error,
    offline: m.home_count_offline,
};

export function homeStatus(p: Pick<PrinterWithLive, 'live'>): HomeStatus {
    const live = p.live;
    if (!live?.connected) return 'offline';
    if (live.printState === 'printing') return 'printing';
    if (live.printState === 'paused') return 'paused';
    if (live.printState === 'error') return 'error';
    return 'ready';
}

export function countByStatus(printers: Pick<PrinterWithLive, 'live'>[]): Record<HomeStatus, number> {
    const counts = Object.fromEntries(HOME_STATUSES.map((s) => [s, 0])) as Record<HomeStatus, number>;
    for (const p of printers) counts[homeStatus(p)] += 1;
    return counts;
}

export function nextToFinish(
    printers: Pick<PrinterWithLive, 'name' | 'live'>[],
    now = Date.now(),
): { name: string; at: number } | null {
    let best: { name: string; at: number } | null = null;
    for (const p of printers) {
        if (homeStatus(p) !== 'printing') continue;
        const remain = p.live?.remainTimeSec ?? 0;
        if (remain <= 0) continue;
        const at = now + remain * 1000;
        if (!best || at < best.at) best = { name: p.name, at };
    }
    return best;
}
