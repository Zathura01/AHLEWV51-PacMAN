class Pacman {
  constructor(x, y, width, height, speed) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.baseSpeed = speed;
    this.speed = speed;
    this.direction = DIRECTION_RIGHT;
    this.nextDirection = this.direction;
    this.currentFrame = 1;
    this.frameCount = 7;

    this.energy = 100;
    this.energyMax = 100;
    this.sprintHeld = false;
    this.sprintMultiplier = 1.65;

    this.flameFramesRemaining = 0;
    this.flameCooldown = 0;
    this.flameCost = 40;
    this.flameDuration = 20;

    this.solarPanelFramesRemaining = 0;
    this.invulnerableFrames = 0;
    this.flameBlastId = 0;


    this.livesMax = 3;
    this.lives = 3;

    setInterval(() => {
      this.changeAnimation();
    }, 100);
  }

  isSolarFrozen() {
    return this.solarPanelFramesRemaining > 0;
  }

  isInvulnerable() {
    return this.invulnerableFrames > 0;
  }

  hasActiveFlame() {
    return this.flameFramesRemaining > 0;
  }

  tryStartFlame() {
    if (
      this.isSolarFrozen() ||
      this.flameCooldown > 0 ||
      this.flameFramesRemaining > 0 ||
      this.energy < this.flameCost
    ) {
      return false;
    }
    this.energy -= this.flameCost;
    this.flameBlastId++;
    this.flameFramesRemaining = this.flameDuration;
    this.flameCooldown = 32;
    return true;
  }

  tickState() {
    if (this.flameCooldown > 0) {
      this.flameCooldown--;
    }
    if (this.flameFramesRemaining > 0) {
      this.flameFramesRemaining--;
    }
    if (this.solarPanelFramesRemaining > 0) {
      this.solarPanelFramesRemaining--;
      this.energy = Math.min(
        this.energyMax,
        this.energy + 0.35
      );
      if (this.solarPanelFramesRemaining === 0) {
        this.x = oneBlockSize;
        this.y = oneBlockSize;
        this.direction = DIRECTION_RIGHT;
        this.nextDirection = DIRECTION_RIGHT;
        this.invulnerableFrames = 72;
      }
      return;
    }
    if (this.invulnerableFrames > 0) {
      this.invulnerableFrames--;
    }
  }

  beginSolarPanel() {
    if (this.isInvulnerable() || this.isSolarFrozen()) {
      return;
    }
    this.solarPanelFramesRemaining = 90;
    this.flameFramesRemaining = 0;
  }

  moveProcess() {
    if (this.isSolarFrozen()) {
      return;
    }
    const prevX = this.x;
    const prevY = this.y;

    this.changeDirectionIfPossible();
    this.moveForwards();
    if (this.checkCollision()) {
      this.moveBackwards();
      this.applyEnergyForStep(prevX, prevY);
      return;
    }
    this.applyEnergyForStep(prevX, prevY);
  }

  applyEnergyForStep(prevX, prevY) {
    if (this.isSolarFrozen()) {
      return;
    }
    const moved = this.x !== prevX || this.y !== prevY;

    let drainSprint = false;
    if (
      moved &&
      this.sprintHeld &&
      this.energy > 0
    ) {
      this.speed = this.baseSpeed * this.sprintMultiplier;
      this.energy -= 0.78;
      drainSprint = true;
    } else {
      this.speed = this.baseSpeed;
    }

    if (moved && !drainSprint) {
      this.energy -= 0.16;
    } else if (!moved) {
      this.energy += 0.045;
    }

    if (this.hasActiveFlame()) {
      this.energy -= 0.09;
    }

    if (this.energy <= 0) {
      this.energy = 0;
      this.speed = this.baseSpeed;
    }
    this.energy = Math.min(this.energyMax, this.energy);
  }

  eat() {
    if (this.isSolarFrozen()) {
      return;
    }
    for (let i = 0; i < map.length; i++) {
      for (let j = 0; j < map[0].length; j++) {
        if (
          map[i][j] == 2 &&
          this.getMapX() == j &&
          this.getMapY() == i
        ) {
          map[i][j] = 3;
          score++;
          this.energy = Math.min(this.energyMax, this.energy + 3);
        }
      }
    }
  }

  getFlameHitCells() {
    const cells = [];
    if (!this.hasActiveFlame()) {
      return cells;
    }
    let tx = this.getMapX();
    let ty = this.getMapY();
    for (let step = 1; step <= 3; step++) {
      if (this.direction === DIRECTION_RIGHT) {
        tx = this.getMapX() + step;
        ty = this.getMapY();
      } else if (this.direction === DIRECTION_LEFT) {
        tx = this.getMapX() - step;
        ty = this.getMapY();
      } else if (this.direction === DIRECTION_UP) {
        tx = this.getMapX();
        ty = this.getMapY() - step;
      } else if (this.direction === DIRECTION_BOTTOM) {
        tx = this.getMapX();
        ty = this.getMapY() + step;
      }
      if (
        ty < 0 ||
        ty >= map.length ||
        tx < 0 ||
        tx >= map[0].length ||
        map[ty][tx] === 1
      ) {
        break;
      }
      cells.push({ x: tx, y: ty });
    }
    return cells;
  }

  moveBackwards() {
    switch (this.direction) {
      case DIRECTION_RIGHT:
        this.x -= this.speed;
        break;
      case DIRECTION_UP:
        this.y += this.speed;
        break;
      case DIRECTION_LEFT:
        this.x += this.speed;
        break;
      case DIRECTION_BOTTOM:
        this.y -= this.speed;
        break;
    }
  }

  moveForwards() {
    switch (this.direction) {
      case DIRECTION_RIGHT:
        this.x += this.speed;
        break;
      case DIRECTION_UP:
        this.y -= this.speed;
        break;
      case DIRECTION_LEFT:
        this.x -= this.speed;
        break;
      case DIRECTION_BOTTOM:
        this.y += this.speed;
        break;
    }
  }

  checkCollision() {
    if (
      map[this.getMapY()][this.getMapX()] == 1 ||
      map[this.getMapYRightSide()][this.getMapX()] == 1 ||
      map[this.getMapY()][this.getMapXRightSide()] == 1 ||
      map[this.getMapYRightSide()][this.getMapXRightSide()] == 1
    ) {
      return true;
    }
    return false;
  }

  checkGhostCollision() {
    if (this.isSolarFrozen() || this.isInvulnerable()) {
      return false;
    }
    for (let i = 0; i < ghosts.length; i++) {
      let ghost = ghosts[i];
      if (
        !ghost.alive ||
        ghost.toastPieRemaining > 0 ||
        ghost.rollInFramesLeft > 0
      ) {
        continue;
      }
      if (
        ghost.getMapX() === this.getMapX() &&
        ghost.getMapY() === this.getMapY()
      ) {
        return true;
      }
    }
    return false;
  }

  changeDirectionIfPossible() {
    if (this.direction == this.nextDirection) {
      return;
    }

    let tempDirection = this.direction;
    this.direction = this.nextDirection;
    this.moveForwards();
    if (this.checkCollision()) {
      this.moveBackwards();
      this.direction = tempDirection;
    } else {
      this.moveBackwards();
    }
  }

  changeAnimation() {
    this.currentFrame =
      this.currentFrame == this.frameCount ? 1 : this.currentFrame + 1;
  }

  drawSolarPanel() {
    const pad = 2;
    canvasContext.fillStyle = "#1a2744";
    canvasContext.fillRect(
      this.x + pad,
      this.y + pad,
      this.width - pad * 2,
      this.height - pad * 2
    );
    canvasContext.strokeStyle = "#4a6fa5";
    canvasContext.lineWidth = 1;
    for (let g = 0; g < 4; g++) {
      canvasContext.beginPath();
      canvasContext.moveTo(this.x + 4 + g * 4, this.y + 4);
      canvasContext.lineTo(this.x + 4 + g * 4, this.y + this.height - 4);
      canvasContext.stroke();
    }
    for (let g = 0; g < 4; g++) {
      canvasContext.beginPath();
      canvasContext.moveTo(this.x + 4, this.y + 4 + g * 4);
      canvasContext.lineTo(this.x + this.width - 4, this.y + 4 + g * 4);
      canvasContext.stroke();
    }
    canvasContext.fillStyle = "#f4c430";
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        canvasContext.fillRect(
          this.x + 6 + c * 7,
          this.y + 6 + r * 7,
          5,
          4
        );
      }
    }
  }

  drawFlameOverlay() {
    const cells = this.getFlameHitCells();
    if (cells.length === 0) {
      return;
    }
    for (let i = 0; i < cells.length; i++) {
      const cx = cells[i].x * oneBlockSize;
      const cy = cells[i].y * oneBlockSize;
      const grd = canvasContext.createRadialGradient(
        cx + oneBlockSize / 2,
        cy + oneBlockSize / 2,
        2,
        cx + oneBlockSize / 2,
        cy + oneBlockSize / 2,
        oneBlockSize * 0.65
      );
      grd.addColorStop(0, "rgba(255,255,200,0.95)");
      grd.addColorStop(0.4, "rgba(255,140,40,0.75)");
      grd.addColorStop(1, "rgba(255,60,0,0.15)");
      canvasContext.fillStyle = grd;
      canvasContext.fillRect(cx, cy, oneBlockSize, oneBlockSize);
    }
  }

  draw() {
    if (this.isSolarFrozen()) {
      this.drawSolarPanel();
      return;
    }

    canvasContext.save();
    canvasContext.translate(
      this.x + oneBlockSize / 2,
      this.y + oneBlockSize / 2
    );
    canvasContext.rotate((this.direction * 90 * Math.PI) / 180);

    canvasContext.translate(
      -this.x - oneBlockSize / 2,
      -this.y - oneBlockSize / 2
    );

    if(this.isInvulnerable() && Math.floor(this.invulnerableFrames / 6) % 2 === 0) {
      canvasContext.globalAlpha = 0.5;
    } 

    canvasContext.drawImage(
      pacmanFrames,
      (this.currentFrame - 1) * oneBlockSize,
      0,
      oneBlockSize,
      oneBlockSize,
      this.x,
      this.y,
      this.width,
      this.height
    );

    canvasContext.restore();

    if (this.hasActiveFlame()) {
      this.drawFlameOverlay();
    }
  }

  getMapX() {
    return parseInt(this.x / oneBlockSize);
  }

  getMapY() {
    return parseInt(this.y / oneBlockSize);
  }

  getMapXRightSide() {
    return parseInt((this.x * 0.9999 + oneBlockSize) / oneBlockSize);
  }

  getMapYRightSide() {
    return parseInt((this.y * 0.9999 + oneBlockSize) / oneBlockSize);
  }
}
