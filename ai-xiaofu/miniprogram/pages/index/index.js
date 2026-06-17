var app = getApp();

Page({
  data: {
    inputText: '',
    outputText: '',
    generating: false,
    errorMsg: '',
    responseInfo: '',
    isViolation: false,
    // 模式：work=普通聊天模式(客服), chat=AI小福模式
    chatMode: 'work',
    // AI小福聊天模式的历史记录
    chatHistory: []
  },

  onLoad: function() {
    // 恢复上次的模式
    var savedMode = wx.getStorageSync('chatMode');
    if (savedMode) {
      this.setData({ chatMode: savedMode });
    }
    // 恢复聊天历史
    var savedHistory = wx.getStorageSync('chatHistory');
    if (savedHistory) {
      try {
        this.setData({ chatHistory: JSON.parse(savedHistory) });
      } catch (e) {
        this.setData({ chatHistory: [] });
      }
    }
    this.fetchOpening();
  },

  fetchOpening: function() {
    wx.request({
      url: app.globalData.apiBase + '/api/chat/public-info',
      success: function(res) {
        if (res.data && res.data.code === 200 && res.data.data && res.data.data.opening) {
          app.globalData.opening = res.data.data.opening;
        }
      }
    });
  },

  // 切换模式
  switchMode: function(e) {
    var mode = e.currentTarget.dataset.mode;
    if (mode === this.data.chatMode) return;

    this.setData({
      chatMode: mode,
      inputText: '',
      outputText: '',
      errorMsg: '',
      responseInfo: '',
      isViolation: false
    });
    wx.setStorageSync('chatMode', mode);

    if (mode === 'chat') {
      wx.showToast({ title: '已进入AI小福模式 💕', icon: 'none', duration: 1500 });
    } else {
      wx.showToast({ title: '已切换到普通聊天模式 💼', icon: 'none', duration: 1500 });
    }
  },

  onInputChange: function(e) {
    this.setData({ inputText: e.detail.value, errorMsg: '' });
  },

  // 核心：发送消息
  generateReply: function() {
    var question = this.data.inputText.trim();
    if (!question) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
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
      isViolation: false
    });

    app.request('/api/chat/generate', 'POST', {
      question: question,
      session_id: app.globalData.sessionId,
      mode: this.data.chatMode
    }).then(function(res) {
      if (res.code === 200) {
        var info = 'API: ' + (res.data.api || '') + ' · ' + (res.data.response_time_ms || 0) + 'ms';
        that.setData({
          outputText: res.data.reply,
          responseInfo: info,
          isViolation: res.data.is_violation || false,
          generating: false
        });

        // AI小福模式：保存对话历史
        if (that.data.chatMode === 'chat') {
          var history = that.data.chatHistory.slice(-40); // 最多保留40条
          history.push({ role: 'user', content: question });
          history.push({ role: 'assistant', content: res.data.reply });
          that.setData({ chatHistory: history });
          wx.setStorageSync('chatHistory', JSON.stringify(history));
        }

        // AI小福模式：生成完成后清空输入框
        if (that.data.chatMode === 'chat') {
          that.setData({ inputText: '' });
        }

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

  // 一键清空
  clearAll: function() {
    var that = this;
    // AI小福模式：清空聊天历史
    if (this.data.chatMode === 'chat') {
      wx.showModal({
        title: '清空对话',
        content: '确定要清空和小福的全部对话记录吗？',
        success: function(modalRes) {
          if (modalRes.confirm) {
            that.setData({
              inputText: '',
              outputText: '',
              errorMsg: '',
              responseInfo: '',
              isViolation: false,
              chatHistory: []
            });
            wx.setStorageSync('chatHistory', '[]');
            wx.showToast({ title: '对话已清空', icon: 'success', duration: 1000 });
          }
        }
      });
    } else {
      this.setData({
        inputText: '',
        outputText: '',
        errorMsg: '',
        responseInfo: '',
        isViolation: false
      });
      wx.showToast({ title: '已清空', icon: 'success', duration: 1000 });
    }
  },

  // 一键复制结果
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
      title: 'AI小福 - 建站接单客服助手，一键生成合规回复',
      path: '/pages/index/index'
    };
  }
});
