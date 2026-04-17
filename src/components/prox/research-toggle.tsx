"use client";

import { cn } from "@/lib/utils";
import { Zap, Globe } from "lucide-react";

interface ResearchToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  className?: string;
}

export function ResearchToggle({ enabled, onToggle, className }: ResearchToggleProps) {
  return (
    <button
      onClick={() => onToggle(!enabled)}
      className={cn(
        "group relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
        enabled ? "glass-strong glow-prox" : "glass hover:bg-white/8",
        className
      )}
    >
      <div className={cn(
        "relative flex items-center justify-center size-9 rounded-lg transition-all duration-300",
        enabled ? "gradient-prox shadow-lg" : "bg-white/10"
      )}>
        <Globe className={cn("size-4 transition-all duration-300", enabled ? "text-white" : "text-muted-foreground")} />
        {enabled && <Zap className="absolute -top-1 -right-1 size-3 text-amber-400 animate-thinking-pulse" />}
      </div>
      <div className="flex flex-col items-start">
        <span className={cn("text-sm font-medium transition-colors", enabled ? "text-foreground" : "text-foreground/70")}>
          リアルタイムリサーチ
        </span>
        <span className="text-[11px] text-muted-foreground">
          {enabled ? "Xトレンドを自動検索" : "オフ: 固定プロンプトのみ"}
        </span>
      </div>
      <div className={cn("ml-auto relative w-11 h-6 rounded-full transition-all duration-300", enabled ? "gradient-prox" : "bg-white/10")}>
        <div className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow-md transition-all duration-300", enabled ? "left-[22px]" : "left-0.5")} />
      </div>
    </button>
  );
}
