const APP=wx;
const KEY='ktaxback_native_saved';
const COPY={
 zh_cn:{back:'返回商品',options:'选择规格',ingredients:'主要成分',use:'使用方法',intro:'商品介绍',wish:'收藏',bag:'加入购物袋',saved:'已加入本地购物清单',notice:'目前仅展示商品，暂未开通支付或订单',loading:'正在加载商品',error:'商品信息暂时不可用'},
 zh_tw:{back:'返回商品',options:'選擇規格',ingredients:'主要成分',use:'使用方法',intro:'商品介紹',wish:'收藏',bag:'加入購物袋',saved:'已加入本機購物清單',notice:'目前僅顯示商品，尚未開放付款及訂單',loading:'載入商品中',error:'商品資訊暫時無法讀取'},
 jp:{back:'商品一覧に戻る',options:'オプションを選択',ingredients:'成分',use:'使い方',intro:'商品説明',wish:'お気に入り',bag:'バッグに追加',saved:'端末内のリストに保存しました',notice:'お支払い・ご注文はまだ利用できません',loading:'商品情報を読み込み中',error:'商品情報を取得できません'},
 en:{back:'Back to products',options:'Choose option',ingredients:'Key ingredients',use:'How to use',intro:'Product details',wish:'Wishlist',bag:'Add to bag',saved:'Saved to your local bag',notice:'Payment and orders are not available yet',loading:'Loading product',error:'Unable to fetch product'}
};
function getSaved(){
 try {
  const v=true ? APP.getStorageSync(KEY) : APP.getStorageSync({key:KEY}).data;
  return v && typeof v==='object' ? v:{favorites:[],bag:[]};
 }catch(e){return {favorites:[],bag:[]};}
}
function writeSaved(v){
 try{
  if(true)APP.setStorageSync(KEY,v);
  else APP.setStorageSync({key:KEY,data:v});
 }catch(e){}
}
function toast(text){
 if(true)APP.showToast({title:text,icon:'none'});
 else APP.showToast({content:text,type:'none'});
}
Page({
 data:{
  id:'',lang:'zh_cn',words:COPY.zh_cn,loading:true,
  product:null,images:[],options:[],description:{summary:'',ingredients:'',howToUse:''},
  chosen:-1,quantity:1,liked:false,error:'',optionText:''
 },
 onLoad(query){
  const id=String(query.id||'');
  const lang=COPY[query.lang]?query.lang:'zh_cn';
  this.setData({id,lang,words:COPY[lang]});
  if(!/^[A-Za-z0-9_-]{2,60}$/.test(id)){this.setData({loading:false,error:COPY[lang].error});return;}
  this.load();
 },
 load(){
  const url=getApp().globalData.apiBase+
   '/v1/ktaxback/miniapp/products/'+encodeURIComponent(this.data.id)+
   '?lang='+encodeURIComponent(this.data.lang);
  this.setData({loading:true,error:''});
  APP.request({url,method:'GET',
    success:res=>{
      const ok=(res.statusCode||res.status)===200;
      if(!ok||!res.data||!res.data.product){
        this.setData({loading:false,error:this.data.words.error});return;
      }
      const data=res.data;
      const product=data.product;
      product.priceText='US$'+Number(product.price||0).toFixed(2);
      product.regularText='US$'+Number(product.regularPrice||0).toFixed(2);
      product.hasDiscount=Number(product.regularPrice||0)>Number(product.price||0);
      const opts=(data.options||[]).map((x,i)=>({
        name:x.name,available:!!x.available,
        index:i,priceText:x.price===null||x.price===undefined?'':'US$'+Number(x.price).toFixed(2)
      }));
      const selected=opts.findIndex(o=>o.available);
      const saved=getSaved();
      this.setData({
        product,images:data.images||[],options:opts,
        description:data.description||{summary:'',ingredients:'',howToUse:''},
        chosen:selected,liked:(saved.favorites||[]).some(f=>f.id===product.id),
        loading:false,error:''
      });
    },
    fail:()=>this.setData({loading:false,error:this.data.words.error})
  });
 },
 onBack(){APP.navigateBack({delta:1});},
 onImageTap(e){},
 onOptionTap(e){
  const n=Number(e.currentTarget.dataset.index);
  if(!this.data.options[n]||!this.data.options[n].available)return;
  this.setData({chosen:n});
 },
 onMinus(){this.setData({quantity:Math.max(1,this.data.quantity-1)});},
 onPlus(){this.setData({quantity:Math.min(99,this.data.quantity+1)});},
 onWish(){
  const p=this.data.product;if(!p)return;
  const v=getSaved();
  let arr=(v.favorites||[]).filter(x=>x.id!==p.id);
  const liked=!this.data.liked;
  if(liked)arr.unshift(p);
  v.favorites=arr.slice(0,100);writeSaved(v);
  this.setData({liked});
  toast(this.data.words.wish);
 },
 onAddBag(){
  const p=this.data.product;if(!p||p.soldOut)return;
  const opts=this.data.options||[];
  if(opts.length && (this.data.chosen<0||!opts[this.data.chosen].available)){
    toast(this.data.words.options);return;
  }
  const option=opts.length?opts[this.data.chosen].name:'';
  const saved=getSaved();
  const bag=saved.bag||[];
  const hit=bag.find(x=>x.product.id===p.id&&x.option===option);
  if(hit)hit.quantity=Math.min(99,hit.quantity+this.data.quantity);
  else bag.push({product:p,option,quantity:this.data.quantity});
  saved.bag=bag.slice(-100);
  writeSaved(saved);
  toast(this.data.words.saved);
 }
});
