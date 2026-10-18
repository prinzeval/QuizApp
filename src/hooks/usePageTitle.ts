import { useEffect } from "react";

const SITE = "SmartQuiz";

/** Sets the browser tab title, e.g. "Cardiology · SmartQuiz". Nothing (or loading) shows just the site name. */
export function usePageTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : SITE;
  }, [title]);
}
