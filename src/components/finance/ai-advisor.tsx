'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Brain,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdvisorComposer } from '@/components/finance/advisor-composer';
import { INTL_LOCALE } from '@/i18n/config';
import { useSafeLocale, useSafeTranslations } from '@/i18n/provider';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function TypingIndicator() {
  const t = useSafeTranslations('advisor');

  return (
    <p role="status" className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
      <Loader2 aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />
      {t('typing')}
    </p>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const t = useSafeTranslations('advisor');
  const locale = useSafeLocale();
  const isUser = message.role === 'user';
  const timeStr = message.timestamp.toLocaleTimeString(INTL_LOCALE[locale], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const content = message.id === 'welcome' ? t('welcomeMessage') : message.content;

  return (
    <article className={cn('rounded-md border px-3 py-2.5', isUser ? 'ml-5 border-border bg-muted' : 'mr-5 border-border bg-card')}>
      <header className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold">{isUser ? t('roles.user') : t('roles.assistant')}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{timeStr}</span>
      </header>
      <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{content}</p>
    </article>
  );
}

export function AIAdvisor() {
  const t = useSafeTranslations('advisor');
  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content: t('welcomeMessage'),
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const quickSuggestions = [
    t('suggestions.saveMore'),
    t('suggestions.analyzeExpenses'),
    t('suggestions.investmentGoal'),
    t('suggestions.reduceExpenses'),
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        requestAnimationFrame(() => inputRef.current?.focus());
      }
      return next;
    });
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim() }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const serverError =
          typeof errorData?.error === 'string' ? errorData.error.trim() : '';
        const assistantError: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: serverError
            ? t('errors.prefix', { message: serverError })
            : t('errors.connectFailed'),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantError]);
        return;
      }

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response || t('errors.unprocessed'),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content:
          error instanceof Error
            ? t('errors.connectFailed')
            : t('errors.unexpected'),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, t]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      sendMessage(inputValue);
    },
    [inputValue, sendMessage]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      sendMessage(suggestion);
    },
    [sendMessage]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  return (
    <section data-quiet-advisor className="min-w-0 overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
      <h3>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={toggleOpen}
          className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-3 text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--ds-focus) sm:px-4"
        >
          <Brain aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-sm font-semibold">{t('title')}</span>
          {isOpen ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
        </button>
      </h3>
      {isOpen && (
        <div className="border-t border-border">
          <div
            ref={scrollRef}
            role="log"
            aria-label={t('conversationAriaLabel')}
            className="max-h-[min(24rem,36dvh)] space-y-2 overflow-y-auto bg-muted/30 px-3 py-3 sm:px-4"
          >
            {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
            {isLoading && <TypingIndicator />}
          </div>

          <AdvisorComposer
            suggestions={quickSuggestions}
            inputValue={inputValue}
            isLoading={isLoading}
            inputRef={inputRef}
            onInputChange={setInputValue}
            onSubmit={handleSubmit}
            onSuggestionClick={handleSuggestionClick}
            onKeyDown={handleKeyDown}
          />
        </div>
      )}
    </section>
  );
}
