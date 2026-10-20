import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.ts";

/** The server's sign-in options (Google client id, whether email is set up). Fetched once per visit. */
export function useAuthConfig() {
  return useQuery({
    queryKey: ["auth", "config"],
    queryFn: api.authConfig,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
}
