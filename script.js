const video = document.getElementById("camera");
const canvas = document.getElementById("art");
const ctx = canvas.getContext("2d");
const waveCanvas = document.getElementById("wave");
const wctx = waveCanvas.getContext("2d");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const infoToggleBtn = document.getElementById("infoToggle");
const infoContent = document.getElementById("infoContent");
const bpmDisplay = document.getElementById("bpmDisplay");
const instructions = document.getElementById("instructions");

canvas.width = 225; canvas.height = 160;
waveCanvas.width = 225; waveCanvas.height = 160;

let stream = null,
  measuring = false,
  lastAvg = 0,
  pulseTimes = [],
  signalBuffer = [],
  idleFrames = 0;

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function drawPattern(bpm = 72) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  // Subtle science pattern: calm or active based on BPM
  ctx.strokeStyle = "#5faaffcc";
  ctx.lineWidth = 2;
  for (let i = 0; i <= canvas.width; i += 14) {
    let y =
      canvas.height / 2 +
      Math.sin(i / 21 + bpm / 25 + performance.now() / 340) * (bpm / 7 + 22);
    ctx.beginPath();
    ctx.moveTo(i, canvas.height / 2);
    ctx.lineTo(i, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.font = "bold 28px Inter,Arial";
  ctx.fillStyle = "#ffe29e";
  ctx.fillText(bpm < 70 ? "Solid" : bpm < 100 ? "Liquid" : "Gas", 54, 90);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawWaveform() {
  wctx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
  wctx.save();
  wctx.strokeStyle = "#ffd86f";
  wctx.lineWidth = 2;
  wctx.beginPath();
  let N = Math.min(signalBuffer.length, 48);
  for (let i = 0; i < N; i++) {
    let x = (i / N) * waveCanvas.width;
    let y = waveCanvas.height / 2 - (signalBuffer[signalBuffer.length - N + i] - 120) * 2.7;
    y = clamp(y, 20, waveCanvas.height - 20);
    if (i === 0) wctx.moveTo(x, y);
    else wctx.lineTo(x, y);
  }
  wctx.stroke();
  wctx.restore();
}

function animate(bpm) {
  if (!measuring) return;
  drawPattern(bpm || 72);
  drawWaveform();
  requestAnimationFrame(() => animate(bpm));
}

function processFrame() {
  if (!measuring) return;
  ctx.drawImage(video, 0, 0, 12, 12);
  const img = ctx.getImageData(0, 0, 12, 12),
    d = img.data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) {
    sum += d[i + 1];
  }
  let avg = sum / (d.length / 4);
  signalBuffer.push(avg);
  if (signalBuffer.length > 50) signalBuffer.shift();
  let smoothAvg =
    signalBuffer.slice(-6).reduce((a, b) => a + b, 0) / Math.min(signalBuffer.length, 6);
  if (Math.abs(lastAvg - smoothAvg) > 25) {
    lastAvg = smoothAvg;
    requestAnimationFrame(processFrame);
    return;
  }
  if (lastAvg < smoothAvg - 3.8) {
    let now = Date.now();
    if (pulseTimes.length === 0 || now - pulseTimes[pulseTimes.length - 1] > 360) {
      pulseTimes.push(now);
      if (pulseTimes.length > 12) pulseTimes.shift();
      if (pulseTimes.length > 2) {
        let intervals = pulseTimes.slice(1).map((t, i) => t - pulseTimes[i]);
        let avgIntv = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        let bpm = Math.round(60000 / avgIntv);
        bpm = clamp(bpm, 48, 160);
        bpmDisplay.textContent = `Pulse: ${bpm} BPM`;
        animate(bpm);
      }
    }
  }
  lastAvg = smoothAvg;
  requestAnimationFrame(processFrame);
}

async function startPulseArt() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 320, height: 240 },
    });
    video.srcObject = stream;
    measuring = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    bpmDisplay.textContent = "Detecting Pulse...";
    instructions.textContent =
      "Hold your finger fully over the camera. Remain still for 15 seconds. Use light if needed.";
    await video.play();
    animate(73);
    processFrame();
  } catch (error) {
    bpmDisplay.textContent = "Camera unavailable. Try again.";
    measuring = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    instructions.textContent = "Camera not found. Make sure your device has a working camera.";
  }
}

function stopPulseArt() {
  measuring = false;
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  bpmDisplay.textContent = "Pulse: -- BPM";
  instructions.textContent = "Place your finger gently on your phone's front camera and tap Start.";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  wctx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
  startBtn.disabled = false;
  stopBtn.disabled = true;
}

startBtn.addEventListener("click", startPulseArt);
stopBtn.addEventListener("click", stopPulseArt);

infoToggleBtn.addEventListener("click", function () {
  const expanded = infoToggleBtn.getAttribute("aria-expanded") === "true";
  infoContent.hidden = expanded;
  infoToggleBtn.setAttribute("aria-expanded", (!expanded).toString());
  infoToggleBtn.textContent = expanded ? "Show Scientific Info" : "Hide Scientific Info";
});
