FROM node:18-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/aicte-dashboard/package.json apps/aicte-dashboard/package.json
RUN pnpm install --frozen-lockfile --filter aicte-dashboard
COPY apps/aicte-dashboard apps/aicte-dashboard
RUN cd apps/aicte-dashboard && pnpm build

FROM nginx:alpine
COPY --from=build /app/apps/aicte-dashboard/dist /usr/share/nginx/html
COPY apps/aicte-dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
