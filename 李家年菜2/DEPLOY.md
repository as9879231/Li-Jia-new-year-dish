# 網站發布指南 (Deployment Guide) - GitHub 安全版

因為您使用 GitHub，我們需要用一個特殊的小技巧來達成 **「前台公開、後台私藏」**。

我們已經幫您建立了一個神奇檔案叫做 `.gitignore`。
它的作用是告訴 Git：**「請忽略 `admin.html`，絕對不要把它上傳到 GitHub。」**

## 🔐 核心安全策略
*   **前台 (`index.html`)**：會被上傳，大家看得到。
*   **後台 (`admin.html`)**：會被 Git 忽略，只留在您的電腦裡。

---

## 🚀 GitHub 上傳步驟

既然已經有了 `.gitignore`，您只需要照平常的方式上傳即可：

1.  開啟您的終端機 (Terminal) 或 Git 軟體。
2.  執行標準的 Git 指令 (如果您習慣用指令的話)：
    ```bash
    git add .
    git commit -m "更新網站，隱藏後台"
    git push
    ```
3.  **檢查**：去您的 GitHub 網頁上看，你會發現檔案列表裡 **沒有** `admin.html`。
    *   這就成功了！駭客在 GitHub 上看不到您的後台檔案。

---

## 🏠 如何管理訂單 (後台)

因為 GitHub 上沒有後台，所以管理方式一樣是「回到自己的電腦」：

1.  在您自己的電腦資料夾中。
2.  找到 `admin.html`。
3.  直接點兩下打開 (使用瀏覽器開啟)。
4.  輸入密碼 (預設 `8888`) 登入。

---

## ⚠️ 如果您之前已經上傳過 admin.html...

如果您在加這個檔案之前，已經把 `admin.html` 上傳到 GitHub 過了，那它還是在歷史紀錄裡。
您需要執行以下指令把它從 GitHub 上「拉下來」：

```bash
git rm --cached admin.html
git commit -m "從遠端移除後台檔案"
git push
```

這樣它就會從 GitHub 消失，但還會保留在您的電腦裡。

---

**總結**：有了 `.gitignore`，您就可以放心地把整個專案 Push 到 GitHub，系統會自動幫您過濾掉敏感的後台檔案。
