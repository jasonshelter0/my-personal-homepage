#!/usr/bin/env python3
"""Run on the authorized server only; preserves WordPress and restores on failure.

Compatible with Alibaba Cloud Linux's Python 3.6. Secrets never leave the
server; command logs and backup archives remain in a mode-0700 directory.
"""
import argparse
import datetime
import hashlib
import json
import os
import shutil
import subprocess
import urllib.request

SITE = '/www/server/panel/vhost/nginx/www.jasonshelter.com.conf'
NGINX = '/www/server/nginx/sbin/nginx'
CONFIG = '/www/server/nginx/conf/nginx.conf'
BACKUPS = '/www/backup/site/folio-studio/'


def digest(file):
    h = hashlib.sha256()
    with open(file, 'rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def run(args, log):
    with open(log, 'ab') as stream:
        result = subprocess.run(args, stdout=stream, stderr=stream, timeout=180)
    if result.returncode:
        raise RuntimeError('Command failed; inspect restricted server validation log.')


def replace(source, mode, uid, gid):
    temporary = SITE + '.folio-tmp'
    shutil.copyfile(source, temporary)
    os.chmod(temporary, mode)
    os.chown(temporary, uid, gid)
    os.replace(temporary, SITE)


def restore(folder, manifest):
    original = os.path.join(folder, 'nginx.before.conf')
    if digest(original) != manifest['before_sha256']:
        raise RuntimeError('Backup checksum mismatch; refusing rollback.')
    replace(original, manifest['mode'], manifest['uid'], manifest['gid'])
    log = os.path.join(folder, 'rollback.log')
    run([NGINX, '-t', '-c', CONFIG], log)
    run([NGINX, '-s', 'reload', '-c', CONFIG], log)


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument('--candidate')
    parser.add_argument('--backup-dir', required=True)
    parser.add_argument('--rollback', action='store_true')
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise RuntimeError('Requires the authorized root deployment session.')
    folder = os.path.abspath(args.backup_dir)
    if not folder.startswith(BACKUPS) or folder == BACKUPS.rstrip('/'):
        raise RuntimeError('Backup directory must be beneath the site-specific backup root.')
    manifest_file = os.path.join(folder, 'manifest.json')
    if args.rollback:
        with open(manifest_file) as stream:
            manifest = json.load(stream)
        restore(folder, manifest)
        print(json.dumps({'status': 'rolled_back_to_wordpress', 'backup': folder}))
        return
    if not args.candidate or not os.path.isfile(args.candidate):
        raise RuntimeError('Pass the reviewed candidate config file.')
    with urllib.request.urlopen('http://127.0.0.1:18080/healthz', timeout=10) as response:
        if response.status != 200 or json.load(response)['status'] != 'ok':
            raise RuntimeError('New website is not healthy; no Nginx change made.')
    os.makedirs(folder, mode=0o700, exist_ok=False)
    stat = os.stat(SITE)
    original = os.path.join(folder, 'nginx.before.conf')
    shutil.copy2(SITE, original)
    shutil.copy2(args.candidate, os.path.join(folder, 'nginx.after.conf'))
    log = os.path.join(folder, 'validation.log')
    run([NGINX, '-t', '-c', CONFIG], log)
    archive = os.path.join(folder, 'wordpress-files.tar.gz')
    run(['tar', '-C', '/www/wwwroot', '-czf', archive, 'www.jasonshelter.com'], log)
    run(['gzip', '-t', archive], log)
    manifest = {
        'created_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'site_config': SITE,
        'mode': stat.st_mode & 0o777,
        'uid': stat.st_uid,
        'gid': stat.st_gid,
        'before_sha256': digest(original),
        'after_sha256': digest(args.candidate),
        'wordpress_archive_sha256': digest(archive),
        'wordpress_database': 'External RDS unchanged; no database restore is required for routing rollback.',
    }
    with open(manifest_file, 'w') as stream:
        json.dump(manifest, stream, indent=2)
    try:
        replace(args.candidate, manifest['mode'], manifest['uid'], manifest['gid'])
        run([NGINX, '-t', '-c', CONFIG], log)
        run([NGINX, '-s', 'reload', '-c', CONFIG], log)
        # Validate existing certificate chain and SNI without changing DNS.
        result = subprocess.run([
            'curl', '--fail', '--silent', '--show-error', '--retry', '3',
            '--retry-delay', '1', '--max-time', '10', '--resolve',
            'www.jasonshelter.com:443:127.0.0.1',
            'https://www.jasonshelter.com/healthz',
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=50)
        if result.returncode or json.loads(result.stdout).get('status') != 'ok':
            raise RuntimeError('HTTPS health check failed after cutover.')
        req = urllib.request.Request('http://127.0.0.1/', headers={'Host': '47.120.33.219'}, method='HEAD')
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status != 200:
                raise RuntimeError('Existing IP page regression.')
    except Exception:
        restore(folder, manifest)
        raise RuntimeError('Cutover failed; original WordPress Nginx config was restored.')
    manifest['activated_utc'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with open(manifest_file, 'w') as stream:
        json.dump(manifest, stream, indent=2)
    print(json.dumps({'status': 'activated', 'backup': folder, 'config_sha256': manifest['after_sha256']}))


if __name__ == '__main__':
    main()
