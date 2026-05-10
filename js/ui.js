import { tryGetMe, logout } from './api.js';

export function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 2500);
}

function setLink(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('hidden', !show);
}

export async function initHeaderAuth() {
  const linkLogin = document.getElementById('link-login');
  const linkRegister = document.getElementById('link-register');
  const linkLogout = document.getElementById('link-logout');
  const linkAdmin = document.getElementById('link-admin');
  const userNameEl = document.getElementById('user-name');

  if (!linkLogin || !linkRegister || !linkLogout || !linkAdmin) return;

  // Default: logged out
  setLink('link-login', true);
  setLink('link-register', true);
  setLink('link-logout', false);
  setLink('link-admin', false);

  linkLogout.onclick = (e) => {
    e.preventDefault();
    logout();
  };

  const me = await tryGetMe();
  if (!me) return;

  linkLogin.classList.add('hidden');
  linkRegister.classList.add('hidden');
  linkLogout.classList.remove('hidden');
  if (me.role === 'admin') linkAdmin.classList.remove('hidden');
  if (userNameEl) userNameEl.textContent = me.name || '';
}

export function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove('hidden');
}

export function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add('hidden');
}

