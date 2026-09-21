import * as THREE from "three"

import { shade } from "./palette.js"
import { box, capsule, cone, cylinder, group, mesh, sphere } from "./shapes.js"

/*
 * Véhicules. Avant vers +Z. Leur `animate(dt, …)` prend la vitesse pour faire
 * tourner roues et hélices.
 *
 * Origine : au sol pour la voiture (comme les personnages) ; **au centre de
 * l'engin** pour le vaisseau et l'avion, qui volent : c'est le pivot naturel
 * pour les incliner (`rotation.x` tangage, `rotation.z` roulis).
 */

/**
 * Voiture. `car.animate(dt, speed, steer)` : les roues roulent à `speed` (m/s,
 * négatif = marche arrière) et les roues avant braquent de `steer` radians
 * (typiquement ±0.5). Les phares s'allument avec `car.setLights(true)`.
 *
 * @param {{ color?: string|number, length?: number }} [options]
 * @returns {THREE.Group & { animate(dt: number, speed?: number, steer?: number): void, setLights(on: boolean): void }}
 */
export function car({ color = "red", length = 4 } = {}) {
  const s = length / 4
  const root = group([], { name: "car" })
  const wheelR = 0.38 * s
  const lift = wheelR

  root.add(box(1.8 * s, 0.55 * s, 4 * s, { color, metalness: 0.4, roughness: 0.35, position: [0, lift + 0.3 * s, 0] }))
  root.add(box(1.5 * s, 0.5 * s, 2 * s, { color: shade(color, 0.05), metalness: 0.3, roughness: 0.4, position: [0, lift + 0.8 * s, -0.25 * s] }))
  // Vitres : un bloc sombre légèrement plus large que la cabine.
  root.add(box(1.54 * s, 0.32 * s, 1.7 * s, { color: "navy", metalness: 0.6, roughness: 0.1, position: [0, lift + 0.83 * s, -0.25 * s] }))
  root.add(box(1.85 * s, 0.1 * s, 0.25 * s, { color: "dark", position: [0, lift + 0.08 * s, 2 * s] }))
  root.add(box(1.85 * s, 0.1 * s, 0.25 * s, { color: "dark", position: [0, lift + 0.08 * s, -2 * s] }))

  const lights = []
  for (const x of [-0.6, 0.6]) {
    const head = box(0.35 * s, 0.18 * s, 0.06 * s, { color: "cream", emissive: "yellow", emissiveIntensity: 0.1, position: [x * s, lift + 0.32 * s, 2.02 * s] })
    const tail = box(0.35 * s, 0.14 * s, 0.06 * s, { color: "crimson", emissive: "red", emissiveIntensity: 0.4, position: [x * s, lift + 0.36 * s, -2.02 * s] })
    root.add(head, tail)
    lights.push(head)
  }

  // Chaque roue : pivot de braquage (Y) > pivot de rotation (X) > cylindre couché.
  const wheels = []
  for (const [x, z, front] of [[-1, 1.25, true], [1, 1.25, true], [-1, -1.25, false], [1, -1.25, false]]) {
    const steerPivot = new THREE.Group()
    steerPivot.position.set(x * 0.95 * s, wheelR, z * s)
    const spinPivot = new THREE.Group()
    const tire = cylinder(wheelR, wheelR, 0.3 * s, { color: "black", roughness: 0.9, rotation: [0, 0, Math.PI / 2] })
    const hub = cylinder(wheelR * 0.5, wheelR * 0.5, 0.32 * s, { color: "silver", metalness: 0.8, roughness: 0.3, rotation: [0, 0, Math.PI / 2] })
    spinPivot.add(tire, hub)
    steerPivot.add(spinPivot)
    root.add(steerPivot)
    wheels.push({ steerPivot, spinPivot, front })
  }

  root.animate = (dt, speed = 0, steer = 0) => {
    for (const wheel of wheels) {
      // Un point de la jante parcourt `speed·dt` : angle = distance / rayon.
      wheel.spinPivot.rotation.x += (speed * dt) / wheelR
      if (wheel.front) wheel.steerPivot.rotation.y += (steer - wheel.steerPivot.rotation.y) * Math.min(1, dt * 12)
    }
  }
  root.setLights = (on) => {
    for (const light of lights) {
      light.material = light.material.clone()
      light.material.emissiveIntensity = on ? 2.5 : 0.1
    }
  }
  return root
}

/**
 * Vaisseau spatial, nez vers +Z, origine au centre. `ship.setThrust(0..1)` règle la flamme des
 * réacteurs, `ship.animate(dt)` la fait vaciller.
 *
 * @param {{ color?: string|number, glow?: string|number, size?: number }} [options]
 * @returns {THREE.Group & { animate(dt: number): void, setThrust(amount: number): void }}
 */
export function spaceship({ color = "silver", glow = "cyan", size = 1 } = {}) {
  const root = group([], { name: "spaceship" })
  const inner = group([], { scale: size })
  root.add(inner)

  // Fuselage : capsule couchée + nez conique.
  inner.add(capsule(0.35, 1.5, { color, metalness: 0.7, roughness: 0.3, rotation: [Math.PI / 2, 0, 0], position: [0, 0, -0.1] }))
  inner.add(cone(0.35, 0.9, { color: "orange", metalness: 0.5, roughness: 0.35, rotation: [Math.PI / 2, 0, 0], position: [0, 0, 1.4] }))
  inner.add(sphere(0.28, { color: glow, opacity: 0.7, roughness: 0.05, metalness: 0.2, emissive: glow, emissiveIntensity: 0.4, scale: [1, 0.8, 1.6], position: [0, 0.25, 0.4], flat: false }))

  // Ailes : deux prismes aplatis en flèche.
  for (const side of [-1, 1]) {
    const wing = new THREE.Shape()
    wing.moveTo(0, 0.5)
    wing.lineTo(1.5, -0.7)
    wing.lineTo(1.5, -1.1)
    wing.lineTo(0, -0.6)
    wing.closePath()
    const geometry = new THREE.ExtrudeGeometry(wing, { depth: 0.07, bevelEnabled: false })
    geometry.rotateX(Math.PI / 2)
    geometry.translate(0, 0.035, 0)
    const mirrored = side < 0
    if (mirrored) geometry.scale(-1, 1, 1)
    inner.add(mesh(geometry, { color: shade(color, -0.1), metalness: 0.6, roughness: 0.35, position: [side * 0.3, -0.05, -0.2], doubleSided: true }))
    inner.add(box(0.06, 0.4, 0.5, { color: "orange", position: [side * 1.7, 0.05, -0.85] }))
  }

  const flames = []
  for (const x of [-0.18, 0.18]) {
    inner.add(cylinder(0.14, 0.18, 0.3, { color: "dark", metalness: 0.7, rotation: [Math.PI / 2, 0, 0], position: [x, 0, -1.0] }))
    const flame = cone(0.13, 0.7, {
      color: glow, emissive: glow, emissiveIntensity: 2.2, unlit: true, castShadow: false,
      rotation: [-Math.PI / 2, 0, 0], position: [x, 0, -1.4],
    })
    inner.add(flame)
    flames.push(flame)
  }

  let thrust = 0.6
  let time = 0
  root.setThrust = (amount) => {
    thrust = THREE.MathUtils.clamp(amount, 0, 1)
  }
  root.animate = (dt) => {
    time += dt
    for (const [i, flame] of flames.entries()) {
      const flicker = 1 + Math.sin(time * 40 + i * 2) * 0.12
      flame.scale.set(1, Math.max(0.001, thrust * 1.4 * flicker), 1)
      flame.visible = thrust > 0.02
      flame.position.z = -1.05 - 0.35 * thrust * flicker
    }
  }
  root.animate(0)
  return root
}

/**
 * Avion à hélice, nez vers +Z, origine au centre. `plane.animate(dt, throttle)` fait tourner l'hélice
 * (`throttle` ∈ [0, 1]).
 *
 * @param {{ color?: string|number, size?: number }} [options]
 * @returns {THREE.Group & { animate(dt: number, throttle?: number): void }}
 */
export function airplane({ color = "blue", size = 1 } = {}) {
  const root = group([], { name: "airplane" })
  const inner = group([], { scale: size })
  root.add(inner)

  inner.add(capsule(0.3, 1.9, { color: "white", roughness: 0.4, rotation: [Math.PI / 2, 0, 0] }))
  inner.add(cone(0.3, 0.5, { color, rotation: [Math.PI / 2, 0, 0], position: [0, 0, 1.4] }))
  inner.add(box(3.6, 0.07, 0.7, { color, position: [0, -0.05, 0.1] }))
  inner.add(box(1.3, 0.06, 0.4, { color, position: [0, 0.05, -1.35] }))
  inner.add(box(0.06, 0.6, 0.5, { color, position: [0, 0.35, -1.3] }))
  inner.add(sphere(0.22, { color: "sky", opacity: 0.75, roughness: 0.05, scale: [1, 0.8, 1.4], position: [0, 0.25, 0.3], flat: false }))

  const propeller = new THREE.Group()
  propeller.position.set(0, 0, 1.68)
  propeller.add(box(1.4, 0.1, 0.03, { color: "dark" }), box(0.1, 1.4, 0.03, { color: "dark" }))
  propeller.add(sphere(0.09, { color: "gold", metalness: 0.7 }))
  inner.add(propeller)

  root.animate = (dt, throttle = 0.5) => {
    propeller.rotation.z += dt * (6 + throttle * 60)
  }
  return root
}
