"use client";
import React from "react";
import { ProductSearch } from "./components/ProductSearch";
import { OrderTable } from "./components/OrderTable";
import { CheckoutBar } from "./components/CheckoutBar";

export default function CajaVentasFeature() {
  return (
    <div className="flex flex-col gap-10 p-6 md:p-10 bg-[#FBFCFE] min-h-full">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight text-center md:text-left">Caja de ventas</h1>
        <p className="text-sm font-bold text-slate-400 text-center md:text-left">Módulo de facturación rápida Medizin</p>
      </header>

      <ProductSearch />

      <OrderTable />

      <CheckoutBar total={0.0} itemCount={0} />
    </div>
  );
}
