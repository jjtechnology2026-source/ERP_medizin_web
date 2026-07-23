const debouncedQuery = "PARACETAMOL";
const q = debouncedQuery.toLowerCase().trim();
const m = { name: "paracetamol" };
console.log((m.name || "").toLowerCase().includes(q));
const m2 = { name: "PARACETAMOL" };
const q2 = "paracetamol".toLowerCase().trim();
console.log((m2.name || "").toLowerCase().includes(q2));
