"use strict";
// @ts-nocheck
// ================== model-marketplace.ts ==================
/**
 * 模型市场数据
 * 国内镜像源 GGUF 模型下载列表，用于本地模型一键安装
 */
const MODEL_MARKETPLACE = [
    {
        provider: 'Alibaba',
        logo: '🅰️',
        description: '阿里巴巴通义千问系列，中文能力极佳。',
        series: [
            {
                name: 'Qwen 2.5',
                description: '最新一代 Qwen 模型，代码与数学能力大幅提升。',
                versions: [
                    { id: 'qwen2.5:7b', name: '7B Instruct', sizeGB: 4.7, paramsBillion: 7, ggufUrl: 'https://modelscope.cn/api/v1/models/qwen/Qwen2.5-7B-Instruct-GGUF/repo?Revision=master&FilePath=qwen2.5-7b-instruct-q4_k_m.gguf' },
                    { id: 'qwen2.5:14b', name: '14B Instruct', sizeGB: 8.5, paramsBillion: 14, ggufUrl: 'https://modelscope.cn/api/v1/models/qwen/Qwen2.5-14B-Instruct-GGUF/repo?Revision=master&FilePath=qwen2.5-14b-instruct-q4_k_m.gguf' },
                    { id: 'qwen2.5:32b', name: '32B Instruct', sizeGB: 19.2, paramsBillion: 32, ggufUrl: 'https://modelscope.cn/api/v1/models/qwen/Qwen2.5-32B-Instruct-GGUF/repo?Revision=master&FilePath=qwen2.5-32b-instruct-q4_k_m.gguf' }
                ]
            },
            {
                name: 'Qwen 2.5 Coder',
                description: '专为代码生成优化的模型系列。',
                versions: [
                    { id: 'qwen2.5-coder:7b', name: '7B Coder', sizeGB: 4.7, paramsBillion: 7, ggufUrl: 'https://modelscope.cn/api/v1/models/qwen/Qwen2.5-Coder-7B-Instruct-GGUF/repo?Revision=master&FilePath=qwen2.5-coder-7b-instruct-q4_k_m.gguf' }
                ]
            }
        ]
    },
    {
        provider: 'DeepSeek',
        logo: '🐋',
        description: '深度求索，开源代码模型霸主。',
        series: [
            {
                name: 'DeepSeek Coder V2',
                description: '当前最强开源代码模型，MoE 架构。',
                versions: [
                    { id: 'deepseek-coder-v2:16b', name: '16B Lite', sizeGB: 8.9, paramsBillion: 16, ggufUrl: 'https://modelscope.cn/api/v1/models/deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct-GGUF/repo?Revision=main&FilePath=DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M.gguf' }
                ]
            }
        ]
    },
    {
        provider: 'Baichuan',
        logo: '🌊',
        description: '百川智能，在中文常识与文本生成上表现卓越。',
        series: [
            {
                name: 'Baichuan 2',
                description: '新一代开源大语言模型，医疗/法律等专业领域极强。',
                versions: [
                    { id: 'baichuan2:7b', name: '7B Chat', sizeGB: 4.6, paramsBillion: 7, ggufUrl: 'https://modelscope.cn/api/v1/models/baichuan-inc/Baichuan2-7B-Chat-GGUF/repo?Revision=master&FilePath=baichuan2-7b-chat-q4_k_m.gguf' },
                    { id: 'baichuan2:13b', name: '13B Chat', sizeGB: 8.1, paramsBillion: 13, ggufUrl: 'https://modelscope.cn/api/v1/models/baichuan-inc/Baichuan2-13B-Chat-GGUF/repo?Revision=master&FilePath=baichuan2-13b-chat-q4_k_m.gguf' }
                ]
            }
        ]
    },
    {
        provider: '01.AI',
        logo: '⚡',
        description: '零一万物，李开复博士创办，拥有极强的双语与代码表现。',
        series: [
            {
                name: 'Yi 1.5',
                description: '大幅提升代码生成与数学逻辑能力。',
                versions: [
                    { id: 'yi1.5:9b', name: '9B Chat', sizeGB: 5.6, paramsBillion: 9, ggufUrl: 'https://modelscope.cn/api/v1/models/01ai/Yi-1.5-9B-Chat-GGUF/repo?Revision=master&FilePath=Yi-1.5-9B-Chat-Q4_K_M.gguf' },
                    { id: 'yi1.5:34b', name: '34B Chat', sizeGB: 20.1, paramsBillion: 34, ggufUrl: 'https://modelscope.cn/api/v1/models/01ai/Yi-1.5-34B-Chat-GGUF/repo?Revision=master&FilePath=Yi-1.5-34B-Chat-Q4_K_M.gguf' }
                ]
            }
        ]
    },
    {
        provider: 'InternLM',
        logo: '🎓',
        description: '上海人工智能实验室 (书生·浦语系列)。',
        series: [
            {
                name: 'InternLM 2.5',
                description: '长文本与复杂推理能力登顶开源榜单前列。',
                versions: [
                    { id: 'internlm2.5:7b', name: '7B Chat', sizeGB: 4.7, paramsBillion: 7, ggufUrl: 'https://modelscope.cn/api/v1/models/Shanghai_AI_Laboratory/internlm2_5-7b-chat-gguf/repo?Revision=main&FilePath=internlm2_5-7b-chat-q4_k_m.gguf' }
                ]
            }
        ]
    },
    {
        provider: 'SenseTime',
        logo: '👁️',
        description: '商汤科技 SenseNova 日日新大模型。',
        series: [
            {
                name: 'SenseNova 5.0',
                description: '极高的人文对话与知识推理表现。',
                versions: [
                    { id: 'sensenova5:8b', name: '8B Instruct', sizeGB: 5.1, paramsBillion: 8, ggufUrl: 'https://modelscope.cn/api/v1/models/sensetime/SenseNova-5.0-8B-Instruct-GGUF/repo?Revision=main&FilePath=sensenova-5.0-8b-instruct-q4_k_m.gguf' }
                ]
            }
        ]
    },
    {
        provider: 'Meta',
        logo: '♾️',
        description: 'Llama 系列，全球最强开源基座。',
        series: [
            {
                name: 'Llama 3.1',
                description: '128K 上下文，多语言支持大幅增强。',
                versions: [
                    { id: 'llama3.1:8b', name: '8B Instruct', sizeGB: 4.7, paramsBillion: 8, ggufUrl: 'https://hf-mirror.com/lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf' },
                    { id: 'llama3.1:70b', name: '70B Instruct', sizeGB: 39.5, paramsBillion: 70, ggufUrl: 'https://hf-mirror.com/lmstudio-community/Meta-Llama-3.1-70B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-70B-Instruct-Q4_K_M.gguf' }
                ]
            }
        ]
    },
    {
        provider: 'Google',
        logo: '🔍',
        description: 'Gemma 系列，基于 Gemini 架构。',
        series: [
            {
                name: 'Gemma 2',
                description: '性能与效率的最佳平衡。',
                versions: [
                    { id: 'gemma2:9b', name: '9B Instruct', sizeGB: 5.4, paramsBillion: 9, ggufUrl: 'https://modelscope.cn/api/v1/models/LLM-Research/gemma-2-9b-it-GGUF/repo?Revision=master&FilePath=gemma-2-9b-it-Q4_K_M.gguf' }
                ]
            }
        ]
    }
];
module.exports = { MODEL_MARKETPLACE };
// ================== plugin-registry.ts ==================
/**
 * OpenHub 插件注册中心数据
 * 模拟 OpenHub 远程注册中心，真实环境中通过 HTTPS API 获取
 * 每个插件包含：元数据、统计数据、标签、官方认证信息
 */
const OPENHUB_REGISTRY = [
    // ===== 通讯平台插件（官方 SDK） =====
    {
        id: 'wechat-official',
        name: '微信公众平台',
        nameEn: 'WeChat Official',
        icon: '💚',
        type: '通讯',
        tags: ['即时通讯', '官方', '微信生态'],
        description: '基于微信公众平台官方 SDK 的接入插件。通过 WeChat MP API 实现服务号/订阅号消息自动回复、模板消息、自定义菜单等功能。',
        author: 'OpenClaw Official',
        authorVerified: true,
        license: 'MIT',
        repository: 'https://github.com/openclaw/plugin-wechat-official',
        version: '2.1.0',
        sdkName: 'wechat-mp-sdk',
        officialApi: '微信公众平台 API (mp.weixin.qq.com)',
        stars: 2340,
        forks: 312,
        downloads: 45800,
        weeklyDownloads: 1230,
        rating: 4.8,
        ratingCount: 386,
        lastUpdated: '2026-06-10T08:00:00Z',
        createdAt: '2025-03-15T00:00:00Z',
        status: 'not_installed',
        verified: true,
        trending: true,
        features: ['服务号消息回复', '模板消息推送', '自定义菜单', '素材管理', '用户管理', 'OAuth 授权登录'],
        configFields: [
            { key: 'appId', label: '公众号 AppID', type: 'text', placeholder: '在 mp.weixin.qq.com 获取', required: true },
            { key: 'appSecret', label: '公众号 AppSecret', type: 'password', placeholder: '在 mp.weixin.qq.com 获取', required: true },
            { key: 'token', label: '服务器 Token', type: 'text', placeholder: '自定义验证 Token', required: true },
            { key: 'encodingAESKey', label: '消息加密密钥', type: 'password', placeholder: '43 位字符串（可选）' },
            { key: 'autoReply', label: '自动回复', type: 'switch', value: true },
        ],
    },
    {
        id: 'wechat-work',
        name: '企业微信',
        nameEn: 'WeCom / WeChat Work',
        icon: '🏢',
        type: '通讯',
        tags: ['即时通讯', '官方', '企业', '微信生态'],
        description: '基于企业微信官方 Server API 的接入插件。支持应用消息推送、群聊机器人、审批流程、日程同步等企业级功能。',
        author: 'OpenClaw Official',
        authorVerified: true,
        license: 'MIT',
        repository: 'https://github.com/openclaw/plugin-wecom',
        version: '1.8.0',
        sdkName: 'wecom-server-api',
        officialApi: '企业微信 Server API (work.weixin.qq.com)',
        stars: 1560,
        forks: 203,
        downloads: 28900,
        weeklyDownloads: 870,
        rating: 4.7,
        ratingCount: 214,
        lastUpdated: '2026-06-08T12:00:00Z',
        createdAt: '2025-05-20T00:00:00Z',
        status: 'not_installed',
        verified: true,
        trending: false,
        features: ['应用消息推送', '群聊机器人', '审批流', '日程同步', '通讯录管理', '素材管理'],
        configFields: [
            { key: 'corpId', label: '企业 ID', type: 'text', placeholder: '在 work.weixin.qq.com 获取', required: true },
            { key: 'agentId', label: '应用 AgentId', type: 'text', placeholder: '自建应用的 AgentId', required: true },
            { key: 'secret', label: '应用 Secret', type: 'password', placeholder: '自建应用的 Secret', required: true },
            { key: 'autoReply', label: '自动回复', type: 'switch', value: true },
        ],
    },
    {
        id: 'qq-bot-official',
        name: 'QQ 官方机器人',
        nameEn: 'QQ Bot (Official)',
        icon: '🐧',
        type: '通讯',
        tags: ['即时通讯', '官方', 'QQ生态'],
        description: '基于 QQ 开放平台官方 Bot SDK 的接入插件。通过 QQ Bot API v2 实现频道消息、群消息、私聊、富文本消息卡片等功能。',
        author: 'OpenClaw Official',
        authorVerified: true,
        license: 'MIT',
        repository: 'https://github.com/openclaw/plugin-qqbot',
        version: '2.0.3',
        sdkName: 'qq-bot-sdk (官方 v2 API)',
        officialApi: 'QQ 开放平台 Bot API (q.qq.com)',
        stars: 1890,
        forks: 256,
        downloads: 38200,
        weeklyDownloads: 1050,
        rating: 4.6,
        ratingCount: 298,
        lastUpdated: '2026-06-12T06:00:00Z',
        createdAt: '2025-04-01T00:00:00Z',
        status: 'not_installed',
        verified: true,
        trending: true,
        features: ['频道消息收发', '群聊消息', '私聊消息', 'Markdown 消息', '消息按钮', '富文本卡片', '事件订阅'],
        configFields: [
            { key: 'appId', label: '机器人 AppID', type: 'text', placeholder: '在 q.qq.com 开放平台获取', required: true },
            { key: 'clientSecret', label: 'ClientSecret', type: 'password', placeholder: '在 q.qq.com 获取', required: true },
            { key: 'sandbox', label: '沙箱模式', type: 'switch', value: true },
            { key: 'autoReply', label: '自动回复', type: 'switch', value: true },
        ],
    },
    {
        id: 'feishu-official',
        name: '飞书机器人',
        nameEn: 'Feishu / Lark Bot',
        icon: '🔷',
        type: '通讯',
        tags: ['即时通讯', '官方', '企业', '飞书生态'],
        description: '基于飞书开放平台官方 SDK 的接入插件。支持消息卡片、事件订阅、机器人指令、多维表格、审批等能力。',
        author: 'OpenClaw Official',
        authorVerified: true,
        license: 'MIT',
        repository: 'https://github.com/openclaw/plugin-feishu',
        version: '3.2.0',
        sdkName: '@larksuiteoapi/node-sdk (官方)',
        officialApi: '飞书开放平台 API (open.feishu.cn)',
        stars: 2100,
        forks: 278,
        downloads: 42500,
        weeklyDownloads: 1150,
        rating: 4.9,
        ratingCount: 356,
        lastUpdated: '2026-06-14T10:00:00Z',
        createdAt: '2025-02-10T00:00:00Z',
        status: 'not_installed',
        verified: true,
        trending: true,
        features: ['消息卡片', '事件订阅', '机器人指令', '群组管理', '多维表格', '审批流程', '日历集成'],
        configFields: [
            { key: 'appId', label: '应用 App ID', type: 'text', placeholder: '在 open.feishu.cn 获取', required: true },
            { key: 'appSecret', label: 'App Secret', type: 'password', placeholder: '在 open.feishu.cn 获取', required: true },
            { key: 'encryptKey', label: 'Encrypt Key', type: 'password', placeholder: '事件订阅加密密钥' },
            { key: 'verificationToken', label: 'Verification Token', type: 'text', placeholder: '事件订阅验证 Token' },
            { key: 'autoReply', label: '自动回复', type: 'switch', value: true },
        ],
    },
    {
        id: 'dingtalk-official',
        name: '钉钉机器人',
        nameEn: 'DingTalk Bot',
        icon: '🔵',
        type: '通讯',
        tags: ['即时通讯', '官方', '企业', '钉钉生态'],
        description: '基于钉钉开放平台官方 SDK 的接入插件。支持企业内部应用机器人、群聊机器人、卡片消息、互动卡片等能力。',
        author: 'OpenClaw Official',
        authorVerified: true,
        license: 'MIT',
        repository: 'https://github.com/openclaw/plugin-dingtalk',
        version: '2.5.1',
        sdkName: '@anthropic-ai/dingtalk-sdk (官方)',
        officialApi: '钉钉开放平台 API (open.dingtalk.com)',
        stars: 1780,
        forks: 231,
        downloads: 35600,
        weeklyDownloads: 980,
        rating: 4.7,
        ratingCount: 267,
        lastUpdated: '2026-06-11T04:00:00Z',
        createdAt: '2025-04-15T00:00:00Z',
        status: 'not_installed',
        verified: true,
        trending: false,
        features: ['群聊机器人', '应用机器人', '互动卡片', 'Webhook 推送', '工作通知', '审批集成'],
        configFields: [
            { key: 'appKey', label: 'AppKey', type: 'text', placeholder: '在 open.dingtalk.com 获取', required: true },
            { key: 'appSecret', label: 'AppSecret', type: 'password', placeholder: '在 open.dingtalk.com 获取', required: true },
            { key: 'robotCode', label: '机器人编码', type: 'text', placeholder: '机器人唯一标识' },
            { key: 'autoReply', label: '自动回复', type: 'switch', value: true },
        ],
    },
    {
        id: 'telegram-bot',
        name: 'Telegram Bot',
        nameEn: 'Telegram',
        icon: '✈️',
        type: '通讯',
        tags: ['即时通讯', '官方', '海外', '开源'],
        description: '基于 Telegram Bot API (官方) 的接入插件。支持消息收发、Inline 查询、自定义键盘、Webhook 等全部 Bot API 功能。',
        author: 'OpenClaw Official',
        authorVerified: true,
        license: 'MIT',
        repository: 'https://github.com/openclaw/plugin-telegram',
        version: '2.3.0',
        sdkName: 'node-telegram-bot-api',
        officialApi: 'Telegram Bot API (core.telegram.org)',
        stars: 3200,
        forks: 420,
        downloads: 62000,
        weeklyDownloads: 1800,
        rating: 4.9,
        ratingCount: 528,
        lastUpdated: '2026-06-15T14:00:00Z',
        createdAt: '2025-01-20T00:00:00Z',
        status: 'not_installed',
        verified: true,
        trending: true,
        features: ['消息收发', 'Inline 查询', '自定义键盘', 'Webhook', '文件发送', '群组管理', '频道管理'],
        configFields: [
            { key: 'botToken', label: 'Bot Token', type: 'password', placeholder: '从 @BotFather 获取', required: true },
            { key: 'webhookUrl', label: 'Webhook URL（可选）', type: 'text', placeholder: 'https://...' },
            { key: 'proxyUrl', label: '代理地址（可选）', type: 'text', placeholder: 'socks5://127.0.0.1:1080' },
            { key: 'autoReply', label: '自动回复', type: 'switch', value: true },
        ],
    },
    {
        id: 'slack-bot',
        name: 'Slack Bot',
        nameEn: 'Slack',
        icon: '💜',
        type: '通讯',
        tags: ['即时通讯', '官方', '海外', '企业'],
        description: '基于 Slack Bolt SDK (官方) 的接入插件。支持频道消息、线程回复、Slash 命令、交互组件等全部 Slack App 功能。',
        author: 'OpenClaw Official',
        authorVerified: true,
        license: 'MIT',
        repository: 'https://github.com/openclaw/plugin-slack',
        version: '1.9.0',
        sdkName: '@slack/bolt (官方)',
        officialApi: 'Slack API (api.slack.com)',
        stars: 1450,
        forks: 189,
        downloads: 24500,
        weeklyDownloads: 720,
        rating: 4.6,
        ratingCount: 178,
        lastUpdated: '2026-06-09T16:00:00Z',
        createdAt: '2025-06-01T00:00:00Z',
        status: 'not_installed',
        verified: true,
        trending: false,
        features: ['频道消息', '线程回复', 'Slash 命令', 'Block Kit', '交互组件', '文件共享', 'App Home'],
        configFields: [
            { key: 'botToken', label: 'Bot Token (xoxb-)', type: 'password', placeholder: 'xoxb-...', required: true },
            { key: 'signingSecret', label: 'Signing Secret', type: 'password', placeholder: '在 api.slack.com 获取', required: true },
            { key: 'appToken', label: 'App Token (xapp-)', type: 'password', placeholder: 'xapp-...' },
            { key: 'autoReply', label: '自动回复', type: 'switch', value: true },
        ],
    },
    {
        id: 'discord-bot',
        name: 'Discord Bot',
        nameEn: 'Discord',
        icon: '🎮',
        type: '通讯',
        tags: ['即时通讯', '官方', '海外', '社区'],
        description: '基于 discord.js (官方推荐) 的接入插件。支持服务器消息、斜杠命令、按钮交互、嵌入消息等全部 Discord Bot 功能。',
        author: 'OpenClaw Official',
        authorVerified: true,
        license: 'MIT',
        repository: 'https://github.com/openclaw/plugin-discord',
        version: '2.0.1',
        sdkName: 'discord.js (官方推荐)',
        officialApi: 'Discord API (discord.com/developers)',
        stars: 2680,
        forks: 356,
        downloads: 51200,
        weeklyDownloads: 1420,
        rating: 4.8,
        ratingCount: 412,
        lastUpdated: '2026-06-13T18:00:00Z',
        createdAt: '2025-02-28T00:00:00Z',
        status: 'not_installed',
        verified: true,
        trending: true,
        features: ['消息收发', '斜杠命令', '按钮交互', '嵌入消息', '语音频道', '服务器管理', '权限控制'],
        configFields: [
            { key: 'botToken', label: 'Bot Token', type: 'password', placeholder: '在 discord.com/developers 获取', required: true },
            { key: 'clientId', label: 'Client ID', type: 'text', placeholder: '应用 Client ID', required: true },
            { key: 'guildId', label: '服务器 ID（可选）', type: 'text', placeholder: '限定到特定服务器' },
            { key: 'autoReply', label: '自动回复', type: 'switch', value: true },
        ],
    },
    // ===== 工具类插件 =====
    {
        id: 'webhook-bridge',
        name: 'Webhook 通用桥接',
        nameEn: 'Webhook Bridge',
        icon: '🔗',
        type: '工具',
        tags: ['集成', '自定义', '通用'],
        description: '通用 Webhook 桥接插件。支持接入任何 Webhook 兼容的服务，可自定义消息格式和认证方式。',
        author: 'OpenClaw Community',
        authorVerified: false,
        license: 'Apache-2.0',
        repository: 'https://github.com/openclaw-community/webhook-bridge',
        version: '1.5.0',
        stars: 890,
        forks: 134,
        downloads: 18200,
        weeklyDownloads: 560,
        rating: 4.4,
        ratingCount: 123,
        lastUpdated: '2026-06-05T10:00:00Z',
        createdAt: '2025-07-01T00:00:00Z',
        status: 'not_installed',
        verified: false,
        trending: false,
        features: ['自定义 Webhook', '消息转发', '格式映射', '认证配置', '批量处理'],
        configFields: [
            { key: 'webhookUrl', label: 'Webhook URL', type: 'text', placeholder: 'https://...', required: true },
            { key: 'secret', label: '签名密钥', type: 'password', placeholder: '可选' },
            { key: 'contentType', label: '内容类型', type: 'text', placeholder: 'application/json' },
        ],
    },
    {
        id: 'email-smtp',
        name: '邮件 SMTP',
        nameEn: 'Email SMTP',
        icon: '📧',
        type: '工具',
        tags: ['邮件', '通知', '通用'],
        description: '通过 SMTP 协议发送和接收邮件。支持 Gmail、Outlook、QQ 邮箱等主流邮件服务。',
        author: 'OpenClaw Community',
        authorVerified: false,
        license: 'MIT',
        repository: 'https://github.com/openclaw-community/email-smtp',
        version: '1.2.0',
        stars: 620,
        forks: 87,
        downloads: 12800,
        weeklyDownloads: 380,
        rating: 4.3,
        ratingCount: 89,
        lastUpdated: '2026-05-28T14:00:00Z',
        createdAt: '2025-08-15T00:00:00Z',
        status: 'not_installed',
        verified: false,
        trending: false,
        features: ['SMTP 发送', 'IMAP 接收', '附件支持', '模板消息', 'HTML 邮件'],
        configFields: [
            { key: 'smtpHost', label: 'SMTP 服务器', type: 'text', placeholder: 'smtp.gmail.com', required: true },
            { key: 'smtpPort', label: '端口', type: 'text', placeholder: '465', required: true },
            { key: 'username', label: '邮箱账号', type: 'text', placeholder: 'user@example.com', required: true },
            { key: 'password', label: '密码/授权码', type: 'password', placeholder: '授权码', required: true },
        ],
    },
    {
        id: 'matrix-bridge',
        name: 'Matrix 协议',
        nameEn: 'Matrix Protocol',
        icon: '🟢',
        type: '通讯',
        tags: ['即时通讯', '开源', '去中心化', '海外'],
        description: '基于 Matrix 开放协议的接入插件。支持 Element、FluffyChat 等客户端互通，去中心化通讯。',
        author: 'OpenClaw Community',
        authorVerified: false,
        license: 'Apache-2.0',
        repository: 'https://github.com/openclaw-community/matrix-bridge',
        version: '1.0.2',
        stars: 430,
        forks: 56,
        downloads: 6800,
        weeklyDownloads: 210,
        rating: 4.2,
        ratingCount: 45,
        lastUpdated: '2026-05-20T08:00:00Z',
        createdAt: '2025-10-01T00:00:00Z',
        status: 'not_installed',
        verified: false,
        trending: false,
        features: ['端到端加密', '房间管理', '桥接其他平台', '文件传输', '去中心化'],
        configFields: [
            { key: 'homeserver', label: 'Homeserver URL', type: 'text', placeholder: 'https://matrix.org', required: true },
            { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: '用户 Access Token', required: true },
        ],
    },
];
module.exports = { OPENHUB_REGISTRY };
// ================== skill-market.ts ==================
/**
 * 技能市场数据
 * 所有可安装的技能定义，包含 Prompt 和元数据
 */
const SKILL_MARKET = [
    { id: 'skill-writer', name: '文章写作专家', icon: '📝', description: '专为撰写高质量文章、报告而生的 AI 技能。', author: 'OpenClaw', type: '创作', downloads: 12000, rating: 4.8, lastUpdated: '2026-06-10', prompt: '你是一位资深的媒体主编和文案专家。你的写作兼具深度与可读性，能够根据不同的目标受众和发布平台（公众号、知乎、博客等）灵活调整风格。请严格遵循 Markdown 格式输出，确保结构清晰。' },
    { id: 'skill-coder', name: '全栈编程助手', icon: '💻', description: '精通多语言编程，自动生成代码和定位 Bug。', author: 'OpenClaw', type: '开发', downloads: 35000, rating: 4.9, lastUpdated: '2026-06-12', prompt: '你是一位资深全栈工程师，精通 JavaScript/TypeScript、Python、Go 等主流语言。回答时请直接给出可运行的代码，包含关键注释，并主动考虑边界情况和安全性问题。' },
    { id: 'skill-translator', name: '本地化翻译', icon: '🌐', description: '高精度的多语言翻译技能，保持语境和专业术语。', author: 'Community', type: '工具', downloads: 8000, rating: 4.5, lastUpdated: '2026-05-20', prompt: '你是一位专业的本地化翻译专家。翻译时请保持原文的语气、风格和专业术语，必要时进行文化适应性调整（本地化）。不要添加额外解释，直接输出翻译结果。' },
    { id: 'skill-analyst', name: '数据分析师', icon: '📊', description: '上传数据文件，自动生成分析结论和可视化代码。', author: 'Community', type: '效率', downloads: 6500, rating: 4.6, lastUpdated: '2026-06-01', prompt: '你是一位高级数据分析师。请使用 Python（pandas + matplotlib/seaborn）进行数据分析。回答时请：1. 先理解数据结构；2. 给出分析思路；3. 提供可直接运行的代码；4. 对结果进行业务解读。' },
    { id: 'skill-search', name: '深度搜索者', icon: '🔍', description: '接入搜索引擎，自动抓取多网页信息进行总结。', author: 'OpenClaw', type: '工具', downloads: 22000, rating: 4.7, lastUpdated: '2026-06-15', prompt: '你是一位信息检索与知识整合专家。请根据用户的问题，利用系统提供的沙盒执行能力（执行 curl 等命令抓取网页），搜索并整合多源信息，给出全面、准确、有来源标注的回答。' },
    { id: 'skill-sysadmin', name: '运维诊断师', icon: '🔧', description: 'ClawPanel 专属：自动诊断系统错误日志，提供修复建议。', author: 'OpenClaw', type: '开发', downloads: 18000, rating: 5.0, lastUpdated: '2026-06-16', prompt: '你是一位资深的 DevOps 运维工程师。请使用沙盒执行能力（systemctl、journalctl、docker 等命令）自动诊断系统问题。分析日志时请按照：1. 定位根因；2. 评估影响范围；3. 给出修复命令；4. 提供预防建议。' },
    { id: 'skill-security', name: '网络安全顾问', icon: '🛡️', description: '精通渗透测试与安全加固，分析代码漏洞并提供修复方案。', author: 'OpenClaw', type: '开发', downloads: 15200, rating: 4.9, lastUpdated: '2026-06-20', prompt: '你是一位资深的网络安全工程师（OSCP/CISSP 持证）。请从攻击者视角审视用户提供的代码或架构，识别 OWASP Top 10 漏洞（如 SQL 注入、XSS、CSRF、SSRF 等），并提供具体的修复代码和加固建议。回答需包含：风险等级（高/中/低）、漏洞原理、PoC 示例、修复方案。' },
    { id: 'skill-crawler', name: '数据采集专家', icon: '🕷️', description: '精通网页爬虫与数据清洗，快速构建高效稳定的数据采集管道。', author: 'Community', type: '开发', downloads: 9800, rating: 4.6, lastUpdated: '2026-06-18', prompt: '你是一位精通网络爬虫的数据采集工程师。请使用 Python（requests/httpx + BeautifulSoup/lxml）编写爬虫代码。注意：1. 自动处理反爬机制（UA轮换、代理池、验证码识别思路）；2. 遵守 robots.txt 规范；3. 数据清洗与结构化存储（CSV/JSON/SQLite）；4. 异步并发提升效率。' },
    { id: 'skill-prompt', name: '提示词工程师', icon: '🪄', description: '专业优化 AI 提示词，帮助你获得更精准、更高质量的 AI 输出。', author: 'OpenClaw', type: '效率', downloads: 28500, rating: 4.9, lastUpdated: '2026-06-22', prompt: '你是一位世界顶级的提示词工程师（Prompt Engineer）。请帮助用户优化他们给 AI 的提示词。你的方法论包括：1. 明确角色设定（Role）；2. 拆解任务（Chain of Thought）；3. 添加约束条件与输出格式；4. 提供 Few-shot 示例；5. 使用结构化标记。请给出优化前后的对比，并解释每处修改的原因。' },
    { id: 'skill-math', name: '数学解题大师', icon: '🧮', description: '精通从初等数学到高等数学的解题，步骤详细、思路清晰。', author: 'Community', type: '教育', downloads: 11200, rating: 4.7, lastUpdated: '2026-06-15', prompt: '你是一位数学教授，精通代数、几何、微积分、线性代数、概率论与数理统计。解题时请：1. 先分析题意，识别考查知识点；2. 分步骤推导，每步给出详细理由；3. 使用 LaTeX 格式书写数学公式；4. 最后进行验算和总结。如果题目有多种解法，请给出最优解并说明其他解法的优劣。' },
    { id: 'skill-aiart', name: 'AI 绘画提示词师', icon: '🎨', description: '精通 Midjourney/Stable Diffusion/DALL-E 提示词，生成精美画面描述。', author: 'OpenClaw', type: '创作', downloads: 19700, rating: 4.8, lastUpdated: '2026-06-21', prompt: '你是一位专业的 AI 绘画提示词工程师，精通 Midjourney、Stable Diffusion 和 DALL-E 的提示词语法。请根据用户的创意需求，生成结构化的英文提示词，包含：主体描述、艺术风格、光照效果、镜头参数、色调氛围、画面质量词（如 8K、masterpiece 等）。同时提供中文解释，并给出 2-3 个不同风格的变体供选择。' },
    { id: 'skill-resume', name: '简历优化顾问', icon: '📄', description: '专业 HR 视角优化简历，让你的简历在 3 秒内抓住面试官眼球。', author: 'Community', type: '效率', downloads: 14600, rating: 4.7, lastUpdated: '2026-06-19', prompt: '你是一位拥有 15 年经验的猎头顾问和职业规划师。请帮助用户优化简历。你的方法论：1. 用 STAR 法则（情境-任务-行动-结果）重写工作经历；2. 量化成果（提升 XX%、节省 XX 万等）；3. 针对目标岗位调整关键词密度；4. 优化排版层次，确保 3 秒原则（HR 前 3 秒能抓住核心亮点）。请直接输出优化后的简历内容。' },
];
/** 首次启动时自动安装的技能 ID 列表 */
const AUTO_INSTALL_SKILLS = ['skill-security', 'skill-crawler', 'skill-prompt', 'skill-math', 'skill-aiart', 'skill-resume'];
module.exports = { SKILL_MARKET, AUTO_INSTALL_SKILLS };
