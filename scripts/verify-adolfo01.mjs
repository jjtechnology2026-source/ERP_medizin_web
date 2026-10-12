import XLSX from "xlsx";
import axios from "axios";

const BASE = process.env.NEXT_PUBLIC_API_URL || "https://medizins.com";
const FILE = "/home/enzo/Descargas/INVENTARIO DRA MILE 226 (1).xlsx";
const USER = "adolfo01";
const PASS = "adolfo01";
const RETRY_BARCODES = new Set(["8902297024122"]);
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

function expectedBarcodes() {
  const wb = XLSX.readFile(FILE);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  const set = new Map();
  rows.forEach((row) => {
    const name = str(row["Nombre Articulo"]);
    if (!name) return;
    const realBar = str(row["Codigo Barra"]);
    const codeArt = str(row["Codigo Articulo"]);
    let bar;
    if (realBar) bar = realBar;
    else if (codeArt) bar = codeArt;
    else return;
    set.set(bar, { name, stock: Math.max(0, parseInt(str(row["EXISTENCIA"] || "0"), 10) || 0), price: Number(String(row["precio $"] || "0").replace(",", ".")) || 0 });
  });
  return set;
}

async function fetchInventory(token, pharmacyId) {
  const auth = { Authorization: `Bearer ${token.replace(/\s/g, "")}` };
  const map = new Map();
  let cursor, total = 0, pages = 0;
  let hasMore = true;
  while (hasMore && pages < 300) {
    const url = `${BASE}/admin/Pharmacy/${pharmacyId}/medications/cursor?limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const { data } = await axios.get(url, { headers: auth, timeout: 30000 });
    total = data.total ?? total;
    (data.medications || []).forEach((m) => map.set(str(m.barCode || m.bar_code), m));
    cursor = data.next_cursor || null;
    hasMore = Boolean(data.has_more);
    pages++;
  }
  return { map, total, pages };
}

async function main() {
  const { token, pharmacyId } = await login();
  console.log(`pharmacyId=${pharmacyId}`);
  const expected = expectedBarcodes();
  console.log(`Esperados (barcodes del Excel): ${expected.size}`);

  const { map, total, pages } = await fetchInventory(token, pharmacyId);
  console.log(`En inventario (API): total=${total}, páginas=${pages}, items leídos=${map.size}`);

  let present = 0, missing = [];
  const stockMismatch = [];
  for (const [bar, exp] of expected) {
    const inv = map.get(bar);
    if (!inv) { missing.push(`${exp.name} [${bar}]`); continue; }
    present++;
    const invStock = Number(inv.stock ?? inv.quantity ?? 0);
    if (exp.stock !== 0 && invStock !== exp.stock) stockMismatch.push(`${exp.name} [${bar}]: Excel=${exp.stock} vs Inventario=${invStock}`);
  }

  console.log(`\n✅ Presentes en inventario: ${present}/${expected.size}`);
  if (missing.length) {
    console.log(`\n❌ FALTANTES (${missing.length}):`);
    missing.slice(0, 20).forEach((m) => console.log("   - " + m));
    if (missing.length > 20) console.log(`   ...y ${missing.length - 20} más`);
  } else {
    console.log("   Todos los productos del Excel están en el inventario.");
  }
  if (stockMismatch.length) {
    console.log(`\n⚠ Diferencias de stock (${stockMismatch.length}, muestra):`);
    stockMismatch.slice(0, 10).forEach((m) => console.log("   - " + m));
  } else {
    console.log("   Stock coincide para los productos con EXISTENCIA > 0.");
  }
  console.log(`\nResumen: ${present} cargados, ${missing.length} faltantes, ${map.size - present} extras en inventario no provenientes del Excel.`);
}

main().catch((e) => { console.error("❌", e?.response?.data ? JSON.stringify(e.response.data) : e.message); process.exit(1); });
