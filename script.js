// Navigation between pages
document.querySelectorAll('.nav-bar a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.dataset.page;
    
    document.querySelectorAll('.nav-bar a').forEach(a => a.classList.remove('active'));
    link.classList.add('active');
    
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(page).classList.add('active');
    
    if (page === 'simulation') {
      setTimeout(() => drawOscilloscope(), 100);
    }
  });
});

// Block Diagram Interactions
let draggedBlock = null;
let offsetX, offsetY;
let connections = [];
let isDrawing = false;
let startPoint = null;
let tempLine = null;

const blocks = document.querySelectorAll('.diagram-block');
const container = document.getElementById('diagramContainer');
const svg = document.getElementById('connectionSvg');

blocks.forEach(block => {
  block.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('connection-point')) return;
    
    draggedBlock = block;
    const rect = block.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    block.classList.add('dragging');
  });
});

document.addEventListener('mousemove', (e) => {
  if (draggedBlock) {
    const containerRect = container.getBoundingClientRect();
    let x = e.clientX - containerRect.left - offsetX;
    let y = e.clientY - containerRect.top - offsetY;
    
    x = Math.max(0, Math.min(x, container.offsetWidth - draggedBlock.offsetWidth));
    y = Math.max(0, Math.min(y, container.offsetHeight - draggedBlock.offsetHeight));
    
    draggedBlock.style.left = x + 'px';
    draggedBlock.style.top = y + 'px';
    
    updateConnections();
  }
  
  if (isDrawing && tempLine) {
    const containerRect = container.getBoundingClientRect();
    const x = e.clientX - containerRect.left;
    const y = e.clientY - containerRect.top;
    tempLine.setAttribute('x2', x);
    tempLine.setAttribute('y2', y);
  }
});

document.addEventListener('mouseup', () => {
  if (draggedBlock) {
    draggedBlock.classList.remove('dragging');
    draggedBlock = null;
  }
  
  if (tempLine && tempLine.parentNode) {
    tempLine.parentNode.removeChild(tempLine);
    tempLine = null;
  }
  isDrawing = false;
  startPoint = null;
});

document.querySelectorAll('.connection-point').forEach(point => {
  point.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    if (point.dataset.type !== 'output') return;
    
    const rect = point.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    startPoint = {
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top + rect.height / 2 - containerRect.top,
      block: point.dataset.block,
      type: point.dataset.type
    };
    
    isDrawing = true;
    tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tempLine.setAttribute('class', 'arrow-line');
    tempLine.setAttribute('x1', startPoint.x);
    tempLine.setAttribute('y1', startPoint.y);
    tempLine.setAttribute('x2', startPoint.x);
    tempLine.setAttribute('y2', startPoint.y);
    svg.appendChild(tempLine);
  });
  
  point.addEventListener('mouseup', (e) => {
    if (isDrawing && startPoint && point.dataset.type === 'input') {
      e.stopPropagation();
      const rect = point.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const endPoint = {
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top + rect.height / 2 - containerRect.top,
        block: point.dataset.block,
        type: point.dataset.type
      };
      
      if (startPoint.block !== endPoint.block) {
        connections.push({ start: startPoint, end: endPoint });
        updateConnections();
      }
      
      if (tempLine && tempLine.parentNode) {
        tempLine.parentNode.removeChild(tempLine);
        tempLine = null;
      }
      isDrawing = false;
      startPoint = null;
    }
  });
});

function updateConnections() {
    svg.querySelectorAll('.arrow-line').forEach(line => line.remove());

    const disconnectThreshold = 200; // distance limit before auto disconnect

    connections = connections.filter(conn => {
        const startBlock = document.querySelector(`[data-id="${conn.start.block}"]`);
        const endBlock = document.querySelector(`[data-id="${conn.end.block}"]`);
        if (!startBlock || !endBlock) return false;

        const startPos = getConnectionPointPosition(startBlock, conn.start.type);
        const endPos = getConnectionPointPosition(endBlock, conn.end.type);

        // ---- Auto-disconnect if blocks moved too far ----
        const dx = startPos.x - endPos.x;
        const dy = startPos.y - endPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > disconnectThreshold) {
            return false; // remove this connection
        }

        // ---- Create CURVED arrow instead of straight line ----
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'arrow-line');

        // Control point for curve (midpoint + offset)
        const mx = (startPos.x + endPos.x) / 2;
        const my = (startPos.y + endPos.y) / 2;
        const curveOffset = 40; // curvature strength

        const cx = mx;
        const cy = my - curveOffset;

        const d = `M ${startPos.x} ${startPos.y} Q ${cx} ${cy} ${endPos.x} ${endPos.y}`;
        path.setAttribute("d", d);

        svg.appendChild(path);
        return true; // keep this connection
    });

    drawOscilloscope();
}


function isPsdConnected() {
  // true if there is a connection from Line Encoder (output) to PSD (input)
  return connections.some(conn =>
    conn.start.block === 'encoder' &&
    conn.start.type === 'output' &&
    conn.end.block === 'psd' &&
    conn.end.type === 'input'
  );
}

/*function isOscConnected() {
  return connections.some(conn =>
    conn.start.block === 'encoder' &&
    conn.start.type === 'output' &&
    conn.end.block === 'oscilloscope' &&
    conn.end.type === 'input'
  );
}*/

function isScopeConnected() {
  return connections.some(conn =>
    conn.start.block === 'encoder' &&
    conn.start.type === 'output' &&
    conn.end.block === 'oscilloscope' &&
    conn.end.type === 'input'
  );
}

function getConnectionPointPosition(block, type) {
  const rect = block.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const point = block.querySelector(`.connection-point.${type}`);
  const pointRect = point.getBoundingClientRect();
  
  return {
    x: pointRect.left + pointRect.width / 2 - containerRect.left,
    y: pointRect.top + pointRect.height / 2 - containerRect.top
  };
}

function resetDiagram() {
  connections = [];
  updateConnections();

  const positions = {
    input:       { left: 50,  top: 170 },
    encoder:     { left: 350, top: 170 },
    oscilloscope:{ left: 700, top: 170 },
    psd:         { left: 950, top: 170 }
  };
  
  blocks.forEach(block => {
    const id = block.dataset.id;
    if (positions[id]) {
      block.style.left = positions[id].left + 'px';
      block.style.top  = positions[id].top  + 'px';
    }
  });

  // 🔥 Force-hide PSD on reset
  const psdSection = document.getElementById('psdSection');
  if (psdSection) {
      psdSection.style.display = 'none';
      Plotly.purge('theoryPSD');
      Plotly.purge('practicalPSD');
  }
}



// Line Coding Simulation
let currentChannel = 0;
let binaryInput = '10110100';

let channelSettings = [];
for (let i = 0; i < 11; i++) {
  channelSettings.push({
    bitsShown: 8,
    amplitude: 5
  });
}

// --- Compare mode globals ---
let compareMode = false;
let compareA = 1; // channel index for first technique
let compareB = 2; // channel index for second technique

const CHANNEL_LABELS = {
  1: 'Unipolar NRZ',
  2: 'Unipolar RZ',
  3: 'Polar NRZ',
  4: 'Polar RZ',
  5: 'Bipolar AMI',
  6: 'Pseudo Ternary',
  7: 'Manchester',
  8: 'HDB3',
  9: 'B8ZS'
};

function enterCompareMode() {
  // Require the encoder -> oscilloscope connection to be present for compare
  if (!isScopeConnected()) {
    alert('Please connect the Line Encoder output to the Virtual Oscilloscope before using COMPARE.');
    return;
  }

  compareMode = true;
  document.getElementById('compareControls').style.display = 'flex';
  // visually deactivate channel buttons while in compare mode
  document.querySelectorAll('.channel-selector .channel-btn').forEach(btn => btn.classList.remove('active'));
  drawOscilloscope();
}

function showCompare() {
  const a = parseInt(document.getElementById('compareSelectA').value, 10);
  const b = parseInt(document.getElementById('compareSelectB').value, 10);
  if (a === b) {
    alert('Please select two different line coding techniques to compare.');
    return;
  }
  compareA = a;
  compareB = b;
  drawOscilloscope();
}

function closeCompare() {
  compareMode = false;
  document.getElementById('compareControls').style.display = 'none';
  // reselect currently active channel button
  const buttons = document.querySelectorAll('.channel-selector .channel-btn');
  buttons.forEach((btn, idx) => btn.classList.toggle('active', idx === currentChannel));
  drawOscilloscope();
}

function getEncodedByChannel(channel, bits, amp) {
  switch (channel) {
    case 1: return generateUnipolarNRZ(bits, amp);
    case 2: return generateUnipolarRZ(bits, amp);
    case 3: return generatePolarNRZ(bits, amp);
    case 4: return generatePolarRZ(bits, amp);
    case 5: return generateBipolarAMI(bits, amp);
    case 6: return generatePseudoTernary(bits, amp);
    case 7: return generateManchester(bits, amp);
    case 8: return generateHDB3(bits, amp);
    case 9: return generateB8ZS(bits, amp);
    default: return generateUnipolarNRZ(bits, amp);
  }
}

function updateControlsDisplay() {
  const settings = channelSettings[currentChannel];
  
  updateDialPointer('bitRateDial', 'bitRatePointer', settings.bitsShown, 4, 32);
  document.getElementById('bitRateValue').textContent = settings.bitsShown + ' bits';
  
  updateDialPointer('amplitudeDial', 'amplitudePointer', settings.amplitude, 1, 10);
  document.getElementById('amplitudeValue').textContent = settings.amplitude.toFixed(1) + ' V';
}

function updateDialPointer(dialId, pointerId, value, min, max) {
  const pointer = document.getElementById(pointerId);
  const normalized = (value - min) / (max - min);
  const angle = -135 + (normalized * 270);
  const radians = (angle * Math.PI) / 180;
  const x2 = 100 + 65 * Math.sin(radians);
  const y2 = 100 - 65 * Math.cos(radians);
  pointer.setAttribute('x2', x2);
  pointer.setAttribute('y2', y2);
}

function setupDialInteraction(dialId, pointerId, min, max, step, callback) {
  const dial = document.getElementById(dialId);
  let isDragging = false;

  const updateFromMouse = (e) => {
    const rect = dial.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
    
    if (angle < -135) angle = -135;
    if (angle > 135) angle = 135;
    
    const normalized = (angle + 135) / 270;
    let value = min + normalized * (max - min);
    value = Math.round(value / step) * step;
    value = Math.max(min, Math.min(max, value));
    
    callback(value);
  };

  dial.addEventListener('mousedown', (e) => {
    isDragging = true;
    updateFromMouse(e);
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      updateFromMouse(e);
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  dial.addEventListener('touchstart', (e) => {
    isDragging = true;
    const touch = e.touches[0];
    updateFromMouse(touch);
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    if (isDragging) {
      const touch = e.touches[0];
      updateFromMouse(touch);
      e.preventDefault();
    }
  }, { passive: false });

  document.addEventListener('touchend', () => {
    isDragging = false;
  });
}

function selectChannel(channel) {
  currentChannel = channel;
  const buttons = document.querySelectorAll('.channel-selector .channel-btn');
  buttons.forEach((btn, idx) => {
    btn.classList.toggle('active', idx === channel);
  });
  updateControlsDisplay();
  drawOscilloscope();
}

function updateSignal() {
  const input = document.getElementById('binaryInput').value;
  if (/^[01]+$/.test(input)) {
    binaryInput = input;
    drawOscilloscope();
  } else {
    alert('Please enter only 0s and 1s');
  }
}

function repeatPattern(pattern, totalBits) {
  let repeated = '';
  while (repeated.length < totalBits) {
    repeated += pattern;
  }
  return repeated.substring(0, totalBits);
}

function generateUnipolarNRZ(bits, amp) {
  const a = parseFloat(amp);
  return bits.split('').map(bit => bit === '1' ? a : 0);
}

function generateUnipolarRZ(bits, amp) {
  const a = parseFloat(amp);
  let signal = [];
  bits.split('').forEach(bit => {
    signal.push(bit === '1' ? a : 0);
    signal.push(0);
  });
  return signal;
}

function generatePolarNRZ(bits, amp) {
  const a = parseFloat(amp);
  return bits.split('').map(bit => bit === '1' ? a : -a);
}

function generatePolarRZ(bits, amp) {
  const a = parseFloat(amp);
  let signal = [];
  bits.split('').forEach(bit => {
    signal.push(bit === '1' ? a : -a);
    signal.push(0);
  });
  return signal;
}

function generateBipolarAMI(bits, amp) {
  const a = parseFloat(amp);
  let signal = [];
  let lastOne = a;
  bits.split('').forEach(bit => {
    if (bit === '1') {
      signal.push(lastOne);
      lastOne = -lastOne;
    } else {
      signal.push(0);
    }
  });
  return signal;
}

function generateManchester(bits, amp) {
  const a = parseFloat(amp);
  const signal = [];
  bits.split('').forEach(bit => {
    if (bit === '1') {
      signal.push(a);
      signal.push(-a);
    } else {
      signal.push(-a);
      signal.push(a);
    }
  });
  return signal;
}

// Global variable to store HDB3 metadata
let hdb3SpecialBits = { balancing: [], violation: [] };

function generateHDB3(bits, amp) {
  const a = parseFloat(amp);
  const signal = [];
  // store bit indices (0-based) where balancing (B) and violation (V) occur
  hdb3SpecialBits = { balancing: [], violation: [] };
  let lastPolarity = -a;
  let nonZeroCount = 0;
  let zeroRun = 0;

  bits.split('').forEach((bit, bitIndex) => {
    if (bit === '1') {
      const out = -lastPolarity;
      signal.push(out);
      lastPolarity = out;
      nonZeroCount++;
      zeroRun = 0;
    } else {
      signal.push(0);
      zeroRun++;

      if (zeroRun === 4) {
        // the four zero bit indices are: bitIndex-3, bitIndex-2, bitIndex-1, bitIndex
        const prevPolarity = lastPolarity;

        if (nonZeroCount % 2 === 1) {
          // odd number of non-zero pulses -> use 000V (violation at last zero)
          signal[bitIndex] = prevPolarity; // V (same polarity as previous mark)
          lastPolarity = prevPolarity;
          hdb3SpecialBits.violation.push(bitIndex);
        } else {
          // even number of non-zero pulses -> use B00V
          // B at bitIndex-3, V at bitIndex. Choose B opposite to previous mark
          const Bpol = -prevPolarity;
          signal[bitIndex - 3] = Bpol; // B (balancing)
          signal[bitIndex] = Bpol;     // V (violation) - same polarity as B here per common convention
          lastPolarity = Bpol;
          hdb3SpecialBits.balancing.push(bitIndex - 3);
          hdb3SpecialBits.violation.push(bitIndex);
        }

        nonZeroCount = 0;
        zeroRun = 0;
      }
    }
  });

  return signal;
}

// Global for B8ZS special bits
let b8zsSpecialBits = { balancing: [], violation: [] };

function generateB8ZS(bits, amp) {
  const a = parseFloat(amp);
  let signal = [];
  let lastPol = -a; // tracks last non-zero polarity
  b8zsSpecialBits = { balancing: [], violation: [] };

  let zeroCount = 0;

  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') {
      let pulse = -lastPol;
      signal.push(pulse);
      lastPol = pulse;
      zeroCount = 0;
    } else {
      zeroCount++;
      signal.push(0);

      if (zeroCount === 8) {
        // Apply B8ZS substitution
        const start = i - 7; // first zero of the 8 zeros

        if (lastPol === a) {
          // last pulse was +V → use +−0−+
          signal[start + 3] = +a;  // violation
          signal[start + 4] = -a;  // balancing
          signal[start + 6] = -a;  // violation
          signal[start + 7] = +a;  // balancing

          b8zsSpecialBits.violation.push(start + 3, start + 6);
          b8zsSpecialBits.balancing.push(start + 4, start + 7);

          lastPol = +a;

        } else {
          // last pulse was -V → use −+0+−
          signal[start + 3] = -a;
          signal[start + 4] = +a;
          signal[start + 6] = +a;
          signal[start + 7] = -a;

          b8zsSpecialBits.violation.push(start + 3, start + 6);
          b8zsSpecialBits.balancing.push(start + 4, start + 7);

          lastPol = -a;
        }

        zeroCount = 0;
      }
    }
  }

  return signal;
}

function generatePseudoTernary(bits, amp) {
  const a = parseFloat(amp);
  let signal = [];
  let lastZeroState = a; // Tracks alternating states for binary 0: starts with +V
  
  bits.split('').forEach(bit => {
    if (bit === '1') {
      // Binary 1: 0V
      signal.push(0);
    } else {
      // Binary 0: Alternates between +V and -V
      signal.push(lastZeroState);
      lastZeroState = -lastZeroState; // Toggle for next zero
    }
  });
  
  return signal;
}

function generateInputSignal(bits) {
  return bits.split('').map(bit => bit === '1' ? 5 : 0);
}

function createTimeArray(signal, bitsShown, xOffset = 0) {
  const totalSamples = Math.max(1, signal.length);
  const bits = Math.max(1, Math.round(bitsShown));
  let samplesPerBit = totalSamples / bits;
  samplesPerBit = Math.max(1, Math.round(samplesPerBit));
  const bitDuration = 1;
  const dt = bitDuration / samplesPerBit;

  const time = [];
  for (let i = 0; i < totalSamples; i++) {
    time.push(i * dt + xOffset);
  }
  return time;
}

function computePSD(signal) {
  const N = signal.length;
  if (N === 0) {
    return { freq: [], psd: [] };
  }

  // Use raw signal (do not remove DC here - windowing will be applied in FFT)
  const x = signal.slice();

  const halfN = Math.floor(N / 2);
  const freq = [];
  const psd  = [];

  for (let k = 0; k <= halfN; k++) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n++) {
      const angle = -2 * Math.PI * k * n / N;
      re += x[n] * Math.cos(angle);
      im += x[n] * Math.sin(angle);
    }
    const mag2 = (re * re + im * im) / N; // power
    freq.push(k / N); // normalized frequency (0 to 0.5)
    psd.push(mag2);
  }

  return { freq, psd };
}

// --------------------------
// Smooth transition helpers
// --------------------------
function fadeShow(el) {
  el.classList.add('fade'); 
  el.classList.remove('fade-hidden');
}

function fadeHide(el) {
  el.classList.add('fade-hidden');
}

function slideShow(el) {
  el.classList.add('slide');
  el.classList.remove('slide-hidden');
}

function slideHide(el) {
  el.classList.add('slide-hidden');
}

function scaleShow(el) {
  el.classList.add('scale');
  el.classList.remove('scale-hidden');
}

function scaleHide(el) {
  el.classList.add('scale-hidden');
}

function drawOscilloscope() {
  // --- HIDE EVERYTHING IF OSCILLOSCOPE NOT CONNECTED ---
  const scopeDisplay = document.querySelector('.scope-display');
  const controlsSection = document.querySelector('.controls-section');
  const channelSelector = document.querySelector('.channel-selector');
  const inputSection = document.querySelector('.input-section');

  if (!isScopeConnected()) {

    const oscilloscopeBox = document.querySelector('.oscilloscope');
    const scopeDisplay = document.querySelector('.scope-display');
    const controlsSection = document.querySelector('.controls-section');
    const channelSelector = document.querySelector('.channel-selector');
    const inputSection = document.querySelector('.input-section');

    if (oscilloscopeBox) oscilloscopeBox.style.display = "none";
    if (scopeDisplay) scopeDisplay.style.display = "none";
    if (controlsSection) controlsSection.style.display = "none";
    if (channelSelector) channelSelector.style.display = "none";
    if (inputSection) inputSection.style.opacity = "0.4";

    Plotly.purge("oscilloscope");
    return;
}
const oscilloscopeBox = document.querySelector('.oscilloscope');
if (oscilloscopeBox) oscilloscopeBox.style.display = "block";

  scopeDisplay.style.display = "block";
  controlsSection.style.display = "grid";
  channelSelector.style.display = "flex";
  inputSection.style.opacity = "1";


  const settings = channelSettings[currentChannel];
  const bits = repeatPattern(binaryInput, settings.bitsShown);

  const inputSignal = generateInputSignal(bits);
  let encodedSignal = null;

  // --- Ensure encodedSignal is generated for single-channel mode ---
  if (!compareMode && currentChannel !== 0) {
    encodedSignal = getEncodedByChannel(currentChannel, bits, settings.amplitude);
  }

  // If compare mode is active, generate two encoded signals and draw both outputs
  if (compareMode) {
    const a = compareA;
    const b = compareB;
    const encodedA = getEncodedByChannel(a, bits, settings.amplitude);
    const encodedB = getEncodedByChannel(b, bits, settings.amplitude);

    const timeInput = createTimeArray(inputSignal, settings.bitsShown, 0);
    const timeA = createTimeArray(encodedA, settings.bitsShown, 0);
    const timeB = createTimeArray(encodedB, settings.bitsShown, 0);

    const tracesCompare = [];
    tracesCompare.push({
      x: timeInput,
      y: inputSignal,
      type: 'scatter',
      mode: 'lines',
      line: { color: '#4a9eff', width: 2.5, shape: 'hv' },
      name: 'Input (Vi)',
      xaxis: 'x',
      yaxis: 'y'
    });

    tracesCompare.push({
      x: timeA,
      y: encodedA,
      type: 'scatter',
      mode: 'lines',
      line: { color: '#ff9933', width: 2.5, shape: 'hv' },
      name: CHANNEL_LABELS[a] + ' (Vo)',
      xaxis: 'x',
      yaxis: 'y2'
    });

    tracesCompare.push({
      x: timeB,
      y: encodedB,
      type: 'scatter',
      mode: 'lines',
      line: { color: '#33ff99', width: 2.5, shape: 'hv' },
      name: CHANNEL_LABELS[b] + ' (Vo)',
      xaxis: 'x',
      yaxis: 'y2'
    });

    const layoutCompare = {
      paper_bgcolor: '#0f0f17',
      plot_bgcolor: '#0f0f17',
      margin: { l: 65, r: 20, t: 40, b: 40 },
      xaxis: { title: 'Time (s)', showgrid: true, gridcolor: '#222', zerolinecolor: '#555', color: '#aaa', domain: [0.08, 0.98], anchor: 'y' },
      yaxis: { title: ' input Vi (V)', domain: [0.55, 1.00], range: [-1, 6], showgrid: true, gridcolor: '#333', zerolinecolor: '#777', color: '#9ec7ff' },
      yaxis2: { title: 'Encoder output Vo (V)', domain: [0.05, 0.50], range: [-12, 12], showgrid: true, gridcolor: '#333', zerolinecolor: '#777', color: '#ffbf80', anchor: 'x' },
      showlegend: true,
      legend: { x: 0.98, y: 1.02, xanchor: 'right', font: { color: '#ddd' } },
      title: { text: 'Compare: ' + CHANNEL_LABELS[a] + ' vs ' + CHANNEL_LABELS[b], font: { color: '#ddd', size: 12 } }
    };

    Plotly.newPlot('oscilloscope', tracesCompare, layoutCompare, { displayModeBar: true, responsive: true });

    // Hide PSD while in compare mode
    const psdSectionCmp = document.getElementById('psdSection');
    if (psdSectionCmp) psdSectionCmp.style.display = 'none';

    return;
  }

  const timeInput = createTimeArray(inputSignal, settings.bitsShown, 0);
  const timeOutput = encodedSignal ? createTimeArray(encodedSignal, settings.bitsShown, 0) : timeInput;
  const traces = [];

  // Input waveform (always blue)
  traces.push({
    x: timeInput,
    y: inputSignal,
    type: 'scatter',
    mode: 'lines',
    line: { color: '#4a9eff', width: 2.5, shape: 'hv' },
    name: 'Input (Vi)',
    xaxis: 'x',
    yaxis: 'y'
  });

  // Handle output waveform coloring per channel
  if (currentChannel !== 8) {
    traces.push({
      x: timeOutput,
      y: encodedSignal || inputSignal,
      type: 'scatter',
      mode: 'lines',
      line: { color: '#ff9933', width: 2.5, shape: 'hv' },
      name: currentChannel === 0 ? 'Input (Vi)' : 'Output (Vo)',
      xaxis: 'x',
      yaxis: 'y2'
    });
  } 
  else {
  // --- Improved HDB3 drawing: full-bit highlighting (flat + vertical edges) ---
  const bitsArr = bits.split('');
  let xPos = 0;

  for (let i = 0; i < bitsArr.length; i++) {
    let color = '#ff9933'; // default orange
    if (hdb3SpecialBits.violation.includes(i)) color = 'red';
    else if (hdb3SpecialBits.balancing.includes(i)) color = 'yellow';

    const yVal = encodedSignal[i];
    const nextY = encodedSignal[i + 1] ?? 0;

    // --- 1️⃣ Draw left vertical (from 0V to signal level) ---
    traces.push({
      x: [xPos, xPos],
      y: [0, yVal],
      type: 'scatter',
      mode: 'lines',
      line: { color, width: 4, shape: 'hv' },
      showlegend: false,
      xaxis: 'x',
      yaxis: 'y2'
    });

    // --- 2️⃣ Draw horizontal flat top (signal level for full bit duration) ---
    traces.push({
      x: [xPos, xPos + 1],
      y: [yVal, yVal],
      type: 'scatter',
      mode: 'lines',
      line: { color, width: 4, shape: 'hv' },
      showlegend: false,
      xaxis: 'x',
      yaxis: 'y2'
    });

    // --- 3️⃣ Draw right vertical (back to 0V or next level) ---
    traces.push({
      x: [xPos + 1, xPos + 1],
      y: [yVal, 0],
      type: 'scatter',
      mode: 'lines',
      line: { color, width: 4, shape: 'hv' },
      showlegend: false,
      xaxis: 'x',
      yaxis: 'y2'
    });

    xPos += 1;
  }
}


  const layout = {
    paper_bgcolor: '#0f0f17',
    plot_bgcolor: '#0f0f17',
    margin: { l: 65, r: 20, t: 30, b: 40 },
    xaxis: {
      title: 'Time (s)',
      showgrid: true,
      gridcolor: '#222',
      zerolinecolor: '#555',
      color: '#aaa',
      domain: [0.08, 0.98],
      anchor: 'y'
    },
    yaxis: {
      title: ' input Vi (V)',
      domain: [0.55, 1.00],
      range: [-1, 6],
      showgrid: true,
      gridcolor: '#333',
      zerolinecolor: '#777',
      color: '#9ec7ff',
      tickfont: { color: '#9ec7ff' },
      titlefont: { color: '#9ec7ff' }
    },
    yaxis2: {
      title: 'Encoder output Vo (V)',
      domain: [0.05, 0.50],
      range: [-12, 12],
      showgrid: true,
      gridcolor: '#333',
      zerolinecolor: '#777',
      color: '#ffbf80',
      tickfont: { color: '#ffbf80' },
      titlefont: { color: '#ffbf80' },
      anchor: 'x'
    },
    showlegend: true,
    legend: { x: 0.98, y: 1.02, xanchor: 'right', font: { color: '#ddd' } },
    title: { text: 'Oscilloscope (upper: Input, lower: Output)', font: { color: '#ddd', size: 10 } ,family:'monospace'}
  };

  // Bit annotations (unchanged)
  const annotations = [];
  for (let i = 0; i < settings.bitsShown; i++) {
    annotations.push({
      x: i + 0.5,
      y: 1.0,
      xref: 'x',
      yref: 'paper',
      text: String(bits[i]),
      showarrow: false,
      font: { color: '#ccc', size: 12, family: 'monospace' }
    });
  }

  layout.annotations = annotations;
if (encodedSignal) {
  const arrowColor = '#ffffffff';

  // Manchester transitions
  if (currentChannel === 7 && encodedSignal.length === settings.bitsShown * 2) {
    for (let i = 0; i < settings.bitsShown; i++) {
      const first = encodedSignal[2 * i];
      const second = encodedSignal[2 * i + 1];
      if (first === 0 || second === 0) continue;
      const arrowSymbol = first > second ? '↓' : '↑';
      const xPos = i + 0.5;
      const yPos = (first + second) / 2;
      annotations.push({
        x: xPos,
        y: yPos,
        xref: 'x',
        yref: 'y2',
        text: arrowSymbol,
        showarrow: false,
        font: { color: arrowColor, size: 30, family: 'monospace' },
        align: 'center'
      });
    }
  }

  // Polar RZ transitions
  if (currentChannel === 4 && encodedSignal.length === settings.bitsShown * 2) {
    for (let i = 0; i < settings.bitsShown; i++) {
      const first = encodedSignal[2 * i];
      const second = encodedSignal[2 * i + 1];
      if (first !== 0 && second === 0) {
        const arrowSymbol = first > second ? '↓' : '↑';
        const xPos = i + 0.5;
        const yPos = (first + second) / 2;
        annotations.push({
          x: xPos,
          y: yPos,
          xref: 'x',
          yref: 'y2',
          text: arrowSymbol,
          showarrow: false,
          font: { color: arrowColor, size: 30, family: 'monospace' },
          align: 'center'
        });
      }
    }
  }

  // Bipolar AMI transitions
  if (currentChannel === 5) {
    for (let i = 0; i < encodedSignal.length - 1; i++) {
      const left = encodedSignal[i];
      const right = encodedSignal[i + 1];
      if (left !== right) {
        const arrowSymbol = left > right ? '↓' : '↑';
        const bitIndex = Math.floor(i / 1);
        const xPos = bitIndex + 1;
        const yPos = (left + right) / 2;
        annotations.push({
          x: xPos,
          y: yPos,
          xref: 'x',
          yref: 'y2',
          text: arrowSymbol,
          showarrow: false,
          font: { color: arrowColor, size: 30, family: 'monospace' },
          align: 'center'
        });
      }
    }
  }

  // Polar NRZ and HDB3 transitions
  if ([3, 8].includes(currentChannel)) {
    for (let i = 0; i < encodedSignal.length - 1; i++) {
      const left = encodedSignal[i];
      const right = encodedSignal[i + 1];
      if (left !== right) {
        const arrowSymbol = left > right ? '↓' : '↑';
        const xPos = i + 1;
        const yPos = (left + right) / 2;
        annotations.push({
          x: xPos,
          y: yPos,
          xref: 'x',
          yref: 'y2',
          text: arrowSymbol,
          showarrow: false,
          font: { color: arrowColor, size: 30, family: 'monospace' },
          align: 'center'
        });
      }
    }
  }

  // B8ZS transitions (show arrows at any level change)
  if (currentChannel === 9) {
    for (let i = 0; i < encodedSignal.length - 1; i++) {
      const left = encodedSignal[i];
      const right = encodedSignal[i + 1];
      if (left !== right) {
        const arrowSymbol = left > right ? '↓' : '↑';
        const xPos = i + 1;
        const yPos = (left + right) / 2;
        annotations.push({
          x: xPos,
          y: yPos,
          xref: 'x',
          yref: 'y2',
          text: arrowSymbol,
          showarrow: false,
          font: { color: arrowColor, size: 30, family: 'monospace' },
          align: 'center'
        });
      }
    }
  }

  // Pseudo Ternary transitions
  if (currentChannel === 6) {
    for (let i = 0; i < encodedSignal.length - 1; i++) {
      const left = encodedSignal[i];
      const right = encodedSignal[i + 1];
      if (left !== right) {
        const arrowSymbol = left > right ? '↓' : '↑';
        const xPos = i + 1;
        const yPos = (left + right) / 2;
        annotations.push({
          x: xPos,
          y: yPos,
          xref: 'x',
          yref: 'y2',
          text: arrowSymbol,
          showarrow: false,
          font: { color: arrowColor, size: 30, family: 'monospace' },
          align: 'center'
        });
      }
    }
  }
}

// --- HDB3 legend annotation (bottom display, true colors) ---
if (currentChannel === 8) {
  layout.annotations.push(
    {
      xref: 'paper',
      yref: 'paper',
      x: 0.5,
      y: 0.02,
      text:
        '<span style="color:#ff4d4d;font-weight:bold;">&#9632;</span> ' +
        '<span style="color:white;">Violation Bit</span>' +
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' +
        '<span style="color:#ffeb3b;font-weight:bold;">&#9632;</span> ' +
        '<span style="color:white;">Balancing Bit</span>',
      showarrow: false,
      align: 'center',
      xanchor: 'center',
      yanchor: 'bottom',
      font: { color: '#fff', size: 14, family: 'monospace' }
    }
  );
}
const shapes = [];
const vlineColor = '#888';
for (let i = 0; i <= settings.bitsShown; i++) {
  shapes.push({
    type: 'line',
    x0: i,
    x1: i,
    xref: 'x',
    y0: 0,
    y1: 2,
    yref: 'paper',
    line: {
      color: vlineColor,
      width: 1,
      dash: 'dot'
    }
  });
}
layout.shapes = shapes;

if (currentChannel === 9) {
  const bitsArr = bits.split('');
  let xPos = 0;

  for (let i = 0; i < bitsArr.length; i++) {
    let color = '#ff9933'; // default

    if (b8zsSpecialBits.violation.includes(i)) color = 'red';
    else if (b8zsSpecialBits.balancing.includes(i)) color = 'yellow';

    const yVal = encodedSignal[i];

    // left vertical
    traces.push({
      x: [xPos, xPos],
      y: [0, yVal],
      type: 'scatter',
      mode: 'lines',
      line: { color, width: 4 },
      showlegend: false,
      yaxis: 'y2'
    });

    // horizontal
    traces.push({
      x: [xPos, xPos + 1],
      y: [yVal, yVal],
      type: 'scatter',
      mode: 'lines',
      line: { color, width: 4 },
      showlegend: false,
      yaxis: 'y2'
    });

    // right vertical
    traces.push({
      x: [xPos + 1, xPos + 1],
      y: [yVal, 0],
      type: 'scatter',
      mode: 'lines',
      line: { color, width: 4 },
      showlegend: false,
      yaxis: 'y2'
    });

    xPos++;
  }
}
if (currentChannel === 9) {
  layout.annotations.push({
    xref: 'paper',
    yref: 'paper',
    x: 0.5,
    y: 0.02,
    text:
      '<span style="color:#ff4d4d;font-weight:bold;">&#9632;</span> Violation Bit' +
      '&nbsp;&nbsp;&nbsp;&nbsp;' +
      '<span style="color:#ffeb3b;font-weight:bold;">&#9632;</span> Balancing Bit',
    showarrow: false,
    align: 'center',
    font: { color: '#fff', size: 14 }
  });
}

  Plotly.newPlot('oscilloscope', traces, layout, { displayModeBar: true, responsive: true });

  // Power Spectral Density (PSD) Plot
const psdSection = document.getElementById('psdSection');
if (!psdSection) return;

if (isPsdConnected() && currentChannel !== 0 && encodedSignal) {

    psdSection.style.display = 'block';


    /* ============================================================
          SIMPLE FFT FOR PLOT.JS (No external libs required)
       ============================================================ */

    /* ============================================================
                SMOOTH PRACTICAL PSD (FFT)
   ============================================================ */

function smoothFFT(signal) {
    let N = signal.length;

    // ---- Zero-padding (critical for smoothing) ----
    let P = 4096;   // or 8192 for even smoother plot

  const fs = 1; // sample rate (samples per unit time). kept 1 for normalized frequency
  let padded = new Array(P).fill(0);
  // apply Hann window (w[n] = 0.5*(1 - cos(2πn/(N-1)))) to reduce spectral leakage
  for (let n = 0; n < N; n++) {
    const w = 0.5 * (1 - Math.cos(2 * Math.PI * n / (N - 1)));
    padded[n] = signal[n] * w;
  }

    let re = new Array(P).fill(0);
    let im = new Array(P).fill(0);

    // ---- FFT (manual DFT for now) ----
    for (let k = 0; k < P; k++) {
        for (let n = 0; n < P; n++) {
            let angle = (-2 * Math.PI * k * n) / P;
            re[k] += padded[n] * Math.cos(angle);
            im[k] += padded[n] * Math.sin(angle);
        }
    }

    // ---- Only positive spectrum and correct frequency axis + PSD scaling ----
    let psd = [];
    let freq = [];

    for (let k = 0; k < P / 2; k++) {
      // PSD scaling: (|X(k)|^2) / (fs * P)
      let mag = (re[k] * re[k] + im[k] * im[k]) / (fs * P);
      psd.push(mag);
      freq.push(k * fs / P);
    }

    return { freq, psd };
}

const { freq, psd } = smoothFFT(encodedSignal);

Plotly.newPlot("practicalPSD", [{
    x: freq,
    y: psd,
    mode: "lines",
    line: { 
        width: 2,
        simplify: false   // <-- REQUIRED for smooth curve
    }
}], {
    title: "Practical PSD (Smooth FFT)",
    paper_bgcolor: "#0f0f17",
    plot_bgcolor: "#0f0f17",
    xaxis: { title: "Frequency Index", color: "#aaa" },
    yaxis: { title: "Magnitude", color: "#ddd" }
});



    /* ============================================================
                     THEORETICAL PSD
       ============================================================ */

    /* ============================
      THEORETICAL PSD
   ============================ */

/* ============================================================
                 THEORETICAL PSD  (Corrected)
   ============================================================ */

function sinc(x) {
    return x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
}

// Line coding names for plot title
const lineCodingNames = {
    1: "Unipolar NRZ",
    2: "Unipolar RZ (50%)",
    3: "Polar NRZ",
    4: "Polar RZ (50%)",
    5: "Bipolar AMI",
    7: "Manchester",
    6: "Pseudo Ternary",
    8: "HDB3",
    9: "B8ZS"
};

let theoFreq = [];
let theoPSD = [];

for (let f = -3; f <= 3; f += 0.01) {
    theoFreq.push(f);
    let S = 0;

    switch (currentChannel) {

        case 1:  // Unipolar NRZ
            // S(f) = sinc^2(f)
            S = Math.pow(sinc(f), 2);
            break;

        case 2:  // Unipolar RZ (50% duty cycle)
            // Width = T/2 → sinc(f/2)
            S = Math.pow(sinc(f / 2), 2);
            break;

        case 3:  // Polar NRZ
            // ±A → amplitude doubles → 4 * sinc^2(f)
            S = 4 * Math.pow(sinc(f), 2);
            break;

        case 4:  // Polar RZ (50% duty)
            // Same shape as unipolar RZ, but amplitude doubled
            S = 4 * Math.pow(sinc(f / 2), 2);
            break;

        case 7:  // Manchester (correct formula)
            /*
               Standard Manchester spectrum:
               S(f) = (1/2) * sinc^2(f/2) * sin^2(πf)
               - Zero at DC
               - Much wider main lobe
            */
            S = 0.5 * Math.pow(sinc(f / 2), 2) * Math.pow(Math.sin(Math.PI * f), 2);
            break;

        case 5:  // AMI / Bipolar
            /*
               S(f) = 4 * sinc^2(f) * sin^2(πf)
               - Zero at DC
               - Strong nulls at integer frequencies
            */
            S = 4 * Math.pow(sinc(f), 2) * Math.pow(Math.sin(Math.PI * f), 2);
            break;
        case 6: // Pseudo Ternary
            /*
               S(f) = 4 * sinc^2(f) * sin^2(πf)
               - Zero at DC
               - Strong nulls at integer frequencies
            */
            S = 4 * Math.pow(sinc(f), 2) * Math.pow(Math.sin(Math.PI * f), 2);
            break;
        case 8:  // HDB3
    
            S = 4 * Math.pow(sinc(f), 2) *
            Math.pow(Math.sin(Math.PI * f), 2) *
            (1 + 0.6 * Math.cos(2 * Math.PI * f));
            break;
        case 9:  // B8ZS
            S = 4 * Math.pow(sinc(f), 2) *
            Math.pow(Math.sin(Math.PI * f), 2) *
            (1 + 0.85 * Math.cos(2 * Math.PI * f));
            break;
        default:
            S = Math.pow(sinc(f), 2);
        
    }

    theoPSD.push(S);
}

Plotly.newPlot("theoryPSD", [{
    x: theoFreq,
    y: theoPSD,
    mode: "lines",
    line: { width: 2, color: "cyan", dash: "dot" }
}], {
    title: "Theoretical PSD – " + lineCodingNames[currentChannel],
    paper_bgcolor: "#0f0f17",
    plot_bgcolor: "#0f0f17",
    xaxis: { title: "Frequency (Normalized)", color: "#aaa" },
    yaxis: { title: "PSD", color: "#ddd" }
});




} else {
    psdSection.style.display = "none";
    Plotly.purge("practicalPSD");
    Plotly.purge("theoryPSD");
}
}

// -------------------- Pre-Test & Post-Test --------------------

const pretestQuestions = [
  {
    q: "What is the purpose of line coding?",
    options: ["Convert analog signals to digital", "Convert binary data into digital signals for transmission", "Amplify weak signals", "Reduce signal bandwidth"],
    correct: 1,
    explanation: "Line coding converts binary data (0s and 1s) into digital waveforms suitable for transmission."
  },
  {
    q: "Which of the following has a DC component?",
    options: ["Polar NRZ", "Manchester", "Unipolar NRZ", "HDB3"],
    correct: 2,
    explanation: "Unipolar NRZ uses only positive voltage and hence has a DC component."
  },
  {
    q: "What does 'RZ' stand for in line coding?",
    options: ["Random Zero", "Return to Zero", "Rapid Zener", "Rising Zone"],
    correct: 1,
    explanation: "'RZ' stands for Return to Zero, meaning the signal returns to 0 within the bit period."
  },
  {
    q: "Which scheme alternates the polarity of 1s?",
    options: ["Bipolar AMI", "Polar NRZ", "Manchester", "Unipolar RZ"],
    correct: 0,
    explanation: "Bipolar AMI alternates the polarity of logic 1s to maintain zero DC level."
  },
  {
    q: "Which line coding scheme is used in Ethernet?",
    options: ["Manchester", "Unipolar NRZ", "Polar NRZ", "HDB3"],
    correct: 0,
    explanation: "Manchester encoding is used in Ethernet (10BASE-T) networks."
  },
  {
    q: "What does HDB3 stand for?",
    options: ["High Density Binary 3", "High Density Bipolar of Order 3", "Half Duplex Band 3", "High Definition Bipolar 3"],
    correct: 1,
    explanation: "HDB3 = High Density Bipolar of Order 3, an enhanced version of AMI."
  },
  {
    q: "How many consecutive zeros are replaced in HDB3?",
    options: ["2", "3", "4", "5"],
    correct: 2,
    explanation: "HDB3 replaces every sequence of four consecutive zeros with a special pattern."
  },
  {
    q: "Which scheme provides best self-synchronization?",
    options: ["Unipolar NRZ", "Polar NRZ", "Manchester", "AMI"],
    correct: 2,
    explanation: "Manchester encoding provides excellent self-synchronization due to mid-bit transitions."
  },
  {
    q: "Which line code eliminates DC component completely?",
    options: ["Unipolar NRZ", "Bipolar AMI", "Polar NRZ", "Polar RZ"],
    correct: 1,
    explanation: "Bipolar AMI eliminates DC by alternating 1s between +V and -V."
  },
  {
    q: "What type of pulse does a '0' represent in Bipolar AMI?",
    options: ["+V", "-V", "0V", "Depends on previous bit"],
    correct: 2,
    explanation: "In AMI, logic 0 is represented by 0 volts."
  }
];

const posttestQuestions = [
  {
    q: "What is the key improvement of HDB3 over AMI?",
    options: ["Reduces bandwidth", "Prevents long zero sequences", "Increases amplitude", "Simplifies receiver design"],
    correct: 1,
    explanation: "HDB3 replaces sequences of four zeros to maintain synchronization and avoid DC drift."
  },
  {
    q: "In HDB3, what does 'Violation' bit mean?",
    options: ["Opposite polarity to previous 1", "Same polarity as previous 1", "Always positive pulse", "Always negative pulse"],
    correct: 1,
    explanation: "Violation bit uses the same polarity as the previous 1 pulse."
  },
  {
    q: "Which bit in HDB3 ensures DC balance?",
    options: ["Violation bit", "Balancing bit", "Zero bit", "Transition bit"],
    correct: 1,
    explanation: "Balancing bit (B) maintains DC balance depending on pulse count parity."
  },
  {
    q: "What happens when number of non-zero pulses is even before 4 zeros?",
    options: ["Use 000V pattern", "Use B00V pattern", "Use V000 pattern", "No replacement"],
    correct: 1,
    explanation: "For even count, HDB3 replaces 0000 with B00V to maintain alternating polarity."
  },
  {
    q: "Which encoding uses mid-bit transitions to encode data?",
    options: ["Unipolar NRZ", "Manchester", "Duo Binary", "Polar NRZ"],
    correct: 1,
    explanation: "Manchester encoding has transitions in the middle of each bit period."
  },
  {
    q: "In Duo Binary coding, the output depends on:",
    options: ["Only current bit", "Previous output", "Next bit", "Clock signal only"],
    correct: 1,
    explanation: "Duo Binary output depends on the current bit and previous output, creating correlation."
  },
  {
    q: "Which encoding provides 3 voltage levels?",
    options: ["Polar NRZ", "Duo Binary", "Manchester", "Unipolar RZ"],
    correct: 1,
    explanation: "Duo Binary encoding uses +V, 0, and -V levels."
  },
  {
    q: "What is the main advantage of Manchester coding?",
    options: ["No DC component & self-synchronizing", "Low bandwidth", "Simple implementation", "Low power consumption"],
    correct: 0,
    explanation: "Manchester is DC-free and self-synchronizing due to guaranteed transitions."
  },
  {
    q: "Which scheme is most efficient for long-distance telecommunication systems?",
    options: ["HDB3", "Unipolar RZ", "Manchester", "Polar NRZ"],
    correct: 0,
    explanation: "HDB3 is used in E1 systems for long-distance transmission due to DC-free and sync properties."
  },
  {
    q: "In HDB3, how are four zeros replaced when the pulse count is odd?",
    options: ["000V", "B00V", "0B0V", "V000"],
    correct: 0,
    explanation: "When count is odd, HDB3 replaces 0000 with 000V (only violation bit)."
  }
];

// Function to display questions
function displayTestQuestions(type) {
  const container = document.getElementById(type + "Content");
  const data = type === "pretest" ? pretestQuestions : posttestQuestions;
  let html = "";

  data.forEach((q, i) => {
    html += `
      <div class="question-block">
        <p><b>Q${i + 1}. ${q.q}</b></p>
        ${q.options
          .map(
            (opt, j) =>
              `<label class="option"><input type="radio" name="${type}_q${i}" value="${j}"> ${opt}</label><br>`
          )
          .join("")}
        <div id="${type}_explain_${i}" class="explanation" style="display:none; margin-top:5px; color:#ddd; background:#1c1c28; padding:6px; border-radius:5px;"></div>
        <hr>
      </div>`;
  });

  container.innerHTML = html;
}

// Function to handle submit
function submitTest(type) {
  const data = type === "pretest" ? pretestQuestions : posttestQuestions;
  let score = 0;

  data.forEach((q, i) => {
    const selected = document.querySelector(`input[name="${type}_q${i}"]:checked`);
    const expDiv = document.getElementById(`${type}_explain_${i}`);
    if (selected) {
      const ans = parseInt(selected.value);
      if (ans === q.correct) {
        score++;
        expDiv.innerHTML = `<b style="color:#4eff4e;">✔ Correct!</b> ${q.explanation}`;
      } else {
        expDiv.innerHTML = `<b style="color:#ff6666;">✘ Incorrect.</b> Correct Answer: <b>${q.options[q.correct]}</b><br>${q.explanation}`;
      }
    } else {
      expDiv.innerHTML = `<b style="color:#ffcc00;">⚠ Not Answered</b><br>Correct Answer: <b>${q.options[q.correct]}</b><br>${q.explanation}`;
    }
    expDiv.style.display = "block";
  });

  alert(`You scored ${score}/${data.length}`);
}

// Initialize tests
document.addEventListener("DOMContentLoaded", () => {
  displayTestQuestions("pretest");
  displayTestQuestions("posttest");
});

// Initialize dial interactions
setupDialInteraction('bitRateDial', 'bitRatePointer', 4, 32, 1, (value) => {
  channelSettings[currentChannel].bitsShown = value;
  document.getElementById('bitRateValue').textContent = value + ' bits';
  updateDialPointer('bitRateDial', 'bitRatePointer', value, 4, 32);
  drawOscilloscope();
});

setupDialInteraction('amplitudeDial', 'amplitudePointer', 1, 10, 1, (value) => {
  channelSettings[currentChannel].amplitude = value;
  document.getElementById('amplitudeValue').textContent = value.toFixed(1) + ' V';
  updateDialPointer('amplitudeDial', 'amplitudePointer', value, 1, 10);
  drawOscilloscope();
});

updateControlsDisplay();
drawOscilloscope();

// Quiz functionality
const quizQuestions = [
  {
    question: "What does HDB3 stand for?",
    options: [
      "High Density Bipolar of order 3",
      "High Distribution Binary 3",
      "Heavy Data Bits of order 3",
      "High Density Binary Poly 3"
    ],
    correct: 0
  },
  {
    question: "What is the main problem HDB3 solves compared to AMI?",
    options: [
      "Reduces bandwidth",
      "Prevents long sequences of zeros",
      "Increases signal amplitude",
      "Eliminates need for synchronization"
    ],
    correct: 1
  },
  {
    question: "What happens when 4 consecutive zeros occur in HDB3?",
    options: [
      "The signal remains zero",
      "They are replaced with a special code including a violation or balancing bit",
      "The entire sequence is repeated",
      "An error is generated"
    ],
    correct: 1
  },
  {
    question: "In HDB3, a Violation bit (V) maintains the same polarity as:",
    options: [
      "The previous zero",
      "The previous pulse of opposite polarity",
      "The previous pulse of the same polarity",
      "An arbitrary polarity"
    ],
    correct: 2
  },
  {
    question: "What is a Balancing bit (B) used for in HDB3?",
    options: [
      "To replace every zero bit",
      "To maintain DC balance when odd number of 1s before 4 zeros",
      "To increase signal strength",
      "To reduce transmission errors"
    ],
    correct: 1
  },
  {
    question: "Which communication standard uses HDB3 encoding?",
    options: [
      "T1 carrier systems",
      "E1 carrier systems",
      "Ethernet",
      "Wi-Fi"
    ],
    correct: 1
  },
  {
    question: "Does HDB3 have a DC component?",
    options: [
      "Yes, always",
      "Yes, sometimes",
      "No",
      "Depends on the input"
    ],
    correct: 2
  },
  {
    question: "What is the main advantage of HDB3 in terms of synchronization?",
    options: [
      "It requires no synchronization",
      "It maintains synchronization better than AMI due to controlled pulse density",
      "It automatically adjusts to any clock speed",
      "It eliminates clock recovery requirements"
    ],
    correct: 1
  }
];

let currentQuizIndex = 0;
let quizScore = 0;
let userAnswers = [];

function initializeQuiz() {
  currentQuizIndex = 0;
  quizScore = 0;
  userAnswers = [];
  displayQuizQuestion();
}

function displayQuizQuestion() {
  const quizContent = document.getElementById('quizContent');
  
  if (currentQuizIndex >= quizQuestions.length) {
    showQuizResults();
    return;
  }
  
  const question = quizQuestions[currentQuizIndex];
  let html = `
    <div class="quiz-question">
      <div class="question-number">Question ${currentQuizIndex + 1} of ${quizQuestions.length}</div>
      <h3>${question.question}</h3>
      <div class="quiz-options">
  `;
  
  question.options.forEach((option, index) => {
    html += `
      <div class="quiz-option">
        <input type="radio" name="answer" value="${index}" id="option${index}">
        <label for="option${index}">${option}</label>
      </div>
    `;
  });
  
  html += `
      </div>
      <div class="quiz-navigation">
        ${currentQuizIndex > 0 ? `<button class="quiz-btn quiz-btn-prev" onclick="previousQuestion()">← Previous</button>` : ''}
        <button class="quiz-btn quiz-btn-next" onclick="nextQuestion()">Next →</button>
      </div>
    </div>
  `;
  
  quizContent.innerHTML = html;
  
  // Restore previous answer if exists
  if (userAnswers[currentQuizIndex] !== undefined) {
    document.querySelector(`input[value="${userAnswers[currentQuizIndex]}"]`).checked = true;
  }
}

function nextQuestion() {
  const selected = document.querySelector('input[name="answer"]:checked');
  if (!selected) {
    alert('Please select an answer before proceeding.');
    return;
  }
  
  userAnswers[currentQuizIndex] = parseInt(selected.value);
  currentQuizIndex++;
  displayQuizQuestion();
}

function previousQuestion() {
  const selected = document.querySelector('input[name="answer"]:checked');
  if (selected) {
    userAnswers[currentQuizIndex] = parseInt(selected.value);
  }
  
  currentQuizIndex--;
  displayQuizQuestion();
}

function showQuizResults() {
  const selected = document.querySelector('input[name="answer"]:checked');
  if (selected) {
    userAnswers[currentQuizIndex] = parseInt(selected.value);
  }
  
  // Calculate score
  quizScore = 0;
  userAnswers.forEach((answer, index) => {
    if (answer === quizQuestions[index].correct) {
      quizScore++;
    }
  });
  
  const percentage = Math.round((quizScore / quizQuestions.length) * 100);
  
  document.getElementById('quizContent').innerHTML = '';
  document.getElementById('finalScore').textContent = quizScore;
  document.getElementById('totalQuestions').textContent = quizQuestions.length;
  document.getElementById('percentage').textContent = percentage;
  document.getElementById('quizResults').style.display = 'block';
}

function restartQuiz() {
  document.getElementById('quizResults').style.display = 'none';
  initializeQuiz();
}

// Initialize quiz when page loads (if on quiz page)
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('quiz')) {
    initializeQuiz();
  }
});

// Also initialize quiz when navigating to quiz page
document.addEventListener('click', (e) => {
  if (e.target.dataset.page === 'quiz') {
    setTimeout(() => {
      const quizContent = document.getElementById('quizContent');
      if (quizContent && quizContent.innerHTML === '') {
        initializeQuiz();
      }
    }, 50);
  }
});
