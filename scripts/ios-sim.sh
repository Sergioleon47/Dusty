#!/bin/bash
# Atajos para el simulador de iPhone, que es donde se arma todo lo de la App Store.
#
# Resuelve dos fricciones que aparecieron en cada vuelta de la preparación de iOS:
#
#   1. El service worker. La app es una PWA: sw.js precachea app-*.js sin ningún
#      número de versión en la URL, así que tras un `cap sync` el WebView sigue
#      sirviendo los archivos de la corrida anterior y parece que el cambio no se
#      aplicó. Desinstalar la app borra su caché y es la única forma confiable de
#      ver de verdad lo último.
#
#   2. Las capturas para la ficha. Apple las quiere en el tamaño de pantalla
#      grande; sacarlas a mano con ⌘+S no dice en qué medida salieron, y App Store
#      Connect recién avisa al subirlas. Acá se imprime el tamaño de cada una.
#
# Uso:
#   scripts/ios-sim.sh reset          desinstala la app del simulador encendido
#   scripts/ios-sim.sh shot <nombre>  guarda una captura en store-screenshots/ios/
#   scripts/ios-sim.sh devices        lista los simuladores disponibles

set -euo pipefail

APP_ID="com.dusty.inventory"
DESTINO="store-screenshots/ios"

# `simctl` habla de "booted" para el simulador que está encendido ahora mismo. Si
# no hay ninguno, sus comandos fallan con un error poco claro, así que se avisa acá.
exigir_simulador() {
  if ! xcrun simctl list devices booted | grep -q "Booted"; then
    echo "No hay ningún simulador encendido."
    echo "Abrí el simulador desde Xcode (▶) y volvé a intentar."
    exit 1
  fi
}

case "${1:-}" in
  reset)
    exigir_simulador
    xcrun simctl uninstall booted "$APP_ID" 2>/dev/null || true
    echo "Dusty desinstalada del simulador."
    echo "Dale ▶ en Xcode: se instala de cero, sin caché vieja."
    ;;

  shot)
    nombre="${2:-}"
    if [ -z "$nombre" ]; then
      echo "Falta el nombre. Ejemplo: scripts/ios-sim.sh shot dashboard"
      exit 1
    fi
    exigir_simulador
    mkdir -p "$DESTINO"
    archivo="$DESTINO/$nombre.png"
    xcrun simctl io booted screenshot --type=png "$archivo"
    # sips viene con macOS y lee el tamaño real del archivo, que es lo que Apple
    # valida — el modelo de simulador no alcanza para saberlo de antemano.
    medida=$(sips -g pixelWidth -g pixelHeight "$archivo" | awk '/pixel/{printf "%s ", $2}')
    echo "Guardada: $archivo"
    echo "Tamaño:   ${medida}px"
    echo
    echo "Apple acepta 1320x2868 o 1290x2796 para iPhone de pantalla grande."
    echo "Si no coincide, cambiá a un simulador Pro Max y repetí."
    ;;

  devices)
    xcrun simctl list devices available | grep -i iphone
    ;;

  *)
    echo "Uso:"
    echo "  scripts/ios-sim.sh reset          desinstala la app (borra la caché del service worker)"
    echo "  scripts/ios-sim.sh shot <nombre>  captura la pantalla actual"
    echo "  scripts/ios-sim.sh devices        lista los simuladores disponibles"
    exit 1
    ;;
esac
