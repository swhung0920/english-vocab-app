/* =====================================================
   APP.JS — UI, Routing, Event Handling
   All pages: Home · Study · Stats · Articles · Notes
   ===================================================== */

const App = (() => {

  /* ════ State ════ */
  let state = {
    page: 'home',
    studyMode: 'flashcard',  // flashcard | quiz | spell | review | error
    studyLevels: [],
    studyWords: [],
    studyIdx: 0,
    studyFlipped: false,
    quizWords: [],
    quizIdx: 0,
    quizScore: 0,
    spellWords: [],
    spellIdx: 0,
    subPage: null,  // e.g. article-reader, note-editor
    currentArticle: null,
    currentNote: null,
    editingNoteId: null,
    noteTab: 'word',  // word | free
    pendingNoteWordId: null,  // for word note modal
  };

  /* ════ Utils ════ */
  const $  = sel => document.querySelector(sel);
  const $$ = sel => [...document.querySelectorAll(sel)];
  const E  = window.Engine;

  function toast(msg, icon = '') {
    const t = $('.toast');
    t.textContent = icon ? `${icon} ${msg}` : msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }

  function levelColor(lv) {
    const m = {A1:'#10b981',A2:'#06b6d4',B1:'#a78bfa',B2:'#f59e0b',C1:'#ef4444',C2:'#ec4899'};
    return m[lv] || '#94a3b8';
  }

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1)   return '剛剛';
    if (m < 60)  return `${m} 分鐘前`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h} 小時前`;
    return `${Math.floor(h/24)} 天前`;
  }

  function shortDate(ts) {
    return new Date(ts).toLocaleDateString('zh-TW', { month:'short', day:'numeric' });
  }

  /* ════ Navigation ════ */
  function navigate(page) {
    $$('.page').forEach(p => p.classList.remove('active'));
    $$('.nav-btn').forEach(b => b.classList.remove('active'));
    const pg = $(`#page-${page}`);
    if (pg) pg.classList.add('active');
    const nb = $(`.nav-btn[data-page="${page}"]`);
    if (nb) nb.classList.add('active');
    state.page = page;
    state.subPage = null;
    renderPage(page);
  }

  function showSubPage(subPage, data) {
    state.subPage = subPage;
    if (subPage === 'article-reader') renderArticleReader(data);
    else if (subPage === 'note-editor') renderNoteEditor(data);
  }

  /* ════ Pages ════ */

  /* ── HOME ── */
  function renderHome() {
    const streak    = E.getStreak();
    const settings  = E.getSettings();
    const todaySt   = E.getTodayStats();
    const due       = E.getDueWords(settings.selectedLevels);
    const pct       = Math.min(1, todaySt.studied / settings.dailyGoal);
    const r         = 44;
    const circ      = 2 * Math.PI * r;
    const offset    = circ - pct * circ;
    const total     = E.getTotalMastered();

    $('#home-streak').textContent     = streak;
    $('#home-studied').textContent    = todaySt.studied;
    $('#home-goal').textContent       = settings.dailyGoal;
    $('#home-mastered').textContent   = total;
    $('#home-ring-fill').style.strokeDashoffset = offset;

    const reviewAlert = $('#review-alert');
    if (due.length > 0) {
      reviewAlert.style.display = 'flex';
      $('#review-count').textContent = due.length;
    } else {
      reviewAlert.style.display = 'none';
    }
  }

  /* ── STUDY ── */
  function renderStudyPage() {
    const settings = E.getSettings();
    state.studyLevels = settings.selectedLevels.length ? settings.selectedLevels : ['A1','A2'];

    // Level pills
    const pillsEl = $('#level-pills');
    pillsEl.innerHTML = ['A1','A2','B1','B2','C1','C2'].map(lv => {
      const active = state.studyLevels.includes(lv) ? `active-${lv.toLowerCase()}` : '';
      return `<button class="level-pill ${active}" data-lv="${lv}">${lv}</button>`;
    }).join('');

    showStudyMode(state.studyMode);
  }

  function showStudyMode(mode) {
    state.studyMode = mode;
    $$('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));

    // Show/hide relevant areas
    const flashcardSection = $('#flashcard-section');
    const quizArea   = $('#quiz-area');
    const spellArea  = $('#spell-area');
    if (flashcardSection) flashcardSection.style.display = (mode === 'flashcard' || mode === 'review' || mode === 'error') ? 'block' : 'none';
    if (quizArea)   quizArea.innerHTML   = '';
    if (spellArea)  spellArea.innerHTML  = '';
    if (quizArea)   quizArea.style.display  = mode === 'quiz'  ? 'block' : 'none';
    if (spellArea)  spellArea.style.display = mode === 'spell' ? 'block' : 'none';

    if (mode === 'flashcard') initFlashcard();
    else if (mode === 'quiz') initQuiz();
    else if (mode === 'spell') initSpell();
    else if (mode === 'review') initReview();
    else if (mode === 'error') initErrorMode();
  }

  /* ── Flashcard ── */
  function initFlashcard() {
    state.studyWords = E.getStudySet(state.studyLevels, 'new', 20);
    state.studyIdx   = 0;
    state.studyFlipped = false;
    if (state.studyWords.length === 0) {
      showFlashcardEmpty();
    } else {
      renderFlashcard();
    }
  }

  function showFlashcardEmpty() {
    const wrap = $('#flashcard-area');
    if (!wrap) return;
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">🎉</div><div class="empty-title">這個等級都學完了！</div><div class="empty-desc">試試切換其他等級，或做 SM2 複習</div></div>`;
    $('#card-actions').style.display = 'none';
    $('#word-tools').style.display = 'none';
  }

  function renderFlashcard() {
    const w = state.studyWords[state.studyIdx];
    if (!w) { showFlashcardComplete(); return; }
    state.studyFlipped = false;

    const wrap = $('#flashcard-area');
    if (!wrap) return;

    const starred = E.isStarred(w.id);
    const hasNote = !!E.getWordNote(w.id);
    const prog    = E.getProgress()[w.id];
    const total   = state.studyWords.length;
    const done    = state.studyIdx;
    const pct     = total > 0 ? (done / total) * 100 : 0;

    // Hide rating buttons until card is flipped
    $('#card-actions').style.display = 'none';
    $('#word-tools').style.display   = 'flex';

    // Build meanings HTML for back face
    const meanings = w.meanings || [{
      pos: w.pos, en_def: w.en_def, example: w.example, context: '📖 一般用法'
    }];

    const meaningsHtml = meanings.map((m, i) => `
      <div class="meaning-item">
        <div class="meaning-header">
          <span class="meaning-pos">${m.pos}</span>
          <span class="meaning-context">${m.context || '📖 一般用法'}</span>
        </div>
        <div class="meaning-en-def">${m.en_def}</div>
        ${m.example ? `<div class="meaning-example-line">${m.example}</div>` : ''}
      </div>`).join('');

    wrap.innerHTML = `
      <div class="flashcard" id="flashcard">
        <div class="flashcard-face flashcard-front">
          <span class="badge badge-${w.level.toLowerCase()}">${w.level}</span>
          <div class="card-word" style="margin-top:12px">${w.word}</div>
          <div class="card-phonetic">${w.phonetic}</div>
          <div class="card-pos-badge"><span class="badge badge-a2">${w.pos}</span></div>
          <div class="card-tap-hint">👆 點擊翻卡看答案</div>
        </div>
        <div class="flashcard-face flashcard-back" style="justify-content:flex-start;padding:16px 14px;overflow:hidden">
          <div class="card-back-scroll">
            <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
              <span class="badge badge-${w.level.toLowerCase()}">${w.level}</span>
              <span style="font-size:20px;font-weight:800;color:var(--cyan-light)">${w.word}</span>
              <span style="font-size:12px;color:var(--text2)">${w.phonetic}</span>
            </div>
            <div class="card-primary-zh">${w.zh}</div>
            <div class="meanings-list">${meaningsHtml}</div>
          </div>
        </div>
      </div>`;


    // Progress bar
    $('#study-progress-fill').style.width = pct + '%';
    $('#study-progress-text').textContent = `${done} / ${total}`;

    // Tool buttons
    $('#btn-star').textContent  = starred ? '⭐' : '☆';
    $('#btn-note').textContent  = hasNote  ? '📝' : '📓';
    $('#btn-note').title        = hasNote  ? '查看筆記' : '加入筆記';
  }

  function flipCard() {
    const card = $('#flashcard');
    if (!card) return;
    state.studyFlipped = !state.studyFlipped;
    card.classList.toggle('flipped', state.studyFlipped);
    // Show rating buttons only after card is flipped
    if (state.studyFlipped) {
      $('#card-actions').style.display = 'flex';
    }
  }
  // Keep App.flipCard for backward compat
  window.App = window.App || {};
  window.App.flipCard = flipCard;

  function rateWord(quality) {
    const w = state.studyWords[state.studyIdx];
    if (!w) return;
    // Only process if card has been flipped
    E.sm2(w.id, quality);
    state.studyIdx++;
    state.studyFlipped = false;
    renderFlashcard();
  }
  // Expose to global for HTML onclick handlers
  window._rateWord = rateWord;
  window.App.rateWord = rateWord;

  function showFlashcardComplete() {
    const wrap = $('#flashcard-area');
    if (!wrap) return;
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">🏆</div><div class="empty-title">本輪完成！</div><div class="empty-desc">今日學習 ${E.getTodayStats().studied} 個單字，繼續保持！</div><button class="btn btn-primary mt-16" onclick="App.initFlashcard()">再來一輪</button></div>`;
    $('#card-actions').style.display = 'none';
    $('#word-tools').style.display   = 'none';
  }

  /* ── Quiz ── */
  function initQuiz() {
    state.quizWords = E.getStudySet(state.studyLevels, 'new', 15);
    state.quizIdx   = 0;
    state.quizScore = 0;
    if (state.quizWords.length < 4) {
      $('#quiz-area').innerHTML = `<div class="empty-state"><div class="empty-icon">😅</div><div class="empty-title">單字不足</div><div class="empty-desc">請多選幾個等級再來測驗</div></div>`;
      return;
    }
    renderQuiz();
  }

  function renderQuiz() {
    const w = state.quizWords[state.quizIdx];
    const area = $('#quiz-area');
    if (!area) return;

    if (!w) { renderQuizResult(); return; }

    const opts = E.generateQuizOptions(w, E.getFilteredWords(state.studyLevels));
    const total = state.quizWords.length;

    // Progress dots
    const dots = state.quizWords.map((_,i) => {
      if (i < state.quizIdx) return `<div class="quiz-dot done"></div>`;
      if (i === state.quizIdx) return `<div class="quiz-dot current"></div>`;
      return `<div class="quiz-dot"></div>`;
    }).join('');

    area.innerHTML = `
      <div class="quiz-progress">${dots}</div>
      <div class="quiz-question">
        <div class="quiz-q-label">這個英文單字的中文意思是？</div>
        <div class="quiz-q-word">${w.word}</div>
        <div class="quiz-q-phonetic">${w.phonetic} &nbsp; <span class="badge badge-${w.level.toLowerCase()}">${w.level}</span></div>
      </div>
      <div class="quiz-options">
        ${opts.map(o => `
          <div class="quiz-option" data-id="${o.id}" onclick="App.answerQuiz(${o.id}, ${w.id})">
            ${o.zh}
          </div>`).join('')}
      </div>`;
  }

  window.App.answerQuiz = (selectedId, correctId) => {
    const correct = selectedId === correctId;
    $$('.quiz-option').forEach(o => {
      o.classList.add('disabled');
      if (+o.dataset.id === correctId) o.classList.add('correct');
      else if (+o.dataset.id === selectedId && !correct) o.classList.add('wrong');
    });
    if (correct) state.quizScore++;
    E.sm2(correctId, correct ? 2 : 0);
    setTimeout(() => { state.quizIdx++; renderQuiz(); }, 900);
  };

  function renderQuizResult() {
    const area = $('#quiz-area');
    const total = state.quizWords.length;
    const pct   = Math.round(state.quizScore / total * 100);
    const emoji = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '📚';
    area.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${emoji}</div>
        <div class="empty-title">測驗結果</div>
        <div class="stat-card" style="margin:16px 0;text-align:center">
          <div class="stat-num purple-num" style="font-size:48px">${pct}%</div>
          <div class="stat-label">${state.quizScore} / ${total} 答對</div>
        </div>
        <div class="empty-desc" style="margin-bottom:16px">${pct >= 80 ? '太厲害了！繼續保持！' : pct >= 50 ? '不錯！繼續加油！' : '繼續練習，你可以的！'}</div>
        <button class="btn btn-primary" onclick="App.initQuiz()">再測一次</button>
      </div>`;
  }

  /* ── Spell Mode ── */
  function initSpell() {
    state.spellWords = E.getStudySet(state.studyLevels, 'new', 15);
    state.spellIdx   = 0;
    renderSpell();
  }

  function renderSpell() {
    const w = state.spellWords[state.spellIdx];
    const area = $('#spell-area');
    if (!area) return;
    if (!w) {
      area.innerHTML = `<div class="empty-state"><div class="empty-icon">✍️</div><div class="empty-title">拼寫完成！</div><button class="btn btn-primary mt-16" onclick="App.initSpell()">再練一次</button></div>`;
      return;
    }
    area.innerHTML = `
      <div class="spell-prompt">
        <div class="spell-zh">${w.zh}</div>
        <div class="spell-hint">${w.pos} · ${w.phonetic}</div>
      </div>
      <div class="spell-input-wrap">
        <input class="spell-input" id="spell-input" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="輸入英文單字..." />
      </div>
      <div class="spell-result" id="spell-result"></div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-primary btn-full" onclick="App.checkSpell(${w.id})">確認</button>
        <button class="btn btn-ghost btn-sm" onclick="App.skipSpell()">跳過</button>
      </div>`;

    const inp = $('#spell-input');
    inp.focus();
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') App.checkSpell(w.id); });
  }

  window.App.checkSpell = (wordId) => {
    const w = E.getWordById(wordId);
    const inp = $('#spell-input');
    const res = $('#spell-result');
    if (!w || !inp) return;
    const val = inp.value.trim().toLowerCase();
    const correct = val === w.word.toLowerCase();
    inp.classList.add(correct ? 'correct' : 'wrong');
    res.classList.add('show', correct ? 'correct' : 'wrong');
    res.textContent = correct ? `✅ 正確！「${w.word}」` : `❌ 正確答案是：${w.word}`;
    E.sm2(wordId, correct ? 3 : 0);
    setTimeout(() => { state.spellIdx++; renderSpell(); }, 1200);
  };
  window.App.skipSpell = () => { state.spellIdx++; renderSpell(); };

  /* ── Review (SM2 due) ── */
  function initReview() {
    const due = E.getDueWords(state.studyLevels);
    if (due.length === 0) {
      $('#study-main-area').innerHTML = `<div class="empty-state" style="padding:48px 20px"><div class="empty-icon">✅</div><div class="empty-title">目前沒有待複習單字</div><div class="empty-desc">SM2 算法會在最佳時機提醒你複習，繼續學新單字吧！</div></div>`;
      return;
    }
    state.studyWords = due;
    state.studyIdx   = 0;
    state.studyMode  = 'flashcard';
    showStudyMode('flashcard');
  }

  /* ── Error mode ── */
  function initErrorMode() {
    state.studyWords = E.getStudySet(state.studyLevels, 'error', 20);
    state.studyIdx   = 0;
    if (state.studyWords.length === 0) {
      $('#flashcard-area').innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><div class="empty-title">沒有錯誤單字</div><div class="empty-desc">目前記錄完美，繼續保持！</div></div>`;
      $('#card-actions').style.display = 'none';
      return;
    }
    state.studyMode = 'flashcard';
    renderFlashcard();
  }

  /* ════ STATS ════ */
  function renderStats() {
    const streak  = E.getStreak();
    const total   = E.getTotalMastered();
    const studied = E.getTotalStudied();
    const today   = E.getTodayStats();

    $('#stat-streak').textContent  = streak;
    $('#stat-mastered').textContent= total;
    $('#stat-total').textContent   = studied;
    $('#stat-today').textContent   = today.studied;

    renderHeatmap();
    renderLevelProgress();
    renderMiniChart();
  }

  function renderHeatmap() {
    const daily = E.getDaily();
    const el    = $('#heatmap');
    if (!el) return;
    const cells = [];
    const d = new Date();
    // fill forward to end of week
    const dayOfWeek = d.getDay(); // 0=Sun
    for (let i = 0; i < (6 - dayOfWeek); i++) cells.unshift(null);
    // 52 weeks backward
    for (let i = 0; i < 52 * 7; i++) {
      const key = d.toISOString().split('T')[0];
      const count = daily[key]?.studied || 0;
      cells.unshift({ key, count });
      d.setDate(d.getDate() - 1);
    }
    // pad start
    const padStart = cells.findIndex(c => c !== null);
    for (let i = 0; i < padStart; i++) cells[i] = { key: '', count: 0 };

    el.innerHTML = cells.map(c => {
      if (!c) return `<div class="heatmap-cell"></div>`;
      const level = c.count >= 20 ? 5 : c.count >= 10 ? 4 : c.count >= 5 ? 3 : c.count >= 2 ? 2 : c.count >= 1 ? 1 : 0;
      return `<div class="heatmap-cell" data-count="${level}" title="${c.key}: ${c.count} 字"></div>`;
    }).join('');
  }

  function renderLevelProgress() {
    const stats = E.getStatsPerLevel();
    const el    = $('#level-progress-list');
    if (!el) return;
    el.innerHTML = stats.map(s => {
      const pct = s.total > 0 ? Math.round(s.mastered / s.total * 100) : 0;
      const lv  = s.level.toLowerCase();
      return `
        <div class="level-progress-item">
          <div class="level-progress-header">
            <span class="level-name"><span class="badge badge-${lv}">${s.level}</span></span>
            <span class="level-pct" style="color:${levelColor(s.level)}">${pct}% <small style="color:var(--text2);font-weight:400">${s.mastered}/${s.total}</small></span>
          </div>
          <div class="level-bar"><div class="level-bar-fill bar-${lv}" style="width:${pct}%"></div></div>
        </div>`;
    }).join('');
  }

  function renderMiniChart() {
    const daily  = E.getDaily();
    const el     = $('#mini-chart');
    if (!el) return;
    const bars   = [];
    const d      = new Date();
    for (let i = 13; i >= 0; i--) {
      const dd = new Date(d);
      dd.setDate(dd.getDate() - i);
      const key   = dd.toISOString().split('T')[0];
      const count = daily[key]?.studied || 0;
      bars.push({ key, count });
    }
    const max = Math.max(...bars.map(b => b.count), 1);
    el.innerHTML = bars.map(b => {
      const h = Math.max(4, (b.count / max) * 100);
      return `<div class="mini-bar" style="height:${h}%" data-val="${b.count}" title="${b.key}: ${b.count} 字"></div>`;
    }).join('');
  }

  /* ════ ARTICLES ════ */
  function renderArticles() {
    const articles = E.getArticles();
    const list     = $('#articles-list');
    if (!list) return;
    if (articles.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">📰</div><div class="empty-title">還沒有文章</div><div class="empty-desc">點擊右下角 + 新增文章，然後點擊單字即可查詢意思！</div></div>`;
      return;
    }
    list.innerHTML = articles.map(a => `
      <div class="article-item" onclick="App.openArticle('${a.id}')">
        <div>
          <div class="title">${escapeHtml(a.title)}</div>
          <div class="meta">${shortDate(a.createdAt)} · ${a.content.length} 字元</div>
        </div>
        <button class="del-btn" onclick="event.stopPropagation();App.deleteArticle('${a.id}')">🗑</button>
      </div>`).join('');
  }

  window.App.openArticle = (id) => {
    const a = E.getArticles().find(a => a.id === id);
    if (!a) return;
    state.currentArticle = a;
    showSubPage('article-reader', a);
  };

  function renderArticleReader(article) {
    const page = $('#page-articles');
    page.innerHTML = `
      <div class="topbar">
        <div class="topbar-row">
          <button class="back-btn" onclick="App.backToArticles()">← </button>
          <div style="flex:1;text-align:center">
            <div style="font-size:15px;font-weight:700">${escapeHtml(article.title)}</div>
          </div>
          <div style="width:40px"></div>
        </div>
      </div>
      <div class="article-reader" id="article-reader-body">${tokenizeArticle(article.content)}</div>
      <div class="word-popup" id="word-popup"></div>`;
  }

  function tokenizeArticle(text) {
    return text.replace(/([a-zA-Z]+)/g, (match) => {
      return `<span class="word-token" onclick="App.lookupWord('${match.toLowerCase()}','${match}')">${match}</span>`;
    });
  }

  window.App.lookupWord = (lower, original) => {
    const w = E.getWords().find(wd => wd.word.toLowerCase() === lower);
    const popup = $('#word-popup');
    if (!popup) return;

    if (!w) {
      popup.innerHTML = `<div style="color:var(--text2);text-align:center;padding:8px">「${original}」 未在詞庫中找到</div>`;
      popup.classList.add('show');
      setTimeout(() => popup.classList.remove('show'), 2000);
      return;
    }

    popup.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div>
          <div class="popup-word">${w.word} <span class="badge badge-${w.level.toLowerCase()}">${w.level}</span></div>
          <div class="popup-phonetic">${w.phonetic} · ${w.pos}</div>
          <div class="popup-def">${w.zh} — ${w.en_def}</div>
          <div class="popup-example">"${w.example}"</div>
        </div>
        <button onclick="$('#word-popup').classList.remove('show')" style="font-size:20px;background:none;border:none;cursor:pointer;color:var(--text2)">✕</button>
      </div>
      <div class="popup-actions">
        <button class="btn btn-ghost btn-sm" onclick="App.addToReview(${w.id})">+ 加入複習</button>
        <button class="btn btn-ghost btn-sm" onclick="App.openWordNoteModal(${w.id})">📝 筆記</button>
      </div>`;
    popup.classList.add('show');
  };

  window.App.backToArticles = () => {
    const page = $('#page-articles');
    state.subPage = null;
    renderPage('articles');
  };

  window.App.addToReview = (wordId) => {
    E.sm2(wordId, 0); // mark for review
    toast('已加入複習佇列', '🔁');
  };

  window.App.deleteArticle = (id) => {
    if (confirm('確定刪除這篇文章？')) {
      E.deleteArticle(id);
      renderArticles();
    }
  };

  /* ════ NOTES ════ */
  function renderNotes() {
    state.noteTab = state.noteTab || 'word';
    const wordNotes = E.getWordNotes();
    const freeNotes = E.getFreeNotes();

    $('#notes-word-tab').classList.toggle('active', state.noteTab === 'word');
    $('#notes-free-tab').classList.toggle('active', state.noteTab === 'free');

    const list = $('#notes-list');
    if (!list) return;

    if (state.noteTab === 'word') {
      const entries = Object.values(wordNotes).sort((a,b) => b.updatedAt - a.updatedAt);
      if (entries.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-title">還沒有單字筆記</div><div class="empty-desc">在學習時點擊「📝 加入筆記」為單字新增個人心得！</div></div>`;
        return;
      }
      list.innerHTML = entries.map(n => {
        const w = E.getWordById(n.wordId);
        return `
          <div class="note-item word-note" onclick="App.openWordNote(${n.wordId})">
            <div class="note-title">📘 ${w ? w.word : '(已刪除)'} <span class="badge badge-${(w?.level||'a1').toLowerCase()}">${w?.level||''}</span></div>
            <div class="note-preview">${escapeHtml(n.content)}</div>
            <div class="note-meta">${timeAgo(n.updatedAt)} · ${w?.zh || ''}</div>
          </div>`;
      }).join('');
    } else {
      if (freeNotes.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="empty-icon">✍️</div><div class="empty-title">還沒有自由筆記</div><div class="empty-desc">點擊右下角 + 新增你的學習心得！</div></div>`;
        return;
      }
      list.innerHTML = freeNotes.map(n => `
        <div class="note-item" onclick="App.openFreeNote('${n.id}')">
          <div class="note-title">📄 ${escapeHtml(n.title || '無標題')}</div>
          <div class="note-preview">${escapeHtml(n.content)}</div>
          <div class="note-meta">${timeAgo(n.updatedAt || n.createdAt)}</div>
        </div>`).join('');
    }
  }

  window.App.openWordNote = (wordId) => {
    const n = E.getWordNote(wordId);
    const w = E.getWordById(wordId);
    if (!n || !w) return;
    state.editingNoteId = wordId;
    showSubPage('note-editor', { type: 'word', word: w, note: n });
  };

  window.App.openFreeNote = (id) => {
    const n = E.getFreeNotes().find(n => n.id === id);
    if (!n) return;
    state.editingNoteId = id;
    showSubPage('note-editor', { type: 'free', note: n });
  };

  window.App.newFreeNote = () => {
    const id = E.uuid();
    state.editingNoteId = id;
    showSubPage('note-editor', { type:'free', note: { id, title:'', content:'', createdAt: Date.now() } });
  };

  function renderNoteEditor(data) {
    const page = $('#page-notes');
    let headerHtml = '';
    if (data.type === 'word' && data.word) {
      const w = data.word;
      headerHtml = `
        <div class="word-note-header">
          <div class="word-note-word">${w.word} <span class="badge badge-${w.level.toLowerCase()}">${w.level}</span></div>
          <div class="word-note-info">${w.phonetic} · ${w.pos} · ${w.zh}</div>
        </div>`;
    }

    page.innerHTML = `
      <div class="topbar">
        <div class="topbar-row">
          <button class="back-btn" onclick="App.saveAndBack()">✓ 儲存</button>
          <div style="flex:1;text-align:center;font-size:15px;font-weight:700">${data.type === 'word' ? '單字筆記' : '自由筆記'}</div>
          <button class="back-btn" onclick="App.deleteNote('${data.type}','${data.type==='word'?data.word?.id:data.note?.id}')">🗑</button>
        </div>
      </div>
      <div class="note-editor">
        ${headerHtml}
        ${data.type === 'free' ? `<input class="note-editor-title" id="note-title-input" value="${escapeHtml(data.note?.title || '')}" placeholder="筆記標題..." />` : ''}
        <textarea class="note-editor-content" id="note-content-input" placeholder="在這裡寫下你的心得、記憶技巧、造句...">${escapeHtml(data.note?.content || '')}</textarea>
      </div>`;
  }

  window.App.saveAndBack = () => {
    const titleEl   = $('#note-title-input');
    const contentEl = $('#note-content-input');
    const content   = contentEl ? contentEl.value : '';
    const title     = titleEl ? titleEl.value : '';

    // Determine if this is a word note or free note
    const wn = E.getWordNote(state.editingNoteId);
    if (wn || E.getWordById(state.editingNoteId)) {
      E.saveWordNote(state.editingNoteId, content);
    } else {
      E.saveFreeNote({ id: state.editingNoteId, title, content, updatedAt: Date.now() });
    }
    toast('已儲存', '✅');
    state.subPage = null;
    renderPage('notes');
  };

  window.App.deleteNote = (type, id) => {
    if (!confirm('確定刪除這則筆記？')) return;
    if (type === 'word') E.deleteWordNote(+id);
    else E.deleteFreeNote(id);
    state.subPage = null;
    renderPage('notes');
  };

  /* ════ WORD NOTE MODAL ════ */
  window.App.openWordNoteModal = (wordId) => {
    const w = E.getWordById(wordId);
    if (!w) return;
    state.pendingNoteWordId = wordId;
    const existing = E.getWordNote(wordId);

    const modal = $('#modal-overlay');
    $('#modal-word-info').innerHTML = `
      <div class="word-note-header">
        <div class="word-note-word">${w.word} <span class="badge badge-${w.level.toLowerCase()}">${w.level}</span></div>
        <div class="word-note-info">${w.phonetic} · ${w.pos} · ${w.zh}</div>
      </div>`;
    $('#modal-note-input').value = existing?.content || '';
    modal.classList.remove('hidden');
    $('#modal-note-input').focus();
    // close word popup
    const popup = $('#word-popup');
    if (popup) popup.classList.remove('show');
  };

  window.App.saveModalNote = () => {
    const content = $('#modal-note-input').value;
    if (state.pendingNoteWordId) {
      E.saveWordNote(state.pendingNoteWordId, content);
      toast('筆記已儲存', '📝');
      // refresh star/note buttons if in flashcard
      const w = state.studyWords[state.studyIdx - 1];
      if (w) { $('#btn-note').textContent = '📝'; }
    }
    closeModal();
  };

  window.App.closeModal = closeModal;
  function closeModal() {
    $('#modal-overlay').classList.add('hidden');
    state.pendingNoteWordId = null;
  }

  /* ════ SETTINGS ════ */
  function renderSettings() {
    const s = E.getSettings();
    $('#setting-goal').value = s.dailyGoal;
    const levels = ['A1','A2','B1','B2','C1','C2'];
    $('#setting-levels').innerHTML = levels.map(lv => {
      const active = s.selectedLevels.includes(lv) ? `active-${lv.toLowerCase()}` : '';
      return `<button class="level-pill ${active}" data-lv="${lv}" onclick="App.toggleSettingLevel('${lv}')">${lv}</button>`;
    }).join('');
  }

  window.App.toggleSettingLevel = (lv) => {
    const s = E.getSettings();
    if (s.selectedLevels.includes(lv)) {
      if (s.selectedLevels.length > 1) s.selectedLevels = s.selectedLevels.filter(x => x !== lv);
    } else {
      s.selectedLevels.push(lv);
    }
    E.saveSettings(s);
    renderSettings();
  };

  window.App.saveGoal = () => {
    const val = +($('#setting-goal').value);
    if (val > 0 && val <= 500) {
      const s = E.getSettings();
      s.dailyGoal = val;
      E.saveSettings(s);
      toast('設定已儲存', '✅');
    }
  };

  window.App.resetProgress = () => {
    if (confirm('確定重置所有學習進度？此操作無法復原！')) {
      localStorage.removeItem('va_progress');
      localStorage.removeItem('va_daily');
      toast('進度已重置', '🔄');
      renderPage('home');
    }
  };

  /* ════ Page Router ════ */
  function renderPage(page) {
    if (page === 'home')     renderHome();
    else if (page === 'study') renderStudyPage();
    else if (page === 'stats') renderStats();
    else if (page === 'articles') { state.subPage = null; restoreArticlesPage(); renderArticles(); }
    else if (page === 'notes')    { state.subPage = null; restoreNotesPage(); renderNotes(); }
    else if (page === 'settings') renderSettings();
  }

  function restoreArticlesPage() {
    const page = $('#page-articles');
    page.innerHTML = `
      <div class="topbar">
        <div class="topbar-row">
          <div><h1>📰 文章閱讀</h1><div class="sub">點擊單字即時查詢</div></div>
        </div>
      </div>
      <div class="articles-list" id="articles-list"></div>
      <button class="fab" onclick="App.showAddArticle()">＋</button>`;
  }

  function restoreNotesPage() {
    const page = $('#page-notes');
    page.innerHTML = `
      <div class="topbar notes-header">
        <div class="topbar-row"><div><h1>📝 筆記</h1><div class="sub">單字心得 & 自由筆記</div></div></div>
      </div>
      <div class="notes-tabs">
        <div class="notes-tab active" id="notes-word-tab" onclick="App.switchNoteTab('word')">📘 單字筆記</div>
        <div class="notes-tab" id="notes-free-tab" onclick="App.switchNoteTab('free')">✍️ 自由筆記</div>
      </div>
      <div class="notes-list" id="notes-list"></div>
      <button class="fab" id="notes-fab" style="display:none" onclick="App.newFreeNote()">＋</button>`;
  }

  window.App.switchNoteTab = (tab) => {
    state.noteTab = tab;
    $('#notes-fab').style.display = tab === 'free' ? 'flex' : 'none';
    renderNotes();
  };

  /* ════ Add Article Modal ════ */
  window.App.showAddArticle = () => {
    const modal = $('#modal-overlay');
    $('#modal-word-info').innerHTML = `<div class="modal-title">新增文章</div>`;
    $('#modal-note-input').placeholder = '貼上文章標題（第一行）+ 內容...';
    $('#modal-note-input').value = '';
    $('#modal-save-btn').textContent = '新增文章';
    $('#modal-save-btn').onclick = App.saveArticle;
    modal.classList.remove('hidden');
    setTimeout(() => { $('#modal-save-btn').onclick = App.saveModalNote; }, 0);

    // Override modal for article
    $('#modal-word-info').innerHTML = `
      <div class="modal-title">新增文章</div>
      <input class="note-editor-title" id="article-title-input" placeholder="文章標題" style="margin-bottom:10px" />`;
    $('#modal-note-input').style.minHeight = '200px';
    $('#modal-note-input').placeholder = '貼上文章內容...';
    $('#modal-save-btn').onclick = () => {
      const title   = $('#article-title-input')?.value || '未命名文章';
      const content = $('#modal-note-input').value;
      if (!content.trim()) { toast('請輸入文章內容','⚠️'); return; }
      E.saveArticle({ title, content });
      closeModal();
      renderArticles();
      toast('文章已新增','📰');
    };
  };

  /* ════ Events ════ */
  function bindEvents() {
    // Nav
    $$('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.page));
    });

    // Mode tabs
    document.addEventListener('click', e => {
      if (e.target.classList.contains('mode-tab')) {
        showStudyMode(e.target.dataset.mode);
      }
      if (e.target.classList.contains('level-pill') && e.target.closest('#level-pills')) {
        const lv = e.target.dataset.lv;
        const s  = E.getSettings();
        if (s.selectedLevels.includes(lv)) {
          if (s.selectedLevels.length > 1) s.selectedLevels = s.selectedLevels.filter(x => x !== lv);
        } else {
          s.selectedLevels.push(lv);
        }
        E.saveSettings(s);
        state.studyLevels = s.selectedLevels;
        renderStudyPage();
      }
    });

    // Flashcard click / touch — handle both desktop click & iOS touch
    const fcArea = document.getElementById('flashcard-area');
    if (fcArea) {
      let _touchMoved = false;

      fcArea.addEventListener('touchstart', () => {
        _touchMoved = false;
      }, { passive: true });

      fcArea.addEventListener('touchmove', () => {
        _touchMoved = true;
      }, { passive: true });

      fcArea.addEventListener('touchend', e => {
        if (!_touchMoved && e.target.closest('#flashcard')) {
          e.preventDefault();   // prevent ghost click
          flipCard();
        }
      });

      // Desktop fallback
      fcArea.addEventListener('click', e => {
        if (e.target.closest('#flashcard')) flipCard();
      });
    }

    // Rating buttons handled via card-actions delegation below

    // Star & Note buttons — use event delegation to always get current word
    document.getElementById('btn-star')?.addEventListener('click', () => {
      const w = state.studyWords[state.studyIdx];
      if (!w) return;
      const starred = E.toggleStar(w.id);
      document.getElementById('btn-star').textContent = starred ? '⭐' : '☆';
      toast(starred ? '已收藏' : '已取消收藏', starred ? '⭐' : '');
    });

    document.getElementById('btn-note')?.addEventListener('click', () => {
      const w = state.studyWords[state.studyIdx];
      if (!w) return;
      App.openWordNoteModal(w.id);
    });

    document.getElementById('btn-tts')?.addEventListener('click', () => {
      const w = state.studyWords[state.studyIdx];
      if (!w) return;
      const utter = new SpeechSynthesisUtterance(w.word);
      utter.lang = 'en-US';
      speechSynthesis.speak(utter);
    });

    // Rating buttons — use event delegation (fixes double-binding issue)
    document.getElementById('card-actions')?.addEventListener('click', e => {
      const btn = e.target.closest('.action-btn');
      if (btn && btn.dataset.q !== undefined) {
        // Remove HTML onclick to prevent double call
        rateWord(+btn.dataset.q);
      }
    });

    // Review alert
    document.getElementById('review-alert')?.addEventListener('click', () => {
      navigate('study');
      state.studyMode = 'review';
      setTimeout(() => showStudyMode('review'), 100);
    });

    // Mode cards on home
    document.querySelectorAll('.mode-card').forEach(card => {
      card.addEventListener('click', () => {
        navigate('study');
        const m = card.dataset.mode;
        if (m) setTimeout(() => { state.studyMode = m; showStudyMode(m); }, 100);
      });
    });

    // Modal close on backdrop click
    document.getElementById('modal-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'modal-overlay') closeModal();
    });
  }

  /* ════ Helpers ════ */
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // Re-expose helpers
  window.App.initFlashcard = initFlashcard;
  window.App.initQuiz      = initQuiz;
  window.App.initSpell     = initSpell;
  window.App.navigate      = navigate;

  /* ════ Init ════ */
  async function init() {
    await E.loadWords();

    // Set initial levels from settings
    const s = E.getSettings();
    state.studyLevels = s.selectedLevels;

    // Hide loading
    setTimeout(() => {
      document.getElementById('loading-screen').style.opacity = '0';
      setTimeout(() => { document.getElementById('loading-screen').style.display = 'none'; }, 300);
    }, 800);

    navigate('home');
    bindEvents();

    // Register SW
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  return { init };
})();

// Global alias so HTML inline onclick works
window.App = window.App || {};
Object.assign(window.App, {
  navigate: (p) => App.navigate(p),
});

document.addEventListener('DOMContentLoaded', () => App.init());
