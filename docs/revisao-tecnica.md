# Revisão técnica completa (falhas, bugs, melhorias e pendências)

## Escopo da revisão

- Infraestrutura Docker Compose
- Bot de atendimento
- Worker de follow-up
- Integração de pedidos com Chatwoot
- Documentação operacional

## Falhas/bugs identificados e status

1. **Inconsistência entre documentação e compose de produção**
   - Problema: runbook antigo referenciava volumes nomeados, enquanto o compose principal usa bind mounts.
   - Correção: runbook atualizado com paths reais em `/opt/crm/data/*`.
   - Status: **corrigido**.

2. **Arquivo legado de follow-up na raiz causando ambiguidade**
   - Problema: `followup.job.js` na raiz usava endpoints fictícios e padrão CJS, potencialmente confundindo operação.
   - Correção: arquivo marcado explicitamente como legado com erro orientando uso de `bot/followup.job.js`.
   - Status: **corrigido**.

3. **Arquivo legado de compose em `opt/crm/docker-compose.yml`**
   - Problema: template alternativo podia conflitar com o compose principal.
   - Correção: arquivo convertido para stub legado indicando uso de `./docker-compose.yml`.
   - Status: **corrigido**.

4. **Bot com baixa resiliência em falhas de rede/API**
   - Problema: chamadas sem timeout e sem verificação robusta de erro de POST para Chatwoot.
   - Correção: adicionado timeout (`AbortSignal.timeout`), validação de status HTTP e tratamento de exceção no endpoint.
   - Status: **corrigido**.

## Melhorias recomendadas (próximas iterações)

1. Adicionar testes para `bot/bot-server.js` (mocks de Chatwoot/Ollama).
2. Adicionar `healthcheck` em serviços críticos no compose.
3. Persistir logs do bot/follow-up em destino central (Loki/ELK).
4. Implementar validação de webhook signature (quando disponível no provedor).
5. Adicionar CI para `npm test` + `node --check` em push/PR.

## Implementações pendentes para operação madura

- Rotina automatizada de backup diário com retenção (7/15/30 dias).
- Alertas (Telegram/Slack/email) para falhas de PM2 e indisponibilidade dos domínios.
- Inventário de segredos e rotação periódica em ambiente produtivo.
