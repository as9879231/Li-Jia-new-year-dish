/**
 * Li Family User Year's Dishes - Data Store
 * Handles persistence using browser LocalStorage
 */

const Store = {
    // Keys
    KEYS: {
        PRODUCTS: 'li_family_products',
        ORDERS: 'li_family_orders',
        SETTINGS: 'li_family_settings'
    },

    // Initial Data
    products: [
        { id: 1, name: "富貴佛跳牆", price: 1280, desc: "嚴選鮑魚、干貝、蹄筋等十餘種頂級食材，慢火煨燉十二小時。" },
        { id: 2, name: "紅燒獅子頭", price: 680, desc: "嚴選黑毛豬後腿肉，口感紮實Q彈，搭配獨門醬汁。" },
        { id: 3, name: "櫻花蝦米糕", price: 580, desc: "東港櫻花蝦與長糯米完美結合，香氣四溢。" },
        { id: 4, name: "紹興醉雞卷", price: 480, desc: "陳年紹興酒醃製入味，皮脆肉嫩，酒香撲鼻。" },
        { id: 5, name: "筍乾東坡肉", price: 780, desc: "肥而不膩，入口即化，搭配在地鮮嫩筍乾。" },
        { id: 6, name: "鮮人蔘雞湯", price: 980, desc: "整支鮮人蔘燉煮，湯頭清甜回甘，滋補養生。" }
    ],

    // Methods
    init() {
        if (!localStorage.getItem(this.KEYS.PRODUCTS)) {
            localStorage.setItem(this.KEYS.PRODUCTS, JSON.stringify(this.products));
        }
        if (!localStorage.getItem(this.KEYS.ORDERS)) {
            localStorage.setItem(this.KEYS.ORDERS, JSON.stringify([]));
        }
    },

    getProducts() {
        return JSON.parse(localStorage.getItem(this.KEYS.PRODUCTS)) || this.products;
    },

    saveProducts(products) {
        localStorage.setItem(this.KEYS.PRODUCTS, JSON.stringify(products));
    },

    getOrders() {
        return JSON.parse(localStorage.getItem(this.KEYS.ORDERS)) || [];
    },

    addOrder(orderData) {
        const orders = this.getOrders();
        const nextId = orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 1;

        const newOrder = {
            id: nextId,
            ...orderData,
            status: 'processing',
            paymentStatus: 'unpaid',
            createdAt: new Date().toISOString()
        };

        orders.push(newOrder);
        localStorage.setItem(this.KEYS.ORDERS, JSON.stringify(orders));
        return newOrder;
    },

    updateOrderStatus(id, status) {
        const orders = this.getOrders();
        const order = orders.find(o => o.id == id);
        if (order) {
            order.status = status;
            localStorage.setItem(this.KEYS.ORDERS, JSON.stringify(orders));
            return true;
        }
        return false;
    },

    updatePaymentStatus(id, status) {
        const orders = this.getOrders();
        const order = orders.find(o => o.id == id);
        if (order) {
            order.paymentStatus = status;
            localStorage.setItem(this.KEYS.ORDERS, JSON.stringify(orders));
            return true;
        }
        return false;
    },

    deleteOrder(id) {
        let orders = this.getOrders();
        // Use loose inequality to handle string/number ID types
        orders = orders.filter(o => o.id != id);
        localStorage.setItem(this.KEYS.ORDERS, JSON.stringify(orders));
    },

    updateOrder(id, updatedData) {
        const orders = this.getOrders();
        const index = orders.findIndex(o => o.id == id);
        if (index !== -1) {
            // Merge existing data with updates
            orders[index] = { ...orders[index], ...updatedData };
            // Recalculate total if items changed? 
            // Better to let the caller handle recalculation or do it here.
            // Let's do a safety recalc here if items are present
            if (updatedData.items) {
                orders[index].totalAmount = updatedData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            }
            localStorage.setItem(this.KEYS.ORDERS, JSON.stringify(orders));
            return orders[index];
        }
        return null;
    },

    getAllData() {
        return {
            products: this.getProducts(),
            orders: this.getOrders(),
            timestamp: new Date().toISOString()
        };
    },

    setAllData(data) {
        if (!data || !data.products || !data.orders) return false;
        try {
            this.saveProducts(data.products);
            localStorage.setItem(this.KEYS.ORDERS, JSON.stringify(data.orders));
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    },

    formatCurrency(num) {
        return 'NT$ ' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    },

    formatDate(isoString) {
        const date = new Date(isoString);
        return date.toLocaleString('zh-TW', { hour12: false });
    }
};

// Initialize on load
Store.init();
