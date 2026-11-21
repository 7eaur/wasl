'use strict';
// Adapted from the project wall in 7eaur/eng-elyas/public/web-developer/index.html:
// sticky cards settle back as the next one covers them; screenshots travel inside tilted monitors.
const cards = [...document.querySelectorAll('.work-card')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const control = document.getElementById('motion-control');
const SPEED = 230;
const REST = 1100;
let paused = false;
let frame = 0;
let lastTime = 0;
let layoutFrame = 0;
const clamp = value => Math.min(1, Math.max(0, value));
const shots = cards.map(card => ({
  card,
  img: card.querySelector('img.page'),
  screen: card.querySelector('.mon-screen'),
  pos: 0,
  dist: 0,
  dir: 1,
  wait: REST,
  visible: false,
  covered: true
}));
function paint(shot) {
  shot.img.style.transform = `translate3d(0,${-shot.pos.toFixed(1)}px,0)`;
}
function measure(shot) {
  shot.dist = Math.max(0, shot.img.offsetHeight - shot.screen.clientHeight);
  shot.pos = Math.min(shot.pos, shot.dist);
  paint(shot);
  wake();
}
function restart(shot) {
  shot.pos = 0;
  shot.dir = 1;
  shot.wait = REST;
  paint(shot);
}
function canAnimate() {
  return !paused && !reduced.matches && !document.hidden && shots.some(s => s.visible && !s.covered && s.dist > 0);
}
function wake() {
  if (!frame && canAnimate()) {
    lastTime = 0;
    frame = requestAnimationFrame(run);
  }
}
function run(time) {
  frame = 0;
  if (!canAnimate()) return;
  const dt = Math.min(64, time - (lastTime || time));
  lastTime = time;
  for (const shot of shots) {
    if (!shot.visible || shot.covered || !shot.dist) continue;
    if (shot.wait > 0) { shot.wait -= dt; continue; }
    const remaining = shot.dir > 0 ? shot.dist - shot.pos : shot.pos;
    const ease = Math.min(1, .3 + remaining / 160) * Math.min(1, .35 + (shot.dist - remaining) / 160);
    shot.pos += shot.dir * SPEED * ease * dt / 1000;
    if (shot.pos >= shot.dist) { shot.pos = shot.dist; shot.dir = -1; shot.wait = REST; }
    else if (shot.pos <= 0) { shot.pos = 0; shot.dir = 1; shot.wait = REST; }
    paint(shot);
  }
  frame = requestAnimationFrame(run);
}
function refreshLayout() {
  layoutFrame = 0;
  const viewport = innerHeight;
  const bounds = cards.map(card => card.getBoundingClientRect());
  // Read geometry together before writing any transforms.
  const screens = shots.map(shot => shot.screen.getBoundingClientRect());
  const offsets = cards.map(card => parseFloat(getComputedStyle(card).top));
  cards.forEach((card, i) => {
    let progress = 0;
    if (bounds[i + 1]) progress = clamp((offsets[i] + card.offsetHeight - bounds[i + 1].top) / card.offsetHeight);
    card.style.transform = !reduced.matches && progress ? `scale(${(1 - progress * .06).toFixed(4)})` : '';
    card.querySelector('.card-dim').style.opacity = reduced.matches ? '0' : (progress * .28).toFixed(3);
    const rect = screens[i];
    let covered = rect.bottom <= 0 || rect.top >= viewport;
    if (!covered) for (let k = i + 1; k < bounds.length; k++) {
      if (bounds[k].top <= rect.top + 1 && bounds[k].bottom >= rect.bottom - 1) { covered = true; break; }
    }
    if (covered && !shots[i].covered) restart(shots[i]);
    shots[i].covered = covered;
  });
  wake();
}
function queueLayout() {
  if (!layoutFrame) layoutFrame = requestAnimationFrame(refreshLayout);
}
function syncMotion() {
  control.hidden = reduced.matches;
  document.body.classList.toggle('motion', !reduced.matches);
  control.setAttribute('aria-pressed', String(paused));
  const label = paused ? 'تشغيل الحركة' : 'إيقاف الحركة';
  control.setAttribute('aria-label', label);
  control.querySelector('span').textContent = label;
  control.querySelector('path').setAttribute('d', paused ? 'm8 5 11 7-11 7Z' : 'M8 5v14M16 5v14');
  queueLayout();
  if (paused || reduced.matches) { cancelAnimationFrame(frame); frame = 0; }
  else wake();
}
control.addEventListener('click', () => { paused = !paused; syncMotion(); });
reduced.addEventListener('change', syncMotion);
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    const shot = shots.find(s => s.card === entry.target);
    shot.visible = entry.isIntersecting;
    if (entry.isIntersecting) entry.target.classList.add('seen');
  }
  queueLayout();
}, { threshold: .2 });
shots.forEach(shot => {
  observer.observe(shot.card);
  if (shot.img.complete && shot.img.naturalWidth) measure(shot);
  else shot.img.addEventListener('load', () => { measure(shot); queueLayout(); }, { once: true });
});
const sizeObserver = new ResizeObserver(() => { shots.forEach(measure); queueLayout(); });
shots.forEach(shot => sizeObserver.observe(shot.screen));
addEventListener('scroll', queueLayout, { passive: true });
addEventListener('resize', () => { shots.forEach(measure); queueLayout(); }, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
  else queueLayout();
});
syncMotion();
refreshLayout();
