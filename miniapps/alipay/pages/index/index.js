const services=[{"kind":"beauty_consultation","name_zh":"韩国美妆咨询","desc_zh":"先咨询，再安排适合的服务","name_ko":"한국 뷰티 상담","tag_zh":"咨询入口"},{"kind":"airport_goods_handoff","name_zh":"机场商品提货预约","desc_zh":"K-TAXBACK 商品 · 离境机场交付","name_ko":"공항 상품 인도 예약","tag_zh":"商品交付"},{"kind":"clinic_visit","name_zh":"医院与诊所预约","desc_zh":"希望到访的机构与日期咨询","name_ko":"병원·의원 예약","tag_zh":"到访预约"},{"kind":"beauty_salon","name_zh":"美发与美妆门店预约","desc_zh":"理发 · 化妆 · 美甲等门店","name_ko":"미용실·뷰티 매장 예약","tag_zh":"美容门店"},{"kind":"spa_wellness","name_zh":"SPA 与护理预约","desc_zh":"护理 · 按摩 · SPA 场所咨询","name_ko":"스파·케어 예약","tag_zh":"SPA"},{"kind":"restaurant_table","name_zh":"韩国餐厅座位预约","desc_zh":"人数 · 用餐时间 · 座位需求","name_ko":"음식점 좌석 예약","tag_zh":"餐厅"},{"kind":"motel_early_checkin","name_zh":"住宿预约与提前入住","desc_zh":"酒店 · 住宿 · 提前入住咨询","name_ko":"숙박·얼리체크인 예약","tag_zh":"住宿"},{"kind":"airport_luggage_delivery","name_zh":"行李配送预约","desc_zh":"酒店与机场之间的行李安排","name_ko":"캐리어 배송 예약","tag_zh":"行李"}];
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
Page({
 data:{services,title_zh:'韩国美妆与旅行预约',subtitle_zh:'先咨询，再预约',status:'预约提交尚未开放 · 可先保存咨询草稿',activeService:'',selectedName:'',preferredDate:'',preferredTime:'',minDate:today(),quantity:'1',contact:'',notes:''},
 onLoad(){this.refreshHome()},
 onShow(){this.refreshHome()},
 refreshHome(){my.request({url:getApp().globalData.apiBase+'/v1/channels/alipay/home',method:'GET',dataType:'json',success:(res)=>{if(res.status===200&&res.data){this.updateRemoteExtras(res.data)}},fail:()=>this.setData({status:'离线示例 · 草稿保存在本机'})})},
 updateRemoteExtras(data){
  // Keep the approved consultation service taxonomy as the primary navigation.
  // The existing manager API may still return the legacy motel/shop catalog.
  const additions=(data.services||[]).filter(x=>typeof x.kind==='string'&&x.kind.startsWith('source_'))
  .map(x=>({kind:x.kind,name_zh:x.name_zh||'附加咨询',desc_zh:'可咨询的附加预约项目',tag_zh:'咨询'}));
  this.setData({services:services.concat(additions),status:'已连接管理服务器 · 实际预约提交尚未开放'});
 },
 onServiceTap(e){const kind=e.currentTarget.dataset.kind;const s=this.data.services.find(x=>x.kind===kind);if(!s)return;
 this.setData({activeService:s.kind,selectedName:s.name_zh,preferredDate:'',preferredTime:'',quantity:'1',contact:'',notes:''})},
 onDateChange(e){this.setData({preferredDate:e.detail.value})},
 onTimeChange(e){this.setData({preferredTime:e.detail.value})},
 onQuantityChange(e){this.setData({quantity:e.detail.value})},
 onContactChange(e){this.setData({contact:e.detail.value})},
 onNotesChange(e){this.setData({notes:e.detail.value})},
 saveDraft(){
  if(!this.data.activeService)return;
  const draft={service_kind:this.data.activeService,service_name:this.data.selectedName,date:this.data.preferredDate,time:this.data.preferredTime,quantity:this.data.quantity,contact:this.data.contact,notes:this.data.notes,saved_at:new Date().toISOString(),submitted:false,booking_confirmed:false};
  my.setStorageSync({key:'korea_prebook_consultation_draft',data:draft});
  my.showToast({content:'草稿已保存，未提交预约',type:'none',duration:2200});
 },
 closeDraft(){this.setData({activeService:'',selectedName:''})},
 openShop(){my.navigateTo({url:'/pages/shop/index'})}
});
