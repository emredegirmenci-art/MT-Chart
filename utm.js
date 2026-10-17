// Koordinat dönüşümleri. İnternet gerektirmez.
// WGS84 enlem/boylam -> UTM (Krüger serisi), isteğe bağlı ED50 (Türkiye) datumuna geçiş.
const ELIPS={WGS84:{a:6378137,f:1/298.257223563},INTL:{a:6378388,f:1/297}};

function toUTM(lat, lon, el){
  const {a,f}=el||ELIPS.WGS84, k0=0.9996, e2=f*(2-f), ep2=e2/(1-e2);
  let zone=Math.floor((lon+180)/6)+1;
  if(lat>=56&&lat<64&&lon>=3&&lon<12) zone=32;
  if(lat>=72&&lat<84){ if(lon>=0&&lon<9)zone=31; else if(lon<21)zone=33; else if(lon<33)zone=35; else if(lon<42)zone=37; }
  const lon0=((zone-1)*6-180+3)*Math.PI/180, phi=lat*Math.PI/180, lam=lon*Math.PI/180;
  const N=a/Math.sqrt(1-e2*Math.sin(phi)**2), T=Math.tan(phi)**2, C=ep2*Math.cos(phi)**2, A=Math.cos(phi)*(lam-lon0);
  const M=a*((1-e2/4-3*e2*e2/64-5*e2**3/256)*phi-(3*e2/8+3*e2*e2/32+45*e2**3/1024)*Math.sin(2*phi)+(15*e2*e2/256+45*e2**3/1024)*Math.sin(4*phi)-(35*e2**3/3072)*Math.sin(6*phi));
  const E=k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep2)*A**5/120)+500000;
  let Nn=k0*(M+N*Math.tan(phi)*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep2)*A**6/720));
  if(lat<0) Nn+=10000000;
  const band="CDEFGHJKLMNPQRSTUVWXX"[Math.floor((lat+80)/8)]||"";
  return {zone:zone+band, E:Math.round(E), N:Math.round(Nn)};
}

function geoToCart(lat,lon,h,{a,f}){const e2=f*(2-f),p=lat*Math.PI/180,l=lon*Math.PI/180,N=a/Math.sqrt(1-e2*Math.sin(p)**2);
  return [(N+h)*Math.cos(p)*Math.cos(l),(N+h)*Math.cos(p)*Math.sin(l),(N*(1-e2)+h)*Math.sin(p)]}
function cartToGeo([X,Y,Z],{a,f}){const e2=f*(2-f),p=Math.hypot(X,Y),lon=Math.atan2(Y,X);let lat=Math.atan2(Z,p*(1-e2)),h=0;
  for(let i=0;i<8;i++){const N=a/Math.sqrt(1-e2*Math.sin(lat)**2);h=p/Math.cos(lat)-N;lat=Math.atan2(Z,p*(1-e2*N/(N+h)))}
  return [lat*180/Math.PI,lon*180/Math.PI,h]}

// EPSG:1784 "ED50 to WGS 84 (30)" – Türkiye, 7 parametre (position vector), doğruluk ~2 m.
// ED50->WGS84: X_w = T + (1+s)·R·X_e ; burada tersini uyguluyoruz.
function wgs84ToED50(lat,lon,h){
  const as=Math.PI/180/3600, rx=0, ry=0, rz=0.468*as, s=1.05e-6, T=[-84.1,-101.8,-129.7];
  const [x,y,z]=geoToCart(lat,lon,h||0,ELIPS.WGS84).map((v,i)=>v-T[i]);
  // R^T · (X_w - T) / (1+s)
  const X=( x + rz*y - ry*z)/(1+s), Y=(-rz*x + y + rx*z)/(1+s), Z=( ry*x - rx*y + z)/(1+s);
  return cartToGeo([X,Y,Z],ELIPS.INTL);
}

// datum: 'WGS84' | 'ED50'
function utmFor(lat,lon,datum){
  if(datum==='ED50'){const [la,lo]=wgs84ToED50(lat,lon,0);return toUTM(la,lo,ELIPS.INTL)}
  return toUTM(lat,lon,ELIPS.WGS84);
}
if(typeof module!=='undefined') module.exports={toUTM,wgs84ToED50,utmFor};
