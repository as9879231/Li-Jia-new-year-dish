/**
 * Admin Dashboard Logic
 */

let currentOrderId = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('searchInput').addEventListener('input', refreshData);
    refreshData();
    refreshMenu();
});

function switchTab(tab) {
    // Nav
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`nav-${tab}`).classList.add('active');

    // Title
    const titles = {
        'orders': '訂單管理',
        'stats': '廚房統計',
        'menu': '菜單設定',
        'system': '系統設定'
    };
    document.getElementById('pageTitle').innerText = titles[tab] || '後台管理';

    // Content
    const ordersSec = document.getElementById('ordersSection');
    const menuSec = document.getElementById('menuSection');
    const statsSec = document.getElementById('statsSection');
    const systemSec = document.getElementById('systemSection');

    ordersSec.classList.add('hidden');
    menuSec.classList.add('hidden');
    statsSec.classList.add('hidden');
    if (systemSec) systemSec.classList.add('hidden');

    if (tab === 'orders') {
        ordersSec.classList.remove('hidden');
        refreshData();
    } else if (tab === 'stats') {
        statsSec.classList.remove('hidden');
        refreshKitchenStats();
    } else if (tab === 'system') {
        if (systemSec) systemSec.classList.remove('hidden');
    } else {
        menuSec.classList.remove('hidden');
        refreshMenu();
    }
}

function refreshKitchenStats() {
    const orders = Store.getOrders();
    const products = Store.getProducts(); // Get canonical menu order
    const validOrders = orders.filter(o => o.status !== 'cancelled');

    // Aggregate items
    const stats = {};
    validOrders.forEach(order => {
        order.items.forEach(item => {
            if (!stats[item.name]) {
                stats[item.name] = 0;
            }
            stats[item.name] += item.quantity;
        });
    });

    // Sort logic: Match Menu Order
    const productOrder = {};
    products.forEach((p, index) => {
        productOrder[p.name] = index;
    });

    // Sort logic: By Menu Order ASC (For Table)
    const tableData = Object.entries(stats).sort((a, b) => {
        const nameA = a[0];
        const nameB = b[0];
        const indexA = productOrder[nameA] !== undefined ? productOrder[nameA] : 9999;
        const indexB = productOrder[nameB] !== undefined ? productOrder[nameB] : 9999;
        return indexA - indexB;
    });

    // Render Table (By Menu Order)
    const tbody = document.getElementById('kitchenTableBody');
    if (!tbody) return;

    if (tableData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">尚無訂單資料</td></tr>';
        return;
    }

    tbody.innerHTML = tableData.map(([name, qty]) => {
        const index = productOrder[name] !== undefined ? productOrder[name] + 1 : '?';
        return `
            <tr>
                <td style="font-weight:700; font-size:1.1rem;">${index}. ${name}</td>
                <td style="font-weight:700; font-size:1.2rem; color:#d35400;">${qty}</td>
            </tr>
        `;
    }).join('');
}

// === ORDER LOGIC ===

// Sort State
let currentSort = 'id'; // 'id' or 'time'
let sortDirection = 'desc'; // 'asc' or 'desc'

function toggleSort(field) {
    if (currentSort === field) {
        sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
    } else {
        currentSort = field;
        sortDirection = 'desc';
    }
    refreshData();
}

function refreshData() {
    let orders = Store.getOrders();

    // Search Filter
    const query = document.getElementById('searchInput')?.value.toLowerCase().trim();
    if (query) {
        orders = orders.filter(o =>
            o.id.toString().includes(query) ||
            o.name.toLowerCase().includes(query) ||
            o.phone.includes(query)
        );
    }

    const tbody = document.getElementById('orderTableBody');

    // Sort logic
    orders.sort((a, b) => {
        let valA, valB;
        if (currentSort === 'id') {
            valA = a.id;
            valB = b.id;
        } else if (currentSort === 'status') {
            const weights = { 'new': 1, 'processing': 1, 'confirmed': 2, 'completed': 3, 'cancelled': 4 };
            valA = weights[a.status] || 99;
            valB = weights[b.status] || 99;
        } else { // currentSort === 'time'
            valA = new Date(a.createdAt).getTime();
            valB = new Date(b.createdAt).getTime();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // Update Icons
    updateSortIcon('sort-id-icon', 'id');
    updateSortIcon('sort-time-icon', 'time');
    updateSortIcon('sort-status-icon', 'status');


    // Stats
    const total = orders.length;
    const newOrders = orders.filter(o => o.status === 'new').length;
    const revenue = orders
        .filter(o => o.status !== 'cancelled')
        .reduce((sum, o) => sum + o.totalAmount, 0);

    // Update Dashboard Numbers
    if (document.getElementById('statsTotal')) {
        document.getElementById('statsTotal').innerText = total;
        document.getElementById('statsNew').innerText = newOrders;
        document.getElementById('statsRevenue').innerText = Store.formatCurrency(revenue);
    }

    if (!tbody) return; // Ensure tbody exists before trying to manipulate it

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px;">尚無訂單</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>#${order.id}</td>
            <td>${order.name}</td>
            <td>${order.phone}</td>
            <td>${getPaymentBadge(order.paymentStatus)}</td>
            <td>${Store.formatCurrency(order.totalAmount)}</td>
            <td>${getStatusBadge(order.status)}</td>
            <td>${Store.formatDate(order.createdAt)}</td>
            <td>
                <button style="border:none; background:none; color:#3498db; cursor:pointer;" 
                    onclick="viewOrder('${order.id}')">查看詳情</button>
            </td>
        </tr>
    `).join('');
}

function updateSortIcon(id, field) {
    const el = document.getElementById(id);
    if (el) {
        el.style.color = currentSort === field ? '#333' : '#ccc';
        el.innerText = currentSort === field && sortDirection === 'asc' ? '▲' : '▼';
    }
}

function getPaymentBadge(status) {
    if (status === 'paid') return '<span class="status-badge" style="background:#e8f5e9; color:#2e7d32;">已收款</span>';
    return '<span class="status-badge" style="background:#f5f5f5; color:#666;">未收款</span>';
}

function getStatusBadge(status) {
    if (status === 'processing' || status === 'new') return '<span class="status-badge status-new">處理中</span>';
    if (status === 'confirmed') return '<span class="status-badge" style="background:#e3f2fd; color:#1976d2;">已確認</span>';
    if (status === 'completed') return '<span class="status-badge status-completed">已完成</span>';
    if (status === 'cancelled') return '<span class="status-badge status-cancelled">已取消</span>';
    return `<span class="status-badge">${status}</span>`;
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('active');
}

// Close sidebar on outside click (Mobile)
document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar');
    const toggle = document.getElementById('sidebarToggle');

    // Only if mobile and sidebar is open
    if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
        // If click is NOT inside sidebar AND NOT the toggle button
        if (!sidebar.contains(e.target) && e.target !== toggle) {
            sidebar.classList.remove('active');
        }
    }
});

function viewOrder(id) {
    const orders = Store.getOrders();
    // Use loose equality (==) because 'id' from HTML is string, but order.id might be number
    const order = orders.find(o => o.id == id);
    if (!order) return;

    currentOrderId = order.id; // Store the correct type (Number/String) for updateStatus

    document.getElementById('modalId').innerText = '#' + order.id;
    document.getElementById('modalName').innerText = order.name;
    document.getElementById('modalPhone').innerText = order.phone;
    document.getElementById('modalNote').innerText = order.note || '(無)';
    document.getElementById('modalTotal').innerText = Store.formatCurrency(order.totalAmount);

    const itemsEl = document.getElementById('modalItems');
    itemsEl.innerHTML = order.items.map(item => `
        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
            <span>${item.name} x${item.quantity}</span>
            <span>${Store.formatCurrency(item.price * item.quantity)}</span>
        </div>
    `).join('');

    // Reset Footer Buttons (Standard Mode)
    const modalContent = document.querySelector('#orderModal .modal-content');
    if (modalContent) {
        const footer = modalContent.lastElementChild;
        // 1. Payment Button
        const isPaid = order.paymentStatus === 'paid';
        const paymentBtn = isPaid
            ? `<button class="btn btn-outline" style="color:#666; border-color:#ccc; font-size:0.9rem;" onclick="updatePayment('unpaid')">💲 標記未收</button>`
            : `<button class="btn btn-outline" style="color:#27ae60; border-color:#27ae60; font-size:0.9rem;" onclick="updatePayment('paid')">💰 標記已收</button>`;

        // 2. Status Button Workflow
        let statusBtn = '';
        if (order.status === 'processing' || order.status === 'new') {
            statusBtn = `<button class="btn" style="background:#3498db; color:white; border:none; padding:8px 15px;" onclick="updateStatus('confirmed')">✅ 確認接單</button>`;
        } else if (order.status === 'confirmed') {
            statusBtn = `<button class="btn" style="background:#27ae60; color:white; border:none; padding:8px 15px;" onclick="updateStatus('completed')">🏁 完成訂單</button>`;
        } else if (order.status === 'completed') {
            statusBtn = `<button class="btn" style="background:#f39c12; color:white; border:none; padding:8px 15px;" onclick="updateStatus('processing')">↩️ 重設狀態</button>`;
        } else {
            statusBtn = `<button class="btn" style="background:#3498db; color:white; border:none; padding:8px 15px;" onclick="updateStatus('processing')">🔄 處理中</button>`;
        }

        footer.innerHTML = `
            <div style="margin-top:30px; display:flex; gap:10px; align-items:center;">
                <button class="btn btn-outline" style="border-color:#e74c3c; color:#e74c3c; padding:8px 15px; font-size:0.9rem;" onclick="deleteCurrentOrder()">🗑️ 刪除</button>
                <div style="flex:1;"></div>
                ${paymentBtn}
                <button class="btn btn-outline" style="border:none; color:#666;" onclick="closeModal()">關閉</button>
                <button class="btn btn-outline" style="padding:8px 15px;" onclick="enableEditMode()">✏️ 編輯</button>
                ${statusBtn}
            </div>
        `;
    }

    document.getElementById('orderModal').classList.add('active');
}

function updatePayment(status) {
    if (!currentOrderId) return;
    Store.updatePaymentStatus(currentOrderId, status);
    // Refresh view
    viewOrder(currentOrderId);
    refreshData();
}

function closeModal() {
    document.getElementById('orderModal').classList.remove('active');
    currentOrderId = null;
}

function updateStatus(status) {
    if (!currentOrderId) return;
    Store.updateOrderStatus(currentOrderId, status);
    closeModal();
    refreshData();
    // Also refresh stats if needed
    refreshKitchenStats();
}

function enableEditMode() {
    if (!currentOrderId) return;
    const orders = Store.getOrders();
    const order = orders.find(o => o.id == currentOrderId);
    if (!order) return;

    // Get full menu
    const products = Store.getProducts();

    // Replace Text with Inputs
    document.getElementById('modalName').innerHTML = `<input type="text" id="editName" class="form-input" value="${order.name}">`;
    document.getElementById('modalPhone').innerHTML = `<input type="text" id="editPhone" class="form-input" value="${order.phone}">`;
    document.getElementById('modalNote').innerHTML = `<textarea id="editNote" class="form-textarea">${order.note || ''}</textarea>`;

    // Prepare Grid of Items (Menu + Legacy)
    // 1. Map Menu Items
    const existingMap = {};
    order.items.forEach(item => existingMap[item.name] = item);

    let itemsHtml = products.map((p, index) => {
        const qty = existingMap[p.name] ? existingMap[p.name].quantity : 0;
        const isSelected = qty > 0;
        const bgStyle = isSelected ? 'border-color:#d35400; background:#fff8e1;' : 'border-color:#eee;';

        return `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:10px; border:1px solid #eee; border-radius:4px; ${bgStyle}">
            <div style="flex:1;">
                <div style="font-weight:700;">${p.name}</div>
                <div style="font-size:0.8rem; color:#666;">$${p.price}</div>
            </div>
            <div style="display:flex; align-items:center; gap:5px;">
                <input type="number" class="form-input edit-item-input" 
                       data-name="${p.name}" data-price="${p.price}" 
                       value="${qty}" min="0" style="width:60px; text-align:center;">
                <span style="font-size:0.9rem;">份</span>
            </div>
        </div>`;
    }).join('');

    // 2. Handle Legacy Items (In order but not in current menu)
    const menuNames = products.map(p => p.name);
    const legacyItems = order.items.filter(item => !menuNames.includes(item.name));

    if (legacyItems.length > 0) {
        itemsHtml += '<div style="margin:20px 0 10px 0; font-weight:bold; color:#e74c3c;">⚠️ 已下架商品 (僅限編輯數量)</div>';
        itemsHtml += legacyItems.map(item => `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:10px; border:1px solid #e74c3c; background:#ffebee; border-radius:4px;">
            <div style="flex:1;">
                <div style="font-weight:700;">${item.name}</div>
                <div style="font-size:0.8rem; color:#666;">$${item.price}</div>
            </div>
            <div style="display:flex; align-items:center; gap:5px;">
                <input type="number" class="form-input edit-item-input" 
                       data-name="${item.name}" data-price="${item.price}" 
                       value="${item.quantity}" min="0" style="width:60px; text-align:center;">
                <span style="font-size:0.9rem;">份</span>
            </div>
        </div>`).join('');
    }

    // Scroll container for items if list is long
    const itemsEl = document.getElementById('modalItems');
    itemsEl.innerHTML = `<div style="max-height:300px; overflow-y:auto; padding-right:5px;">${itemsHtml}</div>`;

    // Replace Footer Buttons
    const modalContent = document.querySelector('#orderModal .modal-content');
    const footer = modalContent.lastElementChild;
    footer.innerHTML = `
        <div style="margin-top:30px; display:flex; gap:10px; align-items:center; justify-content:flex-end;">
            <button class="btn btn-outline" style="color:#666; border-color:#ccc;" onclick="viewOrder('${order.id}')">❌ 取消</button>
            <button class="btn btn-primary" onclick="saveEdit()">💾 儲存變更</button>
        </div>
    `;
}

function saveEdit() {
    if (!currentOrderId) return;

    // Get new values
    const newName = document.getElementById('editName').value;
    const newPhone = document.getElementById('editPhone').value;
    const newNote = document.getElementById('editNote').value;

    // Scan all inputs
    const inputs = document.querySelectorAll('.edit-item-input');
    const newItems = [];

    inputs.forEach(input => {
        const qty = parseInt(input.value) || 0;
        if (qty > 0) {
            newItems.push({
                name: input.getAttribute('data-name'),
                price: parseInt(input.getAttribute('data-price')),
                quantity: qty
            });
        }
    });

    if (newItems.length === 0) {
        alert('訂單必須至少有一樣餐點！');
        return;
    }

    // Update Store
    const updatedData = {
        name: newName,
        phone: newPhone,
        note: newNote,
        items: newItems
    };

    Store.updateOrder(currentOrderId, updatedData);

    // Refresh
    viewOrder(currentOrderId);
    refreshData();
    refreshKitchenStats();
}

function printStats() {
    document.body.classList.add('printing-stats');
    window.print();
    setTimeout(() => {
        document.body.classList.remove('printing-stats');
    }, 100);
}

function deleteCurrentOrder() {
    if (!currentOrderId) return;
    if (confirm('⚠️ 警告：您確定要刪除這筆訂單嗎？\n\n刪除後無法復原！')) {
        Store.deleteOrder(currentOrderId);
        closeModal();
        refreshData();
        refreshKitchenStats();
    }
}

// === MENU LOGIC ===

function refreshMenu() {
    const products = Store.getProducts();
    const tbody = document.getElementById('menuTableBody');
    if (!tbody) return;

    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">無菜單資料</td></tr>';
        return;
    }

    tbody.innerHTML = products.map((p, index) => `
        <tr>
            <td style="font-weight:700;">${index + 1}. ${p.name}</td>
            <td>${Store.formatCurrency(p.price)}</td>
            <td style="color:#666; font-size:0.9rem; max-width:300px;">${p.desc}</td>
            <td>
                <button class="btn btn-outline" style="padding:4px 8px; font-size:0.8rem;" onclick="moveProduct(${index}, -1)" ${index === 0 ? 'disabled style="opacity:0.3"' : ''}>⬆️</button>
                <button class="btn btn-outline" style="padding:4px 8px; font-size:0.8rem;" onclick="moveProduct(${index}, 1)" ${index === products.length - 1 ? 'disabled style="opacity:0.3"' : ''}>⬇️</button>
                <button class="btn btn-outline" style="padding:4px 10px; font-size:0.8rem; margin-left:10px;" onclick="editProduct(${p.id})">編輯</button>
                <button class="btn btn-outline" style="padding:4px 10px; font-size:0.8rem; border-color:#e74c3c; color:#e74c3c;" onclick="deleteProduct(${p.id})">刪除</button>
            </td>
        </tr>
    `).join('');
}

function moveProduct(index, direction) {
    const products = Store.getProducts();
    const newIndex = index + direction;

    if (newIndex >= 0 && newIndex < products.length) {
        // Swap
        [products[index], products[newIndex]] = [products[newIndex], products[index]];
        Store.saveProducts(products);
        refreshMenu();
    }
}

function openProductModal(id = null) {
    const products = Store.getProducts();
    const modal = document.getElementById('productModal');
    const title = document.getElementById('productModalTitle');

    document.getElementById('pId').value = '';
    document.getElementById('pName').value = '';
    document.getElementById('pPrice').value = '';
    document.getElementById('pDesc').value = '';

    if (id) {
        const p = products.find(x => x.id === id);
        if (p) {
            title.innerText = '編輯菜色';
            document.getElementById('pId').value = p.id;
            document.getElementById('pName').value = p.name;
            document.getElementById('pPrice').value = p.price;
            document.getElementById('pDesc').value = p.desc;
        }
    } else {
        title.innerText = '新增菜色';
    }

    modal.classList.add('active');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}

function editProduct(id) {
    openProductModal(id);
}

function deleteProduct(id) {
    if (!confirm('確定要刪除這道菜嗎？')) return;
    let products = Store.getProducts();
    products = products.filter(p => p.id !== id);
    Store.saveProducts(products);
    refreshMenu();
}

function saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('pId').value;
    const name = document.getElementById('pName').value;
    const price = Number(document.getElementById('pPrice').value);
    const desc = document.getElementById('pDesc').value;

    let products = Store.getProducts();

    if (id) {
        // Update
        const idx = products.findIndex(p => p.id == id);
        if (idx !== -1) {
            products[idx] = { ...products[idx], name, price, desc };
        }
    } else {
        // Create
        const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
        products.push({ id: newId, name, price, desc });
    }

    Store.saveProducts(products);
    closeProductModal();
    refreshMenu();
}

function downloadBackup() {
    const data = Store.getAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `li_family_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function restoreBackup(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (Store.setAllData(data)) {
                alert('資料還原成功！系統將重新整理。');
                location.reload();
            } else {
                alert('資料格式錯誤，還原失敗。');
            }
        } catch (err) {
            alert('檔案讀取失敗。');
            console.error(err);
        }
    };
    reader.readAsText(file);
}

function exportToExcel() {
    const orders = Store.getOrders();
    const products = Store.getProducts();

    if (orders.length === 0) {
        alert('目前沒有訂單可匯出！');
        return;
    }

    // 1. Collect all unique item names (Current Menu + Legacy Items in Orders)
    const productNames = new Set(products.map(p => p.name));
    orders.forEach(o => o.items.forEach(i => productNames.add(i.name)));
    const columns = Array.from(productNames);

    // 2. Build Header
    // Fixed: ID, Date, Name, Phone
    // Dynamic: Products...
    // Fixed: Total, Payment, Status, Note
    let csvContent = "訂單編號,日期,訂購人,電話," + columns.map(c => `"${c}"`).join(",") + ",總金額,付款狀態,訂單狀態,備註\n";

    // 3. Build Rows
    orders.forEach(order => {
        // Date
        const date = new Date(order.createdAt).toLocaleString('zh-TW', { hour12: false });

        // Item Map for this order
        const itemMap = {};
        order.items.forEach(i => itemMap[i.name] = i.quantity);

        // Fixed Cells
        let row = [
            `"${order.id}"`,
            `"${date}"`,
            `"${order.name}"`,
            `"${order.phone}"`
        ];

        // Product Cells (Quantities)
        columns.forEach(colName => {
            const qty = itemMap[colName] || 0;
            row.push(qty);
        });

        // Summary Cells
        const paymentStr = order.paymentStatus === 'paid' ? '已收款' : '未收款';
        const statusMap = { 'new': '新訂單', 'processing': '處理中', 'confirmed': '已確認', 'completed': '已完成', 'cancelled': '已取消' };
        const statusStr = statusMap[order.status] || order.status;
        const noteStr = (order.note || '').replace(/"/g, '""');

        row.push(order.totalAmount);
        row.push(`"${paymentStr}"`);
        row.push(`"${statusStr}"`);
        row.push(`"${noteStr}"`);

        csvContent += row.join(",") + "\n";
    });

    // 4. Download
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `李家年菜_統計報表_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
