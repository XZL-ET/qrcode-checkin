#!/bin/sh
set -e

echo "⏳ 等待数据库就绪..."
# 等待 MySQL 3306 端口可连接
until nc -z mysql 3306 2>/dev/null; do
  sleep 2
done
echo "✅ 数据库已就绪"

echo "⏳ 执行数据库迁移..."
node node_modules/prisma/build/index.js db push --schema=./prisma/schema.prisma

echo "⏳ 执行种子数据（如需要）..."
node node_modules/prisma/build/index.js db seed --schema=./prisma/schema.prisma 2>/dev/null || echo "   (种子数据已存在，跳过)"

echo "🚀 启动应用..."
exec node server.js -H 0.0.0.0
