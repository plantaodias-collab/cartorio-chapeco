# Seguranca do painel

Este projeto usa Firebase Realtime Database. Nao publique regras restritivas sem antes cadastrar os usuarios, porque o painel atual ainda nao tem tela de login.

## Passos recomendados

1. Mantenha um backup local antes de qualquer mudanca nas regras.
2. Ative Firebase Authentication no projeto.
3. Cadastre apenas os e-mails autorizados da equipe.
4. Adicione login no painel.
5. Publique as regras em `firebase.rules.json`.
6. Teste leitura, criacao, edicao e movimentacao de cartoes com um usuario autorizado.

## O que ja foi preparado

- Botao `Backup` no painel para exportar os cartoes vistos pelo navegador.
- Metadados `updatedAt` e `updatedBy` nas proximas gravacoes.
- Escrita tentativa em `kanban/audit` para registrar futuras alteracoes sem bloquear o salvamento principal.
- Regras de banco preparadas em `firebase.rules.json`, ainda nao aplicadas.

## Importante

O arquivo `kanban_data.js` contem dados migrados e tambem precisa ser revisado se o repositorio continuar publico. Mesmo com Firebase fechado, qualquer dado sensivel que esteja no JavaScript publicado continua visivel para quem acessar o site.
