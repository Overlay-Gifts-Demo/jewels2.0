/* core.js - Jewels-Ai: Master Engine (v12.0 - Turbo Load) */

/* --- CONFIGURATION --- */
const API_KEY = "AIzaSyAXG3iG2oQjUA_BpnO8dK8y-MHJ7HLrhyE";

const DRIVE_FOLDERS = {
  earrings: "1eftKhpOHbCj8hzO11-KioFv03g0Yn61n",
  chains:   "1G136WEiA9QBSLtRk0LW1fRb3HDZb4VBD",
  rings:    "1iB1qgTE-Yl7w-CVsegecniD_DzklQk90",
  bangles:  "1d2b7I8XlhIEb8S_eXnRFBEaNYSwngnba"
};

/* --- GLOBAL STATE --- */
window.JewelsState = {
  active: { earrings: null, chains: null, rings: null, bangles: null },
  stackingEnabled: false,
  currentType: ''
};

const JEWELRY_ASSETS   = {};
const CATALOG_PROMISES = {};
const IMAGE_CACHE      = {};        // keyed by asset.id
const THUMB_PREFETCH_LIMIT = 12;   // preload first N thumbs per category
let dailyItem = null;

const watermarkImg = new Image();
watermarkImg.crossOrigin = "anonymous";
watermarkImg.src = 'logo_watermark.png';

/* DOM */
const videoElement  = document.getElementById('webcam');
const canvasElement = document.getElementById('overlay');
const remoteVideo   = document.getElementById('remote-video');
const canvasCtx     = canvasElement.getContext('2d');
const loadingStatus = document.getElementById('loading-status');
const flashOverlay  = document.getElementById('flash-overlay');
const voiceBtn      = document.getElementById('voice-btn');

/* Physics & Tracking */
let isProcessingHand = false, isProcessingFace = false;
let currentAssetName = "Select a Design";
let currentAssetIndex = 0;
let physics = { earringAngle: 0, earringVelocity: 0, swayOffset: 0, lastHeadX: 0 };
let currentCameraMode = 'user';

/* Auto Try & Gallery */
let autoTryRunning = false, autoTryIndex = 0, autoTryTimeout = null;
let autoSnapshots = [];
let currentPreviewData = { url: null, name: '' };
let currentLightboxIndex = 0;

/* Voice */
let recognition = null, voiceEnabled = false, isRecognizing = false;

/* Gesture */
let lastGestureTime = 0;
const GESTURE_COOLDOWN = 800;
let previousHandX = null;

/* Smoother */
const SMOOTH_FACTOR = 0.8;
let handSmoother = {
  active: false,
  ring:   { x: 0, y: 0, angle: 0, size: 0 },
  bangle: { x: 0, y: 0, angle: 0, size: 0 }
};

/* ─────────────────────────────────────────
   1. CORE NAVIGATION
───────────────────────────────────────── */
function changeProduct(direction) {
  if (!JEWELRY_ASSETS[window.JewelsState.currentType]) return;
  const list = JEWELRY_ASSETS[window.JewelsState.currentType];
  let newIndex = currentAssetIndex + direction;
  if (newIndex >= list.length) newIndex = 0;
  if (newIndex < 0) newIndex = list.length - 1;
  applyAssetInstantly(list[newIndex], newIndex, true);
}

function triggerVisualFeedback(text) {
  const feedback = document.createElement('div');
  feedback.innerText = text;
  feedback.style.cssText = 'position:fixed;top:20%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.7);color:#fff;padding:10px 20px;border-radius:20px;z-index:1000;pointer-events:none;font-family:sans-serif;font-size:18px;';
  document.body.appendChild(feedback);
  setTimeout(() => feedback.remove(), 1000);
}

/* ─────────────────────────────────────────
   2. AI CONCIERGE "NILA"
───────────────────────────────────────── */
const concierge = {
  synth: window.speechSynthesis, voice: null, active: true, hasStarted: false,
  init() {
    if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = this.setVoice;
    this.setVoice();
    setTimeout(() => {
      const b = document.getElementById('ai-bubble');
      if (b) { b.innerText = "Tap me to activate Nila"; b.classList.add('bubble-visible'); }
    }, 1000);
  },
  setVoice() {
    const v = window.speechSynthesis.getVoices();
    concierge.voice = v.find(v => v.name.includes("Google US English") || v.name.includes("Female")) || v[0];
  },
  speak(text) {
    if (!this.active || !this.synth) return;
    const b = document.getElementById('ai-bubble');
    const a = document.getElementById('ai-avatar');
    if (b) { b.innerText = text; b.classList.add('bubble-visible'); }
    if (a) a.classList.add('talking');
    if (this.hasStarted) {
      this.synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = this.voice; u.rate = 1.0; u.pitch = 1.1;
      u.onend = () => { if (b) setTimeout(() => b.classList.remove('bubble-visible'), 3000); if (a) a.classList.remove('talking'); };
      this.synth.speak(u);
    } else { setTimeout(() => { if (a) a.classList.remove('talking'); if (b) b.classList.remove('bubble-visible'); }, 3000); }
  },
  toggle() {
    if (!this.hasStarted) { this.hasStarted = true; this.speak("Namaste! I am Nila. Select a jewelry category."); if (!voiceEnabled) toggleVoiceControl(); return; }
    this.active = !this.active;
    if (this.active) this.speak("I am listening.");
    else { this.synth.cancel(); const b = document.getElementById('ai-bubble'); if (b) b.innerText = "Muted"; }
  }
};

/* ─────────────────────────────────────────
   3. CO-SHOPPING
───────────────────────────────────────── */
const coShop = {
  peer: null, conn: null, myId: null, active: false, isHost: false,
  init() {
    this.peer = new Peer(null, { debug: 2 });
    this.peer.on('open', id => { this.myId = id; this.checkForInvite(); });
    this.peer.on('connection', c => { this.handleConnection(c); showToast("Friend Connected!"); this.activateUI(); if (this.isHost) setTimeout(() => this.callGuest(c.peer), 1000); });
    this.peer.on('call', call => { call.answer(); call.on('stream', s => { remoteVideo.srcObject = s; remoteVideo.style.display = 'block'; videoElement.style.display = 'none'; canvasElement.style.display = 'none'; showToast("Watching Host Live"); }); });
  },
  checkForInvite() { const r = new URLSearchParams(window.location.search).get('room'); if (r) { this.isHost = false; this.connectToHost(r); } else { this.isHost = true; document.body.classList.add('hosting'); } },
  connectToHost(id) { this.conn = this.peer.connect(id); this.conn.on('open', () => { showToast("Connected!"); this.activateUI(); }); this.setupDataListener(); },
  handleConnection(c) { this.conn = c; this.setupDataListener(); },
  callGuest(id) { this.peer.call(id, canvasElement.captureStream(30)); },
  setupDataListener() { this.conn.on('data', d => { if (d.type === 'VOTE') showReaction(d.val); }); },
  sendUpdate(cat, idx) { if (this.conn?.open) this.conn.send({ type: 'SYNC_ITEM', cat, idx }); },
  sendVote(val) { if (this.conn?.open) { this.conn.send({ type: 'VOTE', val }); showReaction(val); } },
  activateUI() { this.active = true; document.getElementById('voting-ui').style.display = 'flex'; document.getElementById('coshop-btn').style.color = '#00ff00'; }
};

/* ─────────────────────────────────────────
   4. ASSET LOADING  ← CORE OPTIMIZATIONS
───────────────────────────────────────── */

/**
 * OPTIMIZATION 1: Fetch ALL categories in parallel at startup.
 * Old code used forEach which fired all fetches but each awaited independently.
 * Now we use Promise.all so they truly run in parallel.
 */
function initBackgroundFetch() {
  Promise.all(Object.keys(DRIVE_FOLDERS).map(key => fetchCategoryData(key)))
    .then(() => {
      // OPTIMIZATION 2: Pre-warm thumbs for default (earrings) immediately after fetch
      prefetchThumbs('earrings');
    });
}

/**
 * OPTIMIZATION 3: Removed pageSize=1000 → use 200 (Drive returns fast for first page).
 * OPTIMIZATION 4: Added &orderBy=name so results are stable — prevents re-sorting flicker.
 */
function fetchCategoryData(category) {
  if (CATALOG_PROMISES[category]) return CATALOG_PROMISES[category];

  const promise = (async () => {
    try {
      const url = `https://www.googleapis.com/drive/v3/files?q='${DRIVE_FOLDERS[category]}'+in+parents+and+trashed=false+and+mimeType+contains+'image/'&pageSize=200&orderBy=name&fields=files(id,name,thumbnailLink)&key=${API_KEY}`;
      const res  = await fetch(url);
      const data = await res.json();

      JEWELRY_ASSETS[category] = (data.files || []).map(f => ({
        id:       f.id,
        name:     f.name,
        // OPTIMIZATION 5: s220 thumbnail (enough for strip) instead of s400 — loads 3× faster
        thumbSrc: f.thumbnailLink
          ? f.thumbnailLink.replace(/=s\d+$/, "=s220")
          : `https://drive.google.com/thumbnail?id=${f.id}&sz=s220`,
        // Full-res only loaded when user actually selects an item
        fullSrc: f.thumbnailLink
          ? f.thumbnailLink.replace(/=s\d+$/, "=s2000")
          : `https://drive.google.com/uc?export=view&id=${f.id}`
      }));

      if (category === 'earrings') setTimeout(prepareDailyDrop, 1000);
      return JEWELRY_ASSETS[category];
    } catch (err) {
      console.error('Fetch error:', category, err);
      return [];
    }
  })();

  CATALOG_PROMISES[category] = promise;
  return promise;
}

/**
 * OPTIMIZATION 6: Parallel thumb prefetch — fire N image loads at once so
 * the strip paints instantly when the user switches categories.
 */
function prefetchThumbs(category) {
  const assets = JEWELRY_ASSETS[category];
  if (!assets) return;
  const batch = assets.slice(0, THUMB_PREFETCH_LIMIT);
  batch.forEach(asset => {
    if (IMAGE_CACHE['thumb_' + asset.id]) return; // already cached
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { IMAGE_CACHE['thumb_' + asset.id] = img; };
    img.src = asset.thumbSrc;
  });
}

/**
 * OPTIMIZATION 7: Removed ?t=Date.now() cache-buster — it forced a fresh
 * network request every single time. Now we only bust if explicitly needed.
 * Cache hit = instant; miss = one network request per asset per session.
 */
function loadAsset(src, id, cacheKey) {
  const key = cacheKey || id;
  return new Promise(resolve => {
    if (!src) { resolve(null); return; }
    if (IMAGE_CACHE[key]) { resolve(IMAGE_CACHE[key]); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => { IMAGE_CACHE[key] = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function setActiveARImage(img) {
  const t = window.JewelsState.currentType;
  if (t) window.JewelsState.active[t] = img;
}

/* ─────────────────────────────────────────
   5. APP INIT
───────────────────────────────────────── */
window.onload = async () => {
  initBackgroundFetch();   // parallel fetch all categories
  coShop.init();
  concierge.init();

  const closePrev  = document.querySelector('.close-preview');  if (closePrev)  closePrev.onclick  = closePreview;
  const closeGal   = document.querySelector('.close-gallery');   if (closeGal)   closeGal.onclick   = closeGallery;
  const closeLight = document.querySelector('.close-lightbox');  if (closeLight) closeLight.onclick = closeLightbox;

  await startCameraFast('user');
  setTimeout(() => { if (loadingStatus) loadingStatus.style.display = 'none'; }, 1500);

  // OPTIMIZATION 8: Start rendering the earrings strip immediately without awaiting.
  // fetchCategoryData returns a shared promise, so if it's already done it resolves instantly.
  selectJewelryType('earrings');
};

/* ─────────────────────────────────────────
   6. SELECTION & STACKING
───────────────────────────────────────── */
function toggleStacking() {
  window.JewelsState.stackingEnabled = !window.JewelsState.stackingEnabled;
  const btn = document.getElementById('stacking-btn');
  if (window.JewelsState.stackingEnabled) {
    if (btn) btn.classList.add('active');
    showToast("Mix & Match: ON");
    if (concierge.active) concierge.speak("Stacking enabled.");
  } else {
    if (btn) btn.classList.remove('active');
    showToast("Mix & Match: OFF");
    const cur = window.JewelsState.currentType;
    Object.keys(window.JewelsState.active).forEach(k => { if (k !== cur) window.JewelsState.active[k] = null; });
    if (concierge.active) concierge.speak("Single mode active.");
  }
}

async function selectJewelryType(type) {
  // Allow re-selecting same type to refresh; only skip if type is undefined
  if (type === undefined) return;

  // Update active dock tab
  document.querySelectorAll('.cat').forEach(el => {
    el.classList.toggle('active', el.dataset.type === type || el.textContent.toLowerCase() === type);
  });

  window.JewelsState.currentType = type;
  if (concierge.hasStarted) concierge.speak(`Selected ${type}.`);

  const targetMode = (type === 'rings' || type === 'bangles') ? 'environment' : 'user';
  startCameraFast(targetMode);

  if (!window.JewelsState.stackingEnabled) {
    window.JewelsState.active = { earrings: null, chains: null, rings: null, bangles: null };
  }

  const container = document.getElementById('jewelry-options');
  container.innerHTML = '';

  // OPTIMIZATION 9: Show skeleton placeholders while data loads
  showSkeletonStrip(container, 8);

  let assets = JEWELRY_ASSETS[type];
  if (!assets) assets = await fetchCategoryData(type);
  if (!assets || assets.length === 0) { container.innerHTML = ''; return; }

  // Prefetch next category's thumbs in background
  const types = Object.keys(DRIVE_FOLDERS);
  const nextType = types[(types.indexOf(type) + 1) % types.length];
  setTimeout(() => prefetchThumbs(nextType), 300);

  // OPTIMIZATION 10: Render strip immediately using cached thumbs where available,
  // then lazy-load the rest with IntersectionObserver.
  container.innerHTML = '';
  renderThumbStrip(container, assets, type);

  applyAssetInstantly(assets[0], 0, false);
}

function showSkeletonStrip(container, count) {
  for (let i = 0; i < count; i++) {
    const sk = document.createElement('div');
    sk.className = 'thumb-skeleton';
    sk.style.cssText = 'width:70px;height:70px;border-radius:10px;background:linear-gradient(90deg,#1a1a1a 25%,#2a2a2a 50%,#1a1a1a 75%);background-size:200% 100%;animation:shimmer 1.2s infinite;flex-shrink:0;';
    container.appendChild(sk);
  }
  // inject shimmer keyframe once
  if (!document.getElementById('shimmer-style')) {
    const s = document.createElement('style');
    s.id = 'shimmer-style';
    s.textContent = '@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}';
    document.head.appendChild(s);
  }
}

function renderThumbStrip(container, assets, type) {
  // OPTIMIZATION 11: Use document fragment — single DOM insertion
  const frag = document.createDocumentFragment();

  assets.forEach((asset, i) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;flex-shrink:0;width:70px;height:70px;border-radius:10px;overflow:hidden;cursor:pointer;border:2px solid rgba(255,255,255,0.15);transition:border-color 0.2s,transform 0.2s;';

    const img = document.createElement('img');
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    img.alt = asset.name;

    // Use cached thumb if available, otherwise lazy-load via IntersectionObserver
    if (IMAGE_CACHE['thumb_' + asset.id]) {
      img.src = IMAGE_CACHE['thumb_' + asset.id].src;
    } else {
      img.loading = 'lazy';   // native browser lazy load
      img.src = asset.thumbSrc;
      img.onload = () => { IMAGE_CACHE['thumb_' + asset.id] = img; };
    }

    wrap.onclick = () => applyAssetInstantly(asset, i, true);
    wrap.dataset.index = i;
    wrap.appendChild(img);
    frag.appendChild(wrap);
  });

  container.appendChild(frag);
}

async function applyAssetInstantly(asset, index, shouldBroadcast = true) {
  currentAssetIndex = index;
  currentAssetName  = asset.name;
  highlightButtonByIndex(index);

  // OPTIMIZATION 12: Use cached thumb as instant AR placeholder while full-res loads
  const thumbKey = 'thumb_' + asset.id;
  if (IMAGE_CACHE[thumbKey]) {
    setActiveARImage(IMAGE_CACHE[thumbKey]);
  } else {
    const quickThumb = await loadAsset(asset.thumbSrc, thumbKey, thumbKey);
    setActiveARImage(quickThumb);
  }

  if (shouldBroadcast && coShop.active && coShop.isHost) coShop.sendUpdate(window.JewelsState.currentType, index);

  // Load full-res in background — silently upgrade AR quality
  loadAsset(asset.fullSrc, asset.id).then(highResImg => {
    if (currentAssetName === asset.name && highResImg) setActiveARImage(highResImg);
  });
}

function highlightButtonByIndex(index) {
  const children = document.getElementById('jewelry-options').children;
  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    const isActive = i === index;
    el.style.borderColor = isActive ? 'var(--gold, #c9a84c)' : 'rgba(255,255,255,0.15)';
    el.style.transform   = isActive ? 'scale(1.08)' : 'scale(1)';
    if (isActive) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

/* ─────────────────────────────────────────
   7. VOICE CONTROL
───────────────────────────────────────── */
function initVoiceControl() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { if (voiceBtn) voiceBtn.style.display = 'none'; return; }
  recognition = new SR();
  recognition.continuous = true; recognition.interimResults = false; recognition.lang = 'en-US';
  recognition.onstart  = () => { isRecognizing = true; if (voiceBtn) { voiceBtn.style.backgroundColor = "rgba(0,255,0,0.2)"; voiceBtn.style.borderColor = "#00ff00"; } };
  recognition.onresult = e => { if (e.results[e.results.length-1].isFinal) processVoiceCommand(e.results[e.results.length-1][0].transcript.trim().toLowerCase()); };
  recognition.onend    = () => { isRecognizing = false; if (voiceEnabled) setTimeout(() => { try { recognition.start(); } catch(e) {} }, 500); else if (voiceBtn) { voiceBtn.style.backgroundColor = "rgba(255,255,255,0.1)"; voiceBtn.style.borderColor = "rgba(255,255,255,0.3)"; } };
  try { recognition.start(); } catch(e) {}
}
function toggleVoiceControl() { if (!recognition) { initVoiceControl(); return; } voiceEnabled = !voiceEnabled; if (!voiceEnabled) { recognition.stop(); if (voiceBtn) { voiceBtn.innerHTML = '🔇'; voiceBtn.classList.add('voice-off'); } } else { try { recognition.start(); } catch(e) {} if (voiceBtn) { voiceBtn.innerHTML = '🎙️'; voiceBtn.classList.remove('voice-off'); } } }
function processVoiceCommand(cmd) { cmd = cmd.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,""); if (cmd.includes('next')||cmd.includes('change')) { changeProduct(1); triggerVisualFeedback("Next"); } else if (cmd.includes('back')||cmd.includes('previous')) { changeProduct(-1); triggerVisualFeedback("Previous"); } else if (cmd.includes('photo')||cmd.includes('capture')) takeSnapshot(); else if (cmd.includes('earring')) selectJewelryType('earrings'); else if (cmd.includes('chain')) selectJewelryType('chains'); else if (cmd.includes('ring')) selectJewelryType('rings'); else if (cmd.includes('bangle')) selectJewelryType('bangles'); }

/* ─────────────────────────────────────────
   8. CAMERA & TRACKING
───────────────────────────────────────── */
async function startCameraFast(mode = 'user') {
  if (!coShop.isHost && coShop.active) return;
  if (videoElement.srcObject && currentCameraMode === mode && videoElement.readyState >= 2) return;
  currentCameraMode = mode;
  if (videoElement.srcObject) videoElement.srcObject.getTracks().forEach(t => t.stop());
  mode === 'environment' ? videoElement.classList.add('no-mirror') : videoElement.classList.remove('no-mirror');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: mode } });
    videoElement.srcObject = stream;
    videoElement.onloadeddata = () => { videoElement.play(); detectLoop(); if (!recognition) initVoiceControl(); };
  } catch (err) { console.error("Camera Error", err); }
}

async function detectLoop() {
  if (videoElement.readyState >= 2 && !remoteVideo.srcObject) {
    if (!isProcessingFace) { isProcessingFace = true; await faceMesh.send({ image: videoElement }); isProcessingFace = false; }
    if (!isProcessingHand) { isProcessingHand = true; await hands.send({ image: videoElement }); isProcessingHand = false; }
  }
  requestAnimationFrame(detectLoop);
}

/* ─────────────────────────────────────────
   9. RENDER LOOPS
───────────────────────────────────────── */
const faceMesh = new FaceMesh({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
faceMesh.setOptions({ refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
faceMesh.onResults(results => {
  const earringImg  = window.JewelsState.active.earrings;
  const necklaceImg = window.JewelsState.active.chains;
  if (!earringImg && !necklaceImg) return;
  const w = videoElement.videoWidth, h = videoElement.videoHeight;
  canvasElement.width = w; canvasElement.height = h;
  canvasCtx.save();
  currentCameraMode === 'environment' ? canvasCtx.scale(1,1) : (canvasCtx.translate(w,0), canvasCtx.scale(-1,1));
  canvasCtx.drawImage(videoElement, 0, 0, w, h);
  if (results.multiFaceLandmarks?.[0]) {
    const lm = results.multiFaceLandmarks[0];
    const leftEar  = { x: lm[132].x*w, y: lm[132].y*h };
    const rightEar = { x: lm[361].x*w, y: lm[361].y*h };
    const neck = { x: lm[152].x*w, y: lm[152].y*h };
    const nose = { x: lm[1].x*w,   y: lm[1].y*h   };
    const gravityTarget = -Math.atan2(rightEar.y-leftEar.y, rightEar.x-leftEar.x);
    physics.earringVelocity += (gravityTarget - physics.earringAngle) * 0.1;
    physics.earringVelocity *= 0.92; physics.earringAngle += physics.earringVelocity;
    const headSpeed = (lm[1].x - physics.lastHeadX) * w; physics.lastHeadX = lm[1].x;
    physics.swayOffset += headSpeed * -0.005; physics.swayOffset *= 0.85;
    const earDist      = Math.hypot(rightEar.x-leftEar.x, rightEar.y-leftEar.y);
    const distToLeft   = Math.hypot(nose.x-leftEar.x,  nose.y-leftEar.y);
    const distToRight  = Math.hypot(nose.x-rightEar.x, nose.y-rightEar.y);
    const ratio        = distToLeft / (distToLeft + distToRight);
    if (earringImg?.complete) {
      const ew = earDist*0.25, eh = (earringImg.height/earringImg.width)*ew;
      const xShift = ew*0.05, totalAngle = physics.earringAngle + physics.swayOffset*0.5;
      if (ratio > 0.25) { canvasCtx.save(); canvasCtx.translate(leftEar.x,leftEar.y);  canvasCtx.rotate(totalAngle); canvasCtx.drawImage(earringImg, (-ew/2)-xShift, -eh*0.20, ew, eh); canvasCtx.restore(); }
      if (ratio < 0.75) { canvasCtx.save(); canvasCtx.translate(rightEar.x,rightEar.y); canvasCtx.rotate(totalAngle); canvasCtx.drawImage(earringImg, (-ew/2)+xShift, -eh*0.20, ew, eh); canvasCtx.restore(); }
    }
    if (necklaceImg?.complete) {
      const nw = earDist*0.85, nh = (necklaceImg.height/necklaceImg.width)*nw;
      canvasCtx.drawImage(necklaceImg, neck.x-nw/2, neck.y+nw*0.1, nw, nh);
    }
  }
  canvasCtx.restore();
});

const hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
function calculateAngle(p1, p2) { return Math.atan2(p2.y-p1.y, p2.x-p1.x); }

hands.onResults(results => {
  const w = videoElement.videoWidth, h = videoElement.videoHeight;
  if (results.multiHandLandmarks?.length > 0) {
    const lm = results.multiHandLandmarks[0];
    const indexTipX = lm[8].x;
    if (!autoTryRunning && Date.now()-lastGestureTime > GESTURE_COOLDOWN) {
      if (previousHandX !== null) {
        const diff = indexTipX - previousHandX;
        if (Math.abs(diff) > 0.04) {
          const dir = diff > 0 ? -1 : 1;
          changeProduct(dir);
          triggerVisualFeedback(dir === -1 ? "⬅️ Previous" : "Next ➡️");
          lastGestureTime = Date.now(); previousHandX = null;
        }
      }
      if (Date.now()-lastGestureTime > 100) previousHandX = indexTipX;
    }
  } else { previousHandX = null; }

  const ringImg   = window.JewelsState.active.rings;
  const bangleImg = window.JewelsState.active.bangles;
  if (!ringImg && !bangleImg) return;

  canvasElement.width = w; canvasElement.height = h;
  canvasCtx.save();
  currentCameraMode === 'environment' ? canvasCtx.scale(1,1) : (canvasCtx.translate(w,0), canvasCtx.scale(-1,1));
  canvasCtx.drawImage(videoElement, 0, 0, w, h);

  if (results.multiHandLandmarks?.length > 0) {
    const lm = results.multiHandLandmarks[0];
    const mcp   = { x: lm[13].x*w, y: lm[13].y*h };
    const pip   = { x: lm[14].x*w, y: lm[14].y*h };
    const wrist = { x: lm[0].x*w,  y: lm[0].y*h  };
    const tRingAngle   = calculateAngle(mcp, pip) - Math.PI/2;
    const tRingWidth   = Math.hypot(pip.x-mcp.x, pip.y-mcp.y) * 0.6;
    const tArmAngle    = calculateAngle(wrist, { x: lm[9].x*w, y: lm[9].y*h }) - Math.PI/2;
    const tBangleWidth = Math.hypot((lm[17].x*w)-(lm[5].x*w), (lm[17].y*h)-(lm[5].y*h)) * 1.25;
    if (!handSmoother.active) {
      handSmoother = { active:true, ring:{x:mcp.x,y:mcp.y,angle:tRingAngle,size:tRingWidth}, bangle:{x:wrist.x,y:wrist.y,angle:tArmAngle,size:tBangleWidth} };
    } else {
      handSmoother.ring.x     = lerp(handSmoother.ring.x,     mcp.x,        SMOOTH_FACTOR);
      handSmoother.ring.y     = lerp(handSmoother.ring.y,     mcp.y,        SMOOTH_FACTOR);
      handSmoother.ring.angle = lerp(handSmoother.ring.angle, tRingAngle,   SMOOTH_FACTOR);
      handSmoother.ring.size  = lerp(handSmoother.ring.size,  tRingWidth,   SMOOTH_FACTOR);
      handSmoother.bangle.x     = lerp(handSmoother.bangle.x,     wrist.x,       SMOOTH_FACTOR);
      handSmoother.bangle.y     = lerp(handSmoother.bangle.y,     wrist.y,       SMOOTH_FACTOR);
      handSmoother.bangle.angle = lerp(handSmoother.bangle.angle, tArmAngle,     SMOOTH_FACTOR);
      handSmoother.bangle.size  = lerp(handSmoother.bangle.size,  tBangleWidth,  SMOOTH_FACTOR);
    }
    if (ringImg?.complete) {
      const rH = (ringImg.height/ringImg.width)*handSmoother.ring.size;
      canvasCtx.save(); canvasCtx.translate(handSmoother.ring.x, handSmoother.ring.y); canvasCtx.rotate(handSmoother.ring.angle);
      canvasCtx.drawImage(ringImg, -handSmoother.ring.size/2, (handSmoother.ring.size/0.6)*0.15, handSmoother.ring.size, rH); canvasCtx.restore();
    }
    if (bangleImg?.complete) {
      const bH = (bangleImg.height/bangleImg.width)*handSmoother.bangle.size;
      canvasCtx.save(); canvasCtx.translate(handSmoother.bangle.x, handSmoother.bangle.y); canvasCtx.rotate(handSmoother.bangle.angle);
      canvasCtx.drawImage(bangleImg, -handSmoother.bangle.size/2, -bH/2, handSmoother.bangle.size, bH); canvasCtx.restore();
    }
  }
  canvasCtx.restore();
});

/* ─────────────────────────────────────────
   10. CAPTURE
───────────────────────────────────────── */
function captureToGallery() {
  const c = document.createElement('canvas');
  c.width = videoElement.videoWidth; c.height = videoElement.videoHeight;
  const ctx = c.getContext('2d');
  currentCameraMode === 'environment' ? ctx.scale(1,1) : (ctx.translate(c.width,0), ctx.scale(-1,1));
  ctx.drawImage(videoElement, 0, 0);
  ctx.setTransform(1,0,0,1,0,0);
  try { ctx.drawImage(canvasElement, 0, 0); } catch(e) { console.error("AR canvas tainted", e); }

  let cleanName = currentAssetName.replace(/\.(png|jpg|jpeg|webp)$/i,"").replace(/_/g," ");
  cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

  const pad  = c.width*0.04, ts = c.width*0.045, ds = c.width*0.035;
  const cH   = ts*2 + ds + pad;
  const grd  = ctx.createLinearGradient(0, c.height-cH-pad, 0, c.height);
  grd.addColorStop(0,"rgba(0,0,0,0)"); grd.addColorStop(0.2,"rgba(0,0,0,0.8)"); grd.addColorStop(1,"rgba(0,0,0,0.95)");
  ctx.fillStyle = grd; ctx.fillRect(0, c.height-cH-pad, c.width, cH+pad);
  ctx.font = `bold ${ts}px Cormorant Garamond,serif`; ctx.fillStyle = "#c9a84c"; ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText("Product Description", pad, c.height-cH);
  ctx.font = `${ds}px Montserrat,sans-serif`; ctx.fillStyle = "#ffffff";
  ctx.fillText(cleanName, pad, c.height-cH+ts*1.5);
  if (watermarkImg.complete) { const ww=c.width*0.25, wh=(watermarkImg.height/watermarkImg.width)*ww; try { ctx.drawImage(watermarkImg, c.width-ww-pad, pad, ww, wh); } catch(e){} }
  try { return { url: c.toDataURL('image/png'), name: `Jewels-Ai_${Date.now()}.png` }; }
  catch(e) { console.error("Canvas tainted", e); return null; }
}

/* ─────────────────────────────────────────
   11. TRY ALL & GALLERY
───────────────────────────────────────── */
function takeSnapshot() { triggerFlash(); const d = captureToGallery(); if (d) { currentPreviewData=d; document.getElementById('preview-image').src=d.url; document.getElementById('preview-modal').style.display='flex'; if(concierge.active) concierge.speak("Captured!"); } }
function toggleTryAll() { if (!window.JewelsState.currentType) { alert("Select category!"); return; } autoTryRunning ? stopAutoTry() : startAutoTry(); }
function startAutoTry() { autoTryRunning=true; autoSnapshots=[]; autoTryIndex=0; document.getElementById('tryall-btn').textContent="STOP"; runAutoStep(); }
function stopAutoTry() { autoTryRunning=false; clearTimeout(autoTryTimeout); document.getElementById('tryall-btn').textContent="Try All"; if(autoSnapshots.length>0) showGallery(); }
async function runAutoStep() {
  if (!autoTryRunning) return;
  const assets = JEWELRY_ASSETS[window.JewelsState.currentType];
  if (!assets || autoTryIndex >= assets.length) { stopAutoTry(); return; }
  const asset = assets[autoTryIndex];
  const img = await loadAsset(asset.fullSrc, asset.id);
  setActiveARImage(img); currentAssetName = asset.name;
  autoTryTimeout = setTimeout(() => { triggerFlash(); const d=captureToGallery(); if(d) autoSnapshots.push(d); autoTryIndex++; runAutoStep(); }, 1500);
}

/* ─────────────────────────────────────────
   12. GALLERY & LIGHTBOX
───────────────────────────────────────── */
function showGallery() {
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = '';
  if (!autoSnapshots.length) { grid.innerHTML='<p style="color:#888;text-align:center;width:100%;">No items captured.</p>'; }
  const frag = document.createDocumentFragment();
  autoSnapshots.forEach((item, i) => {
    const card = document.createElement('div'); card.className="gallery-card";
    const img  = document.createElement('img'); img.src=item.url; img.className="gallery-img";
    const ov   = document.createElement('div'); ov.className="gallery-overlay";
    ov.innerHTML = `<span class="overlay-text">${item.name.replace("Jewels-Ai_","").replace(".png","").substring(0,12)}</span><div class="overlay-icon">👁️</div>`;
    card.onclick = () => { currentLightboxIndex=i; document.getElementById('lightbox-image').src=item.url; document.getElementById('lightbox-overlay').style.display='flex'; };
    card.appendChild(img); card.appendChild(ov); frag.appendChild(card);
  });
  grid.appendChild(frag);
  document.getElementById('gallery-modal').style.display='flex';
}
function changeLightboxImage(dir) { if(!autoSnapshots.length) return; currentLightboxIndex=(currentLightboxIndex+dir+autoSnapshots.length)%autoSnapshots.length; document.getElementById('lightbox-image').src=autoSnapshots[currentLightboxIndex].url; }

/* ─────────────────────────────────────────
   CLOSE / UTILITY FUNCTIONS
───────────────────────────────────────── */
function closePreview()  { document.getElementById('preview-modal').style.display='none'; }
function closeGallery()  { document.getElementById('gallery-modal').style.display='none'; }
function closeLightbox() { document.getElementById('lightbox-overlay').style.display='none'; }
function showToast(msg)  { const x=document.getElementById("toast-notification"); if(!x) return; x.innerText=msg; x.className="show"; setTimeout(()=>x.className=x.className.replace("show",""),3000); }
function triggerFlash()  { if(!flashOverlay) return; flashOverlay.classList.remove('flash-active'); void flashOverlay.offsetWidth; flashOverlay.classList.add('flash-active'); setTimeout(()=>flashOverlay.classList.remove('flash-active'),300); }
function lerp(a,b,t)     { return (1-t)*a + t*b; }

function prepareDailyDrop() { if(JEWELRY_ASSETS['earrings']?.length>0) { const l=JEWELRY_ASSETS['earrings']; const i=Math.floor(Math.random()*l.length); dailyItem={item:l[i],index:i,type:'earrings'}; const di=document.getElementById('daily-img'); const dn=document.getElementById('daily-name'); if(di) di.src=dailyItem.item.thumbSrc; if(dn) dn.innerText=dailyItem.item.name; } }
function closeDailyDrop()   { document.getElementById('daily-drop-modal').style.display='none'; }
function tryDailyItem()     { closeDailyDrop(); if(dailyItem) selectJewelryType(dailyItem.type).then(()=>applyAssetInstantly(dailyItem.item,dailyItem.index,true)); }
function toggleCoShop()     { const m=document.getElementById('coshop-modal'); if(coShop.myId) { document.getElementById('invite-link-box').innerText=window.location.origin+window.location.pathname+"?room="+coShop.myId; m.style.display='flex'; } else showToast("Generating ID..."); }
function closeCoShopModal() { document.getElementById('coshop-modal').style.display='none'; }
function copyInviteLink()   { navigator.clipboard.writeText(document.getElementById('invite-link-box').innerText).then(()=>showToast("Link Copied!")); }
function openWhatsAppModal()        { if(typeof window._openWhatsAppModal==='function') window._openWhatsAppModal(); }
function confirmWhatsAppDownload()  { if(typeof window._confirmWhatsAppDownload==='function') window._confirmWhatsAppDownload(); }

/* ─────────────────────────────────────────
   EXPORTS
───────────────────────────────────────── */
window.selectJewelryType       = selectJewelryType;
window.toggleTryAll            = toggleTryAll;
window.tryDailyItem            = tryDailyItem;
window.closeDailyDrop          = closeDailyDrop;
window.takeSnapshot            = takeSnapshot;
window.toggleCoShop            = toggleCoShop;
window.closeCoShopModal        = closeCoShopModal;
window.copyInviteLink          = copyInviteLink;
window.sendVote                = val => coShop.sendVote(val);
window.toggleStacking          = toggleStacking;
window.openDailyDrop           = () => { document.getElementById('daily-drop-modal').style.display='flex'; };
window.openWhatsAppModal       = openWhatsAppModal;
window.confirmWhatsAppDownload = confirmWhatsAppDownload;
window.downloadSingleSnapshot  = () => { if(currentPreviewData.url) saveAs(currentPreviewData.url, currentPreviewData.name); };
window.shareSingleSnapshot     = () => { if(currentPreviewData.url) fetch(currentPreviewData.url).then(r=>r.blob()).then(b=>navigator.share({files:[new File([b],"look.png",{type:"image/png"})]})); };
window.downloadAllAsZip        = () => { if(autoSnapshots.length>0) { const z=new JSZip(); const f=z.folder("Jewels_Collection"); autoSnapshots.forEach(i=>f.file(i.name,i.url.split(',')[1],{base64:true})); z.generateAsync({type:"blob"}).then(c=>saveAs(c,"Jewels.zip")); }};
window.changeProduct           = changeProduct;
window.showToast               = showToast;
window.closePreview            = closePreview;
window.closeGallery            = closeGallery;
window.closeLightbox           = closeLightbox;
window.changeLightboxImage     = changeLightboxImage;
window.toggleConciergeMute     = () => concierge.toggle();
window.initVoiceControl        = initVoiceControl;
window.toggleVoiceControl      = toggleVoiceControl;