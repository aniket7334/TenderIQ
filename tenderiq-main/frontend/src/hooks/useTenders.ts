import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { Tender, PaginatedResponse, TenderFilters } from '@/lib/types';

interface UseTendersReturn {
  tenders: Tender[];
  loading: boolean;
  error: string | null;
  totalPages: number;
  totalItems: number;
  currentPage: number;
  refetch: () => void;
}

export default function useTenders(filters: TenderFilters = {}): UseTendersReturn {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(filters.page || 1);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchTenders = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string | number | boolean> = {};

      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.internal_status) params.internal_status = filters.internal_status;
      if (filters.category) params.category = filters.category;
      if (filters.priority) params.priority = filters.priority;
      if (filters.source_id) params.source_id = filters.source_id;
      if (filters.assigned_to) params.assigned_to = filters.assigned_to;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.min_value !== undefined) params.min_value = filters.min_value;
      if (filters.max_value !== undefined) params.max_value = filters.max_value;
      if (filters.state) params.state = filters.state;
      if (filters.is_bookmarked !== undefined) params.is_bookmarked = filters.is_bookmarked;
      if (filters.sort_by) params.sort_by = filters.sort_by;
      if (filters.sort_order) params.sort_order = filters.sort_order;

      params.page = filters.page || 1;
      params.page_size = filters.page_size || 20;

      const response = await api.get<PaginatedResponse<Tender>>('/tenders', {
        params,
        signal: controller.signal,
      });

      const data = response.data;
      setTenders(data.items);
      setTotalPages(data.total_pages);
      setTotalItems(data.total);
      setCurrentPage(data.page);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to fetch tenders';
      setError(message);
      setTenders([]);
    } finally {
      setLoading(false);
    }
  }, [
    filters.search,
    filters.status,
    filters.internal_status,
    filters.category,
    filters.priority,
    filters.source_id,
    filters.assigned_to,
    filters.date_from,
    filters.date_to,
    filters.min_value,
    filters.max_value,
    filters.state,
    filters.is_bookmarked,
    filters.page,
    filters.page_size,
    filters.sort_by,
    filters.sort_order,
  ]);

  useEffect(() => {
    fetchTenders();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchTenders]);

  return {
    tenders,
    loading,
    error,
    totalPages,
    totalItems,
    currentPage,
    refetch: fetchTenders,
  };
}
