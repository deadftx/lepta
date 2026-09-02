

## Git Workflow
- **NEVER** run git commit or git push automatically.
- Only modify and save files locally. The user prefers to review changes in VS Code and commit/push manually.

## Validação e CI/CD (GitHub Actions)
- Sempre validar com `npm run build` E `npm run lint` antes de concluir qualquer tarefa.
- O pipeline no GitHub executa `npm run build` e `npm run lint`. Se o lint acusar qualquer erro (`x`), o GitHub Actions quebra o workflow com `X 0 / 1`, impedindo o deploy.
- Sempre que o usuário reportar que uma correção ou validação não surtiu efeito, verificar e alertar imediatamente sobre falhas de CI/CD ou commits não aplicados no GitHub.
