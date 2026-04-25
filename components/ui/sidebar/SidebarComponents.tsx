"use client";
import React from "react";
import Link from "next/link";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { MenuItem } from "./menuConstants";
import { HiChevronDown } from "react-icons/hi";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function SidebarItem({
  item,
  isExpanded,
  active,
  isOpen,
  onToggle,
  onCollapse,
  onClick,
}: {
  item: MenuItem;
  isExpanded: boolean;
  active: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  onCollapse?: () => void; 
  onClick?: () => void;
}) {
  const hasChildren = item.children && item.children.length > 0;
  const isFooter = item.isFooter;

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick();
      return;
    }
    if (isFooter) {
      return;
    }
    if (!isExpanded && onCollapse) {
      onCollapse();
      if (hasChildren && onToggle) onToggle();
    } else if (onToggle) {
      onToggle();
    }
  };

  const content = (
    <div
      className={cn(
        "relative flex items-center gap-4 px-6 py-4 transition-all group overflow-hidden cursor-pointer",
        !isExpanded && "px-0 justify-center h-16",
        isFooter ? "border-t border-slate-100 mt-auto" : "",
        active && !hasChildren ? "bg-blue-50/50 text-blue-700" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/50",
        item.isHeader && "cursor-default hover:bg-transparent hover:text-slate-600"
      )}
      onClick={handleClick}
    >
      {/* Active Indicator */}
      {active && !hasChildren && (
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-1.5 bg-blue-600 rounded-r-full shadow-[4px_0_15px_rgba(37,99,235,0.2)]",
            !isExpanded && "w-2",
          )}
        />
      )}

      <div className={cn("transition-all duration-300 shrink-0", active ? "scale-110 text-slate-900" : "group-hover:scale-110 text-slate-900")}>
        {item.icon &&
          React.cloneElement(item.icon as React.ReactElement<any>, {
            size: isExpanded ? 22 : 28,
            strokeWidth: 2.5,
          })}
      </div>

      {isExpanded && (
        <>
          <span
            className={cn(
              "text-sm font-black tracking-tight whitespace-nowrap transition-all duration-300 flex-1",
              active ? "opacity-100" : "opacity-70 group-hover:opacity-100",
            )}
          >
            {item.name}
          </span>
          {hasChildren && <HiChevronDown size={18} className={cn("transition-transform duration-300", isOpen && "rotate-180")} />}
        </>
      )}

      {/* Mini Tooltip for Collapsed State */}
      {!isExpanded && (
        <div className="absolute left-full ml-4 px-4 py-2 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all pointer-events-none z-50 whitespace-nowrap shadow-xl">
          {item.name}
        </div>
      )}
    </div>
  );

  if (hasChildren || item.href === "#" || !isExpanded) {
    return content;
  }

  return <Link href={item.href}>{content}</Link>;
}

export function SidebarHeader({ name, isExpanded }: { name: string; isExpanded: boolean }) {
  if (!isExpanded) return <div className="h-px bg-slate-100 mx-6 my-8 opacity-60" />;

  return (
    <div className="px-7 mt-10 mb-3 cursor-default select-none group">
      <div className="flex items-center gap-3">
        <div className="w-1 h-3.5 bg-blue-600 rounded-full opacity-80" />
        
        <span className="text-[11px] font-black text-slate-800 uppercase tracking-[0.15em]">
          {name}
        </span>
      </div>
      
      {/* Opcional: Una línea horizontal muy tenue que se extiende después del título */}
      <div className="h-px bg-gradient-to-r from-slate-100 via-slate-50 to-transparent mt-2" />
    </div>
  );
}