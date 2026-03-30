<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>JEWELS·AI — Couture Try-On</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Tenor+Sans&family=Montserrat:wght@200;300;400&display=swap" rel="stylesheet">

  <script src="https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js"></script>

  <style>
    /* ── TOKENS & RESET ── */
    :root {
      --gold-light:   #F0D080;
      --gold-main:    #C9A84C;
      --gold-dark:    #7B5E1A;
      --gold-shine:   #FFF3B0;
      --obsidian:     #080808;
      --surface:      #0f0f0f;
      --surface-2:    #181818;
      --surface-3:    #242424;
      --border:       rgba(201,168,76,0.18);
      --text-primary: #F5EDD6;
      --text-muted:   rgba(245,237,214,0.45);
      --radius-lg:    20px;
      --radius-pill:  999px;
      --font-display: 'Cormorant Garamond', serif;
      --font-ui:      'Tenor Sans', serif;
      --font-body:    'Montserrat', sans-serif;
      --gold:         #C9A84C;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      height: 100%; overflow: hidden;
      background: var(--obsidian);
      color: var(--text-primary);
      font-family: var(--font-body);
      cursor: crosshair;
    }

    /* ── GRAIN OVERLAY ── */
    body::before {
      content: '';
      position: fixed; inset: 0; z-index: 1000; pointer-events: none;
      opacity: 0.035;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      background-size: 200px 200px;
    }

    /* ── VIDEO STAGE ── */
    #stage { position: fixed; inset: 0; z-index: 0; }

    #webcam, #overlay, #remote-video {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      object-fit: cover;
    }

    #webcam { transform: scaleX(-1); }
    #webcam.no-mirror { transform: scaleX(1); }
    #remote-video { display: none; }

    #stage::after {
      content: '';
      position: absolute; inset: 0;
      background: radial-gradient(ellipse at center, transparent 40%, rgba(8,8,8,0.85) 100%);
      pointer-events: none; z-index: 5;
    }

    /* ── HEADER ── */
    #wordmark {
      position: fixed; top: 28px; left: 50%;
      transform: translateX(-50%);
      z-index: 50; text-align: center;
      animation: fadeDown 1.2s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    #wordmark h1 {
      font-family: var(--font-display);
      font-size: clamp(22px, 3vw, 36px);
      font-weight: 300; letter-spacing: 0.35em; text-transform: uppercase;
      background: linear-gradient(135deg, var(--gold-shine) 0%, var(--gold-main) 45%, var(--gold-dark) 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }

    #wordmark p {
      font-family: var(--font-body); font-size: 9px; font-weight: 200;
      letter-spacing: 0.5em; text-transform: uppercase;
      color: var(--text-muted); margin-top: 4px;
    }

    /* ── STATUS PILL ── */
    #status-pill {
      position: fixed; top: 28px; right: 28px; z-index: 50;
      display: flex; align-items: center; gap: 8px;
      padding: 7px 16px;
      background: rgba(15,15,15,0.7);
      border: 1px solid var(--border); border-radius: var(--radius-pill);
      backdrop-filter: blur(20px);
      font-family: var(--font-body); font-size: 9px; font-weight: 300;
      letter-spacing: 0.3em; color: var(--text-muted); text-transform: uppercase;
      animation: fadeDown 1.4s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    #status-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--gold-main); box-shadow: 0 0 8px var(--gold-main);
      animation: pulse-dot 2s ease-in-out infinite;
    }

    @keyframes pulse-dot {
      0%,100% { opacity: 1; box-shadow: 0 0 8px var(--gold-main); }
      50% { opacity: 0.5; box-shadow: 0 0 3px var(--gold-main); }
    }

    /* ── CATEGORY RAIL ── */
    #category-rail {
      position: fixed; left: 24px; top: 50%;
      transform: translateY(-50%);
      z-index: 40; display: flex; flex-direction: column; gap: 8px;
      animation: fadeRight 1.3s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    .cat-btn {
      position: relative; width: 42px; padding: 14px 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(15,15,15,0.75);
      border: 1px solid var(--border); border-radius: 14px;
      cursor: pointer; overflow: hidden; backdrop-filter: blur(16px);
      transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .cat-btn span {
      writing-mode: vertical-rl; text-orientation: mixed;
      font-family: var(--font-ui); font-size: 9px; letter-spacing: 0.25em;
      text-transform: uppercase; color: var(--text-muted);
      transition: color 0.3s; transform: rotate(180deg);
    }

    .cat-btn::before {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(180deg, var(--gold-light) 0%, var(--gold-dark) 100%);
      opacity: 0; transition: opacity 0.4s;
    }

    .cat-btn.active {
      border-color: var(--gold-main); padding: 22px 0;
      box-shadow: 0 0 24px rgba(201,168,76,0.25), inset 0 0 20px rgba(201,168,76,0.07);
    }

    .cat-btn.active::before { opacity: 1; }

    .cat-btn.active span {
      color: var(--obsidian); font-weight: 600; position: relative; z-index: 1;
    }

    .cat-btn:hover:not(.active) {
      border-color: rgba(201,168,76,0.4); transform: translateX(3px);
    }

    /* ── CAROUSEL ── */
    #carousel-wrap {
      position: fixed; bottom: 0; left: 0; right: 0;
      z-index: 40; padding: 0 90px 36px 90px;
      animation: fadeUp 1.4s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    #carousel-tray {
      display: flex; gap: 0; align-items: flex-end;
      overflow: hidden;
      padding: 20px 20px 20px;
      background: linear-gradient(135deg, rgba(18,18,18,0.92) 0%, rgba(12,12,12,0.88) 100%);
      border: 1px solid var(--border); border-radius: 24px;
      backdrop-filter: blur(32px) saturate(1.2);
    }

    /* The actual scrollable strip that core.js populates */
    #jewelry-options {
      display: flex; gap: 14px; align-items: flex-end;
      overflow-x: auto; overflow-y: visible;
      flex: 1;
      padding-bottom: 4px;
      scrollbar-width: none;
      -webkit-mask-image: linear-gradient(to right, transparent, black 4%, black 96%, transparent);
    }

    #jewelry-options::-webkit-scrollbar { display: none; }

    /* Thumb cards rendered by core.js */
    #jewelry-options > div {
      flex-shrink: 0;
      width: 70px; height: 70px;
      border-radius: 10px; overflow: hidden;
      cursor: pointer; border: 2px solid rgba(255,255,255,0.15);
      transition: border-color 0.25s, transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }

    #jewelry-options > div:hover {
      transform: translateY(-7px) scale(1.07) !important;
      border-color: var(--gold-main) !important;
      box-shadow: 0 14px 28px rgba(0,0,0,0.5), 0 0 16px rgba(201,168,76,0.2);
    }

    #jewelry-options > div img {
      width: 100%; height: 100%; object-fit: cover; display: block;
    }

    /* Skeleton cards */
    .thumb-skeleton {
      flex-shrink: 0; width: 70px; height: 70px; border-radius: 10px;
      background: linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%);
      background-size: 200% 100%;
      animation: shimmer 1.2s infinite;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ── SHUTTER ── */
    #shutter {
      position: fixed; bottom: 42px; right: 32px; z-index: 50;
      width: 64px; height: 64px; border-radius: 50%;
      background: conic-gradient(var(--gold-shine), var(--gold-main), var(--gold-dark), var(--gold-main), var(--gold-shine));
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      box-shadow: 0 0 40px rgba(201,168,76,0.35), 0 8px 24px rgba(0,0,0,0.5);
      animation: fadeUp 1.6s cubic-bezier(0.16, 1, 0.3, 1) both;
      transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s;
    }

    #shutter:hover {
      transform: scale(1.1);
      box-shadow: 0 0 60px rgba(201,168,76,0.55), 0 8px 32px rgba(0,0,0,0.6);
    }

    #shutter:active { transform: scale(0.94); }

    #shutter-inner {
      width: 50px; height: 50px; border-radius: 50%;
      background: var(--obsidian); border: 1.5px solid rgba(201,168,76,0.3);
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
    }

    #shutter:hover #shutter-inner { background: #111; }

    #shutter-icon {
      width: 22px; height: 22px;
      border: 2px solid var(--gold-main); border-radius: 5px; position: relative;
    }

    #shutter-icon::before {
      content: ''; position: absolute; top: -6px; left: 50%;
      transform: translateX(-50%);
      width: 8px; height: 4px;
      border: 2px solid var(--gold-main); border-radius: 2px 2px 0 0; border-bottom: none;
    }

    /* ── FLASH ── */
    #flash {
      position: fixed; inset: 0; z-index: 900;
      background: #fff; opacity: 0; pointer-events: none;
      transition: opacity 0.08s;
    }

    /* flash-overlay (used by core.js triggerFlash) */
    #flash-overlay {
      position: fixed; inset: 0; z-index: 899;
      background: #fff; opacity: 0; pointer-events: none;
      transition: opacity 0.08s;
    }

    #flash-overlay.flash-active { opacity: 1; }

    /* ── PREVIEW MODAL ── */
    #preview-modal {
      display: none;
      position: fixed; inset: 0; z-index: 800;
      background: rgba(4,4,4,0.96);
      flex-direction: column; align-items: center; justify-content: center;
      padding: 32px; backdrop-filter: blur(40px);
      animation: fadeIn 0.4s ease both;
    }

    #preview-modal.open,
    #preview-modal[style*="flex"] { display: flex; }

    #preview-frame {
      position: relative; border: 1px solid var(--border); border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px var(--gold-dark);
      max-width: 90vw; max-height: 62vh;
    }

    #preview-frame::before, #preview-frame::after {
      content: ''; position: absolute;
      width: 22px; height: 22px; border-color: var(--gold-light); border-style: solid; z-index: 2;
    }

    #preview-frame::before { top: 10px; left: 10px; border-width: 2px 0 0 2px; }
    #preview-frame::after  { bottom: 10px; right: 10px; border-width: 0 2px 2px 0; }

    #preview-image {
      display: block; max-width: 100%; max-height: 62vh;
    }

    #preview-label {
      margin-top: 8px; font-family: var(--font-display);
      font-size: 11px; letter-spacing: 0.4em;
      color: var(--text-muted); text-transform: uppercase;
    }

    #preview-actions { margin-top: 24px; display: flex; gap: 14px; }

    .act-btn {
      padding: 13px 30px; border-radius: var(--radius-pill);
      font-family: var(--font-body); font-size: 10px; font-weight: 300;
      letter-spacing: 0.3em; text-transform: uppercase;
      border: none; cursor: pointer;
      transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }

    .act-btn:hover { transform: translateY(-2px); }

    .act-btn-gold {
      background: linear-gradient(135deg, var(--gold-light) 0%, var(--gold-main) 100%);
      color: var(--obsidian);
    }

    .act-btn-wa {
      background: rgba(37,211,102,0.12);
      border: 1px solid rgba(37,211,102,0.4); color: #5bf08a;
    }

    .act-btn-wa:hover { background: rgba(37,211,102,0.2); }

    #close-preview {
      position: absolute; top: 24px; right: 28px;
      width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center;
      border: 1px solid var(--border); border-radius: 50%;
      background: transparent; color: var(--text-muted);
      font-size: 18px; cursor: pointer; transition: all 0.3s;
    }

    #close-preview:hover {
      border-color: var(--gold-main); color: var(--gold-light); transform: rotate(90deg);
    }

    /* ── TOAST ── */
    #toast-notification {
      position: fixed; bottom: 120px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.82); color: var(--text-primary);
      padding: 10px 22px; border-radius: var(--radius-pill);
      border: 1px solid var(--border);
      font-family: var(--font-body); font-size: 11px; letter-spacing: 0.15em;
      z-index: 600; opacity: 0; pointer-events: none;
      transition: opacity 0.3s;
    }

    #toast-notification.show { opacity: 1; }

    /* ── GALLERY MODAL ── */
    #gallery-modal {
      display: none;
      position: fixed; inset: 0; z-index: 750;
      background: rgba(4,4,4,0.97);
      flex-direction: column; align-items: center;
      padding: 40px 32px 32px; gap: 20px;
      backdrop-filter: blur(40px); overflow-y: auto;
    }

    #gallery-modal[style*="flex"] { display: flex; }

    #gallery-grid {
      display: flex; flex-wrap: wrap; gap: 14px;
      justify-content: center; max-width: 900px;
    }

    .gallery-card {
      position: relative; width: 160px; height: 120px;
      border-radius: 12px; overflow: hidden;
      border: 1px solid var(--border); cursor: pointer;
      transition: transform 0.3s;
    }

    .gallery-card:hover { transform: scale(1.05); }
    .gallery-img { width: 100%; height: 100%; object-fit: cover; display: block; }

    .gallery-overlay {
      position: absolute; inset: 0; background: rgba(0,0,0,0.55);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.2s;
    }

    .gallery-card:hover .gallery-overlay { opacity: 1; }
    .overlay-text { color: #fff; font-size: 10px; }
    .overlay-icon { font-size: 22px; }

    /* ── LIGHTBOX ── */
    #lightbox-overlay {
      display: none;
      position: fixed; inset: 0; z-index: 850;
      background: rgba(0,0,0,0.95);
      align-items: center; justify-content: center; flex-direction: column; gap: 16px;
    }

    #lightbox-overlay[style*="flex"] { display: flex; }

    #lightbox-image {
      max-width: 90vw; max-height: 80vh;
      border-radius: 12px; border: 1px solid var(--border);
    }

    .lb-btn {
      position: fixed; top: 50%; transform: translateY(-50%);
      background: rgba(20,20,20,0.8); border: 1px solid var(--border);
      color: var(--text-primary); padding: 12px 18px;
      border-radius: 8px; cursor: pointer; font-size: 20px; z-index: 860;
      transition: border-color 0.2s;
    }

    .lb-btn:hover { border-color: var(--gold-main); }
    #lb-prev { left: 16px; }
    #lb-next { right: 16px; }

    #close-lightbox {
      position: fixed; top: 20px; right: 24px; z-index: 860;
      background: rgba(20,20,20,0.8); border: 1px solid var(--border);
      color: var(--text-muted); width: 38px; height: 38px;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 18px; transition: all 0.3s;
    }

    #close-lightbox:hover { border-color: var(--gold-main); color: var(--gold-light); transform: rotate(90deg); }

    /* ── DAILY DROP MODAL ── */
    #daily-drop-modal {
      display: none;
      position: fixed; inset: 0; z-index: 760;
      background: rgba(4,4,4,0.94);
      align-items: center; justify-content: center;
      backdrop-filter: blur(30px);
    }

    #daily-drop-modal[style*="flex"] { display: flex; }

    .drop-card {
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: 20px; padding: 32px; max-width: 320px; width: 90%;
      text-align: center; display: flex; flex-direction: column; gap: 16px;
    }

    #daily-img { width: 120px; height: 120px; object-fit: contain; margin: 0 auto; border-radius: 10px; }

    #daily-name {
      font-family: var(--font-display); font-size: 16px;
      color: var(--gold-light); letter-spacing: 0.1em;
    }

    /* ── CO-SHOP MODAL ── */
    #coshop-modal {
      display: none;
      position: fixed; inset: 0; z-index: 770;
      background: rgba(4,4,4,0.94);
      align-items: center; justify-content: center;
      backdrop-filter: blur(30px);
    }

    #coshop-modal[style*="flex"] { display: flex; }

    .coshop-card {
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: 20px; padding: 32px; max-width: 400px; width: 90%;
      display: flex; flex-direction: column; gap: 14px;
    }

    #invite-link-box {
      background: var(--surface-3); border: 1px solid var(--border);
      border-radius: 8px; padding: 10px 14px;
      font-family: var(--font-body); font-size: 10px; color: var(--text-muted);
      word-break: break-all; user-select: all;
    }

    /* ── VOTING UI ── */
    #voting-ui {
      display: none;
      position: fixed; bottom: 160px; left: 50%; transform: translateX(-50%);
      z-index: 50; gap: 10px;
    }

    .vote-btn {
      width: 48px; height: 48px; border-radius: 50%;
      border: 1px solid var(--border);
      background: rgba(15,15,15,0.8); backdrop-filter: blur(16px);
      font-size: 22px; cursor: pointer;
      transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
    }

    .vote-btn:hover { transform: scale(1.2); }

    /* ── AI BUBBLE ── */
    #ai-avatar {
      position: fixed; left: 24px; bottom: 150px; z-index: 50;
      width: 48px; height: 48px; border-radius: 50%;
      background: var(--surface-2); border: 1px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 24px;
      box-shadow: 0 0 18px rgba(201,168,76,0.18);
      transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }

    #ai-avatar:hover { transform: scale(1.1); }
    #ai-avatar.talking { animation: talking-pulse 0.5s ease-in-out infinite alternate; }

    @keyframes talking-pulse {
      from { box-shadow: 0 0 10px rgba(201,168,76,0.3); }
      to   { box-shadow: 0 0 28px rgba(201,168,76,0.7); }
    }

    #ai-bubble {
      position: fixed; left: 80px; bottom: 155px; z-index: 50;
      background: rgba(15,15,15,0.9); border: 1px solid var(--border);
      border-radius: 12px; padding: 8px 14px;
      font-family: var(--font-body); font-size: 11px; color: var(--text-primary);
      max-width: 200px; opacity: 0; pointer-events: none;
      transition: opacity 0.4s;
    }

    #ai-bubble.bubble-visible { opacity: 1; }

    /* ── FOOTER ── */
    #footer-tag {
      position: fixed; bottom: 14px; left: 50%; transform: translateX(-50%);
      z-index: 40; font-family: var(--font-body);
      font-size: 8px; letter-spacing: 0.5em; text-transform: uppercase;
      color: rgba(201,168,76,0.25); white-space: nowrap;
    }

    /* ── CONTROL BTNS (voice, stacking, etc.) ── */
    .ctrl-btn {
      position: fixed; z-index: 50;
      background: rgba(15,15,15,0.75); border: 1px solid var(--border);
      border-radius: 10px; color: var(--text-muted);
      padding: 8px 12px; cursor: pointer; font-size: 11px;
      font-family: var(--font-body); letter-spacing: 0.1em;
      backdrop-filter: blur(16px); transition: border-color 0.2s, color 0.2s;
    }

    .ctrl-btn:hover { border-color: var(--gold-main); color: var(--gold-light); }
    .ctrl-btn.active { border-color: var(--gold-main); color: var(--gold-main); }

    #voice-btn     { top: 78px; right: 28px; }
    #stacking-btn  { top: 116px; right: 28px; }
    #tryall-btn    { top: 154px; right: 28px; }
    #coshop-btn    { top: 192px; right: 28px; }

    /* ── ANIMATIONS ── */
    @keyframes fadeDown {
      from { opacity: 0; transform: translate(-50%, -16px); }
      to   { opacity: 1; transform: translate(-50%, 0); }
    }

    @keyframes fadeRight {
      from { opacity: 0; transform: translate(-20px, -50%); }
      to   { opacity: 1; transform: translate(0, -50%); }
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    /* ── RESPONSIVE ── */
    @media (max-width: 600px) {
      #carousel-wrap { padding: 0 16px 28px; }
      #jewelry-options > div { width: 58px; height: 58px; }
      #shutter { width: 56px; height: 56px; bottom: 32px; right: 20px; }
      #shutter-inner { width: 44px; height: 44px; }
    }
  </style>
</head>
<body>

  <!-- ── FLASH OVERLAYS ── -->
  <div id="flash"></div>
  <div id="flash-overlay"></div>

  <!-- ── VIDEO STAGE ── -->
  <div id="stage">
    <video id="webcam" autoplay playsinline muted></video>
    <canvas id="overlay"></canvas>
    <video id="remote-video" autoplay playsinline></video>
  </div>

  <!-- ── WORDMARK ── -->
  <header id="wordmark">
    <h1>Jewels · AI</h1>
    <p>Haute Couture Virtual Try-On</p>
  </header>

  <!-- ── STATUS ── -->
  <div id="status-pill">
    <div id="status-dot"></div>
    <span id="status-text">System Ready</span>
  </div>

  <!-- ── CATEGORY RAIL ── -->
  <nav id="category-rail">
    <div class="cat-btn active" data-type="earrings" onclick="handleCategoryClick(this)"><span>Earrings</span></div>
    <div class="cat-btn" data-type="chains"   onclick="handleCategoryClick(this)"><span>Chains</span></div>
    <div class="cat-btn" data-type="rings"    onclick="handleCategoryClick(this)"><span>Rings</span></div>
    <div class="cat-btn" data-type="bangles"  onclick="handleCategoryClick(this)"><span>Bangles</span></div>
  </nav>

  <!-- ── CAROUSEL — jewelry-options is the live container core.js writes into ── -->
  <div id="carousel-wrap">
    <div id="carousel-tray">
      <div id="jewelry-options"></div>
    </div>
  </div>

  <!-- ── SHUTTER ── -->
  <div id="shutter" onclick="takeSnapshot()" title="Capture Look">
    <div id="shutter-inner">
      <div id="shutter-icon"></div>
    </div>
  </div>

  <!-- ── CONTROL BUTTONS ── -->
  <button id="voice-btn"    class="ctrl-btn" onclick="toggleVoiceControl()">🎙️ Voice</button>
  <button id="stacking-btn" class="ctrl-btn" onclick="toggleStacking()">Stack</button>
  <button id="tryall-btn"   class="ctrl-btn" onclick="toggleTryAll()">Try All</button>
  <button id="coshop-btn"   class="ctrl-btn" onclick="toggleCoShop()">Co-Shop</button>

  <!-- ── AI CONCIERGE ── -->
  <div id="ai-avatar" onclick="toggleConciergeMute()">💎</div>
  <div id="ai-bubble">Tap me to activate Nila</div>

  <!-- ── VOTING UI (shown when co-shopping) ── -->
  <div id="voting-ui">
    <button class="vote-btn" onclick="sendVote('❤️')">❤️</button>
    <button class="vote-btn" onclick="sendVote('😍')">😍</button>
    <button class="vote-btn" onclick="sendVote('👎')">👎</button>
  </div>

  <!-- ── TOAST ── -->
  <div id="toast-notification"></div>

  <!-- ── HIDDEN UTIL ── -->
  <div id="loading-status" style="display:none;"></div>

  <!-- ── FOOTER ── -->
  <div id="footer-tag">Powered by Jewels AI &nbsp;·&nbsp; Couture Intelligence</div>

  <!-- ── PREVIEW MODAL ── -->
  <div id="preview-modal">
    <button id="close-preview" onclick="closePreview()">✕</button>
    <div id="preview-frame">
      <img id="preview-image" src="" alt="Your Look">
    </div>
    <p id="preview-label">Your Signature Look</p>
    <div id="preview-actions">
      <button class="act-btn act-btn-gold" onclick="downloadSingleSnapshot()">↓ &nbsp;Download</button>
      <button class="act-btn act-btn-wa"   onclick="shareToWhatsApp()">WhatsApp Share</button>
    </div>
  </div>

  <!-- ── GALLERY MODAL ── -->
  <div id="gallery-modal">
    <button class="close-gallery ctrl-btn" style="align-self:flex-end" onclick="closeGallery()">✕ Close</button>
    <div id="gallery-grid"></div>
    <button class="act-btn act-btn-gold" onclick="downloadAllAsZip()">↓ Download All</button>
  </div>

  <!-- ── LIGHTBOX ── -->
  <div id="lightbox-overlay">
    <button class="lb-btn" id="lb-prev" onclick="changeLightboxImage(-1)">‹</button>
    <img id="lightbox-image" src="" alt="Look">
    <button class="lb-btn" id="lb-next" onclick="changeLightboxImage(1)">›</button>
    <button id="close-lightbox" class="close-lightbox" onclick="closeLightbox()">✕</button>
  </div>

  <!-- ── DAILY DROP MODAL ── -->
  <div id="daily-drop-modal">
    <div class="drop-card">
      <p style="font-family:var(--font-display);font-size:20px;color:var(--gold-light);letter-spacing:0.2em;">✦ Daily Drop</p>
      <img id="daily-img" src="" alt="Daily Drop">
      <p id="daily-name">Loading...</p>
      <button class="act-btn act-btn-gold" onclick="tryDailyItem()">Try It On</button>
      <button class="act-btn" style="border:1px solid var(--border);background:transparent;color:var(--text-muted)" onclick="closeDailyDrop()">Dismiss</button>
    </div>
  </div>

  <!-- ── CO-SHOP MODAL ── -->
  <div id="coshop-modal">
    <div class="coshop-card">
      <p style="font-family:var(--font-display);font-size:20px;color:var(--gold-light);">Co-Shop Session</p>
      <p style="font-size:11px;color:var(--text-muted);">Share this link with a friend to shop together live:</p>
      <div id="invite-link-box">Generating link...</div>
      <div style="display:flex;gap:10px;">
        <button class="act-btn act-btn-gold" onclick="copyInviteLink()" style="flex:1;">Copy Link</button>
        <button class="act-btn" style="border:1px solid var(--border);background:transparent;color:var(--text-muted);flex:1;" onclick="closeCoShopModal()">Close</button>
      </div>
    </div>
  </div>

  <!-- ════════════════════════════════════════
       CORE ENGINE  (merged from core.js)
       ════════════════════════════════════════ -->
  <script>
  /* ── CONFIGURATION ── */
  const API_KEY = "AIzaSyAXG3iG2oQjUA_BpnO8dK8y-MHJ7HLrhyE";

  const DRIVE_FOLDERS = {
    earrings: "1eftKhpOHbCj8hzO11-KioFv03g0Yn61n",
    chains:   "1G136WEiA9QBSLtRk0LW1fRb3HDZb4VBD",
    rings:    "1iB1qgTE-Yl7w-CVsegecniD_DzklQk90",
    bangles:  "1d2b7I8XlhIEb8S_eXnRFBEaNYSwngnba"
  };

  /* ── GLOBAL STATE ── */
  window.JewelsState = {
    active: { earrings: null, chains: null, rings: null, bangles: null },
    stackingEnabled: false,
    currentType: ''
  };

  const JEWELRY_ASSETS   = {};
  const CATALOG_PROMISES = {};
  const IMAGE_CACHE      = {};
  const THUMB_PREFETCH_LIMIT = 12;
  let dailyItem = null;

  const watermarkImg = new Image();
  watermarkImg.crossOrigin = "anonymous";
  watermarkImg.src = 'logo_watermark.png';

  /* ── DOM REFS ── */
  const videoElement  = document.getElementById('webcam');
  const canvasElement = document.getElementById('overlay');
  const remoteVideo   = document.getElementById('remote-video');
  const canvasCtx     = canvasElement.getContext('2d');
  const flashOverlay  = document.getElementById('flash-overlay');
  const voiceBtn      = document.getElementById('voice-btn');

  /* ── PHYSICS & TRACKING ── */
  let isProcessingHand = false, isProcessingFace = false;
  let currentAssetName = "Select a Design";
  let currentAssetIndex = 0;
  let physics = { earringAngle: 0, earringVelocity: 0, swayOffset: 0, lastHeadX: 0 };
  let currentCameraMode = 'user';

  /* ── AUTO TRY & GALLERY ── */
  let autoTryRunning = false, autoTryIndex = 0, autoTryTimeout = null;
  let autoSnapshots = [];
  let currentPreviewData = { url: null, name: '' };
  let currentLightboxIndex = 0;

  /* ── VOICE ── */
  let recognition = null, voiceEnabled = false, isRecognizing = false;

  /* ── GESTURE ── */
  let lastGestureTime = 0;
  const GESTURE_COOLDOWN = 800;
  let previousHandX = null;

  /* ── SMOOTHER ── */
  const SMOOTH_FACTOR = 0.8;
  let handSmoother = {
    active: false,
    ring:   { x: 0, y: 0, angle: 0, size: 0 },
    bangle: { x: 0, y: 0, angle: 0, size: 0 }
  };

  /* ═══════════════════════════════════════
     1. NAVIGATION
  ═══════════════════════════════════════ */
  function changeProduct(direction) {
    if (!JEWELRY_ASSETS[window.JewelsState.currentType]) return;
    const list = JEWELRY_ASSETS[window.JewelsState.currentType];
    let newIndex = currentAssetIndex + direction;
    if (newIndex >= list.length) newIndex = 0;
    if (newIndex < 0) newIndex = list.length - 1;
    applyAssetInstantly(list[newIndex], newIndex, true);
  }

  function triggerVisualFeedback(text) {
    const fb = document.createElement('div');
    fb.innerText = text;
    fb.style.cssText = 'position:fixed;top:20%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.7);color:#fff;padding:10px 20px;border-radius:20px;z-index:1000;pointer-events:none;font-family:sans-serif;font-size:18px;';
    document.body.appendChild(fb);
    setTimeout(() => fb.remove(), 1000);
  }

  /* ═══════════════════════════════════════
     2. AI CONCIERGE "NILA"
  ═══════════════════════════════════════ */
  const concierge = {
    synth: window.speechSynthesis, voice: null, active: true, hasStarted: false,
    init() {
      if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = this.setVoice.bind(this);
      this.setVoice();
      setTimeout(() => {
        const b = document.getElementById('ai-bubble');
        if (b) { b.innerText = "Tap me to activate Nila"; b.classList.add('bubble-visible'); }
      }, 1000);
    },
    setVoice() {
      const v = window.speechSynthesis.getVoices();
      concierge.voice = v.find(x => x.name.includes("Google US English") || x.name.includes("Female")) || v[0];
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
        u.onend = () => {
          if (b) setTimeout(() => b.classList.remove('bubble-visible'), 3000);
          if (a) a.classList.remove('talking');
        };
        this.synth.speak(u);
      } else {
        setTimeout(() => { if (a) a.classList.remove('talking'); if (b) b.classList.remove('bubble-visible'); }, 3000);
      }
    },
    toggle() {
      if (!this.hasStarted) {
        this.hasStarted = true;
        this.speak("Namaste! I am Nila. Select a jewelry category.");
        if (!voiceEnabled) toggleVoiceControl();
        return;
      }
      this.active = !this.active;
      if (this.active) this.speak("I am listening.");
      else { this.synth.cancel(); const b = document.getElementById('ai-bubble'); if (b) b.innerText = "Muted"; }
    }
  };

  /* ═══════════════════════════════════════
     3. CO-SHOPPING
  ═══════════════════════════════════════ */
  const coShop = {
    peer: null, conn: null, myId: null, active: false, isHost: false,
    init() {
      if (typeof Peer === 'undefined') return;
      this.peer = new Peer(null, { debug: 2 });
      this.peer.on('open', id => { this.myId = id; this.checkForInvite(); });
      this.peer.on('connection', c => {
        this.handleConnection(c); showToast("Friend Connected!"); this.activateUI();
        if (this.isHost) setTimeout(() => this.callGuest(c.peer), 1000);
      });
      this.peer.on('call', call => {
        call.answer();
        call.on('stream', s => {
          remoteVideo.srcObject = s; remoteVideo.style.display = 'block';
          videoElement.style.display = 'none'; canvasElement.style.display = 'none';
          showToast("Watching Host Live");
        });
      });
    },
    checkForInvite() {
      const r = new URLSearchParams(window.location.search).get('room');
      if (r) { this.isHost = false; this.connectToHost(r); }
      else { this.isHost = true; document.body.classList.add('hosting'); }
    },
    connectToHost(id) { this.conn = this.peer.connect(id); this.conn.on('open', () => { showToast("Connected!"); this.activateUI(); }); this.setupDataListener(); },
    handleConnection(c) { this.conn = c; this.setupDataListener(); },
    callGuest(id) { this.peer.call(id, canvasElement.captureStream(30)); },
    setupDataListener() { this.conn.on('data', d => { if (d.type === 'VOTE') showReaction(d.val); }); },
    sendUpdate(cat, idx) { if (this.conn?.open) this.conn.send({ type: 'SYNC_ITEM', cat, idx }); },
    sendVote(val) { if (this.conn?.open) { this.conn.send({ type: 'VOTE', val }); showReaction(val); } },
    activateUI() {
      this.active = true;
      document.getElementById('voting-ui').style.display = 'flex';
      document.getElementById('coshop-btn').style.color = '#00ff00';
    }
  };

  function showReaction(val) { triggerVisualFeedback(val); }

  /* ═══════════════════════════════════════
     4. ASSET LOADING
  ═══════════════════════════════════════ */
  function initBackgroundFetch() {
    Promise.all(Object.keys(DRIVE_FOLDERS).map(key => fetchCategoryData(key)))
      .then(() => { prefetchThumbs('earrings'); });
  }

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
          thumbSrc: f.thumbnailLink
            ? f.thumbnailLink.replace(/=s\d+$/, "=s220")
            : `https://drive.google.com/thumbnail?id=${f.id}&sz=s220`,
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

  function prefetchThumbs(category) {
    const assets = JEWELRY_ASSETS[category];
    if (!assets) return;
    assets.slice(0, THUMB_PREFETCH_LIMIT).forEach(asset => {
      if (IMAGE_CACHE['thumb_' + asset.id]) return;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { IMAGE_CACHE['thumb_' + asset.id] = img; };
      img.src = asset.thumbSrc;
    });
  }

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

  /* ═══════════════════════════════════════
     5. APP INIT
  ═══════════════════════════════════════ */
  window.onload = async () => {
    initBackgroundFetch();
    coShop.init();
    concierge.init();
    await startCameraFast('user');
    setTimeout(() => {
      const ls = document.getElementById('loading-status');
      if (ls) ls.style.display = 'none';
    }, 1500);
    selectJewelryType('earrings');
  };

  /* ═══════════════════════════════════════
     6. CATEGORY SWITCHING (UI + core bridge)
  ═══════════════════════════════════════ */
  function handleCategoryClick(el) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    selectJewelryType(el.dataset.type);
  }

  /* ═══════════════════════════════════════
     7. SELECTION & STACKING
  ═══════════════════════════════════════ */
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
    if (type === undefined) return;

    /* Update category buttons */
    document.querySelectorAll('.cat-btn').forEach(el => {
      el.classList.toggle('active', el.dataset.type === type);
    });

    window.JewelsState.currentType = type;
    if (concierge.hasStarted) concierge.speak(`Selected ${type}.`);

    const targetMode = (type === 'rings' || type === 'bangles') ? 'environment' : 'user';
    startCameraFast(targetMode);

    if (!window.JewelsState.stackingEnabled) {
      window.JewelsState.active = { earrings: null, chains: null, rings: null, bangles: null };
    }

    const container = document.getElementById('jewelry-options');
    if (!container) return;
    container.innerHTML = '';
    showSkeletonStrip(container, 8);

    let assets = JEWELRY_ASSETS[type];
    if (!assets) assets = await fetchCategoryData(type);
    if (!assets || assets.length === 0) { container.innerHTML = ''; return; }

    /* Prefetch next category */
    const types = Object.keys(DRIVE_FOLDERS);
    const nextType = types[(types.indexOf(type) + 1) % types.length];
    setTimeout(() => prefetchThumbs(nextType), 300);

    container.innerHTML = '';
    renderThumbStrip(container, assets, type);
    applyAssetInstantly(assets[0], 0, false);

    /* Update status */
    const statusEl = document.getElementById('status-text');
    if (statusEl) statusEl.textContent = `${assets.length} ${type} loaded`;
  }

  function showSkeletonStrip(container, count) {
    for (let i = 0; i < count; i++) {
      const sk = document.createElement('div');
      sk.className = 'thumb-skeleton';
      container.appendChild(sk);
    }
  }

  function renderThumbStrip(container, assets, type) {
    const frag = document.createDocumentFragment();
    assets.forEach((asset, i) => {
      const wrap = document.createElement('div');
      wrap.title = asset.name.replace(/\.(png|jpg|jpeg|webp)$/i, '').replace(/_/g, ' ');

      const img = document.createElement('img');
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
      img.alt = asset.name;

      if (IMAGE_CACHE['thumb_' + asset.id]) {
        img.src = IMAGE_CACHE['thumb_' + asset.id].src;
      } else {
        img.loading = 'lazy';
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
    window.currentJewelry = asset.fullSrc;
    highlightButtonByIndex(index);

    const thumbKey = 'thumb_' + asset.id;
    if (IMAGE_CACHE[thumbKey]) {
      setActiveARImage(IMAGE_CACHE[thumbKey]);
    } else {
      const quickThumb = await loadAsset(asset.thumbSrc, thumbKey, thumbKey);
      setActiveARImage(quickThumb);
    }

    if (shouldBroadcast && coShop.active && coShop.isHost) {
      coShop.sendUpdate(window.JewelsState.currentType, index);
    }

    loadAsset(asset.fullSrc, asset.id).then(highResImg => {
      if (currentAssetName === asset.name && highResImg) setActiveARImage(highResImg);
    });
  }

  function highlightButtonByIndex(index) {
    const container = document.getElementById('jewelry-options');
    if (!container) return;
    const children = container.children;
    for (let i = 0; i < children.length; i++) {
      const el = children[i];
      const isActive = i === index;
      el.style.borderColor = isActive ? 'var(--gold-main)' : 'rgba(255,255,255,0.15)';
      el.style.transform   = isActive ? 'translateY(-6px) scale(1.08)' : 'scale(1)';
      if (isActive) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  /* ═══════════════════════════════════════
     8. VOICE CONTROL
  ═══════════════════════════════════════ */
  function initVoiceControl() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { if (voiceBtn) voiceBtn.style.display = 'none'; return; }
    recognition = new SR();
    recognition.continuous = true; recognition.interimResults = false; recognition.lang = 'en-US';
    recognition.onstart = () => {
      isRecognizing = true;
      if (voiceBtn) { voiceBtn.style.backgroundColor = "rgba(0,255,0,0.2)"; voiceBtn.style.borderColor = "#00ff00"; }
    };
    recognition.onresult = e => {
      if (e.results[e.results.length-1].isFinal) processVoiceCommand(e.results[e.results.length-1][0].transcript.trim().toLowerCase());
    };
    recognition.onend = () => {
      isRecognizing = false;
      if (voiceEnabled) setTimeout(() => { try { recognition.start(); } catch(e) {} }, 500);
      else if (voiceBtn) { voiceBtn.style.backgroundColor = ''; voiceBtn.style.borderColor = ''; }
    };
    try { recognition.start(); } catch(e) {}
  }

  function toggleVoiceControl() {
    if (!recognition) { initVoiceControl(); return; }
    voiceEnabled = !voiceEnabled;
    if (!voiceEnabled) {
      recognition.stop();
      if (voiceBtn) { voiceBtn.innerHTML = '🔇 Voice'; voiceBtn.classList.add('active'); }
    } else {
      try { recognition.start(); } catch(e) {}
      if (voiceBtn) { voiceBtn.innerHTML = '🎙️ Voice'; voiceBtn.classList.remove('active'); }
    }
  }

  function processVoiceCommand(cmd) {
    cmd = cmd.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
    if (cmd.includes('next')||cmd.includes('change'))     { changeProduct(1); triggerVisualFeedback("Next"); }
    else if (cmd.includes('back')||cmd.includes('previous')) { changeProduct(-1); triggerVisualFeedback("Previous"); }
    else if (cmd.includes('photo')||cmd.includes('capture')) takeSnapshot();
    else if (cmd.includes('earring')) selectJewelryType('earrings');
    else if (cmd.includes('chain'))   selectJewelryType('chains');
    else if (cmd.includes('ring'))    selectJewelryType('rings');
    else if (cmd.includes('bangle'))  selectJewelryType('bangles');
  }

  /* ═══════════════════════════════════════
     9. CAMERA & TRACKING
  ═══════════════════════════════════════ */
  async function startCameraFast(mode = 'user') {
    if (!coShop.isHost && coShop.active) return;
    if (videoElement.srcObject && currentCameraMode === mode && videoElement.readyState >= 2) return;
    currentCameraMode = mode;
    if (videoElement.srcObject) videoElement.srcObject.getTracks().forEach(t => t.stop());
    mode === 'environment'
      ? videoElement.classList.add('no-mirror')
      : videoElement.classList.remove('no-mirror');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: mode }
      });
      videoElement.srcObject = stream;
      videoElement.onloadeddata = () => {
        videoElement.play();
        detectLoop();
        if (!recognition) initVoiceControl();
        const st = document.getElementById('status-text');
        if (st) st.textContent = 'Camera Active';
      };
    } catch (err) {
      console.error("Camera Error", err);
      const st = document.getElementById('status-text');
      if (st) st.textContent = 'Camera Error';
    }
  }

  async function detectLoop() {
    if (videoElement.readyState >= 2 && !remoteVideo.srcObject) {
      if (!isProcessingFace) { isProcessingFace = true; await faceMesh.send({ image: videoElement }); isProcessingFace = false; }
      if (!isProcessingHand) { isProcessingHand = true; await hands.send({ image: videoElement }); isProcessingHand = false; }
    }
    requestAnimationFrame(detectLoop);
  }

  /* ═══════════════════════════════════════
     10. MEDIAPIPE — FACE (earrings + chains)
  ═══════════════════════════════════════ */
  const faceMesh = new FaceMesh({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
  faceMesh.setOptions({ refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
  faceMesh.onResults(results => {
    const earringImg  = window.JewelsState.active.earrings;
    const necklaceImg = window.JewelsState.active.chains;
    if (!earringImg && !necklaceImg) return;

    const w = videoElement.videoWidth, h = videoElement.videoHeight;
    if (!w || !h) return;
    canvasElement.width = w; canvasElement.height = h;
    canvasCtx.save();
    if (currentCameraMode === 'environment') {
      canvasCtx.scale(1,1);
    } else {
      canvasCtx.translate(w, 0); canvasCtx.scale(-1, 1);
    }
    canvasCtx.drawImage(videoElement, 0, 0, w, h);

    if (results.multiFaceLandmarks?.[0]) {
      const lm = results.multiFaceLandmarks[0];
      const leftEar  = { x: lm[132].x*w, y: lm[132].y*h };
      const rightEar = { x: lm[361].x*w, y: lm[361].y*h };
      const neck     = { x: lm[152].x*w, y: lm[152].y*h };
      const nose     = { x: lm[1].x*w,   y: lm[1].y*h   };

      const gravityTarget = -Math.atan2(rightEar.y-leftEar.y, rightEar.x-leftEar.x);
      physics.earringVelocity += (gravityTarget - physics.earringAngle) * 0.1;
      physics.earringVelocity *= 0.92;
      physics.earringAngle += physics.earringVelocity;

      const headSpeed = (lm[1].x - physics.lastHeadX) * w;
      physics.lastHeadX = lm[1].x;
      physics.swayOffset += headSpeed * -0.005;
      physics.swayOffset *= 0.85;

      const earDist     = Math.hypot(rightEar.x-leftEar.x, rightEar.y-leftEar.y);
      const distToLeft  = Math.hypot(nose.x-leftEar.x,  nose.y-leftEar.y);
      const distToRight = Math.hypot(nose.x-rightEar.x, nose.y-rightEar.y);
      const ratio       = distToLeft / (distToLeft + distToRight);

      if (earringImg?.complete) {
        const ew = earDist*0.25, eh = (earringImg.height/earringImg.width)*ew;
        const xShift = ew*0.05, totalAngle = physics.earringAngle + physics.swayOffset*0.5;
        if (ratio > 0.25) {
          canvasCtx.save();
          canvasCtx.translate(leftEar.x, leftEar.y);
          canvasCtx.rotate(totalAngle);
          canvasCtx.drawImage(earringImg, (-ew/2)-xShift, -eh*0.20, ew, eh);
          canvasCtx.restore();
        }
        if (ratio < 0.75) {
          canvasCtx.save();
          canvasCtx.translate(rightEar.x, rightEar.y);
          canvasCtx.rotate(totalAngle);
          canvasCtx.drawImage(earringImg, (-ew/2)+xShift, -eh*0.20, ew, eh);
          canvasCtx.restore();
        }
      }

      if (necklaceImg?.complete) {
        const nw = earDist*0.85, nh = (necklaceImg.height/necklaceImg.width)*nw;
        canvasCtx.drawImage(necklaceImg, neck.x-nw/2, neck.y+nw*0.1, nw, nh);
      }
    }
    canvasCtx.restore();
  });

  /* ═══════════════════════════════════════
     11. MEDIAPIPE — HANDS (rings + bangles)
  ═══════════════════════════════════════ */
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
    if (!w || !h) return;

    canvasElement.width = w; canvasElement.height = h;
    canvasCtx.save();
    if (currentCameraMode === 'environment') {
      canvasCtx.scale(1,1);
    } else {
      canvasCtx.translate(w,0); canvasCtx.scale(-1,1);
    }
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
        handSmoother = {
          active: true,
          ring:   { x:mcp.x,   y:mcp.y,   angle:tRingAngle, size:tRingWidth   },
          bangle: { x:wrist.x, y:wrist.y, angle:tArmAngle,  size:tBangleWidth }
        };
      } else {
        handSmoother.ring.x     = lerp(handSmoother.ring.x,     mcp.x,        SMOOTH_FACTOR);
        handSmoother.ring.y     = lerp(handSmoother.ring.y,     mcp.y,        SMOOTH_FACTOR);
        handSmoother.ring.angle = lerp(handSmoother.ring.angle, tRingAngle,   SMOOTH_FACTOR);
        handSmoother.ring.size  = lerp(handSmoother.ring.size,  tRingWidth,   SMOOTH_FACTOR);
        handSmoother.bangle.x     = lerp(handSmoother.bangle.x,     wrist.x,      SMOOTH_FACTOR);
        handSmoother.bangle.y     = lerp(handSmoother.bangle.y,     wrist.y,      SMOOTH_FACTOR);
        handSmoother.bangle.angle = lerp(handSmoother.bangle.angle, tArmAngle,    SMOOTH_FACTOR);
        handSmoother.bangle.size  = lerp(handSmoother.bangle.size,  tBangleWidth, SMOOTH_FACTOR);
      }

      if (ringImg?.complete) {
        const rH = (ringImg.height/ringImg.width)*handSmoother.ring.size;
        canvasCtx.save();
        canvasCtx.translate(handSmoother.ring.x, handSmoother.ring.y);
        canvasCtx.rotate(handSmoother.ring.angle);
        canvasCtx.drawImage(ringImg, -handSmoother.ring.size/2, (handSmoother.ring.size/0.6)*0.15, handSmoother.ring.size, rH);
        canvasCtx.restore();
      }

      if (bangleImg?.complete) {
        const bH = (bangleImg.height/bangleImg.width)*handSmoother.bangle.size;
        canvasCtx.save();
        canvasCtx.translate(handSmoother.bangle.x, handSmoother.bangle.y);
        canvasCtx.rotate(handSmoother.bangle.angle);
        canvasCtx.drawImage(bangleImg, -handSmoother.bangle.size/2, -bH/2, handSmoother.bangle.size, bH);
        canvasCtx.restore();
      }
    }
    canvasCtx.restore();
  });

  /* ═══════════════════════════════════════
     12. CAPTURE & SNAPSHOT
  ═══════════════════════════════════════ */
  function captureToGallery() {
    const c = document.createElement('canvas');
    c.width = videoElement.videoWidth || 1280;
    c.height = videoElement.videoHeight || 720;
    const ctx = c.getContext('2d');

    if (currentCameraMode !== 'environment') {
      ctx.translate(c.width, 0); ctx.scale(-1, 1);
    }
    ctx.drawImage(videoElement, 0, 0);
    ctx.setTransform(1,0,0,1,0,0);
    try { ctx.drawImage(canvasElement, 0, 0); } catch(e) { console.error("AR canvas tainted", e); }

    let cleanName = currentAssetName.replace(/\.(png|jpg|jpeg|webp)$/i,"").replace(/_/g," ");
    cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

    const pad = c.width*0.04, ts = c.width*0.045, ds = c.width*0.035;
    const cH  = ts*2 + ds + pad;
    const grd = ctx.createLinearGradient(0, c.height-cH-pad, 0, c.height);
    grd.addColorStop(0,"rgba(0,0,0,0)"); grd.addColorStop(0.2,"rgba(0,0,0,0.8)"); grd.addColorStop(1,"rgba(0,0,0,0.95)");
    ctx.fillStyle = grd; ctx.fillRect(0, c.height-cH-pad, c.width, cH+pad);
    ctx.font = `bold ${ts}px Cormorant Garamond,serif`; ctx.fillStyle = "#c9a84c"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("Jewels · AI", pad, c.height-cH);
    ctx.font = `${ds}px Montserrat,sans-serif`; ctx.fillStyle = "#ffffff";
    ctx.fillText(cleanName, pad, c.height-cH+ts*1.5);
    if (watermarkImg.complete) {
      const ww=c.width*0.25, wh=(watermarkImg.height/watermarkImg.width)*ww;
      try { ctx.drawImage(watermarkImg, c.width-ww-pad, pad, ww, wh); } catch(e){}
    }
    try { return { url: c.toDataURL('image/png'), name: `Jewels-Ai_${Date.now()}.png` }; }
    catch(e) { console.error("Canvas tainted", e); return null; }
  }

  function takeSnapshot() {
    /* Flash */
    const flash = document.getElementById('flash');
    if (flash) { flash.style.opacity='1'; setTimeout(()=>{flash.style.opacity='0';},140); }
    triggerFlash();

    const d = captureToGallery();
    if (d) {
      currentPreviewData = d;
      window.currentJewelry = window.currentJewelry || '';
      document.getElementById('preview-image').src = d.url;
      document.getElementById('preview-modal').style.display = 'flex';
      if (concierge.active) concierge.speak("Captured!");
    }
  }

  /* ═══════════════════════════════════════
     13. TRY ALL & GALLERY
  ═══════════════════════════════════════ */
  function toggleTryAll() {
    if (!window.JewelsState.currentType) { showToast("Select a category first!"); return; }
    autoTryRunning ? stopAutoTry() : startAutoTry();
  }

  function startAutoTry() {
    autoTryRunning=true; autoSnapshots=[]; autoTryIndex=0;
    const btn = document.getElementById('tryall-btn');
    if (btn) btn.textContent="STOP";
    runAutoStep();
  }

  function stopAutoTry() {
    autoTryRunning=false; clearTimeout(autoTryTimeout);
    const btn = document.getElementById('tryall-btn');
    if (btn) btn.textContent="Try All";
    if (autoSnapshots.length>0) showGallery();
  }

  async function runAutoStep() {
    if (!autoTryRunning) return;
    const assets = JEWELRY_ASSETS[window.JewelsState.currentType];
    if (!assets || autoTryIndex >= assets.length) { stopAutoTry(); return; }
    const asset = assets[autoTryIndex];
    const img   = await loadAsset(asset.fullSrc, asset.id);
    setActiveARImage(img); currentAssetName = asset.name;
    autoTryTimeout = setTimeout(() => {
      triggerFlash();
      const d = captureToGallery();
      if (d) autoSnapshots.push(d);
      autoTryIndex++; runAutoStep();
    }, 1500);
  }

  /* ═══════════════════════════════════════
     14. GALLERY & LIGHTBOX
  ═══════════════════════════════════════ */
  function showGallery() {
    const grid = document.getElementById('gallery-grid');
    grid.innerHTML = '';
    if (!autoSnapshots.length) {
      grid.innerHTML='<p style="color:#888;text-align:center;width:100%;">No items captured.</p>';
    }
    const frag = document.createDocumentFragment();
    autoSnapshots.forEach((item, i) => {
      const card = document.createElement('div'); card.className="gallery-card";
      const img  = document.createElement('img'); img.src=item.url; img.className="gallery-img";
      const ov   = document.createElement('div'); ov.className="gallery-overlay";
      ov.innerHTML = `<div class="overlay-icon">👁️</div>`;
      card.onclick = () => {
        currentLightboxIndex=i;
        document.getElementById('lightbox-image').src=item.url;
        document.getElementById('lightbox-overlay').style.display='flex';
      };
      card.appendChild(img); card.appendChild(ov); frag.appendChild(card);
    });
    grid.appendChild(frag);
    document.getElementById('gallery-modal').style.display='flex';
  }

  function changeLightboxImage(dir) {
    if (!autoSnapshots.length) return;
    currentLightboxIndex = (currentLightboxIndex+dir+autoSnapshots.length) % autoSnapshots.length;
    document.getElementById('lightbox-image').src = autoSnapshots[currentLightboxIndex].url;
  }

  /* ═══════════════════════════════════════
     15. UTILITY
  ═══════════════════════════════════════ */
  function closePreview()  { const m=document.getElementById('preview-modal'); m.classList.remove('open'); m.style.display='none'; }
  function closeGallery()  { document.getElementById('gallery-modal').style.display='none'; }
  function closeLightbox() { document.getElementById('lightbox-overlay').style.display='none'; }

  function showToast(msg) {
    const x = document.getElementById("toast-notification");
    if (!x) return;
    x.innerText = msg; x.classList.add('show');
    setTimeout(() => x.classList.remove("show"), 3000);
  }

  function triggerFlash() {
    if (!flashOverlay) return;
    flashOverlay.classList.remove('flash-active');
    void flashOverlay.offsetWidth;
    flashOverlay.classList.add('flash-active');
    setTimeout(() => flashOverlay.classList.remove('flash-active'), 300);
  }

  function lerp(a, b, t) { return (1-t)*a + t*b; }

  function prepareDailyDrop() {
    if (JEWELRY_ASSETS['earrings']?.length>0) {
      const l=JEWELRY_ASSETS['earrings'];
      const i=Math.floor(Math.random()*l.length);
      dailyItem={item:l[i],index:i,type:'earrings'};
      const di=document.getElementById('daily-img');
      const dn=document.getElementById('daily-name');
      if (di) di.src=dailyItem.item.thumbSrc;
      if (dn) dn.innerText=dailyItem.item.name.replace(/\.(png|jpg|jpeg|webp)$/i,'').replace(/_/g,' ');
    }
  }

  function closeDailyDrop()  { document.getElementById('daily-drop-modal').style.display='none'; }
  function tryDailyItem()    { closeDailyDrop(); if(dailyItem) { selectJewelryType(dailyItem.type).then?.(()=>applyAssetInstantly(dailyItem.item,dailyItem.index,true)) || setTimeout(()=>applyAssetInstantly(dailyItem.item,dailyItem.index,true),600); } }
  function toggleCoShop()    { const m=document.getElementById('coshop-modal'); if(coShop.myId){document.getElementById('invite-link-box').innerText=window.location.origin+window.location.pathname+"?room="+coShop.myId; m.style.display='flex';}else showToast("Generating ID..."); }
  function closeCoShopModal(){ document.getElementById('coshop-modal').style.display='none'; }
  function copyInviteLink()  { navigator.clipboard.writeText(document.getElementById('invite-link-box').innerText).then(()=>showToast("Link Copied!")); }

  async function shareToWhatsApp() {
    const dataUrl = document.getElementById('preview-image').src;
    const blob    = await (await fetch(dataUrl)).blob();
    const file    = new File([blob], 'my_look.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Jewels AI', text: 'My curated look ✨' });
    } else {
      window.open(`https://wa.me/919743600311?text=${encodeURIComponent('Check out my Jewels AI look! ✨')}`, '_blank');
    }
  }

  /* ═══════════════════════════════════════
     16. GLOBAL EXPORTS
  ═══════════════════════════════════════ */
  window.selectJewelryType       = selectJewelryType;
  window.handleCategoryClick     = handleCategoryClick;
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
  window.downloadSingleSnapshot  = () => { if(currentPreviewData.url) saveAs(currentPreviewData.url, currentPreviewData.name); };
  window.shareSingleSnapshot     = () => { if(currentPreviewData.url) fetch(currentPreviewData.url).then(r=>r.blob()).then(b=>navigator.share({files:[new File([b],"look.png",{type:"image/png"})]})); };
  window.downloadAllAsZip        = () => {
    if(autoSnapshots.length>0) {
      const z=new JSZip(); const f=z.folder("Jewels_Collection");
      autoSnapshots.forEach(i=>f.file(i.name,i.url.split(',')[1],{base64:true}));
      z.generateAsync({type:"blob"}).then(c=>saveAs(c,"Jewels.zip"));
    }
  };
  window.changeProduct           = changeProduct;
  window.showToast               = showToast;
  window.closePreview            = closePreview;
  window.closeGallery            = closeGallery;
  window.closeLightbox           = closeLightbox;
  window.changeLightboxImage     = changeLightboxImage;
  window.toggleConciergeMute     = () => concierge.toggle();
  window.initVoiceControl        = initVoiceControl;
  window.toggleVoiceControl      = toggleVoiceControl;
  window.shareToWhatsApp         = shareToWhatsApp;
  </script>

</body>
</html>