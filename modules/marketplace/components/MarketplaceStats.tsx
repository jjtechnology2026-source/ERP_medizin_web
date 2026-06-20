"use client";
import { HiOutlineShoppingCart, HiOutlineClock, HiOutlineCheckCircle } from "react-icons/hi";

interface MarketplaceStatsProps {
  total: number;
  pending: number;
  completed: number;
}

export default function MarketplaceStats({ total, pending, completed }: MarketplaceStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
          <HiOutlineShoppingCart size={28} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">Total Ordenes</p>
          <p className="text-3xl font-black text-slate-900">{total}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
          <HiOutlineClock size={28} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">Pendientes</p>
          <p className="text-3xl font-black text-slate-900">{pending}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
          <HiOutlineCheckCircle size={28} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">Completadas</p>
          <p className="text-3xl font-black text-slate-900">{completed}</p>
        </div>
      </div>
    </div>
  );
}
