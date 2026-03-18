import {
  ArrowLeftRight,
  Banknote,
  Calendar,
  CalendarClock,
  CreditCard,
  ExternalLink,
  Info,
  Layers,
  Lock,
  Pencil,
  Receipt,
  RefreshCw,
  Tag,
  Trash2,
  User,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import {
  formatCurrency,
  formatDate,
  formatCategoryName,
  formatKind,
  formatOriginType,
  formatLifecycleStatus,
  formatPaymentMethodExpanded,
  formatCompetenceMonth,
} from "../../lib/format";
import type { UnifiedMovement, AccountSummary, CardSummary } from "../../lib/api";

type MovementDrawerProps = {
  movement: UnifiedMovement | null;
  accounts: AccountSummary[];
  cards: CardSummary[];
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (movement: UnifiedMovement) => void;
  onVoid?: (movement: UnifiedMovement) => void;
  onMarkPaid?: (movementId: string) => void;
  isSubmitting?: boolean;
};

// ─── Colour helpers ───────────────────────────────────────────────────────────

function kindAmountClass(kind: string): string {
  switch (kind) {
    case "income":
    case "reimbursement":
      return "text-finance-income";
    case "expense":
      return "text-finance-expense";
    case "transfer":
      return "text-finance-transfer";
    case "investment":
      return "text-finance-investment";
    default:
      return "text-foreground";
  }
}

function lifecyclePillClass(status: string): string {
  switch (status) {
    case "forecast":
      return "bg-muted text-muted-foreground";
    case "pending":
      return "bg-amber-100 text-amber-700";
    case "cleared":
      return "bg-emerald-100 text-emerald-700";
    case "cancelled":
      return "bg-muted text-muted-foreground line-through";
    case "voided":
      return "bg-red-100 text-red-600";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function editPolicyLabel(policy: string): string {
  switch (policy) {
    case "editable":
      return "Editável";
    case "inherited":
      return "Herdado da regra";
    case "locked":
      return "Protegido";
    default:
      return policy;
  }
}

// ─── Info row building block ───────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  secondary,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  secondary?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <div className="mt-0.5 shrink-0 text-muted-foreground/60">{icon}</div>
      <div className="flex-1 min-w-0">
        <span className="block text-[12px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
          {label}
        </span>
        <span className="block text-sm font-semibold text-foreground break-words">
          {value}
        </span>
        {secondary && (
          <span className="block text-[13px] text-muted-foreground mt-0.5">
            {secondary}
          </span>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2 pb-1 border-b border-border/50 mb-3">
      {children}
    </h3>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function MovementDrawer({
  movement,
  accounts,
  cards,
  isOpen,
  onClose,
  onEdit,
  onVoid,
  onMarkPaid,
  isSubmitting = false,
}: MovementDrawerProps) {
  if (!movement) return null;

  const {
    kind,
    origin_type,
    title,
    description,
    amount,
    posted_at,
    competence_month,
    account_id,
    card_id,
    payment_method,
    category_id,
    counterparty,
    lifecycle_status,
    edit_policy,
    parent_id,
    group_id,
    installment_number,
    installment_total,
    source_event_type,
  } = movement;

  const isEditable = edit_policy === "editable";
  const isInherited = edit_policy === "inherited";
  const isLocked = edit_policy === "locked";
  const isVoided = lifecycle_status === "voided";
  const isForecast = lifecycle_status === "forecast";
  const isPending = lifecycle_status === "pending";
  const isCardPurchase =
    origin_type === "card_purchase" ||
    origin_type === "installment" ||
    source_event_type === "CardPurchaseCreated" ||
    source_event_type === "CardPurchaseUpdated";

  const canEdit = (isEditable || isCardPurchase) && !isVoided;
  const canVoid = (isEditable || isInherited || isCardPurchase) && !isVoided;
  const canMarkPaid =
    origin_type === "recurring" && (isForecast || isPending) && !isVoided;

  const accountName =
    accounts.find((a) => a.account_id === account_id)?.name ?? account_id;
  const cardObj = card_id ? cards.find((c) => c.card_id === card_id) : null;

  // Transfer: counterparty is destination account id
  const transferDestName =
    kind === "transfer" && counterparty
      ? (accounts.find((a) => a.account_id === counterparty)?.name ?? counterparty)
      : null;

  const displayTitle =
    title && title !== category_id ? title : formatCategoryName(category_id);

  const signedAmount =
    kind === "income" || kind === "reimbursement" ? amount : -amount;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col gap-0 border-l border-border shadow-2xl bg-surface"
      >
        {/* Accessibility */}
        <SheetHeader className="sr-only">
          <SheetTitle>{displayTitle}</SheetTitle>
          <SheetDescription>
            {`${formatKind(kind)} em ${formatDate(posted_at)} — ${formatCurrency(amount)}`}
          </SheetDescription>
        </SheetHeader>

        {/* ── Block 1: Header ─────────────────────────────────────────── */}
        <header className="px-6 pt-6 pb-5 border-b border-border/60 bg-surface-paper/60">
          {/* Kind + lifecycle badges */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span
              className={cn(
                "px-2.5 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider",
                kind === "income" && "bg-emerald-100 text-emerald-700",
                kind === "expense" && "bg-red-100 text-red-700",
                kind === "transfer" && "bg-slate-100 text-slate-600",
                kind === "investment" && "bg-teal-100 text-teal-700",
                kind === "reimbursement" && "bg-emerald-100 text-emerald-700",
              )}
            >
              {formatKind(kind)}
            </span>

            <span
              className={cn(
                "px-2.5 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider",
                lifecyclePillClass(lifecycle_status),
              )}
            >
              {formatLifecycleStatus(lifecycle_status)}
            </span>

            {isLocked && !isCardPurchase && (
              <span className="ml-auto flex items-center gap-1 text-[12px] font-semibold text-muted-foreground">
                <Lock className="h-3 w-3" />
                Protegido
              </span>
            )}
          </div>

          {/* Amount */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground leading-snug break-words">
                {displayTitle}
              </h2>
              {description && description !== title && (
                <p className="text-xs text-muted-foreground mt-0.5 break-words">
                  {description}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <span
                className={cn(
                  "block text-2xl font-bold tabular-nums leading-none",
                  kindAmountClass(kind),
                  isVoided && "line-through opacity-50",
                )}
              >
                {signedAmount >= 0 ? "+" : ""}
                {formatCurrency(Math.abs(signedAmount))}
              </span>
              <span className="block text-[12px] text-muted-foreground mt-1">
                {formatDate(posted_at)}
              </span>
            </div>
          </div>
        </header>

        {/* ── Scrollable body ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Block 2: Identification */}
          <section>
            <SectionHeading>
              <Tag className="h-3 w-3" />
              Identificação
            </SectionHeading>
            <div className="space-y-4">
              <InfoRow
                icon={<Tag className="h-3.5 w-3.5" />}
                label="Categoria"
                value={formatCategoryName(category_id)}
              />
              {counterparty && kind !== "transfer" && (
                <InfoRow
                  icon={<User className="h-3.5 w-3.5" />}
                  label="Contraparte / Pessoa"
                  value={counterparty}
                />
              )}
              {installment_number != null && installment_total != null && (
                <InfoRow
                  icon={<Layers className="h-3.5 w-3.5" />}
                  label="Parcela"
                  value={`${installment_number} de ${installment_total}`}
                  secondary={
                    parent_id ? `Compra: ${parent_id}` : undefined
                  }
                />
              )}
            </div>
          </section>

          {/* Block 3: Payment */}
          <section>
            <SectionHeading>
              <Receipt className="h-3 w-3" />
              Pagamento
            </SectionHeading>
            <div className="space-y-4">
              <InfoRow
                icon={<Banknote className="h-3.5 w-3.5" />}
                label="Conta"
                value={accountName}
              />
              {cardObj && (
                <InfoRow
                  icon={<CreditCard className="h-3.5 w-3.5" />}
                  label="Cartão"
                  value={cardObj.name}
                  secondary={`Fechamento: dia ${cardObj.closing_day} · Vencimento: dia ${cardObj.due_day}`}
                />
              )}
              {kind === "transfer" && transferDestName && (
                <InfoRow
                  icon={<ArrowLeftRight className="h-3.5 w-3.5" />}
                  label="Destino"
                  value={transferDestName}
                />
              )}
              <InfoRow
                icon={<CreditCard className="h-3.5 w-3.5" />}
                label="Método"
                value={formatPaymentMethodExpanded(payment_method)}
              />
              <InfoRow
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Data de lançamento"
                value={formatDate(posted_at)}
              />
              <InfoRow
                icon={<CalendarClock className="h-3.5 w-3.5" />}
                label="Competência"
                value={formatCompetenceMonth(competence_month)}
              />
            </div>
          </section>

          {/* Block 4: Origin & links */}
          <section>
            <SectionHeading>
              <Info className="h-3 w-3" />
              Origem e vínculos
            </SectionHeading>
            <div className="space-y-4">
              <InfoRow
                icon={<RefreshCw className="h-3.5 w-3.5" />}
                label="Tipo de origem"
                value={formatOriginType(origin_type)}
                secondary={`Evento: ${source_event_type}`}
              />
              <InfoRow
                icon={<Lock className="h-3.5 w-3.5" />}
                label="Política de edição"
                value={editPolicyLabel(edit_policy)}
              />
              {group_id && origin_type === "recurring" && (
                <InfoRow
                  icon={<ExternalLink className="h-3.5 w-3.5" />}
                  label="Regra recorrente"
                  value={group_id}
                />
              )}
              {parent_id && origin_type === "installment" && (
                <InfoRow
                  icon={<ExternalLink className="h-3.5 w-3.5" />}
                  label="Compra parcelada"
                  value={parent_id}
                />
              )}
            </div>
          </section>
        </div>

        {/* ── Block 5: Contextual actions ──────────────────────────────── */}
        <footer className="px-6 py-4 border-t border-border/60 bg-surface space-y-3">
          {/* Primary actions */}
          {canEdit && (
            <div className="flex gap-2">
              <Button
                onClick={() => onEdit?.(movement)}
                disabled={isSubmitting}
                className="flex-1 h-10 rounded-xl font-bold bg-accent-navy text-white hover:bg-accent-navy/90 disabled:opacity-50"
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Editar
              </Button>
              {canVoid && (
                <Button
                  variant="ghost"
                  onClick={() => onVoid?.(movement)}
                  disabled={isSubmitting}
                  className="h-10 px-4 rounded-xl text-finance-expense border border-finance-expense/30 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Estornar
                </Button>
              )}
            </div>
          )}

          {canMarkPaid && (
            <Button
              variant="outline"
              onClick={() => onMarkPaid?.(movement.movement_id)}
              disabled={isSubmitting}
              className="w-full h-10 rounded-xl font-semibold border-finance-income/40 text-finance-income hover:bg-emerald-50 disabled:opacity-50"
            >
              <Receipt className="h-3.5 w-3.5 mr-1.5" />
              Marcar como pago
            </Button>
          )}

          {/* Inherited edit hint */}
          {isInherited && !isVoided && (
            <div className="flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-blue-700 text-xs">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Esta movimentação é gerada por uma regra recorrente. Edições
                afetarão apenas esta instância.
              </span>
            </div>
          )}

          {/* Locked hint */}
          {isLocked && !isCardPurchase && (
            <div className="flex items-center gap-2 py-1.5 text-muted-foreground text-xs justify-center">
              <Lock className="h-3 w-3" />
              Lançamento gerado automaticamente — não editável.
            </div>
          )}
        </footer>
      </SheetContent>
    </Sheet>
  );
}
