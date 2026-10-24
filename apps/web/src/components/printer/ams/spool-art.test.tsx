import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { remainingFraction } from '@/hooks/use-slot-spool';
import { isDark } from '@/lib/color';
import { SpoolArt, SpoolProgress } from './spool-art';

describe('remainingFraction', () => {
    it('divides what is left by the total', () => {
        expect(remainingFraction(250, 1000)).toBe(0.25);
    });

    it('is unknown without a total', () => {
        expect(remainingFraction(250, 0)).toBeUndefined();
        expect(remainingFraction(undefined, 1000)).toBeUndefined();
    });
});

describe('isDark', () => {
    it('reads hex and rgb colours', () => {
        expect(isDark('#111111')).toBe(true);
        expect(isDark('rgb(20, 20, 22)')).toBe(true);
        expect(isDark('#e6e6e6')).toBe(false);
    });
});

describe('SpoolArt', () => {
    it('fills the roll with the filament colour and writes the material on it', () => {
        const { container } = render(<SpoolArt color="#ff7a00" label="PETG" />);
        expect(container.querySelector('[fill="#ff7a00"]')).not.toBeNull();
        expect(screen.getByText('PETG')).toBeTruthy();
    });

    it('writes light text on dark filament', () => {
        render(<SpoolArt color="#111111" label="PLA" />);
        expect(screen.getByText('PLA').getAttribute('fill')).toBe('white');
    });

    it('draws a bare spool when nothing is loaded', () => {
        const { container } = render(<SpoolArt label="PETG" />);
        expect(container.querySelector('text')).toBeNull();
        expect(container.querySelector('[stroke-dasharray]')).not.toBeNull();
    });
});

describe('SpoolProgress', () => {
    it('shows what is left as a progress bar', () => {
        render(<SpoolProgress fraction={0.74} color="#111111" />);
        expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('74');
    });

    it('is hidden when the amount left is unknown', () => {
        render(<SpoolProgress color="#111111" />);
        expect(screen.queryByRole('progressbar')).toBeNull();
    });
});
