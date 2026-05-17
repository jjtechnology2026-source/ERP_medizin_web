"use client";
import { useState, useCallback } from "react";
import { HiX, HiUpload, HiCheck, HiExclamation, HiOutlineDownload, HiOutlineDocumentDownload } from "react-icons/hi";
import { productsService } from "@/modules/products/api/products.service";
import type { BulkProductRow } from "@/modules/products/types/products.types";

interface BulkImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function BulkImportDialog({
  isOpen,
  onClose,
  onComplete,
}: BulkImportDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [products, setProducts] = useState<BulkProductRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);

  const downloadTemplate = async () => {
    try {
      const XLSX = await import("xlsx");
      const headers = [
        "Nombre Comercial",
        "Marca",
        "Código de Barras",
        "Principio Activo",
        "Dosis",
        "Presentación/Tabletas",
        "Categoría",
        "Subcategoría",
        "Descripción",
        "Controlado (SI/NO)",
        "Antibiótico (SI/NO)"
      ];
      
      const dummyData = [
        {
          "Nombre Comercial": "Acetabiofen",
          "Marca": "Biovenezuela",
          "Código de Barras": "8904187880023",
          "Principio Activo": "Acetaminofen",
          "Dosis": "500 mg",
          "Presentación/Tabletas": "Dispensador x 10 blister",
          "Categoría": "malestar general",
          "Subcategoría": "Dolor",
          "Descripción": "Medicamento para el alivio del dolor y la fiebre",
          "Controlado (SI/NO)": "NO",
          "Antibiótico (SI/NO)": "NO"
        },
        {
          "Nombre Comercial": "Ibuprofeno 400",
          "Marca": "Genven",
          "Código de Barras": "7591003001234",
          "Principio Activo": "Ibuprofeno",
          "Dosis": "400 mg",
          "Presentación/Tabletas": "Caja de 10 tabletas",
          "Categoría": "antiinflamatorio",
          "Subcategoría": "Dolor",
          "Descripción": "Tratamiento sintomático del dolor leve a moderado",
          "Controlado (SI/NO)": "NO",
          "Antibiótico (SI/NO)": "NO"
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(dummyData, { header: headers });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla");
      XLSX.writeFile(workbook, "plantilla_carga_masiva.xlsx");
    } catch (err) {
      console.error("Error al descargar plantilla:", err);
    }
  };

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setErrors([]);
    setProducts([]);
    setResult(null);

    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

      const parsed: BulkProductRow[] = [];
      const errs: string[] = [];

      rows.forEach((row, i) => {
        const line = i + 2;
        const name = String(
          row["Nombre Comercial"] || 
          row["name"] || 
          row["Nombre"] || 
          row["NOMBRE"] || 
          ""
        ).trim();

        if (!name) {
          errs.push(`Fila ${line}: El "Nombre Comercial" es requerido.`);
          return;
        }

        const barCode = String(
          row["Código de Barras"] || 
          row["barcode"] || 
          row["barCode"] || 
          row["Código"] || 
          row["CODIGO"] || 
          ""
        ).trim();

        if (!barCode) {
          errs.push(`Fila ${line} (${name}): El "Código de Barras" es requerido.`);
          return;
        }

        parsed.push({
          name,
          brand: String(row["Marca"] || row["brand"] || row["MARCA"] || "").trim(),
          barCode,
          activeIngredient: String(row["Principio Activo"] || row["activeIngredient"] || row["PRINCIPIO_ACTIVO"] || "").trim(),
          dosage: String(row["Dosis"] || row["dosage"] || row["DOSIS"] || "").trim(),
          tablets: String(row["Presentación/Tabletas"] || row["tablets"] || row["Tabletas"] || "").trim(),
          category: String(row["Categoría"] || row["category"] || row["Categoria"] || "").trim(),
          subcategory: String(row["Subcategoría"] || row["subcategory"] || row["SUBCATEGORIA"] || "").trim(),
          description: String(row["Descripción"] || row["description"] || row["DESCRIPCION"] || "").trim(),
          controlled: String(row["Controlado (SI/NO)"] || row["controlled"] || "").trim().toUpperCase() === "SI",
          antibiotic: String(row["Antibiótico (SI/NO)"] || row["antibiotic"] || "").trim().toUpperCase() === "SI",
        });
      });

      setProducts(parsed);
      setErrors(errs);
    } catch (err: any) {
      setErrors([`Error al leer el archivo: ${err.message || "Asegúrate de que sea un archivo .xlsx válido."}`]);
    }

    setIsProcessing(false);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const [progress, setProgress] = useState({ current: 0, total: 0, productName: "" });

  const handleSave = async () => {
    if (products.length === 0) return;
    setIsSaving(true);
    setProgress({ current: 0, total: products.length, productName: "" });
    const res = await productsService.bulkImportWithProgress(products, (current, total, name) => {
      setProgress({ current, total, productName: name || "" });
    });
    setResult(res);
    setIsSaving(false);
    if (res.errors.length === 0) {
      setTimeout(() => {
        onComplete();
      }, 1500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xl font-black text-slate-800">Carga Masiva Excel</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <HiX size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!result && !isProcessing && products.length === 0 && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center hover:border-blue-300 transition-colors cursor-pointer"
            >
              <HiUpload className="mx-auto text-slate-300 mb-3" size={40} />
              <p className="text-sm font-bold text-slate-500 mb-2">
                Arrastra tu archivo Excel aquí o haz clic para seleccionar
              </p>
              <p className="text-[11px] text-slate-400 font-medium">
                Formatos: .xlsx, .xls
              </p>
              <div className="mt-4 flex flex-col sm:flex-row justify-center items-center gap-3">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-xs cursor-pointer hover:scale-105 transition-all shadow-md shadow-slate-100/50 border border-slate-200/40"
                >
                  <HiOutlineDocumentDownload size={18} />
                  Descargar Plantilla Excel
                </button>
                <label className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs cursor-pointer hover:scale-105 transition-all shadow-lg shadow-blue-100">
                  Seleccionar Archivo
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="text-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mx-auto mb-4" />
              <p className="text-sm font-bold text-slate-500">Procesando archivo...</p>
            </div>
          )}

          {products.length > 0 && !result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-green-600">
                  <HiCheck className="inline mr-1" size={16} />
                  {products.length} productos parseados correctamente
                </p>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 font-black text-slate-600">Nombre</th>
                      <th className="px-4 py-3 font-black text-slate-600">Marca</th>
                      <th className="px-4 py-3 font-black text-slate-600">Código</th>
                      <th className="px-4 py-3 font-black text-slate-600">Controlado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {products.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-bold text-slate-700">{p.name}</td>
                        <td className="px-4 py-2.5 text-slate-500">{p.brand || "-"}</td>
                        <td className="px-4 py-2.5 text-slate-500 font-mono">{p.barCode || "-"}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`text-[10px] font-black px-2 py-1 rounded-lg ${
                              p.controlled
                                ? "bg-red-50 text-red-600"
                                : "bg-green-50 text-green-600"
                            }`}
                          >
                            {p.controlled ? "SI" : "NO"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {errors.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <p className="text-xs font-bold text-amber-700 mb-2">
                    <HiExclamation className="inline mr-1" />
                    {errors.length} errores de validación
                  </p>
                  <ul className="text-[11px] text-amber-600 space-y-1">
                    {errors.slice(0, 5).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                    {errors.length > 5 && (
                      <li className="font-bold">...y {errors.length - 5} más</li>
                    )}
                  </ul>
                </div>
              )}

              {isSaving ? (
                <div className="space-y-3">
                  <div className="bg-slate-50 rounded-2xl p-5 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500">Importando productos...</span>
                      <span className="text-xs font-black text-blue-600">{progress.current}/{progress.total}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium truncate">
                      {progress.productName ? `Procesando: ${progress.productName}` : "Preparando..."}
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  Confirmar y Guardar ({products.length})
                </button>
              )}
            </div>
          )}

          {result && (
            <div className="text-center py-6 space-y-4">
              <HiCheck className="mx-auto text-green-500" size={48} />
              <p className="text-lg font-black text-slate-800">
                {result.success} productos creados exitosamente
              </p>
              {result.errors.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-left">
                  <p className="text-xs font-bold text-amber-700 mb-2">
                    {result.errors.length} errores
                  </p>
                  <ul className="text-[11px] text-amber-600 space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                onClick={onComplete}
                className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-100 hover:scale-105 transition-all"
              >
                Finalizar
              </button>
            </div>
          )}

          {errors.length > 0 && products.length === 0 && !result && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <ul className="text-xs text-red-600 space-y-1">
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
              <button
                onClick={() => {
                  setErrors([]);
                  setProducts([]);
                }}
                className="mt-4 px-6 py-2.5 bg-red-600 text-white rounded-xl font-black text-xs hover:scale-105 transition-all"
              >
                Intentar de nuevo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
