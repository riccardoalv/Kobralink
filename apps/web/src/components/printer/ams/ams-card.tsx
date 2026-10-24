import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLiveState } from '@/hooks/use-printers';
import { useExternalSpool } from '@/hooks/use-slot-spool';
import { rgbCss } from '@/lib/color';
import { m } from '@/lib/i18n';
import { AMS_ACTIVITY_LABEL, FILAMENT_MODE_LABEL } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { confirmationDialogStore } from '@/stores/confirmation-dialog';
import { AceControls } from './ace-controls';
import { ExternalSpoolForm } from './external-spool-form';
import { SlotForm } from './slot-form';
import { SlotSpoolArt, SpoolArt } from './spool-art';

export function AmsCard({ printerId }: { printerId: string }) {
    const state = useLiveState(printerId);
    const slots = [...state.amsSlots].sort((a, b) => a.globalIndex - b.globalIndex);
    const loaded = slots.find((s) => s.globalIndex === state.amsLoadedSlot);
    const openDialog = confirmationDialogStore.actions.openDialog;
    const offline = !state.connected;
    const busy = state.printState === 'printing';

    return (
        <Card className="rounded-3xl border-0 shadow-none">
            <CardHeader>
                <CardTitle className="text-lg font-medium">{m.ams_title()}</CardTitle>
                <CardDescription>{FILAMENT_MODE_LABEL[state.filamentMode]?.()}</CardDescription>
                <CardAction className="text-sm text-muted-foreground">
                    {loaded
                        ? m.ams_loaded_type({ type: loaded.type || '?' })
                        : state.externalSpoolOnly
                          ? null
                          : m.ams_none_loaded()}
                </CardAction>
            </CardHeader>
            <CardContent className="space-y-5">
                {slots.length === 0 ? (
                    state.externalSpoolOnly ? (
                        <ExternalSpoolSlot printerId={printerId} disabled={offline} />
                    ) : (
                        <p className="text-sm text-muted-foreground">{m.ams_no_slots()}</p>
                    )
                ) : (
                    <div className="flex flex-wrap gap-3">
                        {slots.map((s) => {
                            const isLoaded = s.globalIndex === state.amsLoadedSlot;
                            const empty = s.status !== 5 && !s.type;
                            const activity = AMS_ACTIVITY_LABEL[s.activity]?.();
                            return (
                                <button
                                    type="button"
                                    key={s.globalIndex}
                                    disabled={offline}
                                    onClick={() =>
                                        openDialog({
                                            title: m.ams_slot_title({
                                                n: s.index + 1,
                                                unit: s.boxId >= 0 ? m.ace_unit({ n: s.boxId + 1 }) : m.ams_toolhead(),
                                            }),
                                            description: m.ams_slot_hint(),
                                            content: <SlotForm key={s.globalIndex} printerId={printerId} slot={s} />,
                                        })
                                    }
                                    className="group flex w-16 cursor-pointer flex-col items-center gap-1.5 rounded-2xl outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                                    title={empty ? m.ams_slot_empty() : m.ams_slot_edit({ type: s.type })}
                                >
                                    <span className="relative transition-transform group-enabled:group-hover:scale-105">
                                        <SlotSpoolArt
                                            printerId={printerId}
                                            slotKey={String(s.globalIndex)}
                                            color={rgbCss(s.color)}
                                            empty={empty}
                                            active={isLoaded}
                                            className={cn(
                                                'size-16',
                                                (s.activity === 'feeding' || s.activity === 'retracting') &&
                                                    'animate-pulse',
                                            )}
                                        />
                                        <SlotBadge>{s.index + 1}</SlotBadge>
                                    </span>
                                    <div className="w-full truncate text-center text-xs text-muted-foreground">
                                        {empty ? m.ams_empty() : activity && !isLoaded ? activity : s.type || '?'}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {state.aceUnits.length > 0 && (
                    <AceControls printerId={printerId} units={state.aceUnits} disabled={offline} busy={busy} />
                )}
            </CardContent>
        </Card>
    );
}

function ExternalSpoolSlot({ printerId, disabled }: { printerId: string; disabled: boolean }) {
    const { hex, material, fraction } = useExternalSpool(printerId);
    const openDialog = confirmationDialogStore.actions.openDialog;

    return (
        <div className="flex flex-wrap gap-3">
            <button
                type="button"
                disabled={disabled}
                onClick={() =>
                    openDialog({
                        title: m.ams_external_spool(),
                        description: m.ams_external_spool_hint(),
                        content: <ExternalSpoolForm printerId={printerId} />,
                    })
                }
                className="group flex w-16 cursor-pointer flex-col items-center gap-1.5 rounded-2xl outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                title={m.ams_external_spool()}
            >
                <span className="relative transition-transform group-enabled:group-hover:scale-105">
                    <SpoolArt color={hex} fraction={fraction ?? 1} active={Boolean(hex)} className="size-16" />
                    <SlotBadge>E</SlotBadge>
                </span>
                <div className="w-full truncate text-center text-xs text-muted-foreground">
                    {material ?? m.ams_external_spool_empty()}
                </div>
            </button>
        </div>
    );
}

function SlotBadge({ children }: { children: React.ReactNode }) {
    return (
        <span className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full bg-secondary text-[0.6875rem] font-semibold text-secondary-foreground ring-2 ring-card">
            {children}
        </span>
    );
}
