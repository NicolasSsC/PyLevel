import { playLogoPreload } from './preload';

export function initHomePreload() {
  const root = document.documentElement;
  let seen = false;
  try { seen = sessionStorage.getItem('pylevel_preload_seen') === 'true'; } catch { /* Storage is optional. */ }
  if (seen && new URLSearchParams(location.search).get('intro') !== '1') {
    delete root.dataset.homeIntro;
    return;
  }
  const background = ['python-home', 'top-navbar', 'pybot-widget']
    .map(id => document.getElementById(id)).filter((node): node is HTMLElement => !!node);
  const previousInert = background.map(node => node.inert);
  background.forEach(node => { node.inert = true; });
  root.dataset.homeIntro = 'preload';
  playLogoPreload(() => {
    try { sessionStorage.setItem('pylevel_preload_seen', 'true'); } catch { /* Entry works without storage. */ }
    delete root.dataset.homeIntro;
    background.forEach((node, i) => { node.inert = previousInert[i]; });
    const heading = document.getElementById('home-title');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
  });
}
