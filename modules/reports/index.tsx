"use client";
import { useState, useMemo } from "react";
import { MetricCard } from "./components/MetricCard";
import { FaChartLine, FaRegClipboard, FaShoppingCart, FaChartBar } from "react-icons/fa";
import { IoHandLeftOutline } from "react-icons/io5";
import { useApiQuery } from "@/modules/core/hooks/useApi";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import type { Order } from "@/modules/orders/types/orders";

function getDateRange(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split("T")[0];
  return dateStr.startsWith(today);
}

function isThisWeek(dateStr: string): boolean {
  const now = new Date();
  const d = new Date(dateStr);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  return d >= startOfWeek;
}

function isThisMonth(dateStr: string): boolean {
  const now = new Date();
  const d = new Date(dateStr);
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export default function Reportes() {
  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();

  const dateRange = useMemo(() => getDateRange(90), []);
  
  const { data: standardOrders = [] } = useApiQuery<Order[]>(
    ["reports-orders-std", dateRange.start, dateRange.end],
    "/admin/Orders/SearchOrders",
    {
      params: {
        fecha_inicio: dateRange.start,
        fecha_fin: dateRange.end,
      },
      staleTime: 30000,
    }
  );

  const { data: marketplaceOrders = [] } = useApiQuery<Order[]>(
    ["reports-orders-mkt", dateRange.start, dateRange.end],
    "/admin/Orders/SearchOrders",
    {
      params: {
        fecha_inicio: dateRange.start,
        fecha_fin: dateRange.end,
        type_sale: "Marketplace",
      },
      staleTime: 30000,
    }
  );

  const orders = useMemo(() => {
    const combined = [...standardOrders, ...marketplaceOrders];
    const seen = new Set();
    return combined.filter((order) => {
      if (!order.id) return true;
      if (seen.has(order.id)) return false;
      seen.add(order.id);
      return true;
    });
  }, [standardOrders, marketplaceOrders]);

  const formatAmount = (amount: number) => {
    if (isDollar) {
      return `$ ${amount.toFixed(2)}`;
    }
    return `Bs ${(amount * rate).toFixed(2)}`;
  };

  const stats = useMemo(() => {
    const completed = orders.filter((o) => o.saleStatus === "Completed");
    const todaySales = completed.filter((o) => isToday(o.date));
    const weekSales = completed.filter((o) => isThisWeek(o.date));
    const monthSales = completed.filter((o) => isThisMonth(o.date));

    const sumTotal = (items: Order[]) =>
      items.reduce((acc, o) => acc + (o.totalreal || o.totalsystem || 0), 0);

    return {
      today: {
        total: sumTotal(todaySales),
        count: todaySales.length,
      },
      week: {
        total: sumTotal(weekSales),
        count: weekSales.length,
        prevTotal: sumTotal(
          completed.filter((o) => {
            const d = new Date(o.date);
            const now = new Date();
            const lastWeekStart = new Date(now);
            lastWeekStart.setDate(now.getDate() - now.getDay() - 7);
            const lastWeekEnd = new Date(lastWeekStart);
            lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
            return d >= lastWeekStart && d <= lastWeekEnd;
          })
        ),
      },
      month: {
        total: sumTotal(monthSales),
        count: monthSales.length,
        prevTotal: sumTotal(
          completed.filter((o) => {
            const d = new Date(o.date);
            const now = new Date();
            const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
            const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
            return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
          })
        ),
      },
      totalSales: sumTotal(completed),
      totalOrders: completed.length,
    };
  }, [orders]);

  const agentStats = useMemo(() => {
    const agentMap = new Map<string, { name: string; total: number; count: number }>();
    for (const order of orders) {
      if (order.saleStatus !== "Completed") continue;
      const id = order.idAgent || "unknown";
      const existing = agentMap.get(id);
      const total = order.totalreal || order.totalsystem || 0;
      if (existing) {
        existing.total += total;
        existing.count += 1;
      } else {
        agentMap.set(id, {
          name: order.nameAgent || "Sin nombre",
          total,
          count: 1,
        });
      }
    }
    return Array.from(agentMap.values()).sort((a, b) => b.total - a.total);
  }, [orders]);

  const noteStats = useMemo(() => {
    let creditNotes = 0;
    let debitNotes = 0;
    let ordersWithNotes = 0;
    for (const order of orders) {
      if (order.notaCredito || order.notaDebito) ordersWithNotes++;
      if (order.notaCredito) creditNotes++;
      if (order.notaDebito) debitNotes++;
    }
    return { creditNotes, debitNotes, ordersWithNotes };
  }, [orders]);

  const getTrend = (current: number, previous: number): { percentage: string; trend: "up" | "down" } => {
    if (previous === 0) return { percentage: "100.00%", trend: "up" };
    const change = ((current - previous) / previous) * 100;
    return {
      percentage: `${Math.abs(change).toFixed(2)}%`,
      trend: change >= 0 ? "up" : "down",
    };
  };

  return (
    <div className="p-8 max-w-8xl mx-auto bg-[#f8f9fa] min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-[#0052ff]">Reporte general</h1>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <span>Datos de los últimos 90 días</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MetricCard
          title="Ventas del día"
          value={formatAmount(stats.today.total)}
          percentage={stats.today.count > 0 ? `${stats.today.count} ordenes` : "Sin ventas"}
          trend={stats.today.count > 0 ? "up" : "down"}
          timeLabel="Hoy"
          bgColor="bg-[#6366f1]"
          icon={<FaChartLine />}
        />
        <MetricCard
          title="Ventas de la Semana"
          value={formatAmount(stats.week.total)}
          percentage={
            getTrend(stats.week.total, stats.week.prevTotal).percentage
          }
          trend={getTrend(stats.week.total, stats.week.prevTotal).trend}
          timeLabel={`${stats.week.count} ordenes`}
          bgColor="bg-[#c084fc]"
          icon={<FaRegClipboard />}
        />
        <MetricCard
          title="Ventas del mes"
          value={formatAmount(stats.month.total)}
          percentage={
            getTrend(stats.month.total, stats.month.prevTotal).percentage
          }
          trend={getTrend(stats.month.total, stats.month.prevTotal).trend}
          timeLabel={`${stats.month.count} ordenes`}
          bgColor="bg-[#4ade80]"
          icon={<IoHandLeftOutline />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="bg-[#0052ff] grid grid-cols-3 text-white text-[11px] font-bold uppercase p-4 tracking-wider">
            <div className="text-center">Nombre del Agente</div>
            <div className="text-center">Órdenes</div>
            <div className="text-center">Ventas Totales</div>
          </div>
          {agentStats.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm font-bold">
              {orders.length === 0 ? "No hay datos de agentes disponibles" : "Sin ventas completadas"}
            </div>
          ) : (
            agentStats.slice(0, 10).map((agent, i) => (
              <div
                key={i}
                className="grid grid-cols-3 p-4 text-center items-center border-b border-gray-50 last:border-0 hover:bg-slate-50/50 transition-colors"
              >
                <div className="font-medium text-left px-4 lowercase text-gray-700">
                  {agent.name}
                </div>
                <div className="text-sm font-bold text-slate-500">{agent.count}</div>
                <div className="font-bold text-gray-700 uppercase">
                  {formatAmount(agent.total)}
                </div>
              </div>
            ))
          )}
          {agentStats.length > 10 && (
            <div className="p-3 text-center text-[10px] font-bold text-slate-400">
              ...y {agentStats.length - 10} agentes más
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="bg-slate-700 grid grid-cols-2 text-white text-[11px] font-bold uppercase p-4 tracking-wider">
            <div className="text-center">Métrica</div>
            <div className="text-center">Valor</div>
          </div>
          <div className="divide-y divide-gray-50">
            <div className="grid grid-cols-2 p-4 text-center hover:bg-slate-50/50 transition-colors">
              <div className="font-medium text-left px-4 text-sm text-slate-600">Total órdenes</div>
              <div className="font-bold text-slate-800">{stats.totalOrders}</div>
            </div>
            <div className="grid grid-cols-2 p-4 text-center hover:bg-slate-50/50 transition-colors">
              <div className="font-medium text-left px-4 text-sm text-slate-600">Ventas totales</div>
              <div className="font-bold text-blue-600">{formatAmount(stats.totalSales)}</div>
            </div>
            <div className="grid grid-cols-2 p-4 text-center hover:bg-slate-50/50 transition-colors">
              <div className="font-medium text-left px-4 text-sm text-slate-600">Tasa de cambio</div>
              <div className="font-bold text-slate-800">1 USD = {rate.toFixed(2)} Bs</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-xl font-bold text-gray-800 mb-8">Notas emitidas</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#eef6ff] p-6 rounded-xl border-l-4 border-blue-400">
            <span className="text-4xl font-bold text-[#3b82f6]">
              {noteStats.ordersWithNotes}
            </span>
            <p className="text-sm text-gray-500 mt-2">Ordenes con notas</p>
          </div>
          <div className="bg-[#ecfdf5] p-6 rounded-xl border-l-4 border-emerald-400">
            <span className="text-4xl font-bold text-[#10b981]">
              {noteStats.creditNotes}
            </span>
            <p className="text-sm text-gray-500 mt-2">Notas de crédito</p>
          </div>
          <div className="bg-[#fffbeb] p-6 rounded-xl border-l-4 border-amber-400">
            <span className="text-4xl font-bold text-[#f59e0b]">
              {noteStats.debitNotes}
            </span>
            <p className="text-sm text-gray-500 mt-2">Notas de débito</p>
          </div>
        </div>

        {noteStats.ordersWithNotes === 0 ? (
          <p className="text-gray-400 text-[13px] font-light">
            No hay notas emitidas registradas.
          </p>
        ) : (
          <p className="text-gray-500 text-sm">
            Se encontraron {noteStats.ordersWithNotes} órdenes con notas emitidas
            ({noteStats.creditNotes} crédito, {noteStats.debitNotes} débito).
          </p>
        )}
      </div>
    </div>
  );
}
