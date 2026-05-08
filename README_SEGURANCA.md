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
- Campo `Seu nome` no painel para preencher o `updatedBy` neste computador.
- Suporte preparado para Firebase Authentication: ao colar a config Web do Firebase no setup, o painel passa a pedir login por e-mail/senha.
- Busca tolerante a acentos e formatos de telefone/documentos.
- Ordenacao dos cartoes por prioridade, prazo e data de entrada.
- Alerta antes de cadastrar um documento que parece duplicado.
- Filtros rapidos de atencao, documentos abertos e notas devolutivas/retornos.
- Exportacao CSV dos documentos filtrados para abrir no Excel.
- Escrita tentativa em `kanban/audit` para registrar futuras alteracoes sem bloquear o salvamento principal.
- Regras de banco preparadas em `firebase.rules.json`, ainda nao aplicadas.

## Importar usuarios do Chat Interno

Depois de ativar `Authentication > Sign-in method > Email/Password` no Firebase Console, copie a `apiKey` da configuracao Web do app Firebase e rode:

```powershell
$env:FIREBASE_API_KEY = "cole-a-apiKey-aqui"
node scripts/import-auth-users.js
```

Por padrao o script le `C:/ChatInterno/data/usuarios.json`, importa somente usuarios ativos e nao imprime senhas no terminal. Se o arquivo estiver em outro local:

```powershell
$env:CHAT_INTERNO_USERS = "C:/caminho/usuarios.json"
$env:FIREBASE_API_KEY = "cole-a-apiKey-aqui"
node scripts/import-auth-users.js
```

## Importante

O arquivo `kanban_data.js` contem dados migrados e tambem precisa ser revisado se o repositorio continuar publico. Mesmo com Firebase fechado, qualquer dado sensivel que esteja no JavaScript publicado continua visivel para quem acessar o site.
