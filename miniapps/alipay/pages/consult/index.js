// This page submits a real server-side request, never claims a video call started.
const A=my;
const PLATFORM='alipay';
const LINK_PATTERN=/^https:\/\/hitel-room-production-ecce\.up\.railway\.app\/private-consultation\?consultation=[0-9a-f-]{36}$/i;
function keyFor(source,id){return 'korea_prebook_consultation_'+PLATFORM+'_'+source+'_'+id;}
function read(key){try{return A.getStorageSync({key:key}).data||null;}catch(e){return null;}}
function write(key,value){A.setStorageSync({key:key,data:value});}
function notify(message){A.showToast({content:message,type:'none'});}
Page({
 data:{id:'',source:'offer',product:null,loading:true,error:'',
   day:'',time:'',submitting:false,refreshing:false,request:null,
   statusText:'',canOpenVideo:false},
 onLoad(query){
  const id=String(query.id||''),source=query.source==='cosmetics'?'cosmetics':'offer';
  if(!/^[A-Za-z0-9_-]{2,60}$/.test(id)){
   this.setData({loading:false,error:'商品编号无效'});return;
  }
  this.setData({id,source});this.load();
  const saved=read(keyFor(source,id));
  if(saved&&saved.request_id&&saved.access_token){
   this.setData({request:{request_id:saved.request_id,access_token:saved.access_token}});
   this.refreshStatus();
  }
 },
 load(){
  const base=getApp().globalData.apiBase;
  const url=this.data.source==='offer'?base+'/v1/offers/'+encodeURIComponent(this.data.id):
   base+'/v1/ktaxback/miniapp/products/'+encodeURIComponent(this.data.id)+'?lang=zh_cn';
  A.request({url,method:'GET',dataType:'json',
   success:(r)=>{
    if((r.statusCode||r.status)===200&&r.data&&r.data.product){
     this.setData({product:r.data.product,loading:false,error:''});
    }else this.setData({loading:false,error:'目前无法读取商品信息'});
   },
   fail:()=>this.setData({loading:false,error:'目前无法读取商品信息'})
  });
 },
 onDateChange(e){this.setData({day:e.detail.value||''});},
 onTimeChange(e){this.setData({time:e.detail.value||''});},
 submitRequest(){
  if(this.data.submitting||this.data.request||!this.data.product)return;
  if(this.data.time&&!this.data.day){notify('请先选择日期');return;}
  this.setData({submitting:true,error:''});
  const body={source:this.data.source,item_id:this.data.id,platform:PLATFORM};
  if(this.data.day)body.desired_date=this.data.day;
  if(this.data.time)body.desired_time=this.data.time;
  A.request({
   url:getApp().globalData.apiBase+'/v1/product-consultations',
   method:'POST',dataType:'json',
   headers:{'Content-Type':'application/json'},data:body,
   success:(res)=>{
    if((res.statusCode||res.status)===201&&res.data&&res.data.access_token){
     const data=res.data;
     const saved={request_id:data.request_id,access_token:data.access_token,booking_confirmed:false,video_connected:false};
     this.setData({request:{...saved,...data},statusText:'咨询申请已送达服务器，等待咨询员处理。'});
     try{write(keyFor(this.data.source,this.data.id),saved);}
     catch(e){this.setData({error:'申请已创建，但无法保存本机凭证。请勿卸载小程序。'});}
    }else{
     const unavailable=(res.statusCode||res.status)===503;
     this.setData({error:unavailable?'咨询申请服务尚未开放，请稍后再试。':'提交未成功，请核对商品后重试。'});
    }
   },
   fail:()=>this.setData({error:'网络连接失败，未确认申请结果。请先检查网络。'}),
   complete:()=>this.setData({submitting:false})
  });
 },
 refreshStatus(){
  const request=this.data.request;
  if(!request||!request.request_id||!request.access_token||this.data.refreshing)return;
  this.setData({refreshing:true,error:''});
  A.request({
   url:getApp().globalData.apiBase+'/v1/product-consultations/'+encodeURIComponent(request.request_id),
   method:'GET',dataType:'json',
   headers:{'X-Consultation-Token':request.access_token},
   success:(res)=>{
    const data=res.data;
    if((res.statusCode||res.status)!==200||!data){
     this.setData({error:'无法查询申请状态，请勿重复提交。'});return;
    }
    if(data.item_id!==this.data.id||data.source!==this.data.source){
     this.setData({error:'申请与当前商品不匹配。'});return;
    }
    const labels={requested:'申请已收到，等待处理',assigned:'咨询员已分配，等待准备咨询',ready:'视频咨询房间已分配，请登录后进入',cancelled:'申请已取消',closed:'咨询申请已结束'};
    this.setData({request:{...request,...data},canOpenVideo:(
      data.status==='ready'&&LINK_PATTERN.test(data.video_url||'')),
      statusText:labels[data.status]||'正在核实申请状态'});
   },
   fail:()=>this.setData({error:'申请状态查询失败，请检查网络。'}),
   complete:()=>this.setData({refreshing:false})
  });
 },
 openVideo(){
  const req=this.data.request;
  if(!req||req.status!=='ready'||!LINK_PATTERN.test(req.video_url||'')){
   notify('视频房间尚未准备完成');return;
  }
  A.navigateTo({url:'/pages/consult/video?url='+encodeURIComponent(req.video_url)});
 }
});