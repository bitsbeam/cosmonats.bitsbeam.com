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
 *   3. Journey           [data-journey-map]          cosmonaut + tether floating along the waypoint path
 *   4. Copy              [data-copy]                 copy-to-clipboard buttons
 *   5. Reading progress  [data-reading-progress]     progress bar on posts
 *   6. Docs nav          [data-docs-nav]             collapsible sidebar on docs pages
 *   7. Reduced motion    svg                         pauses SVG animations when the user asks for less motion
 *
 * (Pure CSS, no JS: the bitsbeam beam digits + cow-abduction / moo / blink sequence,
 *  and the cosmonats waypoint-card reveal — see application.css.)
 */


/* 1. Starfield ============================================================= */
/**
 * Starfield — twinkling, parallax stars with the occasional shooting star.
 *
 * Usage: <canvas class="starfield" data-starfield
 *                data-density="1" data-parallax="0.25" data-shooting-stars="true"></canvas>
 *
 * Performance: stars are batched by colour and brightness level, so a frame is
 * ~40 fill calls instead of one per star; tiny stars are squares, not arcs.
 */
(function () {
  'use strict';

  const COLORS = ['255,255,255', '255,255,255', '255,255,255', '190,240,255', '255,214,170'];
  const PALETTE = ['255,255,255', '190,240,255', '255,214,170'];
  const LEVELS = 12;   // brightness steps per colour
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STYLES = PALETTE.map((c) => Array.from({ length: LEVELS }, (_, k) => `rgba(${c},${((k + 0.5) / LEVELS).toFixed(3)})`));

  function createStarfield(canvas) {
    const ctx = canvas.getContext('2d');
    const density = parseFloat(canvas.dataset.density || '1');
    const parallax = parseFloat(canvas.dataset.parallax || '0.25');
    const shootingStars = canvas.dataset.shootingStars !== 'false' && !reduceMotion;
    let stars = [], shooting = null, w = 0, h = 0;
    const buckets = PALETTE.map(() => Array.from({ length: LEVELS }, () => []));

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((w * h) / 3200 * density);
      stars = Array.from({ length: count }, () => {
        const r = Math.random() < 0.08 ? 1.6 + Math.random() : 0.4 + Math.random() * 0.9;
        return {
          x: Math.random() * w, y: Math.random() * h,
          depth: 0.1 + Math.random() * 0.9, r,
          phase: Math.random() * Math.PI * 2, speed: 0.5 + Math.random() * 2,
          tw: r > 1.5 ? 0.35 : 0.21,
          c: PALETTE.indexOf(COLORS[(Math.random() * COLORS.length) | 0])
        };
      });
    }

    function draw(t) {
      const sy = window.scrollY;
      const time = reduceMotion ? 0 : t / 1000;
      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        const a = Math.max(0.08, (0.45 + Math.sin(time * s.speed + s.phase) * s.tw) * (0.5 + s.depth * 0.5));
        s.py = (((s.y - sy * s.depth * parallax) % h) + h) % h;
        buckets[s.c][Math.min(LEVELS - 1, (a * LEVELS) | 0)].push(s);
      }
      for (let c = 0; c < PALETTE.length; c++) for (let k = 0; k < LEVELS; k++) {
        const list = buckets[c][k];
        if (!list.length) continue;
        ctx.fillStyle = STYLES[c][k];
        ctx.beginPath();
        for (const s of list) {
          if (s.r < 1.2) { const d = s.r * 1.8; ctx.rect(s.x - d / 2, s.py - d / 2, d, d); }
          else {
            ctx.moveTo(s.x + s.r, s.py); ctx.arc(s.x, s.py, s.r, 0, Math.PI * 2);
            if (s.r > 1.6) {      // four-point sparkle on the brightest stars
              ctx.rect(s.x - s.r * 2.5, s.py - 0.4, s.r * 5, 0.8);
              ctx.rect(s.x - 0.4, s.py - s.r * 2.5, 0.8, s.r * 5);
            }
          }
        }
        ctx.fill();
        list.length = 0;
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


/* 3. Journey =============================================================== */
/**
 * Journey — draws a zigzag path through every waypoint. A cosmonaut drifts
 * along it as the user scrolls, wandering widely (±150px) and tumbling around the line,
 * trailing a tether that starts in the void behind him and sways in slow waves.
 * The marker nearest to him gets `.is-active`.
 *
 * Performance: one transform write + two short path writes per frame, no layout
 * reads in the loop (positions are computed, not measured), and the loop only
 * runs while the section is on screen.
 *
 * Markup contract (see cosmonats-web/index.html):
 *   <div data-journey-map>
 *     <svg class="journey__svg"> … <path data-journey-track/>
 *       <linearGradient data-journey-fade/>×2
 *       <path data-journey-tether-edge/><path data-journey-tether/> </svg>
 *     <div data-journey-markers></div>
 *     <ol><li data-stop>…</li>…</ol>
 *     <div data-journey-cosmonaut>…</div>
 *   </div>
 */
(function () {
  'use strict';

  const map = document.querySelector('[data-journey-map]');
  if (!map) return;

  const svg = map.querySelector('.journey__svg');
  const track = map.querySelector('[data-journey-track]');
  const tether = map.querySelector('[data-journey-tether]');
  const tetherEdge = map.querySelector('[data-journey-tether-edge]');
  const fades = Array.from(map.querySelectorAll('[data-journey-fade]'));
  const markersEl = map.querySelector('[data-journey-markers]');
  const astro = map.querySelector('[data-journey-cosmonaut]');
  const stops = Array.from(map.querySelectorAll('[data-stop]'));
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const NARROW = 760;     // below this, the path hugs the edges and markers hide
  const EASE_POS = 0.07;  // how lazily he catches up with the scroll (zero-g = unhurried)
  const STEP = 8;         // path sampling resolution, px
  const TETHER = 650;     // visible tether length behind him, px of path
  const BELT = [-0.03, 0.03]; // tether hook, relative to his size, from his centre

  let height = 0, length = 0, pts = [], markers = [], stopY = [], active = -1;
  let mapTop = 0, mapW = 0, w = 0, h = 0, current = 0, running = false;

  function layout() {
    const width = map.clientWidth;
    height = map.clientHeight;
    const narrow = width < NARROW;

    const points = [{ x: width / 2, y: 0 }];
    markersEl.textContent = '';
    markers = []; stopY = []; active = -1;
    stops.forEach((stop, i) => {
      const y = stop.offsetTop + stop.offsetHeight / 2;
      const left = i % 2 === 0;
      const x = narrow ? (left ? 36 : width - 36) : (left ? width * 0.2 : width * 0.8);
      points.push({ x, y });
      stopY.push([y, stop.offsetHeight * 0.42]);
      let m = null;
      if (!narrow) {
        m = document.createElement('span');
        m.className = 'journey__marker';
        m.style.left = x + 'px';
        m.style.top = (y + 92) + 'px';
        m.textContent = String(i + 1).padStart(2, '0');
        markersEl.appendChild(m);
      }
      markers.push(m);
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

    length = track.getTotalLength();
    pts = [];
    for (let l = 0; l <= length; l += STEP) {
      const a = track.getPointAtLength(l), b = track.getPointAtLength(Math.min(length, l + 1));
      const dx = b.x - a.x, dy = b.y - a.y, n = Math.hypot(dx, dy) || 1;
      pts.push({ l, x: a.x, y: a.y, nx: -dy / n, ny: dx / n });
    }
    mapTop = map.getBoundingClientRect().top + window.scrollY;
    w = astro.offsetWidth; h = astro.offsetHeight; mapW = width;
  }

  // point on the path at length l, interpolated between samples (no snapping → no twitch at slow speeds)
  function at(l) {
    const f = Math.max(0, Math.min(pts.length - 1, l / STEP)), i = Math.min(pts.length - 2, f | 0), k = f - i;
    const a = pts[i], b = pts[i + 1] || a;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, nx: a.nx + (b.nx - a.nx) * k, ny: a.ny + (b.ny - a.ny) * k };
  }
  const smooth = (k) => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);

  function lengthForY(y) {   // first point on the path at this height (the path only goes down)
    let lo = 0, hi = pts.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (pts[mid].y < y) lo = mid + 1; else hi = mid; }
    if (lo === 0) return 0;
    const a = pts[lo - 1], b = pts[lo];
    return a.l + (b.l - a.l) * Math.min(1, Math.max(0, (y - a.y) / ((b.y - a.y) || 1)));
  }

  function frame(now) {
    if (!running) return;
    const t = still ? 0 : now / 1000;

    const targetY = Math.min(height, Math.max(0, window.innerHeight * 0.5 - (mapTop - window.scrollY)));
    const goal = lengthForY(targetY);
    current += (goal - current) * EASE_POS;
    if (Math.abs(goal - current) < 0.05) current = goal;   // settle exactly, no endless sub-pixel creep
    const p = at(current);

    // free zero-g wander around the path + tumble (unrelated periods, so it never visibly repeats);
    // scaled down on narrow screens and kept inside the map so he never drifts off-screen
    const sc = Math.min(1, mapW / 1200);
    const fx = sc * (110 * Math.sin(t * 0.31) + 42 * Math.sin(t * 0.87 + 1.7));
    const fy = sc * (72 * Math.sin(t * 0.47 + 2.1) + 26 * Math.sin(t * 1.21 + 0.4));
    const ang = 26 * Math.sin(t * 0.23) + 10 * Math.sin(t * 0.67 + 1.1);
    const cx = Math.min(mapW - w / 2 - 8, Math.max(w / 2 + 8, p.x + fx)), cy = p.y + fy;
    astro.style.transform = `translate3d(${(cx - w / 2).toFixed(2)}px, ${(cy - h / 2).toFixed(2)}px, 0) rotate(${ang.toFixed(2)}deg)`;

    // belt hook, rotated with him
    const r = ang * Math.PI / 180, bx = BELT[0] * w, by = BELT[1] * h;
    const hx = cx + bx * Math.cos(r) - by * Math.sin(r), hy = cy + bx * Math.sin(r) + by * Math.cos(r);

    // tether: the last TETHER px of path behind him, swaying, hooked onto the belt at the near end
    const L1 = current, L0 = Math.max(0, L1 - TETHER), span = L1 - L0;
    const pe = at(L1), dx = hx - pe.x, dy = hy - pe.y;
    const n = Math.max(4, Math.ceil(span / 22));
    let d = '', prev = null;
    for (let i = 0; i <= n; i++) {
      const u = i / n, l = L0 + span * u, q = at(l);
      const sway = still ? 0 : (34 * Math.sin(l / 120 - t * 0.9) + 14 * Math.sin(l / 47 + t * 0.6)) * Math.sin(Math.PI * Math.min(1, u * 1.15));
      const k = smooth((u - 0.35) / 0.65);            // drift towards the hook over the near two-thirds
      const x = q.x + q.nx * sway + dx * k, y = q.y + q.ny * sway + dy * k;
      if (i === 0) d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
      else if (i === n) d += ` L${hx.toFixed(1)} ${hy.toFixed(1)}`;
      else d += ` Q${prev[0].toFixed(1)} ${prev[1].toFixed(1)} ${((prev[0] + x) / 2).toFixed(1)} ${((prev[1] + y) / 2).toFixed(1)}`;
      prev = [x, y];
    }
    tether.setAttribute('d', d);
    tetherEdge.setAttribute('d', d);
    const g = [d.slice(1, d.indexOf(' Q')).split(' '), hx.toFixed(0), hy.toFixed(0)];  // gradient: far end → hook
    for (const f of fades) { f.setAttribute('x1', g[0][0]); f.setAttribute('y1', g[0][1]); f.setAttribute('x2', g[1]); f.setAttribute('y2', g[2]); }

    // active marker: only touch the DOM when it changes
    let idx = -1;
    for (let i = 0; i < stopY.length; i++) if (Math.abs(stopY[i][0] - p.y) < stopY[i][1]) { idx = i; break; }
    if (idx !== active) {
      if (markers[active]) markers[active].classList.remove('is-active');
      if (markers[idx]) markers[idx].classList.add('is-active');
      active = idx;
    }
    requestAnimationFrame(frame);
  }

  let pending = false;
  const scheduleLayout = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; layout(); });
  };
  new ResizeObserver(scheduleLayout).observe(map);
  window.addEventListener('resize', scheduleLayout);
  if (document.fonts) document.fonts.ready.then(scheduleLayout);
  layout();
  current = lengthForY(Math.max(0, window.innerHeight * 0.5 - (mapTop - window.scrollY)));

  // only animate while the section is on screen
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !running) { running = true; requestAnimationFrame(frame); }
    else if (!e.isIntersecting) running = false;
  }, { rootMargin: '200px 0px' }).observe(map);
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


/* 6. Docs nav ============================================================== */
/**
 * Collapses the docs sidebar into a menu on narrow screens.
 *
 * Usage: <details class="docs-nav" open data-docs-nav>…</details>
 */
(function () {
  'use strict';

  const nav = document.querySelector('[data-docs-nav]');
  if (!nav) return;

  const narrow = window.matchMedia('(max-width: 860px)');
  const sync = () => { nav.open = !narrow.matches; };
  narrow.addEventListener('change', sync);
  sync();
})();


/* 7. Reduced motion for SVG animations ========================================= */
/* CSS can't pause SVG <animate> elements, so honour prefers-reduced-motion here. */
(function () {
  'use strict';
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('svg').forEach((s) => s.pauseAnimations && s.pauseAnimations());
})();
