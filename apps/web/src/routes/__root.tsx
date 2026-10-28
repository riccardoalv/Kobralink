import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';

export interface RouterContext {
    queryClient: QueryClient;
}

const isDesktop =
    typeof window !== 'undefined' &&
    (window as unknown as { farolprintDesktop?: { platform?: string } }).farolprintDesktop?.platform === 'darwin';

export const Route = createRootRouteWithContext<RouterContext>()({
    component: () => (
        <>
            <div className="app-dragbar" hidden={!isDesktop} />
            <Outlet />
        </>
    ),
});
