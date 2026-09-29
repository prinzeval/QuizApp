import { createTheme, type CSSVariablesResolver, type MantineColor, type MantineColorsTuple } from "@mantine/core";
import type { roomColor } from "./lib/format.ts";
import touch from "./touch.module.css";

/** Terracotta accent. Shade 7 is the filled colour: white text on it passes WCAG AA (4.9:1). */
const clay: MantineColorsTuple = ["#FBF1EC", "#F6E3DA", "#EFC9B7", "#E6AA8F", "#DE8E6C", "#D97757", "#C96442", "#B5553A", "#99462F", "#6E3322"];

/** Warm greys (Mantine uses these for borders, hovers and placeholders in light mode). */
const gray: MantineColorsTuple = ["#FAF9F5", "#F5F4ED", "#EDEBE3", "#E3E0D5", "#D6D3C7", "#B0ADA2", "#87857C", "#6B6A63", "#4A4944", "#2B2A27"];

/** Warm darks (Mantine's dark-mode surfaces, borders and text). */
const dark: MantineColorsTuple = ["#EDECE6", "#C8C6BD", "#A6A49B", "#7C7A72", "#4A4945", "#3B3A37", "#30302E", "#262624", "#1F1E1D", "#171716"];

const sans = "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const serif = "'Source Serif 4', Georgia, 'Times New Roman', serif";

export const theme = createTheme({
  colors: { clay, gray, dark },
  primaryColor: "clay",
  primaryShade: { light: 7, dark: 7 },
  white: "#FFFFFF",
  black: "#1F1E1D",
  defaultRadius: "md",
  fontFamily: sans,
  headings: {
    fontFamily: serif,
    fontWeight: "600",
    sizes: {
      h1: { fontSize: "2rem", lineHeight: "1.2" },
      h2: { fontSize: "1.25rem", lineHeight: "1.35" },
      h3: { fontSize: "1.125rem", lineHeight: "1.35" },
    },
  },
  cursorType: "pointer",
  other: {
    light: { canvas: "#FAF9F5", sidebar: "#F5F4ED" },
    dark: { canvas: "#262624", sidebar: "#1F1E1D" },
  },
  components: {
    Modal: { defaultProps: { centered: true, radius: "lg" } },
    Card: { defaultProps: { withBorder: true, radius: "lg", padding: "lg" } },
    Paper: { defaultProps: { radius: "lg" } },
    Button: { classNames: { root: touch.button } },
    Input: { classNames: { wrapper: touch.input } },
    NavLink: { styles: { root: { minHeight: 40 } } },
    Menu: { styles: { item: { minHeight: 40 } } },
    Tabs: { styles: { tab: { minHeight: 44 } } },
  },
});

/**
 * Warm surfaces: `--mantine-color-body` is the surface colour (cards, modals, menus);
 * `--app-canvas` / `--app-sidebar` are the page and navbar backgrounds.
 */
export const cssVariablesResolver: CSSVariablesResolver = t => ({
  variables: {},
  light: {
    "--mantine-color-body": "#FFFFFF",
    "--mantine-color-text": "#1F1E1D",
    "--mantine-color-dimmed": "#6B6A63",
    "--mantine-color-default-border": "#E8E6DC",
    "--mantine-color-default-hover": "#F5F4ED",
    "--app-canvas": t.other.light.canvas,
    "--app-sidebar": t.other.light.sidebar,
  },
  dark: {
    "--mantine-color-body": "#30302E",
    "--mantine-color-text": "#EDECE6",
    "--mantine-color-dimmed": "#A6A49B",
    "--mantine-color-default": "#30302E",
    "--mantine-color-default-hover": "#3B3A37",
    "--mantine-color-default-border": "#4A4945",
    "--app-canvas": t.other.dark.canvas,
    "--app-sidebar": t.other.dark.sidebar,
  },
});

/** roomColor() names → soft Mantine palettes that sit well next to the warm theme. */
const ROOM_TONES: Record<ReturnType<typeof roomColor>, MantineColor> = {
  indigo: "grape",
  teal: "teal",
  amber: "yellow",
  rose: "red",
  sky: "cyan",
  violet: "violet",
  emerald: "lime",
  orange: "orange",
};

export const roomTone = (color: ReturnType<typeof roomColor>): MantineColor => ROOM_TONES[color];
