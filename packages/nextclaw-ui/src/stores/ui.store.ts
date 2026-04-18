import { create } from 'zustand';

interface UiState {
  // Channel modal
  channelModal: { open: boolean; channel?: string };
  openChannelModal: (channel?: string) => void;
  closeChannelModal: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  channelModal: { open: false },
  openChannelModal: (channel) => set({ channelModal: { open: true, channel } }),
  closeChannelModal: () => set({ channelModal: { open: false } })
}));
