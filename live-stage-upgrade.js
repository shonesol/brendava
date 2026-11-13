/*
 * Live Stage Upgrade for admin.html (Lugoba Miracle Center)
 * Add ONE line just before </body> in admin.html, after the main <script> block:
 *   <script src="live-stage-upgrade.js"></script>
 *
 * Gives the Website Live Studio: large 16:9 stage (9:16 on phones), full screen,
 * zoom, flip camera, mic mute, LIVE / REC badges, viewer count, "viewer joined" notices.
 * No other edits to admin.html are needed.
 */
(function () {
  // Track every peer connection the studio creates (so we can count viewers and swap cameras)
  var pcs = [];
  var NativePC = window.RTCPeerConnection;
  if (NativePC) {
    window.RTCPeerConnection = function () {
      var pc = new (Function.prototype.bind.apply(NativePC, [null].concat([].slice.call(arguments))))();
      pcs.push(pc);
      return pc;
    };
    window.RTCPeerConnection.prototype = NativePC.prototype;
    ['generateCertificate'].forEach(function (k) { if (NativePC[k]) window.RTCPeerConnection[k] = NativePC[k]; });
  }

  function liveViewers() {
    pcs = pcs.filter(function (p) { return p.connectionState !== 'closed'; });
    return pcs.filter(function (p) { return p.connectionState === 'connected'; });
  }

  function ready(fn) {
    if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var video = document.getElementById('studioPreview');
    if (!video) return;

    var css = document.createElement('style');
    css.textContent =
      '.studio-stage{position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden;margin:.8rem 0}' +
      '.studio-stage video{width:100%!important;height:100%!important;max-height:none!important;margin:0!important;border-radius:0!important;aspect-ratio:auto!important;object-fit:contain;transform-origin:center;transition:transform .15s}' +
      '.studio-stage:fullscreen{width:100vw;height:100vh;aspect-ratio:auto;border-radius:0;margin:0}' +
      '@media(max-width:700px){.studio-stage{aspect-ratio:9/16;max-height:80vh}}' +
      '.stage-top{position:absolute;top:10px;left:10px;right:10px;display:flex;gap:6px;flex-wrap:wrap;z-index:3}' +
      '.stage-pill{background:rgba(0,0,0,.55);color:#fff;font-size:.8rem;font-weight:700;padding:.25rem .6rem;border-radius:999px}' +
      '.stage-pill.live{background:#d93025}.stage-pill.rec{background:#8e0000}' +
      '.stage-joins{position:absolute;left:10px;bottom:70px;z-index:3;display:flex;flex-direction:column;gap:6px}' +
      '.stage-join{background:rgba(27,90,57,.85);color:#fff;padding:.3rem .7rem;border-radius:999px;font-size:.82rem}' +
      '.stage-controls{position:absolute;left:0;right:0;bottom:0;z-index:3;display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;padding:10px;background:linear-gradient(transparent,rgba(0,0,0,.7))}' +
      '.stage-controls button{background:rgba(255,255,255,.2);color:#fff;border:0;border-radius:999px;padding:.5rem .8rem;cursor:pointer;font-weight:600}' +
      '.stage-controls input[type=range]{width:120px}';
    document.head.appendChild(css);

    // Build the stage and move the existing <video> into it (keeps its id and stream)
    var stage = document.createElement('div');
    stage.id = 'studioStage';
    stage.className = 'studio-stage';
    video.parentNode.insertBefore(stage, video);
    stage.appendChild(video);

    stage.insertAdjacentHTML('beforeend',
      '<div class="stage-top">' +
        '<span id="stageLive" class="stage-pill live" style="display:none">● LIVE</span>' +
        '<span id="stageRec" class="stage-pill rec" style="display:none">● REC</span>' +
        '<span class="stage-pill">👁 <span id="stageViewers">0</span></span>' +
      '</div>' +
      '<div id="stageJoins" class="stage-joins"></div>' +
      '<div class="stage-controls">' +
        '<button type="button" id="btnFull">⛶ Full screen</button>' +
        '<button type="button" id="btnFlip">⟳ Flip camera</button>' +
        '<button type="button" id="btnMute">🎤 Mic</button>' +
        '<input type="range" id="zoomRange" min="1" max="3" step="0.1" value="1" aria-label="Zoom">' +
      '</div>');

    function stream() { return video.srcObject; }
    function show(id, on) { var e = document.getElementById(id); if (e) e.style.display = on ? '' : 'none'; }

    // Full screen
    document.getElementById('btnFull').addEventListener('click', function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (stage.requestFullscreen) stage.requestFullscreen();
    });

    // Mic mute
    document.getElementById('btnMute').addEventListener('click', function () {
      var s = stream(); if (!s) return;
      var t = s.getAudioTracks(); if (!t.length) return;
      var on = !t[0].enabled;
      t.forEach(function (x) { x.enabled = on; });
      this.textContent = on ? '🎤 Mic' : '🔇 Muted';
    });

    // Zoom (real camera zoom where supported, preview-only otherwise)
    document.getElementById('zoomRange').addEventListener('input', function () {
      var z = parseFloat(this.value), s = stream();
      var vt = s && s.getVideoTracks()[0];
      var caps = (vt && vt.getCapabilities) ? vt.getCapabilities() : {};
      if (caps.zoom) {
        vt.applyConstraints({ advanced: [{ zoom: Math.min(caps.zoom.max, Math.max(caps.zoom.min, z)) }] }).catch(function () {});
        video.style.transform = '';
      } else {
        video.style.transform = 'scale(' + z + ')';
      }
    });

    // Flip camera (front/back), also swaps the track for connected viewers
    var facing = 'user';
    document.getElementById('btnFlip').addEventListener('click', async function () {
      var s = stream(); if (!s) return;
      facing = facing === 'user' ? 'environment' : 'user';
      try {
        var ns = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false
        });
        var nt = ns.getVideoTracks()[0], old = s.getVideoTracks()[0];
        pcs.forEach(function (pc) {
          pc.getSenders().forEach(function (sd) {
            if (sd.track && sd.track.kind === 'video') sd.replaceTrack(nt);
          });
        });
        if (old) { s.removeTrack(old); old.stop(); }
        s.addTrack(nt);
        video.srcObject = s;
        video.play().catch(function () {});
      } catch (err) { alert('Could not switch camera: ' + (err.message || err)); }
    });

    // LIVE / REC badges follow the existing buttons (End enabled = we are live)
    var endBtn = document.getElementById('btnEndNativeLive');
    var recBox = document.getElementById('nativeAlsoRecord');
    function syncBadges() {
      var live = !!(endBtn && !endBtn.disabled);
      show('stageLive', live);
      show('stageRec', live && !!(recBox && recBox.checked));
    }
    if (endBtn) new MutationObserver(syncBadges).observe(endBtn, { attributes: true, attributeFilter: ['disabled'] });
    if (recBox) recBox.addEventListener('change', syncBadges);
    syncBadges();

    // Viewer count + "joined" notices
    var last = 0;
    setInterval(function () {
      var n = liveViewers().length;
      var el = document.getElementById('stageViewers');
      if (el) el.textContent = n;
      if (n > last) {
        for (var i = 0; i < n - last; i++) {
          var box = document.getElementById('stageJoins');
          var d = document.createElement('div');
          d.className = 'stage-join';
          d.textContent = 'A new viewer joined';
          box.appendChild(d);
          setTimeout(function (x) { return function () { x.remove(); }; }(d), 5000);
        }
      }
      last = n;
    }, 1500);
  });
})();
