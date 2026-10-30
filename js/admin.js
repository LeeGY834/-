import {db,configured,categories,esc,getSettings,msg} from './common.js';
const $=id=>document.getElementById(id);let active='products';let currentUser=null;
const tabs=[['products','상품 관리'],['settings','홈페이지·매장 정보'],['design','디자인·화면 설정'],['notices','행사·공지사항'],['popups','행사 팝업'],['code','고급 코드 편집'],['visual','화면 보면서 편집'],['layout','카드 배치·크기·순서'],['categoryManager','카테고리 관리']];
const status=s=>$('status').textContent=s;
const input=(key,label,value='',type='text')=>`<label class="field">${label}<input name="${key}" type="${type}" value="${esc(value)}"></label>`;
const area=(key,label,value='')=>`<label class="field">${label}<textarea name="${key}" rows="3">${esc(value)}</textarea></label>`;
const check=(key,label,v=false)=>`<label><input name="${key}" type="checkbox" ${v?'checked':''}> ${label}</label>`;
const formData=form=>Object.fromEntries([...new FormData(form).entries()]);
async function authorized(){const {data:{user}}=await db.auth.getUser();if(!user)return false;const {data,error}=await db.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();if(error)throw error;currentUser=data?user:null;return !!data}
async function show(){if(!configured){status('먼저 js/config.js에 Supabase 연결 정보를 입력하세요.');return}try{if(await authorized()){$('login').classList.add('hidden');$('dashboard').classList.remove('hidden');$('tabs').innerHTML=tabs.map(([k,n])=>`<button class="btn ${k===active?'':'alt'}" data-tab="${k}">${n}</button>`).join('');document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{active=b.dataset.tab;show()});$('section-title').textContent=tabs.find(x=>x[0]===active)[1];await render();status('관리자 로그인 상태')}else{$('dashboard').classList.add('hidden');$('login').classList.remove('hidden');status('관리자 계정으로 로그인하세요.')}}catch(e){status('인증 확인 오류: '+msg(e))}}
$('login-btn').onclick=async()=>{if(!configured)return status('Supabase 연결 설정이 필요합니다.');const {error}=await db.auth.signInWithPassword({email:$('email').value,password:$('password').value});if(error)return status(msg(error));if(!(await authorized())){await db.auth.signOut();return status('관리자 권한이 없는 계정입니다.')}show()};
$('logout').onclick=async()=>{await db.auth.signOut();currentUser=null;show()};
async function upload(file,bucket){if(!file||!file.size)return null;if(!file.type.startsWith('image/'))throw Error('이미지 파일만 업로드할 수 있습니다.');if(file.size>5*1024*1024)throw Error('이미지는 5MB 이하로 업로드하세요.');const path=`${currentUser.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const {error}=await db.storage.from(bucket).upload(path,file,{contentType:file.type});if(error)throw error;return db.storage.from(bucket).getPublicUrl(path).data.publicUrl}
async function render(){try{if(active==='products')await products();if(active==='settings')await settings();if(active==='design')await design();if(active==='notices')await entries('notices');if(active==='popups')await entries('popups');if(active==='code')await codeEditor();if(active==='visual')await visualEditor();if(active==='layout')await cardLayoutEditor();if(active==='categoryManager')await categoryManager()}catch(e){status('오류: '+msg(e))}}
async function products(){const {data,error}=await db.from('products').select('*').order('sort_order');if(error)throw error;const rows=data||[];const categoryNames=await loadCategoryNames();$('editor').innerHTML=`<div class="stack"><button class="btn" id="new-item">+ 새 상품</button><div id="product-form"></div><div>${rows.map(p=>`<div class="item-row"><span>${esc(p.category)} · ${esc(p.name)} <span class="gold">${esc(p.price_text)}</span></span><div class="toolbar"><button class="btn alt" data-edit="${p.id}">수정</button><button class="btn alt" data-delete="${p.id}">삭제</button></div></div>`).join('')}</div></div>`;const edit=p=>{$('product-form').innerHTML=`<form class="stack" id="edit-product"><h3>${p.id?'상품 수정':'새 상품'}</h3>${input('name','상품명',p.name)}<label class="field">카테고리<select name="category">${[...new Set([...categoryNames,p.category].filter(Boolean))].map(c=>`<option ${c===p.category?'selected':''}>${esc(c)}</option>`).join('')}</select></label>${input('price_text','가격 문구',p.price_text)}${area('description','설명',p.description)}${input('sort_order','정렬 순서',p.sort_order??0,'number')}<label class="field">상품 사진 업로드<input name="photo" type="file" accept="image/*"></label>${p.image_url?`<img src="${esc(p.image_url)}" alt="현재 사진" style="max-width:160px">`:''}${check('featured','메인 추천 상품',p.is_featured)}${check('visible','고객에게 표시',p.is_visible??true)}${check('sold_out','품절',p.is_sold_out)}<button class="btn" type="submit">이 상품 저장</button></form>`;$('edit-product').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,d=formData(f);try{const image=await upload(f.elements.photo.files[0],'product-images');const payload={name:d.name.trim(),category:d.category,price_text:d.price_text,description:d.description,sort_order:Number(d.sort_order)||0,is_featured:f.elements.featured.checked,is_visible:f.elements.visible.checked,is_sold_out:f.elements.sold_out.checked};if(image)payload.image_url=image;if(!payload.name)throw Error('상품명을 입력하세요.');const q=p.id?db.from('products').update(payload).eq('id',p.id):db.from('products').insert(payload);const {error}=await q;if(error)throw error;status('상품이 저장되었습니다.');await products()}catch(err){status('저장 실패: '+msg(err))}}};$('new-item').onclick=()=>edit({category:categoryNames[0]||'한우',is_visible:true});document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>edit(rows.find(p=>p.id===b.dataset.edit)));document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('이 상품을 삭제할까요?'))return;const {error}=await db.from('products').delete().eq('id',b.dataset.delete);if(error)return status(msg(error));products()})}
async function settings(){const values=await getSettings();const fields=[['hero_title','메인 배너 제목'],['hero_desc','메인 배너 설명'],['intro','매장 소개'],['address','매장 주소'],['hours','영업시간'],['parking','주차 안내'],['phone','전화번호']];$('editor').innerHTML=`<form id="settings-form" class="stack">${fields.map(([k,n])=>area(k,n,values[k]||'')).join('')}<label class="field">메인 배너 이미지<input name="hero_file" type="file" accept="image/*"></label>${values.hero_image?`<img src="${esc(values.hero_image)}" style="max-width:300px" alt="현재 배너">`:''}<button class="btn">설정 저장</button></form>`;$('settings-form').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;try{const changes=fields.map(([key])=>({key,value:f.elements[key].value}));const image=await upload(f.elements.hero_file.files[0],'product-images');if(image)changes.push({key:'hero_image',value:image});const {error}=await db.from('site_settings').upsert(changes,{onConflict:'key'});if(error)throw error;status('홈페이지 설정을 저장했습니다.');settings()}catch(err){status(msg(err))}}}
async function design(){
 const values=await getSettings();
 const colors=[['theme_accent','강조색 (금색 등)','#d8b574'],['theme_background','페이지 배경색','#101010'],['theme_surface','상품 카드 배경색','#1d1d1d'],['theme_text','본문 글자색','#f4eee3']];
 const fields=[['seo_title','브라우저·검색 제목'],['seo_description','검색 설명'],['footer_text','홈페이지 하단 문구'],['hero_height','메인 배너 높이(px, 220~750)']];
 const toggles=[['show_hero_title','배너 위 제목 표시'],['show_hero_desc','배너 위 설명 표시'],['show_hero_label','PREMIUM QUALITY 표시'],['show_categories','카테고리 바로가기 표시'],['show_featured','추천 상품 표시'],['show_intro','매장 소개 표시'],['show_notices','공지사항 표시'],['show_store','매장 안내 표시']];
 const categoriesOn=[['show_cat_한우','한우'],['show_cat_한돈','한돈'],['show_cat_냉동상품','냉동상품'],['show_cat_수입육','수입육'],['show_cat_완제품','완제품']];
 $('editor').innerHTML=`<form id="design-form" class="stack"><p class="muted">설정은 Supabase에 저장되며 고객 홈페이지 새로고침 시 반영됩니다. GitHub 원본 코드는 변경하지 않습니다.</p><h3>색상</h3>${colors.map(([k,n,d])=>`<label class="field">${n}<input name="${k}" type="color" value="${/^#[0-9a-fA-F]{6}$/.test(values[k]||'')?values[k]:d}"></label>`).join('')}<h3>검색·하단 문구·배너 높이</h3>${fields.map(([k,n])=>input(k,n,values[k]||'')).join('')}<h3>홈페이지 영역 표시</h3>${toggles.map(([k,n])=>check(k,n,values[k]!=='false')).join('')}<h3>상품 카테고리 표시</h3>${categoriesOn.map(([k,n])=>check(k,n,values[k]!=='false')).join('')}<button class="btn" type="submit">디자인 설정 저장</button></form>`;
 $('design-form').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;try{const changes=[...colors,...fields].map(([key])=>({key,value:f.elements[key].value}));for(const [key] of [...toggles,...categoriesOn])changes.push({key,value:String(f.elements[key].checked)});const height=Number(f.elements.hero_height.value);if(f.elements.hero_height.value && (!Number.isFinite(height)||height<220||height>750))throw Error('배너 높이는 220~750 사이 숫자로 입력하세요.');const {error}=await db.from('site_settings').upsert(changes,{onConflict:'key'});if(error)throw error;status('디자인 설정이 저장되었습니다. 고객 홈페이지를 새로고침해 확인하세요.')}catch(err){status('저장 실패: '+msg(err))}};
}

async function popupVisualSettings(){
 const settings=await getSettings();
 const num=(k,d,min,max)=>Math.min(max,Math.max(min,Number(settings[k])||d));
 const initial={width:num('popup_width',470,240,900),image:num('popup_image_height',250,80,650),radius:num('popup_radius',12,0,40)};
 const field=(key,title,min,max)=>`<label class="field">${title}<div class="toolbar"><input type="range" data-popup-control="${key}" min="${min}" max="${max}" value="${initial[key]}" style="flex:1"><output data-popup-output="${key}">${initial[key]}px</output></div></label>`;
 const host=document.createElement('div');host.className='panel stack';
 host.innerHTML=`<h3>팝업 크기·이미지 모양 (PC·모바일 미리보기)</h3><div class="toolbar"><button class="btn" type="button" id="popup-preview-pc">PC 화면</button><button class="btn alt" type="button" id="popup-preview-mobile">모바일 화면</button></div><div id="popup-preview-stage" style="background:#111;max-width:100%;width:100%;min-height:320px;margin:auto;padding:16px;display:flex;align-items:center;justify-content:center;border:1px solid #555;border-radius:10px;overflow:hidden"><div id="popup-preview-box" style="background:#222;color:white;border:1px solid #bb9658;padding:18px;max-width:100%;box-sizing:border-box"><strong style="color:#d8b574">팝업 미리보기</strong><img id="popup-preview-img" alt="팝업 미리보기" style="width:100%;object-fit:cover;display:block;margin-top:12px" src=""><p>행사 안내 문구가 여기에 표시됩니다.</p></div></div>${field('width','팝업 최대 가로 크기',240,900)}${field('image','팝업 사진 높이',80,650)}${field('radius','팝업 모서리 둥글기',0,40)}<label class="field">팝업 사진 맞춤 방식<select id="popup-fit"><option value="contain">사진 전체 표시 (잘리지 않음)</option><option value="cover">영역 채우기 (일부 잘릴 수 있음)</option></select></label><button class="btn" type="button" id="popup-layout-save">팝업 디자인 저장</button>`;
 $('editor').prepend(host);
 const img=host.querySelector('#popup-preview-img');
 const get=k=>Number(host.querySelector(`[data-popup-control="${k}"]`).value);
 const fit=host.querySelector('#popup-fit');fit.value=settings.popup_image_fit==='cover'?'cover':'contain';
 let mobile=false;
 const update=()=>{
  const stage=host.querySelector('#popup-preview-stage'),box=host.querySelector('#popup-preview-box');
  stage.style.width=mobile?'390px':'100%';box.style.width=get('width')+'px';box.style.borderRadius=get('radius')+'px';
  img.style.height=get('image')+'px';img.style.objectFit=fit.value;
  host.querySelectorAll('[data-popup-control]').forEach(el=>host.querySelector(`[data-popup-output="${el.dataset.popupControl}"]`).textContent=el.value+'px');
  host.querySelector('#popup-preview-pc').className='btn '+(mobile?'alt':'');
  host.querySelector('#popup-preview-mobile').className='btn '+(mobile?'':'alt');
 };
 host.querySelectorAll('[data-popup-control]').forEach(el=>el.oninput=update);fit.onchange=update;
 host.querySelector('#popup-preview-pc').onclick=()=>{mobile=false;update()};
 host.querySelector('#popup-preview-mobile').onclick=()=>{mobile=true;update()};
 host.querySelector('#popup-layout-save').onclick=async()=>{
  const values=[['popup_width',get('width')],['popup_image_height',get('image')],['popup_radius',get('radius')],['popup_image_fit',fit.value]].map(([key,value])=>({key,value:String(value)}));
  const {error}=await db.from('site_settings').upsert(values,{onConflict:'key'});
  status(error?'팝업 설정 저장 실패: '+msg(error):'팝업 디자인 저장 완료');
 };
 const imageInput=document.querySelector('#entry-editor [name="photo"]');
 if(imageInput)imageInput.addEventListener('change',()=>{const file=imageInput.files?.[0];if(file)img.src=URL.createObjectURL(file)});
 update();
 return host;
}
async function entries(table){const popup=table==='popups';const {data,error}=await db.from(table).select('*').order('created_at',{ascending:false});if(error)throw error;const rows=data||[];$('editor').innerHTML=`<div class="stack"><button class="btn" id="new-entry">+ 새 ${popup?'팝업':'공지'}</button><div id="entry-form"></div>${rows.map(p=>`<div class="item-row"><span>${esc(p.title)}</span><div class="toolbar"><button class="btn alt" data-edit="${p.id}">수정</button><button class="btn alt" data-delete="${p.id}">삭제</button></div></div>`).join('')}</div>`;const edit=p=>{$('entry-form').innerHTML=`<form class="stack" id="entry-editor">${input('title','제목',p.title)}${area('body','내용',p.body)}${check(popup?'enabled':'visible',popup?'팝업 활성화':'공지 공개',popup?p.enabled:p.visible??true)}${popup?`${input('starts_at','시작 날짜·시간',p.starts_at?.slice(0,16)||'','datetime-local')}${input('ends_at','종료 날짜·시간',p.ends_at?.slice(0,16)||'','datetime-local')}<label class="field">팝업 이미지<input name="photo" type="file" accept="image/*"></label>${p.image_url?`<img src="${esc(p.image_url)}" style="max-width:180px" alt="팝업 이미지">`:''}`:''}<button class="btn">저장</button></form>`;if(popup){popupVisualSettings().then(host=>{const img=host.querySelector('#popup-preview-img');if(p.image_url)img.src=p.image_url;host.querySelector('#popup-preview-box strong').textContent=p.title||'팝업 미리보기';host.querySelector('#popup-preview-box p').textContent=p.body||'행사 안내 문구가 여기에 표시됩니다.'}).catch(err=>status(msg(err)))}$('entry-editor').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,d=formData(f);try{const payload={title:d.title,body:d.body,[popup?'enabled':'visible']:f.elements[popup?'enabled':'visible'].checked};if(popup){payload.starts_at=d.starts_at?new Date(d.starts_at).toISOString():null;payload.ends_at=d.ends_at?new Date(d.ends_at).toISOString():null;const url=await upload(f.elements.photo.files[0],'product-images');if(url)payload.image_url=url}const {error}=await (p.id?db.from(table).update(payload).eq('id',p.id):db.from(table).insert(payload));if(error)throw error;status('저장했습니다.');entries(table)}catch(err){status(msg(err))}}};$('new-entry').onclick=()=>edit({visible:true,enabled:true});document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>edit(rows.find(p=>p.id===b.dataset.edit)));document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('삭제할까요?'))return;const {error}=await db.from(table).delete().eq('id',b.dataset.delete);if(error)return status(msg(error));entries(table)})}
show();


// GitHub 파일 편집: 토큰은 브라우저에 두지 않고 Supabase Edge Function에서만 사용합니다.
async function codeEditor(){
 const files=['index.html','admin.html','css/style.css','js/site.js','js/admin.js'];
 const edgeUrl=window.NAMCHON_CONFIG?.CODE_EDITOR_FUNCTION_URL || `${window.NAMCHON_CONFIG?.SUPABASE_URL?.replace(/\/$/,'')}/functions/v1/github-editor`;
 $('editor').innerHTML=`<div class="stack"><p class="muted">HTML·CSS·JavaScript 원본을 GitHub에 게시합니다. 설정을 완료하기 전에는 사용할 수 없습니다. GitHub 토큰을 이 화면이나 config.js에 입력하지 마세요.</p><label class="field">편집할 파일<select id="code-file">${files.map(f=>`<option value="${f}">${f}</option>`).join('')}</select></label><div class="toolbar"><button class="btn alt" id="code-load">GitHub 파일 불러오기</button><button class="btn alt" id="code-preview">HTML/CSS 미리보기</button><button class="btn" id="code-save">GitHub에 게시</button><button class="btn alt" id="code-history">수정 이력·복원</button></div><div id="code-history-panel" class="stack" style="display:none"></div><label class="field">코드<textarea id="code-text" spellcheck="false" rows="22" style="font-family:monospace;tab-size:2;white-space:pre;overflow:auto"></textarea></label><p class="muted" id="code-info">먼저 파일을 불러오세요. 미리보기에서는 JavaScript를 실행하지 않습니다.</p><iframe id="code-frame" title="코드 미리보기" sandbox="" style="width:100%;height:440px;background:white;border:1px solid #888;display:none"></iframe></div>`;
 let sha=null,loadedPath=null;
 const info=t=>$('code-info').textContent=t;
 const request=async(method,path,body,params='')=>{
  const {data:{session},error:sessionError}=await db.auth.getSession();
  if(sessionError||!session?.access_token)throw Error('다시 로그인해 주세요.');
  const response=await fetch(`${edgeUrl}?path=${encodeURIComponent(path)}${params}`,{method,headers:{'Authorization':`Bearer ${session.access_token}`,'apikey':window.NAMCHON_CONFIG.SUPABASE_ANON_KEY,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||`서버 오류 ${response.status}`);
  return data;
 };
 $('code-history').onclick=async()=>{
  const path=$('code-file').value,panel=$('code-history-panel');
  panel.style.display='block';panel.textContent='수정 이력을 불러오는 중...';
  try{
   const result=await request('GET',path,null,'&action=history');
   panel.innerHTML='<h3>GitHub 수정 이력 (최근 20개)</h3><p class="muted">복원하면 선택한 버전의 파일 내용으로 새 GitHub 커밋을 만듭니다. 다른 파일은 변경하지 않습니다.</p>';
   if(!result.history.length){panel.append(document.createTextNode('수정 이력이 없습니다.'));return;}
   for(const entry of result.history){
    const line=document.createElement('div');line.className='item-row';
    const desc=document.createElement('span');
    desc.textContent=`${new Date(entry.date).toLocaleString('ko-KR')} · ${entry.message.slice(0,90)} · ${entry.sha.slice(0,8)}`;
    const actions=document.createElement('div');actions.className='toolbar';
    const view=document.createElement('button');view.className='btn alt';view.textContent='이 버전 불러오기';
    view.onclick=async()=>{
     if($('code-file').value!==path)return info('파일 선택이 바뀌었습니다. 다시 이력을 열어주세요.');
     if($('code-text').value && !confirm('현재 편집 중인 내용이 바뀝니다. 계속할까요?'))return;
     try{
      const old=await request('GET',path,null,`&action=version&ref=${entry.sha}`);
      const current=await request('GET',path);
      $('code-text').value=old.content;sha=current.sha;loadedPath=path;
      info(`${entry.sha.slice(0,8)} 버전을 편집창에 불러왔습니다. 확인 후 GitHub에 게시하면 복원됩니다.`);
     }catch(e){info('과거 버전 불러오기 실패: '+msg(e))}
    };
    actions.append(view);line.append(desc,actions);panel.append(line);
   }
  }catch(e){panel.textContent='수정 이력 조회 실패: '+msg(e)}
 };
 $('code-file').onchange=()=>{$('code-history-panel').style.display='none';sha=null;loadedPath=null;$('code-text').value='';$('code-frame').style.display='none';info('파일을 선택했습니다. GitHub 파일 불러오기를 누르세요.')};
 $('code-load').onclick=async()=>{try{const path=$('code-file').value;info('파일을 불러오는 중...');const result=await request('GET',path);$('code-text').value=result.content;sha=result.sha;loadedPath=path;info(`${path} 불러오기 완료. 편집 후 게시할 수 있습니다.`)}catch(e){info('불러오기 실패: '+msg(e))}};
 $('code-preview').onclick=()=>{if(!sha||loadedPath!==$('code-file').value)return info('먼저 파일을 불러오세요.');const path=loadedPath,code=$('code-text').value;let html;if(path.endsWith('.html')){html=code.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');}else if(path.endsWith('.css')){html=`<!doctype html><meta charset="utf-8"><style>${code.replace(/<\/style/gi,'<\\/style')}</style><main><h1>디자인 미리보기</h1><p>색상, 폰트 등 CSS 일부만 확인할 수 있습니다.</p><button>버튼 예시</button></main>`;}else{return info('JavaScript는 안전상 이 화면에서 실행 미리보기를 지원하지 않습니다. 게시 전 별도 테스트가 필요합니다.')};const frame=$('code-frame');frame.srcdoc=html;frame.style.display='block';info('제한된 미리보기입니다. 실제 사이트와 다를 수 있으며 JavaScript는 실행되지 않습니다.')};
 $('code-save').onclick=async()=>{try{const path=$('code-file').value;if(!sha||loadedPath!==path)throw Error('먼저 해당 파일을 불러오세요.');const content=$('code-text').value;if(!content.trim())throw Error('빈 파일은 게시할 수 없습니다.');if(!confirm(`${path} 파일을 실제 GitHub 홈페이지에 게시할까요? 잘못된 코드는 홈페이지 오류를 일으킬 수 있습니다.`))return;info('GitHub에 게시 중...');const result=await request('POST',path,{sha,content,message:`CMS: update ${path}`});sha=result.sha;info(`게시 완료! GitHub 커밋: ${result.commitSha}. GitHub Pages 반영까지 몇 분 걸릴 수 있습니다.`)}catch(e){info('게시 실패: '+msg(e))}};
}


// 시각적 편집: 기존 site_settings 필드만 수정하며 실제 페이지는 저장 전까지 변경되지 않습니다.
async function visualEditor(){
 const fields=[['hero_title','메인 배너 제목','hero-title'],['hero_desc','메인 배너 설명','hero-desc'],['intro','매장 소개','intro-text'],['address','매장 주소',null],['hours','영업시간',null],['parking','주차 안내',null],['phone','전화번호',null]];
 const settings=await getSettings();
 const labels=Object.fromEntries(fields.map(([k,n])=>[k,n]));
 const controls=fields.map(([k,n])=>`<label class="field" data-vfield="${k}">${n}<textarea data-vinput="${k}" rows="2">${esc(settings[k]||'')}</textarea></label>`).join('');
 $('editor').innerHTML=`<div class="stack"><p class="muted">홈페이지를 미리 보면서 글자를 수정합니다. 저장 전에는 실제 고객 화면이 바뀌지 않습니다. 상품과 사진은 기존 '상품 관리'에서 수정하세요.</p><div class="toolbar"><button class="btn alt" id="v-pc">PC 화면</button><button class="btn alt" id="v-mobile">모바일 화면</button><button class="btn" id="v-save">변경 내용 저장</button></div><div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start"><div style="flex:2 1 350px;min-width:0"><iframe id="v-frame" title="고객 홈페이지 미리보기" src="index.html" style="width:100%;height:650px;background:white;border:2px solid #888;border-radius:8px"></iframe><p class="muted">미리보기의 배너 제목·설명·매장 소개를 클릭하면 해당 입력칸으로 이동합니다.</p></div><div class="stack" style="flex:1 1 240px;min-width:0">${controls}<label class="field">배너 이미지 변경<input id="v-hero-file" type="file" accept="image/*"></label><p id="v-info" class="muted">입력하면 미리보기에서 즉시 확인할 수 있습니다.</p></div></div></div>`;
 const frame=$('v-frame');const info=t=>$('v-info').textContent=t;
 const preview=()=>{try{const doc=frame.contentDocument;if(!doc)return;for(const [key,,id] of fields){if(!id)continue;const node=doc.getElementById(id);if(node)node.textContent=document.querySelector(`[data-vinput="${key}"]`).value;}}catch(e){info('미리보기를 표시하지 못했습니다: '+msg(e))}};
 frame.onload=()=>{setTimeout(preview,350);try{const doc=frame.contentDocument;for(const [key,,id] of fields){if(!id)continue;const node=doc.getElementById(id);if(node){node.style.cursor='pointer';node.title='클릭하여 수정';node.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const field=document.querySelector(`[data-vfield="${key}"]`);field.scrollIntoView({behavior:'smooth',block:'center'});field.querySelector('textarea').focus()})}}}catch(e){info('클릭 선택을 사용할 수 없습니다: '+msg(e))}};
 document.querySelectorAll('[data-vinput]').forEach(el=>el.addEventListener('input',preview));
 $('v-pc').onclick=()=>{frame.style.width='100%';info('PC 화면 미리보기')};
 $('v-mobile').onclick=()=>{frame.style.width='375px';frame.style.maxWidth='100%';info('모바일 375px 미리보기')};
 $('v-save').onclick=async()=>{const btn=$('v-save');btn.disabled=true;try{const changes=fields.map(([key])=>({key,value:document.querySelector(`[data-vinput="${key}"]`).value}));const image=await upload($('v-hero-file').files[0],'product-images');if(image)changes.push({key:'hero_image',value:image});const {error}=await db.from('site_settings').upsert(changes,{onConflict:'key'});if(error)throw error;info('저장 완료! 실제 고객 홈페이지를 새로고침해 확인하세요.');status('시각적 편집 내용이 저장되었습니다.');frame.contentWindow.location.reload()}catch(e){info('저장 실패: '+msg(e))}finally{btn.disabled=false}};
}


// 카드 배치·크기·순서: 기존 products.sort_order 및 site_settings 사용
async function cardLayoutEditor(){
 const [settings,result]=await Promise.all([getSettings(),db.from('products').select('*').order('sort_order')]);
 if(result.error)throw result.error;
 const rows=result.data||[];
 const num=(key,def,min,max)=>{const n=Number(settings[key]);return settings[key]!==undefined&&Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):def};
 const defaults={columns:num('card_columns',4,1,6),mobile:num('card_mobile_columns',2,1,3),gap:num('card_gap',16,0,48),image:num('card_image_height',180,100,420),radius:num('card_radius',10,0,32)};
 const categoryNames=await loadCategoryNames();const groups=[...new Set([...categoryNames,...rows.map(p=>p.category)])].map(cat=>({cat,items:rows.filter(p=>p.category===cat)})).filter(g=>g.items.length);
 const control=(key,label,min,max,unit)=>`<label class="field">${label}<div class="toolbar"><input data-layout="${key}" type="range" min="${min}" max="${max}" value="${defaults[key]}" style="flex:1"><output data-output="${key}">${defaults[key]}${unit}</output></div></label>`;
 $('editor').innerHTML=`<div class="stack"><p class="muted">아래 상품 카드를 마우스로 끌어서 순서를 변경하세요. 슬라이더를 움직이면 카드 크기와 배치가 즉시 미리보기에 반영됩니다. 저장 전에는 실제 홈페이지가 바뀌지 않습니다.</p><div class="toolbar"><button type="button" class="btn" id="layout-save">변경 사항 모두 저장</button><button type="button" class="btn alt" id="layout-reset">크기 설정 초기화</button></div><div class="panel stack"><h3>실제 고객 홈페이지 미리보기</h3><div class="toolbar"><button class="btn" id="layout-pc" type="button">PC 화면</button><button class="btn alt" id="layout-mobile" type="button">모바일 화면</button></div><p class="muted">아래에는 실제 고객 홈페이지가 표시됩니다. 카드 설정을 바꾸면 저장 전에 화면에 반영됩니다.</p><div style="overflow:auto;width:100%;text-align:center"><iframe id="layout-live-frame" title="실제 홈페이지 PC 모바일 미리보기" src="index.html" style="width:100%;max-width:100%;height:720px;border:2px solid #888;border-radius:10px;background:#101010;transition:width .2s"></iframe></div></div><div class="panel stack"><h3>카드 크기·배치 조절</h3>${control('columns','PC 한 줄 카드 개수',1,6,'개')}${control('mobile','모바일 한 줄 카드 개수',1,3,'개')}${control('gap','카드 사이 간격',0,48,'px')}${control('image','카드 사진 높이',100,420,'px')}${control('radius','카드 모서리 둥글기',0,32,'px')}</div><div class="stack"><h3>실제 상품 카드 미리보기·자리 이동</h3><p class="muted">각 카테고리에서 카드를 끌어 다른 카드 위에 놓으면 순서가 바뀝니다. 카테고리 사이 이동은 지원하지 않습니다. 터치 기기에서는 ↑ ↓ 버튼을 이용하세요.</p><div id="layout-stage" style="width:100%;max-width:100%;margin:auto;transition:max-width .2s">${groups.map(g=>`<section class="panel stack"><h3>${esc(g.cat)}</h3><div class="layout-visual-grid" data-order-group="${esc(g.cat)}" style="display:grid;gap:16px">${g.items.map(p=>`<article class="card layout-draggable" draggable="true" data-order-id="${esc(String(p.id))}" style="min-width:0;overflow:hidden;cursor:grab;touch-action:pan-y" title="마우스로 끌어서 순서 변경">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}" draggable="false" loading="lazy" style="width:100%;object-fit:cover">`:'<div data-empty-image style="height:180px;background:#292929;display:grid;place-items:center;color:#aaa">사진 준비 중</div>'}<div class="details" style="padding:10px"><strong style="overflow-wrap:anywhere">${esc(p.name)}</strong><p class="price">${esc(p.price_text||'가격 문의')}</p>${!p.is_visible?'<p class="muted">숨김 상품 (고객 화면에 표시되지 않음)</p>':''}<div class="toolbar" style="margin-top:8px"><button type="button" class="btn alt" data-move="up" title="앞으로 이동">↑</button><button type="button" class="btn alt" data-move="down" title="뒤로 이동">↓</button></div></div></article>`).join('')}</div></section>`).join('')||'<p class="muted">등록된 상품이 없습니다.</p>'}</div></div><p id="layout-info" class="muted" role="status"></p></div>`;
 const root=$('editor'),get=k=>Number(root.querySelector(`[data-layout="${k}"]`).value);
 let mobileMode=false;
 const previewFrame=$('layout-live-frame');
 let previewReady=false;
 const syncLive=()=>{
  if(!previewReady)return;
  try{
   const doc=previewFrame.contentDocument;
   if(!doc||!doc.head)return;
   let style=doc.getElementById('namchon-admin-live-layout');
   if(!style){style=doc.createElement('style');style.id='namchon-admin-live-layout';doc.head.append(style)}
   const cols=mobileMode?get('mobile'):get('columns');
   const imgHeight=mobileMode?Math.max(100,Math.round(get('image')*.8)):get('image');
   style.textContent=`.cards{grid-template-columns:repeat(${cols},minmax(0,1fr))!important;gap:${get('gap')}px!important}.cards .card{min-width:0;border-radius:${get('radius')}px!important;overflow:hidden}.cards .card img{height:${imgHeight}px!important;object-fit:cover}`;
   for(const group of root.querySelectorAll('[data-order-group]')){
    const cat=group.dataset.orderGroup;
    const section=[...doc.querySelectorAll('[data-cat]')].find(el=>el.dataset.cat===cat);
    if(!section)continue;
    const cards=[...section.querySelectorAll(':scope > .card')];
    const byName=new Map(cards.map(el=>[el.querySelector('.details strong')?.textContent?.trim(),el]));
    for(const el of group.querySelectorAll('[data-order-id]')){
     const product=rows.find(p=>String(p.id)===el.dataset.orderId);
     if(!product)continue;
     const card=byName.get(product.name);
     if(card)section.appendChild(card);
    }
   }
  }catch(e){$('layout-info').textContent='미리보기를 조정할 수 없습니다: '+msg(e)}
 };
 previewFrame.addEventListener('load',()=>{previewReady=true;syncLive();const doc=previewFrame.contentDocument;if(doc){const watch=doc.getElementById('product-sections');if(watch){const observer=new MutationObserver(()=>{observer.disconnect();syncLive()});observer.observe(watch,{childList:true,subtree:true})}}});
 const update=()=>{
  for(const k of Object.keys(defaults))root.querySelector(`[data-output="${k}"]`).textContent=get(k)+(k==='columns'||k==='mobile'?'개':'px');
  const stage=$('layout-stage');stage.style.maxWidth=mobileMode?'390px':'100%';
  for(const grid of root.querySelectorAll('.layout-visual-grid')){
   grid.style.gridTemplateColumns=`repeat(${mobileMode?get('mobile'):get('columns')},minmax(0,1fr))`;
   grid.style.gap=get('gap')+'px';
   grid.querySelectorAll('.layout-draggable').forEach(el=>{
    el.style.borderRadius=get('radius')+'px';
    const img=el.querySelector('img'),empty=el.querySelector('[data-empty-image]');
    if(img)img.style.height=(mobileMode?Math.max(100,Math.round(get('image')*.8)):get('image'))+'px';
    if(empty)empty.style.height=(mobileMode?Math.max(100,Math.round(get('image')*.8)):get('image'))+'px';
   });
  }
  $('layout-pc').className='btn '+(mobileMode?'alt':'');
  $('layout-mobile').className='btn '+(mobileMode?'':'alt');
  previewFrame.style.width=mobileMode?'390px':'100%';
  syncLive();
 };
 root.querySelectorAll('[data-layout]').forEach(el=>el.addEventListener('input',update));
 $('layout-pc').onclick=()=>{mobileMode=false;update()};
 $('layout-mobile').onclick=()=>{mobileMode=true;update()};
 $('layout-reset').onclick=()=>{for(const [k,v] of Object.entries({columns:4,mobile:2,gap:16,image:180,radius:10}))root.querySelector(`[data-layout="${k}"]`).value=v;update()};
 root.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>{
  const item=b.closest('[data-order-id]');
  if(b.dataset.move==='up'&&item.previousElementSibling?.hasAttribute('data-order-id'))item.parentElement.insertBefore(item,item.previousElementSibling);
  if(b.dataset.move==='down'&&item.nextElementSibling?.hasAttribute('data-order-id'))item.parentElement.insertBefore(item.nextElementSibling,item);
 });
 let dragging=null;
 root.querySelectorAll('.layout-draggable').forEach(card=>{
  card.addEventListener('dragstart',e=>{dragging=card;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',card.dataset.orderId);card.style.opacity='.5'});
  card.addEventListener('dragend',()=>{card.style.opacity='1';dragging=null});
  card.addEventListener('dragover',e=>{if(dragging&&dragging!==card&&dragging.parentElement===card.parentElement){e.preventDefault();e.dataTransfer.dropEffect='move'}});
  card.addEventListener('drop',e=>{if(!dragging||dragging===card||dragging.parentElement!==card.parentElement)return;e.preventDefault();const rect=card.getBoundingClientRect();const before=e.clientY<rect.top+rect.height/2;card.parentElement.insertBefore(dragging,before?card:card.nextSibling);syncLive()});
 });
 $('layout-save').onclick=async()=>{
  if(!confirm('카드 디자인과 상품 순서를 실제 홈페이지에 저장할까요?'))return;
  const btn=$('layout-save'),info=$('layout-info');btn.disabled=true;info.textContent='저장 중...';
  try{
   const changes=[['card_columns',get('columns')],['card_mobile_columns',get('mobile')],['card_gap',get('gap')],['card_image_height',get('image')],['card_radius',get('radius')]].map(([key,value])=>({key,value:String(value)}));
   const {error}=await db.from('site_settings').upsert(changes,{onConflict:'key'});if(error)throw error;
   let index=1;
   for(const group of root.querySelectorAll('[data-order-group]')){
    for(const el of group.querySelectorAll('[data-order-id]')){
     const row=rows.find(p=>String(p.id)===el.dataset.orderId);
     if(!row)throw Error('상품을 찾을 수 없습니다.');
     if(Number(row.sort_order)!==index){const {error}=await db.from('products').update({sort_order:index}).eq('id',row.id);if(error)throw error;}
     index++;
    }
   }
   info.textContent='저장 성공! 고객 홈페이지를 새로고침해 확인하세요.';
   status('시각적 카드 편집 저장 완료');
  }catch(e){info.textContent='저장 중 오류가 발생했습니다. 일부 변경이 적용됐을 수 있습니다: '+msg(e)}
  finally{btn.disabled=false}
 };
 update();
}


async function loadCategoryNames(){
 const s=await getSettings();
 try{const v=JSON.parse(s.custom_categories||'null');if(Array.isArray(v))return v.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim())}catch(e){}
 return [...categories];
}
async function categoryManager(){
 const names=await loadCategoryNames();
 const {data:products,error}=await db.from('products').select('id,category,name');if(error)throw error;
 const counts=n=>products.filter(p=>p.category===n).length;
 $('editor').innerHTML=`<div class="stack"><p class="muted">카테고리를 추가하거나 순서를 바꿀 수 있습니다. 삭제는 상품이 없는 카테고리만 가능합니다. 상품이 있으면 먼저 다른 카테고리로 이동하세요.</p><form id="category-add" class="toolbar"><input name="newname" placeholder="새 카테고리 이름" maxlength="40" required style="flex:1;min-width:150px;padding:11px;border-radius:6px"><button class="btn">+ 추가</button></form><div id="category-rows">${names.map((n,i)=>`<div class="item-row" data-cat-name="${esc(n)}"><span><strong>${esc(n)}</strong> <small class="muted">(${counts(n)}개 상품)</small></span><div class="toolbar"><button type="button" class="btn alt" data-cat-up="${i}">↑</button><button type="button" class="btn alt" data-cat-down="${i}">↓</button><button type="button" class="btn alt" data-cat-rename="${i}">이름 변경</button><button type="button" class="btn alt" data-cat-delete="${i}">삭제</button></div></div>`).join('')}</div><p class="muted">순서를 변경한 뒤 아래 저장 버튼을 눌러야 실제 홈페이지에 반영됩니다.</p><button class="btn" id="category-save" type="button">카테고리 순서 저장</button></div>`;
 const rows=$('category-rows'),current=()=>[...rows.querySelectorAll('[data-cat-name]')].map(e=>e.dataset.catName);
 const save=async()=>{const {error}=await db.from('site_settings').upsert({key:'custom_categories',value:JSON.stringify(current())},{onConflict:'key'});if(error)throw error;status('카테고리가 저장됐습니다.');};
 $('category-add').onsubmit=async e=>{e.preventDefault();const name=e.currentTarget.elements.newname.value.trim();if(!name||current().includes(name))return alert('이미 있는 이름이거나 잘못된 이름입니다.');const next=[...current(),name];const {error}=await db.from('site_settings').upsert({key:'custom_categories',value:JSON.stringify(next)},{onConflict:'key'});if(error)return status(msg(error));categoryManager()};
 rows.onclick=async e=>{
  const b=e.target.closest('button');if(!b)return;
  const row=b.closest('[data-cat-name]'),name=row.dataset.catName;
  if(b.hasAttribute('data-cat-up')){if(row.previousElementSibling)rows.insertBefore(row,row.previousElementSibling);return}
  if(b.hasAttribute('data-cat-down')){if(row.nextElementSibling)rows.insertBefore(row.nextElementSibling,row);return}
  if(b.hasAttribute('data-cat-delete')){
   if(counts(name))return alert('이 카테고리에 상품이 '+counts(name)+'개 있습니다. 상품 관리에서 먼저 다른 카테고리로 이동하세요.');
   if(!confirm(name+' 카테고리를 삭제할까요?'))return;
   row.remove();try{await save();await categoryManager()}catch(err){status(msg(err))}return;
  }
  if(b.hasAttribute('data-cat-rename')){
   const renamed=prompt('새 카테고리 이름',name)?.trim();
   if(!renamed||renamed===name)return;
   if(current().includes(renamed))return alert('이미 있는 이름입니다.');
   if(!confirm('카테고리 이름을 변경하고 소속 상품 '+counts(name)+'개의 카테고리도 변경할까요?'))return;
   try{
    for(const p of products.filter(p=>p.category===name)){const {error}=await db.from('products').update({category:renamed}).eq('id',p.id);if(error)throw error}
    row.dataset.catName=renamed;await save();await categoryManager();
   }catch(err){status('이름 변경 중 오류: '+msg(err)+' (일부 상품이 변경됐을 수 있습니다)')}
  }
 };
 $('category-save').onclick=async()=>{try{await save()}catch(e){status(msg(e))}};
}
