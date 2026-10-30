import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { HaMqttCard } from '@/components/settings/ha-mqtt-card';
import { OperatorOnly, settingsKey } from '@/components/settings/settings-form-card';
import { SPOOLMAN_KEYS, SpoolmanCard } from '@/components/settings/spoolman-card';
import { appSettingsQuery } from '@/lib/queries';

export const Route = createFileRoute('/_app/settings/integrations')({ component: IntegrationsSettingsPage });

function IntegrationsSettingsPage() {
    const { data: s } = useSuspenseQuery(appSettingsQuery);
    return (
        <OperatorOnly>
            <SpoolmanCard key={settingsKey(s, SPOOLMAN_KEYS)} settings={s} />
            <HaMqttCard key={settingsKey(s, ['haMqtt'])} settings={s} />
        </OperatorOnly>
    );
}
