/**
 * Admin Dashboard Logic
 */

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await Store.init();

    // ID of overlay
    const overlay = document.getElementById('loginOverlay');

    // Monitor Auth State (Auto Login)
    if (Store.monitorAuth) {
        Store.monitorAuth((user) => {
            if (user) {
                console.log("Admin logged in:", user.email);
                overlay.style.display = 'none';
                // Sync Counter automatically on login
                if (Store.syncOrderCounter) Store.syncOrderCounter();
            } else {
                console.log("No admin user.");
                overlay.style.display = 'flex';
            }
        });
    }

    // Initial Load
    switchTab('orders');

    // Mobile toggle
    document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);

    // Search Listener
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', searchOrders);
    }
});

// Login Function (Global)
window.checkLogin = async function () {
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    const errorDisplay = document.getElementById('loginError');

    if (!email || !password) {
        alert("請輸入管理員帳號密碼");
        return;
    }

    try {
        errorDisplay.style.display = 'none';
        await Store.login(email, password);
        // Success handled by monitorAuth callback above
    } catch (e) {
        errorDisplay.innerText = "登入失敗: " + (e.code === 'auth/invalid-credential' ? '帳號或密碼錯誤' : e.message);
        errorDisplay.style.display = 'block';
    }
};


// === Navigation ===
var TABS = ['orders', 'stats', 'menu', 'system'];

function switchTab(tabId) {
    // Update Nav
    TABS.forEach(t => document.getElementById(`nav-${t}`).classList.remove('active'));
    document.getElementById(`nav-${tabId}`).classList.add('active');

    // Toggle Search Visibility (Only for Orders)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.style.display = (tabId === 'orders') ? 'block' : 'none';
    }

    // Update View
    if (tabId === 'orders') {
        document.getElementById('ordersSection').style.display = 'block';
        document.getElementById('statsSection').classList.add('hidden');
        document.getElementById('menuSection').classList.add('hidden');
        document.getElementById('systemSection').classList.add('hidden');
        document.getElementById('pageTitle').innerText = '訂單管理';
        loadOrders();
    } else if (tabId === 'stats') {
        document.getElementById('ordersSection').style.display = 'none';
        document.getElementById('menuSection').classList.add('hidden');
        document.getElementById('systemSection').classList.add('hidden');
        document.getElementById('statsSection').classList.remove('hidden');
        document.getElementById('pageTitle').innerText = '廚房統計';
        loadStats();
    } else if (tabId === 'menu') {
        document.getElementById('ordersSection').style.display = 'none';
        document.getElementById('statsSection').classList.add('hidden');
        document.getElementById('systemSection').classList.add('hidden');
        document.getElementById('menuSection').classList.remove('hidden');
        document.getElementById('pageTitle').innerText = '菜單設定';
        loadMenuAdmin();
    } else if (tabId === 'system') {
        document.getElementById('ordersSection').style.display = 'none';
        document.getElementById('statsSection').classList.add('hidden');
        document.getElementById('menuSection').classList.add('hidden');
        document.getElementById('systemSection').classList.remove('hidden');
        document.getElementById('pageTitle').innerText = '系統設定';
        loadSystemSettings();
    }

    // Auto-close sidebar on mobile after selection
    const sidebar = document.querySelector('.sidebar');
    if (sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        document.removeEventListener('click', closeSidebarOutside); // Cleanup listener
    }
}

// Toggle Sidebar
function toggleSidebar() {
    console.log("Toggle sidebar clicked");
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('active');

    // If opening, add listener to close when clicking outside
    if (sidebar.classList.contains('active')) {
        setTimeout(() => {
            document.addEventListener('click', closeSidebarOutside);
        }, 100);
    } else {
        document.removeEventListener('click', closeSidebarOutside);
    }
}

function closeSidebarOutside(e) {
    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');

    // If click is NOT on sidebar and NOT on toggle button
    if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
        sidebar.classList.remove('active');
        document.removeEventListener('click', closeSidebarOutside);
    }
}


// === Order Management ===
var currentOrders = [];

function searchOrders() {
    const term = document.getElementById('searchInput').value.trim().toLowerCase();

    if (!term) {
        renderOrders(currentOrders);
        return;
    }

    const filtered = currentOrders.filter(o =>
        (o.id && o.id.toString().toLowerCase().includes(term)) ||
        (o.name && o.name.toLowerCase().includes(term)) ||
        (o.phone && o.phone.includes(term))
    );

    renderOrders(filtered);
}

async function loadOrders() {
    const tableBody = document.getElementById('orderTableBody');
    tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">載入中...</td></tr>';

    currentOrders = await Store.getOrders();
    sortOrders(); // Enforce sort stability
    renderOrders(currentOrders);
    updateDashboardStats(currentOrders);
}

function renderOrders(orders) {
    const tableBody = document.getElementById('orderTableBody');
    if (orders.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">目前沒有訂單</td></tr>';
        return;
    }

    const statusMap = {
        'new': '<span class="status-badge status-new">新訂單</span>',
        'processing': '<span class="status-badge status-new">處理中</span>',
        'confirmed': '<span class="status-badge" style="background:#3498db; color:white;">已確認</span>',
        'completed': '<span class="status-badge status-completed">已完成</span>',
        'cancelled': '<span class="status-badge" style="background:#95a5a6; color:white;">已取消</span>'
    };

    tableBody.innerHTML = orders.map(order => `
        <tr onclick="openOrderModal('${order.id}')" style="cursor:pointer;">
            <td><span class="mobile-label">訂單編號</span>#${order.id}</td>
            <td><span class="mobile-label">訂購人</span>${order.name}</td>
            <td><span class="mobile-label">電話</span>${order.phone}</td>
            <td><span class="mobile-label">付款狀態</span>${order.paymentStatus === 'paid' ? '<span style="color:green">已付款</span>' : '<span style="color:red">未付款</span>'}</td>
            <td><span class="mobile-label">總金額</span>${Store.formatCurrency(order.totalAmount)}</td>
            <td><span class="mobile-label">訂單狀態</span>${statusMap[order.status] || order.status}</td>
            <td><span class="mobile-label">訂購時間</span>${Store.formatDate(order.createdAt)}</td>
            <td>
                <span class="mobile-label">操作</span>
                <button class="btn btn-outline" style="padding:4px 8px; font-size:0.8rem;" onclick="event.stopPropagation(); openOrderModal('${order.id}')">查看</button>
            </td>
        </tr>
    `).join('');
}

function updateDashboardStats(orders) {
    document.getElementById('statsTotal').innerText = orders.length;
    document.getElementById('statsNew').innerText = orders.filter(o => o.status === 'processing' || o.status === 'new').length;

    // Revenue (exclude cancelled)
    const revenue = orders
        .filter(o => o.status !== 'cancelled')
        .reduce((sum, o) => sum + o.totalAmount, 0);

    document.getElementById('statsRevenue').innerText = Store.formatCurrency(revenue);
}


// Search & Sort implementation
var currentSort = { key: 'id', dir: 'desc' }; // Default sort by ID desc

function toggleSort(key) {
    if (currentSort.key === key) {
        currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.key = key;
        currentSort.dir = 'asc'; // New key starts asc
    }

    // Update Icons
    ['id', 'status', 'time'].forEach(k => {
        const icon = document.getElementById(`sort-${k}-icon`);
        if (icon) {
            icon.innerText = '▼';
            icon.style.color = '#ccc';
        }
    });

    const activeIcon = document.getElementById(`sort-${key}-icon`);
    if (activeIcon) {
        activeIcon.innerText = currentSort.dir === 'asc' ? '▲' : '▼';
        activeIcon.style.color = '#333';
    }

    sortOrders();
    renderOrders(currentOrders);
}

function sortOrders() {
    currentOrders.sort((a, b) => {
        let valA, valB;

        if (currentSort.key === 'id') {
            // Extract number from A1, A2...
            valA = parseInt(a.id.replace(/\D/g, '')) || 0;
            valB = parseInt(b.id.replace(/\D/g, '')) || 0;
        } else if (currentSort.key === 'status') {
            // Sort by status logic: new > processing > confirmed > completed > cancelled
            const statusWeight = { 'new': 1, 'processing': 2, 'confirmed': 3, 'completed': 4, 'cancelled': 5 };
            valA = statusWeight[a.status] || 99;
            valB = statusWeight[b.status] || 99;
        } else if (currentSort.key === 'time') {
            valA = new Date(a.createdAt).getTime();
            valB = new Date(b.createdAt).getTime();
        }

        if (valA < valB) return currentSort.dir === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.dir === 'asc' ? 1 : -1;
        return 0;
    });
}


// === Menu Management ===

async function loadMenuAdmin() {
    const tableBody = document.getElementById('menuTableBody');
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">載入中...</td></tr>';
    await Store.getProducts(); // Ensure data is loaded
    renderMenuAdmin();
}

function renderMenuAdmin() {
    const products = Store.products; // Already sorted by ID in Store.js
    const tableBody = document.getElementById('menuTableBody');

    if (!products || products.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">目前沒有菜色</td></tr>';
        return;
    }

    tableBody.innerHTML = products.map((p, index) => `
        <tr>
            <td>${index + 1}</td>
            <td style="font-weight:bold;">${p.name}</td>
            <td>${p.price}</td>
            <td>
                <button class="btn btn-sm ${p.isSoldOut ? 'btn-red' : 'btn-green'}" 
                    style="padding:2px 8px; font-size:0.8rem; background:${p.isSoldOut ? '#e74c3c' : '#2ecc71'}; color:white; border:none;"
                    onclick="toggleProductStatus('${p._id}', ${p.isSoldOut})">
                    ${p.isSoldOut ? '已售完' : '上架中'}
                </button>
            </td>
            <td style="color:#666; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${p.desc}
            </td>
            <td>
                <button class="btn btn-outline" style="padding:2px 8px;" 
                    onclick="moveProduct(${index}, -1)" ${index === 0 ? 'disabled' : ''}>上移</button>
                <button class="btn btn-outline" style="padding:2px 8px;" 
                    onclick="moveProduct(${index}, 1)" ${index === products.length - 1 ? 'disabled' : ''}>下移</button>
            </td>
            <td>
                <button class="btn btn-outline" onclick="editProduct('${p._id}', ${p.id})">編輯</button>
                <button class="btn btn-outline" style="color:red; border-color:red;" onclick="deleteProduct('${p._id}', '${p.name}')">刪除</button>
            </td>
        </tr>
    `).join('');
}

async function moveProduct(index, direction) {
    const products = Store.products;
    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= products.length) return;

    const currentItem = products[index];
    const targetItem = products[targetIndex];

    // Swap IDs
    const tempId = currentItem.id;
    const newId = targetItem.id;

    if (tempId === newId) return;

    try {
        await Store.updateProduct(currentItem._id, { id: newId });
        await Store.updateProduct(targetItem._id, { id: tempId });

        await Store.loadProducts();
        renderMenuAdmin();
    } catch (e) {
        console.error(e);
        alert("排序更新失敗");
    }
}

function closeBatchModal() {
    document.getElementById('batchModal').style.display = 'none';
    document.getElementById('batchInput').value = '';
}

async function saveBatch() {
    const input = document.getElementById('batchInput').value.trim();
    if (!input) return;

    const lines = input.split('\n');
    let successCount = 0;

    if (!confirm(`確定要匯入 ${lines.length} 筆資料嗎？`)) return;

    // Show loading state
    const btn = document.querySelector('#batchModal .btn-primary');
    const originalText = btn.innerText;
    btn.innerText = '匯入中...';
    btn.disabled = true;

    try {
        for (const line of lines) {
            // Expected format: Name, Price, Desc
            // Allow comma or tab separation
            const parts = line.split(/[,，\t]/);
            if (parts.length >= 2) {
                const name = parts[0].trim();
                const price = Number(parts[1].trim().replace(/[^0-9]/g, ''));
                const desc = parts[2] ? parts[2].trim() : '';

                if (name && price) {
                    await Store.addProduct({ name, price, desc });
                    successCount++;
                }
            }
        }
        alert(`成功匯入 ${successCount} 筆資料。`);
        closeBatchModal();
        loadMenuAdmin();
    } catch (e) {
        console.error(e);
        alert('匯入過程發生錯誤');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Toggle Sold Out Status
async function toggleProductStatus(docId, currentStatus) {
    try {
        await Store.updateProduct(docId, { isSoldOut: !currentStatus });
        // Refresh handled by real-time listener or manual reload
        // Since we don't have real-time listener for products yet, manually reload
        loadMenuAdmin();
    } catch (e) {
        console.error("Toggle Status Error:", e);
        alert("狀態更新失敗");
    }
}

// === Batch Import Logic ===
function openBatchModal() {
    document.getElementById('batchModal').style.display = 'flex';
}

function closeBatchModal() {
    document.getElementById('batchModal').style.display = 'none';
    document.getElementById('batchInput').value = '';
}

async function saveBatch() {
    const input = document.getElementById('batchInput').value.trim();
    if (!input) return;

    const lines = input.split('\n');
    let successCount = 0;

    if (!confirm(`確定要匯入 ${lines.length} 筆資料嗎？`)) return;

    // Show loading state
    const btn = document.querySelector('#batchModal .btn-primary');
    const originalText = btn.innerText;
    btn.innerText = '匯入中...';
    btn.disabled = true;

    try {
        for (const line of lines) {
            // Expected format: Name, Price, Desc
            // Allow comma or tab separation
            const parts = line.split(/[,，\t]/);
            if (parts.length >= 2) {
                const name = parts[0].trim();
                const price = Number(parts[1].trim().replace(/[^0-9]/g, ''));
                const desc = parts[2] ? parts[2].trim() : '';

                if (name && price) {
                    await Store.addProduct({ name, price, desc });
                    successCount++;
                }
            }
        }
        alert(`成功匯入 ${successCount} 筆資料。`);
        closeBatchModal();
        loadMenuAdmin();
    } catch (e) {
        console.error(e);
        alert('匯入過程發生錯誤');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function openProductModal(isEdit = false) {
    document.getElementById('productModal').style.display = 'flex';
    document.getElementById('productModalTitle').innerText = isEdit ? '編輯菜色' : '新增菜色';

    if (!isEdit) {
        document.getElementById('pId').value = '';
        document.getElementById('pName').value = '';
        document.getElementById('pPrice').value = '';
        document.getElementById('pDesc').value = '';
    }
}

function closeProductModal() {
    document.getElementById('productModal').style.display = 'none';
}

function editProduct(docId, id) {
    openProductModal(true);
    // Find product
    // Note: Store.products should be populated
    const product = Store.products.find(p => p._id === docId);
    if (product) {
        document.getElementById('pId').value = docId; // Use docId for identifier
        document.getElementById('pName').value = product.name;
        document.getElementById('pPrice').value = product.price;
        document.getElementById('pDesc').value = product.desc;
    }
}

async function saveProduct(e) {
    e.preventDefault();
    const docId = document.getElementById('pId').value;
    const data = {
        name: document.getElementById('pName').value,
        price: Number(document.getElementById('pPrice').value),
        desc: document.getElementById('pDesc').value
    };

    if (docId) {
        await Store.updateProduct(docId, data);
    } else {
        await Store.addProduct(data);
    }

    closeProductModal();
    loadMenuAdmin(); // Refresh
}

async function deleteProduct(docId, name) {
    if (confirm(`確定要刪除 ${name} 嗎？`)) {
        await Store.deleteProduct(docId);
        loadMenuAdmin();
    }
}

// === Order Modal Logic ===
var curModalOrderId = null;
var currentOrderData = null;

function openOrderModal(orderId) {
    const order = currentOrders.find(o => o.id == orderId || o.id === orderId); // Loose check
    if (!order) return;

    curModalOrderId = orderId;
    currentOrderData = order;

    const modal = document.getElementById('orderModal');
    document.getElementById('modalId').innerText = '#' + order.id;
    document.getElementById('modalName').innerText = order.name;
    document.getElementById('modalPhone').innerText = order.phone;

    // Calculate and set total count
    const totalQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const countEl = document.getElementById('modalCount');
    if (countEl) countEl.innerText = totalQty + " 件";

    // Set Payment Status
    const payStatusEl = document.getElementById('modalPayStatus');
    if (payStatusEl) {
        if (order.paymentStatus === 'paid') {
            payStatusEl.innerHTML = '<span style="color:green">已付款</span>';
        } else {
            payStatusEl.innerHTML = '<span style="color:red">未付款</span>';
        }
    }

    document.getElementById('modalNote').innerText = order.note || '(無)';

    const itemsHtml = order.items.map(i => `
        <div style="display:flex; justify-content:space-between; margin-bottom:5px; border-bottom:1px dashed #eee; padding-bottom:5px;">
            <span>${i.name} x ${i.quantity}</span>
            <span>$${i.price * i.quantity}</span>
        </div>
    `).join('');

    document.getElementById('modalItems').innerHTML = itemsHtml;
    document.getElementById('modalTotal').innerText = Store.formatCurrency(order.totalAmount);

    // Reset Actions to Default View Mode
    const actions = document.querySelector('.modal-actions-container');
    if (actions) {
        actions.innerHTML = `
            <div class="action-group-status" style="margin-bottom: 15px;">
                <button class="btn" style="background:#f39c12; color:white; border:none; padding:8px 15px;" onclick="updateStatus('processing')">⏳ 處理中</button>
                <button class="btn" style="background:#3498db; color:white; border:none; padding:8px 15px;" onclick="updateStatus('confirmed')">🆗 已確認</button>
                <button class="btn" style="background:#27ae60; color:white; border:none; padding:8px 15px;" onclick="updateStatus('completed')">✅ 已完成</button>
            </div>

            <div class="action-group-manage">
                <button class="btn btn-outline" style="border-color:#27ae60; color:#27ae60;" onclick="togglePaymentStatus()">💰 切換付款</button>
                <button class="btn btn-outline" style="border-color:#3498db; color:#3498db;" onclick="editCurrentOrder()">✏️ 修改</button>
                <button class="btn btn-outline" style="border-color:#e74c3c; color:#e74c3c;" onclick="deleteCurrentOrder()">🗑️ 刪除</button>
                <button class="btn btn-outline" style="border-color:#ccc; color:#666;" onclick="closeModal()">關閉</button>
            </div>
        `;
    }

    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('orderModal').style.display = 'none';
    curModalOrderId = null;
    currentOrderData = null;
}

async function togglePaymentStatus() {
    if (!curModalOrderId || !currentOrderData) return;

    const newStatus = currentOrderData.paymentStatus === 'paid' ? 'unpaid' : 'paid';
    const { doc, updateDoc } = window.firebase;

    try {
        const ref = doc(Store.db, "orders", curModalOrderId);
        await updateDoc(ref, { paymentStatus: newStatus });

        // Update local data
        currentOrderData.paymentStatus = newStatus;

        // Update UI immediately
        const payStatusEl = document.getElementById('modalPayStatus');
        if (payStatusEl) {
            if (newStatus === 'paid') {
                payStatusEl.innerHTML = '<span style="color:green">已付款</span>';
            } else {
                payStatusEl.innerHTML = '<span style="color:red">未付款</span>';
            }
        }

        // Update background list
        loadOrders();

        // alert(`已切換為：${newStatus === 'paid' ? '已付款' : '未付款'}`);
    } catch (e) {
        console.error(e);
        alert('切換付款狀態失敗');
    }
}

async function updateStatus(newStatus) {
    if (!curModalOrderId) return;

    // No confirm needed for status updates to be faster
    const { doc, updateDoc } = window.firebase;

    // Check if auto-payment should trigger
    const updateData = { status: newStatus };
    if (newStatus === 'completed') {
        updateData.paymentStatus = 'paid';
    }

    try {
        const ref = doc(Store.db, "orders", curModalOrderId);
        await updateDoc(ref, updateData);

        // Update local data
        if (currentOrderData) {
            currentOrderData.status = newStatus;

            // Auto Update Payment badge locally
            if (newStatus === 'completed') {
                currentOrderData.paymentStatus = 'paid';
                const payStatusEl = document.getElementById('modalPayStatus');
                if (payStatusEl) {
                    payStatusEl.innerHTML = '<span style="color:green">已付款</span>';
                }
            }
        }

        // closeModal(); // Removed per user request
        loadOrders();

        // alert('狀態已更新');
    } catch (e) {
        console.error(e);
        alert('更新失敗');
    }
}

async function deleteCurrentOrder() {
    if (!curModalOrderId) return;

    if (confirm('確定要刪除此訂單嗎？此動作無法復原！')) {
        const { doc, deleteDoc } = window.firebase;

        try {
            const ref = doc(Store.db, "orders", curModalOrderId);
            await deleteDoc(ref);

            // Sync counter to ensure gaps are filled or next ID is correct (if last one deleted)
            if (Store.syncOrderCounter) await Store.syncOrderCounter();

            // Also update local list immediately or just reload
            alert('訂單已刪除');
            closeModal();
            loadOrders();
        } catch (e) {
            console.error("Delete Order Error: ", e);
            alert('刪除失敗');
        }
    }
}

// Kitchen Stats
function loadStats() {
    // Simple aggregation
    const itemMap = {};

    // Filter active orders
    const activeOrders = currentOrders.filter(o => o.status === 'new' || o.status === 'processing' || o.status === 'confirmed');

    activeOrders.forEach(o => {
        if (o.items) {
            o.items.forEach(i => {
                if (!itemMap[i.name]) itemMap[i.name] = 0;
                itemMap[i.name] += i.quantity;
            });
        }
    });

    const tbody = document.getElementById('kitchenTableBody');
    if (Object.keys(itemMap).length === 0) {
        tbody.innerHTML = '<tr><td colspan="2">目前沒有統計資料</td></tr>';
        return;
    }

    tbody.innerHTML = Object.entries(itemMap).map(([name, qty]) => `
        <tr>
            <td>${name}</td>
            <td style="font-weight:bold; font-size:1.2rem;">${qty}</td>
        </tr>
    `).join('');
}

function printStats() {
    // 1. Calculate Data (Mirroring loadStats logic)
    const itemMap = {};
    const activeOrders = currentOrders.filter(o => o.status === 'new' || o.status === 'processing' || o.status === 'confirmed');

    activeOrders.forEach(o => {
        if (o.items) {
            o.items.forEach(i => {
                if (!itemMap[i.name]) itemMap[i.name] = 0;
                itemMap[i.name] += i.quantity;
            });
        }
    });

    if (Object.keys(itemMap).length === 0) {
        alert('目前沒有統計資料可列印');
        return;
    }

    const dateStr = new Date().toLocaleString('zh-TW', { hour12: false });

    // 2. Open Print Window
    const win = window.open('', 'print_window', 'width=800,height=1000');
    if (!win) {
        alert('請允許開啟彈出視窗以進行列印');
        return;
    }

    // 3. Write Clean HTML
    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>廚房備料單</title>
            <style>
                body { font-family: "Microsoft JhengHei", "Noto Sans TC", sans-serif; padding: 20px; }
                h2 { text-align: center; margin-bottom: 5px; font-size: 22px; }
                .meta { text-align: center; color: #666; font-size: 14px; margin-bottom: 15px; }
                table { width: 100%; border-collapse: collapse; border: 2px solid #000; }
                th, td { border: 1px solid #999; padding: 8px 10px; text-align: left; font-size: 16px; }
                th { background-color: #f0f0f0; border-bottom: 2px solid #000; }
                .qty { font-size: 20px; font-weight: bold; text-align: center; width: 15%; }
                @media print {
                    @page { margin: 0.8cm; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <h2>📋 廚房備料單</h2>
            <div class="meta">列印時間：${dateStr}</div>
            
            <table>
                <thead>
                    <tr>
                        <th>菜色名稱</th>
                        <th class="qty">數量</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(itemMap).map(([name, qty]) => `
                        <tr>
                            <td>${name}</td>
                            <td class="qty">${qty}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <script>
                // Auto print and close
                window.onload = function() {
                    window.print();
                    // Optional: window.close() after a delay or let user close
                }
            </script>
        </body>
        </html>
    `);

    win.document.close(); // Ensure load triggers
}

// === System Functions ===

async function loadSystemSettings() {
    const btn = document.getElementById('btnToggleOrdering');
    const txt = document.getElementById('orderingStatusText');

    btn.innerText = '讀取中...';
    btn.className = 'btn btn-outline';
    btn.disabled = true;

    try {
        const settings = await Store.getSystemSettings();
        const isOpen = settings.isOrderingOpen;

        btn.disabled = false;
        if (isOpen) {
            btn.innerText = '✅ 目前：開放訂購中 (點擊關閉)';
            btn.className = 'btn';
            btn.style.background = '#2ecc71'; // Green
            btn.style.color = 'white';
            txt.innerText = '目前狀態：店家正常接單中';
            txt.style.color = '#27ae60';
        } else {
            btn.innerText = '⛔ 目前：已停止訂購 (點擊開啟)';
            btn.className = 'btn';
            btn.style.background = '#e74c3c'; // Red
            btn.style.color = 'white';
            txt.innerText = '目前狀態：已暫停，顧客無法下單';
            txt.style.color = '#c0392b';
        }
        // Store for toggle
        btn.dataset.status = isOpen;
    } catch (e) {
        console.error(e);
        btn.innerText = '讀取失敗';
    }
}

async function toggleOrderingStatus() {
    const btn = document.getElementById('btnToggleOrdering');
    const currentStatus = btn.dataset.status === 'true';
    const newStatus = !currentStatus;

    if (!confirm(newStatus ? '確定要「開啟接單」系統嗎？' : '確定要「暫停接單」嗎？')) {
        return;
    }

    try {
        console.log('Step 1: Calling updateSystemSettings with', newStatus);
        // alert('Step 1: 正在更新資料庫...'); // Debug
        await Store.updateSystemSettings({ isOrderingOpen: newStatus });

        console.log('Step 2: Update success, reloading...');
        // alert('Step 2: 資料庫更新完成'); // Debug
        await loadSystemSettings();

        console.log('Step 3: Reload done');
    } catch (e) {
        console.error("System Settings Error:", e);
        alert('更新失敗，請檢查網路連線或稍後再試。\n錯誤訊息: ' + (e.message || e));
    }
}

async function exportToExcel() {
    const orders = await Store.getOrders();
    const products = await Store.getProducts(); // Get full product list for headers

    if (orders.length === 0) {
        alert('目前沒有訂單可匯出');
        return;
    }

    // 1. Build Headers
    // Base headers
    let headers = ['訂單編號', '訂購人', '電話', '備註'];
    // Product headers (dynamic columns)
    const productNames = products.map(p => p.name);
    headers = headers.concat(productNames);
    // End headers
    headers = headers.concat(['總金額', '狀態', '訂購時間']);

    let csvContent = headers.join(',') + "\n";

    // 2. Build Rows
    orders.forEach(o => {
        // Create an item map for quick lookup: { "佛跳牆": 2, "年糕": 1 }
        const itemMap = {};
        if (o.items && Array.isArray(o.items)) {
            o.items.forEach(i => {
                itemMap[i.name] = i.quantity;
            });
        }

        const note = (o.note || '').replace(/"/g, '""');

        let row = [
            `#${o.id}`,
            o.name,
            `'${o.phone}`, // Force string
            `"${note}"`
        ];

        // Fill product columns
        productNames.forEach(pName => {
            const qty = itemMap[pName] || 0;
            // Leave empty if 0 for cleaner look, or '0' if preferred. Let's use qty or empty string.
            // User likely wants to see numbers. '0' or ''? '0' is explicit.
            // Logic: if qty > 0 show qty, else empty string (cleaner for sparse matrix)
            row.push(qty > 0 ? qty : '');
        });

        const statusMap = {
            'processing': '處理中',
            'confirmed': '已確認',
            'completed': '已完成',
            'new': '新訂單',
            'unpaid': '未付款'
        };
        const statusText = statusMap[o.status] || o.status;

        row.push(o.totalAmount);
        row.push(statusText);
        row.push(Store.formatDate(o.createdAt));

        csvContent += row.join(',') + "\n";
    });

    // Add BOM for Excel Chinese support
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `李家年菜_訂單報表_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function downloadBackup() {
    const orders = await Store.getOrders();
    const products = await Store.getProducts();

    const data = {
        timestamp: new Date().toISOString(),
        products: products,
        orders: orders
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `li_family_backup_${new Date().toISOString().slice(0, 10)}.json`);
    link.click();
}

// Restore function - Simplified
async function restoreBackup(input) {
    const file = input.files[0];
    if (!file) return;

    if (!confirm('警告：這將會清除現有的所有菜色與訂單，並還原備份檔！\n確定要繼續嗎？')) {
        input.value = ''; // Reset
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);

            // Restore Products
            if (data.products && Array.isArray(data.products)) {
                let pCount = 0;
                for (const p of data.products) {
                    // Remove internal ID just in case, let Firestore gen new ID or check dupe?
                    // For simplicity, just add.
                    const { _id, ...pData } = p; // Exclude firestore ID
                    await Store.addProduct(pData);
                    pCount++;
                }
                console.log(`Restored ${pCount} products`);
            }

            // Restore Orders
            if (data.orders && Array.isArray(data.orders)) {
                let oCount = 0;
                for (const o of data.orders) {
                    // Exclude ID to allow new ID generation
                    const { id, _id, ...oData } = o;
                    await Store.addOrder(oData);
                    oCount++;
                }
                console.log(`Restored ${oCount} orders`);
            }

            alert('資料還原成功！');
            location.reload();

        } catch (err) {
            console.error(err);
            alert('還原失敗：檔案格式錯誤');
        }
    };
    reader.readAsText(file);
}
// Mobile Toggle Logic
function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('active');
}
window.toggleSidebar = toggleSidebar;

// Edit Order Logic
async function editCurrentOrder() {
    if (!currentOrderData) return;

    const container = document.getElementById('modalItems');

    // 1. Render existing items
    const itemsHtml = currentOrderData.items.map((item, index) => `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:10px;">
            <div style="flex:1;">
                <div style="font-weight:bold;">${item.name}</div>
                <div style="font-size:0.9rem; color:#666;">$${item.price}</div>
            </div>
            <div style="display:flex; align-items:center; gap:5px;">
                <button type="button" onclick="adjustEditQty(${index}, -1)" style="padding:5px 10px;">-</button>
                <input type="number" id="edit-qty-${index}" value="${item.quantity}" style="width:50px; text-align:center;" min="0">
                <button type="button" onclick="adjustEditQty(${index}, 1)" style="padding:5px 10px;">+</button>
                <button type="button" onclick="removeEditItem(${index})" style="background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:4px; margin-left:5px;">刪除</button>
            </div>
        </div>
    `).join('');

    // 2. Render Add Item Section
    // Get products for dropdown
    const products = Store.products || [];
    const options = products.map(p => `<option value="${p._id}">${p.name} ($${p.price})</option>`).join('');

    const addSectionHtml = `
        <div style="margin-top:15px; padding-top:15px; border-top:2px dashed #eee;">
            <div style="display:flex; gap:10px;">
                <select id="newItemSelect" style="flex:1; padding:8px; border:1px solid #ddd; border-radius:4px;">
                    ${options}
                </select>
                <button type="button" class="btn btn-sm" style="background:#2ecc71; color:white;" onclick="addNewItemToEdit()">＋ 新增</button>
            </div>
        </div>
    `;

    const noteHtml = `
        <div style="margin-top:10px; padding-top:10px; border-top:1px solid #eee;">
            <label style="font-weight:bold; display:block; margin-bottom:5px;">訂單備註</label>
            <textarea id="edit-note" style="width:100%; height:60px; padding:8px; border:1px solid #ddd; border-radius:4px; resize:none;">${currentOrderData.note || ''}</textarea>
        </div>
    `;

    container.innerHTML = itemsHtml + addSectionHtml + noteHtml;

    const actions = document.querySelector('.modal-actions-container');
    actions.setAttribute('data-original', actions.innerHTML);
    actions.innerHTML = `
        <div class="action-group-edit">
            <button class="btn btn-outline" onclick="cancelEditOrder()">取消</button>
            <button class="btn btn-primary" onclick="saveEditedOrder()">💾 儲存變更</button>
        </div>
    `;
}

function addNewItemToEdit() {
    // 1. Sync current values to state
    currentOrderData.items.forEach((item, index) => {
        const input = document.getElementById(`edit-qty-${index}`);
        if (input) item.quantity = parseInt(input.value) || 0;
    });

    // 2. Get new item selection
    const select = document.getElementById('newItemSelect');
    const docId = select.value;
    const product = Store.products.find(p => p._id === docId);

    if (product) {
        // Check if already exists
        const existing = currentOrderData.items.find(i => i.name === product.name);
        if (existing) {
            existing.quantity += 1;
            alert(`已增加 "${product.name}" 數量`);
        } else {
            currentOrderData.items.push({
                name: product.name,
                price: product.price,
                quantity: 1
            });
        }
        // 3. Re-render
        editCurrentOrder();
    }
}

function adjustEditQty(index, delta) {
    const input = document.getElementById(`edit-qty-${index}`);
    let val = parseInt(input.value) || 0;
    val += delta;
    if (val < 0) val = 0;
    input.value = val;
    // Update state to effectively track for re-renders or save
    if (currentOrderData.items[index]) {
        currentOrderData.items[index].quantity = val;
    }
}

function removeEditItem(index) {
    if (confirm('確定要刪除此品項嗎？')) {
        // Remove from array and re-render
        currentOrderData.items.splice(index, 1);
        editCurrentOrder();
    }
}

async function saveEditedOrder() {
    if (!currentOrderData) return;

    // Sync one last time just in case (though adjustQty handles it)
    currentOrderData.items.forEach((item, index) => {
        const input = document.getElementById(`edit-qty-${index}`);
        if (input) item.quantity = parseInt(input.value) || 0;
    });

    const newItems = currentOrderData.items.filter(i => i.quantity > 0);
    const newTotal = newItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    // Get Note
    const noteInput = document.getElementById('edit-note');
    const newNote = noteInput ? noteInput.value.trim() : (currentOrderData.note || '');

    try {
        await Store.updateOrder(currentOrderData.id, { items: newItems, totalAmount: newTotal, note: newNote });
        alert('訂單更新成功！');

        // Removed closeModal(); 
        // Reload orders first to get fresh data
        await loadOrders();

        // Refresh modal view (Exit edit mode, show updated info)
        openOrderModal(currentOrderData.id);

    } catch (e) {
        alert('更新失敗：' + e.message);
    }
}

function cancelEditOrder() {
    closeModal();
}
