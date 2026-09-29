import { useState } from "react";
import { initials } from "../lib/format.ts";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

/** Profile photo, or the person's initials when there isn't one (or it fails to load). */
export function UserAvatar({ name, url, size = "md" }: { name: string; url: string | null; size?: Size }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = url && url !== failedUrl;

  return (
    <span className={`user-avatar user-avatar-${size}`} aria-hidden="true">
      {showImage ? <img src={url} alt="" onError={() => setFailedUrl(url)} draggable={false} /> : initials(name)}
    </span>
  );
}
