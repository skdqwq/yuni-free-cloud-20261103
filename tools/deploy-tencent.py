"""Stage both YUNI services, preserve the current database/AI env, then switch Caddy.

Run on the existing server as its deployment user. Old containers remain available
until the public Render-to-Tencent route has been verified and explicitly finalized.
"""
from pathlib import Path, PurePosixPath
from datetime import datetime, timezone
import argparse, hashlib, json, os, re, shutil, socket, subprocess, tarfile, time
import urllib.request, urllib.error

BASE = Path('/home/ubuntu/projects/yuni-updates')
CONFIG = Path('/home/ubuntu/projects/yuni-ops/Caddyfile')
APP_PORT, SITE_PORT = 10011, 10012


def run(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT).strip()


def get(path, port):
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{port}{path}', timeout=15) as reply:
            return reply.status, reply.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def current_service(label, prefix):
    ids = run('docker', 'ps', '-q', '--filter', 'label=com.yuni.service=' + label).split()
    values = json.loads(run('docker', 'inspect', *ids)) if ids else []
    matches = [value for value in values if value['Name'].lstrip('/').startswith(prefix)]
    assert len(matches) == 1, 'Inspect the running YUNI service before deploying: ' + label
    return matches[0]


def bound_port(container, port):
    values = container['NetworkSettings']['Ports'][str(port) + '/tcp']
    assert len(values) == 1 and values[0]['HostIp'] == '127.0.0.1', 'Expected loopback-only service binding'
    return int(values[0]['HostPort'])


def verify_files(folder, manifest):
    record = json.loads(manifest.read_text())
    for relative, expected in record['sha256'].items():
        file = folder / relative.lstrip('/')
        file.resolve().relative_to(folder.resolve())
        assert hashlib.sha256(file.read_bytes()).hexdigest() == expected, 'Release asset mismatch: ' + relative
    return record['release']


def main(commit):
    assert re.fullmatch('[0-9a-f]{40}', commit), 'Use an exact source commit'
    old_config = CONFIG.read_text()
    old_app = current_service('application', 'yuni-tencent')
    old_site = current_service('showcase', 'yuni-showcase')
    old_app_port, old_site_port = bound_port(old_app, 10000), bound_port(old_site, 80)
    assert not old_app['Mounts'], 'Inspect and preserve application mounts before proceeding'
    assert get('/api/health', old_app_port)[0] == 200
    assert get('/', old_site_port)[0] == 200
    for port in [APP_PORT, SITE_PORT]:
        with socket.socket() as connection:
            assert connection.connect_ex(('127.0.0.1', port)) != 0, 'Candidate port is already occupied'
    assert shutil.disk_usage(BASE).free > 1_500_000_000, 'Free some build disk space before deploying'
    environment = dict(value.split('=', 1) for value in old_app['Config']['Env'])
    assert environment.get('YUNI_DB_URL', '').startswith('jdbc:postgresql://'), 'Existing cloud database must be preserved'
    environment['YUNI_RUNTIME_MODE'] = 'application'
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    release = BASE / 'releases' / ('night-' + stamp)
    archive = BASE / ('source-night-' + stamp + '.tar.gz')
    image = 'yuni-tencent:night-' + stamp.lower()
    app_name, site_name = 'yuni-tencent-' + stamp.lower(), 'yuni-showcase-' + stamp.lower()
    release.mkdir(parents=True, exist_ok=False)
    source_url = 'https://codeload.github.com/skdqwq/yuni-free-cloud-20261103/tar.gz/' + commit
    request = urllib.request.Request(source_url, headers={'User-Agent': 'YUNI-deployment'})
    with urllib.request.urlopen(request, timeout=90) as remote, archive.open('wb') as output:
        shutil.copyfileobj(remote, output)
    with tarfile.open(archive, 'r:gz') as source:
        entries = source.getmembers()
        assert len(entries) < 2500 and sum(entry.size for entry in entries) < 250_000_000
        prefix = PurePosixPath(entries[0].name).parts[0]
        for entry in entries:
            relative = PurePosixPath(entry.name)
            assert relative.parts[0] == prefix and '..' not in relative.parts and not relative.is_absolute()
            relative = PurePosixPath(*relative.parts[1:])
            target = release.joinpath(*relative.parts)
            target.resolve().relative_to(release.resolve())
            if entry.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                assert entry.isfile(), 'Only regular source files are accepted'
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(source.extractfile(entry).read())
                target.chmod(0o644)
    app_release = verify_files(release / 'web', release / 'web/release.json')
    site_release = verify_files(release / 'web/showcase', release / 'web/showcase/manifest.json')
    assert app_release == 'night-20261112-3' and site_release == 'showcase-20261112-2'
    print('SOURCE_VERIFIED ' + commit, flush=True)
    build_log = BASE / ('build-night-' + stamp + '.log')
    with build_log.open('wb') as output:
        built = subprocess.run(['docker', 'build', '-t', image, str(release)], stdout=output, stderr=subprocess.STDOUT)
    assert built.returncode == 0, 'Build failed; inspect ' + str(build_log)
    print('IMAGE_BUILT ' + image, flush=True)
    candidate = old_config
    for old, new in [(old_app_port, APP_PORT), (old_site_port, SITE_PORT)]:
        before, after = f'reverse_proxy 127.0.0.1:{old}', f'reverse_proxy 127.0.0.1:{new}'
        assert 1 <= candidate.count(before) <= 6, 'Inspect the current Caddy routes before changing them'
        candidate = candidate.replace(before, after)
    config_candidate = CONFIG.with_name('Caddyfile.night-' + stamp)
    config_candidate.write_text(candidate)
    run('docker', 'run', '--rm', '--network', 'none', '-v', str(config_candidate) + ':/etc/caddy/Caddyfile:ro', '--entrypoint', 'caddy', 'caddy:2-alpine', 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile')
    backup = CONFIG.parent / 'backups' / ('Caddyfile.before-night-' + stamp)
    backup.parent.mkdir(exist_ok=True)
    shutil.copy2(CONFIG, backup)
    env_file = BASE / ('.environment-night-' + stamp)
    descriptor = os.open(str(env_file), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w') as output:
        for key, value in environment.items():
            if key.startswith('YUNI_PROXY_'):
                continue
            assert '\n' not in value and '\r' not in value, 'Inspect multiline configuration before preserving it'
            output.write(key + '=' + value + '\n')
    started, changed = [], False
    try:
        run('docker', 'run', '-d', '--name', app_name, '--restart', 'unless-stopped', '--memory', '512m', '--label', 'com.yuni.service=application', '--env-file', str(env_file), '-p', f'127.0.0.1:{APP_PORT}:10000', image)
        started.append(app_name)
        env_file.unlink()
        run('docker', 'run', '-d', '--name', site_name, '--restart', 'unless-stopped', '--memory', '128m', '--label', 'com.yuni.service=showcase', '-p', f'127.0.0.1:{SITE_PORT}:80', '-v', str(release / 'web/showcase') + ':/srv:ro', '--entrypoint', 'caddy', 'caddy:2-alpine', 'file-server', '--root', '/srv', '--listen', ':80')
        started.append(site_name)
        for attempt in range(180):
            try:
                if get('/api/health', APP_PORT)[0] == 200:
                    break
            except Exception:
                pass
            if attempt == 179:
                raise RuntimeError('Candidate application health timeout')
            time.sleep(1)
        assert json.loads(get('/release.json', APP_PORT)[1])['release'] == app_release
        assert get('/api/planner', APP_PORT)[0] == 401
        assert get('/api/internal-state', APP_PORT)[0] == 503
        assert get('/api/voice-manager', APP_PORT)[0] == 503
        assert json.loads(get('/manifest.json', SITE_PORT)[1])['release'] == site_release
        assert get('/assets/nini-compact.glb', SITE_PORT)[0] == 200
        assert CONFIG.read_text() == old_config, 'Caddy configuration changed during deployment'
        print('BOTH_CANDIDATES_HEALTHY', flush=True)
        changed = True
        # The running Caddy container bind-mounts this file: preserve its inode.
        shutil.copyfile(config_candidate, CONFIG)
        run('docker', 'exec', 'yuni-https', 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile')
        run('docker', 'exec', 'yuni-https', 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile')
        record = {'commit': commit, 'app_release': app_release, 'site_release': site_release, 'source': str(release), 'app_container': app_name, 'site_container': site_name, 'app_port': APP_PORT, 'site_port': SITE_PORT, 'previous_app': old_app['Name'].lstrip('/'), 'previous_site': old_site['Name'].lstrip('/'), 'config_backup': str(backup), 'old_containers_kept_running': True, 'deployed_at': stamp}
        record_file = BASE / ('deployment-night-' + stamp + '.json')
        record_file.write_text(json.dumps(record, indent=2))
        print('DEPLOYED ' + json.dumps(record), flush=True)
    except Exception:
        if changed:
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
    parser.add_argument('--commit', required=True)
    main(parser.parse_args().commit)
