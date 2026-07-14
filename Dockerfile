# Stage 1: 安装依赖 + 构建
FROM node:20-alpine AS builder
WORKDIR /app

# 安装 OpenSSL（Prisma 需要）
RUN apk add --no-cache openssl

# 先复制依赖描述文件，利用 Docker 缓存层
COPY package.json package-lock.json ./
RUN npm ci

# 复制 Prisma schema，生成客户端
COPY prisma ./prisma
RUN npx prisma generate

# 复制源码并构建
COPY . .
RUN npm run build

# Stage 2: 生产运行
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl netcat-openbsd tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

ENV NODE_ENV=production
ENV TZ=Asia/Shanghai

# 复制 standalone 输出（不含其 node_modules，用完整版覆盖）
COPY --from=builder /app/.next/standalone ./
# 清理泄露的敏感文件
RUN rm -f /app/.env /app/.env.production /app/.env.local 2>/dev/null || true
RUN rm -rf /app/node_modules
# 复制完整 node_modules（Next.js standalone trace 会遗漏 bcryptjs/jose 等）
COPY --from=builder /app/node_modules ./node_modules
# 复制静态资源
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# 复制 Prisma schema（用于运行时 migration）
COPY --from=builder /app/prisma ./prisma

# 复制启动脚本
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
