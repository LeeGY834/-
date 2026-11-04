import {db,getSettings,esc,msg} from './common.js';
import {sanitizeImageStyle} from './site-image-editor.js';
const $=id=>document.getElementById(id);
const fields=[['brightness','밝기',0,200,1,'%'],['contrast','대비',0,200,1,'%'],['saturate','채도',0,200,1,'%'],['opacity','투명도',0,100,1,'%'],['blur','흐림',0,15,.5,'px'],['grayscale','흑백',0,100,1,'%'],['sepia','세피아',0,100,1,'%'],['zoom','확대·축소',50,250,1,'%'],['x','가로 위치',0,100,1,'%'],['y','세로 위치',0,100,1,'%'],['radius','모서리 둥글기',0,60,1,'px']];
export async function liveImageEditor(currentUser){
 const origin=location.origin,src=new URL('index.html',location.href);src.searchParams.set('namchon_image_live','1');
 $('editor').innerHTML=`<div class="stack"><p class="muted">실제 홈페이지에서 사진을 클릭하면 오른쪽에서 밝기·투명도·위치·크기를 조절할 수 있습니다. 저장하기 전에는 고객 홈페이지에 반영되지 않습니다.</p><div class="toolbar"><button class="btn alt" id="live-pc">PC</button><button class="btn alt" id="live-mobile">모바일</button><button class="btn alt" id="live-refresh">미리보기 새로고침</button></div><div class="live-image-layout"><div class="live-image-frame"><iframe id="live-image-iframe" title="홈페이지 이미지 실시간 편집" src="${esc(src.href)}"></iframe></div><div id="live-image-controls" class="panel stack"><strong>왼쪽 홈페이지에서 사진을 클릭해 주세요.</strong></div></div><p class="muted">상품 사진은 추천 상품과 카테고리에서 같은 상품으로 연결됩니다. 저장 후 새로고침하면 양쪽에 반영됩니다. 이미지 파일 업로드는 5MB 이하 JPG·PNG·WEBP만 지원합니다.</p></div>`;
 const frame=$('live-image-iframe'),panel=$('live-image-controls');let item=null,style=null,blob=null,file=null,settings=await getSettings(),saved={};
 try{saved=JSON.parse(settings.image_visual_styles||'{}')}catch{}if(!saved||typeof saved!=='object'||Array.isArray(saved))saved={};
 const send=(action,extra={})=>frame.contentWindow?.postMessage({namchonLiveImage:true,action,...extra},origin);
 $('live-pc').onclick=()=>frame.style.width='100%';$('live-mobile').onclick=()=>frame.style.width='390px';$('live-refresh').onclick=()=>{frame.src=src.href};
 const onMessage=e=>{if(e.origin!==origin||e.source!==frame.contentWindow||!e.data?.namchonLiveImage)return;if(e.data.action==='selected'){if(item)send('reset',{key:item.key});select(e.data.item)}};
 window.addEventListener('message',onMessage);
 const changed=()=>{if(!item)return;send('preview',{key:item.key,style,url:blob||item.url});const status=$('live-image-status');if(status)status.textContent='미리보기 변경 중 · 아직 저장되지 않았습니다.'};
 function select(x){if(blob){URL.revokeObjectURL(blob);blob=null}file=null;item=x;style=sanitizeImageStyle(saved[item.key]||x.style||{});
 panel.innerHTML=`<strong>${esc(item.name)}</strong><label class="field">새 이미지 선택 (선택 사항)<input type="file" id="live-file" accept="image/jpeg,image/png,image/webp"></label><div class="live-image-sliders">${fields.map(([k,label,min,max,step,unit])=>`<label class="field">${label} <output id="live-out-${k}">${style[k]}${unit}</output><input type="range" id="live-${k}" min="${min}" max="${max}" step="${step}" value="${style[k]}"></label>`).join('')}</div><label class="field">이미지 채우기<select id="live-fit"><option value="cover">영역 채우기</option><option value="contain">전체 이미지 보기</option></select></label><div class="toolbar"><button class="btn alt" id="live-default">효과 초기화</button><button class="btn alt" id="live-cancel">변경 취소</button></div><button class="btn" id="live-save">이 사진과 효과 저장</button><p class="muted" id="live-image-status">조절하면 홈페이지 화면에서 바로 확인할 수 있습니다.</p>`;
 for(const [k,,,,unit] of fields){$( 'live-'+k).oninput=e=>{style[k]=Number(e.target.value);$('live-out-'+k).textContent=style[k]+unit;changed()}};
 $('live-fit').value=style.fit;$('live-fit').onchange=e=>{style.fit=e.target.value;changed()};
 $('live-file').onchange=e=>{const f=e.target.files?.[0];if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5*1024*1024){$('live-image-status').textContent='JPG·PNG·WEBP 파일 5MB 이하만 업로드할 수 있습니다.';e.target.value='';return}if(blob)URL.revokeObjectURL(blob);blob=URL.createObjectURL(f);file=f;changed()};
 $('live-default').onclick=()=>{style=sanitizeImageStyle({});for(const [k,,,,unit] of fields){$('live-'+k).value=style[k];$('live-out-'+k).textContent=style[k]+unit}$('live-fit').value='cover';changed()};
 $('live-cancel').onclick=()=>{if(blob)URL.revokeObjectURL(blob);blob=null;file=null;send('reset',{key:item.key});select(item)};
 $('live-save').onclick=async()=>{const button=$('live-save'),status=$('live-image-status');button.disabled=true;status.textContent='저장하는 중입니다...';try{
 let url=item.url;
 if(file){if(!currentUser?.id)throw Error('관리자 로그인이 필요합니다.');const path=`${currentUser.id}/${crypto.randomUUID()}.${file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg'}`;const {error:upError}=await db.storage.from('product-images').upload(path,file,{contentType:file.type});if(upError)throw upError;url=db.storage.from('product-images').getPublicUrl(path).data.publicUrl;
 let result;if(item.type==='hero'||item.type==='intro')result=await db.from('site_settings').upsert({key:item.type==='hero'?'hero_image':'intro_background_image',value:url},{onConflict:'key'});else if(item.type==='product')result=await db.from('products').update({image_url:url}).eq('id',item.id);else if(item.type==='popup')result=await db.from('popups').update({image_url:url}).eq('id',item.id);else throw Error('지원하지 않는 이미지 종류입니다.');if(result.error)throw result.error;
 }
 const next={...saved,[item.key]:sanitizeImageStyle(style)};const {error}=await db.from('site_settings').upsert({key:'image_visual_styles',value:JSON.stringify(next)},{onConflict:'key'});if(error)throw error;saved=next;item.url=url;if(blob){URL.revokeObjectURL(blob);blob=null}file=null;send('saved',{key:item.key,style,url});status.textContent='저장 완료! 고객 홈페이지를 새로고침하면 반영됩니다.';
 }catch(err){status.textContent='저장 실패: '+msg(err)}finally{button.disabled=false}};
 }
}
