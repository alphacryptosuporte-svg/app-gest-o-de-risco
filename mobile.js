/* Camada mobile: comportamentos de toque. No desktop os elementos injetados ficam ocultos
   e nenhuma função do app é alterada (os wrappers só agem quando a tela é de celular). */
(function(){
const MQ=matchMedia('(max-width:820px), (pointer:coarse) and (max-height:520px)');
const B=document.body,$=s=>document.querySelector(s);
const st=document.createElement('style');st.textContent='.mob-only{display:none}';document.head.appendChild(st);

const vib=n=>{try{MQ.matches&&navigator.vibrate&&navigator.vibrate(n||8)}catch(e){}};

/* ícones na barra de abas */
const IC={
 R:'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>',
 T:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
 C:'<path d="M3 7a2 2 0 012-2h13v4"/><path d="M3 7v11a2 2 0 002 2h15a1 1 0 001-1V9a1 1 0 00-1-1H5a2 2 0 01-2-1z"/><circle cx="16.5" cy="14" r="1"/>',
 P:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
 S:'<path d="M4 5.5A1.5 1.5 0 015.5 4H20v14H5.5A1.5 1.5 0 004 19.5z"/><path d="M4 19.5A1.5 1.5 0 005.5 21H20"/>'};
document.querySelectorAll('.tabs button').forEach(b=>{
 const k=b.id.replace('tab','');
 if(IC[k]&&!b.querySelector('svg'))b.insertAdjacentHTML('afterbegin','<svg class="mob-only" viewBox="0 0 24 24" aria-hidden="true">'+IC[k]+'</svg>')});

function syncTab(){const on=$('.tabs button.on');B.dataset.tab=on?on.id.replace('tab',''):'R'}

/* formulário de trade em tela cheia */
const sheet=$('#vTrades>.card.tf');
let pushed=false;
function openForm(){if(!MQ.matches||B.classList.contains('mform'))return;B.classList.add('mform');
 try{history.pushState({mf:1},'');pushed=true}catch(e){}
 if(sheet)sheet.scrollTop=0}
function closeForm(fromPop){if(!B.classList.contains('mform'))return;B.classList.remove('mform');
 if(pushed&&!fromPop){pushed=false;try{history.back()}catch(e){}}pushed=false}
addEventListener('popstate',()=>{if(B.classList.contains('mform'))closeForm(true)});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeForm()});
MQ.addEventListener('change',e=>{if(!e.matches)B.classList.remove('mform')});

/* aviso rápido */
const toast=document.createElement('div');toast.className='mob-only toast';toast.setAttribute('role','status');B.appendChild(toast);
let tt;function say(t){toast.textContent=t;toast.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>toast.classList.remove('show'),2200)}

/* botão + e botão de fechar */
const fab=document.createElement('button');fab.className='mob-only fab';fab.id='fabNew';fab.type='button';fab.setAttribute('aria-label','Novo trade');fab.textContent='+';
fab.onclick=()=>{vib();openForm()};B.appendChild(fab);
if(sheet){const x=document.createElement('button');x.className='mob-only mclose';x.type='button';x.setAttribute('aria-label','Fechar formulário');x.textContent='×';
 x.onclick=()=>{if(typeof editId!=='undefined'&&editId!==null&&typeof window.clearF==='function')window.clearF();else closeForm()};
 sheet.insertBefore(x,sheet.firstChild)}

/* indicador dos cartões de risco (A / B) */
const cards=$('.cards');
if(cards){const d=document.createElement('div');d.className='mob-only dots';d.innerHTML='<i class="on"></i><i></i>';cards.after(d);
 cards.addEventListener('scroll',()=>{const m=cards.scrollWidth-cards.clientWidth,i=m>0&&cards.scrollLeft/m>.5?1:0;
  d.children[0].classList.toggle('on',i===0);d.children[1].classList.toggle('on',i===1)},{passive:true})}

/* ganchos nas funções do app (só agem em tela de celular) */
const wrap=(name,fn)=>{const o=window[name];if(typeof o!=='function')return;window[name]=function(){const r=o.apply(this,arguments);try{fn.apply(this,arguments)}catch(e){}return r}};
wrap('tab',()=>{syncTab();if(MQ.matches){closeForm();scrollTo(0,0);vib(6)}});
wrap('editT',()=>openForm());
wrap('clearF',()=>closeForm());
(function(){const o=window.commitT;if(typeof o!=='function')return;
 window.commitT=function(){const edit=typeof editId!=='undefined'&&editId!==null,r=o.apply(this,arguments);
  try{const m=$('#tmsg');if(MQ.matches&&m&&!m.textContent){say(edit?'Alterações salvas':'Trade salvo');vib(14)}}catch(e){}return r}})();
wrap('add',()=>{if(MQ.matches){const h=$('#hint');if(h&&!h.textContent)say('Perda registrada')}});

syncTab();
})();
