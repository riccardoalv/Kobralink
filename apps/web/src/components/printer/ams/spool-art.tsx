import { useId } from 'react';
import { useSlotSpool } from '@/hooks/use-slot-spool';
import { cn } from '@/lib/utils';

export const SPOOL_LAYERS = 10;

const WIDTH = 96;
const HEIGHT = 96;
const FLANGE_W = 7;
const INNER_X = 4 + FLANGE_W;
const INNER_W = WIDTH - 2 * INNER_X;
const HUB_TOP = 42;
const HUB_BOTTOM = 54;
const PITCH = 4;
const LAYER_H = 3.3;
const FLANGE = '#2b2d31';
const FLANGE_EDGE = '#5a5e66';
const HUB = '#55585f';

export function spoolLayers(fraction: number): { full: number; partial: number } {
    const total = Math.min(1, Math.max(0, fraction)) * SPOOL_LAYERS;
    const full = Math.floor(total + 1e-9);
    return { full, partial: full >= SPOOL_LAYERS ? 0 : total - full };
}

function layerY(index: number, side: 'top' | 'bottom') {
    return side === 'top'
        ? HUB_TOP - (index + 1) * PITCH + (PITCH - LAYER_H) / 2
        : HUB_BOTTOM + index * PITCH + (PITCH - LAYER_H) / 2;
}

export function SpoolArt({
    color,
    fraction = 1,
    active,
    className,
}: {
    color?: string;
    fraction?: number;
    active?: boolean;
    className?: string;
}) {
    const id = useId().replace(/:/g, '');
    const { full, partial } = color ? spoolLayers(fraction) : { full: 0, partial: 0 };
    const layers = Array.from({ length: SPOOL_LAYERS }, (_, i) => i);

    const wound = (i: number, side: 'top' | 'bottom') => {
        const width = i < full ? INNER_W : i === full && partial > 0 ? INNER_W * partial : 0;
        const y = layerY(i, side);
        if (width === 0) {
            return (
                <rect
                    key={`${side}-${i}`}
                    data-layer="empty"
                    x={INNER_X + 0.5}
                    y={y}
                    width={INNER_W - 1}
                    height={LAYER_H}
                    rx={LAYER_H / 2}
                    fill="white"
                    fillOpacity="0.03"
                    stroke="white"
                    strokeOpacity="0.1"
                    strokeWidth="0.4"
                />
            );
        }
        return (
            <g key={`${side}-${i}`} data-layer={width < INNER_W ? 'partial' : 'full'}>
                <rect x={INNER_X} y={y} width={width} height={LAYER_H} rx={LAYER_H / 2} fill={color} />
                <rect x={INNER_X} y={y} width={width} height={LAYER_H} rx={LAYER_H / 2} fill={`url(#${id}-shade)`} />
            </g>
        );
    };

    return (
        <span className={cn('relative inline-flex shrink-0', className)}>
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" className="size-full overflow-visible">
                <defs>
                    <linearGradient id={`${id}-shade`} gradientUnits="userSpaceOnUse" x1="0" y1="2" x2="0" y2="94">
                        <stop offset="0" stopColor="black" stopOpacity="0.3" />
                        <stop offset="0.2" stopColor="white" stopOpacity="0.32" />
                        <stop offset="0.45" stopColor="white" stopOpacity="0" />
                        <stop offset="1" stopColor="black" stopOpacity="0.38" />
                    </linearGradient>
                </defs>

                <rect x={INNER_X} y={HUB_TOP} width={INNER_W} height={HUB_BOTTOM - HUB_TOP} fill={HUB} />
                <line
                    x1={INNER_X}
                    y1={(HUB_TOP + HUB_BOTTOM) / 2}
                    x2={INNER_X + INNER_W}
                    y2={(HUB_TOP + HUB_BOTTOM) / 2}
                    stroke="black"
                    strokeOpacity="0.35"
                    strokeWidth="2"
                />
                {layers.map((i) => wound(i, 'top'))}
                {layers.map((i) => wound(i, 'bottom'))}

                {[4, WIDTH - 4 - FLANGE_W].map((x) => (
                    <g key={x}>
                        <rect
                            x={x}
                            y={2}
                            width={FLANGE_W}
                            height={HEIGHT - 4}
                            rx={3}
                            fill={FLANGE}
                            stroke={active ? 'var(--primary)' : FLANGE_EDGE}
                            strokeWidth={active ? 1.6 : 1}
                        />
                        <rect
                            x={x + 1.5}
                            y={(HUB_TOP + HUB_BOTTOM) / 2 - 3}
                            width={FLANGE_W - 3}
                            height={6}
                            rx={1.5}
                            fill={HUB}
                        />
                    </g>
                ))}
            </svg>
        </span>
    );
}

export function SlotSpoolArt({
    printerId,
    slotKey,
    color,
    empty,
    active,
    showPercent,
    className,
}: {
    printerId: string;
    slotKey: string;
    color?: string;
    empty?: boolean;
    showPercent?: boolean;
    active?: boolean;
    className?: string;
}) {
    const spool = useSlotSpool(printerId, slotKey);
    const fill = empty ? undefined : (color ?? spool.hex);
    return (
        <span className="flex flex-col items-center gap-1">
            <SpoolArt color={fill} fraction={spool.fraction ?? 1} active={active} className={className} />
            {showPercent && <SpoolPercent fraction={fill ? spool.fraction : undefined} />}
        </span>
    );
}

export function SpoolPercent({ fraction }: { fraction?: number }) {
    if (fraction === undefined) return null;
    return (
        <span className="text-xs font-medium tabular-nums text-muted-foreground">{Math.round(fraction * 100)}%</span>
    );
}
