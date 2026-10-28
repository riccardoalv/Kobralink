import type { PrinterLiveState } from '@farolprint/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './status-badge';

const state = (overrides: Partial<PrinterLiveState>) =>
    ({ connected: true, printState: 'standby', kobraState: 'free', ...overrides }) as PrinterLiveState;

describe('StatusBadge', () => {
    it('shows the state label', () => {
        render(<StatusBadge state={state({ kobraState: 'printing', printState: 'printing' })} />);
        expect(screen.getByText(/printing/i)).toBeTruthy();
    });

    it('falls back to the raw state when it is unknown', () => {
        render(<StatusBadge state={state({ kobraState: 'brand_new_state' })} />);
        expect(screen.getByText('brand_new_state')).toBeTruthy();
    });
});
