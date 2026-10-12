import XLSX from "xlsx";
import axios from "axios";

const BASE = process.env.NEXT_PUBLIC_API_URL || "https://medizins.com";
const FILE = "/home/enzo/Descargas/INVENTARIO DRA MILE 226 (1).xlsx";
const USER = "adolfo01";
const PASS = "adolfo01";

// Barcodes con barcode real que fallaron en la carga previa y deben reintentarse
// (NO estaban en inventario, así que aumentarlos no duplica).
const RETRY_BARCODES = new Set(["8902297024122"]);

const str = (v) => (v === undefined || v === null ? "" : String(v).trim());

async function login() {
  const body = { user: USER, password: PASS, lastLogin: new Date().toISOString() };
  let data;
  try {
    const r = await axios({ method: "get", url: `${BASE}/login_agent`, data: body, headers: { "Content-Type": "application/json" }, timeout: 30000 });
    data = r.data;
  } catch (e) {
    const r = await axios.post(`${BASE}/login_agent`, body, { headers: { "Content-Type": "application/json" }, timeout: 30000 });
    data = r.data;
  }
  if (data?.success === false) throw new Error(data.message || "Login falló");
  const agent = data.agentData || data;
  const token = data.token || agent.token || data.access_token;
  const pharmacyId = str(agent.pharmacyId || agent.pharmacy_id || agent.idPharmacy);
  if (!token) throw new Error("No se obtuvo token en la respuesta de login");
  if (!pharmacyId) throw new Error("El perfil de adolfo01 no tiene pharmacyId");
  return { token, pharmacyId };
}

function readRows() {
  const wb = XLSX.readFile(FILE);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function mapRows(rows) {
  const out = [];
  const skipped = [];
  rows.forEach((row, i) => {
    const name = str(row["Nombre Articulo"] || row["Nombre"] || row["NOMBRE"]);
    if (!name) {
      skipped.push(`Fila ${i + 2}: sin nombre (omitida)`);
      return;
    }
    const realBar = str(row["Codigo Barra"] || row["Código de Barras"] || row["CODIGO BARRAS"]);
    const codeArt = str(row["Codigo Articulo"] || row["Código Articulo"]);

    // Decidir si esta fila debe cargarse ahora:
    //  - sin barcode real -> usa Codigo Articulo como fallback (es la mayoría, faltante)
    //  - con barcode real -> solo si está en RETRY_BARCODES (para no duplicar las 326 ya cargadas)
    let barCode;
    let shouldLoad;
    if (realBar) {
      barCode = realBar;
      shouldLoad = RETRY_BARCODES.has(realBar);
    } else {
      if (!codeArt) {
        skipped.push(`Fila ${i + 2} (${name}): sin barcode ni código de artículo (omitida)`);
        return;
      }
      barCode = codeArt;
      shouldLoad = true;
    }
    if (!shouldLoad) return;

    const price = Number(String(row["precio $"] || row["Precio"] || "0").replace(",", ".")) || 0;
    const stock = Math.max(0, parseInt(str(row["EXISTENCIA"] || row["Stock"] || "0"), 10) || 0);
    const components = str(row["Componentes"] || "");
    out.push({
      name,
      barCode,
      brand: str(row["Marca"] || ""),
      category: str(row["Categoria"] || "General"),
      subcategory: "Varios",
      activeIngredient: components,
      description: components,
      price,
      quantity: stock,
      stock,
      controlled: false,
      antibiotic: false,
      vat: 16,
      minimum: 0,
      discount: null,
      basePrice: null,
      profitPercentage: null,
      dosage: "",
      tablets: "",
      image: "",
      detalle: "",
    });
  });
  return { out, skipped };
}

function toCreatePayload(p) {
  return {
    name: p.name, barCode: p.barCode, brand: p.brand, category: p.category,
    subcategory: p.subcategory, activeIngredient: p.activeIngredient, description: p.description,
    price: p.price, quantity: p.quantity, stock: p.stock, controlled: p.controlled,
    antibiotic: p.antibiotic, vat: p.vat, minimum: p.minimum, discount: p.discount,
    basePrice: p.basePrice, profitPercentage: p.profitPercentage, dosage: p.dosage,
    tablets: p.tablets, image: p.image, detalle: p.detalle,
  };
}

async function createBatches(token, products) {
  const auth = { Authorization: `Bearer ${token.replace(/\s/g, "")}` };
  const BATCH = 25;
  let created = 0;
  const errors = [];
  for (let i = 0; i < products.length; i += BATCH) {
    const slice = products.slice(i, i + BATCH);
    try {
      await axios.post(`${BASE}/Medications/Create`, slice.map(toCreatePayload), { headers: { ...auth, "Content-Type": "application/json" }, timeout: 60000 });
      created += slice.length;
    } catch (e) {
      for (const p of slice) {
        try {
          await axios.post(`${BASE}/Medications/Create`, [toCreatePayload(p)], { headers: { ...auth, "Content-Type": "application/json" }, timeout: 60000 });
          created += 1;
        } catch (err) {
          const msg = err?.response?.data?.message || err?.message || "Error";
          if (!/ya existe|duplicate|exist/i.test(msg)) errors.push(`"${p.name}" (${p.barCode}): ${msg}`);
        }
      }
    }
    process.stdout.write(`\r  creando catálogo: ${Math.min(i + BATCH, products.length)}/${products.length}`);
  }
  console.log("");
  return { created, errors };
}

async function increaseInventory(token, pharmacyId, products) {
  const auth = { Authorization: `Bearer ${token.replace(/\s/g, "")}` };
  const medications = products.map((p) => ({
    bar_code: p.barCode, stock: p.stock, price: p.price, minimum: p.minimum,
    discount: null, base_price: null, profit_percentage: null,
  }));
  const { data } = await axios.post(
    `${BASE}/admin/MedicationsAgent/increase`,
    { pharmacy_id: pharmacyId, medications },
    { headers: { ...auth, "Content-Type": "application/json" }, timeout: 120000 }
  );
  return data;
}

async function verify(token, pharmacyId) {
  const auth = { Authorization: `Bearer ${token.replace(/\s/g, "")}` };
  const { data } = await axios.get(`${BASE}/admin/Pharmacy/${pharmacyId}/medications/cursor?limit=1`, { headers: auth, timeout: 30000 });
  return data?.total ?? null;
}

async function main() {
  console.log("1) Login adolfo01...");
  const { token, pharmacyId } = await login();
  console.log(`   ✓ token obtenido, pharmacyId=${pharmacyId}`);

  console.log("2) Leyendo Excel (hoja MILE)...");
  const rows = readRows();
  console.log(`   ${rows.length} filas en el archivo`);

  const { out: products, skipped } = mapRows(rows);
  console.log(`   ${products.length} productos a cargar (faltantes + reintentos), ${skipped.length} omitidas`);
  if (skipped.length) console.log("   omitidas (muestra):", skipped.slice(0, 5).join(" | "));

  console.log("3) Creando en catálogo nacional...");
  const { created, errors: createErrors } = await createBatches(token, products);
  console.log(`   ✓ ${created}/${products.length} creados`);
  if (createErrors.length) console.log(`   ⚠ ${createErrors.length} errores (muestra):\n   - ${createErrors.slice(0, 5).join("\n   - ")}`);

  console.log("4) Aumentando inventario de la farmacia (solo faltantes)...");
  const inc = await increaseInventory(token, pharmacyId, products);
  console.log("   ✓ increase:", JSON.stringify(inc).slice(0, 200));

  console.log("5) Verificando carga...");
  const total = await verify(token, pharmacyId);
  console.log(`   → total de medicamentos en inventario de adolfo01 (pharmacyId=${pharmacyId}): ${total}`);

  if (total !== null && total >= 1380) {
    console.log(`\n✅ CARGA COMPLETADA: ${total} productos en inventario`);
  } else if (total !== null) {
    console.log(`\n⚠ Revisar: ${total} en inventario (esperado ~1389). Errores arriba.`);
  } else {
    console.log(`\n⚠ No se pudo verificar el total vía API.`);
  }
}

main().catch((e) => {
  console.error("\n❌ Error general:", e?.response?.data ? JSON.stringify(e.response.data) : e.message);
  process.exit(1);
});
