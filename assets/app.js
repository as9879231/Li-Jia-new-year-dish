/**
 * Customer Application Logic
 */

let cart = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await Store.init();
    await renderMenu();
    updateCartUI();
});

// Global temp variable for current selection
let curSelectId = null;

async function renderMenu() {
    const products = await Store.getProducts();
    const menuGrid = document.getElementById('menuGrid');

    if (products.length === 0) {
        menuGrid.innerHTML = '<p style="text-align:center; width:100%;">載入菜單失敗，請檢查網路連線或稍後再試。</p>';
        return;
    }

    menuGrid.innerHTML = products.map((dish, index) => `
        <div class="dish-card">
            <div class="dish-info">
                <h3 class="dish-title">${index + 1}. ${dish.name}</h3>
                <p class="dish-desc">${dish.desc}</p>
                <div class="dish-meta">
                    <span class="dish-price">${Store.formatCurrency(dish.price)}</span>
                    <button class="btn btn-outline" onclick="openQtyModal('${dish.id}', '${dish.name}', ${dish.price})">加入購物車</button>
                </div>
            </div>
        </div>
    `).join('');
}

// Qty Modal Logic
function openQtyModal(id, name, price) {
    curSelectId = id;
    document.getElementById('qtyModalTitle').innerText = name;
    document.getElementById('qtyModalPrice').innerText = Store.formatCurrency(price);
    document.getElementById('qtyModalValue').innerText = '1';
    document.getElementById('qtyModal').style.display = 'flex';
}

function closeQtyModal() {
    document.getElementById('qtyModal').style.display = 'none';
    curSelectId = null;
}

function adjustModalQty(delta) {
    const el = document.getElementById('qtyModalValue');
    let val = parseInt(el.innerText) || 1;
    val += delta;
    if (val < 1) val = 1;
    el.innerText = val;
}

async function confirmAddToCart() {
    if (!curSelectId) return;

    const qty = parseInt(document.getElementById('qtyModalValue').innerText) || 1;
    await addToCart(curSelectId, qty);
    closeQtyModal();
}

async function addToCart(id, quantity = 1) {
    const products = await Store.getProducts();
    // Convert id to string or number safely for comparison
    const dish = products.find(p => p.id == id || p.id === id);
    if (!dish) return;

    const existing = cart.find(item => item.id == id);

    if (existing) {
        existing.quantity += quantity;
    } else {
        cart.push({ ...dish, quantity: quantity });
    }

    updateCartUI();
    showToast(`已加入購物車 (${quantity}份)`);
}

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.innerText = message;
    toast.className = "toast show";
    setTimeout(function () { toast.className = toast.className.replace("show", ""); }, 3000);
}

function changeQty(id, delta) {
    const item = cart.find(i => i.id == id);
    if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) {
            cart = cart.filter(i => i.id != id);
        }
        updateCartUI();
    }
}

function updateCartUI() {
    const cartItemsEl = document.getElementById('cartItems');
    const cartCountEl = document.getElementById('cartCount');
    const cartTotalEl = document.getElementById('cartTotal');

    // Update Count
    const totalQty = cart.reduce((acc, item) => acc + item.quantity, 0);
    cartCountEl.innerText = totalQty;

    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<p style="text-align: center; color: #999; margin-top: 20px;">購物車是空的</p>';
        cartTotalEl.innerText = Store.formatCurrency(0);
        return;
    }

    // Update Items
    let total = 0;
    cartItemsEl.innerHTML = cart.map(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        return `
            <div class="cart-item">
                <div style="flex:1;">
                    <div style="font-weight: 700;">${item.name}</div>
                    <div style="font-size: 0.9rem; color: #666;">
                        ${Store.formatCurrency(item.price)}
                    </div>
                </div>
                <div class="cart-controls" style="display:flex; align-items:center; gap:8px;">
                    <button onclick="changeQty(${item.id}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="changeQty(${item.id}, 1)">+</button>
                </div>
            </div>
        `;
    }).join('');

    cartTotalEl.innerText = Store.formatCurrency(total);
}

// Toggles & Modals
function toggleCart(forceOpen = null) {
    const panel = document.getElementById('cartPanel');
    if (forceOpen === true) panel.classList.add('open');
    else if (forceOpen === false) panel.classList.remove('open');
    else panel.classList.toggle('open');
}

function openCheckout() {
    if (cart.length === 0) return alert('請先加入商品到購物車');
    document.getElementById('checkoutModal').classList.add('active');
    toggleCart(false);
}

function closeCheckout() {
    document.getElementById('checkoutModal').classList.remove('active');
}

// 1. Verify Verification
function verifyOrder(e) {
    e.preventDefault();

    const name = document.getElementById('cxName').value;
    const phone = document.getElementById('cxPhone').value;
    const note = document.getElementById('cxNote').value;

    if (!name || !phone) {
        showToast('請填寫完整資訊');
        return;
    }

    // Populate Pre-Modal
    document.getElementById('preName').innerText = name;
    document.getElementById('prePhone').innerText = phone;
    document.getElementById('preNote').innerText = note || '(無)';

    document.getElementById('preItems').innerHTML = cart.map(item => `
        <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem;">
            <span>${item.name} x ${item.quantity}</span>
            <span>${Store.formatCurrency(item.price * item.quantity)}</span>
        </div>
    `).join('');

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('preTotal').innerText = Store.formatCurrency(total);

    // Switch Modals
    document.getElementById('checkoutModal').classList.remove('active'); // Changed from style.display = 'none' to match openCheckout's classList.add('active')
    document.getElementById('preOrderModal').style.display = 'flex';
}

function backToEdit() {
    document.getElementById('preOrderModal').style.display = 'none';
    document.getElementById('checkoutModal').classList.add('active'); // Changed from style.display = 'flex' to match openCheckout's classList.add('active')
}

let lastOrder = null;

async function finalSubmitOrder() {
    // Data is already in form inputs, just read again
    const orderData = {
        name: document.getElementById('cxName').value,
        phone: document.getElementById('cxPhone').value,
        note: document.getElementById('cxNote').value,
        items: cart,
        totalAmount: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    };

    try {
        const newOrder = await Store.addOrder(orderData);
        lastOrder = newOrder; // Store for valid LINE sharing

        // Show Success Modal
        document.getElementById('confirmOrderId').innerText = '#' + newOrder.id;
        document.getElementById('confirmName').innerText = newOrder.name;
        document.getElementById('confirmTotal').innerText = Store.formatCurrency(newOrder.totalAmount);

        document.getElementById('confirmItems').innerHTML = newOrder.items.map(item => `
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.95rem;">
                <span>${item.name} x ${item.quantity}</span>
                <span>${Store.formatCurrency(item.price * item.quantity)}</span>
            </div>
        `).join('');

        // Hide Pre-Modal & Show Success
        document.getElementById('preOrderModal').style.display = 'none';
        const modal = document.getElementById('confirmationModal');
        if (modal) modal.style.display = 'flex';

        // Clear Cart & Form
        cart = [];
        updateCartUI();
        document.getElementById('cxName').value = '';
        document.getElementById('cxPhone').value = '';
        document.getElementById('cxNote').value = '';

        // Show Toast
        showToast("訂單已成功送出！");

    } catch (e) {
        console.error(e);
        // Show detailed error for debugging
        alert("訂單送出失敗：\n" + (e.message || e));
    }
}

function shareToLine() {
    if (!lastOrder) return;

    const itemsText = lastOrder.items.map(i => `${i.name} x${i.quantity}`).join('\n');
    const text = `【李家年菜】訂單確認 🎉\n\n訂單編號: #${lastOrder.id}\n訂購人: ${lastOrder.name}\n電話: ${lastOrder.phone}\n------------------\n${itemsText}\n------------------\n總金額: ${Store.formatCurrency(lastOrder.totalAmount)}\n\n謝謝您的預訂！我們已收到訂單。`;

    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(text)}`, '_blank');
}

function closeConfirmation() {
    document.getElementById('confirmationModal').style.display = 'none';
}

function printOrder() {
    // Explicitly ask user
    if (confirm("📱 手機版建議：請直接「截圖」保存。\n🖨️ 電腦版建議：請按「確定」列印。\n\n是否繼續開啟列印視窗？")) {
        window.print();
    }
}

// === INQUIRY LOGIC ===

function openInquiry() {
    document.getElementById('inquiryModal').style.display = 'flex';
}

function closeInquiry() {
    document.getElementById('inquiryModal').style.display = 'none';
    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('searchPhone').value = '';
}

async function searchOrder() {
    const phone = document.getElementById('searchPhone').value.trim();
    if (!phone) {
        alert('請輸入手機號碼');
        return;
    }

    const orders = await Store.getOrders();
    const myOrders = orders.filter(o => o.phone === phone);

    const container = document.getElementById('searchResults');

    if (myOrders.length === 0) {
        container.innerHTML = '<p style="color:#666; text-align:center;">查無此手機號碼的訂單。</p>';
        return;
    }

    container.innerHTML = myOrders.map(order => {
        const itemSummary = order.items.map(i => i.name).join(', ');
        // Status map
        const statusMap = {
            'new': '<span style="color:#e67e22;">處理中</span>',
            'processing': '<span style="color:#e67e22;">處理中</span>',
            'confirmed': '<span style="color:#3498db;">已確認</span>',
            'completed': '<span style="color:#2ecc71;">已完成</span>',
            'cancelled': '<span style="color:#e74c3c;">已取消</span>'
        };

        // Make clickable
        return `
            <div onclick="viewOrderDetails('${order.id}')" style="cursor:pointer; border:1px solid #eee; padding:15px; border-radius:8px; margin-bottom:10px; background:#fafafa; transition: background 0.2s;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <strong style="color:#d35400;">#${order.id}</strong>
                    <span>${Store.formatDate(order.createdAt)}</span>
                </div>
                <div style="margin-bottom:5px; font-weight:700;">${Store.formatCurrency(order.totalAmount)}</div>
                <div style="font-size:0.9rem; color:#666; margin-bottom:5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${itemSummary}
                </div>
                <div style="text-align:right; font-size:0.9rem; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.8rem; color:#999;">(點擊查看詳情)</span>
                    <span>狀態: <strong>${statusMap[order.status] || order.status}</strong></span>
                </div>
            </div>
        `;
    }).join('');
}

async function viewOrderDetails(orderId) {
    const orders = await Store.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // Set global lastOrder for share/print functions to work
    lastOrder = order;

    // Populate Modal
    // Add Order ID population
    const idElement = document.getElementById('confirmOrderId');
    if (idElement) {
        idElement.innerText = '#' + order.id;
    }

    document.getElementById('preName').innerText = order.name;
    document.getElementById('prePhone').innerText = order.phone;
    document.getElementById('preNote').innerText = order.note || '(無)';

    // Calculate Total Quantity
    const totalQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('confirmTotalCount').innerText = totalQty;

    document.getElementById('confirmTotal').innerText = Store.formatCurrency(order.totalAmount);

    const itemsHtml = order.items.map(item => `
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:8px 0;">
            <span>${item.name} x ${item.quantity}</span>
            <span>${Store.formatCurrency(item.price * item.quantity)}</span>
        </div>
    `).join('');
    document.getElementById('confirmItems').innerHTML = itemsHtml;

    // Show Confirmation Modal
    // Hide Inquiry Modal to avoid overlay confusion (optional, but cleaner)
    // document.getElementById('inquiryModal').style.display = 'none'; 
    // Actually, let's keep it open so they can go back? 
    // If confirmationModal z-index is higher, it works. 
    // Let's assume z-index is fine (usually modals are high).
    document.getElementById('confirmationModal').style.display = 'flex';
}
window.viewOrderDetails = viewOrderDetails;
