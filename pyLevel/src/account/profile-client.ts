export function initProfile() {
  const form = document.getElementById('profile-form') as HTMLFormElement | null;
  if (!form) return;
  const input = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
  const status = document.getElementById('profile-status')!;
  const save = document.getElementById('profile-save') as HTMLButtonElement;
  const passwordField = document.getElementById('email-password-field')!;
  input('email').addEventListener('input', () => {
    const changed = input('email').value.trim().toLowerCase() !== form.dataset.originalEmail;
    passwordField.hidden = !changed; input('currentPassword').required = changed;
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity() || save.disabled) return;
    save.disabled = true; save.textContent = 'Guardando…';
    try {
      const response = await fetch('/api/account/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No pudimos guardar los cambios.');
      const user = data.user;
      document.getElementById('account-name')!.textContent = user.displayName;
      document.getElementById('account-email')!.textContent = user.email;
      document.getElementById('account-occupation')!.textContent = user.occupation || 'Completa tu ocupación';
      document.getElementById('account-avatar')!.textContent = user.displayName.split(/\s+/).slice(0, 2).map((n: string) => n[0]).join('').toUpperCase();
      document.getElementById('account-birthday')!.textContent = user.birthday ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${user.birthday}T12:00:00Z`)) : 'Sin completar';
      input('displayName').value = user.displayName; input('email').value = user.email; input('occupation').value = user.occupation || ''; input('birthday').value = user.birthday || '';
      input('currentPassword').value = ''; input('currentPassword').required = false; passwordField.hidden = true;
      form.dataset.originalEmail = user.email;
      status.textContent = 'Tu perfil se guardó correctamente.'; status.dataset.error = 'false'; status.hidden = false;
      window.dispatchEvent(new Event('pylevel:profile-updated'));
    } catch (error) { status.textContent = (error as Error).message; status.dataset.error = 'true'; status.hidden = false; }
    finally { save.disabled = false; save.textContent = 'Guardar cambios →'; }
  });
  document.getElementById('profile-logout')?.addEventListener('click', async () => {
    const button = document.getElementById('profile-logout') as HTMLButtonElement;
    button.disabled = true;
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error();
      try { localStorage.removeItem('pylevel:current_user'); } catch {}
      window.location.href = '/login';
    } catch { document.getElementById('logout-status')!.textContent = 'No se pudo cerrar la sesión. Vuelve a intentar.'; button.disabled = false; }
  });
}
