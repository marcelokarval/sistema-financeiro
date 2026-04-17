import { create } from 'zustand';

export type ViewType = 'dashboard' | 'accounts' | 'cards' | 'purchases' | 'categories' | 'investments' | 'installments' | 'consortiums' | 'savings';

interface AppState {
  currentView: ViewType;
  selectedAccountId: string | null;
  selectedCardId: string | null;
  selectedPurchaseId: string | null;
  selectedInvestmentId: string | null;
  selectedInstallmentPlanId: string | null;
  selectedConsortiumId: string | null;
  sidebarOpen: boolean;
  aiAssistantVisible: boolean;

  setCurrentView: (view: ViewType) => void;
  setSelectedAccountId: (id: string | null) => void;
  setSelectedCardId: (id: string | null) => void;
  setSelectedPurchaseId: (id: string | null) => void;
  setSelectedInvestmentId: (id: string | null) => void;
  setSelectedInstallmentPlanId: (id: string | null) => void;
  setSelectedConsortiumId: (id: string | null) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleAiAssistant: () => void;
  setAiAssistantVisible: (visible: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  selectedAccountId: null,
  selectedCardId: null,
  selectedPurchaseId: null,
  selectedInvestmentId: null,
  selectedInstallmentPlanId: null,
  selectedConsortiumId: null,
  sidebarOpen: false,
  aiAssistantVisible: true,

  setCurrentView: (view) => set({ currentView: view }),
  setSelectedAccountId: (id) => set({ selectedAccountId: id }),
  setSelectedCardId: (id) => set({ selectedCardId: id }),
  setSelectedPurchaseId: (id) => set({ selectedPurchaseId: id }),
  setSelectedInvestmentId: (id) => set({ selectedInvestmentId: id }),
  setSelectedInstallmentPlanId: (id) => set({ selectedInstallmentPlanId: id }),
  setSelectedConsortiumId: (id) => set({ selectedConsortiumId: id }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleAiAssistant: () => set((state) => ({ aiAssistantVisible: !state.aiAssistantVisible })),
  setAiAssistantVisible: (visible) => set({ aiAssistantVisible: visible }),
}));
