// Official miniapp login → server-side provider verification → owned consultation.
// No client-provided openid, phone number, patient record, or HITEL credentials.
const A=my;
const PLATFORM='alipay';
const LINK_PATTERN=/^https:\/\/hitel-room-production-ecce\.up\.railway\.app\/private-consultation\?consultation=[0-9a-f-]{36}$/i;
function notice(message){
  A.showToast({content:message,type:'none'});
}
Page({
  data:{
    id:'',source:'offer',product:null,loading:true,error:'',
    day:'',time:'',request:null,statusText:'',canOpenVideo:false,
    authenticating:false,identityToken:'',submitting:false,refreshing:false,
    loadingRequests:false,booking_confirmed:false
  },
  onLoad(query){
    const id=String(query.id||'');
    const source=query.source==='cosmetics'?'cosmetics':'offer';
    if(!/^[A-Za-z0-9_-]{2,60}$/.test(id)){
      this.setData({loading:false,error:'商品编号无效'});return;
    }
    this.setData({id,source});
    this.load();
    this.login(()=>this.loadMyRequests());
  },
  load(){
    const base=getApp().globalData.apiBase;
    const url=this.data.source==='offer'?
      base+'/v1/offers/'+encodeURIComponent(this.data.id):
      base+'/v1/ktaxback/miniapp/products/'+encodeURIComponent(this.data.id)+'?lang=zh_cn';
    A.request({
      url,method:'GET',dataType:'json',
      success:(r)=>{
        if((r.statusCode||r.status)===200&&r.data&&r.data.product){
          this.setData({product:r.data.product,loading:false,error:''});
        }else this.setData({loading:false,error:'目前无法读取商品信息'});
      },
      fail:()=>this.setData({loading:false,error:'目前无法读取商品信息'})
    });
  },
  login(done){
    if(this.data.authenticating)return;
    if(this.data.identityToken){if(done)done();return;}
    this.setData({authenticating:true,error:''});
    const exchange=(code)=>{
      if(!code){this.setData({authenticating:false,error:'平台无法提供登录授权码'});return;}
      A.request({
        url:getApp().globalData.apiBase+'/v1/miniapp-auth/exchange',
        method:'POST',dataType:'json',
        headers:{'Content-Type':'application/json'},
        data:{platform:PLATFORM,code},
        success:(r)=>{
          if((r.statusCode||r.status)===200&&r.data&&r.data.access_token&&r.data.platform===PLATFORM){
            this.setData({identityToken:r.data.access_token,error:'',authenticating:false});
            if(done)done();
          }else this.setData({
            identityToken:'',authenticating:false,
            error:(r.statusCode||r.status)===503?'平台会员认证尚未开放，请稍后重试。':'会员登录失败，请重试。'
          });
        },
        fail:()=>this.setData({identityToken:'',authenticating:false,error:'无法连接会员认证服务'}),
        complete:()=>this.setData({authenticating:false})
      });
    };
    A.getAuthCode({
      scopes:['auth_base'],
      success:(result)=>exchange(result.authCode),
      fail:()=>this.setData({authenticating:false,error:'支付宝登录授权失败'})
    });;
  },
  loadMyRequests(){
    if(!this.data.identityToken||this.data.loadingRequests)return;
    this.setData({loadingRequests:true});
    A.request({
      url:getApp().globalData.apiBase+'/v1/product-consultations/mine',
      method:'GET',dataType:'json',
      headers:{'Authorization':'Bearer '+this.data.identityToken},
      success:(r)=>{
        if((r.statusCode||r.status)!==200||!r.data||!Array.isArray(r.data.requests)){
          this.setData({error:'无法恢复当前账号的咨询记录，请重新登录。'});return;
        }
        const match=r.data.requests.find(x=>x.item_id===this.data.id&&
          x.source===this.data.source&&x.status!=='closed'&&x.status!=='cancelled');
        if(match){
          this.setData({request:match,statusText:'已恢复您此前提交的咨询申请'});
          this.refreshStatus();
        }else{
          this.setData({request:null,statusText:'',canOpenVideo:false});
        }
      },
      fail:()=>this.setData({error:'咨询记录查询失败'}),
      complete:()=>this.setData({loadingRequests:false})
    });
  },
  onDateChange(e){this.setData({day:e.detail.value||''});},
  onTimeChange(e){this.setData({time:e.detail.value||''});},
  submitRequest(){
    if(this.data.submitting||this.data.authenticating||this.data.request||!this.data.product)return;
    if(!this.data.identityToken){this.login(()=>this.submitRequest());return;}
    if(this.data.time&&!this.data.day){notice('请先选择日期');return;}
    this.setData({submitting:true,error:''});
    const body={source:this.data.source,item_id:this.data.id,platform:PLATFORM};
    if(this.data.day)body.desired_date=this.data.day;
    if(this.data.time)body.desired_time=this.data.time;
    A.request({
      url:getApp().globalData.apiBase+'/v1/product-consultations',
      method:'POST',dataType:'json',
      headers:{'Authorization':'Bearer '+this.data.identityToken,'Content-Type':'application/json'},
      data:body,
      success:(r)=>{
        if((r.statusCode||r.status)===201&&r.data&&r.data.request_id){
          this.setData({request:r.data,statusText:'咨询申请已绑定您的平台账号，等待咨询员处理。',
            canOpenVideo:false,booking_confirmed:false});
        }else{
          if((r.statusCode||r.status)===401)this.setData({identityToken:''});
          this.setData({error:'申请未确认成功。请先刷新咨询记录，避免重复提交。'});
        }
      },
      fail:()=>this.setData({error:'网络连接中断，提交结果未知。请刷新咨询记录确认。'}),
      complete:()=>this.setData({submitting:false})
    });
  },
  refreshStatus(){
    const req=this.data.request;
    if(!req||!req.request_id||this.data.refreshing)return;
    if(!this.data.identityToken){this.login(()=>this.refreshStatus());return;}
    this.setData({refreshing:true,error:''});
    A.request({
      url:getApp().globalData.apiBase+'/v1/product-consultations/'+encodeURIComponent(req.request_id),
      method:'GET',dataType:'json',
      headers:{'Authorization':'Bearer '+this.data.identityToken},
      success:(r)=>{
        const data=r.data;
        if((r.statusCode||r.status)!==200||!data){
          if((r.statusCode||r.status)===401)this.setData({identityToken:''});
          this.setData({error:'无法查询咨询状态，请重新登录。'});return;
        }
        if(data.item_id!==this.data.id||data.source!==this.data.source){
          this.setData({error:'咨询申请与当前商品不匹配'});return;
        }
        const labels={requested:'申请已收到，等待处理',assigned:'咨询员已分配，等待准备咨询',
          ready:'视频咨询房间已分配，请在完成身份验证后进入',
          cancelled:'申请已取消',closed:'咨询申请已结束'};
        this.setData({
          request:data,
          canOpenVideo:(data.status==='ready'&&LINK_PATTERN.test(data.video_url||'')),
          statusText:labels[data.status]||'正在核实咨询状态'
        });
      },
      fail:()=>this.setData({error:'咨询状态查询失败'}),
      complete:()=>this.setData({refreshing:false})
    });
  },
  retryLogin(){
    this.setData({identityToken:''});
    this.login(()=>this.loadMyRequests());
  },
  openVideo(){
    const req=this.data.request;
    if(!req||req.status!=='ready'||!LINK_PATTERN.test(req.video_url||'')){
      notice('视频咨询房间尚未准备完成');return;
    }
    A.navigateTo({url:'/pages/consult/video?url='+encodeURIComponent(req.video_url)});
  }
});