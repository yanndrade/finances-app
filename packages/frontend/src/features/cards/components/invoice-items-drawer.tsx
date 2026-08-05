import { format, parseISO } from "date-fns";
import { CalendarClock, Layers3 } from "lucide-react";

import { Button } from "../../../components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "../../../components/ui/drawer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import type { InvoiceItemSummary } from "../../../lib/api";
import { formatCurrency } from "../../../lib/format";
import { cn } from "../../../lib/utils";

type InvoiceItemsDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceItems: InvoiceItemSummary[];
  isLoading: boolean;
  loadError: string | null;
};

export function InvoiceItemsDrawer({
  open,
  onOpenChange,
  invoiceItems,
  isLoading,
  loadError,
}: InvoiceItemsDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] rounded-t-[3rem] border-none shadow-2xl finance-acrylic-surface">
        <div className="mx-auto flex w-full max-w-4xl flex-col overflow-hidden px-8 py-10">
          <DrawerHeader className="mb-6 px-0">
            <DrawerTitle className="text-4xl font-black tracking-tighter">Resumo detalhado</DrawerTitle>
            <DrawerDescription className="text-base font-bold text-slate-400">
              Análise completa dos lançamentos deste período.
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-auto rounded-[2.5rem] border border-slate-50 bg-white shadow-inner">
            {isLoading ? (
              <div className="p-20 text-center">
                <p className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-300">
                  Sincronizando faturas...
                </p>
              </div>
            ) : loadError ? (
              <div className="p-20 text-center">
                <p className="text-sm font-bold text-rose-600">{loadError}</p>
              </div>
            ) : (
              <InvoiceItemsTable invoiceItems={invoiceItems} />
            )}
          </div>

          <DrawerFooter className="px-0 pt-8">
            <Button
              variant="ghost"
              className="h-14 w-full rounded-[1.5rem] font-black text-slate-400 hover:text-slate-600"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              Fechar
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function InvoiceItemsTable({ invoiceItems }: { invoiceItems: InvoiceItemSummary[] }) {
  return (
    <Table>
      <TableHeader className="bg-slate-50/50">
        <TableRow className="border-slate-50 hover:bg-transparent">
          <TableHead className="px-8 h-14 font-black text-[12px] uppercase tracking-widest text-slate-400">
            Data
          </TableHead>
          <TableHead className="h-14 font-black text-[12px] uppercase tracking-widest text-slate-400">
            Descrição
          </TableHead>
          <TableHead className="h-14 font-black text-[12px] uppercase tracking-widest text-slate-400">
            Parcela
          </TableHead>
          <TableHead className="h-14 font-black text-[12px] uppercase tracking-widest text-slate-400 text-right pr-8">
            Valor
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoiceItems.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="h-40 text-center text-slate-300 font-bold">
              Abra uma fatura no resumo para ver os itens.
            </TableCell>
          </TableRow>
        ) : (
          invoiceItems.map((item) => (
            <TableRow key={item.invoice_item_id} className="border-slate-50">
              <TableCell className="px-8 py-5 font-bold text-slate-500">
                {item.scheduled_date || item.purchase_date
                  ? format(parseISO(item.scheduled_date ?? item.purchase_date!), "dd MMM")
                  : "—"}
              </TableCell>
              <TableCell className={cn(
                "font-black",
                item.lifecycle_status === "forecast" ? "text-primary" : "text-slate-900",
              )}>
                {item.lifecycle_status === "forecast" ? (
                  <span className="mr-2 inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-bold text-primary">
                    <CalendarClock className="h-3 w-3" /> Assinatura prevista
                  </span>
                ) : item.origin_type === "recurring" ? (
                  <span className="mr-2 inline-flex rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-bold text-primary">
                    Assinatura
                  </span>
                ) : null}
                {item.description || "Compra no cartão"}
              </TableCell>
              <TableCell className="font-bold text-slate-500">
                {item.installments_count && item.installments_count > 1 ? (
                  <span className="inline-flex items-center gap-1 text-finance-transfer">
                    <Layers3 className="h-3.5 w-3.5" />
                    Parcela {item.installment_number}/{item.installments_count}
                  </span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="pr-8 text-right font-black text-slate-900">
                {formatCurrency(item.amount)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
