import { DashboardCard } from "../cards/dashboardCard";

const AGENTS = [
  {
    id: 1,
    name: "Ana García",
    role: "CEO",
    img: "https://i.pravatar.cc/150?u=1",
  },
  {
    id: 2,
    name: "Carlos Ruiz",
    role: "Ventas",
    img: "https://i.pravatar.cc/150?u=2",
  },
  {
    id: 3,
    name: "Elena M.",
    role: "Soporte",
    img: "https://i.pravatar.cc/150?u=3",
  },
  {
    id: 4,
    name: "Marcos T.",
    role: "Marketing",
    img: "https://i.pravatar.cc/150?u=4",
  },
];

export const FeaturedAgents = () => {
  return (
    <DashboardCard title="Agentes Destacados" className="h-[400px]">
      <div className="grid grid-cols-2 gap-4 h-[calc(100%-40px)]">
        {AGENTS.map((agent) => (
          <div
            key={agent.id}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-gray-50/50 border border-gray-100/50 hover:bg-white hover:shadow-md hover:border-indigo-100 transition-all group cursor-pointer"
          >
            <div className="relative mb-3">
              <img
                src={agent.img}
                alt={agent.name}
                className="w-14 h-14 rounded-full border-2 border-transparent group-hover:border-indigo-500 transition-all p-0.5"
              />
              {agent.role === "CEO" && (
                <span
                  className="absolute -top-1 -right-1 bg-yellow-400 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center shadow-sm"
                  title="Top Performer"
                />
              )}
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-gray-800 leading-tight">
                {agent.name}
              </p>
              <span
                className={`mt-1.5 inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                  agent.role === "CEO"
                    ? "bg-indigo-100 text-indigo-600"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {agent.role}
              </span>
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
};
