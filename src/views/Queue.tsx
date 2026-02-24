import { useRef, useEffect } from "react";
import { useQueueStore, DownloadItem } from "../store/queueStore";
import {
  Play,
  CheckCircle,
  Trash2,
  Folder,
  Pause,
  Loader2,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type Event } from "@tauri-apps/api/event";
import { ProxyImage } from "../components/ProxyImage";
import { useTranslation } from "../i18n/config";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

export function Queue() {
  const { t } = useTranslation();
  const {
    items,
    removeItem,
    updateItem,
    clearCompleted,
    isProcessing,
    setProcessing,
  } = useQueueStore();
  const isProcessingRef = useRef(false);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
    if (isProcessing) {
      processQueue();
    }
  }, [isProcessing]);

  const notifyDownloadComplete = async (item: DownloadItem) => {
    try {
      let permitted = await isPermissionGranted();
      if (!permitted) {
        const result = await requestPermission();
        permitted = result === "granted";
      }
      if (permitted) {
        sendNotification({
          title: "Download Concluído ✅",
          body: `${item.title}\nSalvo com sucesso!`,
          sound: "default",
        });
      }
    } catch (e) {
      console.error("Notification error:", e);
    }
  };

  const processQueue = async () => {
    if (!isProcessingRef.current) return;

    let currentItems = useQueueStore.getState().items;
    let nextItem = currentItems.find((i) => i.status === "queued");

    while (nextItem && isProcessing) {
      const item = nextItem;

      updateItem(item.id, { status: "downloading", progress: 0 });

      try {
        const unlisten = await listen<string>(
          "download-progress",
          (event: Event<string>) => {
            const line = event.payload.trim();
            const percentageMatch = line.match(/(\d+(?:\.\d+)?)\s*%/);
            const speedMatch = line.match(/at\s+(.+?)\s+ETA/);
            const etaMatch = line.match(/ETA\s+(.+)$/);

            if (percentageMatch) {
              updateItem(item.id, {
                progress: parseFloat(percentageMatch[1]),
                speed: speedMatch ? speedMatch[1].trim() : "-",
                eta: etaMatch ? etaMatch[1].trim() : "-",
              });
            }
          },
        );

        await invoke("download_video", {
          url: item.url,
          path: item.path,
          formatId: item.formatId || null,
          isAudio: item.isAudio,
          subtitles: item.subtitles || false,
          startTime: item.startTime || null,
          endTime: item.endTime || null,
          cookiesBrowser: item.cookiesBrowser || null,
        });

        unlisten();
        updateItem(item.id, { status: "completed", progress: 100 });

        notifyDownloadComplete(item);

        try {
          const historyItem = {
            ...item,
            status: "completed" as const,
            progress: 100,
          };
          const existingJson = localStorage.getItem("download-history");
          const existing = existingJson ? JSON.parse(existingJson) : [];
          existing.push(historyItem);
          localStorage.setItem("download-history", JSON.stringify(existing));
          window.dispatchEvent(new Event("history-updated"));
        } catch (e) {
          console.error("Failed to save history", e);
        }
      } catch (e) {
        console.error(e);
        updateItem(item.id, { status: "error", error: String(e) });
      }

      currentItems = useQueueStore.getState().items;
      if (!isProcessingRef.current) break;
      nextItem = currentItems.find((i) => i.status === "queued");

      if (nextItem) await new Promise((r) => setTimeout(r, 1000));
    }

    setProcessing(false);
  };

  const stopQueue = () => {
    setProcessing(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 z-0">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">{t("queue.title")}</h2>
          {true && (
            <div className="flex gap-2">
              <button
                onClick={processQueue}
                disabled={isProcessing}
                className="text-xs font-medium text-white bg-purple-600 hover:bg-purple-500 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Play className="w-3 h-3" />
                )}
                {isProcessing ? t("queue.processing") : t("queue.start_queue")}
              </button>

              {isProcessing && (
                <button
                  onClick={stopQueue}
                  className="text-xs font-medium text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <Pause className="w-3 h-3" />
                  {t("queue.pause_queue")}
                </button>
              )}

              <button
                onClick={clearCompleted}
                className="text-xs font-medium text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                {t("queue.clear_completed")}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <DownloadItemCard
              key={item.id}
              item={item}
              onRemove={() => removeItem(item.id)}
            />
          ))}
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
              <p className="text-zinc-400 text-sm">{t("queue.empty")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DownloadItemCard({
  item,
  onRemove,
}: {
  item: DownloadItem;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const isCompleted = item.status === "completed";
  const isError = item.status === "error";

  return (
    <div className="bg-[#121214] border border-white/5 rounded-xl p-4 flex items-center gap-4 hover:border-white/10 transition-colors group">
      <div className="w-24 h-16 rounded-lg overflow-hidden bg-zinc-800 relative flex-shrink-0">
        <ProxyImage
          src={item.thumbnail}
          alt=""
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="bg-black/60 p-1 rounded-full">
            {isCompleted ? (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            ) : isError ? (
              <div className="text-red-500 font-bold text-xs">!</div>
            ) : (
              <Play className="w-4 h-4 text-white" />
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-medium text-zinc-200 truncate pr-4 text-sm">
            {item.title}
          </h4>
          <div className="flex items-center gap-3 text-xs font-mono text-zinc-500">
            <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
              {item.isAudio ? "Audio" : item.resolution}
            </span>
            <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
              {item.formatId || "Auto"}
            </span>
          </div>
        </div>

        {!isCompleted && !isError ? (
          <div className="space-y-1.5">
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 transition-all duration-500 relative"
                style={{ width: `${item.progress}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span className="text-purple-400 font-medium">
                {item.status === "queued"
                  ? t("queue.item_queued")
                  : t("queue.item_downloading")}
              </span>
              <div className="flex gap-3">
                <span>{item.speed}</span>
                <span className="text-zinc-400">ETA: {item.eta}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between mt-2">
            <span
              className={`text-xs font-medium flex items-center gap-1.5 ${
                isError ? "text-red-500" : "text-emerald-500"
              }`}
            >
              {isError ? t("queue.error") : t("queue.completed")}
            </span>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title={t("queue.open_folder")}
                onClick={async () => {
                  try {
                    await invoke("open_folder", { path: item.path });
                  } catch (e) {
                    console.error("Failed to open folder", e);
                  }
                }}
              >
                <Folder className="w-4 h-4" />
              </button>
              <button
                className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Remover"
                onClick={onRemove}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
