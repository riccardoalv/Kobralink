import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';
import { AddPrinterDialog } from '@/components/printer/add-printer-dialog';
import { PrinterCard } from '@/components/printer/printer-card';
import { usePrinters } from '@/hooks/use-printers';
import { useCanOperate } from '@/hooks/use-role';
import { api } from '@/lib/api';
import { m } from '@/lib/i18n';
import { printersQuery } from '@/lib/queries';
import { alertConfirmationDialogStore } from '@/stores/alert-confirmation-dialog';

export const Route = createFileRoute('/_app/printers/')({
    loader: ({ context }) => context.queryClient.query({ ...printersQuery, staleTime: 'static' }),
    component: PrintersPage,
});

function PrintersPage() {
    const qc = useQueryClient();
    const printers = usePrinters();
    const canOperate = useCanOperate();
    const onError = (e: Error) => toast.error(e.message);
    const pause = useMutation({
        mutationFn: api.control.pause,
        onSuccess: () => toast.success(m.print_pause_requested()),
        onError,
    });
    const resume = useMutation({
        mutationFn: api.control.resume,
        onSuccess: () => toast.success(m.print_resume_requested()),
        onError,
    });
    const cancel = useMutation({
        mutationFn: api.control.cancel,
        onSuccess: () => toast.success(m.print_cancel_requested()),
        onError,
    });
    const light = useMutation({
        mutationFn: ({ id, on }: { id: string; on: boolean }) => api.control.light(id, { on }),
        onError,
    });
    const reconnect = useMutation({
        mutationFn: api.printers.reconnect,
        onSuccess: () => {
            toast.success(m.printers_reconnect_requested());
            void qc.invalidateQueries({ queryKey: ['printers'] });
        },
        onError: (e) => toast.error(e.message),
    });

    if (printers.length === 0) {
        return (
            <div className="flex min-h-[60svh] flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-primary/40 p-10 text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Printer className="size-7" />
                </div>
                <h2 className="text-xl font-medium">{m.printers_empty_title()}</h2>
                <p className="max-w-md text-sm text-muted-foreground">{m.printers_empty_hint()}</p>
                <AddPrinterDialog />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {printers.map((p) => (
                <PrinterCard
                    key={p.id}
                    printer={p}
                    canOperate={canOperate}
                    onPause={() => pause.mutate(p.id)}
                    onResume={() => resume.mutate(p.id)}
                    onCancel={() =>
                        alertConfirmationDialogStore.actions.openAlertDialog({
                            title: m.print_cancel_title(),
                            description: m.print_cancel_hint(),
                            actionLabel: m.print_cancel_action(),
                            cancelLabel: m.print_cancel_keep(),
                            onAction: () => cancel.mutateAsync(p.id),
                        })
                    }
                    onReconnect={() => reconnect.mutate(p.id)}
                    onLight={(on) => light.mutate({ id: p.id, on })}
                />
            ))}
        </div>
    );
}
