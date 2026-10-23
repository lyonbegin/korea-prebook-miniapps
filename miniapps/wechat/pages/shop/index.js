const APP = wx;
const STORAGE = 'ktaxback_native_saved';
const LANGS = [
  {code:'zh_cn',title:'简体中文'},
  {code:'zh_tw',title:'繁體中文'},
  {code:'jp',title:'日本語'},
  {code:'en',title:'English'}
];
const WORDS = {
  zh_cn:{title:'韩国美妆精选',search:'搜索韩国商品或品牌',all:'全部',best:'热卖',new:'新品',sale:'优惠',price:'价格',categories:'分类',empty:'暂无商品',wishlist:'收藏',cart:'购物袋',services:'韩国旅行',network:'商品数据暂时无法读取',more:'加载更多'},
  zh_tw:{title:'韓國美妝精選',search:'搜尋韓國商品或品牌',all:'全部',best:'熱賣',new:'新品',sale:'優惠',price:'價格',categories:'分類',empty:'暫無商品',wishlist:'收藏',cart:'購物袋',services:'韓國旅行',network:'商品資料暫時無法讀取',more:'載入更多'},
  jp:{title:'韓国コスメセレクト',search:'商品・ブランドを検索',all:'すべて',best:'人気',new:'新着',sale:'セール',price:'価格',categories:'カテゴリー',empty:'商品がありません',wishlist:'お気に入り',cart:'バッグ',services:'韓国旅行',network:'商品情報を読み込めません',more:'さらに表示'},
  en:{title:'K-Beauty Edit',search:'Search Korean products',all:'All',best:'Best',new:'New',sale:'Sale',price:'Price',categories:'Categories',empty:'No products found',wishlist:'Wishlist',cart:'Bag',services:'Korea Travel',network:'Unable to load catalogue',more:'Load more'}
};
function getSaved(){
 try {
  const raw = true ? APP.getStorageSync(STORAGE) : APP.getStorageSync({key:STORAGE}).data;
  return raw && typeof raw==='object' ? raw : {favorites:[],bag:[]};
 }catch(e){return {favorites:[],bag:[]};}
}
function request(url, success, failure){
 APP.request({url:getApp().globalData.apiBase+url,method:'GET',
  success:res=>{
    if((res.statusCode || res.status)===200 && res.data){success(res.data);}
    else {failure('HTTP '+(res.statusCode || res.status || 'error'));}
  },fail:()=>failure('network')});
}
function productView(p){
 return Object.assign({},p,{
  priceText:'US$'+Number(p.price||0).toFixed(2),
  regularText:'US$'+Number(p.regularPrice||0).toFixed(2),
  hasDiscount:Number(p.regularPrice||0)>Number(p.price||0),
  hasImage:!!p.image
 });
}
Page({
 data:{
  lang:'zh_cn',langs:LANGS,words:WORDS.zh_cn,loading:true,
  products:[],categories:[],activeCategory:'all',activeSort:'best',
  search:'',tab:'home',page:1,total:0,hasMore:false,
  bagCount:0,status:'',topTitle:'K-TAXBACK'
 },
 onLoad(){
  this.setData({bagCount:(getSaved().bag||[]).reduce((s,x)=>s+(x.quantity||1),0)});
  this.getHome();
 },
 onShow(){
  const saved=getSaved();
  this.setData({bagCount:(saved.bag||[]).reduce((s,x)=>s+(x.quantity||1),0)});
  if(this.data.tab==='wishlist'||this.data.tab==='cart')this.openLocal();
 },
 getHome(){
  this.setData({loading:true,status:''});
  request('/v1/ktaxback/miniapp/home?lang='+this.data.lang,
    data=>{
      const categories=[{id:'all',label:this.data.words.all,count:data.total||0}].concat(data.categories||[]);
      this.setData({categories,products:(data.products||[]).map(productView),
        loading:false,total:data.total||0,hasMore:!!data.hasMore,page:data.page||1});
    },
    err=>this.setData({loading:false,status:this.data.words.network+' ('+err+')'}));
 },
 reload(){
  if(this.data.tab==='wishlist'||this.data.tab==='cart'){this.openLocal();return;}
  this.loadProducts(true);
 },
 loadProducts(reset){
  if(this.data.loading&&!reset)return;
  const n=reset?1:(this.data.page+1);
  const lang=this.data.lang;
  const params=[
    'lang='+encodeURIComponent(lang),
    'category='+encodeURIComponent(this.data.activeCategory),
    'sort='+encodeURIComponent(this.data.activeSort),
    'keyword='+encodeURIComponent(this.data.search),
    'page='+n,'size=20'
  ];
  this.setData({loading:true,status:''});
  request('/v1/ktaxback/miniapp/products?'+params.join('&'),
    data=>{
      const products=(data.products||[]).map(productView);
      const all=reset?products:(this.data.products||[]).concat(products);
      const unique=[];const seen={};
      all.forEach(p=>{if(!seen[p.id]){unique.push(p);seen[p.id]=1;}});
      const update={products:unique,loading:false,total:data.total||0,
        hasMore:!!data.hasMore,page:n};
      if(data.categories){
        update.categories=[{id:'all',label:this.data.words.all,count:data.total||0}].concat(data.categories);
      }
      this.setData(update);
    },
    err=>this.setData({loading:false,status:this.data.words.network+' ('+err+')'}));
 },
 onLangTap(e){
  const code=e.currentTarget.dataset.lang;
  if(!WORDS[code]||code===this.data.lang)return;
  const current=this.data.tab;
  this.setData({lang:code,words:WORDS[code],products:[],page:1,loading:false});
  if(current==='wishlist'||current==='cart')this.openLocal();
  else this.loadProducts(true);
 },
 onKeywordInput(e){this.setData({search:e.detail.value||''});},
 onSearch(){this.setData({tab:'home',activeCategory:'all',activeSort:'best',loading:false});this.loadProducts(true);},
 onCategoryTap(e){
  const cat=e.currentTarget.dataset.id;
  if(!cat)return;
  this.setData({activeCategory:cat,activeSort:'best',tab:'category',products:[],page:1,loading:false});
  this.loadProducts(true);
 },
 onSortTap(e){
  const sort=e.currentTarget.dataset.sort;
  if(!sort)return;
  this.setData({activeSort:sort,tab:'home',products:[],page:1,loading:false});
  this.loadProducts(true);
 },
 onTabTap(e){
  const tab=e.currentTarget.dataset.tab;
  if(tab==='services'){APP.navigateTo({url:'/pages/index/index'});return;}
  if(tab==='wishlist'||tab==='cart'){
    this.setData({tab,products:[],loading:false});
    this.openLocal();return;
  }
  if(tab==='category'){
    this.setData({tab,activeCategory:'all',activeSort:'best',loading:false});
    this.loadProducts(true);return;
  }
  this.setData({tab:'home',activeCategory:'all',activeSort:'best',search:'',loading:false});
  this.loadProducts(true);
 },
 openLocal(){
  const saved=getSaved();
  const products=this.data.tab==='wishlist'?saved.favorites:saved.bag.map(e=>e.product);
  this.setData({products:(products||[]).filter(Boolean).map(productView),
    total:products.length,hasMore:false,loading:false});
 },
 onProductImageError(e){
  const id=e.currentTarget.dataset.id;
  if(!id)return;
  this.setData({products:(this.data.products||[]).map(p=>
    p.id===id?Object.assign({},p,{hasImage:false,image:''}):p)});
 },
 onProductTap(e){
  const id=e.currentTarget.dataset.id;
  if(!id)return;
  APP.navigateTo({url:'/pages/shop/detail?id='+encodeURIComponent(id)+'&lang='+this.data.lang});
 },
 onMore(){if(this.data.hasMore&&!this.data.loading)this.loadProducts(false);},
 onPullDownRefresh(){
  this.reload();
  if(true)APP.stopPullDownRefresh();
  else if(APP.stopPullDownRefresh)APP.stopPullDownRefresh();
 }
});
