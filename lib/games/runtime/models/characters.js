import * as THREE from "three"

import { damp } from "../engine/math.js"
import { mat, shade } from "./palette.js"
import { box, cone, cylinder, group, sphere } from "./shapes.js"

/*
 * Conventions de tous les personnages :
 *   - origine aux PIEDS, l'objet se pose sur le sol à y = 0 ;
 *   - le personnage regarde vers +Z (comme les contrôleurs de `controls/`) ;
 *   - `animate(dt, speed, …)` joue une animation procédurale (marche, respiration…)
 *     sans modèle squeletté : passer la vitesse horizontale (`controller.speed`).
 */

/** Membre articulé : pivot au joint, mesh qui pend dessous (tourner `pivot.rotation.x` pour balancer). */
function limb(width, length, depth, color, { position }) {
  const pivot = new THREE.Group()
  pivot.position.set(...position)
  pivot.add(box(width, length, depth, { color, position: [0, -length / 2, 0] }))
  return pivot
}

/**
 * Personnage bipède : `style: "human"` (cheveux, chapeau optionnel) ou
 * `"robot"` (métal, visière lumineuse, antenne).
 *
 * @param {object} [options]
 * @param {number} [options.height] Hauteur totale en mètres (défaut : 1.8).
 * @param {"human"|"robot"} [options.style]
 * @param {string|number} [options.shirt] Haut / corps du robot.
 * @param {string|number} [options.pants] Bas.
 * @param {string|number} [options.skin] Peau (humain) ou tête (robot).
 * @param {string|number|null} [options.hair] Couleur des cheveux ; `null` = chauve.
 * @param {string|number|null} [options.hat] Couleur d'une casquette ; `null` = aucune.
 * @param {string|number} [options.accent] Visière et détails lumineux du robot.
 *
 * @returns {THREE.Group & {
 *   parts: Record<string, THREE.Object3D>,
 *   animate(dt: number, speed?: number, state?: { grounded?: boolean, walkSpeed?: number }): void,
 *   attack(): void,
 * }}
 */
export function createCharacter({
  height = 1.8,
  style = "human",
  shirt = "orange",
  pants = "navy",
  skin = "skin",
  hair = "brown",
  hat = null,
  accent = "cyan",
} = {}) {
  const robot = style === "robot"
  const h = height
  const legLen = 0.46 * h
  const torsoH = 0.3 * h
  const torsoW = 0.27 * h
  const torsoD = 0.15 * h
  const headR = 0.12 * h
  const legW = 0.11 * h
  const armW = 0.085 * h
  const armLen = 0.3 * h

  const metal = robot ? { metalness: 0.6, roughness: 0.35 } : {}

  const root = group([], { name: robot ? "robot" : "character" })

  // Tronc et tête sont dans `upper` : il oscille à la marche sans bouger les pieds.
  const upper = new THREE.Group()
  upper.name = "upper"
  root.add(upper)

  const torso = box(torsoW, torsoH, torsoD, { color: shirt, position: [0, legLen + torsoH / 2, 0], ...metal })
  upper.add(torso)

  // --- Tête ---
  const head = new THREE.Group()
  head.name = "head"
  head.position.set(0, legLen + torsoH + headR * 0.85, 0)
  upper.add(head)

  if (robot) {
    head.add(
      box(headR * 2, headR * 1.6, headR * 1.8, { color: skin === "skin" ? "silver" : skin, ...metal }),
      box(headR * 1.5, headR * 0.5, 0.02 * h, {
        color: "black",
        emissive: accent,
        emissiveIntensity: 1.6,
        position: [0, headR * 0.1, headR * 0.91],
        name: "visor",
      }),
      cylinder(0.008 * h, 0.008 * h, headR * 0.8, { color: "gray", position: [0, headR * 1.1, 0] }),
      sphere(0.03 * h, { color: accent, emissive: accent, emissiveIntensity: 1.4, position: [0, headR * 1.55, 0] }),
    )
    torso.add(
      box(torsoW * 0.35, torsoW * 0.35, 0.02 * h, {
        color: accent,
        emissive: accent,
        emissiveIntensity: 1.2,
        position: [0, torsoH * 0.12, torsoD / 2 + 0.005 * h],
      }),
    )
  } else {
    head.add(sphere(headR, { color: skin, roughness: 0.9 }))
    for (const side of [-1, 1]) {
      head.add(
        sphere(0.014 * h, { color: "black", position: [side * headR * 0.36, headR * 0.05, headR * 0.93] }),
      )
    }
    if (hair !== null) {
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(headR * 1.07, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        mat(hair),
      )
      // Ni cheveux ni casquette ne projettent d'ombre : elle noircirait le visage juste dessous.
      cap.castShadow = false
      cap.position.set(0, headR * 0.05, -headR * 0.08)
      head.add(cap)
    }
    if (hat !== null) {
      const domeMesh = new THREE.Mesh(
        new THREE.SphereGeometry(headR * 1.12, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
        mat(hat),
      )
      domeMesh.castShadow = false
      domeMesh.position.set(0, headR * 0.12, 0)
      head.add(domeMesh, box(headR * 1.5, 0.012 * h, headR * 0.9, { color: hat, position: [0, headR * 0.15, headR * 1.0] }))
    }
  }

  // --- Membres ---
  const hipX = torsoW * 0.26
  const shoulderX = torsoW / 2 + armW / 2 + 0.005 * h
  const shoulderY = legLen + torsoH - 0.035 * h
  const armColor = robot ? shade(shirt, -0.15) : shirt

  const legL = limb(legW, legLen, legW * 1.1, pants, { position: [hipX, legLen, 0] })
  const legR = limb(legW, legLen, legW * 1.1, pants, { position: [-hipX, legLen, 0] })
  const armL = limb(armW, armLen, armW * 1.1, armColor, { position: [shoulderX, shoulderY, 0] })
  const armR = limb(armW, armLen, armW * 1.1, armColor, { position: [-shoulderX, shoulderY, 0] })
  root.add(legL, legR)
  upper.add(armL, armR)
  // Mains / pieds : petits blocs au bout des membres.
  const handColor = robot ? "gray" : skin
  for (const arm of [armL, armR]) arm.add(box(armW * 1.05, armW * 1.05, armW * 1.05, { color: handColor, position: [0, -armLen, 0] }))
  for (const leg of [legL, legR]) leg.add(box(legW * 1.05, legW * 0.7, legW * 1.7, { color: "dark", position: [0, -legLen + legW * 0.35, legW * 0.3] }))

  // --- Animation procédurale ---
  const state = { phase: 0, time: 0, attack: 0 }
  const ATTACK_DURATION = 0.35

  root.parts = { root, upper, torso, head, legL, legR, armL, armR }

  root.animate = (dt, speed = 0, { grounded = true, walkSpeed = 3 } = {}) => {
    state.time += dt
    const amount = Math.min(1, speed / walkSpeed)
    // La cadence s'accélère avec la vitesse, pour que les pieds ne « patinent » pas.
    state.phase += dt * (5 + speed * 1.4) * (amount > 0.02 ? 1 : 0)

    const swing = Math.sin(state.phase) * 0.85 * amount
    let legTargetL = swing
    let legTargetR = -swing
    let armTargetL = -swing * 0.9
    let armTargetR = swing * 0.9
    if (!grounded) {
      // En l'air : jambes légèrement repliées, bras levés.
      legTargetL = 0.5
      legTargetR = -0.3
      armTargetL = armTargetR = -2.4
    }
    if (state.attack > 0) {
      state.attack = Math.max(0, state.attack - dt)
      const progress = 1 - state.attack / ATTACK_DURATION
      armTargetR = -Math.PI * 0.55 - Math.sin(progress * Math.PI) * 0.9
    }

    const k = 1 - Math.exp(-22 * dt)
    legL.rotation.x += (legTargetL - legL.rotation.x) * k
    legR.rotation.x += (legTargetR - legR.rotation.x) * k
    armL.rotation.x += (armTargetL - armL.rotation.x) * k
    armR.rotation.x += (armTargetR - armR.rotation.x) * k

    // Rebond du buste au rythme des pas ; respiration à l'arrêt.
    const bob = Math.abs(Math.sin(state.phase)) * 0.025 * h * amount
    const breath = Math.sin(state.time * 2.2) * 0.004 * h * (1 - amount)
    upper.position.y = damp(upper.position.y, bob + breath, 30, dt)
    upper.rotation.y = Math.sin(state.phase) * 0.08 * amount
  }

  /** Coup de bras vers l'avant (attaque, lancer, interaction). */
  root.attack = () => {
    state.attack = ATTACK_DURATION
  }

  return root
}

/**
 * Slime / gelée : boule translucide qui rebondit, un ennemi ou une mascotte
 * facile à animer. `animate(dt, speed)` la fait sautiller quand elle avance.
 *
 * @param {{ color?: string|number, size?: number }} [options] `size` : rayon en mètres.
 */
export function createSlime({ color = "green", size = 0.5 } = {}) {
  const root = group([], { name: "slime" })
  const body = sphere(size, {
    color,
    roughness: 0.15,
    opacity: 0.88,
    emissive: color,
    emissiveIntensity: 0.15,
    flat: false,
  })
  body.scale.set(1, 0.8, 1)
  body.position.y = size * 0.8
  root.add(body)

  const eyes = group([], { position: [0, size * 0.95, size * 0.82] })
  for (const side of [-1, 1]) {
    eyes.add(
      sphere(size * 0.17, { color: "white", position: [side * size * 0.32, 0, 0], flat: false }),
      sphere(size * 0.08, { color: "black", position: [side * size * 0.32, 0, size * 0.12], flat: false }),
    )
  }
  root.add(eyes)

  let time = Math.random() * 10
  root.parts = { root, body, eyes }
  root.animate = (dt, speed = 0) => {
    time += dt
    const moving = Math.min(1, speed / 2)
    // Idle : respiration lente. En mouvement : saut, écrasé à l'atterrissage, étiré en l'air.
    const hop = Math.abs(Math.sin(time * 5)) * moving
    const idle = Math.sin(time * 2) * 0.04 * (1 - moving)
    const stretch = 1 + hop * 0.18 - (1 - Math.min(1, hop * 4)) * 0.16 * moving + idle
    body.scale.set(1 / Math.sqrt(stretch), 0.8 * stretch, 1 / Math.sqrt(stretch))
    root.position.y = hop * size * 0.9
    eyes.position.y = size * 0.95 * stretch
  }
  return root
}

/**
 * Animal à quatre pattes : `type` = `"dog"`, `"cat"`, `"cow"` ou `"pig"`.
 * `animate(dt, speed)` fait marcher en diagonale et remue la queue.
 *
 * @param {{ type?: "dog"|"cat"|"cow"|"pig", color?: string|number, size?: number }} [options]
 *   `size` : échelle globale (1 ≈ un chien de taille moyenne, 0.6 m au garrot).
 */
export function createQuadruped({ type = "dog", color, size = 1 } = {}) {
  const defaults = { dog: "wood", cat: "orange", cow: "white", pig: "pink" }
  const fur = color ?? defaults[type] ?? "wood"
  const darker = shade(fur, -0.3)
  const s = size
  const legLen = 0.32 * s
  const bodyH = 0.34 * s

  const root = group([], { name: type })
  const upper = new THREE.Group()
  root.add(upper)

  upper.add(box(0.36 * s, bodyH, 0.85 * s, { color: fur, position: [0, legLen + bodyH / 2, 0] }))
  if (type === "cow") {
    for (const [x, y, z] of [[0.181, 0.1, 0.1], [-0.181, 0.05, -0.2], [0.181, 0.08, -0.25]]) {
      upper.add(box(0.02 * s, 0.16 * s, 0.22 * s, { color: "black", position: [x * s, legLen + bodyH / 2 + y * s, z * s] }))
    }
  }

  const head = new THREE.Group()
  head.position.set(0, legLen + bodyH * 0.95, 0.5 * s)
  upper.add(head)
  head.add(box(0.28 * s, 0.26 * s, 0.28 * s, { color: fur }))
  for (const side of [-1, 1]) {
    head.add(sphere(0.022 * s, { color: "black", position: [side * 0.09 * s, 0.04 * s, 0.14 * s] }))
  }
  const snoutColor = type === "pig" ? shade("pink", -0.15) : type === "cow" ? "pink" : darker
  head.add(box(0.14 * s, 0.1 * s, 0.12 * s, { color: snoutColor, position: [0, -0.05 * s, 0.18 * s] }))
  if (type === "cat") {
    for (const side of [-1, 1]) head.add(cone(0.05 * s, 0.11 * s, { color: fur, position: [side * 0.09 * s, 0.17 * s, 0] }))
  } else if (type === "cow") {
    for (const side of [-1, 1]) {
      head.add(cone(0.03 * s, 0.12 * s, { color: "cream", position: [side * 0.13 * s, 0.17 * s, 0], rotation: [0, 0, -side * 0.5] }))
      head.add(box(0.1 * s, 0.05 * s, 0.06 * s, { color: darker, position: [side * 0.19 * s, 0.06 * s, 0] }))
    }
  } else {
    for (const side of [-1, 1]) {
      head.add(box(0.05 * s, type === "dog" ? 0.16 * s : 0.08 * s, 0.1 * s, {
        color: type === "dog" ? darker : shade(fur, -0.1),
        position: [side * 0.15 * s, type === "dog" ? -0.02 * s : 0.13 * s, -0.02 * s],
      }))
    }
  }

  const tail = new THREE.Group()
  tail.position.set(0, legLen + bodyH * 0.85, -0.42 * s)
  tail.add(box(0.05 * s, 0.05 * s, 0.24 * s, { color: type === "pig" ? "pink" : darker, position: [0, 0.06 * s, -0.1 * s], rotation: [0.5, 0, 0] }))
  upper.add(tail)

  const legs = {}
  for (const [name, x, z] of [["fl", 1, 1], ["fr", -1, 1], ["bl", 1, -1], ["br", -1, -1]]) {
    const leg = limb(0.12 * s, legLen, 0.12 * s, darker, { position: [x * 0.13 * s, legLen, z * 0.3 * s] })
    root.add(leg)
    legs[name] = leg
  }

  const state = { phase: 0, time: 0 }
  root.parts = { root, upper, head, tail, ...legs }
  root.animate = (dt, speed = 0) => {
    state.time += dt
    const amount = Math.min(1, speed / 3)
    state.phase += dt * (6 + speed * 1.5) * (amount > 0.02 ? 1 : 0)
    const swing = Math.sin(state.phase) * 0.7 * amount
    const k = 1 - Math.exp(-22 * dt)
    // Allure au trot : pattes opposées en diagonale.
    legs.fl.rotation.x += (swing - legs.fl.rotation.x) * k
    legs.br.rotation.x += (swing - legs.br.rotation.x) * k
    legs.fr.rotation.x += (-swing - legs.fr.rotation.x) * k
    legs.bl.rotation.x += (-swing - legs.bl.rotation.x) * k
    upper.position.y = Math.abs(Math.sin(state.phase)) * 0.02 * s * amount
    tail.rotation.y = Math.sin(state.time * (4 + amount * 6)) * 0.45
    head.rotation.x = Math.sin(state.time * 1.5) * 0.04
  }
  return root
}
