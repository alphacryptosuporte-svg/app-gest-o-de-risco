const CFG={A:{name:'Sistema A',per:'semana',limit:6,min:.5,max:2,reset:'Nova semana'},B:{name:'Sistema B',per:'mês',limit:8,min:1.5,max:3,reset:'Novo mês'}};
const KEY='gr_v3',BK='gr_bank';

/* ===== Tetos configuráveis, risco aberto, filtros, fechar trade, desempenho, histórico do protocolo ===== */
let DLIM=10,pdim='setup';
const TF={q:'',s:'',c:'',r:'',o:'D'};
(function(){try{const o=JSON.parse(localStorage.getItem('gr_cfg')||'{}');if(o.A>0)CFG.A.limit=o.A;if(o.B>0)CFG.B.limit=o.B;if(o.D>0)DLIM=o.D}catch(e){}})();
function cfgFill(){[['A',CFG.A.limit],['B',CFG.B.limit],['D',DLIM]].forEach(([k,v])=>{const e=document.getElementById('cfg'+k);if(e)e.value=pc(v)})}
function cfgSave(){try{localStorage.setItem('gr_cfg',JSON.stringify({A:CFG.A.limit,B:CFG.B.limit,D:DLIM}))}catch(e){}}
function cfgSet(k,v){const n=num(v);if(n>0&&n<=100){if(k==='D')DLIM=n;else CFG[k].limit=n;cfgSave()}cfgFill();render()}
function cfgReset(){CFG.A.limit=6;CFG.B.limit=8;DLIM=10;cfgSave();cfgFill();render()}

/* risco dos trades abertos (até o stop, só a parte ainda aberta) entra no espaço disponível do teto */
const openRisk=(k,ex)=>trades.filter(isU).reduce((s,t)=>{if(t.id===ex||sysOf(t)!==k)return s;const c=calc(t);return c.open&&c.N>0?s+riskOf(t)*c.rem/c.N:s},0);
const room=(k,ex)=>Math.max(lim(k)-sum(k)-openRisk(k,ex),0);

function render(){renderRisk();renderTrades();renderCart();specRender();rmaxUpd()}
async function backup(){await doBackup();if(/gerado/.test(kmsg.textContent)){try{localStorage.setItem('gr_lastbk',String(Date.now()))}catch(e){}}bkInfo();render()}
function bkApply(o){try{
 if(o.cfg){if(o.cfg.A>0)CFG.A.limit=o.cfg.A;if(o.cfg.B>0)CFG.B.limit=o.cfg.B;if(o.cfg.D>0)DLIM=o.cfg.D;cfgSave();cfgFill()}
 if(o.specs&&typeof o.specs==='object'){specs.forEach(x=>{const s=o.specs[x.n];if(s&&s.lo>0&&s.hi>0){x.lo=s.lo;x.hi=s.hi}});saveSp()}
 if(o.phist&&typeof o.phist==='object')localStorage.setItem('gr_phist',JSON.stringify(o.phist))
}catch(e){}}

/* filtros e busca na aba Trades */
function tfSet(k,v){TF[k]=v;renderTrades()}
function fltFill(){const S=[...new Set(trades.map(t=>t.setup).filter(Boolean))].sort(),B=brokers.map(b=>b.n);
 const set=(id,key,arr,lab)=>{const e=document.getElementById(id);if(!e)return;const h=`<option value="">${lab}</option>`+arr.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(e.dataset.h!==h){e.dataset.h=h;e.innerHTML=h;e.value=TF[key]}};
 set('tfS','s',S,'Todos os setups');set('tfC','c',B,'Todas as corretoras')}
function fltL(L){const q=nz(TF.q);let R=L.filter(t=>{const c=calc(t);
 if(TF.s&&t.setup!==TF.s)return false;if(TF.c&&(t.corr||'')!==TF.c)return false;
 if(TF.r==='G'&&!(!c.open&&c.net>0))return false;if(TF.r==='L'&&!(!c.open&&c.net<0))return false;if(TF.r==='O'&&!c.open)return false;
 return !q||nz([t.sym,t.setup,t.corr,t.rel].join(' ')).includes(q)});
 if(TF.o==='A')R=R.slice().sort(byTime);else if(TF.o==='G')R=R.slice().sort((a,b)=>calc(b).net-calc(a).net);else if(TF.o==='P')R=R.slice().sort((a,b)=>calc(a).net-calc(b).net);
 const e=document.getElementById('tfN');if(e)e.textContent=R.length===L.length?'':'Mostrando '+R.length+' de '+L.length+' trades do mês.';return R}

/* fechar trade com preço, data e hora */
function closeT(id){const t=trades.find(x=>x.id===id);if(!t)return;const c=calc(t),n=new Date(),o=document.createElement('div');
 o.style.cssText='position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.72);display:grid;place-items:center';
 o.innerHTML=`<div class="card tf" style="max-width:380px;width:90%;background:#0b0b0b"><h3>Fechar ${esc(t.sym)} ${t.type}</h3>
 <label>Preço de saída</label><input id="cxP" inputmode="decimal" autocomplete="off">
 <label style="margin-top:10px">Notional a fechar (vazio = tudo, restam ${mny(t.cart,c.rem)})</label><input id="cxN" inputmode="decimal" autocomplete="off">
 <div class="r2" style="margin-top:10px"><div><label>Data</label><input id="cxD" type="date" value="${ymd(n)}"></div><div><label>Hora</label><input id="cxH" type="time" step="1" value="${n.toTimeString().slice(0,8)}"></div></div>
 <div id="cxM" class="tmsg"></div><button class="go" id="cxOk">Fechar trade</button><button class="ghost" id="cxNo" style="margin-top:8px">Cancelar</button></div>`;
 document.body.appendChild(o);const q=i=>o.querySelector('#'+i),end=()=>o.remove();
 q('cxNo').onclick=end;o.onmousedown=e=>{if(e.target===o)end()};q('cxP').focus();
 q('cxOk').onclick=()=>{const p=num(q('cxP').value),m=num(q('cxN').value)||0,d=q('cxD').value;
  if(!(p>0)){q('cxM').textContent='Informe o preço de saída.';return}
  if(!d){q('cxM').textContent='Informe a data.';return}
  if(m>c.rem+0.005){q('cxM').textContent='O notional passa do que ainda está aberto.';return}
  const L=legsOf(t);t.ent=L.E;t.exs=L.X.concat([{p,n:m}]);
  const S=legStats(L.E,t.exs,t.type);t.exit=(!S.open&&S.cN>0)?S.avgExit:0;
  if(!S.open){t.ds=d;t.hs=q('cxH').value||'';month=d.slice(0,7)}
  saveTr();end();render()}}

/* desempenho por recorte, com R */
const DIA=['dom','seg','ter','qua','qui','sex','sáb'];
const PD={setup:t=>t.setup||'SEM SETUP',ativo:t=>t.sym,corretora:t=>t.corr||'(sem corretora)',dia:t=>DIA[new Date(dOf(t)+'T00:00:00').getDay()],hora:t=>t.he?t.he.slice(0,2)+'h':'sem hora'};
function perfDim(d){pdim=d;perfRender()}
function perfRender(){const el=document.getElementById('perfBody');if(!el)return;
 document.querySelectorAll('#perfDims button').forEach(b=>b.classList.toggle('on',b.dataset.d===pdim));
 const G={},T={n:0,pnl:0,R:0,nR:0},sR=v=>(v>=0?'+':'')+f(v)+'R';
 trades.filter(isU).forEach(t=>{const c=calc(t);if(c.open)return;const k=PD[pdim](t),r=riskOf(t),g=G[k]=G[k]||{n:0,w:0,pnl:0,R:0,nR:0};
  g.n++;T.n++;if(c.net>0)g.w++;g.pnl+=c.net;T.pnl+=c.net;if(r>0){g.R+=c.net/r;g.nR++;T.R+=c.net/r;T.nR++}});
 const rows=Object.entries(G).sort((a,b)=>pdim==='dia'?DIA.indexOf(a[0])-DIA.indexOf(b[0]):pdim==='hora'?a[0].localeCompare(b[0]):b[1].pnl-a[1].pnl);
 const cd=(k,v,s,cl)=>`<div><small>${k}</small><b${cl?` class="${cl}"`:''}>${v}</b>${s?`<small>${s}</small>`:''}</div>`,sc=v=>v>0?'cy':v<0?'neg':'';
 perfSum.innerHTML=T.n?cd('Trades fechados',T.n)+cd('R acumulado',sR(T.R),'em '+T.nR+' com stop',sc(T.R))+cd('Expectativa',T.nR?sR(T.R/T.nR):'-','por trade com stop',T.nR?sc(T.R):'')+cd('Expectativa em US$',sg(T.pnl/T.n),'por trade',sc(T.pnl)):'';
 el.innerHTML=rows.length?rows.map(([k,g])=>`<tr><td>${esc(k)}</td><td>${g.n}</td><td>${f(g.w/g.n*100)}%</td><td class="${g.pnl>0?'pos':g.pnl<0?'neg':''}">${sg(g.pnl)}</td><td>${g.nR?sR(g.R/g.nR):'-'}<small>${g.nR} com stop</small></td></tr>`).join(''):'<tr><td colspan="5" style="color:var(--ink3)">Sem trades fechados na carteira USD.</td></tr>'}

/* histórico do protocolo diário */
/* porta de entrada: o app só libera depois do protocolo diário */
let gateWas=null;
const gateOpen=()=>{if(pr.d!==ymd(new Date()))pLoad();return PROTO.every(pDone)||!!pr.o};
function gateApply(){const open=gateOpen(),was=gateWas;gateWas=open;document.body.classList.toggle('gated',!open);return !open?'P':(was===false?'R':'')}
function gateGo(){const g=gateApply();if(g==='R'||(g==='P'&&vProto.style.display==='none'))tab(g)}

const phGet=()=>{try{return JSON.parse(localStorage.getItem('gr_phist')||'{}')||{}}catch(e){return{}}};
function phSave(){try{const H=phGet(),n=PROTO.filter(pDone).length;H[pr.d]={ok:n===PROTO.length?1:0,n,e:pr.e||''};const ks=Object.keys(H).sort();while(ks.length>400)delete H[ks.shift()];localStorage.setItem('gr_phist',JSON.stringify(H))}catch(e){}}
function phRender(){const el=document.getElementById('phBody');if(!el)return;
 const H=phGet(),D={},G={1:[],0:[]},today=ymd(new Date());
 trades.filter(isU).forEach(t=>{const c=calc(t);if(c.open||!t.ds)return;D[t.ds]=(D[t.ds]||0)+c.net});
 Object.keys(D).forEach(d=>{if(H[d])G[H[d].ok?1:0].push(D[d])});
 let sk=0;for(const d of Object.keys(H).sort().reverse()){if(H[d].ok)sk++;else if(d!==today)break}
 const row=(l,a)=>`<div><small>${l}</small><b class="${a.length&&sm(a)>0?'pos':a.length&&sm(a)<0?'neg':''}">${a.length?sg(sm(a)/a.length):'-'}</b><small>${a.length} ${pl(a.length,'dia','dias')} com trades${a.length?', '+a.filter(x=>x>0).length+' no positivo':''}</small></div>`;
 el.innerHTML=row('Protocolo completo',G[1])+row('Protocolo incompleto',G[0])+`<div><small>Sequência atual</small><b>${sk}</b><small>${pl(sk,'dia completo seguido','dias completos seguidos')}</small></div>`;
 document.getElementById('phNote').textContent=(G[0].length+G[1].length)<5?'Ainda são poucos dias com protocolo registrado e trades fechados. A comparação ganha sentido depois de algumas semanas.':'Média de resultado por dia com trades fechados (pela data de saída), separada pelo protocolo daquele dia.'}

let st={A:[],B:[]},cur='A',bank=600,base=600,flows=[];
const f=n=>n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const usd=n=>'$'+f(n);
const pc=n=>String(n).replace('.',',');
function num(t){t=String(t).trim().replace(/\s/g,'');if(t.includes(','))t=t.replace(/\./g,'').replace(',','.');return parseFloat(t)}
function load(){try{
 const b=localStorage.getItem(BK);if(b!==null)bank=parseFloat(b)||0;const bs=localStorage.getItem('gr_base');base=bs!==null?parseFloat(bs)||0:bank;try{flows=JSON.parse(localStorage.getItem('gr_flows')||'[]')}catch(e){}
 const r=localStorage.getItem(KEY);if(r){st=JSON.parse(r);return}
 const o=localStorage.getItem('gr_v2');
 if(o){const q=JSON.parse(o);['A','B'].forEach(k=>st[k]=(q[k]||[]).map(e=>({v:e.v*bank/100,t:e.t})))}
}catch(e){}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(st));localStorage.setItem(BK,String(bank));localStorage.setItem('gr_base',String(base));localStorage.setItem('gr_flows',JSON.stringify(flows))}catch(e){}}
const TK='gr_trades';let trades=[],editId=null,tType='LONG',month='',tCart='USD',tView='USD';
const isU=t=>t.cart!=='BRL',brl=n=>'R$ '+f(n),mny=(c,n)=>c==='BRL'?brl(n):usd(n),sgm=(c,n)=>(n>0?'+':n<0?'-':'')+mny(c,Math.abs(n));
const accB=()=>trades.filter(t=>t.cart==='BRL'&&!calc(t).open).reduce((a,t)=>a+calc(t).net,0);
function vSync(){tvU.classList.toggle('on',tView==='USD');tvB.classList.toggle('on',tView==='BRL')}
function tviewSet(c){tView=c;vSync();if(!editId)cpick(c);renderTrades()}
function cpick(c){tCart=c;tcU.classList.toggle('on',c==='USD');tcB.classList.toggle('on',c==='BRL');
 document.querySelectorAll('#vTrades .tf label').forEach(l=>{if(!l.dataset.o)l.dataset.o=l.textContent;l.textContent=c==='BRL'?l.dataset.o.replace('US$','R$'):l.dataset.o});
 if(c==='BRL')mpick('SPOT');else updPrev()}
const SETUPS=['SCALP','DIVAP','RETRAÇÃO DA DIVAP','RETRAÇÃO','EMAS','SWING','PERFEIÇÃO','MEIO DIA','LIBERDADE','ZIG ZAG','TORRES GÊMEAS','VIP'];
const TFS=['M5','M15','M30','H1','H4','H12','D','S'],LOWTF=['M1','M5','M15','M30','H1'];
const SPEC0=[{n:'SCALP',lo:2,hi:2,r:'Qualquer time frame.'},{n:'DIVAP',lo:1,hi:2,r:'T.F até H1 usa o limite menor; acima de H1, o maior.'},{n:'RETRAÇÃO DA DIVAP',lo:1,hi:2,r:'T.F até H1 usa o limite menor; acima de H1, o maior.'},{n:'RETRAÇÃO',lo:2,hi:2,r:'Indicado para T.F acima de H1.'},{n:'EMAS',lo:2,hi:2,r:'Qualquer time frame.'},{n:'SWING',lo:3,hi:3,r:'Qualquer time frame.'},{n:'PERFEIÇÃO',lo:3,hi:3,r:'Qualquer time frame.'}];
let specs=SPEC0.map(x=>({...x}));
(function(){try{const o=JSON.parse(localStorage.getItem('gr_specs')||'{}');specs.forEach(x=>{if(o[x.n]){x.lo=o[x.n].lo>0?o[x.n].lo:x.lo;x.hi=o[x.n].hi>0?o[x.n].hi:x.hi}})}catch(e){}})();
const nz=x=>String(x||'').normalize('NFD').split('').filter(c=>c.charCodeAt(0)<768||c.charCodeAt(0)>879).join('').toUpperCase().replace(/ +/g,' ').trim();
function specFor(setup,tf){const n=nz(setup),low=TFS.indexOf(tf)<=TFS.indexOf('H1'),k=LOWTF.includes(tf)?'A':'B';
 const s=specs.slice().sort((a,b)=>b.n.length-a.n.length).find(x=>n===nz(x.n)||n.startsWith(nz(x.n)+' '));
 return s?{pct:low?s.lo:s.hi,label:'do setup '+s.n,known:true,spec:s,low,k}:{pct:CFG[k].max,label:'do Sistema '+k,known:false,spec:null,low,k}}
function rmaxUpd(){const tf=fTf.value,sn=fSetup.value.trim();rmax.style.display='';
 if(!sn){rmax.className='rmax';rmax.innerHTML='Escolha o setup para ver o risco máximo permitido neste trade.';return}
 if(!(bank>0)){rmax.className='rmax w';rmax.innerHTML='Informe o capital da banca na aba Risco.';return}
 const sp=specFor(sn,tf),k=sp.k,mx=bank*sp.pct/100,rest=room(k,editId),eff=Math.min(mx,rest);
 let sub=`${pc(sp.pct)}% da banca ${sp.label}`+(sp.known?` (T.F ${sp.low?'até':'acima de'} H1).`:'. Setup sem regra própria: vale o limite do Sistema '+k+'.');
 if(rest<mx)sub+=` Limitado pelo que resta no teto do Sistema ${k}: ${usd(rest)}.`;
 if(sp.spec&&sp.spec.n==='RETRAÇÃO'&&TFS.indexOf(tf)<TFS.indexOf('H1'))sub+=' Setup indicado para T.F acima de H1.';
 const nf=infoFor(sn);if(nf&&nf.rule)sub+=' '+nf.rule;
 rmax.className='rmax'+(rest<=0?' w':'');
 rmax.innerHTML=rest<=0?`Teto do Sistema ${k} atingido: não abra este trade.<small>${sub}</small>`:`Risco máximo neste trade: <b>${usd(eff)}</b><small>${sub}</small>`}
function saveSp(){try{const o={};specs.forEach(x=>o[x.n]={lo:x.lo,hi:x.hi});localStorage.setItem('gr_specs',JSON.stringify(o))}catch(e){}}
function specSet(i,key,v){const n=num(v);if(n>0&&n<=100)specs[i][key]=n;saveSp();specRender();updPrev()}
function specReset(){ask('Restaurar os limites padrão (banca de $600: 2%, 1% e 3%)?').then(ok=>{if(ok){specs=SPEC0.map(x=>({...x}));saveSp();specRender();updPrev()}})}

const EMAS4=[['EMA 7','Mais rápida: sinal imediato.'],['EMA 30','Tendência de curto prazo.'],['EMA 100','Entrada 1: suporte/resistência chave.'],['EMA 197','Entrada 2: stop técnico de referência.']];
const INFO=[
{n:'EMAS',eb:'Setup da Vitória',tag:'Fundamental',keys:['EMAS','VITORIA','SETUP DA VITORIA'],risk:['EMAS'],desc:'O setup mais versátil. Funciona em qualquer time frame: 1m, 1h, 4h, Diário, Semanal e Mensal.',tf:'Qualquer time frame',ent:'Toque na EMA 100 ou EMA 197, no máximo 3 toques.',stop:'S/R mais próximo além da EMA 197.',alvo:'S/R históricos + extensão Fibonacci do pivot.'},
{n:'MEIO DIA',eb:'Setup Meio Dia',tag:'H12',keys:['MEIO DIA'],risk:[],sys:'Sistema B (T.F H12)',desc:'Igual ao Setup da Vitória, mas somente o 1º e o 2º toque nas médias são válidos.',tf:'H12',ent:'Toque na EMA 100 ou EMA 197: só o 1º e o 2º toque valem.',stop:'S/R mais próximo além da EMA 197.',alvo:'S/R históricos + extensão Fibonacci do pivot.'},
{n:'RETRAÇÃO',eb:'Setup da Lamborghini',tag:'Alta RR',keys:['RETRACAO','LAMBORGHINI','SETUP DA LAMBORGHINI'],risk:['RETRAÇÃO'],desc:'Após uma tendência direcional, comprar ou vender na retração de Fibonacci da pernada.',tf:'Acima de H1',ent:'Ordem limit em 50% ou 61,8% da retração.',stop:'Abaixo de 100%: a tendência fica invalidada.'},
{n:'DIVAP e RETRAÇÃO DA DIVAP',eb:'DIVAP da Lambo (variação da Lamborghini)',tag:'Variação',keys:['DIVAP','RETRACAO DA DIVAP'],risk:['DIVAP','RETRAÇÃO DA DIVAP'],desc:'Variação do Setup da Lamborghini: a entrada é no gatilho, não no rompimento. O DIVAP também é usado como confluência no Setup da Perfeição.',ent:'No gatilho, não no rompimento.'},
{n:'PERFEIÇÃO',eb:'Setup da Perfeição',tag:'Confluências',keys:['PERFEICAO','SETUP DA PERFEICAO'],risk:['PERFEIÇÃO'],desc:'Entrada em suporte ou resistência do Diário, Semanal ou Mensal, com o máximo de confluências.',tf:'Diário, Semanal ou Mensal',ent:'S/R de time frame maior, ordem apregoada.',stop:'Próximo S/R abaixo ou acima da entrada.',conf:'StochRSI, DIVAP, divergência de RSI, Bandas, LTA/LTB.'},
{n:'SWING',eb:'Swing Trade (estilo de operação)',tag:'Estilo',keys:['SWING'],risk:['SWING'],desc:'Oscilações dentro de uma tendência maior, com duração de dias a semanas.',tf:'4h a Diário'},
{n:'LIBERDADE',eb:'Setup da Liberdade',tag:'Grandes tendências',keys:['LIBERDADE','SETUP DA LIBERDADE'],risk:[],sys:'Sistema B (T.F acima de H1)',desc:'Ideal para grandes tendências.',tf:'Mensal, Semanal ou Diário',ent:'Comprar quando o StochRSI está sobrevendido, em ativos grandes.'},
{n:'ZIG ZAG',eb:'Zig Zag (Bollinger)',tag:'Lateralização',keys:['ZIG ZAG','ZIGZAG'],risk:[],sys:'Sistema A (T.F até H1) ou B (acima de H1)',desc:'Usar apenas em lateralização.',ent:'Short na banda superior, long na inferior.',stop:'Topo ou fundo local anterior.'},
{n:'TORRES GÊMEAS',eb:'Torres Gêmeas',tag:'Cripto',keys:['TORRES GEMEAS','TORRES'],risk:[],sys:'Sistema B (T.F semanal ou mensal)',desc:'Cripto. Pavio longo com grande rejeição.',tf:'Semanal ou Mensal',rule:'Alavancagem máx. 8x. Margem máx. 10% da banca.',maxLev:8,maxMargin:10}];
const infoFor=setup=>{const n=nz(setup);return n?INFO.slice().sort((a,b)=>Math.max(...b.keys.map(k=>k.length))-Math.max(...a.keys.map(k=>k.length))).find(x=>x.keys.some(k=>n===nz(k)||n.startsWith(nz(k)+' '))):null};
function riskTxt(s){const ns=s.risk||[];if(!ns.length)return 'Sem limite próprio: vale o do '+(s.sys||'sistema')+'.';
 return ns.map(nm=>{const x=specs.find(y=>y.n===nm);if(!x)return '';const t=x.lo===x.hi?pc(x.lo)+'% ('+usd(bank*x.lo/100)+')':'até H1 '+pc(x.lo)+'% ('+usd(bank*x.lo/100)+') | acima de H1 '+pc(x.hi)+'% ('+usd(bank*x.hi/100)+')';return (ns.length>1?nm+': ':'')+t}).join('<br>')}
function specInfo(){if(!spInfo.dataset.ok){spInfo.dataset.ok='1';const row=(k,v)=>v?`<dt>${k}</dt><dd>${esc(v)}</dd>`:'';
 spInfo.innerHTML=`<details class="sd" open><summary>As 4 EMAs<small>base de todos os setups</small><span class="tg">Base</span></summary><div class="bd"><dl>${EMAS4.map(e=>`<dt>${e[0]}</dt><dd>${esc(e[1])}</dd>`).join('')}</dl><p style="margin-top:10px">Tendência de alta: EMA 7 e 30 acima da EMA 100, que está acima da EMA 197. Invertido: tendência de baixa. Médias cruzadas: não opere.</p></div></details>`
 +INFO.map((x,i)=>`<details class="sd"><summary>${esc(x.n)}<small>${esc(x.eb)}</small><span class="tg">${esc(x.tag)}</span></summary><div class="bd">${esc(x.desc)}<dl>${row('Time frame',x.tf)}${row('Entrada',x.ent)}${row('Stop',x.stop)}${row('Alvo',x.alvo)}${row('Confluências',x.conf)}${row('Regras extras',x.rule)}<dt>Risco máximo</dt><dd class="rk" id="rk${i}"></dd></dl></div></details>`).join('')
 +`<details class="sd"><summary>Regras gerais<small>valem para todos os setups</small><span class="tg">Geral</span></summary><div class="bd"><ul><li>LSR: proibido shortar com LSR abaixo de 1.</li><li>Linhas de tendência: usar a partir do T.F de 4h, traçando só por pavios ou só por fechamentos, nunca misturando.</li><li>Análise do macro para o micro: comece sempre pelos time frames maiores.</li><li>Se hesitar em entrar, não entre.</li><li>SCALP e VIP não têm setup descrito no ebook.</li></ul></div></details>`}
 INFO.forEach((x,i)=>{const e=document.getElementById('rk'+i);if(e)e.innerHTML=riskTxt(x)})}
function specRender(){spBank.textContent=usd(bank);spBody.innerHTML=specs.map((x,i)=>`<tr><td><b>${esc(x.n)}</b></td><td><input inputmode="decimal" value="${pc(x.lo)}" onchange="specSet(${i},'lo',this.value)" aria-label="${esc(x.n)} até H1"> %<small>${usd(bank*x.lo/100)}</small></td><td><input inputmode="decimal" value="${pc(x.hi)}" onchange="specSet(${i},'hi',this.value)" aria-label="${esc(x.n)} acima de H1"> %<small>${usd(bank*x.hi/100)}</small></td><td style="white-space:normal;color:var(--ink2);font-size:12.5px">${esc(x.r)}</td></tr>`).join('');specInfo()}
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const esc=x=>String(x||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sg=n=>(n>0?'+':n<0?'-':'')+usd(Math.abs(n));
const dOf=t=>t.ds||t.de,sysOf=t=>LOWTF.includes(t.tf)?'A':'B';
const dfmt=x=>x?x.slice(8,10)+'/'+x.slice(5,7):'';
function normT(r,i){if(!r||typeof r!=='object')return null;const g=(a,b)=>r[a]!==undefined?r[a]:r[b],n=x=>{const v=typeof x==='number'?x:num(x);return isFinite(v)?v:0};
 const t={id:r.id||Date.now()+i,setup:String(g('setup','system')||'').toUpperCase(),tf:String(g('tf','time_frame')||'M15').toUpperCase(),type:String(r.type||'LONG').toUpperCase()==='SHORT'?'SHORT':'LONG',sym:String(g('sym','symbol')||'').toUpperCase(),entry:n(g('entry','entry_price')),exit:n(g('exit','exit_price')),stop:n(r.stop),alvo:n(r.alvo),notional:n(r.notional),lev:n(g('lev','leverage'))||10,fees:n(r.fees),de:String(g('de','entry_date')||'').slice(0,10),ds:String(g('ds','exit_date')||'').slice(0,10),he:String(g('he','entry_time')||''),hs:String(g('hs','exit_time')||''),rel:String(r.rel||r.relato||''),mkt:String(r.mkt||'').toUpperCase()==='SPOT'?'SPOT':'FUTUROS',corr:String(r.corr||''),cart:String(r.cart||'').toUpperCase()==='BRL'?'BRL':'USD'};
 const lg=a=>Array.isArray(a)?a.map(x=>({p:n(x&&x.p),n:n(x&&x.n)})).filter(x=>x.p>0):[];
 t.ent=lg(r.ent).filter(x=>x.n>0);t.exs=lg(r.exs);
 if(t.ent.length){const S=legStats(t.ent,t.exs,t.type);t.entry=S.avg;t.notional=S.N;t.exit=(!S.open&&S.cN>0)?S.avgExit:0}else{t.ent=[];t.exs=[]}
 if(t.mkt==='SPOT')t.lev=1;
 if(t.ds&&t.ds<t.de){const sw=t.ds.slice(0,5)+t.ds.slice(8,10)+'-'+t.ds.slice(5,7);if(/^\d{4}-\d\d-\d\d$/.test(sw)&&sw>=t.de)t.ds=sw}
 return t.sym&&t.entry>0&&t.notional>0&&/^\d{4}-\d\d-\d\d$/.test(t.de)?t:null}
function loadT(){try{const r=localStorage.getItem(TK);if(r){trades=JSON.parse(r).map(normT).filter(Boolean);saveTr()}}catch(e){}}
function saveTr(){try{localStorage.setItem(TK,JSON.stringify(trades))}catch(e){}}
const riskOf=t=>t.stop>0&&t.entry>0?t.notional*Math.abs(t.entry-t.stop)/t.entry:0;
function updPrev(){if(tCart==='BRL'){rmax.style.display='none';pcalc.innerHTML='';prev.className='prev';prev.textContent='Carteira BRL (ações): valores em R$, fora dos limites de risco da carteira USD.';return}rmaxUpd();pcalcUpd();const LG=legsForm(),S0=legStats(LG.E,LG.X,tType),t={setup:fSetup.value,type:tType,tf:fTf.value,entry:S0.avg,exit:(!S0.open&&S0.cN>0)?S0.avgExit:0,notional:S0.N,fees:num(fFees.value)||0,stop:num(fStop.value)||0,ent:LG.E,exs:LG.X},al=num(fAlvo.value)||0,lev=mkt==='SPOT'?1:(num(fLev.value)||10);
 if(!(t.entry>0&&t.notional>0)){prev.textContent='';prev.className='prev';return}
 const k=sysOf(t),c=calc(t),r=riskOf(t),SP=specFor(t.setup,t.tf),mx=bank*SP.pct/100;let h=`Margem ${usd(t.notional/lev)}. Sistema ${k}.`,w=false;
 if(LG.E.length>1)h+=` Preço médio de entrada ${fp(c.avg)}.`;
 if(!c.open)h+=` Resultado ${sg(c.net)} (${f(c.g*100)}%).`;
 else if(c.part)h+=` Realizado até agora ${sg(c.net)} (${f(c.g*100)}% sobre ${usd(c.cN)} fechados). Restam ${usd(c.rem)} abertos.`;
 if(LG.X.reduce((a,x)=>a+x.n,0)>c.N+0.005){h+=' As saídas somam mais que a posição.';w=true}
 if(r){h+=` Risco ${usd(r)}`+(bank>0?` (${f(r/bank*100)}% da banca)`:'')+'.';if(bank>0){if(r>mx){h+=` Acima do risco máximo ${SP.label} (${usd(mx)}).`;w=true}else h+=' Dentro do limite.'}if(al>0){const pay=Math.abs(al-t.entry)/Math.abs(t.entry-t.stop);h+=` Payoff planejado ${f(pay)}x`+(pay<1.5?' (abaixo de 1,5x).':'.');if(pay<1.5)w=true}}
 const nf=infoFor(t.setup);
 if(nf&&nf.maxLev&&lev>nf.maxLev){h+=` Alavancagem acima do máximo do setup (${nf.maxLev}x).`;w=true}
 if(nf&&nf.maxMargin&&bank>0&&t.notional/lev>bank*nf.maxMargin/100){h+=` Margem acima do máximo do setup (${nf.maxMargin}% da banca = ${usd(bank*nf.maxMargin/100)}).`;w=true}
 prev.textContent=h;prev.className='prev'+(w?' w':'')}
function legStats(E,X,type){const N=E.reduce((a,e)=>a+e.n,0),q=E.reduce((a,e)=>a+e.n/e.p,0),avg=E.length===1?E[0].p:(q>0?N/q:0);let rem=N,real=0,cN=0,sp=0;
 X.forEach(x=>{if(rem<=0.005)return;const n=x.n>0?Math.min(x.n,rem):rem;real+=n*(type==='SHORT'?avg-x.p:x.p-avg)/avg;rem-=n;cN+=n;sp+=n*x.p});
 return{N,avg,rem:Math.max(rem,0),real,cN,avgExit:cN>0?sp/cN:0,open:rem>0.005||!X.length}}
function legsOf(t){return{E:(t.ent&&t.ent.length)?t.ent:[{p:t.entry,n:t.notional}],X:(t.exs&&t.exs.length)?t.exs:(t.exit>0?[{p:t.exit,n:0}]:[])}}
function calc(t){const L=legsOf(t),S=legStats(L.E,L.X,t.type),g=S.cN>0&&S.avg>0?S.real/S.cN:0;return{open:S.open,g,profit:S.real,net:S.real-(t.fees||0),rem:S.rem,N:S.N,avg:S.avg,cN:S.cN,avgExit:S.avgExit,part:S.open&&S.cN>0}}
const fp=n=>n>=100?String(+n.toFixed(2)):String(+n.toFixed(5));
let mkt='FUTUROS',brokers=[{n:'Bitget',c:'#2dd4bf'},{n:'Base',c:'#3b82f6'},{n:'Phantom',c:'#a855f7'},{n:'Íon Itaú',c:'#f97316'}];
(function(){try{const o=JSON.parse(localStorage.getItem('gr_brokers')||'null');if(Array.isArray(o)&&o.length)brokers=o.filter(x=>x&&x.n)}catch(e){}})();
const corOf=n=>brokers.find(b=>b.n===n);
function saveBr(){try{localStorage.setItem('gr_brokers',JSON.stringify(brokers))}catch(e){}}
function hexA(h,a){const v=parseInt(String(h).slice(1),16);return 'rgba('+((v>>16)&255)+','+((v>>8)&255)+','+(v&255)+','+a+')'}
function fillCor(){const cur=fCor.value;fCor.innerHTML='<option value="">(sem corretora)</option>'+brokers.map(b=>`<option>${esc(b.n)}</option>`).join('');fCor.value=cur}
function brRender(){brList.innerHTML=brokers.map((b,i)=>`<div class="lg2"><input type="color" value="${esc(b.c)}" onchange="brSet(${i},'c',this.value)" aria-label="Cor de ${esc(b.n)}"><input type="text" value="${esc(b.n)}" onchange="brSet(${i},'n',this.value)" aria-label="Nome da corretora"><button type="button" aria-label="Remover corretora" onclick="brDel(${i})">×</button></div>`).join('')}
function brSet(i,k,v){if(k==='n'){v=String(v).trim();if(!v||brokers.some((b,j)=>j!==i&&b.n===v)){brRender();return}trades.forEach(t=>{if(t.corr===brokers[i].n)t.corr=v});saveTr()}brokers[i][k]=v;saveBr();fillCor();brRender();render()}
function brAdd(){const cs=['#facc15','#ef4444','#10b981','#ec4899','#06b6d4','#84cc16'];brokers.push({n:'Nova corretora '+(brokers.length+1),c:cs[brokers.length%cs.length]});saveBr();fillCor();brRender()}
function brDel(i){ask('Remover a corretora '+brokers[i].n+'? Os trades já cadastrados mantêm o nome, mas perdem a cor.').then(ok=>{if(ok){brokers.splice(i,1);saveBr();fillCor();brRender();render()}})}
function mpick(m){if(tCart==='BRL')m='SPOT';mkt=m;mF.classList.toggle('on',m==='FUTUROS');mS.classList.toggle('on',m==='SPOT');fLev.disabled=m==='SPOT';tS.disabled=m==='SPOT';if(m==='SPOT'){fLev.value='1';if(tType==='SHORT')tpick('LONG')}else if(fLev.value==='1')fLev.value='10';updPrev()}
function addLeg(k,p,n){const d=document.createElement('div');d.className='lg';d.innerHTML=`<input class="lp" inputmode="decimal" placeholder="Preço" value="${p||''}"><input class="ln" inputmode="decimal" placeholder="${k==='e'?'Notional US$':'Notional (vazio = resto)'}" value="${n||''}"><button type="button" aria-label="Remover" onclick="this.parentNode.remove();updPrev()">×</button>`;(k==='e'?eMore:xMore).appendChild(d)}
function legsForm(){const E=[{p:num(fEnt.value),n:num(fNot.value),r:[fEnt.value,fNot.value]}],X=[{p:num(fExit.value),n:num(fExitN.value)||0,r:[fExit.value,fExitN.value]}];
 eMore.querySelectorAll('.lg').forEach(r=>E.push({p:num(r.children[0].value),n:num(r.children[1].value),r:[r.children[0].value,r.children[1].value]}));
 xMore.querySelectorAll('.lg').forEach(r=>X.push({p:num(r.children[0].value),n:num(r.children[1].value)||0,r:[r.children[0].value,r.children[1].value]}));
 const badE=E.some(e=>(e.r[0].trim()||e.r[1].trim())&&!(e.p>0&&e.n>0)),badX=X.some(x=>(x.r[0].trim()||x.r[1].trim())&&!(x.p>0));
 return{E:E.filter(e=>e.p>0&&e.n>0).map(e=>({p:e.p,n:e.n})),X:X.filter(x=>x.p>0).map(x=>({p:x.p,n:x.n})),badE,badX}}
function tradeLoss(k){const now=new Date(),w=new Date(now);w.setHours(0,0,0,0);w.setDate(w.getDate()-((w.getDay()+6)%7));const ws=ymd(w),m=ymd(now).slice(0,7);
 return trades.filter(isU).reduce((s,t)=>{const c=calc(t);if(c.open||c.net>=0||sysOf(t)!==k||!t.ds)return s;return (k==='A'?t.ds>=ws:t.ds.startsWith(m))?s-c.net:s},0)}
const perStart=k=>{const n=new Date();n.setHours(0,0,0,0);if(k==='A')n.setDate(n.getDate()-((n.getDay()+6)%7));else n.setDate(1);return n.getTime()};
const sum=k=>st[k].filter(e=>e.t>=perStart(k)).reduce((s,e)=>s+e.v,0)+tradeLoss(k);
const lim=k=>bank*CFG[k].limit/100;
const pct=k=>lim(k)>0?sum(k)/lim(k)*100:0;
function stateOf(k){const p=pct(k);return p>=100?['Teto atingido','bad']:p>=75?['Perto do teto','warn']:p>=50?['Atenção','ok']:['Liberado','ok']}
function card(k){
  const c=CFG[k],s=sum(k),L=lim(k),p=Math.min(pct(k),100),oR=openRisk(k),rest=Math.max(L-s-oR,0),R=75,C=2*Math.PI*R;
  const [lbl,lv]=stateOf(k);
  const col=lv==='bad'?'var(--bad)':lv==='warn'?'var(--warn)':'';
  const sub=bank<=0?'Informe o capital da banca':rest>0?'Ainda cabem '+usd(rest)+' de perda'+(oR>0?' ('+usd(oR)+' comprometidos em trades abertos)':''):'Não abra novas operações';
  return `<div class="top"><h2>${c.name}</h2><span class="tag">Teto por ${c.per}</span></div>
  <div class="ring"><svg viewBox="0 0 176 176"><circle class="t" cx="88" cy="88" r="${R}"/><circle class="p" cx="88" cy="88" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-p/100)}" ${col?`style="stroke:${col}"`:''}/></svg>
  <div class="mid"><b>${usd(s)}</b><span>de ${usd(L)}</span></div></div>
  <div class="state" ${col?`style="color:${col}"`:''}>${lbl}</div>
  <div class="sub">${sub}</div>
  <div class="facts"><div class="fact"><small>Perda na banca</small><strong>${f(bank>0?s/bank*100:0)}% de ${c.limit}%</strong></div><div class="fact"><small>Risco por trade</small><strong>${usd(bank*c.min/100)} a ${usd(bank*c.max/100)}</strong></div></div>
  <button class="ghost" onclick="reset('${k}')">${c.reset}</button>`;
}
function renderRisk(){
  cA.innerHTML=card('A');cB.innerHTML=card('B');
  const lA=bank>0&&sum('A')>=lim('A'),lB=bank>0&&sum('B')>=lim('B');
  cA.className='card sys'+(lA?' lock':'');cB.className='card sys b'+(lB?' lock':'');document.body.classList.toggle('locked',lA||lB);
  rA.innerHTML=`Teto de <b>${pc(CFG.A.limit)}%</b> da banca (${usd(lim('A'))}) por semana. Risco por trade de <b>0,5% a 2%</b> (${usd(bank*.005)} a ${usd(bank*.02)}). Zera sozinho toda segunda-feira. Só perdas contam; ganhos não devolvem espaço.`;
  rB.innerHTML=`Teto de <b>${pc(CFG.B.limit)}%</b> da banca (${usd(lim('B'))}) por mês. Risco por trade de <b>1,5% a 3%</b> (${usd(bank*.015)} a ${usd(bank*.03)}). Zera sozinho todo dia 1º. Só perdas contam; ganhos não devolvem espaço.`;
  const a=stateOf('A')[1],b=stateOf('B')[1],ta=bank>0&&sum('A')>=lim('A'),tb=bank>0&&sum('B')>=lim('B');
  let m,l='ok';
  if(bank<=0){m='Informe o capital da banca para calcular os tetos.';l='warn'}
  else if(ta&&tb){m='Os dois sistemas estão travados. Pare e revise a estratégia.';l='bad'}
  else if(ta){m='Sistema A travado nesta semana. Não abra trades de curto prazo (M15/H1).';l='bad'}
  else if(tb){m='Sistema B travado neste mês. Não abra trades de longo prazo.';l='bad'}
  else if(a==='warn'||b==='warn'){m='Atenção: '+(a==='warn'&&b==='warn'?'os dois sistemas estão':a==='warn'?'o Sistema A está':'o Sistema B está')+' perto do teto.';l='warn'}
  else m='Os dois sistemas estão liberados para novas entradas.';
  const dl=num(pr.l);if(pr.d===ymd(new Date())&&dl>0&&dayLoss()>=dl){m='Perda máxima do dia atingida ('+usd(dayLoss())+' de '+usd(dl)+'). Pare de operar hoje.';l='bad'}banner.className='banner '+(l==='ok'?'':l);bmsg.textContent=m+extraTxt();
  const all=[...st.A.map(e=>({...e,k:'A'})),...st.B.map(e=>({...e,k:'B'}))].sort((x,y)=>y.t-x.t);
  list.innerHTML=all.length?all.map(e=>`<div class="row"><span class="d" style="background:var(--${e.k==='A'?'a':'b'})"></span><div class="n">${CFG[e.k].name}<small>${new Date(e.t).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}, ${f(bank>0?e.v/bank*100:0)}% da banca</small></div><b>-${usd(e.v)}</b><button title="Remover" aria-label="Remover registro" onclick="del('${e.k}',${e.t})">×</button></div>`).join(''):'<div class="empty">Nenhuma perda avulsa. As perdas dos trades fechados entram sozinhas, pela aba Trades.</div>';
}
function fillChips(){chipbox.innerHTML=[.5,1,1.5,2,3].map(p=>`<button onclick="chip(${p})">${usd(bank*p/100)} <small style="opacity:.6">${pc(p)}%</small></button>`).join('')}
function pick(k){cur=k;document.querySelectorAll('.seg button').forEach(b=>b.classList.toggle('on',b.dataset.s===k));go.className='go'+(k==='B'?' b':'');hintUpd()}
function hintUpd(){const v=num(inp.value),c=CFG[cur];
 if(isNaN(v)||v<=0||bank<=0){hint.textContent='';return}
 const over=v>bank*c.max/100;
 hint.style.color=over?'var(--warn)':'var(--ink3)';
 hint.textContent=`${f(v/bank*100)}% da banca`+(over?`. Acima do risco máximo por trade do ${c.name} (${usd(bank*c.max/100)}).`:'.')}
function chip(p){inp.value=pc(+(bank*p/100).toFixed(2));hintUpd();inp.focus()}
function add(){const v=num(inp.value);
 if(bank<=0){hint.style.color='var(--warn)';hint.textContent='Informe o capital da banca primeiro.';bankInp.focus();return}
 if(isNaN(v)||v<=0){hint.style.color='var(--warn)';hint.textContent='Digite uma perda em dólares maior que zero, por exemplo 12,50.';inp.focus();return}
 st[cur].push({v,t:Date.now()});save();inp.value='';hint.textContent='';render()}
function del(k,t){st[k]=st[k].filter(e=>e.t!==t);save();render()}
function ask(txt){return new Promise(res=>{mTxt.textContent=txt;modal.style.display='grid';const done=v=>{modal.style.display='none';mYes.onclick=mNo.onclick=null;res(v)};mYes.onclick=()=>done(true);mNo.onclick=()=>done(false)})}
function reset(k){ask(`Apagar todas as perdas avulsas do ${CFG[k].name}? (O teto já ignora sozinho as de períodos anteriores.) Perdas de trades não são apagadas: elas entram pela data de saída.`).then(ok=>{if(ok){st[k]=[];save();render()}})}
bankInp.addEventListener('input',()=>{const v=num(bankInp.value);bank=isNaN(v)||v<0?0:v;save();fillChips();render();hintUpd()});
inp.addEventListener('input',hintUpd);inp.addEventListener('keydown',e=>{if(e.key==='Enter')add()});
today.textContent=new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
function tab(x){if(gateApply()==='P')x='P';vRisco.style.display=x==='R'?'':'none';vTrades.style.display=x==='T'?'grid':'none';vCart.style.display=x==='C'?'grid':'none';vProto.style.display=x==='P'?'grid':'none';vSpec.style.display=x==='S'?'grid':'none';tabS.classList.toggle('on',x==='S');tabR.classList.toggle('on',x==='R');tabT.classList.toggle('on',x==='T');tabC.classList.toggle('on',x==='C');tabP.classList.toggle('on',x==='P');try{localStorage.setItem('gr_tab',x)}catch(e){}if(x==='T')renderTrades();if(x==='C')renderCart();if(x==='P')renderProto();if(x==='S')specRender()}
function tpick(x){tType=x;tL.classList.toggle('on',x==='LONG');tS.classList.toggle('on',x==='SHORT');updPrev()}
function initF(){fTf.innerHTML=TFS.map(x=>`<option>${x}</option>`).join('');dlS.innerHTML=SETUPS.map(x=>`<option value="${x}">`).join('');month=ymd(new Date()).slice(0,7);clearF()}
function clearF(){editId=null;['fSetup','fSym','fNot','fEnt','fExit','fExitN','fStop','fAlvo','fFees','fDs','fHe','fHs','fRel'].forEach(i=>window[i].value='');eMore.innerHTML='';xMore.innerHTML='';fCor.value='';mpick('FUTUROS');fLev.value='10';cpick(tView);fTf.value='M15';fDe.value=ymd(new Date());tpick('LONG');tmsg.textContent='';fTitle.textContent='Novo trade';tSave.textContent='Salvar trade';tCancel.style.display='none';updPrev()}
function commitT(){const LG=legsForm(),S=legStats(LG.E,LG.X,tType);
 const t={id:editId||Date.now(),setup:fSetup.value.trim().toUpperCase(),tf:fTf.value,type:tType,mkt,corr:fCor.value,sym:fSym.value.trim().toUpperCase(),entry:S.avg,exit:(!S.open&&S.cN>0)?S.avgExit:0,stop:num(fStop.value)||0,alvo:num(fAlvo.value)||0,notional:S.N,lev:mkt==='SPOT'?1:(num(fLev.value)||10),fees:num(fFees.value)||0,de:fDe.value,ds:fDs.value,he:fHe.value,hs:fHs.value,rel:fRel.value.trim(),cart:tCart,ent:LG.E,exs:LG.X};
 if(LG.badE){tmsg.textContent='Cada entrada precisa de preço e notional.';return}
 if(LG.badX){tmsg.textContent='Cada saída precisa de preço.';return}
 if(!t.sym||!LG.E.length||!t.de){tmsg.textContent='Preencha ativo, ao menos uma entrada (preço e notional) e a data de entrada.';return}
 if(LG.X.reduce((x,y)=>x+y.n,0)>S.N+0.005){tmsg.textContent='As saídas somam mais que a posição.';return}
 if(!S.open&&!t.ds)t.ds=ymd(new Date());
 trades=editId?trades.map(x=>x.id===editId?t:x):[...trades,t];saveTr();month=dOf(t).slice(0,7);tView=t.cart;vSync();clearF();render()}
function editT(id){const t=trades.find(x=>x.id===id);if(!t)return;editId=id;tView=t.cart||'USD';vSync();cpick(tView);const L=legsOf(t);
 fSetup.value=t.setup;fTf.value=t.tf;fCor.value=t.corr||'';mpick(t.mkt==='SPOT'?'SPOT':'FUTUROS');tpick(t.type);fSym.value=t.sym;
 eMore.innerHTML='';xMore.innerHTML='';fEnt.value=pc(L.E[0].p);fNot.value=pc(L.E[0].n);L.E.slice(1).forEach(e=>addLeg('e',pc(e.p),pc(e.n)));
 fExit.value=L.X[0]?pc(L.X[0].p):'';fExitN.value=L.X[0]&&L.X[0].n>0?pc(L.X[0].n):'';L.X.slice(1).forEach(x=>addLeg('x',pc(x.p),x.n>0?pc(x.n):''));
 fStop.value=t.stop?pc(t.stop):'';fAlvo.value=t.alvo?pc(t.alvo):'';if(t.mkt!=='SPOT')fLev.value=pc(t.lev);fFees.value=t.fees?pc(t.fees):'';fDe.value=t.de;fDs.value=t.ds||'';fHe.value=t.he||'';fHs.value=t.hs||'';fRel.value=t.rel||'';
 updPrev();fTitle.textContent='Editar trade';tSave.textContent='Salvar alterações';tCancel.style.display='';tmsg.textContent='';window.scrollTo({top:0,behavior:'smooth'})}
function delT(id){ask('Excluir este trade?').then(ok=>{if(ok){trades=trades.filter(x=>x.id!==id);saveTr();if(editId===id)clearF();render()}})}
function renderTrades(){fltFill();
 const ms=[...new Set([...trades.filter(t=>(t.cart||'USD')===tView).map(t=>dOf(t).slice(0,7)),...trades.filter(t=>(t.cart||'USD')===tView&&calc(t).open).flatMap(t=>{const a=[];for(let m=t.de.slice(0,7),g=0;m<=ymd(new Date()).slice(0,7)&&g<120;m=nextM(m),g++)a.push(m);return a}),ymd(new Date()).slice(0,7),month])].sort().reverse();
 tMonth.innerHTML=ms.map(m=>`<option value="${m}"${m===month?' selected':''}>${new Date(+m.slice(0,4),+m.slice(5,7)-1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</option>`).join('');
 const cm_=ymd(new Date()).slice(0,7),L=trades.filter(t=>(t.cart||'USD')===tView&&(dOf(t).slice(0,7)===month||(calc(t).open&&t.de.slice(0,7)<month&&month<=cm_))).sort((a,b)=>(calc(b).open-calc(a).open)||(dOf(b)+(b.hs||'')).localeCompare(dOf(a)+(a.hs||'')));
 let pnl=0,g=0,l=0;const W=[],Ls=[];
 L.forEach(t=>{const c=calc(t);if(c.open)return;pnl+=c.net;if(c.net>0){g++;W.push(c.net)}else if(c.net<0){l++;Ls.push(-c.net)}});
 const cRow=cartData().rows.find(r=>r.m===month),banca=cRow?cRow.end:base+pnl,n=g+l,sm=a=>a.reduce((x,y)=>x+y,0),av=a=>a.length?sm(a)/a.length:0,aw=av(W),al=av(Ls);
 const cd=(k,v,sub,tn)=>`<div><small>${k}</small><b${tn?` class="${tn}"`:/^[+-]/.test(v)?` class="${v[0]==='+'?'pos':'neg'}"`:''}>${v}</b>${sub?`<small>${sub}</small>`:''}</div>`;
 sumBox.innerHTML=cd('PNL do mês',sgm(tView,pnl))+(tView==='USD'?cd('Banca atualizada',usd(banca))+cd('Limite de perda ('+pc(DLIM)+'%)',usd(banca*DLIM/100)):cd('Acumulado em ações',sgm('BRL',accB())))+cd('Taxa de acerto',n?f(g/n*100)+'%':'-',n?g+' ganhos e '+l+' perdas':'',n?(g/n>=.5?'cy':'neg'):'')+cd('Ganho médio',mny(tView,aw))+cd('Perda média',mny(tView,al))+cd('Payoff',al?f(aw/al)+'x':W.length?'∞':'-','',al?(aw/al>=1.5?'cy':'neg'):W.length?'cy':'')+cd('Profit factor',Ls.length?f(sm(W)/sm(Ls)):W.length?'∞':'-','',Ls.length?(sm(W)/sm(Ls)>=1?'cy':'neg'):W.length?'cy':'');
 const cl=L.filter(t=>!calc(t).open).sort((x,y)=>(dOf(x)+(x.hs||'')).localeCompare(dOf(y)+(y.hs||'')));let ac=0;const pts=[0,...cl.map(t=>ac+=calc(t).net)];
 const mn=Math.min(...pts),mxp=Math.max(...pts),sp=(mxp-mn)||1,X=i=>i/(pts.length-1)*600,Y=v=>64-(v-mn)/sp*58;
 eq.innerHTML=cl.length>1?`<svg viewBox="0 0 600 70" preserveAspectRatio="none" style="width:100%;height:70px;display:block" aria-label="Curva de resultado do mês"><line x1="0" x2="600" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--line)" stroke-dasharray="4 4"/><polyline fill="none" stroke-width="2" vector-effect="non-scaling-stroke" style="stroke:${ac>=0?'#22e5ff':'var(--bad)'}" points="${pts.map((v,i)=>X(i)+','+Y(v)).join(' ')}"/></svg>`:'';
 tBody.innerHTML=fltL(L).map(t=>{const c=calc(t),bc=c.open?corOf(t.corr):null,nE=(t.ent||[]).length,nX=(t.exs||[]).length;return `<tr class="${c.open?'open':''}${bc?' bc':''}"${bc?` style="background:${hexA(bc.c,.15)};box-shadow:inset 3px 0 0 ${bc.c}"`:''} onclick="editT(${t.id})" title="${esc(t.rel)}"><td>${dfmt(dOf(t))}${c.open?'<small>'+(t.de.slice(0,7)<month?'aberto desde '+dfmt(t.de):'aberto')+'</small>':''}</td><td>${esc(t.setup)||'-'}<small>${t.tf}</small></td><td><span class="ty ${t.type}">${t.type}</span>${t.mkt==='SPOT'?'<small>spot</small>':''}</td><td>${esc(t.sym)}${t.corr?`<small><i class="dt" style="background:${corOf(t.corr)?corOf(t.corr).c:'#777'}"></i>${esc(t.corr)}</small>`:''}${t.rel?'<small>com relato</small>':''}</td><td>${fp(c.avg)}${nE>1?`<small>${nE} entradas</small>`:''}<small>${c.open?(c.part?'saída parcial '+fp(c.avgExit):'-'):fp(c.avgExit)+(nX>1?' ('+nX+' saídas)':'')}</small></td><td>${mny(tView,t.notional)}<small>${t.mkt==='SPOT'?'spot':pc(t.lev)+'x'}${c.part?', restam '+mny(tView,c.rem):''}</small></td><td>${c.open&&!c.part?'-':f(c.g*100)+'%'}</td><td class="${c.open&&!c.part?'':c.net>0?'pos':c.net<0?'neg':''}">${c.open&&!c.part?'-':sgm(tView,c.net)}${c.part?'<small>realizado</small>':''}${!c.open&&riskOf(t)?`<small>${f(c.net/riskOf(t))}R</small>`:''}</td><td><span class="sy">${sysOf(t)}</span></td><td>${c.open?`<button class="fx" aria-label="Fechar trade" onclick="event.stopPropagation();closeT(${t.id})">Fechar</button>`:''}<button aria-label="Excluir trade" onclick="event.stopPropagation();delT(${t.id})">×</button></td></tr>`}).join('');
 tEmpty.style.display=L.length?'none':'block'}
const MES=['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
const xd=x=>x?Date.UTC(+x.slice(0,4),+x.slice(5,7)-1,+x.slice(8,10))/864e5+25569:null;
const xt=x=>{if(!x)return null;const p=x.split(':');return(+p[0]*3600+(+p[1]||0)*60+(+p[2]||0))/86400};
function monthSheet(L,cap){
 const ws={},n=Math.max(L.length+1,102),C='ABCDEFGHIJKLMNOPQR';
 const put=(a,v,z,f)=>{if(v===null||v===undefined||v==='')return;ws[a]={t:typeof v==='string'?'s':'n',v};if(z)ws[a].z=z;if(f)ws[a].f=f};
 const H=['SYSTEM','TIME FRAME ','ENTRY DATE ','EXIT DATE','TYPE','SYMBOL','ENTRY PRICE','EXIT PRICE','NOTIONAL',10,'MARGIN','Gain %',' RELATO','FEES','ENTRY TIME','EXIT TIME','CONTROLE DE RISCO ','PROFIT'];
 H.forEach((h,i)=>put(C[i]+'1',h));
 const D='$#,##0.00',DT='d-mmm',TM='h:mm:ss';let pnl=0,g=0,l=0;
 L.forEach((t,i)=>{const r=i+2,c=calc(t);if(!c.open){pnl+=c.net;if(c.net>0)g++;else if(c.net<0)l++}
  put('A'+r,t.setup);put('B'+r,t.tf);put('C'+r,xd(t.de),DT);put('D'+r,xd(t.ds),DT);put('E'+r,t.type);put('F'+r,t.sym);
  put('G'+r,t.entry,D);put('H'+r,t.exit>0?t.exit:null,D);put('I'+r,t.notional,D);put('J'+r,t.lev);
  put('K'+r,t.notional/t.lev,D,`I${r}/J${r}`);
  put('L'+r,c.g,'0.00%',`IF(AND(ISNUMBER(G${r}), ISNUMBER(H${r}), G${r}<>0), IF(E${r}="SHORT", (G${r}-H${r})/G${r}, (H${r}-G${r})/G${r}), 0)`);
  put('M'+r,t.rel);put('N'+r,t.fees||0,D);put('O'+r,xt(t.he),TM);put('P'+r,xt(t.hs),TM);
  put('R'+r,c.profit,D,`PRODUCT(J${r},K${r},L${r})`)});
 put('T1','PNL MENSAL ');put('U3',pnl,D,`SUM(R2:R${n})-SUM(N2:N${n})`);
 put('T5','TIPO');put('U5','QUANTIDADE');put('T6','GAIN');put('U6',g,null,'COUNTIF(R:R,">0")');put('T7','LOSS');put('U7',l,null,'COUNTIF(R:R,"<0")');
 put('V1','CAPITAL INICIAL ');put('V2',cap.v,D,cap.f);put('W1','PREJUIZO MAX t.f. < H4');put('W2',(cap.v+pnl)*-DLIM/100,'0.00','X2 * -'+(DLIM/100));
 put('X1','BANCA ATUALIZADA ');put('X2',cap.v+pnl,D,'SUM(U3) + SUM(V2)');
 ws['!ref']='A1:X'+n;ws['!cols']=[12,11,11,11,8,9,13,13,12,6,11,9,40,8,11,11,18,12,3,3,12,16,16,18].map(w=>({wch:w}));
 return{ws,banca:cap.v+pnl}}
function buildWB(){
 const by={};trades.filter(isU).forEach(t=>{const m=dOf(t).slice(0,7);(by[m]=by[m]||[]).push(t)});
 const ms=Object.keys(by).sort(),wb={SheetNames:[],Sheets:{}},made=[];let prev=null;
 ms.forEach((m,i)=>{const L=by[m].slice().sort((a,b)=>(a.de+(a.he||'')).localeCompare(b.de+(b.he||'')));
  const nm=MES[+m.slice(5,7)-1]+m.slice(0,4);
  const r=monthSheet(L,i===0?{v:base}:{v:prev.banca,f:`'${prev.nm}'!X2`});prev={nm,banca:r.banca};made.push([nm,r.ws])});
 made.reverse().forEach(a=>{wb.SheetNames.push(a[0]);wb.Sheets[a[0]]=a[1]});
 const rows=[['MES','SISTEMA_APP','SETUP','TIME_FRAME','TIPO','ATIVO','DATA_ENTRADA','DATA_SAIDA','HORA_ENTRADA','HORA_SAIDA','PRECO_ENTRADA','PRECO_SAIDA','NOTIONAL','ALAVANCAGEM','MARGEM','FEES','GAIN_PCT','PROFIT_BRUTO','PROFIT_LIQUIDO','RESULTADO','RELATO','STOP','ALVO','RISCO_USD','R_MULTIPLO','CORRETORA','MERCADO','ENTRADAS','SAIDAS']];
 trades.filter(isU).slice().sort((a,b)=>(a.de+(a.he||'')).localeCompare(b.de+(b.he||''))).forEach(t=>{const c=calc(t);
  rows.push([dOf(t).slice(0,7),sysOf(t),t.setup,t.tf,t.type,t.sym,t.de,t.ds||'',t.he||'',t.hs||'',t.entry,t.exit>0?t.exit:'',t.notional,t.lev,t.notional/t.lev,t.fees||0,c.open?'':c.g,c.open?'':c.profit,c.open?'':c.net,c.open?'ABERTO':c.net>0?'GAIN':c.net<0?'LOSS':'ZERO',t.rel||'',t.stop||'',t.alvo||'',riskOf(t)||'',!c.open&&riskOf(t)?c.net/riskOf(t):'',t.corr||'',t.mkt||'FUTUROS',legsOf(t).E.map(e=>e.p+'@'+e.n).join(' | '),legsOf(t).X.map(x=>x.p+'@'+(x.n||'resto')).join(' | ')])});
 wb.SheetNames.push('DADOS');wb.Sheets.DADOS=XLSX.utils.aoa_to_sheet(rows);return wb}
async function exportX(){xmsg.style.color='var(--warn)';
 if(!trades.filter(isU).length){xmsg.textContent='Registre ao menos um trade antes de baixar.';return}
 try{const d=(typeof claude!=='undefined'&&claude&&claude.use)?await claude.use('downloads'):null;
  if(typeof XLSX==='undefined'){xmsg.textContent='A biblioteca de planilha não carregou. Recarregue a página.';return}const out=XLSX.write(buildWB(),{bookType:'xlsx',type:'array'});
  {const bl=new Blob([out],{type:'application/octet-stream'}),fn='TRADES_'+ymd(new Date())+'.xlsx';if(d)await d.save({filename:fn,data:bl});else dlBlob(fn,bl)}
  xmsg.style.color='var(--ink3)';xmsg.textContent='Planilha gerada.'}
 catch(e){xmsg.textContent=e&&e.code==='declined'?'':'Não foi possível baixar ('+((e&&(e.code||e.message))||'erro')+').'}}
function dlBlob(name,text,type){const u=URL.createObjectURL(text instanceof Blob?text:new Blob([text],{type:type||'application/json'})),a=document.createElement('a');a.href=u;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000)}
function showBk(txt){let b=document.getElementById('bkTxt');if(!b){b=document.createElement('textarea');b.id='bkTxt';b.readOnly=true;b.style.cssText='width:100%;height:90px;margin-top:8px;background:rgba(0,0,0,.35);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:8px;font:12px monospace';kmsg.after(b)}b.value=txt;b.style.display='block';b.focus();b.select();try{navigator.clipboard&&navigator.clipboard.writeText(txt)}catch(e){}}
async function doBackup(){kmsg.style.color='var(--ink3)';const name='backup-gestao-risco-'+ymd(new Date())+'.json',data=JSON.stringify({v:1,bank,base,flows,st,trades,brokers,rf,baseB,specs:Object.fromEntries(specs.map(x=>[x.n,{lo:x.lo,hi:x.hi}])),cfg:{A:CFG.A.limit,B:CFG.B.limit,D:DLIM},phist:phGet()},null,1),old=document.getElementById('bkTxt');if(old)old.style.display='none';
 try{
  if(typeof claude!=='undefined'&&claude&&claude.use){try{const d=await claude.use('downloads');if(d){await d.save({filename:name,data});kmsg.textContent='Backup gerado.';return}}catch(e){if(e&&e.code==='declined'){kmsg.textContent='';return}}}
  dlBlob(name,data);kmsg.textContent='Backup gerado. Se o download não começar, copie o texto abaixo e salve num arquivo .json.';showBk(data)
 }catch(e){kmsg.style.color='var(--warn)';kmsg.textContent='Download bloqueado neste ambiente. Copie o texto abaixo e salve num arquivo .json.';showBk(data)}}
function restore(inp){const fl=inp.files[0];inp.value='';if(!fl)return;kmsg.style.color='var(--ink3)';kmsg.textContent='Lendo arquivo...';
 fl.text().then(tx=>{const o=JSON.parse(tx),raw=Array.isArray(o)?o:o.trades;if(!Array.isArray(raw))throw new Error('formato desconhecido');
  const list=raw.map(normT).filter(Boolean),bad=raw.length-list.length,full=!Array.isArray(o)&&o.v===1;
  if(!list.length)throw new Error('nenhum trade válido');
  const msg=full?`Restaurar backup com ${list.length} trades? Isso substitui os dados atuais.`:`Importar ${list.length} trades? Eles serão adicionados aos trades atuais, sem duplicar os que já existem.`+(bad?` ${bad} linhas inválidas serão ignoradas.`:'');
  return ask(msg).then(ok=>{if(!ok){kmsg.textContent='';return}let add=list.length;
   if(full){bkApply(o);if(Array.isArray(o.brokers)&&o.brokers.length){brokers=o.brokers.filter(x=>x&&x.n);saveBr();fillCor();brRender()}trades=list;if(Array.isArray(o.rf)){rf=o.rf;saveRf()}if(o.baseB>=0){baseB=o.baseB;try{localStorage.setItem('gr_baseB',String(baseB))}catch(e){}}if(o.st&&o.st.A&&o.st.B)st=o.st;if(o.bank>=0)bank=o.bank;base=o.base>=0?o.base:bank;flows=Array.isArray(o.flows)?o.flows:[];bankInp.value=bank?pc(bank):'';baseInp.value=base?pc(base):''}
   else{const key=t=>[t.sym,t.entry,t.de,t.he].join('|'),have=new Set(trades.map(key));add=0;list.forEach(t=>{if(!have.has(key(t))){trades.push(t);have.add(key(t));add++}})}
   month=list.map(dOf).sort().pop().slice(0,7);saveTr();save();fillChips();render();kmsg.textContent=full?'Backup restaurado.':add+' trades importados.'})
 }).catch(e=>{kmsg.style.color='var(--warn)';kmsg.textContent='Não foi possível ler o arquivo ('+(e&&e.message||'erro')+').'})}
let cmonth='';
const MN=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const mshort=m=>MN[+m.slice(5,7)-1]+'/'+m.slice(2,4);
const mlong=m=>new Date(+m.slice(0,4),+m.slice(5,7)-1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
const pp=n=>(n>0?'+':n<0?'-':'')+f(Math.abs(n))+'%';
const pl=(n,a,b)=>n===1?a:b;
const byTime=(a,b)=>(dOf(a)+(a.hs||'')).localeCompare(dOf(b)+(b.hs||''));
const wkOf=s=>{const d=new Date(s+'T00:00:00');d.setDate(d.getDate()-((d.getDay()+6)%7));return ymd(d)};
const nextM=m=>{const y=+m.slice(0,4),k=+m.slice(5,7);return k===12?(y+1)+'-01':y+'-'+String(k+1).padStart(2,'0')};
const sm=a=>a.reduce((x,y)=>x+y,0);
function cartData(){
 const closed=trades.filter(isU).filter(t=>!calc(t).open).sort(byTime),open=trades.filter(isU).filter(t=>calc(t).open),cm=ymd(new Date()).slice(0,7),ms=trades.filter(isU).map(t=>dOf(t).slice(0,7));
 if(!ms.length)return{rows:[],closed,open,cm,dd:0,ddp:0};
 ms.push(cm);ms.sort();
 const rows=[];let cum=0,fb=0;
 for(let m=ms[0],g=0;m<=ms[ms.length-1]&&g<600;m=nextM(m),g++){
  const L=closed.filter(t=>dOf(t).startsWith(m)),nets=L.map(t=>calc(t).net),pnl=sm(nets),start=base+cum+fb,fm=sm(flows.filter(x=>x.d.slice(0,7)===m).map(x=>x.v));cum+=pnl;fb+=fm;
  rows.push({m,L,n:L.length,w:nets.filter(x=>x>0).length,l:nets.filter(x=>x<0).length,pnl,start,end:start+pnl+fm,ret:start>0?pnl/start*100:null,cum,cumPct:base>0?cum/base*100:null,open:open.filter(t=>dOf(t).slice(0,7)<=m)})
 }
 let eq=base,pk=base,dd=0,ddp=0;
 closed.forEach(t=>{eq+=calc(t).net;if(eq>pk)pk=eq;const d=pk-eq;if(d>dd){dd=d;ddp=pk>0?d/pk*100:0}});
 return{rows,closed,open,cm,dd,ddp}}
function monthReport(D,m){
 const i=D.rows.findIndex(r=>r.m===m),r=D.rows[i];if(!r)return null;
 const prev=D.rows.slice(0,i).reverse().find(x=>x.n>0),cap0=r.start,L=r.L,n=r.n,O=r.open,partial=m===D.cm?' (mês em andamento, resultado parcial)':'';
 const nets=L.map(t=>calc(t).net),W=nets.filter(x=>x>0),Ls=nets.filter(x=>x<0).map(x=>-x);
 const hit=n?W.length/n:0,avgW=W.length?sm(W)/W.length:0,avgL=Ls.length?sm(Ls)/Ls.length:0,payoff=avgL&&avgW?avgW/avgL:null,pf=Ls.length?sm(W)/sm(Ls):null,exp=n?r.pnl/n:0;
 let streak=0,run=0;L.forEach(t=>{if(calc(t).net<0){run++;streak=Math.max(streak,run)}else run=0});
 const day={};L.forEach(t=>{day[dOf(t)]=(day[dOf(t)]||0)+calc(t).net});
 const dk=Object.keys(day),worstDay=dk.length?dk.reduce((a,b)=>day[a]<day[b]?a:b):null,worstDayPct=worstDay&&cap0>0?day[worstDay]/cap0*100:0;
 const risks=L.map(t=>({t,r:riskOf(t)})).filter(x=>x.r>0),rp=x=>cap0>0?x.r/cap0*100:0,maxRisk=risks.length?Math.max(...risks.map(rp)):0;
 const noStop=L.filter(t=>!(t.stop>0)).length,over=risks.filter(x=>x.r>cap0*CFG[sysOf(x.t)].max/100).length,over1=risks.filter(x=>rp(x)>1).length;
 const levB=L.filter(t=>sysOf(t)==='B'&&t.lev>8).length;
 const bLoss=sm(L.filter(t=>sysOf(t)==='B'&&calc(t).net<0).map(t=>-calc(t).net));
 const wk={};L.filter(t=>sysOf(t)==='A'&&calc(t).net<0&&t.ds).forEach(t=>{const k=wkOf(t.ds);wk[k]=(wk[k]||0)-calc(t).net});
 const aLoss=Object.values(wk).length?Math.max(...Object.values(wk)):0;
 const su={};L.forEach(t=>{const k=t.setup||'SEM SETUP';su[k]=su[k]||{n:0,pnl:0};su[k].n++;su[k].pnl+=calc(t).net});
 const sk=Object.keys(su).sort((a,b)=>su[b].pnl-su[a].pnl),bestS=sk[0],worstS=sk[sk.length-1];
 const noRel=L.filter(t=>!t.rel).length,fees=sm(L.map(t=>t.fees||0)),gross=sm(L.map(t=>calc(t).profit).filter(x=>x>0)),openNoStop=O.filter(t=>!(t.stop>0)).length;
 const shorts=L.filter(t=>t.type==='SHORT'),shortPnl=sm(shorts.map(t=>calc(t).net));
 const broken=noStop>0||over>0||worstDayPct<=-10||bLoss>cap0*CFG.B.limit/100||aLoss>cap0*CFG.A.limit/100;
 const tone=!n?'':r.pnl>0?'cy':r.pnl<0?'neg':'';
 const head=!n?'Sem trades fechados':r.pnl>0?'Mês positivo':r.pnl<0?'Mês negativo':'Mês no zero a zero';
 const P=[];
 if(!n){
  P.push(`Nenhum trade foi fechado em ${mlong(m)}${partial}. Ficar fora do mercado também é uma decisão: o ebook ensina que, se a resposta para "hoje é um bom dia para operar?" hesitar, não se opera.`);
  P.push(`O acumulado da carteira segue em ${sg(r.cum)}${r.cumPct!==null?` (${pp(r.cumPct)})`:''}.`)
 }else{
  P.push(`Em ${mlong(m)}${partial}, a carteira fechou ${n} ${pl(n,'trade','trades')}: ${W.length} ${pl(W.length,'ganho','ganhos')} e ${Ls.length} ${pl(Ls.length,'perda','perdas')} (taxa de acerto de ${f(hit*100)}%). Resultado líquido de ${sg(r.pnl)}${r.ret!==null?` (${pp(r.ret)} sobre a banca de ${usd(cap0)})`:''}. No acumulado, a carteira está em ${sg(r.cum)}${r.cumPct!==null?` (${pp(r.cumPct)})`:''}.`);
  P.push(payoff!==null?`O ganho médio foi de ${usd(avgW)} contra perda média de ${usd(avgL)}, um payoff de ${f(payoff)}x. Em média, cada trade deixou ${sg(exp)}.`:`Em média, cada trade deixou ${sg(exp)}.`);
  if(prev){const ph=prev.w/prev.n;P.push(`Em comparação com ${mlong(prev.m)} (${sg(prev.pnl)}), o resultado ${r.pnl>prev.pnl?'melhorou':r.pnl<prev.pnl?'piorou':'ficou igual'}${r.pnl!==prev.pnl?` em ${usd(Math.abs(r.pnl-prev.pnl))}`:''} e a taxa de acerto ${hit>ph?'subiu':hit<ph?'caiu':'ficou estável'} de ${f(ph*100)}% para ${f(hit*100)}%.`)}
  P.push(r.pnl<0&&!broken?'Um mês negativo com o risco sob controle faz parte do jogo probabilístico: o ebook lembra que cada trade individual é irrelevante e que o que vale é repetir o processo ao longo de muitos trades.'
   :r.pnl<0?'Neste mês o ajuste parece estar mais na execução do que na estratégia. O ebook é direto: a decisão foi sua, e isso significa que a melhoria também está ao seu alcance.'
   :broken?'Resultado positivo não valida um processo com falhas de risco. Consistência vem de aplicar as regras em todos os trades, sem exceção.'
   :'Resultado positivo com o risco dentro das regras é o padrão a repetir: a consistência vem da disciplina repetida dia após dia.')
 }
 const G=[],Wn=[],F=[],it=(t,r)=>({t,r});
 if(n&&exp>0)G.push(it(`Expectativa positiva: ${sg(exp)} por trade em média${payoff!==null?`, payoff de ${f(payoff)}x`:''}${pf!==null?` e profit factor de ${f(pf)}`:''}.`,'Cap. 2 · Pensamento probabilístico'));
 if(n&&noStop===0)G.push(it('Todos os trades tiveram stop definido, base para calcular o tamanho da posição.','Cap. 6 · Gestão de risco'));
 if(risks.length){if(maxRisk<=1)G.push(it(`Risco por trade sempre dentro de 1% da banca (maior: ${f(maxRisk)}%).`,'Cap. 6 · Gestão de risco'));else if(over===0)G.push(it(`Risco por trade dentro do máximo dos seus sistemas (maior: ${f(maxRisk)}% da banca).`,'Cap. 6 · Gestão de risco'))}
 if(n&&noRel===0)G.push(it('Diário em dia: todos os trades têm relato.','Cap. 6 · Rotina diária'));
 if(n>=3&&sk.length===1&&su[bestS].pnl>0)G.push(it(`Foco em um único setup (${esc(bestS)}), como o ebook recomenda.`,'Cap. 5 · Setups'));
 else if(sk.length>1&&su[bestS].pnl>0)G.push(it(`Setup mais consistente: ${esc(bestS)}, ${sg(su[bestS].pnl)} em ${su[bestS].n} ${pl(su[bestS].n,'trade','trades')}.`,'Cap. 5 · Setups'));
 if(noStop>0)Wn.push(it(`${noStop} ${pl(noStop,'trade sem stop','trades sem stop')}. A fórmula do ebook parte da distância até o stop: tamanho = risco ÷ distância até o stop.`,'Cap. 6 · Gestão de risco'));
 if(over>0)Wn.push(it(`${over} ${pl(over,'trade com risco acima do máximo','trades com risco acima do máximo')} do seu sistema (maior: ${f(maxRisk)}% da banca). A referência do ebook é 1% por trade.`,'Cap. 6 · Gestão de risco'));
 else if(over1>0)Wn.push(it(`${over1} ${pl(over1,'trade acima','trades acima')} de 1% de risco (maior: ${f(maxRisk)}%). Dentro do máximo dos seus sistemas, mas acima da referência do ebook.`,'Cap. 6 · Gestão de risco'));
 if(worstDayPct<=-10)Wn.push(it(`Pior dia (${dfmt(worstDay)}): ${pp(worstDayPct)} da banca, no limite ou além dos -10% por dia do ebook.`,'Cap. 6 · Limites não negociáveis'));
 else if(worstDayPct<=-5)Wn.push(it(`Pior dia (${dfmt(worstDay)}): ${pp(worstDayPct)} da banca, metade do limite diário de -10% do ebook.`,'Cap. 6 · Limites não negociáveis'));
 if(streak>=3)Wn.push(it(`Sequência de ${streak} perdas seguidas. Revise o diário, confirme se cada entrada seguiu o setup e lembre da regra: se hesitar, não entra.`,'Cap. 2 · Teste do conforto'));
 if(bLoss>cap0*CFG.B.limit/100)Wn.push(it(`As perdas do Sistema B somaram ${f(bLoss/cap0*100)}% da banca no mês, acima do teto de ${pc(CFG.B.limit)}%.`,'Seus limites · Sistema B'));
 if(aLoss>cap0*CFG.A.limit/100)Wn.push(it(`Em uma semana, as perdas do Sistema A chegaram a ${f(aLoss/cap0*100)}% da banca, acima do teto de ${pc(CFG.A.limit)}%.`,'Seus limites · Sistema A'));
 if(levB>0)Wn.push(it(`${levB} ${pl(levB,'trade','trades')} do Sistema B com alavancagem acima de 8x. O ebook associa médio e longo prazo a baixa alavancagem (Torres Gêmeas: máx. 8x).`,'Cap. 3 · Tipos de operação'));
 if(payoff!==null&&payoff<1.5)Wn.push(it(`Payoff de ${f(payoff)}x, abaixo do mínimo de 1,5x. Com esse payoff é preciso acertar cerca de ${f(100/(1+payoff))}% dos trades só para empatar (acerto do mês: ${f(hit*100)}%).`,'Cap. 6 · Gestão de risco'));
 if(shorts.length>=2&&shortPnl<0)Wn.push(it(`Os shorts somaram ${sg(shortPnl)} no mês. Antes de shortar, confira o LSR: o ebook proíbe shortar com LSR abaixo de 1.`,'Cap. 6 · Análise de sentimento'));
 if(sk.length>1&&su[worstS].pnl<0&&su[worstS].n>=2)Wn.push(it(`Setup ${esc(worstS)}: ${sg(su[worstS].pnl)} em ${su[worstS].n} trades. Revise a execução ou pause até entender o que falhou.`,'Cap. 5 · Setups'));
 if(sk.length>=4&&su[bestS].n/n<.4)Wn.push(it(`${sk.length} setups diferentes em ${n} trades. O ebook recomenda dominar um setup antes de aprender outro.`,'Cap. 5 · Setups'));
 if(noRel>0)Wn.push(it(`${noRel} de ${n} ${pl(n,'trade sem relato','trades sem relato')}. O diário detalhado é a base para revisar erros e acertos.`,'Cap. 6 · Rotina diária'));
 if(fees>0&&gross>0&&fees>gross*.2)Wn.push(it(`Fees de ${usd(fees)} consumiram ${f(fees/gross*100)}% do lucro bruto dos trades vencedores.`,''));
 if(O.length>0)Wn.push(it(`${O.length} ${pl(O.length,'trade aberto','trades abertos')} neste mês, ainda fora do resultado acima${openNoStop?` (${openNoStop} sem stop)`:''}. Confira se o risco continua dentro do planejado.`,'Cap. 6 · Gestão de risco'));
 if(n>0&&n<10)Wn.push(it(`Amostra pequena: ${n} ${pl(n,'trade','trades')}. O ebook usa 100 trades como referência, então evite conclusões definitivas com poucos resultados.`,'Cap. 2 · Pensamento probabilístico'));
 if(noStop||over||over1)F.push(it('Antes de cada trade: calcular o stop, definir o tamanho da posição (risco ÷ distância até o stop) e conferir o risco máximo.','Cap. 6 · Rotina diária'));
 if(streak>=3||worstDayPct<=-5)F.push(it('Definir a meta de perda do dia antes de operar e parar ao atingi-la. Pergunta final: hoje é um bom dia para operar? Se hesitar, não opere.','Cap. 6 · Rotina diária'));
 if(payoff!==null&&payoff<1.5)F.push(it('Só entrar quando o alvo oferecer payoff de pelo menos 1,5x sobre o stop.','Cap. 6 · Gestão de risco'));
 if(sk.length>=3||(sk.length>1&&su[worstS].pnl<0&&su[worstS].n>=2))F.push(it('Escolher um setup e dominá-lo completamente antes de aprender outro.','Cap. 5 · Setups'));
 if(noRel>0)F.push(it('Registrar o relato de cada trade e revisar erros e acertos do dia anterior.','Cap. 6 · Rotina diária'));
 [it('Manter a rotina: análise macro, sentimento (LSR do BTC) e análise de ativos antes de operar.','Cap. 6 · Rotina diária'),it('Confiar no processo: cada trade é uma experiência independente e o que conta é a execução repetida.','Cap. 2 · Mentalidade'),it('Se hesitar em entrar, não entre. O conforto faz parte da estratégia.','Cap. 7 · Próximos passos')].forEach(x=>{if(F.length<2)F.push(x)});
 return{m,head,tone,P,G:G.slice(0,4),Wn:Wn.slice(0,6),F:F.slice(0,3),n}}
function repHTML(R){
 const li=(a,c)=>a.map(x=>`<li class="${c}"><i></i><div>${x.t}${x.r?`<small>${x.r}</small>`:''}</div></li>`).join('');
 return `<div class="rep"><span class="hl ${R.tone}">${R.head}</span>${R.P.map(p=>`<p>${p}</p>`).join('')}`
 +(R.G.length?`<h4>O que funcionou</h4><ul>${li(R.G,'g')}</ul>`:'')
 +(R.Wn.length?`<h4>Pontos de atenção</h4><ul>${li(R.Wn,'w')}</ul>`:R.n?'<h4>Pontos de atenção</h4><ul><li class="g"><i></i><div>Nenhuma regra de risco foi violada neste mês.</div></li></ul>':'')
 +`<h4>Foco para o próximo mês</h4><ul>${li(R.F,'f')}</ul>`
 +'<div class="src">Relatório gerado automaticamente a partir dos seus trades, com base no ebook Masterclass de Trading (Mentoria Horistic). Material educativo, não é recomendação de investimento.</div></div>'}
function cartChart(D){
 const rows=D.rows;if(!rows.length)return '';
 const pts=[{l:'início',v:base},...rows.map(r=>({l:mshort(r.m),v:r.end}))],W=560,H=210,pl_=14,pr=14,pt=30,pb=30;
 const vs=pts.map(p=>p.v),mn=Math.min(...vs),mx=Math.max(...vs),pad=((mx-mn)||Math.abs(base)||1)*.12,lo=mn-pad,hi=mx+pad;
 const X=i=>pl_+(pts.length>1?i/(pts.length-1)*(W-pl_-pr):(W-pl_-pr)/2),Y=v=>pt+(1-(v-lo)/(hi-lo))*(H-pt-pb);
 const up=pts[pts.length-1].v>=base,col=up?'#22e5ff':'var(--bad)',step=Math.ceil(pts.length/8),last=pts.length-1;
 return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;font:12px var(--f)" role="img" aria-label="Capital da carteira mês a mês">
 <line x1="${pl_}" x2="${W-pr}" y1="${Y(base)}" y2="${Y(base)}" stroke="var(--line)" stroke-dasharray="4 4"/>
 <polyline fill="none" stroke="${col}" stroke-width="2.2" stroke-linejoin="round" points="${pts.map((p,i)=>X(i)+','+Y(p.v)).join(' ')}"/>
 ${pts.map((p,i)=>`<circle cx="${X(i)}" cy="${Y(p.v)}" r="${i===last?4.5:3}" fill="${col}"/>${i%step===0||i===last?`<text x="${X(i)}" y="${H-8}" text-anchor="${i===0?'start':i===last?'end':'middle'}" fill="var(--ink3)">${p.l}</text>`:''}`).join('')}
 <text x="${X(last)}" y="${Math.max(14,Y(pts[last].v)-12)}" text-anchor="${last===0?'start':'end'}" fill="var(--ink)" style="font-weight:700">${usd(pts[last].v)}</text></svg>`}

let baseB=parseFloat(localStorage.getItem('gr_baseB'))||0,rf=[],rfMonth=ymd(new Date()).slice(0,7);try{rf=JSON.parse(localStorage.getItem('gr_rf')||'[]')}catch(e){}
const saveRf=()=>{try{localStorage.setItem('gr_rf',JSON.stringify(rf))}catch(e){}},rfSum=r=>Object.values(r.m||{}).reduce((a,b)=>a+b,0);
function setBaseB(v){const n=num(v);baseB=isNaN(n)||n<0?0:n;try{localStorage.setItem('gr_baseB',String(baseB))}catch(e){}rfRender()}
function rfRender(){
 if(!document.getElementById('rfM'))return;rfM.value=rfMonth;const D=cartData(),m=rfMonth,upto=o=>Object.keys(o||{}).filter(k=>k<=m).reduce((a,k)=>a+o[k],0);
 ['USD','BRL'].forEach(c=>{
  const it=rf.filter(r=>r.c===c),tp=trades.filter(t=>(t.cart||'USD')===c&&!calc(t).open&&dOf(t).slice(0,7)===m).reduce((a,t)=>a+calc(t).net,0),
  pr=it.reduce((a,r)=>a+((r.m||{})[m]||0),0),am=it.reduce((a,r)=>a+((r.a||{})[m]||0),0),ap=it.reduce((a,r)=>a+(r.p||0)+upto(r.a),0),ac=it.reduce((a,r)=>a+upto(r.m),0),cl=v=>v>0?'pos':v<0?'neg':'',rc=ap+ac,
  tc=c==='USD'?(()=>{const rs=D.rows.filter(r=>r.m<=m);return rs.length?rs[rs.length-1].end:base+sm(flows.filter(x=>x.d.slice(0,7)<=m).map(x=>x.v))})():baseB+trades.filter(t=>t.cart==='BRL'&&!calc(t).open&&dOf(t).slice(0,7)<=m).reduce((a,t)=>a+calc(t).net,0),
  k=(a,b,x)=>`<div><small>${a}</small><b${x?` class="${x}"`:''}>${b}</b></div>`;
  document.getElementById(c==='USD'?'rfU':'rfB').innerHTML=`<div class="cbox"><h4>Carteira ${c}</h4><div class="caps"><div><small>${c==='USD'?'Capital em trades':'Capital em ações'}</small><b>${mny(c,tc)}</b></div><div><small>Capital em renda fixa</small><b>${mny(c,rc)}</b></div><div class="tot"><small>Capital total da carteira</small><b>${mny(c,tc+rc)}</b></div></div>${c==='BRL'?`<label class="bl">Capital inicial em ações (R$)<input inputmode="decimal" placeholder="0,00" value="${baseB?pc(baseB):''}" onchange="setBaseB(this.value)"></label>`:''}<div class="sumrow">${k(c==='USD'?'Trades no mês':'Ações no mês',sgm(c,tp),cl(tp))}${k('Renda fixa no mês',sgm(c,pr),cl(pr))}${k('Total do mês',sgm(c,tp+pr),cl(tp+pr))}${k('Aportes no mês',mny(c,am))}${k('Aplicado em RF',mny(c,ap))}${k('RF acumulada',sgm(c,ac),cl(ac))}</div>
  <h5>Renda fixa ${c}</h5><div>${it.length?it.map(r=>`<div class="rfr"><div class="n"><b>${esc(r.t)}</b><small>Aplicado ${mny(c,(r.p||0)+upto(r.a))}${r.p?' (inicial '+mny(c,r.p)+')':''} · Lucro acum. ${sgm(c,upto(r.m))}</small></div><button aria-label="Remover" onclick="rfDel(${r.id})">×</button><div class="in"><label>Aporte do mês<input inputmode="decimal" placeholder="0,00" value="${(r.a||{})[m]!==undefined?pc((r.a||{})[m]):''}" onchange="rfAporte(${r.id},this.value)"></label><label>Lucro do mês<input inputmode="decimal" placeholder="0,00" value="${(r.m||{})[m]!==undefined?pc((r.m||{})[m]):''}" onchange="rfProfit(${r.id},this.value)"></label></div></div>`).join(''):'<div class="empty">Nenhuma renda fixa ainda.</div>'}</div>
  <div class="rfa"><input id="rfT${c}" placeholder="Título (ex.: CDB 110% CDI)" autocomplete="off"><input id="rfP${c}" inputmode="decimal" placeholder="Valor inicial aplicado (opcional)" autocomplete="off"><button class="ghost" onclick="rfAdd('${c}')">+ Renda fixa</button></div></div>`})}
function rfAporte(id,v){const r=rf.find(x=>x.id===id);if(!r)return;r.a=r.a||{};if(String(v).trim()==='')delete r.a[rfMonth];else{const n=num(v);if(!isNaN(n))r.a[rfMonth]=n}saveRf();rfRender()}
function rfProfit(id,v){const r=rf.find(x=>x.id===id);if(!r)return;r.m=r.m||{};if(String(v).trim()==='')delete r.m[rfMonth];else{const n=num(v);if(!isNaN(n))r.m[rfMonth]=n}saveRf();rfRender()}
function rfAdd(c){const t=document.getElementById('rfT'+c).value.trim();if(!t)return;const p=num(document.getElementById('rfP'+c).value);rf.push({id:Date.now(),t,c,p:isNaN(p)?0:p,m:{},a:{}});saveRf();rfRender()}
function rfDel(id){const r=rf.find(x=>x.id===id);if(!r)return;ask('Remover a renda fixa "'+r.t+'"?').then(ok=>{if(ok){rf=rf.filter(x=>x.id!==id);saveRf();rfRender()}})}
function renderCart(){renderFlows();perfRender();try{rfRender()}catch(e){console.error(e)}
 const D=cartData(),rows=D.rows,withT=rows.filter(r=>r.n>0);
 cEmpty.style.display=rows.length?'none':'block';cRepCard.style.display=rows.length?'':'none';
 const fl=sm(flows.map(x=>x.v)),pnl=sm(rows.map(r=>r.pnl)),nW=sm(rows.map(r=>r.w)),nL=sm(rows.map(r=>r.l)),n=nW+nL,allW=D.closed.map(t=>calc(t).net).filter(x=>x>0),allL=D.closed.map(t=>-calc(t).net).filter(x=>x>0);
 capNow.textContent=usd(base+fl+pnl);const cd=(k,v,sub,cl)=>`<div><small>${k}</small><b${cl?` class="${cl}"`:''}>${v}</b>${sub?`<small>${sub}</small>`:''}</div>`,sc=v=>v>0?'cy':v<0?'neg':'';
 cSum.innerHTML=rows.length?cd('Resultado acumulado',sg(pnl),'',sc(pnl))+cd('Retorno acumulado',base>0?pp(pnl/base*100):'-','sobre '+usd(base),base>0?sc(pnl):'')+cd('Capital atual',usd(base+fl+pnl),'',sc(pnl))+cd('Drawdown máximo',D.dd>0?'-'+usd(D.dd):'-',D.dd>0?f(D.ddp)+'% do pico':'',D.dd>0?'neg':'')
  +cd('Trades fechados',String(n),D.open.length?D.open.length+' em aberto':'')+cd('Taxa de acerto',n?f(nW/n*100)+'%':'-',n?nW+' ganhos e '+nL+' perdas':'',n?(nW/n>=.5?'cy':'neg'):'')+cd('Profit factor',allL.length?f(sm(allW)/sm(allL)):allW.length?'∞':'-','',allL.length?(sm(allW)/sm(allL)>=1?'cy':'neg'):allW.length?'cy':'')+cd('Meses positivos',withT.length?withT.filter(r=>r.pnl>0).length+' de '+withT.length:'-','',withT.length?(withT.filter(r=>r.pnl>0).length/withT.length>=.5?'cy':'neg'):''):'';
 cChart.innerHTML=cartChart(D);
 cInfo.textContent=rows.length?'Capital inicial: '+usd(base)+' (editável em Capital e movimentações)':'';
 cBody.innerHTML=rows.slice().reverse().map(r=>`<tr onclick="pickCM('${r.m}')"${r.m===cmonth?' style="background:var(--soft)"':''}><td style="text-transform:capitalize">${mshort(r.m)}${r.open.length?'<small>'+r.open.length+' aberto'+(r.open.length>1?'s':'')+'</small>':''}</td><td>${r.n||'-'}</td><td class="${r.n?(r.w/r.n>=.5?'cy':'neg'):''}">${r.n?f(r.w/r.n*100)+'%':'-'}</td><td class="${r.n?sc(r.pnl):''}">${r.n?sg(r.pnl):'-'}</td><td class="${r.n?sc(r.pnl):''}">${r.n&&r.ret!==null?pp(r.ret):'-'}</td><td class="${sc(r.cum)}">${sg(r.cum)}</td><td class="${sc(r.cum)}">${r.cumPct!==null?pp(r.cumPct):'-'}</td></tr>`).join('');
 if(rows.length){
  if(!rows.some(r=>r.m===cmonth))cmonth=(withT.length?withT[withT.length-1]:rows[rows.length-1]).m;
  cMonth.innerHTML=rows.slice().reverse().map(r=>`<option value="${r.m}"${r.m===cmonth?' selected':''}>${mlong(r.m)}</option>`).join('');
  cRep.innerHTML=repHTML(monthReport(D,cmonth))}
 else cRep.innerHTML=''}
function pickCM(m){cmonth=m;renderCart();cRepCard.scrollIntoView({behavior:'smooth',block:'nearest'})}
const PK='gr_proto',PROTO=[
 {id:'fis',t:'Preparação física',d:'Banho, se arrumar, postura de trabalho'},
 {id:'men',t:'Centragem mental',d:'Meditação ou respiração, 5 a 10 minutos'},
 {id:'dia',t:'Diário de trade',d:'Revisar erros e acertos do dia anterior'},
 {id:'est',t:'Estudo de estratégias',d:'Revisar os setups com os quais mais se identifica'},
 {id:'mac',t:'Análise macro',d:'Sempre do gráfico maior para o menor',subs:['SP500','Notícias','Bitcoin','Total Market Cap','BTC.D','USDT.D','ETH/BTC','ETH']},
 {id:'sen',t:'Sentimento',d:'LSR do BTC e variação (delta LSR). Proibido shortar com LSR abaixo de 1.'},
 {id:'ati',t:'Análise de ativos',d:'Top 20 altcoins no máximo'},
 {id:'pre',t:'Antes de cada trade',d:'Calcular stop, definir tamanho da posição e a meta de ganho e perda do dia',subs:['Calcular o stop','Definir o tamanho da posição','Definir meta de ganho e perda do dia'],goals:true},
 {id:'fin',t:'Pergunta final',d:'Hoje é um bom dia para operar? Se a resposta hesitar, não opere.',final:true}];
let pr={d:'',c:{},g:'',l:'',e:''};
function pLoad(){const t=ymd(new Date());try{const r=JSON.parse(localStorage.getItem(PK)||'null');if(r&&r.d===t&&r.c){pr=r;return}}catch(e){}pr={d:t,c:{},g:'',l:'',e:''}}
function pSave(){try{localStorage.setItem(PK,JSON.stringify(pr))}catch(e){}phSave();gateGo()}
const pDone=s=>s.final?pr.e==='go':s.subs?s.subs.every((_,i)=>pr.c[s.id+'.'+i]):!!pr.c[s.id];
function pTog(k){const was=PROTO.every(pDone),a=k.split('.'),id=a[0],s=PROTO.find(x=>x.id===id);
 if(a.length===1){if(s.subs){const all=pDone(s);s.subs.forEach((_,j)=>pr.c[id+'.'+j]=!all)}else pr.c[id]=!pr.c[id]}else pr.c[k]=!pr.c[k];
 pSave();renderProto();if(!was&&PROTO.every(pDone))showPhrase()}
function pDec(v){const was=PROTO.every(pDone);pr.e=pr.e===v?'':v;pSave();renderProto();if(!was&&PROTO.every(pDone))showPhrase()}
function pIn(k,v){pr[k]=v;pSave();if(k==='l')render()}
function pReset(){ask('Reiniciar o checklist de hoje?').then(ok=>{if(ok){pr={d:ymd(new Date()),c:{},g:'',l:'',e:'',o:false};pSave();renderProto()}})}
const PHR=["Execute o plano. Não negocie com suas emoções.","Você não precisa de mais operações. Precisa de melhores decisões.","Espere pelo seu setup. O mercado não vai embora.","Disciplina é fazer o que precisa ser feito, mesmo quando você não quer.","Uma boa operação pode dar prejuízo. Uma operação ruim pode dar lucro. Avalie o processo.","Não antecipe o mercado. Deixe o preço confirmar.","Sem confirmação, sem entrada.","Proteja seu capital. Sua próxima oportunidade depende disso.","Você está construindo consistência, não buscando sorte.","O objetivo não é ganhar hoje. É continuar evoluindo amanhã.","Pequenas vantagens, repetidas com disciplina, constroem resultados.","Pense em centenas de operações, não em uma única entrada.","O mercado recompensa a preparação, não a ansiedade.","Seu trabalho é executar bem. O resultado vem depois.","Não tenha pressa para enriquecer. Tenha pressa para aprender.","Consistência é sobreviver aos dias ruins sem comprometer os bons.","Você não precisa recuperar o que perdeu hoje.","Perdeu uma oportunidade? Outras virão.","Não transforme uma perda em uma sequência de erros.","O FOMO é caro. A paciência é uma vantagem.","Ficar de fora também é uma decisão.","Não aumente o risco para satisfazer seu ego.","O mercado não lhe deve nada.","Aceite o stop. Preserve a mente para a próxima operação."];
const phraseToday=()=>{const t=new Date();return PHR[Math.floor(Date.UTC(t.getFullYear(),t.getMonth(),t.getDate())/864e5)%PHR.length]};
function showPhrase(){phrTxt.textContent=phraseToday();phr.classList.add('show');document.body.classList.add('phron')}
function hidePhrase(){phr.classList.remove('show');document.body.classList.remove('phron')}
function pGo(){pr.o=true;pSave();showPhrase()}
document.addEventListener('keydown',e=>{if(e.key==='Escape')hidePhrase()});
function renderProto(){phRender();
 if(pr.d!==ymd(new Date()))pLoad();
 const n=PROTO.filter(pDone).length,tot=PROTO.length;
 pFill.style.width=n/tot*100+'%';
 pStat.innerHTML=pr.e==='stop'?'<span class="neg">Hoje sem operar. Ficar fora também é uma decisão válida.</span>':n===tot?'<span class="cy">Protocolo completo. Bom trading.</span>':n+' de '+tot+' etapas concluídas';
 pList.innerHTML=PROTO.map((s,k)=>{
  const on=pDone(s),oc=s.final?'':` onclick="pTog('${s.id}')"`;
  const subs=s.subs?`<div class="ps">${s.subs.map((x,j)=>`<button class="${pr.c[s.id+'.'+j]?'on':''}" onclick="pTog('${s.id}.${j}')">${x}</button>`).join('')}</div>`:'';
  const goals=s.goals?`<div class="r2" style="margin-top:12px"><div><label>Meta de ganho do dia (US$)</label><input inputmode="decimal" value="${esc(pr.g)}" oninput="pIn('g',this.value)"></div><div><label>Perda máxima do dia (US$)</label><input inputmode="decimal" value="${esc(pr.l)}" oninput="pIn('l',this.value)"></div></div>`:'';
  const fin=s.final?`<div class="seg" style="margin-top:12px"><button class="${pr.e==='go'?'on':''}" onclick="pDec('go')">Sim, estou pronto</button><button class="${pr.e==='stop'?'on':''}" onclick="pDec('stop')">Hesito, hoje não opero</button></div>`:'';
  const bad=s.final&&pr.e==='stop';
  return `<div class="pi${on?' on':''}"><button class="pn${bad?' bad':''}" aria-label="${s.t}"${s.final?' tabindex="-1"':` aria-pressed="${on}"`}${oc}>${bad?'✕':on?'✓':k+1}</button><div class="pb"><b${oc}>${s.t}</b><small>${s.d}</small>${subs}${goals}${fin}</div></div>`}).join('')
 +(pr.e==='stop'?`<div class="pi pd"><div class="pn">10</div><div class="pb"><b>DISCLAIMER</b><small>Se estiver afobado, opere na Phantom.</small><button class="pgo" onclick="pGo()">Decidi operar mesmo assim</button></div></div>`:'')}
pLoad();vTrades.addEventListener('input',updPrev);
xBtn.style.display='';
loadT();fillCor();brRender();initF();load();cfgFill();bankInp.value=bank?pc(bank):'';fillChips();
render();try{const q=localStorage.getItem('gr_tab');if(q==='T'||q==='C'||q==='P'||q==='S')tab(q)}catch(e){}

// ---- novas funções
function addFlow(){const v=num(flV.value),d=flD.value;if(!d||isNaN(v)||!v)return;flows.push({d,v});save();flV.value='';renderCart()}
function delFlow(i){flows.splice(i,1);save();renderCart()}
function renderFlows(){flList.innerHTML=flows.map((x,i)=>({x,i})).reverse().map(({x,i})=>`<div class="row"><div class="n">${x.d.slice(8,10)}/${x.d.slice(5,7)}/${x.d.slice(0,4)}<small>${x.v>=0?'aporte':'saque'}</small></div><b class="${x.v>=0?'pos':'neg'}">${sg(x.v)}</b><button aria-label="Remover" onclick="delFlow(${i})">×</button></div>`).join('')}
function useCap(){const D=cartData(),v=base+sm(flows.map(x=>x.v))+sm(D.rows.map(r=>r.pnl));ask('Definir o capital da aba Risco como '+usd(v)+'? Os tetos e o risco por trade passam a usar este valor.').then(ok=>{if(ok){bank=Math.max(0,+v.toFixed(2));bankInp.value=pc(bank);save();fillChips();render()}})}
baseInp.addEventListener('input',()=>{const v=num(baseInp.value);base=isNaN(v)||v<0?0:v;save();renderCart()});
baseInp.value=base?pc(base):'';flD.value=ymd(new Date());
function pcalcUpd(){const e=num(fEnt.value),sp=num(fStop.value),k=sysOf({tf:fTf.value});
 if(!(e>0&&sp>0&&e!==sp&&bank>0)){pcalc.innerHTML='';return}
 const dist=Math.abs(e-sp)/e,ps=[.25,.5,.75,1].map(x=>+(specFor(fSetup.value,fTf.value).pct*x).toFixed(2));
 pcalc.innerHTML=ps.map(p=>{const n=bank*p/100/dist;return `<button type="button" onclick="setNot(${n.toFixed(2)})">Risco ${pc(p)}% → ${usd(n)}</button>`}).join('')}
function setNot(n){fNot.value=pc(n);updPrev()}
function dayLoss(){const td=ymd(new Date());let r=0;trades.filter(isU).forEach(t=>{const c=calc(t);if(!c.open&&c.net<0&&t.ds===td)r-=c.net});['A','B'].forEach(k=>st[k].forEach(e=>{if(ymd(new Date(e.t))===td)r+=e.v}));return r}
function extraTxt(){let x='';const o=trades.filter(isU).filter(t=>calc(t).open);
 if(o.length){const r=sm(o.map(riskOf)),ns=o.filter(t=>!(t.stop>0)).length;x+=` Risco em aberto: ${usd(r)}`+(bank>0?` (${f(r/bank*100)}% da banca)`:'')+(ns?`, ${ns} sem stop`:'')+'.'}
 let lb=0;try{lb=+localStorage.getItem('gr_lastbk')||0}catch(e){}
 if(trades.length&&Date.now()-lb>7*864e5)x+=' Faça um backup (aba Trades).';return x}
function bkInfo(){const bkInfo_=document.getElementById('bkInfo');let lb=0;try{lb=+localStorage.getItem('gr_lastbk')||0}catch(e){}bkInfo_.textContent=lb?'Último backup: '+new Date(lb).toLocaleDateString('pt-BR'):'Você ainda não fez backup.'}
function saveT(){const k=sysOf({tf:fTf.value}),t={notional:num(fNot.value),entry:num(fEnt.value),stop:num(fStop.value)||0};
 if(!editId&&bank>0&&!(num(fExit.value)>0)){const rest=room(k),r=riskOf(t),oR=openRisk(k);let w='';
  if(sum(k)>=lim(k))w=`O Sistema ${k} está travado (teto atingido). Registrar este trade mesmo assim?`;
  else if(r>rest)w=`O risco deste trade (${usd(r)}) é maior que o espaço que resta no teto do Sistema ${k} (${usd(rest)}${oR>0?', já descontados '+usd(oR)+' de risco em trades abertos':''}). Registrar mesmo assim?`;
  if(w){ask(w).then(ok=>{if(ok)commitT()});return}}
 commitT()}
bkInfo();render();gateGo();
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});

/* Listas suspensas: todos os <select> e o campo Setup usam o mesmo componente visual */
(function(){
let pop=null,cur=null;
function close(){if(pop){pop.remove();pop=null}if(cur){cur.classList.remove('open');cur=null}}
function open(anchor,items,val,pick,cap){
 close();cur=anchor;anchor.classList.add('open');
 pop=document.createElement('div');pop.className='ddp';pop.setAttribute('role','listbox');
 if(!items.length)pop.innerHTML='<div class="ddi nil">Sem opções</div>';
 else items.forEach(it=>{const d=document.createElement('div');d.className='ddi'+(it.v===val?' on':'')+(cap?' cap':'');d.setAttribute('role','option');d.textContent=it.t||'\u00a0';d.onmousedown=e=>{e.preventDefault();pick(it);close()};pop.appendChild(d)});
 document.body.appendChild(pop);
 const r=anchor.getBoundingClientRect(),h=pop.offsetHeight,below=innerHeight-r.bottom,up=below<h+12&&r.top>below;
 pop.style.minWidth=r.width+'px';pop.style.left=Math.max(8,Math.min(r.left,innerWidth-pop.offsetWidth-8))+'px';pop.style.top=(up?Math.max(8,r.top-h-6):r.bottom+6)+'px';
 const on=pop.querySelector('.on');if(on)on.scrollIntoView({block:'nearest'})}
function enh(sel){
 if(sel.dataset.dd)return;sel.dataset.dd=1;
 const b=document.createElement('button');b.type='button';b.className='dd';b.setAttribute('aria-haspopup','listbox');
 const cap=getComputedStyle(sel).textTransform==='capitalize';if(cap)b.classList.add('cap');
 sel.style.display='none';sel.after(b);
 const sync=()=>{const o=sel.options[sel.selectedIndex];b.textContent=o&&o.textContent?o.textContent:'\u00a0'};
 const d=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value');
 Object.defineProperty(sel,'value',{get(){return d.get.call(sel)},set(v){d.set.call(sel,v);sync()},configurable:true});
 new MutationObserver(sync).observe(sel,{childList:true,subtree:true});
 b.onclick=()=>{if(cur===b){close();return}open(b,[...sel.options].map(o=>({v:o.value,t:o.textContent})),sel.value,it=>{sel.value=it.v;sel.dispatchEvent(new Event('change',{bubbles:true}))},cap)};
 b.addEventListener('keydown',e=>{if(!pop&&(e.key==='ArrowDown'||e.key==='ArrowUp')){e.preventDefault();b.click()}});
 sync()}
document.querySelectorAll('select').forEach(enh);
new MutationObserver(()=>document.querySelectorAll('select:not([data-dd])').forEach(enh)).observe(document.body,{childList:true,subtree:true});
const fs=document.getElementById('fSetup');
if(fs){fs.removeAttribute('list');
 const items=()=>{const q=fs.value.trim().toUpperCase();return[...document.querySelectorAll('#dlS option')].map(o=>o.value).filter(v=>!q||v.toUpperCase().includes(q)).map(v=>({v,t:v}))};
 const show=()=>{const it=items();if(!it.length){close();return}open(fs,it,fs.value.trim().toUpperCase(),i=>{fs.value=i.v;fs.dispatchEvent(new Event('input',{bubbles:true}));fs.dispatchEvent(new Event('change',{bubbles:true}))},false)};
 fs.addEventListener('focus',show);fs.addEventListener('click',show);fs.addEventListener('input',()=>{if(document.activeElement===fs)show()})}
document.addEventListener('mousedown',e=>{if(pop&&!pop.contains(e.target)&&cur&&!cur.contains(e.target))close()});
addEventListener('scroll',e=>{if(pop&&!pop.contains(e.target))close()},true);addEventListener('resize',close);
document.addEventListener('keydown',e=>{if(!pop)return;if(e.key==='Escape'||e.key==='Tab'){close();return}
 const L=[...pop.querySelectorAll('.ddi:not(.nil)')];if(!L.length)return;let i=L.findIndex(x=>x.classList.contains('hl'));if(i<0)i=L.findIndex(x=>x.classList.contains('on'));
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();L.forEach(x=>x.classList.remove('hl'));i=e.key==='ArrowDown'?Math.min(L.length-1,i+1):Math.max(0,i<0?0:i-1);L[i].classList.add('hl');L[i].scrollIntoView({block:'nearest'})}
 else if(e.key==='Enter'){const h=pop.querySelector('.hl');if(h){e.preventDefault();h.onmousedown({preventDefault(){}})}}});
})();
