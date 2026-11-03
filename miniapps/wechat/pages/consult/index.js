// Real keyless FUNCTIONAL DEMO: no WeChat/Alipay login, API secret or fake HITEL session.
const APP=wx;
const PLATFORM='wechat';
const ROOM=/^\/demo\/rooms\/[0-9a-f-]{36}\?role=customer$/i;
function storageKey(source,id){return 'prebook_demo_'+PLATFORM+'_'+source+'_'+id;}
function read(key){try{return APP.getStorageSync(key)||null;}catch(e){return null;}}
function write(key,value){try{APP.setStorageSync(key,value);}catch(e){}}
function notify(message){APP.showToast({title:message,icon:'none'});}
Page({
 data:{
  id:'',source:'offer',product:null,loading:true,error:'',day:'',time:'',
  request:null,statusText:'',submitting:false,refreshing:false,canOpenVideo:false
 },
 onLoad(query){
  const id=String(query.id||''),source=query.source==='cosmetics'?'cosmetics':'offer';
  if(!/^[A-Za-z0-9_-]{2,60}$/.test(id)){
   this.setData({loading:false,error:'无效的测试商品'});return;
  }
  this.setData({id,source});
  this.load();
  const saved=read(storageKey(source,id));
  if(saved&&saved.id){
   this.setData({request:{id:saved.id},statusText:'正在恢复测试咨询申请'});
   this.refreshStatus();
  }
 },
 onShow(){
  if(this._statusTimer)clearInterval(this._statusTimer);
  this._statusTimer=setInterval(()=>{
   if(this.data.request&&this.data.request.id)this.refreshStatus();
  },5000);
 },
 onHide(){if(this._statusTimer){clearInterval(this._statusTimer);this._statusTimer=null;}},
 onUnload(){if(this._statusTimer){clearInterval(this._statusTimer);this._statusTimer=null;}},
 load(){
  APP.request({
   url:getApp().globalData.apiBase+'/demo/api/products/'+encodeURIComponent(this.data.id),
   method:'GET',
   success:(r)=>{
    if((r.statusCode||r.status)===200&&r.data&&r.data.product)
      this.setData({product:r.data.product,loading:false,error:''});
    else this.setData({loading:false,error:'测试商品读取失败'});
   },
   fail:()=>this.setData({loading:false,error:'无法连接测试商品服务器'})
  });
 },
 onDateChange(e){this.setData({day:e.detail.value||''});},
 onTimeChange(e){this.setData({time:e.detail.value||''});},
 submitRequest(){
  if(this.data.submitting||this.data.request||!this.data.product)return;
  if(this.data.time&&!this.data.day){notify('请先选择日期');return;}
  this.setData({submitting:true,error:''});
  APP.request({
   url:getApp().globalData.apiBase+'/demo/api/consultations',
   method:'POST',
   header:{'Content-Type':'application/json'},
   data:{platform:PLATFORM,item_id:this.data.id,desired_date:this.data.day,desired_time:this.data.time},
   success:(r)=>{
    if((r.statusCode||r.status)===201&&r.data&&r.data.id&&r.data.platform===PLATFORM){
      const request=r.data;
      this.setData({request,statusText:'测试咨询已保存到独立服务器，等待咨询员分配。',
       canOpenVideo:false});
      write(storageKey(this.data.source,this.data.id),{id:request.id});
    }else this.setData({error:'申请未成功，请检查服务器状态。'});
   },
   fail:()=>this.setData({error:'网络中断，提交状态未知。请勿反复点击。'}),
   complete:()=>this.setData({submitting:false})
  });
 },
 refreshStatus(){
  const req=this.data.request;
  if(!req||!req.id||this.data.refreshing)return;
  this.setData({refreshing:true});
  APP.request({
   url:getApp().globalData.apiBase+'/demo/api/consultations/'+encodeURIComponent(req.id),
   method:'GET',
   success:(r)=>{
    const data=r.data;
    if((r.statusCode||r.status)!==200||!data||data.item_id!==this.data.id||
       data.platform!==PLATFORM){
      this.setData({error:'测试咨询记录与当前商品不匹配'});return;
    }
    const labels={requested:'咨询申请已收到，等待分配',ready:'专属测试视频房间已分配',
      closed:'测试咨询已结束'};
    this.setData({
     request:data,statusText:labels[data.status]||'正在核实测试状态',
     canOpenVideo:data.status==='ready'&&ROOM.test(data.customer_room_url||''),
     error:''
    });
   },
   fail:()=>this.setData({error:'咨询状态查询失败'}),
   complete:()=>this.setData({refreshing:false})
  });
 },
 startNew(){
  const req=this.data.request;
  if(req&&req.status!=='closed')return;
  write(storageKey(this.data.source,this.data.id),null);
  this.setData({request:null,canOpenVideo:false,statusText:''});
 },
 openVideo(){
  const req=this.data.request,relative=req&&req.customer_room_url;
  if(!req||req.status!=='ready'||!ROOM.test(relative||'')){
   notify('测试视频房间尚未分配');return;
  }
  APP.navigateTo({url:'/pages/consult/video?url='+encodeURIComponent(getApp().globalData.apiBase+relative)});
 }
});