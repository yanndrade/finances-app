import {
  BarChart3,
  CreditCard,
  Home,
  LineChart,
  Repeat,
  ReceiptText,
  Settings2,
  Wallet2,
  type LucideIcon,
} from "lucide-react";

export type AppView =
  | "dashboard"
  | "reports"
  | "investments"
  | "transactions"
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

type SidebarProps = {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
};

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
    id: "fixedExpenses",
    label: "Gastos fixos",
    shortLabel: "Fixos",
    description: "Regras recorrentes e pendencias do mes",
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
    id: "reports",
    label: "Planejamento",
    shortLabel: "Planejamento",
    description: "Orçamento, relatórios e projeção",
    icon: BarChart3,
  },
  {
    id: "investments",
    label: "Patrimônio & investimentos",
    shortLabel: "Patrimônio",
    description: "Composição, evolução e movimentos",
    icon: LineChart,
  },
  {
    id: "accounts",
    label: "Contas",
    shortLabel: "Contas",
    description: "Saldos e status da carteira",
    icon: Wallet2,
  },
];

export const MOBILE_NAV_ITEMS: NavigationItem[] = DESKTOP_NAV_ITEMS.filter((item) =>
  item.id === "dashboard" ||
  item.id === "transactions" ||
  item.id === "fixedExpenses" ||
  item.id === "cards",
);

export function isMobileEssentialView(view: AppView): boolean {
  return MOBILE_NAV_ITEMS.some((item) => item.id === view);
}

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  return (
    <nav aria-label="Navegação principal" className="sidebar">
      <div className="brand-block">
        <p className="eyebrow">Finanças</p>
        <strong className="brand-title">Controle pessoal</strong>
        <p className="sidebar-copy">Desktop focado em caixa, contas e movimentações.</p>
      </div>
      <ul className="nav-list">
        {DESKTOP_NAV_ITEMS.map((item) => {
          const Icon = item.icon;

          return (
            <li key={item.id}>
              <button
                aria-pressed={item.id === activeView}
                className={`nav-item${item.id === activeView ? " is-active" : ""}`}
                onClick={() => onNavigate(item.id)}
                type="button"
              >
                <span className="nav-item__headline">
                  <Icon aria-hidden="true" className="nav-item__icon" />
                  <span className="nav-item__label">{item.label}</span>
                </span>
                <span aria-hidden="true" className="nav-item__description">
                  {item.description}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="sidebar-footer">
        <button
          aria-pressed={activeView === "settings"}
          className={`nav-item nav-item--footer${activeView === "settings" ? " is-active" : ""}`}
          onClick={() => onNavigate("settings")}
          type="button"
        >
          <span className="nav-item__headline">
            <Settings2 aria-hidden="true" className="nav-item__icon" />
            <span className="nav-item__label">Configurações</span>
          </span>
          <span aria-hidden="true" className="nav-item__description">
            Regras, preferências e backup
          </span>
        </button>
      </div>
    </nav>
  );
}
