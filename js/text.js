/* ====== Text Tool ====== */
'use strict';
function initText() {
  $('txOk').onclick = () => {
    const t = $('txIn').value;
    if (t) {
      pU(); const c = curX();
      c.font = `bold ${S.txFs}px 'M PLUS Rounded 1c',sans-serif`;
      c.globalAlpha = S.alpha; c.textBaseline = 'top';
      if ($('txOL').checked) {
        c.strokeStyle = $('txOC').value; c.lineWidth = +$('txOLW').value;
        c.lineJoin = 'round'; c.miterLimit = 2;
        c.strokeText(t, S.txX, S.txY);
      }
      c.fillStyle = S.cc; c.fillText(t, S.txX, S.txY);
      c.globalAlpha = 1; commitUndo(); afterEdit();
    }
    $('txMo').classList.remove('show'); $('txIn').value = '';
  };
  $('txCn').onclick = () => $('txMo').classList.remove('show');
  $('txSz').oninput = e => { S.txFs = +e.target.value; $('txSL').textContent = e.target.value + 'px'; };
  $('txOL').onchange = e => { $('txOLO').style.display = e.target.checked ? 'flex' : 'none'; };
  $('txOLW').oninput = e => { $('txOLWL').textContent = e.target.value + 'px'; };
}
