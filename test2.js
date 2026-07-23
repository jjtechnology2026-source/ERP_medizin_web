const q = "PARACETAMOL".toLowerCase().trim();
const name = "paracetamol";
console.log((name || "").toLowerCase().includes(q));

const q2 = "paracetamol".toLowerCase().trim();
const name2 = "PARACETAMOL";
console.log((name2 || "").toLowerCase().includes(q2));
