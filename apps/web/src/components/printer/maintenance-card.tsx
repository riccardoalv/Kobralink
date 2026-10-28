import {
    MAINTENANCE_PRESETS,
    type MaintenancePreset,
    type MaintenanceTaskDto,
    maintenanceTaskSchema,
} from '@farolprint/shared';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, History, Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { FieldError, fieldInvalid } from '@/components/form/field-error';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { m } from '@/lib/i18n';
import { maintenanceQuery } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { alertConfirmationDialogStore } from '@/stores/alert-confirmation-dialog';
import { confirmationDialogStore } from '@/stores/confirmation-dialog';

const PRESET_LABEL: Record<string, () => string> = {
    lubricate_axes: m.maintenance_preset_lubricate_axes,
    clean_nozzle: m.maintenance_preset_clean_nozzle,
    check_belts: m.maintenance_preset_check_belts,
    clean_bed: m.maintenance_preset_clean_bed,
    clean_fans: m.maintenance_preset_clean_fans,
};

export function presetLabel(p: MaintenancePreset): string {
    return PRESET_LABEL[p.key]?.() ?? p.key;
}

export function MaintenanceCard({ printerId }: { printerId: string }) {
    const qc = useQueryClient();
    const tasks = useQuery(maintenanceQuery(printerId));
    const invalidate = () => qc.invalidateQueries({ queryKey: ['printers', printerId, 'maintenance'] });
    const onError = (e: Error) => toast.error(e.message);
    const remove = useMutation({
        mutationFn: (id: string) => api.maintenance.remove(printerId, id),
        onSuccess: invalidate,
        onError,
    });
    const openForm = (task?: MaintenanceTaskDto) =>
        confirmationDialogStore.actions.openDialog({
            title: task ? m.maintenance_edit() : m.maintenance_add(),
            description: m.maintenance_interval_hint(),
            content: <TaskForm printerId={printerId} task={task} onSaved={invalidate} />,
        });
    const openDone = (task: MaintenanceTaskDto) =>
        confirmationDialogStore.actions.openDialog({
            title: m.maintenance_done_title({ name: task.name }),
            content: <DoneForm printerId={printerId} task={task} onSaved={invalidate} />,
        });
    const openLog = (task: MaintenanceTaskDto) =>
        confirmationDialogStore.actions.openDialog({
            title: `${task.name} · ${m.maintenance_log()}`,
            content: <LogList printerId={printerId} task={task} />,
        });
    const list = tasks.data ?? [];
    const dueCount = list.filter((t) => t.due).length;

    return (
        <Card className="rounded-3xl border-0 shadow-none">
            <CardHeader>
                <CardTitle className="text-lg font-medium">{m.maintenance_title()}</CardTitle>
                <CardAction className="flex items-center gap-2 text-xs text-muted-foreground">
                    {dueCount > 0 && (
                        <span className="rounded-full bg-destructive/15 px-2 py-0.5 font-medium text-destructive">
                            {m.maintenance_due_count({ n: dueCount })}
                        </span>
                    )}
                    <button
                        type="button"
                        title={m.maintenance_add()}
                        aria-label={m.maintenance_add()}
                        className="flex size-8 items-center justify-center rounded-full bg-secondary hover:bg-accent [&_svg]:size-3.5"
                        onClick={() => openForm()}
                    >
                        <Plus />
                    </button>
                </CardAction>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                {list.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
                        <Wrench className="size-6" />
                        {m.maintenance_empty()}
                    </div>
                ) : (
                    <ScrollArea className="min-h-0 flex-1">
                        <ul className="space-y-2">
                            {list.map((t) => (
                                <TaskRow
                                    key={t.id}
                                    task={t}
                                    onDone={() => openDone(t)}
                                    onEdit={() => openForm(t)}
                                    onLog={() => openLog(t)}
                                    onRemove={() =>
                                        alertConfirmationDialogStore.actions.openAlertDialog({
                                            title: m.maintenance_delete_title({ name: t.name }),
                                            description: m.maintenance_delete_hint(),
                                            actionLabel: m.common_delete(),
                                            onAction: () => remove.mutateAsync(t.id),
                                        })
                                    }
                                />
                            ))}
                        </ul>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}

function intervalText(t: MaintenanceTaskDto): string {
    const parts: string[] = [];
    if (t.intervalHours > 0) parts.push(m.maintenance_every_hours({ n: t.intervalHours }));
    if (t.intervalJobs > 0) parts.push(m.maintenance_every_jobs({ n: t.intervalJobs }));
    if (t.intervalDays > 0) parts.push(m.maintenance_every_days({ n: t.intervalDays }));
    return parts.join(' · ');
}

function TaskRow({
    task,
    onDone,
    onEdit,
    onLog,
    onRemove,
}: {
    task: MaintenanceTaskDto;
    onDone: () => void;
    onEdit: () => void;
    onLog: () => void;
    onRemove: () => void;
}) {
    const pct = Math.min(100, Math.round(task.progress * 100));
    return (
        <li className={cn('rounded-2xl p-3', task.due ? 'bg-destructive/10' : 'bg-secondary/60')}>
            <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{task.name}</span>
                        {task.due && (
                            <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-medium uppercase text-destructive-foreground">
                                {m.maintenance_due()}
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-muted-foreground">{intervalText(task)}</div>
                </div>
                <div className="flex gap-1">
                    <Small title={m.maintenance_done()} onClick={onDone}>
                        <Check />
                    </Small>
                    <Small title={m.maintenance_log()} onClick={onLog}>
                        <History />
                    </Small>
                    <Small title={m.maintenance_edit()} onClick={onEdit}>
                        <Pencil />
                    </Small>
                    <Small title={m.common_delete()} onClick={onRemove}>
                        <Trash2 />
                    </Small>
                </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/60">
                <div
                    className={cn('h-full rounded-full', task.due ? 'bg-destructive' : 'bg-primary')}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
                <span>
                    {m.maintenance_usage({ hours: task.usage.hours, jobs: task.usage.jobs, days: task.usage.days })}
                </span>
                <span>
                    {task.lastDoneAt
                        ? m.maintenance_last({ date: formatDate(task.lastDoneAt) })
                        : m.maintenance_never()}
                </span>
            </div>
            {task.note && <p className="mt-1 text-xs text-muted-foreground">{task.note}</p>}
        </li>
    );
}

function Small({ title, ...props }: React.ComponentProps<'button'> & { title: string }) {
    return (
        <button
            type="button"
            title={title}
            aria-label={title}
            {...props}
            className="flex size-7 items-center justify-center rounded-full bg-background/50 hover:bg-background disabled:opacity-30 [&_svg]:size-3.5"
        />
    );
}

export function TaskForm({
    printerId,
    task,
    onSaved,
}: {
    printerId: string;
    task?: MaintenanceTaskDto;
    onSaved: () => void;
}) {
    const close = confirmationDialogStore.actions.closeDialog;
    const save = useMutation({
        mutationFn: (v: ReturnType<typeof maintenanceTaskSchema.parse>) =>
            task ? api.maintenance.update(printerId, task.id, v) : api.maintenance.create(printerId, v),
        onSuccess: () => {
            toast.success(m.maintenance_saved());
            onSaved();
            close();
        },
        onError: (e) => toast.error(e.message),
    });
    const form = useForm({
        defaultValues: {
            name: task?.name ?? '',
            note: task?.note ?? '',
            intervalHours: task?.intervalHours ?? 0,
            intervalJobs: task?.intervalJobs ?? 0,
            intervalDays: task?.intervalDays ?? 0,
        },
        validators: { onSubmit: maintenanceTaskSchema.required() },
        onSubmit: ({ value }) => save.mutateAsync(maintenanceTaskSchema.parse(value)).catch(() => undefined),
    });
    const num = (name: 'intervalHours' | 'intervalJobs' | 'intervalDays', label: string, step: number) => (
        <form.Field name={name}>
            {(field) => (
                <div className="grid gap-2">
                    <Label htmlFor={`maintenance-${name}`}>{label}</Label>
                    <Input
                        id={`maintenance-${name}`}
                        type="number"
                        min={0}
                        step={step}
                        value={Number.isNaN(field.state.value) ? '' : field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.valueAsNumber || 0)}
                        aria-invalid={fieldInvalid(field.state.meta)}
                        className="rounded-full px-4"
                    />
                    <FieldError meta={field.state.meta} />
                </div>
            )}
        </form.Field>
    );
    return (
        <form
            noValidate
            onSubmit={(e) => {
                e.preventDefault();
                void form.handleSubmit();
            }}
        >
            <div className="grid gap-4 py-2">
                {!task && (
                    <div className="flex flex-wrap gap-1.5">
                        {MAINTENANCE_PRESETS.map((p) => (
                            <button
                                key={p.key}
                                type="button"
                                className="rounded-full bg-secondary px-3 py-1 text-xs hover:bg-accent"
                                onClick={() => {
                                    form.setFieldValue('name', presetLabel(p));
                                    form.setFieldValue('intervalHours', p.intervalHours);
                                    form.setFieldValue('intervalJobs', p.intervalJobs);
                                    form.setFieldValue('intervalDays', p.intervalDays);
                                }}
                            >
                                {presetLabel(p)}
                            </button>
                        ))}
                    </div>
                )}
                <form.Field name="name">
                    {(field) => (
                        <div className="grid gap-2">
                            <Label htmlFor="maintenance-name">{m.maintenance_name()}</Label>
                            <Input
                                id="maintenance-name"
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                aria-invalid={fieldInvalid(field.state.meta)}
                                className="rounded-full px-4"
                            />
                            <FieldError meta={field.state.meta} />
                        </div>
                    )}
                </form.Field>
                <div className="grid gap-4 sm:grid-cols-3">
                    {num('intervalHours', m.maintenance_interval_hours(), 1)}
                    {num('intervalJobs', m.maintenance_interval_jobs(), 1)}
                    {num('intervalDays', m.maintenance_interval_days(), 1)}
                </div>
                <form.Field name="note">
                    {(field) => (
                        <div className="grid gap-2">
                            <Label htmlFor="maintenance-note">{m.maintenance_note()}</Label>
                            <Input
                                id="maintenance-note"
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                aria-invalid={fieldInvalid(field.state.meta)}
                                className="rounded-full px-4"
                            />
                            <FieldError meta={field.state.meta} />
                        </div>
                    )}
                </form.Field>
            </div>
            <DialogFooter className="gap-2">
                <Button type="button" variant="ghost" className="rounded-full" onClick={close}>
                    {m.common_cancel()}
                </Button>
                <Button type="submit" className="rounded-full px-5" disabled={save.isPending}>
                    {m.common_save()}
                </Button>
            </DialogFooter>
        </form>
    );
}

export function DoneForm({
    printerId,
    task,
    onSaved,
}: {
    printerId: string;
    task: MaintenanceTaskDto;
    onSaved: () => void;
}) {
    const close = confirmationDialogStore.actions.closeDialog;
    const done = useMutation({
        mutationFn: (note: string) => api.maintenance.complete(printerId, task.id, { note }),
        onSuccess: () => {
            toast.success(m.maintenance_completed({ name: task.name }));
            onSaved();
            close();
        },
        onError: (e) => toast.error(e.message),
    });
    const form = useForm({
        defaultValues: { note: '' },
        onSubmit: ({ value }) => done.mutateAsync(value.note.trim()).catch(() => undefined),
    });
    return (
        <form
            noValidate
            onSubmit={(e) => {
                e.preventDefault();
                void form.handleSubmit();
            }}
        >
            <div className="grid gap-4 py-2">
                <p className="text-sm text-muted-foreground">
                    {m.maintenance_usage({ hours: task.usage.hours, jobs: task.usage.jobs, days: task.usage.days })}
                </p>
                <form.Field name="note">
                    {(field) => (
                        <div className="grid gap-2">
                            <Label htmlFor="maintenance-done-note">{m.maintenance_done_note()}</Label>
                            <Input
                                id="maintenance-done-note"
                                value={field.state.value}
                                maxLength={500}
                                onChange={(e) => field.handleChange(e.target.value)}
                                className="rounded-full px-4"
                            />
                        </div>
                    )}
                </form.Field>
            </div>
            <DialogFooter className="gap-2">
                <Button type="button" variant="ghost" className="rounded-full" onClick={close}>
                    {m.common_cancel()}
                </Button>
                <Button type="submit" className="rounded-full px-5" disabled={done.isPending}>
                    <Check /> {m.maintenance_done()}
                </Button>
            </DialogFooter>
        </form>
    );
}

export function LogList({ printerId, task }: { printerId: string; task: MaintenanceTaskDto }) {
    const logs = useQuery({
        queryKey: ['printers', printerId, 'maintenance', task.id, 'log'],
        queryFn: () => api.maintenance.logs(printerId, task.id),
    });
    const rows = logs.data ?? [];
    if (logs.isSuccess && rows.length === 0) {
        return <p className="py-2 text-sm text-muted-foreground">{m.maintenance_never()}</p>;
    }
    return (
        <ul className="divide-y divide-border py-2 text-sm">
            {rows.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-2">
                    <span className="text-muted-foreground">{formatDate(l.doneAt)}</span>
                    <span className="flex-1 truncate">{l.note}</span>
                    <span className="tabular-nums text-muted-foreground">
                        {m.maintenance_usage({ hours: l.hours, jobs: l.jobs, days: 0 })}
                    </span>
                </li>
            ))}
        </ul>
    );
}
