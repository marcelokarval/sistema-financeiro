'use client';

import { useState } from 'react';
import { Ellipsis } from 'lucide-react';
import { navigationGroups, navigationItems } from '@/components/finance/sidebar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const shortcuts = navigationItems.slice(0, 4);

export function MobileNav() {
  const currentView = useAppStore((state) => state.currentView);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const [moreOpen, setMoreOpen] = useState(false);
  const inMore = !shortcuts.some(({ view }) => view === currentView);

  const tabClass = "h-12 min-w-0 flex-col gap-0.5 rounded-md px-1 text-xs text-muted-foreground";
  const currentClass = "bg-accent font-semibold text-accent-foreground underline underline-offset-4";

  return (
    <nav aria-label="Navegação móvel" className="shrink-0 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="grid grid-cols-5 gap-1 px-2 py-1">
        {shortcuts.map(({ view, label, icon: Icon }) => (
          <Button
            key={view}
            variant="ghost"
            aria-current={view === currentView ? "page" : undefined}
            className={cn(tabClass, view === currentView && currentClass)}
            onClick={() => setCurrentView(view)}
          >
            <Icon aria-hidden="true" />
            {label}
          </Button>
        ))}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" className={cn(tabClass, inMore && currentClass)}>
              <Ellipsis aria-hidden="true" />
              Mais
              {inMore && <span className="sr-only">: {navigationItems.find(({ view }) => view === currentView)?.label} (página atual)</span>}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] gap-2 overflow-y-auto rounded-t-xl px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] motion-reduce:animate-none">
            <SheetTitle>Mais destinos</SheetTitle>
            <SheetDescription>Escolha uma área do FinanceApp.</SheetDescription>
            <nav aria-label="Todos os destinos" className="mt-2 space-y-3">
              {navigationGroups.map(({ label, items }) => (
                <div key={label} className="space-y-1">
                  <p className="px-2 text-xs font-semibold text-muted-foreground">{label}</p>
                  {items.map(({ view, label, icon: Icon }) => (
                    <Button
                      key={view}
                      variant="ghost"
                      aria-current={view === currentView ? "page" : undefined}
                      className={cn("h-10 w-full justify-start gap-2", view === currentView && currentClass)}
                      onClick={() => { setCurrentView(view); setMoreOpen(false); }}
                    >
                      <Icon aria-hidden="true" />
                      {label}
                    </Button>
                  ))}
                </div>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
