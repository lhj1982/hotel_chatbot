import { useState, useEffect } from "preact/hooks";
import { getWidgetConfig } from "../lib/api";
import type { WidgetConfig } from "../lib/types";

export function useWidgetConfig(widgetKey: string) {
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!widgetKey) {
      setError("No widget key provided");
      return;
    }
    getWidgetConfig(widgetKey)
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, [widgetKey]);

  return { config, error };
}
