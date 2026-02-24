/* ====== IndexedDB ====== */
'use strict';
const DB = {
  db: null, NAME: 'UgokuNoteV3', VER: 2, SF: 'frames', SM: 'meta', SG: 'gallery',
  async open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(this.NAME, this.VER);
      r.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(this.SF)) d.createObjectStore(this.SF);
        if (!d.objectStoreNames.contains(this.SM)) d.createObjectStore(this.SM);
        if (!d.objectStoreNames.contains(this.SG)) d.createObjectStore(this.SG);
      };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  async put(s, k, v) {
    if (!this.db) return;
    return new Promise((res, rej) => {
      const t = this.db.transaction(s, 'readwrite');
      t.objectStore(s).put(v, k);
      t.oncomplete = res; t.onerror = () => rej(t.error);
    });
  },
  async get(s, k) {
    if (!this.db) return null;
    return new Promise((res, rej) => {
      const t = this.db.transaction(s, 'readonly');
      const r = t.objectStore(s).get(k);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  },
  async del(s, k) {
    if (!this.db) return;
    return new Promise((res, rej) => {
      const t = this.db.transaction(s, 'readwrite');
      t.objectStore(s).delete(k);
      t.oncomplete = res; t.onerror = () => rej(t.error);
    });
  },
  async clear(s) {
    if (!this.db) return;
    return new Promise((res, rej) => {
      const t = this.db.transaction(s, 'readwrite');
      t.objectStore(s).clear();
      t.oncomplete = res; t.onerror = () => rej(t.error);
    });
  },
  async getAll(s) {
    if (!this.db) return [];
    return new Promise((res, rej) => {
      const t = this.db.transaction(s, 'readonly');
      const r = t.objectStore(s).getAll();
      r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error);
    });
  },
  async getAllKeys(s) {
    if (!this.db) return [];
    return new Promise((res, rej) => {
      const t = this.db.transaction(s, 'readonly');
      const r = t.objectStore(s).getAllKeys();
      r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error);
    });
  },
  // PNG compression for layers
  async compressLayer(imgData) {
    if (!imgData) return null;
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        const oc = new OffscreenCanvas(imgData.width, imgData.height);
        oc.getContext('2d').putImageData(imgData, 0, 0);
        return await oc.convertToBlob({type: 'image/png'});
      }
      const c = document.createElement('canvas');
      c.width = imgData.width; c.height = imgData.height;
      c.getContext('2d').putImageData(imgData, 0, 0);
      return new Promise(r => c.toBlob(r, 'image/png'));
    } catch(e) { return new Blob([imgData.data.buffer]); }
  },
  async decompressLayer(blob, w, h) {
    if (!blob) return null;
    try {
      const bmp = await createImageBitmap(blob);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
      if (bmp.close) bmp.close();
      return x.getImageData(0, 0, w, h);
    } catch(e) {
      const ab = await blob.arrayBuffer();
      return new ImageData(new Uint8ClampedArray(ab), w, h);
    }
  },
  async saveLayer(fid, layer, imgData) {
    const blob = await this.compressLayer(imgData);
    if (blob) await this.put(this.SF, fid + '_' + layer, blob);
    else await this.del(this.SF, fid + '_' + layer);
  },
  async loadLayer(fid, layer, w, h) {
    const blob = await this.get(this.SF, fid + '_' + layer);
    return blob ? this.decompressLayer(blob, w, h) : null;
  },
  async deleteFrame(fid) {
    for (const l of ['A','B','C']) await this.del(this.SF, fid + '_' + l);
  },
  async saveMeta(m) { await this.put(this.SM, 'project', m); },
  async loadMeta() { return this.get(this.SM, 'project'); },
  // Gallery
  async saveGalleryItem(id, data) { await this.put(this.SG, id, data); },
  async getGalleryItem(id) { return this.get(this.SG, id); },
  async deleteGalleryItem(id) { await this.del(this.SG, id); },
  async getGalleryList() {
    const keys = await this.getAllKeys(this.SG);
    const items = [];
    for (const k of keys) {
      const data = await this.get(this.SG, k);
      if (data) items.push({id: k, ...data});
    }
    return items.sort((a,b) => (b.updated||0) - (a.updated||0));
  }
};
