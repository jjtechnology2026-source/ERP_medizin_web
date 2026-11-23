"use client";

import { useState } from "react";
import {
  HiCheckCircle,
  HiMinus,
  HiOutlineExclamationCircle,
  HiPlus,
} from "react-icons/hi";
import { adjustScannedStock } from "../api/stock-adjust.service.ts";
import {
  buildAdjustment,
  describeDelta,
  parseTypedDelta,
  stepDelta,
  type AdjustDirection,
} from "../lib/stock-adjustment.ts";
import type { StockAdjustResult } from "../lib/stock-adjust-contract.ts";

interface StockAdjustControlProps {
  /** Código **guardado** en el inventario (`product.barCode`). */
  barCode: string;
  pharmacyId?: string | null;
  /** Stock que muestra la tarjeta: el leído o el que dejó el ajuste anterior. */
  stock: number;
  onAdjusted: (result: StockAdjustResult) => void;
}

type Feedback =
  | { kind: "ok"; previous: number; next: number }
  | { kind: "error"; message: string }
  | null;

/**
 * Ajuste de stock de un producto escaneado (`odd/tasks/scanner-stock-adjust.md`,
 * T3 + S5/S6).
 *
 * Un solo campo para la cantidad y dos botones que mueven **ese mismo valor**: −
 * y + restan o suman de a una unidad, y el signo es el que manda (positivo suma,
 * negativo resta). Escribir dígitos sin signo significa "sumar": el teclado
 * numérico de iOS no tiene menos, así que quitar N se hace tocando − N veces. La
 * copia dice siempre el efecto completo ("Sumar 3 unidades") para que nadie lea
 * el número como un stock.
 *
 * Nada se escribe al tocar: hace falta el botón de confirmar. El tope contra el
 * stock leído recorta el valor y bloquea la confirmación, así que el 422 del
 * backend no es la única defensa contra dejar el stock negativo (S5).
 *
 * El permiso no se chequea acá: sin permiso, `modules/scanner/index.tsx` no
 * monta este componente (T4).
 */
export default function StockAdjustControl({
  barCode,
  pharmacyId,
  stock,
  onAdjusted,
}: StockAdjustControlProps) {
  const [raw, setRaw] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const draft = buildAdjustment(raw, stock);

  const applyStep = (direction: AdjustDirection) => {
    if (pending) return;
    const current = parseTypedDelta(raw);
    setRaw(String(stepDelta(current.ok ? current.delta : 0, direction)));
    setFeedback(null);
  };

  const confirm = async () => {
    if (pending || !draft.canConfirm) return;
    setPending(true);
    setFeedback(null);
    const outcome = await adjustScannedStock({
      pharmacyId,
      barCode,
      delta: draft.delta,
    });
    setPending(false);
    if (outcome.status === "adjusted") {
      setRaw("");
      setFeedback({
        kind: "ok",
        previous: outcome.result.stockPrevio,
        next: outcome.result.stockNuevo,
      });
      onAdjusted(outcome.result);
      return;
    }
    setFeedback({ kind: "error", message: outcome.message });
  };

  return (
    <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 p-5 space-y-3">
      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Ajustar stock
        </p>
        <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
          Sumá o restá unidades de este producto. El cambio queda en el libro de inventario.
        </p>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => applyStep(-1)}
          disabled={pending}
          aria-label="Quitar una unidad"
          className="min-h-11 min-w-11 flex items-center justify-center rounded-2xl bg-red-50 text-red-500 text-xl font-black active:bg-red-100 disabled:opacity-40 transition-colors"
        >
          <HiMinus size={20} />
        </button>

        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="done"
          maxLength={8}
          placeholder="0"
          value={raw}
          disabled={pending}
          onChange={(event) => {
            setRaw(event.target.value);
            setFeedback(null);
          }}
          aria-label="Cantidad de unidades a sumar o restar"
          className="h-11 w-24 shrink-0 rounded-2xl border border-slate-300 bg-white px-3 text-center font-mono text-base font-black tabular-nums text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60"
        />

        <button
          type="button"
          onClick={() => applyStep(1)}
          disabled={pending}
          aria-label="Sumar una unidad"
          className="min-h-11 min-w-11 flex items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 text-xl font-black active:bg-emerald-100 disabled:opacity-40 transition-colors"
        >
          <HiPlus size={20} />
        </button>
      </div>

      <div className="bg-slate-50 rounded-2xl p-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-500">{describeDelta(draft.delta)}</span>
          <span className="font-mono text-xs font-black tabular-nums text-slate-600">
            {draft.previousStock} → {draft.resultStock}
          </span>
        </div>
        {draft.notice && (
          <p className="text-[11px] font-bold leading-relaxed text-amber-600">{draft.notice}</p>
        )}
      </div>

      <button
        type="button"
        onClick={confirm}
        disabled={pending || !draft.canConfirm}
        className="w-full min-h-11 rounded-2xl bg-[#0057FF] text-sm font-black tracking-wide text-white transition-colors active:bg-[#0046CC] disabled:bg-slate-200 disabled:text-slate-400"
      >
        {pending ? "Guardando..." : "Confirmar ajuste"}
      </button>

      {feedback?.kind === "ok" && (
        <div className="flex items-start gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700">
          <HiCheckCircle size={18} className="shrink-0 mt-0.5" />
          <p className="text-[11px] font-black leading-relaxed">
            Stock actualizado: {feedback.previous} → {feedback.next}
          </p>
        </div>
      )}

      {feedback?.kind === "error" && (
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700">
          <HiOutlineExclamationCircle size={18} className="shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold leading-relaxed">{feedback.message}</p>
        </div>
      )}
    </div>
  );
}
