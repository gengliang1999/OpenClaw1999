const fs = require('fs');
let s = fs.readFileSync('src/renderer/pages/settings.js', 'utf8');

// Replace replacement characters first
s = s.replace(/\ufffd/g, '?');

// The typical broken line looks like:
// { id: 'hunyuan', name: '腾讯混元', icon: '🐧', type: 'cloud', defaultUrl: 'https://...', desc: '腾讯?API' },
// Or:
// { id: 'mistral', name: 'Mistral', icon: '🌪?, type: 'cloud', defaultUrl: '...', desc: '...' },

// Let's just find and replace the known broken blocks manually using string replacement since regex might be tricky
s = s.replace(/icon: '☁️', type: 'cloud', defaultUrl: 'https:\/\/dashscope\.aliyuncs\.com\/compatible-mode\/v1', desc: '阿里云百\?API' \},/g, 
  "icon: '☁️', type: 'cloud', defaultUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', desc: '阿里云百炼 API' },");

s = s.replace(/icon: '🐾', type: 'cloud', defaultUrl: 'https:\/\/aip\.baidubce\.com\/rpc\/2\.0\/ai_custom\/v1', desc: '千帆大模型平\? \},/g, 
  "icon: '🐾', type: 'cloud', defaultUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1', desc: '千帆大模型平台' },");

s = s.replace(/icon: '🐧', type: 'cloud', defaultUrl: 'https:\/\/hunyuan\.tencentcloudapi\.com', desc: '腾讯\?API' \},/g, 
  "icon: '🐧', type: 'cloud', defaultUrl: 'https://hunyuan.tencentcloudapi.com', desc: '腾讯混元 API' },");

s = s.replace(/icon: '💡', type: 'cloud', defaultUrl: 'https:\/\/open\.bigmodel\.cn\/api\/paas\/v4', desc: 'GLM 系列大模\? \},/g, 
  "icon: '💡', type: 'cloud', defaultUrl: 'https://open.bigmodel.cn/api/paas/v4', desc: 'GLM 系列大模型' },");

s = s.replace(/icon: '🌙', type: 'cloud', defaultUrl: 'https:\/\/api\.moonshot\.cn\/v1', desc: 'Moonshot 超长上下\? \},/g, 
  "icon: '🌙', type: 'cloud', defaultUrl: 'https://api.moonshot.cn/v1', desc: 'Moonshot 超长上下文' },");

s = s.replace(/icon: '🥇', type: 'cloud', defaultUrl: 'https:\/\/api\.lingyiwanwu\.com\/v1', desc: 'Yi 系列大模\? \},/g, 
  "icon: '🥇', type: 'cloud', defaultUrl: 'https://api.lingyiwanwu.com/v1', desc: 'Yi 系列大模型' },");

s = s.replace(/icon: '♾️', type: 'cloud', defaultUrl: '', desc: '需通过第三方接\?Llama' \},/g, 
  "icon: '♾️', type: 'cloud', defaultUrl: '', desc: '需通过第三方接口使用 Llama' },");

s = s.replace(/icon: '🌪\?, type: 'cloud', defaultUrl: 'https:\/\/api\.mistral\.ai\/v1', desc: '欧洲开源大\? \},/g, 
  "icon: '🌪️', type: 'cloud', defaultUrl: 'https://api.mistral.ai/v1', desc: '欧洲开源大模型' },");

s = s.replace(/icon: '\?, type: 'cloud', defaultUrl: 'https:\/\/generativelanguage\.googleapis\.com\/v1beta', desc: 'Google AI 官方接口' \},/g, 
  "icon: '🌟', type: 'cloud', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta', desc: 'Google AI 官方接口' },");

s = s.replace(/name: '自定义配\?, icon: '⚙️'/g, "name: '自定义配置', icon: '⚙️'");

// Other ? replacements
s = s.replace(/已配置模\?/g, '已配置模型');
s = s.replace(/\?自动扫描全盘模型/g, '🔄 自动扫描全盘模型');
s = s.replace(/加载\?\.\./g, '加载中...');
s = s.replace(/<span style="color: #0a84ff;">\?<\/span>/g, '<span style="color: #0a84ff;">🔍</span>');
s = s.replace(/发现与接\?/g, '发现与接入');
s = s.replace(/添加自定义模\?/g, '添加自定义模型');
s = s.replace(/兼容第三\?/g, '兼容第三方');
s = s.replace(/动态渲\?/g, '动态渲染');
s = s.replace(/设置已保\?/g, '设置已保存');
s = s.replace(/未发现新的本地模\?/g, '未发现新的本地模型');
s = s.replace(/自定义配\?/g, '自定义配置');
s = s.replace(/预热\?\.\./g, '预热中...');
s = s.replace(/已触发预热请\?/g, '已触发预热请求');
s = s.replace(/已设为默认模\?/g, '已设为默认模型');
s = s.replace(/模型已删\?/g, '模型已删除');
s = s.replace(/\?探测连接/g, '🔗 探测连接');
s = s.replace(/拉取新模\?/g, '拉取新模型');
s = s.replace(/接口状态异\?/g, '接口状态异常');
s = s.replace(/引擎内尚未下载任何模型\?/g, '引擎内尚未下载任何模型。');
s = s.replace(/成功探测\?/g, '成功探测到');
s = s.replace(/被阻挡\?/g, '被阻挡。');
s = s.replace(/请先成功探测并选择一个模\?/g, '请先成功探测并选择一个模型');
s = s.replace(/服务商别\?/g, '服务商别名');
s = s.replace(/调用模型\?/g, '调用模型名');
s = s.replace(/保存并添\?/g, '保存并添加');
s = s.replace(/请填写完整必要信\?/g, '请填写完整必要信息');
s = s.replace(/我的专属模\?/g, '我的专属模型');
s = s.replace(/自定义图\?/g, '自定义图标');
s = s.replace(/或\?https/g, '或者 https');
s = s.replace(/自定义请求\?/g, '自定义请求头');
s = s.replace(/保存自定义配\?/g, '保存自定义配置');
s = s.replace(/自定义模\?/g, '自定义模型');
s = s.replace(/自定义模型添加成\?/g, '自定义模型添加成功');

// We have many more broken texts in settings.js, but these are the ones that had quotes missing
// Let's just catch all remaining unclosed quotes on lines
const lines = s.split('\n');
for (let i = 0; i < lines.length; i++) {
   if (lines[i].includes('? \},')) {
       lines[i] = lines[i].replace(/\? \},/g, "' },");
   }
}
s = lines.join('\n');

fs.writeFileSync('src/renderer/pages/settings.js', s, 'utf8');
console.log('Fixed settings.js');
