import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import {pool} from './db.js';
import {auth,admin,signUser} from './auth.js';

const app=express();
app.use(cors());
app.use(express.json());

app.get('/api/health',(req,res)=>res.json({ok:true,service:'NovaMarket API'}));

app.get('/api/categories',async(req,res)=>{
  const {rows}=await pool.query('SELECT id,name,slug FROM categories ORDER BY name');
  res.json(rows);
});

app.get('/api/products',async(req,res)=>{
  const q=String(req.query.q||'');
  const cat=String(req.query.category||'');
  const {rows}=await pool.query(`
    SELECT p.*, c.name AS category
    FROM products p LEFT JOIN categories c ON c.id=p.category_id
    WHERE p.active=true
      AND ($1='' OR p.name ILIKE '%'||$1||'%' OR p.description ILIKE '%'||$1||'%')
      AND ($2='' OR c.slug=$2)
    ORDER BY p.id DESC`,[q,cat]);
  res.json(rows);
});

app.post('/api/auth/register',async(req,res)=>{
  const {name,email,password}=req.body;
  if(!name||!email||!password||password.length<8)return res.status(400).json({error:'Nombre, email y contraseña de al menos 8 caracteres son requeridos'});
  try{
    const hash=await bcrypt.hash(password,12);
    const {rows} = await pool.query(
      'INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,role',
      [name,email.toLowerCase(),hash]
    );
    res.status(201).json({user:rows[0],token:signUser(rows[0])});
  }catch(e){res.status(409).json({error:'El correo ya está registrado'});}
});

app.post('/api/auth/login',async(req,res)=>{
  const {email,password}=req.body;
  const {rows}=await pool.query('SELECT * FROM users WHERE email=$1',[String(email||'').toLowerCase()]);
  if(!rows[0]||!(await bcrypt.compare(password||'',rows[0].password_hash)))return res.status(401).json({error:'Credenciales incorrectas'});
  const u={id:rows[0].id,name:rows[0].name,email:rows[0].email,role:rows[0].role};
  res.json({user:u,token:signUser(u)});
});

app.get('/api/me',auth,async(req,res)=>{
  const {rows}=await pool.query('SELECT id,name,email,role,created_at FROM users WHERE id=$1',[req.user.id]);
  res.json(rows[0]);
});

app.post('/api/orders',auth,async(req,res)=>{
  const {items,shipping_address}=req.body;
  if(!Array.isArray(items)||!items.length||!shipping_address)return res.status(400).json({error:'Pedido incompleto'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    let total=0, normalized=[];
    for(const item of items){
      const {rows}=await client.query('SELECT id,name,price,stock FROM products WHERE id=$1 AND active=true FOR UPDATE',[item.product_id]);
      const p=rows[0], qty=Number(item.quantity);
      if(!p||!Number.isInteger(qty)||qty<1||p.stock<qty)throw new Error(`Producto sin stock suficiente: ${p?.name||item.product_id}`);
      total+=Number(p.price)*qty; normalized.push({product_id:p.id,quantity:qty,unit_price:p.price});
    }
    const order=(await client.query(
      'INSERT INTO orders(user_id,total,shipping_address) VALUES($1,$2,$3) RETURNING id,status,total,payment_status',
      [req.user.id,total,JSON.stringify(shipping_address)]
    )).rows[0];
    for(const i of normalized){
      await client.query('INSERT INTO order_items(order_id,product_id,quantity,unit_price) VALUES($1,$2,$3,$4)',[order.id,i.product_id,i.quantity,i.unit_price]);
      await client.query('UPDATE products SET stock=stock-$1 WHERE id=$2',[i.quantity,i.product_id]);
    }
    await client.query('COMMIT');
    res.status(201).json(order);
  }catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message});}
  finally{client.release();}
});

app.get('/api/admin/orders',auth,admin,async(req,res)=>{
  const {rows}=await pool.query(`SELECT o.*,u.name,u.email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC`);
  res.json(rows);
});

app.post('/api/admin/products',auth,admin,async(req,res)=>{
  const {category_id,name,description,price,stock,image_url}=req.body;
  const {rows}=await pool.query(
    `INSERT INTO products(category_id,name,description,price,stock,image_url) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [category_id,name,description||'',price,stock||0,image_url||'']);
  res.status(201).json(rows[0]);
});

app.patch('/api/admin/products/:id',auth,admin,async(req,res)=>{
  const allowed=['name','description','price','stock','image_url','active','category_id'];
  const keys=Object.keys(req.body).filter(k=>allowed.includes(k));
  if(!keys.length)return res.status(400).json({error:'No hay cambios'});
  const vals=keys.map(k=>req.body[k]);
  const set=keys.map((k,i)=>`${k}=$${i+1}`).join(',');
  vals.push(req.params.id);
  const {rows}=await pool.query(`UPDATE products SET ${set} WHERE id=$${vals.length} RETURNING *`,vals);
  res.json(rows[0]);
});

app.post('/api/payments/create-checkout-session',auth,async(req,res)=>{
  // Punto de integración: aquí se crea una sesión de Stripe.
  // No se cobran tarjetas desde este código de demo.
  res.status(501).json({error:'Conectar Stripe antes de activar pagos reales.'});
});

const port=process.env.PORT||3000;
app.listen(port,()=>console.log(`NovaMarket API: http://localhost:${port}`));
