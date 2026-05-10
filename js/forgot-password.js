import { apiFetch } from './api.js';
import { toast } from './ui.js';

const requestForm = document.getElementById('request-otp-form');
const resetForm = document.getElementById('reset-password-form');
const emailEl = document.getElementById('reset-email');
const otpEl = document.getElementById('reset-otp');
const newPassEl = document.getElementById('reset-new-password');
const confirmPassEl = document.getElementById('reset-confirm-password');
const errorEl = document.getElementById('reset-error');




function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function clearError() {
  errorEl.textContent = '';
  errorEl.classList.add('hidden');
}

requestForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  try {
    const email = String(emailEl.value || '').trim();
    if (!email) throw new Error('Email is required');

    await apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: { email }
    });
    toast('OTP sent to your email');
  } catch (err) {
    showError(err.message || 'Failed to send OTP');
  }
  console.log("function loasd");
  //  document.getElementById("#h4").innerHTML = 'Successfully';
  button.innerHTML = 'Successfully';
});





resetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  try {
    const email = String(emailEl.value || '').trim();
    const otp = String(otpEl.value || '').trim();
    const newPassword = String(newPassEl.value || '');
    const confirmPassword = String(confirmPassEl.value || '');

    if (!email || !otp || !newPassword || !confirmPassword) {
      throw new Error('All fields are required');
    }
    if (newPassword !== confirmPassword) {
      throw new Error('Passwords do not match');
    }

    await apiFetch('/auth/reset-password', {
      method: 'POST',
      body: { email, otp, newPassword }
    });

    toast('Password reset successful');
    window.location.href = `/login.html?email=${encodeURIComponent(email)}`;
  } catch (err) {
    showError(err.message || 'Password reset failed');
  }
  
});
