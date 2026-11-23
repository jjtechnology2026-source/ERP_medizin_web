"use client";

import { ReactNode } from "react";
import { cn } from "@/modules/core/utils/ui";

interface ActionBarProps {
  /** The screen's single primary action (spec S6). Receives 56px of height. */
  primary: ReactNode;
  /** At most two secondary actions; the rest belongs to an overflow or a Sheet. */
  secondary?: ReactNode[];
  /**
   * Stack the bar on top of the shell's bottom tab bar instead of overlapping
   * it. Required whenever the screen keeps the bottom navigation visible.
   */
  stacked?: boolean;
}

/**
 * Fixed action bar of a mobile screen (specs S3, S6).
 *
 * It only exists below `lg`: on desktop the same actions stay in place in the
 * existing toolbars, so nothing changes there (spec S4). The primary action is
 * 56px tall, every neighbour is at least 44×44 (S3), the row gap is 8px, and
 * the bar clears the home indicator through the shared safe-area token (S8).
 */
export default function ActionBar({
  primary,
  secondary,
  stacked = false,
}: ActionBarProps) {
  const secondaryActions = (secondary ?? []).slice(0, 2);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden",
        // Stacked bars sit above the tab bar, which already owns the safe-area
        // strip; a standalone bar has to clear the home indicator itself.
        stacked
          ? "pb-3 bottom-[var(--mobile-tabbar-total-height)]"
          : "pb-[calc(12px_+_var(--mobile-tabbar-safe-bottom))]",
      )}
    >
      <div className="flex items-stretch gap-2 px-3 pt-2">
        <div className="flex flex-1 items-stretch gap-2 [&>*]:min-h-14 [&>*]:w-full [&>*]:rounded-2xl">
          {primary}
        </div>

        {secondaryActions.length > 0 && (
          // 44×44 floor for the secondary actions, 8px apart from the primary
          // and from each other (S3).
          <div className="flex shrink-0 items-center gap-2 [&>*]:min-h-11 [&>*]:min-w-11 [&>*]:rounded-2xl">
            {secondaryActions}
          </div>
        )}
      </div>
    </div>
  );
}
