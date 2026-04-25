import React from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  variant?: "blue" | "purple" | "green" | "orange";
  trend?: {
    value: string;
    label: string;
    type: "up" | "down";
  };
}

export const StatCard = ({
  title,
  value,
  icon,
  variant = "blue",
  trend,
}: StatCardProps) => {
  const variants = {
    blue: "from-[#4f86f7] to-[#3b71e3] shadow-blue-100",
    purple: "from-[#a78bfa] to-[#8b5cf6] shadow-purple-100",
    green: "from-[#34d399] to-[#10b981] shadow-green-100",
    orange: "from-[#fbbf24] to-[#f59e0b] shadow-orange-100",
  };

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${variants[variant]} p-6 rounded-[2.5rem] text-white shadow-2xl transition-all hover:scale-[1.02] duration-300 group`}
    >
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold opacity-90 tracking-tight">
            {title}
          </span>
          <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm group-hover:scale-110 transition-transform">
            {icon}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-3xl font-black tracking-tight">{value}</h3>
          {trend && (
            <div className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1 px-3 py-3 rounded-lg text-[10px] font-black backdrop-blur-md ${
                  trend.type === "up" ? "bg-white/30" : "bg-red-500/30"
                }`}
              >
                {trend.type === "up" ? "↗" : "↘"} {trend.value}
              </span>
              <span className="text-[10px] font-bold opacity-80 uppercase tracking-wider">
                {trend.label}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Background patterns */}
      <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-125 transition-transform duration-700">
        {icon}
      </div>
    </div>
  );
};
