export function initHome() {
  const root = document.getElementById('python-home');
  if (!root) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reveals = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
  const chapters = Array.from(root.querySelectorAll<HTMLAnchorElement>('[data-chapter]'));
  const scenes = Array.from(root.querySelectorAll<HTMLElement>('[data-scene]'));
  const visibleScenes = new Map<string, number>();
  let revealObserver: IntersectionObserver | null = null;
  let sceneObserver: IntersectionObserver | null = null;
  let frame = 0;

  function configureMotion() {
    revealObserver?.disconnect();
    revealObserver = null;
    root!.classList.toggle('home-motion', !reduced.matches);
    if (reduced.matches || !('IntersectionObserver' in window)) {
      root!.classList.remove('home-motion');
      reveals.forEach(node => node.classList.add('is-visible'));
      root!.style.setProperty('--hero-drift', '0px');
      return;
    }
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver?.unobserve(entry.target);
      });
    }, { threshold: .08, rootMargin: '0px 0px -20px 0px' });
    reveals.forEach(node => { if (!node.classList.contains('is-visible')) revealObserver!.observe(node); });
  }
  if ('IntersectionObserver' in window) {
    sceneObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const node = entry.target as HTMLElement;
        node.classList.toggle('is-active', entry.isIntersecting);
        if (entry.isIntersecting) visibleScenes.set(node.id, entry.intersectionRatio);
        else visibleScenes.delete(node.id);
      });
      const current = [...visibleScenes].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (current) chapters.forEach(link => {
        if (link.dataset.chapter === current) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-15% 0px -20% 0px', threshold: [0, .15, .35, .6, .85] });
    scenes.forEach(scene => sceneObserver!.observe(scene));
  }
  function updateScroll() {
    frame = 0;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    root!.style.setProperty('--reading-progress', String(maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0));
    if (!reduced.matches) root!.style.setProperty('--hero-drift', `${Math.min(window.scrollY * .16, 80)}px`);
  }
  function onScroll() { if (!frame) frame = requestAnimationFrame(updateScroll); }
  const anchors = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
  function jumpToSection(event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.currentTarget as HTMLAnchorElement;
    const destination = document.getElementById(link.hash.slice(1));
    if (!destination) return;
    event.preventDefault();
    history.replaceState(null, '', link.hash);
    destination.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' });
    // Keep keyboard navigation at the section reached without a second scroll.
    destination.setAttribute('tabindex', '-1');
    destination.focus({ preventScroll: true });
  }
  anchors.forEach(link => link.addEventListener('click', jumpToSection));
  configureMotion();
  updateScroll();
  reduced.addEventListener('change', configureMotion);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  window.addEventListener('pagehide', event => {
    cancelAnimationFrame(frame); frame = 0;
    // BFCache keeps this document: leave its observers/listeners ready for return.
    if (event.persisted) return;
    revealObserver?.disconnect(); sceneObserver?.disconnect();
    window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll);
    reduced.removeEventListener('change', configureMotion);
  }, { once: true });
  window.addEventListener('pageshow', event => {
    if (event.persisted) { configureMotion(); updateScroll(); }
  });
}
