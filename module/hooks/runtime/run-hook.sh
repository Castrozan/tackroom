#!/usr/bin/env bash

set -Eeuo pipefail

readonly HOOK_SCRIPT="${1:-}"
shift || true

if [[ -z $HOOK_SCRIPT || ! -f $HOOK_SCRIPT ]]; then
	exit 0
fi

export PYTHONPYCACHEPREFIX="${XDG_CACHE_HOME:-$HOME/.cache}/tackroom/pycache"
export PYTHONDONTWRITEBYTECODE=1

exec "@hookPythonInterpreter@" "$HOOK_SCRIPT" "$@"
