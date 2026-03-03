# Toast Global Design

**Objetivo:** substituir os banners de sucesso e erro espalhados pelas views por um sistema único de toast com descarte automático, evitando que mensagens "vazem" entre telas.

## Problema Atual

O `App` mantém um `notice` global e repassa essa mensagem para diferentes views (`AccountsView`, `TransactionsView`, `MovementsPanel`, `SettingsView`). Como cada tela renderiza seu próprio banner, a mesma notificação continua visível ao navegar, gerando a percepção de que uma confirmação "aparece em todas as telas".

## Abordagem

Criar um host global de toast renderizado uma única vez no `App`, fora das views de conteúdo. Toda mensagem de sucesso ou erro passa por esse host, que exibe apenas a notificação mais recente e a remove automaticamente após alguns segundos.

## Comportamento

- Toasts de sucesso e erro aparecem no canto superior direito da área principal.
- O toast mais recente substitui qualquer toast ainda visível.
- O usuário pode fechar manualmente.
- Toasts de sucesso somem mais rápido que os de erro.
- Views deixam de renderizar banners inline para mensagens transitórias.

## Impacto Técnico

- `App.tsx` deixa de passar `notice`, `successMessage` e `errorMessage` apenas para exibição.
- `runMutation`, `refreshData` e validações locais passam a publicar toasts.
- `AccountsView`, `TransactionsView`, `MovementsPanel` e `SettingsView` perdem os banners persistentes.
- O pseudo-toast com "Desfazer" em `MovementsPanel` é removido para manter uma única linguagem de feedback.

## Testes

- Verificar que um toast aparece após uma ação de sucesso.
- Verificar que o toast fecha sozinho após o tempo configurado.
- Verificar que uma navegação de tela não reaproveita a mensagem dentro de outra view.
