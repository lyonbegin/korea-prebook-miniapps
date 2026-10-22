const fallback=[
 {kind:'motel_early_checkin',name_zh:'汽车旅馆提前入住'},
 {kind:'clinic_visit',name_zh:'韩国诊所预约'},
 {kind:'korea_online_shopping',name_zh:'韩国网购预购'},
 {kind:'airport_goods_handoff',name_zh:'离境机场取货'},
 {kind:'airport_luggage_delivery',name_zh:'酒店至机场行李配送'}
];
Page({
 data:{services:fallback,title_zh:'韩国行前预约 · 预购',subtitle_zh:'抵韩前预约入住、诊所和网购配送',status:'演示目录 · 尚未开放实际预约'},
 onLoad(){this.refreshHome()},
 onShow(){this.refreshHome()},
 refreshHome(){
  wx.request({url:getApp().globalData.apiBase+'/v1/channels/wechat/home',method:'GET',
   success:(res)=>{
    if(res.statusCode===200&&res.data&&Array.isArray(res.data.services)){
     this.setData({services:res.data.services,title_zh:res.data.title_zh,subtitle_zh:res.data.subtitle_zh,status:'管理服务器已同步 · 预约交易暂未开放'});
    }
   },
   fail:()=>this.setData({status:'网络暂时不可用，显示演示目录'})
  });
 },
 onServiceTap(){wx.showToast({title:'预约功能尚未开放',icon:'none'})}
});
