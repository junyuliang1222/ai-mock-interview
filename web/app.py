"""
AI Mock Interview — Flask 后端
DeepSeek API 代理 + 静态文件服务 + 基于 SKILL.md 的面试规则
"""
import os
from flask import Flask, request, jsonify, send_from_directory
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()  # 从 .env 文件加载环境变量

app = Flask(__name__, static_folder="static", static_url_path="")

# DeepSeek API 客户端（OpenAI 兼容）
deepseek = OpenAI(
    api_key=os.environ.get("DEEPSEEK_API_KEY", ""),
    base_url="https://api.deepseek.com",
)

# ---------- 加载 SKILL.md（面试规则唯一来源） ----------

SKILL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "SKILL.md")


def load_skill_content():
    """读取 SKILL.md，去掉 YAML frontmatter"""
    if not os.path.exists(SKILL_PATH):
        return None
    with open(SKILL_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    # 去掉 YAML frontmatter（第一个 --- 到第二个 --- 之间）
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            return parts[2].strip()
    return content.strip()


SKILL_CONTENT = load_skill_content()

# ---------- 静态文件 ----------


@app.route("/")
def index():
    """返回首页"""
    return send_from_directory("static", "index.html")


# ---------- API ----------


@app.route("/api/start-interview", methods=["POST"])
def start_interview():
    """基于 SKILL.md + 用户配置，构建 system prompt"""
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "缺少请求数据"}), 400

    role_type = data.get("roleType", "通用")
    difficulty = data.get("difficulty", "校招生")
    style = data.get("style", "综合面试")
    resume_text = data.get("resumeText", "")
    jd_text = data.get("jdText", "")

    # 候选人上下文
    context_parts = []
    if resume_text:
        context_parts.append(
            f"## 候选人简历\n"
            f"以下是候选人的简历内容，请围绕这些经历提问：\n"
            f'"""\n{resume_text}\n"""\n'
            f"如果候选人自我介绍或回答的内容与简历有出入，可以追问澄清。"
        )
    else:
        context_parts.append(
            "## 候选人简历\n"
            "候选人未提供简历。请先让候选人做自我介绍，根据自我介绍的内容来提问。"
        )

    if jd_text:
        context_parts.append(
            f"## 目标岗位 JD\n"
            f"以下是候选人目标岗位的 JD，请围绕岗位要求提问，关注候选人的经历与 JD 的匹配度：\n"
            f'"""\n{jd_text}\n"""\n'
            f"如果候选人的简历内容与 JD 要求存在差距，可以在面试中点出。"
        )

    if SKILL_CONTENT is None:
        return jsonify({"success": False, "error": "SKILL.md 未找到，无法构建面试规则"}), 500

    system_prompt = (
        f"你是一位经验丰富的面试官，正在进行一场模拟面试。请严格按照以下规则执行。\n\n"
        f"## 本次面试配置\n"
        f"- 岗位类型：{role_type}\n"
        f"- 难度档位：{difficulty}\n"
        f"- 面试风格：{style}\n\n"
        + "\n".join(context_parts) +
        f"\n\n---\n\n{SKILL_CONTENT}\n\n---\n\n"
        f"现在，面试开始。先请候选人做自我介绍。"
    )

    return jsonify({"success": True, "systemPrompt": system_prompt})


@app.route("/api/chat", methods=["POST"])
def chat():
    """代理 DeepSeek API 聊天请求"""
    data = request.get_json()
    if not data or "messages" not in data:
        return jsonify({"success": False, "error": "缺少 messages 字段"}), 400

    if not os.environ.get("DEEPSEEK_API_KEY"):
        return jsonify({"success": False, "error": "后端未配置 DEEPSEEK_API_KEY"}), 500

    try:
        response = deepseek.chat.completions.create(
            model="deepseek-chat",
            messages=data["messages"],
            temperature=0.8,
            max_tokens=2048,
        )
        reply = response.choices[0].message.content
        usage = response.usage
        return jsonify({
            "success": True,
            "reply": reply,
            "usage": {
                "prompt": usage.prompt_tokens,
                "completion": usage.completion_tokens,
                "total": usage.total_tokens,
            } if usage else None,
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ---------- 启动 ----------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(debug=True, port=port)
