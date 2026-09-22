import {resolveMoisture} from '../moisture.js';

/** Curves are a reference backdrop, never a recalculation of selected historical points. */
export function chartData(points,pressurePa) {
 if(!Number.isFinite(pressurePa)||pressurePa<30000||pressurePa>110000)throw new Error('Chart pressure must be between 30 and 110 kPa.');
 const minT=Math.min(-10,Math.floor(Math.min(...points.map(point=>point.tempC),0)/10)*10);
 const maxT=Math.max(50,Math.ceil(Math.max(...points.map(point=>point.tempC),40)/10)*10);
 const maxW=Math.max(.025,...points.map(point=>point.w*1.2));
 const curves=[.2,.4,.6,.8,1].map(rh=>({rh,points:Array.from({length:Math.ceil((maxT-minT)*2)+1},(_,index)=>{
  const tempC=minT+index*.5;
  const resolved=resolveMoisture({tempC,pressurePa,rh,authoritative:'rh',rhReference:'water',dewPointReference:'unknown'});
  return {tempC,w:resolved.humidityRatio};
 }).filter(point=>point.w!==null&&point.w<=maxW)}));
 return {points,curves,pressurePa,minT,maxT,maxW};
}
const NS='http://www.w3.org/2000/svg';
function element(name,attributes,text){const node=document.createElementNS(NS,name);for(const [key,value]of Object.entries(attributes))node.setAttribute(key,value);if(text!==undefined)node.textContent=text;return node;}
export function renderChart(container,points,pressurePa,system='si') {
 const data=chartData(points,pressurePa),svg=element('svg',{viewBox:'0 0 820 430',role:'img','aria-labelledby':'chart-title chart-desc'});
 svg.append(element('title',{id:'chart-title'},'Dry bulb and humidity ratio'),element('desc',{id:'chart-desc'},`Liquid-water RH curves at ${pressurePa/1000} kPa. Circle A is the input, square B is the process endpoint, diamond C is the room reference. The numerical table below gives every state at its own pressure.`));
 const left=66,top=22,width=710,height=340;
 const x=t=>left+(t-data.minT)/(data.maxT-data.minT)*width,y=w=>top+height-w/data.maxW*height;
 const group=element('g',{});svg.append(group);
 for(let i=0;i<=7;i++) {
  const temp=data.minT+(data.maxT-data.minT)*i/7,xx=x(temp);
  group.append(element('line',{x1:xx,x2:xx,y1:top,y2:top+height,class:'chart-grid'}),element('text',{x:xx,y:height+top+25,'text-anchor':'middle',class:'chart-label'},(system==='ip'?temp*9/5+32:temp).toFixed(0)));
 }
 for(let i=0;i<=5;i++) {
  const w=data.maxW*i/5,yy=y(w);
  group.append(element('line',{x1:left,x2:left+width,y1:yy,y2:yy,class:'chart-grid'}),element('text',{x:left-10,y:yy+4,'text-anchor':'end',class:'chart-label'},(w*(system==='ip'?7000:1000)).toFixed(1)));
 }
 for(const curve of data.curves) {
  group.append(element('path',{d:curve.points.map((point,index)=>`${index?'L':'M'}${x(point.tempC)},${y(point.w)}`).join(' '),class:curve.rh===1?'chart-saturation':'chart-rh',fill:'none'}));
  const last=curve.points.at(-1);if(last)group.append(element('text',{x:x(last.tempC)-4,y:y(last.w)+15,'text-anchor':'end',class:'chart-label'},`${curve.rh*100}%`));
 }
 if(points.length>1)group.append(element('path',{d:`M${x(points[0].tempC)},${y(points[0].w)} L${x(points[1].tempC)},${y(points[1].w)}`,class:'chart-process',fill:'none'}));
 points.forEach((point,index)=>{
  const xx=x(point.tempC),yy=y(point.w),name=String.fromCharCode(65+index);
  const shape=index===0?element('circle',{cx:xx,cy:yy,r:7}):element('rect',{x:xx-6,y:yy-6,width:12,height:12,...(index===2?{transform:`rotate(45 ${xx} ${yy})`}:{})});
  shape.setAttribute('class',`chart-point point-${index}`);group.append(shape,element('text',{x:xx+12,y:yy-10,class:'chart-point-label'},name));
 });
 svg.append(element('text',{x:420,y:416,'text-anchor':'middle',class:'chart-axis'},`Dry-bulb temperature (${system==='ip'?'°F':'°C'})`),element('text',{x:16,y:200,transform:'rotate(-90 16 200)','text-anchor':'middle',class:'chart-axis'},`Humidity ratio (${system==='ip'?'grains/lb':'g/kg'} dry air)`));
 container.replaceChildren(svg);return data;
}
