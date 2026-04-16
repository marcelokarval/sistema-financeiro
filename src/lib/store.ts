import { create } from 'zustand';

export type ViewType = 'dashboard' | 'accounts' | 'cards' | 'purchases' | 'categories';

interface AppState {
  currentView: ViewType;
  selectedAccountId: string | null;
  selectedCardId: string | null;
  selectedPurchaseId: string | null;
  sidebarOpen: boolean;

  setCurrentView: (view: ViewType) => void;
  setSelectedAccountId: (id: string | null) => void;
  setSelectedCardId: (id: string | null) => void;
  setSelectedPurchaseId: (id: string | null) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  selectedAccountId: null,
  selectedCardId: null,
  selectedPurchaseId: null,
  sidebarOpen: false,

  setCurrentView: (view) => set({ currentView: view }),
  setSelectedAccountId: (id) => set({ selectedAccountId: id }),
  setSelectedCardId: (id) => set({ selectedCardId: id }),
  setSelectedPurchaseId: (id) => set({ selectedPurchaseId: id }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
