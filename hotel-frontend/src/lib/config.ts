import type { WidgetOptions } from "./types";

export function parseScriptAttributes(): WidgetOptions {
  const script = document.currentScript as HTMLScriptElement | null;

  const key = script?.getAttribute("data-key") || "";
  const position = (script?.getAttribute("data-position") || "bottom-right") as WidgetOptions["position"];
  const locale = script?.getAttribute("data-locale") || "en";

  let apiUrl = script?.getAttribute("data-api-url") || "";
  if (!apiUrl && script?.src) {
    try {
      const url = new URL(script.src);
      apiUrl = url.origin;
    } catch {
      apiUrl = "";
    }
  }
  if (!apiUrl) {
    apiUrl = window.location.origin;
  }

  return { key, position, locale, apiUrl };
}
