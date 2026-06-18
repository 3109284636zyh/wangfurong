var app = getApp();

Page({
  data: {
    version: '2.0.0',
    chatFormName: '朋友模式',
    humanModeText: '未开启',
    storageInfo: '本地偏好与聊天记录'
  },

  onShow: function() {
    this.refreshStatus();
  },

  refreshStatus: function() {
    var form = wx.getStorageSync('chatForm') || app.globalData.chatModeDefault || 'friend';
    var formMap = {
      daily: '日常聊天',
      friend: '朋友模式',
      bestie: '闺蜜模式',
      brother: '兄弟模式',
      lover: '恋人模式'
    };
    this.setData({
      version: app.globalData.version || '2.0.0',
      chatFormName: formMap[form] || '朋友模式',
      humanModeText: app.globalData.enableHumanMode ? '已开启' : '未开启'
    });
  },

  goSettings: function() {
    wx.navigateTo({ url: '/pages/settings/settings' });
  },

  goChat: function() {
    var chatForm = wx.getStorageSync('chatForm') || app.globalData.chatModeDefault || 'friend';
    wx.navigateTo({ url: '/pages/chat/chat?chatForm=' + chatForm });
  },

  goProducts: function() {
    wx.switchTab({ url: '/pages/ecommerce/ecommerce' });
  },

  goAssistant: function() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  showUsage: function() {
    wx.showModal({
      title: '使用说明',
      content: '首页用于进入产品详情、AI聊天和客服助手；电商页查看建站产品与报价；我的页集中放设置、缓存和说明。客服助手会继续走合规风控。',
      showCancel: false
    });
  },

  showAbout: function() {
    wx.showModal({
      title: '关于AI小福',
      content: 'AI小福是建站接单客服助手，同时提供独立的AI陪伴聊天体验。当前版本：' + (this.data.version || '2.0.0'),
      showCancel: false
    });
  },

  clearLocalCache: function() {
    wx.navigateTo({ url: '/pages/settings/settings?section=cache' });
  }
});
