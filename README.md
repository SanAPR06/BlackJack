# Blackjack 8 Mazos

Juego de blackjack para navegador (PC, iPad y teléfono), sin instalación ni dependencias.

## Qué incluye
- **8 mazos**, el dealer se planta en todos los 17, blackjack paga 3:2, doblar en cualquier mano de 2 cartas, dividir hasta 4 manos (los ases una vez) y rendición tardía.
- **4 mesas** con límites, fichas, color y música propios: **Caracas**, **Madrid**, **Monaco** y **Las Vegas**.
- **Premios exclusivos por mesa**, además del **21+3** y el **Par Perfecto** (que están en todas) y un **Mega Jackpot progresivo** por mesa.
- Caracas: 2 **Jokers** en el zapato. Todas las mesas: **carta de corte** visible.
- Estrategia básica con la jugada resaltada, contador Hi-Lo, calificación de cada ronda (1-100), tabla de líderes por mesa y partida guardada.
- Música y efectos generados en el navegador (sin archivos de audio).

## Estructura del proyecto
```
index.html            página (solo el marcado) y el orden de carga de los scripts
css/style.css         todos los estilos
js/datos.js           constantes, mesas, estado del juego, zapato y reglas básicas
js/audio.js           Web Audio: osciladores, ruido y efectos de sonido
js/musica.js          música generativa, estilos de cada mesa y controles de audio
js/persistencia.js    datos guardados: partida, bote, líderes, Salón de la fama, avisos
js/premios.js         Par Perfecto, 21+3 y premios exclusivos de cada mesa
js/interfaz.js        dibujado de la mesa, eventos y pantalla de inicio
js/estrategia.js      estrategia básica, calificación, avisos y contador de cartas
js/pantallas.js       sin saldo, resumen, continuar y picar el mazo
js/ronda.js           flujo de la ronda y arranque
manifest.webmanifest  datos de la app instalable
sw.js                 service worker (modo sin conexión)
icons/                iconos
```
Son scripts clásicos (sin módulos ni compilación): comparten variables globales y se cargan **en el orden** de `index.html`.
Si agregas un archivo nuevo, añádelo allí y en la lista `SHELL` de `sw.js`.

## Publicarlo en GitHub Pages
1. Crea un repositorio en GitHub y sube **todo el contenido de esta carpeta** (incluidos `css/`, `js/`, `icons/` y `.nojekyll`).
2. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. Espera 1-2 minutos. La dirección será `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

> El service worker (instalación y modo sin conexión) solo funciona con `https`, que GitHub Pages ya ofrece.

## Instalarlo como app (con icono)
- **iPhone / iPad (Safari):** abre la dirección → botón **Compartir** → **Añadir a pantalla de inicio**.
- **Android (Chrome):** menú ⋮ → **Instalar app** o **Añadir a pantalla de inicio**.
- **PC (Chrome/Edge):** icono de instalar en la barra de direcciones.

Requiere iOS/iPadOS 15 o superior. Abrir `index.html` con doble clic también funciona, pero sin instalación ni modo sin conexión.

El icono es una ficha dorada con el 21 (`icons/`). Para cambiarlo, reemplaza los PNG manteniendo los tamaños (180, 192, 512 y 512 *maskable*).

## Publicar una actualización
1. Sube los cambios a `main`.
2. Los dispositivos con conexión reciben la versión nueva al abrir la app (el service worker pide primero la red).
3. Si agregaste o quitaste archivos, cambia `VERSION` en `sw.js` (por ejemplo `v3`).

## Probarlo en tu computadora
Hace falta servir la carpeta (los scripts se cargan por separado):

```bash
npx serve .
# o, con Python:
python -m http.server 8099
```
Luego abre `http://localhost:8099/` (o la dirección que indique `serve`).

## Datos guardados (en cada dispositivo)
Partida, tabla de líderes, bote de cada mesa, Salón de la fama y preferencias de audio se guardan en el navegador (`localStorage`). No se comparten entre dispositivos y se pierden si se borran los datos del sitio.
