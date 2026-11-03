const search = document.getElementById('manual-search') as HTMLInputElement;
const topics = [...document.querySelectorAll<HTMLElement>('.doc-topic')];
const links = [...document.querySelectorAll<HTMLAnchorElement>('.manual-index a')];
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

search.addEventListener('input', () => {
  const query = normalize(search.value.trim());
  let visible = 0;
  for (const topic of topics) {
    const matches = !query || normalize(topic.textContent || '').includes(query);
    topic.hidden = !matches;
    const link = links.find(a => a.hash === `#${topic.id}`);
    if (link) link.hidden = !matches;
    if (matches) visible++;
  }
  document.getElementById('manual-empty')!.hidden = visible > 0;
});

document.querySelectorAll<HTMLButtonElement>('.copy-btn').forEach(button => {
  button.addEventListener('click', async () => {
    const code = button.closest('.code-block-wrap')?.querySelector('code')?.textContent;
    const feedback = document.getElementById('manual-feedback')!;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      feedback.textContent = 'Ejemplo de pruebas copiado.';
    } catch {
      feedback.textContent = 'El navegador no permitió copiar. Puedes seleccionar el código del ejemplo.';
    }
  });
});
