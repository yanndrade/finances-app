import { useCallback, useState } from "react";

import { fetchInvoiceItems, type InvoiceItemSummary } from "../../lib/api";

const DEFAULT_INVOICE_ITEMS_ERROR = "Nao foi possivel carregar os itens da fatura.";

export type UseInvoiceItemsState = {
  invoiceItems: InvoiceItemSummary[];
  isLoadingItems: boolean;
  loadError: string | null;
  loadInvoiceItems: (invoiceId: string) => Promise<void>;
  clearInvoiceItemsState: () => void;
};

export function useInvoiceItems(): UseInvoiceItemsState {
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemSummary[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadInvoiceItems = useCallback(async (invoiceId: string) => {
    setIsLoadingItems(true);
    setLoadError(null);

    try {
      const items = await fetchInvoiceItems(invoiceId);
      setInvoiceItems(items);
    } catch {
      setInvoiceItems([]);
      setLoadError(DEFAULT_INVOICE_ITEMS_ERROR);
    } finally {
      setIsLoadingItems(false);
    }
  }, []);

  const clearInvoiceItemsState = useCallback(() => {
    setInvoiceItems([]);
    setIsLoadingItems(false);
    setLoadError(null);
  }, []);

  return {
    invoiceItems,
    isLoadingItems,
    loadError,
    loadInvoiceItems,
    clearInvoiceItemsState,
  };
}
