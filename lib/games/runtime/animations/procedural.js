import * as THREE from "three"

const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) }

/**
 * Comportements continus qui s'ajoutent à un objet : il tourne, flotte, pulse…
 * en permanence. Chacun renvoie `{ stop() }` qui retire l'effet *et* remet
 * l'objet comme avant (un objet qui flottait redescend à sa hauteur d'origine).
 *
 * Les effets sont additifs : un objet peut flotter *et* tourner, et rester
 * déplacé par ailleurs (par un contrôleur, une physique) sans conflit, car ils
 * n'écrivent que leur propre variation.
 *
 * Chaque comportement a sa propre horloge, alimentée par le temps de jeu :
 * ils s'arrêtent donc en pause.
 */
export function createProcedural(game) {
  function run(update, cleanup, { late = false } = {}) {
    const register = late ? game.onLateUpdate : game.onUpdate
    const off = register.call(game, update)
    return {
      stop() {
        off()
        cleanup?.()
      },
    }
  }

  return {
    /**
     * Rotation continue. `speed` en radians/s (2π ≈ un tour par seconde).
     * @param {THREE.Object3D} object
     * @param {{ axis?: "x"|"y"|"z", speed?: number }} [options]
     */
    spin(object, { axis = "y", speed = 1 } = {}) {
      return run((dt) => object.rotateOnAxis(AXES[axis], speed * dt))
    },

    /**
     * Flottement vertical en sinusoïde (pièces, bonus, objets à ramasser).
     * @param {{ amplitude?: number, speed?: number, phase?: number }} [options]
     */
    float(object, { amplitude = 0.25, speed = 2, phase = Math.random() * Math.PI * 2 } = {}) {
      let t = phase
      let offset = 0
      return run(
        (dt) => {
          t += dt * speed
          const next = Math.sin(t) * amplitude
          object.position.y += next - offset
          offset = next
        },
        () => {
          object.position.y -= offset
          offset = 0
        },
      )
    },

    /**
     * Pulsation d'échelle (battement, alerte, objet précieux).
     * @param {{ amount?: number, speed?: number, phase?: number }} [options] `amount` : fraction (0.1 = ±10 %).
     */
    pulse(object, { amount = 0.08, speed = 3, phase = 0 } = {}) {
      let t = phase
      let factor = 1
      return run(
        (dt) => {
          t += dt * speed
          const next = 1 + Math.sin(t) * amount
          object.scale.multiplyScalar(next / factor)
          factor = next
        },
        () => {
          object.scale.multiplyScalar(1 / factor)
          factor = 1
        },
      )
    },

    /**
     * Fait tourner l'objet autour d'un point ou d'un autre objet (planète,
     * satellite, ennemi qui rôde). Écrit la position : ne pas le combiner avec un contrôleur.
     * @param {{ center?: THREE.Vector3 | THREE.Object3D, radius?: number, speed?: number, height?: number, phase?: number }} [options]
     */
    orbit(object, { center = new THREE.Vector3(), radius = 3, speed = 1, height = 0, phase = 0 } = {}) {
      let angle = phase
      return run((dt) => {
        angle += dt * speed
        const origin = center.isObject3D ? center.position : center
        object.position.set(
          origin.x + Math.cos(angle) * radius,
          origin.y + height,
          origin.z + Math.sin(angle) * radius,
        )
      })
    },

    /**
     * Scintillement de l'intensité d'une lumière ou d'un matériau (torche,
     * néon défaillant). `target` : tout objet avec une propriété `intensity`
     * (lumière) ou `emissiveIntensity` (matériau).
     * @param {{ amount?: number, speed?: number }} [options] `amount` : fraction de l'intensité de base.
     */
    flicker(target, { amount = 0.3, speed = 14 } = {}) {
      const key = "intensity" in target ? "intensity" : "emissiveIntensity"
      const base = target[key]
      let t = Math.random() * 100
      return run(
        (dt) => {
          t += dt * speed
          const noise = Math.sin(t) * 0.5 + Math.sin(t * 2.7 + 1.3) * 0.3 + Math.sin(t * 6.1 + 4.1) * 0.2
          target[key] = base * (1 + noise * amount)
        },
        () => {
          target[key] = base
        },
      )
    },

    /**
     * Tourne l'objet face à la caméra (plan portant une texture, étiquette 3D,
     * sprite). Appliqué après les contrôleurs pour suivre la caméra déjà placée.
     */
    billboard(object) {
      return run(() => object.quaternion.copy(game.camera.quaternion), null, { late: true })
    },

    /**
     * Suit une cible en douceur (compagnon, projectile à tête chercheuse).
     * `lambda` : plus grand = colle davantage. Indépendant du framerate.
     * @param {THREE.Object3D} object
     * @param {THREE.Object3D | THREE.Vector3} target
     * @param {{ lambda?: number, offset?: [number, number, number] }} [options]
     */
    follow(object, target, { lambda = 5, offset = [0, 0, 0] } = {}) {
      const goal = new THREE.Vector3()
      return run((dt) => {
        const source = target.isObject3D ? target.position : target
        goal.set(source.x + offset[0], source.y + offset[1], source.z + offset[2])
        object.position.lerp(goal, 1 - Math.exp(-lambda * dt))
      })
    },
  }
}
