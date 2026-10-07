#!/bin/sh
set -eu

umask 077
backup_dir=${BACKUP_DIR:-./backups}
backup_file="$backup_dir/vitoria_regia-$(date -u +%Y%m%dT%H%M%SZ).sql"

mkdir -p "$backup_dir"
docker compose --env-file .env.production exec -T db sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --routines --triggers vitoria_regia' \
  > "$backup_file"

printf 'Backup criado: %s\n' "$backup_file"
