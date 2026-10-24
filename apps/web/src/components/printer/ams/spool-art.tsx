import { useId } from 'react';
import { useSlotSpool } from '@/hooks/use-slot-spool';
import { cn } from '@/lib/utils';

const CY = 32;
const FRONT = 22;
const BACK = 42;
const FLANGE_RY = 27;
const HUB_RY = 9;
const FULL_RY = 25;
const TILT = 1 / 3;
const FLANGE = '#2b2d31';
const FLANGE_EDGE = '#5a5e66';
const HUB = '#55585f';

export function spoolRadius(fraction: number): number {
    const f = Math.min(1, Math.max(0, fraction));
    return Math.sqrt(HUB_RY ** 2 + (FULL_RY ** 2 - HUB_RY ** 2) * f);
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
    const ry = spoolRadius(fraction);
    const rx = ry * TILT;
    const wound = Boolean(color) && fraction > 0.005;
    const windings = Array.from({ length: 4 }, (_, i) => HUB_RY + ((ry - HUB_RY) * (i + 1)) / 5);
    const turns = Array.from({ length: 9 }, (_, i) => FRONT + 2 + i * 2);

    return (
        <span className={cn('relative inline-flex shrink-0', className)}>
            <svg viewBox="0 0 64 64" aria-hidden="true" className="size-full overflow-visible">
                <defs>
                    <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="black" stopOpacity="0.25" />
                        <stop offset="0.22" stopColor="white" stopOpacity="0.35" />
                        <stop offset="0.45" stopColor="white" stopOpacity="0" />
                        <stop offset="1" stopColor="black" stopOpacity="0.4" />
                    </linearGradient>
                    <clipPath id={`${id}-body`}>
                        <rect x={FRONT} y={CY - ry} width={BACK - FRONT} height={ry * 2} />
                    </clipPath>
                </defs>

                <ellipse
                    cx={BACK}
                    cy={CY}
                    rx={FLANGE_RY * TILT}
                    ry={FLANGE_RY}
                    fill={FLANGE}
                    stroke={FLANGE_EDGE}
                    strokeWidth="1"
                />
                <rect x={FRONT} y={CY - HUB_RY} width={BACK - FRONT} height={HUB_RY * 2} fill={HUB} />

                {wound && color && (
                    <>
                        <ellipse cx={BACK} cy={CY} rx={rx} ry={ry} fill={color} />
                        <ellipse cx={BACK} cy={CY} rx={rx} ry={ry} fill="black" fillOpacity="0.3" />
                        <rect x={FRONT} y={CY - ry} width={BACK - FRONT} height={ry * 2} fill={color} />
                        <g clipPath={`url(#${id}-body)`}>
                            {turns.map((x) => (
                                <line
                                    key={x}
                                    x1={x}
                                    y1={CY - ry}
                                    x2={x}
                                    y2={CY + ry}
                                    stroke="black"
                                    strokeOpacity="0.12"
                                    strokeWidth="0.5"
                                />
                            ))}
                        </g>
                        <rect x={FRONT} y={CY - ry} width={BACK - FRONT} height={ry * 2} fill={`url(#${id}-shade)`} />
                        <path
                            d={`M ${FRONT} ${CY - ry} H ${BACK} M ${FRONT} ${CY + ry} H ${BACK}`}
                            stroke="white"
                            strokeOpacity="0.18"
                            strokeWidth="0.6"
                        />
                        <ellipse
                            cx={FRONT}
                            cy={CY}
                            rx={rx}
                            ry={ry}
                            fill={color}
                            stroke="white"
                            strokeOpacity="0.22"
                            strokeWidth="0.6"
                        />
                        {windings.map((r) => (
                            <ellipse
                                key={r}
                                cx={FRONT}
                                cy={CY}
                                rx={r * TILT}
                                ry={r}
                                fill="none"
                                stroke="black"
                                strokeOpacity="0.16"
                                strokeWidth="0.5"
                            />
                        ))}
                        <path
                            d={`M ${FRONT + 6} ${CY - ry + 0.4} C ${FRONT + 14} ${CY - ry - 6}, ${BACK + 4} ${CY - FLANGE_RY + 2}, ${BACK + 14} ${CY - FLANGE_RY - 1}`}
                            fill="none"
                            stroke={color}
                            strokeWidth="1.6"
                            strokeLinecap="round"
                        />
                    </>
                )}

                <ellipse cx={FRONT} cy={CY} rx={HUB_RY * TILT} ry={HUB_RY} fill={HUB} />
                <ellipse cx={FRONT} cy={CY} rx={1.3} ry={3.8} className="fill-card" />

                <ellipse
                    cx={FRONT}
                    cy={CY}
                    rx={FLANGE_RY * TILT}
                    ry={FLANGE_RY}
                    fill="white"
                    fillOpacity="0.06"
                    stroke={active ? 'var(--primary)' : FLANGE_EDGE}
                    strokeWidth={active ? 2 : 1.2}
                />
                <path
                    d={`M ${FRONT - 6} ${CY - 14} Q ${FRONT - 7.4} ${CY - 4} ${FRONT - 6.4} ${CY + 6}`}
                    fill="none"
                    stroke="white"
                    strokeOpacity="0.3"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                />
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
    className,
}: {
    printerId: string;
    slotKey: string;
    color?: string;
    empty?: boolean;
    active?: boolean;
    className?: string;
}) {
    const spool = useSlotSpool(printerId, slotKey);
    return (
        <SpoolArt
            color={empty ? undefined : (color ?? spool.hex)}
            fraction={spool.fraction ?? 1}
            active={active}
            className={className}
        />
    );
}
