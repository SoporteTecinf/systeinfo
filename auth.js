import jwt from 'jsonwebtoken';
export function signUser(user){return jwt.sign({id:user.id,email:user.email,role:user.role},process.env.JWT_SECRET,{expiresIn:'7d'});}
export function auth(req,res,next){
  const token=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):null;
  if(!token)return res.status(401).json({error:'Autenticación requerida'});
  try{req.user=jwt.verify(token,process.env.JWT_SECRET);next();}
  catch{return res.status(401).json({error:'Token inválido o expirado'});}
}
export function admin(req,res,next){if(req.user?.role!=='admin')return res.status(403).json({error:'Se requiere administrador'});next();}
