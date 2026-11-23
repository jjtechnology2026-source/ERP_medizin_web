"use client";
import React from "react";
import { motion } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DashboardStatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: string;
    label: string;
    type: "up" | "down";
  };
  color?: "blue" | "emerald" | "amber" | "rose" | "indigo";
  /** Layout of the card in its grid (e.g. a full-width last cell on a phone). */
  className?: string;
}

/**
 * One dashboard statistic.
 *
 * From `lg` up it is the card it always was: 32px padding, a 36px number and a
 * 28px icon. On a phone two of these share a 390px row, so the same card is
 * rebuilt tighter instead of overflowing: 16px padding, a 20px number that can
 * wrap a long `Bs 1234567.89`, and a 20px icon. Hover motion is `lg:`-scoped
 * because a touch screen never hovers (spec S5).
 */
export function DashboardStatCard({ title, value, icon, trend, color = "blue", className }: DashboardStatCardProps) {
  const colorMap = {
    blue: "bg-blue-600 shadow-blue-200",
    emerald: "bg-emerald-500 shadow-emerald-200",
    amber: "bg-amber-500 shadow-amber-200",
    rose: "bg-rose-500 shadow-rose-200",
    indigo: "bg-indigo-600 shadow-indigo-200",
  };

  const trendColor = trend?.type === "up" ? "text-emerald-500" : "text-rose-500";

  return (
    <div
      className={cn(
        "bg-white p-4 sm:p-5 lg:p-8 rounded-3xl lg:rounded-[2.5rem] shadow-[0_15px_50px_rgba(0,0,0,0.03)] border border-slate-50 flex flex-col gap-3 lg:gap-6 group hover:shadow-[0_20px_60px_rgba(0,0,0,0.06)] transition-all duration-500 relative overflow-hidden",
        className,
      )}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="pr-10 text-slate-400 text-[10px] lg:pr-0 lg:text-xs font-black uppercase tracking-wide lg:tracking-widest">
            {title}
          </span>
          <h3 className="break-words text-lg sm:text-xl lg:text-4xl font-black tabular-nums text-slate-800 tracking-tight">
            {value}
          </h3>
        </div>
        {/* Two cards share a phone row, so the icon decorates the corner
            (`absolute`) instead of eating 40px of the number's line. From `lg`
            up it is the same right-hand tile it always was (S4). */}
        <div
          className={cn(
            "absolute right-3 top-3 flex size-8 items-center justify-center rounded-xl text-white shadow-lg [&>svg]:size-4 lg:static lg:size-auto lg:p-4 lg:rounded-2xl lg:shadow-xl lg:[&>svg]:size-7 lg:group-hover:scale-110 transition-transform duration-500",
            colorMap[color],
          )}
        >
          {React.cloneElement(icon as React.ReactElement<any>, { size: 28 })}
        </div>
      </div>

      {trend && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-auto">
          <span className={cn("font-black text-xs lg:text-sm", trendColor)}>
            {trend.type === "up" ? "↗" : "↘"} {trend.value}
          </span>
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-tighter">{trend.label}</span>
        </div>
      )}

      {/* Elemento decorativo suave */}
      <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-slate-50 rounded-full opacity-50 lg:group-hover:scale-150 transition-transform duration-700" />
    </div>
  );
}
