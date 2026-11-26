'use client';

import type { FormEvent, KeyboardEvent, RefObject } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSafeTranslations } from '@/i18n/provider';

export interface AdvisorComposerProps {
  suggestions: readonly string[];
  inputValue: string;
  isLoading: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onSuggestionClick: (suggestion: string) => void;
  onKeyDown: (e: KeyboardEvent) => void;
}

/** Prompt composer and quick question suggestions for the AI financial advisor. */
export function AdvisorComposer({
  suggestions,
  inputValue,
  isLoading,
  inputRef,
  onInputChange,
  onSubmit,
  onSuggestionClick,
  onKeyDown,
}: AdvisorComposerProps) {
  const t = useSafeTranslations('advisor');

  return (
    <div className="border-t border-border px-3 py-3 sm:px-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{t('composer.suggestionsTitle')}</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {suggestions.map((suggestion) => (
          <Button
            key={suggestion}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSuggestionClick(suggestion)}
            disabled={isLoading}
            className="h-auto min-h-9 whitespace-normal px-2.5 py-1 text-left text-xs"
          >
            {suggestion}
          </Button>
        ))}
      </div>
      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label={t('composer.inputAriaLabel')}
          placeholder={t('composer.inputPlaceholder')}
          disabled={isLoading}
          className="h-10 min-w-0 flex-1 rounded-md"
        />
        <Button
          type="submit"
          aria-label={t('composer.sendAriaLabel')}
          size="icon"
          disabled={!inputValue.trim() || isLoading}
          className="size-10 shrink-0"
        >
          <Send aria-hidden="true" className="size-4" />
        </Button>
      </form>
    </div>
  );
}
