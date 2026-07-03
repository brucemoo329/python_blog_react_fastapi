import { useEffect, useRef } from 'react';
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import '../styles/ferrofluid.css';

const MAX_COLORS = 8;

function hexToRGB(hex) {
  const color = hex.replace('#', '').padEnd(6, '0');
  return [
    parseInt(color.slice(0, 2), 16) / 255,
    parseInt(color.slice(2, 4), 16) / 255,
    parseInt(color.slice(4, 6), 16) / 255,
  ];
}

function prepColors(input) {
  const base = (input?.length ? input : ['#4F46E5', '#06B6D4', '#E0F2FE']).slice(0, MAX_COLORS);
  const count = base.length;
  const colors = [];
  for (let index = 0; index < MAX_COLORS; index += 1) {
    colors.push(hexToRGB(base[Math.min(index, base.length - 1)]));
  }
  return { colors, count };
}

function flowVector(direction) {
  if (direction === 'up') return [0, 1];
  if (direction === 'left') return [-1, 0];
  if (direction === 'right') return [1, 0];
  return [0, -1];
}

const vertex = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `
precision highp float;

uniform vec3 iResolution;
uniform vec2 iMouse;
uniform float iTime;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform vec3 uColor5;
uniform vec3 uColor6;
uniform vec3 uColor7;
uniform int uColorCount;
uniform vec2 uFlow;
uniform float uSpeed;
uniform float uScale;
uniform float uTurbulence;
uniform float uFluidity;
uniform float uRimWidth;
uniform float uSharpness;
uniform float uShimmer;
uniform float uGlow;
uniform float uOpacity;
uniform float uMouseEnabled;
uniform float uMouseStrength;
uniform float uMouseRadius;

varying vec2 vUv;

#define PI 3.14159265

vec3 palette(float height) {
  int count = uColorCount;
  if (count < 1) count = 1;
  int index = int(floor(clamp(height, 0.0, 0.999999) * float(count)));
  if (index <= 0) return uColor0;
  if (index == 1) return uColor1;
  if (index == 2) return uColor2;
  if (index == 3) return uColor3;
  if (index == 4) return uColor4;
  if (index == 5) return uColor5;
  if (index == 6) return uColor6;
  return uColor7;
}

float hash(vec3 point) {
  point = fract(point * 0.1031);
  point += dot(point, point.zyx + 33.33);
  return fract((point.x + point.y) * point.z);
}

float smoothMinimum(float a, float b, float amount) {
  float result = exp2(-a / amount) + exp2(-b / amount);
  return -amount * log2(result);
}

float sineInterpolate(float a, float b, float weight) {
  return mix(a, b, (sin(weight * PI - PI / 2.0) + 1.0) / 2.0);
}

float valueNoise(vec2 point, float size, float seed) {
  vec2 cell = floor(point / size);
  vec2 relative = mod(point, size);
  float one = hash(vec3(cell, seed));
  float two = hash(vec3(cell.x + 1.0, cell.y, seed));
  float three = hash(vec3(cell.x + 1.0, cell.y + 1.0, seed));
  float four = hash(vec3(cell.x, cell.y + 1.0, seed));
  float bottom = sineInterpolate(one, two, relative.x / size);
  float top = sineInterpolate(four, three, relative.x / size);
  return sineInterpolate(bottom, top, relative.y / size);
}

float layeredNoise(vec2 point, float size, float seed) {
  float offset = size / 2.0;
  float zero = valueNoise(point, size, seed);
  float one = valueNoise(point + vec2(offset, offset), size, seed + 0.1);
  float two = valueNoise(point + vec2(-offset, offset), size, seed + 0.2);
  float three = valueNoise(point + vec2(offset, -offset), size, seed + 0.3);
  float four = valueNoise(point + vec2(-offset, -offset), size, seed + 0.4);
  return (2.0 * zero + 1.5 * one + 1.25 * two + 1.125 * three + four) / 7.0;
}

void mainImage(out vec4 outputColor, in vec2 fragmentCoordinate) {
  float reference = 700.0 / max(uScale, 0.05);
  vec2 point = fragmentCoordinate / iResolution.y * reference;
  float speed = 200.0 * uSpeed;
  float time = iTime;
  vec2 direction = uFlow;
  vec2 perpendicular = vec2(-direction.y, direction.x);

  float distortionOne = valueNoise(point + perpendicular * (time * speed), 60.0, 10.0) * 50.0 * uTurbulence;
  float distortionTwo = valueNoise(point - perpendicular * (time * speed), 120.0, 15.0) * 100.0 * uTurbulence;
  float peaksOne = layeredNoise(point + distortionOne + direction * (time * speed * 0.5), 40.0, 1.0);
  float peaksTwo = layeredNoise(point + distortionTwo - direction * (time * speed * 0.5), 40.0, 0.0);
  float mergedPeaks = smoothMinimum(peaksOne, peaksTwo, max(uFluidity, 0.001));

  float mouseGlow = 0.0;
  if (uMouseEnabled > 0.5) {
    vec2 mousePoint = iMouse / iResolution.y * reference;
    float mouseDistance = length(point - mousePoint) / reference;
    float radius = max(uMouseRadius, 0.02);
    mouseGlow = exp(-mouseDistance * mouseDistance / (radius * radius)) * uMouseStrength;
  }

  float band = (uRimWidth - abs((mergedPeaks - 0.4) * 2.0)) * 5.0;
  float light = clamp(band - valueNoise(point + direction * (time * speed * 0.5), 60.0, 12.0) * uShimmer, 0.0, 1.0);
  light = pow(light, uSharpness) * uGlow;
  light *= clamp(1.0 - mouseGlow, 0.0, 1.0);

  float height = clamp(0.5 + (peaksOne - peaksTwo) * 0.8, 0.0, 1.0);
  vec3 color = palette(height);
  vec3 finalColor = color * light;
  float alpha = clamp(max(finalColor.r, max(finalColor.g, finalColor.b)), 0.0, 1.0);
  outputColor = vec4(finalColor, alpha * uOpacity);
}

void main() {
  vec4 color;
  mainImage(color, vUv * iResolution.xy);
  gl_FragColor = color;
}
`;

export default function Ferrofluid({
  className = '',
  dpr,
  paused = false,
  colors = ['#ffffff', '#ffffff', '#ffffff'],
  backgroundColor = '#03010A',
  speed = 0.5,
  scale = 1.6,
  turbulence = 1,
  fluidity = 0.1,
  rimWidth = 0.2,
  sharpness = 2.5,
  shimmer = 1.5,
  glow = 2,
  flowDirection = 'down',
  opacity = 1,
  mouseInteraction = true,
  mouseStrength = 1,
  mouseRadius = 0.35,
  mouseDampening = 0.15,
  mixBlendMode,
}) {
  const containerRef = useRef(null);
  const animationRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const renderer = new Renderer({
      dpr: dpr ?? Math.min(window.devicePixelRatio || 1, 2),
      alpha: true,
      antialias: true,
    });
    const gl = renderer.gl;
    const canvas = gl.canvas;
    gl.clearColor(0, 0, 0, 0);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    const prepared = prepColors(colors);
    const uniforms = {
      iResolution: { value: [gl.drawingBufferWidth, gl.drawingBufferHeight, 1] },
      iMouse: { value: [0, 0] },
      iTime: { value: 0 },
      uColor0: { value: prepared.colors[0] },
      uColor1: { value: prepared.colors[1] },
      uColor2: { value: prepared.colors[2] },
      uColor3: { value: prepared.colors[3] },
      uColor4: { value: prepared.colors[4] },
      uColor5: { value: prepared.colors[5] },
      uColor6: { value: prepared.colors[6] },
      uColor7: { value: prepared.colors[7] },
      uColorCount: { value: prepared.count },
      uFlow: { value: flowVector(flowDirection) },
      uSpeed: { value: speed },
      uScale: { value: scale },
      uTurbulence: { value: turbulence },
      uFluidity: { value: fluidity },
      uRimWidth: { value: rimWidth },
      uSharpness: { value: sharpness },
      uShimmer: { value: shimmer },
      uGlow: { value: glow },
      uOpacity: { value: opacity },
      uMouseEnabled: { value: mouseInteraction ? 1 : 0 },
      uMouseStrength: { value: mouseStrength },
      uMouseRadius: { value: mouseRadius },
    };

    const program = new Program(gl, { vertex, fragment, uniforms });
    const geometry = new Triangle(gl);
    const mesh = new Mesh(gl, { geometry, program });
    const mouseTarget = [0, 0];
    let lastTime = 0;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      uniforms.iResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight, 1];
    };

    const handlePointerMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      const pixelRatio = renderer.dpr || 1;
      mouseTarget[0] = (event.clientX - rect.left) * pixelRatio;
      mouseTarget[1] = (rect.height - (event.clientY - rect.top)) * pixelRatio;
      if (mouseDampening <= 0) {
        uniforms.iMouse.value = [...mouseTarget];
      }
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    if (mouseInteraction) canvas.addEventListener('pointermove', handlePointerMove);

    const render = (time) => {
      animationRef.current = window.requestAnimationFrame(render);
      uniforms.iTime.value = time * 0.001;

      if (mouseDampening > 0) {
        if (!lastTime) lastTime = time;
        const delta = (time - lastTime) / 1000;
        lastTime = time;
        const factor = Math.min(1, 1 - Math.exp(-delta / Math.max(0.0001, mouseDampening)));
        uniforms.iMouse.value[0] += (mouseTarget[0] - uniforms.iMouse.value[0]) * factor;
        uniforms.iMouse.value[1] += (mouseTarget[1] - uniforms.iMouse.value[1]) * factor;
      }

      if (!paused) renderer.render({ scene: mesh });
    };

    animationRef.current = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationRef.current);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointermove', handlePointerMove);
      if (canvas.parentElement === container) container.removeChild(canvas);
      program.remove?.();
      geometry.remove?.();
      mesh.remove?.();
      renderer.destroy?.();
    };
  }, [
    colors,
    dpr,
    flowDirection,
    fluidity,
    glow,
    mouseDampening,
    mouseInteraction,
    mouseRadius,
    mouseStrength,
    opacity,
    paused,
    rimWidth,
    scale,
    sharpness,
    shimmer,
    speed,
    turbulence,
  ]);

  return (
    <div
      ref={containerRef}
      className={`ferrofluid-container ${className}`}
      style={{ backgroundColor, ...(mixBlendMode ? { mixBlendMode } : {}) }}
      aria-hidden="true"
    />
  );
}
