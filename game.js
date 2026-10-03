'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const SKINS = {
  retro: {
    name: 'Retro',
    colors: [null, '#7aa2f7', '#9ece6a', '#e0af68', '#f7768e', '#ad8ee6', '#2ac3de', '#ff9e64'],
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex];
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = color;
      ctx.fillRect(x * size, y * size, size, size);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(x * size, y * size, size, 3);
      ctx.fillRect(x * size, y * size, 3, size);
      ctx.globalAlpha = 1;
    },
  },
  neon: {
    name: 'Neon',
    colors: [null, '#00f5ff', '#39ff14', '#ff6600', '#ff0090', '#bf00ff', '#00bfff', '#ffff00'],
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex];
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = color;
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      ctx.restore();
    },
  },
  pastel: {
    name: 'Pastel',
    colors: [null, '#a8c8ff', '#b8f0a0', '#ffe0a0', '#ffb8c8', '#d0b8f0', '#a0e8f0', '#ffd0a0'],
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex];
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = color;
      const r = size * 0.2;
      ctx.beginPath();
      ctx.roundRect(x * size + 1, y * size + 1, size - 2, size - 2, r);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.roundRect(x * size + 3, y * size + 3, size - 8, size - 8, r / 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    },
  },
  pixel: {
    name: 'Pixel Art',
    colors: [null, '#5577cc', '#66aa44', '#cc8833', '#cc4455', '#8855bb', '#3399bb', '#cc7733'],
    drawBlock(ctx, x, y, colorIndex, size, alpha) {
      if (!colorIndex) return;
      const color = this.colors[colorIndex];
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = color;
      ctx.fillRect(x * size, y * size, size, size);
      const dotSize = size / 5;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          ctx.fillRect(x * size + col * dotSize + dotSize * 0.5, y * size + row * dotSize + dotSize * 0.5, dotSize * 0.4, dotSize * 0.4);
        }
      }
      ctx.globalAlpha = 1;
    },
  },
};

let activeSkin = SKINS.retro;

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
const restartBtn = document.getElementById('restart-btn');
const skinSelector = document.getElementById('skin-selector');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

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
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
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

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      activeSkin.drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        activeSkin.drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      activeSkin.drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      activeSkin.drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
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
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
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

function applySkin(id) {
  activeSkin = SKINS[id] || SKINS.retro;
  localStorage.setItem('tetris_skin', id);
  skinSelector.value = id;
  if (board) { draw(); drawNext(); }
}

skinSelector.addEventListener('change', e => applySkin(e.target.value));

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

applySkin(localStorage.getItem('tetris_skin') || 'retro');

init();
