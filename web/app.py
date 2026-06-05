"""
AI Mock Interview — Flask 后端
DeepSeek API 代理 + 静态文件服务
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

# ---------- 静态文件 ----------


@app.route("/")
def index():
    """返回首页"""
    return send_from_directory("static", "index.html")


# ---------- API ----------


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
