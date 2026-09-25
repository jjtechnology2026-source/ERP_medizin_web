# Autocomplete en barra de búsqueda de Caja Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al escribir en la barra de `ProductSearchBar` (módulo caja), buscar de forma reactiva en el endpoint de inventario y mostrar un dropdown de coincidencias que permite agregar el producto al pedido con un clic.

**Architecture:** El autocomplete vive en `ProductSearchBar.tsx` con estado local (`results`, `isSearching`, `showDropdown`), debounce de 300 ms que llama `productsService.getCursorInventory(pharmacyId, { query, limit: 10 })` (mismo endpoint server-side que usa `ProductSearchDialog`). El modo escáner exacto (Enter / "ENTER - Agregar" → `findInventoryItem`) no cambia.

**Tech Stack:** React (useState/useRef/useEffect), Zustand stores (`useCurrentOrderStore`, `useAuthStore`, `useProductsStore`), `productsService` axios client vía `/api/proxy`, Next.js.

## Global Constraints

- Único archivo modificado: `modules/cash-register/components/ProductSearchBar.tsx`.
- NO eliminar ni modificar el botón verde "Buscar", `ActionButtons.tsx` ni `ProductSearchDialog.tsx`.
- El endpoint es `getCursorInventory` → GET `/admin/Pharmacy/{id}/medications/cursor?limit=10&query=...`. Sin cambios en proxy/backend.
- El debounce es de **300 ms**.
- Búsqueda reactiva solo con `barcode.trim().length >= 2`; texto vacío o < 2 caracteres NO consulta.
- Enter y el botón "ENTER - Agregar" conservan `findInventoryItem` (escaneo exacto) exactamente como hoy.
- El dropdown se cierra al: agregar un producto, `onBlur` (delay 150 ms), o texto vacío/< 2 chars.
- No se agregan tests unitarios (verificación: `npx tsc --noEmit` + `npm run build` + prueba manual).
- El precio se muestra con `useCurrencyStore` (`isDollar`, `getEffectiveRate`), patrón exacto de `ProductSearchDialog.tsx:33-36`.

---

### Task 1: Reescribir `ProductSearchBar.tsx` con autocomplete

**Files:**
- Modify: `modules/cash-register/components/ProductSearchBar.tsx` (reemplazo completo del archivo, hoy 66 líneas)

**Interfaces:**
- Consumes: `useCurrentOrderStore().addMedication(med, qty)`, `useProductsStore().findInventoryItem(code)`, `productsService.getCursorInventory(pharmacyId, { query, limit })`, `useAuthStore.getState().profile?.pharmacyId`, `useCurrencyStore().isDollar/getEffectiveRate`.
- Produces: nada nuevo reutilizado por otras tareas.

- [ ] **Step 1: Reemplazar el contenido del archivo por el siguiente**

Contenido EXACTO (respetar indentaciones y el patrón de precios del diálogo):

```tsx
"use client";
import { useState, useRef, useEffect } from "react";
import { HiQrcode } from "react-icons/hi";
import { useCurrentOrderStore } from "@/modules/cash-register/store/current-order.store";
import { useProductsStore } from "@/modules/products/store/products.store";
import { productsService } from "@/modules/products/api/products.service";
import { useAuthStore } from "@/modules/auth/store/useAuthStore";
import { useCurrencyStore } from "@/modules/core/store/currency.store";
import type { Medication } from "@/modules/products/types/products.types";

export default function ProductSearchBar() {
  const [barcode, setBarcode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { addMedication } = useCurrentOrderStore();
  const { findInventoryItem } = useProductsStore();

  const [results, setResults] = useState<Medication[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const { isDollar, getEffectiveRate } = useCurrencyStore();
  const rate = getEffectiveRate();

  const formatPrice = (price: number) => {
    if (isDollar) return `$ ${price.toFixed(2)}`;
    return `Bs ${(price * rate).toFixed(2)}`;
  };

  // Búsqueda server-side con debounce en el texto del input.
  useEffect(() => {
    const text = barcode.trim();
    if (!text) {
      setResults([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }
    if (text.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    setShowDropdown(true);
    setIsSearching(true);
    const timer = setTimeout(async () => {
      const pharmacyId = useAuthStore.getState().profile?.pharmacyId;
      if (!pharmacyId) {
        setResults([]);
        setIsSearching(false);
        return;
      }
      try {
        const res = await productsService.getCursorInventory(pharmacyId, {
          query: text,
          limit: 10,
        });
        setResults(res.medications);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [barcode]);

  const handleAdd = async () => {
    const code = barcode.trim();
    if (!code) return;

    const med = await findInventoryItem(code);
    if (!med) {
      setBarcode("");
      return;
    }

    const result = addMedication(med, 1);
    if (!result.success) {
      console.warn(result.error);
    }
    setBarcode("");
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleSelect = (med: Medication) => {
    const result = addMedication(med, 1);
    if (!result.success) {
      console.warn(result.error);
    }
    setBarcode("");
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 w-full">
      <label className="text-xs font-black text-slate-600 whitespace-nowrap min-w-[130px] md:text-left">
        Código del Producto:
      </label>
      <div className="flex flex-1 gap-3 w-full">
        <div className="relative flex-1">
          <HiQrcode className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            ref={inputRef}
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="Código del producto o nombre del producto"
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-transparent rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border-slate-200 transition-all placeholder:text-slate-400"
            autoFocus
          />

          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
              {isSearching && (
                <div className="px-4 py-3 text-xs font-bold text-slate-400">Buscando...</div>
              )}
              {!isSearching && results.length === 0 && (
                <div className="px-4 py-3 text-xs font-bold text-slate-400">
                  Sin resultados para «{barcode.trim()}»
                </div>
              )}
              {!isSearching &&
                results.map((med) => (
                  <button
                    key={med.barCode || med.name}
                    type="button"
                    onClick={() => handleSelect(med)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-blue-50 transition-colors cursor-pointer border-b border-slate-100 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">{med.name}</p>
                      <p className="text-[10px] font-semibold text-slate-400 truncate">
                        {[med.brand, med.activeIngredient, med.barCode].filter(Boolean).join(" • ")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-blue-600">{formatPrice(med.price ?? 0)}</p>
                      <p className="text-[10px] font-semibold text-slate-400">Stock: {med.stock ?? 0}</p>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
        <button
          onClick={handleAdd}
          className="px-8 py-3 bg-[#0055ff] hover:bg-blue-700 text-white rounded-xl font-black text-xs tracking-widest hover:scale-[1.02] active:scale-95 transition-all whitespace-nowrap"
        >
          ENTER - Agregar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos (errores pre-existentes no relacionados son aceptables y se reportan).

- [ ] **Step 3: Verificar compilación complete**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 4: Commit**

```bash
git add modules/cash-register/components/ProductSearchBar.tsx
git commit -m "feat(caja): autocomplete de productos en la barra de busqueda"
```

---

### Task 2: Verificación final

**Files:**
- Ninguno (solo verificación).

**Interfaces:**
- Consumes: Task 1.

- [ ] **Step 1: Prueba manual del flujo**

1. Abrir `/caja-ventas`.
2. Escribir "acetami" en la barra → a los ~300 ms aparece el dropdown con coincidencias (nombre, marca/principio activo, código, precio USD o Bs según moneda, stock).
3. Hacer clic en un resultado → se agrega 1 unidad al pedido, input se limpia y queda con foco.
4. Probar texto corto (ej. "12") → el dropdown no consulta.
5. Escribir un código exacto y pulsar Enter / "ENTER - Agregar" → sigue agregando el match exacto (escaneo).
6. Botón verde "Buscar" → sigue abriendo `ProductSearchDialog` sin cambios.
7. Escribir texto sin coincidencias → "Sin resultados para «texto»".

- [ ] **Step 2: Estado del working tree**

Run: `git status`
Expected: único cambio commitado de Task 1 (más los artefactos de docs si se committean). `package.json` puede tener el fix de `dev` pendiente de commit — NO tocarlo.