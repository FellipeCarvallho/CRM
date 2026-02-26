# Matriz de segredos (Docker/Node)

| Segredo | Origem | Dono | Serviço(s) autorizado(s) | Escopo mínimo | Validade | Rotação |
|---|---|---|---|---|---|---|
| `bot_token` | Provedor do bot | Time de Plataforma | `bot` | Envio/leitura de mensagens do bot | 30 dias | Mensal |
| `bot_db_password` | Banco de dados | DBA + Plataforma | `bot` | Usuário DB exclusivo do bot | 90 dias | Trimestral |
| `worker_token` | IAM interno | Time de Plataforma | `worker` | Execução de jobs assíncronos | 30 dias | Mensal |
| `worker_db_password` | Banco de dados | DBA + Plataforma | `worker` | Usuário DB exclusivo do worker | 90 dias | Trimestral |
| `pedeai_api_token` | Painel Pede.ai | Integrações | `pedeai-integration` | Somente endpoints Pede.ai necessários | 30 dias | Mensal |
| `pedeai_webhook_secret` | Painel Pede.ai | Integrações | `pedeai-integration` | Validação de assinatura de webhook | 90 dias | Trimestral |

## Regras obrigatórias
1. Segredos **não** podem ser enviados por `.env` em produção.
2. Cada serviço recebe apenas secrets dedicados em `/run/secrets`.
3. Logs e métricas devem usar redaction para campos sensíveis.
4. Qualquer vazamento exige revogação imediata (ver runbook).
5. Mudanças devem atualizar esta matriz e o ticket de auditoria.
