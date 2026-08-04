# 📚 英文單字學習 App — VocabApp

> 英文常用詞彙學習平台，支援 CEFR A1-C2 等級分類、SM2 間隔重複算法、文章閱讀、個人筆記。

🌐 **線上體驗**：[https://swhung0920.github.io/english-vocab-app/](https://swhung0920.github.io/english-vocab-app/)

📱 **iPhone 安裝**：用 Safari 開啟上方連結 → 點「分享」→「加入主畫面」

---

## ✨ 功能特色

| 功能 | 說明 |
|------|------|
| 📖 翻卡學習 | 3D 翻轉動畫，顯示多義、使用情境、英英解釋 |
| 🧩 選擇題測驗 | 4 選 1，自動記錄答錯單字 |
| ✍️ 拼寫練習 | 看中文拼出英文 |
| 🔁 SM2 複習 | 根據記憶曲線安排最佳複習時機 |
| 📰 文章閱讀 | 貼上英文文章，點字即時查詞 |
| 📝 個人筆記 | 單字心得筆記 + 自由筆記 |
| 📊 學習統計 | GitHub 風格熱力圖、CEFR 進度條 |
| 🔥 連續天數 | Streak 追蹤每日學習 |

## 📊 CEFR 等級

| 等級 | 字數 | 程度 |
|------|------|------|
| A1 | 301 字 | 入門 |
| A2 | 259 字 | 初級 |
| B1 | 238 字 | 中級 |
| B2 | 132 字 | 中高級 |
| C1 | 73 字 | 高級 |
| C2 | 48 字 | 精英 |

## 🛠 技術架構

- **純前端**：HTML5 + Vanilla CSS + JavaScript
- **離線支援**：PWA + Service Worker
- **資料儲存**：LocalStorage（不需後端）
- **詞庫格式**：`data/words.json`（可自由替換）
- **SM2 算法**：間隔重複記憶系統

## 📁 詞庫自訂

替換 `data/words.json` 即可更換詞庫，格式如下：

```json
[
  {
    "id": 1,
    "word": "ability",
    "phonetic": "/əˈbɪlɪti/",
    "pos": "n.",
    "zh": "能力",
    "en_def": "The quality of being able to do something.",
    "example": "She has the ability to learn quickly.",
    "level": "B1",
    "cefr_order": 3,
    "frequency_rank": 500,
    "meanings": [
      {
        "pos": "n. 名詞",
        "en_def": "Capacity to do something.",
        "example": "He showed great ability in math.",
        "context": "📖 一般用法"
      }
    ]
  }
]
```

## 📄 License

MIT License — 自由使用、修改、分享
