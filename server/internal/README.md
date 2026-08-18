# Backend da área interna

`app.js` concentra temporariamente a implementação do backend para preservar o funcionamento durante a reorganização estrutural.

O arquivo `server.js` da raiz é apenas a entrada estável utilizada por npm e PM2. O `database.sqlite`, `.auth-secret`, `aliases.json` e `dist` continuam sendo resolvidos na raiz do projeto.

## Responsabilidade por módulo

- `modules/administration`: autenticação, usuários, grupos e permissões.
- `modules/calendar`: eventos, aniversários e feriados.
- `modules/database`: sincronização e importação das bases SQLite.
- `modules/finance`: processamento financeiro e extratos.
- `modules/intelligence`: integração UNLTD e análise de clientes.

Novas rotas devem ser criadas dentro do módulo responsável. A extração das rotas existentes de `app.js` deve ser feita módulo a módulo, com testes de regressão, sem alterar os endereços HTTP atuais.
