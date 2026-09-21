import { el, injectStyles } from "./styles.js"
import { createBar, createFps, createStat, createTimer } from "./widgets.js"
import {
  createCrosshair,
  createFlash,
  createGameOverScreen,
  createMessage,
  createPauseMenu,
  createScreen,
  createTitleScreen,
  createToasts,
} from "./overlays.js"
import { createWorldLayer } from "./world.js"
import { createMinimap } from "./minimap.js"

const POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]

/**
 * Interface du jeu en HTML/CSS par-dessus le canvas : score, barres, minuteur,
 * réticule, messages, écrans titre/pause/game over, étiquettes 3D, minimap.
 * Les styles sont injectés automatiquement : aucun CSS à écrire.
 *
 * Positions : `"top-left"` (défaut), `"top-center"`, `"top-right"`,
 * `"bottom-left"`, `"bottom-center"`, `"bottom-right"`. Les éléments d'une même
 * position s'empilent. Sur mobile, les commandes tactiles occupent les coins
 * du bas : préférer le haut de l'écran pour les infos.
 *
 * @param {object} game Résultat de `createGame`.
 * @param {{ accent?: string, font?: string }} [options] `accent` : couleur des boutons et surlignages.
 */
export function createHud(game, { accent = "#ea580c", font } = {}) {
  injectStyles()

  const root = el("div", "hud-root")
  root.style.setProperty("--hud-accent", accent)
  if (font) root.style.setProperty("--hud-font", font)
  game.container.appendChild(root)

  // Couches créées d'avance dans l'ordre d'empilement : un écran reste
  // toujours au-dessus, même si un widget est ajouté après lui.
  const worldLayer = el("div", "hud-layer")
  const slotsLayer = el("div", "hud-layer")
  const overlayLayer = el("div", "hud-layer")
  const screenLayer = el("div", "hud-layer")
  root.append(worldLayer, slotsLayer, overlayLayer, screenLayer)

  const slots = new Map()
  const slot = (position = "top-left") => {
    if (!POSITIONS.includes(position)) {
      throw new Error(`Unknown HUD position "${position}" (expected one of ${POSITIONS.join(", ")})`)
    }
    if (!slots.has(position)) {
      const node = el("div", `hud-slot hud-${position}`)
      slotsLayer.append(node)
      slots.set(position, node)
    }
    return slots.get(position)
  }

  const disposables = []
  const track = (widget) => {
    disposables.push(widget)
    return widget
  }
  const place = (widget, position) => {
    slot(position).append(widget.el)
    return track(widget)
  }

  const toasts = track(createToasts(overlayLayer))
  const message = track(createMessage(overlayLayer))
  const flash = track(createFlash(overlayLayer))
  const world = track(createWorldLayer(game, worldLayer))
  let crosshair = null

  return {
    root,
    slot,

    /** Statistique : `hud.stat({ label: "Score", value: 0 })` → `{ set, add, value }`. */
    stat: ({ position = "top-left", ...options } = {}) => place(createStat(options), position),
    /** Barre : `hud.bar({ label: "Vie", value: 100, max: 100, color: "#22c55e" })` → `{ set, add, setMax, value, ratio }`. */
    bar: ({ position = "top-left", ...options } = {}) => place(createBar(options), position),
    /** Minuteur : `hud.timer({ countdown: 60, autoStart: true, onEnd })` → `{ start, stop, reset, addTime, time, remaining }`. */
    timer: ({ position = "top-center", ...options } = {}) => place(createTimer(game, options), position),
    /** Compteur de FPS (débogage). */
    fps: ({ position = "top-right" } = {}) => place(createFps(game), position),

    /** Réticule central : `hud.crosshair({ style: "dot" })` → `{ hit, show, hide }`. Un seul à la fois. */
    crosshair(options) {
      crosshair?.dispose()
      crosshair = track(createCrosshair(overlayLayer, options))
      return crosshair
    },
    /** Message bref empilé : `hud.toast("Pièce !", { kind: "success" })`. */
    toast: (text, options) => toasts.show(text, options),
    /** Grande bannière centrale : `hud.message("Niveau 2", { duration: 2 })`. */
    message: (text, options) => message.show(text, options),
    /** Flash sur les bords de l'écran : `hud.flash("#ef4444")` (dégât). */
    flash: (color, options) => flash.flash(color, options),

    /** Écran modal générique (titre, sous-titre, lignes, boutons). Masqué au départ. */
    screen: (options) => track(createScreen(game, screenLayer, options)),
    /** Écran titre, affiché tout de suite : `{ title, subtitle, button, onStart }`. */
    titleScreen: (options) => track(createTitleScreen(game, screenLayer, options)),
    /** Menu pause (met le jeu en pause à l'affichage) : `{ title, resumeLabel, buttons }`. */
    pauseMenu: (options) => track(createPauseMenu(game, screenLayer, options)),
    /** Écran de fin : `{ title, subtitle, lines, restartLabel, onRestart }`, puis `.show()`. */
    gameOverScreen: (options) => track(createGameOverScreen(game, screenLayer, options)),

    /**
     * Étiquette qui suit un objet 3D : `hud.attach(enemy, "Gobelin")`, ou un
     * élément HTML (`hud.attach(enemy, bar.el)` pour une barre de vie).
     */
    attach: (object, content, options) => world.attach(object, content, options),
    /** Texte qui monte depuis un point du monde : `hud.floatingText(pos, "-12", { color: "#f87171" })`. */
    floatingText: (position, text, options) => world.floatingText(position, text, options),
    /** Minimap : `hud.minimap({ target: player, points: () => enemies.map(e => ({ object: e })) })`. */
    minimap: ({ position = "top-right", ...options } = {}) => {
      const widget = createMinimap(game, slot(position), options)
      return track(widget)
    },

    show() {
      root.style.display = ""
    },
    hide() {
      root.style.display = "none"
    },
    dispose() {
      for (const widget of disposables) widget.dispose?.()
      root.remove()
    },
  }
}
