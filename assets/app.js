/**
 * Customer Application Logic
 */

let cart = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await Store.init();
    await checkOrderingStatus(); // Check system status first

    // Show Important Notice (Before menu renders)
    // Show Important Notice (Removed)
    // openNoticeModal();

    await renderMenu();
    updateCartUI();
});

// Global temp variable for current selection
let curSelectId = null;
let isSystemOpen = true; // Global flag

async function checkOrderingStatus() {
    const settings = await Store.getSystemSettings();
    isSystemOpen = settings.isOrderingOpen;

    if (!isSystemOpen) {
        // Show Banner
        const banner = document.createElement('div');
        banner.style.cssText = 'position:fixed; top:0; left:0; width:100%; background:#c0392b; color:white; text-align:center; padding:15px; font-weight:bold; z-index:9999; box-shadow:0 2px 10px rgba(0,0,0,0.3);';
        banner.innerHTML = '⚠️ 本年度年菜訂購已截止，感謝您的支持！';
        document.body.prepend(banner);
        document.body.style.paddingTop = '50px'; // Push down content
    }
}

async function renderMenu() {
    const menuGrid = document.getElementById('menuGrid');

    // Show Loading
    menuGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">
            <div style="font-size: 2rem; margin-bottom: 10px;">⏳</div>
            <div>菜單讀取中...</div>
        </div>
    `;

    const products = await Store.getProducts();

    if (products.length === 0) {
        menuGrid.innerHTML = '<p style="text-align:center; width:100%;">載入菜單失敗，請檢查網路連線或稍後再試。</p>';
        return;
    }

    menuGrid.innerHTML = products.map((dish, index) => {
        const isSoldOut = dish.isSoldOut === true;
        // Global Lock overrides individual status
        const isDisabled = !isSystemOpen || isSoldOut;
        let btnText = '加入購物車';
        if (!isSystemOpen) btnText = '已截止';
        else if (isSoldOut) btnText = '已售完';

        return `
        <div class="dish-card ${isDisabled ? 'sold-out' : ''}">
            <div class="dish-info">
                <h3 class="dish-title">
                    ${index + 1}. ${dish.name}
                    ${isDisabled ? `<span style="font-size:0.8rem; color:#e74c3c; margin-left:5px;">(${btnText})</span>` : ''}
                </h3>
                <p class="dish-desc">${dish.desc}</p>
                <div class="dish-meta">
                    <span class="dish-price">${Store.formatCurrency(dish.price)}</span>
                    <button class="btn btn-outline" 
                        ${isDisabled ? 'disabled style="border-color:#ccc; color:#999; cursor:not-allowed;"' : `onclick="openQtyModal('${dish.id}', '${dish.name}', ${dish.price})"`}>
                        ${btnText}
                    </button>
                </div>
            </div>
        </div>
    `}).join('');
}

// Qty Modal Logic
function openQtyModal(id, name, price) {
    if (!isSystemOpen) return alert('很抱歉，訂購已截止。');
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
    if (dish.isSoldOut) {
        showToast('此商品已售完');
        return;
    }

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

// Security State
let captchaAnswers = {
    checkout: 0,
    inquiry: 0
};

function initCaptcha(type) {
    const num1 = Math.floor(Math.random() * 9) + 1; // 1-9
    const num2 = Math.floor(Math.random() * 9) + 1; // 1-9
    const sum = num1 + num2;

    captchaAnswers[type] = sum;

    const el = document.getElementById(`${type}CaptchaQuestion`);
    if (el) el.innerText = `${num1} + ${num2}`;

    const input = document.getElementById(`${type}CaptchaAnswer`);
    if (input) input.value = ''; // Clear old answer
}

// Open Functions with Captcha Init
function openInquiry() {
    // initCaptcha('inquiry');
    document.getElementById('inquiryModal').style.display = 'flex';
    document.getElementById('searchResults').innerHTML = ''; // Clear prev results
    document.getElementById('searchPhone').value = '';
}

function closeInquiry() {
    document.getElementById('inquiryModal').style.display = 'none';
}

function toggleCart(forceOpen = null) {
    const panel = document.getElementById('cartPanel');
    if (forceOpen === true) panel.classList.add('open');
    else if (forceOpen === false) panel.classList.remove('open');
    else panel.classList.toggle('open');
}

function openCheckout() {
    if (!isSystemOpen) return alert('很抱歉，本年度訂購已截止。');
    if (cart.length === 0) return alert('請先加入商品到購物車');

    // initCaptcha('checkout'); // Init Captcha
    document.getElementById('checkoutModal').classList.add('active');
    toggleCart(false);
}

function closeCheckout() {
    document.getElementById('checkoutModal').classList.remove('active');
}

// Modified Verify Order (Security Checks)
function verifyOrder(e) {
    e.preventDefault();

    // 1. Honeypot Check (Bot Trap)
    const hp = document.getElementById('hp_check').value;
    if (hp) {
        console.warn("Bot detected via honeypot");
        return; // Silent fail
    }

    const name = document.getElementById('cxName').value.trim();
    const phoneInput = document.getElementById('cxPhone').value.trim();
    const customId = document.getElementById('cxCustomId').value.trim();

    if (!customId) return showToast('請填寫訂單編號');
    if (!name) return showToast('請填寫訂購人姓名');

    // 2. Phone Validation (Removed)
    // const cleanPhone = phoneInput.replace(/[\s\-\(\)]/g, '');
    // if (!/^\d+$/.test(cleanPhone) || cleanPhone.length < 7 || cleanPhone.length > 10) {
    //     return alert('電話號碼格式錯誤 (請輸入 7-10 碼數字)');
    // }

    // 3. (Removed Captcha)
    // 4. (Removed Rate Limit)

    // Pass checks
    document.getElementById('preName').innerText = name;
    document.getElementById('prePhone').innerText = phoneInput;

    document.getElementById('preItems').innerHTML = cart.map(item => `
        <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem;">
            <span>${item.name} x ${item.quantity}</span>
            <span>${Store.formatCurrency(item.price * item.quantity)}</span>
        </div>
    `).join('');

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    document.getElementById('preTotal').innerText = Store.formatCurrency(total);
    document.getElementById('preTotalCount').innerText = totalCount + " 件";

    document.getElementById('checkoutModal').classList.remove('active');
    document.getElementById('preOrderModal').style.display = 'flex';
}

let currentSearchResults = [];

// Updated Search Order (Security Checks)
async function searchOrder() {
    // 1. Honeypot Check
    const hp = document.getElementById('hp_inq').value;
    if (hp) return;

    // 2. (Removed Captcha)

    const phoneInput = document.getElementById('searchPhone').value.trim();
    if (!phoneInput) {
        alert('請輸入電話號碼');
        return;
    }

    // 3. Phone Validation (Flexible)
    const cleanInput = phoneInput.replace(/[\s\-\(\)]/g, '');
    if (!/^\d+$/.test(cleanInput) || cleanInput.length < 7 || cleanInput.length > 10) {
        return alert('請輸入完整的手機號碼 (7-10 碼)');
    }



    const container = document.getElementById('searchResults');
    container.innerHTML = '<p style="text-align:center;">查詢中...</p>';

    let myOrders = [];
    try {
        // Use New Secure Method (Query instead of Get All)
        myOrders = await Store.findOrdersByPhone(cleanInput);
        currentSearchResults = myOrders; // Cache for details view
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="text-align:center; color:red;">查詢發生錯誤，請稍後再試。</p>';
        return;
    }

    if (myOrders.length === 0) {
        container.innerHTML = '<p style="color:#e74c3c; text-align:center;">查無此手機號碼的訂單。</p>';
        return;
    }

    container.innerHTML = myOrders.map(order => {
        const itemSummary = order.items.map(i => i.name).join(', ');
        const statusMap = {
            'new': '<span style="color:#e67e22;">處理中</span>',
            'processing': '<span style="color:#e67e22;">處理中</span>',
            'confirmed': '<span style="color:#3498db;">已確認</span>',
            'completed': '<span style="color:#2ecc71;">已完成</span>',
            'cancelled': '<span style="color:#e74c3c;">已取消</span>'
        };

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

    // Always refresh CAPTCHA after a search attempt (correct or not) to prevent reuse
    initCaptcha('inquiry');
}

function backToEdit() {
    document.getElementById('preOrderModal').style.display = 'none';
    document.getElementById('checkoutModal').classList.add('active');
    initCaptcha('checkout'); // New question when coming back
}

let lastOrder = null;

async function finalSubmitOrder() {
    const btn = document.getElementById('btnSubmitOrder');

    // 1. Debounce (Prevent double click)
    if (btn) {
        btn.disabled = true;
        btn.innerText = '處理中...';
    }

    // Data is already in form inputs, just read again
    const orderData = {
        customId: document.getElementById('cxCustomId').value.trim().toUpperCase(), // Auto uppercase
        name: document.getElementById('cxName').value,
        phone: document.getElementById('cxPhone').value,
        note: document.getElementById('cxNote').value.trim(),
        items: cart,
        totalAmount: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    };

    try {
        const newOrder = await Store.addOrder(orderData);

        // Anti-Spam: Set Cooldown (Removed for internal use)
        // localStorage.setItem('lastOrderTime', Date.now());

        lastOrder = newOrder; // Store for valid LINE sharing

        // Show Success Modal
        document.getElementById('confirmOrderId').innerText = '#' + newOrder.id;
        document.getElementById('confirmName').innerText = newOrder.name;
        document.getElementById('confirmTotal').innerText = Store.formatCurrency(newOrder.totalAmount);

        // Calculate total count
        const totalQty = newOrder.items.reduce((sum, item) => sum + item.quantity, 0);
        const countEl = document.getElementById('confirmTotalCount');
        if (countEl) countEl.innerText = totalQty;

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
        document.getElementById('cxCustomId').value = '';
        document.getElementById('cxPhone').value = '';
        document.getElementById('cxNote').value = '';

        // Show Toast
        showToast("訂單已成功送出！");

    } catch (e) {
        console.error("Submit Error:", e);

        if (e.message.includes('ORDERING_CLOSED')) {
            alert('⛔ 很抱歉，本店暫時停止接單！\n\n系統將為您重新整理頁面。');
            location.reload();
        } else if (e.message.includes('PRODUCT_SOLD_OUT')) {
            const pName = e.message.split(': ')[1] || '商品';
            alert(`⚠️ 很抱歉，商品「${pName}」剛剛已售完！\n\n系統將為您重新整理頁面。`);
            location.reload();
        } else if (e.message.includes('DUPLICATE_ORDER_FOUND')) {
            alert('⚠️ 系統偵測到您已建立過相同訂單。\n\n如需修改或有任何問題，請直接與我們聯絡，謝謝！');
            // Do not reload, let them see what they typed? Or reload? 
            // Usually keeping page is fine so they can check, but alert stops action.
            if (btn) {
                btn.disabled = false;
                btn.innerText = '送出訂單';
            }
        } else if (err.message.includes("訂單編號重複")) {
            alert("⚠️ 此訂單編號已存在，請更換一個編號。");
        } else {
            alert('訂單送出失敗，請檢查網路後重試。\n錯誤訊息: ' + e.message);
            if (btn) {
                btn.disabled = false;
                btn.innerText = '送出訂單';
            }
        }
    } finally {
        // Restore button state
        if (btn) {
            btn.disabled = false;
            btn.innerText = '確認送出';
        }
    }
}

function shareToLine() {
    if (!lastOrder) return;

    const itemsText = lastOrder.items.map(i => `${i.name} x${i.quantity}`).join('\n');
    const text = `【合誼年菜】訂單確認 🎉\n\n訂單編號: #${lastOrder.id}\n訂購人: ${lastOrder.name}\n電話: ${lastOrder.phone}\n------------------\n${itemsText}\n------------------\n總金額: ${Store.formatCurrency(lastOrder.totalAmount)}\n\n謝謝您的預訂！我們已收到訂單。`;

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

// View Order Details (Reuse Confirmation Modal)
async function viewOrderDetails(orderId) {
    // Rule Fix: Don't re-fetch all orders (blocked by security rules). Use cache.
    const order = currentSearchResults.find(o => o.id == orderId || o.id === orderId);

    if (!order) return alert('找不到此訂單');

    lastOrder = order; // Set for sharing

    // Reuse Confirmation Modal
    document.getElementById('confirmationModal').style.display = 'flex';

    // Update Title for View Mode
    const titleEl = document.querySelector('#confirmationModal h2');
    if (titleEl) titleEl.innerText = '訂單詳情';

    const descEl = document.querySelector('#confirmationModal p');
    if (descEl) descEl.innerText = '此為您的訂單紀錄';

    document.getElementById('confirmOrderId').innerText = '#' + order.id;
    document.getElementById('confirmName').innerText = order.name;
    document.getElementById('confirmTotal').innerText = Store.formatCurrency(order.totalAmount);

    // Calculate count
    const totalQty = order.items.reduce((sum, i) => sum + i.quantity, 0);
    const countEl = document.getElementById('confirmTotalCount');
    if (countEl) countEl.innerText = totalQty;

    document.getElementById('confirmItems').innerHTML = order.items.map(item => `
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.95rem;">
            <span>${item.name} x ${item.quantity}</span>
            <span>${Store.formatCurrency(item.price * item.quantity)}</span>
        </div>
    `).join('');
}


// Notice Modal
function openNoticeModal() {
    // Check session storage to avoid annoyance in same session
    if (!sessionStorage.getItem('hasSeenNotice')) {
        const modal = document.getElementById('noticeModal');
        if (modal) modal.style.display = 'flex';
    }
}

function closeNoticeModal() {
    const modal = document.getElementById('noticeModal');
    if (modal) modal.style.display = 'none';
    sessionStorage.setItem('hasSeenNotice', 'true');
}
