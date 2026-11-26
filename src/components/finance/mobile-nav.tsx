'use client';

import { useState } from 'react';
import { Ellipsis } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { LanguageSwitcher } from '@/components/finance/language-switcher';
import { navigationGroups, navigationItems } from '@/components/finance/sidebar';
import { useSafeTranslations } from '@/i18n/provider';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const shortcuts = navigationItems.slice(0, 4);

export function MobileNav() {
  const currentView = useAppStore((state) => state.currentView);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const [moreOpen, setMoreOpen] = useState(false);
  const t = useSafeTranslations('shell.navigation');
  const inMore = !shortcuts.some(({ view }) => view === currentView);

  const tabClass = 'h-12 min-w-0 flex-col gap-0.5 rounded-md px-1 text-xs text-muted-foreground';
  const currentClass = 'bg-accent font-semibold text-accent-foreground underline underline-offset-4';

  return (
    <nav aria-label={t('mobileAriaLabel')} className="shrink-0 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="grid grid-cols-5 gap-1 px-2 py-1">
        {shortcuts.map(({ view, icon: Icon }) => (
          <Button
            key={view}
            variant="ghost"
            aria-current={view === currentView ? 'page' : undefined}
            className={cn(tabClass, view === currentView && currentClass)}
            onClick={() => setCurrentView(view)}
          >
            <Icon aria-hidden="true" />
            {t(`items.${view}`)}
          </Button>
        ))}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" className={cn(tabClass, inMore && currentClass)}>
              <Ellipsis aria-hidden="true" />
              {t('more')}
              {inMore && (
                <span className="sr-only">
                  : {t(`items.${currentView}`)} {t('currentPageSuffix')}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] gap-2 overflow-y-auto rounded-t-xl px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] motion-reduce:animate-none">
            <SheetTitle>{t('moreDestinations')}</SheetTitle>
            <SheetDescription>{t('moreDescription')}</SheetDescription>
            <nav aria-label={t('allDestinationsAriaLabel')} className="mt-2 space-y-3">
              {navigationGroups.map(({ key, items }) => (
                <div key={key} className="space-y-1">
                  <p className="px-2 text-xs font-semibold text-muted-foreground">{t(`groups.${key}`)}</p>
                  {items.map(({ view, icon: Icon }) => (
                    <Button
                      key={view}
                      variant="ghost"
                      aria-current={view === currentView ? 'page' : undefined}
                      className={cn('h-10 w-full justify-start gap-2', view === currentView && currentClass)}
                      onClick={() => { setCurrentView(view); setMoreOpen(false); }}
                    >
                      <Icon aria-hidden="true" />
                      {t(`items.${view}`)}
                    </Button>
                  ))}
                </div>
              ))}
            </nav>
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-2 px-2 text-xs font-semibold text-muted-foreground">{t('languageSection')}</p>
              <LanguageSwitcher variant="full" />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
