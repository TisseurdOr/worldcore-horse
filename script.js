const track = document.querySelector("#demoTrack");
const stage = document.querySelector("#demoStage");
const scenes = [...document.querySelectorAll(".scene")];
const horse = document.querySelector("#horseCenter");
const horseFrame = document.querySelector("#centerHorseFrame");
const sun = document.querySelector("#sun");
const grain = document.querySelector(".grain");
const chapter = document.querySelector("#chapter");
const progressBar = document.querySelector("#progressBar");
const progressText = document.querySelector("#progressText");
const hoofLinks = [...document.querySelectorAll(".hoof-link")].map((el) => ({ el, reveal: Number(el.dataset.reveal), placed: false }));
const trailSvg = document.querySelector("#trailSvg");
const trailLine = document.querySelector("#trailLine");
const trailClipRect = document.querySelector("#trailClipRect");
const trailPrints = document.querySelector("#trailPrints");

const SPEED = 1.2;
const FRAME_COUNT = 16;
const TRAIL_PRINT_COUNT = 26;

// Background scenes 0–8, in filename order.
const groundBottomVh = [21, 34, 20, 26, 12, 30, 16, 34, 27];
const horseLight = [0.78, 0.78, 0.97, 1.08, 1.02, 0.92, 0.93, 1.00, 0.72];
const shadowOpacity = [0.18, 0.18, 0.34, 0.38, 0.34, 0.28, 0.28, 0.32, 0.16];
const sceneLabels = ["森林深处", "森林", "森林到草地", "草地", "草地傍晚", "牧场", "林间傍晚", "草原傍晚", "森林晚"];

const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const smoothstep = (a, b, v) => {
  const x = clamp((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const pad = (v) => String(Math.round(v)).padStart(2, "0");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const svgNS = "http://www.w3.org/2000/svg";

let actual = 0;
let target = 0;
let frameIndex = 0;
let lastFrame = 0;
let trailPoints = [];
let trailLengths = [];
let trailTotalLength = 1;

function smoothInterpolate(values, position) {
  const n = values.length;
  const i = Math.floor(clamp(position, 0, n - 1));
  const t = position - i;
  const p0 = values[Math.max(0, i - 1)];
  const p1 = values[Math.min(n - 1, i)];
  const p2 = values[Math.min(n - 1, i + 1)];
  const p3 = values[Math.min(n - 1, i + 2)];
  const value = 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
  );
  const low = Math.min(p1, p2);
  const high = Math.max(p1, p2);
  return clamp(value, low, high);
}

function getHorseWidth() {
  // Match the CSS: width <= 25vw and height <= 20vh for the 854:480 horse image.
  return Math.min(innerWidth * 0.245, innerHeight * 0.356);
}

function getHorsePositionAtProgress(p) {
  const mobile = innerWidth <= 720;
  const start = mobile ? 30 : 20;
  const travel = mobile ? 40 : 60;
  const left = start + smoothstep(0, 1, p) * travel;
  const position = p * (scenes.length - 1);
  const bottom = smoothInterpolate(groundBottomVh, position);
  const centerX = (left / 100) * innerWidth;
  const rearHoofOffset = getHorseWidth() * 0.29;

  return {
    centerX,
    x: centerX - rearHoofOffset,
    y: innerHeight - (bottom / 100) * innerHeight,
    bottom,
    p,
  };
}

function buildTrail() {
  const samples = 140;
  trailPoints = [];

  for (let i = 0; i <= samples; i++) {
    trailPoints.push(getHorsePositionAtProgress(i / samples));
  }

  trailLengths = [0];
  for (let i = 1; i < trailPoints.length; i++) {
    const dx = trailPoints[i].x - trailPoints[i - 1].x;
    const dy = trailPoints[i].y - trailPoints[i - 1].y;
    trailLengths[i] = trailLengths[i - 1] + Math.hypot(dx, dy);
  }
  trailTotalLength = Math.max(1, trailLengths[trailLengths.length - 1]);

  const d = trailPoints.map((point, i) => `${i ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  trailSvg.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
  trailLine.setAttribute("d", d);
  buildTrailPrints();
}

function pointAtDistance(distance) {
  const d = clamp(distance, 0, trailTotalLength);
  let low = 0;
  let high = trailLengths.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (trailLengths[mid] < d) low = mid + 1;
    else high = mid;
  }

  const i = Math.max(1, low);
  const a = trailPoints[i - 1];
  const b = trailPoints[i];
  const segment = Math.max(0.001, trailLengths[i] - trailLengths[i - 1]);
  const t = (d - trailLengths[i - 1]) / segment;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    p: a.p + (b.p - a.p) * t,
    angle: Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI),
  };
}

function buildTrailPrints() {
  trailPrints.replaceChildren();

  for (let i = 0; i < TRAIL_PRINT_COUNT; i++) {
    const fraction = 0.025 + (i / (TRAIL_PRINT_COUNT - 1)) * 0.95;
    const point = pointAtDistance(trailTotalLength * fraction);
    const angle = point.angle * (Math.PI / 180);
    const side = i % 2 === 0 ? -1 : 1;
    const offset = 2.2 * side;
    const px = point.x - Math.sin(angle) * offset;
    const py = point.y + Math.cos(angle) * offset;
    const rotation = point.angle + 90;

    const group = document.createElementNS(svgNS, "g");
    group.setAttribute("transform", `translate(${px.toFixed(2)} ${py.toFixed(2)}) rotate(${rotation.toFixed(2)}) scale(0.62)`);

    const print = document.createElementNS(svgNS, "path");
    print.setAttribute("d", "M0 -10 C7 -10 10 -3 8 7 C5 11 2 10 0 6 C-2 10 -5 11 -8 7 C-10 -3 -7 -10 0 -10 Z");
    print.setAttribute("opacity", i % 3 === 0 ? "0.98" : "0.84");
    print.setAttribute("stroke", "#111833");
    print.setAttribute("stroke-width", "1.4");
    group.appendChild(print);
    trailPrints.appendChild(group);
  }
}

function readTarget() {
  const max = track.offsetHeight - innerHeight;
  target = clamp(-track.getBoundingClientRect().top / max);
}

function updateScenes(p) {
  const position = p * (scenes.length - 1);
  const weights = scenes.map((_, i) => Math.max(0, 1 - Math.abs(position - i)));
  const max = Math.max(...weights, 0.001);

  scenes.forEach((scene, i) => {
    scene.style.opacity = (weights[i] / max).toFixed(4);
    scene.style.setProperty("--scene-x", `${-p * innerWidth * 0.022}px`);
  });

  return position;
}

function updateHorse(now, p, position) {
  const point = getHorsePositionAtProgress(p);
  const left = point.centerX / innerWidth * 100;
  const bottom = point.bottom;
  const light = smoothInterpolate(horseLight, position);
  const shadow = smoothInterpolate(shadowOpacity, position);
  const bob = reducedMotion ? 0 : Math.sin(now * 0.015 * SPEED) * 7;
  const tilt = reducedMotion ? 0 : Math.sin(now * 0.015 * SPEED + Math.PI / 2) * 0.45;

  horse.style.setProperty("--horse-left", `${left}vw`);
  horse.style.setProperty("--horse-bottom", `${bottom}vh`);
  horse.style.setProperty("--horse-bob", `${bob}px`);
  horse.style.setProperty("--horse-tilt", `${tilt}deg`);
  horse.style.setProperty("--horse-light", light.toFixed(3));
  horse.style.setProperty("--shadow-opacity", shadow.toFixed(3));
  horse.style.setProperty("--shadow-scale", `${1 - Math.abs(bob) / 60}`);

  const frameInterval = 150 / SPEED;
  if (!reducedMotion && now - lastFrame > frameInterval) {
    frameIndex = (frameIndex + 1) % FRAME_COUNT;
    const number = String(frameIndex + 1).padStart(2, "0");
    horseFrame.src = `assets/horse-webp/frame_${number}.webp`;
    lastFrame = now;
  }

  return point;
}

function updateTrail(p) {
  const point = getHorsePositionAtProgress(p);
  trailClipRect.setAttribute("width", String(Math.max(0, point.x + 12)));
}

function updateHoofLinks(p) {
  hoofLinks.forEach((item, index) => {
    const visible = p >= item.reveal;
    if (!visible) {
      item.el.classList.remove("is-visible");
      item.placed = false;
      return;
    }

    if (!item.placed) {
      const point = pointAtDistance(trailTotalLength * item.reveal);
      item.el.style.setProperty("--hoof-left", `${(point.x / innerWidth) * 100 + 0.6}vw`);
      item.el.style.setProperty("--hoof-bottom", `${(innerHeight - point.y) / innerHeight * 100 + 0.5}vh`);
      item.el.dataset.projectIndex = String(index + 1);
      item.placed = true;
    }

    item.el.classList.add("is-visible");
  });
}

hoofLinks.forEach(({ el }) => {
  el.classList.add("hoof-placeholder");
  el.addEventListener("click", (event) => {
    if (el.getAttribute("href") === "#") event.preventDefault();
  });
});

if (location.hash === "#") {
  history.replaceState(null, "", location.pathname + location.search);
}

function updateInterface(p, position) {
  progressBar.style.height = `${p * 100}%`;
  progressText.textContent = pad(p * 100);
  sun.style.setProperty("--sun-x", `${58 + p * 15}vw`);
  sun.style.setProperty("--sun-y", `${20 - p * 5}vh`);
  grain.style.transform = `translate3d(${p * 9}%, 0, 0)`;
  chapter.textContent = sceneLabels[Math.round(position)] || sceneLabels[0];
}

function render(now) {
  readTarget();
  actual += (target - actual) * (reducedMotion ? 1 : 0.1);
  const p = clamp(actual);

  const position = updateScenes(p);
  updateHorse(now, p, position);
  updateTrail(p);
  updateHoofLinks(p);
  updateInterface(p, position);

  requestAnimationFrame(render);
}

addEventListener("scroll", readTarget, { passive: true });
addEventListener("resize", () => {
  readTarget();
  buildTrail();
});
readTarget();
buildTrail();
preloadHorseFrames();
requestAnimationFrame(render);
