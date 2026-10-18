/* AgroIA — Íconos (sprite SVG). Se inyecta una sola vez con inyectarIconos(). */
const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="gHoja" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6be585"/><stop offset="1" stop-color="#1fa34a"/></linearGradient>
  </defs>
  <symbol id="i-home" viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h4.5v-6h4v6h4.5V10"/></symbol>
  <symbol id="i-chart" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m7 15 4-4.5 3 3 5-6.5"/></symbol>
  <symbol id="i-doc" viewBox="0 0 24 24"><path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h7"/></symbol>
  <symbol id="i-brain" viewBox="0 0 24 24"><path d="M9.5 4A3 3 0 0 0 6.6 6.2 3.2 3.2 0 0 0 4.5 9.5 3.2 3.2 0 0 0 5.6 12a3.2 3.2 0 0 0 .9 4.6A3 3 0 0 0 9.5 20c1 0 2.5-.5 2.5-1.8V5.8C12 4.5 10.8 4 9.5 4z"/><path d="M14.5 4a3 3 0 0 1 2.9 2.2 3.2 3.2 0 0 1 2.1 3.3 3.2 3.2 0 0 1-1.1 2.5 3.2 3.2 0 0 1-.9 4.6A3 3 0 0 1 14.5 20c-1 0-2.5-.5-2.5-1.8V5.8C12 4.5 13.200 4 14.500 4z"/><path d="M9 9.5h1.500M13.500 9.500H15M9 14h1.500M13.500 14H15"/></symbol>
  <symbol id="i-chat" viewBox="0 0 24 24"><path d="M4 5.5h16V16H10l-4.500 3.500V16H4z"/><path d="M8 9.500h8M8 12.500h5"/></symbol>
  <symbol id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100"/></symbol>
  <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.500"/><path d="m16 16 4.500 4.500"/></symbol>
  <symbol id="i-wifi" viewBox="0 0 24 24"><path d="M2.500 9a14 14 0 0 1 19 0"/><path d="M5.500 12.500a9.500 9.500 0 0 1 13 0"/><path d="M8.500 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.500" r=".8" fill="currentColor"/></symbol>
  <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4.500 20.500a7.500 7.500 0 0 1 15 0z" fill="currentColor"/></symbol>
  <symbol id="i-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
  <symbol id="i-chev-r" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></symbol>
  <symbol id="i-chev-l" viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></symbol>
  <symbol id="i-therm" viewBox="0 0 24 24"><path d="M10 14.500V5.500a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/><path d="M12 9v7"/></symbol>
  <symbol id="i-drop" viewBox="0 0 24 24"><path d="M12 3.500s6 6.200 6 10.800a6 6 0 0 1-12 0C6 9.700 12 3.500 12 3.500z"/><path d="M9.500 14.500a2.500 2.500 0 0 0 2 2.300"/></symbol>
  <symbol id="i-leaf" viewBox="0 0 24 24"><path d="M5 19.500C5 11 10 5 20 4.500c0 10-6 15-14.500 15"/><path d="M5 19.500c3-5.500 6-8.500 10-10.500"/></symbol>
  <symbol id="i-sprout" viewBox="0 0 24 24"><path d="M12 20v-8"/><path d="M12 12c0-4 2.500-6 7-6 0 4-2.500 6-7 6z"/><path d="M12 14.500C12 11.500 10 10 5.500 10c0 3 2 4.500 6.500 4.500z"/><path d="M6 20.500h12"/></symbol>
  <symbol id="i-send" viewBox="0 0 24 24"><path d="M21.500 2.500 10.500 13.500"/><path d="M21.500 2.500 14.500 21.500l-4-8-8-4z"/></symbol>
  <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M20 11.500A8 8 0 1 0 17.500 17"/><path d="M20.500 4.500v7h-7"/></symbol>
  <symbol id="i-expand" viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M10 20H4v-6"/><path d="M20 4l-7 7M4 20l7-7"/></symbol>
  <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
  <symbol id="i-rss" viewBox="0 0 24 24"><path d="M4.500 11a8.500 8.500 0 0 1 8.500 8.500"/><path d="M4.500 4.500A15 15 0 0 1 19.500 19.500"/><circle cx="5.500" cy="18.500" r="1.200" fill="currentColor"/></symbol>
  <symbol id="i-logout" viewBox="0 0 24 24"><path d="M9 4H5v16h4"/><path d="M15 8l4 4-4 4"/><path d="M19 12H9"/></symbol>
  <symbol id="i-login" viewBox="0 0 24 24"><path d="M15 4h4v16h-4"/><path d="M9 8l-4 4 4 4"/><path d="M5 12h10"/></symbol>
  <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
  <symbol id="i-dots" viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.500" fill="currentColor"/><circle cx="12" cy="12" r="1.500" fill="currentColor"/><circle cx="18" cy="12" r="1.500" fill="currentColor"/></symbol>
  <symbol id="i-cal" viewBox="0 0 24 24"><rect x="4" y="5.500" width="16" height="14.500" rx="2.500"/><path d="M4 10h16M8.500 3.500v4M15.500 3.500v4"/></symbol>
  <symbol id="i-flask" viewBox="0 0 24 24"><path d="M9.500 3.500h5"/><path d="M10.500 3.500v6L5 19a1.500 1.500 0 0 0 1.300 2h11.400A1.500 1.500 0 0 0 19 19l-5.500-9.500v-6"/><path d="M7.500 15h9"/></symbol>
  <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/></symbol>
  <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 4v11M7 11l5 5 5-5"/><path d="M5 20h14"/></symbol>
  <symbol id="i-eye" viewBox="0 0 24 24"><path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z"/><circle cx="12" cy="12" r="3"/></symbol>
  <symbol id="i-eye-off" viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.600 6A9.800 9.800 0 0 1 12 5.500c6 0 9.500 6.500 9.500 6.500a17 17 0 0 1-3.200 3.900M6.600 7.600A16.700 16.700 0 0 0 2.500 12S6 18.500 12 18.500a9.500 9.500 0 0 0 4-.9"/><path d="M9.900 9.900a3 3 0 0 0 4.200 4.200"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12.500 4.500 4.500L19 7.500"/></symbol>
  <symbol id="i-bulb" viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3.500a6 6 0 0 0-3.500 10.900c.7.600 1 1.300 1 2.100h5c0-.8.3-1.500 1-2.100A6 6 0 0 0 12 3.500z"/></symbol>
  <symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="10.500" width="14" height="10" rx="2.500"/><path d="M8 10.500V8a4 4 0 0 1 8 0v2.500"/></symbol>
  <symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 16.500V11a6 6 0 0 1 12 0v5.500l1.500 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/></symbol>
  <symbol id="i-ext" viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></symbol>
  <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.500M12 7.500v.1"/></symbol>
  <symbol id="i-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>
  <symbol id="logo-hoja" viewBox="0 0 48 48">
    <path d="M6 41C5 21 18 7 43 5c1 24-12 37-31 37" fill="url(#gHoja)"/>
    <path d="M7 41c7-13 15-22 29-29" fill="none" stroke="#0b3d2a" stroke-width="2" stroke-linecap="round"/>
    <path d="M20 41c0-10 6-17 17-18 0 11-6 18-17 18z" fill="#1c8f46" opacity=".9"/>
  </symbol>
</svg>`;

const ico = (id, cls) => `<svg class="ic ${cls || ""}"><use href="#${id}"/></svg>`;

function inyectarIconos() {
  if (document.getElementById("sprite-agroia")) return;
  const d = document.createElement("div");
  d.id = "sprite-agroia";
  d.innerHTML = SPRITE;
  document.body.insertBefore(d, document.body.firstChild);
}
