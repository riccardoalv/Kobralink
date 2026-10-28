import {
    type CostSettings,
    DEFAULT_DENSITY,
    filamentWeightG,
    type JobCost,
    jobCost,
    type SpoolUsageEntry,
} from '@kobralink/shared';
import { jobMaterial } from './job-material';

export type PricedSpool = {
    diameterMm: number;
    densityGcm3: number;
    material: string;
    price: number;
    initialWeightG: number;
};

export interface PricingContext {
    spools: ReadonlyMap<string, PricedSpool>;
    filamentPricePerKg: number;
    costs: CostSettings;
}

export interface PricedUsage {
    mm: number;
    material: string;
    weightG: number;
    cost: number | null;
}

export interface PricedJob {
    usage: PricedUsage[];
    weightG: number;
    unpricedG: number;
    filamentCost: number;
    cost: JobCost;
}

export interface JobLike {
    status: string;
    durationSec: number | null;
    filamentMm: number;
    spoolUsage: string;
    filename: string;
    file?: { filaments?: string } | null;
}

export function parseUsage(raw: string): SpoolUsageEntry[] {
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
}

export function priceJob(job: JobLike, ctx: PricingContext): PricedJob {
    const usage = parseUsage(job.spoolUsage);
    const entries = usage.length
        ? usage
        : job.filamentMm > 0
          ? [{ slotIndex: 0, mm: job.filamentMm, material: '', spoolId: null }]
          : [];
    const fileMaterial = jobMaterial(job.file?.filaments, job.filename);
    const priced = entries.map((u): PricedUsage => {
        const spool = u.spoolId ? ctx.spools.get(String(u.spoolId)) : undefined;
        const material = (u.material || spool?.material || fileMaterial).toUpperCase();
        const weightG = filamentWeightG(
            u.mm,
            spool?.diameterMm ?? 1.75,
            spool?.densityGcm3 ?? DEFAULT_DENSITY[material.split('-')[0]] ?? 1.24,
        );
        const perG =
            spool && spool.price > 0 && spool.initialWeightG > 0
                ? spool.price / spool.initialWeightG
                : ctx.filamentPricePerKg > 0
                  ? ctx.filamentPricePerKg / 1000
                  : null;
        return { mm: u.mm, material, weightG, cost: perG === null ? null : weightG * perG };
    });
    const filamentCost = priced.reduce((acc, u) => acc + (u.cost ?? 0), 0);
    return {
        usage: priced,
        weightG: priced.reduce((acc, u) => acc + u.weightG, 0),
        unpricedG: priced.reduce((acc, u) => acc + (u.cost === null ? u.weightG : 0), 0),
        filamentCost,
        cost: jobCost(job.durationSec ?? 0, filamentCost, ctx.costs),
    };
}

export function hasAnyPricing(ctx: PricingContext): boolean {
    const c = ctx.costs;
    return (
        ctx.filamentPricePerKg > 0 ||
        c.hourlyRate > 0 ||
        (c.energyPricePerKwh > 0 && c.printerPowerW > 0) ||
        [...ctx.spools.values()].some((s) => s.price > 0)
    );
}
