// The invitation is a URL, not a bypass for HITEL authentication.
const APP=my;
const ALLOWED=/^https:\/\/hitel-room-production-ecce\.up\.railway\.app\/private-consultation\?consultation=[0-9a-f-]{36}$/i;
Page({
 data:{url:'',error:''},
 onLoad(query){
  let url='';
  try{url=decodeURIComponent(String(query.url||''));}catch(e){}
  if(!ALLOWED.test(url)){
   this.setData({error:'无效的视频咨询链接。请返回并刷新申请状态。'});
   return;
  }
  this.setData({url});
 }
});