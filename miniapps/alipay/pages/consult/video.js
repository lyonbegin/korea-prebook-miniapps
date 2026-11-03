// TEST-ONLY isolated demo room. It does not use HITEL production auth or rooms.
const ALLOWED=/^https:\/\/prebook-keyless-consult-demo-production\.up\.railway\.app\/demo\/rooms\/[0-9a-f-]{36}\?role=customer$/i;
Page({
 data:{url:'',error:''},
 onLoad(query){
  let url='';
  try{url=decodeURIComponent(String(query.url||''));}catch(e){}
  if(!ALLOWED.test(url)){
   this.setData({error:'无效的测试视频房间链接。请返回咨询页面刷新状态。'});return;
  }
  this.setData({url});
 }
});
