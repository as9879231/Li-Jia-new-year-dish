const Store = {
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

            if (querySnapshot.empty) {
                console.log("No products globally found in DB. Seeding initial data...");
                const initialProducts = [
                    { id: 1, name: "富貴佛跳牆", price: 1280, desc: "嚴選鮑魚、干貝、蹄筋等十餘種頂級食材，慢火煨燉十二小時。" },
                    { id: 2, name: "紅燒獅子頭", price: 680, desc: "嚴選黑毛豬後腿肉，口感紮實Q彈，搭配獨門醬汁。" },
                    { id: 3, name: "櫻花蝦米糕", price: 580, desc: "東港櫻花蝦與長糯米完美結合，香氣四溢。" },
                    { id: 4, name: "紹興醉雞卷", price: 480, desc: "陳年紹興酒醃製入味，皮脆肉嫩，酒香撲鼻。" },
                    { id: 5, name: "筍乾東坡肉", price: 780, desc: "肥而不膩，入口即化，搭配在地鮮嫩筍乾。" },
                    { id: 6, name: "鮮人蔘雞湯", price: 980, desc: "整支鮮人蔘燉煮，湯頭清甜回甘，滋補養生。" }
                ];

                for (const p of initialProducts) {
                    await addDoc(collection(this.db, "products"), p);
                }
                this.products = initialProducts; // Temporary for this load
            } else {
                this.products = [];
                querySnapshot.forEach((doc) => {
                    this.products.push({ _id: doc.id, ...doc.data() });
                });
                // Sort by id if available
                this.products.sort((a, b) => a.id - b.id);
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

    async addOrder(orderData) {
        try {
            const { collection, setDoc, doc } = window.firebase;

            if (!setDoc) {
                alert("系統核心元件 (setDoc) 未載入，請嘗試按 Ctrl+Shift+R 強制重新整理網頁。");
                throw new Error("Firebase setDoc import missing. Clear cache.");
            }

            // Generate Sequential ID: A1, A2, ...
            // Note: This requires reading all orders to find next number. 
            // For a small scale app this is fine, but for high concurrency it needs transactions.
            const orders = await this.getOrders();
            let nextNum = 1;

            if (orders.length > 0) {
                // Find max ID starting with A
                const existingNums = orders
                    .map(o => o.id)
                    .filter(id => typeof id === 'string' && id.startsWith('A'))
                    .map(id => parseInt(id.substring(1)))
                    .filter(n => !isNaN(n));

                if (existingNums.length > 0) {
                    nextNum = Math.max(...existingNums) + 1;
                }
            }

            const customId = `A${nextNum}`;

            const finalData = {
                ...orderData,
                id: customId, // Store readable ID in data too
                status: 'processing',
                paymentStatus: 'unpaid',
                createdAt: new Date().toISOString()
            };

            // Use setDoc with custom ID instead of addDoc
            await setDoc(doc(this.db, "orders", customId), finalData);

            return finalData;
        } catch (e) {
            console.error("Error adding order: ", e);
            throw e;
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
