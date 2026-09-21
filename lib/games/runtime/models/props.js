import * as THREE from "three"

import { createRandom } from "../engine/random.js"
import { mat, shade } from "./palette.js"
import { box, cone, cylinder, group, mesh, sphere, torus } from "./shapes.js"
import { textTexture } from "./textures.js"

/*
 * Décors et objets. Conventions : origine au centre du SOL de l'objet (il se
 * pose à y = 0), face avant vers +Z, unités en mètres. Les paramètres
 * `seed` rendent les variations aléatoires reproductibles.
 */

/** Petite variation de teinte, pour que deux arbres ne soient pas identiques. */
const vary = (color, rng, amount = 0.12) => shade(color, (rng.next() - 0.5) * 2 * amount)

/**
 * Arbre. `variant` : `"round"` (feuillu, défaut), `"pine"` (sapin) ou `"tall"`.
 * @param {{ height?: number, trunk?: string|number, leaves?: string|number, variant?: "round"|"pine"|"tall", seed?: number }} [options]
 */
export function tree({ height = 4, trunk = "wood", leaves, variant = "round", seed } = {}) {
  const rng = createRandom(seed)
  const root = group([], { name: `tree-${variant}` })
  const foliage = leaves ?? (variant === "pine" ? "forest" : "grass")
  const trunkH = height * (variant === "pine" ? 0.3 : 0.4)
  const trunkR = height * 0.045

  root.add(cylinder(trunkR * 0.8, trunkR, trunkH, { color: trunk, position: [0, trunkH / 2, 0] }))

  if (variant === "pine") {
    const layers = 4
    for (let i = 0; i < layers; i++) {
      const t = i / layers
      const radius = height * 0.26 * (1 - t * 0.7)
      const layerH = height * 0.32
      root.add(cone(radius, layerH, { color: vary(foliage, rng), position: [0, trunkH * 0.6 + t * height * 0.55 + layerH / 2, 0] }))
    }
  } else {
    const blobs = variant === "tall" ? 3 : 4
    const spread = height * (variant === "tall" ? 0.06 : 0.14)
    for (let i = 0; i < blobs; i++) {
      const r = height * (variant === "tall" ? 0.17 : 0.22) * (i === 0 ? 1.15 : 0.85 + rng.next() * 0.2)
      const y = trunkH + r * 0.6 + (variant === "tall" ? i * height * 0.14 : (i === 0 ? 0 : rng.next() * height * 0.15))
      const angle = rng.next() * Math.PI * 2
      root.add(
        mesh(new THREE.IcosahedronGeometry(r, 1), {
          color: vary(foliage, rng),
          position: [i === 0 ? 0 : Math.cos(angle) * spread, y, i === 0 ? 0 : Math.sin(angle) * spread],
        }),
      )
    }
  }
  return root
}

/** Rocher irrégulier posé au sol : `size` ≈ rayon. Reproductible avec `seed`. */
export function rock({ size = 1, color = "stone", seed } = {}) {
  const rng = createRandom(seed)
  const salt = rng.next() * 1000
  const geometry = new THREE.IcosahedronGeometry(size, 1)
  const positions = geometry.attributes.position
  // Décalage déterministe *par position* : les sommets partagés entre plusieurs
  // faces bougent ensemble, sinon le rocher se déchire.
  const hash = (x, y, z) => {
    const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + salt) * 43758.5453
    return n - Math.floor(n)
  }
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const y = positions.getY(i)
    const z = positions.getZ(i)
    const k = 1 + (hash(x, y, z) - 0.5) * 0.45
    positions.setXYZ(i, x * k, y * k * 0.7, z * k)
  }
  geometry.computeBoundingBox()
  geometry.translate(0, -geometry.boundingBox.min.y, 0)
  geometry.computeVertexNormals()
  return group([mesh(geometry, { color: vary(color, rng, 0.08), roughness: 0.95 })], { name: "rock" })
}

/** Buisson rond. */
export function bush({ size = 1, color = "forest", seed } = {}) {
  const rng = createRandom(seed)
  const root = group([], { name: "bush" })
  for (let i = 0; i < 3; i++) {
    const r = size * (0.32 + rng.next() * 0.12)
    root.add(mesh(new THREE.IcosahedronGeometry(r, 1), {
      color: vary(color, rng),
      // Aplatie à 85 % et posée à 0.85·r : le dessous touche exactement le sol.
      scale: [1, 0.85, 1],
      position: [(i - 1) * size * 0.3, r * 0.85, (rng.next() - 0.5) * size * 0.25],
    }))
  }
  return root
}

/** Fleur : tige, cœur et pétales. */
export function flower({ color = "pink", height = 0.5 } = {}) {
  const root = group([], { name: "flower" })
  root.add(cylinder(0.012, 0.015, height, { color: "green", position: [0, height / 2, 0] }))
  root.add(sphere(height * 0.1, { color: "yellow", position: [0, height, 0] }))
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2
    root.add(sphere(height * 0.09, {
      color,
      position: [Math.cos(angle) * height * 0.15, height, Math.sin(angle) * height * 0.15],
      scale: [1, 0.5, 1],
    }))
  }
  return root
}

/** Champignon rouge à pois. */
export function mushroom({ size = 0.5, color = "red" } = {}) {
  const root = group([], { name: "mushroom" })
  root.add(cylinder(size * 0.14, size * 0.18, size * 0.55, { color: "cream", position: [0, size * 0.275, 0] }))
  const cap = new THREE.SphereGeometry(size * 0.42, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)
  root.add(mesh(cap, { color, position: [0, size * 0.5, 0], flat: false }))
  for (const [x, z] of [[0.16, 0.12], [-0.15, 0.1], [0.02, -0.2]]) {
    root.add(sphere(size * 0.06, { color: "white", position: [x * size * 1.4, size * 0.83, z * size * 1.4], scale: [1, 0.4, 1] }))
  }
  return root
}

/**
 * Maison à toit à deux pans, porte et fenêtres. La façade (porte) regarde +Z.
 * @param {{ width?: number, depth?: number, height?: number, wall?: string|number, roof?: string|number }} [options]
 */
export function house({ width = 6, depth = 5, height = 3, wall = "sand", roof = "crimson" } = {}) {
  const root = group([], { name: "house" })
  root.add(box(width, height, depth, { color: wall, position: [0, height / 2, 0] }))

  // Toit : triangle extrudé sur la profondeur, avec un léger débord.
  const roofH = height * 0.55
  const overhang = 0.35
  const shape = new THREE.Shape()
  shape.moveTo(-width / 2 - overhang, 0)
  shape.lineTo(width / 2 + overhang, 0)
  shape.lineTo(0, roofH)
  shape.closePath()
  const roofGeometry = new THREE.ExtrudeGeometry(shape, { depth: depth + overhang * 2, bevelEnabled: false })
  roofGeometry.translate(0, height, -depth / 2 - overhang)
  root.add(mesh(roofGeometry, { color: roof }))

  const doorH = Math.min(height * 0.7, 2.1)
  root.add(box(1.1, doorH, 0.12, { color: "brown", position: [0, doorH / 2, depth / 2 + 0.03] }))
  root.add(sphere(0.06, { color: "gold", position: [0.35, doorH * 0.48, depth / 2 + 0.1] }))

  const windowOptions = { color: "cream", emissive: "amber", emissiveIntensity: 0.5 }
  for (const x of [-width * 0.3, width * 0.3]) {
    root.add(box(0.9, 0.9, 0.1, { ...windowOptions, position: [x, height * 0.6, depth / 2 + 0.03] }))
  }
  for (const side of [-1, 1]) {
    root.add(box(0.1, 0.9, 0.9, { ...windowOptions, position: [side * (width / 2 + 0.03), height * 0.6, 0] }))
  }
  root.add(box(0.6, height * 0.5, 0.6, { color: "stone", position: [width * 0.28, height + roofH * 0.55, -depth * 0.2] }))
  return root
}

/** Tronçon de clôture en bois, le long de l'axe X. */
export function fence({ length = 4, height = 1, color = "wood" } = {}) {
  const root = group([], { name: "fence" })
  const posts = Math.max(2, Math.round(length / 1.2) + 1)
  for (let i = 0; i < posts; i++) {
    const x = -length / 2 + (i / (posts - 1)) * length
    root.add(box(0.14, height, 0.14, { color, position: [x, height / 2, 0] }))
  }
  for (const y of [height * 0.35, height * 0.75]) {
    root.add(box(length, 0.1, 0.06, { color: shade(color, 0.1), position: [0, y, 0] }))
  }
  return root
}

/** Caisse en bois cerclée de cadres : `size` = côté. */
export function crate({ size = 1, color = "wood" } = {}) {
  const root = group([], { name: "crate" })
  const frame = shade(color, -0.3)
  root.add(box(size, size, size, { color, position: [0, size / 2, 0] }))
  const t = size * 0.1
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    root.add(box(t, size * 1.01, t, { color: frame, position: [x * (size / 2 - t / 2), size / 2, z * (size / 2 - t / 2)] }))
  }
  for (const y of [t / 2, size - t / 2]) {
    root.add(box(size * 1.01, t, size * 1.01, { color: frame, position: [0, y, 0] }))
  }
  return root
}

/** Tonneau cerclé de deux bandes métalliques. */
export function barrel({ radius = 0.4, height = 1, color = "wood" } = {}) {
  const root = group([], { name: "barrel" })
  root.add(cylinder(radius * 0.88, radius * 0.88, height, { color, position: [0, height / 2, 0] }))
  root.add(cylinder(radius, radius, height * 0.5, { color, position: [0, height / 2, 0] }))
  for (const y of [height * 0.22, height * 0.78]) {
    root.add(mesh(new THREE.TorusGeometry(radius * 0.94, 0.03, 6, 20), {
      color: "dark", metalness: 0.7, rotation: [Math.PI / 2, 0, 0], position: [0, y, 0],
    }))
  }
  return root
}

/**
 * Pièce d'or, de face vers +Z, flottant à `lift` mètres du sol. Pour la faire
 * tourner : `animator.spin(coin, { speed: 3 })` ; pour la faire flotter : `animator.float(coin)`.
 */
export function coin({ radius = 0.35, lift = 0.8, color = "gold" } = {}) {
  const root = group([], { name: "coin" })
  const disc = cylinder(radius, radius, radius * 0.22, {
    color, metalness: 0.9, roughness: 0.25, emissive: color, emissiveIntensity: 0.35,
    rotation: [Math.PI / 2, 0, 0], position: [0, lift, 0],
  })
  const rim = mesh(new THREE.TorusGeometry(radius * 0.82, radius * 0.06, 6, 20), {
    color: shade(color, 0.25), metalness: 0.9, roughness: 0.3, position: [0, lift, 0],
  })
  root.add(disc, rim)
  return root
}

/** Gemme facettée lumineuse. */
export function gem({ size = 0.4, color = "cyan", lift = 0.8 } = {}) {
  return group([
    mesh(new THREE.OctahedronGeometry(size, 0), {
      color, roughness: 0.15, metalness: 0.3, emissive: color, emissiveIntensity: 0.6,
      scale: [1, 1.4, 1], position: [0, lift, 0],
    }),
  ], { name: "gem" })
}

/** Cœur (vie, soin), extrudé, de face vers +Z. */
export function heart({ size = 0.5, color = "red", lift = 0.8 } = {}) {
  const shape = new THREE.Shape()
  const steps = 48
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2
    // Courbe paramétrique classique du cœur, ramenée à ~1 de large.
    const x = (16 * Math.sin(t) ** 3) / 32
    const y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 32
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 })
  geometry.center()
  return group([
    mesh(geometry, { color, roughness: 0.3, emissive: color, emissiveIntensity: 0.3, scale: size * 1.6, position: [0, lift, 0] }),
  ], { name: "heart" })
}

/** Étoile à cinq branches extrudée, de face vers +Z. */
export function star({ size = 0.5, color = "yellow", lift = 0.8 } = {}) {
  const shape = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 + Math.PI / 2
    const radius = i % 2 === 0 ? 0.5 : 0.22
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)
  }
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 })
  geometry.center()
  return group([
    mesh(geometry, { color, metalness: 0.4, roughness: 0.3, emissive: color, emissiveIntensity: 0.5, scale: size * 2, position: [0, lift, 0] }),
  ], { name: "star" })
}

/**
 * Coffre au trésor. `chest.setOpen(0..1)` ouvre le couvercle (à animer avec un tween).
 * @returns {THREE.Group & { setOpen(amount: number): void, lid: THREE.Object3D }}
 */
export function chest({ width = 1.1, depth = 0.7, color = "wood" } = {}) {
  const root = group([], { name: "chest" })
  const baseH = 0.55
  root.add(box(width, baseH, depth, { color, position: [0, baseH / 2, 0] }))
  for (const x of [-1, 1]) {
    root.add(box(0.1, baseH * 1.02, depth * 1.02, { color: "dark", metalness: 0.6, position: [x * width * 0.38, baseH / 2, 0] }))
  }
  // Le couvercle pivote autour de son arête arrière.
  const lid = new THREE.Group()
  lid.position.set(0, baseH, -depth / 2)
  const lidH = 0.25
  lid.add(box(width, lidH, depth, { color: shade(color, 0.08), position: [0, lidH / 2, depth / 2] }))
  lid.add(box(0.14, 0.2, 0.06, { color: "gold", metalness: 0.9, roughness: 0.3, position: [0, 0.03, depth + 0.02] }))
  root.add(lid)
  root.lid = lid
  root.setOpen = (amount) => {
    lid.rotation.x = -THREE.MathUtils.clamp(amount, 0, 1) * 1.9
  }
  return root
}

/**
 * Lampadaire. Avec `light: true`, il éclaire vraiment (une `PointLight`) :
 * utile la nuit, mais chaque lumière a un coût, à limiter à quelques-unes.
 */
export function lampPost({ height = 3.2, color = "amber", light = false, intensity = 30, distance = 14 } = {}) {
  const root = group([], { name: "lamp" })
  root.add(cylinder(0.05, 0.08, height, { color: "dark", metalness: 0.6, position: [0, height / 2, 0] }))
  root.add(cylinder(0.2, 0.12, 0.14, { color: "dark", position: [0, 0.07, 0] }))
  root.add(sphere(0.2, { color, emissive: color, emissiveIntensity: 2, unlit: false, position: [0, height, 0], flat: false }))
  if (light) {
    const bulb = new THREE.PointLight(mat(color).color, intensity, distance, 2)
    bulb.position.set(0, height, 0)
    root.add(bulb)
    root.light = bulb
  }
  return root
}

/**
 * Plateforme : boîte avec un dessus d'une autre couleur. **Origine au centre
 * du dessous** : le dessus est à `y = size[1]`, ce qui simplifie le placement d'un sol de niveau.
 * @param {{ size?: [number, number, number], color?: string|number, top?: string|number|null }} [options]
 */
export function platform({ size = [4, 0.6, 4], color = "brown", top = "grass" } = {}) {
  const [w, h, d] = size
  const root = group([], { name: "platform" })
  root.add(box(w, h, d, { color, position: [0, h / 2, 0] }))
  if (top) root.add(box(w * 1.02, Math.min(0.18, h * 0.3), d * 1.02, { color: top, position: [0, h - Math.min(0.18, h * 0.3) / 2, 0] }))
  return root
}

/** Rangée de pointes dangereuses. */
export function spikes({ count = 4, size = 0.4, color = "silver" } = {}) {
  const root = group([], { name: "spikes" })
  const total = count * size * 1.4
  root.add(box(total, 0.1, size * 1.6, { color: "dark", position: [0, 0.05, 0] }))
  for (let i = 0; i < count; i++) {
    root.add(cone(size * 0.5, size * 1.6, { color, metalness: 0.7, roughness: 0.3, position: [(i - (count - 1) / 2) * size * 1.4, 0.1 + size * 0.8, 0] }))
  }
  return root
}

/**
 * Drapeau. `flag.animate(dt)` le fait flotter (arrivée, checkpoint, base).
 * @returns {THREE.Group & { animate(dt: number): void }}
 */
export function flag({ height = 3, color = "red" } = {}) {
  const root = group([], { name: "flag" })
  root.add(cylinder(0.04, 0.05, height, { color: "silver", metalness: 0.6, position: [0, height / 2, 0] }))
  root.add(sphere(0.08, { color: "gold", metalness: 0.8, position: [0, height + 0.04, 0] }))
  const banner = box(1.1, 0.7, 0.03, { color, position: [0.6, height - 0.45, 0] })
  root.add(banner)
  let time = 0
  root.animate = (dt) => {
    time += dt
    banner.rotation.y = Math.sin(time * 3) * 0.18
    banner.position.x = 0.6 * Math.cos(banner.rotation.y)
  }
  return root
}

/**
 * Portail lumineux (sortie, téléporteur), de face vers +Z. `portal.animate(dt)` fait
 * tourner et pulser l'intérieur.
 * @returns {THREE.Group & { animate(dt: number): void }}
 */
export function portal({ radius = 1.2, color = "purple" } = {}) {
  const root = group([], { name: "portal" })
  const centerY = radius * 1.1 // rayon + épaisseur du tube : la base touche le sol
  root.add(torus(radius, radius * 0.1, { color, emissive: color, emissiveIntensity: 1.2, position: [0, centerY, 0] }))
  const disc = mesh(new THREE.CircleGeometry(radius * 0.92, 24), {
    color, emissive: color, emissiveIntensity: 0.9, opacity: 0.55, doubleSided: true, unlit: false,
    position: [0, centerY, 0], castShadow: false,
  })
  root.add(disc)
  let time = 0
  root.animate = (dt) => {
    time += dt
    disc.rotation.z += dt * 1.5
    disc.scale.setScalar(1 + Math.sin(time * 3) * 0.04)
  }
  return root
}

/**
 * Panneau planté dans le sol avec un texte. Le texte regarde +Z.
 * Nécessite un navigateur (le texte est dessiné sur un canvas).
 */
export function sign({ text = "Hello", width = 2, height = 1, color = "wood", textColor = "white", background = "dark" } = {}) {
  const root = group([], { name: "sign" })
  const postH = height + 0.8
  root.add(cylinder(0.06, 0.06, postH, { color, position: [0, postH / 2, 0] }))
  const texture = textTexture(text, { color: textColor, background, width: 512, height: Math.round(512 * (height / width)) })
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 })
  const board = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.08), [
    mat(color), mat(color), mat(color), mat(color), material, mat(color),
  ])
  board.position.set(0, postH - height / 2 + 0.05, 0.06)
  board.castShadow = true
  root.add(board)
  return root
}
