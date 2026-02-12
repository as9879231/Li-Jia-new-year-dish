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
            const { collection, getDocs, query, where, limit } = window.firebase;
            if (!query || !where) throw new Error("Firebase Query features not loaded");

            // Secure Query: Limit to 5 results to match Security Rules
            const q = query(collection(this.db, "orders"), where("phone", "==", phone), limit(5));
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
            const { collection, setDoc, doc, runTransaction, getDocs, query, where, limit } = window.firebase;

            if (!runTransaction) {
                alert("系統核心元件 (runTransaction) 未載入，請嘗試按 Ctrl+Shift+R 強制重新整理網頁。");
                throw new Error("Firebase runTransaction import missing. Clear cache.");
            }

            // 0. Pre-check: Duplicate Order (Removed per request)
            // const dupQ = query(...)
            // const dupSnap = await getDocs(dupQ);
            // if (!dupSnap.empty) throw new Error("DUPLICATE_ORDER_FOUND");

            const counterRef = doc(this.db, "settings", "orderCounter");

            let finalId = '';

            await runTransaction(this.db, async (transaction) => {
                // 1. Security Check: Read System Settings FIRST
                const settingsRef = doc(this.db, "settings", "system");
                const settingsDoc = await transaction.get(settingsRef);

                if (settingsDoc.exists() && settingsDoc.data().isOrderingOpen === false) {
                    throw new Error("ORDERING_CLOSED");
                }

                // 2. Security Check: Verify Stock for ALL items
                for (const item of orderData.items) {
                    // Check if item has an ID (it should)
                    if (item._id) {
                        const prodRef = doc(this.db, "products", item._id);
                        const prodDoc = await transaction.get(prodRef);
                        if (prodDoc.exists() && prodDoc.data().isSoldOut === true) {
                            throw new Error(`PRODUCT_SOLD_OUT: ${item.name}`);
                        }
                    }
                }

                const counterDoc = await transaction.get(counterRef);
                let nextNum = 1;

                let finalIdToUse = '';
                let currentCounterVal = counterDoc.exists() ? (counterDoc.data().current || 0) : 0;

                if (orderData.customId && orderData.customId.length > 0) {
                    // Manual ID Logic
                    finalIdToUse = orderData.customId;

                    // Note: We removed the explicit "transaction.get" check here because
                    // unauthenticated users (guests) cannot read orders, causing a Permission Denied error.
                    // Instead, we rely on Firestore Security Rules:
                    // If the doc exists, 'set' acts as 'update'. Rules should block 'update' for guests.
                    // If the doc is new, 'set' acts as 'create'. Rules should allow 'create'.

                    // Optional: Try to update counter if custom ID is a pure "A+Number" format and is greater than current
                    if (finalIdToUse.startsWith('A')) {
                        const numPart = parseInt(finalIdToUse.substring(1));
                        if (!isNaN(numPart) && numPart > currentCounterVal) {
                            transaction.set(counterRef, { current: numPart }, { merge: true });
                        }
                    }

                } else {
                    // Auto-Generate Logic
                    if (!counterDoc.exists()) {
                        // (Same fallback logic as before, abbreviated here or kept if identical context fits)
                        // Note: To keep diff small, I will simplify fallback or rely on previous "if !counterDoc.exists" structure if possible.
                        // But since I am rewriting the block, I should copy the fallback logic.

                        try {
                            const allOrders = await getDocs(collection(this.db, "orders"));
                            if (!allOrders.empty) {
                                const existingNums = allOrders.docs
                                    .map(d => d.data().id)
                                    .filter(id => typeof id === 'string' && id.startsWith('A'))
                                    .map(id => parseInt(id.substring(1)))
                                    .filter(n => !isNaN(n));

                                if (existingNums.length > 0) {
                                    currentCounterVal = Math.max(...existingNums);
                                }
                            }
                        } catch (e) {
                            console.warn("Fallback init failed");
                        }
                    }

                    nextNum = currentCounterVal + 1;
                    finalIdToUse = `A${nextNum}`;

                    // Update Counter
                    transaction.set(counterRef, { current: nextNum }, { merge: true });
                }

                finalId = finalIdToUse;

                const finalData = {
                    ...orderData,
                    id: finalIdToUse,
                    status: 'processing',
                    paymentStatus: 'unpaid',
                    createdAt: new Date().toISOString()
                };

                // 3. Create Order
                transaction.set(doc(this.db, "orders", finalIdToUse), finalData);
            });

            const orderResult = { id: finalId, ...orderData };

            // Send Discord Notification (Fire and Forget)
            this.sendDiscordNotification(orderResult).catch(err => console.error("Discord Notification Failed:", err));

            return orderResult;

        } catch (e) {
            console.error("Error adding order transaction: ", e);
            // Don't alert if it's the specific lock error (handled by app.js)
            if (!e.message.includes("ORDERING_CLOSED") && !e.message.includes("PRODUCT_SOLD_OUT") && !e.message.includes("DUPLICATE_ORDER_FOUND") && !e.message.includes("訂單編號重複")) {
                alert("下單失敗，請稍後再試。原因: " + (e.message || "未知錯誤"));
            }
            throw e;
        }
    },

    async sendDiscordNotification(order) {
        try {
            // Debug: Use discord.com and encode URI for better proxy handling
            const targetUrl = "https://discord.com/api/webhooks/1450081622975316074/oLXbBYq-aXZ_jkObEeOWTmwmk8cNOma-Lv0nGitJ27602ELouSOblLHON8T_rRN722jD";
            // Note: corsproxy.io requires the URL to be NOT encoded usually, but let's try straight format first if encoded fails.
            // Actually standard usage is ?<url>. Let's try direct first since previous failed.
            const webhookURL = `https://corsproxy.io/?${targetUrl}`;

            const itemsList = order.items.map(item =>
                `• ${item.name} x${item.quantity} ($${item.price * item.quantity})`
            ).join('\n');

            const embed = {
                title: "🎉 新訂單通知！",
                description: `訂單編號：**${order.id}**`,
                color: 12008779,
                fields: [
                    { name: "👤 訂購人", value: order.name || order.customer?.name || "未知", inline: true },
                    { name: "📞 電話", value: order.phone || order.customer?.phone || "未知", inline: true },
                    { name: "💰 總金額", value: `NT$ ${order.totalAmount || order.totalPrice}`, inline: true },
                    { name: "📋 訂購內容", value: itemsList || "無商品" },
                    { name: "📝 備註", value: order.note || "無" }
                ],
                footer: { text: "合誼年菜自動通知系統" },
                timestamp: new Date().toISOString()
            };

            console.log("Sending Discord Request to Proxy:", webhookURL);

            const res = await fetch(webhookURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [embed] })
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Server Error ${res.status}: ${errText}`);
            }

            // alert("Discord 通知發送成功！ (測試模式)");

        } catch (e) {
            console.error("Discord Notification Error:", e);
            alert("Discord 通知失敗 (Debug): " + e.message);
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

            // if (allOrders.empty) return; // FIX: Don't return, allow reset to 0

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
