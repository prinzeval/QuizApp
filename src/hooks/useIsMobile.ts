import { useMediaQuery } from "@mantine/hooks";

/** True below Mantine's `sm` breakpoint (48em), where the navbar becomes a drawer. */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 47.99em)", false, { getInitialValueInEffect: false }) ?? false;
}
