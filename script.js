// ===== Custom cursor glow =====
const cursorGlow = document.getElementById('cursorGlow');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (cursorGlow && !prefersReducedMotion && window.matchMedia('(hover: hover)').matches) {
  let mouseX = -100, mouseY = -100;
  let curX = -100, curY = -100;

  window.addEventListener('pointermove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function animateCursor() {
    curX += (mouseX - curX) * 0.18;
    curY += (mouseY - curY) * 0.18;
    cursorGlow.style.transform = `translate3d(${curX}px, ${curY}px, 0)`;
    requestAnimationFrame(animateCursor);
  }
  animateCursor();
}

// ===== Focus mode toggle =====
const focusToggle = document.getElementById('focusToggle');
const FOCUS_KEY = 'trip2-focus-mode';

function setFocusMode(on) {
  document.body.classList.toggle('focus-mode', on);
  focusToggle.setAttribute('aria-pressed', String(on));
  localStorage.setItem(FOCUS_KEY, on ? '1' : '0');
}

if (focusToggle) {
  setFocusMode(localStorage.getItem(FOCUS_KEY) === '1');
  focusToggle.addEventListener('click', () => {
    setFocusMode(!document.body.classList.contains('focus-mode'));
  });
}

// ===== Flashcards flip =====
document.querySelectorAll('.flashcard').forEach((card) => {
  card.addEventListener('click', () => card.classList.toggle('flipped'));
});

// ===== Checklist persistence =====
const CHECKLIST_KEY = 'trip2-checklist';
const checklistInputs = document.querySelectorAll('#checklistList input[type="checkbox"]');

function loadChecklist() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(CHECKLIST_KEY) || '{}');
  } catch (e) { saved = {}; }
  checklistInputs.forEach((input) => {
    input.checked = !!saved[input.dataset.key];
  });
}

function saveChecklist() {
  const state = {};
  checklistInputs.forEach((input) => { state[input.dataset.key] = input.checked; });
  localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
}

checklistInputs.forEach((input) => input.addEventListener('change', saveChecklist));
loadChecklist();

const resetBtn = document.getElementById('resetChecklist');
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    checklistInputs.forEach((input) => { input.checked = false; });
    saveChecklist();
  });
}

// ===== Easter egg: click logo 3x =====
const logo = document.getElementById('logoTrigger');
const easterEgg = document.getElementById('easterEgg');
const easterEggClose = document.getElementById('easterEggClose');
let clickCount = 0;
let clickTimer = null;

function openEasterEgg() {
  easterEgg.classList.add('visible');
  easterEgg.setAttribute('aria-hidden', 'false');
}

function closeEasterEgg() {
  easterEgg.classList.remove('visible');
  easterEgg.setAttribute('aria-hidden', 'true');
}

if (logo) {
  logo.addEventListener('click', () => {
    clickCount += 1;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { clickCount = 0; }, 900);
    if (clickCount >= 3) {
      clickCount = 0;
      openEasterEgg();
    }
  });
}

if (easterEggClose) easterEggClose.addEventListener('click', closeEasterEgg);
if (easterEgg) {
  easterEgg.addEventListener('click', (e) => {
    if (e.target === easterEgg) closeEasterEgg();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeEasterEgg();
});

// ===== Trip Timer =====
(function initTripTimer() {
  const clockEl = document.getElementById('timerClock');
  const startLabelEl = document.getElementById('timerStartLabel');
  const vibeEl = document.getElementById('timerVibe');
  const waveEl = document.getElementById('timerWave');
  const startBtn = document.getElementById('timerStart');
  const pauseBtn = document.getElementById('timerPause');
  const resetBtn = document.getElementById('timerReset');
  const noteInput = document.getElementById('timerNoteInput');
  const sliderEl = document.getElementById('timerSlider');
  if (!clockEl || !startBtn) return;

  const SLIDER_MAX_MIN = Number(sliderEl?.max) || 600;
  let sliderDragging = false;

  const STORAGE_KEY = 'trip2-timer-state';

  const VIBES = [
    { max: 0,   phase: 'idle',    text: 'Kliknij Start, kiedy zaczynacie.' },
    { max: 15,  phase: 'rising',  text: 'Start zaliczony. Rozgość się, odpal playlistę, oddychaj.' },
    { max: 35,  phase: 'rising',  text: 'Coś zaczyna się dziać. To normalne — dajcie temu chwilę.' },
    { max: 60,  phase: 'rising',  text: 'Fala wyraźnie rośnie. Trzymajcie się zasad klubu.' },
    { max: 100, phase: 'high',    text: 'Środek drogi. Nie walczcie z niczym, płyńcie z tym.' },
    { max: 150, phase: 'high',    text: 'Wciąż w gęstym środku. Woda, muzyka, spokój.' },
    { max: 210, phase: 'falling', text: 'Powoli robi się łagodniej. Zwalniajcie tempo.' },
    { max: 280, phase: 'falling', text: 'Opadanie w toku. Usiądźcie wygodnie.' },
    { max: 360, phase: 'late',    text: 'Późna faza. Blisko lądowania.' },
    { max: Infinity, phase: 'late', text: 'Dawno powinno robić się spokojnie. Jeśli nie — Zasada Trzeźwego Anioła to teraz priorytet.' },
  ];

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  let state = Object.assign({
    startTimestamp: null,
    running: false,
    accumulatedMs: 0,
    segmentStart: null,
  }, loadState());

  if (noteInput) {
    const savedNote = localStorage.getItem('trip2-timer-note');
    if (savedNote) noteInput.value = savedNote;
    noteInput.addEventListener('input', () => {
      localStorage.setItem('trip2-timer-note', noteInput.value);
    });
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function elapsedMs() {
    const running = state.running && state.segmentStart;
    return state.accumulatedMs + (running ? Date.now() - state.segmentStart : 0);
  }

  function formatClock(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function render() {
    const ms = elapsedMs();
    clockEl.textContent = formatClock(ms);

    if (state.startTimestamp) {
      const d = new Date(state.startTimestamp);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      startLabelEl.textContent = `Start: ${hh}:${mm}`;
    } else {
      startLabelEl.textContent = 'Nie wystartowano';
    }

    const minutes = ms / 60000;
    const vibe = state.startTimestamp
      ? VIBES.find((v) => minutes < v.max) || VIBES[VIBES.length - 1]
      : VIBES[0];

    if (vibeEl.textContent !== vibe.text) {
      vibeEl.style.opacity = '0';
      setTimeout(() => {
        vibeEl.textContent = vibe.text;
        vibeEl.style.opacity = '1';
      }, 200);
    }

    waveEl.dataset.phase = state.startTimestamp ? vibe.phase : 'idle';

    startBtn.textContent = state.running ? 'W trakcie…' : (state.startTimestamp ? 'Wznów' : 'Start');
    startBtn.classList.toggle('is-running', state.running);
    startBtn.disabled = state.running;
    pauseBtn.disabled = !state.running;
    resetBtn.disabled = !state.startTimestamp;

    if (sliderEl && !sliderDragging) {
      const clampedMin = Math.min(SLIDER_MAX_MIN, minutes);
      sliderEl.value = String(Math.round(clampedMin));
    }
  }

  function setElapsedFromMinutes(mins) {
    const ms = mins * 60000;
    state.accumulatedMs = ms;
    if (state.running) {
      state.segmentStart = Date.now();
    }
    // Back-calculate a start time so "Start: HH:MM" stays consistent with the slider.
    state.startTimestamp = Date.now() - ms;
  }

  if (sliderEl) {
    sliderEl.addEventListener('pointerdown', () => { sliderDragging = true; });
    sliderEl.addEventListener('input', () => {
      setElapsedFromMinutes(Number(sliderEl.value));
      saveState();
      render();
    });
    const endDrag = () => {
      if (!sliderDragging) return;
      sliderDragging = false;
      saveState();
      render();
    };
    sliderEl.addEventListener('pointerup', endDrag);
    sliderEl.addEventListener('change', endDrag);
    sliderEl.addEventListener('keyup', endDrag);
  }

  let tickInterval = null;

  function startTicking() {
    if (tickInterval) return;
    tickInterval = setInterval(render, 1000);
  }

  function stopTicking() {
    clearInterval(tickInterval);
    tickInterval = null;
  }

  startBtn.addEventListener('click', () => {
    if (state.running) return;
    if (!state.startTimestamp) state.startTimestamp = Date.now();
    state.running = true;
    state.segmentStart = Date.now();
    saveState();
    render();
    startTicking();
  });

  pauseBtn.addEventListener('click', () => {
    if (!state.running) return;
    state.accumulatedMs += Date.now() - state.segmentStart;
    state.running = false;
    state.segmentStart = null;
    saveState();
    render();
    stopTicking();
  });

  resetBtn.addEventListener('click', () => {
    state = { startTimestamp: null, running: false, accumulatedMs: 0, segmentStart: null };
    saveState();
    render();
    stopTicking();
  });

  render();
  if (state.running) startTicking();
})();

// ===== Music tabs =====
(function initMusicTabs() {
  const tabs = document.querySelectorAll('.music-tab');
  const frame = document.getElementById('musicFeaturedFrame');
  const titleEl = document.getElementById('musicFeaturedTitle');
  if (!tabs.length || !frame) return;

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.classList.contains('is-active')) return;
      tabs.forEach((t) => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');

      const videoId = tab.dataset.video;
      const title = tab.dataset.title;
      frame.src = `https://www.youtube-nocookie.com/embed/${videoId}`;
      frame.title = title;
      if (titleEl) titleEl.textContent = tab.textContent;
    });
  });
})();

// ===== Hero WebGL background =====
(function initHeroGL() {
  const canvas = document.getElementById('heroGl');
  if (!canvas || prefersReducedMotion) return;

  const gl = canvas.getContext('webgl');
  if (!gl) return;

  const vertexSrc = `
    attribute vec4 position;
    void main() {
      gl_Position = position;
    }
  `;

  const fragmentSrc = `
    precision mediump float;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;
    uniform float u_intensity;

    vec3 hash3(vec2 p) {
      vec3 q = vec3(dot(p, vec2(127.1, 311.7)),
                    dot(p, vec2(269.5, 183.3)),
                    dot(p, vec2(419.2, 371.9)));
      return fract(sin(q) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
      return mix(mix(dot(hash3(i + vec2(0.0,0.0)).xy, f - vec2(0.0,0.0)),
                     dot(hash3(i + vec2(1.0,0.0)).xy, f - vec2(1.0,0.0)), u.x),
                 mix(dot(hash3(i + vec2(0.0,1.0)).xy, f - vec2(0.0,1.0)),
                     dot(hash3(i + vec2(1.0,1.0)).xy, f - vec2(1.0,1.0)), u.x), u.y);
    }

    float fbm(vec2 p, int octaves) {
      float value = 0.0;
      float amplitude = 1.0;
      float frequency = 0.25;
      for (int i = 0; i < 10; i++) {
        if (i >= octaves) break;
        value += amplitude * noise(p * frequency);
        amplitude *= 0.52;
        frequency *= 1.13;
      }
      return value;
    }

    vec2 curl(vec2 p) {
      float eps = 0.5;
      float n1 = fbm(p + vec2(eps, 0.0), 6);
      float n2 = fbm(p - vec2(eps, 0.0), 6);
      float n3 = fbm(p + vec2(0.0, eps), 6);
      float n4 = fbm(p - vec2(0.0, eps), 6);
      return vec2((n3 - n4) / (2.0 * eps), (n2 - n1) / (2.0 * eps));
    }

    float grain(vec2 uv, float time) {
      vec2 seed = uv * time;
      return fract(sin(dot(seed, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution.xy;
      vec2 st = (uv - 0.5) * 2.0;
      st.x *= u_resolution.x / u_resolution.y;

      float time = u_time * 0.25;

      vec2 curlForce = curl(st * 2.0) * 0.6;
      vec2 flowField = st + curlForce;

      float dist1 = fbm(flowField * 1.5 + time * 1.2, 8) * 0.4;
      float dist2 = fbm(flowField * 2.3 - time * 0.8, 6) * 0.3;
      float dist3 = fbm(flowField * 3.1 + time * 1.8, 4) * 0.2;
      float dist4 = fbm(flowField * 4.7 - time * 1.1, 3) * 0.15;

      float totalDist = dist1 + dist2 + dist3 + dist4;

      float streak1 = smoothstep(0.3, 0.7, sin((st.x + totalDist) * 15.0 + time * 3.0) * 0.5 + 0.5);
      float streak2 = smoothstep(0.2, 0.8, sin((st.x + totalDist * 0.7) * 25.0 - time * 2.0) * 0.5 + 0.5);
      float streak3 = smoothstep(0.4, 0.6, sin((st.x + totalDist * 1.3) * 35.0 + time * 4.0) * 0.5 + 0.5);
      float combinedStreaks = streak1 * 0.6 + streak2 * 0.4 + streak3 * 0.5;

      float shape1 = smoothstep(0.0, 1.0, 1.0 - abs(st.x + totalDist * 0.6));
      float shape2 = smoothstep(0.1, 0.9, 1.0 - abs(st.x + totalDist * 0.4 + sin(st.y * 3.0 + time) * 0.15));
      float shape3 = smoothstep(0.2, 0.8, 1.0 - abs(st.x + totalDist * 0.8 + cos(st.y * 2.0 - time) * 0.1));
      float finalShape = max(shape1 * 0.8, max(shape2 * 0.6, shape3 * 0.4));

      vec3 colorMagenta = vec3(1.0, 0.24, 0.65);
      vec3 colorAmber   = vec3(1.0, 0.71, 0.33);
      vec3 colorPurple  = vec3(0.75, 0.2, 0.9);
      vec3 colorCyan    = vec3(0.31, 0.89, 0.93);
      vec3 colorVoid    = vec3(0.09, 0.03, 0.16);

      float gradient = 1.0 - uv.y;
      float colorNoise = fbm(flowField * 3.0 + time * 0.5, 4) * 0.5 + 0.5;

      vec3 finalColor = mix(colorVoid, colorPurple, smoothstep(0.5, 0.85, gradient));
      finalColor = mix(finalColor, colorCyan, smoothstep(0.3, 0.55, gradient));
      finalColor = mix(finalColor, colorAmber, smoothstep(0.1, 0.3, gradient));
      finalColor = mix(finalColor, colorMagenta, smoothstep(0.85, 1.0, gradient));
      finalColor = mix(finalColor, colorMagenta, colorNoise * 0.5);

      float pulse1 = sin(time * 3.0 + st.y * 6.0) * 0.5 + 0.5;
      float pulse2 = sin(time * 4.5 - st.y * 8.0) * 0.5 + 0.5;
      float energyPulse = smoothstep(0.3, 0.7, pulse1 * pulse2);

      float intensity = finalShape * combinedStreaks * (1.0 + energyPulse * 0.4);
      intensity *= u_intensity;

      vec2 mouse = u_mouse / u_resolution.xy;
      mouse = (mouse - 0.5) * 2.0;
      mouse.x *= u_resolution.x / u_resolution.y;
      float mouseInfluence = max(0.0, 1.0 - length(st - mouse) * 0.6);
      mouseInfluence = smoothstep(0.0, 1.0, mouseInfluence);
      intensity += mouseInfluence * 0.5;

      vec3 result = finalColor * intensity;
      float bloom = smoothstep(0.4, 1.0, intensity) * 0.5;
      result += bloom * finalColor;

      result = pow(result, vec3(0.85));

      float vignette = smoothstep(0.2, 1.0, 1.0 - length(uv - 0.5) * 0.85);
      vec3 bgColor = colorVoid + finalColor * 0.03;
      result = mix(bgColor, result, smoothstep(0.0, 0.4, intensity));
      result *= vignette;

      float grainValue = grain(uv, time * 0.5) * 2.0 - 1.0;
      result += grainValue * 0.05;

      gl_FragColor = vec4(result, 1.0);
    }
  `;

  function compile(type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vertShader = compile(gl.VERTEX_SHADER, vertexSrc);
  const fragShader = compile(gl.FRAGMENT_SHADER, fragmentSrc);
  if (!vertShader || !fragShader) return;

  const program = gl.createProgram();
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    return;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const positionLoc = gl.getAttribLocation(program, 'position');
  const timeLoc = gl.getUniformLocation(program, 'u_time');
  const resolutionLoc = gl.getUniformLocation(program, 'u_resolution');
  const mouseLoc = gl.getUniformLocation(program, 'u_mouse');
  const intensityLoc = gl.getUniformLocation(program, 'u_intensity');

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);

  const mouse = { x: 0, y: 0 };
  let targetIntensity = 1.0;
  let currentIntensity = 1.0;
  let decayTimer = null;

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (rect.height - (e.clientY - rect.top)) * (canvas.height / rect.height);
    targetIntensity = 1.15;
    clearTimeout(decayTimer);
    decayTimer = setTimeout(() => { targetIntensity = 1.0; }, 150);
  });

  const startTime = Date.now();
  let elapsed = 0;
  let lastTick = Date.now();

  function frame() {
    const now = Date.now();
    const focusMode = document.body.classList.contains('focus-mode');
    if (!focusMode) elapsed += now - lastTick;
    lastTick = now;

    currentIntensity += (targetIntensity - currentIntensity) * 0.06;

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(timeLoc, elapsed * 0.001);
    gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
    gl.uniform2f(mouseLoc, mouse.x, mouse.y);
    gl.uniform1f(intensityLoc, focusMode ? currentIntensity * 0.5 : currentIntensity);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();

// ===== Konami code easter egg =====
const konami = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let konamiPos = 0;

document.addEventListener('keydown', (e) => {
  const expected = konami[konamiPos];
  if (e.key === expected) {
    konamiPos += 1;
    if (konamiPos === konami.length) {
      konamiPos = 0;
      openEasterEgg();
    }
  } else {
    konamiPos = (e.key === konami[0]) ? 1 : 0;
  }
});
