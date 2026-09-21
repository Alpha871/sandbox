import * as THREE from "three"

import { el } from "./styles.js"

const _position = new THREE.Vector3()
const _projected = new THREE.Vector3()

/**
 * Projette un point monde à l'écran (pixels dans le conteneur du jeu).
 * `visible` est faux derrière la caméra ou hors du champ de profondeur.
 */
export function worldToScreen(game, worldPosition, target = { x: 0, y: 0, visible: true }) {
  _projected.copy(worldPosition).project(game.camera)
  target.x = (_projected.x * 0.5 + 0.5) * game.width
  target.y = (-_projected.y * 0.5 + 0.5) * game.height
  target.visible = _projected.z > -1 && _projected.z < 1
  return target
}

/**
 * Couche d'éléments HTML attachés à des points 3D : étiquettes qui suivent un
 * objet (nom, barre de vie d'ennemi) et textes flottants (dégâts, « +10 »).
 * Les positions sont recalculées après tous les `onUpdate`, donc collées à
 * l'objet déjà déplacé et à la caméra déjà placée.
 */
export function createWorldLayer(game, root) {
  const layer = el("div", "hud-world")
  root.append(layer)

  /** @type {Set<{ el: HTMLElement, object: any, offset: THREE.Vector3, maxDistance: number }>} */
  const labels = new Set()
  /** @type {Set<{ el: HTMLElement, position: THREE.Vector3, age: number, duration: number, rise: number }>} */
  const floats = new Set()
  const screen = { x: 0, y: 0, visible: true }

  const place = (node, worldPosition, extra = "") => {
    worldToScreen(game, worldPosition, screen)
    node.style.display = screen.visible ? "" : "none"
    node.style.transform = `translate(${screen.x.toFixed(1)}px, ${screen.y.toFixed(1)}px) translate(-50%, -100%)${extra}`
  }

  const off = game.onLateUpdate(() => {
    const dt = game.time.delta
    const camera = game.camera

    for (const label of labels) {
      label.object.getWorldPosition(_position).add(label.offset)
      const tooFar = _position.distanceTo(camera.position) > label.maxDistance
      if (tooFar) {
        label.el.style.display = "none"
        continue
      }
      place(label.el, _position)
    }

    for (const float of floats) {
      float.age += dt
      const t = Math.min(1, float.age / float.duration)
      if (t >= 1) {
        float.el.remove()
        floats.delete(float)
        continue
      }
      // Monte en ralentissant, et s'efface sur la seconde moitié.
      const eased = 1 - (1 - t) * (1 - t)
      place(float.el, float.position, ` translateY(${(-eased * float.rise).toFixed(1)}px)`)
      float.el.style.opacity = t < 0.5 ? "1" : String(1 - (t - 0.5) * 2)
    }
  })

  return {
    /**
     * Étiquette qui suit `object`.
     * `content` : texte, ou élément HTML (ex. `bar.el` pour une barre de vie).
     * @param {THREE.Object3D} object
     * @param {string | HTMLElement} content
     * @param {{ offset?: [number, number, number], maxDistance?: number }} [options]
     */
    attach(object, content, { offset = [0, 2, 0], maxDistance = Infinity } = {}) {
      const node = el("div", typeof content === "string" ? "hud-panel hud-label" : "")
      node.style.position = "absolute"
      node.style.left = "0"
      node.style.top = "0"
      if (typeof content === "string") node.textContent = content
      else node.append(content)
      layer.append(node)

      const label = { el: node, object, offset: new THREE.Vector3(...offset), maxDistance }
      labels.add(label)
      return {
        el: node,
        setText(text) {
          node.textContent = text
        },
        remove() {
          labels.delete(label)
          node.remove()
        },
      }
    },

    /**
     * Texte qui monte et s'efface à partir d'un point du monde. Suit le
     * temps de jeu : figé en pause.
     * @param {THREE.Vector3} position
     * @param {string} text
     * @param {{ color?: string, size?: number, duration?: number, rise?: number }} [options]
     */
    floatingText(position, text, { color = "#fff", size = 22, duration = 0.9, rise = 56 } = {}) {
      const node = el("div", "hud-float", text)
      node.style.color = color
      node.style.fontSize = `${size}px`
      layer.append(node)
      floats.add({ el: node, position: position.clone(), age: 0, duration, rise })
    },

    clear() {
      for (const label of labels) label.el.remove()
      for (const float of floats) float.el.remove()
      labels.clear()
      floats.clear()
    },
    dispose() {
      off()
      layer.remove()
    },
  }
}
