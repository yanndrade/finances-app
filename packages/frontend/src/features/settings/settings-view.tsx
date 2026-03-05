type SettingsViewProps = {
  isSubmitting: boolean;
  onResetApplicationData: () => Promise<void>;
};

export function SettingsView({
  isSubmitting,
  onResetApplicationData,
}: SettingsViewProps) {
  return (
    <div className="screen-stack">
      <section className="panel-card settings-panel">
        <div className="settings-danger-card">
          <div>
            <p className="eyebrow">Ambiente</p>
            <h3 className="section-title">Zerar aplicacao</h3>
            <p className="section-copy">
              Limpa compras, transferencias e contas para voltar ao estado de primeira abertura
              da aplicacao.
            </p>
          </div>

          <button
            className="ghost-button ghost-button--danger settings-danger-button"
            disabled={isSubmitting}
            onClick={() => {
              void onResetApplicationData();
            }}
            type="button"
          >
            Apagar todos os dados
          </button>
        </div>
      </section>
    </div>
  );
}
