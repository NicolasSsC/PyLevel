const search = document.getElementById('manual-search') as HTMLInputElement | null;
const topics = [...document.querySelectorAll<HTMLElement>('.doc-topic')];
const links = [...document.querySelectorAll<HTMLAnchorElement>('.manual-index a')];
const tabBtns = [...document.querySelectorAll<HTMLButtonElement>('.manual-tab-btn')];
const subSections = [...document.querySelectorAll<HTMLElement>('.manual-sub-content')];
const indexGroups = [...document.querySelectorAll<HTMLElement>('.manual-index-group')];
const emptyMsg = document.getElementById('manual-empty');

let currentTab: 'admin' | 'tecnico' = 'admin';

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

function setManualTab(tab: 'admin' | 'tecnico') {
  currentTab = tab;
  for (const btn of tabBtns) {
    const isActive = btn.dataset.manualTarget === tab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  }

  const query = search ? normalize(search.value.trim()) : '';
  if (!query) {
    for (const sec of subSections) {
      sec.hidden = sec.dataset.manualSection !== tab;
    }
    for (const grp of indexGroups) {
      grp.hidden = grp.dataset.manualGroup !== tab;
    }
    for (const topic of topics) {
      const topicParent = topic.closest('.manual-sub-content') as HTMLElement | null;
      topic.hidden = topicParent ? topicParent.dataset.manualSection !== tab : false;
    }
    for (const link of links) {
      const linkParent = link.closest('.manual-index-group') as HTMLElement | null;
      link.hidden = linkParent ? linkParent.dataset.manualGroup !== tab : false;
    }
    if (emptyMsg) emptyMsg.hidden = true;
  }
}

for (const btn of tabBtns) {
  btn.addEventListener('click', () => {
    const target = (btn.dataset.manualTarget as 'admin' | 'tecnico') || 'admin';
    setManualTab(target);
  });
}

if (search) {
  search.addEventListener('input', () => {
    const query = normalize(search.value.trim());
    if (!query) {
      setManualTab(currentTab);
      return;
    }

    // When querying, show all sections and index groups that have matching content
    for (const sec of subSections) sec.hidden = false;
    for (const grp of indexGroups) grp.hidden = false;

    let visible = 0;
    for (const topic of topics) {
      const matches = normalize(topic.textContent || '').includes(query);
      topic.hidden = !matches;
      const link = links.find(a => a.hash === `#${topic.id}`);
      if (link) link.hidden = !matches;
      if (matches) visible++;
    }

    // Hide empty index groups
    for (const grp of indexGroups) {
      const hasVisibleLinks = [...grp.querySelectorAll<HTMLAnchorElement>('a')].some(a => !a.hidden);
      grp.hidden = !hasVisibleLinks;
    }

    if (emptyMsg) emptyMsg.hidden = visible > 0;
  });
}

// Copy code functionality
document.querySelectorAll<HTMLButtonElement>('.copy-btn').forEach(button => {
  button.addEventListener('click', async () => {
    const code = button.closest('.code-block-wrap')?.querySelector('code')?.textContent;
    const feedback = document.getElementById('manual-feedback');
    if (!code || !feedback) return;
    try {
      await navigator.clipboard.writeText(code);
      feedback.textContent = 'Código copiado al portapapeles.';
    } catch {
      feedback.textContent = 'El navegador no permitió copiar. Puedes seleccionar el código del ejemplo.';
    }
  });
});

// Detect hash or query parameter on load
function checkHash() {
  const hash = window.location.hash;
  const urlParams = new URLSearchParams(window.location.search);
  const subParam = urlParams.get('sub');

  if (subParam === 'tecnico' || hash.startsWith('#tec-') || hash.startsWith('#capitulo-tec-')) {
    setManualTab('tecnico');
  } else {
    setManualTab('admin');
  }

  if (hash) {
    const el = document.querySelector(hash);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }
}

window.addEventListener('hashchange', checkHash);
checkHash();
