// Çevrimdışı çalışma: uygulama dosyaları önbelleğe alınır.
// Dosyalardan birini değiştirdiğinizde SURUM'ü artırın ki telefonlar yeni sürümü alsın.
const SURUM='mt-karne-v5';
const DOSYALAR=['./','index.html','app.css','app.js','utm.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','lib/yerlesim.js','lib/html2canvas.min.js','lib/jspdf.umd.min.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(SURUM).then(c=>c.addAll(DOSYALAR)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==SURUM).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  if(new URL(e.request.url).origin!==location.origin)return; // harita karoları doğrudan ağdan
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).catch(()=>caches.match('index.html'))));
});
