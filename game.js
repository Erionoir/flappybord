const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('bestScore');
const startOverlay = document.getElementById('startOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const finalScoreEl = document.getElementById('finalScore');
const finalBestScoreEl = document.getElementById('finalBestScore');
const restartBtn = document.getElementById('restartBtn');

const STORAGE_KEY = 'flappy-bird-clone-best';

const state = {
    phase: 'ready',
    dpr: window.devicePixelRatio || 1,
    score: 0,
    best: Number(localStorage.getItem(STORAGE_KEY)) || 0,
    bird: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        velocity: 0,
        rotation: 0
    },
    physics: {
        gravity: 0,
        jumpVelocity: 0,
        maxFallSpeed: 0,
        rotationUp: -0.5,
        rotationDown: 0.85
    },
    metrics: {
        width: window.innerWidth,
        height: window.innerHeight,
        groundY: 0,
        groundHeight: 0,
        pipeGap: 0,
        pipeWidth: 0,
        pipeSpeed: 0,
        spawnInterval: 1.35,
        birdHeight: 0,
        birdWidth: 0
    },
    pipes: [],
    spawnTimer: 0,
    readyTime: 0,
    groundOffset: 0,
    shake: {
        strength: 0,
        duration: 0,
        time: 0
    },
    currentShakeOffset: { x: 0, y: 0 },
    graceTimer: 0,
    background: {
        skyStops: [
            { offset: 0, color: '#4fcafe' },
            { offset: 0.55, color: '#67d5ff' },
            { offset: 1, color: '#a4e8ff' }
        ],
        sun: { x: 0, y: 0, radius: 0, glow: '#ffdd8c' },
        parallax: { far: 0, mid: 0 },
        layers: {
            far: '#7fbbff',
            mid: '#6fd581'
        }
    },
    clouds: [],
    lastTimestamp: performance.now()
};

function configureCanvas() {
    state.dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.max(320, window.innerWidth);
    const displayHeight = Math.max(480, window.innerHeight);

    canvas.width = Math.floor(displayWidth * state.dpr);
    canvas.height = Math.floor(displayHeight * state.dpr);
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    state.metrics.width = displayWidth;
    state.metrics.height = displayHeight;
    updateDerivedMetrics();
}

function updateDerivedMetrics() {
    const { width, height } = state.metrics;

    state.metrics.groundHeight = Math.max(48, height * 0.11);
    state.metrics.groundY = height - state.metrics.groundHeight;
    state.metrics.pipeGap = Math.max(180, height * 0.32);
    state.metrics.pipeWidth = Math.max(44, width * 0.09);
    state.metrics.pipeSpeed = Math.max(200, width * 0.34);
    state.metrics.spawnInterval = 1.4;
    state.metrics.birdHeight = Math.max(28, height * 0.06);
    state.metrics.birdWidth = state.metrics.birdHeight * 1.25;

    state.physics.gravity = height * 5.6;
    state.physics.jumpVelocity = -height * 1.95;
    state.physics.maxFallSpeed = height * 3.3;

    state.bird.width = state.metrics.birdWidth;
    state.bird.height = state.metrics.birdHeight;
    state.bird.x = width * 0.25 - state.bird.width / 2;

    if (state.phase === 'ready') {
        state.bird.y = height * 0.4;
        state.bird.velocity = 0;
        state.bird.rotation = 0;
    }
}

function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function randomizeEnvironment() {
    const { width, height, groundY, groundHeight } = state.metrics;
    const baseHue = randomRange(185, 225);
    const variance = randomRange(-8, 10);
    const saturation = randomRange(60, 78);

    state.background.skyStops = [
        { offset: 0, color: `hsl(${baseHue + variance}, ${saturation}%, 78%)` },
        { offset: 0.45, color: `hsl(${baseHue}, ${saturation + 5}%, 72%)` },
        { offset: 0.8, color: `hsl(${baseHue - 6}, ${saturation + 3}%, 68%)` },
        { offset: 1, color: `hsl(${baseHue - 12}, ${saturation + 2}%, 82%)` }
    ];

    const sunRadius = Math.min(width, height) * randomRange(0.07, 0.11);
    state.background.sun = {
        x: width * randomRange(0.62, 0.88),
        y: height * randomRange(0.12, 0.22),
        radius: sunRadius,
        glow: `hsla(${baseHue + 120}, 95%, 85%, 0.55)`
    };

    state.background.layers = {
        far: `hsl(${baseHue - 22}, ${Math.max(40, saturation - 20)}%, 74%)`,
        mid: `hsl(${baseHue - 48}, ${Math.max(38, saturation - 18)}%, 58%)`
    };

    state.background.parallax = { far: 0, mid: 0 };
    state.groundOffset = 0;

    const cloudCount = Math.max(8, Math.round(width / 140));
    state.clouds = Array.from({ length: cloudCount }, () => createCloud());

    // Ensure clouds don't start clustered in one region.
    state.clouds.sort((a, b) => a.x - b.x);
    for (let i = 0; i < state.clouds.length; i += 1) {
        const spacing = width / state.clouds.length;
        const jitter = randomRange(-spacing * 0.35, spacing * 0.35);
        state.clouds[i].x = (spacing * i + jitter + width) % width;
    }
}

function createCloud() {
    const { width, height } = state.metrics;
    const scale = randomRange(0.55, 1.4);
    const baseWidth = Math.max(120, width * 0.13);
    const cloudWidth = baseWidth * scale;
    const cloudHeight = cloudWidth * randomRange(0.32, 0.5);

    return {
        x: Math.random() * width,
        y: height * randomRange(0.05, 0.32),
        width: cloudWidth,
        height: cloudHeight,
        speed: Math.max(22, state.metrics.pipeSpeed * randomRange(0.045, 0.095)),
        opacity: randomRange(0.18, 0.42),
        lumps: [
            {
                offsetX: -cloudWidth * randomRange(0.2, 0.35),
                offsetY: cloudHeight * randomRange(-0.05, 0.1),
                radiusX: cloudWidth * randomRange(0.35, 0.48),
                radiusY: cloudHeight * randomRange(0.52, 0.7)
            },
            {
                offsetX: 0,
                offsetY: -cloudHeight * randomRange(0.05, 0.18),
                radiusX: cloudWidth * randomRange(0.4, 0.55),
                radiusY: cloudHeight * randomRange(0.5, 0.68)
            },
            {
                offsetX: cloudWidth * randomRange(0.18, 0.32),
                offsetY: cloudHeight * randomRange(-0.02, 0.15),
                radiusX: cloudWidth * randomRange(0.28, 0.4),
                radiusY: cloudHeight * randomRange(0.48, 0.65)
            }
        ]
    };
}

function updateClouds(delta) {
    const { width, height } = state.metrics;

    state.clouds.forEach(cloud => {
        cloud.x -= cloud.speed * delta;

        if (cloud.x < -cloud.width * 1.2) {
            const replacement = createCloud();
            cloud.width = replacement.width;
            cloud.height = replacement.height;
            cloud.lumps = replacement.lumps;
            cloud.speed = replacement.speed;
            cloud.opacity = replacement.opacity;
            cloud.x = width + cloud.width * randomRange(0.1, 0.6);
            cloud.y = height * randomRange(0.05, 0.35);
        }
    });
}

function updateParallax(delta) {
    if (state.phase !== 'playing') {
        return;
    }

    const { pipeSpeed, width } = state.metrics;
    state.background.parallax.far = (state.background.parallax.far + pipeSpeed * 0.12 * delta) % width;
    state.background.parallax.mid = (state.background.parallax.mid + pipeSpeed * 0.22 * delta) % width;
    state.groundOffset = (state.groundOffset + pipeSpeed * delta) % width;
}

function setPhase(nextPhase) {
    state.phase = nextPhase;

    if (nextPhase === 'ready') {
        startOverlay.classList.add('overlay--visible');
        startOverlay.setAttribute('aria-hidden', 'false');
        gameOverOverlay.classList.remove('overlay--visible');
        gameOverOverlay.setAttribute('aria-hidden', 'true');
        state.readyTime = 0;
        state.bird.velocity = 0;
        state.bird.rotation = 0;
    } else if (nextPhase === 'playing') {
        startOverlay.classList.remove('overlay--visible');
        startOverlay.setAttribute('aria-hidden', 'true');
        gameOverOverlay.classList.remove('overlay--visible');
        gameOverOverlay.setAttribute('aria-hidden', 'true');
    } else if (nextPhase === 'over') {
        gameOverOverlay.classList.add('overlay--visible');
        gameOverOverlay.setAttribute('aria-hidden', 'false');
    }
}

function resetGame() {
    randomizeEnvironment();
    state.pipes = [];
    state.score = 0;
    state.spawnTimer = 0;
    state.bird.velocity = 0;
    state.bird.rotation = 0;
    state.bird.y = state.metrics.height * 0.4;
    state.groundOffset = 0;
    state.shake = { strength: 0, duration: 0, time: 0 };
    state.currentShakeOffset = { x: 0, y: 0 };
    state.graceTimer = 0;
    updateScoreDisplay();
}

function updateScoreDisplay() {
    scoreEl.textContent = `${state.score}`;
    bestScoreEl.textContent = `${state.best}`;
}

function startGame() {
    resetGame();
    setPhase('playing');
    state.spawnTimer = 0.35;
    state.bird.velocity = state.physics.jumpVelocity;
    state.bird.rotation = state.physics.rotationUp;
    state.bird.y = state.metrics.height * 0.45;
    state.graceTimer = 0.45;
    state.lastTimestamp = performance.now();
}

function startDying() {
    if (state.phase !== 'playing') return;
    state.phase = 'dying';
    state.spawnTimer = 0;
    state.graceTimer = 0;
    state.bird.velocity = Math.max(state.bird.velocity, state.physics.maxFallSpeed * 0.35);
}

function finalizeGameOver() {
    if (state.phase === 'over') return;
    setPhase('over');

    if (state.score > state.best) {
        state.best = state.score;
        localStorage.setItem(STORAGE_KEY, String(state.best));
    }

    finalScoreEl.textContent = `${state.score}`;
    finalBestScoreEl.textContent = `${state.best}`;
    updateScoreDisplay();
}

function flap() {
    state.bird.velocity = state.physics.jumpVelocity;
    state.bird.rotation = state.physics.rotationUp;
}

function spawnPipe() {
    const { width, pipeWidth, pipeGap, groundY, height } = state.metrics;
    const gap = clamp(pipeGap * randomRange(0.86, 1.12), height * 0.26, height * 0.44);
    const minTop = height * 0.08;
    const maxTop = Math.max(minTop + 40, groundY - gap - height * 0.09);
    const topHeight = randomRange(minTop, maxTop);
    const spawnWidth = clamp(pipeWidth * randomRange(0.92, 1.06), pipeWidth * 0.85, pipeWidth * 1.12);

    state.pipes.push({
        x: width + spawnWidth,
        width: spawnWidth,
        topHeight,
        bottomY: topHeight + gap,
        scored: false
    });
}

function update(delta) {
    const { pipeSpeed, groundY, width } = state.metrics;

    state.currentShakeOffset = { x: 0, y: 0 };
    updateClouds(delta);
    updateParallax(delta);

    if (state.phase === 'ready') {
        state.readyTime += delta;
        const floatAmplitude = state.metrics.height * 0.015;
        state.bird.y = state.metrics.height * 0.4 + Math.sin(state.readyTime * 3) * floatAmplitude;
        state.bird.rotation = Math.sin(state.readyTime * 2.6) * 0.12;
        return;
    }

    if (state.phase === 'dying') {
        const shakeOffset = getShakeOffset(delta);

        state.bird.velocity += state.physics.gravity * delta;
        if (state.bird.velocity > state.physics.maxFallSpeed) {
            state.bird.velocity = state.physics.maxFallSpeed;
        }

        state.bird.y += state.bird.velocity * delta;

        if (state.bird.y + state.bird.height >= groundY) {
            state.bird.y = groundY - state.bird.height;
            triggerShake(20, 0.3);
            finalizeGameOver();
        }

        const tiltTarget = state.physics.rotationDown + 0.35;
        state.bird.rotation = lerp(state.bird.rotation, tiltTarget, Math.min(1, delta * 6));

        state.pipes.forEach(pipe => {
            pipe.x -= pipeSpeed * delta;
        });

        state.currentShakeOffset = shakeOffset;
        return;
    }

    if (state.phase !== 'playing') {
        return;
    }

    const shakeOffset = getShakeOffset(delta);
    state.currentShakeOffset = shakeOffset;

    if (state.graceTimer > 0) {
        state.graceTimer = Math.max(0, state.graceTimer - delta);
    }

    state.spawnTimer -= delta;
    if (state.spawnTimer <= 0) {
        spawnPipe();
        state.spawnTimer = state.metrics.spawnInterval;
    }

    for (let i = state.pipes.length - 1; i >= 0; i -= 1) {
        const pipe = state.pipes[i];
        pipe.x -= pipeSpeed * delta;

        if (!pipe.scored && pipe.x + pipe.width < state.bird.x) {
            pipe.scored = true;
            state.score += 1;
            updateScoreDisplay();
        }

        if (pipe.x + pipe.width < -pipe.width) {
            state.pipes.splice(i, 1);
            continue;
        }

        if (state.graceTimer <= 0 && state.phase === 'playing' && checkPipeCollision(pipe)) {
            triggerShake(14, 0.4);
            startDying();
            break;
        }
    }

    if (state.phase !== 'playing') {
        return;
    }

    state.bird.velocity += state.physics.gravity * delta;
    if (state.bird.velocity > state.physics.maxFallSpeed) {
        state.bird.velocity = state.physics.maxFallSpeed;
    }

    state.bird.y += state.bird.velocity * delta;

    if (state.bird.y < 0) {
        state.bird.y = 0;
        state.bird.velocity = 0;
    }

    if (state.bird.y + state.bird.height >= groundY) {
        state.bird.y = groundY - state.bird.height;

        if (state.graceTimer <= 0) {
            triggerShake(18, 0.45);
            startDying();
        } else {
            state.bird.velocity = Math.min(state.bird.velocity, 0);
        }
        return;
    }

    const fallRatio = Math.min(1, Math.max(0, state.bird.velocity / state.physics.maxFallSpeed));
    state.bird.rotation = lerp(state.physics.rotationUp, state.physics.rotationDown, fallRatio);
}

function checkPipeCollision(pipe) {
    const withinX = state.bird.x + state.bird.width > pipe.x && state.bird.x < pipe.x + pipe.width;
    if (!withinX) return false;

    const hitsTop = state.bird.y < pipe.topHeight;
    const hitsBottom = state.bird.y + state.bird.height > pipe.bottomY;
    return hitsTop || hitsBottom;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function triggerShake(strength, duration = 0.3) {
    if (strength <= 0 || duration <= 0) {
        state.shake = { strength: 0, duration: 0, time: 0 };
        return;
    }

    // Take the stronger shake if one is already active to keep big impacts punchy.
    if (state.shake.duration > 0) {
        state.shake.strength = Math.max(strength, state.shake.strength);
        state.shake.duration = Math.max(duration, state.shake.duration - state.shake.time);
        state.shake.time = 0;
    } else {
        state.shake.strength = strength;
        state.shake.duration = duration;
        state.shake.time = 0;
    }
}

function getShakeOffset(delta) {
    if (state.shake.duration <= 0) {
        return { x: 0, y: 0 };
    }

    state.shake.time += delta;

    if (state.shake.time >= state.shake.duration) {
        state.shake = { strength: 0, duration: 0, time: 0 };
        return { x: 0, y: 0 };
    }

    const progress = state.shake.time / state.shake.duration;
    const damping = 1 - progress;
    const magnitude = state.shake.strength * damping;
    const angle = Math.random() * Math.PI * 2;

    return {
        x: Math.cos(angle) * magnitude,
        y: Math.sin(angle) * magnitude
    };
}

function draw() {
    const { width, height } = state.metrics;
    const shake = state.currentShakeOffset || { x: 0, y: 0 };

    ctx.save();
    ctx.translate(shake.x, shake.y);
    ctx.clearRect(-shake.x, -shake.y, width, height);
    drawBackground();
    drawPipes();
    drawGround();
    drawBird();
    ctx.restore();
}

function drawBackground() {
    const { width, groundY, height, groundHeight } = state.metrics;
    const { skyStops, sun, parallax } = state.background;

    const gradient = ctx.createLinearGradient(0, 0, 0, groundY);
    const stops = skyStops && skyStops.length ? skyStops : [
        { offset: 0, color: '#4fcafe' },
        { offset: 0.45, color: '#67d5ff' },
        { offset: 0.85, color: '#a4e8ff' }
    ];
    stops.forEach(stop => {
        gradient.addColorStop(stop.offset, stop.color);
    });
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, groundY);

    if (sun && sun.radius) {
        const sunGlow = ctx.createRadialGradient(
            sun.x,
            sun.y,
            sun.radius * 0.15,
            sun.x,
            sun.y,
            sun.radius * 1.5
        );
        sunGlow.addColorStop(0, 'rgba(255, 255, 240, 0.95)');
        sunGlow.addColorStop(0.5, sun.glow || 'rgba(255, 221, 140, 0.45)');
        sunGlow.addColorStop(1, 'rgba(255, 221, 140, 0)');
        ctx.fillStyle = sunGlow;
        ctx.beginPath();
        ctx.arc(sun.x, sun.y, sun.radius * 1.4, 0, Math.PI * 2);
        ctx.fill();
    }

    const farOffset = parallax.far % width;
    ctx.save();
    ctx.translate(-farOffset, 0);
    for (let i = -1; i <= 1; i += 1) {
        drawFarRange(i * width);
    }
    ctx.restore();

    drawCloudLayer();

    const midOffset = parallax.mid % width;
    ctx.save();
    ctx.translate(-midOffset, 0);
    for (let i = -1; i <= 1; i += 1) {
        drawNearHills(i * width);
    }
    ctx.restore();
}

function drawFarRange(baseX) {
    const { width, height, groundY, groundHeight } = state.metrics;
    const horizon = groundY - groundHeight * 0.82;

    ctx.fillStyle = state.background.layers?.far || '#7fbbff';
    ctx.beginPath();
    ctx.moveTo(baseX, groundY);
    ctx.lineTo(baseX + width * 0.08, horizon + height * 0.09);
    ctx.lineTo(baseX + width * 0.24, horizon - height * 0.08);
    ctx.lineTo(baseX + width * 0.46, horizon + height * 0.03);
    ctx.lineTo(baseX + width * 0.68, horizon - height * 0.1);
    ctx.lineTo(baseX + width * 0.88, horizon + height * 0.06);
    ctx.lineTo(baseX + width, groundY);
    ctx.lineTo(baseX, groundY);
    ctx.closePath();
    ctx.fill();
}

function drawNearHills(baseX) {
    const { width, height, groundY, groundHeight } = state.metrics;
    const hillBase = groundY - groundHeight * 0.48;

    ctx.fillStyle = state.background.layers?.mid || '#6fd581';
    ctx.beginPath();
    ctx.moveTo(baseX, groundY);
    ctx.quadraticCurveTo(baseX + width * 0.16, hillBase - height * 0.08, baseX + width * 0.34, hillBase + height * 0.02);
    ctx.quadraticCurveTo(baseX + width * 0.58, hillBase - height * 0.1, baseX + width * 0.82, hillBase + height * 0.05);
    ctx.lineTo(baseX + width, groundY);
    ctx.closePath();
    ctx.fill();
}

function drawCloudLayer() {
    state.clouds.forEach(cloud => {
        ctx.save();
        ctx.translate(cloud.x, cloud.y);
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        ctx.globalAlpha = cloud.opacity;
        cloud.lumps.forEach(lump => {
            ctx.beginPath();
            ctx.ellipse(lump.offsetX, lump.offsetY, lump.radiusX, lump.radiusY, 0, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.restore();
    });
}

function drawPipes() {
    const { groundY } = state.metrics;

    state.pipes.forEach(pipe => {
        ctx.fillStyle = '#7ed957';
        ctx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight);
        ctx.fillRect(pipe.x, pipe.bottomY, pipe.width, groundY - pipe.bottomY);

        ctx.fillStyle = '#6ac44f';
        ctx.fillRect(pipe.x - 4, pipe.topHeight - 18, pipe.width + 8, 18);
        ctx.fillRect(pipe.x - 4, pipe.bottomY, pipe.width + 8, 18);

        ctx.fillStyle = '#58a83e';
        ctx.fillRect(pipe.x + pipe.width * 0.18, 0, pipe.width * 0.1, pipe.topHeight);
        ctx.fillRect(pipe.x + pipe.width * 0.18, pipe.bottomY, pipe.width * 0.1, groundY - pipe.bottomY);
    });
}

function drawGround() {
    const { width, height, groundY, groundHeight } = state.metrics;

    const groundGradient = ctx.createLinearGradient(0, groundY, 0, height);
    groundGradient.addColorStop(0, '#e9d18f');
    groundGradient.addColorStop(1, '#cba065');
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, groundY, width, groundHeight);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(0, groundY, width, groundHeight * 0.12);

    const tileWidth = Math.max(24, width * 0.06);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    for (let x = -tileWidth + (state.groundOffset % tileWidth); x < width + tileWidth; x += tileWidth) {
        ctx.fillRect(x, groundY + groundHeight * 0.55, tileWidth * 0.5, tileWidth * 0.35);
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(0, groundY - 4, width, 4);
}

function drawBird() {
    const { x, y, width, height, rotation } = state.bird;

    ctx.save();
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate(rotation);

    ctx.fillStyle = '#ffd93d';
    ctx.beginPath();
    ctx.ellipse(0, 0, width * 0.55, height * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffc53d';
    ctx.beginPath();
    ctx.ellipse(-width * 0.1, height * 0.05, width * 0.35, height * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(width * 0.18, -height * 0.18, width * 0.22, height * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3b3b3b';
    ctx.beginPath();
    ctx.ellipse(width * 0.24, -height * 0.2, width * 0.08, height * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff914d';
    ctx.beginPath();
    ctx.moveTo(width * 0.45, -height * 0.05);
    ctx.lineTo(width * 0.75, 0);
    ctx.lineTo(width * 0.45, height * 0.08);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

function handlePrimaryAction(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (state.phase === 'ready') {
        startGame();
        return;
    }

    if (state.phase === 'playing') {
        flap();
        return;
    }

    if (state.phase === 'over') {
        startGame();
        return;
    }
}

function onKeyDown(event) {
    if (event.code === 'Space' || event.code === 'ArrowUp') {
        handlePrimaryAction(event);
    }
}

function gameLoop(timestamp) {
    const delta = Math.min((timestamp - state.lastTimestamp) / 1000, 0.05);
    state.lastTimestamp = timestamp;

    update(delta);
    draw();

    window.requestAnimationFrame(gameLoop);
}

function init() {
    configureCanvas();
    resetGame();
    setPhase('ready');
    updateScoreDisplay();
    state.lastTimestamp = performance.now();
    window.requestAnimationFrame(gameLoop);
}

window.addEventListener('resize', () => {
    configureCanvas();
    if (state.phase === 'playing') {
        setPhase('ready');
    }
    resetGame();
});

canvas.addEventListener('pointerdown', handlePrimaryAction, { passive: false });
canvas.addEventListener('touchstart', handlePrimaryAction, { passive: false });
canvas.addEventListener('click', handlePrimaryAction, { passive: false });
document.addEventListener('keydown', onKeyDown, { passive: false });
startOverlay.addEventListener('pointerdown', handlePrimaryAction, { passive: false });
startOverlay.addEventListener('touchstart', handlePrimaryAction, { passive: false });
startOverlay.addEventListener('click', handlePrimaryAction, { passive: false });
restartBtn.addEventListener('pointerdown', handlePrimaryAction, { passive: false });
restartBtn.addEventListener('touchstart', handlePrimaryAction, { passive: false });
restartBtn.addEventListener('click', handlePrimaryAction, { passive: false });

init();
