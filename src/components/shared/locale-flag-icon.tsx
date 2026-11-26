'use client';

import type { ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import type { CanonicalLocale } from '@/i18n/config';

const FLAG_PATHS: Record<CanonicalLocale, string> = {
  pt: '/locale-flags/pt.svg',
  es: '/locale-flags/es.svg',
  en: '/locale-flags/en.svg',
};

export interface LocaleFlagIconProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  locale: CanonicalLocale;
}

/** Purely decorative locale flag icon paired with accessible text labels. */
export function LocaleFlagIcon({ locale, className, ...props }: LocaleFlagIconProps) {
  return (
    <img
      {...props}
      src={FLAG_PATHS[locale]}
      alt=""
      aria-hidden="true"
      width={24}
      height={16}
      className={cn('h-3.5 w-5 shrink-0 rounded-[2px] object-cover', className)}
    />
  );
}
