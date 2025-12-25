const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const streakEl = document.getElementById('streak');
const energyEl = document.getElementById('energy');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const hardBtn = document.getElementById('hardBtn');

const state = {
  running: false,
  hardMode: false,
  score: 0,
  streak: 0,
  energy: 3,
  frame: 0,
};

const player = {
  x: 100,
  y: canvas.height / 2,
  size: 28,
  speed: 4,
};

const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
const orbs = [];
const meteors = [];

function resetGame() {
  state.running = false;
  state.score = 0;
  state.streak = 0;
  state.energy = 3;
  state.frame = 0;
  player.x = 100;
  player.y = canvas.height / 2;
  orbs.length = 0;
  meteors.length = 0;
  render();
  syncUI();
}

function syncUI() {
  scoreEl.textContent = state.score;
  streakEl.textContent = `${state.streak}x`;
  energyEl.textContent = state.energy;
  hardBtn.textContent = state.hardMode ? 'Hard: ON' : 'Hard: OFF';
}

function spawnOrb() {
  const worth = state.hardMode ? 30 : 15;
  orbs.push({
    x: canvas.width + 20,
    y: 40 + Math.random() * (canvas.height - 80),
    size: 12,
    speed: state.hardMode ? 4 : 3,
    worth,
  });
}

function spawnMeteor() {
  meteors.push({
    x: canvas.width + 40,
    y: 40 + Math.random() * (canvas.height - 80),
    size: 22 + Math.random() * 18,
    speed: state.hardMode ? 5 : 3.5,
  });
}

function update() {
  if (!state.running) return;
  state.frame++;

  const speedBoost = state.hardMode ? 1.4 : 1;
  if (keys.ArrowUp) player.y -= player.speed * speedBoost;
  if (keys.ArrowDown) player.y += player.speed * speedBoost;
  if (keys.ArrowLeft) player.x -= player.speed * speedBoost;
  if (keys.ArrowRight) player.x += player.speed * speedBoost;
  player.x = Math.max(player.size, Math.min(canvas.width - player.size, player.x));
  player.y = Math.max(player.size, Math.min(canvas.height - player.size, player.y));

  if (state.frame % 90 === 0) spawnOrb();
  if (state.frame % (state.hardMode ? 85 : 120) === 0) spawnMeteor();

  updateObjects(orbs);
  updateObjects(meteors);

  handleCollisions();
  render();
  requestAnimationFrame(update);
}

function updateObjects(list) {
  for (let i = list.length - 1; i >= 0; i--) {
    list[i].x -= list[i].speed;
    if (list[i].x < -50) list.splice(i, 1);
  }
}

function handleCollisions() {
  for (let i = orbs.length - 1; i >= 0; i--) {
    if (collides(player, orbs[i])) {
      state.score += orbs[i].worth + state.streak * 5;
      state.streak = Math.min(state.streak + 1, 5);
      state.energy = Math.min(state.energy + 1, 8);
      orbs.splice(i, 1);
      syncUI();
    }
  }

  for (let i = meteors.length - 1; i >= 0; i--) {
    if (collides(player, meteors[i])) {
      state.energy -= 1;
      state.streak = 0;
      meteors.splice(i, 1);
      if (state.energy <= 0) {
        state.running = false;
      }
      syncUI();
    }
  }
}

function collides(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dist = Math.hypot(dx, dy);
  return dist < a.size + b.size;
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // background grid
  ctx.strokeStyle = 'rgba(246,196,83,0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  drawGlowCircle(player.x, player.y, player.size, '#f6c453');

  orbs.forEach((o) => drawGlowCircle(o.x, o.y, o.size, '#ffdf91'));
  meteors.forEach((m) => drawGlowCircle(m.x, m.y, m.size, '#ff7b54'));

  if (!state.running) {
    ctx.fillStyle = 'rgba(0,0,0,0.68)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f6c453';
    ctx.font = '32px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press Start to run', canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = '18px Orbitron, sans-serif';
    ctx.fillText('Arrow keys to move, avoid meteors, catch orbs', canvas.width / 2, canvas.height / 2 + 24);
  }
}

function drawGlowCircle(x, y, radius, color) {
  const gradient = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function startGame() {
  if (!state.running) {
    state.running = true;
    state.frame = 0;
    update();
  }
}

function toggleHard() {
  state.hardMode = !state.hardMode;
  syncUI();
}

startBtn.addEventListener('click', startGame);
resetBtn.addEventListener('click', resetGame);
hardBtn.addEventListener('click', toggleHard);

window.addEventListener('keydown', (e) => {
  if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
  if (e.key === 'Enter') startGame();
});
window.addEventListener('keyup', (e) => { if (keys.hasOwnProperty(e.key)) keys[e.key] = false; });

resetGame();