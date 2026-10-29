/* Service worker: sempre busca a versão mais nova na rede e só usa o cache se estiver sem internet. */
const V='gr-v4';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(
  caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith(fetch(r,{cache:'no-cache'}).then(res=>{
    if(res.ok){const c=res.clone();caches.open(V).then(k=>k.put(r,c)).catch(()=>{})}
    return res;
  }).catch(()=>caches.match(r).then(m=>m||caches.match('index.html'))));
});
