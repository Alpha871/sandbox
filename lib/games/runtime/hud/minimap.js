import { el } from "./styles.js"

/**
 * Minimap circulaire vue du dessus, centrée sur `target`. Le haut de la carte
 * est -Z (comme le haut de l'écran en vue du dessus). Un point hors de portée
 * est collé au bord, atténué : il indique la direction à suivre.
 *
 * @param {object} game
 * @param {HTMLElement} parent Zone du HUD qui reçoit la carte.
 * @param {object} options
 * @param {{ position: import("three").Vector3 }} options.target Le joueur (centre).
 * @param {() => { position?: import("three").Vector3, object?: any, color?: string, radius?: number }[]} [options.points]
 *   Appelée à chaque frame : ennemis, objectifs, pièces… (`object` = un Object3D, suivi).
 * @param {number} [options.range] Rayon du monde affiché, en unités.
 * @param {number} [options.size] Diamètre en pixels.
 * @param {string} [options.playerColor]
 */
export function createMinimap(
  game,
  parent,
  { target, points = () => [], range = 30, size = 140, playerColor = "#ea580c" } = {},
) {
  const node = el("div", "hud-panel hud-minimap")
  node.style.width = node.style.height = `${size}px`
  node.style.borderRadius = "50%"
  const canvas = document.createElement("canvas")
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = canvas.height = size * ratio
  canvas.style.width = canvas.style.height = `${size}px`
  node.append(canvas)
  parent.append(node)

  const g = canvas.getContext("2d")
  g.scale(ratio, ratio)
  const half = size / 2

  const off = game.onLateUpdate(() => {
    g.clearRect(0, 0, size, size)
    const scale = (half - 6) / range

    // Anneaux de repère : rendent la distance lisible.
    g.strokeStyle = "rgba(255,255,255,0.12)"
    g.lineWidth = 1
    for (const fraction of [0.5, 1]) {
      g.beginPath()
      g.arc(half, half, (half - 6) * fraction, 0, Math.PI * 2)
      g.stroke()
    }

    const center = target.position
    for (const point of points()) {
      const position = point.position ?? point.object?.position
      if (!position) continue
      let dx = (position.x - center.x) * scale
      let dy = (position.z - center.z) * scale
      let alpha = 1
      const distance = Math.hypot(dx, dy)
      const edge = half - 6
      if (distance > edge) {
        dx = (dx / distance) * edge
        dy = (dy / distance) * edge
        alpha = 0.45
      }
      g.globalAlpha = alpha
      g.fillStyle = point.color ?? "#ef4444"
      g.beginPath()
      g.arc(half + dx, half + dy, point.radius ?? 3, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 1

    g.fillStyle = playerColor
    g.strokeStyle = "#fff"
    g.lineWidth = 2
    g.beginPath()
    g.arc(half, half, 5, 0, Math.PI * 2)
    g.fill()
    g.stroke()
  })

  return {
    el: node,
    /** Change le rayon du monde affiché (zoom). */
    setRange(next) {
      range = next
    },
    dispose() {
      off()
      node.remove()
    },
  }
}
