import type { jsPDF as JsPdfDocument } from "jspdf";

import type { CardSummary, PendingReimbursementSummary } from "../../lib/api";
import { formatCompetenceMonth, formatCurrency, formatDate } from "../../lib/format";

import type { ReimbursementPersonGroup } from "./person-grouping";

type PdfSaver = (doc: JsPdfDocument, fileName: string) => void;

export type ExportPersonReimbursementsPdfParams = {
  group: ReimbursementPersonGroup;
  month: string;
  cards: CardSummary[];
  generatedAt?: Date;
  savePdf?: PdfSaver;
};

const STATUS_LABEL: Record<PendingReimbursementSummary["status"], string> = {
  pending: "Pendente",
  partial: "Parcial",
  received: "Recebido",
  canceled: "Cancelado",
};

const TABLE_COLUMNS = [
  { label: "Compra / descricao", width: 190 },
  { label: "Data", width: 66 },
  { label: "Cartao", width: 118 },
  { label: "Parcela", width: 50 },
  { label: "Valor", width: 74 },
  { label: "Recebido", width: 74 },
  { label: "Saldo", width: 74 },
  { label: "Status", width: 70 },
] as const;

const PAGE_MARGIN = 36;
const LINE_HEIGHT = 12;
const CELL_PADDING = 6;

export async function exportPersonReimbursementsPdf({
  group,
  month,
  cards,
  generatedAt = new Date(),
  savePdf = defaultSavePdf,
}: ExportPersonReimbursementsPdfParams): Promise<string> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const fileName = buildReimbursementsPdfFileName(group.canonical_name, month);
  const cardNameById = new Map(cards.map((card) => [card.card_id, card.name]));
  const totalListed = group.items.reduce((total, item) => total + item.amount, 0);
  const totalOutstanding = group.items.reduce(
    (total, item) => total + getOutstandingAmount(item),
    0,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Reembolsos - ${group.canonical_name}`, PAGE_MARGIN, 42);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Mes de referencia: ${formatCompetenceMonth(month)}`, PAGE_MARGIN, 62);
  doc.text(`Gerado em: ${formatDate(generatedAt.toISOString())}`, PAGE_MARGIN, 78);

  doc.setFont("helvetica", "bold");
  doc.text(`Total ainda devido: ${formatCurrency(totalOutstanding)}`, PAGE_MARGIN, 102);
  doc.text(`Total listado no mes: ${formatCurrency(totalListed)}`, 250, 102);

  let cursorY = 130;
  cursorY = drawTableHeader(doc, cursorY);

  for (const item of group.items) {
    const row = buildPdfRow(item, cardNameById);
    const rowHeight = measureRowHeight(doc, row);

    if (cursorY + rowHeight > 560) {
      doc.addPage();
      cursorY = 42;
      cursorY = drawTableHeader(doc, cursorY);
    }

    drawTableRow(doc, row, cursorY, rowHeight);
    cursorY += rowHeight;
  }

  savePdf(doc, fileName);
  return fileName;
}

export function buildReimbursementsPdfFileName(personName: string, month: string): string {
  const safePerson = personName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "pessoa";

  return `reembolsos-${safePerson}-${month}.pdf`;
}

function defaultSavePdf(doc: JsPdfDocument, fileName: string) {
  doc.save(fileName);
}

function buildPdfRow(
  item: PendingReimbursementSummary,
  cardNameById: Map<string, string>,
): string[] {
  const sourceTitle =
    item.source_title ??
    item.source_description ??
    item.source_transaction_id ??
    item.transaction_id;
  const sourceDate = item.source_purchase_date ?? item.source_posted_at ?? item.occurred_at;
  const cardName = item.source_card_id
    ? cardNameById.get(item.source_card_id) ?? item.source_card_id
    : "-";
  const installment = item.source_installment_number != null && item.source_installment_total != null
    ? `${item.source_installment_number}/${item.source_installment_total}`
    : "-";

  return [
    sourceTitle,
    formatDate(sourceDate),
    cardName,
    installment,
    formatCurrency(item.amount),
    formatCurrency(item.amount_received ?? 0),
    formatCurrency(getOutstandingAmount(item)),
    STATUS_LABEL[item.status],
  ];
}

function getOutstandingAmount(item: PendingReimbursementSummary): number {
  if (item.status !== "pending" && item.status !== "partial") {
    return 0;
  }
  return Math.max(0, item.amount - (item.amount_received ?? 0));
}

function drawTableHeader(doc: JsPdfDocument, y: number): number {
  doc.setFillColor(241, 245, 249);
  doc.rect(PAGE_MARGIN, y - 12, getTableWidth(), 24, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);

  let cursorX = PAGE_MARGIN;
  for (const column of TABLE_COLUMNS) {
    doc.text(column.label, cursorX + CELL_PADDING, y + 3);
    cursorX += column.width;
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(PAGE_MARGIN, y + 12, PAGE_MARGIN + getTableWidth(), y + 12);
  return y + 24;
}

function drawTableRow(doc: JsPdfDocument, row: string[], y: number, rowHeight: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  let cursorX = PAGE_MARGIN;
  for (let index = 0; index < TABLE_COLUMNS.length; index += 1) {
    const column = TABLE_COLUMNS[index];
    const lines = splitCellText(doc, row[index], column.width);
    doc.text(lines, cursorX + CELL_PADDING, y);
    cursorX += column.width;
  }

  doc.setDrawColor(226, 232, 240);
  doc.line(PAGE_MARGIN, y + rowHeight - 10, PAGE_MARGIN + getTableWidth(), y + rowHeight - 10);
}

function measureRowHeight(doc: JsPdfDocument, row: string[]): number {
  const maxLines = row.reduce((count, value, index) => {
    const lines = splitCellText(doc, value, TABLE_COLUMNS[index].width);
    return Math.max(count, lines.length);
  }, 1);
  return Math.max(28, maxLines * LINE_HEIGHT + CELL_PADDING * 2);
}

function splitCellText(doc: JsPdfDocument, value: string, columnWidth: number): string[] {
  return doc.splitTextToSize(value || "-", columnWidth - CELL_PADDING * 2);
}

function getTableWidth(): number {
  return TABLE_COLUMNS.reduce((total, column) => total + column.width, 0);
}
