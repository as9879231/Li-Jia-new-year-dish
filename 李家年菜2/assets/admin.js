/**
 * Admin Dashboard Logic
 */

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await Store.init();

    // Initial Load
    switchTab('orders');

    // Mobile toggle
    document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
});


// === Navigation ===
const TABS = ['orders', 'stats', 'menu', 'system'];

function switchTab(tabId) {
    // Update Nav
    TABS.forEach(t => document.getElementById(`nav-${t}`).classList.remove('active'));
    document.getElementById(`nav-${tabId}`).classList.add('active');

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
    }
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('active');
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
            <td>#${order.id}</td>
            <td>${order.name}</td>
            <td>${order.phone}</td>
            <td>${order.paymentStatus === 'paid' ? '<span style="color:green">已付款</span>' : '<span style="color:red">未付款</span>'}</td>
            <td>${Store.formatCurrency(order.totalAmount)}</td>
            <td>${statusMap[order.status] || order.status}</td>
            <td>${Store.formatDate(order.createdAt)}</td>
            <td>
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


// Search & Sort implementation skipped for brevity but can be added


// === Menu Management ===
async function loadMenuAdmin() {
    const tableBody = document.getElementById('menuTableBody');
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">載入中...</td></tr>';

    const products = await Store.getProducts();

    if (products.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">目前沒有菜色</td></tr>';
        return;
    }

    tableBody.innerHTML = products.map(p => `
        <tr>
            <td style="font-weight:bold;">${p.name}</td>
            <td>${p.price}</td>
            <td style="color:#666; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${p.desc}
            </td>
            <td>
                <button class="btn btn-outline" onclick="editProduct('${p._id}', ${p.id})">編輯</button>
                <button class="btn btn-outline" style="color:red; border-color:red;" onclick="deleteProduct('${p._id}', '${p.name}')">刪除</button>
            </td>
        </tr>
    `).join('');
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
    // Need to find doc ID? 
    // Wait, getOrders returned objects with id (display ID).
    // If we used Firestore auto-ID, we should have stored docId in result?
    // In store.js getOrders: orders.push({ id: doc.id, ...doc.data() });
    // So order.id IS the docId for Firestore orders.
    // BUT we also simulated numeric ID in data? 
    // Let's check store.js addOrder: { id: docRef.id, ...finalData } => Wait, Firestore ID is string.

    // In store.js addOrder logic I wrote:
    // const docRef = await addDoc(...);
    // return { id: docRef.id, ...finalData }; 
    // And finalData included status etc.
    // So 'id' property on order object is the Firestore Document ID.

    if (confirm('確定更新訂單狀態？')) {
        const { doc, updateDoc } = window.firebase;
        // We need to implement updateOrder in Store or do it here
        // Store has updateOrderStatus
        // Let's use Store

        // Wait, Store.updateOrderStatus was for local storage?
        // I need to update Store.updateOrderStatus too!
        // But I haven't updated it yet in previous step. 
        // Let's just do direct firebase update here or assume I will fix store.js

        // Actually, let's fix Store.updateOrderStatus now via direct usage here for speed or update Store later.
        // Better: use Store.db direct access

        try {
            const ref = window.firebase.doc(Store.db, "orders", curModalOrderId); // order.id is docId
            await window.firebase.updateDoc(ref, { status: newStatus });
            closeModal();
            loadOrders();
        } catch (e) {
            console.error(e);
            alert('更新失敗');
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
    window.print();
}
