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
}

export function DashboardStatCard({ title, value, icon, trend, color = "blue" }: DashboardStatCardProps) {
  const colorMap = {
    blue: "bg-blue-600 shadow-blue-200",
    emerald: "bg-emerald-500 shadow-emerald-200",
    amber: "bg-amber-500 shadow-amber-200",
    rose: "bg-rose-500 shadow-rose-200",
    indigo: "bg-indigo-600 shadow-indigo-200",
  };

  const trendColor = trend?.type === "up" ? "text-emerald-500" : "text-rose-500";

  return (
    <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-[0_15px_50px_rgba(0,0,0,0.03)] border border-slate-50 flex flex-col gap-6 group hover:shadow-[0_20px_60px_rgba(0,0,0,0.06)] transition-all duration-500 relative overflow-hidden">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <span className="text-slate-400 text-xs font-black uppercase tracking-widest">{title}</span>
          <h3 className="text-4xl font-black text-slate-800 tracking-tight">{value}</h3>
        </div>
        <div className={cn("p-4 rounded-2xl text-white shadow-xl group-hover:scale-110 transition-transform duration-500", colorMap[color])}>
          {React.cloneElement(icon as React.ReactElement<any>, { size: 28 })}
        </div>
      </div>

      {trend && (
        <div className="flex items-center gap-2 mt-auto">
          <span className={cn("font-black text-sm", trendColor)}>
            {trend.type === "up" ? "↗" : "↘"} {trend.value}
          </span>
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-tighter">{trend.label}</span>
        </div>
      )}

      {/* Elemento decorativo suave */}
      <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-slate-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700" />
    </div>
  );
}
