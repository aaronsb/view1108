// The high tier's post chain: MSAA HDR render -> ambient occlusion -> tone mapping -> bloom -> sRGB.
// Screens are not tone mapped. A material with toneMapped false (a screen showing the plot or the source) writes
// alpha 0 (markScreens), and the tone pass mixes ACES by alpha, so a screen keeps the page's own colours and the
// handover's crossfade does not shift them (the approach of progression's src/render/display/display.ts, MIT).
// The low tier renders straight to the canvas with the renderer's ACES, which skips such materials by itself.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

export const EXPOSURE = 1.0;
const BLOOM = 0.22;

const ToneShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, exposure: { value: EXPOSURE } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float exposure;
    varying vec2 vUv;
    vec3 RRTAndODTFit(vec3 v) {
      vec3 a = v * (v + 0.0245786) - 0.000090537;
      vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
      return a / b;
    }
    vec3 aces(vec3 c) {   // three's ACESFilmicToneMapping
      const mat3 inM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
      const mat3 outM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
      c *= exposure / 0.6;
      return clamp(outM * RRTAndODTFit(inM * c), 0.0, 1.0);
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(mix(c.rgb, aces(c.rgb), clamp(c.a, 0.0, 1.0)), 1.0);
    }`,
};

/** Make every toneMapped-false material under `root` write alpha 0 and ignore the fog (see the head comment). */
export function markScreens(root: THREE.Object3D): void {
  root.traverse(o => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!m) return;
    for (const x of Array.isArray(m) ? m : [m]) {
      if (x.toneMapped !== false || x.userData.screen) continue;
      x.userData.screen = true;
      (x as THREE.MeshBasicMaterial).fog = false;
      const prev = x.onBeforeCompile;
      x.onBeforeCompile = (s, r) => {
        prev.call(x, s, r);
        s.fragmentShader = s.fragmentShader.replace(/}\s*$/, "  gl_FragColor.a = 0.0;\n}");
      };
      x.customProgramCacheKey = () => "screen";
      x.needsUpdate = true;
    }
  });
}

export class Post {
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private tone: ShaderPass;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    const size = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio();
    const target = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(size.x, size.y);
    this.composer.addPass(new RenderPass(scene, camera));
    const ao = new GTAOPass(scene, camera, size.x * pr, size.y * pr);
    ao.updateGtaoMaterial({ radius: 0.35, samples: 12, distanceExponent: 1, thickness: 1, scale: 1 });
    ao.blendIntensity = 0.8;
    this.composer.addPass(ao);
    this.tone = new ShaderPass(ToneShader);
    this.composer.addPass(this.tone);
    this.bloom = new UnrealBloomPass(size.clone(), BLOOM, 0.45, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());   // sRGB only: the renderer's tone mapping is off in this tier
  }

  /** Bloom strength as a fraction of its usual (the handover turns it down near a screen, as the page has none of ours). */
  set glow(f: number) { this.bloom.strength = BLOOM * f; }

  /** The tone pass's exposure (the lights' level; lighting.ts). */
  set exposure(v: number) { this.tone.uniforms.exposure.value = v; }

  setSize(w: number, h: number): void {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  render(): void { this.composer.render(); }

  dispose(): void {
    for (const p of this.composer.passes) p.dispose();
    this.composer.dispose();
  }
}
