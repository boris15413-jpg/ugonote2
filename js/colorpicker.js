/* ====== Color Picker (SV + Hue) ====== */
'use strict';
function initColorPicker() {
  const svCanvas = $('svPicker');
  const hueCanvas = $('hueBar');
  const svCtx = svCanvas.getContext('2d');
  const hueCtx = hueCanvas.getContext('2d');

  drawHueBar();
  drawSVPicker();

  function drawHueBar() {
    const w = hueCanvas.width, h = hueCanvas.height;
    const grad = hueCtx.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 360; i += 30) {
      grad.addColorStop(i/360, `hsl(${i},100%,50%)`);
    }
    hueCtx.fillStyle = grad;
    hueCtx.fillRect(0, 0, w, h);
  }

  function drawSVPicker() {
    const w = svCanvas.width, h = svCanvas.height;
    const imgData = svCtx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const s = x / w, v = 1 - y / h;
        const rgb = hsvToRgb(S.hue, s, v);
        const i = (y * w + x) * 4;
        imgData.data[i] = rgb[0]; imgData.data[i+1] = rgb[1]; imgData.data[i+2] = rgb[2]; imgData.data[i+3] = 255;
      }
    }
    svCtx.putImageData(imgData, 0, 0);
  }

  function hsvToRgb(h, s, v) {
    let r, g, b;
    const i = Math.floor(h / 60) % 6;
    const f = h / 60 - Math.floor(h / 60);
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    switch (i) {
      case 0: r=v; g=t; b=p; break; case 1: r=q; g=v; b=p; break;
      case 2: r=p; g=v; b=t; break; case 3: r=p; g=q; b=v; break;
      case 4: r=t; g=p; b=v; break; case 5: r=v; g=p; b=q; break;
    }
    return [Math.round(r*255), Math.round(g*255), Math.round(b*255)];
  }

  function rgbToHsv(r, g, b) {
    r/=255; g/=255; b/=255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
    let h = 0, s = max === 0 ? 0 : d / max, v = max;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d + 6) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, v];
  }

  function updateFromHSV() {
    const rgb = hsvToRgb(S.hue, S.sat, S.val);
    S.cc = '#' + rgb.map(c => c.toString(16).padStart(2,'0')).join('');
    $('hexInput').value = S.cc;
    $('ccPick').value = S.cc;
    document.querySelectorAll('.color-dot').forEach(x => x.classList.remove('on'));
    updateCursors();
  }

  function updateCursors() {
    const svCur = $('svCursor');
    svCur.style.left = (S.sat * svCanvas.width) + 'px';
    svCur.style.top = ((1 - S.val) * svCanvas.height) + 'px';
    const hueCur = $('hueCursor');
    hueCur.style.left = (S.hue / 360 * hueCanvas.width - 3) + 'px';
  }

  // SV picker interaction
  let svDragging = false;
  const svArea = svCanvas.parentElement;
  svArea.addEventListener('pointerdown', e => {
    svDragging = true; svArea.setPointerCapture(e.pointerId);
    pickSV(e);
  });
  svArea.addEventListener('pointermove', e => { if (svDragging) pickSV(e); });
  svArea.addEventListener('pointerup', () => svDragging = false);
  svArea.addEventListener('pointercancel', () => svDragging = false);

  function pickSV(e) {
    const rect = svCanvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    S.sat = x; S.val = 1 - y;
    updateFromHSV();
  }

  // Hue bar interaction
  let hueDragging = false;
  const hueArea = hueCanvas.parentElement;
  hueArea.addEventListener('pointerdown', e => {
    hueDragging = true; hueArea.setPointerCapture(e.pointerId);
    pickHue(e);
  });
  hueArea.addEventListener('pointermove', e => { if (hueDragging) pickHue(e); });
  hueArea.addEventListener('pointerup', () => hueDragging = false);
  hueArea.addEventListener('pointercancel', () => hueDragging = false);

  function pickHue(e) {
    const rect = hueCanvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    S.hue = x * 360;
    drawSVPicker();
    updateFromHSV();
  }

  // Hex input
  $('hexInput').onchange = e => {
    const hex = e.target.value;
    if (/^#[0-9a-f]{6}$/i.test(hex)) {
      S.cc = hex; $('ccPick').value = hex;
      const r = parseInt(hex.substr(1,2),16), g = parseInt(hex.substr(3,2),16), b = parseInt(hex.substr(5,2),16);
      const [h,s,v] = rgbToHsv(r,g,b);
      S.hue = h; S.sat = s; S.val = v;
      drawSVPicker(); updateCursors();
      document.querySelectorAll('.color-dot').forEach(x => x.classList.remove('on'));
    }
  };

  // Initialize cursors
  updateCursors();

  // Expose for external use
  window.updateSVPickerFromColor = function(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
    const r = parseInt(hex.substr(1,2),16), g = parseInt(hex.substr(3,2),16), b = parseInt(hex.substr(5,2),16);
    const [h,s,v] = rgbToHsv(r,g,b);
    S.hue = h; S.sat = s; S.val = v;
    drawSVPicker(); updateCursors();
    $('hexInput').value = hex;
  };
}
