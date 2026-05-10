import { apiFetch } from './api.js';
import { toast } from './ui.js';

const form = document.getElementById('register-form');
const errorEl = document.getElementById('register-error');

const nameEl = document.getElementById('reg-name');
const mobileEl = document.getElementById('reg-mobile');
const emailEl = document.getElementById('reg-email');
const passEl = document.getElementById('reg-password');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.classList.add('hidden');

  try {
    const name = nameEl.value.trim();
    const mobileNumber = mobileEl.value.trim();
    const email = emailEl.value.trim();
    const password = passEl.value;

    if (!name || !mobileNumber || !email || !password) {
      throw new Error('All fields are required');
    }

    const payload = {
      name,
      mobileNumber,
      email,
      password
    };

    await apiFetch('/auth/register', {
      method: 'POST',
      body: payload
    });
    toast('OTP sent to your email');
    window.location.href = `/verify-otp.html?email=${encodeURIComponent(email)}`;

  } catch (err) {
    console.error(err);
    errorEl.textContent = err.message || 'Registration failed';
    errorEl.classList.remove('hidden');
  }
});