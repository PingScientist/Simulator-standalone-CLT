# 評分對照

依使用者提供的作業圖片及助教 `proof/4.html`：四項各 0.5 分，Yes / No 判定。本表提供驗收位置，不代替助教評分。

| 項目 | 可直接操作的證據 |
|---|---|
| 清楚展示 CLT | 自由分布選偏態或雙峰，切換 n=1、16、64、256；標準化直方圖、有限 n 曲線與常態參考 |
| 具體例子 | 雙態 ±1 的獨立抽樣、二項分布；另有兩骰卷積放大鏡 |
| 物理世界連結 | 順磁體：E=−hs、Boltzmann 權重與磁化波動；隨機漫步：位移總和與擴散 |
| 正常與流暢操作 | 單一離線 HTML、播放／暫停／單步／重置、輸入防護、分段計算、跨引擎操作測試 |

## 單檔門檻

提交 `index.html` 即可。測試以 file:// 開啟，Chromium 設定 offline=true，WebKit 封鎖全部 HTTP(S)；兩者皆記錄並確認沒有外部資源請求，詳見驗證紀錄。KaTeX WOFF2 字型與 Chart.js 已內嵌。

## 通用 prompt 的適配

四分頁、POE、PBL 核心問題、Canvas、requestAnimationFrame、simState、統計降頻與 sanity checks 均有對應實作。

兩個有意的調整：為滿足完整離線，使用內嵌資源與原生 CSS，沒有 Tailwind CDN；因 CLT 是機率抽樣與卷積問題，沒有強行加入 Euler／Verlet。這兩點在 README 明示。
