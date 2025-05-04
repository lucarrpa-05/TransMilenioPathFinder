import estaciones from './data/estaciones.json';
import aristas from './data/aristas.json';

class GrafoTS{
  nombres;
  adj;
  constructor(nombres,edges){
    this.nombres=[...nombres];
    const n=nombres.length;
    this.adj=Array.from({length:n},()=>Array(n).fill(0));
    edges.forEach(e=>{this.adj[e.from][e.to]=e.weight;this.adj[e.to][e.from]=e.weight});
  }
  vecinos(i){return this.adj[i].map((w,idx)=>w>0?idx:-1).filter(v=>v!==-1);}
  dijkstra(origen,dest){
    const n=this.nombres.length;
    const dist=new Array(n).fill(Infinity);
    const prev=new Array(n).fill(-1);
    const vis=new Set();
    dist[origen]=0;
    while(vis.size<n){
      let u=-1,min=Infinity;
      for(let i=0;i<n;i++) if(!vis.has(i)&&dist[i]<min){min=dist[i];u=i;}
      if(u===-1||u===dest)break;
      vis.add(u);
      this.vecinos(u).forEach(v=>{
        const alt=dist[u]+this.adj[u][v];
        if(alt<dist[v]){dist[v]=alt;prev[v]=u;}
      });
    }
    const ruta=[];
    if(dist[dest]===Infinity)return ruta;
    for(let v=dest;v!==-1;v=prev[v])ruta.unshift(v);
    return ruta;
  }
  dijkstraPaso(o,d,p){
    const r1=this.dijkstra(o,p);
    const r2=this.dijkstra(p,d);
    if(r1.length===0||r2.length===0)return [];
    return [...r1.slice(0,-1),...r2];
  }
  distancia(r){let t=0;for(let i=0;i<r.length-1;i++)t+=this.adj[r[i]][r[i+1]];return t;}
}

const grafo=new GrafoTS(estaciones,aristas);

function fill(sel){
  estaciones.forEach((e,i)=>{const opt=document.createElement('option');opt.value=i.toString();opt.textContent=e;sel.appendChild(opt);});
}
['origen','paso','destino'].forEach(id=>fill(document.getElementById(id)));

document.getElementById('calc').addEventListener('click',()=>{
  const o=parseInt((document.getElementById('origen')).value);
  const p=parseInt((document.getElementById('paso')).value);
  const d=parseInt((document.getElementById('destino')).value);
  const ruta=grafo.dijkstraPaso(o,d,p);
  const pre=document.getElementById('result');
  if(ruta.length===0){pre.textContent='No hay camino';return;}
  const nombres=ruta.map(i=>estaciones[i]);
  pre.textContent=`${nombres.join(' -> ')}\nTiempo: ${grafo.distancia(ruta).toFixed(1)} min`;
});
