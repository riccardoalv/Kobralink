import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { remainingFraction } from '@/hooks/use-slot-spool';
import { SpoolArt, spoolLayers } from './spool-art';

const count = (container: HTMLElement, kind: string) => container.querySelectorAll(`[data-layer="${kind}"]`).length;

describe('spoolLayers', () => {
    it('gives one layer per 10 percent', () => {
        expect(spoolLayers(1)).toEqual({ full: 10, partial: 0 });
        expect(spoolLayers(0.6)).toEqual({ full: 6, partial: 0 });
        expect(spoolLayers(0)).toEqual({ full: 0, partial: 0 });
    });

    it('keeps the rest as a partly wound layer', () => {
        const { full, partial } = spoolLayers(0.81);
        expect(full).toBe(8);
        expect(partial).toBeCloseTo(0.1, 5);
    });

    it('clamps out-of-range values', () => {
        expect(spoolLayers(-1)).toEqual({ full: 0, partial: 0 });
        expect(spoolLayers(3)).toEqual({ full: 10, partial: 0 });
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
    it('winds one layer above and below the hub per 10 percent', () => {
        const { container } = render(<SpoolArt color="#ff7a00" fraction={0.6} />);
        expect(count(container, 'full')).toBe(12);
        expect(count(container, 'partial')).toBe(0);
        expect(count(container, 'empty')).toBe(8);
    });

    it('draws the remainder as a shorter layer', () => {
        const { container } = render(<SpoolArt color="#ff7a00" fraction={0.65} />);
        expect(count(container, 'full')).toBe(12);
        expect(count(container, 'partial')).toBe(2);
        expect(container.querySelectorAll('[fill="#ff7a00"]').length).toBeGreaterThan(0);
    });

    it('draws a bare spool when nothing is loaded', () => {
        const { container } = render(<SpoolArt fraction={1} />);
        expect(count(container, 'empty')).toBe(20);
    });
});
