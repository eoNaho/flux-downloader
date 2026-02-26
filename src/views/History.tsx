import { useState, useEffect, useRef } from "react";
import { DownloadItem } from "../store/queueStore";
import { useTranslation } from "../i18n/config";
import {
  Folder,
  Clock,
  Search,
  Trash2,
  FileVideo,
  FileAudio,
  Play,
  X,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { ProxyImage } from "../components/ProxyImage";
import { Dialog } from "../components/Dialog";

// Reads the file via tauri-plugin-fs and returns a Blob URL.
// This avoids the asset:// protocol which breaks on filenames
// containing special characters like [ ] ! & on Windows.
function useBlobSrc(filePath: string | null | undefined): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const prevUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!filePath) {
      setBlobUrl(null);
      return;
    }

    let cancelled = false;

    readFile(filePath)
      .then((bytes) => {
        if (cancelled) return;

        // Determine MIME type from extension
        const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
        const mimeMap: Record<string, string> = {
          mp4: "video/mp4",
          mkv: "video/x-matroska",
          webm: "video/webm",
          mov: "video/quicktime",
          avi: "video/x-msvideo",
          mp3: "audio/mpeg",
          m4a: "audio/mp4",
          ogg: "audio/ogg",
          wav: "audio/wav",
          flac: "audio/flac",
        };
        const mime = mimeMap[ext] ?? "application/octet-stream";

        const blob = new Blob([bytes], { type: mime });
        const url = URL.createObjectURL(blob);

        // Revoke the previous blob URL to avoid memory leaks
        if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);
        prevUrl.current = url;

        setBlobUrl(url);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to read file for playback:", err);
          setBlobUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);
    };
  }, []);

  return blobUrl;
}

// Mini player that loads the file as a blob to avoid asset:// issues
function MiniPlayer({
  item,
  onClose,
}: {
  item: DownloadItem;
  onClose: () => void;
}) {
  const blobSrc = useBlobSrc(item.exactPath);

  return (
    <div className="fixed bottom-6 right-6 w-96 bg-[#121214] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-50 animate-in slide-in-from-bottom-8 fade-in duration-300">
      <div className="bg-zinc-900/50 border-b border-white/5 p-3 flex items-center justify-between">
        <h4 className="text-sm font-bold text-white truncate pr-4">
          {item.title}
        </h4>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="w-full bg-black relative aspect-video flex items-center justify-center">
        {!blobSrc ? (
          // Loading state
          <div className="flex flex-col items-center gap-2 text-zinc-500">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Carregando...</span>
          </div>
        ) : item.isAudio ? (
          <>
            <ProxyImage
              src={item.thumbnail}
              className="absolute inset-0 w-full h-full object-cover opacity-20 blur-xl"
              alt=""
            />
            <ProxyImage
              src={item.thumbnail}
              className="w-32 h-32 object-cover rounded-xl shadow-2xl z-10"
              alt=""
            />
            <audio
              src={blobSrc}
              autoPlay
              controls
              className="absolute bottom-2 w-[90%] z-10 h-10"
            />
          </>
        ) : (
          <video
            src={blobSrc}
            autoPlay
            controls
            className="w-full h-full object-contain"
          />
        )}
      </div>
    </div>
  );
}

export function History() {
  const { t } = useTranslation();
  const [history, setHistory] = useState<DownloadItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [playingItem, setPlayingItem] = useState<DownloadItem | null>(null);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("download-history");
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    const handleStorageChange = () => {
      const stored = localStorage.getItem("download-history");
      if (stored) setHistory(JSON.parse(stored));
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("history-updated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("history-updated", handleStorageChange);
    };
  }, []);

  const handleDelete = (id: string) => {
    const newHistory = history.filter((i) => i.id !== id);
    setHistory(newHistory);
    localStorage.setItem("download-history", JSON.stringify(newHistory));
    window.dispatchEvent(new Event("history-updated"));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.setItem("download-history", "[]");
    window.dispatchEvent(new Event("history-updated"));
    setIsClearDialogOpen(false);
  };

  const filteredHistory = history
    .filter((item) =>
      item.title.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .reverse();

  return (
    <div className="flex-1 overflow-y-auto p-8 z-0">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">
              {t("history.title")}
            </h2>
            <p className="text-zinc-400">{t("history.subtitle")}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder={t("history.search_placeholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-zinc-900 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500 w-64 transition-colors"
              />
            </div>
            {history.length > 0 && (
              <button
                onClick={() => setIsClearDialogOpen(true)}
                className="text-xs text-red-400 hover:text-red-300 font-medium px-3 py-2 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                {t("history.clear_all")}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {filteredHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
              <Clock className="w-12 h-12 text-zinc-600 mb-4" />
              <p className="text-zinc-500">{t("history.empty")}</p>
            </div>
          )}

          {filteredHistory.map((item) => (
            <div
              key={item.id}
              className="bg-[#121214] border border-white/5 rounded-xl p-4 flex items-center gap-4 hover:border-white/10 transition-colors group"
            >
              <div
                className="w-32 h-20 rounded-lg overflow-hidden bg-zinc-800 relative flex-shrink-0 group-hover:shadow-lg transition-all cursor-pointer"
                onClick={() => item.exactPath && setPlayingItem(item)}
              >
                <ProxyImage
                  src={item.thumbnail}
                  alt=""
                  className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                  {item.exactPath ? (
                    <div className="w-8 h-8 rounded-full bg-purple-500/80 backdrop-blur flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-110">
                      <Play className="w-4 h-4 ml-0.5" />
                    </div>
                  ) : item.isAudio ? (
                    <FileAudio className="w-6 h-6 text-white/50" />
                  ) : (
                    <FileVideo className="w-6 h-6 text-white/50" />
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-zinc-200 truncate pr-4 text-base">
                    {item.title}
                  </h3>
                </div>

                <div className="flex items-center gap-4 text-xs text-zinc-500 mt-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    {item.resolution || "Audio"}
                  </span>
                  <span>{item.uploader}</span>
                  <span>{item.formatId}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-colors"
                  title="Remover"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button
                  onClick={async () => {
                    try {
                      await invoke("open_folder", { path: item.path });
                    } catch (e) {
                      console.error("Failed to open folder", e);
                    }
                  }}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-zinc-300 font-medium transition-colors flex items-center gap-2"
                >
                  <Folder className="w-4 h-4" />
                  {t("queue.open_folder")}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog
        isOpen={isClearDialogOpen}
        onClose={() => setIsClearDialogOpen(false)}
        title={t("history.clear_all")}
        description="Tem certeza que deseja limpar todo o histórico? Essa ação não apaga os arquivos baixados, apenas limpa a lista."
        confirmText="Limpar Histórico"
        cancelText="Cancelar"
        onConfirm={clearHistory}
        danger={true}
      />

      {/* Mini Player — uses Blob URL instead of asset:// to support special chars */}
      {playingItem && playingItem.exactPath && (
        <MiniPlayer item={playingItem} onClose={() => setPlayingItem(null)} />
      )}
    </div>
  );
}
