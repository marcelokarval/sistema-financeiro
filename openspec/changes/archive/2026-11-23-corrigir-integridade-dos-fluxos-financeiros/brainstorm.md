# Diagnóstico e decisão proposta

Pedido: corrigir defeitos confirmados e regressões encontradas no QA, preservando o redesign. O pedido autoriza a correção, mas não aprova uma nova fórmula, mudança de banco ou exposição dos serviços.

- Ocorreu troca de parcelas sob outro consórcio com GET atrasado (sem escrita); Parcelas recebe a coleção no GET com `id`; a compra pode perder itens se a requisição falhar depois da remoção; a data civil de compra se desloca na apresentação em America/Bahia.
- Corrigir nos limites existentes é preferível a reescrever todas as rotas ou mudar o schema. Preservar os fluxos e os cálculos registrados; acrescentar testes de decisão de identidade, transação e data civil.
- Riscos ainda sem reprodução (respostas tardias em Cartões/Investimentos e foco de Metas em alguns refreshes) exigem teste controlado; sem correção especulativa. O caso `Atrasados` requer verificar a origem do status antes de formular uma regra.
- Feedback HTTP de Compras/Categorias, serialização do recibo e encaminhamento da Busca são ajustes pontuais de apresentação, com provas registradas na mudança visual.
- O usuário aprovou expressamente o desenho e autorizou prosseguir com dados sintéticos. Não foram autorizados migração, pagamento real ou escrita na prévia.
