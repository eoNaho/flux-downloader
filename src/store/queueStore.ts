import { create } from "zustand";

export interface DownloadItem {
  id: string; // unique ID
  url: string;
  title: string;
  thumbnail: string;
  duration: string;
  uploader: string;
  formatId: string | null;
  isAudio: boolean;
  resolution: string; // for display
  subtitles?: boolean;
  startTime?: string;
  endTime?: string;
  cookiesBrowser?: string; // "chrome", "edge", etc.
  path: string;
  status: "queued" | "downloading" | "completed" | "error" | "paused";
  progress: number;
  speed: string;
  eta: string;
  error?: string;
  exactPath?: string; // the actual file path of the completed download
}

interface QueueState {
  items: DownloadItem[];
  addItem: (
    item: Omit<DownloadItem, "id" | "status" | "progress" | "speed" | "eta">,
  ) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<DownloadItem>) => void;
  clearCompleted: () => void;
  isProcessing: boolean;
  setProcessing: (processing: boolean) => void;
  startQueue: () => void; // Placeholder
}

export const useQueueStore = create<QueueState>((set) => ({
  items: [],
  addItem: (item) =>
    set((state) => ({
      items: [
        ...state.items,
        {
          ...item,
          id: Math.random().toString(36).substring(7), // Simple ID
          status: "queued",
          progress: 0,
          speed: "0 GiB/s",
          eta: "00:00",
        },
      ],
    })),
  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    })),
  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    })),
  clearCompleted: () =>
    set((state) => ({
      items: state.items.filter((i) => i.status !== "completed"),
    })),
  isProcessing: false,
  setProcessing: (processing) => set({ isProcessing: processing }),
  startQueue: () => {
    console.log("Start queue triggered");
  },
}));
