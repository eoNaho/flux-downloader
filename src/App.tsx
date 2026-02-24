import { useState, useEffect } from "react";
import "./App.css";
import { Sidebar } from "./components/Sidebar";
import { useQueueStore } from "./store/queueStore";
import { Dashboard } from "./views/Dashboard";
import { Queue } from "./views/Queue";
import { Settings } from "./views/Settings";
import { History } from "./views/History";
import { Titlebar } from "./components/Titlebar";
import { listen } from "@tauri-apps/api/event";

export interface DownloadItem {
  id: number;
  title: string;
  thumbnail: string;
  status: "waiting" | "downloading" | "completed" | "error";
  progress: number; // 0-100
  size: string;
  speed: string;
  eta: string;
  format: string;
  quality: string;
}

function App() {
  const [currentView, setCurrentView] = useState("dashboard");
  const queueCount = useQueueStore(
    (state) =>
      state.items.filter(
        (i) => i.status === "queued" || i.status === "downloading",
      ).length,
  );

  useEffect(() => {
    const unlisten = listen<string>("deep-link-url", (event) => {
      try {
        const deepUrl = new URL(event.payload);
        const videoUrl = deepUrl.searchParams.get("url");
        if (videoUrl) {
          setCurrentView("dashboard");
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent("external-url", { detail: videoUrl }),
            );
          }, 100);
        }
      } catch (e) {
        console.error("Failed to parse deep link:", e);
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const navigateToQueue = () => {
    setCurrentView("queue");
  };

  return (
    <div className="flex w-screen h-screen bg-black text-zinc-100 font-sans selection:bg-purple-500/30 overflow-hidden pt-8">
      <Titlebar />
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        queueCount={queueCount}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950 relative">
        <div className="absolute top-20 left-20 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />
        <div className="absolute top-32 left-32 h-96 w-96 rounded-full bg-purple-500/10 blur-[80px] pointer-events-none" />

        <div className="absolute bottom-20 right-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-32 right-32 h-96 w-96 rounded-full bg-blue-500/10 blur-[80px] pointer-events-none" />

        {currentView === "dashboard" && (
          <Dashboard onStartDownload={navigateToQueue} />
        )}
        {currentView === "queue" && <Queue />}
        {currentView === "history" && <History />}
        {currentView === "settings" && <Settings />}
      </main>
    </div>
  );
}

export default App;
