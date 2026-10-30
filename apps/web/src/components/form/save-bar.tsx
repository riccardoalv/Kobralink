import { Button } from '@/components/ui/button';
import { m } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function SaveBar({
    changed,
    submitting,
    onDiscard,
    extra,
}: {
    changed: boolean;
    submitting?: boolean;
    onDiscard?: () => void;
    extra?: React.ReactNode;
}) {
    if (!changed) {
        return (
            <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" variant="secondary" className="rounded-full px-6" disabled={submitting}>
                    {m.common_save()}
                </Button>
                {extra}
            </div>
        );
    }
    return (
        <div
            role="status"
            className="sticky bottom-24 z-20 flex flex-wrap items-center gap-2 rounded-3xl bg-primary py-2 pr-2 pl-5 text-primary-foreground shadow-lg ring-4 ring-primary/25 duration-200 animate-in fade-in slide-in-from-bottom-2 md:bottom-4"
        >
            <span className="mr-auto text-sm font-medium">{m.form_unsaved()}</span>
            {extra}
            {onDiscard && (
                <Button
                    type="button"
                    variant="ghost"
                    className="rounded-full text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                    disabled={submitting}
                    onClick={onDiscard}
                >
                    {m.form_discard()}
                </Button>
            )}
            <Button
                type="submit"
                className={cn('rounded-full bg-background px-6 text-foreground shadow-sm hover:bg-background/90')}
                disabled={submitting}
            >
                {m.common_save()}
            </Button>
        </div>
    );
}
