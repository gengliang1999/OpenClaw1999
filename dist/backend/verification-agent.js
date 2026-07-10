"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationAgent = void 0;
class VerificationAgent {
    modelManager;
    constructor(modelManager) {
        this.modelManager = modelManager;
    }
    /**
     * 对文本内容进行事实核对、谣言和广告过滤
     * @param content - 待审核的纯文本内容
     * @param targetModel - 执行研判的大模型实体描述
     */
    async verifyContent(content, targetModel) {
        const verifyPrompt = [
            {
                role: 'system',
                content: '你是一个高精度的安全事实核对与新闻真伪研判专家。请对用户提供的文章进行深度研判，并严格以 JSON 格式输出判定结果，不要包含任何 markdown 块或多余解释。格式：{"is_rumor": false, "is_ad": false, "reason": "具体研判理由...", "judgment": "PASS"}'
            },
            { role: 'user', content: content.substring(0, 5000) } // 截取前 5000 字防止超出模型视窗
        ];
        try {
            const reply = await this.modelManager.chat(verifyPrompt, { modelId: targetModel.id, temperature: 0.1 });
            const cleanReply = reply.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanReply);
            return {
                isRumor: !!result.is_rumor,
                isAd: !!result.is_ad,
                reason: result.reason || '无明确研判因果',
                judgment: result.judgment === 'PASS' ? 'PASS' : 'FAIL'
            };
        }
        catch (e) {
            return {
                isRumor: false,
                isAd: false,
                reason: `鉴伪过程解析 JSON 失败: ${e.message}`,
                judgment: 'FAIL'
            };
        }
    }
}
exports.VerificationAgent = VerificationAgent;
