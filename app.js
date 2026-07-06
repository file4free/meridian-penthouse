/* ═══════════════ THE MERIDIAN — cinematic scroll engine ═══════════════ */
(() => {
  'use strict';

  /* ——— reveal-on-scroll ——— */
  const revealIO = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); }
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.reveal, .a-row').forEach((el) => revealIO.observe(el));

  /* ——— header ——— */
  const head = document.getElementById('siteHead');
  addEventListener('scroll', () => head.classList.toggle('is-scrolled', scrollY > 40), { passive: true });

  /* ——— showing form ——— */
  const form = document.getElementById('showingForm');
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    let ok = true;
    for (const input of form.querySelectorAll('[required]')) {
      const bad = !input.value.trim() || (input.type === 'email' && !/^\S+@\S+\.\S+$/.test(input.value));
      input.classList.toggle('is-bad', bad);
      if (bad) ok = false;
    }
    if (ok) form.classList.add('is-sent');
  });

  /* ═══════════════ SCROLL-SCRUBBED TOUR ═══════════════ */

  const tour = document.getElementById('tour');
  const video = document.getElementById('tourVideo');
  const loading = document.getElementById('tourLoading');
  const stillsLayer = document.getElementById('tourStills');
  const stills = stillsLayer ? [...stillsLayer.querySelectorAll('img')] : [];
  const railFill = document.getElementById('railFill');
  const stops = [...document.querySelectorAll('.rail__stops li')];
  const chapterCard = document.getElementById('chapterCard');
  const chapterNum = document.getElementById('chapterNum');
  const chapterName = document.getElementById('chapterName');
  const chapterLine = document.getElementById('chapterLine');

  const NUMERALS = ['I', 'II', 'III', 'IV'];
  const TAGLINES = [
    'Dusk over the Mediterranean. The city ignites.',
    'The elevator opens. The residence unfolds.',
    'Marble, walnut and light — one continuous breath.',
    'Sixty floors up, the night is yours alone.',
  ];

  const isTouch = matchMedia('(pointer: coarse)').matches;
  // Less thumb-travel per second of footage on touch screens.
  const PX_PER_SECOND = isTouch ? 110 : 170;

  // Fallback chapters (equal quarters) — replaced by media/tour.json when present.
  let chapters = [
    { name: 'The Approach', start: 0.00 },
    { name: 'The Arrival', start: 0.25 },
    { name: 'The Flow', start: 0.50 },
    { name: 'The Terrace', start: 0.75 },
  ];
  let duration = 0; // seconds, from metadata or manifest

  // Viewport size cache — mobile browsers fire resize when the URL bar
  // collapses; rebuilding the tour height mid-scroll would make the page jump.
  let vpW = innerWidth, vpH = innerHeight;

  fetch('media/tour.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (!j) return;
      if (j.duration && j.chapters) {
        chapters = j.chapters.map((c) => ({ name: c.name, start: c.start / j.duration }));
      }
      if (!duration && j.duration) setDuration(j.duration);
    })
    .catch(() => {});

  function setDuration(d) {
    duration = d;
    tour.style.height = `${Math.round(d * PX_PER_SECOND) + vpH}px`;
  }

  video.addEventListener('loadedmetadata', () => setDuration(video.duration));
  setDuration(38); // provisional until metadata arrives

  /* ——— mobile unlock ———
     iOS/Android refuse to fetch or decode video before a user gesture, so the
     first touch "primes" the element with a muted play()+pause(). Without this
     the playhead can never move on phones. */
  let unlocked = !isTouch;
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    video.muted = true;
    const p = video.play();
    if (p && p.then) p.then(() => video.pause()).catch(() => { try { video.load(); } catch {} });
    else video.pause();
  }
  ['touchstart', 'pointerdown', 'touchmove'].forEach((ev) =>
    addEventListener(ev, unlock, { once: true, passive: true }));

  /* loading indicator until the video can play through */
  let ready = false;
  const markReady = () => { ready = true; loading.classList.remove('is-on'); };
  video.addEventListener('canplaythrough', markReady, { once: true });
  video.addEventListener('canplay', markReady, { once: true });
  if (video.readyState >= 3) markReady();
  setTimeout(() => { if (!ready && isTourVisible()) loading.classList.add('is-on'); }, 800);
  video.pause();

  function isTourVisible() {
    const r = tour.getBoundingClientRect();
    return r.top < vpH && r.bottom > 0;
  }

  /* ——— core scrub loop ——— */
  let target = 0;      // desired playhead (s)
  let current = 0;     // smoothed playhead (s)
  let activeChapter = -1;
  let lastSeek = -1;
  let deadSince = 0;   // when the video last became unable to render

  function onScroll() {
    const r = tour.getBoundingClientRect();
    const span = tour.offsetHeight - vpH;
    const progress = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    target = progress * (duration || 0);

    const inTour = r.top < vpH * 0.5 && r.bottom > vpH * 0.5;
    document.body.classList.toggle('tour-active', inTour);
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => {
    // Ignore the small height changes caused by mobile URL-bar show/hide.
    if (innerWidth === vpW && Math.abs(innerHeight - vpH) < 120) return;
    vpW = innerWidth; vpH = innerHeight;
    if (duration) setDuration(duration);
    onScroll();
  });

  function frame() {
    requestAnimationFrame(frame);
    if (!duration) return;

    // critically-damped chase toward the scroll target — this is what makes
    // the scrub feel fluid instead of stepping per scroll event
    const delta = target - current;
    current += delta * 0.14;
    if (Math.abs(delta) < 0.002) current = target;

    // Seek policy: metadata is enough (the browser fetches whatever the seek
    // needs), but while a previous seek is still in flight only re-seek when
    // the playhead moved substantially — Safari chokes on a queue of seeks.
    if (video.readyState >= 1) {
      const gap = Math.abs(current - lastSeek);
      if ((!video.seeking && gap > 1 / 60) || gap > 0.34) {
        try {
          video.currentTime = Math.min(current, Math.max(0, (video.duration || duration) - 0.05));
          lastSeek = current;
        } catch {}
      }
    }

    const p = current / duration;
    railFill.style.height = `${(p * 100).toFixed(2)}%`;

    // Still-image fallback layer: if the video can't render frames (data
    // saver, very old devices), crossfade the chapter keyframes instead.
    // readyState dips transiently during every seek, so only treat the video
    // as dead when it has been unavailable continuously for a while.
    const now = performance.now();
    if (video.readyState >= 2 && !video.error) deadSince = 0;
    else if (!deadSince) deadSince = now;
    const videoDead = video.error || (deadSince && now - deadSince > 700);
    if (stillsLayer) stillsLayer.classList.toggle('is-on', !!videoDead);
    if (videoDead && stills.length === chapters.length) {
      for (let i = 0; i < stills.length; i++) {
        const a = chapters[i].start;
        const b = i + 1 < chapters.length ? chapters[i + 1].start : 1.001;
        const t = (p - a) / (b - a);
        stills[i].style.opacity = Math.max(0, Math.min(1, 1.5 - Math.abs(t - 0.5) * 1.7)).toFixed(3);
      }
    }

    // chapter bookkeeping
    let ch = 0;
    for (let i = chapters.length - 1; i >= 0; i--) if (p >= chapters[i].start - 1e-6) { ch = i; break; }
    if (ch !== activeChapter) {
      activeChapter = ch;
      stops.forEach((li, i) => {
        li.classList.toggle('is-active', i === ch);
        li.classList.toggle('is-passed', i < ch);
      });
      chapterCard.classList.remove('is-in');
      setTimeout(() => {
        chapterNum.textContent = NUMERALS[ch];
        chapterName.textContent = chapters[ch].name;
        chapterLine.textContent = TAGLINES[ch] || '';
        chapterCard.classList.add('is-in');
      }, 180);
    }
  }

  onScroll();
  requestAnimationFrame(frame);

  /* click a rail stop → glide to that chapter */
  stops.forEach((li, i) => {
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => {
      const span = tour.offsetHeight - vpH;
      const top = tour.getBoundingClientRect().top + scrollY;
      scrollTo({ top: top + chapters[i].start * span + 2, behavior: 'smooth' });
    });
  });
})();
