export type AppView =
  | "dashboard"
  | "reports"
  | "investments"
  | "transactions"
  | "accounts"
  | "cards"
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
    label: "Vis\u00E3o geral",
    description: "Vis\u00E3o mensal do caixa",
  },
  {
    id: "reports",
    label: "Relatórios",
    description: "Períodos, categorias e parcelas futuras",
  },
  {
    id: "investments",
    label: "Investimentos",
    description: "Aportes, dividendos e patrimonio",
  },
  {
    id: "transactions",
    label: "Transa\u00E7\u00F5es",
    description: "Filtros, edi\u00E7\u00E3o e estorno",
  },
  {
    id: "accounts",
    label: "Contas",
    description: "Saldo, cria\u00E7\u00E3o e ajustes",
  },
  {
    id: "cards",
    label: "Cart\u00F5es",
    description: "Cadastro e ciclo de pagamento",
  },
];

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  return (
    <nav aria-label="Main navigation" className="sidebar">
      <div className="brand-block">
        <p className="eyebrow">Finances</p>
        <strong className="brand-title">Controle pessoal</strong>
        <p className="sidebar-copy">{"Desktop focado em caixa, contas e movimenta\u00E7\u00F5es."}</p>
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
          <span className="nav-item__label">{"Configura\u00E7\u00F5es"}</span>
          <span aria-hidden="true" className="nav-item__description">
            {"Desenvolvimento e prefer\u00EAncias"}
          </span>
        </button>
      </div>
    </nav>
  );
}
