var app = getApp();

Page({
  data: {
    chatForm: 'friend',
    chatForms: [
      { key: 'daily', icon: '🌤️', name: '日常' },
      { key: 'friend', icon: '💬', name: '朋友' },
      { key: 'bestie', icon: '💕', name: '闺蜜' },
      { key: 'brother', icon: '💪', name: '兄弟' },
      { key: 'lover', icon: '💝', name: '恋人' }
    ],
    keepHistory: true,
    defaultEntry: 'assistant',
    version: '2.0.0',
    section: ''
  },

  onLoad: function(options) {
    this.setData({ section: (options && options.section) || '' });
    this.loadSettings();
  },

  onShow: function() {
    this.loadSettings();
  },

  loadSettings: function() {
    var savedForm = wx.getStorageSync('chatForm') || app.globalData.chatModeDefault || 'friend';
    var keep = wx.getStorageSync('keepChatHistory');
    var entry = wx.getStorageSync('defaultEntry') || 'assistant';
    this.setData({
      chatForm: savedForm,
      keepHistory: keep === '' || keep === undefined ? true : keep !== false,
      defaultEntry: entry,
      version: app.globalData.version || '2.0.0'
    });
  },

  switchChatForm: function(e) {
    var form = e.currentTarget.dataset.form;
    if (!form || form === this.data.chatForm) return;
    this.setData({ chatForm: form });
    wx.setStorageSync('chatForm', form);
    wx.showToast({ title: '聊天形态已更新', icon: 'success', duration: 1000 });
  },

  toggleKeepHistory: function(e) {
    var value = !!e.detail.value;
    this.setData({ keepHistory: value });
    wx.setStorageSync('keepChatHistory', value);
    wx.showToast({ title: value ? '已开启保留记录' : '已关闭保留记录', icon: 'none' });
  },

  setDefaultEntry: function(e) {
    var entry = e.currentTarget.dataset.entry || 'assistant';
    this.setData({ defaultEntry: entry });
    wx.setStorageSync('defaultEntry', entry);
    wx.showToast({ title: '默认入口已更新', icon: 'success', duration: 1000 });
  },

  clearChatHistory: function() {
    wx.showModal({
      title: '清空聊天记录',
      content: '确定清空本机保存的 AI小福聊天记录吗？不会影响后台配置。',
      success: function(res) {
        if (res.confirm) {
          wx.removeStorageSync('humanChatHistory');
          wx.removeStorageSync('chatHistory');
          wx.showToast({ title: '聊天记录已清空', icon: 'success' });
        }
      }
    });
  },

  clearAssistantPreset: function() {
    wx.removeStorageSync('assistantPreset');
    wx.removeStorageSync('chatMode');
    wx.showToast({ title: '入口偏好已清空', icon: 'success' });
  },

  clearAllLocal: function() {
    var that = this;
    wx.showModal({
      title: '清空本地缓存',
      content: '将清空聊天记录、默认聊天形态、首页预填内容和入口偏好。不会删除后台产品库或聊天日志。',
      success: function(res) {
        if (res.confirm) {
          wx.removeStorageSync('humanChatHistory');
          wx.removeStorageSync('chatHistory');
          wx.removeStorageSync('chatForm');
          wx.removeStorageSync('chatMode');
          wx.removeStorageSync('assistantPreset');
          wx.removeStorageSync('defaultEntry');
          wx.removeStorageSync('keepChatHistory');
          that.loadSettings();
          wx.showToast({ title: '本地缓存已清空', icon: 'success' });
        }
      }
    });
  },

  showRiskInfo: function() {
    wx.showModal({
      title: '风控说明',
      content: '客服助手使用 work 模式生成客户回复，仍会执行平台合规与违禁词检测。AI聊天/真人聊天按陪伴聊天方向处理，不替代客服风控。',
      showCancel: false
    });
  },

  showVersion: function() {
    wx.showModal({
      title: '版本信息',
      content: '当前版本：' + (this.data.version || '2.0.0') + '\n生产接口保持为项目既有配置，不在小程序设置中展示或修改后台敏感配置。',
      showCancel: false
    });
  }
});
