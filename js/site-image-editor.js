import {getSettings} from './common.js';
const defaults={brightness:100,contrast:100,saturate:100,opacity:100,blur:0,grayscale:0,sepia:0,zoom:100,x:50,y:50,radius:0,fit:'cover'};
const clamp=(v,min,max,d)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):d;
export function sanitizeImageStyle(value={}){
 const s={};for(const [k,min,max] of [['brightness',0,200],['contrast',0,200],['saturate',0,200],['opacity',0,100],['blur',0,15],['grayscale',0,100],['sepia',0,100],['zoom',50,250],['x',0,100],['y',0,100],['radius',0,60]])s[k]=clamp(value[k]??defaults[k],min,max,defaults[k]);
 s.fit=['cover','contain'].includes(value.fit)?value.fit:'cover';return s;
}
const filter=s=>`brightness(${s.brightness}%) contrast(${s.contrast}%) saturate(${s.saturate}%) blur(${s.blur}px) grayscale(${s.grayscale}%) sepia(${s.sepia}%)`;
const cssUrl=u=>`url("${String(u).replace(/["\\\n\r]/g,'')}")`;
function elements(){const all=[{key:'hero',type:'hero',name:'메인 배너',el:document.getElementById('home')},{key:'intro',type:'intro',name:'남촌축산백화점 소개 배경',el:document.getElementById('intro')}];
 document.querySelectorAll('.card img[data-live-product]').forEach(el=>all.push({key:'product:'+el.dataset.liveProduct,type:'product',id:el.dataset.liveProduct,name:el.alt||'상품 사진',el}));
 const popup=document.getElementById('popup-image');if(popup?.dataset.livePopup)all.push({key:'popup:'+popup.dataset.livePopup,type:'popup',id:popup.dataset.livePopup,name:'행사 팝업 사진',el:popup});return all.filter(x=>x.el);
}
function apply(item,style,imageUrl){const s=sanitizeImageStyle(style),el=item.el;
 if(item.type==='hero'||item.type==='intro'){
  const prefix=item.type==='hero'?'--live-hero-':'--live-intro-';
  if(imageUrl){el.style.setProperty(prefix+'image',cssUrl(imageUrl));if(item.type==='hero')el.style.backgroundImage='none';else el.style.setProperty('--intro-bg',cssUrl(imageUrl))}
  el.style.setProperty(prefix+'filter',filter(s));el.style.setProperty(prefix+'opacity',String(s.opacity/100));el.style.setProperty(prefix+'size',item.type==='intro'?`${s.zoom*2}% 100%`:`${s.zoom}% auto`);el.style.setProperty(prefix+'position',`${s.x}% ${s.y}%`);el.style.setProperty(prefix+'radius',s.radius+'px');
  if(item.type==='hero')el.style.borderRadius=s.radius+'px';
 }else{
  if(imageUrl)el.src=imageUrl;el.style.filter=filter(s);el.style.opacity=String(s.opacity/100);el.style.objectFit=s.fit;el.style.objectPosition=`${s.x}% ${s.y}%`;el.style.borderRadius=s.radius+'px';
  // zoom uses object scaling without altering the product-card layout.
  el.style.transform=`scale(${s.zoom/100})`;el.style.transformOrigin=`${s.x}% ${s.y}%`;
 }
}
export async function initLiveImages(settings){if(!settings){try{settings=await getSettings()}catch{return}}
 let saved={};try{saved=JSON.parse(settings.image_visual_styles||'{}')}catch{}if(!saved||typeof saved!=='object'||Array.isArray(saved))saved={};
 const items=elements();const urls={hero:settings.hero_image||'',intro:settings.intro_background_image||'images/namchon-jiyuk-background.webp'};
 for(const item of items){item.url=urls[item.type]||((item.type==='product'||item.type==='popup')?item.el.src:'');apply(item,saved[item.key]||{},item.url)}
 if(new URLSearchParams(location.search).get('namchon_image_live')!=='1'||window.parent===window)return;
 try{if(window.parent.location.origin!==location.origin)return}catch{return}
 const send=(action,extra={})=>parent.postMessage({namchonLiveImage:true,action,...extra},location.origin);
 const style=document.createElement('style');style.textContent=`[data-live-img]{cursor:crosshair!important;outline:2px dashed #e8bc6b;outline-offset:2px}[data-live-img]:hover{outline:4px solid #ffd27b!important}#popup-overlay{pointer-events:none}#popup-box{pointer-events:auto}`;document.head.append(style);
 for(const item of items){item.el.dataset.liveImg=item.key;item.el.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();send('selected',{item:{key:item.key,type:item.type,id:item.id||null,name:item.name,url:item.url,style:sanitizeImageStyle(saved[item.key]||{})}})},true)}
 document.addEventListener('click',e=>{if(e.target.closest('a'))e.preventDefault()},true);
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||!e.data?.namchonLiveImage)return;const m=e.data;const item=items.find(x=>x.key===m.key);if(!item)return;
  if(m.action==='preview'){apply(item,m.style||{},typeof m.url==='string'?m.url:item.url)}
  if(m.action==='saved'){saved[item.key]=sanitizeImageStyle(m.style);item.url=m.url||item.url;apply(item,saved[item.key],item.url)}
  if(m.action==='reset'){apply(item,saved[item.key]||{},item.url)}
 });send('ready');
}
