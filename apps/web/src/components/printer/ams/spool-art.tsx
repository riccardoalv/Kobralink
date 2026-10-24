import { useId } from 'react';
import { useSlotSpool } from '@/hooks/use-slot-spool';
import { isDark } from '@/lib/color';
import { cn } from '@/lib/utils';

const FLANGE = '#6b707a';
const FLANGE_EDGE = '#a3a8b1';
const HUB = '#8a8f99';

export function SpoolArt({ color, label, className }: { color?: string; label?: string; className?: string }) {
    const id = useId().replace(/:/g, '');
    const dark = color ? isDark(color) : false;
    const text = label?.slice(0, 6).toUpperCase();

    return (
        <span className={cn('relative inline-flex shrink-0', className)}>
            <svg viewBox="0 0 96 96" aria-hidden="true" className="size-full">
                <defs>
                    <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="white" stopOpacity="0.35" />
                        <stop offset="0.4" stopColor="white" stopOpacity="0" />
                        <stop offset="1" stopColor="black" stopOpacity="0.35" />
                    </linearGradient>
                </defs>
                {color ? (
                    <>
                        <rect x="12" y="14" width="72" height="68" fill={color} />
                        <rect x="12" y="14" width="72" height="68" fill={`url(#${id}-shade)`} />
                        <rect
                            x="12"
                            y="14"
                            width="72"
                            height="68"
                            fill="none"
                            stroke={dark ? 'white' : 'black'}
                            strokeOpacity="0.25"
                            strokeWidth="1"
                        />
                        {text && (
                            <text
                                x="48"
                                y="49"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize="15"
                                fontWeight="600"
                                letterSpacing="0.5"
                                fill={dark ? 'white' : '#111'}
                                fillOpacity="0.9"
                            >
                                {text}
                            </text>
                        )}
                    </>
                ) : (
                    <>
                        <rect x="12" y="40" width="72" height="16" fill={HUB} />
                        <rect
                            x="13"
                            y="15"
                            width="70"
                            height="66"
                            fill="none"
                            stroke={FLANGE_EDGE}
                            strokeOpacity="0.5"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                        />
                    </>
                )}
                {[4, 84].map((x) => (
                    <rect
                        key={x}
                        x={x}
                        y="4"
                        width="8"
                        height="88"
                        rx="3"
                        fill={FLANGE}
                        stroke={FLANGE_EDGE}
                        strokeWidth="1"
                    />
                ))}
            </svg>
        </span>
    );
}

export function SpoolProgress({
    fraction,
    color,
    className,
}: {
    fraction?: number;
    color?: string;
    className?: string;
}) {
    if (fraction === undefined) return null;
    const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
    return (
        <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className={cn('h-2 w-full overflow-hidden rounded-full bg-muted-foreground/25', className)}
        >
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%`, background: color }} />
        </div>
    );
}

export function SlotSpool({
    printerId,
    slotKey,
    color,
    label,
    empty,
    className,
}: {
    printerId: string;
    slotKey: string;
    color?: string;
    label?: string;
    empty?: boolean;
    className?: string;
}) {
    const spool = useSlotSpool(printerId, slotKey);
    const fill = empty ? undefined : (color ?? spool.hex);
    const fraction = fill ? spool.fraction : undefined;
    return (
        <span className="flex w-full flex-col items-center gap-1.5">
            <SpoolArt color={fill} label={empty ? undefined : (label ?? spool.material)} className={className} />
            <SpoolProgress fraction={fraction} color={fill} />
            {fraction !== undefined && (
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {Math.round(fraction * 100)}%
                </span>
            )}
        </span>
    );
}
