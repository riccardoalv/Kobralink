import type { PrinterLiveState } from '@kobralink/shared';
import { Link } from '@tanstack/react-router';
import {
    Ban,
    Clock,
    Fan,
    Flame,
    Heater,
    Layers,
    Lightbulb,
    LightbulbOff,
    Pause,
    Play,
    Printer,
    RefreshCw,
    Settings,
    Video,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { SpoolIcon } from '@/components/printer/ams/spool-icon';
import { StatusBadge } from '@/components/printer/status-badge';
import { useExternalSpool } from '@/hooks/use-external-spool';
import { api, type PrinterWithLive } from '@/lib/api';
import { rgbCss } from '@/lib/color';
import { parseFilename } from '@/lib/filename';
import { formatClock, formatDuration } from '@/lib/format';
import { m } from '@/lib/i18n';
import { connectionErrorText } from '@/lib/labels';
import { cn } from '@/lib/utils';

const SNAPSHOT_INTERVAL_MS = 10_000;

export interface PrinterCardActions {
    onPause: () => void;
    onResume: () => void;
    onCancel: () => void;
    onReconnect: () => void;
    onLight: (on: boolean) => void;
}

export function PrinterCard({
    printer,
    canOperate,
    ...actions
}: { printer: PrinterWithLive; canOperate: boolean } & PrinterCardActions) {
    const live = printer.live;
    const printing = live?.printState === 'printing' || live?.printState === 'paused';
    const job = printing && live ? parseFilename(live.filename) : null;

    return (
        <article
            className={cn(
                'flex flex-col overflow-hidden rounded-3xl bg-card text-card-foreground',
                printing && 'ring-2 ring-primary/70',
            )}
        >
            <Link
                to="/printers/$printerId"
                params={{ printerId: printer.id }}
                aria-label={`${m.common_open()} ${printer.name}`}
                className={cn(
                    'relative block bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                    printing ? 'aspect-video' : 'h-28',
                )}
            >
                <CardMedia printerId={printer.id} live={live} printing={printing} />
                {live && (
                    <StatusBadge
                        state={live}
                        className="absolute left-3 top-3 bg-background/75 text-foreground backdrop-blur-sm"
                    />
                )}
                {printing && live && (
                    <div className="absolute inset-x-0 bottom-0 h-1.5 bg-background/50">
                        <div
                            className="h-full bg-primary transition-[width] duration-500"
                            style={{ width: `${Math.round(live.progress * 100)}%` }}
                        />
                    </div>
                )}
            </Link>

            <div className="flex flex-1 flex-col gap-4 p-5">
                <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="truncate text-lg font-medium">
                            <Link
                                to="/printers/$printerId"
                                params={{ printerId: printer.id }}
                                className="rounded-md outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {printer.name}
                            </Link>
                        </h2>
                        <p className="truncate text-sm text-muted-foreground">
                            {printer.model} · {printer.ip}
                        </p>
                    </div>
                    {printing && live && (
                        <span className="text-2xl font-semibold tabular-nums text-primary">
                            {Math.round(live.progress * 100)}%
                        </span>
                    )}
                </header>

                {job && live && (
                    <div className="space-y-1.5">
                        <p className="truncate font-medium" title={live.filename}>
                            {job.name}
                            {job.plate !== null && (
                                <span className="font-normal text-muted-foreground">
                                    , {m.files_plate({ n: job.plate })}
                                </span>
                            )}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <Meta icon={<Clock />}>
                                {m.printers_remaining({ duration: formatDuration(live.remainTimeSec) })}
                            </Meta>
                            {live.totalLayers > 0 && (
                                <Meta icon={<Layers />}>
                                    {m.preview_layer({ n: live.currLayer, total: live.totalLayers })}
                                </Meta>
                            )}
                            {live.remainTimeSec > 0 && (
                                <span>
                                    {m.printers_eta({ time: formatClock(Date.now() + live.remainTimeSec * 1000) })}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {live?.connectionError && (
                    <p className="text-sm text-destructive">{connectionErrorText(live.connectionError)}</p>
                )}

                {live && (
                    <dl className="grid grid-cols-3 gap-2">
                        <Stat
                            icon={<Flame />}
                            label={m.activity_nozzle()}
                            value={live.nozzleTemp}
                            target={live.nozzleTarget}
                        />
                        <Stat icon={<Heater />} label={m.activity_bed()} value={live.bedTemp} target={live.bedTarget} />
                        <div className="rounded-2xl bg-secondary px-3 py-2.5">
                            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
                                <Fan className={cn(live.fanSpeed > 0 && printing && 'animate-spin')} />
                                {m.activity_fan()}
                            </dt>
                            <dd className="mt-0.5 font-medium tabular-nums">{Math.round(live.fanSpeed)}%</dd>
                        </div>
                    </dl>
                )}

                {live && <Filament printerId={printer.id} live={live} />}

                <footer className="mt-auto flex items-center justify-end gap-1.5 pt-1">
                    {printing && live && canOperate && (
                        <>
                            {live.printState === 'printing' ? (
                                <IconButton label={m.common_pause()} onClick={actions.onPause}>
                                    <Pause />
                                </IconButton>
                            ) : (
                                <IconButton label={m.common_resume()} onClick={actions.onResume}>
                                    <Play />
                                </IconButton>
                            )}
                            <IconButton label={m.common_cancel()} onClick={actions.onCancel} destructive>
                                <Ban />
                            </IconButton>
                        </>
                    )}
                    {live?.connected && canOperate && (
                        <IconButton
                            label={live.lightOn ? m.printers_light_off() : m.printers_light_on()}
                            onClick={() => actions.onLight(!live.lightOn)}
                            pressed={live.lightOn}
                        >
                            {live.lightOn ? <Lightbulb /> : <LightbulbOff />}
                        </IconButton>
                    )}
                    <IconButton label={m.printers_reconnect()} onClick={actions.onReconnect}>
                        <RefreshCw />
                    </IconButton>
                    <Link
                        to="/printers/$printerId/settings"
                        params={{ printerId: printer.id }}
                        title={m.common_settings()}
                        aria-label={m.common_settings()}
                        className="flex size-9 items-center justify-center rounded-full bg-secondary outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4"
                    >
                        <Settings />
                    </Link>
                </footer>
            </div>
        </article>
    );
}

function CardMedia({
    printerId,
    live,
    printing,
}: {
    printerId: string;
    live: PrinterLiveState | null;
    printing: boolean;
}) {
    const camera = printing && Boolean(live?.cameraUrl);
    const [tick, setTick] = useState(() => Date.now());
    const [failed, setFailed] = useState(false);
    const cameraUrl = live?.cameraUrl;

    useEffect(() => {
        if (!cameraUrl) return;
        setFailed(false);
    }, [cameraUrl]);

    useEffect(() => {
        if (!camera || failed) return;
        const id = setInterval(() => {
            if (document.visibilityState === 'visible') setTick(Date.now());
        }, SNAPSHOT_INTERVAL_MS);
        return () => clearInterval(id);
    }, [camera, failed]);

    if (camera && !failed) {
        return (
            <>
                <img
                    src={`${api.camera.snapshotUrl(printerId)}?t=${tick}`}
                    alt={m.camera_alt()}
                    onError={() => setFailed(true)}
                    className="size-full object-cover"
                />
                <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-background/75 px-2.5 py-1 text-xs text-foreground backdrop-blur-sm [&_svg]:size-3.5">
                    <Video />
                    {m.camera_title()}
                </span>
            </>
        );
    }
    if (printing && live?.thumbnail) {
        return <img src={`data:image/png;base64,${live.thumbnail}`} alt="" className="size-full object-contain p-4" />;
    }
    return (
        <div className="flex size-full items-center justify-center">
            <Printer className="size-10 text-muted-foreground/60" />
        </div>
    );
}

function Filament({ printerId, live }: { printerId: string; live: PrinterLiveState }) {
    const slots = [...live.amsSlots].sort((a, b) => a.globalIndex - b.globalIndex);
    if (slots.length > 0) {
        const loaded = slots.find((s) => s.globalIndex === live.amsLoadedSlot);
        return (
            <div className="flex items-center gap-3 text-sm">
                <div className="flex gap-1.5">
                    {slots.map((s) => {
                        const empty = s.status !== 5 && !s.type;
                        return (
                            <span key={s.globalIndex} title={empty ? m.ams_slot_empty() : s.type}>
                                <SpoolIcon
                                    color={empty ? undefined : rgbCss(s.color)}
                                    active={s.globalIndex === live.amsLoadedSlot}
                                    className="size-9"
                                />
                            </span>
                        );
                    })}
                </div>
                <span className="truncate text-muted-foreground">
                    {loaded ? m.ams_loaded_type({ type: loaded.type || '?' }) : m.ams_none_loaded()}
                </span>
            </div>
        );
    }
    if (live.externalSpoolOnly) return <ExternalSpoolLine printerId={printerId} />;
    return null;
}

function ExternalSpoolLine({ printerId }: { printerId: string }) {
    const spool = useExternalSpool(printerId);
    return (
        <div className="flex items-center gap-3 text-sm">
            <SpoolIcon color={spool.hex} className="size-9" />
            {spool.material ? (
                <span className="min-w-0 truncate">
                    <span className="font-medium">{spool.material}</span>
                    {spool.name && <span className="text-muted-foreground">, {spool.name}</span>}
                </span>
            ) : (
                <span className="text-muted-foreground">{m.printers_no_spool()}</span>
            )}
            {spool.remainingG !== undefined && (
                <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                    {m.printers_spool_left({ g: Math.round(spool.remainingG) })}
                </span>
            )}
        </div>
    );
}

function Stat({ icon, label, value, target }: { icon: React.ReactNode; label: string; value: number; target: number }) {
    const heating = target > 0;
    return (
        <div className="rounded-2xl bg-secondary px-3 py-2.5">
            <dt
                className={cn(
                    'flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5',
                    heating && '[&_svg]:text-primary',
                )}
            >
                {icon}
                {label}
            </dt>
            <dd className="mt-0.5 font-medium tabular-nums">
                {Math.round(value)}°
                {heating && <span className="font-normal text-muted-foreground"> / {Math.round(target)}°</span>}
            </dd>
        </div>
    );
}

function Meta({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1.5 [&_svg]:size-3.5">
            {icon}
            {children}
        </span>
    );
}

function IconButton({
    label,
    destructive,
    pressed,
    className,
    ...props
}: React.ComponentProps<'button'> & { label: string; destructive?: boolean; pressed?: boolean }) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={pressed}
            {...props}
            className={cn(
                'flex size-9 items-center justify-center rounded-full bg-secondary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4',
                destructive ? 'hover:bg-destructive hover:text-white' : 'hover:bg-accent',
                pressed && 'text-primary',
                className,
            )}
        />
    );
}
