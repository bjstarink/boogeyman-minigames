(() => {
  'use strict';
  // Approved BJ Starink effects; do not run on other websites.
  if (!['bjstarink.com', 'www.bjstarink.com'].includes(location.hostname.toLowerCase())) return;
  if (window.__bjstarinkEffectsLoaded) return;
  window.__bjstarinkEffectsLoaded = true;
  const audioBase = 'https://bjstarink.github.io/boogeyman-minigames/';
  const audioContext = typeof window.AudioContext === 'function' ? new window.AudioContext() : null;
  const audioBuffers = Object.create(null);
  const audioBufferPromises = Object.create(null);
  const activeSources = {footsteps: [], screams: [], navigation: []};
  const activeFallbacks = {footsteps: new Set(), screams: new Set(), navigation: new Set()};
  function loadAudioBuffer(filename) {
    if (!audioContext) return Promise.resolve(null);
    if (audioBufferPromises[filename]) return audioBufferPromises[filename];
    audioBufferPromises[filename] = fetch(`${audioBase}${filename}`)
      .then(response => {
        if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(data => audioContext.decodeAudioData(data))
      .then(buffer => { audioBuffers[filename] = buffer; return buffer; })
      .catch(() => { audioBuffers[filename] = null; return null; });
    return audioBufferPromises[filename];
  }
  const footstepBuffer = loadAudioBuffer('bj-footstep-clear.mp3');
  const reviewScreamsBuffer = loadAudioBuffer('bj-chorus-screams.mp3');
  const distantScreamBuffer = loadAudioBuffer('bj-distant-scream.mp3');
  const navigationSplatterBuffer = loadAudioBuffer('bj-blood-splash-impact.mp3');
  function unlockAudio() {
    if (!audioContext) return Promise.resolve(false);
    if (audioContext.state === 'running') return Promise.resolve(true);
    return audioContext.resume().then(() => audioContext.state === 'running').catch(() => false);
  }
  function stopAudioTrack(track) {
    for (const source of [...activeSources[track]]) {
      try { source.stop(); } catch (_) {}
    }
    activeSources[track].length = 0;
    for (const media of [...activeFallbacks[track]]) {
      media.pause();
      media.currentTime = 0;
    }
    activeFallbacks[track].clear();
  }
  function playDecoded(filename, volume, statusKey, bufferPromise) {
    if (muted) return;
    const track = statusKey === 'bjfxFootsteps' ? 'footsteps' :
      statusKey === 'bjfxNavigationAudio' ? 'navigation' : 'screams';
    const fallback = () => {
      if (muted) return;
      try {
        const media = new Audio(`${audioBase}${filename}`);
        media.preload = 'auto';
        media.volume = volume;
        activeFallbacks[track].add(media);
        media.addEventListener('ended', () => activeFallbacks[track].delete(media), {once: true});
        media.play().then(() => { document.documentElement.dataset[statusKey] = 'playing'; })
          .catch(() => { activeFallbacks[track].delete(media); document.documentElement.dataset[statusKey] = 'blocked'; });
      } catch (_) {
        document.documentElement.dataset[statusKey] = 'blocked';
      }
    };
    if (!audioContext) { fallback(); return; }
    Promise.all([unlockAudio(), bufferPromise]).then(([unlocked, buffer]) => {
      if (muted) return;
      if (!unlocked || !buffer || audioContext.state !== 'running') { fallback(); return; }
      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      source.buffer = buffer;
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(audioContext.destination);
      activeSources[track].push(source);
      source.onended = () => {
        source.disconnect();
        const index = activeSources[track].indexOf(source);
        if (index >= 0) activeSources[track].splice(index, 1);
        if (!activeSources[track].length) document.documentElement.dataset[statusKey] = 'stopped';
      };
      source.start(0);
      document.documentElement.dataset[statusKey] = 'playing';
    }).catch(fallback);
  }
  let muted = false;
  const flashlightStorageKey = 'bjstarink-preview-flashlight';
  let flashlightOn = (() => {
    try { return window.localStorage.getItem(flashlightStorageKey) === 'on'; }
    catch (_) { return false; }
  })();
  let scrollIntentUntil = 0;
  let lastFootstep = 0;
  let lastScrollY = window.scrollY;
  let lastScrollAt = performance.now();
  let smoothedScrollSpeed = 0;
  let scrollStopTimer = 0;
  let temporaryLensTimer = 0;

  // Resume a silent Web Audio context only from a real user gesture; no effect autoplays.
  document.addEventListener('pointerdown', event => { if (event.isTrusted) unlockAudio(); }, {capture: true, passive: true});
  document.addEventListener('touchstart', event => { if (event.isTrusted) unlockAudio(); }, {capture: true, passive: true});

  const style = document.createElement('style');
  style.textContent = `
    @keyframes bjfx-text {
      0%,100% { text-shadow: none; }
      24% { text-shadow: 0 0 7px rgba(160,20,32,.72); }
      42% { text-shadow: none; }
      58% { text-shadow: 0 0 4px rgba(195,24,38,.48); }
    }
    @keyframes bjfx-image {
      0%,100% { filter: none; }
      24% { filter: brightness(.58) contrast(1.22); }
      38% { filter: brightness(1.08) contrast(1.08); }
      54% { filter: brightness(.72) contrast(1.18); }
    }
    @keyframes bjfx-control {
      0%,100% { filter: none; }
      30% { filter: brightness(.52); }
      52% { filter: brightness(1.12); }
    }
    @keyframes bjfx-lens-flicker {
      0%,20%,40%,55%,82%,100% {
        background: radial-gradient(circle var(--bjfx-radius) at var(--bjfx-x) var(--bjfx-y), rgba(0,0,0,0) 0 68%, rgba(0,0,0,.4) 79%, rgba(0,0,0,.96) 100%);
      }
      10%,26%,47%,65% { background: rgba(0,0,0,.98); }
    }
    @keyframes bjfx-blood {
      0% { opacity: 0; transform: translate(-50%,-50%) scale(.65); }
      12% { opacity: .88; transform: translate(-50%,-50%) scale(1); }
      58% { opacity: .7; }
      100% { opacity: 0; transform: translate(-50%,-47%) scale(1.04); }
    }
    .bjfx-text { animation: bjfx-text 820ms ease-in-out; }
    .bjfx-image { animation: bjfx-image 760ms ease-in-out; }
    .bjfx-control { animation: bjfx-control 620ms ease-in-out; }
    .bjfx-blood {
      position: fixed; z-index: 2147483646; width: 175px; height: 145px;
      left: var(--bjfx-x); top: var(--bjfx-y);
      pointer-events: none; animation: bjfx-blood 950ms ease-out both;
      filter: drop-shadow(0 2px 2px rgba(0,0,0,.65));
    }
    #bjfx-flashlight {
      position: fixed; inset: 0; z-index: 2147483645; pointer-events: none;
      opacity: 0; transition: opacity 240ms ease;
      --bjfx-x: 50vw; --bjfx-y: 38vh;
      --bjfx-radius: 235px;
      background: radial-gradient(circle var(--bjfx-radius) at var(--bjfx-x) var(--bjfx-y),
        rgba(0,0,0,0) 0 68%,
        rgba(0,0,0,.4) 79%,
        rgba(0,0,0,.96) 100%);
      will-change: opacity, background;
    }
    #bjfx-flashlight.bjfx-flashlight-on,
    #bjfx-flashlight.bjfx-flashlight-success { opacity: 1; }
    #bjfx-flashlight.bjfx-flashlight-flicker { animation: bjfx-lens-flicker 1100ms steps(1,end); }
    #bjfx-flashlight-toggle {
      position: fixed; z-index: 2147483646; right: 14px;
      bottom: max(14px, env(safe-area-inset-bottom));
      min-width: 132px; min-height: 48px; padding: 10px 15px; border: 1px solid rgba(180,61,67,.9);
      border-radius: 4px; background: rgba(18,13,14,.94); color: #f6eded;
      font: inherit; font-size: 13px; font-weight: 600; line-height: 1.2;
      letter-spacing: .02em; cursor: pointer;
      box-shadow: 0 2px 12px rgba(0,0,0,.42); touch-action: manipulation;
    }
    #bjfx-flashlight-toggle:hover, #bjfx-flashlight-toggle:focus-visible {
      background: rgba(57,20,23,.97); outline: 2px solid rgba(224,113,112,.65); outline-offset: 2px;
    }
    @media (max-width: 600px) {
      #bjfx-flashlight { --bjfx-radius: 215px; }
      #bjfx-flashlight-toggle { right: 10px; bottom: max(10px, env(safe-area-inset-bottom)); min-width: 132px; min-height: 48px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .bjfx-text,.bjfx-image,.bjfx-control { animation: none !important; }
      #bjfx-flashlight { transition: none; }
      .bjfx-blood { display: none !important; }
      #bjfx-flashlight.bjfx-flashlight-flicker { animation: none !important; }
    }
  `;
  document.head.appendChild(style);

  const flashlight = document.createElement('div');
  flashlight.id = 'bjfx-flashlight';
  flashlight.setAttribute('aria-hidden', 'true');
  const toggle = document.createElement('button');
  toggle.id = 'bjfx-flashlight-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-pressed', 'false');
  toggle.setAttribute('aria-label', 'Flashlight on');
  toggle.textContent = 'Flashlight on';
  document.body.append(flashlight, toggle);

  function moveBeam(x, y) {
    flashlight.style.setProperty('--bjfx-x', `${Math.max(0, Math.min(window.innerWidth, x))}px`);
    flashlight.style.setProperty('--bjfx-y', `${Math.max(0, Math.min(window.innerHeight, y))}px`);
  }
  function setFlashlight(on, x, y) {
    flashlightOn = on;
    try { window.localStorage.setItem(flashlightStorageKey, on ? 'on' : 'off'); } catch (_) {}
    if (Number.isFinite(x) && Number.isFinite(y)) moveBeam(x, y);
    flashlight.classList.toggle('bjfx-flashlight-on', on);
    toggle.setAttribute('aria-pressed', String(on));
    toggle.setAttribute('aria-label', on ? 'Flashlight off' : 'Flashlight on');
    toggle.textContent = on ? 'Flashlight off' : 'Flashlight on';
    document.documentElement.dataset.bjfxFlashlight = on ? 'on' : 'off';
  }
  setFlashlight(flashlightOn, window.innerWidth / 2, window.innerHeight * .38);
  document.addEventListener('pointermove', event => {
    if (flashlightOn && event.isTrusted) moveBeam(event.clientX, event.clientY);
  }, {passive: true});
  document.addEventListener('touchmove', event => {
    if (flashlightOn && event.isTrusted && event.touches?.length) {
      moveBeam(event.touches[0].clientX, event.touches[0].clientY);
    }
  }, {passive: true});
  document.addEventListener('pointerdown', event => {
    if (flashlightOn && event.isTrusted) moveBeam(event.clientX, event.clientY);
  }, {passive: true});

  // Footsteps are the only sound caused by scrolling; their pace follows measured scroll speed.
  function noteScrollIntent(event) {
    if (event.isTrusted) {
      scrollIntentUntil = Date.now() + 1600;
      unlockAudio();
    }
  }
  document.addEventListener('wheel', noteScrollIntent, {passive: true});
  document.addEventListener('touchmove', noteScrollIntent, {passive: true});
  document.addEventListener('keydown', event => {
    if (['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)) {
      noteScrollIntent(event);
    }
  });
  function footstepIntervalForSpeed(pixelsPerSecond) {
    return Math.round(Math.max(320, Math.min(1220, 1240 - Math.min(pixelsPerSecond, 1750) * .52)));
  }
  document.addEventListener('scroll', event => {
    if (!event.isTrusted || Date.now() > scrollIntentUntil || muted) return;
    const now = performance.now();
    const currentY = window.scrollY;
    const elapsed = Math.max(16, now - lastScrollAt);
    const distance = Math.abs(currentY - lastScrollY);
    lastScrollY = currentY;
    lastScrollAt = now;
    if (distance === 0) return;
    const instantaneousSpeed = distance * 1000 / elapsed;
    smoothedScrollSpeed = smoothedScrollSpeed ? smoothedScrollSpeed * .55 + instantaneousSpeed * .45 : instantaneousSpeed;
    const interval = footstepIntervalForSpeed(smoothedScrollSpeed);
    document.documentElement.dataset.bjfxStepIntervalMs = String(interval);
    window.clearTimeout(scrollStopTimer);
    scrollStopTimer = window.setTimeout(() => {
      smoothedScrollSpeed = 0;
      lastFootstep = 0;
      lastScrollY = window.scrollY;
      lastScrollAt = performance.now();
      document.documentElement.dataset.bjfxFootsteps = 'stopped';
    }, 700);
    if (!lastFootstep || now - lastFootstep >= interval) {
      lastFootstep = now;
      playDecoded('bj-footstep-clear.mp3', 0.82, 'bjfxFootsteps', footstepBuffer);
    }
    }, {passive: true, capture: true});

  // A wet blood-impact sound is limited to actual site-navigation links.
  document.addEventListener('click', event => {
    if (!event.isTrusted || muted || !event.target?.closest) return;
    const link = event.target.closest('nav a[href], .jw-menu-link[href], .jw-menu-copy a[href]');
    if (!link) return;
    playDecoded('bj-blood-splash-impact.mp3', 0.9, 'bjfxNavigationAudio', navigationSplatterBuffer);
  }, true);

  function flashlightFlicker() {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    window.clearTimeout(temporaryLensTimer);
    if (!flashlightOn) flashlight.classList.add('bjfx-flashlight-success');
    flashlight.classList.remove('bjfx-flashlight-flicker');
    void flashlight.offsetWidth;
    flashlight.classList.add('bjfx-flashlight-flicker');
    document.documentElement.dataset.bjfxFlicker = 'active';
    temporaryLensTimer = window.setTimeout(() => {
      flashlight.classList.remove('bjfx-flashlight-success', 'bjfx-flashlight-flicker');
      document.documentElement.dataset.bjfxFlicker = 'stopped';
    }, 1150);
  }
  function bloodSplatter() {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const splatter = document.createElement('div');
    splatter.className = 'bjfx-blood';
    splatter.setAttribute('aria-hidden', 'true');
    splatter.innerHTML = '<svg viewBox="0 0 175 145" width="175" height="145" aria-hidden="true"><g fill="#7d0710"><path d="M76 51 C71 38 66 35 69 27 C73 18 80 31 83 41 C88 27 100 19 102 27 C104 34 97 43 94 50 C105 45 114 46 119 54 C125 64 111 69 101 70 C115 76 119 87 114 91 C107 97 96 88 91 78 C90 96 85 108 78 106 C71 104 75 91 76 78 C67 85 56 92 51 86 C45 79 56 71 67 66 C53 64 47 59 52 53 C57 47 67 50 76 51 Z"/><ellipse cx="35" cy="25" rx="4" ry="7" transform="rotate(-25 35 25)"/><ellipse cx="139" cy="34" rx="3" ry="6" transform="rotate(30 139 34)"/><circle cx="132" cy="103" r="4"/><ellipse cx="49" cy="115" rx="3" ry="7"/><circle cx="153" cy="69" r="2.5"/><circle cx="23" cy="77" r="3"/><ellipse cx="102" cy="124" rx="2.5" ry="5"/></g></svg>';
    flashlight.appendChild(splatter);
    document.documentElement.dataset.bjfxSplatter = 'shown';
    window.setTimeout(() => {
      splatter.remove();
      if (!flashlight.querySelector('.bjfx-blood')) document.documentElement.dataset.bjfxSplatter = 'hidden';
    }, 1000);
  }

  const pendingRatings = new Map();
  const pendingComments = new Map();
  function voteCount(rating) {
    const summary = rating?.querySelector('.jw-element-rating__text--summary');
    const digits = summary?.textContent.replace(/[^0-9]/g, '');
    return digits ? Number(digits) : null;
  }
  function armRating(rating) {
    const content = rating?.querySelector('.jw-element-rating-content');
    const count = voteCount(rating);
    if (!rating?.id || !rating.dataset.jwElementId || !content ||
        content.classList.contains('jw-element-rating--voted') ||
        !content.classList.contains('jw-element-rating--voting-enabled') ||
        !Number.isSafeInteger(count)) return;
    pendingRatings.set(rating.id, {original: rating, count, at: Date.now()});
  }
  function reviewSucceeded() {
    flashlightFlicker();
    bloodSplatter();
    document.documentElement.dataset.bjfxReviewSuccess = 'confirmed';
    if (muted) return;
    playDecoded('bj-chorus-screams.mp3', 0.9, 'bjfxReviewAudio', reviewScreamsBuffer);
    window.setTimeout(() => {
      if (!muted) playDecoded('bj-distant-scream.mp3', 0.68, 'bjfxReviewAudio', distantScreamBuffer);
    }, 160);
  }
  document.addEventListener('click', event => {
    if (!event.isTrusted) return;
    const label = event.target.closest?.('.jw-rating label.jw-element-rating__star');
    if (label) armRating(label.closest('.jw-rating'));
  }, true);
  document.addEventListener('submit', event => {
    if (!event.isTrusted || !event.target?.matches) return;
    const form = event.target;
    if (form.matches('.jw-rating form[name="rating"]')) {
      armRating(form.closest('.jw-rating'));
    } else if (form.matches('.jw-comment-module form[name="comment"]')) {
      const parent = form.parentElement;
      if (parent) pendingComments.set(form, {parent, module: form.closest('.jw-comment-module'), previous: new Set(parent.querySelectorAll('.jw-comment-success')), at: Date.now()});
    }
  }, true);
  new MutationObserver(() => {
    const now = Date.now();
    for (const [id, pending] of pendingRatings) {
      if (now - pending.at > 120000) { pendingRatings.delete(id); continue; }
      const replacement = document.getElementById(id);
      if (!replacement || replacement === pending.original || !replacement.classList.contains('jw-rating')) continue;
      pendingRatings.delete(id);
      const count = voteCount(replacement);
      if (replacement.dataset.jwElementId === pending.original.dataset.jwElementId &&
          replacement.querySelector('.jw-element-rating--voted') && Number.isSafeInteger(count) && count > pending.count) reviewSucceeded();
    }
    for (const [form, pending] of pendingComments) {
      if (now - pending.at > 120000) { pendingComments.delete(form); continue; }
      if (form.isConnected) continue;
      const success = [...pending.parent.querySelectorAll('.jw-comment-success')].find(el => !pending.previous.has(el) && el.textContent.trim());
      if (success) {
        pendingComments.delete(form);
        reviewSucceeded();
      }
    }
  }).observe(document.documentElement, {childList: true, subtree: true});

  function animate(target) {
    const cls = target.matches('img') ? 'bjfx-image' :
      target.matches('h1,h2,h3,p') ? 'bjfx-text' : 'bjfx-control';
    target.classList.remove(cls);
    void target.offsetWidth;
    target.classList.add(cls);
    target.addEventListener('animationend', () => target.classList.remove(cls), {once: true});
    window.setTimeout(() => target.classList.remove(cls), 950);
    document.documentElement.dataset.bjfxLastAnimation = cls;
  }
  document.addEventListener('click', event => {
    if (!event.isTrusted || !event.target?.closest) return;
    const toggleButton = event.target.closest('#bjfx-flashlight-toggle');
    if (toggleButton) {
      setFlashlight(!flashlightOn, window.innerWidth / 2, window.innerHeight * .38);
      if (flashlightOn) flashlightFlicker();
      document.documentElement.dataset.bjfxLastAnimation = 'flashlight';
      return;
    }
    if (flashlightOn) flashlightFlicker();
    if (event.target.closest('input,textarea,select,form,[role="dialog"],video,audio')) return;
    const target = event.target.closest('img,h1,h2,h3,p,a,button,[role="button"]');
    if (!target) return;
    animate(target);
  }, true);
  document.addEventListener('keydown', event => {
    if (!event.isTrusted || event.repeat || event.ctrlKey || event.metaKey || event.altKey ||
        /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName || '')) return;
    if (event.key.toLowerCase() === 'm') {
      muted = !muted;
      if (muted) {
        stopAudioTrack('footsteps');
        stopAudioTrack('screams');
        stopAudioTrack('navigation');
      }
    }
    if (event.key.toLowerCase() === 'f') setFlashlight(!flashlightOn, window.innerWidth / 2, window.innerHeight * .38);
    if (event.key === 'Escape' && flashlightOn) setFlashlight(false);
  });

  window.__bjstarinkApprovedEffects = true;
})();
