import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { DashboardCard } from "../cards/dashboardCard";

const DATA = [
  { name: "Salud y Farmacia", value: 30, color: "#4F46E5" },
  { name: "Cuidado Personal", value: 15, color: "#F59E0B" },
  { name: "Otros", value: 35, color: "#A855F7" },
  { name: "Belleza", value: 20, color: "#10B981" },
];

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  name,
}: any) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-[11px] font-bold"
    >
      <tspan x={x} dy="-0.4em">{`${(percent * 100).toFixed(0)}%`}</tspan>
      <tspan x={x} dy="1.2em" fontSize="9">
        {name.split(" ")[0]}
      </tspan>
    </text>
  );
};
export const CategoryStats = () => {
  return (
    <DashboardCard title="Estadísticas por categorías" className="h-[400px]">
      <div className="w-full h-full flex flex-col items-center justify-start md:justify-center pt-10 md:pt-2">
        <div className="w-full h-[240px] sm:h-[280px] md:h-[300px]">
          <ResponsiveContainer width="100%" height="100%" minHeight={240}>
            <PieChart>
              <Pie
                data={DATA}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius="90%"
                innerRadius="45%"
                dataKey="value"
                paddingAngle={5}
                stroke="none"
              >
                {DATA.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </DashboardCard>
  );
};
