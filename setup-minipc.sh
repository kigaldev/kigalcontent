#!/usr/bin/env bash
# Wrapper conveniente para scripts/setup-minipc.sh
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$DIR/scripts/setup-minipc.sh" "$@"
