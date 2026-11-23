"use client";

import { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { HiOutlineX } from "react-icons/hi";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rendered as `Dialog.Title`, so it also names the dialog (aria-labelledby). */
  title: ReactNode;
  /** Wired as `Dialog.Description` (aria-describedby) when present. */
  description?: ReactNode;
  /** Sticky action row. Sits above the iOS home indicator on its own. */
  footer?: ReactNode;
  /** Scrollable body, between the fixed header and the fixed footer. */
  children?: ReactNode;
}

/**
 * The one contextual surface of the mobile shell (spec S9).
 *
 * Two deliberate compositions instead of one shrunk layout (spec S2):
 * below `sm` it is a bottom sheet anchored to the bottom edge with an
 * 85dvh ceiling and a scrollable body; from `sm` up it is the classic
 * centered dialog with a width cap. Desktop behaviour of the screens that
 * adopt it does not change (spec S4).
 *
 * Radix owns the behaviour a hand-written overlay never had: focus trap,
 * `aria-labelledby`/`aria-describedby`, Escape, scrim tap, scroll lock and
 * focus restore. This component only owns the look and the sticky layout.
 */
export default function Sheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
}: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-[9998] bg-slate-900/40 backdrop-blur-sm" />

        {/* Bottom sheet under `sm`; from `sm` a centered box. Centering uses
            `inset-0` + `m-auto` + `h-fit` so no transform is parked on the
            panel and the entrance animation stays unencumbered. */}
        <Dialog.Content className="sheet-panel fixed inset-x-0 bottom-0 z-[9999] flex max-h-[85dvh] flex-col overflow-hidden rounded-t-[32px] bg-white pb-[var(--mobile-tabbar-safe-bottom)] shadow-[0_-12px_48px_-16px_rgba(15,23,42,0.35)] outline-none sm:inset-0 sm:m-auto sm:h-fit sm:w-full sm:max-w-lg sm:rounded-[32px] sm:pb-0 sm:shadow-[0_32px_64px_-15px_rgba(0,0,0,0.25)]">
          {/* Header and footer never scroll: only the body does, so the title
              and the actions stay reachable on a long form. */}
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-4 sm:px-7 sm:pt-6">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="pt-1 text-lg font-black leading-snug tracking-tight text-slate-800 sm:text-xl">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm font-medium leading-relaxed text-slate-500">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Cerrar"
                className="-mr-1 flex size-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
              >
                <HiOutlineX size={22} />
              </button>
            </Dialog.Close>
          </header>

          {children ? (
            // `overscroll-contain` stops the sheet's scroll from chaining into
            // the shell behind it (spec S8).
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-7">
              {children}
            </div>
          ) : null}

          {footer ? (
            <footer className="shrink-0 border-t border-slate-100 bg-white px-5 pb-4 pt-3 sm:px-7 sm:pb-6 sm:pt-4">
              {footer}
            </footer>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
