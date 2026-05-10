import { apiFetch, authHeaders, requireAuth } from './api.js';
import { toast } from './ui.js';

const detailEl = document.getElementById('product-detail');

function getProductId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

async function loadProduct() {
  try {
    const id = getProductId();

    // ❗ ID check
    if (!id) {
      detailEl.innerHTML = `<p>Invalid product</p>`;
      return;
    }

    const data = await apiFetch(`/products/${id}`);
    const p = data.product;

    // ❗ Product not found
    if (!p) {
      detailEl.innerHTML = `<p>Product not found</p>`;
      return;
    }

    const images = Array.isArray(p.imageUrls) && p.imageUrls.length > 0
      ? p.imageUrls
      : [p.imageUrl].filter(Boolean);
    const heroImage = images[0] || '';

    detailEl.innerHTML = `
      <div class="admin-section">
        <div style="display:grid;grid-template-columns:1.1fr 1fr;gap:24px;">
          <div>
            <img id="main-image" src="${heroImage}" alt="${p.name}" style="width:100%;max-width:520px;border-radius:14px;cursor:pointer;" />
            <div id="thumbs" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"></div>
            <div style="font-size:12px;color:#888;margin-top:8px;">Image pe click karoge to new tab me full image open hogi.</div>
          </div>
          <div>
            <h2>${p.name}</h2>
            <p>Brand: ${p.brand}</p>
            <h3>₹ ${p.price}</h3>
            <div style="display:flex;gap:10px;margin-top:16px;">
              <button id="add-cart" class="btn">Add to Cart</button>
              <button id="buy-now" class="btn btn-primary">Buy Now</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const mainImageEl = document.getElementById('main-image');
    mainImageEl.onclick = () => window.open(mainImageEl.src, '_blank');

    const thumbsEl = document.getElementById('thumbs');
    for (const src of images) {
      const thumb = document.createElement('img');
      thumb.src = src;
      thumb.alt = `${p.name} image`;
      thumb.style.width = '72px';
      thumb.style.height = '72px';
      thumb.style.objectFit = 'cover';
      thumb.style.borderRadius = '8px';
      thumb.style.cursor = 'pointer';
      thumb.onclick = () => {
        mainImageEl.src = src;
      };
      thumbsEl.appendChild(thumb);
    }

    document.getElementById('add-cart').onclick = () => addToCart(p._id);
    document.getElementById('buy-now').onclick = () => buyNow(p._id);

  } catch (err) {
    detailEl.innerHTML = `<p>Error loading product</p>`;
    console.error(err);
  }
}

async function addToCart(productId) {
  const me = await requireAuth('/index.html');
  if (!me) return;

  await apiFetch('/cart/add', {
    method: 'POST',
    headers: authHeaders(),
    body: { productId, quantity: 1 }
  });

  toast('Added to cart');
}

function buyNow(productId) {
  window.location.href = `/checkout.html?id=${productId}`;
}

loadProduct();