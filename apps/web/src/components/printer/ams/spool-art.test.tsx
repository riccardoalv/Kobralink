import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { remainingFraction } from '@/hooks/use-slot-spool';
import { SpoolArt, spoolRadius } from './spool-art';

describe('spoolRadius', () => {
    it('shrinks to the hub when the spool is empty', () => {
        expect(spoolRadius(0)).toBe(9);
        expect(spoolRadius(1)).toBe(25);
    });

    it('follows the wound volume, so half a spool is past half the radius', () => {
        expect(spoolRadius(0.5)).toBeGreaterThan((9 + 25) / 2);
        expect(spoolRadius(0.25)).toBeLessThan(spoolRadius(0.5));
    });

    it('clamps out-of-range values', () => {
        expect(spoolRadius(-1)).toBe(9);
        expect(spoolRadius(3)).toBe(25);
    });
});

describe('remainingFraction', () => {
    it('divides what is left by the total', () => {
        expect(remainingFraction(250, 1000)).toBe(0.25);
    });

    it('is unknown without a total', () => {
        expect(remainingFraction(250, 0)).toBeUndefined();
        expect(remainingFraction(undefined, 1000)).toBeUndefined();
    });
});

describe('SpoolArt', () => {
    it('draws the filament in its colour', () => {
        const { container } = render(<SpoolArt color="#ff7a00" fraction={0.5} />);
        expect(container.querySelectorAll('[fill="#ff7a00"]').length).toBeGreaterThan(0);
    });

    it('draws a bare spool when nothing is loaded', () => {
        const { container } = render(<SpoolArt fraction={1} />);
        expect(container.querySelectorAll('line')).toHaveLength(0);
    });
});
