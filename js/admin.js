import { apiFetch, authHeaders, requireAuth } from './api.js';
import { toast } from './ui.js';

const addForm = document.getElementById('add-product-form');
const prodNameEl = document.getElementById('prod-name');
const prodBrandEl = document.getElementById('prod-brand');
const prodPriceEl = document.getElementById('prod-price');
const prodImageEl = document.getElementById('prod-image');
const statusEl = document.getElementById('admin-product-status');

const usersEl = document.getElementById('admin-users');
const ordersEl = document.getElementById('admin-orders');

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.remove('hidden');
  statusEl.style.borderColor = isError ? 'rgba(255,77,109,0.5)' : 'rgba(36,209,143,0.4)';
}

async function loadBrandsIntoSelect() {
  const data = await apiFetch('/products/brands');
  const dbBrands = data.brands || [];

  const defaultBrands = ['Nike', 'Adidas', 'Puma', 'Reebok', 'Skechers','Red-tape','Campus','Liberty','Wood-land','Air-Jordan','Bata','Relaxo Footwears','Paragon','Red Chief','Khadim'];

  const allBrands = [...new Set([...defaultBrands, ...dbBrands])];

  prodBrandEl.innerHTML = '';
  for (const b of allBrands) {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    prodBrandEl.appendChild(opt);
  }
}

async function loadUsers() {
  const data = await apiFetch('/admin/users', { headers: authHeaders() });
  const users = data.users || [];

  const table = document.createElement('table');
  table.className = 'table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>User</th>
        <th>Email</th>
        <th>Mobile</th>
        <th>Role</th>
        <th>Active</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');
  for (const u of users) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-weight:900;">${u.name}</td>
      <td>${u.email}</td>
      <td>${u.mobileNumber}</td>
      <td>${u.role}</td>
      <td>${u.active ? 'Active' : 'Inactive'}</td>
      <td>
        <button style="color:black;" class="toggle ${u.active ? 'on' : 'off'}" type="button" data-user-id="${u._id}" data-next-active="${(!u.active).toString()}">
          ${u.active ? 'Deactivate' : 'Activate'}
        </button>
      </td>
    `;

    row.querySelector('button').onclick = async () => {
      const nextActive = row.querySelector('button').dataset.nextActive === 'true';
      try {
        await apiFetch(`/admin/users/${u._id}`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: { active: nextActive }
        });
        toast('User status updated');
        await loadUsers();
      } catch (err) {
        toast(err.message || 'Update failed');
      }
    };

    tbody.appendChild(row);
  }

  usersEl.innerHTML = '';
  usersEl.appendChild(table);
}

function orderDetailBlock(enriched) {
  const { order, user } = enriched;
  const itemsHtml = (order.items || [])
    .map((it) => `<div style="margin-top:4px;color:#FFFFFF;">${it.name} (x${it.quantity}) - ₹ ${Number(it.price).toFixed(0)}</div>`)
    .join('');

  const u = user || {};
  const userLine = u.name ? `${u.name} (${u.email || ''})` : `${order.userId}`;

  const div = document.createElement('div');
  div.className = 'notice';
  div.innerHTML = `
    <div style="font-weight:900;">Order Total: ₹ ${Number(order.totalPrice).toFixed(0)}</div>
    <div style="color:#565959;font-size:13px;margin-top:4px;">
      User: ${userLine}
      <div>Mobile: ${u.mobileNumber || ''}</div>
    </div>
    <div style="margin-top:8px;font-size:13px;color:#aaaaaa;">
      Address: ${String(order.deliveryAddress || '')}
    </div>
    <div style="margin-top:8px;color:#aaaaaa;font-size:13px;">
      Status: <strong>${order.status}</strong> | Payment: <strong>${order.paymentMethod}</strong>
    </div>
    <div style="margin-top:10px;">
      <div style="color:#565959;font-size:12px;text-transform:uppercase;letter-spacing:0.3px;">Items</div>
      ${itemsHtml}
    </div>
    <div style="margin-top:10px;color:#565959;font-size:12px;">
      Placed: ${new Date(order.createdAt || order.updatedAt).toLocaleString()}
    </div>

    <div style="margin-top:10px;">
      <label for="status-${order._id}" style="font-size:13px;color:#0f1111;">Change Status:</label>
      <select id="status-${order._id}" style="margin-left:8px;">
        <option value="Placed" ${order.status === 'Placed' ? 'selected' : ''}>Placed</option>
        <option value="Shipped" ${order.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
        <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
        <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
      </select>
    </div>
  `;

  div.querySelector(`#status-${order._id}`).addEventListener('change', async (e) => {
    const newStatus = e.target.value;
    await updateStatus(order._id, newStatus);
    await loadOrders();
  });

  return div;
}

async function loadOrders() {
  const data = await apiFetch('/admin/orders', { headers: authHeaders() });
  const orders = data.orders || [];
  ordersEl.innerHTML = '';
  if (orders.length === 0) {
    ordersEl.innerHTML = `<div class="notice">No orders yet.</div>`;
    return;
  }
  for (const o of orders) ordersEl.appendChild(orderDetailBlock(o));
}

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  statusEl.classList.add('hidden');
  try {
    const images = Array.from(prodImageEl.files || []);
    if (images.length === 0) throw new Error('Please select at least one image');
    if (images.length > 6) throw new Error('Maximum 6 images allowed');

    const fd = new FormData();
    fd.append('name', prodNameEl.value.trim());
    fd.append('brand', prodBrandEl.value);
    fd.append('price', prodPriceEl.value);
    for (const image of images) fd.append('images', image);

    await apiFetch('/admin/products', {
      method: 'POST',
      headers: authHeaders(),
      body: fd,
      isMultipart: true
    });

    setStatus('Product added successfully');
    await loadBrandsIntoSelect();
    addForm.reset();
  } catch (err) {
    setStatus(err.message || 'Failed to add product', true);
  }
});

async function updateStatus(orderId, status) {
  try {
    await apiFetch(`/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: { status }
    });
    toast('Order status updated');
  } catch (err) {
    toast(err.message || 'Failed to update status');
  }
}

(async () => {
  const me = await requireAuth('/admin.html');
  if (!me) return;
  if (me.role !== 'admin') {
    toast('Admin access required');
    window.location.href = '/index.html';
    return;
  }

  try {
    await loadBrandsIntoSelect();
    await loadUsers();
    await loadOrders();
    await loadProducts();   // ✅ YAH ADD KIY
  } catch (err) {
    toast(err.message || 'Failed to load admin data');
  }
})();








const productsEl = document.getElementById('admin-products');
let currentEditId = null;

// LOAD PRODUCTS
async function loadProducts() {
  const data = await apiFetch('/products');
  //const data = await apiFetch('/api/products');
  const products = data.products || [];

  productsEl.innerHTML = '';

  if (products.length === 0) {
    productsEl.innerHTML = `<div class="notice">No products found.</div>`;
    return;
  }

  for (const p of products) {
    const div = document.createElement('div');
    div.className = 'notice';

    div.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;">
          <img src="${p.imageUrl}" width="60" height="60" style="border-radius:6px;" />
        <div>
          <div style="font-weight:900;">${p.name}</div>
          <div style="font-size:13px;color:#aaaaaa;">${p.brand}</div>
          <div style="font-size:14px;">₹ ${p.price}</div>
            <div style="font-size:12px;color:#888;">${(p.imageUrls || []).length || 1} image(s)</div>
        </div>
      </div>

      <div style="margin-top:10px;">
        <button class="btn btn-primary btn-edit" data-id="${p._id}">Edit</button>
        <button class="btn btn-danger btn-delete" data-id="${p._id}">Delete</button>
      </div>
    `;

    // DELETE
    div.querySelector('.btn-delete').onclick = async () => {
      if (!confirm('Delete this product?')) return;

      try {
        await apiFetch(`/admin/products/${p._id}`, {
          method: 'DELETE',
          headers: authHeaders()
        });

        toast('Product deleted');
        loadProducts();
      } catch (err) {
        toast(err.message || 'Delete failed');
      }
    };

    // EDIT
    div.querySelector('.btn-edit').onclick = () => openEditModal(p);

    productsEl.appendChild(div);
  }
}

// OPEN EDIT MODAL
function openEditModal(p) {
  document.getElementById('edit-modal').classList.remove('hidden');

  document.getElementById('edit-name').value = p.name;
  document.getElementById('edit-brand').value = p.brand;
  document.getElementById('edit-price').value = p.price;

  currentEditId = p._id;
}

// SAVE EDIT
document.getElementById('save-edit').onclick = async () => {
  try {
    const fd = new FormData();

    fd.append('name', document.getElementById('edit-name').value.trim());
    fd.append('brand', document.getElementById('edit-brand').value.trim());
    fd.append('price', document.getElementById('edit-price').value);

    const files = Array.from(document.getElementById('edit-image').files || []);
    if (files.length > 6) throw new Error('Maximum 6 images allowed');
    for (const file of files) fd.append('images', file);

    await apiFetch(`/admin/products/${currentEditId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: fd,
      isMultipart: true
    });

    toast('Product updated');

    document.getElementById('edit-modal').classList.add('hidden');

    loadProducts();

  } catch (err) {
    toast(err.message || 'Update failed');
  }
};






