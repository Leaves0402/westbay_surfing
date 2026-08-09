# 西灣衝浪社內部網站

## 專案簡介

這是西灣衝浪社的內部管理網站，用於社員登入、社員資料管理、租板時段管理、公告、揪外衝、社課報名與簽到等功能。

網站主要提供社團內部使用，透過 Google Login 與 Supabase 管理會員資料與權限。

正式網址：https://westbay-surfing.vercel.app/

---

## 技術架構

- Frontend：Next.js
- Database / Auth：Supabase
- Deployment：Vercel
- Version Control：GitHub
- Login：Google Login

---

## 主要功能

### 1. 社員登入與權限

- Google 登入
- 社員基本資料
- 角色權限：
  - 管理員 admin
  - 幹部 officer
  - 板務 board_manager
  - 社員 member
- 待審核社員管理
- 社員名單管理
- 衝浪程度管理
- 站主帳號永久保留管理員身分
- 站主之外最多三位管理員，只有管理員可授予或移除管理員
- 幹部可查看程度申請通知，只有管理員可審核；進階核准後自動晉升管理員

### 2. 租板系統

- 新增租板時段
- 租板日曆
- 時段詳細資料
- 社員登記租板
- 租板名單
- 租板未繳費管理
- 未繳費提醒與限制

### 3. 公告系統

- 新增公告
- 公告列表
- 幹部 / 管理員可新增、編輯、刪除公告

### 4. 揪外衝系統

- 新增外衝活動
- 浪點多選與搜尋
- 新增浪點
- 外衝車隊
- 跟車功能
- 車長功能
- 外衝聊天室
- 外衝備取機制
- 外衝開始時鎖定車隊名單並累計社員參加次數
- 已結束外衝保留三天後自動清理

### 5. 社課系統

- 新增社課
- 社課報名
- 社課備取
- 社課取消
- 社課簽到
- 候補社員需先依序正式遞補，成為正取後才能簽到
- 教學出席統計
- 社員出席統計
- 個人檔案社課出席紀錄

### 6. 系統維護資訊

- 系統維護與聯絡頁面
- 維護人聯絡資料
- 技術架構與維護注意事項

---

## 本機開發

```bash
npm install
npm run dev
```

開啟：

```text
http://localhost:3000
```

---

## Build 測試

```bash
npm run lint
npm run typecheck
npm run build
```

推送前請先確認 lint、型別檢查與 build 都通過。

---

## 環境變數

請在專案根目錄建立 `.env.local`，並設定以下變數（不要寫入實際值）：

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

注意：

- 不要把 `.env.local` commit 到 GitHub。
- 不要把 service_role key 放在前端。
- 不要公開任何 secret。

---

## 資料庫 SQL

資料庫相關 SQL 放在：

```text
docs/sql/
```

執行 SQL 時請到 Supabase SQL Editor。

既有資料庫更新到本版本時，請在原有 SQL 都已執行後，再執行：

```text
docs/sql/apply_priority_fixes_and_surf_trip_stats.sql
docs/sql/apply_medium_priority_improvements.sql
docs/sql/add_navigation_badges.sql
```

請依上列順序執行。第一個檔案會新增外衝計次資料、三日保留規則，以及課程／衝浪板／權限相關 RPC；第二個檔案會加入管理員上限與站主保護、程度審核權限、正式遞補，以及範圍／聚合查詢；第三個檔案會新增公告與社課的小紅點閱讀狀態。站主會以 `tom.yeh.940402@gmail.com` 對應的 profile 設定，找不到時 SQL 會停止，不會套用錯誤帳號。

外衝 lifecycle 會在環境允許時自動建立每小時排程；若無法啟用 `pg_cron`，開啟外衝頁或社員名單頁仍會自動處理。

修改資料庫前請先確認：

- 是否會刪除既有資料
- 是否需要 on delete cascade
- 是否會影響 RLS policy
- 是否需要先備份

---

## 部署

目前使用 Vercel 部署。

一般流程：

```bash
git add .
git commit -m "描述本次修改"
git push
```

Vercel 會自動偵測 GitHub 分支並部署。

`main` 分支視為正式部署分支。

---

## Git 工作流程

建議流程：

1. 從 `main` 建立功能分支。
2. 在功能分支修改。
3. 執行 `npm run build`。
4. push 到 GitHub。
5. 確認 Vercel build 通過。
6. 建立 PR 或 merge 回 `main`。

遇到遠端分支不同步時：

```bash
git fetch origin
git pull --rebase origin <branch-name>
```

遇到 conflict 時，先解 conflict，再：

```bash
git add .
git commit
git push
```

---

## 維護聯絡

主要維護人：葉宗庭  
身分：116 中山大學光電系，第二屆衝浪社幹部

Email：tom.yeh.940402@gmail.com  
手機：0965594620

可聯絡事項：

- 網站 bug
- 權限調整
- 資料庫問題
- 部署問題
- 功能新增
