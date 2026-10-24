import { useQuery } from '@tanstack/react-query';
import { EXTERNAL_SLOT } from '@/components/printer/ams/external-spool-form';
import { spoolAssignmentsQuery, spoolmanSpoolsQuery, spoolmanStatusQuery, spoolsQuery } from '@/lib/queries';

export interface ExternalSpool {
    hex?: string;
    material?: string;
    name?: string;
    remainingG?: number;
}

export function useExternalSpool(printerId: string): ExternalSpool {
    const spoolman = useQuery(spoolmanStatusQuery(printerId));
    const spools = useQuery(spoolmanSpoolsQuery(Boolean(spoolman.data?.configured)));
    const localSpools = useQuery(spoolsQuery());
    const localAssign = useQuery(spoolAssignmentsQuery(printerId));
    const spoolmanSpool = spools.data?.find((sp) => sp.id === spoolman.data?.slotSpools[EXTERNAL_SLOT]);
    const localSpool = localSpools.data?.find((sp) => sp.id === localAssign.data?.slotSpools[EXTERNAL_SLOT]);
    if (spoolmanSpool) {
        const { filament } = spoolmanSpool;
        return {
            hex: filament.color_hex ? `#${filament.color_hex.replace(/^#/, '')}` : undefined,
            material: filament.material,
            name: [filament.vendor?.name, filament.name].filter(Boolean).join(' ') || undefined,
            remainingG: spoolmanSpool.remaining_weight,
        };
    }
    if (localSpool) {
        return {
            hex: localSpool.colorHex,
            material: localSpool.material,
            name: [localSpool.vendor, localSpool.name].filter(Boolean).join(' ') || undefined,
            remainingG: localSpool.remainingG,
        };
    }
    return {};
}
