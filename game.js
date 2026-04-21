const canvas = document.getElementById("canvas");
const canvasContext = canvas.getContext("2d"); // Fixed typo
const pacmanFrames = document.getElementById("animations");
const ghostFrames = document.getElementById("ghosts");

let createRect = (x, y, width, height, color) => {
    canvasContext.fillStyle = color;
    canvasContext.fillRect(x, y, width, height); // Fixed typo
};

let fps = 30;
let oneBlockSize = 20;
let wallColor = "#342DCA";
let wallSpaceWidth = oneBlockSize / 1.5
let wallOffset = (oneBlockSize - wallSpaceWidth) / 2
let wallInnerColor = "black"
let foodColor = "#FEB897"
let score = 0;
let foodCount = 0;
const DIRECTION_RIGHT = 4;
const DIRECTION_UP = 3;
const DIRECTION_LEFT = 2;
const DIRECTION_BOTTOM = 1;
let classicGhostCount = 4;
let eliteIntroFramesRemaining = 0;
let eliteKillablesInPlay = false;
let toastDiscoFrames = 0;
let gameTick = 0;


const SCORE_TO_SPAWN_SPHERE = 125;          // points needed to spawn the sphere
const SPHERE_CELL = { x: 10, y: 10 };        // middle of ghost-spawn box
let teleportSphere = null;                   // { x, y, spawnTick } once active
let gameWon = false;
let gameLost = false;

// ---------- Game state machine ----------
const STATE = { RUNNING: "running", PAUSED: "paused", ENDED: "ended" };
let gameState = STATE.RUNNING;

// ---------- SFX helper ----------
const SFX_EL = {
    flame: document.getElementById("sfx-flame"),
    run: document.getElementById("sfx-run"),
    collide: document.getElementById("sfx-collide"),
    eliteEnter: document.getElementById("sfx-elite-enter"),
    toast: document.getElementById("sfx-toast"),
    lose: document.getElementById("sfx-lose"),
    win: document.getElementById("sfx-win"),
};

const SFX_VARIANTS = {
    flame: [
        "assets/sfx/scream3.mp3",
        "assets/sfx/scream1.mp3",
        "assets/sfx/scream2.mp3",
        "assets/sfx/scream.mp3",
        "assets/sfx/scream4.mp3",
    ],
    run: [
        "assets/sfx/run.mp3",
        "assets/sfx/amelia.mp3",
        "assets/sfx/run1.mp3",
        //"assets/sfx/run2.mp3",
        "assets/sfx/run3.mp3",
        "assets/sfx/run4.mp3",
    ],
    eliteEnter: [
        "assets/sfx/elite-enter.mp3",
        //"assets/sfx/beet1.mp3",
        //"assets/sfx/beet2.mp3",
    ],
};

// Build Audio pools once, so files are preloaded and re-used every trigger.
const SFX_POOL = {};
for (const k in SFX_VARIANTS) {
    SFX_POOL[k] = SFX_VARIANTS[k].map((src) => {
        const a = new Audio(src);
        a.preload = "auto";
        if (k === "run") a.loop = true;
        return a;
    });
}

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Tracks whichever run-variant is currently looping, so runOff() can stop it.
let activeRunEl = null;

let _audioUnlocked = false;
function unlockAudio() {
    if (_audioUnlocked) return;
    _audioUnlocked = true;

    const primeOne = (el) => {
        if (!el) return;
        try {
            el.muted = true;
            const p = el.play();
            const reset = () => {
                try { el.pause(); el.currentTime = 0; } catch (_) {}
                el.muted = false;
            };
            if (p && typeof p.then === "function") {
                p.then(reset).catch(() => { el.muted = false; });
            } else {
                reset();
            }
        } catch (_) { el.muted = false; }
    };

    for (const k in SFX_EL)   primeOne(SFX_EL[k]);
    for (const k in SFX_POOL) SFX_POOL[k].forEach(primeOne);
}
["pointerdown", "touchstart", "keydown", "click"].forEach((evt) =>
    window.addEventListener(evt, unlockAudio, { once: true, capture: true, passive: true })
);

const SFX = {
    play(name) {
        const pool = SFX_POOL[name];
        if (pool && pool.length) {
            const el = pickRandom(pool);
            try {
                el.currentTime = 0;
                const p = el.play();
                if (p && typeof p.catch === "function") p.catch(() => { });
            } catch (_) { }
            return;
        }
        const el = SFX_EL[name];
        if (!el) return;
        try {
            el.currentTime = 0;
            const p = el.play();
            if (p && typeof p.catch === "function") p.catch(() => { });
        } catch (_) { }
    },
    runOn() {
        if (activeRunEl && !activeRunEl.paused) return;
        const pool = SFX_POOL.run;
        if (pool && pool.length) {
            activeRunEl = pickRandom(pool);
            try {
                const p = activeRunEl.play();
                if (p && typeof p.catch === "function") p.catch(() => { });
            } catch (_) { }
            return;
        }
        const el = SFX_EL.run;
        if (!el) return;
        if (el.paused) {
            const p = el.play();
            if (p && typeof p.catch === "function") p.catch(() => { });
        }
        activeRunEl = el;
    },
    runOff() {
        if (activeRunEl) {
            try { activeRunEl.pause(); activeRunEl.currentTime = 0; } catch (_) {
                activeRunEl = null;
            }
            const el = SFX_EL.run;
            //if (!el) return;
            //if (!el.paused) el.pause();
            if (el && !el.paused) el.pause();
        }
    },
    stopAll() {
        for (const k in SFX_EL) {
            const el = SFX_EL[k];
            if (!el) continue;
            try { el.pause(); el.currentTime = 0; } catch (_) { }
        }
        for (const k in SFX_POOL) {
            for (const el of SFX_POOL[k]) {
                try { el.pause(); el.currentTime = 0; } catch (_) { }
            }
        }
        activeRunEl = null;
    },
};




function startToastDisco(frames) {
    toastDiscoFrames = Math.max(toastDiscoFrames, frames);
}
let ghostLocations = [
    { x: 0, y: 0 },
    { x: 176, y: 0 },
    { x: 0, y: 121 },
    { x: 176, y: 121 }
];
let ghosts = [];


















const INITIAL_MAP = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
    [1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1],
    [1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1],
    [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
    [1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1],
    [1, 2, 2, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 2, 1],
    [1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 1, 2, 1, 2, 2, 2, 2, 2, 2, 2, 1, 2, 1, 0, 0, 0, 0],
    [1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 2, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1],
    [2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2],
    [1, 1, 1, 1, 1, 2, 1, 2, 1, 2, 2, 2, 1, 2, 1, 2, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 2, 1, 2, 2, 2, 2, 2, 2, 2, 1, 2, 1, 0, 0, 0, 0],
    [1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1],
    [1, 1, 1, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 1, 1, 1],
    [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
    [1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1],
    [1, 2, 2, 2, 1, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 1, 2, 2, 2, 1],
    [1, 1, 2, 2, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2, 1, 2, 2, 1, 1],
    [1, 2, 2, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 2, 1],
    [1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1],
    [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

let map = INITIAL_MAP.map(row => row.slice()); // deep copy to allow mutation

canvas.width = map[0].length * oneBlockSize;
canvas.height = map.length * oneBlockSize + 56;

let randomTargetsForGhosts = [
    { x: 1 * oneBlockSize, y: 1 * oneBlockSize },
    { x: 1 * oneBlockSize, y: (map.length - 2) * oneBlockSize },
    { x: (map[0].length - 2) * oneBlockSize, y: oneBlockSize },
    { x: (map[0].length - 2) * oneBlockSize, y: (map.length - 2) * oneBlockSize }
]


let restartPacmanAndGhosts = () => {
    createNewPacman();
    eliteIntroFramesRemaining = 0;
    eliteKillablesInPlay = false;
    toastDiscoFrames = 0;
    createGhosts();
};

let onCaughtByGhost = () => {
    if (pacman.isInvulnerable() || pacman.isSolarFrozen()) {
        return;
    }
    SFX.play("collide");
    pacman.lives = Math.max(0, pacman.lives - 1);
    if (pacman.lives <= 0) {
        gameLost = true;
        //drawGaveOver();
        endGame("lose");
        return;
    }
    // still have lives — respawn animation
    pacman.beginSolarPanel();
};

let gameOver = () => {
    endGame("lose");
    //    drawGaveOver();

    //   clearInterval(gameInterval)
}

let drawGameOver = () => {
    canvasContext.font = "bold 25px Emulogic";
    canvasContext.textAlign = "center";
    canvasContext.textBaseline = "middle";
    canvasContext.fillStyle = "white";
    canvasContext.fillText("Game Over!", 200, 200)
}


// ---------- End / Pause / Resume / New Game ----------
// Win video overlay handling
let winVideoTimer = null;
function playWinVideoAndRestart() {
    const overlay = document.getElementById("win-video-overlay");
    const video = document.getElementById("win-video");
    if (!overlay || !video) {
        // Fallback: just restart after a brief pause
        setTimeout(() => newGame(), 1500);
        return;
    }

    // Stop game sounds so the video's own audio (if any) is clear
    try { SFX.stopAll(); } catch (e) {}

    const cleanupAndRestart = () => {
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("error", onEnded);
        overlay.classList.remove("is-visible");
        overlay.setAttribute("aria-hidden", "true");
        try { video.pause(); } catch (e) {}
        try { video.currentTime = 0; } catch (e) {}
        // Return to main screen and restart the game
        newGame();
    };

    const onEnded = () => cleanupAndRestart();

    // Show overlay + start playback
    overlay.classList.add("is-visible");
    overlay.setAttribute("aria-hidden", "false");
    try { video.currentTime = 0; } catch (e) {}
    video.addEventListener("ended", onEnded, { once: true });
    video.addEventListener("error", onEnded, { once: true });

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
            // If autoplay is blocked (e.g. due to audio), retry muted
            try {
                video.muted = true;
                video.play().catch(() => cleanupAndRestart());
            } catch (e) {
                cleanupAndRestart();
            }
        });
    }
}

function endGame(reason) {
    if (gameState === STATE.ENDED) return;
    gameState = STATE.ENDED;
    //SFX.runOff();
    //if (reason === "win") SFX.play("win");
    //else SFX.play("lose");
        if (reason === "win") {
        SFX.play("win");
        // 1.5s delay before playing the fullscreen win video overlay
        if (winVideoTimer) clearTimeout(winVideoTimer);
        winVideoTimer = setTimeout(() => {
            winVideoTimer = null;
            playWinVideoAndRestart();
        }, 1500);
    } else {
        SFX.play("lose");
    }
    // No clearInterval: the loop keeps drawing overlays,
    // but update() is a no-op while state !== RUNNING.
}

function pauseGame() {
    if (gameState !== STATE.RUNNING) return;
    gameState = STATE.PAUSED;
    // SFX.runOff();
}

function resumeGame() {
    if (gameState === STATE.RUNNING) return;
    if (gameState === STATE.ENDED) { newGame(); return; }
    gameState = STATE.RUNNING;
}

function newGame() {
        // cancel any pending win video sequence
    if (winVideoTimer) { clearTimeout(winVideoTimer); winVideoTimer = null; }
    const _overlay = document.getElementById("win-video-overlay");
    const _video = document.getElementById("win-video");
    if (_overlay) { _overlay.classList.remove("is-visible"); _overlay.setAttribute("aria-hidden", "true"); }
    if (_video) { try { _video.pause(); _video.currentTime = 0; } catch (e) {} }

    // reset state
    SFX.stopAll();
    score = 0;
    gameTick = 0;
    teleportSphere = null;
    gameWon = false; gameLost = false;
    eliteIntroFramesRemaining = 0;
    eliteKillablesInPlay = false;
    toastDiscoFrames = 0;
    // reset map in place (keeps same reference for other files)
    for (let i = 0; i < INITIAL_MAP.length; i++)
        for (let j = 0; j < INITIAL_MAP[i].length; j++)
            map[i][j] = INITIAL_MAP[i][j];
    createNewPacman();
    createGhosts();
    gameState = STATE.RUNNING;
    SFX.runOn();
    syncToolbar();
}


let gameLoop = () => {
    draw();

    update();
};

let maybeSpawnTeleportSphere = () => {
    if (teleportSphere || score < SCORE_TO_SPAWN_SPHERE) {
        return;
    }
    teleportSphere = {
        cellX: SPHERE_CELL.x,
        cellY: SPHERE_CELL.y,
        x: SPHERE_CELL.x * oneBlockSize,
        y: SPHERE_CELL.y * oneBlockSize,
        spawnTick: gameTick,
    };
};

let checkTeleportSphereCollision = () => {
    if (!teleportSphere) return false;
    return (
        pacman.getMapX() === teleportSphere.cellX &&
        pacman.getMapY() === teleportSphere.cellY
    );
};


let update = () => {
    if (gameState !== STATE.RUNNING) {
        //SFX.runOff();
        return;
    }
    gameTick++;
    const prevX = pacman.x;
    const prevY = pacman.y;
    pacman.tickState();
    pacman.moveProcess();
    pacman.eat();
    processGhostFlameAndToast();
    updateEliteMidShow();
    updateGhosts();
    if (toastDiscoFrames > 0) {
        toastDiscoFrames--;
    }
    if (pacman.checkGhostCollision()) {
        onCaughtByGhost();
    }
    maybeSpawnTeleportSphere();
    if (checkTeleportSphereCollision()) {
        gameWon = true;
        endGame("win");
        //    drawWin();
        //    clearInterval(gameInterval);
    }


    /*     const moving = gameState === STATE.RUNNING &&
                     (pacman.x !== prevX || pacman.y !== prevY) &&
                     !pacman.isSolarFrozen();
      if (moving) SFX.runOn(); else SFX.runOff(); */

};

let drawWin = () => {
    const playW = map[0].length * oneBlockSize;
    const playH = map.length * oneBlockSize;
    canvasContext.save();
    canvasContext.fillStyle = "rgba(0,0,0,0.6)";
    canvasContext.fillRect(0, 0, playW, playH);
    canvasContext.font = "24px Emulogic";
    canvasContext.textAlign = "center";
    canvasContext.textBaseline = "middle";
    canvasContext.fillStyle = "#9ef7ff";
    canvasContext.fillText("YOU WIN!", playW * 0.5 - 70, playH * 0.5 - 10);
    canvasContext.font = "bold 25px Emulogic";
    canvasContext.fillStyle = "#ffffff";
    canvasContext.fillText("Teleport complete.", playW * 0.5 - 84, playH * 0.5 + 18);
    canvasContext.restore();
};

let drawPauseOverlay = () => {
    if (gameState !== STATE.PAUSED) return;
    const playW = map[0].length * oneBlockSize;
    const playH = map.length * oneBlockSize;
    canvasContext.save();
    canvasContext.fillStyle = "rgba(0,0,0,0.55)";
    canvasContext.fillRect(0, 0, playW, playH);
    canvasContext.font = "22px Emulogic";
    canvasContext.textAlign = "center";
    canvasContext.textBaseline = "middle";
    canvasContext.fillStyle = "#9ef7ff";
    canvasContext.fillText("PAUSED", playW * 0.5 - 50, playH * 0.5);
    canvasContext.restore();
};

let drawFoods = () => {
    for (let i = 0; i < map.length; i++) {
        for (let j = 0; j < map[0].length; j++) {
            if (map[i][j] == 2) {
                createRect(
                    j * oneBlockSize + oneBlockSize / 3,
                    i * oneBlockSize + oneBlockSize / 3,
                    oneBlockSize / 3,
                    oneBlockSize / 3,
                    foodColor
                )
            }
        }
    }
}

let drawTeleportSphere = () => {
    if (!teleportSphere) return;
    const cx = teleportSphere.x + oneBlockSize / 2;
    const cy = teleportSphere.y + oneBlockSize / 2;
    const t = (gameTick - teleportSphere.spawnTick) * 0.12;
    const pulse = 0.6 + 0.4 * Math.sin(t);

    canvasContext.save();

    // outer swirling halo
    const halo = canvasContext.createRadialGradient(cx, cy, 1, cx, cy, oneBlockSize * 1.6);
    halo.addColorStop(0, `rgba(140, 230, 255, ${0.55 * pulse})`);
    halo.addColorStop(0.5, `rgba(120, 80, 255, ${0.35 * pulse})`);
    halo.addColorStop(1, "rgba(20, 0, 60, 0)");
    canvasContext.fillStyle = halo;
    canvasContext.beginPath();
    canvasContext.arc(cx, cy, oneBlockSize * 1.6, 0, Math.PI * 2);
    canvasContext.fill();

    // core orb
    const core = canvasContext.createRadialGradient(
        cx - 2,
        cy - 2,
        1,
        cx,
        cy,
        oneBlockSize * 0.5
    );
    core.addColorStop(0, "#ffffff");
    core.addColorStop(0.35, "#a7e9ff");
    core.addColorStop(0.75, "#5a6bff");
    core.addColorStop(1, "#1a0f55");
    canvasContext.fillStyle = core;
    canvasContext.beginPath();
    canvasContext.arc(cx, cy, oneBlockSize * 0.46 + Math.sin(t) * 1.2, 0, Math.PI * 2);
    canvasContext.fill();

    // orbiting sparks
    for (let i = 0; i < 4; i++) {
        const a = t + (i * Math.PI) / 2;
        const r = oneBlockSize * 0.62;
        const sx = cx + Math.cos(a) * r;
        const sy = cy + Math.sin(a) * r;
        canvasContext.fillStyle = `rgba(255,255,255,${0.6 + 0.4 * Math.sin(t * 2 + i)})`;
        canvasContext.beginPath();
        canvasContext.arc(sx, sy, 1.6, 0, Math.PI * 2);
        canvasContext.fill();
    }

    canvasContext.restore();
};

let drawRemainingLives = () => {
    const y = hudBaseY() - 14;
    const startX = canvas.width - 8 - pacman.livesMax * (oneBlockSize + 4);
    canvasContext.font = "14px Emulogic";
    canvasContext.fillStyle = "#ccc";
    canvasContext.fillText("Lives", startX - 54, y + oneBlockSize * 0.7);
    for (let i = 0; i < pacman.livesMax; i++) {
        const x = startX + i * (oneBlockSize + 4);
        const cx = x + oneBlockSize / 2;
        const cy = y + oneBlockSize / 2;
        if (i < pacman.lives) {
            // live pacman icon
            canvasContext.fillStyle = "#ffcc33";
            canvasContext.beginPath();
            canvasContext.moveTo(cx, cy);
            canvasContext.arc(
                cx,
                cy,
                oneBlockSize / 2 - 1,
                Math.PI * 0.18,
                Math.PI * 1.82
            );
            canvasContext.closePath();
            canvasContext.fill();
        } else {
            // lost life
            canvasContext.strokeStyle = "#555";
            canvasContext.lineWidth = 1.5;
            canvasContext.beginPath();
            canvasContext.arc(cx, cy, oneBlockSize / 2 - 2, 0, Math.PI * 2);
            canvasContext.stroke();
        }
    }
};

let drawMidShowDiscoBackground = () => {
    if (eliteKillablesInPlay || eliteIntroFramesRemaining <= 0 || score < 55) {
        return;
    }
    const playW = map[0].length * oneBlockSize;
    const playH = map.length * oneBlockSize;
    const t = performance.now() * 0.005 + gameTick * 0.08;
    canvasContext.save();
    canvasContext.globalCompositeOperation = "lighter";
    const g = canvasContext.createRadialGradient(
        playW * 0.5,
        playH * 0.35,
        20,
        playW * 0.5,
        playH * 0.5,
        playW * 0.85
    );
    const h0 = (t * 120) % 360;
    g.addColorStop(0, `hsla(${h0}, 100%, 58%, 0.45)`);
    g.addColorStop(0.35, `hsla(${(h0 + 90) % 360}, 100%, 52%, 0.38)`);
    g.addColorStop(0.7, `hsla(${(h0 + 200) % 360}, 95%, 48%, 0.32)`);
    g.addColorStop(1, `hsla(${(h0 + 280) % 360}, 90%, 45%, 0.2)`);
    canvasContext.fillStyle = g;
    canvasContext.fillRect(0, 0, playW, playH);
    for (let i = 0; i < 70; i++) {
        const hue = (i * 19 + t * 140) % 360;
        canvasContext.fillStyle = `hsla(${hue}, 100%, 62%, 0.55)`;
        const sx = (i * 61 + Math.sin(t * 2 + i * 0.7) * 50) % playW;
        const sy = (i * 37 + t * 95) % playH;
        canvasContext.fillRect(sx, sy, 6, 18);
    }
    for (let b = 0; b < 6; b++) {
        const bx =
            playW * 0.12 +
            b * playW * 0.16 +
            Math.sin(t * 3 + b) * 22;
        canvasContext.fillStyle = `hsla(${(h0 + b * 55) % 360}, 100%, 70%, 0.5)`;
        canvasContext.fillRect(bx, 8 + (b % 2) * 6, 14, playH - 20);
    }
    canvasContext.globalCompositeOperation = "source-over";
    canvasContext.font = "25px Emulogic";
    canvasContext.fillStyle = "rgba(255,255,255,0.9)";
      canvasContext.textAlign    = "center";
  canvasContext.textBaseline = "middle";
    canvasContext.fillText("SHOWDOWN", playW * 0.5 - 118, 36);
    canvasContext.restore();
};

let drawEliteMidShow = () => {
    if (eliteKillablesInPlay || eliteIntroFramesRemaining <= 0 || score < 55) {
        return;
    }
    const pulse = 0.55 + 0.45 * Math.sin(gameTick * 0.18);
    const y = map.length * oneBlockSize * 0.38;
    canvasContext.save();
    canvasContext.globalAlpha = 0.92;
    canvasContext.font = "22px Emulogic";
    canvasContext.fillStyle = `rgba(255, 60, 180, ${pulse})`;
    canvasContext.fillText("MID-SHOW", 70, y);
    canvasContext.fillStyle = `rgba(120, 255, 255, ${pulse})`;
    canvasContext.font = "16px Emulogic";
    canvasContext.fillText("Elites roll in…", 88, y + 28);
    canvasContext.strokeStyle = `rgba(255, 255, 100, ${0.35 + 0.2 * pulse})`;
    canvasContext.lineWidth = 3;
    canvasContext.strokeRect(
        6,
        6,
        map[0].length * oneBlockSize - 12,
        map.length * oneBlockSize - 12
    );
    canvasContext.restore();
};

let drawDiscoToastOverlay = () => {
    if (toastDiscoFrames <= 0) {
        return;
    }
    const t = performance.now() * 0.0035;
    const playH = map.length * oneBlockSize;
    const playW = map[0].length * oneBlockSize;
    canvasContext.save();
    canvasContext.globalCompositeOperation = "lighter";
    const g = canvasContext.createLinearGradient(0, 0, canvas.width, playH);
    const h0 = (t * 140) % 360;
    g.addColorStop(0, `hsla(${h0}, 95%, 52%, 0.14)`);
    g.addColorStop(0.45, `hsla(${(h0 + 100) % 360}, 100%, 55%, 0.2)`);
    g.addColorStop(1, `hsla(${(h0 + 220) % 360}, 90%, 50%, 0.16)`);
    canvasContext.fillStyle = g;
    canvasContext.fillRect(0, 0, canvas.width, playH);
    for (let i = 0; i < 48; i++) {
        const hue = (i * 31 + t * 180) % 360;
        canvasContext.fillStyle = `hsla(${hue}, 100%, 65%, 0.4)`;
        const sx = (i * 73 + Math.sin(t + i) * 40) % playW;
        const sy = (i * 41 + t * 120) % playH;
        canvasContext.fillRect(sx, sy, 4, 10);
    }
    canvasContext.globalCompositeOperation = "source-over";
    canvasContext.font = "14px Emulogic";
    canvasContext.fillStyle = "rgba(255,255,255,0.75)";
    canvasContext.fillText("TOAST DISCO", playW * 0.5 - 52, 22);
    canvasContext.restore();
};

const hudBaseY = () => map.length * oneBlockSize + 18;

let drawScore = () => {
    canvasContext.font = "20px Emulogic";
    canvasContext.fillStyle = "white";
    canvasContext.fillText("Score: " + score + " (125)", 8, hudBaseY());
};

let drawEnergyBar = () => {
    const y = hudBaseY() + 22;
    const x = 8;
    const w = 200;
    const h = 10;
    canvasContext.fillStyle = "#222";
    canvasContext.fillRect(x, y, w, h);
    const ratio = Math.max(0, pacman.energy / pacman.energyMax);
    canvasContext.fillStyle =
        ratio > 0.28 ? "#384fd3ff" : ratio > 0.12 ? "#70bb1bff" : "#d9534f";
    canvasContext.fillRect(x, y, w * ratio, h);
    canvasContext.strokeStyle = "#666";
    canvasContext.strokeRect(x, y, w, h);
    canvasContext.font = "14px Emulogic";
    canvasContext.fillStyle = "#ccc";
    canvasContext.fillText("Energy", x + w + 10, y + h - 1);
};



let drawGhosts = () => {
    for (let i = 0; i < ghosts.length; i++) {
        ghosts[i].draw();
    }
}


let draw = () => {
    createRect(0, 0, canvas.width, canvas.height, "black");
    drawMidShowDiscoBackground();
    drawWalls();
    drawFoods();
    drawTeleportSphere();
    drawGhosts();
    pacman.draw();
    drawEliteMidShow();
    drawDiscoToastOverlay();
    drawScore();
    drawEnergyBar();
    drawRemainingLives();
    if (pacman.isSolarFrozen() && gameState === STATE.RUNNING) {
        canvasContext.font = "bold 25px Emulogic";
        canvasContext.fillStyle = "#ffffffff";
          canvasContext.textAlign    = "center";
  canvasContext.textBaseline = "middle";
        canvasContext.fillText("Solar Panel recharging…", 200, map.length * oneBlockSize * 0.45);
    }
    if (gameState === STATE.ENDED) {
        if (gameWon) drawWin(); else drawGameOver();
    }
    drawPauseOverlay();
};

// Initial rendering for testin
let gameInterval = setInterval(gameLoop, 1000 / fps);

let drawWalls = () => {
    for (let i = 0; i < map.length; i++) {
        for (let j = 0; j < map[0].length; j++) {
            if (map[i][j] === 1) {
                createRect(
                    j * oneBlockSize,
                    i * oneBlockSize,
                    oneBlockSize,
                    oneBlockSize,
                    wallColor
                );
                if (j > 0 && map[i][j - 1] == 1) {
                    createRect(
                        j * oneBlockSize,
                        i * oneBlockSize + wallOffset,
                        wallSpaceWidth + wallOffset,
                        wallSpaceWidth,
                        wallInnerColor
                    )
                }
                if (j < map[0].length - 1 && map[i][j + 1] == 1) {
                    createRect(
                        j * oneBlockSize + wallOffset,
                        i * oneBlockSize + wallOffset,
                        wallSpaceWidth + wallOffset,
                        wallSpaceWidth,
                        wallInnerColor
                    )
                }
                if (i > 0 && map[i - 1][j] == 1) {
                    createRect(
                        j * oneBlockSize + wallOffset,
                        i * oneBlockSize,
                        wallSpaceWidth,
                        wallSpaceWidth + wallOffset,
                        wallInnerColor
                    )
                }
                if (i < map[0].length - 1 && map[i + 1][j] == 1) {
                    createRect(
                        j * oneBlockSize + wallOffset,
                        i * oneBlockSize + wallOffset,
                        wallSpaceWidth,
                        wallSpaceWidth + wallOffset,
                        wallInnerColor
                    )
                }
            }
        }
    }
};

let createGhosts = () => {
    ghosts = [];
    for (let i = 0; i < classicGhostCount; i++) {
        let newGhost = new Ghost(
            9 * oneBlockSize + (i % 2 == 0 ? 0 : 1) * oneBlockSize,
            10 * oneBlockSize + (i % 2 == 0 ? 0 : 1) * oneBlockSize,
            oneBlockSize,
            oneBlockSize,
            (pacman.baseSpeed / 2) * 1.2,
            ghostLocations[i % 4].x,
            ghostLocations[i % 4].y,
            124,
            116,
            6 + i,
            false
        );
        ghosts.push(newGhost);
    }
};

let spawnEliteKillablesNow = () => {
    const eliteSpeed = (pacman.baseSpeed / 2.45) * 1.15;
    const eliteRange = 8;
    const rowY = 11 * oneBlockSize;
    const offLeft = -2 * oneBlockSize;
    const offRight = (map[0].length + 2) * oneBlockSize;
    ghosts.push(
        new Ghost(
            offLeft,
            rowY,
            oneBlockSize,
            oneBlockSize,
            eliteSpeed,
            ghostLocations[0].x,
            ghostLocations[0].y,
            124,
            116,
            eliteRange,
            true,
            {
                rollFrames: 58,
                fromX: offLeft,
                targetX: 9 * oneBlockSize,
            }
        )
    );
    ghosts.push(
        new Ghost(
            offRight,
            rowY,
            oneBlockSize,
            oneBlockSize,
            eliteSpeed,
            ghostLocations[2].x,
            ghostLocations[2].y,
            124,
            116,
            eliteRange,
            true,
            {
                rollFrames: 58,
                fromX: offRight,
                targetX: 11 * oneBlockSize,
            }
        )
    );
    SFX.play("eliteEnter");
};

let updateEliteMidShow = () => {
    if (eliteKillablesInPlay || score < 55) {
        return;
    }
    if (eliteIntroFramesRemaining === 0) {
        eliteIntroFramesRemaining = 120;
        return;
    }
    eliteIntroFramesRemaining--;
    if (eliteIntroFramesRemaining <= 0) {
        spawnEliteKillablesNow();
        eliteKillablesInPlay = true;
        eliteIntroFramesRemaining = 0;
    }
};


let createNewPacman = () => {
    pacman = new Pacman(
        oneBlockSize, oneBlockSize, oneBlockSize,
        oneBlockSize, oneBlockSize / 5
    );
};

createNewPacman();
createGhosts();
gameLoop();

window.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
        event.preventDefault();
        if (gameState === STATE.RUNNING && pacman.tryStartFlame()) SFX.play("flame");
    }
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
        event.preventDefault();
        pacman.sprintHeld = true;
    }
    let k = event.keyCode;
    setTimeout(() => {
        if (k == 37 || k == 65) {
            pacman.nextDirection = DIRECTION_LEFT;
        } else if (k == 38 || k == 87) {
            pacman.nextDirection = DIRECTION_UP;
        } else if (k == 39 || k == 68) {
            pacman.nextDirection = DIRECTION_RIGHT;
        } else if (k == 40 || k == 83) {
            pacman.nextDirection = DIRECTION_BOTTOM;
        }
    }, 1);
});

window.addEventListener("keyup", (event) => {
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
        pacman.sprintHeld = false;
    }
});
function getGhostSpeedScale() {
    return Math.max(1, 1 + Math.min(0.5, score / 200)); // keeps speed ≈ 2.4–3.6
}
(function bindTouchControls() {

    const bindTap = (el, handler) => {
        if (!el) return;
        const wrapped = (e) => {
            if (e.cancelable) e.preventDefault();
            handler(e);
        };
        el.addEventListener("pointerdown", wrapped);
        el.addEventListener("touchstart",  wrapped, { passive: false });
    };


    const bindDir = (id, dir) => {
/*         const el = document.getElementById(id);
        if (el) {
            el.addEventListener("click", () => {
                pacman.nextDirection = dir;
            });
        } */
                bindTap(document.getElementById(id), () => { pacman.nextDirection = dir; });

    };
    bindDir("left", DIRECTION_LEFT);
    bindDir("right", DIRECTION_RIGHT);
    bindDir("up", DIRECTION_UP);
    bindDir("down", DIRECTION_BOTTOM);
/*     const fireBtn = document.getElementById("fire");
    if (fireBtn) {
        fireBtn.addEventListener("click", () => pacman.tryStartFlame());
        fireBtn.addEventListener("click", () => {
            if (gameState === STATE.RUNNING && pacman.tryStartFlame()) SFX.play("flame");
 */
                bindTap(document.getElementById("fire"), () => {
        if (gameState === STATE.RUNNING && pacman.tryStartFlame()) {
            SFX.play("flame");
        }
        });
    }
)();

// ---------- Floating toolbar (Start / Pause / New Game) ----------
function syncToolbar() {
    const b = (id) => document.getElementById(id);
    const bs = b("btn-start"), bp = b("btn-pause"), bn = b("btn-newgame");
    if (!bs || !bp || !bn) return;
    bs.setAttribute("data-active", String(gameState === STATE.RUNNING));
    bp.setAttribute("data-active", String(gameState === STATE.PAUSED));
    bn.setAttribute("data-active", "false");
    bp.textContent = gameState === STATE.PAUSED ? "Resume" : "Pause";
}
(function bindToolbar() {
    const bs = document.getElementById("btn-start");
    const bp = document.getElementById("btn-pause");
    const bn = document.getElementById("btn-newgame");
    if (bs) bs.addEventListener("click", () => { resumeGame(); syncToolbar(); });
    if (bp) bp.addEventListener("click", () => {
        if (gameState === STATE.RUNNING) pauseGame();
        else if (gameState === STATE.PAUSED) resumeGame();
        syncToolbar();
    });
    if (bn) bn.addEventListener("click", () => { newGame(); });
    syncToolbar();
})();