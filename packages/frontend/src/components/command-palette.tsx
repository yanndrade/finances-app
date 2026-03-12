import {
  CreditCard,
  HandCoins,
  Home,
  Landmark,
  Repeat,
  RotateCcw,
  Settings2,
  TrendingUp,
  Wallet,
} from "lucide-react";

import type { QuickAddPreset } from "./quick-add-composer";
import type { AppView } from "./sidebar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenQuickAdd: (preset?: QuickAddPreset) => void;
  onNavigate: (view: AppView) => void;
};

const ACTION_COMMANDS: Array<{
  label: string;
  hint: string;
  value: string;
  preset: QuickAddPreset;
}> = [
  {
    label: "Registrar despesa",
    hint: "Lançador rápido",
    value: "registrar despesa gasto",
    preset: "expense",
  },
  {
    label: "Registrar receita",
    hint: "Entrada de caixa",
    value: "registrar receita entrada",
    preset: "income",
  },
  {
    label: "Transferir entre contas",
    hint: "Transferência interna",
    value: "transferir entre contas transferência interna",
    preset: "transfer_internal",
  },
  {
    label: "Pagar fatura",
    hint: "Transferência para cartão",
    value: "pagar fatura cartão",
    preset: "transfer_invoice_payment",
  },
  {
    label: "Novo aporte",
    hint: "Investimento",
    value: "novo aporte investimento",
    preset: "investment_contribution",
  },
  {
    label: "Registrar resgate",
    hint: "Investimento",
    value: "resgate investimento retirada",
    preset: "investment_withdrawal",
  },
];

const NAVIGATION_COMMANDS: Array<{
  label: string;
  hint: string;
  value: string;
  view: AppView;
  icon: typeof Home;
}> = [
  {
    label: "Visão geral",
    hint: "Dashboard acionável",
    value: "visão geral dashboard",
    view: "dashboard",
    icon: Home,
  },
  {
    label: "Histórico",
    hint: "Histórico principal",
    value: "histórico ledger movimentos",
    view: "transactions",
    icon: Landmark,
  },
  {
    label: "Reembolsos",
    hint: "Cobranças e recebimentos",
    value: "reembolsos cobranças recebimentos pendências",
    view: "reimbursements",
    icon: RotateCcw,
  },
  {
    label: "Gastos fixos",
    hint: "Regras e pendências",
    value: "gastos fixos recorrências pendências",
    view: "fixedExpenses",
    icon: Repeat,
  },
  {
    label: "Cartões",
    hint: "Gestão de faturas",
    value: "cartões crédito",
    view: "cards",
    icon: CreditCard,
  },
  {
    label: "Patrimônio e investimentos",
    hint: "Aportes e evolução",
    value: "patrimônio investimentos",
    view: "investments",
    icon: TrendingUp,
  },
  {
    label: "Contas",
    hint: "Saldos e cadastro",
    value: "contas saldos carteira",
    view: "accounts",
    icon: Wallet,
  },
  {
    label: "Configurações",
    hint: "Preferências do sistema",
    value: "configurações sistema",
    view: "settings",
    icon: Settings2,
  },
];

export function CommandPalette({
  open,
  onOpenChange,
  onOpenQuickAdd,
  onNavigate,
}: CommandPaletteProps) {
  function runAfterClose(action: () => void) {
    onOpenChange(false);
    globalThis.setTimeout(action, 0);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-[680px]">
        <DialogHeader className="px-4 pb-1 pt-4">
          <DialogTitle>Paleta de comandos</DialogTitle>
          <DialogDescription>Digite para navegar ou disparar ações rápidas.</DialogDescription>
        </DialogHeader>

        <Command className="rounded-none">
          <CommandInput placeholder="Ex.: Registrar despesa, Pagar fatura, Abrir Histórico..." />
          <CommandList>
            <CommandEmpty>Nenhuma ação encontrada.</CommandEmpty>

            <CommandGroup heading="Lançamentos">
              {ACTION_COMMANDS.map((command) => (
                <CommandItem
                  key={command.value}
                  value={command.value}
                  onSelect={() =>
                    runAfterClose(() => {
                      onOpenQuickAdd(command.preset);
                    })
                  }
                >
                  <HandCoins />
                  <span>{command.label}</span>
                  <CommandShortcut>{command.hint}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Navegação">
              {NAVIGATION_COMMANDS.map((command) => {
                const Icon = command.icon;
                return (
                  <CommandItem
                    key={command.value}
                    value={command.value}
                    onSelect={() =>
                      runAfterClose(() => {
                        onNavigate(command.view);
                      })
                    }
                  >
                    <Icon />
                    <span>{command.label}</span>
                    <CommandShortcut>{command.hint}</CommandShortcut>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
