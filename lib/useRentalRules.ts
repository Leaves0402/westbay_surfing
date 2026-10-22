"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchRentalRules } from "@/lib/rentalRules";

export function useRentalRules() {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      setContent(await fetchRentalRules());
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  return { content, setContent, isLoading, hasError, reload };
}
