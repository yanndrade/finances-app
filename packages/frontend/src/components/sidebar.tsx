const NAV_ITEMS = ["Dashboard", "Transacoes", "Contas", "Movimentar"];

export function Sidebar() {
  return (
    <nav aria-label="Main navigation" className="sidebar">
      <div className="brand-block">
        <p className="eyebrow">Finance</p>
        <strong>Desktop</strong>
      </div>
      <ul className="nav-list">
        {NAV_ITEMS.map((item) => (
          <li key={item}>
            <button
              className={`nav-item${item === "Dashboard" ? " is-active" : ""}`}
              type="button"
            >
              {item}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
