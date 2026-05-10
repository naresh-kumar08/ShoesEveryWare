import { apiFetch, authHeaders, requireAuth } from './api.js';
import { toast } from './ui.js';

const emptyEl = document.getElementById('orders-empty');
const recentEl = document.getElementById('recent-orders');
const prevEl = document.getElementById('prev-orders');

function orderCard(order) {
  const div = document.createElement('div');
  div.className = 'notice';

  const itemsHtml = (order.items || [])
    .map(
      (it) =>
        `<div style="margin-top:6px;color:#ccb899;">
          ${it.name} (x${it.quantity}) - ₹ ${Number(it.price).toFixed(0)}
        </div>`
    )
    .join('');

  div.innerHTML = `
    <div style="font-weight:900;">Order Total: ₹ ${Number(order.totalPrice).toFixed(0)}</div>
    <div style="color:#aaaaaa;font-size:13px;margin-top:4px;">
      Status: <strong style="color:#aaaaaa;">${order.status}</strong>
      | Payment: <strong style="color:#599851;">${order.paymentMethod}</strong>
    </div>
    <div style="margin-top:8px;color:#aaaaaa;font-size:13px;">
      Delivery: ${String(order.deliveryAddress || '')}
    </div>
    ${itemsHtml}
    <div style="margin-top:10px;color:#aaaaaa;font-size:12px;">
      Placed: ${new Date(order.createdAt || order.updatedAt).toLocaleString()}
    </div>
  `;

  return div;
}

async function loadOrders() {
  const data = await apiFetch('/orders/me', { headers: authHeaders() });
  const orders = data.orders || [];
  if (orders.length === 0) {
    emptyEl.classList.remove('hidden');
    recentEl.innerHTML = '';
    prevEl.innerHTML = '';
    return;
  }

  emptyEl.classList.add('hidden');

  const recent = orders.slice(0, 2);
  const previous = orders.slice(2);

  recentEl.innerHTML = '';
  for (const o of recent) recentEl.appendChild(orderCard(o));

  prevEl.innerHTML = '';
  for (const o of previous) prevEl.appendChild(orderCard(o));
}

(async () => {
  const me = await requireAuth('/orders.html');
  if (!me) return;

  try {
    await loadOrders();
  } catch (err) {
    toast(err.message || 'Failed to load orders');
  }
})();

