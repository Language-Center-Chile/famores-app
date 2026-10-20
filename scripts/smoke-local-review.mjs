import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const child=spawn(process.execPath,['scripts/dev-review.mjs'],{stdio:['ignore','pipe','pipe']});
let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
const request=(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(5000)});
try{
  for(let n=0;n<100&&!log.includes('Ctrl+C para terminar.');n++){
    if(child.exitCode!==null)throw new Error(log);
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  const base=/DEMO LOCAL: (http:\/\/127\.0\.0\.1:\d+)/.exec(log)?.[1];
  assert(base,'Demo did not initialize: '+log);
  for(const [role,path] of [['buyer','/mi-cuenta'],['seller','/panel'],['admin','/panel']]){
    const login=await request(base+'/api/account/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email:role+'@example.test',password:'FamoresLocal2026!'}),redirect:'manual'});
    assert.equal(login.status,303);const cookie=login.headers.get('set-cookie').split(';')[0];
    const response=await request(base+path,{headers:{Cookie:cookie}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const html=await response.text();assert(html.includes('DEMO5'));
    if(role==='buyer'){
      assert(html.includes('Cupones disponibles'));assert(html.includes('/comprar?coupon=DEMO5'));
      assert(html.includes('DEMO-PEDIDO-001'));assert(!html.includes('Comisiones por ventas pagadas'));
    }
    console.log(role+' login and private dashboard passed');
  }
  const quote=await request(base+'/api/cart/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[{product:'Kit Pro pintado',quantity:1}],courier:'retiro',couponCode:'DEMO5'})});
  const data=await quote.json();assert.equal(data.subtotal,69170);assert.equal(data.total,65711);assert.equal(data.commission,5522);
  const pay=await request(base+'/api/flow/create-cart-payment',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(pay.status,503);
  console.log('Local demo passed: Pro $69.170, DEMO5, commission $5.522, payments disabled.');
}catch(error){console.error(log);throw error;}
finally{
  if(child.exitCode===null){const done=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await done;}
}
