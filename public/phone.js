const video = document.querySelector("#video");
const tokenInput = document.querySelector("#token");
const statusEl = document.querySelector("#status");
const lastEl = document.querySelector("#last");
const startBtn = document.querySelector("#start");
const stopBtn = document.querySelector("#stop");
let stream, detector, running = false, lastPayload = "", lastSentAt = 0;
async function sendPayload(payload) {
  const now = Date.now();
  if (payload === lastPayload && now - lastSentAt < 30000) return;
  const res = await fetch("/api/qr", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenInput.value}` },
    body: JSON.stringify({ payload })
  });
  if (!res.ok) throw new Error("ارسال ناموفق؛ توکن یا اتصال را بررسی کن.");
  const result = await res.json();
  lastPayload = payload; lastSentAt = now;
  lastEl.textContent = payload;
  statusEl.textContent = result.duplicate ? "این QR اخیراً دریافت شده بود." : "QR جدید دریافت و ذخیره شد.";
}
async function scanLoop() {
  if (!running) return;
  try {
    if (video.readyState >= 2) {
      const codes = await detector.detect(video);
      if (codes.length) await sendPayload(codes[0].rawValue);
    }
  } catch (e) { statusEl.textContent = e.message; }
  requestAnimationFrame(scanLoop);
}
startBtn.onclick = async () => {
  try {
    if (!("BarcodeDetector" in window)) throw new Error("مرورگر این گوشی BarcodeDetector را پشتیبانی نمی‌کند؛ از Chrome به‌روز استفاده کن.");
    if (!tokenInput.value || tokenInput.value.length < 24) throw new Error("توکن مدیریتی معتبر را وارد کن.");
    detector = new BarcodeDetector({ formats: ["qr_code"] });
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    video.srcObject = stream; await video.play();
    running = true; startBtn.disabled = true; stopBtn.disabled = false;
    statusEl.textContent = "دوربین فعال است؛ QR را در کادر قرار بده.";
    scanLoop();
  } catch (e) { statusEl.textContent = e.message; }
};
stopBtn.onclick = () => {
  running = false; stream?.getTracks().forEach(t => t.stop());
  video.srcObject = null; startBtn.disabled = false; stopBtn.disabled = true;
  statusEl.textContent = "دوربین متوقف شد.";
};
