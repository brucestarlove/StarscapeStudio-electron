import { create } from 'zustand';

export type LeftPaneTab = 'library' | 'utilities' | 'ai';
export type RightPaneTab = 'transitions' | 'effects';

interface UiState {
  leftPaneCollapsed: boolean;
  setLeftPaneCollapsed: (collapsed: boolean) => void;
  toggleLeftPane: () => void;
  activeLeftPaneTab: LeftPaneTab;
  setActiveLeftPaneTab: (tab: LeftPaneTab) => void;
  rightPaneCollapsed: boolean;
  setRightPaneCollapsed: (collapsed: boolean) => void;
  toggleRightPane: () => void;
  activeRightPaneTab: RightPaneTab;
  setActiveRightPaneTab: (tab: RightPaneTab) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  leftPaneCollapsed: false,
  setLeftPaneCollapsed: (collapsed: boolean) => set({ leftPaneCollapsed: collapsed }),
  toggleLeftPane: () => set((s) => ({ leftPaneCollapsed: !s.leftPaneCollapsed })),
  activeLeftPaneTab: 'library',
  setActiveLeftPaneTab: (tab: LeftPaneTab) => set({ activeLeftPaneTab: tab }),
  rightPaneCollapsed: true,
  setRightPaneCollapsed: (collapsed: boolean) => set({ rightPaneCollapsed: collapsed }),
  toggleRightPane: () => set((s) => ({ rightPaneCollapsed: !s.rightPaneCollapsed })),
  activeRightPaneTab: 'transitions',
  setActiveRightPaneTab: (tab: RightPaneTab) => set({ activeRightPaneTab: tab }),
}));
