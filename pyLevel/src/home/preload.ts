// PyLevel logo animation. The entry controller owns background focus and scroll.
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

  // Points sampled from the supplied PyLevel emblem, normalized to a 111-unit canvas.
  const LOGO_BLUE_POINTS: [number, number][] = [
    [20.2, 19],
    [13.8, 26.2],
    [8.3, 34.2],
    [5.2, 43.4],
    [2.3, 52.8],
    [6.7, 60.9],
    [9.7, 70.2],
    [7.7, 79.7],
    [8.1, 89.4],
    [12.1, 98.1],
    [21.1, 101.4],
    [30.5, 104.3],
    [40, 106.4],
    [49.9, 106.6],
    [59.6, 105.3],
    [69.2, 103.7],
    [78.9, 101.9],
    [88.7, 101.2],
    [98.1, 98.8],
    [105.4, 92.6],
    [107.1, 83.2],
    [104.3, 73.9],
    [103.2, 64.2],
    [105.9, 55],
    [108.1, 45.5],
    [108, 35.8],
    [102, 28.7],
    [98.1, 21.9],
    [92.3, 15.4],
    [83.6, 11.2],
    [74.8, 6.9],
    [65.3, 4.4],
    [55.5, 4.4],
    [45.7, 4.9],
    [36.5, 8.3],
    [27.9, 12.9]
  ];
  const LOGO_GOLD_POINTS: [number, number][] = [
    [17.1, 22.7],
    [11.1, 30.3],
    [6.9, 38.8],
    [3.5, 48],
    [3.3, 57.5],
    [8.5, 65.5],
    [9, 75],
    [7.2, 84.6],
    [9.1, 94.2],
    [16.2, 100.6],
    [25.8, 102.8],
    [35.2, 105.7],
    [45, 106.6],
    [54.8, 106.5],
    [64.4, 104.3],
    [74, 102.6],
    [83.8, 101.4],
    [93.5, 100.5],
    [102.5, 96.5],
    [107.1, 88.1],
    [105.1, 78.7],
    [103.4, 69.1],
    [103.9, 59.3],
    [107.2, 50.3],
    [108.9, 40.6],
    [105.3, 31.9],
    [98.4, 26],
    [96.6, 17.6],
    [87.7, 13.8],
    [79.2, 8.9],
    [70.2, 5.1],
    [60.4, 4.4],
    [50.6, 4.5],
    [41.2, 6.8],
    [32, 10.3],
    [23.9, 15.8]
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

  const PARTICLES_PER_SWARM = 130;

  function createParticles(
    points: [number, number][],
    baseColor: string,
    accentColor: string,
    spawnOriginX: number,
    spawnOriginY: number
  ): IntroParticle[] {
    const list: IntroParticle[] = [];
    for (let i = 0; i < PARTICLES_PER_SWARM; i++) {
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
    blueSwarm = createParticles(LOGO_BLUE_POINTS, '#3776ab', '#60a5fa', w * 0.22, h * 0.26);
    // Enjambre amarillo: nace hacia abajo a la derecha
    yellowSwarm = createParticles(LOGO_GOLD_POINTS, '#ffd43b', '#fde047', w * 0.78, h * 0.74);
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
