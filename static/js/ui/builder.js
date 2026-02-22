'use strict';
(function(G){
  const U=G.Utils, C=G.Config, S=G.State, E=G.Engine, R=G.Renderer, TL=G.Timeline, A=G.Audio;
  const UI={};

  const I={
    pen:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>',
    eraser:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.14 3c-.51 0-1.02.2-1.41.59L2.59 14.73a2 2 0 000 2.83l2.58 2.61a2 2 0 002.83 0L19.14 9.03a2 2 0 000-2.83L16.55 3.59A2 2 0 0015.14 3z"/></svg>',
    fill:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.56 8.94L8.94 16.56a1.5 1.5 0 01-2.12 0l-2.38-2.38a1.5 1.5 0 010-2.12L12.06 4.44a1.5 1.5 0 012.12 0l2.38 2.38a1.5 1.5 0 010 2.12z"/><path d="M19 14s3 3.5 3 5a3 3 0 01-6 0c0-1.5 3-5 3-5z" opacity=".5"/></svg>',
    eyedrop:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.71 5.63l-2.34-2.34a1 1 0 00-1.41 0l-3.12 3.12-1.71-1.71-1.41 1.41 1 1L4 14.83V20h5.17l7.72-7.72 1 1 1.41-1.41-1.71-1.71 3.12-3.12a1 1 0 000-1.41z"/></svg>',
    pixel:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h4v4H3zm7 0h4v4h-4zm7 0h4v4h-4zM3 10h4v4H3zm7 0h4v4h-4zM3 17h4v4H3z"/></svg>',
    cp:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8.5 8.5l7 7"/><circle cx="12" cy="3" r="2" fill="currentColor"/></svg>',
    line:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="19" x2="19" y2="5"/></svg>',
    rect:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>',
    circle:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>',
    star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>',
    heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>',
    text:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 4h14v3h-1.5V5.5h-5V18H14v1.5h-4V18h1.5V5.5h-5V7H5V4z"/></svg>',
    select:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3"><rect x="3" y="3" width="18" height="18" rx="1"/></svg>',
    lasso:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 12a5 5 0 10-5 5"/><circle cx="12" cy="17" r="2" fill="currentColor"/></svg>',
    hand:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 9V5a1 1 0 012 0v4h2V3a1 1 0 012 0v6h1V4a1 1 0 012 0v10.5a6.5 6.5 0 01-13 0V9a1 1 0 012 0v4h-1V7a1 1 0 012 0v2z"/></svg>',
    play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    stop:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="12" height="14" rx="1"/></svg>',
    prev:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z"/></svg>',
    next:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>',
    first:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 18l-8.5-6L18 6v12zM8 6H6v12h2z"/></svg>',
    last:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6l8.5 6L6 18V6zm10 0h2v12h-2z"/></svg>',
    undo:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>',
    redo:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.4 10.6C16.55 9 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>',
    canvas_icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>',
    menu:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>',
    timeline:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 6H2v14a2 2 0 002 2h14v-2H4V6zm16-4H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm-8 12.5v-9l6 4.5-6 4.5z"/></svg>',
    eye:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>',
    eye_off:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.8 11.8 0 001 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>',
    photo:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
    merge:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v2H6zm0 4h12v2H6zm0 4h12v2H6z"/></svg>',
    onion:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="12" r="6" opacity=".4"/><circle cx="14" cy="12" r="6"/></svg>',
    grid:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18"/></svg>',
    paper:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>',
    ratio:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 12h18"/></svg>',
    rotate:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.11 8.53L5.7 7.11C4.8 8.27 4.24 9.61 4.07 11h2.02c.14-.87.49-1.72 1.02-2.47zM6.09 13H4.07c.17 1.39.72 2.73 1.62 3.89l1.41-1.42c-.52-.75-.87-1.59-1.01-2.47zM7.1 18.32c1.16.9 2.51 1.44 3.9 1.61V17.9c-.87-.15-1.71-.49-2.46-1.03L7.1 18.32zM13 4.07V1L8.45 5.55 13 10V6.09c2.84.48 5 2.94 5 5.91s-2.16 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93s-3.05-7.44-7-7.93z"/></svg>',
    flipH:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15 21h2v-2h-2v2zm4-12h2V7h-2v2zM3 5v14c0 1.1.9 2 2 2h4v-2H5V5h4V3H5c-1.1 0-2 .9-2 2zm16-2v2h2c0-1.1-.9-2-2-2zm-8 20h2V1h-2v22zm8-6h2v-2h-2v2zM15 5h2V3h-2v2zm4 8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2z"/></svg>',
    flipV:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 15v2h2v-2H3zm12 4v2h2v-2h-2zM5 21c0 1.1.9 2 2 2v-2H5zm14-4v2h2v-2h-2zM5 15v2h2v-2H5zM1 11v2h22v-2H1zm18-4v2h2V7h-2zM5 3v2h2V3H5zm14 0c1.1 0 2 .9 2 2h-2V3zM9 3v2h2V3H9zm4 0v2h2V3h-2z"/></svg>',
    audio:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>',
    save:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>',
    load:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>',
    export_icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>',
    trash:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
    copy:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>',
    paste:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg>',
    add:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
    dup:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm-1 4l6 6v10c0 1.1-.9 2-2 2H7.99C6.89 23 6 22.1 6 21l.01-14c0-1.1.89-2 1.99-2h7zm-1 7h5.5L14 6.5V12z"/></svg>',
    loop:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>',
    rec:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>',
    mic:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>',
    symmetry:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M5 7l7 5-7 5M19 7l-7 5 7 5"/></svg>',
    zoomIn:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z"/></svg>',
    zoomOut:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7V9z"/></svg>',
    fit:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5v4h2V5h4V3H5c-1.1 0-2 .9-2 2zm2 10H3v4c0 1.1.9 2 2 2h4v-2H5v-4zm14 4h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4zm0-16h-4v2h4v4h2V5c0-1.1-.9-2-2-2z"/></svg>',
    zoomSel:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/><rect x="7" y="7" width="5" height="5" rx=".5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 1.5"/></svg>',
    layers:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z"/></svg>',
    up:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>',
    down:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>',
    addMany:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm2 4v-2H3c0 1.1.9 2 2 2zM3 9h2V7H3v2zm12 12h2v-2h-2v2zm4-18H9c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 12H9V5h10v10zm-8 6h2v-2h-2v2zm-4 0h2v-2H7v2z"/></svg>',
    goto:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-4h2V8h-3v2h1v6z"/></svg>',
    clear:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>',
    mix:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>',
    micRec:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>',
    folder:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>',
    playSmall:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    clearSmall:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>',
    note:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>',
  };

  UI.showPage = page => {
    S.currentPage = page;
    ['canvasPage','menuPage','timelinePage'].forEach(id => {
      const el = U.$(id); if(el) el.classList.toggle('active', id === page+'Page');
    });
    ['navCanvas','navMenu','navTimeline'].forEach(id => {
      const el = U.$(id);
      if(el) el.classList.toggle('on', id === 'nav' + page.charAt(0).toUpperCase() + page.slice(1));
    });
    if(page === 'canvas') E.fitView();
    if(page === 'timeline') {
      TL.renderTL();
      UI.updateFrameInfo();
    }
  };

  UI.buildHTML = () => {
    const app = U.$('app');
    app.innerHTML = `
<div class="page active" id="canvasPage">
  <header class="topbar">
    <div class="topbar-left">
      <span class="app-logo">うごくノート</span>
    </div>
    <div class="topbar-center">
      <button class="ctrl-btn" id="prevFrBtn" title="前のコマ">${I.prev}</button>
      <button class="ctrl-btn" id="playBtn" title="再生">${I.play}</button>
      <button class="ctrl-btn" id="stopBtn" style="display:none" title="停止">${I.stop}</button>
      <button class="ctrl-btn" id="nextFrBtn" title="次のコマ">${I.next}</button>
      <span class="frame-info" id="frameCounter"><b id="curF">1</b>/<span id="totF">1</span></span>
    </div>
    <div class="topbar-right">
      <button class="ctrl-btn" id="undoBtn" title="もどる">${I.undo}</button>
      <button class="ctrl-btn" id="redoBtn" title="やりなおし">${I.redo}</button>
    </div>
  </header>

  <div class="viewport" id="viewport">
    <div class="canvas-wrap" id="cw">
      <canvas id="bgC"></canvas><canvas id="lPhoto"></canvas>
      <canvas id="rC"></canvas><canvas id="vC"></canvas>
      <canvas id="rB"></canvas><canvas id="vB"></canvas>
      <canvas id="rA"></canvas><canvas id="vA"></canvas>
      <canvas id="onC"></canvas><canvas id="gridC"></canvas>
      <canvas id="strokeC"></canvas><canvas id="drC"></canvas>
      <canvas id="floatC"></canvas><canvas id="cursorC"></canvas>
      <div id="selBox"></div>
      <svg id="selPath" xmlns="http://www.w3.org/2000/svg"><path id="lassoPath" fill="rgba(255,214,0,.1)" stroke="var(--acc)" stroke-width="2" stroke-dasharray="5 4" d=""/></svg>
    </div>
    <div class="hud-badge left" id="zoomDisp">100%</div>
    <div class="hud-badge right" id="ratioBadge">4:3</div>
    <div class="img-hud" id="imgHud">
      <span>ドラッグで移動 / ピンチで縮小</span>
      <button class="pill-btn sm" id="imgOk">OK</button>
      <button class="pill-btn sm ghost" id="imgCn">もどる</button>
    </div>
    <div class="img-hud" id="transformHud">
      <span>自由変形</span>
      <button class="pill-btn sm" id="tfRotL">↺</button>
      <button class="pill-btn sm" id="tfRotR">↻</button>
      <button class="pill-btn sm" id="tfOk">確定</button>
      <button class="pill-btn sm ghost" id="tfCn">もどる</button>
    </div>
    <button class="sel-zoom-btn" id="selZoomBtn">${I.zoomSel} 選択範囲を拡大</button>
    <div class="zoom-cluster">
      <button class="float-btn" id="zoomInBtn">${I.zoomIn}</button>
      <button class="float-btn" id="zoomOutBtn">${I.zoomOut}</button>
      <button class="float-btn" id="fitViewBtn">${I.fit}</button>
    </div>
  </div>

  <div class="tool-dock" id="toolDock">
    <div class="tool-scroll" id="toolStrip">
      <button class="dock-tool on" data-tool="pen">${I.pen}<span>ペン</span></button>
      <button class="dock-tool" data-tool="eraser">${I.eraser}<span>消しゴム</span></button>
      <button class="dock-tool" data-tool="fill">${I.fill}<span>塗り</span></button>
      <button class="dock-tool" data-tool="eyedrop">${I.eyedrop}<span>スポイト</span></button>
      <button class="dock-tool" data-tool="pixel">${I.pixel}<span>ドット</span></button>
      <button class="dock-tool" data-tool="cpEdit">${I.cp}<span>制御点</span></button>
      <div class="dock-sep"></div>
      <button class="dock-tool" data-tool="line">${I.line}<span>直線</span></button>
      <button class="dock-tool" data-tool="rect">${I.rect}<span>四角</span></button>
      <button class="dock-tool" data-tool="circle">${I.circle}<span>丸</span></button>
      <button class="dock-tool" data-tool="star">${I.star}<span>星</span></button>
      <button class="dock-tool" data-tool="heart">${I.heart}<span>ハート</span></button>
      <div class="dock-sep"></div>
      <button class="dock-tool" data-tool="text">${I.text}<span>文字</span></button>
      <button class="dock-tool" data-tool="select">${I.select}<span>選択</span></button>
      <button class="dock-tool" data-tool="lasso">${I.lasso}<span>なげなわ</span></button>
      <button class="dock-tool" data-tool="hand">${I.hand}<span>移動</span></button>
    </div>
    <div class="quick-strip" id="quickStrip">
      <div class="color-quick" id="colorQuick"></div>
      <input type="color" id="customColor" value="#111111" title="カスタム色">
      <div class="dock-sep-h"></div>
      <div class="size-quick" id="sizeQuick"></div>
      <div class="dock-sep-h"></div>
      <button class="mini-btn" id="addFrameBtn">+コマ</button>
      <button class="mini-btn" id="dupFrameBtn">複製</button>
      <button class="mini-btn" id="flattenVecBtn">ベクター焼付（軽量化）</button>
      <button class="mini-btn del" id="delFrameBtn">削除</button>
    </div>
  </div>
</div>

<div class="page" id="menuPage">
  <header class="topbar">
    <div class="topbar-left"><span class="app-logo">設定メニュー</span></div>
  </header>
  <div class="menu-scroll">
    <section class="card">
      <h3 class="card-title">${I.layers} レイヤー</h3>
      <div id="layerList"></div>
      <div class="card-actions">
        <button class="pill-btn sm" id="addPhotoBtn">${I.photo} 写真</button>
        <button class="pill-btn sm" id="mergeBtn">${I.merge} 結合</button>
      </div>
    </section>
    <section class="card">
      <h3 class="card-title">${I.paper} カラーパレット</h3>
      <div class="color-grid" id="colorGrid"></div>
    </section>
    <section class="card">
      <h3 class="card-title">${I.pen} ペン設定</h3>
      <div class="size-row" id="sizeRow"></div>
      <div class="range-row"><label>不透明度</label><input type="range" id="alphaRange" min="5" max="100" value="100"><span id="alphaLabel">100%</span></div>
      <div class="range-row"><label>なめらかさ</label><input type="range" id="smoothRange" min="0" max="10" value="4"><span id="smoothLabel">4</span></div>
      <div class="chip-row">
        <label class="chip" id="outlineToggle"><input type="checkbox" id="outlineCheck">フチドリ</label>
        <label class="chip" id="fillToggle"><input type="checkbox" id="fillCheck">塗りつぶし</label>
        <label class="chip" id="pressureToggle"><input type="checkbox" id="pressureCheck">筆圧</label>
      </div>
      <div id="outlineOpts" class="sub-opts hide">
        <label>色</label><input type="color" id="outlineColor" value="#FFFFFF">
        <label>幅</label><input type="range" id="outlineWidth" min="1" max="16" value="3" style="width:60px">
      </div>
    </section>
    <section class="card">
      <h3 class="card-title">${I.pixel} ドット絵設定</h3>
      <div class="chip-row">
        <label class="chip" id="pixelModeToggle"><input type="checkbox" id="pixelModeCheck">ドット絵モード</label>
      </div>
      <div class="range-row"><label>ドットサイズ</label><input type="range" id="pixelSizeRange" min="4" max="64" value="16" step="4"><span id="pixelSizeLabel">16px</span></div>
    </section>
    <section class="card">
      <h3 class="card-title">${I.eye} 表示</h3>
      <button class="list-btn" id="onionBtn">${I.onion} オニオンスキン</button>
      <button class="list-btn" id="gridBtn">${I.grid} グリッド</button>
      <button class="list-btn" id="paperBtn">${I.paper} 用紙の色</button>
      <button class="list-btn" id="ratioBtn">${I.ratio} 画面比率</button>
    </section>
    <section class="card">
      <h3 class="card-title">${I.symmetry} 対称</h3>
      <div class="chip-row">
        <button class="chip on" data-sym="none">なし</button>
        <button class="chip" data-sym="h">左右対称</button>
        <button class="chip" data-sym="v">上下対称</button>
        <button class="chip" data-sym="4">4方向</button>
      </div>
    </section>
    <section class="card">
      <h3 class="card-title">${I.rotate} 変形</h3>
      <button class="list-btn" id="rotateBtn">${I.rotate} 回転</button>
      <button class="list-btn" id="flipHBtn">${I.flipH} 左右反転</button>
      <button class="list-btn" id="flipVBtn">${I.flipV} 上下反転</button>
    </section>
    <section class="card">
      <h3 class="card-title">${I.audio} 音声</h3>
      <button class="list-btn" id="audioBtn">${I.audio} 音声設定</button>
    </section>
    <section class="card">
      <h3 class="card-title">${I.save} 保存 / 書き出し</h3>
      <button class="list-btn" id="saveBtn">${I.save} プロジェクト保存</button>
      <button class="list-btn" id="loadBtn">${I.load} プロジェクト読込</button>
      <div class="card-grid">
        <button class="pill-btn sm" id="expFrameBtn">${I.export_icon} PNG</button>
        <button class="pill-btn sm" id="expSvgBtn">${I.export_icon} SVG</button>
        <button class="pill-btn sm" id="expGifBtn">${I.export_icon} GIF</button>
        <button class="pill-btn sm" id="expMp4Btn">${I.export_icon} MP4</button>
        <button class="pill-btn sm" id="expPngBtn">${I.export_icon} PNG連番</button>
      </div>
      <button class="list-btn danger" id="clearAllBtn">${I.trash} すべて消す</button>
    </section>
  </div>
</div>

<div class="page" id="timelinePage">
  <header class="tl-topbar">
    <div class="tl-playback">
      <button class="badge-btn rec" id="recSyncBtn2" title="録音">${I.rec} 録音</button>
      <button class="badge-btn" id="mixerBtn" title="音源設定">${I.mix} 音源</button>
    </div>
    <div class="tl-info">
      <span class="fps-tag"><b id="fpsNum">8</b>fps</span>
      <input type="range" id="fpsRange" min="1" max="30" value="8">
      <span class="frame-info lg" id="frameCounter2"><b id="curF2">1</b>/<span id="totF2">1</span></span>
    </div>
  </header>

  <div class="tl-preview-wrap">
    <canvas id="tlPreviewCanvas" class="tl-preview-canvas" width="320" height="240"></canvas>
  </div>

  <div class="tl-strip-wrap">
    <div class="tl-strip-area" id="tls"></div>
  </div>

  <div class="tl-controls">
    <button class="ugo-btn del" id="tlDelBtn">${I.trash}<span>さくじょ</span></button>
    <button class="ugo-btn" id="tlAddBtn">${I.add}<span>ついか</span></button>
    <button class="ugo-btn" id="cpFrameBtn">${I.copy}<span>コピー</span></button>
    <button class="ugo-btn" id="psFrameBtn">${I.paste}<span>はりつけ</span></button>
    <button class="ugo-btn" id="tlDupBtn">${I.dup}<span>複製</span></button>
    <button class="ugo-btn" id="addManyBtn">${I.addMany}<span>一括追加</span></button>
  </div>

  <div class="tl-bottom-area">
    <div class="tl-nav ugo-style">
      <button class="ugo-nav-btn" id="firstFBtn" title="最初">${I.first}</button>
      <button class="ugo-nav-btn" id="prevFBtn" title="前">${I.prev}</button>
      
      <button class="ugo-nav-btn play-btn" id="tlPlayBtn" title="再生">${I.play}</button>
      <button class="ugo-nav-btn play-btn" id="tlStopBtn" style="display:none" title="停止">${I.stop}</button>
      
      <button class="ugo-nav-btn" id="nextFBtn" title="次">${I.next}</button>
      <button class="ugo-nav-btn" id="lastFBtn" title="最後">${I.last}</button>
      
      <button class="ugo-nav-btn loop-btn" id="loopToggle" title="ループ">${I.loop}</button>
    </div>
    <div class="tl-scrubber" id="scrubTrack">
      <span class="scrub-label" id="scrubStart">1</span>
      <div class="scrub-track"><div class="scrub-fill" id="scrubFill"></div></div>
      <span class="scrub-label" id="scrubEnd">1</span>
    </div>
  </div>
</div>

<nav class="bottom-nav" id="bottomNav">
  <button class="nav-item on" id="navCanvas" data-page="canvas">
    ${I.canvas_icon}<span>キャンバス</span>
  </button>
  <button class="nav-item" id="navMenu" data-page="menu">
    ${I.menu}<span>メニュー</span>
  </button>
  <button class="nav-item" id="navTimeline" data-page="timeline">
    ${I.timeline}<span>タイムライン</span>
  </button>
</nav>

<input type="file" id="imgInput" accept="image/*" style="display:none">
<input type="file" id="projInput" accept=".ugodraw,.ugomemo" style="display:none">

<div class="ctx-menu" id="ctxMenu">
  <div class="ctx-item" data-ctx="undo">${I.undo} もどる</div>
  <div class="ctx-item" data-ctx="redo">${I.redo} やりなおし</div>
  <div class="ctx-item" data-ctx="paste">${I.paste} 貼り付け</div>
  <div class="ctx-item" data-ctx="clear">${I.clear} レイヤー消去</div>
  <div class="ctx-item" data-ctx="eyedrop">${I.eyedrop} スポイト</div>
</div>

<div class="modal" id="selModal"><div class="modal-inner"><h3>選択範囲</h3><div class="modal-btns"><button class="pill-btn" id="selCopyBtn">${I.copy} コピー</button><button class="pill-btn warn" id="selCutBtn">${I.clear} 切り取り</button><button class="pill-btn orange" id="selTransformBtn">${I.rotate} 自由変形</button></div><div class="modal-btns"><button class="pill-btn sm" id="selZoomModalBtn">${I.zoomSel} 選択範囲を拡大</button></div><button class="pill-btn ghost" id="selCancelBtn">とじる</button></div></div>
<div class="modal" id="paperModal"><div class="modal-inner"><h3>用紙の色</h3><div class="paper-grid" id="paperGrid"></div><button class="pill-btn ghost" onclick="this.closest('.modal').classList.remove('show')">とじる</button></div></div>
<div class="modal" id="ratioModal"><div class="modal-inner"><h3>画面比率</h3><div class="ratio-grid" id="ratioGrid"></div><p class="hint">変更するとデータが消えます</p><button class="pill-btn ghost" onclick="this.closest('.modal').classList.remove('show')">とじる</button></div></div>
<div class="modal" id="ratioConfirmModal"><div class="modal-inner"><h3>確認</h3><p style="font-size:11px;margin:6px 0">画面比率を変更すると、すべてのデータが消えます。</p><div class="modal-btns"><button class="pill-btn del" id="ratioConfOk">変更する</button><button class="pill-btn ghost" id="ratioConfNo">もどる</button></div></div></div>
<div class="modal" id="textModal"><div class="modal-inner"><h3>テキスト入力</h3><input type="text" id="textInput" class="modal-input" placeholder="テキストを入力..."><div class="range-row"><label>サイズ</label><input type="range" id="textSize" min="10" max="120" value="28"><span id="textSizeLabel">28px</span></div><div class="chip-row"><label class="chip"><input type="checkbox" id="textOutline" checked>フチあり</label><label class="chip"><input type="checkbox" id="textBold" checked>太字</label></div><div id="textOutlineOpts" class="sub-opts"><label>色</label><input type="color" id="textOutColor" value="#FFFFFF"><label>幅</label><input type="range" id="textOutWidth" min="1" max="20" value="5" style="width:65px"><span id="textOutWidthLabel">5px</span></div><div class="modal-btns"><button class="pill-btn" id="textOk">配置</button><button class="pill-btn ghost" id="textCancel">もどる</button></div></div></div>
<div class="modal" id="audioModal"><div class="modal-inner"><h3>音声設定</h3><div class="card-actions"><button class="pill-btn sm" id="recSyncBtn">${I.mic} 再生しながら録音</button><label class="pill-btn sm" style="cursor:pointer">${I.audio} BGM<input type="file" id="bgmFile" accept="audio/*" style="display:none"></label></div><div class="card-actions"><button class="pill-btn sm ghost" id="prevAudioBtn" disabled>プレビュー</button><button class="pill-btn sm del" id="clearAudioBtn">BGM消去</button></div><div class="range-row"><label>BGM音量</label><input type="range" id="bgmVolRange" min="0" max="100" value="100"><span id="bgmVolLabel">100%</span></div><div class="range-row"><label>効果音量</label><input type="range" id="sfxVolRange" min="0" max="100" value="100"><span id="sfxVolLabel">100%</span></div><hr class="divider"><h4 class="sub-title">コマ効果音</h4><div class="card-actions"><select id="sfxSelect" class="select-input"><option value="">なし</option></select><button class="pill-btn sm ghost" id="sfxPreviewBtn">試聴</button><button class="pill-btn sm" id="sfxAssignBtn">設定</button></div><button class="pill-btn ghost" onclick="this.closest('.modal').classList.remove('show')">とじる</button></div></div>
<div class="modal" id="rotateModal"><div class="modal-inner"><h3>回転</h3><div class="modal-btns"><button class="pill-btn" data-rot="90">右90度</button><button class="pill-btn" data-rot="-90">左90度</button><button class="pill-btn" data-rot="180">180度</button></div><div class="modal-row"><label>角度:</label><input type="number" id="rotAngle" value="45" class="num-input"><button class="pill-btn sm" id="rotCustomBtn">回転</button></div><button class="pill-btn ghost" onclick="this.closest('.modal').classList.remove('show')">とじる</button></div></div>
<div class="modal" id="mergeModal"><div class="modal-inner"><h3>レイヤー結合</h3><div class="modal-btns"><button class="pill-btn" id="mergeDownBtn">下に結合</button><button class="pill-btn warn" id="mergeAllBtn">すべてAに結合</button><button class="pill-btn" id="flattenVecBtn">ベクター焼付</button></div><button class="pill-btn ghost" onclick="this.closest('.modal').classList.remove('show')">とじる</button></div></div>
<div class="modal" id="exportModal"><div class="modal-inner"><h3 id="expTitle">書き出し中...</h3><div class="progress"><div class="progress-fill" id="expBar"></div></div><p id="expMsg" class="hint"></p></div></div>
<div class="modal" id="qualityModal"><div class="modal-inner"><h3>書き出し設定</h3><p id="qualLabel" class="hint">GIF</p><div class="chip-row qual-sel" id="qualSel"><label class="chip on"><input type="radio" name="qual" value="low" checked>低画質</label><label class="chip"><input type="radio" name="qual" value="mid">中画質</label><label class="chip"><input type="radio" name="qual" value="high">高画質</label></div><p class="hint"><span id="qualDur">0.0</span>秒 (<span id="qualFrames">0</span>コマ)</p><div class="modal-btns"><button class="pill-btn" id="qualOk">書き出し</button><button class="pill-btn ghost" onclick="this.closest('.modal').classList.remove('show')">もどる</button></div></div></div>
<div class="modal" id="gotoModal"><div class="modal-inner"><h3>コマ移動</h3><div class="modal-row"><input type="number" id="gotoNum" min="1" value="1" class="num-input lg">/ <span id="gotoMax">1</span></div><div class="modal-btns"><button class="pill-btn" id="gotoOk">移動</button><button class="pill-btn ghost" onclick="this.closest('.modal').classList.remove('show')">とじる</button></div></div></div>
<div class="modal" id="addManyModal"><div class="modal-inner"><h3>コマ一括追加</h3><div class="modal-row"><input type="number" id="addManyNum" min="1" max="200" value="5" class="num-input lg"><span>コマ</span></div><div class="modal-btns"><button class="pill-btn" id="addManyOk">追加</button><button class="pill-btn ghost" onclick="this.closest('.modal').classList.remove('show')">とじる</button></div></div></div>

<div class="modal" id="mixerModal">
  <div class="modal-inner" style="max-width:600px;text-align:left;">
    <h3 style="text-align:center;color:var(--pri);border-bottom:2px solid var(--pri-bg);padding-bottom:5px;margin-bottom:10px;">🎵 音源設定</h3>
    
    <div class="se-mixer-container">
      <div class="se-sources">
        <div class="se-bgm-row">
          <div class="se-header-row">
            <span class="se-label">BGM</span>
            <div class="se-name" id="mixBgmName">なし</div>
          </div>
          <div class="se-acts">
            <label class="mix-btn file" title="読込">
              ${I.folder} <input type="file" id="mixBgmIn" accept="audio/*" style="display:none">
            </label>
            <button class="mix-btn del" id="mixBgmClear" title="消去">${I.trash}</button>
          </div>
        </div>

        ${[0,1,2,3].map(i => `
          <div class="se-channel-row">
            <div class="se-header-row">
              <span class="se-label">SE${i+1}</span>
              <div class="se-name" id="seName${i}">デフォルト</div>
            </div>
            <div class="se-acts">
              <button class="mix-btn rec se-mic" data-ch="${i}" title="録音">${I.micRec}</button>
              <label class="mix-btn file" title="読込">
                ${I.folder} <input type="file" class="se-file-in" data-ch="${i}" accept="audio/*" style="display:none">
              </label>
              <button class="mix-btn play se-play" data-ch="${i}" title="再生">${I.playSmall}</button>
              <button class="mix-btn del se-clear" data-ch="${i}" title="クリア">${I.clearSmall}</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="se-grid-wrap">
        <div class="se-grid-header" id="seGridHeader"></div>
        <div class="se-grid-body" id="seGridBody"></div>
      </div>
    </div>

    <div class="modal-btns" style="justify-content:center;margin-top:10px;">
      <button class="pill-btn ghost" onclick="this.closest('.modal').classList.remove('show')">とじる</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>
<div class="save-ind" id="saveInd">自動保存しました</div>
`;

    buildColorGrid(); buildSizeRow(); buildPaperGrid(); buildRatioGrid(); buildQuickColors(); buildQuickSizes(); populateSFX();
    
    U.$('saveBtn').onclick=()=>G.Storage.saveProjectFile();
    U.$('loadBtn').onclick=()=>U.$('projInput').click();
    U.$('projInput').onchange=e=>{if(e.target.files[0])G.Storage.loadProjectFile(e.target.files[0]);};
    U.$('clearAllBtn').onclick=()=>G.Storage.clearAll();
    U.$('expGifBtn').onclick=()=>G.Export.exportGIF('mid');
    U.$('undoBtn').onclick=()=>E.undo();
    U.$('redoBtn').onclick=()=>E.redo();


    U.$$('[data-tool]').forEach(b=>{
      b.onclick=()=>{
        U.$$('.dock-tool').forEach(t=>t.classList.remove('on'));
        b.classList.add('on');
        S.ct=b.dataset.tool;
        if(S.ct==='cpEdit'){ S.cpMode=!S.cpMode; b.classList.toggle('on',S.cpMode); G.Tools.drawControlPointOverlay(); }
        else { S.cpMode=false; R.contexts.cursorC.clearRect(0,0,S.CW,S.CH); }
      };
    });


    ['navCanvas','navMenu','navTimeline'].forEach(id => {
      U.$(id).onclick = () => UI.showPage(id.replace('nav','').toLowerCase());
    });

    const mxBtn = U.$('mixerBtn');
    if(mxBtn) mxBtn.onclick = () => UI.openMixer();
    UI.setupMixerEvents();
  };

  UI.openMixer = () => {
    U.$('mixerModal').classList.add('show');
    UI.renderMixerGrid();
    S.seNames.forEach((n,i)=>{const el=U.$(`seName${i}`);if(el)el.textContent=S.seBuffers[i]?n:'デフォルト';});
    const bgmName = U.$('mixBgmName');
    if(bgmName) bgmName.textContent = A.bgmBuffer ? '設定済み' : 'なし';
  };

  UI.renderMixerGrid = () => {
    const head = U.$('seGridHeader');
    const body = U.$('seGridBody');
    if(!head || !body) return;
    head.innerHTML = ''; body.innerHTML = '';
    
    const total = S.frames.length;
    const gridWidth = total * 24; 
    head.style.width = gridWidth + 'px';
    body.style.width = gridWidth + 'px';
    
    head.style.gridTemplateColumns = `repeat(${total}, 24px)`;
    body.style.gridTemplateColumns = `repeat(${total}, 24px)`;
    
    S.frames.forEach((_, i) => {
      const n = document.createElement('div');
      n.className = `se-grid-num ${i===S.cf?'cur':''}`;
      n.textContent = i+1;
      n.onclick = () => { TL.switchFrame(i); UI.renderMixerGrid(); };
      head.appendChild(n);
    });

    for(let ch=0; ch<4; ch++){
      S.frames.forEach((fr, f) => {
        const cell = document.createElement('div');
        const isActive = fr.seFlags && fr.seFlags[ch];
        const chClass = `ch${ch}`;
        cell.className = `se-cell ${isActive?'on':''} ${chClass}`;
        
        if(isActive) cell.innerHTML = I.note;

        cell.onclick = () => {
          if(!fr.seFlags) fr.seFlags=[0,0,0,0];
          fr.seFlags[ch] = fr.seFlags[ch] ? 0 : 1;
          
          const nowActive = !!fr.seFlags[ch];
          cell.classList.toggle('on', nowActive);
          cell.innerHTML = nowActive ? I.note : '';
          
          E.markDirty(fr.id, 'sfx');
          if(nowActive) A.playSEChannel(ch);
        };
        body.appendChild(cell);
      });
    }
    const sx = Math.max(0, (S.cf * 24) - 100);
    U.$('.se-grid-wrap').scrollLeft = sx;
  };

  UI.setupMixerEvents = () => {
    U.$$('.se-mic').forEach(b=>{b.onclick=async()=>{b.classList.add('active');await A.recordToChannel(+b.dataset.ch);b.classList.remove('active');U.$(`seName${b.dataset.ch}`).textContent=S.seNames[b.dataset.ch];};});
    U.$$('.se-play').forEach(b=>b.onclick=()=>A.playSEChannel(+b.dataset.ch));
    U.$$('.se-clear').forEach(b=>b.onclick=()=>{A.clearChannel(+b.dataset.ch);U.$(`seName${b.dataset.ch}`).textContent='デフォルト';});
    U.$$('.se-file-in').forEach(i=>i.onchange=async e=>{const f=e.target.files[0];if(!f)return;if(await A.importToChannel(+i.dataset.ch,f))U.$(`seName${i.dataset.ch}`).textContent=S.seNames[i.dataset.ch];i.value='';});
    const bgmIn=U.$('mixBgmIn'); if(bgmIn) bgmIn.onchange=e=>{const f=e.target.files[0];if(f) A.loadBGM(f).then(()=>U.$('mixBgmName').textContent='設定済'); bgmIn.value='';};
    U.$('mixBgmClear').onclick=()=>{A.clearBGM();U.$('mixBgmName').textContent='なし';};
  };

  function buildColorGrid(){const cg=U.$('colorGrid');C.COLORS.forEach(c=>{const d=document.createElement('div');d.className='color-swatch'+(c===S.cc?' on':'');d.style.background=c;if(c==='#FFFFFF')d.style.border='2px solid #999';d.dataset.c=c;d.onclick=()=>{S.cc=c;buildColorGrid();buildQuickColors();};cg.appendChild(d);});}
  function buildSizeRow(){const sr=U.$('sizeRow');[1,2,4,8,16,32,64].forEach(s=>{const d=document.createElement('div');d.className='size-dot'+(s===S.cs?' on':'');d.dataset.size=s;const px=Math.max(6,Math.min(28,s*1.5+4));d.style.width=px+'px';d.style.height=px+'px';d.onclick=()=>{S.cs=s;buildSizeRow();buildQuickSizes();};sr.appendChild(d);});}
  function buildPaperGrid(){const pg=U.$('paperGrid');C.PAPER_COLORS.forEach(c=>{const d=document.createElement('div');d.className='paper-opt'+(c===S.pc?' on':'');d.style.background=c;d.dataset.p=c;d.onclick=()=>{S.pc=c;E.updatePaperColor();buildPaperGrid();};pg.appendChild(d);});}
  function buildRatioGrid(){const rg=U.$('ratioGrid');C.RATIOS.forEach(r=>{const d=document.createElement('div');d.className='ratio-opt'+(r.name===S.ratio?' on':'');d.dataset.r=r.name;d.dataset.w=r.w;d.dataset.h=r.h;const aspect=r.w/r.h;const maxSz=36;let vw,vh;if(aspect>1){vw=maxSz;vh=maxSz/aspect;}else{vh=maxSz;vw=maxSz*aspect;}d.innerHTML=`<div class="rv" style="width:${vw}px;height:${vh}px"></div><span>${r.name}</span>`;d.onclick=()=>{};rg.appendChild(d);});}
  function buildQuickColors(){const qc=U.$('colorQuick');qc.innerHTML='';['#111111','#E02020','#2060E0','#20A020','#F0C000','#FFFFFF'].forEach(c=>{const d=document.createElement('div');d.className='qc'+(c===S.cc?' on':'');d.style.background=c;if(c==='#FFFFFF')d.style.border='1.5px solid #888';d.dataset.c=c;d.onclick=()=>{S.cc=c;buildQuickColors();buildColorGrid();};qc.appendChild(d);});}
  function buildQuickSizes(){const qs=U.$('sizeQuick');qs.innerHTML='';[2,4,8,16].forEach(s=>{const d=document.createElement('div');d.className='qs'+(s===S.cs?' on':'');d.dataset.size=s;const px=Math.max(5,Math.min(16,s+4));d.style.width=px+'px';d.style.height=px+'px';d.onclick=()=>{S.cs=s;buildQuickSizes();buildSizeRow();};qs.appendChild(d);});}
  function populateSFX(){if(!G.Audio)return;const sel=U.$('sfxSelect');G.Audio.getSFXList().forEach(name=>{const opt=document.createElement('option');opt.value=name;opt.textContent=name;sel.appendChild(opt);});}

  UI.buildLayerList = () => {
    const el = U.$('layerList'); if(!el) return;
    el.innerHTML = '';
    S.layerOrder.slice().reverse().forEach(l => {
      const d = document.createElement('div');
      d.className = 'layer-row' + (S.cl === l ? ' on' : '');
      const vis = document.createElement('div');
      const rc = R.getRasterCanvas(l);
      const vc = R.getVectorCanvas(l);
      const isVis = rc && rc.style.display !== 'none';
      vis.className = 'layer-vis' + (isVis ? ' on' : '');
      vis.innerHTML = isVis ? I.eye : I.eye_off;
      vis.onclick = e => { e.stopPropagation(); const newDisp = rc.style.display === 'none' ? 'block' : 'none'; rc.style.display = newDisp; if(vc) vc.style.display = newDisp; vis.className = 'layer-vis' + (newDisp !== 'none' ? ' on' : ''); vis.innerHTML = newDisp !== 'none' ? I.eye : I.eye_off; };
      d.appendChild(vis);
      const sp = document.createElement('span'); sp.textContent = l; d.appendChild(sp);
      const acts = document.createElement('div'); acts.className = 'layer-acts';
      [{icon:I.up, dir:1}, {icon:I.down, dir:-1}].forEach(({icon, dir}) => {
        const b = document.createElement('button'); b.className = 'mini-btn'; b.innerHTML = icon;
        b.style.cssText = 'display:flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0';
        b.querySelector('svg').style.cssText = 'width:14px;height:14px';
        b.onclick = e => { e.stopPropagation(); const idx = S.layerOrder.indexOf(l); if(dir === 1 && idx < S.layerOrder.length - 1){ [S.layerOrder[idx], S.layerOrder[idx+1]] = [S.layerOrder[idx+1], S.layerOrder[idx]]; E.updateLayerZOrder(); UI.buildLayerList(); } else if(dir === -1 && idx > 0){ [S.layerOrder[idx], S.layerOrder[idx-1]] = [S.layerOrder[idx-1], S.layerOrder[idx]]; E.updateLayerZOrder(); UI.buildLayerList(); } };
        acts.appendChild(b);
      });
      d.appendChild(acts);
      d.onclick = () => { S.cl = l; UI.buildLayerList(); };
      el.appendChild(d);
    });
    const pd = document.createElement('div'); pd.className = 'layer-row photo' + (S.cl === 'Photo' ? ' on' : '');
    const pv = document.createElement('div'); pv.className = 'layer-vis' + (R.canvases.lPhoto && R.canvases.lPhoto.style.display !== 'none' ? ' on' : '');
    pv.innerHTML = R.canvases.lPhoto && R.canvases.lPhoto.style.display !== 'none' ? I.eye : I.eye_off;
    pv.onclick = e => { e.stopPropagation(); R.canvases.lPhoto.style.display = R.canvases.lPhoto.style.display === 'none' ? 'block' : 'none'; pv.classList.toggle('on'); pv.innerHTML = R.canvases.lPhoto.style.display !== 'none' ? I.eye : I.eye_off; };
    pd.appendChild(pv); const ps2 = document.createElement('span'); ps2.textContent = '\u5199\u771f'; pd.appendChild(ps2);
    pd.onclick = () => { S.cl = 'Photo'; UI.buildLayerList(); };
    el.appendChild(pd);
  };

  UI.updateFrameInfo = () => {
    ['curF','curF2'].forEach(id => { const el = U.$(id); if(el) el.textContent = S.cf+1; });
    ['totF','totF2'].forEach(id => { const el = U.$(id); if(el) el.textContent = S.frames.length; });
    const fill = U.$('scrubFill'); if(fill) fill.style.width = (S.frames.length > 1 ? (S.cf/(S.frames.length-1)) * 100 : 0) + '%';
    const se = U.$('scrubEnd'); if(se) se.textContent = S.frames.length;
    const ss = U.$('scrubStart'); if(ss) ss.textContent = S.cf+1;

    const pv = U.$('tlPreviewCanvas');
    if(pv && G.Export && G.Export.renderFrameToCtx && S.currentPage === 'timeline'){
      const ctx = pv.getContext('2d');
      const dpr = C.DPR;
      const ratio = S.CW / S.CH;
      const ph = pv.height;
      const pw = ph * ratio;
      const dx = (pv.width - pw) / 2;
      
      ctx.fillStyle = '#CCC';
      ctx.fillRect(0, 0, pv.width, pv.height);
      ctx.fillStyle = '#FFF';
      ctx.fillRect(dx, 0, pw, ph);
      
      G.Export.renderFrameToCtx(ctx, E.curId(), pw, ph);
    }
  };

  UI.initScrubber = () => {
    const track = U.$('scrubTrack'); if(!track) return;
    const seek = e => {
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const frame = Math.round(ratio * (S.frames.length - 1));
      if(frame !== S.cf && G.Timeline) G.Timeline.switchFrame(frame);
    };
    let scrubbing = false;
    track.addEventListener('pointerdown', e => { scrubbing = true; track.setPointerCapture(e.pointerId); seek(e); });
    track.addEventListener('pointermove', e => { if(scrubbing) seek(e); });
    track.addEventListener('pointerup', () => { scrubbing = false; });
  };

  UI.initLoopToggle = () => {
    const btn = U.$('loopToggle'); if(!btn) return;
    btn.onclick = () => { S.loopPlay = !S.loopPlay; btn.classList.toggle('on', S.loopPlay); E.toast(S.loopPlay ? 'ループ ON' : 'ループ OFF'); };
  };

  UI.showSelZoomBtn = show => { const btn = U.$('selZoomBtn'); if(btn) btn.classList.toggle('show', show); };
  UI.zoomToSelection = () => {};

  G.UI = UI;
})(window.UgokuDraw);