import { type AppSettings, optionalUrl } from '@farolprint/shared';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { FieldError, fieldInvalid } from '@/components/form/field-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { m } from '@/lib/i18n';
import { appSettingsQuery } from '@/lib/queries';
import { cn } from '@/lib/utils';

const spoolmanSchema = z.object({
    spoolmanUrl: optionalUrl,
    spoolmanSyncRateSec: z.number().int().min(0).max(3600),
});

export const SPOOLMAN_KEYS = ['spoolmanUrl', 'spoolmanSyncRateSec'] as const satisfies readonly (keyof AppSettings)[];

export function SpoolmanCard({ settings }: { settings: AppSettings }) {
    const qc = useQueryClient();
    const health = useQuery({
        queryKey: ['spoolman', 'health'],
        queryFn: api.spoolman.health,
        enabled: Boolean(settings.spoolmanUrl),
        refetchInterval: 30_000,
        retry: false,
    });
    const save = useMutation({
        mutationFn: (v: z.infer<typeof spoolmanSchema>) => api.settings.update(v),
        onSuccess: (next) => {
            qc.setQueryData(appSettingsQuery.queryKey, next);
            void qc.invalidateQueries({ queryKey: ['spoolman'] });
            void qc.invalidateQueries({ queryKey: ['printers'] });
            toast.success(m.settings_saved());
        },
        onError: (e) => toast.error(e.message),
    });
    const form = useForm({
        defaultValues: { spoolmanUrl: settings.spoolmanUrl, spoolmanSyncRateSec: settings.spoolmanSyncRateSec },
        validators: { onSubmit: spoolmanSchema },
        onSubmit: ({ value }) => save.mutateAsync(value).catch(() => undefined),
    });
    const dot = !settings.spoolmanUrl
        ? 'bg-muted-foreground/40'
        : health.data?.reachable
          ? 'bg-primary'
          : 'bg-destructive';

    return (
        <form
            noValidate
            onSubmit={(e) => {
                e.preventDefault();
                void form.handleSubmit();
            }}
        >
            <Card className="rounded-3xl border-0 shadow-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        Spoolman <span className={cn('size-2 rounded-full', dot)} />
                    </CardTitle>
                    <CardDescription>
                        {m.spoolman_hint()}
                        {settings.spoolmanUrl &&
                            (health.data?.reachable
                                ? ` ${m.spoolman_reachable()}`
                                : health.isFetched
                                  ? ` ${m.spoolman_unreachable()}`
                                  : '')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <form.Field name="spoolmanUrl">
                        {(field) => (
                            <div className="grid gap-2">
                                <Label htmlFor={field.name}>{m.spoolman_server_url()}</Label>
                                <Input
                                    id={field.name}
                                    type="url"
                                    placeholder="http://192.168.1.20:7912"
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
                    <form.Field name="spoolmanSyncRateSec">
                        {(field) => (
                            <div className="grid gap-2">
                                <Label htmlFor={field.name}>{m.spoolman_sync_rate()}</Label>
                                <Input
                                    id={field.name}
                                    type="number"
                                    min={0}
                                    max={3600}
                                    step={30}
                                    value={Number.isNaN(field.state.value) ? '' : field.state.value}
                                    onBlur={field.handleBlur}
                                    onChange={(e) => field.handleChange(e.target.valueAsNumber)}
                                    aria-invalid={fieldInvalid(field.state.meta)}
                                    className="w-40 rounded-full px-4"
                                />
                                <p className="px-4 text-xs text-muted-foreground">{m.spoolman_sync_rate_hint()}</p>
                                <FieldError meta={field.state.meta} />
                            </div>
                        )}
                    </form.Field>
                    <div>
                        <form.Subscribe selector={(s) => s.isSubmitting}>
                            {(isSubmitting) => (
                                <Button type="submit" className="rounded-full px-6" disabled={isSubmitting}>
                                    {m.common_save()}
                                </Button>
                            )}
                        </form.Subscribe>
                    </div>
                </CardContent>
            </Card>
        </form>
    );
}
