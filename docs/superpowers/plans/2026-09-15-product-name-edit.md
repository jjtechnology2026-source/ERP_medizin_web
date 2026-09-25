# Editar nombre de producto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir cambiar el nombre de un producto existente desde la pestaña "Detalles" de la vista de edición, usando `PUT /admin/products/update-name`.

**Architecture:** Nueva acción `updateMedicineName` en el store Zustand que llama al service (que hace `api.put` vía proxy) y, en éxito, actualiza `name` en `currentMedicine`, `inventory` y `catalog` en memoria, luego recarga la página actual de inventario. En la UI, el campo "Nombre comercial" de `StockFeaturesForm` pasa a ser un `<input>` con botón "Guardar nombre".

**Tech Stack:** Next.js (App Router), Zustand, Axios (cliente `/api/proxy`), TypeScript.

## Global Constraints

- El endpoint es `PUT /admin/products/update-name` con body `{ barCode, name }`.
- No se toca ningún otro campo del producto.
- No se agregan tests unitarios nuevos (verificación mínima: `npm run build` + prueba manual).
- El fix de seguridad: no escribir ninguna regla que permita `name` vacío; el botón se deshabilita con `nameDraft` vacío.
- Sin comentarios nuevos de código (seguir estilo del repo, que sí tiene comentarios útiles en TS).

---

### Task 1: Añadir `updateName` al products service

**Files:**
- Modify: `modules/products/api/products.service.ts` (agregar método a `productsService`, junto al bloque de `deleteProduct` que está en `:172-174`)

**Interfaces:**
- Consumes: `api` (default export de `@/modules/core/api/client`), ya importado en `products.service.ts:1`.
- Produces: `productsService.updateName(barCode: string, name: string): Promise<void>` — usado en Task 2.

- [ ] **Step 1: Añadir el método**

Agregar dentro del objeto `productsService`, después de `deleteProduct` (`:172-174`):

```ts
  /** Cambia solo el nombre del producto por barCode (regenera search_document/embedding en el backend) */
  async updateName(barCode: string, name: string): Promise<void> {
    await api.put("/admin/products/update-name", { barCode, name });
  },
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add modules/products/api/products.service.ts
git commit -m "feat: agregar productsService.updateName para PUT /admin/products/update-name"
```

---

### Task 2: Acción `updateMedicineName` en el store

**Files:**
- Modify: `modules/products/store/products.store.ts`
  - Interfaz `ProductsActions` (`:34-52`): añadir la firma.
  - Definición de acciones: añadir el método cerca de `saveMedicine` (`:266-336`).

**Interfaces:**
- Consumes: `productsService.updateName(barCode, name)` (Task 1); `setCurrentMedicine` y `fetchInventory` ya existen en el mismo store.
- Produces: `updateMedicineName(barCode: string, name: string): Promise<boolean>` — usado en Task 3.

- [ ] **Step 1: Añadir la firma a la interfaz**

En `ProductsActions` (`:34-52`), junto a `saveMedicine`:

```ts
  updateMedicineName: (barCode: string, name: string) => Promise<boolean>;
```

- [ ] **Step 2: Implementar la acción**

Agregar tras el cierre de `saveMedicine` (después de `:336`):

```ts
    updateMedicineName: async (barCode, name) => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      try {
        await productsService.updateName(barCode, trimmed);
      } catch (e) {
        console.error("[updateMedicineName] API error:", e);
        return false;
      }
      const { inventory, catalog, currentMedicine } = get();
      if (currentMedicine?.barCode === barCode) {
        set({ currentMedicine: { ...currentMedicine, name: trimmed } });
      }
      set({
        inventory: inventory.map((m) => (m.barCode === barCode ? { ...m, name: trimmed } : m)),
        catalog: catalog.map((m) => (m.barCode === barCode ? { ...m, name: trimmed } : m)),
      });
      void get().fetchInventory(true);
      return true;
    },
```

- [ ] **Step 3: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add modules/products/store/products.store.ts
git commit -m "feat: accion updateMedicineName en products store"
```

---

### Task 3: Campo editable + botón "Guardar nombre" en StockFeaturesForm

**Files:**
- Modify: `modules/products/components/StockFeaturesForm.tsx`
  - Estado local junto a `lote`/`isSaving` (`:24-34`).
  - Efecto de inicialización `:36-59`.
  - Bloque "Nombre comercial" en la pestaña Detalles (`:361-365`).
  - `handleSave` (no tocar su lógica; conservar).

**Interfaces:**
- Consumes: `updateMedicineName` del store (Task 2); patrón de `feedback` ya existente en el componente.
- Produces: Nada nuevo reutilizado por otras tareas.

- [ ] **Step 1: Añadir estado local**

Junto a `const [isSaving, setIsSaving] = useState(false);` (`:32`):

```ts
  const [nameDraft, setNameDraft] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
```

- [ ] **Step 2: Inicializar `nameDraft`**

En el `useEffect` de `:36`, dentro del `if (!currentMedicine) return;` inicial, agregar (al inicio del efecto):

```ts
    setNameDraft(currentMedicine.name ?? "");
```

- [ ] **Step 3: Handler de guardado de nombre**

Junto a `handleSave` (`:87-120`), agregar:

```ts
  const handleSaveName = async () => {
    const trimmed = nameDraft.trim();
    if (!currentMedicine?.barCode || !trimmed) return;
    if (trimmed === currentMedicine.name) return;
    setIsSavingName(true);
    setFeedback(null);
    const ok = await updateMedicineName(currentMedicine.barCode, trimmed);
    if (ok) {
      setFeedback({ type: "success", message: "Nombre actualizado correctamente." });
    } else {
      setFeedback({ type: "error", message: "Error al actualizar el nombre" });
    }
    setIsSavingName(false);
  };
```

Obtener `updateMedicineName` del store: cambiar `const { currentMedicine, editMode, saveMedicine, setCurrentMedicine } = useProductsStore();` (`:18`) a:

```ts
  const { currentMedicine, editMode, saveMedicine, setCurrentMedicine, updateMedicineName } = useProductsStore();
```

- [ ] **Step 4: Reemplazar el bloque "Nombre comercial" por input + botón**

En la pestaña Detalles, el bloque actual (`:361-365`) es:

```tsx
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nombre comercial</span>
                      <p className="text-sm font-bold text-slate-700 mt-1">{currentMedicine.name}</p>
                    </div>
```

Reemplazar por:

```tsx
                    <div className="col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nombre comercial</span>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          className="flex-1 px-3 py-2 bg-white border border-slate-200/60 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                        />
                        <button
                          onClick={handleSaveName}
                          disabled={isSavingName || !nameDraft.trim() || nameDraft.trim() === currentMedicine.name}
                          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {isSavingName ? "Guardando..." : "Guardar nombre"}
                        </button>
                      </div>
                    </div>
```

Nota: la grilla del Detalles es `grid grid-cols-2` (`:361`), por eso el bloque usa `col-span-2` para ocupar todo el ancho.

- [ ] **Step 5: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add modules/products/components/StockFeaturesForm.tsx
git commit -m "feat: editar nombre de producto desde pestaña Detalles"
```

---

### Task 4: Verificación final

**Files:**
- Ninguno (solo verificación).

**Interfaces:**
- Consumes: Tasks 1-3.

- [ ] **Step 1: Compilar la app**

Run: `npm run build`
Expected: build exitoso sin errores.

- [ ] **Step 2: Prueba manual del flujo**

1. Abrir la vista de inventario → botón lápiz (Editar) de un producto.
2. Pestaña "Detalles".
3. Cambiar el nombre → clic "Guardar nombre".
4. Confirmar que el header del producto muestra el nuevo nombre y aparece feedback "Nombre actualizado correctamente."
5. Volver al inventario y confirmar que la lista refleja el nuevo nombre.

- [ ] **Step 3: Commit final (si quedó algo sin commitear)**

Run: `git status`
Expected: working tree limpio.