'use client';

import type { RefObject } from 'react';
import { Bell, Brain, Moon, Plus, Search, Sun, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/finance/language-switcher';
import { NotificationPanel } from '@/components/finance/notification-panel';
import { QuickActions } from '@/components/finance/quick-actions';
import { useSafeTranslations } from '@/i18n/provider';
import type { ViewType } from '@/lib/store';

export interface AppHeaderProps {
  currentView: ViewType;
  isConnected: boolean;
  darkTheme: boolean;
  onToggleTheme: () => void;
  searchButtonRef: RefObject<HTMLButtonElement | null>;
  onOpenSearch: (origin: HTMLElement) => void;
  advisorButtonRef: RefObject<HTMLButtonElement | null>;
  aiAssistantVisible: boolean;
  onOpenAdvisor: () => void;
  notificationButtonRef: RefObject<HTMLButtonElement | null>;
  showNotifications: boolean;
  onToggleNotifications: () => void;
  onCloseNotifications: () => void;
  onDismissNotifications: () => void;
  onQuickNavigate: (view: ViewType, origin: HTMLButtonElement | null) => void;
  onNewGoal: () => void;
  onExport: () => void;
  newEntryButtonRef: RefObject<HTMLButtonElement | null>;
  onNewEntry: (origin: HTMLElement) => void;
}

/** Top application header containing the active view title, global services, and quick actions. */
export function AppHeader({
  currentView,
  isConnected,
  darkTheme,
  onToggleTheme,
  searchButtonRef,
  onOpenSearch,
  advisorButtonRef,
  aiAssistantVisible,
  onOpenAdvisor,
  notificationButtonRef,
  showNotifications,
  onToggleNotifications,
  onCloseNotifications,
  onDismissNotifications,
  onQuickNavigate,
  onNewGoal,
  onExport,
  newEntryButtonRef,
  onNewEntry,
}: AppHeaderProps) {
  const t = useSafeTranslations('shell.header');
  const tNav = useSafeTranslations('shell.navigation');

  const currentLabel =
    currentView === 'dashboard'
      ? t('dashboardTitle')
      : tNav(`items.${currentView}`);

  return (
    <header className="relative z-30 flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-border bg-card px-3 py-1.5 sm:min-h-16 sm:flex-nowrap sm:px-5 lg:px-6">
      <div className="min-w-0">
        <h1 className="text-sm font-semibold leading-tight tracking-tight sm:text-base">{currentLabel}</h1>
        <p className="hidden text-xs text-muted-foreground sm:block">{t(`viewContext.${currentView}`)}</p>
      </div>
      <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-0.5 sm:flex-nowrap sm:gap-1">
        {!isConnected && (
          <span className="mr-1 hidden text-muted-foreground sm:max-md:inline-flex" title={t('realtimeUnavailable')}>
            <WifiOff aria-hidden="true" className="size-4" />
            <span className="sr-only">{t('realtimeUnavailable')}</span>
          </span>
        )}
        <Button
          ref={searchButtonRef}
          variant="ghost"
          className="size-9 px-0 text-muted-foreground lg:w-auto lg:gap-2 lg:border lg:border-border lg:px-3"
          aria-label={t('openSearch')}
          aria-keyshortcuts="Control+K Meta+K"
          aria-haspopup="dialog"
          onClick={(event) => onOpenSearch(event.currentTarget)}
        >
          <Search aria-hidden="true" />
          <span className="hidden lg:inline">{t('searchButton')}</span>
          <kbd aria-hidden="true" className="hidden rounded border border-border px-1 font-mono text-[10px] lg:inline">{t('shortcutHint')}</kbd>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label={darkTheme ? t('useLightTheme') : t('useDarkTheme')}
          onClick={onToggleTheme}
        >
          {darkTheme ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </Button>

        <LanguageSwitcher variant="compact" />

        <Button
          ref={advisorButtonRef}
          variant="ghost"
          size="icon"
          aria-label={t('openAdvisor')}
          aria-haspopup="dialog"
          aria-expanded={aiAssistantVisible}
          onClick={onOpenAdvisor}
        >
          <Brain aria-hidden="true" />
        </Button>

        <div
          onKeyDown={(event) => {
            if (event.key === 'Escape' && showNotifications) onCloseNotifications();
          }}
          className="[&>div]:!right-3 md:[&>div]:!right-6"
        >
          <Button
            ref={notificationButtonRef}
            variant="ghost"
            size="icon"
            aria-label={t('notifications')}
            aria-expanded={showNotifications}
            onClick={onToggleNotifications}
          >
            <Bell aria-hidden="true" />
          </Button>
          <NotificationPanel isOpen={showNotifications} onClose={onCloseNotifications} />
        </div>

        <QuickActions
          onOpenChange={(open) => {
            if (open) onDismissNotifications();
          }}
          onNavigate={onQuickNavigate}
          onNewGoal={onNewGoal}
          onExport={onExport}
        />

        <Button
          ref={newEntryButtonRef}
          size="sm"
          className="ml-1 h-9 px-2.5"
          aria-label={t('newEntry')}
          aria-haspopup="dialog"
          onClick={(event) => onNewEntry(event.currentTarget)}
        >
          <Plus aria-hidden="true" />
          <span>{t('newEntry')}</span>
        </Button>
      </div>
    </header>
  );
}
