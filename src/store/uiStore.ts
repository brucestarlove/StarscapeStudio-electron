import { create } from 'zustand';

interface UiState {
  leftPaneCollapsed: boolean;
  setLeftPaneCollapsed: (collapsed: boolean) => void;
  toggleLeftPane: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  leftPaneCollapsed: false,
  setLeftPaneCollapsed: (collapsed: boolean) => set({ leftPaneCollapsed: collapsed }),
  toggleLeftPane: () => set((s) => ({ leftPaneCollapsed: !s.leftPaneCollapsed })),
}));
