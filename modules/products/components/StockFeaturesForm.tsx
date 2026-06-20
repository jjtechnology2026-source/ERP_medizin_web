"use client";
import { useState, useEffect, useMemo } from "react";
import { HiArrowLeft, HiOutlineCash, HiOutlineAdjustments, HiOutlineInformationCircle, HiOutlineCube, HiOutlineTag, HiOutlineShieldCheck, HiCheckCircle } from "react-icons/hi";
import { useProductsStore } from "@/modules/products/store/products.store";
import { useFormatCurrency } from "@/modules/core/hooks/useFormatCurrency";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import type { ViewState, Medication } from "@/modules/products/types/products.types";

const VAT_OPTIONS = [0, 8, 16, 31] as const;
type TabType = "PRECIO_STOCK" | "INFO_ADICIONAL";

export default function StockFeaturesForm({
  setView,
}: {
  setView: (v: ViewState) => void;
}) {
  const { currentMedicine, editMode, saveMedicine, setCurrentMedicine } = useProductsStore();
  const { parseInput, format } = useFormatCurrency();
  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();

  const [activeTab, setActiveTab] = useState<TabType>("PRECIO_STOCK");
  const [priceWithoutVat, setPriceWithoutVat] = useState("");
  const [selectedVat, setSelectedVat] = useState<number>(16);
  const [quantity, setQuantity] = useState("");
  const [minStock, setMinStock] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  useEffect(() => {
    if (!currentMedicine) return;
    const vat = VAT_OPTIONS.includes(currentMedicine.vat as typeof VAT_OPTIONS[number])
      ? (currentMedicine.vat as number)
      : 16;
    const p = currentMedicine.price ?? 0;
    const priceExVat = vat > 0 ? p / (1 + vat / 100) : p;
    setPriceWithoutVat(priceExVat.toFixed(2));
    setSelectedVat(vat);
    setQuantity(String(currentMedicine.stock ?? 0));
    setMinStock(String(currentMedicine.minimum ?? 0));
  }, [currentMedicine]);

  const priceWithVat = useMemo(() => {
    const p = parseInput(priceWithoutVat);
    return p * (1 + selectedVat / 100);
  }, [priceWithoutVat, selectedVat, parseInput]);

  const finalPriceUSD = priceWithVat;
  const finalPriceVES = priceWithVat * rate;

  const handleSave = async () => {
    if (!currentMedicine?.name) return;
    setIsSaving(true);
    setFeedback(null);

    const p = parseInput(priceWithoutVat);
    const q = parseInput(quantity);
    const min = parseInput(minStock);

    const medicine: Medication = {
      ...(currentMedicine as Medication),
      price: p * (1 + selectedVat / 100),
      stock: q,
      vat: selectedVat,
      minimum: min,
    };

    const success = await saveMedicine(medicine);
    if (success) {
      setShowSuccessDialog(true);
    } else {
      setFeedback({ type: "error", message: "Error al guardar el producto" });
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    setCurrentMedicine(null);
    setView(editMode ? "LIST" : "SEARCH_CATALOG");
  };

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: "PRECIO_STOCK", label: "Precio, IVA y Stock", icon: HiOutlineCash },
    { key: "INFO_ADICIONAL", label: "Detalles", icon: HiOutlineInformationCircle },
  ];

  const medStock = currentMedicine?.stock ?? 0;
  const medMin = currentMedicine?.minimum ?? 0;
  const stockLevel = currentMedicine && medStock > 0 ? medStock <= medMin ? "low" : "ok" : "empty";
  const stockColors = { low: "text-rose-600 bg-rose-50 border-rose-200", ok: "text-emerald-600 bg-emerald-50 border-emerald-200", empty: "text-slate-400 bg-slate-50 border-slate-200" };

  return (
    <div className="w-full max-w-[1400px] mx-auto animate-in fade-in duration-500 space-y-6 px-2">
      <button
        onClick={handleCancel}
        className="flex items-center gap-2 text-slate-400 hover:text-blue-600 font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer group"
      >
        <HiArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Volver {editMode ? "al inventario" : "al catálogo"}
      </button>

      {/* Product Header */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="size-20 md:size-24 shrink-0 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-slate-100 overflow-hidden flex items-center justify-center">
            {currentMedicine?.image ? (
              <img src={currentMedicine.image} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl">💊</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                  {currentMedicine?.name || "Producto sin nombre"}
                </h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {currentMedicine?.activeIngredient || ""} • {currentMedicine?.brand || ""}
                </p>
              </div>
              <div className={`px-4 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider ${stockColors[stockLevel]}`}>
                {stockLevel === "low" ? "Stock Bajo" : stockLevel === "ok" ? "En Stock" : "Sin Stock"}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">{currentMedicine?.barCode || "Sin código"}</span>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-lg">{currentMedicine?.category || "General"}</span>
              {currentMedicine?.dosage && <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-lg">{currentMedicine.dosage}</span>}
              {currentMedicine?.tablets && <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-lg">{currentMedicine.tablets}</span>}
              {currentMedicine?.controlled && <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-3 py-1 rounded-lg">Controlado</span>}
              {currentMedicine?.antibiotic && <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-lg">Antibiótico</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-2">
        <div className="flex gap-1 bg-slate-50 rounded-2xl p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center justify-center gap-2 flex-1 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === tab.key
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Icon size={16} /> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <div className="lg:col-span-3 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-6 md:p-8 space-y-6">
          {activeTab === "PRECIO_STOCK" && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl"><HiOutlineCash size={20} /></span>
                <h3 className="text-lg font-black text-slate-800">Precio, IVA y Stock</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Precio Base (sin IVA)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input
                      type="text" inputMode="decimal" value={priceWithoutVat}
                      onChange={(e) => setPriceWithoutVat(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200/60 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Tasa de IVA</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {VAT_OPTIONS.map((v) => (
                      <button key={v} type="button" onClick={() => setSelectedVat(v)}
                        className={`py-3 rounded-xl font-black text-xs transition-all cursor-pointer ${
                          selectedVat === v
                            ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                            : "bg-slate-50 border border-slate-200/50 text-slate-500 hover:bg-slate-100"
                        }`}
                      >{v}%</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-3xl p-6 border border-blue-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Precio Final (con IVA)</span>
                    <p className="text-3xl font-black text-slate-800 mt-1">{format(priceWithVat)}</p>
                  </div>
                  <div className="flex flex-col text-xs font-bold text-slate-500 gap-1 border-t md:border-t-0 md:border-l border-blue-100 pt-3 md:pt-0 md:pl-6">
                    <span>USD: <strong className="text-blue-600 font-black">${finalPriceUSD.toFixed(2)}</strong></span>
                    <span>VES: <strong className="text-indigo-600 font-black">{finalPriceVES.toFixed(2)} Bs</strong></span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Existencias en stock</label>
                    <input type="text" inputMode="numeric" value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="0"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Stock Mínimo (Alerta)</label>
                    <input type="text" inputMode="numeric" value={minStock}
                      onChange={(e) => setMinStock(e.target.value)}
                      placeholder="0"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100 mt-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl shadow-sm">
                      <HiOutlineCube size={24} className="text-blue-600" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor total del stock</span>
                      <p className="text-xl font-black text-slate-800 mt-1">{format(priceWithVat * (parseInput(quantity) || 0))}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{parseInput(quantity) || 0} unidades x {format(priceWithVat)} c/u</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "INFO_ADICIONAL" && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl"><HiOutlineInformationCircle size={20} /></span>
                <h3 className="text-lg font-black text-slate-800">Información del Producto</h3>
              </div>

              {currentMedicine ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nombre comercial</span>
                      <p className="text-sm font-bold text-slate-700 mt-1">{currentMedicine.name}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Código de barras</span>
                      <p className="text-sm font-mono font-bold text-slate-700 mt-1">{currentMedicine.barCode}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Principio activo</span>
                      <p className="text-sm font-bold text-slate-700 mt-1">{currentMedicine.activeIngredient || "-"}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Marca / Laboratorio</span>
                      <p className="text-sm font-bold text-slate-700 mt-1">{currentMedicine.brand || "-"}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Dosis / Concentración</span>
                      <p className="text-sm font-bold text-slate-700 mt-1">{currentMedicine.dosage || "-"}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Presentación</span>
                      <p className="text-sm font-bold text-slate-700 mt-1">{currentMedicine.tablets || "-"}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Categoría</span>
                      <p className="text-sm font-bold text-blue-600 mt-1 uppercase">{currentMedicine.category || "-"}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Subcategoría</span>
                      <p className="text-sm font-bold text-slate-700 mt-1">{currentMedicine.subcategory || "-"}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {currentMedicine.controlled && <span className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase">Controlado</span>}
                    {currentMedicine.antibiotic && <span className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl text-[10px] font-black uppercase">Antibiótico</span>}
                  </div>
                  {currentMedicine.description && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Descripción</span>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{currentMedicine.description}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-400 text-sm font-semibold py-8 text-center">No hay información del producto</p>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-6 space-y-4">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Resumen rápido</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                <span className="text-xs font-bold text-slate-400">Stock actual</span>
                <span className={`text-sm font-black ${stockLevel === "low" ? "text-rose-600" : "text-slate-800"}`}>
                  {currentMedicine?.stock ?? 0} und
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                <span className="text-xs font-bold text-slate-400">Stock mínimo</span>
                <span className="text-sm font-black text-slate-800">{currentMedicine?.minimum ?? 0} und</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                <span className="text-xs font-bold text-slate-400">Precio unitario</span>
                <span className="text-sm font-black text-blue-600">{format(priceWithVat)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                <span className="text-xs font-bold text-slate-400">IVA aplicado</span>
                <span className="text-sm font-black text-slate-800">{selectedVat}%</span>
              </div>
            </div>
          </div>

          {feedback && (
            <div className={`px-4 py-3.5 rounded-2xl text-xs font-bold ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-red-50 text-red-700 border border-red-100"
            } animate-in slide-in-from-top-2 duration-300`}>
              {feedback.message}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleCancel} type="button"
              className="flex-1 py-3.5 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all active:scale-95 cursor-pointer">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={isSaving || !currentMedicine?.name} type="button"
              className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
              {isSaving ? "Guardando..." : editMode ? "Actualizar Stock" : "Confirmar"}
            </button>
          </div>
        </div>
      </div>

      {showSuccessDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl max-w-sm w-full mx-4 text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <HiCheckCircle className="text-emerald-500" size={36} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-800">Producto Agregado</h3>
              <p className="text-sm text-slate-400 font-medium leading-relaxed">
                El producto se agregó al inventario correctamente{editMode ? " (actualizado)" : ""}.
              </p>
            </div>
            <button
              onClick={() => {
                setShowSuccessDialog(false);
                setCurrentMedicine(null);
                setView("LIST");
              }}
              className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
            >
              Ver inventario
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
