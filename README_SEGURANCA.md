# Seguranca do painel

Este projeto usa Firebase Realtime Database. O banco de producao esta temporariamente bloqueado para leitura e gravacao enquanto configuramos contas e login. A pagina exige Firebase Authentication; mesmo apos sua publicacao, o painel permanece sem dados ate concluirmos contas, migracao e regras.

## Passos recomendados

1. Mantenha o backup fora do repositorio e confirme que ele pode ser lido antes de qualquer migracao.
2. Ative Firebase Authentication e crie individualmente as contas autorizadas.
3. Desative criacao de contas por usuarios finais; confirme que somente a equipe autorizada possui conta.
4. Publique o painel sem a fonte estatica, mantendo o banco bloqueado.
5. Revise as regras em `firebase.rules.json` e obtenha autorizacao expressa antes de substituir o bloqueio global, pois isso libera dados a usuarios autenticados.
6. Depois da autorizacao, publique as regras e migre os dados do backup protegido usando uma sessao autenticada; valide a contagem e o funcionamento.
7. Teste leitura, criacao, edicao e movimentacao com uma conta autorizada e confirme que uma conta nao autorizada nao acessa os dados.
8. Se algum teste ou regra falhar, reaplique bloqueio global de leitura e gravacao.

## O que ja foi preparado

- Botao `Backup` no painel para exportar os cartoes vistos pelo navegador.
- Metadados `updatedAt` e `updatedBy` nas proximas gravacoes.
- Campo `Seu nome` no painel para preencher o `updatedBy` neste computador.
- Firebase Authentication obrigatorio no codigo do painel; o acesso aos dados so deve ser liberado depois da configuracao das contas e das regras.
- Busca tolerante a acentos e formatos de telefone/documentos.
- Ordenacao dos cartoes por prioridade, prazo e data de entrada.
- Alerta antes de cadastrar um documento que parece duplicado.
- Duplicacao de documento para reaproveitar identificacao e dados de atendimento; pagamento, observacoes e datas iniciam em branco.
- Atribuicao em lote usando a mesma rotina central de salvamento e auditoria.
- Destaque visual para registros com `prazo` numerico entre zero e cinco dias; `data_conclusao` nao e tratada como prazo final.
- Filtros rapidos de atencao, documentos abertos e notas devolutivas/retornos.
- Exportacao CSV dos documentos filtrados para abrir no Excel.
- Historico recente no modal de cada documento, baseado em `kanban/audit`.
- Arquivamento exige data de retirada, quem retirou e responsavel pela entrega.
- Navegacao rapida entre colunas, botoes principais fixos no mobile e layout ajustado para telas pequenas.
- Tela de relatorio com documentos por responsavel, tempo medio em aberto, concluidos no mes e documentos parados.
- Escrita tentativa em `kanban/audit` para registrar futuras alteracoes sem bloquear o salvamento principal. E um historico operacional gravado pelo cliente, nao um log de seguranca confiavel.
- Os novos registros de auditoria omitem valores de campos pessoais/financeiros, mantendo a indicacao de quais campos mudaram.
- Regras de autenticacao preparadas em `firebase.rules.json`; nao as publique antes de configurar as contas autorizadas e desativar o cadastro publico.

## Primeiro acesso e troca de senha

Use uma conta individual por pessoa, identificada pelo e-mail institucional ou outro e-mail confirmado. O Firebase Authentication usa e-mail/senha; prenomes isolados nao sao identificadores de login neste painel. O campo `recebido` da tabela e apenas um responsavel registrado no atendimento e nao comprova que essa pessoa tenha acesso ao sistema.

Nao reutilize senha de outro sistema nem distribua uma senha comum como `123456`: qualquer pessoa que a conheca poderia entrar como outra. Crie apenas as contas autorizadas no Firebase Authentication e, para cada uma, envie o link individual de redefinicao/definicao de senha. A tela de login possui essa opcao e apresenta uma resposta generica para nao revelar se um e-mail esta cadastrado. O link permite que cada usuario defina sua propria senha antes de entrar.

Para um fluxo administrativo de senha temporaria com troca obrigatoria apos o primeiro login, seria necessario implementar uma verificacao de primeiro acesso confiavel no servidor (Firebase Admin SDK); nao basta gravar uma flag no navegador. Esse fluxo ainda nao esta implementado. A configuracao Email/Password deve permanecer sem cadastro publico.

## Estado de seguranca

O Realtime Database de producao esta bloqueado globalmente: `.read` e `.write`
estao definidos como `false`. A leitura anonima de verificacao retornou HTTP
401. Nenhum dado foi apagado. Mantenha o bloqueio ate a configuracao de contas
individuais autorizadas, migracao e validacao do painel autenticado.

`firebase.rules.json` contem a proxima etapa, que permite usuarios autenticados
com provedor Email/Password; nao e a regra atualmente publicada. `auth != null`
sozinho nao e uma lista de autorizacao: desative cadastro publico depois de
criar as contas e antes de publicar essa regra. A migracao da base historica
deve ser concluida e validada antes de liberar leitura e gravacao.

## Importante

O arquivo `kanban_data.js` era uma fonte historica com dados pessoais. Foi
removido da versao atual e preservado fora do checkout em
`C:\planilha de controle de atas\kanban_data-private-backup.js`; nao o publique
novamente. O repositorio e o GitHub Pages sao publicos. Considere a exposicao
passada como real: remover o arquivo da versao atual nao apaga versoes antigas,
forks ou caches.
