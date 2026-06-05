#!/bin/bash
# 启动 AI Mock Interview Web 后端
# 用法: bash start.sh

cd "$(dirname "$0")"

# 杀掉旧进程
lsof -ti :5001 | xargs kill -9 2>/dev/null

# 启动
conda run -n sql-project python -c "
from app import app
app.run(debug=True, port=5001)
" &
sleep 2
echo "已启动 → http://127.0.0.1:5001/"
