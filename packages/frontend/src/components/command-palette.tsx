import {
  BarChart3,
  CreditCard,
  HandCoins,
  Home,
  Landmark,
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
    hint: "Lancador rapido",
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
    hint: "Transferencia interna",
    value: "transferir entre contas transferencia interna",
    preset: "transfer_internal",
  },
  {
    label: "Pagar fatura",
    hint: "Transferencia para cartao",
    value: "pagar fatura cartao",
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
    label: "Visao geral",
    hint: "Dashboard acionavel",
    value: "visao geral dashboard",
    view: "dashboard",
    icon: Home,
  },
  {
    label: "Historico unificado",
    hint: "Ledger principal",
    value: "historico unificado ledger movimentos",
    view: "transactions",
    icon: Landmark,
  },
  {
    label: "Cartoes",
    hint: "Gestao de faturas",
    value: "cartoes credito",
    view: "cards",
    icon: CreditCard,
  },
  {
    label: "Patrimonio & investimentos",
    hint: "Aportes e evolucao",
    value: "patrimonio investimentos",
    view: "investments",
    icon: TrendingUp,
  },
  {
    label: "Analises & relatorios",
    hint: "Categorias e tendencia",
    value: "analises relatorios insights",
    view: "reports",
    icon: BarChart3,
  },
  {
    label: "Contas",
    hint: "Saldos e cadastro",
    value: "contas saldos carteira",
    view: "accounts",
    icon: Wallet,
  },
  {
    label: "Configuracoes",
    hint: "Preferencias do sistema",
    value: "configuracoes sistema",
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
      <DialogContent className="overflow-hidden p-0 sm:max-w-[560px]">
        <DialogHeader className="px-4 pt-4 pb-1">
          <DialogTitle>Command palette</DialogTitle>
          <DialogDescription>
            Digite uma acao para navegar ou lancar rapidamente.
          </DialogDescription>
        </DialogHeader>

        <Command className="rounded-none">
          <CommandInput placeholder="Ex.: Registrar despesa, Pagar fatura, Abrir Historico..." />
          <CommandList>
            <CommandEmpty>Nenhuma acao encontrada.</CommandEmpty>

            <CommandGroup heading="Lancamentos">
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

            <CommandGroup heading="Navegacao">
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
