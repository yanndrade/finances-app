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
        <div className="section-heading">
          <div>
            <p className="eyebrow">Configurações</p>
            <h2 className="section-title">Ferramentas de desenvolvimento</h2>
            <p className="section-copy">
              Recursos temporários para testar o aplicativo durante o desenvolvimento.
            </p>
          </div>
        </div>

        <div className="settings-danger-card">
          <div>
            <p className="eyebrow">Ação destrutiva</p>
            <h3 className="section-title">Zerar aplicação</h3>
            <p className="section-copy">
              Isso apaga todos os dados do banco e volta o sistema para o estado de
              primeira execução.
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
