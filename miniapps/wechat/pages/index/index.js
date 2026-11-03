const CATEGORIES=[{"id":"all","name_zh":"全部","name_ko":"전체"},{"id":"lifting","name_zh":"提升紧致","name_ko":"리프팅"},{"id":"skin","name_zh":"皮肤治疗","name_ko":"피부 시술"},{"id":"botox","name_zh":"肉毒素","name_ko":"보톡스"},{"id":"filler","name_zh":"填充","name_ko":"필러"},{"id":"rhinoplasty","name_zh":"鼻部整形","name_ko":"코성형"},{"id":"eye","name_zh":"眼部整形","name_ko":"눈성형"},{"id":"face_contour","name_zh":"面部轮廓","name_ko":"안면윤곽"},{"id":"breast","name_zh":"胸部整形","name_ko":"가슴성형"},{"id":"body","name_zh":"身体塑形","name_ko":"바디"},{"id":"hair_treatment","name_zh":"植发与头皮","name_ko":"모발이식·두피"},{"id":"hair_removal","name_zh":"脱毛","name_ko":"제모"},{"id":"kmed","name_zh":"韩医","name_ko":"한방"},{"id":"dental","name_zh":"牙科","name_ko":"치과"},{"id":"others","name_zh":"其他项目","name_ko":"기타"},{"id":"cosmetics","name_zh":"韩国美妆商品","name_ko":"화장품"},{"id":"aesthetic","name_zh":"皮肤美容护理","name_ko":"에스테틱"},{"id":"nail","name_zh":"美甲","name_ko":"네일"},{"id":"hair_salon","name_zh":"美发造型","name_ko":"헤어·미용실"},{"id":"guide","name_zh":"韩国旅游向导","name_ko":"관광 가이드"}];

Page({
 data:{categories:CATEGORIES,activeCategory:'all',products:[],visibleProducts:[],query:'',loading:false,networkError:false,
       emptyText:'请选择类别查看商品',helpText:'商品页面提供视频咨询入口；未接通的服务会明确提示',ready:false},
 onLoad(q){const category=(q&&q.category)||'all';this.setData({activeCategory:CATEGORIES.some(x=>x.id===category)?category:'all'});this.loadListings()},
 onCategoryTap(e){const category=e.currentTarget.dataset.id||'all';if(category===this.data.activeCategory)return;
   this.setData({activeCategory:category,query:'',products:[],visibleProducts:[]});this.loadListings()},
 onSearchInput(e){this.setData({query:e.detail.value||''});this.applySearch()},
 onSearchConfirm(){this.applySearch()},
 applySearch(){const q=(this.data.query||'').trim().toLocaleLowerCase();const visible=(this.data.products||[]).filter(p=>!q||(p.name+' '+(p.subtitle||'')).toLocaleLowerCase().includes(q));this.setData({visibleProducts:visible})},
 loadListings(){
   if(getApp().globalData.demoMode){this.loadDemoListings();return;}
   const category=this.data.activeCategory,includeOffers=category!=='cosmetics',includeCosmetics=category==='cosmetics'||category==='all';
   const requestId=this._listingRequestId=(this._listingRequestId||0)+1;
   this.setData({products:[],visibleProducts:[],loading:true,networkError:false,ready:false});
   let count=(includeOffers?1:0)+(includeCosmetics?1:0),failed=0;
   const finish=()=>{if(requestId!==this._listingRequestId)return;count--;if(count<=0){this.setData({loading:false,ready:true,networkError:failed>0});this.applySearch()}};
   const add=(items)=>{if(requestId!==this._listingRequestId)return;const old=this.data.products||[];this.setData({products:old.concat(items)});this.applySearch()};
   if(includeOffers){
      const categoryQuery=encodeURIComponent(category);
      wx.request({url:getApp().globalData.apiBase+'/v1/offers?category_id='+categoryQuery+'&size=60',method:'GET',
        success:(res)=>{if(requestId!==this._listingRequestId)return;if(res.statusCode===200&&res.data&&Array.isArray(res.data.offers)){
           add(res.data.offers.map(p=>({id:p.id,source:'offer',name:p.title_zh||p.name,subtitle:p.provider_name||p.summary_zh||'',
            categoryId:p.category_id,image:p.image||'',priceText:p.price_krw===null||p.price_krw===undefined?'价格请咨询':'₩'+Number(p.price_krw).toLocaleString()})));
         }else failed++;finish()},fail:()=>{if(requestId!==this._listingRequestId)return;failed++;finish()}});
   }
   if(includeCosmetics){
      wx.request({url:getApp().globalData.apiBase+'/v1/ktaxback/miniapp/products?lang=zh_cn&size=30&page=1&sort=best',method:'GET',
        success:(res)=>{if(requestId!==this._listingRequestId)return;if(res.statusCode===200&&res.data&&Array.isArray(res.data.products)){
         add(res.data.products.map(p=>({id:p.id,source:'cosmetics',name:p.name,subtitle:p.brand||'',categoryId:'cosmetics',
          image:p.image||'',priceText:'US$'+Number(p.price||0).toFixed(2)})));
        }else failed++;finish()},fail:()=>{if(requestId!==this._listingRequestId)return;failed++;finish()}});
   }
 },
 loadDemoListings(){
   const requestId=this._listingRequestId=(this._listingRequestId||0)+1;
   this.setData({products:[],visibleProducts:[],loading:true,networkError:false,ready:false});
   wx.request({
     url:getApp().globalData.apiBase+'/demo/api/products',
     method:'GET',
     success:(res)=>{
       if(requestId!==this._listingRequestId)return;
       if((res.statusCode||res.status)!==200||!res.data||!Array.isArray(res.data.products)){
         this.setData({loading:false,ready:true,networkError:true});return;
       }
       const all=res.data.products.map(p=>({
         id:p.id,source:p.category==='cosmetics'?'cosmetics':'offer',
         categoryId:p.category,name:p.name,subtitle:'DEMO · '+p.provider,
         image:'',priceText:p.price_krw===null?'价格请咨询':'₩'+Number(p.price_krw).toLocaleString()
       }));
       const items=this.data.activeCategory==='all'?all:all.filter(p=>p.categoryId===this.data.activeCategory);
       this.setData({products:items,loading:false,ready:true,networkError:false});
       this.applySearch();
     },
     fail:()=>{
       if(requestId===this._listingRequestId)this.setData({loading:false,ready:true,networkError:true});
     }
   });
 },
 onProductTap(e){const id=String(e.currentTarget.dataset.id||''),source=e.currentTarget.dataset.source;
   if(!/^[A-Za-z0-9_-]{2,60}$/.test(id))return;
   wx.navigateTo({url:'/pages/shop/detail?id='+encodeURIComponent(id)+'&source='+encodeURIComponent(source)+'&lang=zh_cn'})},
 onRefresh(){this.loadListings()}
});