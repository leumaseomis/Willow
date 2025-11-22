// Arcos originais
let arcos = [
  { id: 1, x: 187, y: 518, w: 250, h: 250 },
  { id: 2, x: 270, y: 518, w: 117, h: 363 },
  { id: 3, x: 401, y: 518, w: 117, h: 594 },
  { id: 4, x: 483, y: 518, w: 250, h: 441 }
];

// Estado Global
let globalTime = 0;
let autoGrowTime = 0;

// Variáveis de Física
let physHeight = [];
let physShear = [];

// UI Vars
let painel, sldEsp, sldGlobalSpeed;
// Menus Dropdown
let divGrowth, divMotion, divPhysics, divVisuals;
// Growth Vars
let sldGrowth, chkAutoGrow, selGrowMode, selGrowDir, selGrowEase, sldGrowStutter;
// Motion / Physics / Visuals Vars
let selMotionType, sldMotionAmp, sldMotionFreq;
let chkPhysics, sldLevitation, sldTurbulence, sldInertia, sldWindForce;
let chkEcho, sldEchoRastros, sldEchoLag, chkIntel, sldIntelAmp;

function setup() {
  createCanvas(windowWidth, windowHeight);

  // REGRA SAGRADA: PONTAS RETAS
  strokeCap(SQUARE);
  noFill();

  criarInterfaceCompleta();

  // Inicializar Física
  for(let i=0; i<arcos.length; i++) {
    physHeight.push(new SmoothValue(0));
    physShear.push(new SmoothValue(0));
  }
}

function draw() {
  background(20);

  // --- 1. GLOBAL ---
  let esp = sldEsp.value();
  let speed = sldGlobalSpeed.value();
  globalTime += speed;

  // Temporizador do Ciclo Growth
  let loopDuration = 1.0 + 0.2;

  if (chkAutoGrow.checked()) {
    autoGrowTime += 0.005;
    if (autoGrowTime > loopDuration) autoGrowTime = -0.2;
  } else {
    autoGrowTime = sldGrowth.value() / 100;
  }

  stroke(100, 200, 180);
  strokeWeight(esp);
  noFill();

  // --- 2. GEOMETRIA BASE ---
  let basesOriginais = arcos.map(a => (a.id <= 2) ? a.x + a.w/2 : a.x - a.w/2);
  let primeiraBase = basesOriginais[0];
  let distReal = esp * 1.5;

  let novasBases = [];
  for (let i = 0; i < arcos.length; i++) {
    novasBases[i] = primeiraBase + i * distReal;
  }

  // --- 3. PARÂMETROS ---
  let isPhysics = chkPhysics.checked();
  let growMode = selGrowMode.value();
  let growDir = selGrowDir.value();
  let growEase = selGrowEase.value();
  let growStutter = sldGrowStutter.value();

  // Physics Inputs
  let mType = selMotionType.value();
  let mAmp = sldMotionAmp.value();
  let mFreq = sldMotionFreq.value();
  let lev = sldLevitation.value();
  let turb = sldTurbulence.value();
  let inert = sldInertia.value();
  let wind = sldWindForce.value();

  // --- 4. ATUALIZAR FÍSICA ---
  for (let i = 0; i < arcos.length; i++) {
    let masterSig = 0;
    if (mType === 'Sine (Breath)') {
      masterSig = sin(globalTime*mFreq+i*0.5);
    } else if (mType === 'Pulse (Beat)') {
      let w = sin(globalTime*mFreq);
      masterSig = (w > 0.8 ? 1 : 0);
    } else if (mType === 'Noise (Organic)') {
      masterSig = map(noise(globalTime*mFreq+i), 0, 1, -1, 1);
    }

    let tH = 0;
    let tS = 0;

    if (isPhysics) {
      tH = lev + (map(noise(globalTime*0.5+i*10), 0, 1, -0.5, 0.5) * turb) + (masterSig * mAmp);
      tS = map(noise(globalTime*0.2+i), 0, 1, -0.5, 0.5) * (wind/100);
    } else {
      if (mType !== 'None') tH = masterSig * mAmp;
    }

    physHeight[i].update(tH, inert);
    physShear[i].update(tS, inert);
  }

  // --- 5. DESENHO ---
  for (let i = 0; i < arcos.length; i++) {
    let a = arcos[i];
    let baseX = novasBases[i];
    let baseY = a.y;

    let currentH = a.h + physHeight[i].val;
    let currentShear = physShear[i].val;

    let vIntel = 0;
    if (chkIntel.checked()) {
       vIntel = map(noise(frameCount*0.5+i), 0, 1, -10, 10) * (sldIntelAmp.value()/10);
    }
    let drawH = currentH + vIntel;

    // --- CÁLCULO GROWTH ---
    let growInput = constrain(autoGrowTime, 0, 1);

    // Cascata
    let cascadedInput = growInput;
    if (growMode === 'Sequential') {
      let start = i * 0.25;
      let end = start + 0.25;
      cascadedInput = map(growInput, start, end, 0, 1, true);
    } else if (growMode === 'Cascade') {
      let start = i * 0.15;
      let end = start + 0.5;
      cascadedInput = map(growInput, start, end, 0, 1, true);
    }

    // Direção e Segmentação (Lógica Completa Restaurada)
    let segStart = 0;
    let segEnd = 1;

    if (growDir === 'Loop: Base -> Tip -> Clear') {
      if (cascadedInput < 0.5) {
         let t = map(cascadedInput, 0, 0.5, 0, 1);
         segStart = 0;
         segEnd = applyEasing(t, growEase);
      } else {
         let t = map(cascadedInput, 0.5, 1.0, 0, 1);
         segStart = applyEasing(t, growEase);
         segEnd = 1;
      }
    }
    else if (growDir === 'Anim Out -> Anim In') {
      if (cascadedInput < 0.5) {
         // Fase OUT (Varrer da base)
         let t = map(cascadedInput, 0, 0.5, 0, 1);
         segStart = applyEasing(t, growEase);
         segEnd = 1;
      } else {
         // Fase IN (Crescer da base)
         let t = map(cascadedInput, 0.5, 1.0, 0, 1);
         segStart = 0;
         segEnd = applyEasing(t, growEase);
      }
    }
    else if (growDir === 'One Way: Tip -> Base') {
      let t = applyEasing(cascadedInput, growEase);
      segStart = 0;
      segEnd = 1.0 - t;
    }
    else { // One Way: Base -> Tip
      let t = applyEasing(cascadedInput, growEase);
      segStart = 0;
      segEnd = t;
    }

    if (growStutter > 0) {
      let steps = map(growStutter, 1, 100, 50, 2);
      segStart = floor(segStart * steps) / steps;
      segEnd = floor(segEnd * steps) / steps;
    }

    if (segEnd - segStart <= 0.001) continue;

    // --- RENDERIZAÇÃO ---
    stroke(100, 200, 180);

    push();
    translate(baseX, baseY);
    shearX(currentShear);

    let drawCx = (a.id <= 2) ? -a.w / 2 : a.w / 2;

    if (drawH != 0) {
      let angleStart, angleStop;
      if (a.id <= 2) {
        angleStop = TWO_PI - (PI * segStart);
        angleStart = TWO_PI - (PI * segEnd);
      } else {
        angleStart = PI + (PI * segStart);
        angleStop = PI + (PI * segEnd);
      }
      arc(drawCx, 0, a.w, drawH, angleStart, angleStop);
    }
    pop();
  }
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
      return pow(2, -10 * t) * sin((t - p / 4) * (2 * PI) / p) + 1;
    default:
      return t;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (painel) painel.position(windowWidth - 270, 20);
}

class SmoothValue {
  constructor(v) {
    this.val = v;
  }

  update(t, s) {
    this.val = lerp(this.val, t, s);
  }
}

// --- UI COMPLETA ---
function criarInterfaceCompleta() {
  painel = createDiv();
  painel.position(windowWidth - 270, 20);
  estilizarPainel(painel);

  criarHeader(painel, "GLOBAL");
  sldEsp = criarSlider(painel, "Espessura", 1, 60, 8, 1);
  sldGlobalSpeed = criarSlider(painel, "Velocidade", 0, 0.5, 0.05, 0.001);
  criarSeparador(painel);

  // 1. GROWTH
  let btnGrow = criarBotaoToggle(painel, "GROWTH");
  divGrowth = criarContainerOculto(painel);

  let divG1 = createDiv();
  divG1.parent(divGrowth);
  divG1.style('display', 'flex');
  divG1.style('gap', '10px');
  divG1.style('margin-bottom', '5px');

  chkAutoGrow = createCheckbox('Active', false);
  chkAutoGrow.parent(divG1);
  chkAutoGrow.style('color', '#00ffcc');

  // Evento: Começa a meio (Cheio) se ativar o loop
  chkAutoGrow.changed(() => {
    if(chkAutoGrow.checked()) autoGrowTime = 0.0;
  });

  selGrowDir = createSelect();
  selGrowDir.parent(divG1);
  selGrowDir.option('One Way: Base -> Tip');
  selGrowDir.option('Anim Out -> Anim In');
  selGrowDir.option('Loop: Base -> Tip -> Clear');
  selGrowDir.option('Cycle: In -> Out');
  selGrowDir.option('One Way: Tip -> Base');
  selGrowDir.selected('One Way: Base -> Tip');
  selGrowDir.style('flex-grow', '1');
  estilizarSelect(selGrowDir);

  let divG2 = createDiv();
  divG2.parent(divGrowth);
  divG2.style('display', 'flex');
  divG2.style('gap', '10px');
  divG2.style('margin-bottom', '10px');

  selGrowMode = createSelect();
  selGrowMode.parent(divG2);
  selGrowMode.option('Simultaneous');
  selGrowMode.option('Cascade');
  selGrowMode.option('Sequential');
  selGrowMode.style('flex-grow', '1');
  estilizarSelect(selGrowMode);

  selGrowEase = createSelect();
  selGrowEase.parent(divG2);
  selGrowEase.option('SmoothStep');
  selGrowEase.option('Linear');
  selGrowEase.option('Ease Out');
  selGrowEase.option('Elastic');
  selGrowEase.style('flex-grow', '1');
  estilizarSelect(selGrowEase);

  sldGrowStutter = criarSlider(divGrowth, "Stutter", 0, 100, 0, 1);
  sldGrowth = criarSlider(divGrowth, "Progresso Manual", 0, 100, 100, 1);

  configurarToggle(btnGrow, divGrowth, "GROWTH");
  criarSeparador(painel);

  setupOtherPanels();
}

function setupOtherPanels() {
  // 2. MOTION
  let btnM = criarBotaoToggle(painel, "2. MOTION");
  let divM = criarContainerOculto(painel);

  selMotionType = createSelect();
  selMotionType.parent(divM);
  selMotionType.option('None');
  selMotionType.option('Sine (Breath)');
  selMotionType.option('Pulse (Beat)');
  selMotionType.option('Noise (Organic)');
  estilizarSelect(selMotionType);

  sldMotionAmp = criarSlider(divM, "Amp", 0, 400, 100, 10);
  sldMotionFreq = criarSlider(divM, "Freq", 0.1, 10, 2, 0.1);
  configurarToggle(btnM, divM, "2. MOTION");
  criarSeparador(painel);

  // 3. PHYSICS
  let btnP = criarBotaoToggle(painel, "3. PHYSICS");
  let divP = criarContainerOculto(painel);

  chkPhysics = criarCheckbox(divP, "Active");
  sldLevitation = criarSlider(divP, "Lev", 0, 600, 150, 10);
  sldTurbulence = criarSlider(divP, "Turb", 0, 200, 50, 10);
  sldInertia = criarSlider(divP, "Inertia", 0.01, 0.2, 0.05, 0.01);
  sldWindForce = criarSlider(divP, "Wind", 0, 100, 20, 1);
  configurarToggle(btnP, divP, "3. PHYSICS");
  criarSeparador(painel);

  // 4. VISUALS
  let btnV = criarBotaoToggle(painel, "4. VISUALS");
  let divV = criarContainerOculto(painel);

  chkEcho = criarCheckbox(divV, "Echo");
  sldEchoRastros = criarSlider(divV, "Trails", 0, 50, 15, 1);
  sldEchoLag = criarSlider(divV, "Lag", 0, 5, 1, 0.1);
  chkIntel = criarCheckbox(divV, "Intel");
  sldIntelAmp = criarSlider(divV, "Intel Amp", 0, 50, 20, 1);
  configurarToggle(btnV, divV, "4. VISUALS");
}

function estilizarPainel(p) {
  p.style('background-color', 'rgba(0, 0, 0, 0.9)');
  p.style('padding', '15px');
  p.style('border-radius', '8px');
  p.style('color', 'white');
  p.style('font-family', 'sans-serif');
  p.style('width', '240px');
  p.style('z-index', '1000');
}

function criarHeader(p, t) {
  let el = createP(t);
  el.parent(p);
  el.style('margin', '0 0 10px 0');
  el.style('font-weight', 'bold');
  el.style('color', '#fff');
  el.style('border-left', '3px solid #00ffcc');
  el.style('padding-left', '8px');
}

function criarSeparador(p) {
  let s = createDiv();
  s.parent(p);
  s.style('height', '1px');
  s.style('background-color', '#333');
  s.style('margin', '10px 0');
}

function criarContainerOculto(p) {
  let d = createDiv();
  d.parent(p);
  d.style('display', 'none');
  d.style('padding', '10px');
  d.style('background', 'rgba(255,255,255,0.03)');
  return d;
}

function criarBotaoToggle(p, t) {
  let b = createButton('▼ ' + t);
  b.parent(p);
  b.style('width', '100%');
  b.style('background', 'transparent');
  b.style('border', '1px solid #444');
  b.style('color', '#aaa');
  b.style('padding', '6px');
  b.style('cursor', 'pointer');
  return b;
}

function configurarToggle(b, d, t) {
  b.mousePressed(() => {
    if(d.style('display') === 'none') {
      d.style('display', 'block');
      b.html('▲ ' + t);
    } else {
      d.style('display', 'none');
      b.html('▼ ' + t);
    }
  });
}

function criarCheckbox(p, t) {
  let d = createDiv();
  d.parent(p);
  let c = createCheckbox(t, false);
  c.parent(d);
  c.style('color', '#fff');
  return c;
}

function criarSlider(p, t, min, max, val, step) {
  let d = createDiv();
  d.parent(p);
  createSpan(t).parent(d).style('font-size', '9px').style('color', '#888').style('display', 'block');
  let s = createSlider(min, max, val, step);
  s.parent(d);
  s.style('width', '100%');
  return s;
}

function estilizarSelect(s) {
  s.style('background', '#222');
  s.style('color', '#fff');
  s.style('border', '1px solid #444');
  s.style('padding', '4px');
  s.style('border-radius', '4px');
}
