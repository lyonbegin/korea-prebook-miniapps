// The exact same original React K-TAXBACK H5 page, not a native UI reconstruction.
// Register this hostname in the Alipay Mini Program H5 domain whitelist.
Page({
  data:{shopUrl:''},
  onLoad(){
    this.setData({shopUrl:getApp().globalData.shopWebUrl});
  }
});
