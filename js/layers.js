/* ====== Layer Management ====== */
'use strict';
const LN = {A:'A (上)', B:'B (中)', C:'C (下)'};

function buildLL() {
  const el = $('layerList'); el.innerHTML = '';
  [...layerOrder].reverse().forEach(l => {
    const d = document.createElement('div');
    d.className = 'layer-row' + (S.cl===l ? ' on' : '');
    const vis = document.createElement('div');
    vis.className = 'layer-vis' + (cvs[l].style.display!=='none' ? ' on' : '');
    vis.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>';
    vis.onclick = e2 => {
      e2.stopPropagation();
      const on = cvs[l].style.display !== 'none';
      cvs[l].style.display = on ? 'none' : 'block';
      vis.classList.toggle('on', !on);
    };
    d.appendChild(vis);
    const sp = document.createElement('span'); sp.textContent = LN[l]; d.appendChild(sp);
    const acts = document.createElement('div'); acts.className = 'layer-acts';
    [0,1].forEach(ti => {
      const b = document.createElement('button');
      b.innerHTML = ti===0
        ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>';
      b.onclick = e2 => {
        e2.stopPropagation();
        const idx = layerOrder.indexOf(l);
        if (ti===0 && idx<layerOrder.length-1) {
          [layerOrder[idx], layerOrder[idx+1]] = [layerOrder[idx+1], layerOrder[idx]];
          updZO(); buildLL();
        } else if (ti===1 && idx>0) {
          [layerOrder[idx], layerOrder[idx-1]] = [layerOrder[idx-1], layerOrder[idx]];
          updZO(); buildLL();
        }
      };
      acts.appendChild(b);
    });
    d.appendChild(acts);
    d.onclick = () => { S.cl = l; buildLL(); };
    el.appendChild(d);
  });
}
