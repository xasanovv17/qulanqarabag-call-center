const API=window.API_URL,$=s=>document.querySelector(s),M=$('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n).toLocaleString('ru-RU'),stars=r=>'★'.repeat(Math.round(r))+'☆'.repeat(5-Math.round(r));
const L={new:'Yangi',accepted:'Qabul qilindi',done:'Bajarildi',rejected:'Rad etildi',cancelled:'Bekor qilindi'};
let tok=localStorage.tok,me=JSON.parse(localStorage.me||'null'),tab='stats';
const toast=(m,bad)=>{const t=$('#toast');t.textContent=m;t.className='show'+(bad?' bad':'');clearTimeout(t.t);t.t=setTimeout(()=>t.className='',3000)};
async function api(p,m='GET',b){const r=await fetch(API+p,{method:m,headers:{'Content-Type':'application/json',...(tok&&{Authorization:'Bearer '+tok})},body:b&&JSON.stringify(b)});
const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Xatolik');return d}
const act=async f=>{try{await f()}catch(e){toast(e.message,1)}};
const fd=e=>Object.fromEntries(new FormData(e.target));
const empty=t=>`<p class="empty">${t}</p>`;
const tbl=(h,r)=>`<div class="tw"><table><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${r.map(x=>`<tr>${x.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</table></div>`;
const need=role=>me?.role===role||!(location.hash='#/login');

function nav(){const l=[['','Bosh sahifa'],['workers','Xizmatlar']];
if(me?.role==='client')l.push(['orders','Buyurtmalarim']);if(me?.role==='worker')l.push(['cabinet','Kabinet']);if(me?.role==='admin')l.push(['admin','Admin panel']);
$('#links').innerHTML=l.map(([h,t])=>`<a href="#/${h}">${t}</a>`).join('')+(me?`<a href="#" id="out">Chiqish (${esc(me.name)})</a>`:`<a href="#/login">Kirish</a><a class="btn" href="#/register">Ro'yxatdan o'tish</a>`)}
const card=w=>`<a class="card wk" href="#/worker/${w.id}"><div class="av">${esc(w.name[0])}</div><div><h3>${esc(w.name)}</h3><p class="mut">${esc(w.service||'')}${w.city?', '+esc(w.city):''}</p><p><span class="st">${stars(w.rating)}</span> ${w.rating} (${w.review_count})</p><p class="pr">${w.price?fmt(w.price)+" so'm dan":'Narx kelishiladi'}</p></div></a>`;

async function route(){nav();$('#links').classList.remove('open');const[path,qs]=location.hash.slice(2).split('?'),[pg,id]=path.split('/');scrollTo(0,0);
const v={'':vHome,workers:vWorkers,worker:vWorker,login:vLogin,register:vReg,orders:vOrders,cabinet:vCab,admin:vAdmin}[pg]||vHome;
try{await v(id,new URLSearchParams(qs))}catch(e){M.innerHTML=`<div class="wrap">${empty(esc(e.message))}</div>`}}

async function vHome(){const[sv,ws]=await Promise.all([api('/services'),api('/workers')]);
M.innerHTML=`<section class="hero"><div class="wrap"><h1>Qishlog'imizdagi xizmatlar bir joyda</h1><p>,Har hil hizmatlardan foydalaning va xizmat egasiga izoh qoldirib uni baholang.</p>
<form id="sf" class="search"><input name="q" placeholder="o'zingizga kerak xizmat nomi" aria-label="Qidiruv"><button class="btn">Qidirish</button></form>
<div class="chips">${sv.map(s=>`<a href="#/workers?s=${s.id}">${esc(s.name)}</a>`).join('')}</div></div></section>
<section class="wrap"><div class="grid">${ws.slice(0,6).map(card).join('')||empty("Hozircha hizmatlar yo'q")}</div></section>`;
$('#sf').onsubmit=e=>{e.preventDefault();location.hash='#/workers?q='+encodeURIComponent(e.target.q.value)}}

async function vWorkers(_,q){const sv=await api('/services');
M.innerHTML=`<div class="wrap"><h2>Xizmatlar</h2><form id="ff" class="filter"><select name="s"><option value="">Barcha xizmatlar</option>${sv.map(s=>`<option value="${s.id}" ${q.get('s')==s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select><input name="q" value="${esc(q.get('q')||'')}" placeholder="Ism yoki xizmat"><button class="btn">Topish</button></form><div id="res" class="grid"></div></div>`;
const load=async()=>{const ws=await api('/workers?'+new URLSearchParams(new FormData($('#ff'))));$('#res').innerHTML=ws.map(card).join('')||empty('Xizmat topilmadi')};
$('#ff').onsubmit=e=>{e.preventDefault();act(load)};await load()}

async function vWorker(id){const w=await api('/workers/'+id);
const form=me?.role==='client'?`<h3>Xizmatni korish</h3><form id="of" class="fg1"><input name="address" placeholder="Manzil" required><input name="date" type="date"><textarea name="note" rows="3" placeholder="Xizmat haqida qisqacha"></textarea><button class="btn">Buyurtma yuborish</button></form>`:me?`<p class="mut">Buyurtma berish faqat mijoz hisobi uchun.</p>`:`<p>Buyurtma berish uchun <a class="pr" href="#/login">tizimga kiring</a> yoki <a class="pr" href="#/register">ro'yxatdan o'ting</a>.</p>`;
M.innerHTML=`<div class="wrap two"><div class="card"><div class="av big">${esc(w.name[0])}</div><h1 style="font-size:30px">${esc(w.name)}</h1><p class="mut">${esc(w.service||'')}${w.city?', '+esc(w.city):''}</p><p><span class="st">${stars(w.rating)}</span> ${w.rating} (${w.reviews.length} izoh)</p>
<ul class="facts"><li>Tajriba: ${w.experience} yil</li><li>Narx: ${w.price?fmt(w.price)+" so'm dan":'kelishiladi'}</li><li>Profil ko'rishlar: ${w.views}</li></ul><p>${esc(w.bio||"Ma'lumot kiritilmagan")}</p></div>
<div><div class="card">${form}</div><h2>Izohlar</h2>${w.reviews.map(r=>`<div class="card"><b>${esc(r.client_name)}</b> <span class="st">${stars(r.rating)}</span><p>${esc(r.comment)}</p></div>`).join('')||empty("Hali izoh yo'q")}</div></div>`;
const f=$('#of');if(f)f.onsubmit=e=>{e.preventDefault();act(async()=>{await api('/orders','POST',{worker_id:+id,...fd(e)});toast('Buyurtma yuborildi');location.hash='#/orders'})}}

const authForm=(reg)=>`<form id="af" class="form card"><h2>${reg?"Ro'yxatdan o'tish":'Kirish'}</h2>${reg?'<input name="name" placeholder="Ismingiz" required>':''}<input name="phone" type="tel" placeholder="Telefon: +998901234567" required><input name="password" type="password" placeholder="Parol (kamida 6 belgi)" minlength="6" required><button class="btn">${reg?"Ro'yxatdan o'tish":'Kirish'}</button><p class="mut">${reg?'Hisobingiz bormi? <a class="pr" href="#/login">Kiring</a>':'Hisobingiz yo\'qmi? <a class="pr" href="#/register">Ro\'yxatdan o\'ting</a>'}</p></form>`;
function authPage(reg){M.innerHTML=authForm(reg);$('#af').onsubmit=e=>{e.preventDefault();act(async()=>{const d=await api(reg?'/auth/register':'/auth/login','POST',fd(e));
tok=localStorage.tok=d.token;me=d.user;localStorage.me=JSON.stringify(me);toast('Xush kelibsiz, '+me.name);location.hash={admin:'#/admin',worker:'#/cabinet',client:'#/workers'}[me.role]})}}
const vLogin=()=>authPage(0),vReg=()=>authPage(1);

function oc(o,role){const a=[];
if(role==='client'&&o.status==='new')a.push(['cancelled','Bekor qilish']);
if(role==='worker'){if(o.status==='new')a.push(['accepted','Qabul qilish'],['rejected','Rad etish']);if(o.status==='accepted')a.push(['done','Bajarildi'])}
const who=role==='worker'?`Mijoz: ${esc(o.client_name)}, ${esc(o.client_phone)}`:role==='admin'?`Mijoz: ${esc(o.client_name)}, ${esc(o.client_phone)}<br>Usta: ${esc(o.worker_name)}, ${esc(o.worker_phone)}`:`Usta: <a class="pr" href="#/worker/${o.worker_id}">${esc(o.worker_name)}</a>, ${esc(o.worker_phone)}`;
return `<div class="card"><div class="row"><b>Buyurtma #${o.id}, ${esc(o.service||'')}</b><span class="badge ${o.status}">${L[o.status]}</span></div><p>${who}</p><p class="mut">${esc(o.address)}${o.date?', '+o.date:''}</p>${o.note?`<p>${esc(o.note)}</p>`:''}
<div class="row"><span>${a.map(x=>`<button class="btn sm" data-o="${o.id}" data-s="${x[0]}">${x[1]}</button> `).join('')}</span>${role==='admin'?`<select class="ss" data-o="${o.id}">${Object.entries(L).map(([k,v])=>`<option value="${k}" ${k==o.status?'selected':''}>${v}</option>`).join('')}</select>`:''}</div>
${role==='client'&&o.status==='done'&&!o.reviewed?`<form class="rf" data-o="${o.id}"><select name="rating">${[5,4,3,2,1].map(n=>`<option>${n}</option>`).join('')}</select><input name="comment" placeholder="Izoh yozing" required><button class="btn sm">Yuborish</button></form>`:''}</div>`}

async function vOrders(){if(!need('client'))return;const os=await api('/orders');M.innerHTML=`<div class="wrap"><h2>Buyurtmalarim</h2>${os.map(o=>oc(o,'client')).join('')||empty('Buyurtmalar yo\'q. <a class="pr" href="#/workers">Usta tanlang</a>')}</div>`}

async function vCab(){if(!need('worker'))return;const[w,os]=await Promise.all([api('/worker/me'),api('/orders')]);
M.innerHTML=`<div class="wrap"><h2>Shaxsiy kabinet</h2><div class="stats"><div class="card"><b>${w.views}</b><span>Profil ko'rishlar</span></div><div class="card"><b>${w.rating}</b><span>Reyting (${w.review_count} izoh)</span></div><div class="card"><b>${os.length}</b><span>Buyurtmalar</span></div></div>
<div class="two"><form id="pf" class="card fg1"><h3>${esc(w.name)}, ${esc(w.service||'')}</h3><textarea name="bio" rows="4" placeholder="O'zingiz haqingizda">${esc(w.bio)}</textarea><input name="experience" type="number" min="0" value="${w.experience}" placeholder="Tajriba (yil)"><input name="price" type="number" min="0" value="${w.price}" placeholder="Narx (so'm)"><input name="city" value="${esc(w.city)}" placeholder="Hudud"><button class="btn">Saqlash</button><a class="pr" href="#/worker/${w.id}">Ommaviy profilni ko'rish</a></form>
<div><h3 style="margin-bottom:12px">Buyurtmalar</h3>${os.map(o=>oc(o,'worker')).join('')||empty("Hali buyurtma yo'q")}</div></div></div>`;
$('#pf').onsubmit=e=>{e.preventDefault();act(async()=>{await api('/worker/me','PUT',fd(e));toast('Saqlandi')})}}

async function vAdmin(){if(!need('admin'))return;
const tabs=[['stats','Statistika'],['orders','Buyurtmalar'],['workers','Ustalar'],['clients','Mijozlar'],['services','Xizmatlar']];
M.innerHTML=`<div class="wrap"><h2>Admin panel</h2><div class="tabs">${tabs.map(([k,t])=>`<button class="${k==tab?'on':''}" data-t="${k}">${t}</button>`).join('')}</div><div id="tb"></div></div>`;
const tb=$('#tb'),del=(p)=>`<button class="btn sm o" data-del="${p}">O'chirish</button>`;
if(tab==='stats'){const[s,ws]=await Promise.all([api('/admin/stats'),api('/admin/workers')]);
const c=[['clients','Mijozlar'],['workers','Ustalar'],['services','Xizmatlar'],['orders','Buyurtmalar'],['new_orders','Yangi buyurtmalar'],['done_orders','Bajarilgan'],['views',"Profil ko'rishlar"],['rating',"O'rtacha reyting"]];
tb.innerHTML=`<div class="stats">${c.map(([k,t])=>`<div class="card"><b>${s[k]}</b><span>${t}</span></div>`).join('')}</div><h3 style="margin-bottom:10px">Ustalar reytingi va ko'rishlari</h3>`+tbl(['Usta','Xizmat',"Ko'rishlar",'Reyting','Izohlar','Buyurtmalar'],[...ws].sort((a,b)=>b.views-a.views).map(w=>[esc(w.name),esc(w.service||''),w.views,w.rating,w.review_count,w.orders]))}
if(tab==='orders'){const os=await api('/orders');tb.innerHTML=os.map(o=>oc(o,'admin')).join('')||empty("Buyurtmalar yo'q")}
if(tab==='workers'){const[sv,ws]=await Promise.all([api('/services'),api('/admin/workers')]);
tb.innerHTML=`<form id="aw" class="card"><h3 style="margin-bottom:12px">Yangi usta qo'shish</h3><div class="fg"><input name="name" placeholder="Ism familiya" required><input name="phone" placeholder="Login (telefon)" required><input name="password" placeholder="Parol (kamida 6 belgi)" minlength="6" required><select name="service_id" required><option value="">Xizmat turi</option>${sv.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><input name="city" placeholder="Hudud"><input name="experience" type="number" min="0" placeholder="Tajriba (yil)"><input name="price" type="number" min="0" placeholder="Narx (so'm)"><input name="bio" placeholder="Qisqacha ma'lumot"></div><button class="btn">Usta qo'shish</button></form>`+
tbl(['Usta','Login','Xizmat',"Ko'rishlar",'Reyting','Amallar'],ws.map(w=>[esc(w.name),esc(w.phone),esc(w.service||''),w.views,w.rating,`<button class="btn sm" data-pw="${w.id}">Parol</button> ${del('workers/'+w.id)}`]));
$('#aw').onsubmit=e=>{e.preventDefault();act(async()=>{await api('/admin/workers','POST',fd(e));toast("Usta qo'shildi");route()})}}
if(tab==='clients'){const cs=await api('/admin/clients');tb.innerHTML=tbl(['Ism','Telefon','Buyurtmalar','Sana',''],cs.map(c=>[esc(c.name),esc(c.phone),c.orders,c.created_at.slice(0,10),del('clients/'+c.id)]))}
if(tab==='services'){const sv=await api('/services');tb.innerHTML=`<form id="as" class="card row"><input name="name" placeholder="Yangi xizmat nomi" required style="flex:1"><button class="btn">Qo'shish</button></form>`+tbl(['Xizmat',''],sv.map(s=>[esc(s.name),del('services/'+s.id)]));
$('#as').onsubmit=e=>{e.preventDefault();act(async()=>{await api('/admin/services','POST',fd(e));route()})}}}

document.addEventListener('click',e=>{const b=e.target.closest('button,a');if(!b)return;
if(b.id==='out'){e.preventDefault();localStorage.clear();tok=me=null;location.hash==='#/'?route():location.hash='#/'}
if(b.id==='burger')$('#links').classList.toggle('open');
if(b.dataset.s)act(async()=>{await api('/orders/'+b.dataset.o,'PATCH',{status:b.dataset.s});toast('Saqlandi');route()});
if(b.dataset.t){tab=b.dataset.t;route()}
if(b.dataset.del&&confirm("O'chirishni tasdiqlaysizmi?"))act(async()=>{await api('/admin/'+b.dataset.del,'DELETE');toast("O'chirildi");route()});
if(b.dataset.pw){const p=prompt('Yangi parol (kamida 6 belgi)');if(p)act(async()=>{await api(`/admin/workers/${b.dataset.pw}/password`,'PUT',{password:p});toast('Parol yangilandi')})}});
document.addEventListener('change',e=>{if(e.target.classList.contains('ss'))act(async()=>{await api('/orders/'+e.target.dataset.o,'PATCH',{status:e.target.value});toast('Holat yangilandi');route()})});
document.addEventListener('submit',e=>{if(e.target.classList.contains('rf')){e.preventDefault();act(async()=>{await api('/reviews','POST',{order_id:+e.target.dataset.o,...fd(e)});toast('Izoh qoldirildi');route()})}});
addEventListener('hashchange',route);route();
