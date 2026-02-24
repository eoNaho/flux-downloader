import React from "react";
import {
  Download,
  Link,
  List,
  Settings,
  Clock,
} from "lucide-react";
import { clsx } from "clsx";
import { useTranslation } from "../i18n/config";

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  queueCount?: number;
}

export function Sidebar({
  currentView,
  onViewChange,
  queueCount = 0,
}: SidebarProps) {
  const { t } = useTranslation();

  const navItems = [
    { id: "dashboard", label: t("sidebar.dashboard"), icon: Link },
    { id: "queue", label: t("sidebar.queue"), icon: List, badge: queueCount },
    { id: "history", label: t("sidebar.history"), icon: Clock },
  ];

  return (
    <aside className="w-20 lg:w-64 bg-[#0c0c0e] border-r border-white/5 flex flex-col justify-between py-6 transition-all duration-300 ease-in-out">
      <div>
        <div className="flex items-center gap-3 px-6 mb-10 overflow-hidden">
          <div className="min-w-[32px] w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <Download className="w-5 h-5 text-white" />
          </div>
          <span className="hidden lg:block font-bold text-lg tracking-tight text-white whitespace-nowrap">
            Flux Downloader
          </span>
        </div>

        <nav className="space-y-2 px-3">
          {navItems.map((item) => (
            <NavButton
              key={item.id}
              active={currentView === item.id}
              icon={<item.icon size={20} />}
              label={item.label}
              badge={item.badge}
              onClick={() => onViewChange(item.id)}
            />
          ))}
        </nav>
      </div>

      <div className="px-3 border-t border-white/5 pt-6">
        <NavButton
          active={currentView === "settings"}
          icon={<Settings size={20} />}
          label={t("sidebar.settings")}
          onClick={() => onViewChange("settings")}
        />
      </div>
    </aside>
  );
}

interface NavButtonProps {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  active?: boolean;
  onClick: () => void;
}

function NavButton({ icon, label, badge, active, onClick }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={clsx(
        "relative w-full flex items-center rounded-xl transition-all duration-200 group h-11",
        "lg:px-4 justify-center lg:justify-start",
        active
          ? "bg-white/[0.08] text-white"
          : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200",
      )}
    >
      {active && (
        <div className="absolute left-0 w-1 h-5 bg-purple-500 rounded-r-full" />
      )}

      <div
        className={clsx(
          "relative flex items-center justify-center transition-colors",
          active ? "text-purple-400" : "group-hover:text-zinc-200",
        )}
      >
        {icon}

        {badge ? (
          <span className="absolute -top-1.5 -right-1.5 flex lg:hidden w-4 h-4 bg-purple-600 text-[9px] font-bold rounded-full border-2 border-[#0c0c0e] items-center justify-center text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </div>

      <span
        className={clsx(
          "hidden lg:block ml-3 text-sm font-medium transition-opacity duration-300 whitespace-nowrap",
          active ? "text-white" : "text-zinc-400 group-hover:text-zinc-200",
        )}
      >
        {label}
      </span>

      {badge ? (
        <span className="hidden lg:flex ml-auto w-5 h-5 bg-purple-600/20 text-purple-400 text-[10px] font-bold rounded-md items-center justify-center border border-purple-500/30">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
