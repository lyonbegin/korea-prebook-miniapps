const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const BASE='https://prebook-keyless-consult-demo-production.up.railway.app';
const ROOM='f984c559-c3d1-4cea-a94e-987ec432a251';
const REQUEST='d534ac27-e01a-4211-8e29-7655cc25e3e0';
const PRODUCTS=[
 {id:'demo-skin-a',name:'皮肤护理体验 A · 데모',provider:'테스트 상품',category:'skin',counselor_id:'counselor-demo-1',price_krw:80000},
 {id:'demo-skin-b',name:'皮肤护理体验 B · 데모',provider:'테스트 상품',category:'skin',counselor_id:'counselor-demo-1',price_krw:120000},
 {id:'demo-cosmetics',name:'韩国化妆品 · 데모',provider:'테스트 상품',category:'cosmetics',counselor_id:'counselor-demo-3',price_krw:19000}
];
for(const platform of ['wechat','alipay']){
 const files=[],calls=[],nav=[],storage=new Map();
 let row=null,activeStatus='requested',videoPath=null;
 const api={
  navigateTo:o=>nav.push(o),navigateBack:()=>{},
  showToast:()=>{},
  getStorageSync:platform==='wechat'?key=>storage.get(key):({key})=>({data:storage.get(key)}),
  setStorageSync:platform==='wechat'?(key,value)=>storage.set(key,value):({key,data})=>storage.set(key,data),
  request:opts=>{
   calls.push({url:opts.url,method:opts.method});
   let response;
   if(opts.url===BASE+'/demo/api/products'){
    response={statusCode:200,status:200,data:{demo:true,products:PRODUCTS}};
   }else if(opts.url.startsWith(BASE+'/demo/api/products/')){
    const id=opts.url.split('/').pop(),p=PRODUCTS.find(x=>x.id===id);
    response=p?{statusCode:200,status:200,data:{
     product:{id:p.id,name:p.name,brand:p.provider,source:p.category==='cosmetics'?'cosmetics':'offer',
      currency:'KRW',price:p.price_krw,image:'',soldOut:false},
     images:[],description:{summary:'테스트'},options:[]}}:
     {statusCode:404,status:404,data:{}};
   }else if(opts.url===BASE+'/demo/api/consultations'&&opts.method==='POST'){
    assert.equal(opts.data.platform,platform);
    assert.equal(opts.data.item_id,'demo-skin-a');
    row={id:REQUEST,item_id:'demo-skin-a',platform,status:'requested',
     room_id:null,customer_room_url:null,booking_confirmed:false,video_connected:false};
    response={statusCode:201,status:201,data:row};
   }else if(opts.url===BASE+'/demo/api/consultations/'+REQUEST){
    response={statusCode:200,status:200,data:{...row,status:activeStatus,
      room_id:activeStatus==='ready'?ROOM:null,customer_room_url:videoPath}};
   }else throw Error('unexpected request '+opts.url);
   opts.success?.(response);opts.complete?.();
  }
 };
 const globalData={apiBase:BASE,demoMode:true};
 function pageAt(path){
  let page;
  const source=fs.readFileSync('miniapps/'+platform+'/pages/'+path,'utf8');
  const ctx={Page:o=>{page=o},[platform==='wechat'?'wx':'my']:api,
   getApp:()=>({globalData}),encodeURIComponent,decodeURIComponent,clearInterval,
   setInterval:()=>0,console};
  vm.runInNewContext(source,ctx,{filename:path});
  assert(page,'Page was not declared in '+path);
  const instance={...page,data:{...page.data}};
  instance.setData=function(change){Object.assign(this.data,change)};
  return instance;
 }
 const listing=pageAt('index/index.js');
 listing.onLoad({category:'all'});
 assert.equal(listing.data.visibleProducts.length,3);
 listing.onCategoryTap({currentTarget:{dataset:{id:'skin'}}});
 assert.equal(listing.data.visibleProducts.length,2);
 listing.onProductTap({currentTarget:{dataset:{id:'demo-skin-a',source:'offer'}}});
 assert.match(nav.at(-1).url,/\/pages\/shop\/detail/);
 const detail=pageAt('shop/detail.js');
 detail.onLoad({id:'demo-skin-a',source:'offer',lang:'zh_cn'});
 assert.equal(detail.data.product.id,'demo-skin-a');
 detail.onConsult();
 assert.match(nav.at(-1).url,/\/pages\/consult\/index/);
 let consult=pageAt('consult/index.js');
 consult.onLoad({id:'demo-skin-a',source:'offer'});
 assert.equal(consult.data.product.id,'demo-skin-a');
 assert.equal(consult.data.request,null);
 consult.onDateChange({detail:{value:'2027-06-10'}});
 consult.onTimeChange({detail:{value:'14:00'}});
 consult.submitRequest();
 assert.equal(consult.data.request.id,REQUEST);
 assert.equal(consult.data.request.booking_confirmed,false);
 assert.equal(storage.size,1);
 consult.refreshStatus();
 assert.equal(consult.data.canOpenVideo,false);
 activeStatus='ready';
 videoPath='/demo/rooms/'+ROOM+'?role=counselor';
 consult.refreshStatus();
 assert.equal(consult.data.canOpenVideo,false,'wrong role must be blocked');
 videoPath='/demo/rooms/'+ROOM+'?role=customer';
 consult.refreshStatus();
 assert.equal(consult.data.canOpenVideo,true);
 consult.openVideo();
 assert.equal(nav.at(-1).url,
  '/pages/consult/video?url='+encodeURIComponent(BASE+videoPath));
 const video=pageAt('consult/video.js');
 video.onLoad({url:encodeURIComponent(BASE+videoPath)});
 assert.equal(video.data.url,BASE+videoPath);
 const malicious=pageAt('consult/video.js');
 malicious.onLoad({url:encodeURIComponent('https://attacker.invalid/demo/rooms/'+ROOM+'?role=customer')});
 assert.equal(malicious.data.url,'');
 assert.ok(malicious.data.error);
 consult=pageAt('consult/index.js');
 consult.onLoad({id:'demo-skin-a',source:'offer'});
 assert.equal(consult.data.request.id,REQUEST);
 assert.equal(consult.data.canOpenVideo,true);
 const submits=calls.filter(x=>x.method==='POST').length;
 consult.submitRequest();
 assert.equal(calls.filter(x=>x.method==='POST').length,submits);
 console.log(platform+': native list > detail > request > room > reopen tested ('+calls.length+' HTTP mocks)');
}
