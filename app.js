'use strict';
const $=id=>document.getElementById(id), form=$('f');
function toast(t){const e=$('toast');e.textContent=t;e.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('on'),2500)}
function num(v){if(v==null)return NaN;const s=String(v).trim().replace(',','.');return s===''?NaN:Number(s)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function today(){const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)}
function trDate(s){const m=/^(\d{4})-(\d\d)-(\d\d)$/.exec(s||'');return m?`${m[3]}.${m[2]}.${m[1]}`:(s||'')}
function safeName(s){return String(s||'').replace(/[^\wğüşöçıİĞÜŞÖÇ-]+/g,'_')}

// ================= ayarlar (cihazda) =================
const DEF_BASLIK='TATVAN MT KAMPI';
function pref(k,v){try{if(v===undefined)return localStorage.getItem('mt-'+k);localStorage.setItem('mt-'+k,v)}catch(e){return null}}
function defBaslik(){return pref('baslik')||DEF_BASLIK}
function showListTitle(){$('listTitle').textContent=defBaslik()}
$('btnTitle').onclick=()=>{const v=prompt('Karne başlığı (yeni karnelerde kullanılır):',defBaslik());
  if(v!=null&&v.trim()){pref('baslik',v.trim().toLocaleUpperCase('tr'));showListTitle()}};

// ================= IndexedDB =================
function req(r){return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
const DB={
  db:null,
  open(){return new Promise((res,rej)=>{const r=indexedDB.open('mt-karne',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('kayit',{keyPath:'id'});
    r.onsuccess=()=>{this.db=r.result;res()};r.onerror=()=>rej(r.error)})},
  st(mode){return this.db.transaction('kayit',mode).objectStore('kayit')},
  all(){return req(this.st('readonly').getAll())},
  get(id){return req(this.st('readonly').get(id))},
  put(o){return req(this.st('readwrite').put(o))},
  del(id){return req(this.st('readwrite').delete(id))},
};

// ================= uyarı kuralları (formdaki !!Dikkat notlarından) =================
const EL={n:'N',s:'S',e:'E',w:'W'};
function warnings(r){
  const w=[];
  if(!String(r.nokta||'').trim()) w.push('Nokta numarası boş');
  if(!r.zone||!r.enlem||!r.boylam) w.push('Koordinat alınmadı');
  else if(num(r.acc)>10) w.push(`GPS doğruluğu zayıf (±${r.acc} m)`);
  if(r.elle) w.push('Koordinat elle düzeltildi');
  if(num(r.aku)<12) w.push(`Akü gerilimi düşük (${r.aku} V)`);
  for(const d of ['ex','ey']){const D=d==='ex'?'Ex':'Ey';
    if(num(r[d+'_ac'])>=150) w.push(`${D} AC ${r[d+'_ac']} mV ≥ 150 mV: genlik küçük (low) seçilmeli, pot kontrol`);
    if(num(r[d+'_dc'])>=150) w.push(`${D} DC ${r[d+'_dc']} mV ≥ 150 mV: pot sorunlu olabilir, istasyon yeri değişebilir`);
    if(num(r[d+'_k'])>2) w.push(`${D} kontak direnci ${r[d+'_k']} kΩ > 2 kΩ: kurulum hatası olabilir`);
  }
  for(const k in EL) if(num(r[`el_${k}_k`])>=2) w.push(`${EL[k]} elektrot direnci ${r[`el_${k}_k`]} kΩ ≥ 2 kΩ: tuzlu su/çamur, yeni çukur, kablo kontrol`);
  return w;
}
function checkField(el){const v=num(el.value);let bad=false;
  if(el.dataset.max){const m=+el.dataset.max;bad=!isNaN(v)&&(el.dataset.strict?v>m:v>=m)}
  if(el.dataset.min){bad=!isNaN(v)&&v<+el.dataset.min}
  el.classList.toggle('flag',bad)}
function showWarnings(){}
// Dipol uzunlukları elektrod uzaklıklarından: Ex = N+S, Ey = E+W
function sumStr(a,b){const x=num(a),y=num(b);if(isNaN(x)||isNaN(y))return '';return String(Math.round((x+y)*100)/100).replace('.',',')}
function calcLen(){const f=form.elements;f.ex_len.value=sumStr(f.el_n_d.value,f.el_s_d.value);f.ey_len.value=sumStr(f.el_e_d.value,f.el_w_d.value)}

// ================= kroki =================
// 1. dokunuş: kuzey bobini (Hx, K-G doğrultulu), 2. dokunuş: doğu bobini (Hy, D-B doğrultulu).
// Parmak değdiği anda bobin belirir, kaydırınca onunla gider, parmak kalkınca yeri sabitlenir.
// İki bobin yerleşince: bobinin üzerine dokunup sürüklemek onu taşır, başka yere dokunmak serbest çizim yapar.
const cv=$('kroki'), cx=cv.getContext('2d');
let strokes=[], bobin={N:null,E:null}, hist=[], act=null;
const BOB={N:{w:16,l:96,ad:'Hx'},E:{w:16,l:96,ad:'Hy'}};
function clampPt([x,y]){return [Math.max(20,Math.min(580,x)),Math.max(20,Math.min(580,y))]}
function coilRect(k,[x,y]){const b=BOB[k];return k==='N'?[x-b.w/2,y-b.l/2,b.w,b.l]:[x-b.l/2,y-b.w/2,b.l,b.w]}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function drawCoil(ctx,k,p,active){
  const [x,y,w,h]=coilRect(k,p), vert=k==='N';
  ctx.save();
  if(active){ctx.shadowColor='rgba(0,0,0,.35)';ctx.shadowBlur=14}
  const g=vert?ctx.createLinearGradient(x,0,x+w,0):ctx.createLinearGradient(0,y,0,y+h);
  g.addColorStop(0,'#5b6b7d');g.addColorStop(.45,'#c9d3dd');g.addColorStop(1,'#46525f');
  ctx.fillStyle=g;roundRect(ctx,x,y,w,h,Math.min(w,h)/2);ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle='#2c3640';ctx.lineWidth=2;ctx.stroke();
  // uç kapakları
  ctx.fillStyle='#2c3640';
  if(vert){ctx.fillRect(x+2,y+10,w-4,4);ctx.fillRect(x+2,y+h-14,w-4,4)}else{ctx.fillRect(x+10,y+2,4,h-4);ctx.fillRect(x+w-14,y+2,4,h-4)}
  ctx.font='bold 24px sans-serif';ctx.textBaseline='middle';ctx.fillStyle='#1f5fbf';
  if(vert){ctx.textAlign='left';ctx.fillText(BOB[k].ad,x+w+6,y+h/2)}else{ctx.textAlign='center';ctx.fillText(BOB[k].ad,x+w/2,y-16)}
  ctx.restore();
}
function drawKroki(ctx,list,ink,bg,bob,activeKey){
  ctx.clearRect(0,0,600,600); if(bg){ctx.fillStyle=bg;ctx.fillRect(0,0,600,600)}
  ctx.strokeStyle='#888';ctx.fillStyle='#888';ctx.lineWidth=2;ctx.font='bold 34px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.beginPath();ctx.moveTo(300,70);ctx.lineTo(300,530);ctx.moveTo(70,300);ctx.lineTo(530,300);ctx.stroke();
  [[300,70,0,-1],[300,530,0,1],[70,300,-1,0],[530,300,1,0]].forEach(([x,y,dx,dy])=>{ctx.beginPath();ctx.moveTo(x+dx*14,y+dy*14);ctx.lineTo(x-dy*10,y+dx*10);ctx.lineTo(x+dy*10,y-dx*10);ctx.fill()});
  ctx.fillText('N',300,30);ctx.fillText('S',300,572);ctx.fillText('W',28,300);ctx.fillText('E',572,300);
  ctx.strokeStyle=ink;ctx.lineWidth=6;ctx.lineCap='round';ctx.lineJoin='round';
  (list||[]).forEach(s=>{ctx.beginPath();s.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke()});
  for(const k of ['N','E'])if(bob&&bob[k])drawCoil(ctx,k,bob[k],k===activeKey);
}
function krokiHint(){$('krokiHint').textContent=!bobin.N?'Dokunun: kuzey bobini (Hx) yerleşir. Sürükleyip bırakın.'
  :!bobin.E?'Dokunun: doğu bobini (Hy) yerleşir. Sürükleyip bırakın.'
  :'Bobini taşımak için üzerine dokunup sürükleyin; boş yere çizim yapılır.'}
function draw(){drawKroki(cx,strokes,getComputedStyle(document.body).color,null,bobin,act&&act.k);krokiHint()}
function krokiPng(list,bob){const c=document.createElement('canvas');c.width=c.height=600;drawKroki(c.getContext('2d'),list,'#000','#fff',bob);return c.toDataURL('image/png')}
function pt(e){const r=cv.getBoundingClientRect();return [Math.round((e.clientX-r.left)*600/r.width),Math.round((e.clientY-r.top)*600/r.height)]}
function hitCoil(p){for(const k of ['E','N']){const c=bobin[k];if(!c)continue;const [x,y,w,h]=coilRect(k,c);
  if(p[0]>=x-24&&p[0]<=x+w+24&&p[1]>=y-24&&p[1]<=y+h+24)return k}return null}
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);const p=pt(e);
  if(!bobin.N||!bobin.E){const k=!bobin.N?'N':'E';act={t:'coil',k,prev:null};bobin[k]=clampPt(p)}
  else{const k=hitCoil(p);
    if(k)act={t:'coil',k,prev:bobin[k],off:[bobin[k][0]-p[0],bobin[k][1]-p[1]]};
    else{act={t:'stroke',s:[p]};strokes.push(act.s)}}
  draw()});
cv.addEventListener('pointermove',e=>{if(!act)return;const p=pt(e);
  if(act.t==='coil'){const o=act.off||[0,0];bobin[act.k]=clampPt([p[0]+o[0],p[1]+o[1]])}else act.s.push(p);
  draw()});
['pointerup','pointercancel'].forEach(t=>cv.addEventListener(t,()=>{if(!act)return;
  hist.push(act.t==='coil'?{t:'coil',k:act.k,prev:act.prev}:{t:'stroke'});act=null;draw();dirty()}));
$('btnUndo').onclick=()=>{const h=hist.pop();
  if(!h){if(strokes.length)strokes.pop();else if(bobin.E)bobin.E=null;else if(bobin.N)bobin.N=null}
  else if(h.t==='stroke')strokes.pop();else bobin[h.k]=h.prev;
  draw();dirty()};
$('btnClear').onclick=()=>{if((strokes.length||bobin.N||bobin.E)&&confirm('Kroki (bobinler ve çizimler) temizlensin mi?')){strokes=[];bobin={N:null,E:null};hist=[];draw();dirty()}};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',draw);

// ================= kayıt =================
let cur=null, fotos=[], saveT=null;
function data(){const o={};new FormData(form).forEach((v,k)=>{if(typeof v==='string')o[k]=v});o.mt=$('mt').checked;o.elle=$('elle').checked;return o}
function fill(r){
  form.reset();
  for(const k in r){const el=form.elements[k];if(el&&el.type!=='checkbox'&&el.type!=='file'&&typeof r[k]==='string')el.value=r[k]}
  if(!r.datum)$('datum').value='WGS84';
  $('mt').checked=!!r.mt;$('elle').checked=!!r.elle;setElle();
  strokes=r.kroki||[];bobin=Object.assign({N:null,E:null},r.bobin||{});hist=[];act=null;fotos=r.fotos||[];
  calcLen();form.querySelectorAll('[data-max],[data-min]').forEach(checkField);
  draw();renderPhotos();showWarnings();gpsInfoFromRecord(r);showMap(r);
  $('formTitle').textContent=r.nokta||'Yeni karne';
  if(r.lat&&r.mapKaynak!=='osm'&&navigator.onLine)updateMap(false);
}
function dirty(){$('saveState').textContent='…';clearTimeout(saveT);saveT=setTimeout(save,500);showWarnings()}
async function save(){
  clearTimeout(saveT);saveT=null;if(!cur)return;
  Object.assign(cur,data(),{kroki:strokes,bobin,fotos,updated:Date.now()});
  try{await DB.put(cur);$('saveState').textContent='Kaydedildi'}
  catch(e){$('saveState').textContent='KAYDEDİLEMEDİ';toast('Kaydedilemedi: '+e.message)}
}
form.addEventListener('input',e=>{if(e.target.matches('[data-max],[data-min]'))checkField(e.target);
  if(/^el_[nsew]_d$/.test(e.target.name))calcLen();
  if(e.target.name==='nokta')$('formTitle').textContent=e.target.value||'Yeni karne';
  if(e.target.name==='baslik'&&e.target.value.trim())pref('baslik',e.target.value.trim());
  if(e.target.id!=='photoIn')dirty()});
$('btnSave').onclick=async()=>{await save();toast('Kaydedildi')};

function nextNo(no){const m=/^(.*?)(\d+)$/.exec(no||'');if(!m)return '';const n=String(+m[2]+1).padStart(m[2].length,'0');return m[1]+n}
const CARRY=['box','olcen','sensor','hx','hy','hz','plaka','nobetci','telefon','datum','ex_len','ey_len','el_n_d','el_s_d','el_e_d','el_w_d'];
async function newRecord(){
  const all=(await DB.all()).sort((a,b)=>b.updated-a.updated), last=all[0];
  const r={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),created:Date.now(),updated:Date.now(),
    baslik:defBaslik(),tarih:today(),mt:true,sensor:'MTC-150',datum:'WGS84'};
  if(last){CARRY.forEach(k=>{if(last[k])r[k]=last[k]});r.mt=!!last.mt;r.nokta=nextNo(last.nokta)}
  return r;
}

// ================= GPS -> UTM =================
let watchId=null, gpsTimer=null, best=null;
function setElle(){form.querySelectorAll('input.gps').forEach(i=>i.readOnly=!$('elle').checked)}
$('elle').addEventListener('change',setElle);
function gpsInfoFromRecord(r){const i=$('gpsInfo');i.className='';
  if(r.acc){i.textContent=`±${r.acc} m · ${r.lat}, ${r.lon} (WGS84)`;i.className=num(r.acc)<=10?'good':'weak'}
  else i.textContent='GPS ile UTM doldurulur'}
function fillUTM(){const lat=num($('lat').value),lon=num($('lon').value);if(isNaN(lat)||isNaN(lon))return false;
  const u=utmFor(lat,lon,$('datum').value);$('zone').value=u.zone;$('enlem').value=String(u.E);$('boylam').value=String(u.N);return true}
$('datum').addEventListener('change',()=>{
  if($('elle').checked&&$('enlem').value){toast('Koordinat elle girilmiş; yeni datuma göre yeniden “Konumu al” deyin.');return}
  if(fillUTM())toast(`Koordinat ${$('datum').value} datumuna çevrildi`)});
function applyPos(p){const c=p.coords;
  $('lat').value=c.latitude.toFixed(7);$('lon').value=c.longitude.toFixed(7);$('acc').value=String(Math.round(c.accuracy));
  fillUTM();
  if(c.altitude!=null)$('yukseklik').value=String(Math.round(c.altitude));
  $('gpsZaman').value=new Date(p.timestamp).toISOString();$('elle').checked=false;setElle()}
function stopGps(){
  if(watchId!=null)navigator.geolocation.clearWatch(watchId);watchId=null;clearTimeout(gpsTimer);
  $('btnGps').textContent='Konumu al';
  if(best){applyPos(best);gpsInfoFromRecord(data());dirty();
    if(best.coords.altitude==null)$('gpsMsg').textContent='Telefon yükseklik vermedi, elle girin.';
    if(cur){cur.mapImg=null;cur.mapKaynak=null}updateMap(true)}
}
$('btnGps').onclick=()=>{
  $('gpsMsg').textContent='';
  if(watchId!=null){stopGps();return}
  if(!navigator.geolocation){$('gpsMsg').textContent='Bu cihazda konum servisi yok.';return}
  if($('enlem').value&&!confirm('Mevcut koordinat yenisiyle değiştirilsin mi?'))return;
  best=null;$('btnGps').textContent='Durdur';$('gpsInfo').className='';$('gpsInfo').textContent='Konum aranıyor…';
  watchId=navigator.geolocation.watchPosition(p=>{
    if(!best||p.coords.accuracy<best.coords.accuracy)best=p;
    const a=Math.round(best.coords.accuracy);$('gpsInfo').textContent=`±${a} m · iyileştiriliyor… (Durdur ile kabul et)`;
    if(a<=5)stopGps();
  },e=>{
    if(best){stopGps();return}
    stopGps();$('gpsInfo').textContent='GPS ile UTM doldurulur';
    $('gpsMsg').textContent=e.code===1?'Konum izni verilmedi. Telefon ayarlarından bu uygulamaya konum izni (Tam Konum) verin.':'Konum alınamadı: '+e.message;
  },{enableHighAccuracy:true,timeout:30000,maximumAge:0});
  gpsTimer=setTimeout(stopGps,20000);
};

// ================= harita ve yakın yerleşimler =================
const YON=['K','KD','D','GD','G','GB','B','KB'];
function distBear(la1,lo1,la2,lo2){const R=6371,r=Math.PI/180,dla=(la2-la1)*r,dlo=(lo2-lo1)*r;
  const a=Math.sin(dla/2)**2+Math.cos(la1*r)*Math.cos(la2*r)*Math.sin(dlo/2)**2,d=2*R*Math.asin(Math.sqrt(a));
  const y=Math.sin(dlo)*Math.cos(la2*r),x=Math.cos(la1*r)*Math.sin(la2*r)-Math.sin(la1*r)*Math.cos(la2*r)*Math.cos(dlo);
  const b=(Math.atan2(y,x)/r+360)%360;return {d,b,yon:YON[Math.round(b/45)%8]}}
function nearest(lat,lon,n=4){if(typeof YERLESIM==='undefined')return [];
  return YERLESIM.map(([ad,la,lo])=>({ad,la,lo,...distBear(lat,lon,la,lo)})).sort((a,b)=>a.d-b.d).slice(0,n)}
function yakinText(r){const lat=num(r.lat),lon=num(r.lon);if(isNaN(lat))return [];
  return nearest(lat,lon).map(p=>`${p.ad}: ${p.d.toFixed(1).replace('.',',')} km ${p.yon}`)}

const TILE=256, ZOOM=14, MW=768, MH=384;
function loadImg(src,ms){return new Promise((res,rej)=>{const i=new Image();i.crossOrigin='anonymous';
  const t=setTimeout(()=>{i.src='';rej(new Error('zaman aşımı'))},ms);
  i.onload=()=>{clearTimeout(t);res(i)};i.onerror=()=>{clearTimeout(t);rej(new Error('yüklenemedi'))};i.src=src})}
function marker(ctx,x,y){ctx.fillStyle='#d32f2f';ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,9,0,7);ctx.fill();ctx.stroke()}
async function osmMap(lat,lon){
  const n=2**ZOOM, wx=(lon+180)/360*n*TILE, s=Math.log(Math.tan(Math.PI/4+lat*Math.PI/360)), wy=(1-s/Math.PI)/2*n*TILE;
  const x0=wx-MW/2,y0=wy-MH/2, c=document.createElement('canvas');c.width=MW;c.height=MH;const ctx=c.getContext('2d');
  const jobs=[];
  for(let tx=Math.floor(x0/TILE);tx<=Math.floor((x0+MW)/TILE);tx++)for(let ty=Math.floor(y0/TILE);ty<=Math.floor((y0+MH)/TILE);ty++)
    jobs.push(loadImg(`https://tile.openstreetmap.org/${ZOOM}/${tx}/${ty}.png`,10000).then(i=>ctx.drawImage(i,tx*TILE-x0,ty*TILE-y0)));
  await Promise.all(jobs);
  marker(ctx,MW/2,MH/2);
  // ölçek: 1 km
  const mpp=156543.03*Math.cos(lat*Math.PI/180)/n, px=1000/mpp;
  ctx.fillStyle='rgba(255,255,255,.85)';ctx.fillRect(8,MH-34,px+16,26);ctx.fillRect(MW-196,MH-20,196,20);
  ctx.strokeStyle='#000';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(16,MH-14);ctx.lineTo(16+px,MH-14);ctx.stroke();
  ctx.fillStyle='#000';ctx.font='13px sans-serif';ctx.textAlign='left';ctx.fillText('1 km',18,MH-20);
  ctx.fillText('© OpenStreetMap katkıcıları',MW-190,MH-6);
  return c.toDataURL('image/jpeg',0.82);
}
function schemaMap(lat,lon){
  const c=document.createElement('canvas');c.width=MW;c.height=MH;const ctx=c.getContext('2d'),cx0=MW/2,cy0=MH/2;
  ctx.fillStyle='#f6f4ee';ctx.fillRect(0,0,MW,MH);
  const near=nearest(lat,lon,8), maxD=Math.max(5,...near.slice(0,5).map(p=>p.d)), sc=(MH/2-30)/maxD;
  ctx.strokeStyle='#c9c4b5';ctx.setLineDash([4,4]);ctx.lineWidth=1;ctx.fillStyle='#8a8370';ctx.font='12px sans-serif';
  const step=maxD>40?20:maxD>15?10:5;
  for(let r=step;r<=maxD*1.4;r+=step){ctx.beginPath();ctx.arc(cx0,cy0,r*sc,0,7);ctx.stroke();ctx.fillText(r+' km',cx0+r*sc*0.71+3,cy0-r*sc*0.71)}
  ctx.setLineDash([]);
  ctx.font='bold 14px sans-serif';
  near.forEach(p=>{const a=p.b*Math.PI/180,x=cx0+Math.sin(a)*p.d*sc,y=cy0-Math.cos(a)*p.d*sc;
    if(x<0||x>MW||y<0||y>MH)return;
    ctx.fillStyle='#333';ctx.beginPath();ctx.arc(x,y,5,0,7);ctx.fill();ctx.fillText(p.ad,x+8,y+5)});
  marker(ctx,cx0,cy0);
  ctx.fillStyle='#333';ctx.font='bold 16px sans-serif';ctx.fillText('K ↑',MW-40,22);
  ctx.font='12px sans-serif';ctx.fillStyle='#8a8370';ctx.fillText('Şematik (internetsiz): ilçe/belde merkezleri',8,MH-8);
  return c.toDataURL('image/jpeg',0.85);
}
function mapFor(r){const lat=num(r.lat),lon=num(r.lon);if(isNaN(lat))return null;return r.mapImg||schemaMap(lat,lon)}
function showMap(r){
  const lat=num(r.lat),lon=num(r.lon),img=$('mapImg');
  $('mapEmpty').hidden=!isNaN(lat);img.hidden=isNaN(lat);
  if(isNaN(lat)){$('mapNote').textContent='';return}
  img.src=mapFor(r);
  $('mapNote').textContent=r.mapKaynak==='osm'?'Harita OpenStreetMap’ten internet varken alındı ve karneye kaydedildi; internetsiz de görünür.'
    :'İnternet yok: şematik gösterim. İnternet olduğunda “Haritayı yenile” ile gerçek harita karneye kaydedilir.';
}
let mapBusy=false;
async function updateMap(loud){
  if(!cur||mapBusy)return;const lat=num($('lat').value),lon=num($('lon').value);
  if(isNaN(lat)){showMap(cur);if(loud)toast('Önce konumu alın');return}
  mapBusy=true;$('btnMap').textContent='Harita alınıyor…';
  try{const id=cur.id,img=await osmMap(lat,lon);if(!cur||cur.id!==id)return;
    cur.mapImg=img;cur.mapKaynak='osm';cur.mapLat=lat;cur.mapLon=lon;await save();showMap(cur)}
  catch(e){if(cur){cur.mapImg=null;cur.mapKaynak='sema';showMap(Object.assign({},cur,data()))}
    if(loud)toast('Harita indirilemedi (internet yok?). Şematik gösteriliyor.')}
  finally{mapBusy=false;$('btnMap').textContent='Haritayı yenile'}
}
$('btnMap').onclick=()=>updateMap(true);

// ================= fotoğraflar =================
function resize(file,max=1600){return new Promise((res,rej)=>{const u=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{const s=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');
    c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    URL.revokeObjectURL(u);res(c.toDataURL('image/jpeg',0.8))};
  img.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('Resim okunamadı'))};img.src=u})}
function renderPhotos(){$('photos').innerHTML=fotos.map((f,i)=>`<div class="ph"><img src="${f}" alt="Fotoğraf ${i+1}"><button type="button" data-i="${i}" aria-label="Sil">×</button></div>`).join('')}
$('photos').onclick=e=>{const b=e.target.closest('button');if(b&&confirm('Fotoğraf silinsin mi?')){fotos.splice(+b.dataset.i,1);renderPhotos();dirty()}};
$('photoIn').onchange=async e=>{for(const f of e.target.files){try{fotos.push(await resize(f))}catch(err){toast(err.message)}}
  e.target.value='';renderPhotos();dirty()};

// ================= liste =================
async function renderList(){
  showListTitle();
  const q=$('search').value.trim().toLocaleLowerCase('tr'), everything=await DB.all();
  const all=everything.sort((a,b)=>b.updated-a.updated)
    .filter(r=>!q||[r.nokta,r.olcen,r.mevki,r.box].join(' ').toLocaleLowerCase('tr').includes(q));
  $('empty').hidden=!!all.length||!!q;
  $('list').innerHTML=all.map(r=>{
    return `<button type="button" class="card" data-id="${esc(r.id)}"><div class="t"><span>${esc(r.nokta||'(numarasız)')}</span></div>
    <div class="s">${esc(trDate(r.tarih))} · ${r.zone?esc(`${r.datum||'WGS84'} ${r.zone} ${r.enlem} D / ${r.boylam} K`):'koordinat yok'}</div>
    <div class="s">${esc([r.olcen,r.mevki].filter(Boolean).join(' · '))}</div></button>`}).join('');
  let usage='';
  try{if(navigator.storage&&navigator.storage.estimate){const e=await navigator.storage.estimate();usage=` · ${(e.usage/1048576).toFixed(1)} MB kullanılıyor`}}catch(e){}
  $('storageInfo').textContent=`${everything.length} karne${usage}`;
}
$('list').onclick=e=>{const c=e.target.closest('.card');if(c)location.hash='k='+c.dataset.id};
$('search').oninput=renderList;
$('btnNew').onclick=async()=>{cur=await newRecord();location.hash='k='+cur.id};
$('btnBack').onclick=async()=>{await flush();location.hash=''};
$('btnDelete').onclick=async()=>{if(cur&&confirm(`${cur.nokta||'Bu karne'} silinsin mi? Geri alınamaz.`)){await DB.del(cur.id);cur=null;location.hash='';toast('Silindi')}};

async function flush(){if(watchId!=null)stopGps();if(saveT)await save()}
async function route(){
  const m=/^#k=(.+)$/.exec(location.hash);
  if(m){
    if(!cur||cur.id!==m[1]){const r=await DB.get(m[1]);if(!r){location.hash='';return}cur=r}
    $('vList').hidden=true;$('vForm').hidden=false;fill(cur);$('saveState').textContent='';scrollTo(0,0);
  }else{
    await flush();cur=null;$('vForm').hidden=true;$('vList').hidden=false;renderList();
  }
}
addEventListener('hashchange',route);
addEventListener('pagehide',()=>{if(saveT)save()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&saveT)save()});

// ================= dosya verme =================
function blobToB64(blob){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(',')[1]);fr.onerror=()=>rej(fr.error);fr.readAsDataURL(blob)})}
function download(file){const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=file.name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),60000)}
async function shareOrDownload(file){
  if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:file.name});return}catch(e){if(e.name==='AbortError')return}}
  download(file);
}
async function giveFile(name,content,type){
  if(window.Android&&Android.saveFile&&typeof content==='string'){Android.saveFile(name,type,content);return}
  const blob=content instanceof Blob?content:new Blob([content],{type});
  if(window.Android&&Android.saveBase64){Android.saveBase64(name,type,await blobToB64(blob));return}
  await shareOrDownload(new File([blob],name,{type}));
}
// Uzun işlemden sonra paylaşım için yeni bir dokunuş gerekir (iOS kuralı): "PDF hazır" penceresi.
function readyDialog(file){
  const b=$('busy');b.hidden=false;
  b.innerHTML=`<div><p style="margin:0 0 10px">${esc(file.name)} hazır.</p><div class="btns"><button type="button" id="rdShare">Paylaş / Kaydet</button><button type="button" class="sec" id="rdClose">Kapat</button></div></div>`;
  $('rdShare').onclick=async()=>{await shareOrDownload(file);b.hidden=true};
  $('rdClose').onclick=()=>{b.hidden=true};
}

// ================= CSV / yedek =================
const COLS=[['Karne başlığı','baslik'],['Nokta','nokta'],['Box Seri No','box'],['Tarih',r=>trDate(r.tarih)],['MT',r=>r.mt?'X':''],['Ölçüyü Alan','olcen'],
  ['Datum',r=>r.datum||'WGS84'],['UTM Zon','zone'],['Doğu (D)','enlem',1],['Kuzey (K)','boylam',1],['Yükseklik (m)','yukseklik',1],['Akü (V)','aku',1],['Mevkii','mevki'],
  ['Enlem WGS84 (°)','lat',1],['Boylam WGS84 (°)','lon',1],['GPS doğruluk (m)','acc',1],['GPS zamanı','gpsZaman'],['Koordinat elle',r=>r.elle?'Evet':''],
  ['Ex uzunluk (m)','ex_len',1],['Ey uzunluk (m)','ey_len',1],['Ex AC (mV)','ex_ac',1],['Ey AC (mV)','ey_ac',1],['Ex DC (mV)','ex_dc',1],['Ey DC (mV)','ey_dc',1],['Ex kΩ','ex_k',1],['Ey kΩ','ey_k',1],
  ['Sensör','sensor'],['Hx','hx'],['Hy','hy'],['Hz','hz'],
  ...Object.entries(EL).flatMap(([k,n])=>[[`${n} direnç kΩ`,`el_${k}_k`,1],[`${n} MTU uzaklık (m)`,`el_${k}_d`,1]]),
  ['Araç Plakası','plaka'],['Nöbetçi','nobetci'],['Telefon','telefon'],['Notlar','notlar'],['Fotoğraf sayısı',r=>String((r.fotos||[]).length)]];
function cell(r,[,k,isNum]){let v=typeof k==='function'?k(r):(r[k]??'');v=String(v);
  if(isNum)v=v.replace('.',',');return /[;"\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
const byDate=(a,b)=>(a.tarih||'').localeCompare(b.tarih||'')||(a.created-b.created);
$('btnCsv').onclick=async()=>{const all=(await DB.all()).sort(byDate);
  if(!all.length){toast('Kayıt yok');return}
  const csv='﻿'+[COLS.map(c=>c[0]).join(';'),...all.map(r=>COLS.map(c=>cell(r,c)).join(';'))].join('\r\n');
  giveFile(`mt_karneler_${today()}.csv`,csv,'text/csv')};
$('btnBackup').onclick=async()=>{const all=await DB.all();if(!all.length){toast('Kayıt yok');return}
  giveFile(`mt_karne_yedek_${today()}.json`,JSON.stringify({app:'mt-karne',surum:2,tarih:new Date().toISOString(),kayitlar:all}),'application/json')};
$('btnRestore').onclick=()=>$('restoreFile').click();
$('restoreFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const j=JSON.parse(await f.text()),list=Array.isArray(j)?j:j.kayitlar;
    if(!Array.isArray(list))throw new Error('Yedek dosyası tanınmadı');
    const valid=list.filter(r=>r&&typeof r.id==='string');
    if(!confirm(`${valid.length} karne yüklensin mi? Aynı karneler üzerine yazılır.`))return;
    for(const r of valid)await DB.put(r);toast(`${valid.length} karne yüklendi`);renderList();
  }catch(err){toast('Yüklenemedi: '+err.message)}};

// ================= PDF (telefonda üretilir: html2canvas + jsPDF) =================
function page(r){
  const v=k=>esc(r[k]),map=mapFor(r);
  return `<div class="pg"><h1>${esc(r.baslik||DEF_BASLIK)}</h1>
  <table><tr><th>Nokta No</th><td>${v('nokta')}</td><th>Box Seri No</th><td>${v('box')}</td><th>Tarih</th><td>${esc(trDate(r.tarih))}</td></tr>
  <tr><th>MT</th><td>${r.mt?'☒':'☐'}</td><th>Ölçüyü Alan</th><td colspan="3">${v('olcen')}</td></tr></table>
  <div class="two"><table>
    <tr><th>Datum / Zon</th><td>${esc(r.datum||'WGS84')} · UTM ${v('zone')}</td></tr>
    <tr><th>Enlem (UTM)</th><td>${v('enlem')} D</td></tr>
    <tr><th>Boylam (UTM)</th><td>${v('boylam')} K</td></tr>
    <tr><th>Yükseklik</th><td>${v('yukseklik')} m</td></tr>
    <tr><th>Akü gerilimi</th><td>${v('aku')} V</td></tr>
    <tr><th>Mevkii</th><td>${v('mevki')}</td></tr>
    <tr><th>GPS (WGS84)</th><td>${r.acc?`±${v('acc')} m · ${v('lat')}, ${v('lon')}${r.elle?' · elle düzeltildi':''}`:''}</td></tr>
  </table><img class="kr" src="${krokiPng(r.kroki,r.bobin)}" alt=""></div>
  <table><tr><th>Dipol aralığı</th><th>Ex</th><th>Ey</th><th>Sensörler</th><th>Hx</th><th>Hy</th><th>Hz</th></tr>
    <tr><th>Uzunluk (m)</th><td>${v('ex_len')}</td><td>${v('ey_len')}</td><td>${v('sensor')}</td><td>${v('hx')}</td><td>${v('hy')}</td><td>${v('hz')}</td></tr>
    <tr><th>AC (mV)</th><td>${v('ex_ac')}</td><td>${v('ey_ac')}</td><td colspan="4" rowspan="3" class="notes"><b>Notlar:</b> ${v('notlar').replace(/\n/g,'<br>')}</td></tr>
    <tr><th>DC (mV)</th><td>${v('ex_dc')}</td><td>${v('ey_dc')}</td></tr>
    <tr><th>kΩ</th><td>${v('ex_k')}</td><td>${v('ey_k')}</td></tr></table>
  <div class="bottom"><div class="left">
    <table><tr><th>Elektrodlar</th><th>Toprakla pot arası direnç kΩ</th><th>MTU'ya uzaklık (m)</th></tr>
    ${Object.entries(EL).map(([k,n])=>`<tr><th>${n}</th><td>${v(`el_${k}_k`)}</td><td>${v(`el_${k}_d`)}</td></tr>`).join('')}</table>
    <table><tr><th style="width:34%">Araç Plakası</th><td>${v('plaka')}</td></tr>
    <tr><th>Nöbetçi</th><td>${v('nobetci')}</td></tr>
    <tr><th>Telefon</th><td>${v('telefon')}</td></tr></table>
  </div><div class="map">${map?`<div style="position:absolute;inset:0;background:url('${map}') center/cover no-repeat"></div>`:'<p style="padding:6px">Konum alınmadı</p>'}</div></div>
  </div>`;
}
function photoPages(r){const f=r.fotos||[],out=[];
  for(let i=0;i<f.length;i+=4)out.push(`<div class="pg"><h1>${esc(r.nokta||'')} · Fotoğraflar</h1><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${
    f.slice(i,i+4).map(s=>`<img src="${s}" style="width:100%;height:470px;object-fit:contain;border:1px solid #999">`).join('')}</div></div>`);
  return out}
const LIBS=['lib/html2canvas.min.js','lib/jspdf.umd.min.js'];
function loadScript(src){return new Promise((res,rej)=>{if(document.querySelector(`script[src="${src}"]`))return res();
  const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error(src+' yüklenemedi'));document.head.appendChild(s)})}
async function makePdf(list,name){
  const b=$('busy');b.innerHTML='<div>PDF hazırlanıyor…</div>';b.hidden=false;
  try{
    for(const s of LIBS)await loadScript(s);
    const {jsPDF}=window.jspdf, doc=new jsPDF({unit:'mm',format:'a4',compress:true}), root=$('pdfRoot');
    const pages=list.flatMap(r=>[page(r),...photoPages(r)]);
    for(let i=0;i<pages.length;i++){
      b.firstChild.textContent=`PDF hazırlanıyor… ${i+1}/${pages.length}`;
      root.innerHTML=pages[i];const el=root.firstElementChild;
      await Promise.all([...el.querySelectorAll('img')].map(im=>im.complete?0:new Promise(r=>{im.onload=im.onerror=r})));
      const c=await html2canvas(el,{scale:2,backgroundColor:'#ffffff',logging:false,useCORS:true});
      if(i)doc.addPage();doc.addImage(c.toDataURL('image/jpeg',0.88),'JPEG',0,0,210,297);
    }
    root.innerHTML='';
    const blob=doc.output('blob'), file=new File([blob],name,{type:'application/pdf'});
    if(window.Android&&Android.saveBase64){b.hidden=true;Android.saveBase64(name,'application/pdf',await blobToB64(blob));return}
    readyDialog(file);
  }catch(e){b.hidden=true;$('pdfRoot').innerHTML='';toast('PDF oluşturulamadı: '+e.message)}
}
$('btnPdf').onclick=async()=>{await save();makePdf([cur],`karne_${safeName(cur.nokta||'nokta')}_${cur.tarih||today()}.pdf`)};
$('btnPdfAll').onclick=async()=>{const all=(await DB.all()).sort(byDate);
  if(!all.length){toast('Kayıt yok');return}makePdf(all,`mt_karneler_${today()}.pdf`)};

// ================= başlat =================
(async()=>{
  showListTitle();
  try{await DB.open()}catch(e){document.body.innerHTML='<p style="padding:16px">Depolama açılamadı: '+esc(e.message)+'. Safari gizli sekmede olmadığınızdan emin olun.</p>';return}
  if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
  const ios=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  $('installHint').hidden=!(ios&&!navigator.standalone);
  if(!window.Android&&'serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
  route();
})();
