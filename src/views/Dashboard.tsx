import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Download,
  Link,
  Play,
  Loader2,
  ArrowRight,
  FolderOpen,
  ListPlus,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { useQueueStore } from "../store/queueStore";
import { useTranslation } from "../i18n/config";

interface Format {
  format_id: string;
  ext: string;
  resolution: string;
  fps?: number;
  filesize?: number;
}

interface PlaylistEntry {
  id: string;
  title: string;
  duration: string;
  uploader: string;
  thumbnail: string;
}

interface VideoMetadata {
  title: string;
  thumbnail: string;
  duration: string;
  uploader: string;
  formats: Format[];
  is_playlist?: boolean;
  playlist_entries?: PlaylistEntry[];
}

interface DashboardProps {
  onStartDownload: (metadata: VideoMetadata) => void;
}

import { ProxyImage } from "../components/ProxyImage";

export function Dashboard({ onStartDownload }: DashboardProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDownloading] = useState(false);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [activeTab, setActiveTab] = useState<"video" | "audio">("video");
  const [selectedFormat, setSelectedFormat] = useState<string>("");
  const savedDefaultPath = localStorage.getItem("settings-default-path");
  const [downloadPath, setDownloadPath] = useState<string>(
    savedDefaultPath || "Downloads",
  );
  const [realPath, setRealPath] = useState<string>(savedDefaultPath || ".");
  const [subtitles, setSubtitles] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [cookiesBrowser] = useState("none");

  const [selectedPlaylistItems, setSelectedPlaylistItems] = useState<
    Set<string>
  >(new Set());
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const videoUrl = (e as CustomEvent).detail;
      if (videoUrl && typeof videoUrl === "string") {
        setUrl(videoUrl);
        analyzeUrl(videoUrl);
      }
    };
    window.addEventListener("external-url", handler);
    return () => window.removeEventListener("external-url", handler);
  }, []);

  const analyzeUrl = async (targetUrl: string) => {
    if (!targetUrl) return;
    setIsAnalyzing(true);
    setMetadata(null);
    setShowPlaylistModal(false);

    try {
      const data = await invoke<VideoMetadata>("get_video_metadata", {
        url: targetUrl,
      });
      setMetadata(data);

      if (data.is_playlist && data.playlist_entries) {
        const allIds = new Set(data.playlist_entries.map((e) => e.id));
        setSelectedPlaylistItems(allIds);
        setShowPlaylistModal(true);
      } else {
        const bestVideo = data.formats
          .slice()
          .reverse()
          .find((f) => f.resolution !== "Audio Only");
        if (bestVideo) setSelectedFormat(bestVideo.format_id);
        else if (data.formats.length > 0)
          setSelectedFormat(data.formats[data.formats.length - 1].format_id);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to analyze video: " + error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = () => analyzeUrl(url);

  const handleSelectPath = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Download Folder",
    });
    if (selected) {
      setRealPath(selected as string);
      setDownloadPath(selected as string);
    }
  };

  const handleDownload = async () => {
    if (!url || !metadata) return;

    const isAudio = activeTab === "audio";

    let resLabel = "Unknown";
    const fmt = metadata.formats.find((f) => f.format_id === selectedFormat);
    if (fmt) resLabel = isAudio ? "Audio" : fmt.resolution;

    useQueueStore.getState().addItem({
      url,
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      duration: metadata.duration,
      uploader: metadata.uploader,
      formatId: selectedFormat || null,
      isAudio: isAudio,
      resolution: resLabel,
      path: realPath,
      subtitles: subtitles,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      cookiesBrowser: cookiesBrowser !== "none" ? cookiesBrowser : undefined,
    });

    useQueueStore.getState().setProcessing(true);
    onStartDownload(metadata);
    setMetadata(null);
    setUrl("");
  };

  const handleAddToQueue = () => {
    if (!metadata) return;
    const isAudio = activeTab === "audio";

    let resLabel = "Unknown";
    const fmt = metadata.formats.find((f) => f.format_id === selectedFormat);
    if (fmt) resLabel = isAudio ? "Audio" : fmt.resolution;

    useQueueStore.getState().addItem({
      url,
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      duration: metadata.duration,
      uploader: metadata.uploader,
      formatId: selectedFormat || null,
      isAudio,
      resolution: resLabel,
      path: realPath,
      subtitles,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      cookiesBrowser: cookiesBrowser !== "none" ? cookiesBrowser : undefined,
    });
    alert(t("dashboard.add_to_queue") + "!");
  };

  const handlePlaylistBatchQueue = () => {
    if (!metadata || !metadata.playlist_entries) return;
    const isAudio = activeTab === "audio";

    const selectedEntries = metadata.playlist_entries.filter((e) =>
      selectedPlaylistItems.has(e.id),
    );

    selectedEntries.forEach((entry) => {
      useQueueStore.getState().addItem({
        url: `https://www.youtube.com/watch?v=${entry.id}`, // Reconstruct URL
        title: entry.title,
        thumbnail: entry.thumbnail,
        duration: entry.duration,
        uploader: entry.uploader,
        formatId: null, // Let backend decide best for batch
        isAudio, // Apply global preference
        resolution: isAudio ? "Audio" : "Auto",
        path: realPath,
        subtitles,
        cookiesBrowser: cookiesBrowser !== "none" ? cookiesBrowser : undefined,
      });
    });

    alert(`Added ${selectedEntries.length} items to Queue!`);
    setShowPlaylistModal(false);
    setMetadata(null);
    setUrl("");
  };

  const videoFormats =
    metadata?.formats?.filter(
      (f) => f.resolution !== "Audio Only" && f.resolution !== "Unknown",
    ) || [];

  const audioFormats =
    metadata?.formats
      ?.filter((f) => f.resolution === "Audio Only")
      .slice()
      .reverse() || [];

  const displayFormats =
    activeTab === "video"
      ? videoFormats
          .slice()
          .reverse()
          .filter(
            (v, i, a) =>
              a.findIndex(
                (t) => t.resolution === v.resolution && t.ext === v.ext,
              ) === i,
          )
          .slice(0, 10)
      : audioFormats.slice(0, 10);

  return (
    <div className="flex-1 overflow-y-auto p-8 z-0 relative">
      <div className="max-w-4xl mx-auto mt-10">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500 mb-4">
            {t("dashboard.title")}
          </h2>
          <p className="text-zinc-500 text-lg">{t("dashboard.subtitle")}</p>
        </div>

        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-2 shadow-2xl shadow-black/50 backdrop-blur-xl mb-12 transform hover:scale-[1.01] transition-transform duration-300">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="flex-1 relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                <Link className="w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder={t("dashboard.input_placeholder")}
                className="w-full h-14 bg-transparent border-none pl-12 pr-4 text-white placeholder:text-zinc-600 focus:outline-none text-lg font-medium"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !url}
              className={clsx(
                "h-14 px-8 rounded-xl font-bold text-white transition-all duration-300 flex items-center justify-center gap-2 min-w-[160px]",
                isAnalyzing
                  ? "bg-zinc-800 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg hover:shadow-purple-500/25 active:scale-95",
              )}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t("dashboard.analyzing")}</span>
                </>
              ) : (
                <>
                  <span>{t("dashboard.analyze_button")}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {showPlaylistModal && metadata?.playlist_entries && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#121214] border border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-zinc-900/50">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <ListPlus className="w-5 h-5 text-purple-500" />
                    {t("dashboard_playlist.select_videos_title")}
                  </h3>
                  <p className="text-zinc-400 text-sm mt-1">
                    {metadata.title} • {metadata.playlist_entries.length}{" "}
                    {t("dashboard_playlist.videos_found")}
                  </p>
                </div>
                <button
                  onClick={() => setShowPlaylistModal(false)}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <div className="flex items-center justify-between mb-4 px-2">
                  <button
                    onClick={() => {
                      if (
                        selectedPlaylistItems.size ===
                        metadata.playlist_entries!.length
                      ) {
                        setSelectedPlaylistItems(new Set());
                      } else {
                        const all = new Set(
                          metadata.playlist_entries!.map((e) => e.id),
                        );
                        setSelectedPlaylistItems(all);
                      }
                    }}
                    className="text-sm font-medium text-purple-400 hover:text-purple-300 flex items-center gap-2"
                  >
                    {selectedPlaylistItems.size ===
                    metadata.playlist_entries.length ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    {selectedPlaylistItems.size ===
                    metadata.playlist_entries.length
                      ? t("dashboard_playlist.unselect_all")
                      : t("dashboard_playlist.select_all")}
                  </button>
                  <span className="text-sm text-zinc-500">
                    {selectedPlaylistItems.size}{" "}
                    {t("dashboard_playlist.selected")}
                  </span>
                </div>

                {metadata.playlist_entries.map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => {
                      const newSet = new Set(selectedPlaylistItems);
                      if (newSet.has(entry.id)) newSet.delete(entry.id);
                      else newSet.add(entry.id);
                      setSelectedPlaylistItems(newSet);
                    }}
                    className={clsx(
                      "flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all",
                      selectedPlaylistItems.has(entry.id)
                        ? "bg-purple-500/10 border-purple-500/50"
                        : "bg-zinc-900/50 border-white/5 hover:border-white/10",
                    )}
                  >
                    <div
                      className={clsx(
                        "w-5 h-5 rounded-md border flex items-center justify-center transition-colors",
                        selectedPlaylistItems.has(entry.id)
                          ? "bg-purple-500 border-purple-500"
                          : "border-zinc-600",
                      )}
                    >
                      {selectedPlaylistItems.has(entry.id) && (
                        <CheckSquare className="w-3.5 h-3.5 text-white" />
                      )}
                    </div>

                    <ProxyImage
                      src={entry.thumbnail}
                      className="w-16 h-10 object-cover rounded bg-black"
                      alt=""
                    />

                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-zinc-200 truncate">
                        {entry.title}
                      </h4>
                      <p className="text-xs text-zinc-500">
                        {entry.uploader} • {entry.duration}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 border-t border-white/5 bg-zinc-900/50 flex justify-between items-center">
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab("video")}
                    className={clsx(
                      "text-sm font-bold",
                      activeTab === "video" ? "text-white" : "text-zinc-500",
                    )}
                  >
                    {t("dashboard.video_tab")}
                  </button>
                  <button
                    onClick={() => setActiveTab("audio")}
                    className={clsx(
                      "text-sm font-bold",
                      activeTab === "audio" ? "text-white" : "text-zinc-500",
                    )}
                  >
                    {t("dashboard.audio_tab")}
                  </button>
                </div>

                <button
                  onClick={handlePlaylistBatchQueue}
                  disabled={selectedPlaylistItems.size === 0}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <ListPlus className="w-4 h-4" />
                  {t("dashboard.add_to_queue")}
                </button>
              </div>
            </div>
          </div>
        )}

        {metadata && !showPlaylistModal && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="bg-[#121214] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <div className="flex flex-col md:flex-row">
                <div className="w-full md:w-80 h-48 md:h-auto relative group">
                  <ProxyImage
                    src={metadata.thumbnail}
                    alt="Thumbnail"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-110">
                      <Play className="w-6 h-6 ml-1" />
                    </div>
                  </div>
                  <div className="absolute bottom-3 right-3 bg-black/80 px-2 py-1 rounded text-xs font-bold text-white backdrop-blur-md">
                    {metadata.duration}
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white leading-tight line-clamp-2">
                      {metadata.title}
                    </h3>
                    <p className="text-zinc-400 mt-1 flex items-center gap-2 text-sm">
                      <span className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold">
                        A
                      </span>
                      {metadata.uploader}
                    </p>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="flex items-center gap-4 border-b border-white/10 pb-2 mb-4">
                      <button
                        onClick={() => {
                          setActiveTab("video");
                          if (videoFormats.length > 0)
                            setSelectedFormat(videoFormats[0].format_id);
                        }}
                        className={clsx(
                          "text-sm font-bold pb-2 -mb-2.5 transition-colors",
                          activeTab === "video"
                            ? "text-white border-b-2 border-purple-500"
                            : "text-zinc-500 hover:text-white",
                        )}
                      >
                        {t("dashboard.video_tab")}
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab("audio");
                          if (audioFormats.length > 0)
                            setSelectedFormat(audioFormats[0].format_id);
                        }}
                        className={clsx(
                          "text-sm font-bold pb-2 -mb-2.5 transition-colors",
                          activeTab === "audio"
                            ? "text-white border-b-2 border-purple-500"
                            : "text-zinc-500 hover:text-white",
                        )}
                      >
                        {t("dashboard.audio_tab")}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col">
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block tracking-wider">
                          {t("dashboard.resolutions_label")}
                        </label>
                        <div className="relative">
                          <select
                            value={selectedFormat}
                            onChange={(e) => setSelectedFormat(e.target.value)}
                            className="w-full bg-zinc-900 border border-white/10 rounded-lg h-10 pl-3 pr-8 text-sm text-white focus:border-purple-500 focus:outline-none appearance-none cursor-pointer hover:border-white/20 transition-colors"
                          >
                            {displayFormats.length === 0 && (
                              <option disabled>
                                {t("dashboard.no_formats")}
                              </option>
                            )}
                            {displayFormats.map((f) => (
                              <option key={f.format_id} value={f.format_id}>
                                {activeTab === "video" ? f.resolution : "Áudio"}{" "}
                                • {f.ext.toUpperCase()}{" "}
                                {f.filesize
                                  ? `(${Math.round(
                                      f.filesize / 1024 / 1024,
                                    )}MB)`
                                  : ""}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-500">
                            <ArrowRight className="h-4 w-4 rotate-90" />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block tracking-wider">
                          {t("dashboard.save_path_label")}
                        </label>
                        <button
                          onClick={handleSelectPath}
                          className="w-full bg-zinc-900 border border-white/10 rounded-lg h-10 px-3 text-sm text-zinc-300 flex items-center justify-between hover:border-white/20 transition-colors group"
                        >
                          <span className="truncate flex-1 text-left">
                            {downloadPath.split(/[\\/]/).pop()}
                          </span>
                          <FolderOpen className="w-4 h-4 text-zinc-500 group-hover:text-purple-400" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 pt-2">
                      <label className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white cursor-pointer transition-colors select-none">
                        <input
                          type="checkbox"
                          checked={subtitles}
                          onChange={(e) => setSubtitles(e.target.checked)}
                          className="w-4 h-4 rounded border-white/20 bg-zinc-800 text-purple-600 focus:ring-purple-500 accent-purple-500"
                        />
                        {t("dashboard.subtitles_label")}
                      </label>

                      <div className="flex items-center gap-2">
                        <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                          {t("dashboard.trimming_label")}:
                        </div>
                        <input
                          type="text"
                          placeholder={t("dashboard.start_time_placeholder")}
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="bg-zinc-900 border border-white/10 rounded-lg h-8 px-2 text-xs text-white w-24 focus:border-purple-500 outline-none"
                        />
                        <span className="text-zinc-500">-</span>
                        <input
                          type="text"
                          placeholder={t("dashboard.end_time_placeholder")}
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="bg-zinc-900 border border-white/10 rounded-lg h-8 px-2 text-xs text-white w-24 focus:border-purple-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 gap-3">
                      <button
                        onClick={handleAddToQueue}
                        className="h-10 px-6 bg-zinc-800 text-white font-bold rounded-lg hover:bg-zinc-700 transition-colors flex items-center gap-2 active:scale-95 border border-white/10"
                      >
                        <ListPlus className="w-4 h-4" />
                        {t("dashboard.add_to_queue")}
                      </button>

                      <button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="h-10 px-6 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-colors flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDownloading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        {isDownloading
                          ? t("dashboard.downloading")
                          : t("dashboard.download_now")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
