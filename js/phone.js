// The hero phone: a Three.js phone that floats, then turns through the app's three steps as the story act scrolls.
// It reads the act's scroll progress (--sc-p, written by scrollcraft.js) and never listens to the mouse.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const act = document.querySelector('[data-story]');
const stage = act.querySelector('[data-sc-stage]');
const canvas = stage.querySelector('canvas');
const tags = [...stage.querySelectorAll('.ledger li')];
const SHOTS = ['img/ios-walk.jpg', 'img/ios-issue.jpg', 'img/ios-sent.jpg'];
const SWAP_AT = [0.48, 0.72];          // screen changes while the back faces the visitor
const TAG_AT = [0.3, 0.55, 0.79];      // a dated tag drops out once each screen has landed
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Renderer ----
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (e) {
  stage.classList.add('no-webgl');     // CSS shows the flat screenshot instead
  throw e;
}
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();
const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 30);
const key = new THREE.DirectionalLight(0xffffff, 1.2);
key.position.set(2, 3, 4);
scene.add(key);

// ---- Phone (same build as the Phone3D demo) ----
const W = 0.716, H = 1.476, D = 0.072, R = 0.115, BS = 0.01, BT = 0.01;
const FRONT = D / 2 + BT, INSET = 0.024, SW = W - 2 * INSET, SH = H - 2 * INSET, SR = R - INSET;

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function flatShape(w, h, r) {   // 0..1 UVs so a picture fills the shape exactly
  const g = new THREE.ShapeGeometry(roundedRect(w, h, r), 32);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  return g;
}

const frameMat = new THREE.MeshPhysicalMaterial({ color: 0xb9b4aa, metalness: 1, roughness: 0.32 });
const backMat = new THREE.MeshPhysicalMaterial({ color: 0xcfcac0, roughness: 0.55, clearcoat: 1, clearcoatRoughness: 0.35 });
const plateMat = new THREE.MeshPhysicalMaterial({ color: 0xcfcac0, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 });
const blackGlass = new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.05, clearcoat: 1 });
const lensGlass = new THREE.MeshPhysicalMaterial({ color: 0x07070c, roughness: 0.02, clearcoat: 1, iridescence: 0.7, iridescenceIOR: 1.4 });
const darkPart = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.6 });
const coverGlass = new THREE.MeshPhysicalMaterial({   // black base adds nothing: only reflections show
  color: 0x000000, roughness: 0.03, clearcoat: 1, transparent: true,
  blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 0.5
});

const phone = new THREE.Group();
scene.add(phone);

const frameGeo = new THREE.ExtrudeGeometry(roundedRect(W, H, R), {
  depth: D, bevelEnabled: true, bevelSize: BS, bevelThickness: BT, bevelSegments: 8, curveSegments: 48
});
frameGeo.translate(0, 0, -D / 2);
phone.add(new THREE.Mesh(frameGeo, frameMat));

const front = new THREE.Mesh(flatShape(W, H, R), blackGlass);
front.position.z = FRONT + 0.0005;
phone.add(front);

const screenCanvas = document.createElement('canvas');
screenCanvas.width = 900; screenCanvas.height = Math.round(900 * SH / SW);
const screenTex = new THREE.CanvasTexture(screenCanvas);
screenTex.colorSpace = THREE.SRGBColorSpace;
screenTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
const screen = new THREE.Mesh(flatShape(SW, SH, SR), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
screen.position.z = FRONT + 0.001;
phone.add(screen);

// Shutter flash over the screen when a step lands (the snap)
const flash = new THREE.Mesh(flatShape(SW, SH, SR), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, toneMapped: false }));
flash.position.z = FRONT + 0.0012;
phone.add(flash);

const cover = new THREE.Mesh(flatShape(W, H, R), coverGlass);
cover.position.z = FRONT + 0.0015;
phone.add(cover);

const back = new THREE.Mesh(flatShape(W, H, R), backMat);
back.rotation.y = Math.PI;
back.position.z = -FRONT - 0.0005;
phone.add(back);

const cam = new THREE.Group();
const PS = 0.33, PD = 0.008;
cam.add(new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(PS, PS, 0.085), {
  depth: PD, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 4, curveSegments: 32
}), plateMat));
const ringGeo = new THREE.CylinderGeometry(0.066, 0.068, 0.022, 64).rotateX(Math.PI / 2);
const lensGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.024, 64).rotateX(Math.PI / 2);
const innerGeo = new THREE.CircleGeometry(0.022, 48);
for (const [x, y] of [[-0.075, 0.075], [-0.075, -0.075], [0.08, 0]]) {
  const ring = new THREE.Mesh(ringGeo, frameMat); ring.position.set(x, y, PD + 0.011);
  const lens = new THREE.Mesh(lensGeo, lensGlass); lens.position.set(x, y, PD + 0.012);
  const inner = new THREE.Mesh(innerGeo, darkPart); inner.position.set(x, y, PD + 0.0245);
  cam.add(ring, lens, inner);
}
const flashLed = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.004, 32).rotateX(Math.PI / 2),
  new THREE.MeshPhysicalMaterial({ color: 0xf3ead2, roughness: 0.3, clearcoat: 1 }));
flashLed.position.set(0.08, 0.1, PD + 0.004);
cam.add(flashLed);
cam.rotation.y = Math.PI;
cam.position.set(W / 2 - 0.03 - PS / 2, H / 2 - 0.03 - PS / 2, -FRONT);
phone.add(cam);

const SIDE = W / 2 + BS + 0.002;
for (const [x, y, len] of [[SIDE, 0.22, 0.2], [-SIDE, 0.42, 0.07], [-SIDE, 0.27, 0.12], [-SIDE, 0.12, 0.12]]) {
  const b = new THREE.Mesh(new RoundedBoxGeometry(0.012, len, 0.032, 4, 0.0055), frameMat);
  b.position.set(x, y, 0);
  phone.add(b);
}
const BOTTOM = -(H / 2 + BS);
const port = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.012, 0.03, 4, 0.005), darkPart);
port.position.set(0, BOTTOM, 0);
phone.add(port);

// ---- Pedestal with a soft contact shadow (hero only, sinks away on scroll) ----
const pedestal = new THREE.Group();
const PED_R = 0.5, PED_H = 0.28;
pedestal.add(new THREE.Mesh(new THREE.CylinderGeometry(PED_R, PED_R * 1.04, PED_H, 96),
  new THREE.MeshPhysicalMaterial({ color: 0xfbfdfd, roughness: 0.42, clearcoat: 0.3 })));
const sc = document.createElement('canvas'); sc.width = sc.height = 128;
const sctx = sc.getContext('2d');
const grad = sctx.createRadialGradient(64, 64, 0, 64, 64, 64);
grad.addColorStop(0, 'rgba(20,38,43,0.45)'); grad.addColorStop(1, 'rgba(20,38,43,0)');
sctx.fillStyle = grad; sctx.fillRect(0, 0, 128, 128);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.26),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = PED_H / 2 + 0.002;
pedestal.add(shadow);
scene.add(pedestal);

// ---- Screens ----
const sctx2 = screenCanvas.getContext('2d');
const CW = screenCanvas.width, CH = screenCanvas.height;
const shots = SHOTS.map(src => { const i = new Image(); i.src = src; return i; });
let shown = -1;
function drawShot(i) {
  const img = shots[i];
  if (!img.complete || !img.naturalWidth) return false;
  const s = Math.max(CW / img.naturalWidth, CH / img.naturalHeight);   // cover-fit
  sctx2.drawImage(img, (CW - img.naturalWidth * s) / 2, 0, img.naturalWidth * s, img.naturalHeight * s);
  sctx2.fillStyle = '#000';                                              // Dynamic Island
  sctx2.beginPath(); sctx2.roundRect(CW / 2 - 110, 40, 220, 64, 32); sctx2.fill();
  screenTex.needsUpdate = true;
  shown = i;
  return true;
}

// ---- Layout per screen size (phone, tablet, desktop) ----
let L;
function layout() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio, w < 640 ? 1.5 : 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const upright = w / h < 1;                                    // phones and upright tablets: phone on top, words below
  const share = upright ? 0.44 : w < 1180 ? 0.56 : 0.6;        // phone height as a share of the screen height
  const tan = Math.tan(THREE.MathUtils.degToRad(14));
  const dist = H / (2 * tan * share), halfH = dist * tan, halfW = halfH * camera.aspect;
  camera.position.set(0, 0, dist);
  camera.updateProjectionMatrix();
  L = upright
    ? { hx: 0, hy: halfH * 0.27, sx: 0, sy: halfH * 0.3 }
    : { hx: 0, hy: halfH * 0.04, sx: halfW * (w < 1180 ? 0.2 : 0.26), sy: 0.02 };
}
new ResizeObserver(layout).observe(stage);
layout();

// ---- Scroll choreography ----
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const v = new THREE.Vector3();
let flashUntil = 0, lastTagCount = 0, lastPx = '', lastLift = '';
let visible = true;
new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(stage);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  if (!visible) return;
  const t = clock.getElapsedTime();
  const p = parseFloat(act.style.getPropertyValue('--sc-p')) || 0;
  const lift = smooth(0.1, 0.26, p);
  const turns = still ? 0 : smooth(0.43, 0.53, p) + smooth(0.67, 0.77, p);
  const float = still ? 0 : Math.sin(t * 1.3) * 0.025;

  const want = p < SWAP_AT[0] ? 0 : p < SWAP_AT[1] ? 1 : 2;
  if (want !== shown) drawShot(want);

  phone.position.set(lerp(L.hx, L.sx, lift), lerp(L.hy, L.sy, lift) + float, 0);
  phone.rotation.set(0.06 - lift * 0.03, lerp(-0.42, -0.2, lift) + turns * Math.PI * 2 + (still ? 0 : Math.sin(t * 0.5) * 0.04), 0.015);
  pedestal.position.set(L.hx, L.hy - H / 2 - 0.11 - PED_H / 2 - lift * 2.4, -0.05);
  pedestal.visible = lift < 0.99;
  shadow.material.opacity = 0.9 - float * 6;

  // The snap: each tag that has newly landed flashes the screen once (no allocations: this runs every frame)
  let count = 0;
  for (let i = 0; i < TAG_AT.length; i++) if (p >= TAG_AT[i]) count++;
  if (count !== lastTagCount) {
    if (count > lastTagCount && !still) flashUntil = t + 0.35;
    for (let i = 0; i < tags.length; i++) tags[i].classList.toggle('on', i < count);
    lastTagCount = count;
  }
  flash.material.opacity = Math.max(0, (flashUntil - t) / 0.35) * 0.85;

  // Page layers that follow the phone: the band and arc sit behind its centre. Write only on change (style recalc).
  v.copy(phone.position).project(camera);
  const px = ((v.x + 1) / 2 * 100).toFixed(1) + '%', lf = lift.toFixed(3);
  if (px !== lastPx) { stage.style.setProperty('--px', px); lastPx = px; }
  if (lf !== lastLift) { stage.style.setProperty('--lift', lf); lastLift = lf; }

  renderer.render(scene, camera);
});

Promise.all(shots.map(i => i.decode().catch(() => {}))).then(() => { drawShot(0); stage.classList.add('phone-ready'); });
