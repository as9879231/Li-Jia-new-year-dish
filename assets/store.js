var Store = {
    // Firebase Config
    db: null,
    products: [],

    // Methods
    async init() {
        console.log('Store initializing with Firebase...');

        const firebaseConfig = {
            apiKey: "AIzaSyACTdWMWn5o8JHa2OlV4jmS-T0ZR_MJawY",
            authDomain: "li-family-dishes.firebaseapp.com",
            projectId: "li-family-dishes",
            storageBucket: "li-family-dishes.firebasestorage.app",
            messagingSenderId: "415624599544",
            appId: "1:415624599544:web:9b7507f808cfe730a0a80d",
            measurementId: "G-DPWF4XPMTG"
        };

        try {
            // Wait for firebase to be loaded from module script
            if (!window.firebase) {
                // simple retry mechanism if module loading is slow
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            const { initializeApp, getFirestore, collection, getDocs } = window.firebase;

            const app = initializeApp(firebaseConfig);
            this.db = getFirestore(app);

            // Conditional Auth Init (Only if SDK loaded)
            if (window.firebase.getAuth) {
                const { getAuth } = window.firebase;
                this.auth = getAuth(app);
            }

            // Check connection by fetching products (or seeding if empty)
            await this.loadProducts();
            console.log('Firebase connected successfully.');
        } catch (e) {
            console.error('Firebase Initialization Error:', e);
            alert('連線到資料庫失敗，請檢查網路連線。');
        }
    },

    // Auth Methods
    async login(email, password) {
        if (!this.auth) throw new Error("Auth module not loaded");
        try {
            const { signInWithEmailAndPassword } = window.firebase;
            const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
            return userCredential.user;
        } catch (error) {
            console.error("Login failed:", error);
            throw error;
        }
    },

    async logout() {
        try {
            const { signOut } = window.firebase;
            await signOut(this.auth);
        } catch (error) {
            console.error("Logout failed:", error);
        }
    },

    monitorAuth(callback) {
        const { onAuthStateChanged } = window.firebase;
        onAuthStateChanged(this.auth, (user) => {
            callback(user);
        });
    },

    async loadProducts() {
        try {
            const { collection, getDocs, addDoc } = window.firebase;
            const querySnapshot = await getDocs(collection(this.db, "products"));

            this.products = [];
            if (!querySnapshot.empty) {
                querySnapshot.forEach((doc) => {
                    this.products.push({ _id: doc.id, ...doc.data() });
                });
                // Sort by id if available
                this.products.sort((a, b) => a.id - b.id);
            } else {
                console.log("No products found in DB.");
            }
            return this.products;
        } catch (e) {
            console.error("Error loading products:", e);
            return [];
        }
    },

    async getProducts() {
        if (!this.products || this.products.length === 0) {
            await this.loadProducts();
        }
        return this.products;
    },

    async getOrders() {
        try {
            const { collection, getDocs } = window.firebase;
            const querySnapshot = await getDocs(collection(this.db, "orders"));
            const orders = [];
            querySnapshot.forEach((doc) => {
                orders.push({ id: doc.id, ...doc.data() });
            });
            // Client-side sort by date (newest first)
            return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } catch (e) {
            console.error("Error getting orders: ", e);
            return [];
        }
    },

    // New Secure Query Method
    async findOrdersByPhone(phone) {
        try {
            const { collection, getDocs, query, where } = window.firebase;
            if (!query || !where) throw new Error("Firebase Query features not loaded");

            const q = query(collection(this.db, "orders"), where("phone", "==", phone));
            const querySnapshot = await getDocs(q);

            const orders = [];
            querySnapshot.forEach((doc) => {
                orders.push({ id: doc.id, ...doc.data() });
            });

            // Sort local
            return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } catch (e) {
            console.error("Error searching orders by phone: ", e);
            throw e;
        }
    },

    async addOrder(orderData) {
        try {
            const { collection, setDoc, doc, runTransaction, getDocs } = window.firebase;

            if (!runTransaction) {
                alert("系統核心元件 (runTransaction) 未載入，請嘗試按 Ctrl+Shift+R 強制重新整理網頁。");
                throw new Error("Firebase runTransaction import missing. Clear cache.");
            }

            const counterRef = doc(this.db, "settings", "orderCounter");

            let finalId = '';

            await runTransaction(this.db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                let nextNum = 1;

                if (!counterDoc.exists()) {
                    // Fallback: If counter doesn't exist, try to count existing orders carefully
                    // This is a one-time migration step.
                    try {
                        const allOrders = await getDocs(collection(this.db, "orders"));
                        if (!allOrders.empty) {
                            const existingNums = allOrders.docs
                                .map(d => d.data().id)
                                .filter(id => typeof id === 'string' && id.startsWith('A'))
                                .map(id => parseInt(id.substring(1)))
                                .filter(n => !isNaN(n));

                            if (existingNums.length > 0) {
                                nextNum = Math.max(...existingNums) + 1;
                            }
                        }
                    } catch (e) {
                        console.warn("Could not read orders for init fallback (likely permission denied). Starting at 1.");
                    }
                } else {
                    nextNum = (counterDoc.data().current || 0) + 1;
                }

                const customId = `A${nextNum}`;
                finalId = customId;

                const finalData = {
                    ...orderData,
                    id: customId,
                    status: 'processing',
                    paymentStatus: 'unpaid',
                    createdAt: new Date().toISOString()
                };

                // 1. Update Counter
                transaction.set(counterRef, { current: nextNum }, { merge: true });

                // 2. Create Order
                // Use the custom ID as the document key as well for consistency
                transaction.set(doc(this.db, "orders", customId), finalData);
            });

            return { id: finalId, ...orderData };

        } catch (e) {
            console.error("Error adding order transaction: ", e);
            alert("下單失敗，請稍後再試。原因: " + (e.message || "未知錯誤"));
            throw e;
        }
    },

    // Admin Helper: Sync Counter (Run when Admin Logs in)
    async syncOrderCounter() {
        try {
            const { collection, getDocs, doc, setDoc } = window.firebase;

            // Check if counter exists first
            const counterRef = doc(this.db, "settings", "orderCounter");
            // We just overwrite it based on max found to be safe

            console.log("Syncing Order Counter...");
            const allOrders = await getDocs(collection(this.db, "orders"));

            if (allOrders.empty) return;

            const existingNums = allOrders.docs
                .map(d => d.data().id)
                .filter(id => typeof id === 'string' && id.startsWith('A'))
                .map(id => parseInt(id.substring(1)))
                .filter(n => !isNaN(n));

            let maxNum = 0;
            if (existingNums.length > 0) {
                maxNum = Math.max(...existingNums);
            }

            // Update Counter to Max found
            await setDoc(counterRef, { current: maxNum }, { merge: true });
            console.log("Order Counter Synced to:", maxNum);

        } catch (e) {
            console.error("Failed to sync counter (Are you Admin?):", e);
        }
    },

    async addProduct(productData) {
        try {
            const { collection, addDoc } = window.firebase;

            // Fix: ensure products is loaded
            if (!this.products) await this.loadProducts();

            // Get max ID safe logic
            const maxId = this.products.length > 0
                ? Math.max(...this.products.map(p => Number(p.id) || 0))
                : 0;

            const newProduct = { ...productData, id: maxId + 1 };

            await addDoc(collection(this.db, "products"), newProduct);
            await this.loadProducts(); // Reload to get new list
            return true;
        } catch (e) {
            console.error("Add Product Error:", e);
            throw e;
        }
    },

    async updateProduct(docId, productData) {
        try {
            const { doc, updateDoc } = window.firebase;
            const ref = doc(this.db, "products", docId);
            await updateDoc(ref, productData);
            await this.loadProducts();
            return true;
        } catch (e) {
            console.error("Update Product Error:", e);
            throw e;
        }
    },

    async deleteProduct(docId) {
        try {
            const { doc, deleteDoc } = window.firebase;
            if (deleteDoc) {
                await deleteDoc(doc(this.db, "products", docId));
                await this.loadProducts();
                return true;
            } else {
                alert("刪除功能尚未啟用 (Missing SDK import)");
                return false;
            }
        } catch (e) {
            console.error("Delete Product Error:", e);
            throw e;
        }
    },

    formatCurrency(num) {
        return 'NT$ ' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    },

    formatDate(isoString) {
        const date = new Date(isoString);
        return date.toLocaleString('zh-TW', { hour12: false });
    },

    // System Settings
    async getSystemSettings() {
        try {
            const { doc, getDoc, setDoc } = window.firebase;
            const ref = doc(this.db, "settings", "system");
            const snap = await getDoc(ref);

            if (snap.exists()) {
                return snap.data();
            } else {
                // Initialize default if missing
                const defaultSettings = { isOrderingOpen: true };
                await setDoc(ref, defaultSettings);
                return defaultSettings;
            }
        } catch (e) {
            console.error("Get Settings Error:", e);
            return { isOrderingOpen: true }; // Fallback
        }
    },

    async updateOrder(docId, data) {
        try {
            const { doc, updateDoc } = window.firebase;
            const ref = doc(this.db, "orders", docId);
            await updateDoc(ref, data);
            return true;
        } catch (e) {
            console.error("Update Order Error:", e);
            throw e;
        }
    },

    async updateSystemSettings(data) {
        try {
            const { doc, setDoc } = window.firebase;
            const ref = doc(this.db, "settings", "system");
            // Use setDoc with merge:true so it creates the doc if it doesn't exist
            await setDoc(ref, data, { merge: true });
            return true;
        } catch (e) {
            console.error("Update Settings Error:", e);
            throw e;
        }
    }
};
