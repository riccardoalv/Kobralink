import { depreciationPerHour, type PrinterProfile, printerSpecs } from '@farolprint/shared';
import { TagsInput } from '@/components/form/tags-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatMoney } from '@/lib/format';
import { m } from '@/lib/i18n';

const COMMON_NOZZLES = [0.2, 0.25, 0.4, 0.6, 0.8, 1];
const NO_NOZZLE = 'none';

export function nozzleChoices(modeId: string | null | undefined, current: number | null): number[] {
    const official = printerSpecs(modeId)?.nozzleSizesMm ?? [];
    const base = official.length ? official : COMMON_NOZZLES;
    return [...new Set(current === null ? base : [...base, current])].sort((a, b) => a - b);
}

function numberOrNull(raw: string): number | null {
    if (raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

function NumberField({
    id,
    label,
    hint,
    value,
    onChange,
    step,
}: {
    id: string;
    label: string;
    hint?: string;
    value: number | null;
    onChange: (v: number | null) => void;
    step: number;
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                type="number"
                min={0}
                step={step}
                value={value ?? ''}
                onChange={(e) => onChange(numberOrNull(e.target.value))}
                className="rounded-full px-4"
            />
            {hint && <p className="px-4 text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}

export function ProfileFields({
    value,
    onChange,
    modeId,
    currency,
}: {
    value: PrinterProfile;
    onChange: (next: PrinterProfile) => void;
    modeId: string | null | undefined;
    currency: string;
}) {
    const set = <K extends keyof PrinterProfile>(key: K, v: PrinterProfile[K]) => onChange({ ...value, [key]: v });
    const perHour = depreciationPerHour(value);
    return (
        <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
                <Label htmlFor="profile-location">{m.profile_location()}</Label>
                <Input
                    id="profile-location"
                    value={value.location}
                    maxLength={64}
                    placeholder={m.profile_location_placeholder()}
                    onChange={(e) => set('location', e.target.value)}
                    className="rounded-full px-4"
                />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="profile-nozzle">{m.profile_nozzle()}</Label>
                <Select
                    value={value.nozzleMm === null ? NO_NOZZLE : String(value.nozzleMm)}
                    onValueChange={(v) => set('nozzleMm', v === NO_NOZZLE ? null : Number(v))}
                >
                    <SelectTrigger id="profile-nozzle" className="w-full rounded-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NO_NOZZLE}>{m.profile_nozzle_unknown()}</SelectItem>
                        {nozzleChoices(modeId, value.nozzleMm).map((n) => (
                            <SelectItem key={n} value={String(n)}>
                                {n} mm
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className="px-4 text-xs text-muted-foreground">{m.profile_nozzle_hint()}</p>
            </div>
            <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="profile-tags">{m.profile_tags()}</Label>
                <TagsInput id="profile-tags" value={value.tags} onChange={(tags) => set('tags', tags)} />
                <p className="px-4 text-xs text-muted-foreground">{m.profile_tags_hint()}</p>
            </div>
            <div className="md:col-span-2">
                <NumberField
                    id="profile-power"
                    label={m.profile_power()}
                    hint={m.profile_power_hint()}
                    value={value.powerW}
                    onChange={(v) => set('powerW', v)}
                    step={5}
                />
            </div>
            <NumberField
                id="profile-price"
                label={m.profile_purchase_price({ currency })}
                value={value.purchasePrice}
                onChange={(v) => set('purchasePrice', v)}
                step={1}
            />
            <NumberField
                id="profile-lifespan"
                label={m.profile_lifespan()}
                value={value.lifespanHours}
                onChange={(v) => set('lifespanHours', v === null ? null : Math.round(v))}
                step={100}
            />
            {perHour > 0 && (
                <p className="px-4 text-xs text-muted-foreground md:col-span-2">
                    {m.profile_depreciation({ value: formatMoney(perHour, currency) })}
                </p>
            )}
        </div>
    );
}
