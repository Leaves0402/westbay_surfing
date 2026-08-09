# 首頁圖片替換說明

首頁圖片都集中在這個資料夾。正式照片準備好後，使用相同檔名覆蓋即可，
不需要修改 React 元件。

## 檔案用途

- `hero/hero-01.webp` 到 `hero/hero-04.webp`：首頁最上方輪播圖
- `banner.webp`：首頁中段固定背景
- `officers/*.webp`：幹部照片
- `footer.webp`：頁尾背景

## 建議規格

- Hero、Banner、Footer：橫向照片，建議至少 2000px 寬
- 幹部照片：4:5 直向照片，建議至少 800 x 1000px
- 格式：優先使用 WebP，單張建議控制在 500KB 左右
- 檔名：使用英文小寫，不要包含空格

若照片主體被裁切，可調整 `lib/siteContent.ts` 對應圖片的
`objectPosition`，例如 `50% 35%` 會讓畫面顯示較靠上的區域。
