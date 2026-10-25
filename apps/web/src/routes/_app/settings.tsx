import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { FilamentProfilesCard } from '@/components/printer/filament-profiles-card';
import { DetectionCard } from '@/components/settings/detection-card';
import { DryPresetsCard } from '@/components/settings/dry-presets-card';
import { GeneralCard } from '@/components/settings/general-card';
import { HaMqttCard } from '@/components/settings/ha-mqtt-card';
import { MacrosEditor } from '@/components/settings/macros-editor';
import { NotificationsCard } from '@/components/settings/notifications-card';
import { SpoolmanCard } from '@/components/settings/spoolman-card';
import { SpoolsCard } from '@/components/settings/spools-card';
import { SystemCard } from '@/components/settings/system-card';
import { UsersCard } from '@/components/settings/users-card';
import { useCanOperate, useIsAdmin } from '@/hooks/use-role';
import { m } from '@/lib/i18n';
import { appSettingsQuery } from '@/lib/queries';
import { cn } from '@/lib/utils';

const TABS = [
    'general',
    'notifications',
    'detection',
    'integrations',
    'filament',
    'macros',
    'users',
    'system',
] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute('/_app/settings')({
    validateSearch: z.object({ tab: z.enum(TABS).optional() }),
    loader: ({ context }) => context.queryClient.ensureQueryData(appSettingsQuery),
    component: SettingsPage,
});

const TAB_LABEL: Record<Tab, () => string> = {
    general: m.settings_tab_general,
    notifications: m.settings_tab_notifications,
    detection: m.settings_tab_detection,
    integrations: m.settings_tab_integrations,
    filament: m.settings_tab_filament,
    macros: m.settings_tab_macros,
    users: m.settings_tab_users,
    system: m.settings_tab_system,
};

function SettingsPage() {
    const { tab = 'general' } = Route.useSearch();
    const navigate = Route.useNavigate();
    const settings = useQuery(appSettingsQuery);
    const isAdmin = useIsAdmin();
    const canOperate = useCanOperate();
    if (!settings.data) return null;
    const s = settings.data;
    const tabs = TABS.filter((t) => t !== 'users' || isAdmin);
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 px-2">
                <h2 className="text-xl font-medium">{m.bridge_settings_title()}</h2>
            </div>
            <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-secondary p-1 [scrollbar-width:none]">
                {tabs.map((t) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => navigate({ search: { tab: t }, replace: true })}
                        className={cn(
                            'shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                            tab === t
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {TAB_LABEL[t]()}
                    </button>
                ))}
            </div>
            {!canOperate && (
                <div className="rounded-3xl bg-secondary px-5 py-3 text-sm text-muted-foreground">
                    {m.role_viewer_hint()}
                </div>
            )}
            <fieldset disabled={!canOperate} className="contents">
                <div key={`${tab}-${JSON.stringify(s)}`} className="space-y-4">
                    {tab === 'general' && <GeneralCard settings={s} />}
                    {tab === 'notifications' && <NotificationsCard settings={s} />}
                    {tab === 'detection' && <DetectionCard settings={s} />}
                    {tab === 'integrations' && (
                        <>
                            <SpoolmanCard settings={s} />
                            <HaMqttCard settings={s} />
                        </>
                    )}
                    {tab === 'filament' && (
                        <>
                            <SpoolsCard />
                            <DryPresetsCard settings={s} />
                            <FilamentProfilesCard />
                        </>
                    )}
                    {tab === 'macros' && <MacrosEditor />}
                    {tab === 'users' && isAdmin && <UsersCard />}
                    {tab === 'system' && <SystemCard />}
                </div>
            </fieldset>
        </div>
    );
}
