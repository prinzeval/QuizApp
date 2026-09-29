import type { ReactNode } from "react";
import classes from "./Doodles.module.css";

/** Marker-style yellow underline, drawn in on load. */
export function Scribble({ children }: { children: ReactNode }) {
  return (
    <span className={classes.scribble}>
      {children}
      <svg viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">
        <path d="M3 13c35-7 75-9 115-6 27 2 53 3 79-2" />
      </svg>
    </span>
  );
}

/** Hand-drawn open book for the empty rooms state. */
export function BookDoodle() {
  return (
    <svg className={classes.book} viewBox="0 0 120 90" aria-hidden="true">
      <path d="M60 22C46 12 28 11 12 15v58c16-4 33-2 48 8 15-10 32-12 48-8V15c-16-4-34-3-48 7z" />
      <path d="M60 22v59" />
      <path d="M22 32c8-2 17-2 26 1M22 44c8-2 17-2 26 1M72 33c9-3 18-3 26-1" />
    </svg>
  );
}
