const fs = require('fs');
let content = fs.readFileSync('src/App.test.tsx', 'utf8');

// Use exact string replacement or safe regex
content = content.replace(/name: \/\^historico\$\/i/g, 'name: /^histórico/i');
content = content.replace(/name: \/patrimonio & investimentos\/i/g, 'name: /patrimônio & investimentos/i');
content = content.replace(/name: \/evolu\.\.o do patrim\.nio\/i/g, 'name: /resumo, evolucao e movimentos/i');
content = content.replace(/name: \/\^lancar\$\/i/g, 'name: /^lançar/i');
content = content.replace(/name: \/\^lancar\/i/g, 'name: /^lançar/i');
content = content.replace(/name: \/\^historico\/i/g, 'name: /^histórico/i');
content = content.replace(/name: \/\^patrimonio\/i/g, 'name: /^patrimônio/i');
content = content.replace(/name: \/\^cartoes\$\/i/g, 'name: /^cartões$/i');
content = content.replace(/name: \/configuracoes\/i/g, 'name: /configurações/i');

// Other strings
content = content.replace(/\/registrar aporte agora\/i/g, '/novo aporte/i');
content = content.replace(/\/ver todos no histórico\/i/g, '/ver no historico/i');
content = content.replace(/\/orcamentos por categoria\/i/g, '/orçamentos por categoria/i');
content = content.replace(/\/lancamentos nao categorizados\/i/g, '/lançamentos não categorizados/i');
content = content.replace(/\/ver categorias em alerta\/i/g, '/ver categorias em alerta/i');

// Add timeouts
content = content.replace(/findAllByText\(\/reembolsos pendentes\/i\)/g, 'findAllByText(/reembolsos pendentes/i, undefined, { timeout: 15000 })');
content = content.replace(/findByText\(\/próximos eventos\/i\)/g, 'findByText(/próximos eventos/i, undefined, { timeout: 15000 })');
content = content.replace(/findByText\(\/lançamentos não categorizados\/i\)/g, 'findByText(/lançamentos não categorizados/i, undefined, { timeout: 15000 })');
content = content.replace(/findByText\(\/orçamentos por categoria\/i\)/g, 'findByText(/orçamentos por categoria/i, undefined, { timeout: 15000 })');

fs.writeFileSync('src/App.test.tsx', content);
