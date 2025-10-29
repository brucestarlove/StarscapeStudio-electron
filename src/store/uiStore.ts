import { create } from 'zustand';

export type LeftPaneTab = 'library' | 'utilities';

interface UiState {
  leftPaneCollapsed: boolean;
  setLeftPaneCollapsed: (collapsed: boolean) => void;
  toggleLeftPane: () => void;
  activeLeftPaneTab: LeftPaneTab;
  setActiveLeftPaneTab: (tab: LeftPaneTab) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  leftPaneCollapsed: false,
  setLeftPaneCollapsed: (collapsed: boolean) => set({ leftPaneCollapsed: collapsed }),
  toggleLeftPane: () => set((s) => ({ leftPaneCollapsed: !s.leftPaneCollapsed })),
  activeLeftPaneTab: 'library',
  setActiveLeftPaneTab: (tab: LeftPaneTab) => set({ activeLeftPaneTab: tab }),
}));
