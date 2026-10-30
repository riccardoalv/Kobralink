import type { LinkProps } from '@tanstack/react-router';
import { BarChart3, Disc3, type LucideIcon, Printer, Settings2 } from 'lucide-react';
import { m } from '@/lib/i18n';

export interface NavItem {
    to: NonNullable<LinkProps['to']>;
    icon: LucideIcon;
    label: () => string;
}

export const NAV_ITEMS: NavItem[] = [
    { to: '/printers', icon: Printer, label: m.nav_home },
    { to: '/filament', icon: Disc3, label: m.nav_filament },
    { to: '/stats', icon: BarChart3, label: m.nav_stats },
];

export const SETTINGS_ITEM: NavItem = { to: '/settings', icon: Settings2, label: m.nav_settings };
