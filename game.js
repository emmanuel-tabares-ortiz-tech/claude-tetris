'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const SKINS = {
  retro: {
    name: 'Retro',
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#7986cb', '#ffb74d'],
    bg: null,        // null → clearRect, CSS background shows through
    gridColor: null, // null → use CSS --grid variable
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = this.colors[colorIndex];
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      ctx.globalAlpha = 1;
    },
  },
  neon: {
    name: 'Neon',
    colors: [null, '#00e5ff', '#ffea00', '#e040fb', '#00e676', '#ff1744', '#448aff', '#ff9100'],
    bg: '#050508',
    gridColor: '#0d0d14',
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex];
      const a = alpha ?? 1;
      const px = x * size + 1, py = y * size + 1, pw = size - 2, ph = size - 2;
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(px, py, pw, ph);
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = a * 0.18;
      ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    },
  },
  pastel: {
    name: 'Pastel',
    colors: [null, '#80deea', '#fff59d', '#ce93d8', '#a5d6a7', '#ef9a9a', '#9fa8da', '#ffcc80'],
    bg: '#faf5ff',
    gridColor: '#ede6f5',
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex];
      ctx.globalAlpha = alpha ?? 1;
      const px = x * size + 2, py = y * size + 2, pw = size - 4, ph = size - 4;
      ctx.fillStyle = color;
      ctx.beginPath();
      if (ctx.roundRect) { ctx.roundRect(px, py, pw, ph, 5); } else { ctx.rect(px, py, pw, ph); }
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(px, py, pw, Math.min(ph, 6), [5, 5, 0, 0]);
      } else {
        ctx.rect(px, py, pw, 6);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    },
  },
  pixel: {
    name: 'Pixel',
    colors: [null, '#29b6d4', '#f9a825', '#8e24aa', '#43a047', '#c62828', '#3949ab', '#ef6c00'],
    bg: '#0a0a12',
    gridColor: '#14141e',
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex];
      ctx.globalAlpha = alpha ?? 1;
      const px = x * size, py = y * size;
      ctx.fillStyle = color;
      ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
      // dark right + bottom pixel edge
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(px + size - 3, py + 1, 2, size - 2);
      ctx.fillRect(px + 1, py + size - 3, size - 2, 2);
      // light top + left pixel edge
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(px + 1, py + 1, size - 3, 2);
      ctx.fillRect(px + 1, py + 1, 2, size - 3);
      ctx.globalAlpha = 1;
    },
  },
};

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const SCORES_KEY = 'tetris-scores';
const MAX_SCORES = 5;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const overlayStats = document.getElementById('overlay-stats');
const restartBtn = document.getElementById('restart-btn');
const nameEntry = document.getElementById('name-entry');
const playerNameInput = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const scoresSection = document.getElementById('scores-section');
const scoresTableBody = document.querySelector('#scores-table tbody');
const resetScoresBtn = document.getElementById('reset-scores-btn');
const pauseOverlay = document.getElementById('pause-overlay');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsToggleBtn = document.getElementById('controls-toggle-btn');
const pauseControlsEl = document.getElementById('pause-controls');
const startLevelSelect = document.getElementById('start-level');

let board, current, next, score, lines, level, startLevel, combo, maxCombo, maxLinesCleared,
    paused, gameOver = true, lastTime, dropAccum, dropInterval, animId;
let activeSkin = SKINS[localStorage.getItem('skin') || 'retro'];

// --- localStorage helpers ---

function loadScores() {
  try { return JSON.parse(localStorage.getItem(SCORES_KEY)) || []; }
  catch { return []; }
}

function saveNewScore(name) {
  const scores = loadScores();
  scores.push({ name: name || 'Jugador', score, combo: maxCombo, maxLines: maxLinesCleared });
  scores.sort((a, b) => b.score - a.score);
  scores.splice(MAX_SCORES);
  localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
}

function qualifiesForTop(s) {
  const scores = loadScores();
  return scores.length < MAX_SCORES || s > scores[scores.length - 1].score;
}

function renderScoresTable(highlightScore) {
  const scores = loadScores();
  scoresTableBody.innerHTML = '';
  if (scores.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="5" class="no-records">Sin récords aún</td>';
    scoresTableBody.appendChild(tr);
    return;
  }
  scores.forEach((entry, i) => {
    const tr = document.createElement('tr');
    if (highlightScore !== null && entry.score === highlightScore) tr.classList.add('new-record');
    tr.innerHTML = `<td class="rank">${i + 1}</td>
      <td class="entry-name">${entry.name}</td>
      <td class="entry-score">${entry.score.toLocaleString()}</td>
      <td class="entry-combo">${entry.combo}x</td>
      <td class="entry-lines">${entry.maxLines}</td>`;
    scoresTableBody.appendChild(tr);
  });
}

// --- Board / pieces ---

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    if (cleared > maxLinesCleared) maxLinesCleared = cleared;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + startLevel;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  activeSkin.drawBlock(context, x, y, colorIndex, size, alpha);
}

function drawGrid() {
  const gridColor = activeSkin.gridColor ??
    getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  if (activeSkin.bg) {
    ctx.fillStyle = activeSkin.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  if (activeSkin.bg) {
    nextCtx.fillStyle = activeSkin.bg;
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  } else {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  }
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayTitle.style.color = '';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlayStats.textContent = `Combo: ${maxCombo}x · Máx. líneas: ${maxLinesCleared}`;
  overlayStats.classList.remove('hidden');

  nameEntry.classList.add('hidden');
  scoresSection.classList.add('hidden');

  if (qualifiesForTop(score)) {
    nameEntry.classList.remove('hidden');
    playerNameInput.value = '';
    setTimeout(() => playerNameInput.focus(), 50);
  } else {
    renderScoresTable(null);
    scoresSection.classList.remove('hidden');
  }

  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseOverlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    pauseOverlay.classList.remove('hidden');
  }
}

function showStartScreen() {
  overlayTitle.textContent = 'TETRIS';
  overlayTitle.style.color = 'var(--accent)';
  overlayScore.textContent = '';
  overlayStats.classList.add('hidden');
  nameEntry.classList.add('hidden');
  renderScoresTable(null);
  scoresSection.classList.remove('hidden');
  restartBtn.textContent = 'Jugar';
  overlay.classList.remove('hidden');
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  startLevel = parseInt(startLevelSelect.value, 10) || 1;
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  combo = 0;
  maxCombo = 0;
  maxLinesCleared = 0;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (startLevel - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  nameEntry.classList.add('hidden');
  scoresSection.classList.add('hidden');
  overlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  restartBtn.textContent = 'Reiniciar';
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || (e.code === 'Escape' && !gameOver)) {
    e.preventDefault();
    togglePause();
    return;
  }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', init);
controlsToggleBtn.addEventListener('click', () => {
  const hidden = pauseControlsEl.classList.toggle('hidden');
  controlsToggleBtn.textContent = hidden ? 'Ver controles' : 'Ocultar controles';
});

for (let i = 1; i <= 15; i++) {
  const opt = document.createElement('option');
  opt.value = i;
  opt.textContent = i;
  startLevelSelect.appendChild(opt);
}

function handleSaveScore() {
  const name = playerNameInput.value.trim() || 'Jugador';
  const savedScore = score;
  saveNewScore(name);
  nameEntry.classList.add('hidden');
  renderScoresTable(savedScore);
  scoresSection.classList.remove('hidden');
}

saveScoreBtn.addEventListener('click', handleSaveScore);

playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') handleSaveScore();
  e.stopPropagation();
});

resetScoresBtn.addEventListener('click', () => {
  localStorage.removeItem(SCORES_KEY);
  renderScoresTable(null);
});

function setSkin(name) {
  activeSkin = SKINS[name] || SKINS.retro;
  localStorage.setItem('skin', name);
  canvas.style.background = activeSkin.bg || '';
  nextCanvas.style.background = activeSkin.bg || '';
  document.querySelectorAll('.skin-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.skin === name);
  });
  if (paused || gameOver) draw();
}

document.querySelectorAll('.skin-btn').forEach(btn => {
  btn.addEventListener('click', () => { setSkin(btn.dataset.skin); btn.blur(); });
});

const themeBtn = document.getElementById('theme-toggle');

function applyTheme(theme) {
  const light = theme === 'light';
  if (light) document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  themeBtn.textContent = light ? '🌙' : '☀️';
  themeBtn.setAttribute('aria-label', light ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  if (paused) draw();
}

themeBtn.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('theme', theme);
  applyTheme(theme);
  themeBtn.blur(); // evita que Space/Enter vuelvan a activar el botón durante el juego
});

applyTheme(localStorage.getItem('theme'));
setSkin(localStorage.getItem('skin') || 'retro');

showStartScreen();
