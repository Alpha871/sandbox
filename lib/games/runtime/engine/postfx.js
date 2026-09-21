import * as THREE from "three"
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js"
import { RenderPass } from "three/addons/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js"
import { OutputPass } from "three/addons/postprocessing/OutputPass.js"

/**
 * Post-traitement : rendu de la scène, bloom, puis OutputPass (tone mapping +
 * sRGB). Le composer reçoit une cible multi-échantillonnée, sinon
 * l'antialiasing du renderer serait perdu dès que le bloom est actif.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {{ strength?: number, radius?: number, threshold?: number }} [bloom]
 */
export function createPostFx(renderer, scene, camera, bloom = {}) {
  const size = renderer.getSize(new THREE.Vector2())
  const pixelRatio = renderer.getPixelRatio()

  const target = new THREE.WebGLRenderTarget(
    size.x * pixelRatio,
    size.y * pixelRatio,
    { type: THREE.HalfFloatType, samples: 4 },
  )

  const composer = new EffectComposer(renderer, target)
  const renderPass = new RenderPass(scene, camera)
  const bloomPass = new UnrealBloomPass(
    size,
    bloom.strength ?? 0.6,
    bloom.radius ?? 0.5,
    bloom.threshold ?? 0.85,
  )
  const outputPass = new OutputPass()

  composer.addPass(renderPass)
  composer.addPass(bloomPass)
  composer.addPass(outputPass)
  composer.setSize(size.x, size.y)

  return {
    composer,
    renderPass,
    bloomPass,
    /** À appeler quand la caméra est remplacée (`game.camera = ...`). */
    setCamera(nextCamera) {
      renderPass.camera = nextCamera
    },
    setSize(width, height) {
      composer.setPixelRatio(renderer.getPixelRatio())
      composer.setSize(width, height)
    },
    render(delta) {
      composer.render(delta)
    },
    dispose() {
      composer.dispose()
      target.dispose()
    },
  }
}
