var app = getApp();

Page({
  data: {
    inputText: '',
    outputText: '',
    generating: false,
    errorMsg: '',
    responseInfo: '',
    isViolation: false,
    showAssistant: false,
    sampleQuestions: [
      '客户问：做一个企业官网多少钱？包含哪些服务？',
      '客户问：多久能做好小程序？后期能不能维护？',
      '客户问：我只有一个想法，你们能不能帮我整理方案？'
    ],
    quickStats: [
      { value: '合规', label: '客服回复风控' },
      { value: '产品库', label: '自动结合报价' },
      { value: 'AI', label: '小福陪伴聊天' }
    ]
  },

  onLoad: function() {
    this.loadAssistantPreset();
  },

  onShow: function() {
    this.loadAssistantPreset();
  },

  loadAssistantPreset: function() {
    var preset = wx.getStorageSync('assistantPreset');
    if (preset) {
      this.setData({
        inputText: preset,
        showAssistant: true,
        outputText: '',
        errorMsg: '',
        responseInfo: '',
        isViolation: false
      });
      wx.removeStorageSync('assistantPreset');
    }
  },

  goProducts: function() {
    wx.switchTab({ url: '/pages/ecommerce/ecommerce' });
  },

  goChat: function() {
    var chatForm = wx.getStorageSync('chatForm') || app.globalData.chatModeDefault || 'friend';
    wx.navigateTo({
      url: '/pages/chat/chat?chatForm=' + chatForm
    });
  },

  goProfile: function() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  openAssistant: function() {
    this.setData({ showAssistant: true });
  },

  closeAssistant: function() {
    this.setData({ showAssistant: false });
  },

  toggleAssistant: function() {
    this.setData({ showAssistant: !this.data.showAssistant });
  },

  useSample: function(e) {
    var text = e.currentTarget.dataset.text || '';
    this.setData({
      inputText: text,
      showAssistant: true,
      errorMsg: '',
      outputText: '',
      responseInfo: '',
      isViolation: false
    });
  },

  onInputChange: function(e) {
    this.setData({ inputText: e.detail.value, errorMsg: '' });
  },

  generateReply: function() {
    var question = this.data.inputText.trim();
    if (!question) {
      wx.showToast({ title: '请输入客户咨询内容', icon: 'none' });
      return;
    }

    if (question.length < 2) {
      wx.showToast({ title: '内容太短，请输入完整内容', icon: 'none' });
      return;
    }

    var that = this;
    this.setData({
      generating: true,
      outputText: '',
      errorMsg: '',
      responseInfo: '',
      isViolation: false,
      showAssistant: true
    });

    app.request('/api/chat/generate', 'POST', {
      question: question,
      session_id: app.globalData.sessionId,
      mode: 'work',
      chat_form: wx.getStorageSync('chatForm') || app.globalData.chatModeDefault || 'friend'
    }, { timeout: 20000 }).then(function(res) {
      if (res.code === 200) {
        var info = 'API: ' + (res.data.api || '') + ' · ' + (res.data.response_time_ms || 0) + 'ms';
        that.setData({
          outputText: res.data.reply,
          responseInfo: info,
          isViolation: res.data.is_violation || false,
          generating: false
        });

        if (res.data.type === 'fallback') {
          wx.showToast({ title: '已触发默认回复', icon: 'none' });
        }
      } else {
        that.setData({
          generating: false,
          errorMsg: res.message || 'AI服务返回异常，请稍后重试'
        });
        wx.showToast({ title: '生成失败，请重试', icon: 'none' });
      }
    }).catch(function(err) {
      that.setData({
        generating: false,
        errorMsg: err.message || '网络异常，请检查网络连接后重试'
      });
      wx.showToast({ title: '网络异常，请检查连接', icon: 'none' });
    });
  },

  clearAll: function() {
    this.setData({
      inputText: '',
      outputText: '',
      errorMsg: '',
      responseInfo: '',
      isViolation: false
    });
    wx.showToast({ title: '已清空', icon: 'success', duration: 1000 });
  },

  copyResult: function() {
    var text = this.data.outputText;
    if (!text) {
      wx.showToast({ title: '没有可复制的内容', icon: 'none' });
      return;
    }

    wx.setClipboardData({
      data: text,
      success: function() {
        wx.showToast({ title: '已复制，可直接粘贴回复客户', icon: 'success', duration: 2000 });
      },
      fail: function() {
        wx.showToast({ title: '复制失败，请手动长按复制', icon: 'none' });
      }
    });
  },

  onShareAppMessage: function() {
    return {
      title: 'AI小福 - 建站接单客服助手',
      path: '/pages/index/index'
    };
  }
});
