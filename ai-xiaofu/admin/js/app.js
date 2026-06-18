const { createApp, ref, reactive, computed, onMounted, watch } = Vue;

const app = createApp({
  setup() {
    // 全局
    const apiBase = '';
    const token = ref(localStorage.getItem('xiaofu_token') || '');
    const loggedIn = ref(false);
    const activeMenu = ref('dashboard');
    const saving = ref(false);
    const mobileMenuOpen = ref(false);

    // 页面元信息
    const menuMeta = {
      dashboard: {
        title: '运营概览',
        eyebrow: 'Dashboard',
        description: '查看调用量、风控触发与平均响应效率。'
      },
      'ai-settings': {
        title: 'AI 个性设置',
        eyebrow: 'Persona',
        description: '调整回复风格、记忆、开场白与系统提示词。'
      },
      products: {
        title: '产品价格库',
        eyebrow: 'Products',
        description: '维护建站服务、价格、交付周期与售后说明。'
      },
      apis: {
        title: '大模型 API',
        eyebrow: 'LLM APIs',
        description: '管理主备接口、模型参数与连通性测试。'
      },
      logs: {
        title: '对话日志',
        eyebrow: 'Logs',
        description: '检索客户问题、AI 回复、响应耗时与风控记录。'
      },
      banned: {
        title: '风控词库',
        eyebrow: 'Risk Control',
        description: '维护违禁词、正则规则并进行合规检测。'
      }
    };

    const currentPageMeta = computed(() => menuMeta[activeMenu.value] || menuMeta.dashboard);

    // 登录
    const loginPassword = ref('');
    const loginLoading = ref(false);
    const loginError = ref('');

    async function doLogin() {
      loginError.value = '';
      if (!loginPassword.value) { loginError.value = '请输入密码'; return; }
      loginLoading.value = true;
      try {
        const res = await fetch(apiBase + '/api/auth/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: loginPassword.value })
        });
        const data = await res.json();
        if (data.code === 200) {
          token.value = data.data.token;
          localStorage.setItem('xiaofu_token', token.value);
          loggedIn.value = true;
          loadAll();
        } else {
          loginError.value = data.message;
        }
      } catch (e) {
        loginError.value = '网络错误，请检查后端服务是否启动';
      }
      loginLoading.value = false;
    }

    function logout() {
      token.value = '';
      loggedIn.value = false;
      localStorage.removeItem('xiaofu_token');
    }

    async function request(url, options = {}) {
      const headers = { 'Content-Type': 'application/json', ...options.headers };
      if (token.value) headers['Authorization'] = `Bearer ${token.value}`;
      const res = await fetch(apiBase + url, { ...options, headers });
      const data = await res.json();
      if (data.code === 401) { logout(); throw new Error('登录已过期'); }
      return data;
    }

    async function downloadFile(url, filename) {
      const headers = {};
      if (token.value) headers['Authorization'] = `Bearer ${token.value}`;
      const res = await fetch(apiBase + url, { headers });
      if (res.status === 401) { logout(); throw new Error('登录已过期'); }
      if (!res.ok) throw new Error('导出失败');
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(link.href);
      document.body.removeChild(link);
    }

    function showMsg(msg, type = 'success') {
      ElementPlus.ElMessage({ message: msg, type: type });
    }

    // ==================== 仪表盘 ====================
    const stats = reactive([
      { label: '今日调用', value: 0 }, { label: '总调用次数', value: 0 },
      { label: '触发风控', value: 0 }, { label: '平均响应(ms)', value: 0 }
    ]);

    async function loadStats() {
      try {
        const d = await request('/api/logs/stats');
        if (d.code === 200) {
          stats[0].value = d.data.today;
          stats[1].value = d.data.total;
          stats[2].value = d.data.violations;
          stats[3].value = d.data.avg_response_ms;
        }
      } catch (e) { console.error(e); }
    }

    // ==================== AI设置 ====================
    const aiForm = reactive({
      personality: '', reply_max_length: 500, reply_in_paragraphs: 1,
      proactive_follow_up: 1, ban_internet_slang: 1, ban_marketing_words: 1,
      reply_tone: '专业温和', memory_enabled: 1, memory_retention_days: 30,
      default_opening: '', fallback_reply: '', custom_system_prompt: '',
      chat_mode: 'friend', ai_temperature: 0.7, ai_interests: '',
      enable_human_mode: 0, human_mode_tip: ''
    });

    async function loadAiSettings() {
      try {
        const d = await request('/api/ai-settings');
        if (d.code === 200 && d.data) {
          Object.assign(aiForm, d.data);
          aiForm.ai_temperature = Number(aiForm.ai_temperature || 0.7);
          aiForm.enable_human_mode = aiForm.enable_human_mode ? 1 : 0;
          // 将JSON格式的兴趣爱好转换回多行文本
          if (d.data.ai_interests) {
            try {
              const interests = typeof d.data.ai_interests === 'string'
                ? JSON.parse(d.data.ai_interests)
                : d.data.ai_interests;
              const lines = [];
              for (const [key, value] of Object.entries(interests)) {
                lines.push(`${key}：${value}`);
              }
              aiForm.ai_interests = lines.join('\n');
            } catch (e) {
              aiForm.ai_interests = d.data.ai_interests;
            }
          }
        }
      } catch (e) { console.error(e); }
    }

    async function saveAiSettings() {
      saving.value = true;
      try {
        const d = await request('/api/ai-settings', { method: 'PUT', body: JSON.stringify(aiForm) });
        showMsg(d.message || '保存成功');
      } catch (e) { showMsg('保存失败', 'error'); }
      saving.value = false;
    }

    async function clearMemories() {
      try {
        await ElementPlus.ElMessageBox.confirm('确定清空全部AI记忆吗？', '确认', { type: 'warning' });
        await request('/api/ai-settings/clear-memories', { method: 'POST' });
        showMsg('全部记忆已清空');
      } catch (e) { /* cancel */ }
    }

    // ==================== 产品库 ====================
    const productList = ref([]);
    const productTotal = ref(0);
    const productSearch = ref('');
    const productCategoryFilter = ref(null);
    const categories = ref([]);
    const productDialogVisible = ref(false);
    const editingProduct = ref({});
    const productLoading = ref(false);
    const productPage = ref(1);
    const productPageSize = 20;
    const productFormRef = ref(null);
    let productSearchTimer = null;
    let productRequestSeq = 0;
    const productForm = reactive({
      category_id: null, name: '', description: '', standard_price: 0,
      discount_price: 0, included_services: '', excluded_services: '',
      delivery_days: '', after_sales: '', is_active: 1, faq: {}
    });
    const productRules = {
      name: [{ required: true, message: '请输入产品名称', trigger: 'blur' }]
    };
    const activeProductCount = computed(() => productList.value.filter(p => p.is_active).length);

    async function loadCategories() {
      try {
        const d = await request('/api/products/categories');
        if (d.code === 200) categories.value = d.data;
      } catch (e) { console.error(e); }
    }

    function emptyProductForm() {
      return {
        category_id: null,
        name: '',
        description: '',
        standard_price: 0,
        discount_price: 0,
        included_services: '',
        excluded_services: '',
        delivery_days: '',
        after_sales: '',
        is_active: 1,
        faq: {}
      };
    }

    function parseFaq(value) {
      if (!value) return {};
      if (typeof value === 'object') return value;
      try { return JSON.parse(value); }
      catch (e) { return {}; }
    }

    function fillProductForm(row = {}) {
      Object.assign(productForm, emptyProductForm(), {
        category_id: row.category_id ?? null,
        name: row.name ?? '',
        description: row.description ?? '',
        standard_price: Number(row.standard_price ?? 0),
        discount_price: Number(row.discount_price ?? 0),
        included_services: row.included_services ?? '',
        excluded_services: row.excluded_services ?? '',
        delivery_days: row.delivery_days ?? '',
        after_sales: row.after_sales ?? '',
        is_active: row.is_active ?? 1,
        faq: parseFaq(row.faq)
      });
    }

    function normalizeProductPayload() {
      return {
        category_id: productForm.category_id === '' ? null : productForm.category_id,
        name: String(productForm.name || '').trim(),
        description: productForm.description || '',
        standard_price: Number(productForm.standard_price) || 0,
        discount_price: Number(productForm.discount_price) || 0,
        included_services: productForm.included_services || '',
        excluded_services: productForm.excluded_services || '',
        delivery_days: productForm.delivery_days || '',
        after_sales: productForm.after_sales || '',
        is_active: productForm.is_active ?? 1,
        faq: productForm.faq || {}
      };
    }

    async function loadProducts(page = productPage.value || 1) {
      const pageNumber = Number(page) || 1;
      productPage.value = pageNumber;
      productLoading.value = true;
      const seq = ++productRequestSeq;
      try {
        const params = new URLSearchParams({ page: String(pageNumber), limit: String(productPageSize) });
        if (productSearch.value) params.append('keyword', productSearch.value.trim());
        if (productCategoryFilter.value) params.append('category_id', productCategoryFilter.value);
        const d = await request('/api/products?' + params);
        if (seq === productRequestSeq && d.code === 200) {
          productList.value = d.data.list || [];
          productTotal.value = Number(d.data.total || 0);
        } else if (d.code !== 200) {
          showMsg(d.message || '加载产品失败', 'error');
        }
      } catch (e) { console.error(e); }
      finally { if (seq === productRequestSeq) productLoading.value = false; }
    }

    function applyProductFilters() {
      loadProducts(1);
    }

    function queueProductSearch() {
      clearTimeout(productSearchTimer);
      productSearchTimer = setTimeout(() => loadProducts(1), 300);
    }

    function resetProductFilters() {
      productSearch.value = '';
      productCategoryFilter.value = null;
      loadProducts(1);
    }

    function money(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return '0';
      return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
    }

    async function reloadProductsAfterMutation(preferCurrentPage = true) {
      await loadProducts(preferCurrentPage ? productPage.value : 1);
      if (productList.value.length === 0 && productTotal.value > 0 && productPage.value > 1) {
        await loadProducts(productPage.value - 1);
      }
    }

    function showProductDialog(row = null) {
      if (row) {
        editingProduct.value = row;
        fillProductForm(row);
      } else {
        editingProduct.value = {};
        fillProductForm();
      }
      productDialogVisible.value = true;
    }

    function resetProductForm() {
      editingProduct.value = {};
      fillProductForm();
      productFormRef.value?.clearValidate?.();
    }

    async function saveProduct() {
      if (productFormRef.value) {
        try { await productFormRef.value.validate(); }
        catch (e) { return; }
      }
      saving.value = true;
      try {
        const isEdit = Boolean(editingProduct.value.id);
        const method = isEdit ? 'PUT' : 'POST';
        const url = isEdit ? `/api/products/${editingProduct.value.id}` : '/api/products';
        const d = await request(url, { method, body: JSON.stringify(normalizeProductPayload()) });
        if (d.code !== 200) { showMsg(d.message || '保存失败', 'error'); return; }
        showMsg(d.message || '保存成功');
        productDialogVisible.value = false;
        await reloadProductsAfterMutation(isEdit);
      } catch (e) { showMsg('保存失败', 'error'); }
      finally { saving.value = false; }
    }

    async function toggleProduct(row) {
      try {
        const d = await request(`/api/products/${row.id}/toggle`, { method: 'PUT' });
        if (d.code !== 200) { showMsg(d.message || '操作失败', 'error'); return; }
        showMsg(d.message);
        await reloadProductsAfterMutation(true);
      } catch (e) { showMsg('操作失败', 'error'); }
    }

    async function deleteProduct(id) {
      try {
        await ElementPlus.ElMessageBox.confirm('确定删除该产品？', '确认', { type: 'warning' });
        const d = await request(`/api/products/${id}`, { method: 'DELETE' });
        if (d.code !== 200) { showMsg(d.message || '删除失败', 'error'); return; }
        showMsg('已删除');
        await reloadProductsAfterMutation(true);
      } catch (e) { /* cancel */ }
    }

    async function exportProducts() {
      try {
        await downloadFile('/api/products/export', 'products.xlsx');
      } catch (e) {
        showMsg(e.message || '导出失败', 'error');
      }
    }

    function onImportSuccess(res) {
      if (res.code === 200) { showMsg(res.message); loadProducts(1); }
      else showMsg(res.message || '导入失败', 'error');
    }

    function onImportError(err) {
      const status = err?.status || err?.target?.status;
      if (status === 401) { logout(); showMsg('登录已过期，请重新登录', 'error'); return; }
      showMsg('导入失败，请检查文件格式和登录状态', 'error');
    }

    const uploadHeaders = computed(() => ({ Authorization: `Bearer ${token.value}` }));

    // ==================== API管理 ====================
    const apiList = ref([]);
    const apiDialogVisible = ref(false);
    const editingApi = ref({});
    const apiForm = reactive({
      name: '', api_type: 'deepseek', api_key: '', api_url: '',
      model: '', temperature: 0.7, max_tokens: 2000, timeout_seconds: 30
    });

    async function loadApis() {
      try {
        const d = await request('/api/apis');
        if (d.code === 200) apiList.value = d.data;
      } catch (e) { console.error(e); }
    }

    function showApiDialog(row = null) {
      if (row) {
        editingApi.value = row;
        Object.assign(apiForm, { ...row, api_key: '' });
      } else {
        editingApi.value = {};
        Object.keys(apiForm).forEach(k => apiForm[k] = k === 'temperature' ? 0.7 : k === 'max_tokens' ? 2000 : k === 'timeout_seconds' ? 30 : k === 'api_type' ? 'deepseek' : '');
      }
      apiDialogVisible.value = true;
    }

    async function saveApi() {
      saving.value = true;
      try {
        const method = editingApi.value.id ? 'PUT' : 'POST';
        const url = editingApi.value.id ? `/api/apis/${editingApi.value.id}` : '/api/apis';
        const d = await request(url, { method, body: JSON.stringify(apiForm) });
        showMsg(d.message || '保存成功');
        apiDialogVisible.value = false;
        loadApis();
      } catch (e) { showMsg('保存失败', 'error'); }
      saving.value = false;
    }

    async function deleteApi(id) {
      try {
        await ElementPlus.ElMessageBox.confirm('确定删除该API？', '确认', { type: 'warning' });
        await request(`/api/apis/${id}`, { method: 'DELETE' });
        showMsg('已删除');
        loadApis();
      } catch (e) { /* cancel */ }
    }

    async function setPrimaryApi(id) {
      try {
        await request(`/api/apis/${id}/primary`, { method: 'PUT' });
        showMsg('已设为主API');
        loadApis();
      } catch (e) { showMsg('设置失败', 'error'); }
    }

    async function testApi(row) {
      try {
        const d = await request(`/api/apis/${row.id}/test`, { method: 'POST' });
        if (d.code === 200) {
          ElementPlus.ElMessageBox.alert(
            `响应: ${d.data.response}\n耗时: ${d.data.response_time_ms}ms\n模型: ${d.data.model}`,
            '测试成功', { type: 'success' }
          );
        } else {
          ElementPlus.ElMessageBox.alert(d.message, '测试失败', { type: 'error' });
        }
      } catch (e) { showMsg('测试失败', 'error'); }
    }

    // ==================== 对话日志 ====================
    const logList = ref([]);
    const logTotal = ref(0);
    const logSearch = ref('');
    const logDateRange = ref(null);

    async function loadLogs(page = 1) {
      try {
        const params = new URLSearchParams({ page, limit: 50 });
        if (logSearch.value) params.append('keyword', logSearch.value);
        if (logDateRange.value && logDateRange.value.length === 2) {
          params.append('date_from', logDateRange.value[0]);
          params.append('date_to', logDateRange.value[1]);
        }
        const d = await request('/api/logs?' + params);
        if (d.code === 200) { logList.value = d.data.list; logTotal.value = d.data.total; }
      } catch (e) { console.error(e); }
    }

    async function deleteLog(id) {
      try { await request(`/api/logs/${id}`, { method: 'DELETE' }); showMsg('已删除'); loadLogs(); }
      catch (e) { showMsg('删除失败', 'error'); }
    }

    async function exportLogs() {
      try {
        await downloadFile('/api/logs/export', 'logs.json');
      } catch (e) {
        showMsg(e.message || '导出失败', 'error');
      }
    }

    // ==================== 违禁词库 ====================
    const bannedList = ref([]);
    const bannedDialogVisible = ref(false);
    const editingBanned = ref({});
    const bannedForm = reactive({ word: '', category: '通用', is_regex: 0, is_active: 1 });
    const bannedCheckText = ref('');

    async function loadBanned() {
      try {
        const d = await request('/api/banned-words');
        if (d.code === 200) bannedList.value = d.data;
      } catch (e) { console.error(e); }
    }

    function showBannedDialog(row = null) {
      if (row) { editingBanned.value = row; Object.assign(bannedForm, row); }
      else { editingBanned.value = {}; bannedForm.word = ''; bannedForm.category = '通用'; bannedForm.is_regex = 0; bannedForm.is_active = 1; }
      bannedDialogVisible.value = true;
    }

    async function saveBanned() {
      try {
        const method = editingBanned.value.id ? 'PUT' : 'POST';
        const url = editingBanned.value.id ? `/api/banned-words/${editingBanned.value.id}` : '/api/banned-words';
        await request(url, { method, body: JSON.stringify(bannedForm) });
        showMsg('已保存'); bannedDialogVisible.value = false; loadBanned();
      } catch (e) { showMsg('保存失败', 'error'); }
    }

    async function deleteBanned(id) {
      try { await request(`/api/banned-words/${id}`, { method: 'DELETE' }); showMsg('已删除'); loadBanned(); }
      catch (e) { showMsg('删除失败', 'error'); }
    }

    async function checkBannedText() {
      if (!bannedCheckText.value.trim()) { showMsg('请输入要检测的内容', 'error'); return; }
      try {
        const d = await request('/api/banned-words/check', { method: 'POST', body: JSON.stringify({ text: bannedCheckText.value }) });
        if (d.code === 200) {
          if (d.data.has_violation) {
            ElementPlus.ElMessageBox.alert(
              `检测到 ${d.data.count} 个违禁词：\n${d.data.violations.map(v => v.word + '[' + v.category + ']').join('\n')}`,
              '违规检测结果', { type: 'warning' }
            );
          } else {
            showMsg('✓ 内容合规，未检测到违禁词');
          }
        }
      } catch (e) { showMsg('检测失败', 'error'); }
    }

    // ==================== 导航 ====================
    function switchMenu(index) {
      activeMenu.value = index;
      mobileMenuOpen.value = false;
      const loaders = {
        dashboard: loadStats, 'ai-settings': loadAiSettings, products: loadProducts,
        apis: loadApis, logs: loadLogs, banned: loadBanned
      };
      if (loaders[index]) loaders[index]();
    }

    function loadAll() {
      loadStats();
      loadCategories();
    }

    // ==================== 初始化 ====================
    onMounted(async () => {
      if (token.value) {
        try {
          const d = await request('/api/auth/verify');
          if (d.code === 200) { loggedIn.value = true; loadAll(); }
          else logout();
        } catch (e) { logout(); }
      }
    });

    // 定时检查30分钟超时
    setInterval(async () => {
      if (loggedIn.value && token.value) {
        try {
          const d = await request('/api/auth/verify');
          if (d.code !== 200) { logout(); showMsg('登录已超时（30分钟），请重新登录', 'error'); }
        } catch (e) { logout(); }
      }
    }, 60000);

    return {
      apiBase, token, loggedIn, activeMenu, saving, mobileMenuOpen,
      menuMeta, currentPageMeta,
      loginPassword, loginLoading, loginError, doLogin, logout,
      stats,
      aiForm, loadAiSettings, saveAiSettings, clearMemories,
      productList, productTotal, productSearch, productCategoryFilter, categories,
      productDialogVisible, editingProduct, productForm, productRules, productFormRef,
      productLoading, productPage, productPageSize, activeProductCount,
      showProductDialog, resetProductForm, saveProduct, toggleProduct, deleteProduct,
      exportProducts, onImportSuccess, onImportError, uploadHeaders, loadProducts, loadCategories,
      queueProductSearch, applyProductFilters, resetProductFilters, money,
      apiList, apiDialogVisible, editingApi, apiForm,
      showApiDialog, saveApi, deleteApi, setPrimaryApi, testApi, loadApis,
      logList, logTotal, logSearch, logDateRange, loadLogs, deleteLog, exportLogs,
      bannedList, bannedDialogVisible, editingBanned, bannedForm, bannedCheckText,
      showBannedDialog, saveBanned, deleteBanned, checkBannedText, loadBanned,
      switchMenu,
    };
  }
});

// 注册Element Plus 与图标（CDN模式）
app.use(ElementPlus);
if (window.ElementPlusIconsVue) {
  Object.entries(window.ElementPlusIconsVue).forEach(([name, component]) => {
    app.component(name, component);
  });
}
app.mount('#app');
