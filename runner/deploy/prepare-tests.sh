#!/usr/bin/env bash
set -euo pipefail
sudo -n apt-get update -qq
sudo -n env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends python3-venv
python3 -m venv /home/pylevelRoot/pylevel-runner-api-upload/test-venv
/home/pylevelRoot/pylevel-runner-api-upload/test-venv/bin/pip install --disable-pip-version-check -r /home/pylevelRoot/pylevel-runner-api-upload/runner/requirements-api.txt
cd /home/pylevelRoot/pylevel-runner-api-upload/runner
/home/pylevelRoot/pylevel-runner-api-upload/test-venv/bin/python -B -m unittest test_api -v
