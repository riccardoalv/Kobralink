import type { GcodeFileDto } from '@farolprint/shared';
import { QueryClient } from '@tanstack/react-query';
import { isValidElement, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrintReadyForm } from '@/components/printer/files/print-ready-form';
import { confirmationDialogStore } from '@/stores/confirmation-dialog';
import { openPrintReadyDialog } from './print-ready-watcher';

const { queueAdd, print, clearFileReady, toast } = vi.hoisted(() => ({
    queueAdd: vi.fn(),
    print: vi.fn(),
    clearFileReady: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('sonner', () => ({ toast }));

vi.mock('@/lib/api', () => ({
    api: { queue: { add: queueAdd }, files: { print }, control: { clearFileReady } },
}));

vi.mock('@/lib/queries', () => ({
    filesQuery: (printerId: string) => ({ queryKey: ['printers', printerId, 'files'] }),
}));

const file = { id: 'f1', filename: 'bracket.gcode' } as unknown as GcodeFileDto;
const chosen = {
    excludedObjects: ['cube'],
    autoLeveling: false,
    vibrationCompensation: false,
    timelapse: true,
    failureDetection: false,
};

type FormProps = React.ComponentProps<typeof PrintReadyForm>;

async function openFor(filename: string): Promise<{ opened: boolean; props: FormProps | null }> {
    const qc = new QueryClient();
    qc.setQueryData(['printers', 'p1', 'files'], [file]);
    vi.spyOn(qc, 'fetchQuery').mockResolvedValue([file]);
    let props: FormProps | null = null;
    const open = vi.spyOn(confirmationDialogStore.actions, 'openDialog').mockImplementation((data) => {
        if (isValidElement<FormProps>(data?.content)) props = (data.content as ReactElement<FormProps>).props;
    });
    const opened = await openPrintReadyDialog(qc, 'p1', filename);
    open.mockRestore();
    return { opened, props };
}

beforeEach(() => {
    queueAdd.mockReset().mockResolvedValue({ filename: 'bracket.gcode' });
    print.mockReset().mockResolvedValue({ filename: 'bracket.gcode' });
    clearFileReady.mockReset().mockResolvedValue(undefined);
    toast.success.mockReset();
    toast.error.mockReset();
});

describe('openPrintReadyDialog', () => {
    it('does not open for a file missing from the library', async () => {
        const { opened, props } = await openFor('other.gcode');
        expect(opened).toBe(false);
        expect(props).toBeNull();
    });

    it('queues the file with every option chosen in the dialog', async () => {
        const { opened, props } = await openFor('bracket.gcode');
        expect(opened).toBe(true);
        await props?.onQueue?.(chosen);
        expect(queueAdd).toHaveBeenCalledWith('p1', { fileId: 'f1', ...chosen });
        expect(clearFileReady).toHaveBeenCalledWith('p1');
        expect(toast.success).toHaveBeenCalledOnce();
    });

    it('prints the file with the options chosen in the dialog', async () => {
        const { props } = await openFor('bracket.gcode');
        await props?.onPrint(chosen);
        expect(print).toHaveBeenCalledWith('p1', { fileId: 'f1', ...chosen });
    });

    it('reports a failed queue add', async () => {
        queueAdd.mockRejectedValueOnce(new Error('queue full'));
        const { props } = await openFor('bracket.gcode');
        await props?.onQueue?.(chosen);
        expect(toast.error).toHaveBeenCalledWith('queue full');
    });
});
