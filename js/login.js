import { apiFetch, setToken } from './api.js';
import { toast } from './ui.js';

const form = document.getElementById('login-form');
const emailEl = document.getElementById('login-email');
const passEl = document.getElementById('login-password');
const errorEl = document.getElementById('login-error');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.classList.add('hidden');

  try {
    const email = emailEl.value.trim();
    const password = passEl.value;

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: { email, password }
    });

    console.log("LOGIN RESPONSE:", data); // ✅ correct log

    // check token
    if (!data.token) {
      throw new Error('Invalid login response');
    }

    setToken(data.token);

    // optional: save user
    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    toast('Logged in successfully');

    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get('returnUrl') || '/index.html';
    window.location.href = returnUrl;

  } catch (err) {
    console.error(err);
    errorEl.textContent = err.message || 'Login failed';
    errorEl.classList.remove('hidden');
  }
});