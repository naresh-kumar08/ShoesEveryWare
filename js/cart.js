import { apiFetch, authHeaders, requireAuth } from './api.js';
import { toast, openModal, closeModal } from './ui.js';

const itemsEl = document.getElementById('cart-items');
const noticeEl = document.getElementById('cart-notice');
const totalEl = document.getElementById('cart-total');

const checkoutModal = document.getElementById('checkout-modal');
const checkoutCancelBtn = document.getElementById('checkout-cancel');
const checkoutPlaceBtn = document.getElementById('checkout-place');
const checkoutAddressEl = document.getElementById('checkout-address');
const proceedBtn = document.getElementById('proceed-btn');

function setNotice(msg) {
  noticeEl.textContent = msg;
  noticeEl.classList.remove('hidden');
}

function clearNotice() {
  noticeEl.textContent = '';
  noticeEl.classList.add('hidden');
}

function renderItems(items) {
  if (!items || items.length === 0) {
    itemsEl.innerHTML = '';
    setNotice('Your cart is empty. Add some shoes from the shop.');
    totalEl.textContent = '₹ 0';
    return;
  }

  const table = document.createElement('table');
  table.className = 'table';

  table.innerHTML = `
    <thead>
      <tr>
        <th>Product</th>
        <th>Brand</th>
        <th>Qty</th>
        <th>Price</th>
        <th>Total</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
    </tbody>
  `;

  const tbody = table.querySelector('tbody');
  for (const it of items) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <div style="display:flex;gap:10px;align-items:center;">
          <img src="${it.product.imageUrl || `https://placehold.co/80x80/png?text=${encodeURIComponent(it.product.brand)}`}" style="width:56px;height:56px;border-radius:12px;object-fit:cover;border:1px solid rgba(255,255,255,0.12);" />
          <div>
            <div style="font-weight:800;">${it.product.name}</div>
            <div style="color:#565959;font-size:12px;">${it.product.id}</div>
          </div>
        </div>
      </td>
      <td>${it.product.brand}</td>
      <td>${it.quantity}</td>
      <td>₹ ${Number(it.product.price).toFixed(0)}</td>
      <td>₹ ${Number(it.lineTotal).toFixed(0)}</td>
      <td>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <button class="qty-btn" type="button" data-qty-action="dec" data-product-id="${it.productId}">-</button>
          <span class="qty-value" aria-label="Quantity">${it.quantity}</span>
          <button class="qty-btn" type="button" data-qty-action="inc" data-product-id="${it.productId}">+</button>
          <button class="toggle off" type="button" data-qty-action="remove" data-product-id="${it.productId}">Remove</button>
        </div>
      </td>
    `;

    const updateBtn = row.querySelectorAll('button[data-qty-action]');
    updateBtn.forEach((btn) => {
      btn.onclick = async () => {
        const action = btn.dataset.qtyAction;
        const productId = btn.dataset.productId;
        const currentQty = Number(it.quantity);
        const nextQty =
          action === 'dec' ? Math.max(0, currentQty - 1) : action === 'inc' ? currentQty + 1 : 0;

        try {
          await apiFetch('/cart/update', {
            method: 'POST',
            headers: authHeaders(),
            body: { productId, quantity: nextQty }
          });

          if (nextQty === 0) toast('Removed from cart');
          else toast('Cart updated');

          await loadCart();
        } catch (err) {
          toast(err.message || 'Update failed');
        }
      };
    });

    tbody.appendChild(row);
  }

  itemsEl.innerHTML = '';
  itemsEl.appendChild(table);
}

async function loadCart() {
  clearNotice();
  const data = await apiFetch('/cart', { headers: authHeaders() });
  const items = data.items || [];
  renderItems(items);
  totalEl.textContent = `₹ ${Number(data.cartTotal || 0).toFixed(0)}`;
}

proceedBtn.onclick = () => {
  openModal(checkoutModal);
};

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

// Init
(async () => {
  const me = await requireAuth('/cart.html');
  if (!me) return;

  try {
    await loadCart();
  } catch (err) {
    setNotice(err.message || 'Failed to load cart');
  }
})();