export type AppView =
  | "dashboard"
  | "transactions"
  | "accounts"
  | "cards"
  | "movements"
  | "settings";

type SidebarProps = {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
};

const NAV_ITEMS: Array<{
  id: AppView;
  label: string;
  description: string;
}> = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Visao mensal do caixa",
  },
  {
    id: "transactions",
    label: "Transacoes",
    description: "Filtros, edicao e estorno",
  },
  {
    id: "accounts",
    label: "Contas",
    description: "Saldo, criacao e ajustes",
  },
  {
    id: "cards",
    label: "Cards",
    description: "Cadastro e ciclo de pagamento",
  },
  {
    id: "movements",
    label: "Movimentar",
    description: "Entradas, saidas e transferencias",
  },
];

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  return (
    <nav aria-label="Main navigation" className="sidebar">
      <div className="brand-block">
        <p className="eyebrow">Finances</p>
        <strong className="brand-title">Controle pessoal</strong>
        <p className="sidebar-copy">Desktop focado em caixa, contas e movimentacoes.</p>
      </div>
      <ul className="nav-list">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              aria-pressed={item.id === activeView}
              className={`nav-item${item.id === activeView ? " is-active" : ""}`}
              onClick={() => onNavigate(item.id)}
              type="button"
            >
              <span className="nav-item__label">{item.label}</span>
              <span aria-hidden="true" className="nav-item__description">
                {item.description}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="sidebar-footer">
        <button
          aria-pressed={activeView === "settings"}
          className={`nav-item nav-item--footer${activeView === "settings" ? " is-active" : ""}`}
          onClick={() => onNavigate("settings")}
          type="button"
        >
          <span className="nav-item__label">Configurações</span>
          <span aria-hidden="true" className="nav-item__description">
            Desenvolvimento e preferências
          </span>
        </button>
      </div>
    </nav>
  );
}
