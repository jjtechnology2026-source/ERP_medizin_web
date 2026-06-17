import { useState, useRef, useEffect } from "react";
import { HiCloudUpload, HiOutlineChevronDown, HiOutlineCamera, HiOutlineDocumentDownload, HiOutlineTable, HiTrash } from "react-icons/hi";
import { useCreateMedication } from "../hook/useCreateProduct";
import BulkImportDialog from "../components/BulkImportDialog";

// Interfaz para el manejo de imágenes múltiples en local
export interface LocalImage {
  id: string; // Identificador único para el drag-and-drop o key
  name: string;
  data: number[];
  previewUrl: string;
}

const CATEGORY_MAP: Record<string, string[]> = {
  "Higiene": ["Cuidado Oral", "Cuidado Capilar", "Jabones", "Desodorantes", "Afeitado", "Otros"],
  "Medicamentos": ["Analgesicos", "Antibióticos", "Antialérgicos", "Antiinflamatorios", "Cardiovascular", "Gastrointestinal", "Otros"],
  "Insumos": ["Jeringas", "Gasas", "Algodón", "Tapabocas", "Guantes", "Otros"],
  "Bebé": ["Pañales", "Fórmulas", "Toallitas", "Accesorios", "Cremas", "Otros"],
  "Otros": ["Varios", "Suplementos", "Confitería", "Cosméticos", "Otros"]
};

const CATEGORY_KEYS = Object.keys(CATEGORY_MAP);

interface SearchableSelectProps {
  label: string;
  placeholder: string;
  required?: boolean;
  value: string;
  options: string[];
  onChange: (val: string) => void;
}

function SearchableSelect({ label, placeholder, required, value, options, onChange }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const showAddCustom = search && !options.some(o => o.toLowerCase() === search.toLowerCase());

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      <label className="text-[11px] font-black text-slate-400 uppercase ml-1">
        {label}: {required && <span className="text-red-500">*</span>}
      </label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 text-sm transition-all cursor-pointer flex justify-between items-center"
      >
        <span className={value ? "text-slate-800 font-bold" : "text-slate-400"}>
          {value || placeholder}
        </span>
        <HiOutlineChevronDown className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[300px]">
          <div className="p-3 border-b border-slate-100 bg-slate-50/50">
            <input
              type="text"
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none text-xs focus:ring-2 focus:ring-blue-500/20"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="overflow-y-auto flex-1 py-2">
            {filteredOptions.length === 0 && !showAddCustom && (
              <div className="px-6 py-3 text-xs text-slate-400 italic">No se encontraron opciones</div>
            )}
            {filteredOptions.map((opt) => (
              <div
                key={opt}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(opt);
                  setSearch("");
                  setIsOpen(false);
                }}
                className={`px-6 py-3 text-xs font-bold cursor-pointer hover:bg-blue-50 hover:text-blue-600 transition-colors ${
                  value === opt ? "bg-blue-50/50 text-blue-600 font-black" : "text-slate-700"
                }`}
              >
                {opt}
              </div>
            ))}
            {showAddCustom && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(search);
                  setSearch("");
                  setIsOpen(false);
                }}
                className="px-6 py-3 text-xs font-black cursor-pointer text-blue-600 hover:bg-blue-50 border-t border-slate-100 transition-colors"
              >
                + Agregar "{search}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreateProductPage({ setView }: any) {
  const [selectedUnit, setSelectedUnit] = useState("mg");
  const { createMedication, isLoading, error } = useCreateMedication();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = async () => {
    try {
      const XLSX = await import("xlsx");
      const headers = [
        "Nombre Comercial", "Marca", "Código de Barras", "Principio Activo",
        "Dosis", "Presentación/Tabletas", "Categoría", "Subcategoría",
        "Descripción", "Precio", "Stock Inicial", "Mínimo Stock", "IVA", "Controlado (SI/NO)", "Antibiótico (SI/NO)"
      ];
      const dummyData = [
        {
          "Nombre Comercial": "Acetaminofen Genfar",
          "Marca": "Genfar",
          "Código de Barras": "7591234567890",
          "Principio Activo": "Acetaminofen",
          "Dosis": "500 mg",
          "Presentación/Tabletas": "10 tabletas",
          "Categoría": "Medicamentos",
          "Subcategoría": "Analgesicos",
          "Descripción": "Medicamento para el alivio del dolor y la fiebre",
          "Precio": 3.5,
          "Stock Inicial": 20,
          "Mínimo Stock": 5,
          "IVA": 16,
          "Controlado (SI/NO)": "NO",
          "Antibiótico (SI/NO)": "NO"
        },
      ];
      const worksheet = XLSX.utils.json_to_sheet(dummyData, { header: headers });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla");
      XLSX.writeFile(workbook, "plantilla_carga_masiva.xlsx");
    } catch (err) {
      console.error("Error al descargar plantilla:", err);
    }
  };

  // Estado para un arreglo de hasta 10 imágenes
  const [images, setImages] = useState<LocalImage[]>([]);

  const [formData, setFormData] = useState({
    brand: "",
    activeIngredient: "",
    doseValue: "",
    doseUnit: "mg",
    amount: "",
    barCode: "",
    name: "",
    category: "",
    subcategory: "",
    description: "",
    presentation: "Tabletas",
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (images.length + files.length > 10) {
      alert("Solo puedes subir un máximo de 10 imágenes.");
      return;
    }

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");

          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL("image/webp", 0.8);

            const base64String = dataUrl.split(",")[1];
            const binaryString = window.atob(base64String);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            const newFileName = file.name.split(".")[0] + ".webp";

            setImages((prev) => [
              ...prev,
              {
                id: Math.random().toString(36).substring(7),
                name: newFileName,
                data: Array.from(bytes),
                previewUrl: dataUrl,
              },
            ]);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const clearAllImages = () => {
    setImages([]);
  };

  const moveImage = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === images.length - 1) return;

    const newImages = [...images];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    const temp = newImages[index];
    newImages[index] = newImages[targetIndex];
    newImages[targetIndex] = temp;

    setImages(newImages);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      ...formData,
      doseUnit: selectedUnit,
      price: "0",
      stock: "0",
      minimum: "0",
      vat: 0,
      controlled: false,
      antibiotic: false,
    };

    const result = await createMedication(payload, images);

    if (result.success) {
      setSuccessMsg("Producto creado exitosamente. Redirigiendo...");
      setTimeout(() => setView("LIST"), 1500);
    }
  };

  const subcategoryOptions = CATEGORY_MAP[formData.category] || [];

  return (
    <div className="w-full max-w-[1600px] flex flex-col space-y-4">
      <h1 className="text-3xl font-black text-blue-600 px-4">Crear Producto</h1>

      <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 p-10">
        <div className="flex gap-6 mb-10 text-[11px] font-black text-blue-600 uppercase tracking-widest">
          <button onClick={() => setView("LIST")} className="flex items-center gap-1 hover:text-blue-800 transition-colors">
            ← Regresar
          </button>
          <button onClick={downloadTemplate} className="flex items-center gap-1 hover:underline">
            <HiOutlineDocumentDownload size={16} /> Plantilla Excel
          </button>
          <button onClick={() => setShowBulkImport(true)} className="flex items-center gap-2 bg-blue-50 px-4 py-1.5 rounded-2xl hover:bg-blue-100 transition-colors">
            <HiOutlineTable size={16} /> Carga Masiva Excel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-20">
          {/* COLUMNA IZQUIERDA */}
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-blue-600">Contenido Multimedia</h2>
                <p className="text-xs text-slate-400 mt-1">Imágenes subidas: {images.length} / 10</p>
              </div>
              <div className="flex gap-2">
                {images.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllImages}
                    className="bg-red-50 text-red-600 px-3 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 hover:bg-red-100"
                  >
                    <HiTrash size={14} /> Limpiar todo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={images.length >= 10}
                  className="bg-slate-700 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 disabled:opacity-50"
                >
                  <HiOutlineCamera size={16} /> Cargar Imágenes
                </button>
              </div>

              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleImageChange} />
            </div>

            {/* Zona de arrastre / carga */}
            {images.length === 0 ? (
              <div className="border-4 border-dashed border-slate-50 rounded-[40px] py-24 flex flex-col items-center justify-center bg-slate-50/30">
                <HiCloudUpload size={40} className="text-blue-500 mb-4 opacity-50" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-black text-sm shadow-xl shadow-blue-100"
                >
                  Subir Archivos
                </button>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {images.map((imgItem, index) => (
                  <div key={imgItem.id} className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-100 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <img
                        src={imgItem.previewUrl}
                        alt={imgItem.name}
                        className="w-14 h-14 object-cover rounded-xl border border-slate-200 shadow-sm"
                      />
                      <div>
                        <p className="text-xs font-black text-slate-800 truncate max-w-[180px]">{imgItem.name}</p>
                        <span className="text-[10px] font-bold text-slate-400">Posición: {index + 1}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveImage(index, "up")}
                        className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
                        disabled={index === 0}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(index, "down")}
                        className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
                        disabled={index === images.length - 1}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(imgItem.id)}
                        className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"
                      >
                        <HiTrash size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>

          {/* COLUMNA DERECHA */}
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-blue-600 mb-8">Información del Producto</h2>

            <div className="grid grid-cols-1 gap-5">
              <InputField
                label="Código de barras"
                placeholder="ej: 7591234567890"
                value={formData.barCode}
                onChange={(e: any) => setFormData({ ...formData, barCode: e.target.value })}
                required
              />
              <InputField
                label="Marca"
                placeholder="ej: Genfar"
                value={formData.brand}
                onChange={(e: any) => setFormData({ ...formData, brand: e.target.value })}
                required
              />
              <InputField
                label="Principio activo"
                placeholder="ej: Acetaminofen"
                value={formData.activeIngredient}
                onChange={(e: any) => setFormData({ ...formData, activeIngredient: e.target.value })}
                required
              />
              <InputField
                label="Nombre comercial"
                placeholder="ej: Acetaminofen 500mg"
                value={formData.name}
                onChange={(e: any) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <InputField
                label="Dosis"
                placeholder="ej: 500"
                value={formData.doseValue}
                onChange={(e: any) => setFormData({ ...formData, doseValue: e.target.value })}
                required
              />

              <InputField
                label="Cantidad"
                placeholder="Cantidad de presentación (ej: 10)"
                value={formData.amount}
                onChange={(e: any) => setFormData({ ...formData, amount: e.target.value })}
                required
              />

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase ml-1">Presentación: *</label>
                <div className="grid grid-cols-2 gap-2">
                  {["Frasco", "Tabletas", "Pastillas", "Capsulas", "Empaque"].map((opt) => (
                    <div
                      key={opt}
                      onClick={() => setFormData({ ...formData, presentation: opt })}
                      className={`flex items-center gap-3 p-4 bg-slate-50 border rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                        formData.presentation === opt
                          ? "border-blue-600 bg-blue-50/30 text-blue-600 font-black"
                          : "border-slate-100 text-slate-600 hover:bg-white hover:border-blue-200"
                      }`}
                    >
                      <div
                        className={`size-4 rounded-full border-2 ${formData.presentation === opt ? "border-blue-600 bg-blue-600" : "border-slate-300"}`}
                      />
                      {opt}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase ml-1">Unidad métrica: *</label>
                <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
                  {["und", "ml", "l", "cc", "mg", "gr", "mcg"].map((u) => (
                    <button
                      type="button"
                      key={u}
                      onClick={() => setSelectedUnit(u)}
                      className={`flex-1 px-2 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                        selectedUnit === u ? "bg-blue-600 text-white shadow-md" : "text-slate-400"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase ml-1">Descripción: *</label>
              <textarea
                className="w-full px-6 py-4 bg-slate-50 rounded-[24px] outline-none border border-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 text-sm min-h-[120px]"
                placeholder="ej: Escribe la descripción de tu producto..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <SearchableSelect
                label="Categoría"
                placeholder="Seleccione una categoría"
                required
                value={formData.category}
                options={CATEGORY_KEYS}
                onChange={(val) => setFormData({ ...formData, category: val, subcategory: "" })}
              />
              <SearchableSelect
                label="Subcategoría"
                placeholder="Seleccione una subcategoría"
                required
                value={formData.subcategory}
                options={subcategoryOptions}
                onChange={(val) => setFormData({ ...formData, subcategory: val })}
              />
            </div>
          </div>

            {successMsg && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
                <p className="text-emerald-700 text-xs font-bold">{successMsg}</p>
              </div>
            )}
            {error && <p className="text-red-500 text-xs font-bold">{error}</p>}

            <div className="flex gap-4 pt-10 sticky bottom-0 bg-white py-4 border-t border-slate-50">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-5 bg-blue-600 text-white rounded-[24px] font-black text-lg shadow-2xl shadow-blue-100"
              >
                {isLoading ? "Guardando..." : "Guardar Producto"}
              </button>
              <button
                type="button"
                onClick={() => setView("LIST")}
                className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-[24px] font-black text-lg"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      </div>
      <BulkImportDialog
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onComplete={() => {
          setShowBulkImport(false);
          setView("LIST");
        }}
      />
    </div>
  );
}

function InputField({ label, placeholder, required, isSelect, value, onChange, type = "text", step }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-black text-slate-400 uppercase ml-1">
        {label}: {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type={type}
          step={step}
          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 text-sm transition-all"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
        />
        {isSelect && <HiOutlineChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" />}
      </div>
    </div>
  );
}
