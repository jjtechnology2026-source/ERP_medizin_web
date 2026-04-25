"use client";
import { useState } from "react";
import InventoryList from "./components/TabInventory";
import CreateProductPage from "./components/TabCreateProduct";
import CatalogSearchPage from "./components/TabSearchPage";

export type ViewState = 'LIST' | 'CREATE_MANUAL' | 'SEARCH_CATALOG';
export type StockTab = 'GENERAL' | 'LOW';

export default function InventoryManagement() {
  const [view, setView] = useState<ViewState>('LIST');
  const [stockTab, setStockTab] = useState<StockTab>('GENERAL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  return (
    // min-h-screen permite que el fondo crezca, pero no fuerza un scroll si no hay contenido
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      <main className="p-6 flex flex-col items-center">
        {view === 'LIST' && (
          <InventoryList 
            setView={setView} 
            stockTab={stockTab} 
            setStockTab={setStockTab}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            itemsPerPage={itemsPerPage}
          />
        )}
        {view === 'CREATE_MANUAL' && <CreateProductPage setView={setView} />}
        {view === 'SEARCH_CATALOG' && <CatalogSearchPage setView={setView} />}
      </main>
    </div>
  );
}