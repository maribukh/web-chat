import { create } from 'zustand';

interface UIState {
  isSidebarOpen: boolean;
  isMemberPanelOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  toggleMemberPanel: () => void;
  setMemberPanelOpen: (isOpen: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: false,
  isMemberPanelOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  toggleMemberPanel: () => set((state) => ({ isMemberPanelOpen: !state.isMemberPanelOpen })),
  setMemberPanelOpen: (isOpen) => set({ isMemberPanelOpen: isOpen }),
}));
