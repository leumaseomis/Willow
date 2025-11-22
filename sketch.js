// Arcos originais
let arcos = [
  { id: 1, x: 187, y: 518, w: 250, h: 250 },
  { id: 2, x: 270, y: 518, w: 117, h: 363 },
  { id: 3, x: 401, y: 518, w: 117, h: 594 },
  { id: 4, x: 483, y: 518, w: 250, h: 441 }
];

let globalTime = 0;
let autoGrowTime = 0;
let softBodies = [];
const SEGMENTS = 40;

let painel, sldEsp, sldGlobalSpeed;
let sldGrowth, chkAutoGrow, selGrowMode, selGrowEase, sldGrowStutter;
let chkPhysics, sldPhysicsIntensity, sldGravity, sldWindForce, sldTurbulence, sldStiffness, sldDamping;
let chkShowPoints, chkShowStiffness;

function setup() {
  createCanvas(windowWidth, windowHeight);
  strokeCap(SQUARE);
  noFill();
  criarInterfaceCompleta();
  inicializarSoftBodies();
}

function inicializarSoftBodies() {
  softBodies = [];
  let esp = sldEsp.value();
  let basesOriginais = arcos.map(a =>
    (a.id <= 2) ? a.x + a.w / 2 : a.x - a.w / 2
  );

  let primeiraBase = basesOriginais[0];
  let distReal = esp * 1.5;

  for (let i = 0; i < arcos.length; i++) {
    let baseX = primeiraBase + i * distReal;
    let baseY = arcos[i].y;
    let softBody = new SoftBody(arcos[i], i, baseX, baseY);
    softBodies.push(softBody);
  }
}

function draw() {
  background(20);

  let esp = sldEsp.value();
  let speed = sldGlobalSpeed.value();
  globalTime += speed;

  let loopDuration = 1.2;
  if (chkAutoGrow.checked()) {
    autoGrowTime += 0.005;
    if (autoGrowTime > loopDuration) autoGrowTime = -0.2;
  } else {
    autoGrowTime = sldGrowth.value() / 100;
  }

  let basesOriginais = arcos.map(a =>
    (a.id <= 2) ? a.x + a.w / 2 : a.x - a.w / 2
  );
  let primeiraBase = basesOriginais[0];
  let distReal = esp * 1.5;
  let novasBases = [];

  for (let i = 0; i < arcos.length; i++)
    novasBases[i] = primeiraBase + i * distReal;

  let isPhysics = chkPhysics.checked();
  let physicsIntensity = sldPhysicsIntensity.value() / 100;
  let gravity = sldGravity.value();
  let windForce = sldWindForce.value();
  let turbulence = sldTurbulence.value();
  let stiffness = sldStiffness.value();
  let damping = sldDamping.value();

  strokeWeight(esp);

  for (let i = 0; i < softBodies.length; i++) {
    let sb = softBodies[i];
    let baseX = novasBases[i];
    let baseY = arcos[i].y;

    sb.updateBase(baseX, baseY);

    if (isPhysics && physicsIntensity > 0) {
      sb.applyForces(globalTime, gravity, windForce, turbulence, physicsIntensity);
      sb.update(stiffness, damping, physicsIntensity);
    } else {
      sb.resetToOriginal();
    }

    let growInput = constrain(autoGrowTime, 0, 1);
    let growData = calculateGrowth(growInput, i);

    stroke(100, 200, 180);
    sb.display(growData, chkShowPoints.checked(), chkShowStiffness.checked());
  }
}

class SoftBody {
  constructor(arcoData, index, initialBaseX, initialBaseY) {
    this.arcoData = arcoData;
    this.index = index;
    this.isLeft = arcoData.id <= 2;
    this.drawCx = this.isLeft ? -arcoData.w / 2 : arcoData.w / 2;
    this.drawCy = 0;
    this.points = [];
    this.originalOffsets = [];
    this.restDistances = [];
    this.baseX = initialBaseX;
    this.baseY = initialBaseY;
    this.createPoints();
  }

  createPoints() {
    for (let i = 0; i <= SEGMENTS; i++) {
      let t = i / SEGMENTS;
      let angle;

      if (this.isLeft) {
        angle = TWO_PI - (PI * t);
      } else {
        angle = PI + (PI * t);
      }

      let offsetX = this.drawCx + cos(angle) * (this.arcoData.w / 2);
      let offsetY = this.drawCy + sin(angle) * (this.arcoData.h / 2);
      this.originalOffsets.push({ x: offsetX, y: offsetY });

      // Mobilidade é linear (0 na base, 1 no topo)
      let isFixed = (i === 0);
      let mobilityFactor = t;

      let point = new Point(
        this.baseX + offsetX,
        this.baseY + offsetY,
        isFixed,
        mobilityFactor
      );
      this.points.push(point);
    }

    for (let i = 0; i < this.points.length - 1; i++) {
      let p1 = this.originalOffsets[i];
      let p2 = this.originalOffsets[i + 1];
      let d = dist(p1.x, p1.y, p2.x, p2.y);
      this.restDistances.push(d);
    }
  }

  updateBase(newBaseX, newBaseY) {
    this.baseX = newBaseX;
    this.baseY = newBaseY;
    // Atualiza imediatamente o ponto zero para não haver lag
    this.points[0].x = newBaseX + this.originalOffsets[0].x;
    this.points[0].y = newBaseY + this.originalOffsets[0].y;
    this.points[0].px = this.points[0].x;
    this.points[0].py = this.points[0].y;
  }

  resetToOriginal() {
    for (let i = 1; i < this.points.length; i++) {
      this.points[i].x = this.baseX + this.originalOffsets[i].x;
      this.points[i].y = this.baseY + this.originalOffsets[i].y;
      this.points[i].px = this.points[i].x;
      this.points[i].py = this.points[i].y;
      this.points[i].ax = 0;
      this.points[i].ay = 0;
    }
  }

  applyForces(time, gravity, windForce, turbulence, intensity) {
    // Loop começa em 1, mas vamos ignorar os primeiros pontos dentro do loop também
    // para poupar processamento e evitar conflitos com o Hard Lock.
    for (let i = 1; i < this.points.length; i++) {
      let p = this.points[i];
      let m = p.mobilityFactor;

      // Otimização: Se a mobilidade for muito baixa (base), nem calcula força
      if (m < 0.1) continue;

      let effectiveMobility = m * m * intensity;

      p.ay += gravity * 0.001 * effectiveMobility;

      let windPhase = time * 1.0 + this.index * 0.5 + i * 0.08;
      p.ax += sin(windPhase) * windForce * 0.01 * effectiveMobility;
      p.ay += cos(windPhase * 0.6) * windForce * 0.005 * effectiveMobility;

      let noiseScale = 0.2;
      let tx = time * noiseScale + i * 0.05 + this.index * 10;
      let ty = time * noiseScale + i * 0.05 + this.index * 10 + 1000;

      p.ax += map(noise(tx), 0, 1, -1, 1) * turbulence * 0.01 * effectiveMobility;
      p.ay += map(noise(ty), 0, 1, -1, 1) * turbulence * 0.01 * effectiveMobility;
    }
  }

  update(stiffness, damping, intensity) {
    // 1. VERLET
    for (let i = 1; i < this.points.length; i++) {
      if (damping < 0) {
        let originalX = this.baseX + this.originalOffsets[i].x;
        let originalY = this.baseY + this.originalOffsets[i].y;
        let returnStrength = abs(damping);

        this.points[i].px = this.points[i].x;
        this.points[i].py = this.points[i].y;
        this.points[i].x = lerp(this.points[i].x, originalX, returnStrength * 0.3);
        this.points[i].y = lerp(this.points[i].y, originalY, returnStrength * 0.3);
        this.points[i].x += this.points[i].ax * (1 - returnStrength);
        this.points[i].y += this.points[i].ay * (1 - returnStrength);
        this.points[i].ax = 0;
        this.points[i].ay = 0;
      } else {
        this.points[i].update(damping);
      }
    }

    // 2. PULL TO ORIGINAL
    let originalPull = lerp(0.25, 0.0, intensity);
    for (let i = 1; i < this.points.length; i++) {
      let originalX = this.baseX + this.originalOffsets[i].x;
      let originalY = this.baseY + this.originalOffsets[i].y;
      this.points[i].x = lerp(this.points[i].x, originalX, originalPull);
      this.points[i].y = lerp(this.points[i].y, originalY, originalPull);
    }

    // 3. DISTANCE CONSTRAINTS
    let lengthFactor = this.arcoData.h / 600;
    let iterations = floor(25 / lengthFactor);
    iterations = constrain(iterations, 20, 50);

    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < this.points.length - 1; i++) {
        let p1 = this.points[i];
        let p2 = this.points[i + 1];
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        let currentDist = sqrt(dx * dx + dy * dy);
        if (currentDist < 0.0001) continue;
        let restDist = this.restDistances[i];
        let segmentProgress = i / (this.points.length - 1);
        let progressCurve = segmentProgress * segmentProgress;
        let localStiffness = lerp(1.0, stiffness, progressCurve);
        let error = (currentDist - restDist) / currentDist;
        let correctionX = dx * error * 0.5 * localStiffness;
        let correctionY = dy * error * 0.5 * localStiffness;

        // Não aplicamos correção se o ponto estiver na zona "bloqueada" (Ver passo 5)
        // Isso evita que a fisica "lute" com o nosso Hard Lock
        let stemThreshold = 6;

        if (!p1.fixed && i >= stemThreshold) {
          p1.x += correctionX;
          p1.y += correctionY;
        }
        if (!p2.fixed && (i+1) >= stemThreshold) {
          p2.x -= correctionX;
          p2.y -= correctionY;
        }
      }
    }

    // 4. SUAVIZAÇÃO (LAPLACIAN)
    for (let pass = 0; pass < 10; pass++) {
      for (let i = 1; i < this.points.length - 1; i++) {
        if (this.points[i].fixed) continue;
        let p0 = this.points[i - 1];
        let p1 = this.points[i];
        let p2 = this.points[i + 1];
        let avgX = (p0.x + p2.x) * 0.5;
        let avgY = (p0.y + p2.y) * 0.5;
        p1.x = lerp(p1.x, avgX, 0.2);
        p1.y = lerp(p1.y, avgY, 0.2);
      }
    }

    // ============================================================
    // 5. HARD STEM LOCK (SOLUÇÃO DEFINITIVA)
    // Sobrepomos brutalmente a posição dos primeiros N pontos.
    // Isto garante que não há rotação, nem ziguezague, nem cotovelos.
    // ============================================================

    let hardLockCount = 4;  // Primeiros 4 pontos são estátuas (Base Rígida)
    let transitionCount = 8; // Até ao ponto 8 fazemos mistura suave

    for (let i = 0; i < transitionCount; i++) {
        if (i >= this.points.length) break;

        let rigidX = this.baseX + this.originalOffsets[i].x;
        let rigidY = this.baseY + this.originalOffsets[i].y;

        let physX = this.points[i].x;
        let physY = this.points[i].y;

        // Se i < hardLockCount, blend é 0 (fica 100% rigidX)
        // Se i varia de hardLockCount a transitionCount, blend vai de 0 a 1
        let blend = 0;
        if (i >= hardLockCount) {
           let t = map(i, hardLockCount, transitionCount, 0, 1);
           blend = t * t; // Curva suave
        }

        this.points[i].x = lerp(rigidX, physX, blend);
        this.points[i].y = lerp(rigidY, physY, blend);

        // Resetar velocidade para não acumular energia explosiva
        if (blend < 0.5) {
            this.points[i].px = this.points[i].x;
            this.points[i].py = this.points[i].y;
        }
    }
  }

  display(growData, showPoints, showStiffness) {
    let startIdx = floor(growData.start * this.points.length);
    let endIdx = floor(growData.end * this.points.length);

    if (endIdx >= this.points.length) endIdx = this.points.length - 1;
    if (endIdx <= startIdx) return;

    if (showStiffness) {
      for (let i = startIdx; i < endIdx && i < this.points.length - 1; i++) {
        let p1 = this.points[i];
        let p2 = this.points[i + 1];
        let segmentProgress = i / (this.points.length - 1);
        let hue = map(segmentProgress, 0, 1, 0, 120);
        stroke(hue, 255, 255);
        colorMode(HSB);
        line(p1.x, p1.y, p2.x, p2.y);
        colorMode(RGB);
      }
      stroke(100, 200, 180);
    } else {
      noFill();
      beginShape();

      // FIX VISUAL:
      // Como os pontos 0 a hardLockCount estão agora matematicamente bloqueados na vertical (ou na curva original),
      // basta duplicar o primeiro ponto visível para o curveVertex apanhar a tangente correcta.
      // Não precisamos de pontos fantasmas extra porque a "coluna" de pontos fixos já define a direção.

      if (this.points[startIdx]) {
        curveVertex(this.points[startIdx].x, this.points[startIdx].y);
      }

      for (let i = startIdx; i <= endIdx && i < this.points.length; i++) {
        curveVertex(this.points[i].x, this.points[i].y);
      }

      if (this.points[endIdx]) {
        curveVertex(this.points[endIdx].x, this.points[endIdx].y);
      }

      endShape();
    }

    if (showPoints) {
      for (let i = startIdx; i <= endIdx && i < this.points.length; i++) {
        let p = this.points[i];
        let pointColor = (i < 4) ? color(255, 0, 0) : color(255, 200, 0, 150); // Mostra a vermelho os pontos fixos
        fill(pointColor);
        noStroke();
        circle(p.x, p.y, (i < 4) ? 6 : 5);
        stroke(100, 200, 180);
      }
    }
  }
}

class Point {
  constructor(x, y, fixed = false, mobilityFactor = 1.0) {
    this.x = x;
    this.y = y;
    this.px = x;
    this.py = y;
    this.ax = 0;
    this.ay = 0;
    this.fixed = fixed;
    this.mobilityFactor = mobilityFactor;
  }

  update(damping) {
    if (this.fixed) return;

    let vx = (this.x - this.px) * damping;
    let vy = (this.y - this.py) * damping;
    this.px = this.x;
    this.py = this.y;
    this.x += vx + this.ax;
    this.y += vy + this.ay;
    this.ax = 0;
    this.ay = 0;
  }
}

function calculateGrowth(rawInput, i) {
  let growMode = selGrowMode.value();
  let growEase = selGrowEase.value();
  let growStutter = sldGrowStutter.value();
  let myTime = rawInput;

  if (growMode === 'Sequential') {
    let start = i * 0.25;
    let end = start + 0.25;
    myTime = map(rawInput, start, end, 0, 1, true);
  } else if (growMode === 'Cascade') {
    let start = i * 0.15;
    let end = start + 0.5;
    myTime = map(rawInput, start, end, 0, 1, true);
  }

  let segStart = 0,
    segEnd = 1;

  if (myTime < 0.5) {
    let t = map(myTime, 0, 0.5, 0, 1);
    segStart = applyEasing(t, growEase);
    segEnd = 1;
  } else {
    let t = map(myTime, 0.5, 1.0, 0, 1);
    segStart = 0;
    segEnd = applyEasing(t, growEase);
  }

  if (growStutter > 0) {
    let s = map(growStutter, 1, 100, 50, 2);
    segStart = floor(segStart * s) / s;
    segEnd = floor(segEnd * s) / s;
  }

  return { start: segStart, end: segEnd };
}

function applyEasing(t, type) {
  t = constrain(t, 0, 1);
  switch (type) {
    case 'Linear':
      return t;
    case 'SmoothStep':
      return t * t * (3 - 2 * t);
    case 'Ease Out':
      return 1 - pow(1 - t, 3);
    case 'Elastic':
      if (t === 0 || t === 1) return t;
      let p = 0.3;
      return (
        pow(2, -10 * t) * sin((t - p / 4) * (2 * PI) / p) + 1
      );
    default:
      return t;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (painel) painel.position(windowWidth - 270, 20);
  inicializarSoftBodies();
}

function criarInterfaceCompleta() {
  painel = createDiv();
  painel.position(windowWidth - 270, 20);
  estilizarPainel(painel);

  criarHeader(painel, "GLOBAL");
  sldEsp = criarSlider(painel, "Espessura", 1, 60, 8, 1);
  sldGlobalSpeed = criarSlider(painel, "Velocidade", 0, 0.5, 0.1, 0.001);
  criarSeparador(painel);

  let btnGrow = criarBotaoToggle(painel, "GROWTH");
  let divG = criarContainerOculto(painel);

  let divG1 = createDiv();
  divG1.parent(divG);
  divG1.style("display", "flex");
  divG1.style("gap", "10px");
  divG1.style("margin-bottom", "5px");

  chkAutoGrow = createCheckbox("Active", false);
  chkAutoGrow.parent(divG1);
  chkAutoGrow.style("color", "#00ffcc");
  chkAutoGrow.changed(() => {
    if (chkAutoGrow.checked()) autoGrowTime = 0;
  });

  let divG2 = createDiv();
  divG2.parent(divG);
  divG2.style("display", "flex");
  divG2.style("gap", "10px");
  divG2.style("margin-bottom", "10px");

  selGrowMode = createSelect();
  selGrowMode.parent(divG2);
  selGrowMode.option("Simultaneous");
  selGrowMode.option("Cascade");
  selGrowMode.option("Sequential");
  selGrowMode.style("flex-grow", "1");
  estilizarSelect(selGrowMode);

  selGrowEase = createSelect();
  selGrowEase.parent(divG2);
  selGrowEase.option("SmoothStep");
  selGrowEase.option("Linear");
  selGrowEase.option("Ease Out");
  selGrowEase.option("Elastic");
  selGrowEase.style("flex-grow", "1");
  estilizarSelect(selGrowEase);

  sldGrowStutter = criarSlider(divG, "Stutter", 0, 100, 0, 1);
  sldGrowth = criarSlider(divG, "Progresso Manual", 0, 100, 100, 1);

  configurarToggle(btnGrow, divG, "GROWTH");
  criarSeparador(painel);

  let btnP = criarBotaoToggle(painel, "SOFT BODY PHYSICS");
  let divP = criarContainerOculto(painel);

  let infoDiv = createDiv(
    "Base: 1 pt fixo (vermelho)<br>Gravity: - = up, + = down<br>Damping: - = volta ao original<br>Intensity 0% = forma original"
  );
  infoDiv.parent(divP);
  infoDiv.style("font-size", "9px");
  infoDiv.style("color", "#666");
  infoDiv.style("margin-bottom", "8px");
  infoDiv.style("line-height", "1.4");

  chkPhysics = criarCheckbox(divP, "Active");
  chkPhysics.checked(true);

  sldPhysicsIntensity = criarSlider(divP, "🎚️ Physics Intensity", 0, 100, 0, 1);
  criarSeparador(divP);

  sldGravity = criarSlider(divP, "Gravity (- = up)", -200, 200, 0, 1);
  sldWindForce = criarSlider(divP, "Wind Force", 0, 200, 60, 1);
  sldTurbulence = criarSlider(divP, "Turbulence", 0, 200, 40, 1);
  sldStiffness = criarSlider(divP, "Stiffness (tip)", 0.05, 1, 0.6, 0.01);
  sldDamping = criarSlider(divP, "Damping (- = return)", -1, 0.99, 0.93, 0.01);

  criarSeparador(divP);

  chkShowPoints = criarCheckbox(divP, "Show Points (Debug)");
  chkShowStiffness = criarCheckbox(divP, "Show Stiffness (Colors)");

  configurarToggle(btnP, divP, "SOFT BODY PHYSICS");
  divP.style("display", "block");
  btnP.html("▲ SOFT BODY PHYSICS");
}

function estilizarPainel(p) {
  p.style("background-color", "rgba(0, 0, 0, 0.9)");
  p.style("padding", "15px");
  p.style("border-radius", "8px");
  p.style("color", "white");
  p.style("font-family", "sans-serif");
  p.style("width", "240px");
  p.style("z-index", "1000");
}

function criarHeader(p, t) {
  let el = createP(t);
  el.parent(p);
  el.style("margin", "0 0 10px 0");
  el.style("font-weight", "bold");
  el.style("color", "#fff");
  el.style("border-left", "3px solid #00ffcc");
  el.style("padding-left", "8px");
}

function criarSeparador(p) {
  let s = createDiv();
  s.parent(p);
  s.style("height", "1px");
  s.style("background-color", "#333");
  s.style("margin", "10px 0");
}

function criarContainerOculto(p) {
  let d = createDiv();
  d.parent(p);
  d.style("display", "none");
  d.style("padding", "10px");
  d.style("background", "rgba(255,255,255,0.03)");
  return d;
}

function criarBotaoToggle(p, t) {
  let b = createButton("▼ " + t);
  b.parent(p);
  b.style("width", "100%");
  b.style("background", "transparent");
  b.style("border", "1px solid #444");
  b.style("color", "#aaa");
  b.style("padding", "6px");
  b.style("cursor", "pointer");
  return b;
}

function configurarToggle(b, d, t) {
  b.mousePressed(() => {
    if (d.style("display") === "none") {
      d.style("display", "block");
      b.html("▲ " + t);
    } else {
      d.style("display", "none");
      b.html("▼ " + t);
    }
  });
}

function criarCheckbox(p, t) {
  let d = createDiv();
  d.parent(p);
  let c = createCheckbox(t, false);
  c.parent(d);
  c.style("color", "#fff");
  return c;
}

function criarSlider(p, t, min, max, val, step) {
  let d = createDiv();
  d.parent(p);
  createSpan(t)
    .parent(d)
    .style("font-size", "9px")
    .style("color", "#888")
    .style("display", "block");
  let s = createSlider(min, max, val, step);
  s.parent(d);
  s.style("width", "100%");
  return s;
}

function estilizarSelect(s) {
  s.style("background", "#222");
  s.style("color", "#fff");
  s.style("border", "1px solid #444");
  s.style("padding", "4px");
  s.style("border-radius", "4px");
}
