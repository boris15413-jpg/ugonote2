/* ====== SNS Share ====== */
'use strict';
function initShare() {
  $('snsShareBtn').onclick = () => $('shareMo').classList.add('show');

  document.querySelectorAll('.share-btn').forEach(btn => {
    btn.onclick = async () => {
      const sns = btn.dataset.sns;
      $('shareMo').classList.remove('show');

      if (sns === 'download') {
        toast('GIF生成中...');
        await doExpGIF('mid');
        return;
      }

      // Generate a GIF blob for sharing
      toast('GIF生成中...');
      snapToCache();
      for (let i = 0; i < S.frames.length; i++) await ensureCached(S.frames[i].id);

      const sc = 1, ow = Math.round(CW*sc), oh = Math.round(CH*sc);
      const delay = Math.round(1000/S.fps);
      const tmp = document.createElement('canvas'); tmp.width = ow; tmp.height = oh;
      const tc = tmp.getContext('2d');
      const framesData = [];
      for (let i = 0; i < S.frames.length; i++) {
        renderFrameEx(tc, S.frames[i].id, ow, oh);
        framesData.push(tc.getImageData(0,0,ow,oh).data.buffer);
      }

      if (!W) { toast('Worker非対応'); return; }

      const res = await wCall({type:'gifEncode', w:ow, h:oh, framesData, delay}, framesData);
      const gifBlob = new Blob([new Uint8Array(res.data)], {type:'image/gif'});

      if (sns === 'clipboard') {
        // Copy GIF download URL to clipboard
        const url = URL.createObjectURL(gifBlob);
        const a = document.createElement('a'); a.href = url; a.download = 'ugonote.gif'; a.click();
        toast('GIFダウンロード完了');
        return;
      }

      // For social sharing, download GIF then open share URL
      const gifUrl = URL.createObjectURL(gifBlob);
      const a = document.createElement('a'); a.href = gifUrl; a.download = 'ugonote.gif'; a.click();

      const shareText = encodeURIComponent('うごくノートで作りました!');

      if (sns === 'twitter') {
        window.open(`https://twitter.com/intent/tweet?text=${shareText}`, '_blank');
        toast('X(Twitter)を開きました - GIFを添付してください');
      } else if (sns === 'line') {
        window.open(`https://social-plugins.line.me/lineit/share?text=${shareText}`, '_blank');
        toast('LINEを開きました');
      }
    };
  });
}
