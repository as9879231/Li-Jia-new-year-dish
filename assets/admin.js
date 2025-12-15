/**
 * Admin Dashboard Logic
 */

// Initialize
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
});

// Login Function (Global)
window.checkLogin = async function () {
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    const errorDisplay = document.getElementById('loginError');

    if (!email || !password) {
        alert("請輸入帳號與密碼");
        return;
    }

    try {
        errorDisplay.style.display = 'none';
        await Store.login(email, password);
        // Success handled by monitorAuth callback above
    } catch (e) {
        errorDisplay.innerText = "❌ 登入失敗: " + (e.code === 'auth/invalid-credential' ? '帳號或密碼錯誤' : e.message);
        errorDisplay.style.display = 'block';
    }
};


// === Navigation ===
const TABS = ['orders', 'stats', 'menu', 'system'];

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
let currentOrders = [];

async function loadOrders() {
    const tableBody = document.getElementById('orderTableBody');
    tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">載入中...</td></tr>';

    currentOrders = await Store.getOrders();
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
            <td><span class="mobile-label">姓名</span>${order.name}</td>
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
let currentSort = { key: 'id', dir: 'desc' }; // Default sort by ID desc

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
                    ${p.isSoldOut ? '已售完' : '供應中'}
                </button>
            </td>
            <td style="color:#666; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${p.desc}
            </td>
            <td>
                <button class="btn btn-outline" style="padding:2px 8px;" 
                    onclick="moveProduct(${index}, -1)" ${index === 0 ? 'disabled' : ''}>⬆️</button>
                <button class="btn btn-outline" style="padding:2px 8px;" 
                    onclick="moveProduct(${index}, 1)" ${index === products.length - 1 ? 'disabled' : ''}>⬇️</button>
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
    btn.innerText = '處理中...';
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
        alert(`成功匯入 ${successCount} 筆菜色！`);
        closeBatchModal();
        loadMenuAdmin();
    } catch (e) {
        console.error(e);
        alert('匯入發生錯誤');
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
    btn.innerText = '處理中...';
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
        alert(`成功匯入 ${successCount} 筆菜色！`);
        closeBatchModal();
        loadMenuAdmin();
    } catch (e) {
        console.error(e);
        alert('匯入發生錯誤');
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
    if (confirm(`確定要刪除「${name}」嗎？`)) {
        await Store.deleteProduct(docId);
        loadMenuAdmin();
    }
}

// === Order Modal Logic ===
let curModalOrderId = null;

function openOrderModal(orderId) {
    const order = currentOrders.find(o => o.id == orderId || o.id === orderId); // Loose check
    if (!order) return;

    curModalOrderId = orderId;

    const modal = document.getElementById('orderModal');
    document.getElementById('modalId').innerText = '#' + order.id;
    document.getElementById('modalName').innerText = order.name;
    document.getElementById('modalPhone').innerText = order.phone;
    document.getElementById('modalNote').innerText = order.note || '(無)';

    const itemsHtml = order.items.map(i => `
        <div style="display:flex; justify-content:space-between; margin-bottom:5px; border-bottom:1px dashed #eee; padding-bottom:5px;">
            <span>${i.name} x ${i.quantity}</span>
            <span>$${i.price * i.quantity}</span>
        </div>
    `).join('');

    document.getElementById('modalItems').innerHTML = itemsHtml;
    document.getElementById('modalTotal').innerText = Store.formatCurrency(order.totalAmount);

    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('orderModal').style.display = 'none';
}

async function updateStatus(newStatus) {
    if (!curModalOrderId) return;

    // No confirm needed for status updates to be faster
    const { doc, updateDoc } = window.firebase;

    try {
        const ref = doc(Store.db, "orders", curModalOrderId);
        await updateDoc(ref, { status: newStatus });
        closeModal();
        loadOrders();
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
        tbody.innerHTML = '<tr><td colspan="2">目前無需備料</td></tr>';
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
    document.body.classList.add('printing-stats');
    window.print();
    document.body.classList.remove('printing-stats');
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
            btn.innerText = '🟢 目前：開放訂購中 (點擊關閉)';
            btn.className = 'btn';
            btn.style.background = '#2ecc71'; // Green
            btn.style.color = 'white';
            txt.innerText = '目前狀態：系統正常接單中';
            txt.style.color = '#27ae60';
        } else {
            btn.innerText = '🔴 目前：已停止接單 (點擊開啟)';
            btn.className = 'btn';
            btn.style.background = '#e74c3c'; // Red
            btn.style.color = 'white';
            txt.innerText = '目前狀態：已截止，前台無法下單';
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

    if (!confirm(newStatus ? '確定要「重新開放」訂購嗎？' : '確定要「停止接單」嗎？')) {
        return;
    }

    try {
        console.log('Step 1: Calling updateSystemSettings with', newStatus);
        // alert('Step 1: 正在呼叫資料庫...'); // Debug
        await Store.updateSystemSettings({ isOrderingOpen: newStatus });

        console.log('Step 2: Update success, reloading...');
        // alert('Step 2: 資料庫更新成功！'); // Debug
        await loadSystemSettings();

        console.log('Step 3: Reload done');
    } catch (e) {
        console.error("System Settings Error:", e);
        alert('更新失敗，請檢查網路連線或重新整理嘗試。\n錯誤訊息: ' + (e.message || e));
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
        // Create an item map for quick lookup: { "佛跳牆": 2, "醉雞": 1 }
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

    if (!confirm('警告：還原將會新增備份中的所有訂單與菜色到資料庫中 (可能造成重複)。確定要繼續嗎？')) {
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

            alert('資料還原完成！');
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
