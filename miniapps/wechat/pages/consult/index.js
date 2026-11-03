const A=wx;
Page({
 data:{id:'',source:'offer',product:null,loading:true,error:'',day:'',time:'',notes:''},
 onLoad(q){const id=String(q.id||''),source=q.source==='cosmetics'?'cosmetics':'offer';
  if(!/^[A-Za-z0-9_-]{2,60}$/.test(id)){this.setData({loading:false,error:'商品编号无效'});return}
  this.setData({id,source});this.load()},
 load(){
  const base=getApp().globalData.apiBase;
  const url=this.data.source==='offer'?base+'/v1/offers/'+encodeURIComponent(this.data.id):base+'/v1/ktaxback/miniapp/products/'+encodeURIComponent(this.data.id)+'?lang=zh_cn';
  A.request({url,method:'GET',success:(r)=>{
    if((r.statusCode||r.status)===200&&r.data&&r.data.product){this.setData({product:r.data.product,loading:false,error:''})}
    else this.setData({loading:false,error:'目前无法读取商品信息'})},
    fail:()=>this.setData({loading:false,error:'目前无法读取商品信息'})})
 },
 onDateChange(e){this.setData({day:e.detail.value})},
 onTimeChange(e){this.setData({time:e.detail.value})},
 onNoteChange(e){this.setData({notes:e.detail.value})},
 saveDraft(){
  if(!this.data.product)return;
  const d={offer_id:this.data.id,source:this.data.source,counselor_id:this.data.product.counselorId||null,
    desired_date:this.data.day,desired_time:this.data.time,notes:this.data.notes,
    saved_at:new Date().toISOString(),submitted:false,video_connected:false,booking_confirmed:false};
  try{
    A.setStorageSync('korea_prebook_offer_consultation_draft',d);
    A.showToast({title:'仅已保存草稿',icon:'none'});
  }catch(e){A.showToast({title:'保存失败',icon:'none'})}
 }
});