import type { ReactNode } from "react";

export function TerminalCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`challenge-terminal-card ${className}`.trim()}>
      <div className="flex items-center gap-2 border-b border-white/8 bg-black/35 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#FD8305]/85" />
          <span className="h-3 w-3 rounded-full bg-[#fb923c]/85" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/85" />
        </div>
        <span className="ml-2 truncate font-tech-mono text-xs text-slate-500">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
