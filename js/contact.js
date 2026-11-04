/* Contact number picker: no credentials or backend needed. */
(()=>{
 const dialog=document.getElementById('contact-dialog');
 const title=document.getElementById('contact-dialog-title');
 const close=document.getElementById('contact-dialog-close');
 if(!dialog||!title||!close)return;
 let opener=null;
 const hide=()=>{dialog.classList.add('hidden');document.body.style.overflow='';if(opener)opener.focus();};
 document.querySelectorAll('[data-contact-kind]').forEach(button=>button.addEventListener('click',()=>{
  opener=button;title.textContent=button.dataset.contactKind+' · 전화번호 선택';
  dialog.classList.remove('hidden');document.body.style.overflow='hidden';close.focus();
 }));
 close.addEventListener('click',hide);
 dialog.addEventListener('click',e=>{if(e.target===dialog)hide();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!dialog.classList.contains('hidden'))hide();});
})();
