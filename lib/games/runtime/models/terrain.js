import * as THREE from "three"

import { createRandom } from "../engine/random.js"
import { clamp, lerp } from "../engine/math.js"
import { mat, toColor } from "./palette.js"
import { group, plane, sphere } from "./shapes.js"
import { checkerTexture } from "./textures.js"

// --- Bruit de valeur déterministe (mêmes coordonnées + même graine = même altitude) ---

const hash = (x, z, seed) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed | 0, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const fade = (t) => t * t * (3 - 2 * t)

function valueNoise(x, z, seed) {
  const x0 = Math.floor(x)
  const z0 = Math.floor(z)
  const fx = fade(x - x0)
  const fz = fade(z - z0)
  return lerp(
    lerp(hash(x0, z0, seed), hash(x0 + 1, z0, seed), fx),
    lerp(hash(x0, z0 + 1, seed), hash(x0 + 1, z0 + 1, seed), fx),
    fz,
  )
}

/** Bruit fractal ∈ [0, 1] : plusieurs octaves de bruit de valeur superposées. */
export function fbm(x, z, { seed = 1, octaves = 4 } = {}) {
  let amplitude = 0.5
  let frequency = 1
  let total = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    total += valueNoise(x * frequency, z * frequency, seed + i * 101) * amplitude
    norm += amplitude
    amplitude *= 0.5
    frequency *= 2
  }
  return total / norm
}

/** Sol plat. Avec `checker: [c1, c2]`, un damier de cases de `tileSize` mètres. */
export function createGround({ size = 200, color = "grass", checker = null, tileSize = 2 } = {}) {
  const ground = plane(size, size, { color, roughness: 1 })
  if (checker) {
    const texture = checkerTexture({ colors: checker, squares: 2, repeat: [size / (tileSize * 2), size / (tileSize * 2)] })
    ground.material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 })
  }
  ground.name = "ground"
  return ground
}

/**
 * Relief généré. Renvoie `{ mesh, heightAt(x, z), size }` : passer `heightAt`
 * comme `ground` de `createPhysics`, ou s'en servir pour poser des objets
 * (`tree.position.y = heightAt(x, z)`). La zone autour de l'origine est
 * aplatie sur `flatRadius` mètres, pour que le joueur apparaisse sur du plat.
 *
 * @param {object} [options]
 * @param {number} [options.size] Côté en mètres.
 * @param {number} [options.segments] Résolution (64 → 65×65 sommets).
 * @param {number} [options.height] Amplitude verticale.
 * @param {number} [options.frequency] Taille des reliefs : petit = collines larges.
 * @param {number} [options.seed] Même graine = même monde.
 * @param {number} [options.flatRadius]
 * @param {[number, string|number][]} [options.colors] Couleur par altitude normalisée : `[[0, "sand"], [0.3, "grass"], [1, "stone"]]`.
 */
export function createTerrain({
  size = 100,
  segments = 64,
  height = 6,
  frequency = 0.035,
  seed = 1,
  flatRadius = 8,
  colors = [
    [0, "sand"],
    [0.25, "grass"],
    [0.65, "forest"],
    [0.85, "stone"],
    [1, "white"],
  ],
} = {}) {
  const offset = seed * 37.7
  const heightAt = (x, z) => {
    const noise = fbm(x * frequency + offset, z * frequency + offset, { seed })
    const raw = (noise - 0.4) * 2 * height
    // Fondu vers 0 près de l'origine : une zone de départ plate.
    const t = clamp((Math.hypot(x, z) - flatRadius) / (flatRadius * 1.5), 0, 1)
    return raw * fade(t)
  }

  const geometry = new THREE.PlaneGeometry(size, size, segments, segments)
  geometry.rotateX(-Math.PI / 2)
  const positions = geometry.attributes.position
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < positions.count; i++) {
    const y = heightAt(positions.getX(i), positions.getZ(i))
    positions.setY(i, y)
    min = Math.min(min, y)
    max = Math.max(max, y)
  }

  const stops = colors.map(([at, color]) => [at, toColor(color)])
  const colorAttribute = new Float32Array(positions.count * 3)
  const tmp = new THREE.Color()
  for (let i = 0; i < positions.count; i++) {
    const t = max > min ? (positions.getY(i) - min) / (max - min) : 0
    let k = 0
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++
    const [a, ca] = stops[k]
    const [b, cb] = stops[k + 1]
    tmp.copy(ca).lerp(cb, clamp((t - a) / (b - a || 1), 0, 1))
    colorAttribute.set([tmp.r, tmp.g, tmp.b], i * 3)
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colorAttribute, 3))
  geometry.computeVertexNormals()

  const mesh = new THREE.Mesh(geometry, mat("white", { vertexColors: true, roughness: 1 }))
  mesh.receiveShadow = true
  mesh.name = "terrain"
  return { mesh, heightAt, size, min, max }
}

/**
 * Plan d'eau translucide qui ondule. `water.animate(time)` (temps de jeu total,
 * ex. `game.time.elapsed`) déplace les sommets ; sans appel, l'eau est calme.
 */
export function createWater({ size = 200, color = "water", y = 0, opacity = 0.75, segments = 40, wave = 0.12 } = {}) {
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments)
  geometry.rotateX(-Math.PI / 2)
  const positions = geometry.attributes.position
  const baseX = new Float32Array(positions.count)
  const baseZ = new Float32Array(positions.count)
  for (let i = 0; i < positions.count; i++) {
    baseX[i] = positions.getX(i)
    baseZ[i] = positions.getZ(i)
  }

  const water = new THREE.Mesh(geometry, mat(color, { opacity, roughness: 0.15, metalness: 0.1 }))
  water.position.y = y
  water.receiveShadow = true
  water.name = "water"
  water.animate = (time) => {
    for (let i = 0; i < positions.count; i++) {
      positions.setY(i, Math.sin(baseX[i] * 0.35 + time * 1.4) * wave + Math.cos(baseZ[i] * 0.3 + time * 1.1) * wave)
    }
    positions.needsUpdate = true
  }
  return water
}

/**
 * Ciel étoilé (jeux d'espace, scènes de nuit). Reste centré sur la caméra :
 * les étoiles sont donc toujours à l'infini, quel que soit le déplacement.
 */
export function createStars(game, { count = 1500, radius = 220, size = 1.6, color = "white" } = {}) {
  const rng = createRandom(7)
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    // Direction uniforme sur la sphère.
    const u = rng.next() * 2 - 1
    const angle = rng.next() * Math.PI * 2
    const r = Math.sqrt(1 - u * u)
    positions.set([Math.cos(angle) * r * radius, u * radius, Math.sin(angle) * r * radius], i * 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  const material = new THREE.PointsMaterial({
    color: toColor(color), size, sizeAttenuation: false, fog: false, depthWrite: false, transparent: true, opacity: 0.9,
  })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  points.renderOrder = -900
  points.name = "stars"
  const off = game.onLateUpdate(() => points.position.copy(game.camera.position))
  points.dispose = () => {
    off()
    points.parent?.remove(points)
    geometry.dispose()
    material.dispose()
  }
  return points
}

/**
 * Nuages low-poly qui dérivent le long de X et rebouclent. Demande le `game`
 * pour se mettre à jour ; `clouds.dispose()` les retire.
 */
export function createClouds(game, { count = 8, area = 160, height = 32, color = "white", speed = 1.5, seed = 3 } = {}) {
  const rng = createRandom(seed)
  const root = group([], { name: "clouds" })
  for (let i = 0; i < count; i++) {
    const cloud = group([], { position: [rng.range(-area / 2, area / 2), height + rng.range(-4, 6), rng.range(-area / 2, area / 2)] })
    const blobs = rng.int(3, 5)
    for (let b = 0; b < blobs; b++) {
      const r = rng.range(3, 6)
      cloud.add(sphere(r, { color, roughness: 1, opacity: 0.92, castShadow: false, receiveShadow: false, position: [(b - blobs / 2) * 4, rng.range(-0.5, 1), rng.range(-1.5, 1.5)], scale: [1.3, 0.75, 1] }))
    }
    root.add(cloud)
  }
  const off = game.onUpdate((dt) => {
    for (const cloud of root.children) {
      cloud.position.x += speed * dt
      if (cloud.position.x > area / 2) cloud.position.x -= area
    }
  })
  root.dispose = () => {
    off()
    root.parent?.remove(root)
  }
  return root
}

/**
 * Sème des objets au hasard sur une zone : forêt, rochers, herbes, pièces.
 * `factory(rng, index)` renvoie l'objet à poser (ou `null` pour l'ignorer).
 *
 * @param {(rng: ReturnType<typeof createRandom>, index: number) => THREE.Object3D | null} factory
 * @param {object} [options]
 * @param {number} [options.count]
 * @param {[number, number]} [options.area] Largeur et profondeur de la zone.
 * @param {[number, number]} [options.center] Centre `[x, z]`.
 * @param {number} [options.seed]
 * @param {number} [options.minDistance] Écart minimal entre deux objets (évite les chevauchements).
 * @param {(x: number, z: number) => number} [options.heightAt] Pose chaque objet sur le relief.
 * @param {{ x: number, z: number, radius: number }[]} [options.avoid] Zones à laisser vides (départ, maisons).
 * @param {[number, number]} [options.scale] Échelle aléatoire min/max.
 * @param {boolean} [options.rotate] Rotation aléatoire autour de Y.
 */
export function scatter(
  factory,
  { count = 20, area = [50, 50], center = [0, 0], seed, minDistance = 0, heightAt, avoid = [], scale = [0.8, 1.3], rotate = true } = {},
) {
  const rng = createRandom(seed)
  const root = group([], { name: "scatter" })
  const placed = []
  let attempts = 0
  const maxAttempts = count * 30

  while (placed.length < count && attempts++ < maxAttempts) {
    const x = center[0] + (rng.next() - 0.5) * area[0]
    const z = center[1] + (rng.next() - 0.5) * area[1]
    if (avoid.some((zone) => Math.hypot(x - zone.x, z - zone.z) < zone.radius)) continue
    if (minDistance > 0 && placed.some((p) => Math.hypot(x - p.x, z - p.z) < minDistance)) continue

    const object = factory(rng, placed.length)
    if (!object) continue
    object.position.set(x, heightAt ? heightAt(x, z) : 0, z)
    if (rotate) object.rotation.y = rng.next() * Math.PI * 2
    object.scale.multiplyScalar(rng.range(scale[0], scale[1]))
    root.add(object)
    placed.push({ x, z })
  }
  return root
}
