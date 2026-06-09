#!/bin/sh
set -e

echo "⏳ 等待数据库就绪..."
# 等待 MySQL 3306 端口可连接
until nc -z mysql 3306 2>/dev/null; do
  sleep 2
done
echo "✅ 数据库已就绪"

echo "⏳ 执行数据库迁移..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "⏳ 执行种子数据（如需要）..."
npx prisma db seed --schema=./prisma/schema.prisma 2>/dev/null || echo "   (种子数据已存在，跳过)"

echo "🚀 启动应用..."
exec "$@"
