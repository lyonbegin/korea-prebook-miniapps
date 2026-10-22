const fallback=[
  {kind:'motel_early_checkin',name_zh:'汽车旅馆提前入住'},
  {kind:'clinic_visit',name_zh:'韩国诊所预约'},
  {kind:'korea_online_shopping',name_zh:'韩国网购预购，送至预订酒店'},
  {kind:'airport_goods_handoff',name_zh:'离境机场取货'},
  {kind:'airport_luggage_delivery',name_zh:'酒店至机场行李配送'}
];
Page({
  data:{services:fallback,status:'演示目录 · 尚未开放实际预约'},
  onLoad(){
    const base=getApp().globalData.apiBase;
    if(base.indexOf('.invalid')!==-1)return;
    my.request({
      url:`${base}/v1/catalog`,method:'GET',dataType:'json',
      success:(res)=>{
        if(res.status===200&&res.data&&Array.isArray(res.data.services)){
          this.setData({services:res.data.services,status:'测试版：当前不支持正式交易'});
        }
      },
      fail:()=>this.setData({status:'连接失败，显示本地演示目录'})
    });
  },
  onServiceTap(){my.showToast({content:'预约功能尚未开放'});}
});
