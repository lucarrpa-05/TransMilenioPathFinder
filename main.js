// Plain JS version (no bundler) – loads JSON with fetch
class Grafo {
  constructor(names, edges) {
    this.nombres = names;
    const n = names.length;
    this.adj = Array.from({ length: n }, () => Array(n).fill(0));
    edges.forEach(e => {
      this.adj[e.from][e.to] = e.weight;
      this.adj[e.to][e.from] = e.weight;
    });
  }
  vecinos(i) {
    const v = [];
    for (let j = 0; j < this.adj[i].length; j++) if (this.adj[i][j] > 0) v.push(j);
    return v;
  }
  dijkstra(o, d) {
    const n = this.nombres.length,
      dist = Array(n).fill(Infinity),
      prev = Array(n).fill(-1),
      seen = new Set();
    dist[o] = 0;
    while (seen.size < n) {
      let u = -1, best = Infinity;
      for (let i = 0; i < n; i++) if (!seen.has(i) && dist[i] < best) { best = dist[i]; u = i; }
      if (u === -1 || u === d) break;
      seen.add(u);
      this.vecinos(u).forEach(v => {
        const alt = dist[u] + this.adj[u][v];
        if (alt < dist[v]) { dist[v] = alt; prev[v] = u; }
      });
    }
    const path = [];
    if (dist[d] === Infinity) return path;
    for (let v = d; v !== -1; v = prev[v]) path.unshift(v);
    return path;
  }
  dijkstraPaso(o, d, p) {
    const a = this.dijkstra(o, p);
    const b = this.dijkstra(p, d);
    if (a.length === 0 || b.length === 0) return [];
    return [...a.slice(0, -1), ...b];
  }
  distancia(path) {
    let t = 0;
    for (let i = 0; i < path.length - 1; i++) t += this.adj[path[i]][path[i + 1]];
    return t;
  }
}

async function init() {
  const [estacionesRaw, edges] = await Promise.all([
    fetch('data/estaciones.json').then(r => r.json()),
    fetch('data/aristas.json').then(r => r.json())
  ]);

  const names = estacionesRaw.map(e => typeof e === 'string' ? e : e.name);

  const grafo = new Grafo(names, edges);
  const baseAdj = grafo.adj.map(r=>r.slice()); // immutable base weights

  /* ---------- Hora slider & presets ---------- */
  const hourSlider=document.getElementById('hour-slider');
  const hourDisp=document.getElementById('hour-display');
  hourSlider.value=new Date().getHours();
  hourDisp.textContent=`${hourSlider.value}h`;
  hourSlider.addEventListener('input',()=>{hourDisp.textContent=`${hourSlider.value}h`;});

  const presetSel=document.getElementById('preset');
  presetSel.addEventListener('change',()=>{
    switch(presetSel.value){
      case 'peak': hourSlider.value=7; document.getElementById('weather').value='soleado'; break;
      case 'off': hourSlider.value=14; document.getElementById('weather').value='soleado'; break;
      case 'rain': hourSlider.value=18; document.getElementById('weather').value='lluvioso'; break;
      default: /* keep current */ break;
    }
    hourDisp.textContent=`${hourSlider.value}h`;
  });

  /* ---------- Autocomplete ---------- */
  function setupAutocomplete(inputId) {
    const inp = document.getElementById(inputId);
    let cur = -1;
    inp.addEventListener('input', function () {
      const val = this.value.trim().toLowerCase();
      closeLists();
      if (!val) return;
      const list = document.createElement('div');
      list.setAttribute('class', 'autocomplete-items');
      this.parentNode.appendChild(list);
      names.filter(n => n.toLowerCase().includes(val))
        .slice(0, 10)
        .forEach(n => {
          const item = document.createElement('div');
          const idx = n.toLowerCase().indexOf(val);
          item.innerHTML = n.substring(0, idx) + '<strong>' + n.substr(idx, val.length) + '</strong>' + n.substr(idx + val.length);
          item.addEventListener('click', () => { inp.value = n; closeLists(); });
          list.appendChild(item);
        });
    });
    inp.addEventListener('keydown', function (e) {
      let list = this.parentNode.querySelector('.autocomplete-items');
      if (list) list = list.getElementsByTagName('div');
      if (e.key === 'ArrowDown') { cur++; highlight(list); }
      else if (e.key === 'ArrowUp') { cur--; highlight(list); }
      else if (e.key === 'Enter') { e.preventDefault(); if (cur > -1 && list) list[cur].click(); }
    });
    document.addEventListener('click', (e) => closeLists(e.target));
    function highlight(list) {
      if (!list) return;
      if (cur >= list.length) cur = 0;
      if (cur < 0) cur = list.length - 1;
      Array.from(list).forEach(el => el.classList.remove('autocomplete-active'));
      list[cur].classList.add('autocomplete-active');
    }
    function closeLists(except) {
      document.querySelectorAll('.autocomplete-items').forEach(el => { if (el !== except) el.remove(); });
      cur = -1;
    }
  }

  ['origen', 'paso', 'destino'].forEach(setupAutocomplete);

  // Snackbar helper
  function showSnackbar(msg, type = 'info') {
    const sb = document.getElementById('snackbar');
    sb.textContent = msg;
    sb.className = `show ${type}`;
    setTimeout(() => (sb.className = ''), 3000);
  }

  document.getElementById('calc').addEventListener('click', () => {
    const oName = document.getElementById('origen').value.trim();
    const pName = document.getElementById('paso').value.trim();
    const dName = document.getElementById('destino').value.trim();

    const o = names.indexOf(oName);
    const p = names.indexOf(pName);
    const d = names.indexOf(dName);
    if (o === -1 || p === -1 || d === -1) {
      showSnackbar('Selecciona estaciones válidas', 'error');
      return;
    }

    // Dynamic weight multiplier using slider hour and current day
    const hour=parseInt(hourSlider.value);
    const dow=new Date().getDay();
    const tau24=[0.75,0.75,0.75,0.75,0.9,0.9,1.4,1.4,1.4,1,1,1,1,1,1,1.45,1.45,1.45,1.15,1.15,1.15,0.75,0.75,0.75];
    const delta=[1,1,1,1,1,0.9,0.8]; // Sunday first
    const kappaMap={soleado:1, lluvioso:1.25, tormenta:1.45};
    const clima=document.getElementById('weather').value;
    const m=tau24[hour]*delta[dow]*kappaMap[clima];

    // rebuild adj from baseAdj with multiplier
    grafo.adj.forEach((row,i)=>row.forEach((_,j)=>{ grafo.adj[i][j]=baseAdj[i][j]*m; }));

    const ruta = grafo.dijkstraPaso(o, d, p);
    if (ruta.length === 0) {
      showSnackbar('No existe camino', 'error');
      return;
    }
    showSnackbar('Ruta calculada', 'success');

    // Texto resumen
    const total = grafo.distancia(ruta).toFixed(1);
    document.getElementById('result').textContent = ruta.map(i => names[i]).join(' -> ') + `\nTiempo: ${total} min`;

    // Tabla detalles
    const tbl = document.getElementById('details');
    tbl.innerHTML = '<tr><th>#</th><th>Estación</th><th>Δ min</th><th>Acum min</th></tr>';
    let acc = 0;
    ruta.forEach((idx, i) => {
      const delta = i === 0 ? 0 : grafo.adj[ruta[i - 1]][idx];
      if (i > 0) acc += delta;
      const row = tbl.insertRow();
      row.innerHTML = `<td>${i + 1}</td><td>${names[idx]}</td><td>${i === 0 ? '-' : delta.toFixed(1)}</td><td>${acc.toFixed(1)}</td>`;
      row.dataset.idx = idx;
      row.addEventListener('mouseover', () => highlightMarker(idx, true));
      row.addEventListener('mouseout', () => highlightMarker(idx, false));
    });

    // Animar ruta en mapa
    const coords = ruta.map(idx => markerCoords[idx]);
    if (window._rutaLayer) window._rutaLayer.remove();
    const poly = L.polyline([], { color: 'red', weight: 5 }).addTo(map);
    let k = 0;
    (function step() {
      poly.addLatLng(coords[k]);
      map.panTo(coords[k], { animate: true, duration: 0.4 });
      if (++k < coords.length) setTimeout(step, 400);
    })();
    window._rutaLayer = poly;
  });

  // Build datalist
  const dl = document.getElementById('stations');
  names.forEach(n=>{const opt=document.createElement('option');opt.value=n;dl.appendChild(opt);});

  // Theme toggle
  const toggle=document.getElementById('theme-toggle');
  toggle.addEventListener('click',()=>{document.body.classList.toggle('dark');});

  // Initialize map
  const map = L.map('map').setView([4.65,-74.1],12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'&copy; OpenStreetMap'}).addTo(map);

  // Coordinates: use real if present else circular fallback
  const center=[4.65,-74.1];
  const radius=0.05;
  const angleStep=2*Math.PI/names.length;
  const markerCoords=[];
  const markers=[];
  names.forEach((n,i)=>{
      let lat, lon;
      const est = estacionesRaw[i];
      if (typeof est === 'object' && est.lat != null && est.lon != null) {
          lat = est.lat; lon = est.lon;
      } else {
          const ang = i * angleStep;
          lat = center[0] + radius * Math.cos(ang);
          lon = center[1] + radius * Math.sin(ang);
      }
      markerCoords.push([lat,lon]);
      const m=L.circleMarker([lat,lon],{radius:4,color:'#3388ff'}).addTo(map);
      m.bindTooltip(n);
      markers.push(m);
      m.on('mouseover',()=>{ highlightMarker(i,true); highlightRow(i,true);});
      m.on('mouseout', ()=>{ highlightMarker(i,false); highlightRow(i,false);});
  });

  // Fit bounds to markers if we have real coords
  if(markerCoords.some(c=>c[0]!==null)){
      map.fitBounds(markerCoords,{padding:[20,20]});
  }

  function highlightMarker(idx,on){
      const m=markers[idx]; if(!m) return;
      m.setStyle({radius:on?8:4,color:on?'#ffc107':'#3388ff'});
  }

  function highlightRow(idx,on){
      const row=document.querySelector(`#details tr[data-idx='${idx}']`);
      if(row) row.classList.toggle('highlight',on);
  }

  /* ---------- Nearest station button ---------- */
  function haversine(lat1,lon1,lat2,lon2){
     const R=6371e3;
     const toRad=d=>d*Math.PI/180;
     const φ1=toRad(lat1), φ2=toRad(lat2);
     const Δφ=toRad(lat2-lat1);
     const Δλ=toRad(lon2-lon1);
     const a=Math.sin(Δφ/2)**2+Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
     return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }

  document.getElementById('btn-nearest').addEventListener('click',()=>{
     if(!navigator.geolocation){showSnackbar('Geolocalización no soportada','error');return;}
     navigator.geolocation.getCurrentPosition(pos=>{
        const {latitude,longitude}=pos.coords;
        let best=-1,bestD=Infinity;
        markerCoords.forEach(([lat,lon],idx)=>{
            if(lat==null||lon==null) return;
            const d=haversine(latitude,longitude,lat,lon);
            if(d<bestD){bestD=d;best=idx;}
        });
        if(best===-1){showSnackbar('No hay estaciones con coordenadas','error');return;}
        document.getElementById('origen').value=names[best];
        highlightMarker(best,true);
        map.setView(markerCoords[best],14);
        if(window._geoLine) window._geoLine.remove();
        window._geoLine=L.polyline([[latitude,longitude],markerCoords[best]],{color:'blue',dashArray:'4'}).addTo(map);
        showSnackbar('Origen establecido a estación más cercana','success');
     },()=>showSnackbar('No se pudo obtener ubicación','error'));
  });
}

document.addEventListener('DOMContentLoaded', init);
