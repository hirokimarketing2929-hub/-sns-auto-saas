"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Brain, Search, Sparkles, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

export interface ResearchLogEntry {
  id: string;
  type: "thinking" | "searching" | "analyzing" | "complete";
  message: string;
  timestamp: number;
  detail?: string;
}

const iconMap = {
  thinking: Brain,
  searching: Search,
  analyzing: Sparkles,
  complete: CheckCircle2,
};

const labelMap = {
  thinking: "思考中",
  searching: "リサーチ中",
  analyzing: "分析中",
  complete: "完了",
};

const colorMap = {
  thinking: "text-purple-400",
  searching: "text-blue-400",
  analyzing: "text-amber-400",
  complete: "text-emerald-400",
};

interface ThinkingLogProps {
  logs: ResearchLogEntry[];
  isActive: boolean;
  className?: string;
}

export function ThinkingLog({ logs, isActive, className }: ThinkingLogProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isExpanded]);

  if (logs.length === 0 && !isActive) return null;

  return (
    <div className={cn("glass rounded-2xl overflow-hidden transition-all duration-300", className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Brain className="size-4 text-purple-400" />
            {isActive && (
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-purple-400 animate-thinking-pulse" />
            )}
          </div>
          <span className="text-sm font-medium text-foreground/90">思考プロセス</span>
          {logs.length > 0 && (
            <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-white/5">
              {logs.length} ステップ
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>

      {isExpanded && (
        <div ref={scrollRef} className="max-h-64 overflow-y-auto px-5 pb-4 space-y-2 custom-scrollbar">
          {logs.map((entry, index) => {
            const Icon = iconMap[entry.type];
            return (
              <div key={entry.id} className="animate-slide-in-log flex items-start gap-3 py-2" style={{ animationDelay: `${index * 50}ms` }}>
                <div className="flex flex-col items-center pt-0.5">
                  <Icon className={cn("size-3.5", colorMap[entry.type])} />
                  {index < logs.length - 1 && <div className="w-px h-full min-h-4 bg-white/10 mt-1" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-medium", colorMap[entry.type])}>{labelMap[entry.type]}</span>
                    <span className="text-[10px] text-muted-foreground/50">
                      {new Date(entry.timestamp).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/70 mt-0.5 leading-relaxed">{entry.message}</p>
                  {entry.detail && <p className="text-xs text-muted-foreground/60 mt-1 font-mono">{entry.detail}</p>}
                </div>
              </div>
            );
          })}
          {isActive && (
            <div className="flex items-center gap-3 py-2 animate-slide-in-log">
              <div className="flex gap-1 pt-0.5 pl-0.5">
                <span className="size-1.5 rounded-full bg-purple-400 animate-thinking-dot-1" />
                <span className="size-1.5 rounded-full bg-purple-400 animate-thinking-dot-2" />
                <span className="size-1.5 rounded-full bg-purple-400 animate-thinking-dot-3" />
              </div>
              <span className="text-xs text-muted-foreground">処理中...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
