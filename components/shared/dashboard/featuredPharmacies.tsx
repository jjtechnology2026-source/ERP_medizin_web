import { DashboardCard } from "../cards/dashboardCard";

const PHARMACIES = [
  {
    id: 1,
    name: "Farmacia 1",
    date: "28 Jan 2026",
    amount: "+$2,500",
    color: "bg-orange-100",
  },
  {
    id: 2,
    name: "Farmacia 2",
    date: "25 Jan 2026",
    amount: "+$2,500",
    color: "bg-blue-100",
  },
  {
    id: 3,
    name: "Farmacia 3",
    date: "21 Jan 2026",
    amount: "+$8,400",
    color: "bg-green-100",
  },
];

export const FeaturedPharmacies = () => (
  <DashboardCard title="Farmacias Destacadas" className="h-[400px]">
    <div className="flex flex-col gap-3">
      {PHARMACIES.map((f) => (
        <div
          key={f.id}
          className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/50 border border-gray-100/50 hover:bg-white hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full ${f.color} flex-shrink-0 border-2 border-white shadow-sm`}
            />
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-800 leading-tight truncate">
                {f.name}
              </p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                {f.date}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg border border-green-100/50">
            {f.amount}
          </span>
        </div>
      ))}
    </div>
  </DashboardCard>
);
