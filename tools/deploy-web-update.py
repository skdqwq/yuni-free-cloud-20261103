"""Update YUNI web assets using the current application image and cloud settings."""
from pathlib import Path, PurePosixPath
from datetime import datetime, timezone
import argparse, hashlib, json, os, re, shutil, socket, subprocess, tarfile, time
import urllib.request, urllib.error

BASE = Path('/home/ubuntu/projects/yuni-updates')
CONFIG = Path('/home/ubuntu/projects/yuni-ops/Caddyfile')
APP_PORT, SITE_PORT = 10021, 10022


def run(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT).strip()


def fetch(port, route):
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{port}{route}', timeout=15) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def active_service(label, container_port, config):
    ids = run('docker', 'ps', '-q', '--filter', 'label=com.yuni.service=' + label).split()
    values = json.loads(run('docker', 'inspect', *ids)) if ids else []
    matches = []
    for value in values:
        bindings = value['NetworkSettings']['Ports'].get(str(container_port) + '/tcp') or []
        if len(bindings) == 1 and bindings[0]['HostIp'] == '127.0.0.1':
            port = int(bindings[0]['HostPort'])
            if re.search(r'reverse_proxy 127\.0\.0\.1:' + str(port) + r'\b', config):
                matches.append((value, port))
    assert len(matches) == 1, 'Inspect the active YUNI service: ' + label
    return matches[0]


def main(archive_path, expected_sha):
    assert re.fullmatch('[0-9a-f]{64}', expected_sha)
    archive = Path(archive_path)
    assert archive.is_file() and hashlib.sha256(archive.read_bytes()).hexdigest() == expected_sha
    config_before = CONFIG.read_text()
    old_app, old_app_port = active_service('application', 10000, config_before)
    old_site, old_site_port = active_service('showcase', 80, config_before)
    assert not old_app['Mounts'], 'Preserve existing application mounts before proceeding'
    environment = dict(value.split('=', 1) for value in old_app['Config']['Env'])
    assert environment.get('YUNI_DB_URL', '').startswith('jdbc:postgresql://')
    assert fetch(old_app_port, '/api/health')[0] == 200 and fetch(old_site_port, '/')[0] == 200
    for port in [APP_PORT, SITE_PORT]:
        with socket.socket() as connection:
            assert connection.connect_ex(('127.0.0.1', port)) != 0, 'Candidate port occupied'
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    release = BASE / 'releases' / ('colors-' + stamp)
    release.mkdir(parents=True, exist_ok=False)
    with tarfile.open(archive, 'r:gz') as source:
        entries = source.getmembers()
        assert len(entries) < 500 and sum(entry.size for entry in entries) < 50_000_000
        for entry in entries:
            relative = PurePosixPath(entry.name)
            assert not relative.is_absolute() and '..' not in relative.parts
            target = release.joinpath(*relative.parts)
            target.resolve().relative_to(release.resolve())
            if entry.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                assert entry.isfile()
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(source.extractfile(entry).read())
                target.chmod(0o644)
    bundle = json.loads((release / 'bundle.json').read_text())
    for name, expected in bundle['sha256'].items():
        file = release / name
        file.resolve().relative_to(release.resolve())
        assert hashlib.sha256(file.read_bytes()).hexdigest() == expected, 'Asset mismatch: ' + name
    assert bundle['app_release'] == 'colors-20261113-1'
    assert bundle['site_release'] == 'showcase-20261113-restore'
    base_image = old_app['Config']['Image']
    assert re.fullmatch(r'yuni-tencent:[a-z0-9-]+', base_image), 'Inspect the current application image'
    (release / 'Dockerfile').write_text('FROM ' + base_image + '\nCOPY --chown=node:node web/ /app/web/\n')
    image = 'yuni-tencent:colors-' + stamp.lower()
    with (release / 'build.log').open('wb') as output:
        assert subprocess.run(['docker', 'build', '-t', image, str(release)], stdout=output, stderr=subprocess.STDOUT).returncode == 0, 'Web image build failed'
    print('WEB_IMAGE_BUILT ' + image, flush=True)
    candidate = config_before
    for old, new in [(old_app_port, APP_PORT), (old_site_port, SITE_PORT)]:
        candidate, count = re.subn(r'reverse_proxy 127\.0\.0\.1:' + str(old) + r'\b', 'reverse_proxy 127.0.0.1:' + str(new), candidate)
        assert 1 <= count <= 6
    config_candidate = release / 'Caddyfile'
    config_candidate.write_text(candidate)
    run('docker', 'run', '--rm', '--network', 'none', '-v', str(config_candidate) + ':/etc/caddy/Caddyfile:ro', '--entrypoint', 'caddy', 'caddy:2-alpine', 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile')
    backup = CONFIG.parent / 'backups' / ('Caddyfile.before-colors-' + stamp)
    backup.parent.mkdir(exist_ok=True)
    shutil.copy2(CONFIG, backup)
    environment['YUNI_RUNTIME_MODE'] = 'application'
    env_file = release / '.environment'
    descriptor = os.open(str(env_file), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w') as output:
        for key, value in environment.items():
            if key.startswith('YUNI_PROXY_'):
                continue
            assert '\n' not in value and '\r' not in value
            output.write(key + '=' + value + '\n')
    app_name, site_name = 'yuni-tencent-colors-' + stamp.lower(), 'yuni-showcase-colors-' + stamp.lower()
    started, switched = [], False
    try:
        run('docker', 'run', '-d', '--name', app_name, '--restart', 'unless-stopped', '--memory', '512m', '--label', 'com.yuni.service=application', '--env-file', str(env_file), '-p', f'127.0.0.1:{APP_PORT}:10000', image)
        started.append(app_name)
        env_file.unlink()
        run('docker', 'run', '-d', '--name', site_name, '--restart', 'unless-stopped', '--memory', '128m', '--label', 'com.yuni.service=showcase', '-p', f'127.0.0.1:{SITE_PORT}:80', '-v', str(release / 'web/showcase') + ':/srv:ro', '--entrypoint', 'caddy', 'caddy:2-alpine', 'file-server', '--root', '/srv', '--listen', ':80')
        started.append(site_name)
        for attempt in range(180):
            try:
                if fetch(APP_PORT, '/api/health')[0] == 200:
                    break
            except Exception:
                pass
            if attempt == 179:
                raise RuntimeError('Candidate startup timeout')
            time.sleep(1)
        for port, manifest in [(APP_PORT, 'web/release.json'), (SITE_PORT, 'web/showcase/manifest.json')]:
            record = json.loads((release / manifest).read_text())
            for name, expected in record['sha256'].items():
                code, data = fetch(port, '/' + name.lstrip('/'))
                assert code == 200 and hashlib.sha256(data).hexdigest() == expected, 'Served asset mismatch: ' + name
        assert fetch(APP_PORT, '/api/planner')[0] == 401
        assert fetch(APP_PORT, '/api/internal-state')[0] == 503
        assert fetch(APP_PORT, '/api/voice-manager')[0] == 503
        assert CONFIG.read_text() == config_before, 'Caddy changed during deployment'
        switched = True
        shutil.copyfile(config_candidate, CONFIG)
        run('docker', 'exec', 'yuni-https', 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile')
        run('docker', 'exec', 'yuni-https', 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile')
        record = {'app_release': bundle['app_release'], 'site_release': bundle['site_release'], 'app_container': app_name, 'site_container': site_name, 'app_port': APP_PORT, 'site_port': SITE_PORT, 'previous_app': old_app['Name'].lstrip('/'), 'previous_site': old_site['Name'].lstrip('/'), 'config_backup': str(backup), 'source': str(release), 'old_containers_kept_running': True, 'deployed_at': stamp}
        (BASE / ('deployment-colors-' + stamp + '.json')).write_text(json.dumps(record, indent=2))
        print('DEPLOYED ' + json.dumps(record), flush=True)
    except Exception:
        if switched:
            shutil.copyfile(backup, CONFIG)
            subprocess.run(['docker', 'exec', 'yuni-https', 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'], check=False)
        for name in started:
            subprocess.run(['docker', 'stop', name], check=False, stdout=subprocess.DEVNULL)
        raise
    finally:
        if env_file.exists():
            env_file.unlink()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', required=True)
    parser.add_argument('--sha256', required=True)
    args = parser.parse_args()
    main(args.archive, args.sha256)
