import * as THREE from "three"

/**
 * Ambiances prêtes à l'emploi. `sky` : [zénith, horizon]. Le brouillard prend
 * la couleur de l'horizon pour que le décor lointain se fonde dans le ciel.
 *
 * Une ambiance doit rester *jouable* : les faces qui ne regardent pas le
 * soleil ne sont éclairées que par la lumière hémisphérique, qui compte pour
 * `intensité / π` dans Three.js. Réglées en mesurant le rendu réel : luminance
 * (sur 255) d'une boîte grise dont la face regarde la caméra, à l'opposé du
 * soleil pour `night` : jour 112, crépuscule 88, nuit 50, néon 44, espace 93.
 * Un preset dont cette valeur tombe sous ~40 est trop sombre pour jouer.
 */
export const ATMOSPHERES = {
  day: {
    sky: [0x3b82f6, 0xbfe3ff],
    fog: [0xbfe3ff, 40, 160],
    sun: { color: 0xfff1d6, intensity: 1.8, position: [30, 50, 20] },
    hemi: { sky: 0xd6ecff, ground: 0x9a8a6a, intensity: 2.2 },
  },
  sunset: {
    sky: [0x3b2a6b, 0xff8a4c],
    fog: [0xff9a5c, 30, 140],
    sun: { color: 0xffb070, intensity: 1.9, position: [-40, 14, 30] },
    hemi: { sky: 0xffb47a, ground: 0x7a5a76, intensity: 1.9 },
  },
  night: {
    sky: [0x03050f, 0x1b2a5e],
    fog: [0x0a1030, 25, 120],
    sun: { color: 0xb4c6ff, intensity: 1.6, position: [20, 40, -20] },
    hemi: { sky: 0x93a8f0, ground: 0x3a4478, intensity: 2.6 },
  },
  neon: {
    sky: [0x0a0014, 0x5a1a8a],
    fog: [0x1a0a30, 20, 100],
    sun: { color: 0xff5ad9, intensity: 1.6, position: [-20, 30, 20] },
    hemi: { sky: 0x6f8fff, ground: 0x3a0a55, intensity: 1.8 },
  },
  space: {
    sky: [0x000000, 0x05060f],
    fog: null,
    sun: { color: 0xffffff, intensity: 2.5, position: [50, 20, 30] },
    hemi: { sky: 0x334477, ground: 0x000000, intensity: 0.4 },
  },
}

/**
 * Ciel : un dôme dégradé (zénith → horizon) qui suit la caméra, donc jamais
 * atteint et sans coupure à l'horizon. Rendu en premier, sans profondeur.
 */
export function createSky(game, { top = 0x3b82f6, bottom = 0xbfe3ff, exponent = 0.8 } = {}) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(top) },
      uBottom: { value: new THREE.Color(bottom) },
      uExponent: { value: exponent },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uBottom;
      uniform float uExponent;
      varying vec3 vDirection;
      void main() {
        float t = pow(clamp(vDirection.y, 0.0, 1.0), uExponent);
        gl_FragColor = vec4(mix(uBottom, uTop, t), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })

  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), material)
  dome.name = "sky"
  dome.renderOrder = -1000
  dome.frustumCulled = false

  const update = () => {
    const camera = game.camera
    const radius = (camera.far ?? 500) * 0.9
    dome.scale.setScalar(radius)
    dome.position.copy(camera.position)
  }
  const unsubscribe = game.onUpdate(update)
  update()

  game.scene.background = null
  game.scene.add(dome)

  return {
    mesh: dome,
    setColors(nextTop, nextBottom) {
      material.uniforms.uTop.value.set(nextTop)
      material.uniforms.uBottom.value.set(nextBottom)
    },
    dispose() {
      unsubscribe()
      game.scene.remove(dome)
      dome.geometry.dispose()
      material.dispose()
    },
  }
}

/** Brouillard linéaire ; `setFog(game, null)` le retire. */
export function setFog(game, color, near = 30, far = 150) {
  game.scene.fog = color === null ? null : new THREE.Fog(color, near, far)
}

/**
 * Soleil (lumière directionnelle avec ombres) + lumière hémisphérique.
 * `follow(position)` recentre le soleil et sa zone d'ombre sur un point
 * (typiquement le joueur) : la carte d'ombre reste nette sur un grand monde.
 */
export function createLights(
  game,
  {
    sun: sunOptions = {},
    hemi: hemiOptions = {},
    shadowSize = 30,
    shadowMapSize = 2048,
  } = {},
) {
  const {
    color = 0xfff1d6,
    intensity = 2.2,
    position = [30, 50, 20],
  } = sunOptions
  const { sky = 0xbfe3ff, ground = 0x6b5b45, intensity: hemiIntensity = 0.9 } =
    hemiOptions

  const hemi = new THREE.HemisphereLight(sky, ground, hemiIntensity)
  const sun = new THREE.DirectionalLight(color, intensity)
  const offset = new THREE.Vector3(...position)
  sun.position.copy(offset)
  sun.castShadow = game.renderer.shadowMap.enabled

  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize)
  const cam = sun.shadow.camera
  cam.left = -shadowSize
  cam.right = shadowSize
  cam.top = shadowSize
  cam.bottom = -shadowSize
  cam.near = 1
  cam.far = offset.length() + shadowSize * 2
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.03

  game.scene.add(hemi, sun, sun.target)

  return {
    sun,
    hemi,
    follow(target) {
      sun.target.position.copy(target)
      sun.position.copy(target).add(offset)
    },
    dispose() {
      game.scene.remove(hemi, sun, sun.target)
      sun.shadow.map?.dispose()
    },
  }
}

/**
 * Pose une ambiance complète (ciel, brouillard, lumières) en un appel.
 * `preset` : nom d'`ATMOSPHERES` ou objet de même forme.
 * @returns {{ sky, sun, hemi, follow, setPreset, dispose }}
 */
export function createEnvironment(game, preset = "day", options = {}) {
  const resolve = (value) =>
    typeof value === "string" ? (ATMOSPHERES[value] ?? ATMOSPHERES.day) : value

  const atmosphere = resolve(preset)
  const sky = createSky(game, {
    top: atmosphere.sky[0],
    bottom: atmosphere.sky[1],
  })
  const lights = createLights(game, {
    sun: atmosphere.sun,
    hemi: atmosphere.hemi,
    ...options,
  })
  applyFog(game, atmosphere)

  return {
    sky,
    sun: lights.sun,
    hemi: lights.hemi,
    follow: lights.follow,
    /** Change d'ambiance sans recréer les objets. */
    setPreset(next) {
      const value = resolve(next)
      sky.setColors(value.sky[0], value.sky[1])
      lights.sun.color.set(value.sun.color)
      lights.sun.intensity = value.sun.intensity
      lights.hemi.color.set(value.hemi.sky)
      lights.hemi.groundColor.set(value.hemi.ground)
      lights.hemi.intensity = value.hemi.intensity
      applyFog(game, value)
    },
    dispose() {
      sky.dispose()
      lights.dispose()
      setFog(game, null)
    },
  }
}

function applyFog(game, atmosphere) {
  if (atmosphere.fog) setFog(game, ...atmosphere.fog)
  else setFog(game, null)
}
