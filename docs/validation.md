# 驗證紀錄

驗證日期：2026-09-22。測試直接讀取此 repo 的最終 `index.html`，以 `file://` 開啟，不啟動本機伺服器。

- HTML 大小：982,608 bytes（約 959.6 KiB）。
- HTML SHA-256：`3285f90d15e1c7c845e35ecfcfd338536becad787095b689c376a41b7db11b46`。
- 13 組數值／封裝、30 組跨引擎操作、6 組邊界與備援檢查，全數通過。分組內包含多項 assertions；不將分組數當成涵蓋率百分比。
- Chromium 與 WebKit 均無未捕獲 JavaScript 錯誤、無 HTTP(S) 資源請求、無 KaTeX 排版錯誤。

## 實測環境

| 引擎 | 版本 | 網路隔離 | 結果 |
|---|---|---|---|
| Playwright Chromium | 151.0.7922.34 | offline=true，並攔截全部 HTTP(S) | 15 組通過 |
| Playwright WebKit | 26.4（revision 2251，macOS 14 對應版本） | 攔截全部 HTTP(S) | 15 組通過 |

WebKit 使用相容的 Playwright 1.59.1 驅動。該環境的 `offline=true` 會在開啟 `file://` 前回報內部錯誤，因此改以 HTTP(S) 全部封鎖驗證，並檢查請求紀錄為空。這是驅動驗證範圍的限制；不將 WebKit 自動化結果寫成已測過使用者安裝的 Safari。

## 數值與封裝（13 組）

FFT 與直接卷積比較；最大支援 FFT 的正規化與矩；二項極端機率；物理模型矩；Normal／Gamma CDF 與分位數；種子與 RNG 續接；Monte Carlo 抽樣誤差；n 增四倍時平均 SD 約減半；群組相關變異數；Cauchy 尺度與尾端；離散 CDF 跳躍兩側；無效 PMF 拒絕；單檔外部資源檢查。

## 操作與畫面（每引擎 15 組）

- 首次離線初始化、6 項頁面自檢、公式排版。
- 種子重現、單步、重置、手動暫停與目標完成後數據刷新。
- A 組與新實驗隔離、不同觀察座標及分析圖。
- JSON 保存／載入後沿原 RNG 序列繼續；CSV 列數與 PNG 匯出。
- 五種情境、所有母分布、手繪輸入、完全相關與冷／熱極限。
- 無效控制值、無效匯入檔、n 掃描、普適性畫廊。
- POE 紀錄、AI 提示詞、導覽、展示模式。
- 375／768／1024 px 寬度無水平溢出；另檢查 1440 px 桌面畫面。
- 全流程監測 JavaScript 錯誤與網路請求。

## 邊界與備援（6 組）

1. n=1024、K=512 的最大 FFT 完成；改變參數後沒有沿用舊理論。
2. 零場、零溫未指定路徑的聯合極限被拒絕；UI、參數與模型一起回復。
3. 100,000 次 Cauchy 實驗保留全部尾端：框內 92,127 + 框外 7,873 = 100,000。停止後儀表、可讀表格與分析圖同步至最終數據；測試不手動呼叫渲染函式。
4. A 組快照可完整移除。
5. 順磁體 10,000 次最終畫面、390 px 手機版、執行期間的 reduced-motion 媒體變更。
6. 禁用 Worker 時，有限 n 理論與單步功能仍可運作。

## 證據

- [Chromium 機器可讀紀錄](verification/chromium-report.json)
- [WebKit 機器可讀紀錄](verification/webkit-report.json)
- [邊界檢查紀錄](verification/boundaries-report.json)
- [桌面預覽](preview.png)／[手機預覽](preview-mobile.png)

測試重跑方式見 [README](../README.md#開發驗證使用-demo-不需要執行)。輸出預設寫入已被 Git 忽略的 `test-results/`；此處只保存最終報告與預覽，不包含測試下載的實驗資料。

## 尚未實測

原生 Safari、Firefox、Edge、實體 iPhone／Android，以及低階裝置的長時間效能未實測。響應式測試是桌面引擎的 viewport 驗證，不等同於實機觸控驗證。測試不能保證沒有任何 bug，也不代替助教的最終評分。
