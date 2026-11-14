require('dotenv').config();
const express=require('express'),cors=require('cors'),{Pool}=require('pg'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='false'?false:{rejectUnauthorized:false}});
const SECRET=process.env.JWT_SECRET||'ozgartiring',L=['new','accepted','done','rejected','cancelled'];
const q=(s,p)=>pool.query(s,p).then(r=>r.rows);
const h=f=>(req,res)=>f(req,res).catch(e=>{console.error(e);res.status(500).json({error:'Server xatosi'})});
const bad=(res,m,c=400)=>res.status(c).json({error:m});
const ph=s=>String(s||'').replace(/[^\d+]/g,'');
const app=express();app.use(cors({origin:process.env.CORS_ORIGIN||'*'}),express.json());
const auth=(...roles)=>(req,res,next)=>{try{req.user=jwt.verify((req.headers.authorization||'').slice(7),SECRET)}catch{return bad(res,'Avval tizimga kiring',401)}
if(roles.length&&!roles.includes(req.user.role))return bad(res,"Ruxsat yo'q",403);next()};
const sign=u=>({token:jwt.sign({id:u.id,role:u.role},SECRET,{expiresIn:'30d'}),user:{id:u.id,name:u.name,phone:u.phone,role:u.role}});
const SCHEMA=`
CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY,name TEXT NOT NULL,phone TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'client',created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS services(id SERIAL PRIMARY KEY,name TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS workers(id SERIAL PRIMARY KEY,user_id INT UNIQUE REFERENCES users ON DELETE CASCADE,service_id INT REFERENCES services ON DELETE SET NULL,bio TEXT DEFAULT '',experience INT DEFAULT 0,price INT DEFAULT 0,city TEXT DEFAULT '',views INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS orders(id SERIAL PRIMARY KEY,client_id INT REFERENCES users ON DELETE CASCADE,worker_id INT REFERENCES workers ON DELETE CASCADE,address TEXT NOT NULL,note TEXT DEFAULT '',date DATE,status TEXT DEFAULT 'new',created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS reviews(id SERIAL PRIMARY KEY,order_id INT UNIQUE REFERENCES orders ON DELETE CASCADE,worker_id INT REFERENCES workers ON DELETE CASCADE,client_id INT REFERENCES users ON DELETE CASCADE,rating INT CHECK(rating BETWEEN 1 AND 5),comment TEXT DEFAULT '',created_at TIMESTAMPTZ DEFAULT now());`;
const W=`SELECT w.id,u.name,w.service_id,s.name service,w.bio,w.experience,w.price,w.city,w.views,COALESCE(ROUND(AVG(r.rating),1),0)::float rating,COUNT(r.id)::int review_count FROM workers w JOIN users u ON u.id=w.user_id LEFT JOIN services s ON s.id=w.service_id LEFT JOIN reviews r ON r.worker_id=w.id`,G=' GROUP BY w.id,u.id,s.id';
const O=`SELECT o.id,o.client_id,o.worker_id,o.address,o.note,o.status,to_char(o.date,'YYYY-MM-DD') date,o.created_at,cu.name client_name,cu.phone client_phone,wu.name worker_name,wu.phone worker_phone,s.name service,(r.id IS NOT NULL) reviewed FROM orders o JOIN users cu ON cu.id=o.client_id JOIN workers w ON w.id=o.worker_id JOIN users wu ON wu.id=w.user_id LEFT JOIN services s ON s.id=w.service_id LEFT JOIN reviews r ON r.order_id=o.id`;

app.get('/',(req,res)=>res.json({ok:1}));
app.post('/api/auth/register',h(async(req,res)=>{const{name,password}=req.body,phone=ph(req.body.phone);
if(!name||phone.length<9||!password||password.length<6)return bad(res,'Ism, telefon va kamida 6 belgili parol kiriting');
if((await q('SELECT 1 FROM users WHERE phone=$1',[phone])).length)return bad(res,'Bu telefon raqam band');
const[u]=await q('INSERT INTO users(name,phone,password) VALUES($1,$2,$3) RETURNING *',[name.trim(),phone,await bcrypt.hash(password,10)]);res.json(sign(u))}));
app.post('/api/auth/login',h(async(req,res)=>{const[u]=await q('SELECT * FROM users WHERE phone=$1',[ph(req.body.phone)]);
if(!u||!await bcrypt.compare(req.body.password||'',u.password))return bad(res,"Telefon yoki parol noto'g'ri",401);res.json(sign(u))}));
app.get('/api/services',h(async(req,res)=>res.json(await q('SELECT * FROM services ORDER BY id'))));
app.get('/api/workers',h(async(req,res)=>{const{s,q:t}=req.query,p=[],c=[];
if(s){p.push(+s);c.push(`w.service_id=$${p.length}`)}
if(t){p.push('%'+t+'%');c.push(`(u.name ILIKE $${p.length} OR s.name ILIKE $${p.length})`)}
res.json(await q(W+(c.length?' WHERE '+c.join(' AND '):'')+G+' ORDER BY rating DESC,w.views DESC',p))}));
app.get('/api/workers/:id',h(async(req,res)=>{await q('UPDATE workers SET views=views+1 WHERE id=$1',[+req.params.id]);
const[w]=await q(W+' WHERE w.id=$1'+G,[+req.params.id]);if(!w)return bad(res,'Usta topilmadi',404);
w.reviews=await q('SELECT r.rating,r.comment,r.created_at,u.name client_name FROM reviews r JOIN users u ON u.id=r.client_id WHERE r.worker_id=$1 ORDER BY r.id DESC',[w.id]);res.json(w)}));

app.post('/api/orders',auth('client'),h(async(req,res)=>{const{worker_id,address,note,date}=req.body;
if(!worker_id||!address)return bad(res,'Manzilni kiriting');
if(!(await q('SELECT 1 FROM workers WHERE id=$1',[worker_id])).length)return bad(res,'Usta topilmadi',404);
const[o]=await q('INSERT INTO orders(client_id,worker_id,address,note,date) VALUES($1,$2,$3,$4,$5) RETURNING id',[req.user.id,worker_id,address,note||'',date||null]);res.json(o)}));
app.get('/api/orders',auth(),h(async(req,res)=>{const{id,role}=req.user;
const w=role==='client'?' WHERE o.client_id=$1':role==='worker'?' WHERE w.user_id=$1':'';
res.json(await q(O+w+' ORDER BY o.id DESC',w?[id]:[]))}));
app.patch('/api/orders/:id',auth(),h(async(req,res)=>{const{id,role}=req.user,st=req.body.status;
const[o]=await q(O+' WHERE o.id=$1',[+req.params.id]);if(!o)return bad(res,'Topilmadi',404);
const own=(await q('SELECT 1 FROM workers WHERE id=$1 AND user_id=$2',[o.worker_id,id])).length>0;
const ok={client:o.client_id===id&&st==='cancelled'&&o.status==='new',worker:own&&['accepted','rejected','done'].includes(st),admin:L.includes(st)}[role];
if(!ok)return bad(res,"Bu amalga ruxsat yo'q",403);
await q('UPDATE orders SET status=$1 WHERE id=$2',[st,o.id]);res.json({ok:1})}));
app.post('/api/reviews',auth('client'),h(async(req,res)=>{const{order_id,rating,comment}=req.body;
const[o]=await q("SELECT * FROM orders WHERE id=$1 AND client_id=$2 AND status='done'",[order_id,req.user.id]);
if(!o)return bad(res,'Izoh faqat bajarilgan buyurtmaga yoziladi');
await q('INSERT INTO reviews(order_id,worker_id,client_id,rating,comment) VALUES($1,$2,$3,$4,$5) ON CONFLICT(order_id) DO NOTHING',[o.id,o.worker_id,req.user.id,Math.min(5,Math.max(1,+rating||5)),comment||'']);res.json({ok:1})}));

app.get('/api/worker/me',auth('worker'),h(async(req,res)=>res.json((await q(W+' WHERE w.user_id=$1'+G,[req.user.id]))[0])));
app.put('/api/worker/me',auth('worker'),h(async(req,res)=>{const{bio,experience,price,city}=req.body;
await q('UPDATE workers SET bio=$1,experience=$2,price=$3,city=$4 WHERE user_id=$5',[bio||'',+experience||0,+price||0,city||'',req.user.id]);res.json({ok:1})}));

const A=auth('admin');
app.get('/api/admin/stats',A,h(async(req,res)=>res.json((await q(`SELECT (SELECT COUNT(*) FROM users WHERE role='client')::int clients,(SELECT COUNT(*) FROM workers)::int workers,(SELECT COUNT(*) FROM services)::int services,(SELECT COUNT(*) FROM orders)::int orders,(SELECT COUNT(*) FROM orders WHERE status='new')::int new_orders,(SELECT COUNT(*) FROM orders WHERE status='done')::int done_orders,(SELECT COALESCE(SUM(views),0) FROM workers)::int views,(SELECT COALESCE(ROUND(AVG(rating),1),0)::float FROM reviews) rating`))[0])));
app.get('/api/admin/workers',A,h(async(req,res)=>res.json(await q(W.replace('u.name,','u.name,u.phone,(SELECT COUNT(*) FROM orders WHERE worker_id=w.id)::int orders,')+G+' ORDER BY w.id DESC'))));
app.get('/api/admin/clients',A,h(async(req,res)=>res.json(await q("SELECT id,name,phone,created_at,(SELECT COUNT(*) FROM orders WHERE client_id=users.id)::int orders FROM users WHERE role='client' ORDER BY id DESC"))));
app.post('/api/admin/workers',A,h(async(req,res)=>{const{name,password,service_id,bio,experience,price,city}=req.body,phone=ph(req.body.phone);
if(!name||phone.length<9||!password||password.length<6||!service_id)return bad(res,"Barcha maydonlarni to'ldiring (parol kamida 6 belgi)");
if((await q('SELECT 1 FROM users WHERE phone=$1',[phone])).length)return bad(res,'Bu telefon raqam band');
const[u]=await q("INSERT INTO users(name,phone,password,role) VALUES($1,$2,$3,'worker') RETURNING id",[name.trim(),phone,await bcrypt.hash(password,10)]);
await q('INSERT INTO workers(user_id,service_id,bio,experience,price,city) VALUES($1,$2,$3,$4,$5,$6)',[u.id,service_id,bio||'',+experience||0,+price||0,city||'']);res.json({ok:1})}));
app.put('/api/admin/workers/:id/password',A,h(async(req,res)=>{const p=req.body.password||'';if(p.length<6)return bad(res,'Parol kamida 6 belgi');
await q('UPDATE users SET password=$1 WHERE id=(SELECT user_id FROM workers WHERE id=$2)',[await bcrypt.hash(p,10),+req.params.id]);res.json({ok:1})}));
app.post('/api/admin/services',A,h(async(req,res)=>{const n=(req.body.name||'').trim();if(!n)return bad(res,'Nom kiriting');
await q('INSERT INTO services(name) VALUES($1) ON CONFLICT DO NOTHING',[n]);res.json({ok:1})}));
const D={workers:'DELETE FROM users WHERE id=(SELECT user_id FROM workers WHERE id=$1)',clients:"DELETE FROM users WHERE id=$1 AND role='client'",services:'DELETE FROM services WHERE id=$1'};
app.delete('/api/admin/:t/:id',A,h(async(req,res)=>{if(!D[req.params.t])return bad(res,'Topilmadi',404);await q(D[req.params.t],[+req.params.id]);res.json({ok:1})}));

(async()=>{await q(SCHEMA);
for(const s of ['Moto ustalari','Kunlik ishchilar','Jatkichilar','Malyarkachilar','Elektriklar','Santexniklar','Duradgorlar','Payvandchilar'])await q('INSERT INTO services(name) VALUES($1) ON CONFLICT DO NOTHING',[s]);
await q("INSERT INTO users(name,phone,password,role) VALUES('Admin',$1,$2,'admin') ON CONFLICT DO NOTHING",[ph(process.env.ADMIN_PHONE||'+998900000000'),await bcrypt.hash(process.env.ADMIN_PASSWORD||'admin123',10)]);
app.listen(process.env.PORT||4000,()=>console.log('API tayyor'))})().catch(e=>{console.error(e);process.exit(1)});
