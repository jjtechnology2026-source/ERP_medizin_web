interface DashboardCardProps {
  title: string;
  children: React.ReactNode;
  className?: string; 
}

export const DashboardCard = ({ title, children, className = "" }: DashboardCardProps) => (
  <div className={`bg-white p-6 rounded-3xl shadow-sm border border-gray-100 ${className}`}>
    <h3 className="text-lg font-bold text-gray-800 mb-4">{title}</h3>
    <div className="w-full">
      {children}
    </div>
  </div>
);