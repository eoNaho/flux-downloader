import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { useState } from "react";

export function Titlebar() {
  const appWindow = getCurrentWindow();
  const [isMaximized, setIsMaximized] = useState(false);

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = async () => {
    await appWindow.toggleMaximize();
    setIsMaximized(!isMaximized);
  };
  const handleClose = () => appWindow.close();

  return (
    <div
      data-tauri-drag-region
      className="h-8 bg-[#0c0c0e] flex items-center justify-between pl-4 select-none fixed top-0 left-0 right-0 z-50 border-b border-white/5"
    >
      <span className="text-xs font-bold text-zinc-500 pointer-events-none">
        Flux Downloader
      </span>
      <div className="flex">
        <button
          onClick={handleMinimize}
          className="h-8 w-10 inline-flex items-center justify-center hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-8 w-10 inline-flex items-center justify-center hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
        >
          <Square size={12} className={isMaximized ? "fill-current" : ""} />
        </button>
        <button
          onClick={handleClose}
          className="h-8 w-10 inline-flex items-center justify-center hover:bg-red-500 hover:text-white text-zinc-400 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
