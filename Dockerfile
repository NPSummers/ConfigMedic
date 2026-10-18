FROM oven/bun:1.1.38 AS build
WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
RUN bun run build

FROM oven/bun:1.1.38-slim
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "build/index.js"]
