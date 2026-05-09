import type { jsPDF as JsPdfDocument } from "jspdf";

import type { CardSummary, PendingReimbursementSummary } from "../../lib/api";
import { isTauriEnvironment } from "../../lib/desktop";
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

export type ExportPersonReimbursementsPdfResult = {
  fileName: string;
  reusedExisting: boolean;
};

const STATUS_LABEL: Record<PendingReimbursementSummary["status"], string> = {
  pending: "Pendente",
  partial: "Parcial",
  received: "Recebido",
  canceled: "Cancelado",
};

type PdfRow = {
  cells: string[];
  status: PendingReimbursementSummary["status"];
};

type RowStyle = {
  background: [number, number, number];
  stripe: [number, number, number];
  text: [number, number, number];
  mutedText: [number, number, number];
  statusFill: [number, number, number];
  statusText: [number, number, number];
};

const ROW_STYLE: Record<PendingReimbursementSummary["status"], RowStyle> = {
  pending: {
    background: [255, 251, 235],
    stripe: [245, 158, 11],
    text: [30, 41, 59],
    mutedText: [71, 85, 105],
    statusFill: [254, 243, 199],
    statusText: [146, 64, 14],
  },
  partial: {
    background: [239, 246, 255],
    stripe: [59, 130, 246],
    text: [30, 41, 59],
    mutedText: [71, 85, 105],
    statusFill: [219, 234, 254],
    statusText: [30, 64, 175],
  },
  received: {
    background: [236, 253, 245],
    stripe: [16, 185, 129],
    text: [15, 118, 110],
    mutedText: [51, 65, 85],
    statusFill: [209, 250, 229],
    statusText: [4, 120, 87],
  },
  canceled: {
    background: [248, 250, 252],
    stripe: [148, 163, 184],
    text: [148, 163, 184],
    mutedText: [148, 163, 184],
    statusFill: [226, 232, 240],
    statusText: [100, 116, 139],
  },
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
  savePdf,
}: ExportPersonReimbursementsPdfParams): Promise<ExportPersonReimbursementsPdfResult> {
  const fileName = buildReimbursementsPdfFileName(group.canonical_name, month);

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
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
    const rowHeight = measureRowHeight(doc, row.cells);

    if (cursorY + rowHeight > 560) {
      doc.addPage();
      cursorY = 42;
      cursorY = drawTableHeader(doc, cursorY);
    }

    drawTableRow(doc, row, cursorY, rowHeight);
    cursorY += rowHeight;
  }

  if (savePdf) {
    savePdf(doc, fileName);
    return { fileName, reusedExisting: false };
  }

  if (isTauriEnvironment()) {
    await saveDesktopPdf(doc, fileName);
    return { fileName, reusedExisting: false };
  }

  defaultSavePdf(doc, fileName);
  return { fileName, reusedExisting: false };
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

async function saveDesktopPdf(doc: JsPdfDocument, fileName: string): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  const bytes = Array.from(new Uint8Array(doc.output("arraybuffer")));
  await invoke("save_reimbursement_pdf", { fileName, bytes });
}

function buildPdfRow(
  item: PendingReimbursementSummary,
  cardNameById: Map<string, string>,
): PdfRow {
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

  return {
    cells: [
      sourceTitle,
      formatDate(sourceDate),
      cardName,
      installment,
      formatCurrency(item.amount),
      formatCurrency(item.amount_received ?? 0),
      formatCurrency(getOutstandingAmount(item)),
      STATUS_LABEL[item.status],
    ],
    status: item.status,
  };
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
  doc.setTextColor(51, 65, 85);

  let cursorX = PAGE_MARGIN;
  for (const column of TABLE_COLUMNS) {
    doc.text(column.label, cursorX + CELL_PADDING, y + 3);
    cursorX += column.width;
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(PAGE_MARGIN, y + 12, PAGE_MARGIN + getTableWidth(), y + 12);
  doc.setTextColor(15, 23, 42);
  return y + 24;
}

function drawTableRow(doc: JsPdfDocument, row: PdfRow, y: number, rowHeight: number) {
  const style = ROW_STYLE[row.status];
  const rowTop = y - 11;
  const rowBottom = y + rowHeight - 10;

  doc.setFillColor(...style.background);
  doc.rect(PAGE_MARGIN, rowTop, getTableWidth(), rowHeight - 4, "F");
  doc.setFillColor(...style.stripe);
  doc.rect(PAGE_MARGIN, rowTop, 4, rowHeight - 4, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  let cursorX = PAGE_MARGIN;
  for (let index = 0; index < TABLE_COLUMNS.length; index += 1) {
    const column = TABLE_COLUMNS[index];
    const isStatusColumn = index === TABLE_COLUMNS.length - 1;
    const lines = splitCellText(doc, row.cells[index], column.width);

    if (isStatusColumn) {
      drawStatusBadge(doc, row.status, cursorX + CELL_PADDING, y - 8, column.width - CELL_PADDING * 2);
    } else {
      const isSecondaryColumn = index === 1 || index === 2 || index === 3;
      const textColor = isSecondaryColumn ? style.mutedText : style.text;
      doc.setTextColor(...textColor);
      doc.text(lines, cursorX + CELL_PADDING, y);
    }

    cursorX += column.width;
  }

  if (row.status === "canceled") {
    doc.setDrawColor(148, 163, 184);
    doc.line(PAGE_MARGIN + 8, y + 4, PAGE_MARGIN + getTableWidth() - 8, y + 4);
  }

  doc.setDrawColor(226, 232, 240);
  doc.line(PAGE_MARGIN, rowBottom, PAGE_MARGIN + getTableWidth(), rowBottom);
  doc.setTextColor(15, 23, 42);
}

function drawStatusBadge(
  doc: JsPdfDocument,
  status: PendingReimbursementSummary["status"],
  x: number,
  y: number,
  width: number,
) {
  const style = ROW_STYLE[status];
  const label = status === "received" ? "OK Recebido" : STATUS_LABEL[status];

  doc.setFillColor(...style.statusFill);
  doc.roundedRect(x, y, width, 14, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...style.statusText);
  doc.text(label, x + 5, y + 9);
  doc.setFont("helvetica", "normal");
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
