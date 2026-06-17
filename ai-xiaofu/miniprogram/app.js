App({
  globalData: {
    apiBase: 'https://wfr.ccvo.top',
    sessionId: '',
    opening: '您好！我是您的专属建站顾问小福😊 请问有什么可以帮您的？'
  },

  onLaunch: function() {
    var sid = wx.getStorageSync('session_id');
    if (sid) {
      this.globalData.sessionId = sid;
    } else {
      this.globalData.sessionId = 'wx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      wx.setStorageSync('session_id', this.globalData.sessionId);
    }
    this.fetchOpening();
  },

  fetchOpening: function() {
    var that = this;
    wx.request({
      url: this.globalData.apiBase + '/api/chat/public-info',
      success: function(res) {
        if (res.data && res.data.code === 200 && res.data.data && res.data.data.opening) {
          that.globalData.opening = res.data.data.opening;
        }
      }
    });
  },

  request: function(url, method, data) {
    var m = method || 'GET';
    var d = data || {};
    var that = this;
    return new Promise(function(resolve, reject) {
      wx.request({
        url: that.globalData.apiBase + url,
        method: m,
        data: d,
        header: { 'Content-Type': 'application/json' },
        success: function(res) {
          if (res.statusCode === 200 && res.data) {
            resolve(res.data);
          } else {
            var msg = (res.data && res.data.message) ? res.data.message : '请求失败';
            reject(new Error(msg));
          }
        },
        fail: function(err) {
          reject(new Error('网络异常，请检查网络连接'));
        }
      });
    });
  }
});
