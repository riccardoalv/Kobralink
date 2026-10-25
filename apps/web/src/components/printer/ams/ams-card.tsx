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
import { SlotSpool, SpoolTileBody } from './spool-art';

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
                                    className={TILE}
                                    title={empty ? m.ams_slot_empty() : m.ams_slot_edit({ type: s.type })}
                                >
                                    <SlotSpool
                                        printerId={printerId}
                                        slotKey={String(s.globalIndex)}
                                        color={rgbCss(s.color)}
                                        empty={empty}
                                        className={cn(
                                            (s.activity === 'feeding' || s.activity === 'retracting') &&
                                                'animate-pulse',
                                        )}
                                    >
                                        <TileHeader
                                            title={
                                                empty ? m.ams_empty() : activity && !isLoaded ? activity : s.type || '?'
                                            }
                                            badge={s.index + 1}
                                        />
                                    </SlotSpool>
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
                className={TILE}
                title={m.ams_external_spool()}
            >
                <SpoolTileBody color={hex} fraction={hex ? fraction : undefined}>
                    <TileHeader title={material ?? m.ams_external_spool_empty()} badge="E" />
                </SpoolTileBody>
            </button>
        </div>
    );
}

const TILE =
    'flex w-56 cursor-pointer items-center gap-3 rounded-2xl bg-secondary p-2.5 text-left outline-none transition-colors enabled:hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60';

function TileHeader({ title, badge }: { title: string; badge: React.ReactNode }) {
    return (
        <span className="flex w-full items-center justify-between gap-2 text-xs">
            <span className="truncate font-medium">{title}</span>
            <span className="shrink-0 text-muted-foreground">{badge}</span>
        </span>
    );
}
