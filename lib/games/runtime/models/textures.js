import * as THREE from "three"

import { toColor } from "./palette.js"

const css = (color) => `#${toColor(color).getHexString()}`

/**
 * Texture dessinée à la volée sur un canvas 2D : aucun fichier image à
 * embarquer. `draw(ctx, size)` reçoit le contexte 2D et la taille en pixels.
 *
 * @param {number} size Côté en pixels (puissance de 2 conseillée pour la répétition).
 * @param {(ctx: CanvasRenderingContext2D, width: number, height: number) => void} draw
 * @param {{ repeat?: [number, number], pixelated?: boolean, width?: number, height?: number }} [options]
 *   `pixelated` : pixels francs, sans lissage (style rétro).
 */
export function drawTexture(size, draw, { repeat, pixelated = false, width = size, height = size } = {}) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext("2d"), width, height)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  if (repeat) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(...repeat)
  }
  if (pixelated) {
    texture.magFilter = THREE.NearestFilter
    texture.minFilter = THREE.NearestFilter
  }
  return texture
}

/**
 * Damier : sol, plateau d'échecs, cases de jeu. `squares` : nombre de cases par côté
 * de la texture ; combiner avec `repeat` pour couvrir une grande surface.
 */
export function checkerTexture({ colors = ["white", "dark"], squares = 8, size = 256, repeat } = {}) {
  return drawTexture(
    size,
    (ctx, w, h) => {
      const cell = w / squares
      for (let y = 0; y < squares; y++) {
        for (let x = 0; x < squares; x++) {
          ctx.fillStyle = css(colors[(x + y) % 2])
          ctx.fillRect(x * cell, y * cell, cell, cell)
        }
      }
    },
    { repeat, pixelated: true },
  )
}

/** Quadrillage : sol de prototypage, cartes, terrain de sport. */
export function gridTexture({ background = "dark", line = "gray", cells = 8, size = 256, lineWidth = 2, repeat } = {}) {
  return drawTexture(
    size,
    (ctx, w, h) => {
      ctx.fillStyle = css(background)
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = css(line)
      ctx.lineWidth = lineWidth
      const cell = w / cells
      for (let i = 0; i <= cells; i++) {
        ctx.beginPath()
        ctx.moveTo(i * cell, 0)
        ctx.lineTo(i * cell, h)
        ctx.moveTo(0, i * cell)
        ctx.lineTo(w, i * cell)
        ctx.stroke()
      }
    },
    { repeat },
  )
}

/** Dégradé linéaire (ciel, lueur, barre) : `stops` = `[[0, "orange"], [1, "purple"]]`. */
export function gradientTexture({ stops = [[0, "orange"], [1, "purple"]], vertical = true, size = 256 } = {}) {
  return drawTexture(size, (ctx, w, h) => {
    const gradient = vertical ? ctx.createLinearGradient(0, 0, 0, h) : ctx.createLinearGradient(0, 0, w, 0)
    for (const [offset, color] of stops) gradient.addColorStop(offset, css(color))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)
  })
}

/** Bruit de grain autour d'une couleur (sol, pierre, papier) : `strength` ∈ [0, 1]. */
export function noiseTexture({ color = "gray", strength = 0.25, size = 128, repeat } = {}) {
  return drawTexture(
    size,
    (ctx, w, h) => {
      ctx.fillStyle = css(color)
      ctx.fillRect(0, 0, w, h)
      const image = ctx.getImageData(0, 0, w, h)
      for (let i = 0; i < image.data.length; i += 4) {
        const delta = (Math.random() - 0.5) * 255 * strength
        image.data[i] += delta
        image.data[i + 1] += delta
        image.data[i + 2] += delta
      }
      ctx.putImageData(image, 0, 0)
    },
    { repeat, pixelated: true },
  )
}

/**
 * Texte sur fond : enseignes, panneaux, étiquettes, écrans dans le monde 3D.
 * Le canvas fait `width × height` pixels ; la taille de police s'adapte à la hauteur.
 */
export function textTexture(
  text,
  { color = "white", background = null, font = "system-ui, sans-serif", weight = 700, width = 512, height = 256, padding = 24 } = {},
) {
  return drawTexture(
    width,
    (ctx, w, h) => {
      if (background !== null) {
        ctx.fillStyle = css(background)
        ctx.fillRect(0, 0, w, h)
      }
      ctx.fillStyle = css(color)
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      // Réduit la police jusqu'à ce que la ligne tienne dans la largeur.
      let fontSize = h * 0.6
      do {
        ctx.font = `${weight} ${fontSize}px ${font}`
        fontSize -= 4
      } while (ctx.measureText(text).width > w - padding * 2 && fontSize > 8)
      ctx.fillText(text, w / 2, h / 2)
    },
    { width, height },
  )
}
