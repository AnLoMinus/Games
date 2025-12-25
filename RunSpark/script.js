/* ============================================================================
    🧩 RunSpark (RS) — Endless Runner
    📅 25 בדצמבר 2025 | ד׳ טבת תשפ״ו
    🕒 15:54 (Asia/Jerusalem)
    ✅ Single-file: HTML + CSS + JS (No external libs/assets)
  ============================================================================ */

  const CONFIG = {
    // Physics
    gravity: 2600,           // px/s^2
    jumpForce: 980,          // initial velocity (px/s)
    doubleJumpForce: 900,    // for optional double jump
    groundPad: 84,           // ground thickness visual
    player: { w: 46, h: 56 },

    // Speed & difficulty
    startSpeed: 520,         // px/s (world moves left)
    speedIncreaseRate: 14,   // px/s per second (ramps)
    maxSpeed: 1600,

    // Obstacles
    obstacleSpawnMin: 0.55,  // seconds
    obstacleSpawnMax: 1.25,  // seconds
    obstacleGapSafe: 90,     // minimum gap from last spawn (px, converted)
    obstacleTypes: {
      spike: { w: 34, h: 40, yMode: "ground",  score: 25 },
      wall:  { w: 40, h: 74, yMode: "ground",  score: 35 },
      drone: { w: 42, h: 32, yMode: "air",     score: 45 } // flying obstacle
    },

    // Lives & i-frames
    maxLives: 3,
    invincibleTime: 1.1,     // seconds
    hitStop: 0.06,           // seconds small freeze feel

    // Powerups
    powerupChance: 0.16,     // chance per spawn cycle window
    powerupMinInterval: 6.5, // seconds between powerups
    powerupDuration: { shield: 0, slow: 3.2 },
    slowFactor: 0.55,

    // Juice
    screenShake: { hit: 14, land: 4 },
    particles: {
      runRate: 42,           // particles per second
      max: 260
    },

    // Audio
    volume: 0.22,

    // Rendering
    laneY: 0.78,             // player baseline relative height
    floorLine: 0.865         // floor relative height
  };

  // DOM
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const frame = document.getElementById("frame");

  const elDist  = document.getElementById("dist");
  const elScore = document.getElementById("score");
  const elSpeed = document.getElementById("speed");
  const elLives = document.getElementById("lives");
  const elHi    = document.getElementById("hi");

  const startOverlay = document.getElementById("startOverlay");
  const overOverlay  = document.getElementById("overOverlay");

  const btnStart     = document.getElementById("btnStart");
  const btnRestart   = document.getElementById("btnRestart");
  const btnBackMenu  = document.getElementById("btnBackToMenu");
  const btnPause     = document.getElementById("btnPause");
  const btnMute      = document.getElementById("btnMute");
  const btnToggleDJ  = document.getElementById("btnToggleDJ");
  const btnResetHi   = document.getElementById("btnResetHi");

  const elFinalScore = document.getElementById("finalScore");
  const elFinalDist  = document.getElementById("finalDist");
  const elFinalHi    = document.getElementById("finalHi");
  const elFinalSpd   = document.getElementById("finalSpd");
  const elOverText   = document.getElementById("overText");

  // Storage
  const STORAGE = {
    hi: "RS_hiScore_v1",
    mute: "RS_mute_v1",
    dj: "RS_doubleJump_v1"
  };

  // State
  const state = {
    running: false,
    paused: false,
    gameOver: false,
    time: 0,
    dt: 0,
    lastT: 0,

    width: 0, height: 0, dpr: 1,

    // gameplay
    speed: CONFIG.startSpeed,
    baseSpeed: CONFIG.startSpeed,
    distance: 0,
    score: 0,
    hiScore: Number(localStorage.getItem(STORAGE.hi) || 0),

    lives: CONFIG.maxLives,
    invincible: 0,
    hitStop: 0,

    // options
    muted: (localStorage.getItem(STORAGE.mute) === "1"),
    doubleJump: (localStorage.getItem(STORAGE.dj) === "1"),

    // powerups
    shield: false,
    slow: 0,
    lastPowerupAt: -999,

    // camera/juice
    shake: 0,
    shakeX: 0,
    shakeY: 0,

    // world
    obstacles: [],
    powerups: [],
    particles: [],

    // timers
    spawnIn: 0.9,
    lastSpawnX: 0,

    // player
    p: {
      x: 0, y: 0,
      w: CONFIG.player.w, h: CONFIG.player.h,
      vy: 0,
      onGround: true,
      canDouble: false,
      squash: 0
    }
  };

  // Audio (WebAudio synth)
  let audioCtx = null;
  function ensureAudio(){
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  function beep({freq=440, dur=0.08, type="sine", gain=0.18, slide=0, noise=false}={}){
    if (state.muted) return;
    ensureAudio();
    const t0 = audioCtx.currentTime;
    const g = audioCtx.createGain();
    g.gain.value = 0.0001;
    g.connect(audioCtx.destination);

    if (noise){
      // noise burst
      const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
      const src = audioCtx.createBufferSource();
      src.buffer = buffer;
      src.connect(g);
      g.gain.setTargetAtTime(gain*CONFIG.volume, t0, 0.005);
      g.gain.setTargetAtTime(0.0001, t0 + dur, 0.02);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
      return;
    }

    const o = audioCtx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40,freq*slide), t0 + dur);

    o.connect(g);
    g.gain.setTargetAtTime(gain*CONFIG.volume, t0, 0.01);
    g.gain.setTargetAtTime(0.0001, t0 + dur, 0.03);

    o.start(t0);
    o.stop(t0 + dur + 0.06);
  }

  function setMute(m){
    state.muted = m;
    localStorage.setItem(STORAGE.mute, m ? "1":"0");
    btnMute.classList.toggle("on", !m);
    btnMute.classList.toggle("off", m);
    btnMute.querySelector(".dot").className = "dot " + (!m ? "" : "");
    btnMute.innerHTML = `<span class="dot ${!m ? "" : ""}"></span>${m ? "🔇 Muted" : "🔊 Sound"}`;
    if (!m) beep({freq: 660, dur: 0.07, type:"triangle", gain:0.16, slide: 0.8});
  }

  function setDoubleJump(v){
    state.doubleJump = v;
    localStorage.setItem(STORAGE.dj, v ? "1":"0");
    btnToggleDJ.textContent = `✨ Double Jump: ${v ? "ON" : "OFF"}`;
    beep({freq: v ? 780 : 420, dur: 0.08, type:"square", gain:0.12, slide: 0.9});
  }

  // Helpers
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const rand = (a,b)=>a+Math.random()*(b-a);
  const irand = (a,b)=>Math.floor(rand(a,b+1));
  function aabb(a,b){
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function resize(){
    const r = frame.getBoundingClientRect();
    state.dpr = Math.max(1, Math.min(2.25, window.devicePixelRatio || 1));
    state.width = Math.floor(r.width * state.dpr);
    state.height = Math.floor(r.height * state.dpr);
    canvas.width = state.width;
    canvas.height = state.height;
    canvas.style.width = r.width + "px";
    canvas.style.height = r.height + "px";
    resetPlayerPosition();
  }

  function worldFloorY(){
    return Math.floor(state.height * CONFIG.floorLine);
  }

  function resetPlayerPosition(){
    const floor = worldFloorY();
    state.p.x = Math.floor(state.width * 0.22);
    state.p.y = floor - state.p.h;
  }

  function heartsStr(n){
    return "❤️".repeat(n) + "🖤".repeat(Math.max(0, CONFIG.maxLives - n));
  }

  // Obstacles & powerups
  function spawnObstacle(){
    const keys = Object.keys(CONFIG.obstacleTypes);
    // Weighted choice: more spikes than drones
    const roll = Math.random();
    const typeKey = roll < 0.55 ? "spike" : (roll < 0.85 ? "wall" : "drone");
    const t = CONFIG.obstacleTypes[typeKey];

    const floor = worldFloorY();
    const w = Math.round(t.w * state.dpr);
    const h = Math.round(t.h * state.dpr);

    let y = floor - h;
    if (t.yMode === "air"){
      // hover roughly mid-air
      const minY = Math.floor(state.height * 0.48);
      const maxY = Math.floor(state.height * 0.66);
      y = irand(minY, maxY) - h;
    }

    const ob = {
      kind: "obstacle",
      type: typeKey,
      x: state.width + Math.round(40*state.dpr),
      y, w, h,
      passed: false,
      scoreValue: t.score
    };
    state.obstacles.push(ob);

    // Powerup roll (sparse + interval)
    const now = state.time;
    const canSpawnPU = (now - state.lastPowerupAt) > CONFIG.powerupMinInterval;
    if (canSpawnPU && Math.random() < CONFIG.powerupChance){
      state.lastPowerupAt = now;
      spawnPowerupNear(ob);
    }
  }

  function spawnPowerupNear(ob){
    const kind = (Math.random() < 0.55) ? "shield" : "slow";
    const floor = worldFloorY();

    const size = Math.round(30 * state.dpr);
    let y = floor - size - Math.round(70*state.dpr);
    // keep it reachable
    y = clamp(y, Math.round(state.height*0.35), floor - size - Math.round(22*state.dpr));

    state.powerups.push({
      kind: "powerup",
      type: kind,
      x: ob.x + ob.w + Math.round(rand(120, 220)*state.dpr),
      y,
      w: size,
      h: size,
      t: 0
    });
  }

  // Particles
  function emitRunParticles(dt){
    if (!state.running || state.paused || state.gameOver) return;
    const rate = CONFIG.particles.runRate;
    const count = rate * dt;
    const floor = worldFloorY();
    const px = state.p.x + Math.round(10*state.dpr);
    const py = floor - Math.round(8*state.dpr);

    for (let i=0;i<count;i++){
      if (state.particles.length >= CONFIG.particles.max) break;
      state.particles.push({
        x: px + rand(-2,2)*state.dpr,
        y: py + rand(-2,2)*state.dpr,
        vx: -rand(120, 260)*state.dpr - state.speed*0.35,
        vy: -rand(40, 160)*state.dpr,
        life: rand(0.25, 0.55),
        max: 0,
        size: rand(1.2, 2.6)*state.dpr
      });
    }
  }

  function updateParticles(dt){
    for (let i=state.particles.length-1;i>=0;i--){
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (CONFIG.gravity*0.18) * dt;
      if (p.life <= 0) state.particles.splice(i,1);
    }
  }

  // Input
  function jump(){
    if (!state.running || state.paused || state.gameOver) return;

    if (state.p.onGround){
      state.p.vy = -CONFIG.jumpForce * state.dpr;
      state.p.onGround = false;
      state.p.canDouble = state.doubleJump;
      state.p.squash = 1.0;
      beep({freq: 620, dur: 0.07, type:"triangle", gain:0.16, slide: 1.25});
      return;
    }

    if (state.doubleJump && state.p.canDouble){
      state.p.vy = -CONFIG.doubleJumpForce * state.dpr;
      state.p.canDouble = false;
      state.p.squash = 0.9;
      beep({freq: 820, dur: 0.06, type:"square", gain:0.12, slide: 1.1});
    }
  }

  function togglePause(){
    if (!state.running || state.gameOver) return;
    state.paused = !state.paused;
    btnPause.querySelector(".dot").classList.toggle("warn", state.paused);
    btnPause.innerHTML = `<span class="dot ${state.paused ? "warn":""}"></span>${state.paused ? "▶️ Resume" : "⏸️ Pause"}`;
    beep({freq: state.paused ? 380 : 520, dur: 0.06, type:"sine", gain:0.10, slide: 0.85});
  }

  // Game lifecycle
  function init(){
    elHi.textContent = state.hiScore;
    setMute(state.muted);
    setDoubleJump(state.doubleJump);

    resize();
    window.addEventListener("resize", resize);

    // controls
    window.addEventListener("keydown", (e)=>{
      if (e.code === "Space"){
        e.preventDefault();
        if (!state.running) return;
        jump();
      }
      if (e.code === "KeyP"){
        e.preventDefault();
        togglePause();
      }
      if (e.code === "Enter"){
        if (!state.running) startGame();
        else if (state.gameOver) restart();
      }
    }, {passive:false});

    // click/touch anywhere on frame to jump (avoid buttons)
    const onPointer = (e)=>{
      const t = e.target;
      if (t && (t.id === "btnStart" || t.id === "btnRestart" || t.id === "btnBackToMenu" || t.id === "btnPause" || t.id === "btnMute" || t.id === "btnToggleDJ" || t.id === "btnResetHi")) return;
      if (!state.running) return;
      jump();
    };
    frame.addEventListener("pointerdown", onPointer, {passive:true});

    // UI buttons
    btnStart.addEventListener("click", startGame);
    btnRestart.addEventListener("click", restart);
    btnBackMenu.addEventListener("click", backToMenu);
    btnPause.addEventListener("click", togglePause);
    btnMute.addEventListener("click", ()=>setMute(!state.muted));
    btnToggleDJ.addEventListener("click", ()=>setDoubleJump(!state.doubleJump));
    btnResetHi.addEventListener("click", ()=>{
      state.hiScore = 0;
      localStorage.setItem(STORAGE.hi, "0");
      elHi.textContent = 0;
      beep({freq: 260, dur: 0.09, type:"sawtooth", gain:0.12, slide: 0.7});
    });

    // warm render
    state.lastT = performance.now();
    requestAnimationFrame(loop);
  }

  function startGame(){
    ensureAudio(); // user gesture button click triggers audio unlock
    startOverlay.classList.add("hidden");
    overOverlay.classList.add("hidden");

    state.running = true;
    state.paused = false;
    state.gameOver = false;

    reset();
    beep({freq: 540, dur: 0.07, type:"triangle", gain:0.18, slide: 1.15});
    beep({freq: 720, dur: 0.08, type:"sine", gain:0.12, slide: 1.05});
  }

  function reset(){
    state.time = 0;
    state.distance = 0;
    state.score = 0;
    state.lives = CONFIG.maxLives;
    state.invincible = 0;
    state.hitStop = 0;

    state.speed = CONFIG.startSpeed;
    state.baseSpeed = CONFIG.startSpeed;

    state.shield = false;
    state.slow = 0;

    state.obstacles.length = 0;
    state.powerups.length = 0;
    state.particles.length = 0;

    state.spawnIn = rand(CONFIG.obstacleSpawnMin, CONFIG.obstacleSpawnMax);
    state.lastSpawnX = 0;

    resetPlayerPosition();
    state.p.vy = 0;
    state.p.onGround = true;
    state.p.canDouble = false;
    state.p.squash = 0;

    elLives.textContent = heartsStr(state.lives);
    elScore.textContent = "0";
    elDist.textContent = "0";
    elSpeed.textContent = String(Math.round(state.speed / state.dpr));
    elHi.textContent = state.hiScore;
  }

  function restart(){
    startGame();
  }

  function backToMenu(){
    state.running = false;
    state.paused = false;
    state.gameOver = false;
    startOverlay.classList.remove("hidden");
    overOverlay.classList.add("hidden");
    reset();
  }

  function gameOver(){
    state.gameOver = true;
    state.running = true; // keep loop for background render
    overOverlay.classList.remove("hidden");

    // update hi-score
    if (state.score > state.hiScore){
      state.hiScore = state.score;
      localStorage.setItem(STORAGE.hi, String(state.hiScore));
    }
    elHi.textContent = state.hiScore;

    elFinalScore.textContent = state.score;
    elFinalDist.textContent = Math.floor(state.distance);
    elFinalHi.textContent = state.hiScore;
    elFinalSpd.textContent = Math.round(state.speed / state.dpr);

    elOverText.textContent = `הניקוד שלך: ${state.score} | מרחק: ${Math.floor(state.distance)} | שיא: ${state.hiScore}`;
    beep({freq: 160, dur: 0.12, type:"sawtooth", gain:0.18, slide: 0.6});
    beep({noise:true, dur: 0.10, gain:0.16});
  }

  // Update & Render
  function loop(t){
    const rawDt = (t - state.lastT) / 1000;
    state.lastT = t;

    // clamp dt for stability
    let dt = clamp(rawDt, 0, 1/24);
    state.dt = dt;

    if (state.running && !state.paused){
      // hit-stop small freeze
      if (state.hitStop > 0){
        state.hitStop -= dt;
        dt = 0;
      } else {
        update(dt);
      }
    }

    render();
    requestAnimationFrame(loop);
  }

  function update(dt){
    state.time += dt;

    // slow-time
    if (state.slow > 0){
      state.slow -= dt;
    }
    const slowMul = (state.slow > 0) ? CONFIG.slowFactor : 1;

    // speed ramp
    state.speed = clamp(state.speed + CONFIG.speedIncreaseRate * state.dpr * dt, CONFIG.startSpeed*state.dpr, CONFIG.maxSpeed*state.dpr);
    const effectiveSpeed = state.speed * slowMul;

    // score & distance
    state.distance += (effectiveSpeed / (520*state.dpr)) * dt * 10; // tuned distance units
    state.score += Math.floor(dt * 60); // base per time

    // spawn obstacles
    state.spawnIn -= dt;
    if (state.spawnIn <= 0){
      // enforce spacing by x distance
      const minX = state.width - Math.round(CONFIG.obstacleGapSafe * state.dpr);
      if (state.lastSpawnX < minX){
        spawnObstacle();
        state.lastSpawnX = state.width;
      } else {
        // still too close; delay a hair
        state.spawnIn = 0.12;
      }
      state.spawnIn = rand(CONFIG.obstacleSpawnMin, CONFIG.obstacleSpawnMax);
    } else {
      state.lastSpawnX -= effectiveSpeed * dt;
    }

    // player physics
    const floor = worldFloorY();
    state.p.vy += CONFIG.gravity * state.dpr * dt;
    state.p.y += state.p.vy * dt;

    // landing
    if (state.p.y >= floor - state.p.h){
      if (!state.p.onGround){
        // landed event
        state.shake = Math.max(state.shake, CONFIG.screenShake.land * state.dpr);
        state.p.squash = 0.85;
        beep({freq: 220, dur: 0.03, type:"sine", gain:0.08});
      }
      state.p.y = floor - state.p.h;
      state.p.vy = 0;
      state.p.onGround = true;
      state.p.canDouble = false;
    } else {
      state.p.onGround = false;
    }

    // squash decay
    state.p.squash = Math.max(0, state.p.squash - dt*2.6);

    // invincibility timer
    if (state.invincible > 0) state.invincible -= dt;

    // move obstacles & powerups
    for (let i=state.obstacles.length-1;i>=0;i--){
      const ob = state.obstacles[i];
      ob.x -= effectiveSpeed * dt;

      // passed scoring
      if (!ob.passed && ob.x + ob.w < state.p.x){
        ob.passed = true;
        state.score += ob.scoreValue;
        beep({freq: 860, dur: 0.035, type:"triangle", gain:0.09, slide: 0.92});
      }

      // remove offscreen
      if (ob.x + ob.w < -50*state.dpr){
        state.obstacles.splice(i,1);
      }
    }

    for (let i=state.powerups.length-1;i>=0;i--){
      const pu = state.powerups[i];
      pu.t += dt;
      pu.x -= effectiveSpeed * dt;
      if (pu.x + pu.w < -60*state.dpr) state.powerups.splice(i,1);
    }

    // particles
    emitRunParticles(dt);
    updateParticles(dt);

    // collisions
    checkCollisions();

    // UI
    elDist.textContent = String(Math.floor(state.distance));
    elScore.textContent = String(state.score);
    elSpeed.textContent = String(Math.round((effectiveSpeed / state.dpr)));
    elLives.textContent = heartsStr(state.lives);

    // camera shake decay
    if (state.shake > 0){
      state.shake *= Math.pow(0.001, dt); // fast decay curve
      if (state.shake < 0.35*state.dpr) state.shake = 0;
    }
  }

  function checkCollisions(){
    const pBox = {x: state.p.x, y: state.p.y, w: state.p.w, h: state.p.h};

    // powerups
    for (let i=state.powerups.length-1;i>=0;i--){
      const pu = state.powerups[i];
      if (aabb(pBox, pu)){
        if (pu.type === "shield"){
          state.shield = true;
          state.score += 120;
          beep({freq: 980, dur: 0.07, type:"sine", gain:0.12, slide: 1.08});
          beep({freq: 1240, dur: 0.05, type:"triangle", gain:0.10, slide: 1.02});
        } else if (pu.type === "slow"){
          state.slow = CONFIG.powerupDuration.slow;
          state.score += 90;
          beep({freq: 520, dur: 0.08, type:"triangle", gain:0.12, slide: 0.78});
        }
        state.powerups.splice(i,1);
      }
    }

    // obstacles
    if (state.invincible > 0) return;

    for (let i=0;i<state.obstacles.length;i++){
      const ob = state.obstacles[i];
      if (aabb(pBox, ob)){
        onHit();
        return;
      }
    }
  }

  function onHit(){
    if (state.shield){
      state.shield = false;
      state.invincible = 0.55;
      state.shake = Math.max(state.shake, CONFIG.screenShake.hit * 0.85 * state.dpr);
      state.hitStop = CONFIG.hitStop * 0.55;
      beep({freq: 320, dur: 0.06, type:"square", gain:0.12, slide: 0.75});
      beep({noise:true, dur: 0.06, gain:0.10});
      return;
    }

    state.lives -= 1;
    state.invincible = CONFIG.invincibleTime;
    state.shake = Math.max(state.shake, CONFIG.screenShake.hit * state.dpr);
    state.hitStop = CONFIG.hitStop;

    // small knock
    state.p.vy = -Math.max(state.p.vy, 420*state.dpr);

    beep({freq: 140, dur: 0.10, type:"sawtooth", gain:0.18, slide: 0.66});
    beep({noise:true, dur: 0.08, gain:0.14});

    if (state.lives <= 0){
      gameOver();
    }
  }

  // Render helpers
  function withCamera(fn){
    ctx.save();
    if (state.shake > 0){
      const s = state.shake;
      state.shakeX = rand(-s, s);
      state.shakeY = rand(-s, s);
      ctx.translate(state.shakeX, state.shakeY);
    }
    fn();
    ctx.restore();
  }

  function render(){
    const w = state.width, h = state.height;

    // clear
    ctx.clearRect(0,0,w,h);

    withCamera(()=>{
      drawBackground();
      drawGround();
      drawParallax();
      drawObstacles();
      drawPowerups();
      drawParticles();
      drawPlayer();
      drawFX();
    });

    // HUD high score
    elHi.textContent = state.hiScore;
  }

  function drawBackground(){
    const w = state.width, h = state.height;

    // subtle grid + stars
    const t = state.time;

    // gradient wash
    const g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0, "rgba(9,12,26,1)");
    g.addColorStop(1, "rgba(8,14,36,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);

    // far stars
    ctx.globalAlpha = 0.55;
    for (let i=0;i<80;i++){
      const x = (i*97 + (t*20)) % w;
      const y = (i*173 + 60) % (h*0.6);
      const r = (i%3===0?1.6:1.1)*state.dpr;
      ctx.fillStyle = "rgba(233,242,255,.35)";
      ctx.beginPath();
      ctx.arc(w - x, y, r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // neon mist bands
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "rgba(139,92,246,1)";
    ctx.fillRect(0, h*0.18, w, h*0.06);
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "rgba(52,211,153,1)";
    ctx.fillRect(0, h*0.26, w, h*0.05);
    ctx.globalAlpha = 1;
  }

  function drawParallax(){
    // moving streaks
    const w = state.width, h = state.height;
    const sp = (state.speed * ((state.slow>0)?CONFIG.slowFactor:1)) * 0.35;
    const t = state.time;

    ctx.save();
    ctx.globalAlpha = 0.22;

    for (let i=0;i<18;i++){
      const y = h*(0.14 + i*0.03);
      const x = (w - ((t*sp) + i*220*state.dpr) % (w + 200*state.dpr));
      ctx.strokeStyle = "rgba(233,242,255,.22)";
      ctx.lineWidth = 2*state.dpr;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 160*state.dpr, y);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawGround(){
    const w = state.width, h = state.height;
    const floor = worldFloorY();

    // ground base
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.fillRect(0, floor, w, h-floor);

    // runway line
    ctx.strokeStyle = "rgba(233,242,255,.22)";
    ctx.lineWidth = 2*state.dpr;
    ctx.beginPath();
    ctx.moveTo(0, floor);
    ctx.lineTo(w, floor);
    ctx.stroke();

    // moving lane marks
    const speed = (state.speed * ((state.slow>0)?CONFIG.slowFactor:1));
    const t = state.time;
    const seg = 90*state.dpr;
    const dash = 44*state.dpr;

    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = "rgba(139,92,246,.35)";
    ctx.lineWidth = 4*state.dpr;
    for (let lane=1; lane<=2; lane++){
      const y = floor + lane*(CONFIG.groundPad*state.dpr/3);
      ctx.beginPath();
      for (let x = (w - (t*speed) % seg); x < w + seg; x += seg){
        ctx.moveTo(x, y);
        ctx.lineTo(x + dash, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer(){
    const p = state.p;

    // blink if invincible
    const blink = (state.invincible > 0) ? (Math.floor(state.time*16)%2===0) : true;
    if (!blink) return;

    // squash/stretch
    const squash = p.squash;
    const sx = 1 + squash*0.16;
    const sy = 1 - squash*0.14;

    const cx = p.x + p.w/2;
    const cy = p.y + p.h/2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, sy);
    ctx.translate(-cx, -cy);

    // aura
    const aura = ctx.createRadialGradient(cx, cy, 6*state.dpr, cx, cy, 72*state.dpr);
    aura.addColorStop(0, "rgba(52,211,153,.22)");
    aura.addColorStop(0.5, "rgba(139,92,246,.16)");
    aura.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, cy, 72*state.dpr, 0, Math.PI*2);
    ctx.fill();

    // body
    const bodyG = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
    bodyG.addColorStop(0, "rgba(233,242,255,.95)");
    bodyG.addColorStop(0.55, "rgba(139,92,246,.92)");
    bodyG.addColorStop(1, "rgba(52,211,153,.86)");

    roundRect(ctx, p.x, p.y, p.w, p.h, 12*state.dpr);
    ctx.fillStyle = bodyG;
    ctx.fill();

    // visor
    ctx.fillStyle = "rgba(5,12,26,.55)";
    roundRect(ctx, p.x + 10*state.dpr, p.y + 14*state.dpr, p.w - 20*state.dpr, 16*state.dpr, 10*state.dpr);
    ctx.fill();

    // jet sparks
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "rgba(233,242,255,.55)";
    ctx.lineWidth = 2*state.dpr;
    ctx.beginPath();
    ctx.moveTo(p.x - 10*state.dpr, p.y + p.h*0.55);
    ctx.lineTo(p.x + 6*state.dpr, p.y + p.h*0.55);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // shield ring
    if (state.shield){
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = "rgba(251,191,36,.75)";
      ctx.lineWidth = 3*state.dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, 40*state.dpr, 0, Math.PI*2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function drawObstacles(){
    for (const ob of state.obstacles){
      if (ob.type === "spike"){
        drawSpike(ob);
      } else if (ob.type === "wall"){
        drawWall(ob);
      } else {
        drawDrone(ob);
      }
    }
  }

  function drawSpike(ob){
    const {x,y,w,h} = ob;
    ctx.save();
    ctx.globalAlpha = 0.95;

    // base glow
    const g = ctx.createRadialGradient(x+w*0.5, y+h*0.7, 6*state.dpr, x+w*0.5, y+h*0.7, 60*state.dpr);
    g.addColorStop(0, "rgba(251,113,133,.25)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x+w*0.5, y+h*0.75, 60*state.dpr, 0, Math.PI*2);
    ctx.fill();

    // spikes
    ctx.fillStyle = "rgba(251,113,133,.85)";
    ctx.beginPath();
    ctx.moveTo(x, y+h);
    ctx.lineTo(x+w*0.5, y);
    ctx.lineTo(x+w, y+h);
    ctx.closePath();
    ctx.fill();

    // highlight
    ctx.strokeStyle = "rgba(233,242,255,.35)";
    ctx.lineWidth = 2*state.dpr;
    ctx.stroke();

    ctx.restore();
  }

  function drawWall(ob){
    const {x,y,w,h} = ob;
    ctx.save();

    const body = ctx.createLinearGradient(x,y,x+w,y+h);
    body.addColorStop(0, "rgba(139,92,246,.78)");
    body.addColorStop(1, "rgba(233,242,255,.26)");
    roundRect(ctx, x, y, w, h, 10*state.dpr);
    ctx.fillStyle = body;
    ctx.fill();

    ctx.strokeStyle = "rgba(233,242,255,.25)";
    ctx.lineWidth = 2*state.dpr;
    ctx.stroke();

    // inner stripes
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "rgba(52,211,153,.55)";
    for (let i=0;i<4;i++){
      ctx.beginPath();
      ctx.moveTo(x + 6*state.dpr, y + (i+1)*h/5);
      ctx.lineTo(x + w - 6*state.dpr, y + (i+1)*h/5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function drawDrone(ob){
    const {x,y,w,h} = ob;
    ctx.save();

    // body glow
    const glow = ctx.createRadialGradient(x+w/2,y+h/2, 4*state.dpr, x+w/2,y+h/2, 55*state.dpr);
    glow.addColorStop(0, "rgba(52,211,153,.22)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x+w/2,y+h/2, 55*state.dpr, 0, Math.PI*2);
    ctx.fill();

    // body
    const g = ctx.createLinearGradient(x,y,x+w,y);
    g.addColorStop(0, "rgba(52,211,153,.78)");
    g.addColorStop(1, "rgba(139,92,246,.65)");
    roundRect(ctx, x, y, w, h, 12*state.dpr);
    ctx.fillStyle = g;
    ctx.fill();

    // eye
    ctx.fillStyle = "rgba(5,12,26,.6)";
    roundRect(ctx, x + 10*state.dpr, y + 8*state.dpr, w - 20*state.dpr, h - 16*state.dpr, 10*state.dpr);
    ctx.fill();

    // wings
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = "rgba(233,242,255,.35)";
    ctx.lineWidth = 2*state.dpr;
    ctx.beginPath();
    ctx.moveTo(x + 8*state.dpr, y + h*0.15);
    ctx.lineTo(x - 18*state.dpr, y + h*0.05);
    ctx.moveTo(x + w - 8*state.dpr, y + h*0.15);
    ctx.lineTo(x + w + 18*state.dpr, y + h*0.05);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function drawPowerups(){
    for (const pu of state.powerups){
      const cx = pu.x + pu.w/2, cy = pu.y + pu.h/2;
      ctx.save();
      // bobbing
      const bob = Math.sin((state.time*4 + pu.t*6)) * 4*state.dpr;
      const y = pu.y + bob;

      // glow
      const glow = ctx.createRadialGradient(cx, cy, 6*state.dpr, cx, cy, 60*state.dpr);
      if (pu.type === "shield"){
        glow.addColorStop(0, "rgba(251,191,36,.26)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
      } else {
        glow.addColorStop(0, "rgba(139,92,246,.24)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
      }
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 60*state.dpr, 0, Math.PI*2);
      ctx.fill();

      // token
      roundRect(ctx, pu.x, y, pu.w, pu.h, 12*state.dpr);
      ctx.fillStyle = "rgba(233,242,255,.15)";
      ctx.fill();

      ctx.strokeStyle = (pu.type === "shield") ? "rgba(251,191,36,.85)" : "rgba(139,92,246,.85)";
      ctx.lineWidth = 3*state.dpr;
      ctx.stroke();

      // icon
      ctx.fillStyle = "rgba(233,242,255,.9)";
      ctx.font = `${Math.round(18*state.dpr)}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pu.type === "shield" ? "🛡️" : "🕒", cx, y + pu.h/2);

      ctx.restore();
    }
  }

  function drawParticles(){
    ctx.save();
    for (const p of state.particles){
      const a = clamp(p.life / 0.55, 0, 1);
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = "rgba(233,242,255,.7)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFX(){
    // slow-time vignette
    if (state.slow > 0){
      const w = state.width, h = state.height;
      const a = clamp(state.slow / CONFIG.powerupDuration.slow, 0, 1);
      const g = ctx.createRadialGradient(w/2,h/2, 120*state.dpr, w/2,h/2, Math.max(w,h)*0.7);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(139,92,246,${0.18*a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0,0,w,h);
    }

    // shield indicator subtle
    if (state.shield){
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = "rgba(251,191,36,1)";
      ctx.fillRect(0,0,state.width,state.height);
      ctx.restore();
    }
  }

  function roundRect(ctx, x, y, w, h, r){
    r = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
  }

  // Boot
  init();