import resolveConfig from "tailwindcss/resolveConfig";
import { Config } from "tailwindcss/types/config";

const tailwindConfig = resolveConfig({} as Config);
const tailwindColors = tailwindConfig.theme.colors;

// 色の命名規則については以下の動画を参照:
// The hardest part about building dark mode is that people think it’s easy - Figma team (Config 2022)
// https://www.youtube.com/watch?v=1DTnojio89Y

export type BgColorKey =
  | "bg"
  | "bg-component"
  | "bg-brand"
  | "bg-brand-hover"
  | "bg-active";

export type TextColorKey = "text" | "text-inverse";

export type BorderColorKey =
  | "border-onbrand"
  | "border-hover"
  | "border-pressed"
  | "border-active"
  | "border-component"
  | "border-component-strong"
  | "border-component-strong-disabled"
  | "border-inverse";

export type IconColorKey = "icon-brand" | "icon-onbrand";

export type ColorKey =
  | BgColorKey
  | TextColorKey
  | BorderColorKey
  | IconColorKey;

export const Colors: { [key in ColorKey]: string } = {
  bg: tailwindColors.zinc["50"],
  "bg-component": tailwindColors.white,
  "bg-brand": tailwindColors.sky["500"],
  "bg-brand-hover": tailwindColors.sky["600"],
  "bg-active": tailwindColors.purple["500"],
  text: tailwindColors.zinc["900"],
  "text-inverse": tailwindColors.zinc["200"],
  "border-onbrand": tailwindColors.sky["700"],
  "border-hover": tailwindColors.purple["500"],
  "border-pressed": tailwindColors.purple["700"],
  "border-active": tailwindColors.teal["300"],
  "border-component": tailwindColors.zinc["400"],
  "border-component-strong": tailwindColors.zinc["500"],
  "border-component-strong-disabled": tailwindColors.zinc["200"],
  "border-inverse": tailwindColors.zinc["300"],
  "icon-brand": tailwindColors.sky["500"],
  "icon-onbrand": tailwindColors.white,
};

export type WireColor =
  | typeof Colors["border-component-strong-disabled"]
  | typeof Colors["text"];

export const NO_OPACITY = 1;
export const FULL_OPACITY = 0;
