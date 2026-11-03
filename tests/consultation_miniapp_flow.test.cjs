// Verify actual miniapp Page handlers with mocked official code exchange.
// This is a harness, NOT a live platform call or WebRTC connection.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ROOM='f984c559-c3d1-4cea-a94e-987ec432a251';
const REQUEST='d534ac27-e01a-4211-8e29-7655cc25e3e0';
const BASE='https://prebook-api-production-9b80.up.railway.app';
const GOOD_VIDEO='https://hitel-room-production-ecce.up.railway.app/private-consultation?consultation='+ROOM;

function simulate(platform){
 const calls=[],navigation=[];
 let serverRequests=[],backendStatus='requested',backendUrl=null,postStatus=201,authStatus=200,page;
 const validProduct={id:'offer-123',name:'Example offer',brand:'Example clinic'};
 const token='server-verified-'+platform+'-session';
 const authHeader=o=>(o.header||o.headers||{}).Authorization;
 const request=opts=>{
  calls.push(opts);
  let resp;
  if(opts.url.includes('/v1/offers/offer-123')){
   resp={statusCode:200,status:200,data:{product:validProduct}};
  }else if(opts.url.endsWith('/v1/miniapp-auth/exchange')){
   assert.equal(opts.data.platform,platform);
   assert.equal(opts.data.code,platform==='wechat'?'wechat-login-code':'alipay-auth-code');
   resp={statusCode:authStatus,status:authStatus,data:
     authStatus===200?{access_token:token,platform,verified_by_provider:true}:{detail:'not enabled'}};
  }else if(opts.url.endsWith('/v1/product-consultations/mine')){
   assert.equal(authHeader(opts),'Bearer '+token);
   resp={statusCode:200,status:200,data:{requests:serverRequests.slice()}};
  }else if(opts.url.endsWith('/v1/product-consultations')&&opts.method==='POST'){
   assert.equal(authHeader(opts),'Bearer '+token);
   resp={statusCode:postStatus,status:postStatus,data:postStatus===201?{
    request_id:REQUEST,status:'requested',source:'offer',item_id:'offer-123',
    video_url:null,video_connected:false,booking_confirmed:false
   }:{detail:'disabled'}};
   if(postStatus===201)serverRequests=[resp.data];
  }else if(opts.url.endsWith('/v1/product-consultations/'+REQUEST)){
   assert.equal(authHeader(opts),'Bearer '+token);
   resp={statusCode:200,status:200,data:{
    request_id:REQUEST,status:backendStatus,source:'offer',item_id:'offer-123',
    video_url:backendUrl,video_connected:false,booking_confirmed:false
   }};
  }else throw Error('Unexpected call '+opts.url);
  opts.success?.(resp);
  opts.complete?.();
 };
 const api={request,navigateTo:o=>navigation.push(o),showToast:()=>{}};
 if(platform==='wechat')api.login=opts=>opts.success({code:'wechat-login-code'});
 else api.getAuthCode=opts=>{
  assert.equal(opts.scopes[0],'auth_base');
  opts.success({authCode:'alipay-auth-code'});
 };
 const src=fs.readFileSync('miniapps/'+platform+'/pages/consult/index.js','utf8');
 const ctx={Page:x=>{page=x},getApp:()=>({globalData:{apiBase:BASE}}),
  [platform==='wechat'?'wx':'my']:api,encodeURIComponent,Date,console};
 vm.runInNewContext(src,ctx,{filename:platform+'/consult.js'});
 const mount=()=>{
  const instance={...page,data:{...page.data}};
  instance.setData=function(update){Object.assign(this.data,update);};
  return instance;
 };
 let screen=mount();
 screen.onLoad({id:'offer-123',source:'offer'});
 assert.equal(screen.data.product.id,'offer-123');
 assert.equal(screen.data.identityToken,token);
 assert.equal(screen.data.request,null);
 assert.equal(screen.data.canOpenVideo,false);
 screen.onDateChange({detail:{value:'2027-06-10'}});
 screen.onTimeChange({detail:{value:'14:00'}});
 screen.submitRequest();
 assert.equal(screen.data.request.request_id,REQUEST);
 assert.equal(screen.data.request.booking_confirmed,false);
 assert.equal(screen.data.request.video_connected,false);
 assert.equal(screen.data.canOpenVideo,false);
 const post=calls.find(x=>x.method==='POST'&&x.url.endsWith('/v1/product-consultations'));
 assert.equal(post.data.item_id,'offer-123');
 assert.equal(post.data.platform,platform);
 assert.equal(post.data.desired_date,'2027-06-10');
 assert.equal(post.data.desired_time,'14:00');
 assert.equal((post.header||post.headers)['Content-Type'],'application/json');
 assert.equal((post.header||post.headers)['Authorization'],'Bearer '+token);
 assert.equal(Object.hasOwn(screen.data.request,'access_token'),false);
 screen.refreshStatus();
 assert.equal(screen.data.request.status,'requested');
 assert.equal(screen.data.canOpenVideo,false);
 backendStatus='ready';
 backendUrl='https://attacker.example/private-consultation?consultation='+ROOM;
 screen.refreshStatus();
 assert.equal(screen.data.canOpenVideo,false,'block external host');
 screen.openVideo();
 assert.equal(navigation.length,0);
 backendUrl=GOOD_VIDEO;
 screen.refreshStatus();
 assert.equal(screen.data.canOpenVideo,true);
 screen.openVideo();
 assert.equal(navigation.length,1);
 assert.equal(navigation[0].url,'/pages/consult/video?url='+encodeURIComponent(GOOD_VIDEO));
 // New device login rehydrates existing request from authenticated /mine.
 screen=mount();
 screen.onLoad({id:'offer-123',source:'offer'});
 assert.equal(screen.data.request.request_id,REQUEST);
 assert.equal(screen.data.canOpenVideo,true);
 const postsBefore=calls.filter(x=>x.method==='POST'&&x.url.endsWith('/v1/product-consultations')).length;
 screen.submitRequest();
 assert.equal(calls.filter(x=>x.method==='POST'&&x.url.endsWith('/v1/product-consultations')).length,postsBefore);
 // Provider login failure: no application request can be submitted.
 serverRequests=[];authStatus=503;
 screen=mount();
 screen.onLoad({id:'offer-123',source:'offer'});
 assert.equal(screen.data.identityToken,'');
 screen.submitRequest();
 assert.equal(screen.data.request,null);
 assert.equal(calls.filter(x=>x.method==='POST'&&x.url.endsWith('/v1/product-consultations')).length,postsBefore);
 assert.match(screen.data.error,/尚未开放/);
 // Logged in but consultation service disabled: must not show success.
 authStatus=200;postStatus=503;
 screen=mount();screen.onLoad({id:'offer-123',source:'offer'});
 screen.submitRequest();
 assert.equal(screen.data.request,null);
 assert.match(screen.data.error,/未确认成功/);
 return platform+': pass ('+calls.length+' mocked calls)';
}
for(const p of ['wechat','alipay'])console.log(simulate(p));
