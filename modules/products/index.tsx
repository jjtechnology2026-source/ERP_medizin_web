"use client";
import { useState } from "react";
import InventoryList from "./components/TabInventory";
import CreateProductPage from "./components/TabCreateProduct";
import CatalogSearchPage from "./components/TabSearchPage";
import StockAutocomplete from "./components/StockAutocomplete";
import StockFeaturesForm from "./components/StockFeaturesForm";
import StockTaxBreakdown from "./components/StockTaxBreakdown";

import { useProductsStore } from "@/modules/products/store/products.store";
import { MqttInventoryProvider } from "@/modules/products/providers/MqttInventoryProvider";
import type { ViewState, StockFilter, Medication } from "@/modules/products/types/products.types";

export type { ViewState, StockFilter };

export default function InventoryManagement() {
  const [view, setView] = useState<ViewState>("LIST");
  const [stockTab, setStockTab] = useState<StockFilter>("GENERAL");

  const {
    inventory,
    isLoading,
    setCurrentMedicine,
    setEditMode,
    setSearchQuery,
  } = useProductsStore();

  const handleStockAutocompleteSelect = (med: Medication) => {
    setCurrentMedicine(med);
    setEditMode(false);
    setView("STOCK_FEATURES");
  };

  return (
    <MqttInventoryProvider>
      <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
        <main className="p-6 flex flex-col items-center">
        {view === "LIST" && (
          <>
            <InventoryList
              setView={setView}
              stockTab={stockTab}
              setStockTab={setStockTab}
            />
          </>
        )}

        {view === "ADD_STOCK" && (
          <div className="w-full max-w-[600px] mx-auto animate-in fade-in duration-500">
            <button
              onClick={() => setView("LIST")}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold text-xs mb-6 transition-colors"
            >
              ← Volver al inventario
            </button>
            <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 p-8">
              <h2 className="text-2xl font-black text-slate-800 mb-6">Agregar Producto a Stock</h2>
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
                </div>
              ) : (
                <StockAutocomplete
                  inventory={inventory}
                  onSelect={handleStockAutocompleteSelect}
                />
              )}
            </div>
          </div>
        )}

        {view === "STOCK_FEATURES" && <StockFeaturesForm setView={setView} />}

        {view === "STOCK_TAX" && <StockTaxBreakdown setView={setView} />}
        {view === "CREATE_MANUAL" && <CreateProductPage setView={setView} />}
        {view === "SEARCH_CATALOG" && <CatalogSearchPage setView={setView} />}
        </main>
      </div>
    </MqttInventoryProvider>
  );
}
