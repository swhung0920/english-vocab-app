/* =====================================================
   ENGINE.JS — Core Business Logic
   SM2 Algorithm · LocalStorage · Word Management
   ===================================================== */

window.Engine = (() => {

  const STORAGE = {
    PROGRESS: 'va_progress',
    DAILY:    'va_daily',
    NOTES:    'va_notes',
    FREE:     'va_free_notes',
    ARTICLES: 'va_articles',
    SETTINGS: 'va_settings',
    STARRED:  'va_starred',
  };

  let allWords = [];

  /* ── Utilities ── */
  const today = () => new Date().toISOString().split('T')[0];
  const uuid  = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  const load = (key, def) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; }
    catch { return def; }
  };
  const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

  /* ── Words ── */
  async function loadWords() {
    const r = await fetch('./data/words.json');
    allWords = await r.json();
    return allWords;
  }
  const getWords = () => allWords;

  function getFilteredWords(levels) {
    if (!levels || levels.length === 0) return allWords;
    return allWords.filter(w => levels.includes(w.level));
  }

  function getWordById(id) {
    return allWords.find(w => w.id === id);
  }

  /* ── SM2 Algorithm ── */
  function sm2(wordId, quality) {
    // quality: 0=wrong 1=hard 2=okay 3=easy (mapped from 0–5 scale internally)
    const qMap = { 0: 1, 1: 2, 2: 4, 3: 5 };
    const q = qMap[quality] ?? 1;

    const prog = getProgress();
    const wp = prog[wordId] || { n: 0, ef: 2.5, interval: 0, nextReview: null, wrong: 0, right: 0 };

    let { n, ef, interval } = wp;

    if (q >= 3) {
      if      (n === 0) interval = 1;
      else if (n === 1) interval = 6;
      else              interval = Math.round(interval * ef);
      n++;
      wp.right = (wp.right || 0) + 1;
    } else {
      n = 0; interval = 1;
      wp.wrong = (wp.wrong || 0) + 1;
    }

    ef = Math.max(1.3, ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    const nextReview = Date.now() + interval * 864e5;

    prog[wordId] = { ...wp, n, ef, interval, nextReview, lastStudied: Date.now() };
    save(STORAGE.PROGRESS, prog);
    recordDaily(1, q >= 3 ? 1 : 0);
    return prog[wordId];
  }

  /* ── Progress ── */
  const getProgress = () => load(STORAGE.PROGRESS, {});

  function getWordStatus(wordId) {
    const p = getProgress()[wordId];
    if (!p) return 'new';
    if (p.n === 0) return 'new';
    if (p.right >= 5) return 'mastered';
    return 'learning';
  }

  function getDueWords(levels) {
    const prog = getProgress();
    const now = Date.now();
    return getFilteredWords(levels).filter(w => {
      const p = prog[w.id];
      if (!p || !p.nextReview) return false;
      return p.nextReview <= now;
    });
  }

  function getStatsPerLevel() {
    const prog = getProgress();
    const levels = ['A1','A2','B1','B2','C1','C2'];
    return levels.map(lv => {
      const words = allWords.filter(w => w.level === lv);
      const mastered = words.filter(w => {
        const p = prog[w.id];
        return p && p.right >= 5;
      }).length;
      return { level: lv, total: words.length, mastered };
    });
  }

  /* ── Daily Stats ── */
  function recordDaily(studied, correct) {
    const daily = load(STORAGE.DAILY, {});
    const d = today();
    if (!daily[d]) daily[d] = { studied: 0, correct: 0 };
    daily[d].studied += studied;
    daily[d].correct += correct;
    save(STORAGE.DAILY, daily);
  }

  function getDaily() { return load(STORAGE.DAILY, {}); }

  function getTodayStats() {
    const daily = getDaily();
    return daily[today()] || { studied: 0, correct: 0 };
  }

  function getStreak() {
    const daily = getDaily();
    let streak = 0;
    const d = new Date();
    d.setHours(0,0,0,0);
    while (true) {
      const key = d.toISOString().split('T')[0];
      if (daily[key] && daily[key].studied > 0) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else break;
    }
    return streak;
  }

  function getTotalStudied() {
    return Object.values(getProgress()).reduce((a,p) => a + (p.right||0) + (p.wrong||0), 0);
  }

  function getTotalMastered() {
    const prog = getProgress();
    return allWords.filter(w => { const p=prog[w.id]; return p && p.right>=5; }).length;
  }

  /* ── Settings ── */
  function getSettings() {
    return load(STORAGE.SETTINGS, { dailyGoal: 20, selectedLevels: ['A1','A2'] });
  }
  function saveSettings(s) { save(STORAGE.SETTINGS, s); }

  /* ── Starred ── */
  function getStarred()     { return load(STORAGE.STARRED, []); }
  function toggleStar(id)   {
    let starred = getStarred();
    if (starred.includes(id)) starred = starred.filter(x => x !== id);
    else starred.push(id);
    save(STORAGE.STARRED, starred);
    return starred.includes(id);
  }
  function isStarred(id) { return getStarred().includes(id); }

  /* ── Word Notes ── */
  function getWordNotes() { return load(STORAGE.NOTES, {}); }
  function saveWordNote(wordId, content) {
    const notes = getWordNotes();
    notes[wordId] = { content, wordId, updatedAt: Date.now(), createdAt: notes[wordId]?.createdAt || Date.now() };
    save(STORAGE.NOTES, notes);
  }
  function deleteWordNote(wordId) {
    const notes = getWordNotes();
    delete notes[wordId];
    save(STORAGE.NOTES, notes);
  }
  function getWordNote(wordId) { return getWordNotes()[wordId]; }

  /* ── Free Notes ── */
  function getFreeNotes() { return load(STORAGE.FREE, []); }
  function saveFreeNote(note) {
    const notes = getFreeNotes();
    const idx = notes.findIndex(n => n.id === note.id);
    if (idx >= 0) notes[idx] = note;
    else notes.unshift({ ...note, id: note.id || uuid(), createdAt: note.createdAt || Date.now() });
    save(STORAGE.FREE, notes);
    return note;
  }
  function deleteFreeNote(id) {
    save(STORAGE.FREE, getFreeNotes().filter(n => n.id !== id));
  }

  /* ── Articles ── */
  function getArticles() { return load(STORAGE.ARTICLES, []); }
  function saveArticle(article) {
    const articles = getArticles();
    const idx = articles.findIndex(a => a.id === article.id);
    if (idx >= 0) articles[idx] = article;
    else articles.unshift({ ...article, id: article.id || uuid(), createdAt: Date.now() });
    save(STORAGE.ARTICLES, articles);
    return article;
  }
  function deleteArticle(id) {
    save(STORAGE.ARTICLES, getArticles().filter(a => a.id !== id));
  }

  /* ── Quiz Generation ── */
  function generateQuizOptions(word, allPool) {
    const others = allPool.filter(w => w.id !== word.id);
    const shuffled = others.sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [word, ...shuffled].sort(() => Math.random() - 0.5);
    return options;
  }

  /* ── Word Set for Study ── */
  function getStudySet(levels, mode, count = 20) {
    const prog = getProgress();
    let pool = getFilteredWords(levels);

    if (mode === 'review') {
      pool = getDueWords(levels);
    } else if (mode === 'new') {
      pool = pool.filter(w => !prog[w.id] || prog[w.id].n === 0);
    } else if (mode === 'error') {
      pool = pool.filter(w => prog[w.id] && prog[w.id].wrong > 0);
    }

    return pool.sort(() => Math.random() - 0.5).slice(0, count);
  }

  return {
    loadWords, getWords, getFilteredWords, getWordById,
    sm2, getProgress, getWordStatus, getDueWords,
    getStatsPerLevel,
    recordDaily, getDaily, getTodayStats, getStreak,
    getTotalStudied, getTotalMastered,
    getSettings, saveSettings,
    getStarred, toggleStar, isStarred,
    getWordNotes, saveWordNote, deleteWordNote, getWordNote,
    getFreeNotes, saveFreeNote, deleteFreeNote,
    getArticles, saveArticle, deleteArticle,
    generateQuizOptions, getStudySet,
    today, uuid,
  };
})();
