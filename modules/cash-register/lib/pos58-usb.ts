/* eslint-disable @typescript-eslint/no-explicit-any -- WebUSB no esta tipado en el proyecto (evitamos sumar @types/w3c-web-usb) */
type USBDevice = any;
type USBOutTransferResult = { status: string; bytesWritten: number };
// Transporte WebUSB para la impresora POS58 "No Fiscal" (clase 7 / printer).
// Guiado por el modulo del proyecto restaurante (thermal-printer.ts):
// pairing silencioso, watchdog de transferencia, chunks con drenaje, manejo de
// partial write/stall, reopen silencioso y cola de impresion (una a la vez).
//
// WebUSB es Chrome/Edge y requiere contexto seguro + un gesto del usuario para
// el primer pairing. En Linux hace falta unbind de usblp (udev); en Windows,
// driver WinUSB.

export interface UsbPrintOutcome {
  printed: boolean;
  via: "usb";
  error?: string;
}

// --- Watchdogs (knobs de hardware) ---
const TRANSFER_TIMEOUT_MS = 10_000;
const SECURITY_RETRY_DELAY_MS = 600;
const CHUNK = 4096;

interface Seams {
  transferMs: number;
}
const seams: Seams = { transferMs: TRANSFER_TIMEOUT_MS };

/** Solo para tests. */
export function __setPrinterSeams(s: Partial<Seams>): void {
  Object.assign(seams, s);
}
export function __resetPrinterSeams(): void {
  seams.transferMs = TRANSFER_TIMEOUT_MS;
}

export function isWebUsbSupported(): boolean {
  return typeof navigator !== "undefined" && Boolean((navigator as any).usb);
}

// --- Estado del dispositivo (singleton) ---
let device: USBDevice | null = null;
let endpointOut: number | null = null;

const PRINTER_CLASS = 7;

function isPrinter(dev: USBDevice): boolean {
  return dev.configurations.some((c: any) =>
    c.interfaces.some((i: any) => i.alternate.interfaceClass === PRINTER_CLASS),
  );
}

async function findPaired(): Promise<USBDevice | null> {
  const devices = await (navigator as any).usb.getDevices();
  return (devices as USBDevice[]).find(isPrinter) ?? null;
}

async function openDevice(dev: USBDevice): Promise<void> {
  try {
    try {
      await dev.open();
    } catch (e) {
      if ((e as DOMException)?.name !== "SecurityError") throw e;
      await new Promise((r) => setTimeout(r, SECURITY_RETRY_DELAY_MS));
      await dev.open();
    }
    if (dev.configuration === null) await dev.selectConfiguration(1);
    const iface = dev.configuration!.interfaces.find(
      (i: any) => i.alternate.interfaceClass === PRINTER_CLASS,
    );
    if (!iface) throw new Error("No se encontro la interfaz de impresora (clase 7)");
    await dev.claimInterface(iface.interfaceNumber);
    const ep = iface.alternate.endpoints.find((e: any) => e.direction === "out" && e.type === "bulk");
    endpointOut = ep?.endpointNumber ?? 1;
  } catch (e) {
    device = null;
    endpointOut = null;
    throw e;
  }
}

async function connect(prompt = true): Promise<void> {
  if (device && !device.opened) {
    device = null;
    endpointOut = null;
  }
  if (device) return;

  const paired = await findPaired();
  if (paired) {
    device = paired;
    try {
      await openDevice(device);
      return;
    } catch (e) {
      device = null;
      endpointOut = null;
      if (!prompt) throw e;
    }
  } else if (!prompt) {
    throw new Error("La impresora POS58 no esta conectada");
  }

  try {
    device = await (navigator as any).usb.requestDevice({ filters: [{ classCode: PRINTER_CLASS }] });
    await openDevice(device);
  } catch (e) {
    device = null;
    endpointOut = null;
    throw e;
  }
}

async function disconnect(): Promise<void> {
  const dev = device;
  device = null;
  endpointOut = null;
  if (dev) {
    try {
      await dev.close();
    } catch {
      // best-effort
    }
  }
}

// requestDevice SOLO abre el selector dentro de un gesto del usuario, y ese
// gesto expira tras los awaits del flujo fiscal. Por eso hay que enganchar la
// impresora en el mismo click del cobro, antes de la llamada HTTP.
// ponytail: si no esta emparejada, pide permiso AHORA; una vez emparejada queda
// silencioso. Si molesta el selector en cada venta, mover a agotar Permissions API.
export async function prepairPrinter(): Promise<void> {
  if (!isWebUsbSupported()) return;
  try {
    await connect(true);
  } catch {
    // Sin impresora disponible: el flujo fiscal continua; el fallback reporta el error.
  }
}

/** Empareja (gesto del usuario) y deja la impresora lista. */
export async function pairPrinter(): Promise<UsbPrintOutcome> {
  if (!isWebUsbSupported()) {
    return { printed: false, via: "usb", error: "Este navegador no soporta WebUSB (usa Chrome/Edge)." };
  }
  try {
    await connect(true);
    return { printed: true, via: "usb" };
  } catch (e) {
    return { printed: false, via: "usb", error: e instanceof Error ? e.message : String(e) };
  }
}

function timedTransferOut(dev: USBDevice, ep: number, chunk: Uint8Array): Promise<USBOutTransferResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new DOMException("La impresora no respondio (timeout)", "NetworkError")),
      seams.transferMs,
    );
  });
  return Promise.race([dev.transferOut(ep, chunk), timeout]).finally(() => clearTimeout(timer));
}

async function transferFull(dev: USBDevice, ep: number, data: Uint8Array): Promise<void> {
  let offset = 0;
  while (offset < data.length) {
    let res = await timedTransferOut(dev, ep, data.subarray(offset));
    if (res.status === "stall") {
      await dev.clearHalt("out", ep).catch(() => {});
      res = await timedTransferOut(dev, ep, data.subarray(offset));
      if (res.status === "stall") throw new DOMException("Endpoint bloqueado (stall)", "NetworkError");
    }
    if (res.bytesWritten === 0) {
      throw new DOMException("La impresora no acepto datos", "NetworkError");
    }
    offset += res.bytesWritten;
  }
}

async function sendChunks(dev: USBDevice, ep: number, data: Uint8Array): Promise<void> {
  for (let off = 0; off < data.length; off += CHUNK) {
    if (off > 0) await new Promise((r) => setTimeout(r, 20));
    await transferFull(dev, ep, data.subarray(off, off + CHUNK));
  }
}

async function write(data: Uint8Array): Promise<void> {
  if (!device || endpointOut === null) throw new Error("La impresora POS58 no esta conectada");
  try {
    await sendChunks(device, endpointOut, data);
  } catch (e) {
    if (e instanceof DOMException && e.name === "NetworkError") {
      try {
        await disconnect();
        await connect(false);
        if (!device || endpointOut === null) throw e;
        await sendChunks(device, endpointOut, data);
      } catch (inner) {
        device = null;
        endpointOut = null;
        throw inner;
      }
      return;
    }
    throw e;
  }
}

// --- Serializacion: una impresion a la vez ---
let printQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const result = printQueue.then(job);
  printQueue = result.catch(() => {});
  return result;
}

/** Imprime bytes ESC/POS. Rechaza con mensaje accionable en cualquier fallo. */
export async function printEscPos(data: Uint8Array): Promise<UsbPrintOutcome> {
  if (!isWebUsbSupported()) {
    return { printed: false, via: "usb", error: "Este navegador no soporta WebUSB (usa Chrome/Edge)." };
  }
  try {
    await enqueue(async () => {
      await connect(true);
      await write(data);
    });
    return { printed: true, via: "usb" };
  } catch (e) {
    return { printed: false, via: "usb", error: e instanceof Error ? e.message : String(e) };
  }
}
