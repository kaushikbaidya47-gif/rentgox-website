/* =========================================================
   RentGoX — main script
   Sections:
   1. Loader
   2. Particle background canvas
   3. Header scroll state + mobile nav
   4. Scroll reveal (IntersectionObserver)
   5. Ripple buttons
   6. FAQ accordion
   7. Circular category wheel (drag + momentum + snap)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- 1. LOADER ---------- */
  const loader = document.getElementById('loader');
  window.addEventListener('load', () => {
    setTimeout(() => loader.classList.add('is-hidden'), 350);
  });
  // Fallback in case 'load' already fired
  setTimeout(() => loader && loader.classList.add('is-hidden'), 2200);

  /* ---------- footer year ---------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- 2. PARTICLE BACKGROUND ---------- */
  initParticles();
  initHeroSlideshow();

  /* ---------- 3. HEADER + MOBILE NAV ---------- */
  const header = document.getElementById('site-header');
  const navToggle = document.getElementById('nav-toggle');
  const mainNav = document.getElementById('main-nav');

  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  navToggle.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
  mainNav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => mainNav.classList.remove('is-open'));
  });

  /* ---------- 4. SCROLL REVEAL ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach(el => revealObserver.observe(el));

  /* ---------- 5. RIPPLE BUTTONS ---------- */
  document.querySelectorAll('.ripple').forEach(btn => {
    btn.addEventListener('click', function (e) {
      const rect = this.getBoundingClientRect();
      const dot = document.createElement('span');
      const size = Math.max(rect.width, rect.height) * 1.2;
      dot.className = 'ripple-dot';
      dot.style.width = dot.style.height = size + 'px';
      dot.style.left = (e.clientX - rect.left - size / 2) + 'px';
      dot.style.top = (e.clientY - rect.top - size / 2) + 'px';
      this.appendChild(dot);
      dot.addEventListener('animationend', () => dot.remove());
    });
  });

  /* ---------- 6. FAQ ACCORDION ---------- */
  document.querySelectorAll('.accordion-item').forEach(item => {
    const trigger = item.querySelector('.accordion-trigger');
    trigger.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');
      item.closest('.accordion').querySelectorAll('.accordion-item').forEach(i => {
        i.classList.remove('is-open');
        i.querySelector('.accordion-trigger').setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ---------- 7. CIRCULAR CATEGORY WHEEL ---------- */
  initCategoryWheel();

});

/* =========================================================
   Particle background — lightweight canvas, no dependencies
   ========================================================= */
function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  let w, h;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = document.documentElement.scrollHeight;
  }

  function createParticles() {
    const count = Math.min(70, Math.floor((w * h) / 32000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      hue: Math.random() > 0.5 ? '109,94,245' : '52,209,191',
      alpha: Math.random() * 0.5 + 0.15
    }));
  }

  function tick() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.hue},${p.alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(tick);
  }

  resize();
  createParticles();
  requestAnimationFrame(tick);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); createParticles(); }, 250);
  });
}

/* =========================================================
   Hero background slideshow — crossfades between 3-4 photos.
   Any image that fails to load (missing file) is skipped
   automatically, so this keeps working even with fewer photos.
   ========================================================= */
function initHeroSlideshow() {
  const container = document.getElementById('hero-bg');
  if (!container) return;
  const slides = Array.from(container.querySelectorAll('.hero-bg-slide'));
  if (slides.length <= 1) return;

  let current = 0;

  function goToNext() {
    const available = slides.filter(s => s.dataset.failed !== 'true');
    if (available.length <= 1) return; // nothing to rotate between

    // find current active among available slides, then move to the next one
    const currentEl = slides[current];
    let nextIndex = (current + 1) % slides.length;
    let safety = 0;
    while (slides[nextIndex].dataset.failed === 'true' && safety < slides.length) {
      nextIndex = (nextIndex + 1) % slides.length;
      safety++;
    }

    if (currentEl) currentEl.classList.remove('is-active');
    slides[nextIndex].classList.add('is-active');
    current = nextIndex;
  }

  setInterval(goToNext, 5000);
}

/* =========================================================
   Circular category wheel
   - Items positioned around a circle, angle measured
     clockwise from the top (0deg = top / "front").
   - Drag (mouse or touch) rotates the whole ring.
   - Releasing applies momentum, then eases into a snap
     so the nearest category settles at the front.
   - Front item scales up + glows; clicking any item spins
     it to the front and opens the detail card.
   ========================================================= */
function initCategoryWheel() {
  const outer = document.getElementById('wheel-outer');
  const ring = document.getElementById('wheel-ring');
  const hubLabel = document.getElementById('wheel-hub-label');
  const detail = document.getElementById('category-detail');
  const detailClose = document.getElementById('detail-close');
  const detailTitle = document.getElementById('detail-title');
  const detailDesc = document.getElementById('detail-desc');
  const detailIcon = document.getElementById('detail-icon');
  if (!outer || !ring) return;

  const categories = [
    { key: 'room', label: 'Room', icon: '🛏️', desc: 'Find verified single and shared rooms near you, ready to move in.' },
    { key: 'apartment', label: 'Apartment', icon: '🏢', desc: 'Fully furnished apartments for short or long-term stays.' },
    { key: 'hostel', label: 'Hostel', icon: '🏨', desc: 'Budget-friendly beds for students and travellers, verified and safe.' },
    { key: 'pg', label: 'PG', icon: '🏠', desc: 'Paying-guest accommodations with meals and amenities included.' },
    { key: 'bike', label: 'Bike', icon: '🏍️', desc: 'Hourly and daily two-wheeler rentals wherever you are.' },
    { key: 'car', label: 'Car', icon: '🚗', desc: 'Self-drive and chauffeur cars, booked in a couple of taps.' },
    { key: 'scooter', label: 'Scooter', icon: '🛵', desc: 'Quick, affordable scooter rentals for short city trips.' },
    { key: 'electronics', label: 'Electronics', icon: '💻', desc: 'Laptops, cameras and gadgets available to rent by the day.' },
    { key: 'hall', label: 'Marriage Hall', icon: '💍', desc: 'Book verified venues and halls for weddings and events.' }
  ];

  const n = categories.length;
  const anglePerItem = 360 / n;

  // Build DOM items
  const items = categories.map((cat, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'wheel-item';
    el.dataset.index = i;
    el.dataset.base = i * anglePerItem;
    el.innerHTML = `<div class="wheel-item-icon">${cat.icon}</div><span>${cat.label}</span>`;
    el.setAttribute('aria-label', `Open ${cat.label} category`);
    ring.appendChild(el);
    return el;
  });

  let rotation = 0;        // current rotation in degrees
  let velocity = 0;        // deg per frame
  let radius = 0;
  let dragging = false;
  let lastAngle = 0;       // last pointer angle relative to wheel center
  let lastTime = 0;
  let momentumFrame = null;
  let snapFrame = null;

  function computeRadius() {
    const size = outer.clientWidth;
    radius = size / 2 - (size < 400 ? 40 : 62); // keep items inside the ring
  }

  function pointerAngle(clientX, clientY) {
    const rect = outer.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // atan2 with y first gives angle from top(0) clockwise when adjusted
    const dx = clientX - cx;
    const dy = clientY - cy;
    let deg = Math.atan2(dx, -dy) * (180 / Math.PI); // 0 = top, clockwise positive
    return deg;
  }

  function normalize(angle) {
    let a = angle % 360;
    if (a < 0) a += 360;
    return a;
  }

  function layout() {
    items.forEach((el, i) => {
      const base = i * anglePerItem;
      const current = base + rotation;
      const rad = (current * Math.PI) / 180;
      const x = radius * Math.sin(rad);
      const y = -radius * Math.cos(rad);

      const norm = normalize(current);
      const distToFront = Math.min(norm, 360 - norm);
      const isFront = distToFront < anglePerItem / 2;

      el.style.transform = `translate(${x}px, ${y}px)`;
      el.classList.toggle('is-front', isFront);

      if (isFront) {
        hubLabel.textContent = categories[i].label;
        el.dataset.front = 'true';
      } else {
        delete el.dataset.front;
      }
    });
  }

  function getFrontIndex() {
    let closest = 0;
    let minDist = Infinity;
    items.forEach((el, i) => {
      const base = i * anglePerItem;
      const norm = normalize(base + rotation);
      const dist = Math.min(norm, 360 - norm);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    return closest;
  }

  function openDetail(index) {
    const cat = categories[index];
    detailIcon.textContent = cat.icon;
    detailTitle.textContent = cat.label;
    detailDesc.textContent = cat.desc;
    detail.classList.add('is-open');
  }

  function closeDetail() {
    detail.classList.remove('is-open');
  }

  function spinToIndex(index) {
    // find rotation that brings this item's base angle to 0 (front),
    // choosing the shortest path from current rotation.
    const base = index * anglePerItem;
    let targetRotation = -base;
    // normalize target relative to current rotation for shortest path
    const diff = ((targetRotation - rotation + 540) % 360) - 180;
    animateRotationBy(diff);
  }

  function animateRotationBy(delta) {
    cancelMomentum();
    cancelSnap();
    const start = rotation;
    const end = rotation + delta;
    const duration = 650;
    const startTime = performance.now();
    function step(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      rotation = start + (end - start) * eased;
      layout();
      if (t < 1) {
        snapFrame = requestAnimationFrame(step);
      }
    }
    snapFrame = requestAnimationFrame(step);
  }

  function cancelMomentum() {
    if (momentumFrame) cancelAnimationFrame(momentumFrame);
    momentumFrame = null;
  }
  function cancelSnap() {
    if (snapFrame) cancelAnimationFrame(snapFrame);
    snapFrame = null;
  }

  function runMomentum() {
    cancelSnap();
    function step() {
      velocity *= 0.945; // friction
      rotation += velocity;
      layout();
      if (Math.abs(velocity) > 0.02) {
        momentumFrame = requestAnimationFrame(step);
      } else {
        momentumFrame = null;
        snapToNearest();
      }
    }
    momentumFrame = requestAnimationFrame(step);
  }

  function snapToNearest() {
    const idx = getFrontIndex();
    const base = idx * anglePerItem;
    const targetRotation = -base;
    const diff = ((targetRotation - rotation + 540) % 360) - 180;
    if (Math.abs(diff) > 0.3) {
      animateRotationBy(diff);
    }
  }

  /* ---- pointer interaction (mouse + touch via Pointer Events) ---- */
  let moved = false;
  let startClientX = 0;
  let startClientY = 0;
  let pressedItem = null; // the wheel-item actually pressed on pointerdown

  outer.addEventListener('pointerdown', (e) => {
    dragging = true;
    moved = false;
    startClientX = e.clientX;
    startClientY = e.clientY;
    pressedItem = e.target.closest('.wheel-item');
    cancelMomentum();
    cancelSnap();
    outer.classList.add('is-dragging');
    outer.setPointerCapture(e.pointerId);
    lastAngle = pointerAngle(e.clientX, e.clientY);
    lastTime = performance.now();
    velocity = 0;
  });

  outer.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const angle = pointerAngle(e.clientX, e.clientY);
    let delta = angle - lastAngle;
    // handle wrap-around (crossing the 180/-180 boundary)
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    // Use total pixel distance from the initial touch/click point to decide
    // whether this is a genuine drag or just a tap (avoids false positives
    // from tiny finger jitter on touchscreens).
    const pixelDist = Math.hypot(e.clientX - startClientX, e.clientY - startClientY);
    if (pixelDist > 8) moved = true;

    const now = performance.now();
    const dt = Math.max(now - lastTime, 1);
    velocity = (delta / dt) * 16; // normalize to ~60fps step

    rotation += delta;
    layout();

    lastAngle = angle;
    lastTime = now;
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    outer.classList.remove('is-dragging');

    // Handle tap ourselves: pointer capture on `outer` can prevent the
    // native click event from firing on the individual item, so we detect
    // taps here directly instead of relying on each item's click listener.
    if (!moved && pressedItem) {
      const index = Number(pressedItem.dataset.index);
      spinToIndex(index);
      openDetail(index);
    }
    pressedItem = null;

    if (Math.abs(velocity) > 0.15) {
      runMomentum();
    } else {
      snapToNearest();
    }
  }

  outer.addEventListener('pointerup', endDrag);
  outer.addEventListener('pointercancel', endDrag);
  outer.addEventListener('pointerleave', (e) => { if (dragging && e.buttons === 0) endDrag(e); });

  detailClose.addEventListener('click', closeDetail);

  /* ---- init ---- */
  function init() {
    computeRadius();
    layout();
  }
  init();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(init, 200);
  });
}