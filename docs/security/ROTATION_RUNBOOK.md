# Runbook de rotação e revogação de segredos

## Frequência recomendada
- **Tokens de API (bot, worker, Pede.ai):** mensal.
- **Credenciais de banco e webhook secrets:** trimestral.
- **Rotação extraordinária:** imediata em incidentes, suspeita de vazamento, desligamento de colaborador com acesso privilegiado ou exposição em log.

## Procedimento padrão de rotação (mensal/trimestral)
1. Gerar novo segredo no provedor (Vault/KMS/Pede.ai/etc.).
2. Atualizar o arquivo de segredo no host/orquestrador (`secrets/<nome>.txt`) sem versionar em Git.
3. Validar permissões mínimas por serviço (bot não acessa secrets de worker e vice-versa).
4. Reiniciar apenas o serviço afetado para recarregar `/run/secrets/*`.
5. Executar smoke test funcional do serviço.
6. Revogar o segredo antigo no provedor.
7. Registrar evidências da rotação (ticket, data, responsável, resultado).

## Procedimento de revogação emergencial
1. **Conter:** pausar tráfego externo do serviço afetado (se aplicável).
2. **Revogar imediatamente** o token/credencial comprometido no provedor de origem.
3. **Emitir novo segredo** com escopo mínimo e tempo de vida reduzido temporariamente.
4. Atualizar Docker secret e reiniciar serviço impactado.
5. Validar sinais de abuso (logs, auditoria do provedor, chamadas suspeitas).
6. Abrir incidente com linha do tempo e ações corretivas.

## Checklist operacional
- [ ] Segredo rotacionado no prazo (mensal/trimestral).
- [ ] Segredo antigo revogado.
- [ ] Serviço saudável após reload.
- [ ] Evidências anexadas no ticket.
- [ ] Matriz de segredos atualizada.
