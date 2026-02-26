# Runbook de Operação — Persistência, Backup e Validação

## 1) Paths que armazenam dados persistentes

No `docker-compose.yml`, os dados críticos ficam nos volumes abaixo:

- `chatwoot_storage` montado em `/app/storage` (anexos e arquivos do Active Storage do Chatwoot).
- `chatwoot_public` montado em `/app/public` (arquivos públicos/upload quando utilizados pela imagem/configuração).
- `evolution_instances` montado em `/evolution/instances` (estado das instâncias WhatsApp da Evolution API: sessão Baileys, QR e credenciais).

> Dica: para descobrir o path físico no host de cada volume nomeado:
>
> ```bash
> docker volume inspect chatwoot_storage chatwoot_public evolution_instances \
>   --format '{{ .Name }} -> {{ .Mountpoint }}'
> ```

---

## 2) Procedimento de backup/restauração dos volumes

### 2.1 Backup

1. (Opcional, recomendado) congelar escrita durante o backup:
   ```bash
   docker compose -f /opt/crm/docker-compose.yml stop chatwoot evolution_api
   ```
2. Criar pasta de backup:
   ```bash
   mkdir -p /opt/crm/backups
   ```
3. Exportar cada volume para tar.gz:
   ```bash
   docker run --rm -v chatwoot_storage:/volume -v /opt/crm/backups:/backup alpine \
     sh -c 'cd /volume && tar -czf /backup/chatwoot_storage_$(date +%F_%H%M).tar.gz .'

   docker run --rm -v chatwoot_public:/volume -v /opt/crm/backups:/backup alpine \
     sh -c 'cd /volume && tar -czf /backup/chatwoot_public_$(date +%F_%H%M).tar.gz .'

   docker run --rm -v evolution_instances:/volume -v /opt/crm/backups:/backup alpine \
     sh -c 'cd /volume && tar -czf /backup/evolution_instances_$(date +%F_%H%M).tar.gz .'
   ```
4. Subir serviços novamente (se foram parados):
   ```bash
   docker compose -f /opt/crm/docker-compose.yml up -d
   ```

### 2.2 Restauração

1. Parar os serviços:
   ```bash
   docker compose -f /opt/crm/docker-compose.yml down
   ```
2. (Se necessário) recriar volumes vazios:
   ```bash
   docker volume create chatwoot_storage
   docker volume create chatwoot_public
   docker volume create evolution_instances
   ```
3. Restaurar cada backup:
   ```bash
   docker run --rm -v chatwoot_storage:/volume -v /opt/crm/backups:/backup alpine \
     sh -c 'cd /volume && tar -xzf /backup/chatwoot_storage_YYYY-MM-DD_HHMM.tar.gz'

   docker run --rm -v chatwoot_public:/volume -v /opt/crm/backups:/backup alpine \
     sh -c 'cd /volume && tar -xzf /backup/chatwoot_public_YYYY-MM-DD_HHMM.tar.gz'

   docker run --rm -v evolution_instances:/volume -v /opt/crm/backups:/backup alpine \
     sh -c 'cd /volume && tar -xzf /backup/evolution_instances_YYYY-MM-DD_HHMM.tar.gz'
   ```
4. Subir stack:
   ```bash
   docker compose -f /opt/crm/docker-compose.yml up -d
   ```

---

## 3) Checklist de validação após restart

1. **Containers ativos**
   ```bash
   docker compose -f /opt/crm/docker-compose.yml ps
   ```
   Esperado: `chatwoot` e `evolution_api` em estado `Up`.

2. **Validação de anexo no Chatwoot**
   - Entrar no Chatwoot.
   - Abrir uma conversa de teste.
   - Enviar um arquivo (imagem/pdf).
   - Confirmar upload e download do anexo após reload da página.

3. **Validação de instância WhatsApp na Evolution API**
   - Consultar status da instância (endpoint/status no painel/API).
   - Confirmar que a instância está `connected` (sem solicitar novo QR indevidamente).
   - Enviar/receber mensagem de teste para confirmar sessão ativa.

4. **Logs sem erro crítico de storage/sessão**
   ```bash
   docker compose -f /opt/crm/docker-compose.yml logs --tail=200 chatwoot evolution_api
   ```
   Esperado: sem erros recorrentes de permissão, `ENOENT`, perda de sessão ou falhas de upload.
