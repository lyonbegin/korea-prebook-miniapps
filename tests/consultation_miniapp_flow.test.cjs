// End-to-end miniapp page-contract simulation (no live user, booking, or payment).
// Tests the same JS Page handlers used by both native miniapp packages.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const ROOM='f984c559-c3d1-4cea-a94e-987ec432a251';
const REQUEST='d534ac27-e01a-4211-8e29-7655cc25e3e0';
const BASE='https://prebook-api-production-9b80.up.railway.app';
const GOOD_VIDEO='https://hitel-room-production-ecce.up.railway.app/private-consultation?consultation='+ROOM;

function simulate(platform){
 const storage=new Map();
 const calls=[];
 const navigation=[];
 let backendStatus='requested';
 let backendUrl=null;
 let httpStatus=201;
 let page;
 const validProduct={id:'offer-123',name:'Real example offer',brand:'Example clinic'};
 const request = opts=>{
  calls.push(opts);
  let response;
  if(opts.url.includes('/v1/offers/offer-123')){
   response={statusCode:200,status:200,data:{product:validProduct}};
  } else if(opts.url.endsWith('/v1/product-consultations')&&opts.method==='POST'){
   response={statusCode:httpStatus,status:httpStatus,
     data:httpStatus===201?{
      request_id:REQUEST,access_token:'client-secret-not-in-url',
      status:'requested',source:'offer',item_id:'offer-123',
      video_url:null,video_connected:false,booking_confirmed:false
     }:{detail:'disabled'}};
  } else if(opts.url.endsWith('/v1/product-consultations/'+REQUEST)&&opts.method==='GET'){
   response={statusCode:200,status:200,data:{
    request_id:REQUEST,status:backendStatus,source:'offer',item_id:'offer-123',
    video_url:backendUrl,video_connected:false,booking_confirmed:false
   }};
  } else {
   throw new Error('Unexpected request URL: '+opts.url);
  }
  opts.success?.(response);
  opts.complete?.();
 };
 const api={request,navigateTo:x=>navigation.push(x)};
 if(platform==='wechat'){
  api.getStorageSync=k=>storage.get(k);
  api.setStorageSync=(k,v)=>storage.set(k,v);
  api.showToast=()=>{};
 } else {
  api.getStorageSync=({key})=>({data:storage.get(key)});
  api.setStorageSync=({key,data})=>storage.set(key,data);
  api.showToast=()=>{};
 }
 const src=fs.readFileSync('miniapps/'+platform+'/pages/consult/index.js','utf8');
 const context={Page:x=>{page=x},getApp:()=>({globalData:{apiBase:BASE}}),
    [platform==='wechat'?'wx':'my']:api,encodeURIComponent,Date,console};
 vm.runInNewContext(src,context,{filename:platform+'/pages/consult/index.js'});
 const mount=()=>{
  const instance={...page,data:{...page.data}};
  instance.setData=function(update){Object.assign(this.data,update);};
  return instance;
 };
 let screen=mount();
 screen.onLoad({id:'offer-123',source:'offer'});
 assert.equal(screen.data.product.id,'offer-123');
 assert.equal(screen.data.request,null);
 assert.equal(screen.data.canOpenVideo,false);
 screen.onDateChange({detail:{value:'2027-06-10'}});
 screen.onTimeChange({detail:{value:'14:00'}});
 screen.submitRequest();
 assert.equal(screen.data.request.request_id,REQUEST);
 assert.equal(screen.data.request.booking_confirmed,false);
 assert.equal(screen.data.request.video_connected,false);
 assert.equal(screen.data.canOpenVideo,false);
 const post=calls.find(x=>x.method==='POST');
 assert.equal(post.data.item_id,'offer-123');
 assert.equal(post.data.platform,platform);
 assert.equal(post.data.desired_date,'2027-06-10');
 assert.equal(post.data.desired_time,'14:00');
 assert.equal(platform==='wechat'?post.header['Content-Type']:post.headers['Content-Type'],'application/json');
 assert.equal(storage.size,1);
 screen.refreshStatus();
 assert.equal(screen.data.request.status,'requested');
 assert.equal(screen.data.canOpenVideo,false);
 const get=calls.find(x=>x.method==='GET'&&x.url.endsWith('/'+REQUEST));
 assert.equal(platform==='wechat'?get.header['X-Consultation-Token']:get.headers['X-Consultation-Token'],'client-secret-not-in-url');
 backendStatus='ready';
 backendUrl='https://attacker.example/private-consultation?consultation='+ROOM;
 screen.refreshStatus();
 assert.equal(screen.data.canOpenVideo,false,'must reject foreign website');
 screen.openVideo();
 assert.equal(navigation.length,0);
 backendUrl=GOOD_VIDEO;
 screen.refreshStatus();
 assert.equal(screen.data.canOpenVideo,true,'ready only for permitted URL');
 screen.openVideo();
 assert.equal(navigation.length,1);
 assert.equal(navigation[0].url,'/pages/consult/video?url='+encodeURIComponent(GOOD_VIDEO));
 // Page reopen must resume existing request and not POST a duplicate request.
 screen=mount();
 screen.onLoad({id:'offer-123',source:'offer'});
 assert.equal(screen.data.request.request_id,REQUEST);
 assert.equal(screen.data.canOpenVideo,true);
 const postsBefore=calls.filter(x=>x.method==='POST').length;
 screen.submitRequest();
 assert.equal(calls.filter(x=>x.method==='POST').length,postsBefore);
 // 503 must not create a phantom request.
 httpStatus=503;
 // Clear saved credentials to exercise a disabled-service response.
 storage.clear();
 screen=mount();
 screen.onLoad({id:'offer-123',source:'offer'});
 screen.submitRequest();
 assert.equal(screen.data.request,null);
 assert.match(screen.data.error,/尚未开放/);
 assert.equal(storage.size,0);
 return platform+': success ('+calls.length+' mocked API calls)';
}

for(const platform of ['wechat','alipay'])console.log(simulate(platform));
