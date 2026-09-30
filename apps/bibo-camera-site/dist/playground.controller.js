/* Brand playground: one owner for mood, discoveries and transient particles. */
/* global document, window, matchMedia, devicePixelRatio, innerWidth, innerHeight, requestAnimationFrame, cancelAnimationFrame, performance */
{
  const world = document.querySelector('#playground');
  const friend = document.querySelector('#little-friend');
  const wrap = document.querySelector('#friend-wrap');
  const bubble = document.querySelector('#hello-bubble');
  const prop = document.querySelector('#held-prop');
  const fountain = document.querySelector('#fountain');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const moods = {
    hello: ['嗨，你来啦。', '不只眼前这件事，你在意的事我也想懂。'],
    party: ['这一步，值得庆祝！', '大事小事，都陪你认真完成。'],
    dream: ['你休息，我轻一点。', '好的搭档，也知道什么时候不打扰。'],
    bloom: ['这个想法，一起养大吧。', '先聊聊，再把它接上你的计划。'],
  };
  const greetings = [
    ['在呢。', '你的计划、烦恼、小灵感，都可以和我聊。'],
    ['戳到一个认真听你的我。', '一起想，也一起把事情做完。'],
    ['被你发现了，我有点好玩。', '做事也认真，会从经验里改进。'],
  ];
  const discovered = new Set();
  let greeting = 0;
  let surpriseFound = false;
  let bounce;
  let drawId = 0;
  let particles = [];
  let emissionUntil = 0;
  let lastTime = 0;
  const canvas = document.createElement('canvas');
  canvas.className = 'spark-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const colors = ['#c7a0e8', '#edb559', '#f29389', '#91bca3', '#e0c1ea'];

  function speak(lines) {
    const detail = document.createElement('span');
    detail.textContent = lines[1];
    bubble.replaceChildren(document.createTextNode(lines[0]), detail);
  }

  function hop() {
    bounce?.cancel();
    if (reduced.matches) return;
    bounce = wrap.animate([
      { translate: '0 0', rotate: '0deg' },
      { translate: '0 -18px', rotate: '-5deg', offset: .42 },
      { translate: '0 2px', rotate: '3deg', offset: .78 },
      { translate: '0 0', rotate: '0deg' },
    ], { duration: 620, easing: 'ease-out' });
  }

  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * ratio;
    canvas.height = innerHeight * ratio;
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function addSpark(x, y, burst = false) {
    if (particles.length >= 180) return;
    const angle = burst ? Math.random() * Math.PI * 2 : -Math.PI / 2 + .3 + (Math.random() - .5) * 1.05;
    const speed = burst ? 80 + Math.random() * 180 : 180 + Math.random() * 220;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      age: 0, life: .8 + Math.random() * .85, size: 2 + Math.random() * 4,
      angle: Math.random() * Math.PI, color: colors[Math.floor(Math.random() * colors.length)], star: Math.random() > .55 });
  }

  function draw(time) {
    drawId = 0;
    if (!ctx || reduced.matches || document.hidden) { stopSparks(); return; }
    const delta = Math.min((time - (lastTime || time)) / 1000, .04);
    lastTime = time;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (time < emissionUntil) {
      const rect = prop.getBoundingClientRect();
      for (let i = 0; i < 5; i++) addSpark(rect.left + rect.width * .63, rect.top + rect.height * .23);
    }
    particles = particles.filter(p => p.age < p.life);
    for (const p of particles) {
      p.age += delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 210 * delta;
      p.angle += delta * 2;
      paintSpark(p);
    }
    if (particles.length || time < emissionUntil) drawId = requestAnimationFrame(draw);
    else { ctx.clearRect(0, 0, innerWidth, innerHeight); lastTime = 0; }
  }

  function paintSpark(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
    ctx.fillStyle = p.color;
    if (p.star) {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const radius = i % 2 ? p.size * .32 : p.size;
        const angle = i * Math.PI / 4;
        const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    } else ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * .65);
    ctx.restore();
  }

  function stopSparks() {
    cancelAnimationFrame(drawId);
    drawId = 0;
    particles = [];
    emissionUntil = 0;
    lastTime = 0;
    ctx?.clearRect(0, 0, innerWidth, innerHeight);
  }

  function spark(burst = false) {
    if (!ctx || reduced.matches || document.hidden) return;
    if (burst) {
      const rect = friend.getBoundingClientRect();
      for (let i = 0; i < 70; i++) addSpark(rect.left + rect.width / 2, rect.top + rect.height / 3, true);
    } else emissionUntil = performance.now() + 1200;
    if (!drawId) drawId = requestAnimationFrame(draw);
  }

  function hold(button) {
    prop.replaceChildren(button.querySelector('svg').cloneNode(true));
    world.dataset.holding = 'true';
    world.dataset.prop = button.dataset.mood || 'fountain';
  }

  for (const toy of document.querySelectorAll('.world-toy[data-mood]')) {
    toy.addEventListener('click', () => {
      stopSparks();
      const mood = toy.dataset.mood;
      world.dataset.mood = mood;
      hold(toy);
      speak(moods[mood]);
      hop();
      discovered.add(mood);
      if (mood === 'party') spark(true);
      if (discovered.size === 3 && !surpriseFound) {
        surpriseFound = true;
        speak(['彩蛋：有趣的灵魂，被你找到啦。', '谢谢你愿意了解我。现在，也让我了解你吧。']);
        spark(true);
      }
    });
  }
  fountain.addEventListener('click', () => {
    world.dataset.mood = 'party';
    hold(fountain);
    speak(['给平凡的一天，放一点花。', '完成一小步，也值得一起开心。']);
    hop();
    spark();
  });
  friend.addEventListener('click', () => {
    speak(greetings[greeting++ % greetings.length]);
    hop();
    if (world.dataset.mood === 'party') spark(prop.querySelector('.cone-stripe') === null);
  });
  world.addEventListener('pointermove', event => {
    if (reduced.matches || event.pointerType !== 'mouse') return;
    const rect = friend.getBoundingClientRect();
    friend.style.setProperty('--look-x', `${Math.max(-6, Math.min(6, (event.clientX - rect.left - rect.width / 2) / 30))}px`);
    friend.style.setProperty('--look-y', `${Math.max(-5, Math.min(5, (event.clientY - rect.top - rect.height / 2) / 30))}px`);
  });
  world.addEventListener('pointerleave', () => {
    friend.style.removeProperty('--look-x');
    friend.style.removeProperty('--look-y');
  });
  function settle() { stopSparks(); bounce?.cancel(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) settle(); });
  reduced.addEventListener('change', () => { if (reduced.matches) settle(); });
  window.addEventListener('pagehide', settle);
  window.addEventListener('resize', resize);
  resize();
  hop();
}
