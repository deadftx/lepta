# Estrutura do projeto LEPTA

## Site institucional

O site público permanece em `src/pages`, com os componentes públicos em `src/components`.

- `src/pages/Home.tsx`: página institucional.
- `src/pages/Login.tsx`: entrada da área interna.
- `src/components/Navbar.tsx`: navegação institucional.
- `src/components/Footer.tsx`: rodapé institucional.

## Área interna

Todo o frontend autenticado está em `src/internal`.

### Núcleo compartilhado

`src/internal/core` contém somente infraestrutura usada por vários módulos:

- autenticação e sessão;
- layout e menu lateral;
- proteção de rotas;
- catálogo e seletor de permissões;
- estilos compartilhados.

### Módulos

| Grupo | Pasta |
| --- | --- |
| Home | `src/internal/modules/home` |
| Créditos | `src/internal/modules/credits` |
| Análise de Riscos | `src/internal/modules/risks` |
| Comitê de Crédito | `src/internal/modules/credit-committee` |
| Calendário | `src/internal/modules/calendar` |
| Financeiro | `src/internal/modules/finance` |
| Processar Extrato | `src/internal/modules/finance/statement-processing` |
| Lepta Intelligence | `src/internal/modules/intelligence` |
| Análise de Clientes | `src/internal/modules/intelligence/customer-analysis` |
| Confirmação | `src/internal/modules/confirmation` |
| Banco de Dados | `src/internal/modules/database` |
| Dashboards | `src/internal/modules/dashboards` |
| Business Intelligence | `src/internal/modules/business-intelligence` |
| Administração e acessos | `src/internal/modules/administration/access` |

## Backend

- `server.js`: entrada estável para npm e PM2.
- `server/internal/app.js`: aplicação Express da área interna.
- `server/internal/modules`: responsabilidades dos módulos do backend.
- `database.sqlite`: banco principal, mantido na raiz.

## Como criar um submenu

1. Crie uma pasta dentro do grupo correspondente.
2. Cadastre a permissão em `src/internal/core/permissions.ts`.
3. Proteja a rota em `src/App.tsx` com `AccessRoute`.
4. Adicione o item ao grupo em `src/internal/core/InternalLayout.tsx`.
5. Coloque qualquer rota nova do backend no módulo correspondente em `server/internal/modules`.
6. Execute `npm run build` e teste a rota com e sem permissão.

As URLs existentes não devem ser renomeadas apenas por causa da organização das pastas.
