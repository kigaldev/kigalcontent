# Registra la tarea de Windows "InstagramStudio-tick": cada 10 minutos publica las piezas aprobadas cuya hora ha llegado
# y renueva los tokens de Instagram cuando toca. Solo corre con tu sesión iniciada y el ordenador encendido.
#   powershell -ExecutionPolicy Bypass -File meta\programar-tarea.ps1          (registrar)
#   powershell -ExecutionPolicy Bypass -File meta\programar-tarea.ps1 -Quitar  (borrar)
param([switch]$Quitar)

$nombre = 'InstagramStudio-tick'
if ($Quitar) {
  Unregister-ScheduledTask -TaskName $nombre -Confirm:$false
  Write-Output "Tarea $nombre eliminada."
  return
}

$node = (Get-Command node).Source
$meta = $PSScriptRoot
$accion = New-ScheduledTaskAction -Execute $node -Argument "`"$meta\ig.mjs`" tick" -WorkingDirectory $meta
$disparador = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 10)
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName $nombre -Action $accion -Trigger $disparador -Settings $ajustes `
  -Description 'Instagram Studio: publica por la API oficial de Meta las piezas aprobadas y programadas.' -Force | Out-Null
Write-Output "Tarea $nombre registrada: cada 10 minutos ejecuta node ig.mjs tick. Registro en $meta\ig.log"
