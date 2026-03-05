import {
  BarChart3,
  CreditCard,
  Home,
  LineChart,
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
    label: "Visao geral",
    shortLabel: "Inicio",
    description: "Visao mensal do caixa",
    icon: Home,
  },
  {
    id: "transactions",
    label: "Transacoes",
    shortLabel: "Transacoes",
    description: "Filtros, edicao e estorno",
    icon: ReceiptText,
  },
  {
    id: "cards",
    label: "Cartoes",
    shortLabel: "Cartoes",
    description: "Cadastro e ciclo de pagamento",
    icon: CreditCard,
  },
  {
    id: "reports",
    label: "Relatorios",
    shortLabel: "Relatorios",
    description: "Periodos, categorias e parcelas futuras",
    icon: BarChart3,
  },
  {
    id: "investments",
    label: "Investimentos",
    shortLabel: "Investimentos",
    description: "Aportes, dividendos e patrimonio",
    icon: LineChart,
  },
  {
    id: "accounts",
    label: "Contas",
    shortLabel: "Contas",
    description: "Saldo, criacao e ajustes",
    icon: Wallet2,
  },
];

export const MOBILE_NAV_ITEMS: NavigationItem[] = DESKTOP_NAV_ITEMS.filter((item) =>
  item.id === "dashboard" || item.id === "transactions" || item.id === "cards",
);

export function isMobileEssentialView(view: AppView): boolean {
  return MOBILE_NAV_ITEMS.some((item) => item.id === view);
}

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  return (
    <nav aria-label="Main navigation" className="sidebar">
      <div className="brand-block">
        <p className="eyebrow">Finances</p>
        <strong className="brand-title">Controle pessoal</strong>
        <p className="sidebar-copy">Desktop focado em caixa, contas e movimentacoes.</p>
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
            <span className="nav-item__label">Configuracoes</span>
          </span>
          <span aria-hidden="true" className="nav-item__description">
            Desenvolvimento e preferencias
          </span>
        </button>
      </div>
    </nav>
  );
}
