# CRM - Baseline de segurança para segredos (Docker/Node)

Este repositório define um baseline para gestão de segredos com:
- Docker secrets por serviço (`bot`, `worker`, `pedeai-integration`)
- Menor privilégio por token/credencial
- Rotação periódica e revogação emergencial documentadas
- Redação de dados sensíveis em logs

## Como aplicar
1. Criar arquivos de segredo em `./secrets/*.txt` no ambiente de deploy (não versionar).
2. Subir stack com `docker compose up -d`.
3. Consumir segredos no Node via `src/security/secrets.js` usando variáveis `*_FILE`.
4. Registrar rotações conforme `docs/security/ROTATION_RUNBOOK.md`.
