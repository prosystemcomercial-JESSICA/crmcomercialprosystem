#!/usr/bin/env python3
# Sincroniza os backups gerados pelo cron do VPS (/var/backups-comercial) para
# uma pasta local, via SFTP. Roda pelo Task Scheduler, substituindo o antigo
# job que conectava direto no MySQL do Railway (backup-diario.cjs local).
#
# Motivo: o MySQL do VPS so aceita conexao no banco vinda de dentro do proprio
# servidor (bind-address 127.0.0.1) por seguranca -- entao o export roda LA
# (via cron, backup-comercial.sh) e este script so baixa o resultado pronto.
#
# Uso: python sync-backup-vps.py

import paramiko
import os
import sys

VPS_HOST = os.environ.get("VPS_HOST", "179.199.134.177")
VPS_USER = os.environ.get("VPS_USER", "root")
VPS_PASSWORD = os.environ["VPS_PASSWORD"]  # obrigatório — nunca hardcode aqui
VPS_BACKUP_DIR = "/var/backups-comercial"
LOCAL_BACKUP_DIR = os.environ.get("BACKUP_DEST", "C:/Users/prosy/backups-crm-comercial")


def sync_dir(sftp, remote_dir, local_dir):
    os.makedirs(local_dir, exist_ok=True)
    for entry in sftp.listdir_attr(remote_dir):
        remote_path = f"{remote_dir}/{entry.filename}"
        local_path = os.path.join(local_dir, entry.filename)
        import stat
        if stat.S_ISDIR(entry.st_mode):
            sync_dir(sftp, remote_path, local_path)
        else:
            if not os.path.exists(local_path) or os.path.getsize(local_path) != entry.st_size:
                sftp.get(remote_path, local_path)
                print(f"baixado: {remote_path}")


def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(VPS_HOST, username=VPS_USER, password=VPS_PASSWORD, timeout=20)
    sftp = client.open_sftp()

    try:
        pastas_remotas = sorted(sftp.listdir(VPS_BACKUP_DIR))
    except FileNotFoundError:
        print(f"[SYNC] Pasta remota {VPS_BACKUP_DIR} ainda nao existe (nenhum backup rodou no VPS ainda)")
        sftp.close()
        client.close()
        sys.exit(0)

    for nome_pasta in pastas_remotas:
        sync_dir(sftp, f"{VPS_BACKUP_DIR}/{nome_pasta}", os.path.join(LOCAL_BACKUP_DIR, nome_pasta))

    sftp.close()
    client.close()
    print(f"[SYNC] OK — {len(pastas_remotas)} backups sincronizados em {LOCAL_BACKUP_DIR}")


if __name__ == "__main__":
    main()
