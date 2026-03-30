import { useCallback, useState } from "react";

import { fetchInvoicePayments, type InvoicePaymentSummary } from "../../lib/api";

const DEFAULT_INVOICE_PAYMENTS_ERROR = "N\u00e3o foi poss\u00edvel carregar os pagamentos da fatura.";

export type UseInvoicePaymentsState = {
  invoicePayments: InvoicePaymentSummary[];
  isLoadingPayments: boolean;
  loadError: string | null;
  loadInvoicePayments: (invoiceId: string) => Promise<void>;
  clearInvoicePaymentsState: () => void;
};

export function useInvoicePayments(): UseInvoicePaymentsState {
  const [invoicePayments, setInvoicePayments] = useState<InvoicePaymentSummary[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadInvoicePayments = useCallback(async (invoiceId: string) => {
    setIsLoadingPayments(true);
    setLoadError(null);

    try {
      const payments = await fetchInvoicePayments(invoiceId);
      setInvoicePayments(payments);
    } catch {
      setInvoicePayments([]);
      setLoadError(DEFAULT_INVOICE_PAYMENTS_ERROR);
    } finally {
      setIsLoadingPayments(false);
    }
  }, []);

  const clearInvoicePaymentsState = useCallback(() => {
    setInvoicePayments([]);
    setIsLoadingPayments(false);
    setLoadError(null);
  }, []);

  return {
    invoicePayments,
    isLoadingPayments,
    loadError,
    loadInvoicePayments,
    clearInvoicePaymentsState,
  };
}
