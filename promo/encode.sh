#!/usr/bin/env sh
# Blends the 3 sub-frames per frame from `node render.mjs frames 60 3` into
# motion-blurred 60fps video and muxes music.wav -> shipped-promo.mp4
set -e
cd "$(dirname "$0")"
FFMPEG="${FFMPEG:-ffmpeg}"
"$FFMPEG" -hide_banner -y -framerate 180 -i frames/f_%05d.jpg -i music.wav \
  -vf "tmix=frames=3,select='eq(mod(n\,3)\,2)',setpts=N/60/TB,format=yuv420p" -r 60 -fps_mode cfr \
  -c:v libx264 -preset slow -crf 16 -profile:v high -movflags +faststart \
  -c:a aac -b:a 256k -shortest shipped-promo.mp4
