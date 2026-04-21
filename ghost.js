class Ghost {
    constructor(
        x,
        y,
        width,
        height,
        speed,
        imageX,
        imageY,
        imageWidth,
        imageHeight,
        range,
        killable = false,
        entryRoll = null
    ) {
        this.rollInFramesLeft = 0;
        this.rollInTotalFrames = 0;
        this.rollInFromX = x;
        this.rollInTargetX = x;
        this.rollInAnchorY = y;
        this.lastFlameBlastStunId = -1;
        this.lastScorchBlastId = -1;

        if (entryRoll && entryRoll.rollFrames > 0) {
            this.rollInFromX =
                entryRoll.fromX != null ? entryRoll.fromX : x;
            this.rollInTargetX =
                entryRoll.targetX != null ? entryRoll.targetX : x;
            this.rollInAnchorY = y;
            this.x = this.rollInFromX;
            this.y = this.rollInAnchorY;
            this.rollInFramesLeft = entryRoll.rollFrames;
            this.rollInTotalFrames = entryRoll.rollFrames;
        } else {
            this.x = x;
            this.y = y;
        }
        this.width = width;
        this.height = height;
        this.baseSpeed = speed;
        this.speed = speed;
        this.killable = killable;
        this.alive = true;
        this.direction = DIRECTION_RIGHT;
        this.imageX = imageX;
        this.imageY = imageY;
        this.imageHeight = imageHeight;
        this.imageWidth = imageWidth;
        this.range = range;
        this.flameHaltFrames = 0;
        this.scorchRemaining = 0;
        this.toastPieRemaining = 0;
        this.randomTargetIndex = parseInt(
            Math.random() * randomTargetsForGhosts.length
        );
        this.target = randomTargetsForGhosts[this.randomTargetIndex];
        setInterval(() => {
            this.changeRandomDirection();
        }, 1000);
    }

    effectiveChaseRange() {
        const bonus =
            typeof getGhostIntelRangeBonus === "function"
                ? getGhostIntelRangeBonus()
                : 0;
        return Math.min(this.range + bonus, 16);
    }

    isInRange() {
        let xDistance = Math.abs(pacman.getMapX() - this.getMapX());
        let yDistance = Math.abs(pacman.getMapY() - this.getMapY());
        if (
            Math.sqrt(xDistance * xDistance + yDistance * yDistance) <=
            this.effectiveChaseRange()
        ) {
            return true;
        }
        return false;
    }

    changeRandomDirection() {
        let addition = 1;
        this.randomTargetIndex += addition;
        this.randomTargetIndex = this.randomTargetIndex % 4;
    }

    moveProcess() {
        if (!this.alive) {
            return;
        }
        if (this.toastPieRemaining > 0 || this.scorchRemaining > 0) {
            return;
        }
        if (this.rollInFramesLeft > 0) {
            this.rollInFramesLeft--;
            if (this.rollInFramesLeft === 0) {
                this.x = this.rollInTargetX;
                this.y = this.rollInAnchorY;
                this.direction =
                    this.rollInTargetX >= this.rollInFromX
                        ? DIRECTION_RIGHT
                        : DIRECTION_LEFT;
            } else {
                const u =
                    1 -
                    this.rollInFramesLeft /
                    Math.max(1, this.rollInTotalFrames);
                const ease = 1 - Math.pow(1 - u, 3);
                this.x =
                    this.rollInFromX +
                    (this.rollInTargetX - this.rollInFromX) * ease;
                this.y = this.rollInAnchorY;
            }
            return;
        }
        if (this.flameHaltFrames > 0) {
            this.flameHaltFrames--;
            return;
        }

        if (
            typeof getGhostAmbushChance === "function" &&
            Math.random() < getGhostAmbushChance()
        ) {
            this.target = pacman;
        } else if (this.isInRange()) {
            this.target = pacman;
        } else {
            this.target = randomTargetsForGhosts[this.randomTargetIndex];
        }
        const aligned =
            this.x % oneBlockSize === 0 && this.y % oneBlockSize === 0;
        if (aligned) {
            this.changeDirectionIfPossible();
        }
        this.moveForwards();
        if (this.checkCollisions()) {
            this.moveBackwards();
            const tryDirs = [
                DIRECTION_RIGHT,
                DIRECTION_LEFT,
                DIRECTION_UP,
                DIRECTION_BOTTOM,
            ];
            for (let i = 0; i < tryDirs.length; i++) {
                this.direction = tryDirs[i];
                this.moveForwards();
                if (!this.checkCollisions()) {
                    return;
                }
                this.moveBackwards();
            }
        }
    }

    moveBackwards() {
        switch (this.direction) {
            case 4:
                this.x -= this.speed;
                break;
            case 3:
                this.y += this.speed;
                break;
            case 2:
                this.x += this.speed;
                break;
            case 1:
                this.y -= this.speed;
                break;
        }
    }

    moveForwards() {
        const step = this.speed;
        switch (this.direction) {
            case DIRECTION_RIGHT: {          // 4
                const nextEdge = (Math.floor(this.x / oneBlockSize) + 1) * oneBlockSize;
                this.x = Math.min(this.x + step, nextEdge);
                if (nextEdge - this.x < 0.5) this.x = nextEdge;
                break;
            }
            case DIRECTION_UP: {             // 3
                const nextEdge = Math.ceil(this.y / oneBlockSize - 1) * oneBlockSize;
                this.y = Math.max(this.y - step, nextEdge);
                if (this.y - nextEdge < 0.5) this.y = nextEdge;
                break;
            }
            case DIRECTION_LEFT: {           // 2
                const nextEdge = Math.ceil(this.x / oneBlockSize - 1) * oneBlockSize;
                this.x = Math.max(this.x - step, nextEdge);
                if (this.x - nextEdge < 0.5) this.x = nextEdge;
                break;
            }
            case DIRECTION_BOTTOM: {         // 1
                const nextEdge = (Math.floor(this.y / oneBlockSize) + 1) * oneBlockSize;
                this.y = Math.min(this.y + step, nextEdge);
                if (nextEdge - this.y < 0.5) this.y = nextEdge;
                break;
            }
        }
    }

    pickFallbackDirection() {
        const saved = this.direction;
        const tryOrder = [
            DIRECTION_RIGHT,
            DIRECTION_LEFT,
            DIRECTION_UP,
            DIRECTION_BOTTOM,
        ];
        for (let i = 0; i < tryOrder.length; i++) {
            const d = tryOrder[i];
            this.direction = d;
            this.moveForwards();
            const hit = this.checkCollisions();
            this.moveBackwards();
            this.direction = saved;
            if (!hit) {
                return d;
            }
        }
        return DIRECTION_RIGHT;
    }

    checkCollisions() {
        const tx = parseInt(this.x / oneBlockSize);
        const ty = parseInt(this.y / oneBlockSize);
        const tx2 = parseInt((this.x * 0.9999 + oneBlockSize) / oneBlockSize);
        const ty2 = parseInt((this.y * 0.9999 + oneBlockSize) / oneBlockSize);
        if (
            ty < 0 ||
            ty >= map.length ||
            tx < 0 ||
            tx >= map[0].length ||
            ty2 < 0 ||
            ty2 >= map.length ||
            tx2 < 0 ||
            tx2 >= map[0].length
        ) {
            return true;
        }
        let isCollided = false;
        if (
            map[ty][tx] == 1 ||
            map[ty2][tx] == 1 ||
            map[ty][tx2] == 1 ||
            map[ty2][tx2] == 1
        ) {
            isCollided = true;
        }
        return isCollided;
    }

    changeDirectionIfPossible() {
        const destX = parseInt(this.target.x / oneBlockSize);
        const destY = parseInt(this.target.y / oneBlockSize);
        const next = this.calculateNewDirection(map, destX, destY);
        if (typeof next === "number" && !Number.isNaN(next)) {
            this.direction = next;
        }
    }

    calculateNewDirection(map, destX, destY) {
        if (
            typeof destX !== "number" ||
            typeof destY !== "number" ||
            Number.isNaN(destX) ||
            Number.isNaN(destY)
        ) {
            return this.pickFallbackDirection();
        }
        let mp = [];
        for (let i = 0; i < map.length; i++) {
            mp[i] = map[i].slice();
        }

        let queue = [
            {
                x: this.getMapX(),
                y: this.getMapY(),
                moves: [],
            },
        ];
        while (queue.length > 0) {
            let poped = queue.shift();
            if (poped.x == destX && poped.y == destY) {
                if (poped.moves.length > 0) {
                    return poped.moves[0];
                }
                return this.pickFallbackDirection();
            } else {
                mp[poped.y][poped.x] = 1;
                let neighborList = this.addNeighbors(poped, mp);
                for (let i = 0; i < neighborList.length; i++) {
                    queue.push(neighborList[i]);
                }
            }
        }

        const fb = this.pickFallbackDirection();
        return typeof fb === "number" && !Number.isNaN(fb) ? fb : DIRECTION_RIGHT;
    }

    addNeighbors(poped, mp) {
        const queue = [];
        const numRows = mp.length;
        const numCols = mp[0].length;

        if (poped.x - 1 >= 0 && mp[poped.y][poped.x - 1] != 1) {
            const tempMoves = poped.moves.slice();
            tempMoves.push(DIRECTION_LEFT);
            queue.push({ x: poped.x - 1, y: poped.y, moves: tempMoves });
        }
        if (poped.x + 1 < numCols && mp[poped.y][poped.x + 1] != 1) {
            const tempMoves = poped.moves.slice();
            tempMoves.push(DIRECTION_RIGHT);
            queue.push({ x: poped.x + 1, y: poped.y, moves: tempMoves });
        }
        if (poped.y - 1 >= 0 && mp[poped.y - 1][poped.x] != 1) {
            const tempMoves = poped.moves.slice();
            tempMoves.push(DIRECTION_UP);
            queue.push({ x: poped.x, y: poped.y - 1, moves: tempMoves });
        }
        if (poped.y + 1 < numRows && mp[poped.y + 1][poped.x] != 1) {
            const tempMoves = poped.moves.slice();
            tempMoves.push(DIRECTION_BOTTOM);
            queue.push({ x: poped.x, y: poped.y + 1, moves: tempMoves });
        }
        return queue;
    }

    getMapX() {
        let mapX = parseInt(this.x / oneBlockSize);
        return mapX;
    }

    getMapY() {
        let mapY = parseInt(this.y / oneBlockSize);
        return mapY;
    }

    getMapXRightSide() {
        let mapX = parseInt((this.x * 0.99 + oneBlockSize) / oneBlockSize);
        return mapX;
    }

    getMapYRightSide() {
        let mapY = parseInt((this.y * 0.99 + oneBlockSize) / oneBlockSize);
        return mapY;
    }

    changeAnimation() {
        this.currentFrame =
            this.currentFrame == this.frameCount ? 1 : this.currentFrame + 1;
    }

    drawToastPie() {
        const x = this.x;
        const y = this.y;
        const w = this.width;
        const h = this.height;
        const crimp = 4;
        canvasContext.fillStyle = "#8b5a2b";
        canvasContext.beginPath();
        canvasContext.moveTo(x + crimp, y + h * 0.35);
        canvasContext.lineTo(x + w * 0.15, y + h * 0.12);
        canvasContext.lineTo(x + w * 0.85, y + h * 0.12);
        canvasContext.lineTo(x + w - crimp, y + h * 0.35);
        canvasContext.lineTo(x + w - 2, y + h - 4);
        canvasContext.lineTo(x + 2, y + h - 4);
        canvasContext.closePath();
        canvasContext.fill();
        canvasContext.strokeStyle = "#4a3018";
        canvasContext.lineWidth = 2;
        canvasContext.stroke();
        canvasContext.fillStyle = "#d4a574";
        canvasContext.fillRect(x + 4, y + h * 0.38, w - 8, h * 0.35);
        canvasContext.fillStyle = "rgba(255,255,255,0.35)";
        canvasContext.fillRect(x + 6, y + h * 0.42, w - 12, 3);
    }

    draw() {
        if (!this.alive) {
            return;
        }
        if (this.toastPieRemaining > 0) {
            this.drawToastPie();
            return;
        }

        canvasContext.save();
        if (this.scorchRemaining > 0) {
            const flick = 0.65 + 0.35 * Math.sin(performance.now() * 0.02);
            canvasContext.filter = `sepia(0.9) saturate(2) hue-rotate(-15deg)`;
            canvasContext.globalAlpha = flick;
        } else if (this.flameHaltFrames > 0) {
            canvasContext.globalAlpha = 0.38;
            canvasContext.filter =
                "brightness(1.15) saturate(0.35) hue-rotate(185deg)";
        }
        canvasContext.drawImage(
            ghostFrames,
            this.imageX,
            this.imageY,
            this.imageWidth,
            this.imageHeight,
            this.x,
            this.y,
            this.width,
            this.height
        );
        if (this.flameHaltFrames > 0 && this.scorchRemaining <= 0) {
            canvasContext.globalAlpha = 0.22;
            canvasContext.filter = "none";
            canvasContext.drawImage(
                ghostFrames,
                this.imageX,
                this.imageY,
                this.imageWidth,
                this.imageHeight,
                this.x + 3,
                this.y,
                this.width,
                this.height
            );
        }
        canvasContext.restore();

        if (this.scorchRemaining > 0) {
            canvasContext.fillStyle = `rgba(255, 80, 0, ${0.25 + 0.2 * Math.sin(performance.now() * 0.025)})`;
            canvasContext.fillRect(this.x, this.y, this.width, this.height);
        }
        if (this.flameHaltFrames > 0 && this.scorchRemaining <= 0) {
            canvasContext.strokeStyle = "rgba(180, 220, 255, 0.55)";
            canvasContext.lineWidth = 1.5;
            canvasContext.strokeRect(
                this.x - 1,
                this.y - 1,
                this.width + 2,
                this.height + 2
            );
        }
    }
}

function getGhostIntelRangeBonus() {
    return Math.min(10, Math.floor(score / 14));
}

function getGhostAmbushChance() {
    return Math.min(0.34, score / 420);
}

function getGhostSpeedScale() {
    return Math.max(1.15, 1 + Math.min(0.55, score / 200));
}

let updateGhosts = () => {
    const scale = getGhostSpeedScale();
    for (let i = 0; i < ghosts.length; i++) {
        if (ghosts[i].alive) {
            ghosts[i].speed = ghosts[i].baseSpeed * scale;
            ghosts[i].moveProcess();
        }
    }
};

function ghostIsOnFlameCell(ghost, cells) {
    const gx = ghost.getMapX();
    const gy = ghost.getMapY();
    for (let c = 0; c < cells.length; c++) {
        if (cells[c].x === gx && cells[c].y === gy) {
            return true;
        }
    }
    return false;
}

function processGhostFlameAndToast() {
    const flameOn = pacman.hasActiveFlame();
    const cells = flameOn ? pacman.getFlameHitCells() : [];

    for (let i = 0; i < ghosts.length; i++) {
        const g = ghosts[i];
        if (!g.alive) {
            continue;
        }
        if (g.rollInFramesLeft > 0) {
            continue;
        }

        if (g.toastPieRemaining > 0) {
            g.toastPieRemaining--;
            if (g.toastPieRemaining <= 0) {
                g.alive = false;
                score += 40;
            }
            continue;
        }

        const hit = flameOn && ghostIsOnFlameCell(g, cells);

        if (g.scorchRemaining > 0) {
            g.scorchRemaining -= hit ? 3 : 1;
            if (g.scorchRemaining <= 0) {
                g.scorchRemaining = 0;
                g.toastPieRemaining = 54;
                if (typeof SFX == "undefined") SFX.play("sfx-toast");
                if (typeof startToastDisco === "function") {
                    startToastDisco(64);
                }
            }
        } else if (hit && g.killable) {
            const bid = pacman.flameBlastId;
            if (g.scorchRemaining <= 0 && bid !== g.lastScorchBlastId) {
                g.scorchRemaining = 28;
                g.flameHaltFrames = Math.max(g.flameHaltFrames, 14);
                g.lastScorchBlastId = bid;
            }
        }

        if (hit && !g.killable) {
            const bid = pacman.flameBlastId;
            if (bid !== g.lastFlameBlastStunId) {
                g.flameHaltFrames = 16;
                g.lastFlameBlastStunId = bid;
            }
        }
    }
}
