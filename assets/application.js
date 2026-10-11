/**
 * Cosmonats / bitsbeam — application.js
 * Shared by cosmonats.bitsbeam.com/ and bitsbeam.com/ — keep both copies identical.
 * Single script for every page. Plain ES2017, no build step, no dependencies.
 * Loaded with `defer`, so the DOM is ready when it runs.
 *
 * Each module is an isolated IIFE that looks for its own data-* hook and
 * quietly does nothing when the hook isn't on the current page:
 *
 *   1. Starfield         <canvas data-starfield>     twinkling parallax stars
 *   2. Beam              [data-beam]                 rising 0101 in the tractor beam
 *   3. Journey           .journey [data-journey-map] scroll-driven rocket / UFO
 *   4. Copy              [data-copy]                 copy-to-clipboard buttons
 *   5. Reading progress  [data-reading-progress]     progress bar on posts
 */


/* 1. Starfield ============================================================= */
/**
 * Starfield — twinkling, parallax stars with the occasional shooting star.
 *
 * Usage: <canvas class="starfield" data-starfield
 *                data-density="1" data-parallax="0.25" data-shooting-stars="true"></canvas>
 */
(function () {
  'use strict';

  const COLORS = ['255,255,255', '255,255,255', '255,255,255', '190,240,255', '255,214,170'];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function createStarfield(canvas) {
    const ctx = canvas.getContext('2d');
    const density = parseFloat(canvas.dataset.density || '1');
    const parallax = parseFloat(canvas.dataset.parallax || '0.25');
    const shootingStars = canvas.dataset.shootingStars !== 'false' && !reduceMotion;
    let stars = [];
    let shooting = null;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth, h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((w * h) / 3200 * density);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        depth: 0.1 + Math.random() * 0.9,
        r: Math.random() < 0.08 ? 1.6 + Math.random() : 0.4 + Math.random() * 0.9,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 2,
        color: COLORS[(Math.random() * COLORS.length) | 0]
      }));
    }

    function draw(t) {
      const w = window.innerWidth, h = window.innerHeight, sy = window.scrollY;
      const time = reduceMotion ? 0 : t / 1000;
      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        const y = (((s.y - sy * s.depth * parallax) % h) + h) % h;
        const a = 0.45 + Math.sin(time * s.speed + s.phase) * 0.35 * (s.r > 1.5 ? 1 : 0.6);
        ctx.fillStyle = `rgba(${s.color},${Math.max(0.08, a * (0.5 + s.depth * 0.5))})`;
        ctx.beginPath();
        ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.r > 1.6) { // four-point sparkle on the brightest stars
          ctx.fillRect(s.x - s.r * 2.5, y - 0.4, s.r * 5, 0.8);
          ctx.fillRect(s.x - 0.4, y - s.r * 2.5, 0.8, s.r * 5);
        }
      }

      if (shootingStars) {
        if (!shooting && Math.random() < 0.004) shooting = { x: Math.random() * w, y: Math.random() * h * 0.5, life: 0 };
        if (shooting) {
          shooting.life += 0.025;
          const x = shooting.x + shooting.life * 420, y = shooting.y + shooting.life * 180;
          const g = ctx.createLinearGradient(x - 120, y - 52, x, y);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(1, `rgba(255,255,255,${1 - shooting.life})`);
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x - 120, y - 52); ctx.lineTo(x, y); ctx.stroke();
          if (shooting.life >= 1) shooting = null;
        }
      }
      requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(draw);
  }

  document.querySelectorAll('canvas[data-starfield]').forEach(createStarfield);
})();


/* 2. Beam ================================================================== */
/**
 * Beam — fills the tractor beam with columns of rising 0/1 digits.
 *
 * Usage: <div class="beam" data-beam data-columns="11"></div>
 */
(function () {
  'use strict';

  // Deterministic pseudo-random bit string so the beam looks the same on every load.
  function bits(seed, length) {
    let out = '';
    for (let k = 0; k < length; k++) out += ((seed * 7 + k * 13 + (k * k) % 5) % 3 === 0) ? '1' : '0';
    return out;
  }

  document.querySelectorAll('[data-beam]').forEach((beam) => {
    const columns = parseInt(beam.dataset.columns || '11', 10);
    const frag = document.createDocumentFragment();

    for (let i = 0; i < columns; i++) {
      const col = document.createElement('div');
      col.className = 'beam__col';
      col.style.left = (20 + i * 5.6) + '%';

      const text = document.createElement('div');
      text.className = 'beam__bits';
      text.textContent = bits(i + 1, 34);
      text.style.setProperty('--dur', (3.2 + (i % 4) * 0.7) + 's');
      text.style.setProperty('--delay', (-(i * 0.47)) + 's');

      col.appendChild(text);
      frag.appendChild(col);
    }
    beam.appendChild(frag);
  });
})();


/* 3. Journey =============================================================== */
/**
 * Journey — draws a zigzag path through every waypoint and flies a vehicle
 * (rocket or UFO) along it as the user scrolls. The waypoint closest to the
 * vehicle gets `.is-active`.
 *
 * Markup contract (see index.html):
 *   <section class="journey" data-vehicle="rocket|ufo" data-trail="true|false">
 *     <div data-journey-map>
 *       <svg class="journey__svg"><path data-journey-track/><path data-journey-trail/></svg>
 *       <div data-journey-markers></div>
 *       <ol><li data-stop><article data-card>…</article></li>…</ol>
 *       <div data-journey-vehicle>…</div>
 *     </div>
 *   </section>
 */
(function () {
  'use strict';

  const section = document.querySelector('.journey');
  const map = section && section.querySelector('[data-journey-map]');
  if (!map) return;

  const svg = map.querySelector('.journey__svg');
  const track = map.querySelector('[data-journey-track]');
  const trail = map.querySelector('[data-journey-trail]');
  const markersEl = map.querySelector('[data-journey-markers]');
  const vehicle = map.querySelector('[data-journey-vehicle]');
  const stops = Array.from(map.querySelectorAll('[data-stop]'));

  const NARROW = 760;       // below this, the path hugs the edges and markers hide
  const EASE_POS = 0.09;    // how quickly the vehicle catches up with scroll
  const EASE_ANGLE = 0.12;  // how quickly it turns

  let height = 0, length = 0, samples = [], markers = [];
  let current = 0, angle = -90, forward = true;

  const isUfo = () => section.dataset.vehicle === 'ufo';

  function layout() {
    const width = map.clientWidth;
    height = map.clientHeight;
    const narrow = width < NARROW;

    const points = [{ x: width / 2, y: 0 }];
    markersEl.textContent = '';
    markers = [];

    stops.forEach((stop, i) => {
      const y = stop.offsetTop + stop.offsetHeight / 2;
      const left = i % 2 === 0;
      const x = narrow ? (left ? 36 : width - 36) : (left ? width * 0.2 : width * 0.8);
      points.push({ x, y });

      if (!narrow) {
        const m = document.createElement('span');
        m.className = 'journey__marker';
        m.style.left = x + 'px';
        m.style.top = (y + 92) + 'px';
        m.textContent = String(i + 1).padStart(2, '0');
        markersEl.appendChild(m);
      }
      markers.push(markersEl.lastElementChild && !narrow ? markersEl.lastElementChild : null);
    });
    points.push({ x: width / 2, y: height });

    let d = `M${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p = points[i - 1], q = points[i], dy = q.y - p.y;
      d += ` C${p.x} ${p.y + dy * 0.55} ${q.x} ${q.y - dy * 0.55} ${q.x} ${q.y}`;
    }

    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    track.setAttribute('d', d);
    trail.setAttribute('d', d);
    sample();
    stops.forEach((s) => { s._active = undefined; });
  }

  // Pre-sample the path so we can map a scroll Y to a distance along it.
  function sample() {
    length = trail.getTotalLength();
    const N = 800;
    samples = [];
    for (let i = 0; i <= N; i++) {
      const l = length * i / N;
      samples.push({ l, y: trail.getPointAtLength(l).y });
    }
    trail.style.strokeDasharray = length;
    trail.style.strokeDashoffset = length - current;
  }

  function lengthForY(y) {
    if (!samples.length) return 0;
    let lo = 0, hi = samples.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (samples[mid].y < y) lo = mid + 1; else hi = mid;
    }
    if (lo === 0) return 0;
    const a = samples[lo - 1], b = samples[lo];
    const k = Math.min(1, Math.max(0, (y - a.y) / ((b.y - a.y) || 1)));
    return a.l + (b.l - a.l) * k;
  }

  function tick() {
    if (length) {
      const rect = map.getBoundingClientRect();
      const targetY = Math.min(height, Math.max(0, window.innerHeight * 0.5 - rect.top));
      const diff = lengthForY(targetY) - current;
      if (Math.abs(diff) > 4) forward = diff > 0;
      current += diff * EASE_POS;

      const l = Math.min(length - 1, Math.max(0, current));
      const a = trail.getPointAtLength(l), b = trail.getPointAtLength(l + 1);

      // Rocket points along the path (flips when scrolling back); UFO just tilts.
      const target = isUfo()
        ? Math.max(-22, Math.min(22, (b.x - a.x) * 30))
        : Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 90 + (forward ? 0 : 180);
      angle += (((target - angle + 540) % 360) - 180) * EASE_ANGLE;

      vehicle.style.transform =
        `translate(${a.x - vehicle.offsetWidth / 2}px, ${a.y - vehicle.offsetHeight / 2}px) rotate(${angle}deg)`;
      trail.style.strokeDashoffset = length - current;

      stops.forEach((stop, i) => {
        const cy = stop.offsetTop + stop.offsetHeight / 2;
        const active = Math.abs(cy - a.y) < stop.offsetHeight * 0.42;
        if (stop._active === active) return;
        stop._active = active;
        const card = stop.querySelector('[data-card]');
        if (card) card.classList.toggle('is-active', active);
        if (markers[i]) markers[i].classList.toggle('is-active', active);
      });
    }
    requestAnimationFrame(tick);
  }

  let pending = false;
  const scheduleLayout = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; layout(); });
  };

  new ResizeObserver(scheduleLayout).observe(map);
  if (document.fonts) document.fonts.ready.then(scheduleLayout);
  layout();
  requestAnimationFrame(tick);
})();


/* 4. Copy ================================================================== */
/**
 * Copy to clipboard.
 *
 * Usage: <button data-copy="gem &quot;cosmonats&quot;">
 *          <span data-copy-label>copy</span>
 *        </button>
 * If no [data-copy-label] child exists, the button's own text is swapped.
 */
(function () {
  'use strict';

  const RESET_MS = 1400;

  async function writeClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (_) { /* ignore */ }
      ta.remove();
    }
  }

  document.querySelectorAll('[data-copy]').forEach((btn) => {
    const label = btn.querySelector('[data-copy-label]') || btn;
    const original = label.textContent;
    let timer;

    btn.addEventListener('click', async () => {
      await writeClipboard(btn.dataset.copy);
      label.textContent = 'copied ✓';
      clearTimeout(timer);
      timer = setTimeout(() => { label.textContent = original; }, RESET_MS);
    });
  });
})();


/* 5. Reading progress ====================================================== */
/**
 * Reading progress bar.
 *
 * Usage: <div class="reading-progress" data-reading-progress></div>
 */
(function () {
  'use strict';

  const bar = document.querySelector('[data-reading-progress]');
  if (!bar) return;

  let ticking = false;
  function update() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
