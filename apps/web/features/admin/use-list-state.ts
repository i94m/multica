"use client";

import { useState } from "react";
import type { SortOrder } from "./components/shared";

export function useAdminListState(defaultSort = "created_at", defaultOrder: SortOrder = "desc") {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(25);
  const [sort, setSort] = useState(defaultSort);
  const [order, setOrder] = useState<SortOrder>(defaultOrder);

  return {
    page,
    pageSize,
    sort,
    order,
    setPage,
    setPageSize: (size: number) => {
      setPageSizeState(size);
      setPage(1);
    },
    resetPage: () => setPage(1),
    onSort: (column: string) => {
      setPage(1);
      if (column === sort) {
        setOrder((current) => (current === "asc" ? "desc" : "asc"));
        return;
      }
      setSort(column);
      setOrder("asc");
    },
  };
}
