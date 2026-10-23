// Identical original React K-TAXBACK source is served by Railway H5.
// The merchant must register the H5 hostname as a WeChat Mini Program business domain.
Page({
  data:{shopUrl:''},
  onLoad(){
    this.setData({shopUrl:getApp().globalData.shopWebUrl});
  }
});
