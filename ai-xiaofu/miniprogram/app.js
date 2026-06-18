// 环境配置
const ENV_CONFIG = {
  // 开发环境
  development: {
    apiBase: 'http://localhost:3000',
    debug: true
  },
  // 测试环境
  test: {
    apiBase: 'https://test.wfr.ccvo.top',
    debug: true
  },
  // 生产环境
  production: {
    apiBase: 'https://wfr.ccvo.top',
    debug: false
  }
};

// 当前环境（发布时改为 'production'）
const CURRENT_ENV = 'production';

App({
  globalData: {
    ...ENV_CONFIG[CURRENT_ENV],
    sessionId: '',
    opening: '您好！我是您的专属建站顾问小福😊 请问有什么可以帮您的？',
    version: '2.0.0'
  },

  onLaunch: function() {
    this.initSession();
    this.fetchOpening();
    this.checkUpdate();

    // 开发环境显示环境标识
    if (this.globalData.debug) {
      console.log('[AI小福] 当前环境:', CURRENT_ENV);
      console.log('[AI小福] API地址:', this.globalData.apiBase);
    }
  },

  // 初始化会话ID
  initSession: function() {
    var sid = wx.getStorageSync('session_id');
    if (sid) {
      this.globalData.sessionId = sid;
    } else {
      this.globalData.sessionId = 'wx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      wx.setStorageSync('session_id', this.globalData.sessionId);
    }
  },

  // 获取开场白
  fetchOpening: function() {
    var that = this;
    wx.request({
      url: this.globalData.apiBase + '/api/chat/public-info',
      success: function(res) {
        if (res.data && res.data.code === 200 && res.data.data && res.data.data.opening) {
          that.globalData.opening = res.data.data.opening;
        }
      },
      fail: function(err) {
        if (that.globalData.debug) {
          console.error('[AI小福] 获取开场白失败:', err);
        }
      }
    });
  },

  // 检查小程序更新
  checkUpdate: function() {
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager();
      updateManager.onCheckForUpdate(function(res) {
        if (res.hasUpdate) {
          updateManager.onUpdateReady(function() {
            wx.showModal({
              title: '更新提示',
              content: '新版本已准备好，是否重启应用？',
              success: function(res) {
                if (res.confirm) {
                  updateManager.applyUpdate();
                }
              }
            });
          });
          updateManager.onUpdateFailed(function() {
            wx.showModal({
              title: '更新失败',
              content: '新版本下载失败，请删除小程序后重新搜索打开',
              showCancel: false
            });
          });
        }
      });
    }
  },

  // 封装的请求方法（支持重试）
  request: function(url, method, data, options) {
    var m = method || 'GET';
    var d = data || {};
    var opts = options || {};
    var retry = opts.retry !== undefined ? opts.retry : 2;
    var timeout = opts.timeout || 10000;
    var that = this;

    return this._requestWithRetry(url, m, d, retry, timeout);
  },

  // 带重试的请求
  _requestWithRetry: function(url, method, data, retries, timeout) {
    var that = this;
    return new Promise(function(resolve, reject) {
      wx.request({
        url: that.globalData.apiBase + url,
        method: method,
        data: data,
        header: { 'Content-Type': 'application/json' },
        timeout: timeout,
        success: function(res) {
          if (res.statusCode === 200 && res.data) {
            resolve(res.data);
          } else if (res.statusCode === 401) {
            reject(new Error('认证失败'));
          } else if (res.statusCode === 429) {
            reject(new Error('请求过于频繁，请稍后再试'));
          } else if (res.statusCode >= 500) {
            // 服务器错误，可重试
            if (retries > 0) {
              console.log('[AI小福] 请求失败，重试中...剩余次数:', retries);
              setTimeout(function() {
                that._requestWithRetry(url, method, data, retries - 1, timeout)
                  .then(resolve)
                  .catch(reject);
              }, 1000);
            } else {
              var msg = (res.data && res.data.message) ? res.data.message : '服务器错误，请稍后重试';
              reject(new Error(msg));
            }
          } else {
            var msg = (res.data && res.data.message) ? res.data.message : '请求失败';
            reject(new Error(msg));
          }
        },
        fail: function(err) {
          // 网络错误，可重试
          if (retries > 0 && err.errMsg.includes('timeout')) {
            console.log('[AI小福] 网络超时，重试中...剩余次数:', retries);
            setTimeout(function() {
              that._requestWithRetry(url, method, data, retries - 1, timeout)
                .then(resolve)
                .catch(reject);
            }, 1000);
          } else {
            reject(new Error('网络异常，请检查网络连接'));
          }
        }
      });
    });
  }
});
