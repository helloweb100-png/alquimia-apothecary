/* =====================================================================
   ALQUIMIA APOTHECARY · script.js
   Capa de interacción de la landing. Mobile first, sin dependencias
   obligatorias: anime.js (cdnjs 3.2.2) solo mejora el panal; si la CDN
   falla, la página se ve y funciona completa.

   Módulos (cada uno va aislado: si uno falla, los demás siguen):
   1. Cargador con contador          8. Imagen que se abre (scroll)
   2. Encabezado, menú y progreso    9. Proceso + matraz que se llena
   3. Revelado al hacer scroll      10. Panal de ingredientes (anime.js)
   4. Hero: molécula 3D en canvas   11. Preguntas frecuentes
   5. Manifiesto (texto que se      12. Contacto y WhatsApp
      ilumina con el scroll)        13. Imán, tilt y cursor
   6. Prisma 3D de servicios        14. Cinta que acelera con el scroll
   7. Casa de marcas + carrusel 3D
   ===================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------
     WhatsApp: ÚNICO lugar donde vive el número (lada 52 + 10 dígitos).
     Si se deja vacío, el botón flotante y los envíos se ocultan solos.
     --------------------------------------------------------------- */
  const WHATSAPP_NUMBER = '523314959287';

  /* ---------- Utilidades ---------- */
  const root = document.documentElement;
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const pad2 = (n) => String(n).padStart(2, '0');
  const mq = (q) => (window.matchMedia ? window.matchMedia(q) : { matches: false });

  const reduced = mq('(prefers-reduced-motion: reduce)').matches;
  const finePointer = mq('(hover: hover) and (pointer: fine)').matches;
  const isDesktop = () => mq('(min-width: 960px)').matches;

  let vh = window.innerHeight;
  const scrollFns = []; // se ejecutan cuando hay scroll o resize
  const tickFns = []; // se ejecutan en cada fotograma
  let dirty = true;

  const safe = (fn) => {
    try { fn(); } catch (err) { if (window.console) console.error('[Alquimia]', err); }
  };

  /* Observa cuándo un elemento entra o sale de pantalla (true por defecto sin IO) */
  function watch(el, cb, margin) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    new IntersectionObserver((es) => cb(es[es.length - 1].isIntersecting), { rootMargin: margin || '120px 0px' }).observe(el);
  }

  /* Envuelve palabras en <span> conservando los <em> y los espacios */
  function wrapWords(el, cls, nested) {
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((ch) => {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = cls;
            if (nested) {
              const inner = document.createElement('span');
              inner.className = cls + '__i';
              inner.style.setProperty('--wi', i);
              inner.textContent = part;
              w.appendChild(inner);
            } else {
              w.textContent = part;
            }
            i++;
            frag.appendChild(w);
          });
          node.replaceChild(frag, ch);
        } else if (ch.nodeType === 1) {
          walk(ch);
        }
      });
    };
    walk(el);
  }

  /* =================================================================
     1. CARGADOR · cuenta de 000 a 100 y se abre como un obturador.
        Total ≤ 2.5 s. Respaldo en CSS por si este script fallara.
     ================================================================= */
  function initLoader() {
    const loader = $('#cargador');
    const num = $('#cargadorNum');
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (loader) {
        if (num) num.textContent = '100';
        loader.classList.add('is-done');
        loader.style.pointerEvents = 'none';
        setTimeout(() => loader.classList.add('is-gone'), 850);
      }
      root.classList.add('is-ready');
    };

    if (!loader || reduced) { finish(); return; }

    const DURATION = 1450;
    let t0 = null;
    const tick = (now) => {
      if (finished) return;
      if (t0 === null) t0 = now;
      const p = clamp((now - t0) / DURATION);
      const eased = 1 - Math.pow(1 - p, 2.2);
      if (num) num.textContent = String(Math.round(eased * 100)).padStart(3, '0');
      if (p < 1) requestAnimationFrame(tick); else finish();
    };
    requestAnimationFrame(tick);
    setTimeout(finish, 1600); // tope duro: aunque el fotograma se pause
  }

  /* =================================================================
     2. ENCABEZADO · estado al hacer scroll, menú móvil, progreso y
        resaltado de la sección activa
     ================================================================= */
  function initHeader() {
    const header = $('#siteHeader');
    const burger = $('#burger');
    const nav = $('#nav');
    const bar = $('#progressBar');
    if (!header) return;

    const setMenu = (open) => {
      header.classList.toggle('menu-open', open);
      document.body.classList.toggle('menu-open-lock', open);
      if (burger) {
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      }
    };
    if (burger) burger.addEventListener('click', () => setMenu(!header.classList.contains('menu-open')));
    if (nav) nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    window.addEventListener('resize', () => { if (isDesktop()) setMenu(false); });

    const links = $$('.nav__list a');
    const sections = links.map((a) => $(a.getAttribute('href')));

    scrollFns.push((y) => {
      header.classList.toggle('is-scrolled', y > 24);
      if (bar) {
        const max = root.scrollHeight - vh;
        bar.style.transform = 'scaleX(' + (max > 0 ? clamp(y / max).toFixed(4) : 0) + ')';
      }
      const line = vh * 0.35;
      links.forEach((a, i) => {
        const s = sections[i];
        if (!s) return;
        const r = s.getBoundingClientRect();
        if (r.top <= line && r.bottom > line) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    });
  }

  /* =================================================================
     3. REVELADO AL HACER SCROLL · [data-r]
        Todo queda visible: lo que ya quedó arriba se revela igual.
     ================================================================= */
  function initReveal() {
    let pending = $$('[data-r]');
    const show = (el) => {
      el.classList.add('is-in');
      const d = parseFloat(el.style.getPropertyValue('--d')) || 0;
      setTimeout(() => el.classList.add('r-end'), 1500 + d);
    };
    const check = () => {
      if (!pending.length) return;
      pending = pending.filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < vh * 0.93 || r.bottom < 0) { show(el); return false; }
        return true;
      });
    };
    if (reduced) { pending.forEach(show); pending = []; return; }
    scrollFns.push(check);
  }

  /* =================================================================
     4. HERO · titular por palabras, parallax y molécula 3D en canvas
     ================================================================= */
  function initHero() {
    const hero = $('#inicio');
    if (!hero) return;

    $$('[data-split]').forEach((el) => wrapWords(el, 'w', true));

    scrollFns.push((y) => {
      hero.style.setProperty('--hp', clamp(y / Math.max(1, hero.offsetHeight)).toFixed(3));
    });

    if (finePointer && !reduced) {
      window.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        hero.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
        hero.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
      }, { passive: true });
    }

    safe(() => initMolecule(hero));
  }

  /* Molécula de coroneno (7 anillos hexagonales) con órbitas, electrones
     y partículas. Proyección 3D propia sobre canvas 2D. */
  function initMolecule(hero) {
    const canvas = $('#molecule');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const D = 16; // distancia de cámara
    let W = 0, H = 0, CX = 0, CY = 0, S = 40, DPR = 1;
    let visible = true;
    let readyAt = 0;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

    /* --- Geometría --- */
    const SQ3 = Math.sqrt(3);
    const atoms = [];
    const lookup = {};
    const addAtom = (x, y, type) => {
      const key = x.toFixed(3) + ',' + y.toFixed(3);
      if (key in lookup) return lookup[key];
      atoms.push({ x: x, y: y, z: Math.sin(x * 1.2) * Math.cos(y * 1.1) * 0.22, type: type });
      lookup[key] = atoms.length - 1;
      return lookup[key];
    };
    const centers = [[0, 0]];
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; centers.push([Math.cos(a) * SQ3, Math.sin(a) * SQ3]); }

    const bonds = [];
    const seen = {};
    const addBond = (a, b, h) => {
      const key = Math.min(a, b) + '-' + Math.max(a, b);
      if (seen[key]) return;
      seen[key] = 1;
      bonds.push({ a: a, b: b, h: h });
    };
    centers.forEach((c) => {
      const ids = [];
      for (let j = 0; j < 6; j++) {
        const a = Math.PI / 6 + j * Math.PI / 3;
        ids.push(addAtom(c[0] + Math.cos(a), c[1] + Math.sin(a), 'C'));
      }
      for (let j = 0; j < 6; j++) addBond(ids[j], ids[(j + 1) % 6], false);
    });
    const deg = atoms.map(() => 0);
    bonds.forEach((b) => { deg[b.a]++; deg[b.b]++; });
    const carbons = atoms.length;
    for (let i = 0; i < carbons; i++) {
      if (deg[i] !== 2) continue;
      const at = atoms[i];
      const len = Math.hypot(at.x, at.y) || 1;
      const h = addAtom(at.x + (at.x / len) * 0.82, at.y + (at.y / len) * 0.82, 'H');
      atoms[h].z = at.z;
      addBond(i, h, true);
    }
    const arom = centers.map((c) => ({ x: c[0], y: c[1], z: Math.sin(c[0] * 1.2) * Math.cos(c[1] * 1.1) * 0.22 }));

    /* Órbitas con electrones */
    const orbits = [
      { R: 4.9, tx: 1.15, tz: 0.3, sp: 0.00055, n: 3, ph: 0 },
      { R: 5.7, tx: -0.8, tz: -0.65, sp: -0.0004, n: 2, ph: 1.3 }
    ];
    const orbitPoint = (o, th, out) => {
      const x0 = o.R * Math.cos(th), y0 = o.R * Math.sin(th);
      const y1 = y0 * Math.cos(o.tx), z1 = y0 * Math.sin(o.tx);
      out.x = x0 * Math.cos(o.tz) - y1 * Math.sin(o.tz);
      out.y = x0 * Math.sin(o.tz) + y1 * Math.cos(o.tz);
      out.z = z1;
      return out;
    };
    const SEG = 72;
    orbits.forEach((o) => {
      o.pts = [];
      for (let i = 0; i <= SEG; i++) o.pts.push(orbitPoint(o, (i / SEG) * Math.PI * 2, { x: 0, y: 0, z: 0 }));
      o.pp = o.pts.map(() => ({ x: 0, y: 0, z: 0, k: 1 }));
    });

    /* Partículas que suben como burbujas */
    const motes = [];
    for (let i = 0; i < 46; i++) {
      motes.push({
        x: (Math.random() - 0.5) * 13, y: (Math.random() - 0.5) * 11, z: (Math.random() - 0.5) * 9,
        v: 0.0003 + Math.random() * 0.0006, r: 0.035 + Math.random() * 0.07, ph: Math.random() * 6.28
      });
    }

    /* --- Sprites pre-renderizados --- */
    const sprite = (stops, edge) => {
      const c = document.createElement('canvas');
      c.width = c.height = 96;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(34, 30, 4, 48, 48, 46);
      stops.forEach((s) => grad.addColorStop(s[0], s[1]));
      g.fillStyle = grad;
      g.beginPath(); g.arc(48, 48, 46, 0, Math.PI * 2); g.fill();
      if (edge) { g.strokeStyle = edge; g.lineWidth = 2; g.stroke(); }
      return c;
    };
    const sprC = sprite([[0, '#d6f1fd'], [0.28, '#3AAEE5'], [0.7, '#0081BC'], [1, '#043A56']]);
    const sprH = sprite([[0, '#ffffff'], [0.55, '#eef4f7'], [1, '#aebfc9']], 'rgba(4,58,86,.28)');
    const sprGlow = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(58,174,229,.95)'); grad.addColorStop(0.4, 'rgba(10,155,225,.35)'); grad.addColorStop(1, 'rgba(10,155,225,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
      return c;
    })();

    /* --- Tamaño --- */
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      CX = W * 0.5; CY = H * 0.5;
      S = (Math.min(W, H) * 0.5) / 5.4;
      if (reduced) draw(4200);
    };
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);

    if (finePointer && !reduced) {
      window.addEventListener('pointermove', (e) => {
        mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
    }
    watch(hero, (v) => { visible = v; });

    /* --- Proyección --- */
    const P = atoms.map(() => ({ x: 0, y: 0, z: 0, k: 1 }));
    let m = null;
    const proj = (x, y, z, o) => {
      const x1 = x * m.cz - y * m.sz, y1 = x * m.sz + y * m.cz;
      const y2 = y1 * m.cx - z * m.sx, z2 = y1 * m.sx + z * m.cx;
      const x3 = x1 * m.cy + z2 * m.sy, z3 = -x1 * m.sy + z2 * m.cy;
      const k = D / (D - z3);
      o.x = CX + x3 * S * m.scale * k;
      o.y = CY + y2 * S * m.scale * k;
      o.z = z3; o.k = k;
      return o;
    };
    const depth = (z) => clamp((z + 5) / 10);

    function draw(t) {
      if (!W) return;
      let k = 1;
      if (!reduced) {
        if (!readyAt) { if (root.classList.contains('is-ready')) readyAt = t; else k = 0; }
        if (readyAt) k = smooth(clamp((t - readyAt) / 1700));
      }
      mouse.x = lerp(mouse.x, mouse.tx, 0.05);
      mouse.y = lerp(mouse.y, mouse.ty, 0.05);
      const ry = t * 0.00032 + mouse.x * 0.55 + (window.scrollY || 0) * 0.0014;
      const rx = 1.0 + Math.sin(t * 0.0004) * 0.18 + mouse.y * 0.3;
      const rz = t * 0.00012;
      m = {
        cy: Math.cos(ry), sy: Math.sin(ry), cx: Math.cos(rx), sx: Math.sin(rx), cz: Math.cos(rz), sz: Math.sin(rz),
        scale: 0.8 + 0.2 * k
      };

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (k <= 0) return;
      ctx.globalAlpha = k;
      ctx.lineCap = 'round';

      /* resplandor central */
      const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, S * 5.6);
      g.addColorStop(0, 'rgba(10,155,225,.2)'); g.addColorStop(1, 'rgba(10,155,225,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      const items = [];
      atoms.forEach((a, i) => proj(a.x, a.y, a.z, P[i]));

      /* órbitas: tramo trasero (antes de la molécula) */
      orbits.forEach((o) => { o.pts.forEach((p, i) => proj(p.x, p.y, p.z, o.pp[i])); });
      const drawOrbit = (front) => {
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = front ? 'rgba(0,129,188,.55)' : 'rgba(0,129,188,.2)';
        ctx.beginPath();
        orbits.forEach((o) => {
          for (let i = 0; i < SEG; i++) {
            const a = o.pp[i], b = o.pp[i + 1];
            if (((a.z + b.z) / 2 >= 0) === front) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
          }
        });
        ctx.stroke();
      };
      drawOrbit(false);

      /* enlaces, anillos aromáticos, átomos, electrones y partículas */
      bonds.forEach((b) => {
        const a = P[b.a], c = P[b.b];
        items.push({ t: 0, z: (a.z + c.z) / 2 - 0.01, a: a, c: c, h: b.h });
      });
      atoms.forEach((a, i) => items.push({ t: 1, z: P[i].z, p: P[i], type: a.type }));
      arom.forEach((c) => {
        const pts = [];
        for (let i = 0; i < 20; i++) {
          const th = (i / 20) * Math.PI * 2;
          const o = proj(c.x + Math.cos(th) * 0.5, c.y + Math.sin(th) * 0.5, c.z, { x: 0, y: 0, z: 0, k: 1 });
          pts.push(o);
        }
        items.push({ t: 2, z: pts[0].z, pts: pts });
      });
      orbits.forEach((o) => {
        for (let j = 0; j < o.n; j++) {
          const th = o.ph + t * o.sp * 5 + (j * Math.PI * 2) / o.n;
          const w = orbitPoint(o, th, { x: 0, y: 0, z: 0 });
          const e = proj(w.x, w.y, w.z, { x: 0, y: 0, z: 0, k: 1 });
          items.push({ t: 3, z: e.z, p: e });
        }
      });
      motes.forEach((mo) => {
        if (!reduced) {
          mo.y -= mo.v * 16;
          if (mo.y < -5.6) { mo.y = 5.6; mo.x = (Math.random() - 0.5) * 13; }
        }
        const e = proj(mo.x + Math.sin(t * 0.0008 + mo.ph) * 0.2, mo.y, mo.z, { x: 0, y: 0, z: 0, k: 1 });
        items.push({ t: 4, z: e.z, p: e, r: mo.r });
      });

      items.sort((a, b) => a.z - b.z);
      const s = S * m.scale;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const d = depth(it.z);
        if (it.t === 0) {
          ctx.strokeStyle = 'rgba(29,26,27,' + (it.h ? 0.16 + d * 0.3 : 0.24 + d * 0.5).toFixed(3) + ')';
          ctx.lineWidth = Math.max(1, s * (it.h ? 0.028 : 0.05) * ((it.a.k + it.c.k) / 2));
          ctx.beginPath(); ctx.moveTo(it.a.x, it.a.y); ctx.lineTo(it.c.x, it.c.y); ctx.stroke();
        } else if (it.t === 1) {
          const r = s * (it.type === 'C' ? 0.3 : 0.19) * it.p.k;
          ctx.globalAlpha = k * (0.55 + 0.45 * d);
          ctx.drawImage(it.type === 'C' ? sprC : sprH, it.p.x - r, it.p.y - r, r * 2, r * 2);
          ctx.globalAlpha = k;
        } else if (it.t === 2) {
          ctx.strokeStyle = 'rgba(0,129,188,' + (0.25 + d * 0.4).toFixed(3) + ')';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          it.pts.forEach((p, n) => { if (n) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
          ctx.closePath(); ctx.stroke();
        } else if (it.t === 3) {
          const r = s * 0.5 * it.p.k;
          ctx.drawImage(sprGlow, it.p.x - r, it.p.y - r, r * 2, r * 2);
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(it.p.x, it.p.y, Math.max(1.6, s * 0.06 * it.p.k), 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(10,155,225,' + (0.15 + d * 0.5).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(it.p.x, it.p.y, Math.max(1, s * it.r * it.p.k), 0, Math.PI * 2); ctx.fill();
        }
      }
      drawOrbit(true);
      ctx.globalAlpha = 1;
    }

    resize();
    if (!reduced) tickFns.push((t) => { if (visible && !document.hidden) draw(t); });
  }

  /* =================================================================
     5. MANIFIESTO · el texto se ilumina palabra por palabra y el
        hexágono de fondo gira con el scroll
     ================================================================= */
  function initManifesto() {
    const sec = $('#manifiesto');
    const text = $('#manifestoText');
    if (!sec || !text) return;
    wrapWords(text, 'wd', false);
    const words = $$('.wd', text);

    scrollFns.push(() => {
      const r = sec.getBoundingClientRect();
      sec.style.setProperty('--mr', (clamp((vh - r.top) / (vh + r.height)) * 70 - 15).toFixed(1) + 'deg');

      const tr = text.getBoundingClientRect();
      const start = vh * 0.82, end = vh * 0.38;
      const p = reduced ? 1 : clamp((start - tr.top) / (tr.height + start - end));
      const on = Math.round(p * words.length);
      for (let i = 0; i < words.length; i++) words[i].classList.toggle('is-on', i < on);
    });
  }

  /* =================================================================
     6. PRISMA DE SERVICIOS · sección fijada: el scroll gira un prisma
        3D de seis caras y cambia la disciplina activa
     ================================================================= */
  function initPrisma() {
    const sec = $('#servicios');
    const rot = $('#prismRot');
    const tilt = $('.prism__tilt');
    const services = $$('#prismaList .service');
    const dots = $$('#prismaNav button');
    if (!sec || !rot || !services.length) return;

    let target = 0, cur = 0, active = 0, visible = false;

    const setActive = (i) => {
      if (i === active) return;
      active = i;
      services.forEach((s, n) => s.classList.toggle('is-active', n === i));
      dots.forEach((d, n) => d.classList.toggle('is-active', n === i));
    };

    dots.forEach((d, i) => d.addEventListener('click', () => {
      const r = sec.getBoundingClientRect();
      const top = r.top + window.scrollY + ((i + 0.5) / services.length) * (r.height - vh);
      window.scrollTo({ top: top, behavior: reduced ? 'auto' : 'smooth' });
    }));

    if (reduced) return; // el CSS ya muestra todos los servicios en lista

    scrollFns.push(() => {
      const r = sec.getBoundingClientRect();
      visible = r.bottom > 0 && r.top < vh;
      const total = r.height - vh;
      const p = total > 0 ? clamp(-r.top / total) : 0;
      const n = services.length;
      const u = clamp(p * n - 0.5, 0, n - 1);
      const i = Math.floor(u);
      const f = u - i;
      const t = i >= n - 1 ? 0 : smooth(clamp((f - 0.35) / 0.65));
      target = -(i + t) * 60;
      setActive(clamp(Math.round(i + t), 0, n - 1));
    });

    tickFns.push((t) => {
      if (!visible) return;
      cur = lerp(cur, target, 0.085);
      rot.style.transform = 'rotateY(' + (cur + Math.sin(t / 1900) * 5).toFixed(2) + 'deg)';
      if (tilt) tilt.style.transform = 'rotateX(' + (-13 + Math.sin(t / 2400) * 3).toFixed(2) + 'deg)';
    });
  }

  /* =================================================================
     7. CASA DE MARCAS (tarjetas apiladas) y CARRUSEL 3D DE PRODUCTOS
     ================================================================= */
  function initBrands() {
    const brands = $$('.brand');
    if (!brands.length) return;
    scrollFns.push(() => {
      const desk = isDesktop();
      brands.forEach((b, i) => {
        const br = b.getBoundingClientRect();
        let cov = 0;
        const next = brands[i + 1];
        if (desk && next && !reduced) {
          const nr = next.getBoundingClientRect();
          cov = clamp((br.top + b.offsetHeight - nr.top) / Math.max(1, b.offsetHeight - 26));
        }
        b.style.setProperty('--cov', cov.toFixed(3));
        const pc = clamp((vh - br.top) / (vh * 0.9));
        b.style.setProperty('--rot', ((1 - easeIO(pc)) * (i % 2 ? -3 : 3)).toFixed(2) + 'deg');
      });
    });
  }

  function initRing() {
    const stage = $('#ringStage');
    const ring = $('#ring');
    if (!stage || !ring) return;
    const items = $$('.ring__item', ring);
    const details = $$('#pdetails .pdetail');
    const count = $('#ringCount');
    const N = items.length;
    const STEP = 360 / N;

    let angle = 0, target = 0, current = 0;
    let down = false, drag = false, startX = 0, lastX = 0, lastT = 0, vel = 0, pid = null;
    let hover = false, idle = 0, visible = false;

    let applied = null;
    const apply = () => {
      const v = angle.toFixed(2);
      if (v === applied) return; // no repinta si no se movió
      applied = v;
      ring.style.setProperty('--ry', v + 'deg');
    };
    const indexOf = (a) => ((Math.round(-a / STEP) % N) + N) % N;
    const show = () => {
      const i = indexOf(target);
      if (i === current) return;
      current = i;
      details.forEach((d, n) => d.classList.toggle('is-active', n === i));
      if (count) count.textContent = pad2(i + 1) + ' / ' + pad2(N);
    };
    const go = (dir) => { target -= dir * STEP; idle = 0; show(); };
    const goTo = (i) => {
      const base = -i * STEP;
      target = base + Math.round((target - base) / 360) * 360;
      idle = 0; show();
    };

    stage.setAttribute('tabindex', '0');
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    });
    stage.addEventListener('pointerdown', (e) => {
      down = true; drag = false; startX = lastX = e.clientX; lastT = performance.now(); vel = 0; pid = e.pointerId;
    });
    window.addEventListener('pointermove', (e) => {
      if (!down) return;
      if (!drag && Math.abs(e.clientX - startX) > 6) {
        drag = true;
        stage.classList.add('is-drag');
        try { stage.setPointerCapture(pid); } catch (err) { /* sin captura */ }
      }
      if (!drag) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      vel = lerp(vel, dx / Math.max(1, now - lastT), 0.4);
      lastX = e.clientX; lastT = now;
      angle += dx * 0.32; target = angle; idle = 0; show();
    });
    const release = (e) => {
      if (!down) return;
      down = false;
      if (drag) {
        drag = false;
        stage.classList.remove('is-drag');
        target = Math.round((angle + vel * 70) / STEP) * STEP;
        show();
      } else if (e && e.target && e.target.closest) {
        const it = e.target.closest('.ring__item');
        if (it) goTo(parseInt(it.style.getPropertyValue('--i'), 10) || 0);
      }
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    stage.addEventListener('pointerenter', () => { hover = true; });
    stage.addEventListener('pointerleave', () => { hover = false; });
    stage.addEventListener('focusin', () => { hover = true; });
    stage.addEventListener('focusout', () => { hover = false; });

    const prev = $('#ringPrev'), next = $('#ringNext');
    if (prev) prev.addEventListener('click', () => go(-1));
    if (next) next.addEventListener('click', () => go(1));

    watch(stage, (v) => { visible = v; });
    apply();

    tickFns.push((t, dt) => {
      if (!visible) return;
      if (!reduced && !down && !hover) { idle += dt; if (idle > 5200) go(1); }
      if (!drag) angle = lerp(angle, target, 0.1);
      apply();
    });
  }

  /* =================================================================
     8. IMAGEN QUE SE ABRE · el scroll expande la escena a pantalla
        completa y revela el titular blanco
     ================================================================= */
  function initExpand() {
    const sec = $('#laboratorio');
    const media = $('#expandMedia');
    const copy = $('#expandCopy');
    if (!sec || !media || reduced) return;
    scrollFns.push(() => {
      const r = sec.getBoundingClientRect();
      const total = r.height - vh;
      const p = total > 0 ? clamp(-r.top / total) : 1;
      media.style.setProperty('--e', easeIO(clamp(p / 0.62)).toFixed(4));
      if (copy) {
        const c = smooth(clamp((p - 0.66) / 0.22));
        copy.style.setProperty('--c', c.toFixed(3));
        copy.inert = c < 0.3;
      }
    });
  }

  /* =================================================================
     9. PROCESO · la línea avanza, los pasos se encienden y el matraz
        se llena con el scroll
     ================================================================= */
  function initProcess() {
    const steps = $('#steps');
    if (!steps) return;
    const list = $$('.step', steps);
    const liquid = $('#flaskLiquid');
    scrollFns.push(() => {
      const r = steps.getBoundingClientRect();
      const line = vh * 0.6;
      const p = clamp((line - r.top - 22) / Math.max(1, r.height - 62));
      steps.style.setProperty('--p', p.toFixed(4));
      list.forEach((s) => {
        const n = $('.step__node', s);
        if (!n) return;
        s.classList.toggle('is-lit', n.getBoundingClientRect().top + 26 < line);
      });
      if (liquid) liquid.setAttribute('transform', 'translate(0 ' + lerp(236, 98, easeIO(p)).toFixed(1) + ')');
    });
  }

  /* =================================================================
     10. PANAL DE INGREDIENTES · toca un hexágono para leerlo.
         Con anime.js: entrada escalonada y onda de brillo continua.
     ================================================================= */
  function initHoney() {
    const honey = $('#honey');
    if (!honey) return;
    const hexes = $$('.hex', honey);
    const info = $('#ingInfo');
    const name = $('#ingName');
    const text = $('#ingText');

    hexes.forEach((h) => h.addEventListener('click', () => {
      if (h.classList.contains('is-active')) return;
      hexes.forEach((x) => x.classList.remove('is-active'));
      h.classList.add('is-active');
      if (info) info.classList.add('is-swap');
      setTimeout(() => {
        if (name) name.textContent = h.dataset.name || '';
        if (text) text.textContent = h.dataset.text || '';
        if (info) info.classList.remove('is-swap');
      }, 220);
    }));

    const a = window.anime;
    if (!a || reduced) return; // sin anime.js queda el pulso CSS de respaldo
    root.classList.add('anime-on');

    const clearInline = () => hexes.forEach((h) => {
      h.style.removeProperty('transition'); h.style.removeProperty('transform'); h.style.removeProperty('opacity');
    });
    hexes.forEach((h) => { h.style.opacity = '0'; });

    const icons = hexes.map((h) => $('svg', h)).filter(Boolean);
    const ripple = a({
      targets: icons,
      opacity: [{ value: 0.3, duration: 420 }, { value: 1, duration: 700 }],
      delay: a.stagger(140, { grid: [3, 3], from: 'center' }),
      easing: 'easeInOutSine', loop: true, endDelay: 3000, autoplay: false
    });

    let started = false;
    watch(honey, (v) => {
      if (v && !started) {
        started = true;
        a({
          targets: hexes,
          opacity: [0, 1], scale: [0.55, 1], translateY: [26, 0],
          delay: a.stagger(85, { grid: [3, 3], from: 'center' }),
          duration: 900, easing: 'easeOutExpo',
          begin: () => hexes.forEach((h) => { h.style.transition = 'none'; }),
          complete: clearInline
        });
        setTimeout(clearInline, 3400); // seguro: nada se queda oculto
      }
      if (v) ripple.play(); else ripple.pause();
    }, '0px');
  }

  /* =================================================================
     11. PREGUNTAS FRECUENTES · acordeón accesible (uno abierto a la vez)
     ================================================================= */
  function initFaq() {
    const items = $$('#acc .acc__item');
    items.forEach((item) => {
      const btn = $('.acc__btn', item);
      if (!btn) return;
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') !== 'true';
        items.forEach((o) => {
          const b = $('.acc__btn', o);
          const on = o === item && open;
          o.classList.toggle('is-open', on);
          if (b) b.setAttribute('aria-expanded', String(on));
        });
      });
    });
  }

  /* =================================================================
     12. CONTACTO Y WHATSAPP · los botones con data-wa y el formulario
         abren https://wa.me/ con el mensaje ya escrito
     ================================================================= */
  const waLink = (msg) => 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg);

  function initWhatsApp() {
    const float = $('#whatsappFloat');
    const form = $('#contactForm');

    if (!WHATSAPP_NUMBER) { // sin número: se oculta con elegancia
      root.classList.add('sin-wa');
      if (form) {
        const note = $('.form__note', form);
        if (note) note.textContent = 'Pronto habilitaremos el envío por WhatsApp.';
      }
      return;
    }

    $$('[data-wa]').forEach((el) => {
      el.setAttribute('href', waLink(el.getAttribute('data-wa')));
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    });

    if (float && !reduced) {
      setTimeout(() => float.classList.add('show-tip'), 5200);
      setTimeout(() => float.classList.remove('show-tip'), 9800);
    }

    if (!form) return;
    const nameField = form.elements.nombre;
    const err = $('.field__err', form);
    const wrap = nameField ? nameField.closest('.field') : null;
    const note = $('.form__note', form);

    const setError = (msg) => {
      if (err) err.textContent = msg;
      if (wrap) wrap.classList.toggle('is-invalid', !!msg);
      if (nameField) nameField.setAttribute('aria-invalid', msg ? 'true' : 'false');
    };
    if (nameField) nameField.addEventListener('input', () => setError(''));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nombre = (nameField ? nameField.value : '').trim();
      if (nombre.length < 2) {
        setError('Cuéntanos tu nombre para saber con quién platicamos.');
        if (nameField) nameField.focus();
        return;
      }
      setError('');
      const interes = form.elements.interes ? form.elements.interes.value : '';
      const idea = (form.elements.mensaje ? form.elements.mensaje.value : '').trim();
      const msg = ['Hola, soy ' + nombre + '.', interes ? 'Me interesa: ' + interes + '.' : '', idea ? 'Mi idea: ' + idea : '']
        .filter(Boolean).join('\n');
      const url = waLink(msg);
      const win = window.open(url, '_blank', 'noopener');
      if (!win) window.location.href = url;
      if (note) note.textContent = 'Listo: abrimos WhatsApp con tu mensaje. Tú decides si lo envías.';
    });
  }

  /* =================================================================
     13. DETALLES DE ESCRITORIO · imán en botones, tilt 3D en tarjetas y
         cursor de laboratorio (solo con ratón)
     ================================================================= */
  function initPointerFx() {
    if (!finePointer || reduced) return;

    $$('.btn--mag').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        b.style.transform = 'translate3d(' + (dx * 12).toFixed(1) + 'px,' + (dy * 10).toFixed(1) + 'px,0)';
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });

    $$('[data-tilt]').forEach((c) => {
      c.addEventListener('pointermove', (e) => {
        const r = c.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        c.style.setProperty('--mx', (x * r.width).toFixed(0) + 'px');
        c.style.setProperty('--my', (y * r.height).toFixed(0) + 'px');
        c.style.transform = 'perspective(900px) rotateX(' + ((0.5 - y) * 7).toFixed(2) + 'deg) rotateY(' + ((x - 0.5) * 9).toFixed(2) + 'deg) translateZ(0)';
      });
      c.addEventListener('pointerleave', () => { c.style.transform = ''; });
    });

    const cur = document.createElement('div');
    cur.className = 'cursor';
    cur.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cur);
    let x = -100, y = -100, cx = x, cy = y;
    window.addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; cur.classList.add('is-on'); }, { passive: true });
    document.addEventListener('pointerover', (e) => {
      cur.classList.toggle('is-link', !!(e.target.closest && e.target.closest('a, button, [data-tilt], .chipradio, .ring-stage')));
    });
    root.addEventListener('mouseleave', () => cur.classList.remove('is-on'));
    tickFns.push(() => {
      cx = lerp(cx, x, 0.22); cy = lerp(cy, y, 0.22);
      cur.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
    });
  }

  /* =================================================================
     14. CINTA · acelera según la velocidad del scroll
     ================================================================= */
  function initMarquee() {
    if (reduced || !Element.prototype.getAnimations) return;
    const anims = [];
    $$('.marquee__track').forEach((t) => { const a = t.getAnimations()[0]; if (a) anims.push(a); });
    if (!anims.length) return;
    let rate = 1;
    tickFns.push((t, dt, vel) => {
      const r = 1 + clamp(Math.abs(vel) / 650, 0, 5);
      if (Math.abs(r - rate) > 0.04) { rate = r; anims.forEach((a) => { a.playbackRate = r; }); }
    });
  }

  /* =================================================================
     ARRANQUE · un solo ciclo de fotogramas para todo
     ================================================================= */
  function start() {
    [initLoader, initHeader, initReveal, initHero, initManifesto, initPrisma, initBrands, initRing,
      initExpand, initProcess, initHoney, initFaq, initWhatsApp, initPointerFx, initMarquee].forEach(safe);

    window.addEventListener('scroll', () => { dirty = true; }, { passive: true });
    window.addEventListener('resize', () => { vh = window.innerHeight; dirty = true; });
    window.addEventListener('load', () => { dirty = true; });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { dirty = true; });

    let last = 0, lastY = window.scrollY, vel = 0;
    const frame = (t) => {
      requestAnimationFrame(frame);
      if (document.hidden) { last = t; return; }
      const dt = Math.min(64, t - last || 16);
      last = t;
      const y = window.scrollY;
      vel = lerp(vel, ((y - lastY) / Math.max(1, dt)) * 1000, 0.1);
      lastY = y;
      if (dirty) {
        dirty = false;
        for (let i = 0; i < scrollFns.length; i++) { try { scrollFns[i](y); } catch (e) { /* un módulo no tumba a los demás */ } }
      }
      for (let i = 0; i < tickFns.length; i++) { try { tickFns[i](t, dt, vel); } catch (e) { /* idem */ } }
    };
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
