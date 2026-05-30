# Stage 1: Build the React frontend
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG GIT_SHA=unknown
ARG GIT_LOG=
ENV GIT_SHA=$GIT_SHA
ENV GIT_LOG=$GIT_LOG
RUN npm run build

# Stage 2: Production server
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server/ ./server/
COPY --from=builder /app/dist ./dist
EXPOSE 3001
CMD ["node", "server/index.js"]
