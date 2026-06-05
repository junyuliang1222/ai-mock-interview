/**
 * AI Mock Interview — 前端聊天逻辑
 * Liquid Glass 风格，DeepSeek API 驱动
 */

// ---------- DOM ----------
const setupPanel = document.getElementById("setupPanel");
const headerBar = document.getElementById("headerBar");
const headerBadge = document.getElementById("headerBadge");
const chatArea = document.getElementById("chatArea");
const inputArea = document.getElementById("inputArea");
const chatMessages = document.getElementById("chatMessages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const typingIndicator = document.getElementById("typingIndicator");
const startBtn = document.getElementById("startBtn");

// ---------- 面试配置（从 UI 读取） ----------
let interviewConfig = {};

// ---------- 消息状态 ----------
let messages = [];
let isLoading = false;
let interviewActive = false;
let totalTokens = 0;

// ---------- 文件上传（仅 .txt / .md，浏览器直读） ----------
const resumeInput = document.getElementById("resumeInput");
const resumeFileInput = document.getElementById("resumeFileInput");
const uploadBtn = document.getElementById("uploadBtn");

uploadBtn.addEventListener("click", () => resumeFileInput.click());

resumeFileInput.addEventListener("change", () => {
    const file = resumeFileInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => { resumeInput.value = e.target.result; };
        reader.readAsText(file);
    }
});

resumeInput.addEventListener("dragover", (e) => {
    e.preventDefault();
    resumeInput.classList.add("drag-over");
});

resumeInput.addEventListener("dragleave", () => {
    resumeInput.classList.remove("drag-over");
});

resumeInput.addEventListener("drop", (e) => {
    e.preventDefault();
    resumeInput.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => { resumeInput.value = e.target.result; };
        reader.readAsText(file);
    }
});

// ---------- JD 文件上传 ----------
const jdInput = document.getElementById("jdInput");
const jdFileInput = document.getElementById("jdFileInput");
const jdUploadBtn = document.getElementById("jdUploadBtn");

jdUploadBtn.addEventListener("click", () => jdFileInput.click());

jdFileInput.addEventListener("change", () => {
    const file = jdFileInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => { jdInput.value = e.target.result; };
        reader.readAsText(file);
    }
});

jdInput.addEventListener("dragover", (e) => {
    e.preventDefault();
    jdInput.classList.add("drag-over");
});

jdInput.addEventListener("dragleave", () => {
    jdInput.classList.remove("drag-over");
});

jdInput.addEventListener("drop", (e) => {
    e.preventDefault();
    jdInput.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => { jdInput.value = e.target.result; };
        reader.readAsText(file);
    }
});

// ---------- 分段按钮交互 ----------
document.querySelectorAll(".segmented-row").forEach((row) => {
    row.addEventListener("click", (e) => {
        const btn = e.target.closest(".seg-btn");
        if (!btn) return;
        // 取消同组其他选中
        row.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("selected"));
        // 选中当前
        btn.classList.add("selected");
    });
});

// ---------- 输入事件（一次性绑定，用 interviewActive 控制） ----------
sendBtn.addEventListener("click", () => {
    if (interviewActive) handleSend();
});
messageInput.addEventListener("keydown", (e) => {
    if (interviewActive) handleKeydown(e);
});
messageInput.addEventListener("input", autoResize);

// ---------- 开始面试 ----------
startBtn.addEventListener("click", async () => {
    // 读取简历内容和 JD
    const resumeText = document.getElementById("resumeInput").value.trim();
    const jdText = document.getElementById("jdInput").value.trim();

    // 读取用户选择
    interviewConfig = {
        roleType: getSelected("roleType"),
        difficulty: getSelected("difficulty"),
        style: getSelected("style"),
    };

    // 更新 header badge
    headerBadge.textContent = `${interviewConfig.difficulty} · ${interviewConfig.roleType} · ${interviewConfig.style}`;

    // 构建 system prompt
    const systemPrompt = buildSystemPrompt(interviewConfig, resumeText, jdText);

    // 隐藏配置面板，显示面试界面
    setupPanel.classList.add("hidden");
    setTimeout(() => {
        setupPanel.style.display = "none";
        headerBar.style.display = "flex";
        chatArea.style.display = "flex";
        inputArea.style.display = "flex";
        messageInput.focus();
    }, 300);

    // 重置面试状态
    interviewEnded = false;
    interviewActive = true;
    endBtn.disabled = false;
    messageInput.disabled = false;
    totalTokens = 0;
    updateTokenCounter();

    // 构建初始 messages
    messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: "（面试开始）" },
    ];

    // 获取 AI 面试官的开场白
    const success = await sendToAI();
    if (!success) {
        // 回到配置面板
        interviewActive = false;
        messages = [];
        chatMessages.querySelectorAll(".message").forEach(el => el.remove());
        typingIndicator.style.display = "none";
        headerBar.style.display = "none";
        chatArea.style.display = "none";
        inputArea.style.display = "none";
        setupPanel.classList.remove("hidden");
        setupPanel.style.display = "flex";
    }
});

// ---------- 读取分段按钮选中值 ----------
function getSelected(key) {
    const row = document.querySelector(`.segmented-row[data-key="${key}"]`);
    const selected = row.querySelector(".seg-btn.selected");
    return selected ? selected.dataset.value : "";
}

// ---------- 构建 System Prompt ----------
function buildSystemPrompt(config, resumeText, jdText) {
    const difficultyGuide = {
        "日常实习生": `你是面试官，目标难度为「日常实习生」。核心考察学习能力——这个人学东西快不快？能不能迅速上手？
追问力度：1-2 层，见好就收。整体语感：友善，更像交流。不要求答对所有问题，但看遇到不会的怎么应对。
对于每个回答，留意展现的学习方法、学习速度和举一反三的能力。可以适当设置"未知情境"问题。`,

        "暑期实习生": `你是面试官，目标难度为「暑期实习生」，接近校招标准。核心考察：这是一年后我要招的人吗？值得培养吗？
追问力度：2-3 层。整体语感：偏严格但留余地，更像考察。聚焦候选人主导的部分，关注结果和成长性。`,

        "校招生": `你是面试官，目标难度为「校招生」。追问到底，逼到候选人说不出来为止。
追问力度：3-5 层，挖到说不上来为止。整体语感：客观甚至挑剔，更像同事在过方案。重点测 trade-off 理解和独立设计能力。
对于项目追问：S/T/A/R 完整覆盖——"这是你做的还是你执行的？方案谁定的？为什么这样做？有什么 trade-off？"`,

        "研究生入学": `你是面试官，目标难度为「研究生入学面试」。核心考察理论深度、研究方法论、学术兴趣。
追问力度：理论层面持续深挖。整体语感：学术探讨式，看似温和但考察潜台词很严。不关注业务落地能力，关注"用了什么研究方法？看过哪些相关论文/文献？怎么验证结论？创新点在哪？"`,
    };

    const styleGuide = {
        "技术深挖": `面试风格为「技术深挖」。重点深挖技术选型、架构决策、工具原理、异常处理。
提问类型：直接技术问、场景假设、项目闲聊式切入、观点追问（trade-off 讨论）、挑刺质疑。适当穿插行为问题。`,

        "综合面试": `面试风格为「综合面试」。项目经验追问 + 行为问题并重。
提问类型：项目细节追问、行为洞察（困难/冲突/成长/团队协作）、场景假设。技术问题适度，不过于深挖。`,

        "岗位自适应": `面试风格为「岗位自适应」。根据候选人简历中的岗位类型自动选择侧重。
技术岗 → 以技术深挖为主，穿插行为问题。
业务岗 → 以业务理解 + 推动能力为主，技术仅问基础概念。
创作岗 → 以作品追问 + 方法论反思为主。
研究岗 → 理论深度 + 方法论 + 研究方向探讨。`,
    };

    const roleGuide = {
        "技术岗": `候选人为技术岗。以技术深挖为主，穿插行为问题。重点考察：技术基础、系统设计/架构 sense、问题解决能力、项目经验深度。`,
        "业务岗": `候选人为业务岗。以业务理解 + 推动能力为主，技术仅问基础概念。重点考察：业务理解、方法论、数据意识、沟通协调。`,
        "创作岗": `候选人为创作岗。以作品追问 + 方法论反思为主。重点考察：创作方法论、审美判断、作品深度。`,
        "研究岗": `候选人为研究岗。注重理论深度 + 方法论 + 研究方向探讨。重点考察：理论基础、研究方法论、创新思维、学术表达。`,
        "通用": `候选人岗位类型为通用。技术 + 行为各半，全面考察。`,
    };

    return `你是一位经验丰富的面试官，正在进行一场模拟面试。

## 你的角色
- 面试岗位类型：${config.roleType}
${roleGuide[config.roleType] || ""}
- 目标难度：${config.difficulty}
${difficultyGuide[config.difficulty] || ""}
- 面试风格：${config.style}
${styleGuide[config.style] || ""}

## 候选人简历
${resumeText ? `以下是候选人的简历内容，请围绕这些经历提问：\n"""\n${resumeText}\n"""\n如果候选人自我介绍或回答的内容与简历有出入，可以追问澄清。` : "候选人未提供简历。请先让候选人做自我介绍，根据自我介绍的内容来提问。"}

## 目标岗位 JD
${jdText ? `以下是候选人目标岗位的 JD，请围绕岗位要求提问，关注候选人的经历与 JD 的匹配度：\n"""\n${jdText}\n"""\n如果候选人的简历内容与 JD 要求存在差距，可以在面试中点出。` : "候选人未提供岗位 JD。请根据简历内容进行通用提问。"}

## 面试流程
1. 先让候选人做 1 分钟自我介绍（暖场）
2. 围绕候选人的简历项目（如有）或自我介绍中的经历进行追问
3. 穿插行为问题（困难/冲突/成长/团队协作）
4. 在适当的时候抛出场景假设题和质疑
5. 最后进入反问环节

## 追问规则
- 回答不够具体时追问细节（"能举一个具体的例子吗？"）
- 回答涉及技术决策时追问 why（"为什么选这个方案？当时还有哪些备选？"）
- 回答有明显错误时直接指出质疑
- 自然衔接，不要机械套模板
- 容忍度动态调整：前面表现好时宽容，前面表现差时严厉

## 重要约束
- 每次只问一个问题，不要一次抛多个问题
- 面试过程中不要评价候选人的回答，不要给反馈，不要打分
- 如果候选人问"这个回答怎么样"，回答"面试结束后我会统一给你反馈"
- 用中文提问，专业术语保留英文（如 trade-off、ACID、QPS 等）
- 保持面试官的角色状态，不要在面试结束前给任何总结或建议

现在，面试开始。先请候选人做自我介绍。`;
}

// ---------- 结束面试 ----------
const endBtn = document.getElementById("endBtn");
let interviewEnded = false;

endBtn.addEventListener("click", async () => {
    if (interviewEnded) return;

    const confirmed = confirm(
        "确定要结束面试吗？\n\n" +
        "AI 面试官将根据你的所有回答，输出结构化的 STAR/CARL 评估报告和改善建议。"
    );
    if (!confirmed) return;

    interviewEnded = true;
    endBtn.disabled = true;
    messageInput.disabled = true;
    sendBtn.disabled = true;

    // 追加评估指令
    const evaluationPrompt = `面试到此结束。现在请你以面试官的身份，根据我（候选人）的全部回答，给出结构化的总结反馈。

## 输出格式要求

### 1. 总体印象
用 2-3 句话概括我的整体表现。

### 2. STAR/CARL 评估
对我在主要项目/经历上的回答，用以下维度评估（每个维度给出 ✅ 做得好的 和 ⚠️ 可改进的）：
- **S** (Situation) 背景交代
- **T** (Task) 任务目标
- **A** (Action) 行动过程
- **R** (Result) 结果成果
- **C** (Context) 场景/约束
- **L** (Learning) 反思成长

### 3. 能力素质模型评分（1-5 分，3 分为及格）
针对我的岗位类型，选择相关的核心能力维度进行评分，每个分数旁用一句话说明理由。

### 4. 改进建议
按优先级列出 3-5 条具体可操作的改进建议。`;

    messages.push({ role: "user", content: evaluationPrompt });
    appendMessage("user", "（结束面试，请求评估反馈）");

    const success = await sendToAI();
    if (!success) {
        // 恢复：撤销结束操作
        messages.pop();
        const lastUserMsg = chatMessages.querySelector(".message.user:last-of-type");
        if (lastUserMsg) lastUserMsg.remove();
        interviewEnded = false;
        endBtn.disabled = false;
        messageInput.disabled = false;
        messageInput.focus();
    } else {
        // 替换最后一个气泡为美化报告
        const lastBubble = chatMessages.querySelector(".message.interviewer:last-of-type");
        if (lastBubble) {
            const reply = messages[messages.length - 1].content;
            const reportEl = renderReport(reply);
            lastBubble.replaceWith(reportEl);
        }
    }
});

// ---------- 重新开始 ----------
const restartBtn = document.getElementById("restartBtn");

restartBtn.addEventListener("click", () => {
    if (isLoading) return;

    const confirmed = confirm(
        "确定要重新开始吗？\n\n" +
        "当前的面试对话将被清空，你可以重新设置参数并开始新的面试。"
    );
    if (!confirmed) return;

    // 重置所有状态
    interviewActive = false;
    interviewEnded = false;
    isLoading = false;
    messages = [];
    totalTokens = 0;
    updateTokenCounter();

    // 重新启用控件
    endBtn.disabled = false;
    messageInput.disabled = false;
    messageInput.value = "";
    autoResize();

    // 清空聊天记录
    chatMessages.querySelectorAll(".message").forEach(el => el.remove());

    // 隐藏打字指示器
    typingIndicator.style.display = "none";

    // 切换视图：隐藏面试 UI，显示配置面板
    headerBar.style.display = "none";
    chatArea.style.display = "none";
    inputArea.style.display = "none";

    setupPanel.classList.remove("hidden");
    setupPanel.style.display = "flex";
});

// ====================================================================
//  预览报告（测试用，需要时取消注释）
// ====================================================================
/*
const testReportBtn = document.getElementById("testReportBtn");

testReportBtn.addEventListener("click", () => {
    setupPanel.classList.add("hidden");
    setTimeout(() => {
        setupPanel.style.display = "none";
        headerBar.style.display = "flex";
        chatArea.style.display = "flex";
        inputArea.style.display = "flex";
        headerBadge.textContent = "校招生 · 技术岗 · 综合面试";
    }, 300);

    interviewActive = true;
    interviewEnded = true;
    endBtn.disabled = true;
    messageInput.disabled = true;
    sendBtn.disabled = true;

    // 追加几条模拟对话
    appendMessage("user", "我叫张三，是XX大学计算机科学专业2024届毕业生...");
    appendMessage("interviewer", "请详细说说你在腾讯实习时负责的微服务网关项目。");
    appendMessage("user", "我主要负责了API网关的限流模块设计和实现...");
    appendMessage("interviewer", "为什么选择Token Bucket算法而不是Leaky Bucket？有什么trade-off？");

    // 注入模拟评估报告
    const mockReport = `### 1. 总体印象
候选人在本次面试中展现了较为扎实的技术基础，项目经验描述清晰有条理。但在系统设计层面的深度追问时暴露出一些不足，对 trade-off 的理解偏浅，需要加强架构思维训练。整体沟通表达流畅，态度积极。

### 2. STAR/CARL 评估

**S (Situation) 背景交代**
✅ 做得好的：能够清楚描述实习项目的业务背景和技术栈选型原因
⚠️ 可改进的：部分技术决策的前置条件交代不足，比如为什么那个时间点必须做限流改造

**T (Task) 任务目标**
✅ 做得好的：对自己负责的模块边界有清晰认知，能区分"我做的"和"团队做的"
⚠️ 可改进的：量化指标偏少，比如限流改造后具体降低了多少 P99 延迟

**A (Action) 行动过程**
✅ 做得好的：技术选型有对比分析（Token Bucket vs 固定窗口），代码实现细节能说清楚
⚠️ 可改进的：对于方案的局限性讨论不够——"如果让你重新设计，你会怎么做？"回答较为笼统

**R (Result) 结果成果**
✅ 做得好的：提到了上线后的实际效果和监控数据
⚠️ 可改进的：缺乏对失败的复盘——"有没有做得不好的地方？踩过什么坑？"

**C (Context) 场景/约束**
⚠️ 可改进的：没有主动提到团队规模、项目周期、技术债务等上下文约束

**L (Learning) 反思成长**
✅ 做得好的：能总结从项目中学到的技术点
⚠️ 可改进的：对于"如果现在重新做，会有什么不同"缺乏深度思考

### 3. 能力素质模型评分

**技术基础：4 分** — 常见概念理解到位，八股文掌握较好
**系统设计：3 分** — 有一定架构意识，但面对开放性问题时思路不够开阔
**问题解决：4 分** — 能清晰描述解决问题的过程和方法
**沟通表达：4 分** — 表达流畅，逻辑清晰，结构化程度好
**业务理解：3 分** — 对所做项目的业务价值有一定理解，但深度不够
**学习能力：4 分** — 有主动学习的意识，简历上项目涉及的技术栈较广

### 4. 改进建议

1. 加强系统设计训练——可以多看业界经典架构案例（如系统设计面试题），重点思考为什么这样设计，而不是记住了什么设计
2. 每个项目准备一个"失败复盘"版本——面试中能说出踩过的坑和学到的东西，比只讲成功更有说服力
3. 补充量化思维——所有项目成果尽量用数字说话，如"降低了XX%延迟""节省了XX人日"
4. 准备 3-5 个有深度的反问问题——反问环节是你展示思考深度的最后机会，不要浪费`;

    messages.push({ role: "assistant", content: mockReport });

    const reportEl = renderReport(mockReport);
    chatMessages.appendChild(reportEl);

    scrollToBottom();
});
*/

// ---------- 发送消息 ----------
async function handleSend() {
    const text = messageInput.value.trim();
    if (!text || isLoading) return;

    appendMessage("user", text);
    messages.push({ role: "user", content: text });

    messageInput.value = "";
    autoResize();

    const success = await sendToAI();
    if (!success) {
        // 恢复：撤回用户消息，还原输入框内容
        messages.pop();
        const lastUserMsg = chatMessages.querySelector(".message.user:last-of-type");
        if (lastUserMsg) lastUserMsg.remove();
        messageInput.value = text;
        autoResize();
        messageInput.focus();
    }
}

// ---------- 键盘事件 ----------
function handleKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
}

// ---------- 自动调整输入框高度 ----------
function autoResize() {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + "px";
}

// ---------- 错误 Toast ----------
let toastTimer = null;

function showErrorToast(message) {
    const toast = document.getElementById("errorToast");
    const toastText = document.getElementById("errorToastText");

    if (toastTimer) clearTimeout(toastTimer);

    toastText.textContent = message;
    toast.style.display = "flex";
    toast.classList.remove("fadeout");

    // 强制回流后重启动画
    void toast.offsetWidth;

    toastTimer = setTimeout(() => {
        toast.classList.add("fadeout");
        toastTimer = setTimeout(() => {
            toast.style.display = "none";
            toast.classList.remove("fadeout");
        }, 350);
    }, 4000);
}

// ---------- 调用后端 API ----------
async function sendToAI() {
    isLoading = true;
    sendBtn.disabled = true;
    typingIndicator.style.display = "flex";
    scrollToBottom();

    let success = false;
    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages }),
        });

        const data = await response.json();

        if (data.success) {
            messages.push({ role: "assistant", content: data.reply });
            appendMessage("interviewer", data.reply);
            success = true;

            // 累计 token
            if (data.usage) {
                totalTokens += data.usage.total;
                updateTokenCounter();
            }
        } else {
            showErrorToast(data.error || "服务器返回错误");
        }
    } catch (err) {
        showErrorToast("网络连接失败，请检查网络后重试");
    } finally {
        isLoading = false;
        if (success) {
            sendBtn.disabled = false;
            typingIndicator.style.display = "none";
            messageInput.focus();
        }
        scrollToBottom();
    }
    return success;
}

// ---------- 添加消息到界面 ----------
function appendMessage(role, text) {
    const div = document.createElement("div");
    div.className = `message ${role}`;

    const label = document.createElement("div");
    label.className = "message-label";
    label.textContent = role === "interviewer" ? "面试官" : "你";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = text;

    div.appendChild(label);
    div.appendChild(bubble);
    chatMessages.appendChild(div);

    scrollToBottom();
}

// ---------- 滚动到底部 ----------
function scrollToBottom() {
    requestAnimationFrame(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

// ---------- Token 计数 ----------
function updateTokenCounter() {
    const counter = document.getElementById("tokenCounter");
    if (totalTokens >= 1000) {
        counter.textContent = `Tokens: ${(totalTokens / 1000).toFixed(1)}k`;
    } else {
        counter.textContent = `Tokens: ${totalTokens}`;
    }
}

// ====================================================================
//  报告美化渲染
// ====================================================================

function renderReport(markdown) {
    const wrapper = document.createElement("div");
    wrapper.className = "report-wrapper";

    // 按 ### 拆分为各板块
    const rawSections = markdown.split(/^### /m).filter(s => s.trim());
    if (rawSections.length === 0) {
        // 没有 ### 标题，整个当纯文本渲染
        const card = createReportCard("评估报告", markdown);
        wrapper.appendChild(card);
        return wrapper;
    }

    for (const raw of rawSections) {
        const lines = raw.split("\n");
        const title = lines[0].trim();
        const body = lines.slice(1).join("\n").trim();
        if (!body) continue;
        wrapper.appendChild(createReportCard(title, body));
    }

    return wrapper;
}

function createReportCard(title, body) {
    const card = document.createElement("div");
    card.className = "report-card";

    const cleanTitle = title.replace(/^\d+\.\s*/, "");
    const iconSvg = getSectionIcon(cleanTitle);

    card.innerHTML = `
        <div class="report-card-header">
            ${iconSvg || ""}
            <span class="report-card-title">${cleanTitle}</span>
        </div>
        <div class="report-card-body">${parseReportBody(body)}</div>
    `;

    return card;
}

function parseReportBody(text) {
    let html = text;

    // ✅ ⚠️ 着色（最先，纯文本替换）
    html = html.replace(/✅/g, '<span class="hl-good">✅</span>');
    html = html.replace(/⚠️/g, '<span class="hl-warn">⚠️</span>');

    // 评分行（必须在粗体之前，处理 **技术基础：4 分** 这种写法）
    // 变体 A：label：X分 — comment
    html = html.replace(
        /^\*{0,2}(.+?)[：:]\s*(\d+)\s*分?\*{0,2}\s*(?:[—–\-—,，]\s*(.+))?$/gm,
        (_, label, score, comment) => buildScoreRow(label, score, comment)
    );

    // 变体 B：label：X/5
    html = html.replace(
        /^\*{0,2}(.+?)[：:]\s*(\d+)\s*\/\s*5\*{0,2}\s*$/gm,
        (_, label, score) => buildScoreRow(label, score, "")
    );

    // 粗体（评分行之后）
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // 无序列表
    html = html.replace(/^- (.+)$/gm, '<div class="list-item"><span class="list-dot">•</span> $1</div>');

    // 有序列表
    html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<div class="list-item"><span class="list-num">$1.</span> $2</div>');

    // 换行
    html = html.replace(/\n/g, "<br>");

    return html;
}

function buildScoreRow(label, score, comment) {
    const num = parseInt(score);
    const pct = Math.round((num / 5) * 100);
    const colorClass = num <= 2 ? "score-low" : num === 3 ? "score-mid" : "score-high";
    return `<div class="score-row">
        <span class="score-label">${label}</span>
        <div class="score-bar-track">
            <div class="score-bar-fill ${colorClass}" style="width:${pct}%"></div>
        </div>
        <span class="score-value">${score}/5</span>
        ${comment ? `<span class="score-comment">${comment}</span>` : ""}
    </div>`;
}

function getSectionIcon(title) {
    if (title.includes("总体印象")) {
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    }
    if (title.includes("STAR") || title.includes("CARL")) {
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
    }
    if (title.includes("评分") || title.includes("能力") || title.includes("素质")) {
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;
    }
    if (title.includes("改进") || title.includes("建议")) {
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
    }
    return "";
}
