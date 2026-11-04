#!/usr/bin/env bash
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then
    printf '%s\n' 'Run this installer with sudo.' >&2
    exit 1
fi
stage=/home/pylevelRoot/pylevel-runner-api-upload
source_dir="$stage/runner"
if ! id pylevel-runner >/dev/null 2>&1; then
    useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin pylevel-runner
fi
usermod -a -G docker pylevel-runner
install -d -o root -g root -m 755 /opt/pylevel-runner
install -d -o root -g root -m 700 /etc/pylevel-runner
for name in api.py execute.py reconcile.py requirements-api.txt; do
    install -o root -g root -m 644 "$source_dir/$name" "/opt/pylevel-runner/$name"
done
install -o root -g root -m 600 "$stage/runner.env" /etc/pylevel-runner/runner.env
python3 -m venv /opt/pylevel-runner/venv
/opt/pylevel-runner/venv/bin/pip install --disable-pip-version-check -r /opt/pylevel-runner/requirements-api.txt

if ! command -v caddy >/dev/null 2>&1; then
    # Prevent the package's default site from starting before its configuration is ready.
    systemctl mask caddy.service
    export DEBIAN_FRONTEND=noninteractive
    apt-get install -y --no-install-recommends debian-keyring debian-archive-keyring apt-transport-https curl gnupg
    curl --fail --silent --show-error --location https://dl.cloudsmith.io/public/caddy/stable/gpg.key -o "$stage/caddy-signing.key"
    gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg "$stage/caddy-signing.key"
    curl --fail --silent --show-error --location https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /etc/apt/sources.list.d/caddy-stable.list
    chmod 644 /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq
    apt-get install -y --no-install-recommends caddy
fi
install -o root -g root -m 644 "$source_dir/deploy/Caddyfile" /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
for name in pylevel-runner.service pylevel-runner-cleanup.service pylevel-runner-cleanup.timer; do
    install -o root -g root -m 644 "$source_dir/deploy/$name" "/etc/systemd/system/$name"
done
systemctl daemon-reload
systemctl enable pylevel-runner.service pylevel-runner-cleanup.timer
systemctl restart pylevel-runner.service
systemctl start pylevel-runner-cleanup.timer
systemctl unmask caddy.service
systemctl enable caddy.service
systemctl restart caddy.service
systemctl is-active pylevel-runner.service caddy.service pylevel-runner-cleanup.timer
