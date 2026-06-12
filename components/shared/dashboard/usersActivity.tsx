import { DashboardCard } from "../cards/dashboardCard";
import { BarChartCustom } from "../barchart/barchartCustom";

const WEEKLY_DATA = [
  { label: "Sat", value1: 85, value2: 40 },
  { label: "Sun", value1: 60, value2: 25 },
  { label: "Mon", value1: 70, value2: 50 },
  { label: "Tue", value1: 90, value2: 70 },
  { label: "Wed", value1: 40, value2: 45 },
  { label: "Thu", value1: 80, value2: 50 },
  { label: "Fri", value1: 75, value2: 65 },
];

export const UsersActivity = () => {
  return (
    <DashboardCard title="Usuarios registrados" className="h-[400px]">
      <div className="flex justify-end gap-4 mb-8 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-600"></span> Completados
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-pink-400"></span> Cancelados
        </span>
      </div>

      <BarChartCustom
        data={WEEKLY_DATA}
        yAxisLabels={["0", "100", "200", "300", "400", "500"]}
      />
    </DashboardCard>
  );
};
