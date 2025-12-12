# 網站發布指南 (Deployment Guide)

這個網站是純靜態網頁 (Static Website)，所以非常容易免費部署到網路上。以下提供兩種最簡單的方法：

## 方法一：使用 Netlify Drop (最簡單，不用寫程式)

適合：想要立刻產生網址分享給朋友，不需要安裝任何軟體。

1.  開啟 [Netlify Drop](https://app.netlify.com/drop) 網站。
2.  打開你的電腦資料夾，找到包含 `index.html` 的專案資料夾。
3.  直接將整個資料夾拖曳到 Netlify 網頁上的虛線框框中。
4.  等待幾秒鐘，網頁就會上線，你會獲得一個隨機的網址 (例如 `brave-curie-123456.netlify.app`)。
5.  你可以點選 "Site settings" -> "Change site name" 來修改網址名稱。

> **注意**：這種方式此後每次修改程式碼，都需要重新拖曳資料夾上去更新。

---

## 方法二：使用 GitHub Pages (推薦，長久經營)

適合：如果你有用 Git 版本控制，這是最標準的做法。

1.  在 GitHub 上建立一個新的儲存庫 (Repository)。
2.  將你的程式碼上傳 (Push) 到該儲存庫。
3.  進入儲存庫的 **Settings** (設定) > **Pages**。
4.  在 **Build and deployment** 下的 **Source** 選擇 `Deploy from a branch`。
5.  在 **Branch** 選擇 `main` (或 `master`) 並儲存。
6.  幾分鐘後，你的網站就會在 `https://你的帳號.github.io/儲存庫名稱/` 上線。

## 關於資料儲存的提醒

目前你的網站使用的是瀏覽器的 **localStorage** 來儲存訂單資料。
這意味著：
*   **A 用戶** 在他的電腦下單，**B 管理員** 在另一台電腦的後台是**看不到**的。
*   所有的訂單資料只存在於使用者的那台電腦/手機上。

如果你需要真的能「收單」的功能 (讓老闆能看到客戶的訂單)，我們需要：
1.  建立一個真正的後端資料庫 (如 Firebase, Supabase, 或自己的伺服器)。
2.  修改 `assets/store.js` 將資料存到雲端，而不是 `localStorage`。

目前的版本適合作為 **作品集展示** 或 **單機版演示**。
