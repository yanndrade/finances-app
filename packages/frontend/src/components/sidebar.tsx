import {
  CreditCard,
  Home,
  LineChart,
  PanelLeftClose,
  PanelLeftOpen,
  Repeat,
  ReceiptText,
  RotateCcw,
  Settings2,
  Wallet2,
  type LucideIcon,
} from "lucide-react";

export type AppView =
  | "dashboard"
  | "investments"
  | "transactions"
  | "reimbursements"
  | "fixedExpenses"
  | "accounts"
  | "cards"
  | "settings";

type NavigationItem = {
  id: AppView;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
};

type NavGroup = {
  label?: string;
  items: NavigationItem[];
};

type SidebarProps = {
  activeView: AppView;
  isCollapsed: boolean;
  onNavigate: (view: AppView) => void;
  onToggleCollapse: () => void;
};

// Flat list kept for mobile and backward-compat exports
export const DESKTOP_NAV_ITEMS: NavigationItem[] = [
  {
    id: "dashboard",
    label: "Visão geral",
    shortLabel: "Início",
    description: "Visão mensal do caixa",
    icon: Home,
  },
  {
    id: "transactions",
    label: "Histórico",
    shortLabel: "Histórico",
    description: "Histórico central e operação do mês",
    icon: ReceiptText,
  },
  {
    id: "reimbursements",
    label: "Reembolsos",
    shortLabel: "Reembolsos",
    description: "Pendências, cobranças e recebimentos",
    icon: RotateCcw,
  },
  {
    id: "fixedExpenses",
    label: "Gastos fixos",
    shortLabel: "Fixos",
    description: "Regras recorrentes e pendências do mês",
    icon: Repeat,
  },
  {
    id: "cards",
    label: "Cartões",
    shortLabel: "Cartões",
    description: "Faturas, limite e ciclo de pagamento",
    icon: CreditCard,
  },
  {
    id: "accounts",
    label: "Contas",
    shortLabel: "Contas",
    description: "Saldos e status da carteira",
    icon: Wallet2,
  },
  {
    id: "investments",
    label: "Patrimônio & investimentos",
    shortLabel: "Patrimônio",
    description: "Composição, evolução e movimentos",
    icon: LineChart,
  },
];

// Grouped structure for desktop sidebar
const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { id: "dashboard", label: "Visão geral", shortLabel: "Início", description: "Visão mensal do caixa", icon: Home },
      { id: "transactions", label: "Histórico", shortLabel: "Histórico", description: "Histórico central e operação do mês", icon: ReceiptText },
      { id: "reimbursements", label: "Reembolsos", shortLabel: "Reembolsos", description: "Pendências, cobranças e recebimentos", icon: RotateCcw },
    ],
  },
  {
    label: "Estrutura",
    items: [
      { id: "fixedExpenses", label: "Gastos fixos", shortLabel: "Fixos", description: "Regras recorrentes e pendências do mês", icon: Repeat },
      { id: "cards", label: "Cartões", shortLabel: "Cartões", description: "Faturas, limite e ciclo de pagamento", icon: CreditCard },
      { id: "accounts", label: "Contas", shortLabel: "Contas", description: "Saldos e status da carteira", icon: Wallet2 },
    ],
  },
  {
    label: "Patrimônio",
    items: [
      { id: "investments", label: "Patrimônio & investimentos", shortLabel: "Patrimônio", description: "Composição, evolução e movimentos", icon: LineChart },
    ],
  },
];

const MOBILE_NAV_ORDER: AppView[] = [
  "dashboard",
  "transactions",
  "cards",
  "fixedExpenses",
  "reimbursements",
];

export const MOBILE_NAV_ITEMS: NavigationItem[] = MOBILE_NAV_ORDER.map(
  (view) => DESKTOP_NAV_ITEMS.find((item) => item.id === view)!,
);

export function isMobileEssentialView(view: AppView): boolean {
  return MOBILE_NAV_ITEMS.some((item) => item.id === view);
}

export function Sidebar({
  activeView,
  isCollapsed,
  onNavigate,
  onToggleCollapse,
}: SidebarProps) {
  return (
    <nav
      aria-label="Navegação principal"
      className={`sidebar${isCollapsed ? " sidebar--collapsed" : ""}`}
    >
      {/* Header: brand + collapse toggle */}
      <div className="sidebar-header">
        <div className="brand-block">
          <img
            src="/meucofri-logo.png"
            alt="MeuCofri"
            className="brand-mark"
          />
          {!isCollapsed && (
            <div className="brand-text">
              <strong className="brand-title">MeuCofri</strong>
              <p className="sidebar-copy">Controle pessoal</p>
            </div>
          )}
        </div>
        <button
          aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
          className="sidebar-toggle"
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          type="button"
        >
          {isCollapsed ? (
            <PanelLeftOpen aria-hidden="true" className="sidebar-toggle__icon" />
          ) : (
            <PanelLeftClose aria-hidden="true" className="sidebar-toggle__icon" />
          )}
        </button>
      </div>

      {/* Main navigation */}
      <div className="nav-body">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div className="nav-group" key={groupIndex}>
            {group.label && !isCollapsed && (
              <p className="nav-group__label">{group.label}</p>
            )}
            <ul className="nav-list">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.id === activeView;

                return (
                  <li key={item.id}>
                    <button
                      aria-current={isActive ? "page" : undefined}
                      className={`nav-item${isActive ? " is-active" : ""}`}
                      onClick={() => onNavigate(item.id)}
                      title={isCollapsed ? item.label : undefined}
                      type="button"
                    >
                      <span className="nav-item__headline">
                        <Icon aria-hidden="true" className="nav-item__icon" />
                        {!isCollapsed && (
                          <span className="nav-item__label">{item.label}</span>
                        )}
                      </span>
                      {!isCollapsed && isActive && (
                        <span aria-hidden="true" className="nav-item__description">
                          {item.description}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer: settings */}
      <div className="sidebar-footer">
        <button
          aria-current={activeView === "settings" ? "page" : undefined}
          className={`nav-item nav-item--footer${activeView === "settings" ? " is-active" : ""}`}
          onClick={() => onNavigate("settings")}
          title={isCollapsed ? "Configurações" : undefined}
          type="button"
        >
          <span className="nav-item__headline">
            <Settings2 aria-hidden="true" className="nav-item__icon" />
            {!isCollapsed && (
              <span className="nav-item__label">Configurações</span>
            )}
          </span>
          {!isCollapsed && activeView === "settings" && (
            <span aria-hidden="true" className="nav-item__description">
              Sistema, dados e manutenção
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}
