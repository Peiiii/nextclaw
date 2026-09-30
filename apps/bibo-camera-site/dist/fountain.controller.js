/* global document, window, matchMedia, innerWidth, innerHeight, devicePixelRatio, performance, requestAnimationFrame, cancelAnimationFrame */
/* A short fountain from the physical nozzle; story state stays in the camera. */
{
  const button = document.querySelector('#fountain');
  const nozzle = document.querySelector('#fountain-nozzle');
  const grip = document.querySelector('#fountain-grip');
  const status = document.querySelector('#fountain-status');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.createElement('canvas');
  canvas.className = 'fountain-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const colors = ['#ec6299', '#f0b244', '#52bfd3', '#8880d8', '#ef8761', '#76bfa1'];
  let sparks = [];
  let frameId = 0;
  let previousTime = 0;
  let emissionUntil = 0;
  let emissionCarry = 0;
  let flashTimer;

  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * ratio;
    canvas.height = innerHeight * ratio;
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function emit(count) {
    const rect = nozzle.getBoundingClientRect();
    const hand = grip.getBoundingClientRect();
    const scale = innerWidth < 700 ? .7 : 1;
    const direction = Math.atan2(rect.top + rect.height / 2 - hand.top - hand.height / 2,
      rect.left + rect.width / 2 - hand.left - hand.width / 2);
    for (let i = 0; i < count && sparks.length < 240; i++) {
      const angle = direction + (Math.random() - .5) * 1.6;
      const speed = (220 + Math.random() * 390) * scale;
      const kind = Math.random();
      sparks.push({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        age: 0, life: 2.5 + Math.random() * 1.3,
        width: (3 + Math.random() * 4) * scale,
        length: (kind < .17 ? 23 + Math.random() * 17 : 5 + Math.random() * 7) * scale,
        shape: kind < .17 ? 'ribbon' : kind < .27 ? 'dot' : 'paper',
        rotation: Math.random() * Math.PI * 2, spin: (Math.random() - .5) * 8,
        phase: Math.random() * Math.PI * 2,
        color: colors[Math.floor(Math.random() * colors.length)] });
    }
  }

  function paint(spark, delta) {
    spark.age += delta;
    spark.vx *= Math.exp(-1.5 * delta);
    spark.vy = spark.vy * Math.exp(-.6 * delta) + 200 * delta;
    spark.x += (spark.vx + Math.sin(spark.age * 5 + spark.phase) * 24) * delta;
    spark.y += spark.vy * delta;
    spark.rotation += spark.spin * delta;
    ctx.save();
    ctx.translate(spark.x, spark.y);
    ctx.rotate(spark.rotation);
    ctx.globalAlpha = Math.max(0, Math.min(1, (spark.life - spark.age) / .8));
    ctx.fillStyle = spark.color;
    if (spark.shape === 'ribbon') paintRibbon(spark);
    else if (spark.shape === 'dot') {
      ctx.beginPath();
      ctx.arc(0, 0, spark.width * .6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.scale(.18 + Math.abs(Math.cos(spark.age * 7 + spark.phase)) * .82, 1);
      ctx.fillRect(-spark.width / 2, -spark.length / 2, spark.width, spark.length);
    }
    ctx.restore();
  }

  function paintRibbon(spark) {
    ctx.strokeStyle = spark.color;
    ctx.lineWidth = spark.width * .5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const y = (i / 16 - .5) * spark.length;
      const x = Math.sin(i / 16 * Math.PI * 3 + spark.age * 4 + spark.phase) * spark.width;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function draw(time) {
    frameId = 0;
    if (!ctx || reduced.matches || document.hidden) { clear(); return; }
    const delta = Math.min((time - (previousTime || time - 16)) / 1000, .04);
    previousTime = time;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (time < emissionUntil) {
      emissionCarry += delta * 280;
      const count = Math.floor(emissionCarry);
      emissionCarry -= count;
      emit(count);
    }
    sparks = sparks.filter(spark => spark.age < spark.life);
    for (const spark of sparks) paint(spark, delta);
    ctx.globalAlpha = 1;
    if (sparks.length || time < emissionUntil) frameId = requestAnimationFrame(draw);
    else { ctx.clearRect(0, 0, innerWidth, innerHeight); previousTime = 0; }
  }

  function clear() {
    cancelAnimationFrame(frameId);
    clearTimeout(flashTimer);
    frameId = 0;
    previousTime = 0;
    emissionUntil = 0;
    emissionCarry = 0;
    sparks = [];
    button.classList.remove('is-spraying');
    ctx?.clearRect(0, 0, innerWidth, innerHeight);
  }

  button.addEventListener('click', () => {
    clearTimeout(flashTimer);
    button.classList.add('is-spraying');
    status.textContent = status.textContent === '喷花亮了一下。' ? '再放一小束花。' : '喷花亮了一下。';
    flashTimer = setTimeout(() => button.classList.remove('is-spraying'), 750);
    if (!ctx || reduced.matches || document.hidden) return;
    emissionUntil = performance.now() + 140;
    emit(110);
    if (!frameId) frameId = requestAnimationFrame(draw);
  });
  window.addEventListener('resize', resize);
  window.addEventListener('pagehide', clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  reduced.addEventListener('change', () => { if (reduced.matches) clear(); });
  resize();
}
