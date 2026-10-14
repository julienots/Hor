import * as THREE from 'three';

// Post-traitement plein écran : grain, vignette, aberration chromatique,
// lignes de balayage et parasites pour les caméras, vision nocturne, flash.
export function createPost(renderer) {
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 0 });
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: rt.texture },
      uTime: { value: 0 },
      uCam: { value: 0 },
      uStatic: { value: 0 },
      uNight: { value: 0 },
      uFlash: { value: 0 },
      uDark: { value: 0 },
      uAberr: { value: 0.0015 },
      uVignette: { value: 1.0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uLooped: { value: 0 },
      uRed: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tDiffuse;
      uniform float uTime, uCam, uStatic, uNight, uFlash, uDark, uAberr, uVignette, uLooped, uRed;
      uniform vec2 uRes;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec2 uv = vUv;
        // légère distorsion en barillet pour les caméras
        if (uCam > 0.5) {
          vec2 c = uv - 0.5;
          uv = 0.5 + c * (1.0 + 0.08 * dot(c, c));
          // décalage horizontal de lignes lors des parasites
          float band = step(0.985 - uStatic * 0.2, hash(vec2(floor(uv.y * 80.0), floor(uTime * 20.0))));
          uv.x += band * (hash(vec2(uTime, uv.y)) - 0.5) * 0.06;
        }
        float ab = uAberr * (1.0 + uCam * 2.0 + uStatic * 6.0);
        vec3 col;
        col.r = texture2D(tDiffuse, uv + vec2(ab, 0.0)).r;
        col.g = texture2D(tDiffuse, uv).g;
        col.b = texture2D(tDiffuse, uv - vec2(ab, 0.0)).b;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = vec3(0.0);
        // vision nocturne (conduits)
        if (uNight > 0.5) {
          float l = dot(col, vec3(0.3, 0.59, 0.11));
          col = vec3(0.15, 1.0, 0.35) * pow(l * 2.2, 0.8);
        }
        if (uCam > 0.5) {
          float l = dot(col, vec3(0.3, 0.59, 0.11));
          col = mix(col, vec3(l) * vec3(0.85, 0.95, 1.05), 0.35); // désaturation légère
          col *= 0.9 + 0.1 * sin(uv.y * uRes.y * 1.4);           // lignes de balayage
          col *= 0.97 + 0.03 * sin(uTime * 60.0);                 // scintillement
          if (uLooped > 0.5) col *= vec3(1.0, 0.98, 0.94);
        }
        // parasites / neige
        float n = hash(uv * uRes + uTime * 100.0);
        float grain = (n - 0.5) * (0.025 + uCam * 0.03);
        col += grain;
        col = mix(col, vec3(n), clamp(uStatic, 0.0, 1.0));
        // vignette
        vec2 d = vUv - 0.5;
        col *= mix(1.0, smoothstep(0.85, 0.2, length(d * vec2(1.1, 1.0))), uVignette);
        col = mix(col, vec3(0.0), uDark);
        // pulsation rouge (jumpscare)
        col = mix(col, col * vec3(1.7, 0.25, 0.2) + vec3(0.12, 0.0, 0.0), clamp(uRed, 0.0, 1.0) * 0.75);
        col += vec3(uFlash);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    rt, uniforms: mat.uniforms,
    setSize(w, h) { rt.setSize(w, h); mat.uniforms.uRes.value.set(w, h); },
    render(sceneToRender, camera) {
      renderer.setRenderTarget(rt);
      renderer.render(sceneToRender, camera);
      renderer.setRenderTarget(null);
      renderer.render(scene, cam);
    },
  };
}
