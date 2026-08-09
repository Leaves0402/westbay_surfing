/**
 * 首頁公開內容集中管理。
 *
 * 圖片目前是存放在 public/images/home 的本機暫代照片。
 * 等社團正式照片準備好後，可直接以相同檔名覆蓋，或修改這裡的
 * src / alt / objectPosition，不需要改動任何元件。
 */

export type SiteImage = {
  src: string;
  alt: string;
  /** 對應 CSS object-position，避免主要人物在手機版被裁掉。 */
  objectPosition: string;
};

/**
 * TEMPORARY PLACEHOLDER：Hero 輪播照片。
 * 請替換為社團實際的衝浪活動照片（建議橫向、2000px 以上）。
 */
export const heroSlides: SiteImage[] = [
  {
    src: "/images/home/hero/hero-01.webp",
    alt: "衝浪者在藍綠色浪管中滑行（暫代照片）",
    objectPosition: "60% 50%",
  },
  {
    src: "/images/home/hero/hero-02.webp",
    alt: "衝浪者沿著浪壁斜跑（暫代照片）",
    objectPosition: "62% 50%",
  },
  {
    src: "/images/home/hero/hero-03.webp",
    alt: "夕陽下坐在浪板上等浪的衝浪者剪影（暫代照片）",
    objectPosition: "55% 45%",
  },
  {
    src: "/images/home/hero/hero-04.webp",
    alt: "黃色長板立在海灘上，背景是海浪（暫代照片）",
    objectPosition: "50% 55%",
  },
];

/**
 * TEMPORARY PLACEHOLDER：中段全寬固定背景照片與標語。
 */
export const bannerSection: {
  image: SiteImage;
  slogan: string;
  subtitle: string;
} = {
  image: {
    src: "/images/home/banner.webp",
    alt: "夕陽下的椰子樹與海平面（暫代照片）",
    objectPosition: "50% 50%",
  },
  slogan: "有浪就下水，沒浪就一起等浪",
  subtitle: "西子灣的浪不大，但我們每個週末都在海邊。",
};

export type Officer = {
  /** TEMPORARY PLACEHOLDER：請替換為實際幹部姓名。 */
  name: string;
  role: string;
  bio: string;
  image: SiteImage;
};

/**
 * TEMPORARY PLACEHOLDER：幹部團隊。
 * 姓名與介紹皆為暫代文字，照片為本機暫代衝浪照，請替換為幹部本人照片。
 */
export const officers: Officer[] = [
  {
    name: "幹部姓名",
    role: "社長",
    bio: "負責社團整體運作、對外聯絡與活動規劃。",
    image: {
      src: "/images/home/officers/president.webp",
      alt: "衝浪者在浪上轉向的黑白照片（幹部照片暫代）",
      objectPosition: "50% 40%",
    },
  },
  {
    name: "幹部姓名",
    role: "副社長",
    bio: "協助社務推動，統籌社課與社員事務。",
    image: {
      src: "/images/home/officers/vice-president.webp",
      alt: "衝浪者在白色浪花中做出動作（幹部照片暫代）",
      objectPosition: "50% 45%",
    },
  },
  {
    name: "幹部姓名",
    role: "板務",
    bio: "管理社上衝浪板、租板時段與器材維護。",
    image: {
      src: "/images/home/officers/board-manager.webp",
      alt: "從水中拍攝的浪管與衝浪者（幹部照片暫代）",
      objectPosition: "45% 50%",
    },
  },
  {
    name: "幹部姓名",
    role: "活動",
    bio: "規劃揪外衝、社遊與各項社團活動。",
    image: {
      src: "/images/home/officers/activity-manager.webp",
      alt: "黃色長板立在海灘上的照片（幹部照片暫代）",
      objectPosition: "50% 55%",
    },
  },
];

/**
 * TEMPORARY PLACEHOLDER：Footer 深色海浪背景照片。
 */
export const footerImage: SiteImage = {
  src: "/images/home/footer.webp",
  alt: "夕陽下的椰子樹與海平面（暫代照片）",
  objectPosition: "50% 50%",
};

/**
 * 聯絡資訊。
 *
 * 尚未取得社團公開聯絡資料，因此全部保持 null，畫面會顯示「聯絡資訊待補」，
 * 不會產生假的可點擊 Email、電話或社群連結。
 * 請勿在此填入維護人員的私人手機或私人 Email。
 */
export type ContactItem = {
  label: string;
  /** 顯示文字；null 代表尚未提供。 */
  value: string | null;
  /** 可點擊連結；null 代表不要做成連結。 */
  href: string | null;
};

export const contactPendingText = "聯絡資訊待補";

export const footerContact: {
  clubName: string;
  description: string;
  items: ContactItem[];
  qrCodeNote: string;
} = {
  clubName: "西灣衝浪社",
  description: "國立中山大學西灣衝浪社，社員以上可登入使用租板、社課與外衝功能。",
  items: [
    { label: "Email", value: null, href: null },
    { label: "Instagram", value: null, href: null },
    { label: "Facebook / LINE", value: null, href: null },
    { label: "聯絡位置", value: null, href: null },
  ],
  qrCodeNote: "QR Code 待補",
};

export const clubIntro: {
  heading: string;
  paragraphs: string[];
  highlights: Array<{ title: string; description: string }>;
} = {
  heading: "關於西灣衝浪社",
  paragraphs: [
    "我們是國立中山大學的西灣衝浪社。社團就在西子灣旁邊，從教室走到海邊只要幾分鐘，不管是第一次下水還是已經有自己的板子，都可以找到一起衝浪的人。",
    "社團提供社板租借、社課教學與週末外衝，由幹部與板務一起維護器材與安全，讓新手可以安心從頭學起。",
  ],
  highlights: [
    {
      title: "社板租借",
      description: "線上查看租板時段與剩餘名額，登入後挑選適合自己的板子。",
    },
    {
      title: "社課教學",
      description: "從基本觀念、起乘到看浪選浪，由社上教學帶著練習。",
    },
    {
      title: "週末外衝",
      description: "一起揪車去外地浪點，跟車、車隊與行程都在網站上安排。",
    },
  ],
};

export const heroContent: {
  title: string;
  subtitle: string;
} = {
  title: "西灣衝浪社",
  subtitle:
    "中山大學西子灣旁的衝浪社團。租板、社課、外衝，一起把週末交給海。",
};
