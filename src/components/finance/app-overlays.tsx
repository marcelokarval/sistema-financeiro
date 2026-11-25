'use client';

import type { RefObject } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIAdvisor } from '@/components/finance/ai-advisor';
import { GlobalSearch, type SearchResultType } from '@/components/finance/global-search';

export interface AppOverlaysProps {
  advisorDialogRef: RefObject<HTMLDialogElement | null>;
  aiAssistantVisible: boolean;
  advisorOpened: boolean;
  onCloseAdvisor: () => void;
  onAdvisorDialogClose: () => void;
  showSearch: boolean;
  onCloseSearch: () => void;
  onSelectSearch: (type: SearchResultType, id: string, meta?: { accountId?: string }) => void;
}

/** Shell overlays hosting the on-demand AI advisor dialog and the global search dialog. */
export function AppOverlays({
  advisorDialogRef,
  aiAssistantVisible,
  advisorOpened,
  onCloseAdvisor,
  onAdvisorDialogClose,
  showSearch,
  onCloseSearch,
  onSelectSearch,
}: AppOverlaysProps) {
  return (
    <>
      <dialog
        ref={advisorDialogRef}
        inert={!aiAssistantVisible}
        aria-labelledby="advisor-title"
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg border border-border bg-card p-4 text-card-foreground shadow-lg backdrop:bg-black/50"
        onCancel={(event) => {
          event.preventDefault();
          onCloseAdvisor();
        }}
        onClose={onAdvisorDialogClose}
      >
        <h2 id="advisor-title" className="sr-only">Assistente financeiro IA</h2>
        <div className="mb-2 flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Fechar assistente financeiro"
            onClick={onCloseAdvisor}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        {(advisorOpened || aiAssistantVisible) && <AIAdvisor />}
      </dialog>

      <GlobalSearch
        isOpen={showSearch}
        onClose={onCloseSearch}
        onSelect={onSelectSearch}
      />
    </>
  );
}
