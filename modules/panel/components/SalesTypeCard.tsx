import React from "react";

interface SalesTypeCardProps {
  monthOptions: { key: string; label: string }[];
  selectedMonthKey: string;
  onMonthChange: (key: string) => void;
  counts: {
    delivery: number;
    pickup: number;
    local: number;
  };
}

export const SalesTypeCard = ({ monthOptions, selectedMonthKey, onMonthChange, counts }: SalesTypeCardProps) => {
  const salesData = [
    { id: 1, type: "Venta por Delivery", count: counts.delivery, label: "delivery", color: "bg-blue-600" },
    { id: 2, type: "Venta por Pick Up", count: counts.pickup, label: "pickup", color: "bg-amber-500" },
    { id: 3, type: "Venta por Local", count: counts.local, label: "local", color: "bg-purple-500" },
  ];

  return (
    <div className="bg-white p-4 md:p-6 lg:p-8 rounded-3xl lg:rounded-[2.5rem] shadow-sm border border-slate-50 flex flex-col h-full">
      <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between lg:mb-6">
        <h3 className="text-lg lg:text-xl font-black text-slate-800">Cantidad de tipos vendidos</h3>
        <select
          aria-label="Mes de las ventas"
          className="min-h-11 lg:min-h-0 w-full rounded-lg border-none bg-slate-100 p-2 text-base font-bold text-slate-600 outline-none sm:w-auto sm:text-sm"
          value={selectedMonthKey}
          onChange={(event) => onMonthChange(event.target.value)}
        >
          {monthOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-100">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="p-2.5 sm:p-4 text-[11px] sm:text-sm font-bold">Tipo de Venta</th>
              <th className="p-2.5 sm:p-4 text-[11px] sm:text-sm font-bold text-center">Cantidad</th>
              <th className="p-2.5 sm:p-4 text-[11px] sm:text-sm font-bold text-center">Tipo de entrega</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {salesData.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-2.5 sm:p-4 text-sm font-medium text-slate-600">{item.type}</td>
                <td className="p-2.5 sm:p-4 text-sm font-bold text-slate-800 text-center">{item.count}</td>
                <td className="p-2.5 sm:p-4 text-center">
                  <span className={`${item.color} text-white text-[10px] uppercase font-black px-2 sm:px-3 py-1 rounded-md shadow-sm`}>
                    {item.label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
