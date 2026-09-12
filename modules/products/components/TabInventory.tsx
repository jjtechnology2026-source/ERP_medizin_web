import { useEffect, useState, useRef } from "react";
import {
  HiOutlinePencil, HiOutlineTrash, HiOutlineRefresh,
  HiPlus, HiCloudUpload, HiSearch, HiViewGrid, HiExclamationCircle,
  HiOutlineCash
} from "react-icons/hi";
import { useProductsStore } from "@/modules/products/store/products.store";
import { productsService } from "@/modules/products/api/products.service";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { useInfiniteScroll } from "@/modules/products/lib/useInfiniteScroll";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import type { StockFilter, ViewState, Medication } from "@/modules/products/types/products.types";

export default function InventoryList({
  setView,
  stockTab,
  setStockTab,
}: {
  setView: (v: ViewState) => void;
  stockTab: StockFilter;
  setStockTab: (t: StockFilter) => void;
}) {
  const {
    inventory,
    inventoryTotal,
    isLoading,
    isLoadingMore,
    isInitialLoad,
    hasMore,
    error,
    fetchInventory,
    loadNextPage,
    searchInventory,
    setFilter,
    getLowStockCount,
    deleteMedicine,
    setEditMode,
    setCurrentMedicine,
  } = useProductsStore();

  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();
  const [localSearch, setLocalSearch] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // La carga inicial la dispara MqttInventoryProvider (envuelve a esta lista).

  // No buscar en el montaje (la lista ya viene de fetchInventory): solo al tipear.
  const didMountSearch = useRef(false);
  useEffect(() => {
    if (!didMountSearch.current) {
      didMountSearch.current = true;
      return;
    }
    const timer = setTimeout(() => {
      void searchInventory(localSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, searchInventory]);

  const lowStockCount = getLowStockCount();

  // Prefetch progresivo (2 pantallas antes) sobre el scroll real de <main>.
  useInfiniteScroll(sentinelRef, {
    hasMore,
    isLoading: isLoadingMore,
    onLoadMore: () => {
      void loadNextPage();
    },
  });

  const formatPrice = (price: number) => {
    if (isDollar) return `$ ${price.toFixed(2)}`;
    return `Bs ${(price * rate).toFixed(2)}`;
  };

  const handleEdit = (med: Medication) => {
    setCurrentMedicine(med);
    setEditMode(true);
    setView("STOCK_FEATURES");
  };

  const handleStockTabChange = (tab: StockFilter) => {
    setStockTab(tab);
    setFilter(tab);
  };

  const showLoadingState = inventory.length === 0 && (isLoading || isInitialLoad) && !error;
  const showEmptyState = !isLoading && !isInitialLoad && inventory.length === 0 && !error;

  const formatReportDate = (date: Date) =>
    date.toLocaleString("es-VE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const loadLogoAsPng = async (): Promise<string | null> => {
    try {
      const response = await fetch("/Logo.svg");
      if (!response.ok) return null;
      const svgText = await response.text();
      const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.src = url;
      await image.decode();
      const width = Math.min(220, image.width || 200);
      const height = Math.max(60, Math.round((image.height || 80) * (width / (image.width || width))));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(url);
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  };

  // El PDF necesita TODO el inventario filtrado, no solo lo paginado en pantalla:
  // recorre las paginas del endpoint solo cuando el usuario pide el reporte.
  const fetchAllForReport = async (): Promise<Medication[]> => {
    const pharmacyId = useAuthStore.getState().profile?.pharmacyId;
    if (!pharmacyId) return inventory;
    const all: Medication[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 500; i++) {
      const page = await productsService.getCursorInventory(pharmacyId, {
        cursor,
        limit: 200,
        query: localSearch || undefined,
        lowStock: stockTab === "LOW",
      });
      all.push(...page.medications);
      if (!page.has_more || !page.next_cursor) break;
      cursor = page.next_cursor;
    }
    return all;
  };

  const downloadInventoryReport = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      const reportItems = await fetchAllForReport();
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "pt", format: "letter" });
      const today = new Date();
      const headerTextY = 50;
      const logoDataUrl = await loadLogoAsPng();

      if (logoDataUrl) {
        pdf.addImage(logoDataUrl, "PNG", 40, 20, 90, 40);
      }

      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("Inventario de Productos", logoDataUrl ? 150 : 40, headerTextY);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Fecha: ${formatReportDate(today)}`, 40, headerTextY + 25);
      pdf.text(`Total de productos: ${reportItems.length}`, 40, headerTextY + 40);

      const headers = ["Código", "Producto", "Stock", "Precio", "Categoría"];
      const colX = [40, 160, 370, 430, 510];
      let currentY = headerTextY + 70;
      const rowHeight = 18;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      headers.forEach((label, index) => {
        pdf.text(label, colX[index], currentY);
      });

      currentY += rowHeight;
      pdf.setFont("helvetica", "normal");

      reportItems.forEach((item, index) => {
        if (currentY + rowHeight > 750) {
          pdf.addPage();
          currentY = 40;
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9);
          headers.forEach((label, idx) => pdf.text(label, colX[idx], currentY));
          currentY += rowHeight;
          pdf.setFont("helvetica", "normal");
        }

        pdf.text(item.barCode || "-", colX[0], currentY);
        pdf.text(item.name ? item.name.slice(0, 32) : "-", colX[1], currentY);
        pdf.text(String(item.stock ?? 0), colX[2], currentY);
        pdf.text(formatPrice(item.price), colX[3], currentY);
        pdf.text(item.category || "-", colX[4], currentY);
        currentY += rowHeight;
      });

      const filename = `inventario_${today.toISOString().slice(0, 10)}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error("Error al generar el PDF de inventario:", error);
      alert("No se pudo generar el PDF. Intenta nuevamente.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="w-full max-w-[1600px] flex flex-col space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 px-2">
        <h1 className="text-3xl font-black text-blue-600">Productos en Stock</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setView("STOCK_TAX")}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-500 rounded-xl font-black text-[10px] uppercase hover:border-blue-200 hover:text-blue-600 transition-all shadow-sm"
          >
            <HiOutlineCash size={14} /> Stock por impuesto
          </button>
          <button
            onClick={() => setView("SEARCH_CATALOG")}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-blue-100 hover:scale-105 transition-all cursor-pointer"
          >
            <HiCloudUpload size={18} /> Agregar a stock
          </button>
          <button
            onClick={() => setView("CREATE_MANUAL")}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-400 text-white rounded-2xl font-black text-xs shadow-lg shadow-slate-200 hover:scale-105 transition-all cursor-pointer"
          >
            <HiPlus size={18} /> Crear producto
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 flex flex-col overflow-hidden">
        <div className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-50">
          <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => handleStockTabChange("GENERAL")}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[11px] font-black uppercase transition-all ${
                stockTab === "GENERAL"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-400"
              }`}
            >
              <HiViewGrid size={16} /> Stock General
            </button>
            <button
              onClick={() => handleStockTabChange("LOW")}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[11px] font-black uppercase transition-all ${
                stockTab === "LOW"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-400"
              }`}
            >
              <HiExclamationCircle size={16} />
              Stock Bajo
              {lowStockCount > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                  {lowStockCount}
                </span>
              )}
            </button>
          </div>
          <div className="relative w-full sm:w-72">
            <HiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, código..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-100 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white border-b border-slate-50">
              <tr>
                {["Imagen", "Nombre", "Categoria", "Precio", "Desc.", "Cantidad", "Descripción", "Acción"].map(
                  (h) => (
                    <th key={h} className="px-8 py-5 text-[11px] font-black text-slate-900 uppercase tracking-widest">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {showLoadingState ? (
                <tr>
                  <td colSpan={8} className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-slate-500 font-bold text-sm">Cargando datos...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-red-500 font-bold text-sm">{error}</span>
                      <button
                        onClick={() => fetchInventory(true)}
                        className="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:scale-105 transition-all"
                      >
                        Reintentar
                      </button>
                    </div>
                  </td>
                </tr>
              ) : showEmptyState ? (
                <tr>
                  <td colSpan={8} className="px-8 py-16 text-center text-slate-400 font-bold text-sm">
                    {localSearch ? (
                      "No se encontraron productos con ese criterio de búsqueda"
                    ) : (
                      "No hay productos en inventario"
                    )}
                  </td>
                </tr>
              ) : (
                inventory.map((med, i) => (
                  <tr
                    key={med.barCode || i}
                    className={`hover:bg-blue-50/20 transition-colors ${
                      med.stock <= med.minimum ? "bg-red-50/30" : ""
                    }`}
                  >
                    <td className="px-8 py-4">
                      <div className="size-10 bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
                        {med.image ? (
                          <img src={med.image} alt={med.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs font-black">?</div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <p className="font-bold text-slate-700 text-sm">{med.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{med.barCode}</p>
                    </td>
                    <td className="px-8 py-4 text-slate-500 text-xs">{med.category || "-"}</td>
                    <td className="px-8 py-4 font-black text-slate-800 text-xs">{formatPrice(med.price)}</td>
                    <td className="px-8 py-4 text-xs font-bold text-slate-500">{med.discount ? `${med.discount}%` : "-"}</td>
                    <td className="px-8 py-4">
                      <span className={`font-bold text-xs ${med.stock <= med.minimum ? "text-red-600" : "text-slate-600"}`}>
                        {med.stock}
                      </span>
                      {med.stock <= med.minimum && <HiExclamationCircle className="inline ml-1 text-red-500" size={14} />}
                    </td>
                    <td className="px-8 py-4 text-slate-400 text-[11px] max-w-xs truncate">{med.description || "-"}</td>
                    <td className="px-8 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(med)}
                          className="p-2 text-blue-500 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-500 hover:text-white transition-all active:scale-90"
                          title="Editar"
                        >
                          <HiOutlinePencil />
                        </button>
                        <button className="p-2 text-amber-500 bg-amber-50 rounded-lg border border-amber-100 hover:bg-amber-500 hover:text-white transition-all active:scale-90" title="Restar stock">
                          <HiOutlineRefresh />
                        </button>
                        <button
                          onClick={() => deleteMedicine(med.barCode)}
                          className="p-2 text-red-500 bg-red-50 rounded-lg border border-red-100 hover:bg-red-500 hover:text-white transition-all active:scale-90"
                          title="Eliminar"
                        >
                          <HiOutlineTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Sentinel siempre montado: el observer se engancha al montar, antes de
            que la tabla tenga filas. */}
        <div ref={sentinelRef} className="h-1 w-full" />

        {inventory.length > 0 && (
          <div className="p-4 border-t border-slate-50 bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs font-bold text-slate-400">
              Mostrando {inventory.length}
              {inventoryTotal != null && !localSearch && stockTab === "GENERAL"
                ? ` de ${inventoryTotal}`
                : ""}{" "}
              productos
            </p>

            {isLoadingMore && (
              <span className="text-xs text-slate-400 font-bold">Cargando más productos...</span>
            )}
            {!hasMore && inventory.length > 0 && (
              <span className="text-[11px] text-slate-300 font-bold">Fin del inventario</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
