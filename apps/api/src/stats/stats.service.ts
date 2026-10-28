import {
    type PrintJobDto,
    round2,
    type StatsBucket,
    type StatsDto,
    type StatsFileEntry,
    type StatsPrinterEntry,
} from '@farolprint/shared';
import { Injectable } from '@nestjs/common';
import { toJobDto } from '../gcode/gcode.service';
import type { PrintJob } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { hasAnyPricing, type PricedSpool, type PricingContext, priceJob } from './job-cost';
import { jobsToCsv } from './stats-csv';

const DAILY_MAX_DAYS = 90;

type JobRow = PrintJob & { file: { thumbnail: string | null; id: string; filaments: string } | null };

@Injectable()
export class StatsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly settings: SettingsService,
    ) {}

    async pricing(): Promise<PricingContext> {
        const spoolRows = await this.prisma.client.localSpool.findMany({
            select: {
                id: true,
                diameterMm: true,
                densityGcm3: true,
                material: true,
                price: true,
                initialWeightG: true,
            },
        });
        const { filamentPricePerKg, costs } = this.settings.get();
        return {
            spools: new Map<string, PricedSpool>(spoolRows.map((s) => [s.id, s])),
            filamentPricePerKg,
            costs,
        };
    }

    async history(printerId: string | undefined, limit = 50, offset = 0): Promise<PrintJobDto[]> {
        const [rows, ctx] = await Promise.all([
            this.prisma.client.printJob.findMany({
                where: printerId ? { printerId } : undefined,
                orderBy: { startedAt: 'desc' },
                take: limit,
                skip: offset,
                include: { file: { select: { thumbnail: true, id: true, filaments: true } } },
            }),
            this.pricing(),
        ]);
        return rows.map((r) => this.withCost(r, ctx));
    }

    private withCost(r: JobRow, ctx: PricingContext): PrintJobDto {
        const dto = toJobDto(r, r.file?.thumbnail ?? null);
        if (r.status === 'printing' || !hasAnyPricing(ctx)) return dto;
        return { ...dto, cost: priceJob(r, ctx).cost };
    }

    async exportCsv(printerId?: string, days = 0): Promise<string> {
        const since = sinceDate(days);
        const [rows, ctx, printers] = await Promise.all([
            this.prisma.client.printJob.findMany({
                where: { ...(printerId ? { printerId } : {}), ...(since ? { startedAt: { gte: since } } : {}) },
                include: { file: { select: { thumbnail: true, id: true, filaments: true } } },
                orderBy: { startedAt: 'asc' },
            }),
            this.pricing(),
            this.prisma.client.printer.findMany({ select: { id: true, name: true } }),
        ]);
        const names = new Map(printers.map((p) => [p.id, p.name]));
        return jobsToCsv(
            rows.map((r) => this.withCost(r, ctx)),
            names,
            this.settings.get().currency,
        );
    }

    async compute(printerId?: string, days = 0): Promise<StatsDto> {
        const since = sinceDate(days);
        const [jobs, printerRows, ctx] = await Promise.all([
            this.prisma.client.printJob.findMany({
                where: { ...(printerId ? { printerId } : {}), ...(since ? { startedAt: { gte: since } } : {}) },
                include: { file: { select: { thumbnail: true, id: true, filaments: true } } },
                orderBy: { startedAt: 'asc' },
            }),
            this.prisma.client.printer.findMany({ select: { id: true, name: true } }),
            this.pricing(),
        ]);
        const { currency } = this.settings.get();
        const printerNames = new Map(printerRows.map((p) => [p.id, p.name]));
        const finished = jobs.filter((j) => j.status !== 'printing');
        const completed = finished.filter((j) => j.status === 'completed');
        const cancelled = finished.filter((j) => j.status === 'cancelled');
        const errored = finished.filter((j) => j.status === 'error');
        const inProgress = jobs.length - finished.length;
        const totalDuration = sum(finished, (j) => j.durationSec ?? 0);
        const completedDuration = sum(completed, (j) => j.durationSec ?? 0);
        const totalFilament = sum(finished, (j) => j.filamentMm);
        const estimated = completed.filter((j) => j.estimatedSec > 0 && (j.durationSec ?? 0) > 0);
        const estimatedSec = sum(estimated, (j) => j.estimatedSec);
        const estimatedActualSec = sum(estimated, (j) => j.durationSec ?? 0);

        const daily = new Map<string, StatsBucket>();
        if (since && days <= DAILY_MAX_DAYS) {
            for (let i = 0; i < days; i++) {
                const key = dayKey(new Date(since.getTime() + i * 86_400_000));
                daily.set(key, emptyBucket(key));
            }
        }
        const months = new Map<string, StatsBucket>();
        const weekdays = new Map<string, StatsBucket>();
        for (let i = 0; i < 7; i++) weekdays.set(String(i), emptyBucket(String(i)));
        const hours = new Map<string, StatsBucket>();
        for (let i = 0; i < 24; i++) hours.set(String(i), emptyBucket(String(i)));
        const printers = new Map<string, StatsPrinterEntry>();
        const files = new Map<string, StatsFileEntry>();
        const materials = new Map<string, { filamentMm: number; weightG: number; cost: number; jobs: number }>();
        const failures = new Map<string, number>();
        let totalFilamentG = 0;
        let filamentCost = 0;
        let energyCost = 0;
        let machineCost = 0;
        let unpricedG = 0;

        for (const j of finished) {
            const d = j.startedAt;
            const ok = j.status === 'completed';
            const dur = j.durationSec ?? 0;
            const priced = priceJob(j, ctx);
            const jobCost = priced.cost.total;
            const dk = dayKey(d);
            const db = daily.get(dk);
            if (db) bump(db, ok, dur, j.filamentMm, jobCost);
            const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const mb = months.get(mk) ?? emptyBucket(mk);
            bump(mb, ok, dur, j.filamentMm, jobCost);
            months.set(mk, mb);
            const wd = weekdays.get(String(d.getDay()));
            if (wd) bump(wd, ok, dur, j.filamentMm, jobCost);
            const hb = hours.get(String(d.getHours()));
            if (hb) bump(hb, ok, dur, j.filamentMm, jobCost);
            if (!ok) {
                const reason = j.failureReason || (j.status === 'error' ? 'error' : 'unlabeled');
                failures.set(reason, (failures.get(reason) ?? 0) + 1);
            }

            const pe = printers.get(j.printerId) ?? {
                printerId: j.printerId,
                name: printerNames.get(j.printerId) ?? j.printerId,
                jobs: 0,
                completed: 0,
                durationSec: 0,
                filamentMm: 0,
                weightG: 0,
                cost: 0,
            };
            pe.jobs += 1;
            if (ok) pe.completed += 1;
            pe.durationSec += dur;
            pe.filamentMm += j.filamentMm;
            pe.weightG += priced.weightG;
            pe.cost += jobCost;
            printers.set(j.printerId, pe);

            const fk = j.fileId ?? j.filename;
            const fe = files.get(fk) ?? {
                filename: j.filename,
                fileId: j.fileId,
                thumbnail: j.file?.thumbnail ?? null,
                jobs: 0,
                completed: 0,
                durationSec: 0,
                filamentMm: 0,
                cost: 0,
                lastPrintedAt: d.toISOString(),
            };
            fe.jobs += 1;
            if (ok) fe.completed += 1;
            fe.durationSec += dur;
            fe.filamentMm += j.filamentMm;
            fe.cost += jobCost;
            fe.lastPrintedAt = d.toISOString();
            files.set(fk, fe);

            const seen = new Set<string>();
            for (const u of priced.usage) {
                const me = materials.get(u.material) ?? { filamentMm: 0, weightG: 0, cost: 0, jobs: 0 };
                me.filamentMm += u.mm;
                me.weightG += u.weightG;
                me.cost += u.cost ?? 0;
                if (!seen.has(u.material)) {
                    me.jobs += 1;
                    seen.add(u.material);
                }
                materials.set(u.material, me);
            }
            totalFilamentG += priced.weightG;
            unpricedG += priced.unpricedG;
            filamentCost += priced.cost.filament;
            energyCost += priced.cost.energy;
            machineCost += priced.cost.machine;
        }

        const first = finished[0]?.startedAt ?? null;
        const last = finished[finished.length - 1]?.startedAt ?? null;
        return {
            totalJobs: finished.length,
            completed: completed.length,
            cancelled: cancelled.length,
            errored: errored.length,
            inProgress,
            successRate: finished.length ? completed.length / finished.length : 0,
            totalDurationSec: totalDuration,
            completedDurationSec: completedDuration,
            avgDurationSec: completed.length ? Math.round(completedDuration / completed.length) : 0,
            longestDurationSec: completed.length ? Math.max(...completed.map((j) => j.durationSec ?? 0)) : 0,
            estimatedDurationSec: estimatedSec,
            estimateRatio: estimatedSec > 0 ? estimatedActualSec / estimatedSec : null,
            totalFilamentMm: Math.round(totalFilament),
            totalFilamentG: Math.round(totalFilamentG),
            totalCost: round2(filamentCost + energyCost + machineCost),
            filamentCost: round2(filamentCost),
            energyCost: round2(energyCost),
            machineCost: round2(machineCost),
            unpricedG: Math.round(unpricedG),
            currency,
            firstJobAt: first?.toISOString() ?? null,
            lastJobAt: last?.toISOString() ?? null,
            daily: [...daily.values()].map(roundBucket),
            months: [...months.values()]
                .sort((a, b) => a.key.localeCompare(b.key))
                .slice(-12)
                .map(roundBucket),
            weekdays: [...weekdays.values()].map(roundBucket),
            hours: [...hours.values()].map(roundBucket),
            printers: [...printers.values()]
                .map((p) => ({
                    ...p,
                    filamentMm: Math.round(p.filamentMm),
                    weightG: Math.round(p.weightG),
                    cost: round2(p.cost),
                }))
                .sort((a, b) => b.durationSec - a.durationSec),
            topFiles: [...files.values()]
                .map((f) => ({ ...f, filamentMm: Math.round(f.filamentMm), cost: round2(f.cost) }))
                .sort((a, b) => b.jobs - a.jobs || b.durationSec - a.durationSec)
                .slice(0, 8),
            materials: [...materials.entries()]
                .map(([material, v]) => ({
                    material,
                    filamentMm: Math.round(v.filamentMm),
                    weightG: Math.round(v.weightG),
                    cost: round2(v.cost),
                    jobs: v.jobs,
                }))
                .sort((a, b) => b.filamentMm - a.filamentMm),
            failures: [...failures.entries()]
                .map(([reason, count]) => ({ reason, count }))
                .sort((a, b) => b.count - a.count),
        };
    }
}

function sinceDate(days: number): Date | undefined {
    return days > 0 ? startOfDay(new Date(Date.now() - (days - 1) * 86_400_000)) : undefined;
}

function sum<T>(rows: T[], pick: (row: T) => number): number {
    return rows.reduce((acc, row) => acc + pick(row), 0);
}

function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function emptyBucket(key: string): StatsBucket {
    return { key, jobs: 0, completed: 0, durationSec: 0, filamentMm: 0, cost: 0 };
}

function roundBucket(b: StatsBucket): StatsBucket {
    return { ...b, cost: round2(b.cost) };
}

function bump(b: StatsBucket, ok: boolean, durationSec: number, filamentMm: number, cost: number): void {
    b.jobs += 1;
    if (ok) b.completed += 1;
    b.durationSec += durationSec;
    b.filamentMm += filamentMm;
    b.cost += cost;
}
