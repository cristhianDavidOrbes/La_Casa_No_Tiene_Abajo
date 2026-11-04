# Vídeos locales con fotografías del juego y narración; no se generan al jugar.
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $project
New-Item -ItemType Directory -Path 'work/broadcast-refresh' -Force | Out-Null
Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.SelectVoice('Microsoft Helena Desktop')
$speaker.Rate = -1
$speaker.Volume = 85
$channels = @{
  '01' = @(
    @('televisor', 'OBJETOS CON MEMORIA', 'Archivo domestico / Coleccion 1998', 'Hubo una epoca en la que las familias se reunian alrededor de una sola pantalla. Cada aparato guardaba las voces y las imagenes de una casa.'),
    @('radio', 'ARCHIVO DOMESTICO', 'Las voces permanecen', 'Una fotografia conserva una mirada. Una grabacion conserva una voz. A veces, al volver a escucharlas, parece que la habitacion sigue esperando a quien falta.')
  )
  '02' = @(
    @('fusible', '01 / FUSIBLE DE REPUESTO', 'Mesa junto a la puerta de entrada', 'Este es el fusible de repuesto. Esta sobre la mesa de madera junto a la puerta de entrada. Su cuerpo es de ceramica clara, con dos extremos metalicos.'),
    @('panel', '02 / CAJA ELECTRICA', 'Coloca aqui el fusible para dar corriente', 'Esta es la caja electrica de la sala. Acercate con el fusible para colocarlo en su conexion. Al restablecer la corriente, el primer acceso queda abierto.'),
    @('televisor', 'ESTA CASA CAMBIA', 'Los umbrales permiten ir y volver', 'Esta casa tiene comportamientos extranos. Algunas habitaciones cambian de orientacion. Observa el entorno y recuerda que los umbrales permiten ir y volver. No estas obligado a seguir viendo esta grabacion.')
  )
  '05' = @(
    @('radio', 'MUSEO DE LA RADIO', 'Emision nocturna / Archivo sonoro', 'Antes de las pantallas, una radio llenaba la casa de lugares lejanos. Por la noche, entre las estaciones, se oian silbidos, voces y palabras que nadie llegaba a entender.'),
    @('televisor', 'LA ULTIMA EMISION', 'Continuaremos despues de la pausa', 'Cuando terminaba la programacion, quedaba una pantalla encendida en una sala vacia. La transmision seguia alli, aunque ya no hubiera nadie mirando.')
  )
}
try {
  foreach ($channel in @('01', '02', '05')) {
    $clips = @()
    $index = 0
    foreach ($shot in $channels[$channel]) {
      $prefix = "work/broadcast-refresh/$channel-$index"
      $speaker.SetOutputToWaveFile((Join-Path $project "$prefix.wav"))
      $speaker.Speak($shot[3].Replace('extranos', ('extra' + [char]0xF1 + 'os')))
      $speaker.SetOutputToNull()
      [IO.File]::WriteAllText((Join-Path $project "$prefix.txt"), ($shot[1] + "`n" + $shot[2]), (New-Object Text.UTF8Encoding($false)))
      $filter = "scale=768:432:force_original_aspect_ratio=decrease,pad=768:576:(ow-iw)/2:0:color=0x0b1510,setsar=1,noise=alls=3:allf=t,drawtext=fontfile='C\:/Windows/Fonts/cour.ttf':textfile='$prefix.txt':fontcolor=0xd7d6b9:fontsize=24:x=(w-tw)/2:y=472:line_spacing=14"
      & ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 15 -i "public/assets/broadcasts/instruccion-$($shot[0]).png" -i "$prefix.wav" -vf $filter -af 'highpass=f=150,lowpass=f=3500,apad=pad_dur=0.8,alimiter=limit=0.8' -c:v libx264 -preset fast -crf 25 -pix_fmt yuv420p -c:a aac -b:a 96k -shortest -movflags +faststart "$prefix.mp4"
      if ($LASTEXITCODE -ne 0) { throw "Fallo al preparar $prefix" }
      $clips += "file '$channel-$index.mp4'"
      $index++
    }
    [IO.File]::WriteAllLines((Join-Path $project 'work/broadcast-refresh/clips.txt'), $clips, (New-Object Text.UTF8Encoding($false)))
    & ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i 'work/broadcast-refresh/clips.txt' -c copy -movflags +faststart "public/assets/broadcasts/canal-$channel.mp4"
    if ($LASTEXITCODE -ne 0) { throw "Fallo al unir canal $channel" }
  }
} finally { $speaker.Dispose() }
