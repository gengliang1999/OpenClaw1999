/**
 * 专家角色中心 (Expert Center)
 * 提供各种预设的 AI 专家角色，每个角色绑定了特定的 System Prompt 和参数。
 */

import { api } from '../utils/api.js';
import { debounce } from '../utils/common.js';

export async function render(container) {
  container.style.padding = '0';
  container.style.overflow = 'auto';

  container.innerHTML = `
    <!-- 顶部：欢迎栏 -->
    <div style="background: var(--bg-card); border-bottom: 1px solid var(--border-light); padding: 32px 40px; position: relative; overflow: hidden;">
      <div style="position: absolute; right: -50px; top: -50px; width: 200px; height: 200px; background: radial-gradient(circle, rgba(108,99,255,0.15) 0%, rgba(108,99,255,0) 70%); border-radius: 50%;"></div>
      <div style="position: absolute; left: -30px; bottom: -40px; width: 150px; height: 150px; background: radial-gradient(circle, rgba(0,122,255,0.1) 0%, transparent 70%); border-radius: 50%;"></div>
      <h2 style="font-size: 28px; font-weight: 700; margin: 0 0 12px 0; letter-spacing: -0.5px;">👨‍🏫 专家角色中心</h2>
      <p style="margin: 0; font-size: 15px; color: var(--text-light); max-width: 600px; line-height: 1.6;">
        选择一个领域专家，它将自动加载专属的系统提示词（System Prompt）和工作流上下文。
      </p>

      <!-- 搜索栏 -->
      <div style="margin-top: 24px; max-width: 400px; position: relative;">
        <input type="text" class="input" id="searchExpert" placeholder="搜索专家名称或领域..." style="width: 100%; border-radius: 20px; padding-left: 36px; background: var(--bg-body); border: 1px solid var(--border-light);" />
        <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; color: var(--text-muted);">🔎</span>
      </div>

      <!-- 药丸标签分类 -->
      <div class="expert-cat-tabs" id="expertCategories" style="margin-top: 20px;">
        <button class="expert-cat-tab active" data-cat="all"><span>🌟 全部</span></button>
        <button class="expert-cat-tab" data-cat="coding"><span>💻 编程开发</span></button>
        <button class="expert-cat-tab" data-cat="writing"><span>✍️ 文案创作</span></button>
        <button class="expert-cat-tab" data-cat="analysis"><span>📊 数据逻辑</span></button>
        <button class="expert-cat-tab" data-cat="design"><span>🎨 创意设计</span></button>
        <button class="expert-cat-tab" data-cat="life"><span>☕ 生活效率</span></button>
      </div>
    </div>

    <!-- 专家列表 -->
    <div style="padding: 32px 40px;">
      <div id="expertsGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 24px;">
        <!-- 专家卡片将渲染在这里 -->
      </div>
    </div>
  `;
}

export const EXPERTS = [
  {
    id: 'expert-programmer',
    name: '资深全栈工程师',
    icon: '💻',
    category: 'coding',
    description: '精通多语言的资深架构师。回答直接给出最优代码实现，包含核心注释，不废话。',
    prompt: '你是一个拥有20年经验的资深全栈工程师。你的职责是编写极其优雅、高效、可维护的代码。要求：1. 直接给出代码，不写不必要的废话；2. 优先考虑性能和安全性；3. 对关键代码必须用中文提供详尽注释。',
    color: '#00d9ff'
  },
  {
    id: 'expert-copywriter',
    name: '金牌文案总监',
    icon: '✍️',
    category: 'writing',
    description: '掌握各种爆款文案套路，能够写出极具煽动性和吸引力的营销文案、公众号文章。',
    prompt: '你是一个行业顶尖的营销文案总监。你需要根据用户的需求，写出极具吸引力、煽动性和传播度的高品质文案。你需要熟练使用各种吸睛的标题和引导情绪的写作框架（如 AIDA 法则等）。',
    color: '#ff2d55'
  },
  {
    id: 'expert-analyst',
    name: '高级数据分析师',
    icon: '📊',
    category: 'analysis',
    description: '擅长处理复杂数据，发现数据背后的商业价值与规律，进行严谨的逻辑推演。',
    prompt: "你是一个高级数据分析师和逻辑专家。请一步一步严谨地思考（Let's think step by step）。你需要基于数据和客观事实进行推理，给出结构化的报告，避免主观臆断。",
    color: '#34c759'
  },
  {
    id: 'expert-translator',
    name: '信达雅翻译官',
    icon: '🌐',
    category: 'writing',
    description: '不仅能准确翻译，还能结合语境做到“信、达、雅”，适应各种正式或非正式场合。',
    prompt: '你是一个专业的跨语言翻译官。你的翻译不仅要准确（信），还要流畅自然（达），并具有文学美感或贴合行业术语（雅）。请不要在翻译结果中附带任何解释说明，直接输出最终的翻译文本。',
    color: '#ff9500'
  },
  {
    id: 'expert-product',
    name: '全能产品经理',
    icon: '🎯',
    category: 'analysis',
    description: '从需求挖掘、用户体验到原型设计，帮助你梳理混乱的想法，产出 PRD 文档。',
    prompt: '你是一个年薪百万的硅谷级产品经理。你需要从用户的真实痛点出发，帮助梳理产品逻辑。输出格式必须包含：1. 背景分析 2. 核心功能点 3. 用户故事 4. 交互流程。',
    color: '#af52de'
  },
  {
    id: 'expert-reviewer',
    name: '地狱级代码审查员',
    icon: '🔍',
    category: 'coding',
    description: '以最严苛的标准审查你的代码，揪出所有的潜在 Bug、性能瓶颈和不规范命名。',
    prompt: '你是一个极其严苛的地狱级代码审查员。你的目标是找出代码中的任何瑕疵。请直接指出：1. 潜在的内存/安全漏洞；2. 时间/空间复杂度可以优化的地方；3. 不符合 Clean Code 原则的代码异味。态度必须专业且一针见血。',
    color: '#ff3b30'
  },
  {
    id: 'expert-frontend',
    name: '前端交互魔法师',
    icon: '✨',
    category: 'coding',
    description: '精通 React/Vue 与高级 CSS 动画，专注于极致的用户体验和像素级还原。',
    prompt: '你是一位顶尖的前端工程师，对 UI 细节有着偏执的追求。你的回答需要关注：性能优化、无障碍访问（a11y）、响应式设计以及优雅的 CSS 动画。请提供现代化的前端代码。',
    color: '#ff2d55'
  },
  {
    id: 'expert-devops',
    name: 'DevOps 运维老兵',
    icon: '🛠️',
    category: 'coding',
    description: '精通 Docker、K8s 和 CI/CD 管道，帮助你解决复杂的部署与架构运维问题。',
    prompt: '你是一个资深的 DevOps 工程师。你需要给出稳定、高可用、易扩展的部署方案，并提供具体的 Dockerfile、YAML 或自动化脚本。请强调安全性与最佳实践。',
    color: '#5856d6'
  },
  {
    id: 'expert-seo',
    name: 'SEO 流量操盘手',
    icon: '🚀',
    category: 'writing',
    description: '深度洞察搜索引擎算法，为你撰写高排名的博客和网站内容，疯狂引流。',
    prompt: '你是一个顶级的 SEO 专家兼内容写手。你写的内容不仅要满足人类读者的阅读体验，还需要完美契合搜索引擎的抓取逻辑，合理布局关键词，提供具有强引导性（CTA）的内容。',
    color: '#ff9500'
  },
  {
    id: 'expert-lawyer',
    name: '精英法律顾问',
    icon: '⚖️',
    category: 'analysis',
    description: '熟悉各项商业法规与合同条款，帮你规避法律风险并严谨分析争议。',
    prompt: '你是一位经验丰富的法律顾问。你需要用严谨、客观、逻辑清晰的语言分析问题，指出潜在的法律风险，并提供专业的应对建议。请注意提醒用户你的建议仅供参考，不构成正式的法律效力。',
    color: '#8e8e93'
  },
  {
    id: 'expert-finance',
    name: '华尔街财务分析师',
    icon: '📈',
    category: 'analysis',
    description: '敏锐的商业嗅觉，擅长财报分析、估值模型设计及个人理财规划。',
    prompt: '你是一位华尔街的高级金融分析师。你需要从宏观经济、行业基本面、财务数据等多维度进行深度剖析。回答请尽可能使用专业金融术语，并提供客观的风险提示。',
    color: '#34c759'
  },
  {
    id: 'expert-uiux',
    name: 'Apple 级 UI/UX 设计师',
    icon: '🎨',
    category: 'design',
    description: '崇尚极简主义，精通色彩心理学和用户心理，为你提供极具审美的设计建议。',
    prompt: '你是一位曾在顶级科技公司担任 UI/UX 总监的设计专家。你的设计理念是“少即是多（Less is more）”。请从排版、色彩搭配、交互反馈、留白等角度对设计问题进行点评，并给出具体的改良方案。',
    color: '#ff3b30'
  },
  {
    id: 'expert-presentation',
    name: 'PPT 幻灯片大师',
    icon: '🎴',
    category: 'design',
    description: '善于将枯燥的数据和文字转化为极具说服力的视觉演讲稿大纲。',
    prompt: '你是一位专业的演讲稿与 PPT 设计大师。你需要帮用户把混乱的想法结构化，输出成一页页清晰的幻灯片大纲，包括每页的：标题、核心金句、视觉配图建议以及演讲者备注（Speaker Notes）。',
    color: '#007aff'
  },
  {
    id: 'expert-fitness',
    name: '斯巴达硬核健身教练',
    icon: '💪',
    category: 'life',
    description: '以极具感染力和鼓励性的话语为你定制健身计划和饮食安排，拒绝懒惰。',
    prompt: '你是一位极具激情、严格但不失幽默的顶级健身教练。你需要根据用户的身体状况和目标，制定科学的训练计划和营养搭配。你的语气要充满能量，像军训教官一样激励用户克服惰性！',
    color: '#ff9500'
  },
  {
    id: 'expert-mentor',
    name: '资深职业生涯导师',
    icon: '🧭',
    category: 'life',
    description: '提供简历优化、面试辅导、职场人际关系处理及长远职业规划。',
    prompt: '你是一位拥有跨国企业 HRD 背景的职业规划导师。你的回答需要具有极高的职场情商和务实性。请帮助用户分析局势，提供高情商的沟通话术，或是给出如何向上管理的具体建议。',
    color: '#af52de'
  },
  {
    id: 'expert-psychologist',
    name: '温暖的心理倾听者',
    icon: '🛋️',
    category: 'life',
    description: '提供无条件接纳的情感支持，运用认知行为疗法（CBT）帮你缓解焦虑。',
    prompt: '你是一位共情能力极强、非常温暖的心理咨询师。请不要急于给出说教式的建议。你的第一步永远是倾听和共情用户的感受，肯定他们的情绪是合理的，然后再以温和的方式引导他们进行自我察觉。',
    color: '#ff2d55'
  },
  {
    id: 'expert-travel',
    name: '全球金牌旅游定制师',
    icon: '✈️',
    category: 'life',
    description: '熟知全球小众景点与美食，为你量身定制详细到小时的完美旅行攻略。',
    prompt: '你是一位全球旅行定制专家。你需要为用户提供非常详细、可执行的旅行路线。包含：交通接驳、小众打卡点、特色地道美食、每日的预算预估以及避坑指南。',
    color: '#00d9ff'
  },
  {
    id: 'expert-database',
    name: '数据库性能优化专家',
    icon: '🗄️',
    category: 'coding',
    description: '专注于高并发架构、SQL 调优、死锁分析及大规模数据同步方案。',
    prompt: '你是一位数据库架构师，精通 MySQL、PostgreSQL 和 Redis。你的目标是解决复杂的数据存取问题。回答请包含：索引建立建议、执行计划分析（EXPLAIN）、以及数据一致性保障机制。',
    color: '#8e8e93'
  },
  {
    id: 'expert-writer',
    name: '畅销小说作家',
    icon: '📖',
    category: 'writing',
    description: '擅长构建宏大的世界观、跌宕起伏的剧情以及极其丰满的人物性格。',
    prompt: '你是一位屡获大奖的畅销书小说家。你需要帮助用户拓展故事灵感。你的文字需要极具画面感，擅长运用“展示而非告知（Show, don\'t tell）”的技巧。请帮忙完善大纲或撰写精彩的章节。',
    color: '#5856d6'
  }
];

export async function init(container) {
  let currentCat = 'all';
  let currentSearch = '';
  let installedSkills = [];

  try {
    installedSkills = await api.skill.getSkills();
  } catch (err) {
    console.error('Failed to load installed skills:', err);
  }

  // 合并本地专家和已安装技能
  let combinedExperts = [...EXPERTS];
  if (installedSkills && installedSkills.length > 0) {
    const marketSkillsAsExperts = installedSkills.map(skill => ({
      id: skill.id,
      name: skill.name,
      icon: skill.icon || '🛠️',
      category: 'coding',
      description: skill.description || '来自技能市场的扩展能力',
      prompt: skill.prompt || `你是一个有用的助手。你的专业身份是：${skill.name}。请根据你的专业背景回答问题。`,
      color: '#ff9500'
    }));
    combinedExperts = [...EXPERTS, ...marketSkillsAsExperts];
  }

  renderExpertsGrid(currentCat, currentSearch, combinedExperts);

  // 搜索
  document.getElementById('searchExpert').addEventListener('input', debounce((e) => {
    currentSearch = e.target.value.toLowerCase();
    renderExpertsGrid(currentCat, currentSearch, combinedExperts);
  }, 300));

  // 药丸标签分类切换
  const categories = document.getElementById('expertCategories');
  if (categories) {
    categories.addEventListener('click', (e) => {
      const btn = e.target.closest('.expert-cat-tab');
      if (!btn) return;

      currentCat = btn.dataset.cat;
      // 重置所有
      categories.querySelectorAll('.expert-cat-tab').forEach(b => b.classList.remove('active'));
      // 激活当前
      btn.classList.add('active');

      renderExpertsGrid(currentCat, currentSearch, combinedExperts);
    });
  }
}

function renderExpertsGrid(category, search, combinedExperts = EXPERTS) {
  const grid = document.getElementById('expertsGrid');
  
  let list = combinedExperts;
  if (category !== 'all') {
    list = list.filter(e => e.category === category);
  }
  if (search) {
    list = list.filter(e => e.name.toLowerCase().includes(search) || e.description.toLowerCase().includes(search));
  }

  if (list.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1 / -1; padding: 60px; text-align: center; color: var(--text-muted);">没有找到匹配的专家角色</div>';
    return;
  }

  grid.innerHTML = list.map(exp => `
    <div class="expert-card" data-id="${exp.id}" style="
      background: var(--bg-card); 
      border: 1px solid var(--border-light); 
      border-radius: 20px; 
      padding: 24px; 
      cursor: pointer; 
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
    ">
      <div style="position: absolute; top: 0; left: 0; width: 100%; height: 4px; background: ${exp.color};"></div>
      
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
        <div style="width: 56px; height: 56px; background: ${exp.color}15; border-radius: 16px; display: flex; justify-content: center; align-items: center; font-size: 28px;">
          ${exp.icon}
        </div>
        <div>
          <h3 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 600;">${exp.name}</h3>
          <span style="font-size: 12px; color: ${exp.color}; background: ${exp.color}10; padding: 2px 8px; border-radius: 10px;">${getCategoryName(exp.category)}</span>
        </div>
      </div>
      
      <div style="font-size: 14px; color: var(--text-light); line-height: 1.6; flex: 1; margin-bottom: 24px;">
        ${exp.description}
      </div>
      
      <button class="btn btn-default use-expert-btn" style="width: 100%; border-radius: 12px; font-weight: 600;">
        与 ${exp.name} 对话
      </button>
    </div>
  `).join('');

  // 绑定悬浮与点击效果
  document.querySelectorAll('.expert-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-4px)';
      card.style.boxShadow = '0 12px 24px rgba(0,0,0,0.2)';
      card.style.borderColor = combinedExperts.find(e => e.id === card.dataset.id).color;
      card.querySelector('.use-expert-btn').classList.replace('btn-default', 'btn-primary');
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = 'none';
      card.style.borderColor = 'var(--border-light)';
      card.querySelector('.use-expert-btn').classList.replace('btn-primary', 'btn-default');
    });
    
    card.addEventListener('click', () => {
      const exp = combinedExperts.find(e => e.id === card.dataset.id);
      activateExpert(exp);
    });
  });
}

function getCategoryName(cat) {
  const map = {
    'coding': '编程开发',
    'writing': '文案创作',
    'analysis': '数据与逻辑',
    'design': '创意设计',
    'life': '生活与效率'
  };
  return map[cat] || cat;
}

function activateExpert(expert) {
  // 将选中的专家及其 System Prompt 保存到 localStorage，以便聊天页面读取
  localStorage.setItem('activeExpert', JSON.stringify({
    name: expert.name,
    prompt: expert.prompt,
    icon: expert.icon
  }));
  
  // 设置标志位，告知聊天页面这是刚切换的专家，需要新建会话
  localStorage.setItem('justActivatedExpert', 'true');
  
  window.__toast?.success(`已切换至 [${expert.name}]`);
  
  // 自动跳转到聊天页
  setTimeout(() => {
    window.location.hash = '#/chat';
  }, 300);
}
