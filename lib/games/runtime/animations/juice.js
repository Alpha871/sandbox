import * as THREE from "three"

/**
 * Matériaux d'un objet, clonés une fois pour cet objet : plusieurs meshes
 * partagent souvent le même matériau, et faire clignoter l'un ferait
 * clignoter tous les autres.
 */
function ownMaterials(object) {
  const materials = []
  object.traverse((child) => {
    if (!child.isMesh) return
    if (!child.userData.__ownMaterial) {
      child.material = Array.isArray(child.material)
        ? child.material.map((m) => m.clone())
        : child.material.clone()
      child.userData.__ownMaterial = true
    }
    materials.push(...(Array.isArray(child.material) ? child.material : [child.material]))
  })
  return materials
}

/**
 * « Game feel » : de petites animations d'une ligne qui rendent un jeu vivant
 * (apparition qui rebondit, écrasement à l'atterrissage, flash de dégât…).
 * S'appuient sur `createTweens` et respectent donc la pause.
 *
 * @param {object} game
 * @param {ReturnType<import("./tween.js").createTweens>} tweens
 */
export function createJuice(game, tweens) {
  const _flash = new THREE.Color()

  return {
    /**
     * Apparition : l'objet grandit depuis `from` jusqu'à son échelle actuelle, avec rebond.
     * @param {{ duration?: number, from?: number, ease?: string, delay?: number }} [options]
     */
    popIn(object, { duration = 0.45, from = 0.001, ease = "outBack", delay = 0 } = {}) {
      const target = object.scale.clone()
      object.scale.setScalar(from)
      return tweens.to(object.scale, { x: target.x, y: target.y, z: target.z }, { duration, ease, delay })
    },

    /**
     * Disparition : l'objet rétrécit puis, avec `remove` (défaut), est retiré de la scène.
     * Renvoie le tween : `await juice.popOut(coin).finished`.
     */
    popOut(object, { duration = 0.25, remove = true, ease = "inBack" } = {}) {
      return tweens.to(object.scale, { x: 0.001, y: 0.001, z: 0.001 }, {
        duration,
        ease,
        onComplete: () => {
          if (remove) object.parent?.remove(object)
        },
      })
    },

    /**
     * Écrasement puis retour élastique (atterrissage, coup reçu, rebond).
     * `amount` > 0 écrase (large et bas) ; < 0 étire (haut et fin, décollage).
     */
    squash(object, { amount = 0.3, duration = 0.45 } = {}) {
      const base = object.userData.__baseScale ?? (object.userData.__baseScale = object.scale.clone())
      tweens.killTweensOf(object.scale)
      object.scale.set(base.x * (1 + amount), base.y * (1 - amount), base.z * (1 + amount))
      return tweens.to(object.scale, { x: base.x, y: base.y, z: base.z }, { duration, ease: "outElastic" })
    },

    /**
     * Flash de couleur sur l'objet entier (coup reçu, ramassage) : `color` puis retour à la normale.
     * Utilise l'émissif des matériaux qui en ont, sinon leur couleur.
     */
    hitFlash(object, { color = 0xffffff, duration = 0.18 } = {}) {
      const materials = ownMaterials(object)
      const targets = materials.map((material) => {
        const key = material.emissive ? "emissive" : "color"
        material.userData.__flashBase ??= { key, color: material[key].clone() }
        return material
      })
      object.userData.__hitFlash?.stop()
      _flash.set(color)
      const flashColor = _flash.clone()

      const handle = tweens.value(
        1,
        0,
        (k) => {
          for (const material of targets) {
            const { key, color: base } = material.userData.__flashBase
            material[key].copy(base).lerp(flashColor, k)
          }
        },
        { duration, ease: "linear" },
      )
      object.userData.__hitFlash = handle
      return handle
    },

    /** Petit saut sur place (joie, appel d'attention) : monte de `height` puis retombe. */
    hop(object, { height = 0.8, duration = 0.5 } = {}) {
      let last = 0
      return tweens.value(
        0,
        1,
        (t) => {
          const y = Math.sin(t * Math.PI) * height
          object.position.y += y - last
          last = y
        },
        { duration, ease: "linear" },
      )
    },

    /**
     * Fondu d'opacité vers `opacity` (0 = invisible). Avec `remove`, retire l'objet ensuite.
     * @param {{ duration?: number, remove?: boolean }} [options]
     */
    fadeTo(object, opacity, { duration = 0.4, remove = false } = {}) {
      const materials = ownMaterials(object)
      for (const material of materials) material.transparent = true
      const starts = materials.map((material) => material.opacity)
      return tweens.value(
        0,
        1,
        (t) => {
          materials.forEach((material, i) => {
            material.opacity = starts[i] + (opacity - starts[i]) * t
          })
        },
        {
          duration,
          ease: "linear",
          onComplete: () => {
            if (remove) object.parent?.remove(object)
          },
        },
      )
    },

    /**
     * Tremblement de l'objet (impact, peur, machine en surchauffe) : oscille en
     * position puis s'apaise. Additif, il laisse l'objet exactement où il était.
     */
    wobble(object, { amount = 0.12, duration = 0.35, frequency = 40 } = {}) {
      let lastX = 0
      let lastZ = 0
      return tweens.value(
        0,
        1,
        (t) => {
          const fade = 1 - t
          const x = Math.sin(t * frequency) * amount * fade
          const z = Math.cos(t * frequency * 1.3) * amount * fade
          object.position.x += x - lastX
          object.position.z += z - lastZ
          lastX = x
          lastZ = z
        },
        { duration, ease: "linear" },
      )
    },
  }
}
