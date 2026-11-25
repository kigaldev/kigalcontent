#Requires -Version 5.1
# Wrapper conveniente para scripts\setup-minipc.ps1 (equivalente a setup-minipc.sh)
& (Join-Path $PSScriptRoot 'scripts\setup-minipc.ps1') @args
exit $LASTEXITCODE
