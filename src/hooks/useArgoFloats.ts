"use client";

import { useState, useMemo, useCallback } from "react";
import { ARGO_FLOATS, getFloatById, getFloatsByBasin } from "@/data/argoFloats";

export function useArgoFloats() {
  const [selectedFloatId, setSelectedFloatId] = useState<number | null>(null);
  const [basinFilter, setBasinFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const selectedFloat = useMemo(() => {
    return selectedFloatId ? getFloatById(selectedFloatId) || null : null;
  }, [selectedFloatId]);

  const filteredFloats = useMemo(() => {
    return ARGO_FLOATS.filter((float) => {
      const matchesBasin =
        basinFilter === "all" ||
        float.basin.toLowerCase().includes(basinFilter.toLowerCase());
      const matchesSearch =
        !searchQuery.trim() ||
        float.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        float.wmoId.toString().includes(searchQuery) ||
        float.basin.toLowerCase().includes(searchQuery.toLowerCase()) ||
        float.institution.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesBasin && matchesSearch;
    });
  }, [basinFilter, searchQuery]);

  const selectFloat = useCallback((id: number | null) => {
    setSelectedFloatId(id);
  }, []);

  return {
    floats: filteredFloats,
    allFloats: ARGO_FLOATS,
    selectedFloat,
    selectedFloatId,
    selectFloat,
    basinFilter,
    setBasinFilter,
    searchQuery,
    setSearchQuery,
    getFloatsByBasin,
  };
}
