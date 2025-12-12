# Firebase 資料庫申請教學 (Firebase Setup Guide)

這份指南會教你如何申請免費的 Google Firebase 資料庫，並取得我們需要的設定檔。

## 步驟 1：建立專案
1.  登入你的 Google 帳號。
2.  前往 [Firebase Console (控制台)](https://console.firebase.google.com/)。
3.  點選 **"新增專案" (Create a project)**。
4.  輸入專案名稱（例如：`li-family-dishes`），並點選繼續。
5.  Google Analytics (分析) 可以選擇 **不啟用**，然後點選 **"建立專案"**。
6.  等待幾秒鐘，看到 "你的新專案已準備就緒" 後，點選 **"繼續"**。

## 步驟 2：建立 Firestore 資料庫
1.  進入專案後，在左側選單點選 **"建構" (Build)** -> **"Firestore Database"**。
2.  點選畫面中間的 **"建立資料庫" (Create database)**。
3.  **位置設定**：選擇 `asia-east1` (台灣) 或預設值，點選 **"下一步"**。
4.  **安全規則**：
    *   選擇 **"以測試模式啟動" (Start in test mode)**。
    *   *(這很重要！這樣我們才能不用登入就寫入訂單，測試模式通常有 30 天期限，之後我們可以再教你怎麼改規則)*。
    *   點選 **"啟用" (Enable)**。

## 步驟 3：取得網頁設定檔 (Config)
1.  點選左上角的 **"專案總覽" (Project Overview)** 旁邊的齒輪圖示 ⚙️ -> **"專案設定" (Project settings)**。
2.  滑到最下方的 **"您的應用程式" (Your apps)** 區塊。
3.  點選 **`</>` (Web)** 的圖示。
4.  **註冊應用程式**：輸入暱稱（例如：`web-shop`），**不要**勾選 "Firebase Hosting"，點選 **"註冊應用程式"**。
5.  你會看到一段程式碼 `const firebaseConfig = { ... };`。
6.  **請複製 `const firebaseConfig = { ... };` 這一段花括號內的內容**。
    *   它看起來會像這樣：
    ```javascript
    const firebaseConfig = {
      apiKey: "AIzaSyB...",
      authDomain: "...",
      projectId: "...",
      storageBucket: "...",
      messagingSenderId: "...",
      appId: "..."
    };
    ```
7.  把這段資訊貼給我，或者等我把程式碼準備好後，你自己貼進去。

完成以上步驟，你就擁有一個免費且強大的雲端資料庫了！
