import type { CostSettings } from './settings';

export interface JobCost {
    filament: number;
    energy: number;
    machine: number;
    total: number;
}

export function round2(v: number): number {
    return Math.round(v * 100) / 100;
}

export function jobCost(durationSec: number, filamentCost: number, costs: CostSettings): JobCost {
    const hours = Math.max(0, durationSec) / 3600;
    const energy = (costs.printerPowerW / 1000) * hours * costs.energyPricePerKwh;
    const machine = hours * costs.hourlyRate;
    const filament = Math.max(0, filamentCost);
    return {
        filament: round2(filament),
        energy: round2(energy),
        machine: round2(machine),
        total: round2(filament + energy + machine),
    };
}
