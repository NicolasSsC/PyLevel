// Original Python logo animation. The entry controller owns background focus and scroll.
export function playLogoPreload(onComplete: () => void) {
  const overlay = document.getElementById('pylevel-preload');
  const canvas = document.getElementById('preload-canvas') as HTMLCanvasElement | null;
  const glow = document.getElementById('preload-radial-glow');
  const svgLogo = document.getElementById('preload-svg-logo');
  const brandGroup = document.getElementById('preload-brand-group');
  const skip = document.getElementById('preload-skip-btn');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!overlay || !canvas || !svgLogo || !brandGroup || !skip || motion.matches) {
    onComplete();
    return;
  }
  let hasEnded = false;
  let frame = 0;
  overlay.hidden = false;
  skip.focus({ preventScroll: true });

  const finishIntro = () => {
    if (hasEnded) return;
    hasEnded = true;
    cancelAnimationFrame(frame);
    window.clearTimeout(fallback);
    window.removeEventListener('resize', resizeCanvas);
    window.removeEventListener('resize', setupSwarms);
    motion.removeEventListener('change', onMotionChange);
    skip.removeEventListener('click', finishIntro);
    overlay.classList.add('fade-out');
    // Keep this phase modal until the fade finishes, then hand off exactly once.
    window.setTimeout(() => {
      overlay.hidden = true;
      window.removeEventListener('keydown', handleKey);
      onComplete();
    }, motion.matches ? 0 : 700);
  };
  function handleKey(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); finishIntro(); }
    if (event.key === 'Tab') { event.preventDefault(); skip?.focus(); }
  }
  function onMotionChange() { if (motion.matches) finishIntro(); }
  skip.addEventListener('click', finishIntro);
  window.addEventListener('keydown', handleKey);
  motion.addEventListener('change', onMotionChange);
  // Frames may be throttled; never strand the entry screen on the logo.
  const fallback = window.setTimeout(finishIntro, 8000);

  // 2. Inicializacion del Canvas y Fisica de Particulas
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    finishIntro();
    return;
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Muestreo denso de puntos de la silueta oficial de Python (coordenadas viewBox 0..111)
  // 36 puntos para la serpiente azul (mitad superior-izquierda)
  const BLUE_SNAKE_POINTS: [number, number][] = [
    [54.9, 0.0], [48.0, 0.2], [42.1, 1.1], [35.0, 3.5], [30.0, 8.0],
    [28.7, 15.0], [28.7, 20.0], [28.7, 25.2], [38.0, 25.2], [48.0, 25.2],
    [55.5, 25.2], [55.5, 28.6], [42.0, 28.6], [28.7, 28.6], [18.6, 28.6],
    [10.0, 32.0], [4.0, 37.0], [1.5, 43.0], [0.0, 52.0], [0.0, 62.0],
    [2.0, 69.2], [6.5, 76.0], [14.2, 82.8], [20.0, 82.8], [26.7, 82.8],
    [26.7, 76.0], [26.7, 70.6], [32.0, 64.0], [38.0, 58.0], [43.5, 53.9],
    [55.0, 53.9], [65.0, 53.9], [70.3, 53.9], [78.0, 48.0], [83.7, 40.3],
    [40.4, 13.3] // Ojo azul
  ];

  // 36 puntos para la serpiente amarilla (mitad inferior-derecha)
  const YELLOW_SNAKE_POINTS: [number, number][] = [
    [85.6, 28.7], [85.6, 35.0], [85.6, 40.6], [78.0, 48.0], [70.0, 55.0],
    [68.9, 57.6], [58.0, 57.6], [48.0, 57.6], [42.1, 57.6], [35.0, 62.0],
    [28.7, 71.2], [28.7, 80.0], [28.7, 90.0], [28.7, 96.7], [35.0, 104.0],
    [42.1, 110.3], [52.0, 110.3], [62.0, 110.3], [68.9, 110.3], [76.0, 105.0],
    [82.3, 96.7], [82.3, 90.0], [82.3, 86.5], [68.0, 86.5], [55.5, 86.5],
    [55.5, 83.1], [70.0, 83.1], [82.3, 83.1], [92.0, 83.1], [95.7, 83.1],
    [103.0, 78.0], [109.1, 69.5], [111.0, 58.0], [109.1, 42.3], [102.0, 33.0],
    [70.6, 97.9] // Ojo amarillo
  ];

  interface IntroParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    alpha: number;
    color: string;
    accentColor: string;
    targetSvgX: number;
    targetSvgY: number;
    orbitAngle: number;
    orbitRadius: number;
    orbitSpeed: number;
    initialDistance: number;
  }

  const PARTICLES_PER_SNAKE = 130;

  function createParticles(
    points: [number, number][],
    baseColor: string,
    accentColor: string,
    spawnOriginX: number,
    spawnOriginY: number
  ): IntroParticle[] {
    const list: IntroParticle[] = [];
    for (let i = 0; i < PARTICLES_PER_SNAKE; i++) {
      const pt = points[i % points.length];
      const dist = Math.random() * 260 + 120;
      const angle = Math.random() * Math.PI * 2;
      list.push({
        x: spawnOriginX + Math.cos(angle) * dist,
        y: spawnOriginY + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        radius: Math.random() * 2.2 + 0.8,
        alpha: Math.random() * 0.6 + 0.4,
        color: baseColor,
        accentColor,
        targetSvgX: pt[0],
        targetSvgY: pt[1],
        orbitAngle: angle,
        orbitRadius: dist,
        orbitSpeed: (Math.random() * 0.012 + 0.006) * (Math.random() < 0.5 ? 1 : -1),
        initialDistance: dist
      });
    }
    return list;
  }

  let blueSwarm: IntroParticle[]   = [];
  let yellowSwarm: IntroParticle[] = [];

  function setupSwarms() {
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    // Enjambre azul: nace hacia arriba a la izquierda
    blueSwarm = createParticles(BLUE_SNAKE_POINTS, '#3776ab', '#60a5fa', w * 0.22, h * 0.26);
    // Enjambre amarillo: nace hacia abajo a la derecha
    yellowSwarm = createParticles(YELLOW_SNAKE_POINTS, '#ffd43b', '#fde047', w * 0.78, h * 0.74);
  }
  setupSwarms();
  window.addEventListener('resize', setupSwarms);

  // Calcular la transformacion viewBox -> coordenadas de pantalla del SVG
  function getSvgMatrix() {
    if (!svgLogo || !canvas) return { ox: 0, oy: 0, scale: 1 };
    const rect = svgLogo.getBoundingClientRect();
    return {
      ox: rect.left,
      oy: rect.top,
      scale: rect.width / 111
    };
  }

  // Preserve the original 6.8-second logo choreography before the handoff.
  const START_TIME        = performance.now();
  const T_ORBIT_PHASE     = 1800; // 0.0s - 1.8s: fisica orbital fluida
  const T_CONVERGE_END    = 3900;
  const T_MATERIALIZE_SVG = 4000;
  const T_STAGE_REVEAL    = 5200;
  const T_PULSE_START     = 5600;
  const T_AUTO_FINISH     = 6800;

  function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  const render = (now: number) => {
    if (hasEnded) return;
    const elapsed = now - START_TIME;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const matrix = getSvgMatrix();

    // Desvanecimiento paulatino de particulas a medida que el SVG se materializa
    const particleOpacity = elapsed < T_MATERIALIZE_SVG
      ? 1
      : Math.max(0, 1 - (elapsed - T_MATERIALIZE_SVG) / 1000);

    // Dibujar enjambre
    const drawSwarm = (swarm: IntroParticle[]) => {
      for (let i = 0; i < swarm.length; i++) {
        const p = swarm[i];
        p.orbitAngle += p.orbitSpeed;

        // Cada particula converge en un momento distinto para formar el logo por partes
        const particleDelay = (i / swarm.length) * 900;
        const particleStart = T_ORBIT_PHASE + particleDelay;
        const particleRaw = Math.max(
          0,
          Math.min((elapsed - particleStart) / (T_CONVERGE_END - particleStart), 1)
        );
        const particleProgress = easeInOutCubic(particleRaw);

        // Trayectoria orbital individual con convergencia progresiva
        const currentOrbitR = p.initialDistance * (1 - particleProgress * 0.88);
        const orbX = p.x + Math.cos(p.orbitAngle) * currentOrbitR * 0.4;
        const orbY = p.y + Math.sin(p.orbitAngle) * currentOrbitR * 0.4;

        // Destino de cada destello sobre la silueta oficial
        const targetX = matrix.ox + p.targetSvgX * matrix.scale;
        const targetY = matrix.oy + p.targetSvgY * matrix.scale;

        // Los destellos llegan uno tras otro, dibujando el simbolo
        const drawX = orbX + (targetX - orbX) * particleProgress;
        const drawY = orbY + (targetY - orbY) * particleProgress;

        const effectiveAlpha = p.alpha * particleOpacity;
        if (effectiveAlpha <= 0.01) continue;

        // Halo luminoso
        const glowRadius = p.radius * 4;
        const grad = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, glowRadius);
        grad.addColorStop(0, p.accentColor);
        grad.addColorStop(1, 'transparent');

        ctx.save();
        ctx.globalAlpha = effectiveAlpha * 0.65;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(drawX, drawY, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Nucleo de la particula
        ctx.globalAlpha = effectiveAlpha;
        ctx.fillStyle = p.accentColor;
        ctx.beginPath();
        ctx.arc(drawX, drawY, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    if (particleOpacity > 0) {
      drawSwarm(blueSwarm);
      drawSwarm(yellowSwarm);
    }

    // 3. Fases temporales del logotipo y tipografia
    if (elapsed >= T_MATERIALIZE_SVG && !svgLogo.classList.contains('materialized')) {
      svgLogo.classList.add('materialized');
      if (glow) glow.classList.add('visible');
    }

    if (elapsed >= T_STAGE_REVEAL && !brandGroup.classList.contains('revealed')) {
      brandGroup.classList.add('revealed');
    }

    if (elapsed >= T_PULSE_START && !svgLogo.classList.contains('pulse')) {
      svgLogo.classList.add('pulse');
    }

    // Hand off to the programming prelogin after the logo animation.
    if (elapsed >= T_AUTO_FINISH) {
      finishIntro();
      return;
    }

    frame = requestAnimationFrame(render);
  }

  frame = requestAnimationFrame(render);
}
