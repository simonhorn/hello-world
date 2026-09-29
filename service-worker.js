const CACHE='heart-monitor-v9';
const CORE=['./','./index.html','./app.js?v=0.2.6','./manifest.webmanifest','./heart-monitor-icon.svg'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
    const clients=await self.clients.matchAll({type:'window'});
    await Promise.all(clients.map(async client=>{
      try { await client.navigate(client.url); } catch {}
    }));
  })());
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const isNav=e.request.mode==='navigate';
  e.respondWith(
    fetch(e.request,{cache:isNav?'no-store':'default'})
      .then(r=>{
        const copy=r.clone();
        caches.open(CACHE).then(c=>c.put(e.request,copy));
        return r;
      })
      .catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html')))
  );
});