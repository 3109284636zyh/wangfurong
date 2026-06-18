var app = getApp();

Page({
  data: {
    loading: false,
    errorMsg: '',
    products: [],
    displayProducts: [],
    categories: ['全部'],
    activeCategory: '全部',
    currentProduct: null,
    showDetail: false
  },

  onLoad: function() {
    this.fetchProducts();
  },

  onPullDownRefresh: function() {
    this.fetchProducts(function() {
      wx.stopPullDownRefresh();
    });
  },

  fetchProducts: function(done) {
    var that = this;
    this.setData({ loading: true, errorMsg: '' });

    app.request('/api/products/public', 'GET', {}, { timeout: 12000 }).then(function(res) {
      if (res.code === 200) {
        var list = that.normalizeProducts(res.data || []);
        var categories = that.buildCategories(list);
        that.setData({
          products: list,
          categories: categories,
          loading: false,
          activeCategory: categories.indexOf(that.data.activeCategory) >= 0 ? that.data.activeCategory : '全部'
        });
        that.filterProducts();
      } else {
        that.setData({
          loading: false,
          errorMsg: res.message || '产品获取失败，请稍后重试'
        });
      }
      if (typeof done === 'function') done();
    }).catch(function(err) {
      that.setData({
        loading: false,
        errorMsg: err.message || '网络异常，请稍后重试'
      });
      if (typeof done === 'function') done();
    });
  },

  normalizeProducts: function(rows) {
    return rows.map(function(item) {
      var categoryName = item.category_name || '未分类';
      var discount = Number(item.discount_price || 0);
      var standard = Number(item.standard_price || 0);
      var price = discount > 0 ? discount : standard;
      var priceText = price > 0 ? '￥' + price + '起' : '按需报价';
      var description = item.description || '暂无详细介绍，可在后台产品库补充服务说明。';
      var summary = description.length > 52 ? description.slice(0, 52) + '...' : description;

      return {
        id: item.id,
        name: item.name || '未命名产品',
        categoryName: categoryName,
        description: description,
        summary: summary,
        priceText: priceText,
        standardPrice: standard,
        discountPrice: discount,
        includedServices: item.included_services || '暂无包含服务说明',
        excludedServices: item.excluded_services || '暂无不包含服务说明',
        deliveryDays: item.delivery_days || '周期按需求评估',
        afterSales: item.after_sales || '售后按项目约定执行'
      };
    });
  },

  buildCategories: function(list) {
    var map = { '全部': true };
    var categories = ['全部'];
    list.forEach(function(item) {
      if (item.categoryName && !map[item.categoryName]) {
        map[item.categoryName] = true;
        categories.push(item.categoryName);
      }
    });
    return categories;
  },

  selectCategory: function(e) {
    var category = e.currentTarget.dataset.category || '全部';
    this.setData({ activeCategory: category, showDetail: false, currentProduct: null });
    this.filterProducts();
  },

  filterProducts: function() {
    var active = this.data.activeCategory;
    var list = this.data.products;
    if (active !== '全部') {
      list = list.filter(function(item) {
        return item.categoryName === active;
      });
    }
    this.setData({ displayProducts: list });
  },

  showProductDetail: function(e) {
    var id = Number(e.currentTarget.dataset.id || 0);
    var product = null;
    for (var i = 0; i < this.data.products.length; i++) {
      if (Number(this.data.products[i].id) === id) {
        product = this.data.products[i];
        break;
      }
    }
    if (!product) return;
    this.setData({ currentProduct: product, showDetail: true });
  },

  closeDetail: function() {
    this.setData({ showDetail: false, currentProduct: null });
  },

  noop: function() {},

  copyProductInfo: function(e) {
    var product = this.getProductByEvent(e) || this.data.currentProduct;
    if (!product) return;
    wx.setClipboardData({
      data: this.buildProductText(product),
      success: function() {
        wx.showToast({ title: '产品信息已复制', icon: 'success' });
      }
    });
  },

  generateReplyForProduct: function(e) {
    var product = this.getProductByEvent(e) || this.data.currentProduct;
    if (!product) return;
    var preset = '客户正在咨询“' + product.name + '”。请结合以下产品信息，生成一段适合闲鱼/淘宝/拼多多沟通的合规回复：\n\n' + this.buildProductText(product);
    wx.setStorageSync('assistantPreset', preset);
    wx.switchTab({ url: '/pages/index/index' });
  },

  getProductByEvent: function(e) {
    var id = Number((e && e.currentTarget && e.currentTarget.dataset.id) || 0);
    if (!id) return null;
    for (var i = 0; i < this.data.products.length; i++) {
      if (Number(this.data.products[i].id) === id) return this.data.products[i];
    }
    return null;
  },

  buildProductText: function(product) {
    return [
      '产品：' + product.name,
      '分类：' + product.categoryName,
      '价格：' + product.priceText,
      '交付周期：' + product.deliveryDays,
      '简介：' + product.description,
      '包含服务：' + product.includedServices,
      '不包含服务：' + product.excludedServices,
      '售后保障：' + product.afterSales
    ].join('\n');
  },

  goAssistant: function() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  onShareAppMessage: function() {
    return {
      title: 'AI小福 - 建站产品与服务',
      path: '/pages/ecommerce/ecommerce'
    };
  }
});
