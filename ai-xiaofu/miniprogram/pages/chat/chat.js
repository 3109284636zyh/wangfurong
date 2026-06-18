var app = getApp();

Page({
  data: {
    inputText: '',
    generating: false,
    errorMsg: '',
    chatForm: 'friend',
    humanModeTip: '小福正在用心回复你~',
    keepHistory: true,
    chatForms: [
      { key: 'daily', icon: '🌤️', name: '日常' },
      { key: 'friend', icon: '💬', name: '朋友' },
      { key: 'bestie', icon: '💕', name: '闺蜜' },
      { key: 'brother', icon: '💪', name: '兄弟' },
      { key: 'lover', icon: '💝', name: '恋人' }
    ],
    messages: []
  },

  onLoad: function(options) {
    var form = options.chatForm || wx.getStorageSync('chatForm') || app.globalData.chatModeDefault || 'friend';
    var keep = wx.getStorageSync('keepChatHistory');
    var keepHistory = keep === '' || keep === undefined ? true : keep !== false;
    var saved = keepHistory ? wx.getStorageSync('humanChatHistory') : '';
    var messages = [];
    if (saved) {
      try {
        messages = JSON.parse(saved) || [];
      } catch (e) {
        messages = [];
      }
    }
    if (!messages.length) {
      messages.push({
        role: 'assistant',
        content: app.globalData.opening || '你好呀，我是小福。今天想聊点什么呢？💕'
      });
    }
    this.setData({
      chatForm: form,
      humanModeTip: app.globalData.humanModeTip || '小福正在用心回复你~',
      keepHistory: keepHistory,
      messages: messages
    });
    wx.setStorageSync('chatForm', form);
  },

  switchChatForm: function(e) {
    var form = e.currentTarget.dataset.form;
    if (form === this.data.chatForm) return;
    this.setData({ chatForm: form });
    wx.setStorageSync('chatForm', form);
    var formMap = {
      daily: '日常聊天',
      friend: '朋友模式',
      bestie: '闺蜜模式',
      brother: '兄弟模式',
      lover: '恋人模式'
    };
    wx.showToast({ title: '已切换到' + (formMap[form] || '新形态'), icon: 'none', duration: 1200 });
  },

  onInputChange: function(e) {
    this.setData({ inputText: e.detail.value, errorMsg: '' });
  },

  sendMessage: function() {
    var question = this.data.inputText.trim();
    if (!question) {
      wx.showToast({ title: '请输入消息', icon: 'none' });
      return;
    }
    if (question.length < 2) {
      wx.showToast({ title: '内容太短啦', icon: 'none' });
      return;
    }

    var that = this;
    var messages = this.data.messages.slice(-60);
    messages.push({ role: 'user', content: question });
    this.setData({
      messages: messages,
      inputText: '',
      generating: true,
      errorMsg: ''
    });
    if (this.data.keepHistory) {
      wx.setStorageSync('humanChatHistory', JSON.stringify(messages));
    }

    app.request('/api/chat/generate', 'POST', {
      question: question,
      session_id: app.globalData.sessionId,
      mode: 'human',
      chat_form: this.data.chatForm
    }, { timeout: 20000 }).then(function(res) {
      if (res.code === 200) {
        var next = that.data.messages.slice(-60);
        next.push({ role: 'assistant', content: res.data.reply });
        that.setData({ messages: next, generating: false });
        if (that.data.keepHistory) {
          wx.setStorageSync('humanChatHistory', JSON.stringify(next));
        }
      } else {
        that.setData({
          generating: false,
          errorMsg: res.message || '小福回复失败，请稍后重试'
        });
      }
    }).catch(function(err) {
      that.setData({
        generating: false,
        errorMsg: err.message || '网络异常，请检查网络连接'
      });
    });
  },

  clearChat: function() {
    var that = this;
    wx.showModal({
      title: '清空聊天',
      content: '确定清空真人模式聊天记录吗？',
      success: function(res) {
        if (res.confirm) {
          var messages = [{ role: 'assistant', content: app.globalData.opening || '聊天清空啦，我们重新开始吧💕' }];
          that.setData({ messages: messages, errorMsg: '' });
          if (that.data.keepHistory) {
            wx.setStorageSync('humanChatHistory', JSON.stringify(messages));
          } else {
            wx.removeStorageSync('humanChatHistory');
          }
        }
      }
    });
  }
});
