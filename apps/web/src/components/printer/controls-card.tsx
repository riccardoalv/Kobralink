import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fan, Feather, Gauge, Lightbulb, LightbulbOff, Plug, PlugZap, Sun, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { useLiveState, usePrinter } from '@/hooks/use-printers';
import { api } from '@/lib/api';
import { m } from '@/lib/i18n';
import { powerStatusQuery } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { printersStore } from '@/stores/printers';

const SPEED_MODES = [
    { value: 1, label: m.controls_speed_quiet, icon: <Feather /> },
    { value: 2, label: m.controls_speed_standard, icon: <Gauge /> },
    { value: 3, label: m.controls_speed_fast, icon: <Zap /> },
];

export function ControlsCard({ printerId }: { printerId: string }) {
    const state = useLiveState(printerId);
    const offline = !state.connected;
    const busy = state.printState === 'printing';
    const patchLiveState = printersStore.actions.patchLiveState;
    const qc = useQueryClient();
    const printer = usePrinter(printerId);
    const powerConfigured = Boolean(printer?.settings.powerOnUrl || printer?.settings.powerOffUrl);
    const power = useQuery(powerStatusQuery(printerId, powerConfigured));
    const powerMut = useMutation({
        mutationFn: (action: 'on' | 'off') => api.printers.power(printerId, action),
        onSuccess: (r) => {
            toast.success(r.state === 'on' ? m.controls_power_on_toast() : m.controls_power_off_toast());
            void qc.invalidateQueries({ queryKey: ['printers', printerId, 'power'] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const onError = (e: Error) => toast.error(e.message);
    const fanMut = useMutation({ mutationFn: (speed: number) => api.control.fan(printerId, { speed }), onError });
    const lightMut = useMutation({
        mutationFn: (input: { on: boolean; brightness?: number }) => api.control.light(printerId, input),
        onError,
    });
    const speedMut = useMutation({ mutationFn: (mode: number) => api.control.speed(printerId, { mode }), onError });

    const powerOn = power.data?.state === 'on' || (power.data?.state === 'unknown' && state.connected);
    const powerStatus = power.isError
        ? m.controls_plug_unreachable()
        : power.data?.state === 'unknown'
          ? m.controls_plug_unknown()
          : power.data?.state === 'on'
            ? m.controls_plug_on()
            : m.controls_plug_off();

    return (
        <Card className="rounded-3xl border-0 shadow-none">
            <CardHeader>
                <CardTitle className="text-lg font-medium">{m.controls_title()}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-evenly gap-5">
                <div className={cn('grid gap-3', powerConfigured ? 'grid-cols-2' : 'grid-cols-1')}>
                    <Tile
                        icon={state.lightOn ? <Lightbulb /> : <LightbulbOff />}
                        label={m.controls_light()}
                        status={state.lightOn ? `${m.controls_on()} · ${state.lightBrightness} %` : m.controls_off()}
                        pressed={state.lightOn}
                        disabled={offline || lightMut.isPending}
                        onClick={() => lightMut.mutate({ on: !state.lightOn })}
                    />
                    {powerConfigured && (
                        <Tile
                            icon={powerOn ? <PlugZap /> : <Plug />}
                            label={m.controls_power()}
                            status={busy ? `${powerStatus} · ${m.controls_locked_printing()}` : powerStatus}
                            pressed={powerOn}
                            disabled={powerMut.isPending || busy}
                            onClick={() => powerMut.mutate(powerOn ? 'off' : 'on')}
                        />
                    )}
                </div>
                {state.lightOn && (
                    <Section icon={<Sun />} label={m.controls_brightness()} value={`${state.lightBrightness} %`}>
                        <Slider
                            value={[state.lightBrightness]}
                            min={5}
                            max={100}
                            step={5}
                            disabled={offline}
                            onValueChange={([v]) => patchLiveState(printerId, { lightBrightness: v })}
                            onValueCommit={([v]) => lightMut.mutate({ on: true, brightness: v })}
                        />
                    </Section>
                )}
                <Section
                    icon={
                        <Fan
                            className={cn(state.fanSpeed > 0 && 'animate-spin')}
                            style={{ animationDuration: `${Math.max(0.6, 3 - state.fanSpeed / 40)}s` }}
                        />
                    }
                    label={m.controls_part_fan()}
                    value={`${state.fanSpeed} %`}
                >
                    <Slider
                        value={[state.fanSpeed]}
                        min={0}
                        max={100}
                        step={5}
                        disabled={offline}
                        onValueChange={([v]) => patchLiveState(printerId, { fanSpeed: v })}
                        onValueCommit={([v]) => fanMut.mutate(v)}
                    />
                </Section>
                <Section icon={<Gauge />} label={m.controls_speed()} value={busy ? '' : m.controls_speed_hint()}>
                    <div className="flex gap-1 rounded-full bg-secondary p-1">
                        {SPEED_MODES.map((mode) => (
                            <button
                                key={mode.value}
                                type="button"
                                aria-pressed={state.printSpeedMode === mode.value}
                                disabled={offline || !busy}
                                onClick={() => speedMut.mutate(mode.value)}
                                className={cn(
                                    'flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 [&_svg]:size-3.5',
                                    state.printSpeedMode === mode.value
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {mode.icon}
                                {mode.label()}
                            </button>
                        ))}
                    </div>
                </Section>
            </CardContent>
        </Card>
    );
}

function Tile({
    icon,
    label,
    status,
    pressed,
    ...props
}: React.ComponentProps<'button'> & { icon: React.ReactNode; label: string; status: string; pressed: boolean }) {
    return (
        <button
            type="button"
            aria-pressed={pressed}
            {...props}
            className={cn(
                'flex items-center gap-3 rounded-2xl p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                pressed ? 'bg-primary/10 hover:bg-primary/15' : 'bg-secondary hover:bg-accent',
            )}
        >
            <span
                className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-full transition-colors [&_svg]:size-5',
                    pressed ? 'bg-primary text-primary-foreground' : 'bg-background/60 text-muted-foreground',
                )}
            >
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{label}</span>
                <span className={cn('block truncate text-xs', pressed ? 'text-primary' : 'text-muted-foreground')}>
                    {status}
                </span>
            </span>
        </button>
    );
}

function Section({
    icon,
    label,
    value,
    children,
}: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2.5 text-sm">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground [&_svg]:size-4">
                        {icon}
                    </span>
                    {label}
                </span>
                <span className="text-sm text-muted-foreground tabular-nums">{value}</span>
            </div>
            {children}
        </div>
    );
}
