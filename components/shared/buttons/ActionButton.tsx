import React from "react";
import { IconType } from "react-icons"; // Tipado para iconos de react-icons
import { cn } from "@/modules/core/utils/ui";

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  icon?: IconType;
  color?: "primary" | "red" | "blue" | "green" | "orange" | "gray"; // Colores predefinidos
  className?: string; // Por si quieres añadir algo extra después
}

export const ActionButton = ({
  label,
  onClick,
  icon: Icon,
  color = "red",
  className,
}: ActionButtonProps) => {
  // Mapeo de colores para mantener el efecto "Glow" consistente
  const colorVariants = {
    primary: "bg-primary hover:shadow-primary/50",
    red: "bg-red-500 hover:shadow-red-500/50",
    blue: "bg-blue-500 hover:shadow-blue-500/50",
    green: "bg-emerald-500 hover:shadow-emerald-500/50",
    orange: "bg-orange-500 hover:shadow-orange-500/50",
    gray: "bg-gray-600 hover:shadow-gray-600/50",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "px-8 md:px-5 py-3 rounded-full text-white text-sm font-semibold tracking-wide flex items-center gap-2 transition-all duration-500 hover:shadow-lg active:scale-90 cursor-pointer",
        colorVariants[color],
        className,
      )}
    >
      {Icon && <Icon className="text-lg" />}
      <span className="hidden md:block">{label}</span>
    </button>
  );
};
