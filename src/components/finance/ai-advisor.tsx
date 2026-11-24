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

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const quickSuggestions = [
  'Como economizar mais?',
  'Análise dos meus gastos',
  'Meta de investimento',
  'Dicas para reduzir despesas',
];

function TypingIndicator() {
  return (
    <p role="status" className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
      <Loader2 aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />
      Preparando resposta…
    </p>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const timeStr = message.timestamp.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <article className={cn('rounded-md border px-3 py-2.5', isUser ? 'ml-5 border-border bg-muted' : 'mr-5 border-border bg-card')}>
      <header className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold">{isUser ? 'Você' : 'Assistente'}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{timeStr}</span>
      </header>
      <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{message.content}</p>
    </article>
  );
}

export function AIAdvisor() {
  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Olá! Sou seu assistente financeiro inteligente. Posso te ajudar com:\n\n• Análise dos seus gastos\n• Dicas de economia\n• Planejamento de metas\n• Estratégias de investimento\n\nDigite sua dúvida ou use uma das sugestões abaixo!',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        throw new Error(errorData?.error || 'Erro ao conectar com o assistente.');
      }

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response || 'Não consegui processar sua mensagem. Tente novamente.',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content:
          error instanceof Error
            ? `Erro: ${error.message}`
            : 'Erro: Ocorreu um erro inesperado. Tente novamente em instantes.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

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
          <span className="flex-1 text-sm font-semibold">Assistente Financeiro IA</span>
          {isOpen ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
        </button>
      </h3>
      {isOpen && (
        <div className="border-t border-border">
          <div
            ref={scrollRef}
            role="log"
            aria-label="Conversa"
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
