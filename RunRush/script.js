(() => {
  "use strict";

  // ======= DOM =======
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const elScore = document.getElementById("score");
  const elSpeed = document.getElementById("speed");

  const overlayStart = document.getElementById("overlayStart");
  const overlayOver  = document.getElementById("overlayOver");

  const btnStart  = document.getElementById("btnStart");
  const btnStart2 = document.getElementById("btnStart2");
  const btnReset  = document.getElementById("btnReset");
  const btnRestart = document.getElementById("btnRestart");

  const elFinalScore = document.getElementById("finalScore");
  const elBestScore  = document.getElementById("bestScore");

  // ======= Game State =======
  const GROUND_Y = 420;     // ground line (in canvas coordinates)
  const GRAVITY = 2400;     // px/s^2
  const JUMP_V = 920;       // px/s
  const BASE_SPEED = 360;   // world speed px/s
  const SPEED_GROWTH = 0.060; // speed multiplier per second
  const SPAWN_MIN = 0.75;   // seconds
  const SPAWN_MAX = 1.60;   // seconds

  const player = {
    x: 140,
    y: GROUND_Y,
    w: 44,
    h: 64,
    vy: 0,
    onGround: true,
    // tiny style
    glow: 0
  };

  let obstacles = [];
  let particles = [];

  let running = false;
  let gameOver = false;

  let tPrev = performance.now();
  let timeAlive = 0;
  let score = 0;
  let best = Number(localStorage.getItem("RR_best") || 0);

  // spawn control
  let spawnTimer = 0;
  let nextSpawn = rand(SPAWN_MIN, SPAWN_MAX);

  // background parallax
  let stars = makeStars(120);
  let floorOffset = 0;

  // ======= Helpers =======
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function rand(a, b){ return a + Math.random() * (b - a); }
  function randi(a, b){ return Math.floor(rand(a, b+1)); }

  function resetAll(showStart = true){
    running = false;
    gameOver = false;
    timeAlive = 0;
    score = 0;
    obstacles = [];
    particles = [];
    player.y = GROUND_Y;
    player.vy = 0;
    player.onGround = true;
    player.glow = 0;
    spawnTimer = 0;
    nextSpawn = rand(SPAWN_MIN, SPAWN_MAX);
    floorOffset = 0;

    elScore.textContent = "0";
    elSpeed.textContent = "1.00";
    elFinalScore.textContent = "0";
    elBestScore.textContent = String(best);

    overlayOver.classList.add("hide");
    if (showStart) overlayStart.classList.remove("hide");
    else overlayStart.classList.add("hide");
  }

  function startGame(){
    if (running) return;
    overlayStart.classList.add("hide");
    overlayOver.classList.add("hide");
    running = true;
    gameOver = false;
    tPrev = performance.now();
  }

  function endGame(){
    running = false;
    gameOver = true;

    best = Math.max(best, Math.floor(score));
    localStorage.setItem("RR_best", String(best));

    elFinalScore.textContent = String(Math.floor(score));
    elBestScore.textContent  = String(best);
    overlayOver.classList.remove("hide");
  }

  function jump(){
    if (!running && !gameOver){
      startGame();
      // allow jump on start
    }
    if (gameOver) return;

    if (player.onGround){
      player.vy = -JUMP_V;
      player.onGround = false;
      player.glow = 1;

      // jump burst
      for (let i=0;i<16;i++){
        particles.push({
          x: player.x + player.w*0.35,
          y: player.y + player.h - 6,
          vx: rand(-120, -20),
          vy: rand(-420, -120),
          life: rand(0.25, 0.55),
          t: 0,
          r: rand(1.5, 3.5)
        });
      }
    }
  }

  function makeObstacle(){
    const type = Math.random() < 0.72 ? "box" : "bar";
    const h = type === "box" ? randi(34, 78) : randi(22, 40);
    const w = type === "box" ? randi(26, 50) : randi(56, 92);

    const y = GROUND_Y + (player.h - h);
    return {
      x: canvas.width + 40,
      y,
      w,
      h,
      type,
      passed: false,
      // visual flicker
      seed: Math.random()*999
    };
  }

  function aabb(a, b){
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function drawRoundedRect(x,y,w,h,r){
    r = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
  }

  function makeStars(n){
    const arr = [];
    for(let i=0;i<n;i++){
      arr.push({
        x: Math.random()*canvas.width,
        y: Math.random()*canvas.height*0.75,
        r: rand(0.7, 2.2),
        s: rand(0.15, 0.9) // speed factor
      });
    }
    return arr;
  }

  // ======= Render =======
  function render(dt){
    const w = canvas.width, h = canvas.height;

    // background
    ctx.clearRect(0,0,w,h);

    // stars parallax
    ctx.save();
    ctx.globalAlpha = 0.9;
    for (const st of stars){
      st.x -= (worldSpeed() * 0.10 * st.s) * dt;
      if (st.x < -10) { st.x = w + rand(0, 60); st.y = rand(0, h*0.75); }
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI*2);
      ctx.fillStyle = "rgba(233,238,252,0.9)";
      ctx.fill();
    }
    ctx.restore();

    // subtle horizon glow
    const grad = ctx.createLinearGradient(0, GROUND_Y-110, 0, GROUND_Y+140);
    grad.addColorStop(0, "rgba(108,240,255,0.18)");
    grad.addColorStop(0.45, "rgba(92,255,152,0.07)");
    grad.addColorStop(1, "rgba(0,0,0,0.0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, GROUND_Y-140, w, 220);

    // ground line & floor stripes
    floorOffset = (floorOffset + worldSpeed()*dt) % 80;
    ctx.save();
    ctx.strokeStyle = "rgba(233,238,252,0.20)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + player.h);
    ctx.lineTo(w, GROUND_Y + player.h);
    ctx.stroke();

    for (let x = -floorOffset; x < w; x += 80){
      ctx.strokeStyle = "rgba(233,238,252,0.06)";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + player.h + 18);
      ctx.lineTo(x + 28, GROUND_Y + player.h + 18);
      ctx.stroke();
    }
    ctx.restore();

    // obstacles
    for (const ob of obstacles){
      const flick = 0.55 + 0.45*Math.sin((timeAlive*8)+(ob.seed*3));
      ctx.save();

      // glow
      ctx.shadowBlur = 18;
      ctx.shadowColor = `rgba(255,77,109,${0.35*flick})`;

      // body
      const g2 = ctx.createLinearGradient(ob.x, ob.y, ob.x, ob.y+ob.h);
      g2.addColorStop(0, `rgba(255,77,109,${0.70*flick})`);
      g2.addColorStop(1, `rgba(255,77,109,${0.20*flick})`);
      ctx.fillStyle = g2;

      drawRoundedRect(ob.x, ob.y, ob.w, ob.h, 12);
      ctx.fill();

      // edge
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(233,238,252,${0.14+0.10*flick})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // hazard stripes (tiny)
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i=0;i<6;i++){
        const xx = ob.x + (i*ob.w/6);
        ctx.moveTo(xx, ob.y+6);
        ctx.lineTo(xx+ob.w/6, ob.y+ob.h-6);
      }
      ctx.strokeStyle = "rgba(233,238,252,0.40)";
      ctx.stroke();

      ctx.restore();
    }

    // particles
    for (const p of particles){
      const k = 1 - (p.t / p.life);
      ctx.save();
      ctx.globalAlpha = Math.max(0, k) * 0.9;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = "rgba(108,240,255,0.95)";
      ctx.fill();
      ctx.restore();
    }

    // player
    ctx.save();

    // aura
    const aura = clamp(player.glow, 0, 1);
    ctx.shadowBlur = 28;
    ctx.shadowColor = `rgba(108,240,255,${0.35*aura})`;

    // body gradient
    const pg = ctx.createLinearGradient(player.x, player.y, player.x, player.y+player.h);
    pg.addColorStop(0, "rgba(108,240,255,0.85)");
    pg.addColorStop(1, "rgba(108,240,255,0.18)");
    ctx.fillStyle = pg;

    drawRoundedRect(player.x, player.y, player.w, player.h, 14);
    ctx.fill();

    // face visor
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(233,238,252,0.22)";
    drawRoundedRect(player.x+10, player.y+14, player.w-16, 16, 8);
    ctx.fill();

    // tiny leg hint
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "rgba(233,238,252,0.30)";
    drawRoundedRect(player.x+8, player.y+player.h-16, player.w-16, 10, 6);
    ctx.fill();

    ctx.restore();

    // hint when paused on start
    if (!running && !gameOver){
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "rgba(233,238,252,0.70)";
      ctx.font = "700 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText("לחץ Space / קליק / טאץ' כדי לקפוץ ולהתחיל", 26, 34);
      ctx.restore();
    }
  }

  function worldSpeed(){
    // speed multiplier grows with timeAlive
    const mult = 1 + (timeAlive * SPEED_GROWTH);
    return BASE_SPEED * mult;
  }

  // ======= Update Loop =======
  function update(dt){
    if (!running) return;

    timeAlive += dt;

    // speed + score
    const speedMult = 1 + (timeAlive * SPEED_GROWTH);
    score += dt * (20 * speedMult);
    elScore.textContent = String(Math.floor(score));
    elSpeed.textContent = speedMult.toFixed(2);

    // player physics
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;

    const groundTop = GROUND_Y;
    if (player.y >= groundTop){
      player.y = groundTop;
      player.vy = 0;
      player.onGround = true;
    }

    // glow decay
    player.glow = Math.max(0, player.glow - dt*2.2);

    // spawn obstacles
    spawnTimer += dt;
    if (spawnTimer >= nextSpawn){
      spawnTimer = 0;
      nextSpawn = rand(SPAWN_MIN, SPAWN_MAX) / (1 + timeAlive*0.03);
      obstacles.push(makeObstacle());
    }

    // move obstacles + scoring on pass
    const spd = worldSpeed();
    for (const ob of obstacles){
      ob.x -= spd * dt;

      if (!ob.passed && ob.x + ob.w < player.x){
        ob.passed = true;
        score += 12; // bonus
        // pass spark
        for (let i=0;i<10;i++){
          particles.push({
            x: player.x + player.w + rand(2, 10),
            y: player.y + player.h*0.55 + rand(-12, 12),
            vx: rand(120, 360),
            vy: rand(-160, 160),
            life: rand(0.18, 0.38),
            t: 0,
            r: rand(1.2, 2.8)
          });
        }
      }
    }

    // cleanup obstacles
    obstacles = obstacles.filter(o => o.x > -120);

    // particles update
    for (const p of particles){
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 900 * dt; // fall
    }
    particles = particles.filter(p => p.t < p.life);

    // collision
    const playerBox = { x: player.x, y: player.y, w: player.w, h: player.h };
    for (const ob of obstacles){
      if (aabb(playerBox, ob)){
        // small impact burst
        for (let i=0;i<26;i++){
          particles.push({
            x: player.x + player.w*0.6,
            y: player.y + player.h*0.5,
            vx: rand(-420, 280),
            vy: rand(-520, 120),
            life: rand(0.25, 0.55),
            t: 0,
            r: rand(1.4, 3.8)
          });
        }
        endGame();
        break;
      }
    }
  }

  function tick(now){
    const dt = clamp((now - tPrev) / 1000, 0, 0.033);
    tPrev = now;

    update(dt);
    render(dt);

    requestAnimationFrame(tick);
  }

  // ======= Controls =======
  function onAction(){
    if (gameOver) return;
    jump();
  }

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === " " || k === "arrowup"){
      e.preventDefault();
      onAction();
    }
    if ((k === "enter") && !running && !gameOver){
      startGame();
    }
    if ((k === "r") && gameOver){
      resetAll(false);
      startGame();
    }
    if ((k === "r") && !gameOver){
      resetAll(true);
    }
  }, { passive:false });

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onAction();
  }, { passive:false });

  // HUD buttons
  btnStart.addEventListener("click", () => startGame());
  btnStart2.addEventListener("click", () => startGame());
  btnReset.addEventListener("click", () => resetAll(true));
  btnRestart.addEventListener("click", () => { resetAll(false); startGame(); });

  // ======= Init =======
  elBestScore.textContent = String(best);
  resetAll(true);
  requestAnimationFrame(tick);
})();