/* ============================================================
   Magnetelligence Lab — v2 scripts
   ============================================================ */

// ---------- Tools menu link ----------
(function addToolsLink() {
    const navLinks = document.getElementById('navLinks');
    if (!navLinks || navLinks.querySelector('a[href="tools.html"]')) return;

    const item = document.createElement('li');
    item.innerHTML = '<a href="tools.html" class="nav-link" target="_blank" rel="noopener"><span class="lang-en">Tools</span><span class="lang-tr">Araçlar</span></a>';

    const contactItem = navLinks.querySelector('a[href="#contact"]')?.parentElement;
    if (contactItem) navLinks.insertBefore(item, contactItem);
    else navLinks.appendChild(item);
})();

// ---------- Language toggle ----------
const langBtns = document.querySelectorAll('.lang-btn');

function setLang(lang) {
    document.body.dataset.lang = lang;
    document.documentElement.lang = lang;
    langBtns.forEach(b => {
        const active = b.dataset.lang === lang;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
    });
    localStorage.setItem('preferred-lang', lang);
}

langBtns.forEach(btn => btn.addEventListener('click', () => setLang(btn.dataset.lang)));

const savedLang = localStorage.getItem('preferred-lang');
if (savedLang) {
    setLang(savedLang);
} else if (navigator.language && navigator.language.toLowerCase().startsWith('tr')) {
    setLang('tr');
}

// ---------- Mobile menu ----------
const menuBtn = document.getElementById('menuBtn');
const navLinks = document.getElementById('navLinks');

menuBtn.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    menuBtn.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
});

navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    menuBtn.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
}));

// ---------- Nav scroll state + progress bar + back-to-top ----------
const nav = document.getElementById('nav');
const scrollBar = document.getElementById('scrollBar');
const backToTop = document.getElementById('backToTop');

function onScroll() {
    const y = window.scrollY;
    nav.classList.toggle('scrolled', y > 30);
    backToTop.classList.toggle('visible', y > 600);

    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollBar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ---------- Active section highlighting ----------
const sections = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav-link');

const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            navAnchors.forEach(a => {
                a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id);
            });
        }
    });
}, { rootMargin: '-35% 0px -55% 0px' });

sections.forEach(s => sectionObserver.observe(s));

// ---------- Reveal on scroll ----------
const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ---------- Animated counters ----------
const counters = document.querySelectorAll('.stat-value[data-count]');

function animateCounter(el) {
    const target = parseInt(el.dataset.count, 10);
    const suffix = el.dataset.suffix || '';
    const duration = 1400;
    const start = performance.now();

    function tick(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

const statsObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            counters.forEach(animateCounter);
            statsObserver.disconnect();
        }
    });
}, { threshold: 0.4 });

const statsEl = document.getElementById('stats');
if (statsEl) statsObserver.observe(statsEl);

// ---------- Tabs ----------
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.tab-panel');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        panels.forEach(p => {
            const active = p.id === 'panel-' + tab.dataset.tab;
            p.classList.toggle('active', active);
            p.hidden = !active;
            if (active) p.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
        });
    });
});

// ---------- Smooth anchor scrolling ----------
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// ============================================================
// Hero canvas — interactive magnetic spin lattice
// Spins are disordered (warm colors); near the cursor they align
// with the "applied field" and turn cyan — a playful nod to the
// magnetocaloric effect.
// ============================================================
(function () {
    const canvas = document.getElementById('spinCanvas');
    if (!canvas) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d');
    const hero = canvas.parentElement;

    let spins = [];
    let mouse = { x: -9999, y: -9999 };
    let width = 0, height = 0, dpr = 1;
    let activation = 0; // 0–1: how strongly the "model" is firing (driven by spin alignment)

    const SPACING = 64;
    const FIELD_RADIUS = 220;

    // ---- Neural network layer (drawn behind the spins) ----
    const net = { nodes: [], edges: [], outputs: [] };

    function buildNetwork() {
        const layers = [4, 3, 3, 2];
        const cx = width / 2, cy = height / 2;
        const spanX = Math.min(width * 0.62, 760);
        const spanY = Math.min(height * 0.42, 340);
        net.nodes = []; net.edges = []; net.outputs = [];

        const layerNodes = [];
        layers.forEach((count, li) => {
            const arr = [];
            for (let k = 0; k < count; k++) {
                const node = {
                    x: cx - spanX / 2 + (spanX * li) / (layers.length - 1),
                    y: cy - spanY / 2 + (spanY * (k + 0.5)) / count,
                    r: li === layers.length - 1 ? 6 : 4.5,
                    layer: li,
                    last: li === layers.length - 1,
                    phase: Math.random() * Math.PI * 2
                };
                arr.push(node);
                net.nodes.push(node);
                if (node.last) net.outputs.push(node);
            }
            layerNodes.push(arr);
        });

        for (let li = 0; li < layerNodes.length - 1; li++) {
            for (const a of layerNodes[li]) {
                for (const b of layerNodes[li + 1]) {
                    net.edges.push({ a, b, t: Math.random(), speed: 0.0025 + Math.random() * 0.004 });
                }
            }
        }
    }

    function drawNetwork(now) {
        const act = activation;

        // connections
        ctx.lineWidth = 1;
        for (const e of net.edges) {
            ctx.strokeStyle = `rgba(129, 140, 248, ${0.07 + act * 0.13})`;
            ctx.beginPath();
            ctx.moveTo(e.a.x, e.a.y);
            ctx.lineTo(e.b.x, e.b.y);
            ctx.stroke();

            // data pulse travelling along the edge — faster when the model "fires"
            if (!reduceMotion) e.t = (e.t + e.speed * (0.6 + act * 3)) % 1;
            const px = e.a.x + (e.b.x - e.a.x) * e.t;
            const py = e.a.y + (e.b.y - e.a.y) * e.t;
            ctx.fillStyle = `rgba(34, 211, 238, ${0.25 + act * 0.6})`;
            ctx.shadowColor = 'rgba(34, 211, 238, 0.9)';
            ctx.shadowBlur = 6 + act * 8;
            ctx.beginPath();
            ctx.arc(px, py, 1.6 + act * 1.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // nodes
        for (const n of net.nodes) {
            const breathe = 1 + Math.sin(now * 0.002 + n.phase) * 0.15;
            const r = n.r * breathe * (1 + act * 0.25);
            if (n.last) {
                ctx.fillStyle = `rgba(52, 211, 153, ${0.5 + act * 0.5})`;
                ctx.shadowColor = 'rgba(52, 211, 153, 0.9)';
            } else if (n.layer === 0) {
                ctx.fillStyle = `rgba(34, 211, 238, ${0.4 + act * 0.4})`;
                ctx.shadowColor = 'rgba(34, 211, 238, 0.9)';
            } else {
                ctx.fillStyle = `rgba(129, 140, 248, ${0.4 + act * 0.4})`;
                ctx.shadowColor = 'rgba(129, 140, 248, 0.9)';
            }
            ctx.shadowBlur = 8 + act * 10;
            ctx.beginPath();
            ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // labels: inputs → f(X) → outputs
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';

        const inX = net.nodes[0].x;
        const outX = net.outputs[0].x;
        const topY = Math.min(...net.nodes.map(n => n.y)) - 22;
        const botY = Math.max(...net.nodes.map(n => n.y)) + 30;

        ctx.fillStyle = `rgba(148, 163, 184, ${0.35 + act * 0.3})`;
        ctx.fillText('X: features', inX, botY);
        ctx.fillStyle = `rgba(52, 211, 153, ${0.4 + act * 0.5})`;
        ctx.fillText('ΔS · Tc', outX, botY);

        // prediction readout — "confidence" climbs as the spins align
        ctx.fillStyle = `rgba(34, 211, 238, ${0.3 + act * 0.65})`;
        ctx.fillText(`f(X) → ΔS_ref   [${Math.round(act * 100)}%]`, (inX + outX) / 2, topY);
        ctx.textAlign = 'left';
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = hero.clientWidth;
        height = hero.clientHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        buildLattice();
        buildNetwork();
    }

    function buildLattice() {
        spins = [];
        const cols = Math.ceil(width / SPACING) + 1;
        const rows = Math.ceil(height / SPACING) + 1;
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                spins.push({
                    x: i * SPACING + (j % 2 ? SPACING / 2 : 0),
                    y: j * SPACING,
                    angle: Math.random() * Math.PI * 2,
                    baseSpeed: 0.004 + Math.random() * 0.012,
                    drift: Math.random() * Math.PI * 2,
                    align: 0 // 0 = disordered, 1 = fully aligned
                });
            }
        }
    }

    hero.addEventListener('pointermove', e => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
    });
    hero.addEventListener('pointerleave', () => { mouse.x = -9999; mouse.y = -9999; });

    function lerpAngle(a, b, t) {
        let d = b - a;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return a + d * t;
    }

    function draw(now) {
        ctx.clearRect(0, 0, width, height);

        drawNetwork(now);

        let alignSum = 0;

        for (const s of spins) {
            const dx = mouse.x - s.x;
            const dy = mouse.y - s.y;
            const dist = Math.hypot(dx, dy);
            const inField = dist < FIELD_RADIUS;

            // approach (or relax from) the aligned state
            const targetAlign = inField ? 1 - dist / FIELD_RADIUS : 0;
            s.align += (targetAlign - s.align) * 0.08;
            alignSum += s.align;

            if (inField) {
                // align toward the cursor like dipoles in an applied field
                s.angle = lerpAngle(s.angle, Math.atan2(dy, dx), 0.12 * (s.align + 0.15));
            } else if (!reduceMotion) {
                // thermal wobble when no field is applied
                s.drift += s.baseSpeed;
                s.angle += Math.sin(s.drift) * 0.02;
            }

            const len = 9 + s.align * 5;
            const cos = Math.cos(s.angle), sin = Math.sin(s.angle);

            // color: warm slate (disordered) → cyan (aligned)
            const a = s.align;
            const r = Math.round(120 - 86 * a);
            const g = Math.round(130 + 81 * a);
            const b = Math.round(160 + 78 * a);
            const alpha = 0.22 + a * 0.65;
            ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
            ctx.fillStyle = ctx.strokeStyle;
            ctx.lineWidth = 1.5 + a;

            if (a > 0.25) {
                ctx.shadowColor = 'rgba(34,211,238,0.8)';
                ctx.shadowBlur = 10 * a;
            } else {
                ctx.shadowBlur = 0;
            }

            // shaft
            ctx.beginPath();
            ctx.moveTo(s.x - cos * len, s.y - sin * len);
            ctx.lineTo(s.x + cos * len, s.y + sin * len);
            ctx.stroke();

            // arrowhead
            const hx = s.x + cos * len, hy = s.y + sin * len;
            const headLen = 5 + a * 2;
            ctx.beginPath();
            ctx.moveTo(hx, hy);
            ctx.lineTo(hx - cos * headLen - sin * headLen * 0.55, hy - sin * headLen + cos * headLen * 0.55);
            ctx.lineTo(hx - cos * headLen + sin * headLen * 0.55, hy - sin * headLen - cos * headLen * 0.55);
            ctx.closePath();
            ctx.fill();
        }
        ctx.shadowBlur = 0;

        // feed spin alignment into the network's activation level:
        // aligning spins with the cursor makes the "model" fire harder
        const fieldStrength = spins.length ? Math.min((alignSum / spins.length) * 14, 1) : 0;
        const idle = 0.12 + Math.sin(now * 0.0012) * 0.05; // gentle idle breathing
        const target = Math.max(idle, fieldStrength);
        activation += (target - activation) * 0.05;

        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    requestAnimationFrame(draw);
})();
