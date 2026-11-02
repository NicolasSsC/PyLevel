export function initFeatureJourney() {
  const journey = document.getElementById('pylevel-journey');
  if (!journey) return;
  const stage = journey.querySelector<HTMLElement>('.journey-stage');
  const nav = journey.querySelector<HTMLElement>('.journey-nav');
  const content = journey.querySelector<HTMLElement>('.journey-content');
  const panels = [...journey.querySelectorAll<HTMLElement>('[data-feature]')];
  const buttons = [...journey.querySelectorAll<HTMLButtonElement>('[data-feature-target]')];
  if (!stage || !nav || !content || panels.length !== buttons.length) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let enhanced = false;
  let active = -1;
  let frame = 0;
  let resizeFrame = 0;
  let stickyTop = 68;

  function select(index: number) {
    if (index === active) return;
    active = index;
    panels.forEach((panel, i) => {
      const current = i === index;
      panel.classList.toggle('is-current', current);
      panel.inert = !current;
      panel.setAttribute('aria-hidden', String(!current));
    });
    buttons.forEach((button, i) => button.setAttribute('aria-expanded', String(i === index)));
  }

  function update() {
    frame = 0;
    if (!enhanced) return;
    const range = journey!.offsetHeight - stage!.offsetHeight;
    const progress = range > 0 ? Math.max(0, Math.min(1, (stickyTop - journey!.getBoundingClientRect().top) / range)) : 0;
    const step = progress * (panels.length - 1);
    const index = Math.min(panels.length - 1, Math.round(step));
    select(index);
    buttons[index].style.setProperty('--step-progress', '1');
  }
  function scheduleUpdate() {
    if (enhanced && !frame) frame = requestAnimationFrame(update);
  }

  function restoreReading() {
    enhanced = false;
    journey!.classList.remove('is-scroll-story');
    nav!.hidden = true;
    panels.forEach(panel => {
      panel.inert = false;
      panel.removeAttribute('aria-hidden');
      panel.classList.remove('is-current');
    });
    active = -1;
  }
  function configure() {
    resizeFrame = 0;
    cancelAnimationFrame(frame); frame = 0;
    const navHeight = document.getElementById('top-navbar')?.offsetHeight || 68;
    stickyTop = navHeight;
    const height = window.innerHeight - stickyTop;
    if (motion.matches || window.innerWidth <= 760 || window.innerHeight < 680) {
      restoreReading();
      return;
    }
    journey!.style.setProperty('--story-height', `${height}px`);
    journey!.style.setProperty('--story-top', `${stickyTop}px`);
    enhanced = true;
    journey!.classList.add('is-scroll-story');
    nav!.hidden = false;
    // Zoom, large fonts, or a short viewport must never clip the explanation.
    if (panels.some(panel => panel.scrollHeight > panel.clientHeight + 2) || nav!.scrollHeight > content!.clientHeight) {
      restoreReading();
      return;
    }
    active = -1;
    update();
  }
  function onResize() { if (!resizeFrame) resizeFrame = requestAnimationFrame(configure); }

  buttons.forEach((button, index) => button.addEventListener('click', () => {
    if (!enhanced) return;
    const range = journey.offsetHeight - stage.offsetHeight;
    const top = window.scrollY + journey.getBoundingClientRect().top - stickyTop + range * index / (panels.length - 1);
    window.scrollTo({ top, behavior: motion.matches ? 'instant' : 'smooth' });
  }));

  configure();
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  motion.addEventListener('change', configure);
  window.addEventListener('pageshow', event => { if (event.persisted) configure(); });
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    cancelAnimationFrame(frame); cancelAnimationFrame(resizeFrame);
    window.removeEventListener('scroll', scheduleUpdate);
    window.removeEventListener('resize', onResize);
    motion.removeEventListener('change', configure);
  }, { once: true });
}
