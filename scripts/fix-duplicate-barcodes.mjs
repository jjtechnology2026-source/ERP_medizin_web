import XLSX from "xlsx";
import axios from "axios";

const BASE = process.env.NEXT_PUBLIC_API_URL || "https://medizins.com";
const FILE = "/home/enzo/Descargas/INVENTARIO DRA MILE 226 (1).xlsx";
const USER = "adolfo01";
const PASS = "adolfo01";
const str = (v) => (v === undefined || v === null ? "" : String(v).trim());

async function login() {
  const body = { user: USER, password: PASS, lastLogin: new Date().toISOString() };
  let data;
  try { data = (await axios({ method: "get", url: `${BASE}/login_agent`, data: body, headers: { "Content-Type": "application/json" }, timeout: 30000 })).data; }
  catch { data = (await axios.post(`${BASE}/login_agent`, body, { headers: { "Content-Type": "application/json" }, timeout: 30000 })).data; }
  if (data?.success === false) throw new Error(data.message || "Login falló");
  const agent = data.agentData || data;
  return { token: data.token || agent.token || data.access_token, pharmacyId: str(agent.pharmacyId || agent.pharmacy_id || agent.idPharmacy) };
}

function buildTargets() {
  const wb = XLSX.readFile(FILE);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  const seen = new Set();
  const toLoad = [];
  rows.forEach((row) => {
    const name = str(row["Nombre Articulo"]);
    if (!name) return;
    const realBar = str(row["Codigo Barra"]);
    const codeArt = str(row["Codigo Articulo"]);
    let base;
    if (realBar) base = realBar;
    else if (codeArt) base = codeArt;
    else return;

    let barCode = base;
    let dup = 0;
    while (seen.has(barCode)) { dup++; barCode = `${base}-${dup + 1}`; }
    seen.add(barCode);

    if (dup === 0) return; // primera ocurrencia ya está cargada
    const price = Number(String(row["precio $"] || "0").replace(",", ".")) || 0;
    const stock = Math.max(0, parseInt(str(row["EXISTENCIA"] || "0"), 10) || 0);
    toLoad.push({
      name, barCode, brand: str(row["Marca"] || ""), category: str(row["Categoria"] || "General"),
      subcategory: "Varios", activeIngredient: str(row["Componentes"] || ""), description: str(row["Componentes"] || ""),
      price, quantity: stock, stock, controlled: false, antibiotic: false, vat: 16, minimum: 0,
      discount: null, basePrice: null, profitPercentage: null, dosage: "", tablets: "", image: "", detalle: "",
    });
  });
  return toLoad;
}

function toPayload(p) {
  return { name: p.name, barCode: p.barCode, brand: p.brand, category: p.category, subcategory: p.subcategory,
    activeIngredient: p.activeIngredient, description: p.description, price: p.price, quantity: p.quantity, stock: p.stock,
    controlled: p.controlled, antibiotic: p.antibiotic, vat: p.vat, minimum: p.minimum, discount: p.discount,
    basePrice: p.basePrice, profitPercentage: p.profitPercentage, dosage: p.dosage, tablets: p.tablets, image: p.image, detalle: p.detalle };
}

async function main() {
  const { token, pharmacyId } = await login();
  const targets = buildTargets();
  console.log(`Presentaciones duplicadas a separar: ${targets.length}`);
  targets.forEach((t) => console.log(`   + ${t.name}  -> barcode ${t.barCode} (stock ${t.stock})`));

  const auth = { Authorization: `Bearer ${token.replace(/\s/g, "")}` };
  let created = 0; const errs = [];
  for (const p of targets) {
    try {
      await axios.post(`${BASE}/Medications/Create`, [toPayload(p)], { headers: { ...auth, "Content-Type": "application/json" }, timeout: 60000 });
      created++;
    } catch (e) { const m = e?.response?.data?.message || e?.message || ""; if (!/ya existe|duplicate/i.test(m)) errs.push(`${p.name}: ${m}`); }
  }
  console.log(`   catálogo: ${created}/${targets.length} creados`);

  const meds = targets.map((p) => ({ bar_code: p.barCode, stock: p.stock, price: p.price, minimum: 0, discount: null, base_price: null, profit_percentage: null }));
  const inc = await axios.post(`${BASE}/admin/MedicationsAgent/increase`, { pharmacy_id: pharmacyId, medications: meds }, { headers: { ...auth, "Content-Type": "application/json" }, timeout: 120000 });
  console.log("   increase:", JSON.stringify(inc).slice(0, 120));

  const { data: v } = await axios.get(`${BASE}/admin/Pharmacy/${pharmacyId}/medications/cursor?limit=1`, { headers: auth, timeout: 30000 });
  console.log(`\n✅ Total en inventario ahora: ${v.total} (antes 1389, +${targets.length} separadas)`);
  if (errs.length) console.log("   errores:", errs);
}

main().catch((e) => { console.error("❌", e?.response?.data ? JSON.stringify(e.response.data) : e.message); process.exit(1); });
