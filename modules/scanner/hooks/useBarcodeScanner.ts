"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReadInputBarcodeFormat, ReadResult } from "zxing-wasm/reader";
import { mustReleaseStream } from "../lib/stream-abandonment.ts";

/**
 * Cámara trasera + bucle de decodificación para la pantalla `/escaner`
 * (T2 de `odd/tasks/barcode-scan-price.md`).
 *
 * Decodificador: `zxing-wasm/reader`, no `zxing-wasm` ni `zxing-wasm/full`.
 * Ese subpath es sólo lectura y su binario WASM pesa ~1.04 MiB contra ~1.46 MiB
 * del "full" (el resto es el escritor de códigos, que acá no se usa). Safari en
 * iOS no tiene `BarcodeDetector` (S5), así que el decode no puede depender de la
 * API nativa del navegador.
 *
 * El `.wasm` está auto-hospedado en `public/zxing/zxing_reader.wasm` y se sirve
 * desde el mismo origen: la app corre en una farmacia con señal inestable y el
 * escaneo no puede depender de un CDN de terceros (S6). El asset se copia con
 * `pnpm sync:zxing-wasm`; hay que re-correrlo al actualizar la versión de
 * `zxing-wasm`, porque el glue JS y el binario tienen que ser de la misma build.
 * Si la carga falla o tarda, el estado final es `error` con mensaje — nunca un
 * spinner infinito (S6).
 */

export type ScannerStatus =
  /** Nadie pidió la cámara todavía. */
  | "idle"
  /** `getUserMedia` en curso (permiso / apertura del dispositivo). */
  | "starting"
  /** Stream vivo y bucle de decodificación corriendo. */
  | "running"
  /** `NotAllowedError` / `SecurityError`: el usuario o el navegador negaron la cámara. */
  | "denied"
  /** `NotFoundError`: el dispositivo no tiene cámara. */
  | "no-camera"
  /** No hay `navigator.mediaDevices`: la página no está en contexto seguro (HTTPS/localhost). */
  | "insecure"
  /** El navegador no expone la API de cámara o no soporta WebAssembly. */
  | "unsupported"
  /** Cualquier otro fallo (dispositivo ocupado, WASM caído, frame ilegible). */
  | "error";

export interface UseBarcodeScannerOptions {
  /** Se llama una vez por código detectado, con cooldown por repetición. */
  onDetect: (code: string) => void;
}

export interface BarcodeScanner {
  status: ScannerStatus;
  /** Mensaje accionable del estado; `null` en `idle`, `starting` y `running`. */
  error: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  start: () => void;
  stop: () => void;
}

/** No repetir el mismo código mientras la tarjeta del anterior sigue en pantalla. */
const REPEAT_COOLDOWN_MS = 1500;
/** Pausa entre intentos de decodificación (~4 por segundo, suficiente y barato). */
const DECODE_INTERVAL_MS = 250;
/** Máximo para cargar el módulo WASM: si no llega, es error, no spinner. */
const LOAD_TIMEOUT_MS = 20000;
/** Máximo para abrir la cámara: si no llega, es error, no spinner. */
const START_TIMEOUT_MS = 20000;

/**
 * Códigos que usa una farmacia: familia EAN/UPC y lineales industriales
 * (Code 128 / Code 39 / ITF / Codabar). Se listan explícitamente porque los
 * conjuntos predefinidos del paquete (`LINEAR_BARCODE_FORMATS`) incluyen
 * variantes que el lector no acepta (EAN-2 / EAN-5 sueltos).
 */
const PRODUCT_BARCODE_FORMATS: ReadInputBarcodeFormat[] = [
  "EAN13",
  "EAN8",
  "UPCA",
  "UPCE",
  "Code128",
  "Code39",
  "ITF",
  "Codabar",
];

type ReaderApi = typeof import("zxing-wasm/reader");

/** Binario WASM servido desde el mismo origen (public/zxing/zxing_reader.wasm). */
const ZXING_WASM_PATH = "/zxing/zxing_reader.wasm";

/**
 * Importa el lector y apunta `locateFile` al asset local. Sin este override,
 * `zxing-wasm` baja el `.wasm` desde jsDelivr en la primera lectura.
 */
async function loadReaderModule(): Promise<ReaderApi> {
  const reader = await import("zxing-wasm/reader");
  await reader.prepareZXingModule({
    overrides: {
      locateFile: (path: string) => (path.endsWith(".wasm") ? ZXING_WASM_PATH : path),
    },
    fireImmediately: true,
  });
  return reader;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Traduce el error de `getUserMedia` a un estado explícito con mensaje accionable. */
function mapCameraError(error: unknown): { status: ScannerStatus; message: string } {
  const name = (error as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return {
      status: "denied",
      message:
        "Permiso de cámara denegado. Habilitalo para este sitio en los ajustes del navegador y volvé a intentar.",
    };
  }
  if (name === "NotFoundError") {
    return { status: "no-camera", message: "Este dispositivo no tiene una cámara disponible." };
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return {
      status: "error",
      message: "La cámara está siendo usada por otra aplicación. Cerrala e intentá de nuevo.",
    };
  }
  const message = (error as { message?: unknown } | null)?.message;
  return {
    status: "error",
    message:
      typeof message === "string" && message.trim()
        ? message
        : "No se pudo iniciar la cámara. Intentá de nuevo.",
  };
}

function getCanvas(ref: React.RefObject<HTMLCanvasElement | null>): HTMLCanvasElement {
  if (!ref.current) ref.current = document.createElement("canvas");
  return ref.current;
}

/** Dibuja el frame actual del `<video>` en un canvas y lo pasa al lector WASM. */
async function decodeVideoFrame(
  reader: ReaderApi,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Promise<string | null> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;

  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(video, 0, 0, width, height);
  const frame = context.getImageData(0, 0, width, height);
  const results: ReadResult[] = await reader.readBarcodes(frame, {
    // Restringir el conjunto evita gastar tiempo buscando simbologías 2D que el
    // mostrador no usa.
    formats: PRODUCT_BARCODE_FORMATS,
    maxNumberOfSymbols: 1,
    tryHarder: true,
  });

  const hit = results.find((result) => result.isValid && result.text.trim().length > 0);
  return hit ? hit.text.trim() : null;
}

export function useBarcodeScanner({ onDetect }: UseBarcodeScannerOptions): BarcodeScanner {
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const readerRef = useRef<ReaderApi | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Generación de la sesión de cámara: incrementarla cancela bucles y aperturas en vuelo. */
  const sessionRef = useRef(0);
  const decodingRef = useRef(false);
  const lastHitRef = useRef<{ code: string; at: number } | null>(null);

  const onDetectRef = useRef(onDetect);
  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  /** Corta el stream y libera cada track: la luz de la cámara debe apagarse. */
  const releaseStream = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const handleCode = useCallback((code: string) => {
    const now = Date.now();
    const last = lastHitRef.current;
    if (last && last.code === code && now - last.at < REPEAT_COOLDOWN_MS) return;
    lastHitRef.current = { code, at: now };

    // Vibración disponible sólo en Android/Chrome; en iOS Safari no existe.
    if (typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate(80);
      } catch {
        // La vibración es un extra: si falla, el escaneo sigue.
      }
    }
    onDetectRef.current(code);
  }, []);

  const runDecodeLoop = useCallback(
    (session: number) => {
      const tick = () => {
        if (session !== sessionRef.current) return;
        void (async () => {
          const video = videoRef.current;
          if (!decodingRef.current && video && video.readyState >= 2 && video.videoWidth > 0) {
            decodingRef.current = true;
            try {
              const reader = readerRef.current;
              if (reader) {
                const code = await decodeVideoFrame(reader, video, getCanvas(canvasRef));
                if (code) handleCode(code);
              }
            } catch {
              // Un frame ilegible no es fatal; un lector roto sí: cortar y avisar.
              if (session === sessionRef.current) {
                sessionRef.current += 1;
                releaseStream();
                setStatus("error");
                setError("No se pudo leer la imagen de la cámara. Recargá la página e intentá de nuevo.");
              }
              return;
            } finally {
              decodingRef.current = false;
            }
          }
          if (session === sessionRef.current) {
            timerRef.current = setTimeout(tick, DECODE_INTERVAL_MS);
          }
        })();
      };
      tick();
    },
    [handleCode, releaseStream],
  );

  const stop = useCallback(() => {
    sessionRef.current += 1;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    decodingRef.current = false;
    lastHitRef.current = null;
    releaseStream();
    setStatus("idle");
    setError(null);
  }, [releaseStream]);

  const start = useCallback(() => {
    // Estados explícitos de S6: cada rama termina en un estado final accionable,
    // nunca en un spinner sin salida.
    if (typeof navigator === "undefined") {
      setStatus("unsupported");
      setError("Este navegador no puede acceder a la cámara.");
      return;
    }
    if (!navigator.mediaDevices) {
      setStatus("insecure");
      setError("La cámara sólo funciona en conexiones seguras (HTTPS). Abrí la app con https://.");
      return;
    }
    const mediaDevices = navigator.mediaDevices;
    if (typeof mediaDevices.getUserMedia !== "function") {
      setStatus("unsupported");
      setError("Este navegador no puede acceder a la cámara. Probá con Safari o Chrome actualizados.");
      return;
    }
    if (typeof WebAssembly === "undefined") {
      setStatus("unsupported");
      setError("Este navegador no soporta WebAssembly, que es lo que lee los códigos de barras.");
      return;
    }

    const session = sessionRef.current + 1;
    sessionRef.current = session;
    setStatus("starting");
    setError(null);

    void (async () => {
      // Las dos promesas arrancan en el mismo tick: `getUserMedia` tiene que quedar
      // dentro del gesto del usuario (iOS lo exige) y el WASM se descarga en
      // paralelo, sin bloquear el pedido de permiso.
      const readerPromise = withTimeout(
        loadReaderModule(),
        LOAD_TIMEOUT_MS,
        "No se pudo cargar el lector de códigos. Revisá la conexión e intentá de nuevo.",
      );
      // El stream se libera aunque la promesa resuelva tarde: si el timeout ganó,
      // nadie más va a ver este MediaStream y la luz de la cámara quedaría
      // encendida. En iOS aceptar el permiso después de los 20s es lo normal.
      //
      // `settled` es imprescindible: el timeout NO cambia `sessionRef`, así que
      // comparar sólo la sesión no alcanza. Cuando la carrera ya se resolvió
      // (gane el stream o gane el timeout), todo lo que llegue después es
      // huérfano y se apaga acá.
      let settled = false;
      const streamPromise = withTimeout(
        mediaDevices
          .getUserMedia({ video: { facingMode: "environment" }, audio: false })
          .then((stream) => {
            if (mustReleaseStream({ settled, session, currentSession: sessionRef.current })) {
              stream.getTracks().forEach((track) => track.stop());
            }
            return stream;
          }),
        START_TIMEOUT_MS,
        "La cámara no respondió. Cerrá otras apps que la estén usando e intentá de nuevo.",
      );
      void streamPromise.then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
        },
      );
      const [readerOutcome, streamOutcome] = await Promise.allSettled([readerPromise, streamPromise]);

      // Si una de las dos falló, el stream que sí llegó no puede quedar encendido.
      if (streamOutcome.status === "fulfilled" && readerOutcome.status === "rejected") {
        streamOutcome.value.getTracks().forEach((track) => track.stop());
      }

      try {
        if (readerOutcome.status === "fulfilled") readerRef.current = readerOutcome.value;
        if (streamOutcome.status === "rejected") throw streamOutcome.reason;
        if (readerOutcome.status === "rejected") throw readerOutcome.reason;

        const stream = streamOutcome.value;
        // Si el usuario apagó la cámara mientras se abría, liberar lo que llegó.
        if (session !== sessionRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) {
          releaseStream();
          setStatus("error");
          setError("No se pudo preparar la vista de la cámara. Recargá la página e intentá de nuevo.");
          return;
        }
        video.srcObject = stream;
        try {
          await video.play();
        } catch {
          // iOS exige `muted`+`playsInline` (van en el JSX); si play() rechaza, el
          // stream igual queda vivo y el primer frame llega solo.
        }
        if (session !== sessionRef.current) {
          releaseStream();
          return;
        }
        setStatus("running");
        runDecodeLoop(session);
      } catch (caught) {
        if (session !== sessionRef.current) return;
        releaseStream();
        const mapped = mapCameraError(caught);
        setStatus(mapped.status);
        setError(mapped.message);
      }
    })();
  }, [releaseStream, runDecodeLoop]);

  // Desmontar (o cambiar de pantalla) apaga la cámara: nunca queda un track vivo.
  useEffect(() => {
    return () => {
      sessionRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      decodingRef.current = false;
      const stream = streamRef.current;
      streamRef.current = null;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return { status, error, videoRef, start, stop };
}
