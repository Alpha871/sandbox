import * as THREE from "three"

/** Disque doux généré à la volée : évite les carrés de `PointsMaterial`. */
function createDiscTexture() {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 64
  const g = canvas.getContext("2d")
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, "rgba(255,255,255,1)")
  gradient.addColorStop(0.4, "rgba(255,255,255,0.6)")
  gradient.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = gradient
  g.fillRect(0, 0, 64, 64)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const _color = new THREE.Color()
const PARKED = 1e6

/**
 * Système de particules (un seul `Points`, donc un seul draw call) : étincelles,
 * explosions, poussière, traînées. Mélange additif : les particules
 * s'éteignent en tirant leur couleur vers le noir, et brillent avec le bloom.
 *
 * @param {object} game Résultat de `createGame`.
 * @param {{ max?: number, size?: number }} [options] `size` en unités monde.
 */
export function createParticles(game, { max = 800, size = 0.35 } = {}) {
  const positions = new Float32Array(max * 3).fill(PARKED)
  const colors = new Float32Array(max * 3)
  const velocities = new Float32Array(max * 3)
  const base = new Float32Array(max * 3)
  const life = new Float32Array(max)
  const lifespan = new Float32Array(max).fill(1)
  const gravity = new Float32Array(max)
  let cursor = 0

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))

  const texture = createDiscTexture()
  const material = new THREE.PointsMaterial({
    size,
    map: texture,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  points.renderOrder = 10
  game.scene.add(points)

  const unsubscribe = game.onUpdate((dt) => {
    for (let i = 0; i < max; i++) {
      if (life[i] <= 0) continue
      life[i] -= dt
      const i3 = i * 3
      if (life[i] <= 0) {
        positions[i3] = positions[i3 + 1] = positions[i3 + 2] = PARKED
        colors[i3] = colors[i3 + 1] = colors[i3 + 2] = 0
        continue
      }
      velocities[i3 + 1] -= gravity[i] * dt
      positions[i3] += velocities[i3] * dt
      positions[i3 + 1] += velocities[i3 + 1] * dt
      positions[i3 + 2] += velocities[i3 + 2] * dt
      const fade = life[i] / lifespan[i]
      colors[i3] = base[i3] * fade
      colors[i3 + 1] = base[i3 + 1] * fade
      colors[i3 + 2] = base[i3 + 2] * fade
    }
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.color.needsUpdate = true
  })

  const system = {
    points,

    /**
     * @param {object} options
     * @param {THREE.Vector3} options.position Origine.
     * @param {number} [options.count]
     * @param {number|string} [options.color]
     * @param {number} [options.speed] Vitesse moyenne, en unités/s.
     * @param {number} [options.life] Durée de vie moyenne, en secondes.
     * @param {number} [options.gravity] Accélération vers le bas.
     * @param {THREE.Vector3} [options.direction] Si fourni, jet orienté ; sinon sphère.
     * @param {number} [options.spread] Ouverture du jet (0 à 1) avec `direction`.
     */
    emit({
      position,
      count = 20,
      color = 0xffffff,
      speed = 4,
      life: duration = 0.7,
      gravity: g = 0,
      direction = null,
      spread = 0.5,
    }) {
      _color.set(color)
      for (let n = 0; n < count; n++) {
        const i = cursor
        cursor = (cursor + 1) % max
        const i3 = i * 3

        // Direction aléatoire uniforme sur la sphère, ou autour de `direction`.
        let x = Math.random() * 2 - 1
        let y = Math.random() * 2 - 1
        let z = Math.random() * 2 - 1
        if (direction) {
          x = direction.x + x * spread
          y = direction.y + y * spread
          z = direction.z + z * spread
        }
        const length = Math.hypot(x, y, z) || 1
        const v = speed * (0.5 + Math.random() * 0.5)

        positions[i3] = position.x
        positions[i3 + 1] = position.y
        positions[i3 + 2] = position.z
        velocities[i3] = (x / length) * v
        velocities[i3 + 1] = (y / length) * v
        velocities[i3 + 2] = (z / length) * v
        base[i3] = colors[i3] = _color.r
        base[i3 + 1] = colors[i3 + 1] = _color.g
        base[i3 + 2] = colors[i3 + 2] = _color.b
        lifespan[i] = life[i] = duration * (0.6 + Math.random() * 0.8)
        gravity[i] = g
      }
    },

    /** Explosion : grosse gerbe orange. */
    explosion(position, { color = 0xff8a3c, count = 60, speed = 9 } = {}) {
      system.emit({ position, count, color, speed, life: 0.8, gravity: 6 })
      system.emit({ position, count: count / 2, color: 0xffe08a, speed: speed * 0.5, life: 0.5 })
    },
    /** Étincelles : petit jet vers le haut (impact, ramassage). */
    sparks(position, { color = 0xffe08a, count = 14 } = {}) {
      system.emit({
        position,
        count,
        color,
        speed: 5,
        life: 0.45,
        gravity: 12,
        direction: new THREE.Vector3(0, 1, 0),
        spread: 1,
      })
    },
    /** Poussière : nuage lent (atterrissage, dérapage). */
    dust(position, { color = 0xcbb89a, count = 8 } = {}) {
      system.emit({ position, count, color, speed: 1.5, life: 0.6, direction: new THREE.Vector3(0, 0.3, 0), spread: 1 })
    },

    clear() {
      life.fill(0)
      positions.fill(PARKED)
      colors.fill(0)
    },
    dispose() {
      unsubscribe()
      game.scene.remove(points)
      geometry.dispose()
      material.dispose()
      texture.dispose()
    },
  }

  return system
}
