'use client';

import { useContext, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LocaleFlagIcon } from '@/components/shared/locale-flag-icon';
import {
  CANONICAL_LOCALES,
  LOCALE_METADATA,
  setLocaleCookie,
  type CanonicalLocale,
  type LocaleMetadata,
} from '@/i18n/config';
import {
  AppLocaleSwitchContext,
  useAppRefresh,
  useSafeLocale,
  useSafeTranslations,
} from '@/i18n/provider';
import { cn } from '@/lib/utils';

export interface LanguageSwitcherProps {
  variant?: 'compact' | 'full';
  className?: string;
  onLocaleSelect?: (locale: CanonicalLocale) => void;
}

/** Persists a new locale selection and triggers caller callback or router refresh. */
export function applyLocaleSelection(
  nextLocale: CanonicalLocale,
  currentLocale: CanonicalLocale,
  onLocaleSelect?: (locale: CanonicalLocale) => void,
  refresh?: () => void,
): void {
  if (nextLocale === currentLocale) return;
  setLocaleCookie(nextLocale);
  if (onLocaleSelect) {
    onLocaleSelect(nextLocale);
    return;
  }
  refresh?.();
}

/** Renders the inner content of a language option row with decorative flag, autonym, and active mark. */
export function LanguageSwitcherOptionRow({
  item,
  active,
}: {
  item: LocaleMetadata;
  active: boolean;
}) {
  return (
    <span
      data-locale={item.code}
      data-active={active ? 'true' : undefined}
      className="flex w-full items-center justify-between gap-2"
    >
      <span className="flex items-center gap-2">
        <LocaleFlagIcon locale={item.code} />
        <span className={cn('text-sm', active ? 'font-semibold text-foreground' : 'text-foreground')}>
          {item.autonym}
        </span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-xs text-muted-foreground">{item.shortCode}</span>
        {active && <Check aria-hidden="true" className="size-3.5 text-primary" />}
      </span>
    </span>
  );
}

/** Accessible Quiet Financial OS language selector for header and mobile navigation. */
export function LanguageSwitcher({
  variant = 'compact',
  className,
  onLocaleSelect,
}: LanguageSwitcherProps) {
  const currentLocale = useSafeLocale();
  const t = useSafeTranslations('languageSwitcher');
  const refresh = useAppRefresh();
  const localeSwitch = useContext(AppLocaleSwitchContext);
  const [localPending, startLocalTransition] = useTransition();
  const isPending = Boolean(localeSwitch?.isPending || localPending);
  const currentMeta = LOCALE_METADATA[currentLocale];
  const pendingIndicator = isPending ? (
    <Loader2 aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" />
  ) : null;

  const handleSelect = (nextLocale: CanonicalLocale) => {
    if (nextLocale === currentLocale) return;
    startLocalTransition(() => {
      applyLocaleSelection(nextLocale, currentLocale, onLocaleSelect, refresh);
    });
    if (!onLocaleSelect) {
      localeSwitch?.setOptimisticLocale(nextLocale);
    }
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        {variant === 'full' ? (
          <Button
            type="button"
            variant="outline"
            data-language-switcher="full"
            aria-label={t('label')}
            aria-busy={isPending || undefined}
            title={t('currentLanguage', { language: currentMeta.autonym })}
            className={cn('h-10 w-full justify-between gap-2 px-3', className)}
          >
            <span className="flex items-center gap-2">
              <LocaleFlagIcon locale={currentLocale} />
              <span className="text-sm font-medium text-foreground">{currentMeta.autonym}</span>
            </span>
            <span className="flex items-center gap-1.5">
              {pendingIndicator}
              <span className="font-mono text-xs text-muted-foreground">{currentMeta.shortCode}</span>
            </span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-language-switcher="compact"
            aria-label={t('label')}
            aria-busy={isPending || undefined}
            title={t('currentLanguage', { language: currentMeta.autonym })}
            className={cn('h-9 gap-1.5 px-2 text-muted-foreground hover:text-foreground', className)}
          >
            <LocaleFlagIcon locale={currentLocale} />
            {pendingIndicator}
            <span className="font-mono text-xs font-medium">{currentMeta.shortCode}</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        aria-label={t('menuLabel')}
        className="min-w-44 motion-reduce:animate-none"
      >
        {CANONICAL_LOCALES.map((code) => {
          const item = LOCALE_METADATA[code];
          const active = code === currentLocale;
          return (
            <DropdownMenuItem
              key={code}
              data-locale={item.code}
              data-active={active ? 'true' : undefined}
              aria-current={active ? 'true' : undefined}
              onSelect={() => handleSelect(item.code)}
            >
              <LanguageSwitcherOptionRow item={item} active={active} />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
