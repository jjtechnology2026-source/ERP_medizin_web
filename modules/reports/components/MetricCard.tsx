interface MetricCardProps {
  title: string;
  value: string;
  percentage: string;
  trend: 'up' | 'down';
  timeLabel: string;
  bgColor: string;
  icon: React.ReactNode;
}

export const MetricCard = ({ title, value, percentage, trend, timeLabel, bgColor, icon }: MetricCardProps) => {
  return (
    <div className={`${bgColor} text-white p-6 rounded-2xl shadow-lg relative overflow-hidden`}>
      <p className="text-sm font-semibold opacity-90">{title}</p>
      <h2 className="text-3xl font-bold mt-2">{value}</h2>
      <div className="mt-4 flex items-center">
        <span className={`${trend === 'up' ? 'bg-emerald-600' : 'bg-red-500'} px-2 py-1 rounded text-xs font-bold mr-2 flex items-center gap-1`}>
          {trend === 'up' ? '↑' : '↓'} {percentage}
        </span>
        <span className="text-xs opacity-80">{timeLabel}</span>
      </div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-5xl opacity-20">
        {icon}
      </div>
    </div>
  );
};