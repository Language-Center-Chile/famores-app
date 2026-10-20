import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync } from 'node:crypto';
import { createServer } from 'node:net';
import { DatabaseSync } from 'node:sqlite';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const freePort=port=>new Promise(resolve=>{
  const server=createServer();server.once('error',()=>resolve(false));
  server.listen(port,'127.0.0.1',()=>server.close(()=>resolve(true)));
});
let port=3000;
while(port<3010 && !await freePort(port))port++;
if(!await freePort(port))throw new Error('No hay un puerto libre entre 3000 y 3010.');
const base=`http://127.0.0.1:${port}`;
const directory=mkdtempSync(join(tmpdir(),'famores-review-'));
const path=join(directory,'commerce.sqlite');
const password='FamoresLocal2026!'; // Fictitious, temporary accounts only.
const salt=randomBytes(16).toString('hex');
const passwordHash=`scrypt:${salt}:${scryptSync(password,salt,64).toString('hex')}`;
const accounts=['admin','seller'].map(role=>({id:'demo-'+role,role,name:'Demo '+role,email:role+'@example.test',passwordHash}));
const astroPackage=JSON.parse(readFileSync(join(root,'node_modules/astro/package.json'),'utf8'));
const bin=typeof astroPackage.bin==='string'?astroPackage.bin:astroPackage.bin.astro;
const child=spawn(process.execPath,[join(root,'node_modules/astro',bin),'dev','--ignore-lock','--host','127.0.0.1','--port',String(port)],{
  cwd:root,stdio:'inherit',env:{...process.env,PUBLIC_SITE_URL:base,FAMORES_LOCAL_REVIEW:'1',
    FAMORES_DB_PATH:path,FAMORES_ACCOUNTS_JSON:JSON.stringify(accounts),FLOW_API_KEY:'',FLOW_SECRET_KEY:'',
    FAMORES_NOTIFICATION_WEBHOOK:'',FAMORES_NOTIFICATION_TOKEN:'',FAMORES_ACCOUNT_MAIL_WEBHOOK:'',FAMORES_ACCOUNT_MAIL_TOKEN:''}
});
const cleanup=()=>{try{rmSync(directory,{recursive:true,force:true});}catch{}};
child.on('error',error=>{cleanup();console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{cleanup();process.exitCode=code||0;});
process.once('SIGINT',()=>child.kill('SIGINT'));process.once('SIGTERM',()=>child.kill('SIGTERM'));
try{
  let ready=false;
  for(let n=0;n<80;n++){
    if(child.exitCode!==null)throw new Error('El servidor local se detuvo.');
    try{const r=await fetch(base+'/api/cart/quote',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({items:[{product:'Set Standard Pintado',quantity:1}],courier:'retiro',couponCode:'INITIALIZE'}),signal:AbortSignal.timeout(1000)});
      if(r.status===400){ready=true;break;}
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!ready)throw new Error('No fue posible iniciar la demo local.');
  const db=new DatabaseSync(path);const now=Date.now();
  db.prepare('INSERT INTO customers(id,email,name,passwordHash,verifiedAt,createdAt) VALUES(?,?,?,?,?,?)')
    .run('demo-buyer','buyer@example.test','Comprador de prueba',passwordHash,now,now);
  db.prepare('INSERT INTO coupons(code,sellerId,kind,value,expiresAt,maxUses,active,commissionBps,publicListing) VALUES(?,?,?,?,?,?,?,?,?)')
    .run('DEMO5','demo-seller','percent',5,now+86400000,100,1,1000,1);
  db.prepare('INSERT INTO orders(id,sellerId,couponCode,discount,total,status,createdAt,details,buyerId,commission) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run('DEMO-PEDIDO-001','demo-seller','DEMO5',2400,45600,2,now,JSON.stringify({demo:true,items:[{product:'Set Standard Pintado',quantity:1}]}),'demo-buyer',3832);
  db.close();
  console.log(`\nDEMO LOCAL: ${base}\nComprar: ${base}/comprar\nIngresar: ${base}/ingresar\nMi cuenta: ${base}/mi-cuenta\nPanel vendedor/admin: ${base}/panel`);
  console.log(`Cuentas ficticias: buyer@example.test / seller@example.test / admin@example.test\nContraseña de prueba para las tres: ${password}\nCupón publicado: DEMO5 (5%). Comisión vendedor: 10% del neto descontado.\nDatos temporales; pagos y correo deshabilitados. Ctrl+C para terminar.\n`);
}catch(error){console.error(error.message);process.exitCode=1;child.kill('SIGTERM');}
