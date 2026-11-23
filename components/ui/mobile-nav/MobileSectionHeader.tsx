"use client";

/**
 * Sticky section title of the mobile shell.
 *
 * On a phone nothing told the agent which screen they were on: the shell only
 * set `document.title`. This pins the name below the navbar for the whole
 * scroll of the screen. Desktop never renders it (`lg:hidden`).
 */
export default function MobileSectionHeader({ title }: { title: string }) {
  return (
    <header
      aria-label="Sección actual"
      className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur-md lg:hidden"
    >
      <div className="flex h-11 items-center px-4">
        <p className="truncate text-[15px] font-black tracking-tight text-slate-800">
          {title}
        </p>
      </div>
    </header>
  );
}
