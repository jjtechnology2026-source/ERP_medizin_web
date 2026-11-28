"use client";

// Estado del canal de comprobante de ESTA terminal, para que el operador lo vea
// ANTES de cobrar (`odd/tasks/canal-comprobante-por-caja.md`, T12, Spec S5).
//
// Monta el vigilante de `channel-watchdog.ts` y expone su ultimo estado con
// `useSyncExternalStore`. Lo que se muestra es una ANTICIPACION, no la verdad
// con la que se cobra: la venta resuelve el canal fresco con
// `resolveTerminalChannel()`. Por eso `isStale` importa tanto como `decision`:
// con la pestana oculta o con sondeos que fallan, lo ultimo leido puede tener
// minutos, y la UI tiene que decirlo en vez de mostrar un canal viejo como si
// estuviera confirmado.

import { useEffect, useSyncExternalStore } from "react";
import { channelWatchdog, type ChannelStatusSnapshot } from "../lib/channel-watchdog.ts";
import type { ChannelDecision } from "../lib/channel-detect.ts";

export interface ChannelStatus {
  /** Ultima decision conocida. `null` hasta el primer sondeo. */
  decision: ChannelDecision | null;
  /** true si la decision publicada ya no esta confirmada (pestana oculta, sondeos que fallan). */
  isStale: boolean;
}

/**
 * Snapshot del servidor y estado inicial: sin sondeo todavia no hay decision
 * que mostrar. Constante para no romper la comparacion por referencia de
 * `useSyncExternalStore`.
 */
const INITIAL_SNAPSHOT: ChannelStatusSnapshot = { decision: null, isStale: true };

/**
 * El vigilante es un unico por pestana, asi que se cuenta cuantos componentes lo
 * usan: el primero lo arranca y el ultimo lo corta. Sin esto, desmontar un
 * consumidor apagaria el canal que otro todavia esta mostrando.
 */
let mountedConsumers = 0;

export function useChannelStatus(): ChannelStatus {
  const snapshot = useSyncExternalStore(
    channelWatchdog.subscribe,
    channelWatchdog.getSnapshot,
    () => INITIAL_SNAPSHOT,
  );

  useEffect(() => {
    mountedConsumers += 1;
    if (mountedConsumers === 1) channelWatchdog.start();
    return () => {
      mountedConsumers -= 1;
      if (mountedConsumers === 0) channelWatchdog.stop();
    };
  }, []);

  // `decision` se lee del snapshot en cada render: el canal de la terminal puede
  // cambiar sin que cambie este componente.
  return { decision: snapshot.decision, isStale: snapshot.isStale };
}

export default useChannelStatus;
