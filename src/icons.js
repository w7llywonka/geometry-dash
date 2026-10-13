const INK = '#102b32';
const validColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
const clampIcon = index => Math.max(0, Math.min(23, Math.floor(Number(index) || 0)));

// The garage and gameplay use these same original vector shapes.
function shapes(index) {
  const variant = clampIcon(index);
  const result = [
    { kind:'rect', x:7,y:7,w:76,h:76,r:variant%12>=6?8:2,fill:'primary',stroke:'ink',sw:4 },
    { kind:'rect', x:12,y:12,w:66,h:66,r:variant%12>=6?5:0,fill:'none',stroke:'secondary',sw:3 },
  ];
  if(variant>=12) {
    result.push({kind:'polygon',points:[[13,13],[36,13],[13,36]],fill:'secondary'});
    result.push({kind:'polygon',points:[[77,77],[54,77],[77,54]],fill:'secondary'});
  }
  if(variant%3===2) {
    result.push({kind:'polygon',points:[[20,22],[38,30],[33,42],[20,34]],fill:'ink'});
    result.push({kind:'polygon',points:[[70,22],[52,30],[57,42],[70,34]],fill:'ink'});
  } else {
    for(const x of [22,54]) result.push({kind:'rect',x,y:24,w:14,h:16,fill:'ink'});
    if(variant%3===1) for(const x of [25,57]) result.push({kind:'rect',x,y:27,w:6,h:6,fill:'white'});
  }
  if(variant%4===0) result.push({kind:'rect',x:22,y:54,w:46,h:14,fill:'ink'});
  else if(variant%4===1) result.push({kind:'polygon',points:[[22,54],[34,54],[34,62],[56,62],[56,54],[68,54],[68,71],[22,71]],fill:'ink'});
  else if(variant%4===2) result.push({kind:'polygon',points:[[22,65],[32,51],[45,65],[58,51],[68,65]],fill:'ink'});
  else result.push({kind:'rect',x:25,y:55,w:40,h:9,fill:'ink'});
  if(variant>=18) result.push({kind:'rect',x:35,y:16,w:20,h:4,fill:'secondary'});
  return result;
}

function palette(primary,secondary) {
  return {primary:validColor(primary,'#b8ff65'),secondary:validColor(secondary,'#9b7bff'),ink:INK,white:'#fffce4',none:'none'};
}

export function iconSVG(index,primary,secondary) {
  const colors=palette(primary,secondary);
  const content=shapes(index).map(shape=>{
    const attributes=`fill="${colors[shape.fill]}"${shape.stroke?` stroke="${colors[shape.stroke]}" stroke-width="${shape.sw||1}"`:''}`;
    return shape.kind==='rect'
      ? `<rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" rx="${shape.r||0}" ${attributes}/>`
      : `<polygon points="${shape.points.map(point=>point.join(',')).join(' ')}" ${attributes}/>`;
  }).join('');
  return `<svg viewBox="0 0 90 90" aria-hidden="true" class="player-icon">${content}</svg>`;
}

export function drawCubeIcon(ctx,index,primary,secondary,size=32) {
  const colors=palette(primary,secondary);
  ctx.save();
  ctx.scale(size/76,size/76);
  ctx.translate(-45,-45);
  ctx.lineJoin='round';
  for(const shape of shapes(index)) {
    ctx.beginPath();
    if(shape.kind==='rect') {
      if(shape.r && ctx.roundRect) ctx.roundRect(shape.x,shape.y,shape.w,shape.h,shape.r);
      else ctx.rect(shape.x,shape.y,shape.w,shape.h);
    } else {
      shape.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
      ctx.closePath();
    }
    if(shape.fill!=='none') {ctx.fillStyle=colors[shape.fill];ctx.fill();}
    if(shape.stroke) {ctx.strokeStyle=colors[shape.stroke];ctx.lineWidth=shape.sw||1;ctx.stroke();}
  }
  ctx.restore();
}

export function difficultySVG(difficulty) {
  const colors={Easy:'#5edbff',Normal:'#7dff72',Hard:'#ffed69',Harder:'#ffb653',Insane:'#ee80e4',Demon:'#ff6363'};
  const color=colors[difficulty]||colors.Normal;
  const stern=['Harder','Insane','Demon'].includes(difficulty);
  const eyes=stern?'<path d="m24 34 18 8-5 9-13-9zm52 0-18 8 5 9 13-9z"/>':'<ellipse cx="34" cy="42" rx="6" ry="9"/><ellipse cx="66" cy="42" rx="6" ry="9"/>';
  const mouth=difficulty==='Easy'||difficulty==='Normal'?'<path d="M30 62q20 20 40 0" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>':difficulty==='Insane'?'<path d="m29 70 10-11 11 11 11-11 10 11" fill="none" stroke="currentColor" stroke-width="5"/>':'<path d="M29 69q21-18 42 0" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>';
  return `<svg viewBox="0 0 100 100" class="difficulty-face" aria-hidden="true" style="color:${INK}">${difficulty==='Demon'?'<path d="m20 27-4-19 25 16m39 3 4-19-25 16" fill="#ff6363" stroke="#612127" stroke-width="4"/>':''}<circle cx="50" cy="53" r="39" fill="${color}" stroke="${INK}" stroke-width="4"/><path d="M25 26q25-18 48 0" fill="none" stroke="#ffffff" opacity=".5" stroke-width="5" stroke-linecap="round"/><g fill="currentColor">${eyes}${mouth}</g></svg>`;
}
