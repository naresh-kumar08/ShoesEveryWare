import { apiFetch } from './api.js';
import { toast } from './ui.js';

const form = document.getElementById('otp-form');
const otpEl = document.getElementById('otp');
const errorEl = document.getElementById('error');
const emailEl = document.getElementById('otp-email');

// URL se email lo
const params = new URLSearchParams(window.location.search);
const email = params.get('email');
emailEl.textContent = email || '';

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  try {
    if (!email) throw new Error('Email missing. Please register again.');
    const otp = otpEl.value.trim();

    if (!otp) throw new Error('Enter OTP');

    const data = await apiFetch('/auth/verify-otp', {
      method: 'POST',
      body: { email, otp }
    });

    toast('Account verified successfully');

    window.location.href = '/login.html';

  } catch (err) {
    errorEl.textContent = err.message || 'Invalid OTP';
  }
});