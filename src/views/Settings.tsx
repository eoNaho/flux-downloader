import { check } from "@tauri-apps/plugin-updater";
import { RefreshCw, Github, Download } from "lucide-react";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "../i18n/config";
import { useLanguageStore } from "../store/languageStore";

export function Settings() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguageStore();
  const [status, setStatus] = useState("Unknown");
  const [defaultPath, setDefaultPath] = useState("Not set");
  const [ytdlpVersion, setYtdlpVersion] = useState<string | null>(null);
  const [ytdlpUpdating, setYtdlpUpdating] = useState(false);
  const [ytdlpUpdateResult, setYtdlpUpdateResult] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const savedPath = localStorage.getItem("settings-default-path");
    if (savedPath) {
      setDefaultPath(savedPath);
    }
    invoke<string>("get_ytdlp_version")
      .then((v) => setYtdlpVersion(v))
      .catch(() => setYtdlpVersion("???"));
  }, []);

  const handleSelectDefaultPath = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Default Download Folder",
    });
    if (selected) {
      const path = selected as string;
      setDefaultPath(path);
      localStorage.setItem("settings-default-path", path);
    }
  };

  const checkForUpdates = async () => {
    setStatus(t("settings.checking_updates"));
    try {
      const update = await check();
      if (update?.available) {
        setStatus(`${t("settings.update_available")}: ${update.version}`);
      } else {
        setStatus(t("settings.up_to_date"));
      }
    } catch (error) {
      console.error(error);
      setStatus(t("settings.check_error"));
    }
  };

  const handleUpdateYtdlp = async () => {
    setYtdlpUpdating(true);
    setYtdlpUpdateResult(null);
    try {
      await invoke<string>("update_ytdlp");
      const newVersion = await invoke<string>("get_ytdlp_version");
      setYtdlpVersion(newVersion);
      setYtdlpUpdateResult(t("settings.ytdlp_updated"));
    } catch (e) {
      setYtdlpUpdateResult(`${t("settings.ytdlp_update_error")}: ${e}`);
    } finally {
      setYtdlpUpdating(false);
    }
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">
            {t("settings.title")}
          </h2>
          <p className="text-zinc-400">{t("settings.subtitle")}</p>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h3 className="font-medium text-zinc-200 mb-4">
            {t("settings.preferences")}
          </h3>

          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-zinc-400 block mb-2">
                {t("settings.language_label")}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setLanguage("en")}
                  className={`px-4 py-2 rounded-lg border transition-all text-sm font-medium ${
                    language === "en"
                      ? "bg-purple-500/20 border-purple-500/50 text-white"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900"
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => setLanguage("pt-br")}
                  className={`px-4 py-2 rounded-lg border transition-all text-sm font-medium ${
                    language === "pt-br"
                      ? "bg-purple-500/20 border-purple-500/50 text-white"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900"
                  }`}
                >
                  Português (BR)
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-400 block mb-2">
                {t("settings.default_path_label")}
              </label>
              <div className="flex gap-2">
                <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 truncate font-mono">
                  {defaultPath}
                </div>
                <button
                  onClick={handleSelectDefaultPath}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  <FolderOpen size={16} />
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                {t("settings.default_path_hint")}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800">
          <div className="p-6 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-zinc-200">
                {t("settings.app_version")}
              </h3>
              <p className="text-sm text-zinc-500">v0.1.0-alpha</p>
            </div>
            <button
              onClick={checkForUpdates}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <RefreshCw size={16} />
              {t("settings.check_updates")}
            </button>
          </div>
          <div className="p-6 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-zinc-200">
                {t("settings.ytdlp_version")}
              </h3>
              <p className="text-sm text-zinc-500 font-mono">
                {ytdlpVersion ?? t("settings.ytdlp_loading")}
              </p>
              {ytdlpUpdateResult && (
                <p
                  className={`text-xs mt-1 ${ytdlpUpdateResult.includes("error") || ytdlpUpdateResult.includes("Falha") ? "text-red-400" : "text-emerald-400"}`}
                >
                  {ytdlpUpdateResult}
                </p>
              )}
            </div>
            <button
              onClick={handleUpdateYtdlp}
              disabled={ytdlpUpdating}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
            >
              {ytdlpUpdating ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              {ytdlpUpdating
                ? t("settings.ytdlp_updating")
                : t("settings.ytdlp_update")}
            </button>
          </div>
          <div className="p-6 bg-zinc-950/50">
            <p className="text-sm text-zinc-400 font-mono">
              Status: <span className="text-zinc-200">{status}</span>
            </p>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h3 className="font-medium text-zinc-200 mb-4">
            {t("settings.about")}
          </h3>
          <p className="text-sm text-zinc-400 mb-4">
            {t("settings.about_text")}
          </p>
          <a
            href="https://github.com/eoNaho/flux-downloader"
            target="_blank"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
          >
            <Github size={16} />
            {t("settings.visit_github")}
          </a>
        </div>
      </div>
    </div>
  );
}
