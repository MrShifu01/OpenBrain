import { useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { TC } from "../data/constants";

export default function GraphView({ onSelect, entries = [], links = [] }) {
  const ref = useRef(null);
  const nodesRef = useRef([]);
  const frameRef = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    const W = c.width = c.offsetWidth * 2, H = c.height = c.offsetHeight * 2;
    ctx.scale(2, 2); const w = W/2, h = H/2;
    const ids = new Set(); links.forEach(l => { ids.add(l.from); ids.add(l.to); });
    const nodes = entries.filter(e => ids.has(e.id)).map((e, i, a) => {
      const ang = (i/a.length)*Math.PI*2, r = Math.min(w,h)*0.35;
      return { ...e, x: w/2+Math.cos(ang)*r+(Math.random()-0.5)*40, y: h/2+Math.sin(ang)*r+(Math.random()-0.5)*40, vx:0, vy:0 };
    });
    nodesRef.current = nodes;
    const sim = () => {
      for(let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++){let dx=nodes[j].x-nodes[i].x,dy=nodes[j].y-nodes[i].y,d=Math.sqrt(dx*dx+dy*dy)||1,f=800/(d*d);nodes[i].vx-=(dx/d)*f;nodes[i].vy-=(dy/d)*f;nodes[j].vx+=(dx/d)*f;nodes[j].vy+=(dy/d)*f;}
      links.forEach(l=>{const a=nodes.find(n=>n.id===l.from),b=nodes.find(n=>n.id===l.to);if(!a||!b)return;let dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy)||1,f=(d-120)*0.02;a.vx+=(dx/d)*f;a.vy+=(dy/d)*f;b.vx-=(dx/d)*f;b.vy-=(dy/d)*f;});
      nodes.forEach(n=>{n.vx*=0.85;n.vy*=0.85;n.x+=n.vx;n.y+=n.vy;n.x=Math.max(30,Math.min(w-30,n.x));n.y=Math.max(30,Math.min(h-30,n.y));});
      ctx.clearRect(0,0,w,h);
      links.forEach(l=>{const a=nodes.find(n=>n.id===l.from),b=nodes.find(n=>n.id===l.to);if(!a||!b)return;const alpha=Math.round(Math.min(1,Math.max(0.1,(l.similarity||0.5)-0.2))*255).toString(16).padStart(2,"0");ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=`#4ECDC4${alpha}`;ctx.lineWidth=1+(l.similarity||0)*2;ctx.stroke();});
      nodes.forEach(n=>{const cfg=TC[n.type]||TC.note,r=n.pinned?16:12;ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);ctx.fillStyle=cfg.c+"30";ctx.fill();ctx.strokeStyle=cfg.c+"80";ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle="#ddd";ctx.font="10px system-ui";ctx.textAlign="center";ctx.fillText(cfg.i,n.x,n.y+4);ctx.fillStyle="#aaa";ctx.font="8px system-ui";const label=n.title?.length>20?n.title.slice(0,20)+"…":n.title||"";ctx.fillText(label,n.x,n.y+r+10);});
      frameRef.current=requestAnimationFrame(sim);
    };
    sim(); return () => cancelAnimationFrame(frameRef.current);
  }, [entries, links]);
  return <canvas ref={ref} aria-label="Knowledge graph visualization" onClick={e=>{const r=ref.current.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const n=nodesRef.current.find(n=>Math.hypot(n.x-x,n.y-y)<20);if(n)onSelect(entries.find(en=>en.id===n.id));}} style={{width:"100%",height:400,borderRadius:12,background:"#0d0d1a",cursor:"pointer"}} />;
}

GraphView.propTypes = {
  onSelect: PropTypes.func.isRequired,
  entries: PropTypes.array,
  links: PropTypes.array,
};
