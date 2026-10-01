export type AppLocale = "zh-Hant" | "en";

export const DEFAULT_LOCALE: AppLocale = "zh-Hant";
export const LOCALE_STORAGE_KEY = "westbay-surf-club-locale";

/**
 * System-owned interface copy. Member names, surfboard names and content
 * entered by users intentionally do not belong in this dictionary.
 */
const englishUiText: Record<string, string> = {
  // Global navigation and authentication
  "開啟選單": "Open menu",
  "開啟選單（有待查看項目）": "Open menu (items need attention)",
  "關閉選單": "Close menu",
  "主要選單": "Main menu",
  "功能選單": "Feature menu",
  "公開功能": "Public",
  "社員功能": "Members",
  "幹部管理": "Staff",
  "首頁": "Home",
  "社團介紹與最新樣貌": "Club introduction and latest updates",
  "租板": "Board Rental",
  "查看租板時段並登記": "View rental sessions and register",
  "查看公開租板時段與名額": "View public rental sessions and availability",
  "基本資料": "Profile",
  "姓名、學號與衝浪程度": "Name, student ID and surfing level",
  "基本資料尚未完成": "Profile is incomplete",
  "社課": "Club Lessons",
  "查看社課、報名與候補": "View lessons, register or join the waitlist",
  "有新社課": "New lesson available",
  "公告": "Announcements",
  "社團公告與活動訊息": "Club announcements and event updates",
  "有新公告": "New announcement",
  "揪外衝": "Surf Trips",
  "外衝活動、浪點與車隊": "Surf trips, spots and carpools",
  "社員名單": "Member List",
  "正式成員與衝浪程度": "Confirmed members and surfing levels",
  "社課簽到": "Lesson Attendance",
  "教學與社員出席管理": "Lesson and member attendance management",
  "系統維護與聯絡": "Maintenance & Contact",
  "架構說明與維護聯絡方式": "System information and maintenance contact",
  "未填姓名": "Name not provided",
  "讀取身分中...": "Loading role...",
  "登出": "Log out",
  "Google 登入": "Sign in with Google",
  "登入後會自動建立社員資料，預設身分為待審核，需由幹部或管理員審核。":
    "A member profile will be created automatically after sign-in. New accounts require staff approval.",
  "切換成英文": "Switch to English",
  "切換成中文": "Switch to Chinese",

  // Shared labels and statuses
  "待審核": "Pending",
  "社員": "Member",
  "板務": "Board Manager",
  "幹部": "Officer",
  "管理員": "Admin",
  "站主": "Site Owner",
  "初階": "Beginner",
  "中階": "Intermediate",
  "中進階": "Upper-intermediate",
  "進階": "Advanced",
  "未填寫": "Not provided",
  "未知": "Unknown",
  "不限制": "No restriction",
  "全部": "All",
  "是": "Yes",
  "否": "No",
  "無": "None",
  "未指定": "Not specified",
  "姓名": "Name",
  "學號": "Student ID",
  "電話": "Phone",
  "聯絡電話": "Contact phone",
  "電子郵件": "Email",
  "衝浪程度": "Surfing level",
  "程度": "Level",
  "身分": "Role",
  "狀態": "Status",
  "操作": "Actions",
  "備註": "Notes",
  "說明": "Description",
  "標題": "Title",
  "內容": "Content",
  "日期": "Date",
  "時間": "Time",
  "開始時間": "Start time",
  "結束時間": "End time",
  "名額": "Capacity",
  "目前程度": "Current level",
  "申請程度": "Requested level",
  "目前：": "Current:",
  "申請：": "Requested:",
  "建立時間": "Created",
  "更新時間": "Updated",
  "重新整理": "Refresh",
  "搜尋": "Search",
  "篩選": "Filter",
  "清除篩選": "Clear filters",
  "儲存": "Save",
  "儲存中...": "Saving...",
  "新增": "Add",
  "新增中...": "Adding...",
  "編輯": "Edit",
  "修改": "Edit",
  "刪除": "Delete",
  "移除": "Remove",
  "移除中...": "Removing...",
  "取消": "Cancel",
  "關閉": "Close",
  "確認": "Confirm",
  "處理中...": "Processing...",
  "讀取中...": "Loading...",
  "送出": "Submit",
  "送出中": "Submitting",
  "核准": "Approve",
  "拒絕": "Reject",
  "返回": "Back",
  "下一步": "Next",
  "上一步": "Back",
  "完成": "Done",
  "成功": "Success",
  "已選擇": "Selected",
  "可選擇": "Available",
  "程度不足": "Level too low",
  "尚未登入": "Not signed in",
  "正在讀取登入狀態...": "Checking sign-in status...",
  "請先登入。": "Please sign in first.",

  // Home
  "查看租板時段": "View Rental Sessions",
  "查看我的資料": "View My Profile",
  "編輯 Hero": "Edit Hero",
  "你可以直接編輯首頁的文字、照片與幹部介紹。":
    "You can edit homepage text, photos and officer profiles directly.",
  "編輯首頁": "Edit Homepage",
  "關於我們": "About Us",
  "社團幹部": "Club Officers",
  "照片待補": "Photo coming soon",
  "聯絡我們": "Contact Us",
  "追蹤 Instagram": "Follow us on Instagram",
  "地址": "Address",
  "編輯此區塊": "Edit this section",
  "完成編輯": "Finish Editing",
  "取消編輯": "Cancel Editing",
  "發布變更": "Publish Changes",
  "尚未儲存": "Unsaved",
  "中山大學西子灣旁的衝浪社團。租板、社課、外衝，一起把週末交給海。":
    "A surfing club beside Sizihwan at NSYSU. Rent boards, join lessons and explore new breaks with us.",
  "關於西灣衝浪社": "About West Bay Surf Club",
  "我們是國立中山大學的西灣衝浪社。社團就在西子灣旁邊，從教室走到海邊只要幾分鐘，不管是第一次下水還是已經有自己的板子，都可以找到一起衝浪的人。":
    "We are West Bay Surf Club at National Sun Yat-sen University, just minutes from the sea at Sizihwan. Whether it is your first time in the water or you already own a board, you will find people to surf with.",
  "社團提供社板租借、社課教學與週末外衝，由幹部與板務一起維護器材與安全，讓新手可以安心從頭學起。":
    "The club offers board rentals, lessons and weekend surf trips. Our officers and board managers maintain the equipment and help beginners learn safely from the start.",
  "社板租借": "Club Board Rentals",
  "線上查看租板時段與剩餘名額，登入後挑選適合自己的板子。":
    "Check rental sessions and availability online, then sign in to choose a suitable board.",
  "社課教學": "Club Lessons",
  "從基本觀念、起乘到看浪選浪，由社團教學帶著練習。":
    "Learn fundamentals, pop-ups, reading waves and wave selection with club instructors.",
  "週末外衝": "Weekend Surf Trips",
  "一起揪車去外地浪點，跟車、車隊與行程都在網站上安排。":
    "Carpool to surf spots outside Kaohsiung and organize seats, cars and schedules on the website.",
  "有浪就下水，沒浪就一起等浪": "Surf when there are waves; wait together when there are not.",
  "西子灣的浪不大，但我們每個週末都在海邊。":
    "Sizihwan may not have big waves, but we are by the sea every weekend.",
  "社長": "President",
  "副社長": "Vice President",
  "社師": "Club Advisor",
  "總務": "Treasurer",
  "器材": "Equipment",
  "活動": "Events",
  "網管": "Web Admin",
  "負責社團整體運作、對外聯絡與活動規劃。":
    "Oversees club operations, external communication and event planning.",
  "協助社務推動，統籌社課與社員事務。":
    "Supports club operations and coordinates lessons and member affairs.",
  "管理社上衝浪板、租板時段與器材維護。":
    "Manages club surfboards, rental sessions and equipment maintenance.",
  "規劃揪外衝、社遊與各項社團活動。":
    "Plans surf trips, club outings and other activities.",
  "國立中山大學西灣衝浪社，社員可登入使用租板、社課與外衝功能。":
    "West Bay Surf Club at National Sun Yat-sen University. Members can sign in to use board rentals, lessons and surf trips.",

  // Profile
  "社員基本資料": "Member Profile",
  "填寫姓名、學號與衝浪程度，儲存後即可送出審核。":
    "Enter your name, student ID and surfing level, then save your profile.",
  "姓名與學號尚未填寫完成": "Name and student ID are incomplete",
  "姓名與學號填寫完成後，首頁與選單上的提醒紅點就會消失。":
    "The reminder dot will disappear after you save your name and student ID.",
  "姓名 *": "Name *",
  "學號 *": "Student ID *",
  "社課出席": "Lesson attendance",
  "次": "times",
  "儲存基本資料": "Save Profile",
  "儲存資料中...": "Saving profile...",
  "程度申請": "Level Request",
  "申請進階程度": "Request a Higher Level",
  "等待管理員審核": "Awaiting admin review",

  // Announcements and lessons
  "社團公告": "Club Announcements",
  "查看社團最新公告與活動資訊。": "View the latest club announcements and event updates.",
  "新增公告": "New Announcement",
  "編輯公告": "Edit Announcement",
  "公告列表": "Announcements",
  "目前沒有公告": "No announcements yet",
  "目前沒有公告。": "No announcements yet.",
  "公告標題": "Announcement title",
  "公告內容": "Announcement content",
  "公告照片（選填）": "Announcement photo (optional)",
  "新增照片": "Add photo",
  "更換照片": "Replace photo",
  "移除照片": "Remove photo",
  "公告照片預覽": "Announcement photo preview",
  "支援 JPG、PNG、WebP 與 GIF，每張最大 5 MB。":
    "JPG, PNG, WebP and GIF are supported, up to 5 MB per image.",
  "發布公告": "Publish Announcement",
  "更新公告": "Update Announcement",
  "發布中...": "Publishing...",
  "更新中...": "Updating...",
  "刪除公告": "Delete announcement",
  "社課列表": "Club Lessons",
  "查看社課、報名、候補與簽到資訊。": "View lessons, registration, waitlists and attendance.",
  "新增社課": "New Lesson",
  "社課名稱": "Lesson name",
  "社課日期": "Lesson date",
  "社課時間": "Lesson time",
  "教練": "Instructor",
  "報名人數": "Registrations",
  "候補人數": "Waitlist",
  "已報名": "Registered",
  "已候補": "Waitlisted",
  "報名": "Register",
  "取消報名": "Cancel registration",
  "加入候補": "Join waitlist",
  "取消候補": "Leave waitlist",
  "候補已滿": "Waitlist full",
  "社課已額滿": "Lesson full",
  "目前沒有社課。": "No lessons yet.",
  "查看名單": "View roster",
  "報名名單": "Registration roster",
  "候補名單": "Waitlist",

  // Attendance
  "社課出席管理": "Lesson Attendance",
  "建立社課、安排教學人員並管理社員簽到。":
    "Create lessons, assign instructors and manage member attendance.",
  "新增社課紀錄": "Add Lesson Record",
  "簽到名單": "Attendance Roster",
  "已簽到": "Checked in",
  "未簽到": "Not checked in",
  "全選": "Select all",
  "取消全選": "Clear selection",
  "儲存簽到": "Save Attendance",
  "出席人數": "Attendance",
  "教學人員": "Instructors",

  // Rentals
  "租板時段": "Board Rental Sessions",
  "查看公開時段、名額與最低程度，並登記租板。":
    "View public sessions, availability and minimum level, then register for a board.",
  "租板日曆": "Rental Calendar",
  "時段公開資訊": "Session Information",
  "請從日曆選擇一個租板時段查看時間、名額與最低程度。":
    "Select a rental session on the calendar to view its time, availability and minimum level.",
  "登記租板": "Register for a Board",
  "取消登記": "Cancel Registration",
  "登記名單": "Registration Roster",
  "編號": "No.",
  "繳費": "Payment",
  "衝浪板": "Surfboard",
  "未繳": "Unpaid",
  "已繳": "Paid",
  "空位": "Available",
  "最低程度": "Minimum level",
  "已額滿": "Full",
  "尚有名額": "Spots available",
  "衝浪板管理": "Surfboard Management",
  "新增衝浪板": "Add Surfboard",
  "編輯衝浪板": "Edit Surfboard",
  "板型": "Board type",
  "適合程度": "Suitable level",
  "浮力": "Volume",
  "長度": "Length",
  "圖片": "Images",
  "軟板": "Softboard",
  "硬板": "Hardboard",
  "長板": "Longboard",
  "短板": "Shortboard",
  "中長板": "Mid-length",
  "挑選你想要的板子": "Choose a Surfboard",
  "衝浪板詳細資料": "Surfboard Details",
  "返回挑板列表": "Back to board list",
  "返回挑板": "Back to boards",
  "篩選板型": "Filter board type",
  "依板型篩選": "Filter by board type",
  "關閉挑板視窗": "Close board picker",
  "選擇這張衝浪板": "Choose this surfboard",
  "已選擇這張衝浪板": "This surfboard is selected",
  "正在讀取衝浪板資料...": "Loading surfboards...",
  "目前沒有可挑選的衝浪板，請聯絡幹部或管理員新增衝浪板。":
    "No surfboards are available. Please ask an officer or admin to add one.",
  "沒有符合目前板型篩選的衝浪板，請調整或清除篩選。":
    "No surfboards match the current filter. Adjust or clear the filter.",
  "點擊卡片可查看詳細資料，並在詳細資料中選擇這張衝浪板。":
    "Select a card to view details and choose that surfboard.",
  "目前選擇：": "Current selection:",
  "尚未選擇衝浪板": "No surfboard selected",
  "確認登記租板": "Confirm Rental",
  "你的衝浪程度尚未達到此板子的適合程度":
    "Your surfing level does not meet this board's requirement",
  "此時段已被選擇": "Already selected for this session",
  "非社員租板": "Guest Board Rental",
  "非社員租板說明": "Guest Rental Terms",
  "我已閱讀並同意以上租板規則": "I have read and agree to the rental terms above",
  "填寫基本資料": "Enter Contact Details",
  "確認資料與租板": "Review Rental",
  "費用": "Fee",
  "付款方式": "Payment method",
  "現金或轉帳": "Cash or bank transfer",
  "預約編號": "Reservation number",
  "登記成功": "Reservation Confirmed",
  "查詢或取消預約": "Find or Cancel a Reservation",
  "查詢預約": "Find Reservation",
  "取消預約": "Cancel Reservation",
  "姓名（必填）": "Name (required)",
  "聯絡電話（必填）": "Contact phone (required)",
  "備註（選填）": "Notes (optional)",

  // Trips
  "正式成員可以發起外衝、新增車長，並在車廂中跟車。":
    "Confirmed members can create surf trips, add drivers and join carpools.",
  "新增外衝": "Create Surf Trip",
  "出發日期": "Departure date",
  "回程日期": "Return date",
  "地點": "Location",
  "可複選、搜尋，也可新增浪點": "Select multiple, search or add a surf spot",
  "人數上限": "Passenger limit",
  "程度限制": "Level requirement",
  "外衝列表": "Surf Trips",
  "目前沒有外衝活動": "No surf trips yet",
  "已開始，車隊名單已完成外衝計次": "Started — trip counts have been recorded",
  "聊天室": "Chat",
  "外衝聊天室": "Trip Chat",
  "輸入訊息...": "Type a message...",
  "目前還沒有訊息。": "No messages yet.",
  "外衝車隊": "Trip Carpool",
  "車長": "Driver",
  "跟車": "Join car",
  "已跟車": "Joined",
  "取消跟車": "Leave car",
  "新增車長": "Add Driver",
  "目前還沒有車隊。": "No cars yet.",
  "加入備取": "Join waitlist",
  "備取已滿": "Waitlist full",
  "目前沒有備取。": "No one is waitlisted.",
  "移除活動": "Remove Trip",
  "浪點": "Surf spot",
  "新增浪點": "Add Surf Spot",
  "浪點名稱": "Surf spot name",
  "縣市": "City / County",

  // Members/admin and maintenance
  "正式成員列表": "Confirmed Members",
  "額外管理員名額": "Additional admin slots",
  "搜尋社員姓名": "Search member names",
  "外衝次數": "Surf trips",
  "目前沒有正式成員資料。": "No confirmed member data.",
  "找不到符合條件的社員。": "No matching members.",
  "待審核名單": "Pending Members",
  "搜尋姓名、學號或 Email": "Search name, student ID or email",
  "目前沒有待審核社員": "No pending members",
  "目前沒有待審核社員。": "No pending members.",
  "一鍵審核": "Approve All",
  "審核中...": "Approving...",
  "核准成為社員": "Approve as Member",
  "程度審核": "Level Reviews",
  "目前沒有程度審核申請。": "No pending level requests.",
  "等待管理員處理": "Awaiting admin action",
  "系統維護": "System Maintenance",
  "系統架構": "System Architecture",
  "資料庫": "Database",
  "前端": "Frontend",
  "部署": "Deployment",
  "維護聯絡": "Maintenance Contact",

  // Rental availability, member rental and guest rental details
  "公開頁面可查看時段與遮罩名單；未登入的非社員也能依初階限制登記租板。":
    "Public visitors can view sessions and masked rosters. Guests can register under beginner-level restrictions.",
  "社員以上可以查看與登記；板務、幹部與管理員可以新增、開關、刪除時段並管理繳費狀態。":
    "Confirmed members can view and register. Board managers, officers and admins can manage sessions and payments.",
  "非社員也可以登記租板": "Guests Can Rent Surfboards",
  "不需 Google 登入。非社員一律視為初階，費用每次 200 元；完成閱讀說明、填寫聯絡資料並選板後即可登記。":
    "No Google sign-in is required. Guests are treated as beginners and pay NT$200 per rental. Read the terms, enter your contact details and choose a board to register.",
  "待審核帳號目前只能查看公開時段。若要使用非社員流程，請先登出；審核通過後可使用社員租板功能。":
    "Pending accounts can only view public sessions. Log out to use guest rental, or wait for approval to use member rental.",
  "等待社員審核中": "Membership Approval Pending",
  "非社員固定為初階，無法登記最低程度較高的時段。":
    "Guests are treated as beginners and cannot register for higher-level sessions.",
  "公開名單只顯示遮罩姓名，不顯示社員學號或非社員電話。":
    "The public roster shows masked names only. Student IDs and guest phone numbers are hidden.",
  "點擊日期格中的時段查看名額與登記狀況。":
    "Select a session on the calendar to view availability and registration status.",
  "點擊日期格中的時段查看詳細資料。":
    "Select a session on the calendar to view details.",
  "這個月份尚未建立租板時段，可切換月份後再查看。":
    "No rental sessions have been created for this month. Try another month.",
  "目前沒有租板時段": "No rental sessions",
  "上個月": "Previous month",
  "下個月": "Next month",
  "正在讀取租板時段...": "Loading rental sessions...",
  "正在讀取租板資料...": "Loading rental data...",
  "時段詳細資料": "Session Details",
  "開放狀態": "Availability",
  "開放中": "Open",
  "未開放": "Closed",
  "已關閉": "Closed",
  "已過期": "Expired",
  "此時段已額滿。": "This session is full.",
  "此時段目前未開放登記。": "Registration is closed for this session.",
  "此租板時段已過期，無法登記。": "This rental session has expired.",
  "你的衝浪程度尚未符合此時段最低要求。":
    "Your surfing level does not meet this session's minimum requirement.",
  "日期：": "Date:",
  "學號／電話": "Student ID / Phone",
  "學號：": "Student ID:",
  "電話：": "Phone:",
  "電話已刪除": "Phone deleted",
  "未填學號": "Student ID not provided",
  "未繳費": "Unpaid",
  "已繳費": "Paid",
  "未付款的人": "Unpaid rentals",
  "目前沒有未繳費紀錄": "No unpaid rentals",
  "租板未繳費資訊": "Outstanding Rental Payments",
  "您目前租板未繳費": "Your unpaid rentals",
  "補繳": "Payment received",
  "標記補繳": "Mark as paid",
  "確認此筆租板費用已補繳？": "Confirm that this rental has been paid?",
  "繳費狀態已更新。": "Payment status updated.",
  "已標記補繳。": "Marked as paid.",
  "負責人": "Coordinator",
  "負責人載入中": "Loading coordinator",
  "負責人名單載入中...": "Loading coordinators...",
  "未指定負責人": "No coordinator assigned",
  "負責板務": "Board manager",
  "負責板務：": "Board manager:",
  "最低衝浪程度": "Minimum surfing level",
  "不能選擇今天以前的日期": "Past dates cannot be selected",
  "租板開始時間必須晚於目前時間。": "The rental start time must be in the future.",
  "結束時間必須晚於開始時間。": "The end time must be later than the start time.",
  "人數上限必須是大於 0 的整數。": "Capacity must be a positive whole number.",
  "請填寫開始與結束時間。": "Enter a start and end time.",
  "請選擇日期。": "Select a date.",
  "請選擇負責人。": "Select a coordinator.",
  "新增租板時段": "Add Rental Session",
  "租板時段已新增。": "Rental session added.",
  "租板時段已開放。": "Rental session opened.",
  "租板時段已關閉。": "Rental session closed.",
  "租板時段已刪除。": "Rental session deleted.",
  "確定要刪除這個租板時段嗎？": "Delete this rental session?",
  "請先登入後再登記租板。": "Sign in before registering for a board.",
  "取消我的登記": "Cancel My Registration",
  "已取消登記。": "Registration cancelled.",
  "已登記租板。": "Board rental registered.",
  "登記中...": "Registering...",
  "刪除中...": "Deleting...",
  "例如集合地點、浪況提醒或其他注意事項":
    "For example: meeting point, surf conditions or other notes",
  "時段": "Session",
  "新台幣": "NT$",
  "元": "NTD",
  "元（領板時現金或轉帳）": "NTD (cash or bank transfer at pickup)",
  "非社員": "Guest",
  "非社員（資料已刪除）": "Guest (personal data deleted)",
  "非社員租板登記成功": "Guest Rental Confirmed",
  "租板登記成功": "Rental Confirmed",
  "填寫租板資料": "Enter Rental Details",
  "確認租板資料": "Review Rental Details",
  "挑選衝浪板": "Choose a Surfboard",
  "重新挑板": "Choose Another Board",
  "選好，查看最終摘要": "Continue to Review",
  "繼續填寫資料": "Continue",
  "返回說明": "Back to Terms",
  "登記完成": "Reservation Complete",
  "步驟 1／4": "Step 1 of 4",
  "步驟 2／4": "Step 2 of 4",
  "步驟 4／4": "Step 4 of 4",
  "你已閱讀到說明最下方。": "You have reached the end of the terms.",
  "請先將說明捲動到最下方。": "Scroll to the end of the terms first.",
  "我已完整閱讀並同意上述非社員租板說明。":
    "I have read and agree to all guest rental terms above.",
  "我確認自己已年滿 18 歲。": "I confirm that I am at least 18 years old.",
  "請確認你已年滿 18 歲。非社員租板不開放未成年人。 ":
    "Confirm that you are at least 18 years old. Guest rental is not available to minors.",
  "非社員租板每次費用為新台幣": "Each guest rental costs NT$",
  "若因使用不當造成器材損壞或遺失，經社團確認後，衝浪板為 3,000 元、板鰭為 500 元、腳繩為 800 元；整套遺失合計 4,300 元。也可補交相同款式及相當狀況的器材。正常使用刮痕不在此限。":
    "If equipment is damaged or lost through misuse, the confirmed replacement charges are NT$3,000 for the board, NT$500 for fins and NT$800 for the leash (NT$4,300 total for a complete loss). Equivalent replacement equipment is also accepted. Normal scratches are excluded.",
  "請於租板時段開始時準時至社辦領取，無法提早領板，並於時段結束前完成歸還。社辦地址：":
    "Pick up the board at the club room exactly when the rental session begins; early pickup is not available. Return it before the session ends. Club room address:",
  "。若不清楚領取方式，請提前聯絡西灣衝浪社 Instagram；連結位於首頁最下方。":
    ". If you are unsure about pickup, contact the club on Instagram in advance. The link is at the bottom of the homepage.",
  "本服務僅提供器材租借，不包含衝浪教學、陪同、救生、保險或其他安全保障。請自行評估天候、浪況、場地與個人能力，並自行承擔下水風險。":
    "This service provides equipment rental only. It does not include instruction, supervision, rescue, insurance or other safety coverage. Assess the weather, surf, location and your own ability, and assume all risks of entering the water.",
  "領取時請與社團人員共同確認板況；若發現既有損傷，應在下水前立即提出。":
    "Inspect the board with club staff at pickup and report any existing damage before entering the water.",
  "聯絡電話用於租板聯絡、付款與器材歸還處理。未登入訪客看不到電話；已登入的正式社員與工作人員可在該時段名單中查看，以利辨識及聯絡。":
    "Your phone number is used for rental contact, payment and equipment return. It is hidden from public visitors; signed-in confirmed members and staff can view it on the session roster for identification and contact.",
  "非社員租板僅開放年滿 18 歲者。已付款的非社員資料會在租板時段結束 24 小時後刪除姓名、電話與備註，只保留匿名化租板與付款紀錄。":
    "Guest rental is available only to adults aged 18 or older. For paid rentals, the guest's name, phone and notes are deleted 24 hours after the session ends; only anonymized rental and payment records remain.",
  "同一電話同時只能保留一筆有效預約。登記成功後請保存預約編號；可用電話與預約編號查詢，並於開始前至少 24 小時自行取消。超過期限請聯絡 Instagram。":
    "Only one active reservation is allowed per phone number. Save your reservation number. Use it with your phone number to look up the booking or cancel at least 24 hours before the session; after that, contact us on Instagram.",
  "非社員一律視為初階，只能選擇初階衝浪板。":
    "Guests are treated as beginners and may choose beginner boards only.",
  "非社員不需自評程度，系統一律以初階限制時段與板子。":
    "Guests do not self-assess their level. Beginner restrictions apply to both sessions and boards.",
  "衝浪程度：初階（固定）": "Surfing level: Beginner (fixed)",
  "請填寫真實姓名": "Enter your legal name",
  "例如 0912-345-678": "For example: 0912-345-678",
  "例如領板聯絡事項": "For example: pickup contact notes",
  "可輸入空格或連字號，系統會自動整理。":
    "Spaces and hyphens are allowed and will be normalized automatically.",
  "按下確認後才會一次占用名額與板子。成功畫面會顯示預約編號，請務必保存。":
    "Your spot and board are reserved together only after confirmation. Save the reservation number shown on the success screen.",
  "請準時於時段開始時至社辦領板，並在時段結束前歸還。":
    "Pick up your board at the session start time and return it before the session ends.",
  "請保存「電話＋預約編號」。之後查詢或取消時兩者缺一不可；系統不會再顯示這組編號。":
    "Save both your phone number and reservation number. Both are required to look up or cancel the reservation, and the number will not be shown again.",
  "複製預約編號": "Copy reservation number",
  "已複製": "Copied",
  "查詢／取消非社員預約": "Find / Cancel a Guest Reservation",
  "使用登記時的電話與預約編號查詢。開始前至少 24 小時可自行取消；之後請聯絡 Instagram。":
    "Use the phone number and reservation number from registration. You can cancel at least 24 hours before the session; after that, contact us on Instagram.",
  "請填寫登記時的電話與預約編號。":
    "Enter the phone number and reservation number used for registration.",
  "查詢中...": "Searching...",
  "查無預約，請確認電話與預約編號是否正確。":
    "No reservation was found. Check the phone number and reservation number.",
  "取消這筆預約": "Cancel This Reservation",
  "確定要取消這筆非社員租板預約嗎？": "Cancel this guest rental reservation?",
  "預約已取消，名額與衝浪板已釋出。":
    "Reservation cancelled. The spot and surfboard are now available.",
  "已不足開始前 24 小時，無法自行取消；請聯絡西灣衝浪社 Instagram。":
    "This reservation is less than 24 hours from the start time and cannot be cancelled online. Contact the club on Instagram.",
  "衝浪板／程度": "Surfboard / Level",
  "讀取板子中...": "Loading boards...",
  "重新讀取衝浪板": "Reload Surfboards",

  // Access, profile, announcements and lessons
  "請先使用 Google 登入後再填寫社員資料。":
    "Sign in with Google before completing your member profile.",
  "正在建立或讀取社員資料...": "Creating or loading your member profile...",
  "正在讀取資料...": "Loading profile...",
  "填寫姓名、學號與衝浪程度。初階與中階可直接更新，中進階與進階需由管理員審核；進階核准後會自動晉升為管理員。":
    "Enter your name, student ID and surfing level. Beginner and intermediate changes apply immediately; upper-intermediate and advanced require admin review. Approved advanced members are promoted to admin automatically.",
  "系統身分": "System role",
  "請輸入姓名": "Enter your name",
  "請輸入學號": "Enter your student ID",
  "請填寫姓名。": "Enter your name.",
  "請填寫學號。": "Enter your student ID.",
  "請選擇衝浪程度。": "Select your surfing level.",
  "儲存資料": "Save Profile",
  "社員資料已儲存。": "Member profile saved.",
  "需審核": "Review required",
  "已送出": "Submitted",
  "已核准程度": "Approved level",
  "程度審核，等待管理員處理。": "Level review pending admin action.",
  "尚未開通公告權限": "Announcement Access Pending",
  "目前身份只能登入與填寫資料，請等待幹部或管理員審核。":
    "Your current account can only sign in and edit your profile. Wait for officer or admin approval.",
  "社員以上可以查看公告；幹部與管理員可以新增、編輯與刪除公告。":
    "Confirmed members can view announcements. Officers and admins can create, edit and delete them.",
  "請先登入後再查看公告。": "Sign in to view announcements.",
  "請先登入後再新增公告。": "Sign in before creating an announcement.",
  "請填寫公告標題。": "Enter an announcement title.",
  "請填寫公告內容。": "Enter announcement content.",
  "公告已新增。": "Announcement published.",
  "公告已新增，LINE 通知已發送。":
    "Announcement published and the LINE notification was sent.",
  "公告已新增，但 LINE 通知發送失敗。":
    "Announcement published, but the LINE notification could not be sent.",
  "公告已更新。": "Announcement updated.",
  "公告已刪除。": "Announcement deleted.",
  "確定要刪除這則公告嗎？": "Delete this announcement?",
  "有新公告時會顯示在這裡。": "New announcements will appear here.",
  "使用上方表單新增第一則公告。": "Use the form above to publish the first announcement.",
  "尚未開通社課權限": "Lesson Access Pending",
  "目前身分只能登入與填寫資料，請等待幹部或管理員審核。":
    "Your current account can only sign in and edit your profile. Wait for officer or admin approval.",
  "請先登入後再查看社課。": "Sign in to view club lessons.",
  "查看社課時間、教學與名額，並在這裡完成報名或候補。":
    "View lesson times, instructors and availability, then register or join the waitlist.",
  "讀取社課中...": "Loading lessons...",
  "重新整理社課": "Refresh lessons",
  "上限人數": "Capacity",
  "上限人數必須是大於 0 的整數。": "Capacity must be a positive whole number.",
  "請填寫日期與時間。": "Enter the date and time.",
  "報名截止時間": "Registration deadline",
  "報名截止時間必須晚於現在且早於社課開始時間。":
    "The registration deadline must be later than now and before the lesson starts.",
  "社員可報名到這個時間；取消報名會提早 3 小時截止。":
    "Members can register until this time. Cancellation closes 3 hours earlier.",
  "請選擇至少一位教學": "Select at least one instructor",
  "例如上課地點、課程內容、浪況提醒或注意事項":
    "For example: location, lesson content, surf conditions or other notes",
  "社課已新增。": "Lesson created.",
  "社課已新增，LINE 通知已發送。":
    "Lesson created and the LINE notification was sent.",
  "社課已新增，但 LINE 通知發送失敗。":
    "Lesson created, but the LINE notification could not be sent.",
  "社課已取消。": "Lesson cancelled.",
  "確定要取消此社課嗎？該次報名、備取與簽到紀錄都會被刪除，此操作無法復原。":
    "Cancel this lesson? Its registrations, waitlist and attendance records will be permanently deleted.",
  "取消社課": "Cancel Lesson",
  "取消中...": "Cancelling...",
  "社課｜": "Lesson | ",
  "教學：": "Instructors:",
  "人數：": "Participants:",
  "備取：": "Waitlist:",
  "備註：": "Notes:",
  "報名截止：": "Registration closes:",
  "取消截止：": "Cancellation closes:",
  "（報名截止前 3 小時）": " (3 hours before registration closes)",
  "已參加": "Registered",
  "參加": "Register",
  "報名成功。": "Registration successful.",
  "已取消報名。": "Registration cancelled.",
  "報名已截止": "Registration closed",
  "已超過取消截止時間": "Cancellation deadline passed",
  "社課已開始": "Lesson started",
  "選擇教學": "Select instructors",
  "目前沒有可選教學。": "No instructors available.",

  // Trips, chat and surf spots
  "尚未開通外衝權限": "Surf Trip Access Pending",
  "待審核身分只能登入與填寫基本資料，尚不能使用揪外衝功能。":
    "Pending accounts can sign in and edit their profile, but cannot use surf trips yet.",
  "請先登入後再查看與新增外衝活動。": "Sign in to view or create surf trips.",
  "正在讀取外衝活動...": "Loading surf trips...",
  "請選擇出發與回程日期。": "Select departure and return dates.",
  "回程日期不可早於出發日期。": "The return date cannot be before departure.",
  "外衝必須至少提前一天建立，才能在開始時正確計次。":
    "Create a surf trip at least one day in advance so participation can be counted correctly when it starts.",
  "請至少選擇一個地點。": "Select at least one location.",
  "人數上限最多 8 人，不包含負責人。":
    "The passenger limit is 8, excluding the coordinator.",
  "不包含負責人（第一台車跟車名額），最多 8 人":
    "Excludes the coordinator (the first car's passenger capacity); maximum 8",
  "例如集合地點、交通方式、浪況提醒或其他注意事項":
    "For example: meeting point, transport, surf conditions or other notes",
  "外衝活動已新增。": "Surf trip created.",
  "外衝活動已新增，LINE 通知已發送。":
    "Surf trip created and the LINE notification was sent.",
  "外衝活動已新增，但 LINE 通知發送失敗。":
    "Surf trip created, but the LINE notification could not be sent.",
  "活動已移除。": "Trip removed.",
  "外衝已開始，名單已鎖定": "The trip has started and the roster is locked",
  "地點：": "Location:",
  "未指定地點": "No location specified",
  "負責人：": "Coordinator:",
  "人數上限：": "Passenger limit:",
  "人（不含車長）": "people (excluding drivers)",
  "程度限制：": "Level requirement:",
  "程度限制已更新。": "Level requirement updated.",
  "備取名單": "Waitlist",
  "仍有空車廂時請直接跟車，備取僅在車位已滿時開放。":
    "Join an available car directly. The waitlist opens only when all seats are full.",
  "已加入備取。": "Joined the waitlist.",
  "已取消備取。": "Left the waitlist.",
  "取消備取": "Leave Waitlist",
  "已成功跟車。": "Joined the car.",
  "已取消跟車。": "Left the car.",
  "已新增車長。": "Driver added.",
  "已移除車廂。": "Car slot removed.",
  "跟車人數": "Passenger capacity",
  "移除車廂": "Remove car slot",
  "此車廂已有跟車者，無法移除。": "This car slot has passengers and cannot be removed.",
  "請先從最後一個空車廂開始移除。": "Remove the last empty car slot first.",
  "確定要移除此活動嗎？所有車隊、跟車與聊天室紀錄都會被刪除，此操作無法復原。":
    "Remove this trip? All carpool, passenger and chat records will be permanently deleted.",
  "讀取訊息中...": "Loading messages...",
  "重新整理訊息": "Refresh messages",
  "關閉聊天室": "Close chat",
  "僅正式成員可發送": "Confirmed members only",
  "訊息不可空白。": "Message cannot be empty.",
  "訊息最多 500 字。": "Messages are limited to 500 characters.",
  "搜尋浪點名稱或縣市": "Search surf spot or city",
  "找不到符合的浪點。": "No matching surf spots.",
  "浪點名稱，例如：西子灣": "Surf spot name, e.g. 西子灣",
  "縣市，例如：高雄": "City / county, e.g. 高雄",
  "請填寫浪點名稱與縣市。": "Enter a surf spot name and city.",
  "此浪點已存在，已直接選取。": "This surf spot already exists and has been selected.",
  "浪點已新增。": "Surf spot added.",

  // Attendance and member administration
  "教學與正取社員可簽到；候補需先正式遞補。簽到不限時間，統計僅計算已開始的社課。":
    "Instructors and confirmed participants can be checked in. Waitlisted members must first be promoted. Check-in has no time window; statistics count only lessons that have started.",
  "請先登入後再使用簽到功能。": "Sign in to use attendance.",
  "沒有簽到權限": "No Attendance Access",
  "選擇社課": "Select a lesson",
  "目前沒有社課": "No lessons available",
  "教學出席": "Instructor Attendance",
  "社員出席簽到": "Member Attendance",
  "正取": "Confirmed",
  "候補": "Waitlisted",
  "正式遞補": "Promote",
  "遞補中...": "Promoting...",
  "正式遞補後才能簽到": "Promote before check-in",
  "正取名額已滿，需先釋出名額": "Confirmed capacity is full; free a spot first",
  "必須依候補順序遞補": "Promote in waitlist order",
  "候補社員必須先正式遞補，才能簽到。":
    "A waitlisted member must be promoted before check-in.",
  "候補社員已正式遞補，現在可以簽到。":
    "The waitlisted member has been promoted and can now be checked in.",
  "本堂沒有教學名單。": "No instructors are assigned to this lesson.",
  "本堂尚無參加者。": "No participants in this lesson.",
  "簽到": "Check in",
  "簽到中...": "Saving attendance...",
  "一鍵簽到": "Check In All Instructors",
  "確定要將所有教學標記為出席嗎？": "Mark all instructors as present?",
  "已將所有教學標記為出席。": "All instructors marked present.",
  "社員出席社課次數統計": "Member Lesson Attendance Statistics",
  "幹部教學次數統計": "Instructor Lesson Statistics",
  "出席次數 / 社課次數": "Attendance / Lessons",
  "教學次數 / 社課次數": "Teaching / Lessons",
  "幹部可審核社員及處理一般社員身分；只有管理員可以管理管理員身分與審核程度。":
    "Officers can approve members and manage ordinary member status. Only admins can manage admin roles and review surfing levels.",
  "尚未開通瀏覽權限": "Member List Access Pending",
  "待審核身分只能登入與填寫基本資料，尚不能瀏覽社員名單。":
    "Pending accounts can sign in and edit their profile, but cannot view the member list yet.",
  "請先登入後再查看社員名單。": "Sign in to view the member list.",
  "額外管理員名額：": "Additional admin slots:",
  "（不含站主）": "(site owner excluded)",
  "取消批量移除": "Cancel bulk removal",
  "批量移除成員": "Remove selected members",
  "找不到符合條件的待審核成員。": "No matching pending members.",
  "審核通過所有待審核社員": "Approve all pending members",
  "請先勾選要核准的待審核社員。": "Select pending members to approve.",
  "請先勾選要移除的成員。": "Select members to remove.",
  "已核准成為社員。": "Approved as a member.",
  "社員身分已更新。": "Member role updated.",
  "有社員送出程度申請；幹部可查看通知，只有管理員可以核准或拒絕。":
    "A member submitted a level request. Officers can see the notification, but only admins can approve or reject it.",
  "核准程度申請": "Approve level request",
  "額外管理員名額已滿，需先移除一位管理員":
    "All additional admin slots are in use. Remove an admin first.",
  "衝浪程度已核准。": "Surfing level approved.",
  "已拒絕衝浪程度申請。": "Surfing level request rejected.",
  "進階程度已核准，該社員已自動晉升為管理員。":
    "Advanced level approved. The member was automatically promoted to admin.",
  "不能在這裡調整自己的身分，避免鎖死權限。":
    "You cannot change your own role here, to prevent being locked out.",

  // Homepage controls, dialogs and media
  "幹部團隊": "Officer Team",
  "有任何關於入社、租板或社課的問題，都可以直接找我們。":
    "Contact us with any questions about joining, rentals or lessons.",
  "目前還沒有幹部介紹。": "No officer profiles yet.",
  "管理幹部": "Manage Officers",
  "幹部團隊橫向列表": "Horizontal officer list",
  "可以左右滑動或使用箭頭查看更多幹部。":
    "Swipe horizontally or use the arrows to see more officers.",
  "上一批": "Previous officers",
  "下一批": "Next officers",
  "查看前面的幹部": "View previous officers",
  "查看後面的幹部": "View next officers",
  "社團照片輪播": "Club photo carousel",
  "上一張照片": "Previous photo",
  "下一張照片": "Next photo",
  "編輯 About": "Edit About",
  "編輯 About 區塊": "Edit About Section",
  "編輯中段區塊": "Edit Banner",
  "編輯中段背景區塊": "Edit Banner Section",
  "編輯 Footer": "Edit Footer",
  "編輯 Hero 區塊": "Edit Hero Section",
  "完成這個區塊": "Done with This Section",
  "ABOUT 小標": "About eyebrow",
  "顯示在標題上方的英文小字": "Small English text shown above the heading",
  "區塊標題": "Section heading",
  "小標、標題、左側介紹段落與右側特色項目":
    "Eyebrow, heading, introduction paragraphs and highlights",
  "新增段落": "Add Paragraph",
  "刪除段落": "Delete paragraph",
  "新增項目": "Add Highlight",
  "移除項目": "Remove highlight",
  "往上移": "Move up",
  "往下移": "Move down",
  "主標語": "Headline",
  "副標語": "Subtitle",
  "背景圖片": "Background image",
  "背景圖片、主標語與副標語": "Background image, headline and subtitle",
  "首頁主標題": "Homepage title",
  "副標題": "Subtitle",
  "新增圖片": "Add Image",
  "替換": "Replace",
  "往前移": "Move earlier",
  "往後移": "Move later",
  "管理首頁幹部": "Manage Homepage Officers",
  "新增展示幹部": "Add Officer Profile",
  "已達上限": "Limit reached",
  "職位": "Role title",
  "名稱": "Name",
  "幹部照片": "Officer photo",
  "從首頁移除": "Remove from homepage",
  "社團名稱": "Club name",
  "簡介": "Description",
  "聯絡網站管理員": "Contact the Website Admin",
  "QR Code 圖片": "QR Code image",
  "Footer 背景圖片": "Footer background image",
  "社團 QR Code": "Club QR Code",
  "．社團內部網站": " · Internal club website",
  "上傳圖片": "Upload Image",
  "替換圖片": "Replace Image",
  "移除圖片": "Remove Image",
  "尚未設定": "Not set",
  "圖片載入失敗": "Image failed to load",
  "調整圖片": "Adjust Image",
  "縮放": "Zoom",
  "縮放圖片": "Zoom image",
  "水平焦點": "Horizontal focus",
  "垂直焦點": "Vertical focus",
  "水平": "Horizontal",
  "垂直": "Vertical",
  "重設位置與縮放": "Reset position and zoom",
  "確認裁切": "Confirm Crop",
  "桌機預覽": "Desktop preview",
  "手機預覽": "Mobile preview",
  "手機版顯示焦點": "Mobile focal point",
  "圖片替代文字（alt）": "Image alternative text (alt)",
  "給看不到圖片的使用者與搜尋引擎的簡短描述":
    "A short description for screen-reader users and search engines",
  "拖曳可移動圖片，使用下方滑桿或手機雙指手勢縮放。":
    "Drag to reposition the image. Use the slider or pinch gesture to zoom.",
  "關閉編輯視窗": "Close editor",
  "編輯模式：點各區塊的編輯按鈕修改內容":
    "Edit mode: use each section's edit button to change its content",
  "．目前沒有變更": " · No changes",
  "．有尚未儲存的變更": " · Unsaved changes",

  // Surfboard management and image controls
  "幹部與管理員可以在這裡管理社上的衝浪板，點擊卡片查看與編輯詳細資料。":
    "Officers and admins can manage club surfboards here. Select a card to view and edit its details.",
  "目前還沒有衝浪板，點擊左側卡片新增第一張。":
    "No surfboards yet. Select the card on the left to add the first one.",
  "重新整理衝浪板列表": "Refresh surfboards",
  "衝浪板名稱": "Surfboard name",
  "板型（可複選）": "Board type (select multiple)",
  "浮力（L）": "Volume (L)",
  "長度（呎吋）": "Length (ft/in)",
  "衝浪板狀況、適用情境或其他備註":
    "Board condition, suitable use or other notes",
  "圖片（最少 1 張、最多": "Images (minimum 1, maximum",
  "尚未加入圖片": "No images added",
  "支援 JPG、PNG、WebP，每張最大": "Supports JPG, PNG and WebP; maximum per image",
  "MB。第 1 張會作為列表封面。": "MB. The first image is used as the card cover.",
  "將這張圖片往前移": "Move this image earlier",
  "將這張圖片往後移": "Move this image later",
  "移除這張圖片": "Remove this image",
  "儲存變更": "Save Changes",
  "移除衝浪板": "Remove Surfboard",
  "確認移除衝浪板": "Confirm Surfboard Removal",
  "確認移除": "Confirm Removal",
  "衝浪板已新增。": "Surfboard added.",
  "衝浪板已更新。": "Surfboard updated.",
  "衝浪板已移除。": "Surfboard removed.",
  "請至少上傳 1 張圖片。": "Upload at least one image.",
  "沒有圖片": "No image",
  "上一張圖片": "Previous image",
  "下一張圖片": "Next image",
  "衝浪板圖片": "Surfboard image",
  "關閉視窗": "Close window",
  "例如 45.5，可留空": "For example: 45.5 (optional)",
  "例如 5'4 或 9，可留空": "For example: 5'4 or 9 (optional)",

  // Sign-in gates and maintenance page
  "請使用 Google 帳號登入後繼續": "Sign in with Google to continue",
  "這個功能需要社員身分。登入後會自動建立社員資料，預設身分為待審核。":
    "This feature requires membership. A pending member profile will be created automatically after sign-in.",
  "前往登入...": "Signing in...",
  "關閉登入提示": "Close sign-in prompt",
  "你沒有權限查看此頁面": "You do not have access to this page",
  "此頁面僅供幹部與管理員查看。": "This page is available to officers and admins only.",
  "請先登入後再查看此頁面。": "Sign in to view this page.",
  "幹部與管理員可查看維護聯絡方式、系統架構與注意事項。":
    "Officers and admins can view maintenance contacts, system architecture and important notes.",
  "主要維護人": "Primary Maintainer",
  "主要維護人：": "Primary maintainer:",
  "手機：": "Phone:",
  "身分：": "Role:",
  "可聯絡事項：": "Contact about:",
  "網站 bug": "Website bugs",
  "功能新增": "New features",
  "權限調整": "Permission changes",
  "資料庫問題": "Database issues",
  "部署問題": "Deployment issues",
  "前端：Next.js": "Frontend: Next.js",
  "資料庫 / Auth：Supabase": "Database / Auth: Supabase",
  "部署：Vercel": "Deployment: Vercel",
  "程式碼管理：GitHub": "Source control: GitHub",
  "登入方式：Google Login": "Sign-in: Google Login",
  "常見維護流程": "Common Maintenance Workflow",
  "更新網站功能：": "Updating website features:",
  "修改資料庫：": "Changing the database:",
  "在功能分支修改。": "Make changes on a feature branch.",
  "執行 npm run build。": "Run npm run build.",
  "push 到 GitHub。": "Push to GitHub.",
  "確認 Vercel build 通過。": "Confirm the Vercel build passes.",
  "合併到 main。": "Merge into main.",
  "先在 docs/sql 撰寫 SQL 檔案。": "Write the SQL file in docs/sql first.",
  "檢查 SQL 是否會影響既有資料。": "Check whether the SQL affects existing data.",
  "到 Supabase SQL Editor 執行。": "Run it in the Supabase SQL Editor.",
  "回網站測試功能。": "Return to the website and test the feature.",
  "維護注意事項": "Maintenance Notes",
  "不要公開 .env.local。": "Never expose .env.local.",
  "不要把 Supabase service_role key 放到前端。":
    "Never put the Supabase service_role key in frontend code.",
  "不要刪除 Supabase auth.users。": "Never delete Supabase auth.users.",
  "修改資料庫前請先確認 SQL 內容。": "Review SQL before changing the database.",
  "main 分支視為正式部署分支。": "The main branch is the production deployment branch.",
  "功能分支 build / Vercel 通過後再合併 main。":
    "Merge a feature branch into main only after the build and Vercel checks pass.",
  "若要新增功能或改資料庫結構，請先和主要維護人確認。":
    "Check with the primary maintainer before adding features or changing the database schema.",
  "以上": "or above",
  "位": " people",
  "剩": "Remaining ",
  "已跟": "Joined ",
  "備取": "Waitlist",
  "備取第": "Waitlist position ",
  "序號": "No.",
  "教學": "Instructor",
  "開放": "Open",
  "待補": "Pending",
  "第": "No. ",
  "張": " image(s)",
  "張）": " images)",
  "200 元": "NT$200",
  "，領板時可使用現金或轉帳付款。":
    ", payable by cash or bank transfer at pickup.",
  "目前身份尚未開通租板權限。": "Rental access has not been approved yet.",
  "請從日曆選擇一個租板時段查看詳細資料。":
    "Select a rental session on the calendar to view details.",
  "找不到租板時段，請重新整理後再試。":
    "Rental session not found. Refresh and try again.",
  "這個租板時段已額滿。": "This rental session is full.",
  "這個租板時段目前未開放。": "This rental session is closed.",
  "此租板時段已過期，無法登記": "This rental session has expired",
  "此租板時段已過期，無法開關": "Expired sessions cannot be opened or closed",
  "此租板時段已過期，無法重新開放或關閉。":
    "Expired rental sessions cannot be reopened or closed.",
  "租板時段已開始，無法取消": "The rental session has started and cannot be cancelled",
  "只能取消自己的登記。": "You can only cancel your own registration.",
  "已登記租板。提醒：您目前租板未繳費 1/2。":
    "Board rental registered. Reminder: you have 1 of 2 unpaid rentals.",
  "您目前租板未繳費 1/2": "You have 1 of 2 unpaid rentals",
  "/2，請先完成補繳後再租板": "/2. Complete payment before renting again",
  "登記已送出，但未取得預約編號，請立即聯絡社團確認。":
    "Registration was submitted but no reservation number was returned. Contact the club immediately to confirm.",
  "登入失敗：": "Sign-in failed:",
  "只有正式成員可以發送訊息。": "Only confirmed members can send messages.",
  "只有正式成員可以新增外衝。": "Only confirmed members can create surf trips.",
  "只有正式成員可以新增車長。": "Only confirmed members can add drivers.",
  "只有正式成員可以新增浪點。": "Only confirmed members can add surf spots.",
  "只有正式成員可以跟車。": "Only confirmed members can join a car.",
  "只有活動負責人可以移除此活動。": "Only the trip coordinator can remove this trip.",
  "只有板務、幹部與管理員可以刪除租板時段。":
    "Only board managers, officers and admins can delete rental sessions.",
  "只有板務、幹部與管理員可以開關租板時段。":
    "Only board managers, officers and admins can open or close rental sessions.",
  "只有板務、幹部與管理員可以新增租板時段。":
    "Only board managers, officers and admins can create rental sessions.",
  "只有幹部與管理員可以刪除公告。": "Only officers and admins can delete announcements.",
  "只有幹部與管理員可以更新繳費狀態。":
    "Only officers and admins can update payment status.",
  "只有幹部與管理員可以取消社課。": "Only officers and admins can cancel lessons.",
  "只有幹部與管理員可以核准待審核社員。":
    "Only officers and admins can approve pending members.",
  "只有幹部與管理員可以移除正式成員。":
    "Only officers and admins can remove confirmed members.",
  "只有幹部與管理員可以進入簽到頁。":
    "Only officers and admins can access attendance.",
  "只有幹部與管理員可以新增公告。": "Only officers and admins can create announcements.",
  "只有幹部與管理員可以新增社課。": "Only officers and admins can create lessons.",
  "只有幹部與管理員可以管理社員身分。":
    "Only officers and admins can manage member roles.",
  "只有幹部與管理員可以標記補繳。":
    "Only officers and admins can mark outstanding payments as paid.",
  "只有幹部與管理員可以編輯公告。": "Only officers and admins can edit announcements.",
  "只有管理員可以審核衝浪程度。": "Only admins can review surfing levels.",
  "請先登入後再新增外衝。": "Sign in before creating a surf trip.",
  "請先登入後再新增租板時段。": "Sign in before creating a rental session.",
  "請輸入有效人數。": "Enter a valid capacity.",
  "確認新增": "Confirm Add",
  "4:5 直向照片效果最好，會輸出 1000×1250 的 WebP。":
    "A 4:5 portrait works best and will be exported as a 1000×1250 WebP.",
  "建議使用橫向照片，會輸出 2400×1200 的 WebP。":
    "A landscape image is recommended and will be exported as a 2400×1200 WebP.",
  "深色橫向照片效果最好，會輸出 2400×1200 的 WebP。":
    "A dark landscape image works best and will be exported as a 2400×1200 WebP.",
  "正方形圖片，會輸出 800×800 的 WebP；沒有設定時 Footer 不會顯示 QR Code 區塊。":
    "A square image exported as an 800×800 WebP. If unset, the QR Code section is hidden.",
  "可以拖曳卡片調整順序，手機請使用上下箭頭。":
    "Drag cards to reorder them. On mobile, use the up and down arrows.",
  "可以拖曳卡片調整順序，手機請使用左右箭頭。第 1 張會是進入首頁時的第一張照片。":
    "Drag cards to reorder them. On mobile, use the left and right arrows. The first image is shown first on the homepage.",
  "目前沒有展示幹部，按「新增展示幹部」加入第一位。":
    "No officer profiles yet. Select “Add Officer Profile” to add the first one.",
  "目前沒有特色項目，可以按「新增項目」加入。":
    "No highlights yet. Select “Add Highlight” to add one.",
  "這裡只管理首頁上的幹部介紹卡，與系統帳號權限完全分開。新增或移除都不會變更任何人的角色；帳號權限請到「社員名單」調整。":
    "This section manages homepage officer profiles only and is separate from account permissions. Adding or removing a profile does not change anyone's role; manage account permissions from the Member List.",
  "沒有上傳照片的幹部，首頁會顯示「照片待補」的佔位方塊。":
    "Officer profiles without a photo display a “Photo coming soon” placeholder.",
  "社團名稱、簡介、Instagram、聯絡網站管理員、QR Code 與背景圖":
    "Club name, description, Instagram, admin contact, QR Code and background image",
  "可以填 Email 或表單網址；留空就不顯示。":
    "Enter an email address or form URL. Leave blank to hide it.",
  "可以輸入帳號（例如 westbay.surf）或完整網址；留空就不顯示。":
    "Enter an account name (such as westbay.surf) or a full URL. Leave blank to hide it.",
  "例如 admin@example.com": "For example: admin@example.com",
  "例如：社長": "For example: 社長",
  "例如：王小明": "For example: 王小明",
  "例如：負責社團整體運作與活動規劃。":
    "For example: 負責社團整體運作與活動規劃。",
  "例如：社員在西子灣練習起乘": "For example: 社員在西子灣練習起乘",
  "例如：藍白軟板": "For example: 藍白軟板",
  "請至少保留一段社團介紹。": "Keep at least one introduction paragraph.",
  "確定要刪除這張 Hero 圖片嗎？按「完成編輯」後才會實際套用。":
    "Delete this Hero image? The change is applied only after you finish editing.",
  "請先調整裁切範圍。": "Adjust the crop area first.",
  "圖片處理失敗，請重試。": "Image processing failed. Try again.",
  "手機版容器較窄，會再裁掉左右兩側。調整焦點可以避免人物被裁掉。":
    "The mobile container is narrower and crops both sides. Adjust the focal point to keep people visible.",
  "Hero 輪播圖（16:9）": "Hero carousel image (16:9)",
  "中段背景圖（2:1）": "Banner background (2:1)",
  "頁尾背景圖（2:1）": "Footer background (2:1)",
  "幹部照片（4:5）": "Officer photo (4:5)",
};

const actionTranslations: Record<string, string> = {
  讀取登入狀態: "Loading sign-in status",
  初始化登入狀態: "Initializing sign-in status",
  "Google 登入": "Google sign-in",
  登出: "Sign-out",
  讀取社員資料: "Loading member profile",
  建立社員資料: "Creating member profile",
  讀取新社員資料: "Loading new member profile",
  讀取公告: "Loading announcements",
  新增公告: "Publishing announcement",
  更新公告: "Updating announcement",
  刪除公告: "Deleting announcement",
  讀取社課: "Loading lessons",
  新增社課: "Creating lesson",
  報名: "Registration",
  取消報名: "Cancelling registration",
  加入候補: "Joining waitlist",
  取消候補: "Leaving waitlist",
  讀取租板時段: "Loading rental sessions",
  登記租板: "Board registration",
  取消租板: "Cancelling rental",
  讀取衝浪板: "Loading surfboards",
  新增衝浪板: "Adding surfboard",
  更新衝浪板: "Updating surfboard",
  刪除衝浪板: "Deleting surfboard",
  讀取外衝活動: "Loading surf trips",
  新增外衝: "Creating surf trip",
  跟車: "Joining car",
  取消跟車: "Leaving car",
  讀取社員名單: "Loading member list",
  儲存: "Saving",
};

function translateAction(value: string) {
  return actionTranslations[value.trim()] ?? value.trim();
}

export function translateUiText(value: string, locale: AppLocale): string {
  if (locale === "zh-Hant" || !value) return value;

  const exact = englishUiText[value];
  if (exact) return exact;

  const levelMatch = value.match(/^(.+)以上$/);
  if (levelMatch) return `${translateUiText(levelMatch[1], "en")} or above`;

  const joinedMatch = value.match(/^已跟 (\d+) \/ (\d+)$/);
  if (joinedMatch) return `${joinedMatch[1]} / ${joinedMatch[2]} joined`;

  const waitlistMatch = value.match(/^備取 (\d+) \/ (\d+)$/);
  if (waitlistMatch) return `Waitlist ${waitlistMatch[1]} / ${waitlistMatch[2]}`;

  const positionMatch = value.match(/^備取第 (\d+) 位$/);
  if (positionMatch) return `Waitlist position ${positionMatch[1]}`;

  const peopleMatch = value.match(/^共?\s*(\d+) 人$/);
  if (peopleMatch) return `${peopleMatch[1]} people`;

  const remainingMatch = value.match(/^剩餘 (\d+) 名$/);
  if (remainingMatch) return `${remainingMatch[1]} spots left`;

  const stepMatch = value.match(/^第 (\d+) 步，共 (\d+) 步$/);
  if (stepMatch) return `Step ${stepMatch[1]} of ${stepMatch[2]}`;

  const failureMatch = value.match(/^(.+)失敗：(.+)$/);
  if (failureMatch) {
    return `${translateAction(failureMatch[1])} failed: ${failureMatch[2]}`;
  }

  return value;
}

export function localeForIntl(locale: AppLocale) {
  return locale === "en" ? "en-US" : "zh-TW";
}
