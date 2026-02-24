import { useState, useEffect } from "react";
import { DownloadItem } from "../store/queueStore";
import { useTranslation } from "../i18n/config";
import {
  Folder,
  Clock,
  Search,
  Trash2,
  FileVideo,
  FileAudio,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { ProxyImage } from "../components/ProxyImage";

export function History() {
  const { t } = useTranslation();
  const [history, setHistory] = useState<DownloadItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

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
    if (confirm("Are you sure you want to clear history?")) {
      setHistory([]);
      localStorage.setItem("download-history", "[]");
      window.dispatchEvent(new Event("history-updated"));
    }
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
                onClick={clearHistory}
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
              <div className="w-32 h-20 rounded-lg overflow-hidden bg-zinc-800 relative flex-shrink-0">
                <ProxyImage
                  src={item.thumbnail}
                  alt=""
                  className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  {item.isAudio ? (
                    <FileAudio className="w-6 h-6 text-white" />
                  ) : (
                    <FileVideo className="w-6 h-6 text-white" />
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-zinc-200 truncate pr-4 text-base">
                    {item.title}
                  </h3>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-zinc-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
          ))}
        </div>
      </div>
    </div>
  );
}
