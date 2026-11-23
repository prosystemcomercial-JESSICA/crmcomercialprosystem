#!/usr/bin/env python3
# Cópia extra dos backups do servidor neste computador (a principal fora do servidor é o MEGA, enviado pelo próprio
# servidor desde 23/11/2026). Roda pela tarefa do Windows "CRM_Backup_Diario_17h" (e no logon), via backup-diario.bat.
#
# 23/11/2026: entra com a chave SSH (antes era senha, num .bat de uma pasta antiga, e parou em 19/11); baixa só os
# backups que o servidor marcou como bons (_ok) e só o necessário para restaurar (dump completo + sha256 + arquivos
# dos clientes + _resumo.json; o JSON de cada tabela, ~700 MB, fica só no servidor); confere o sha256 de cada dump;
# guarda os MANTER mais novos e avisa o servidor (o vigia do CRM confere).
#
# Uso: python sync-backup-vps.py

import datetime
import hashlib
import io
import json
import os
import shutil
import sys

import paramiko

VPS_HOST = os.environ.get("VPS_HOST", "comercial.prosystemnet.com")
VPS_USER = os.environ.get("VPS_USER", "root")
CHAVE = os.path.expanduser(os.environ.get("VPS_CHAVE", "~/.ssh/crm_comercial_vps"))
REMOTO = "/var/backups-comercial"
LOCAL = os.environ.get("BACKUP_DEST", "C:/Users/prosy/backups-crm-comercial")
MANTER = 14  # ~7 dias (2 por dia), ~500 MB cada
ARQUIVOS = ["banco-completo.sql.gz", "banco-completo.sql.gz.sha256", "_resumo.json", "_arquivos-clientes.tar.gz", "_restauracao.txt"]


def sha256(caminho):
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        for bloco in iter(lambda: f.read(1024 * 1024), b""):
            h.update(bloco)
    return h.hexdigest()


def main():
    cliente = paramiko.SSHClient()
    cliente.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    cliente.connect(VPS_HOST, username=VPS_USER, key_filename=CHAVE, timeout=30, banner_timeout=60)
    sftp = cliente.open_sftp()
    os.makedirs(LOCAL, exist_ok=True)

    bons = []
    for nome in sorted(sftp.listdir(REMOTO)):
        try:
            nomes = set(sftp.listdir(f"{REMOTO}/{nome}"))
        except IOError:
            continue
        if "_ok" in nomes and "banco-completo.sql.gz" in nomes:
            bons.append((nome, nomes))
    alvo = bons[-MANTER:]
    erros = []

    for nome, nomes in alvo:
        pasta = os.path.join(LOCAL, nome)
        if os.path.exists(os.path.join(pasta, "_conferido")):
            continue
        os.makedirs(pasta, exist_ok=True)
        for a in ARQUIVOS:
            if a not in nomes:
                continue
            remoto, local = f"{REMOTO}/{nome}/{a}", os.path.join(pasta, a)
            tam = sftp.stat(remoto).st_size
            if not os.path.exists(local) or os.path.getsize(local) != tam:
                sftp.get(remoto, local + ".parcial")
                os.replace(local + ".parcial", local)
                print(f"baixado: {nome}/{a}")
        esperado = open(os.path.join(pasta, "banco-completo.sql.gz.sha256"), encoding="utf-8").read().split()[0]
        if sha256(os.path.join(pasta, "banco-completo.sql.gz")) == esperado:
            open(os.path.join(pasta, "_conferido"), "w").close()
        else:
            erros.append(nome)
            os.remove(os.path.join(pasta, "banco-completo.sql.gz"))  # baixa de novo na próxima vez
            print(f"[SYNC] ERRO: {nome} chegou diferente do servidor (sha256); será baixado de novo")

    # Limpeza local: só pastas de backup (nome com data) fora das MANTER mais novas, e só se a cópia de hoje deu certo.
    if not erros:
        manter = {n for n, _ in alvo}
        for nome in os.listdir(LOCAL):
            if nome[:4].isdigit() and "T" in nome and nome not in manter and os.path.isdir(os.path.join(LOCAL, nome)):
                if alvo and nome < alvo[0][0]:
                    shutil.rmtree(os.path.join(LOCAL, nome), ignore_errors=True)
                    print(f"removido local antigo: {nome}")

    if not erros and alvo:
        marca = json.dumps({"pc_em": datetime.datetime.now(datetime.timezone.utc).isoformat(), "backups": len(alvo), "ultimo": alvo[-1][0]})
        try:
            sftp.mkdir("/var/backups-comercial-status")
        except IOError:
            pass
        sftp.putfo(io.BytesIO(marca.encode("utf-8")), "/var/backups-comercial-status/copia-pc.json")

    sftp.close()
    cliente.close()
    if erros:
        print(f"[SYNC] FALHA: {len(erros)} backup(s) não conferiram")
        sys.exit(1)
    print(f"[SYNC] OK: {len(alvo)} backups conferidos em {LOCAL} ({datetime.datetime.now():%d/%m/%Y %H:%M})")


if __name__ == "__main__":
    main()
