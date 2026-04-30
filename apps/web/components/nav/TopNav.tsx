"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ExternalLink, Menu, X } from "lucide-react";
import EyeMark from "@/components/brand/EyeMark";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Demo" },
  { href: "/ops", label: "Operations" },
  { href: "/architecture", label: "Architecture" },
  { href: "/compliance", label: "Compliance" },
  { href: "/audit", label: "Audit" },
];

export default function TopNav({ minimal = false }: { minimal?: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  // close menu on route change
  useEffect(() => {
    setOpen(false);
  }, [path]);

  // lock body scroll when sheet open
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <nav className="sticky top-0 z-30 border-b border-white/10 glass-strong">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          aria-label="Drishti home"
        >
          <EyeMark size="sm" />
          <span className="font-bold tracking-widest text-gold">DRISHTI</span>
          <span className="hidden text-[10px] font-bold uppercase tracking-widest text-indigo-300/70 md:inline">
            · The Agentic AI Loan Officer
          </span>
        </Link>

        {/* Desktop links */}
        {!minimal && (
          <div className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => {
              const active =
                l.href === "/" ? path === "/" : path?.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition",
                    active
                      ? "bg-gold/20 text-gold"
                      : "text-indigo-200/70 hover:bg-white/5 hover:text-white",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
            <a
              href="https://github.com/WarHawkADI/drishti"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 inline-flex items-center gap-1 rounded-md border border-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-indigo-200/80 transition hover:border-white/20 hover:text-white"
            >
              GitHub
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Mobile hamburger */}
        {!minimal && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="flex h-11 w-11 items-center justify-center rounded-md text-indigo-200 transition hover:bg-white/5 md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        )}
      </div>

      {/* Mobile sheet */}
      {!minimal && open && (
        <div className="md:hidden">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-x-0 bottom-0 top-14 z-20 bg-black/50 backdrop-blur-sm"
          />
          {/* Sheet */}
          <div className="relative z-30 border-t border-white/10 bg-ink/95 px-4 py-3">
            <div className="space-y-1">
              {LINKS.map((l) => {
                const active =
                  l.href === "/" ? path === "/" : path?.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      "block rounded-lg px-4 py-3 text-sm font-bold uppercase tracking-widest transition",
                      active
                        ? "bg-gold/15 text-gold"
                        : "text-indigo-100/90 hover:bg-white/5",
                    )}
                  >
                    {l.label}
                  </Link>
                );
              })}
              <a
                href="https://github.com/WarHawkADI/drishti"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3 text-sm font-bold uppercase tracking-widest text-indigo-100/90 transition hover:bg-white/5"
              >
                GitHub
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
