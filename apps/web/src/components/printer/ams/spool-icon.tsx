import { cn } from '@/lib/utils';

const WINDINGS = [12.5, 14.5, 16.5, 18.5];
const SPOKES = [0, 120, 240];
const FLANGE = '#2b2d31';
const FLANGE_EDGE = '#4a4d54';
const HUB = '#55585f';

function polar(radius: number, deg: number) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: 24 + radius * Math.cos(rad), y: 24 + radius * Math.sin(rad) };
}

export function SpoolIcon({ color, active, className }: { color?: string; active?: boolean; className?: string }) {
    return (
        <span className={cn('relative inline-flex shrink-0', className)}>
            <svg viewBox="0 0 48 48" aria-hidden="true" className="size-full overflow-visible">
                <circle cx="24" cy="24" r="23" fill={FLANGE} stroke={FLANGE_EDGE} strokeWidth="1" />
                {color ? (
                    <>
                        <circle cx="24" cy="24" r="20" fill={color} />
                        {WINDINGS.map((r) => (
                            <circle
                                key={r}
                                cx="24"
                                cy="24"
                                r={r}
                                fill="none"
                                stroke="black"
                                strokeOpacity="0.16"
                                strokeWidth="0.6"
                            />
                        ))}
                        <path
                            d="M10.5 17.5 A15 15 0 0 1 19 9.8"
                            fill="none"
                            stroke="white"
                            strokeOpacity="0.45"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                        />
                        <circle
                            cx="24"
                            cy="24"
                            r="20"
                            fill="none"
                            stroke="black"
                            strokeOpacity="0.25"
                            strokeWidth="1"
                        />
                        <path
                            d="M37.5 9.5 Q42 6 46.5 6.5"
                            fill="none"
                            stroke={color}
                            strokeWidth="1.8"
                            strokeLinecap="round"
                        />
                    </>
                ) : (
                    <circle
                        cx="24"
                        cy="24"
                        r="18.5"
                        fill="none"
                        stroke={FLANGE_EDGE}
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                    />
                )}
                <circle cx="24" cy="24" r="10.5" fill={HUB} />
                <circle cx="24" cy="24" r="10.5" fill="none" stroke="black" strokeOpacity="0.3" strokeWidth="0.8" />
                {SPOKES.map((deg) => {
                    const p = polar(6.6, deg);
                    return <circle key={deg} cx={p.x} cy={p.y} r="2" className="fill-card" />;
                })}
                <circle cx="24" cy="24" r="3.4" className="fill-card" />
                {active && <circle cx="24" cy="24" r="23.5" className="fill-none stroke-primary" strokeWidth="2.5" />}
            </svg>
        </span>
    );
}
