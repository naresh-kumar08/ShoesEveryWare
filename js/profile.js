import { apiFetch, authHeaders, requireAuth } from './api.js';
import { toast, openModal, closeModal } from './ui.js';

const nameEl = document.getElementById('profile-name');
const mobileEl = document.getElementById('profile-mobile');
const emailEl = document.getElementById('profile-email');
const cartItemsEl = document.getElementById('profile-cart-items');
const cartTotalEl = document.getElementById('profile-cart-total');

const checkoutModal = document.getElementById('checkout-modal');
const checkoutCancelBtn = document.getElementById('checkout-cancel');
const checkoutPlaceBtn = document.getElementById('checkout-place');
const checkoutAddressEl = document.getElementById('checkout-address');
const proceedBtn = document.getElementById('profile-proceed');

function renderCart(items) {
  cartItemsEl.innerHTML = '';
  if (!items || items.length === 0) {
    cartItemsEl.innerHTML = `<div class="notice">Your cart is empty.</div>`;
    cartTotalEl.textContent = '₹ 0';
    return;
  }

  for (const it of items) {
    const el = document.createElement('div');
    el.className = 'notice';
    el.innerHTML = `
      <div style="font-weight:900;">${it.product.name}</div>
      <div style="color:#565959;font-size:13px;margin-top:4px;">Brand: ${it.product.brand}</div>
      <div style="margin-top:6px;color:#599851;font-size:13px;">Qty: ${it.quantity}</div>
      <div style="margin-top:6px;font-weight:900;">Line Total: ₹ ${Number(it.lineTotal).toFixed(0)}</div>
    `;
    cartItemsEl.appendChild(el);
  }
}

proceedBtn.onclick = () => openModal(checkoutModal);
checkoutCancelBtn.onclick = () => closeModal(checkoutModal);

checkoutPlaceBtn.onclick = async () => {
  try {
    const deliveryAddress = String(checkoutAddressEl.value || '').trim();
    if (!deliveryAddress) {
      toast('Please enter delivery address');
      return;
    }

    await apiFetch('/orders/checkout', {
      method: 'POST',
      headers: authHeaders(),
      body: { deliveryAddress, paymentMethod: 'COD' }
    });

    toast('Order placed');
    closeModal(checkoutModal);
    window.location.href = '/orders.html';
  } catch (err) {
    toast(err.message || 'Checkout failed');
  }
};

(async () => {
  const me = await requireAuth('/profile.html');
  if (!me) return;

  nameEl.textContent = me.name || '';
  mobileEl.textContent = me.mobileNumber || '';
  emailEl.textContent = me.email || '';

  try {
    const cart = await apiFetch('/cart', { headers: authHeaders() });
    renderCart(cart.items || []);
    cartTotalEl.textContent = `₹ ${Number(cart.cartTotal || 0).toFixed(0)}`;
  } catch (err) {
    toast(err.message || 'Failed to load cart');
  }
})();

