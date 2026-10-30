FROM node:18-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/employer/package.json apps/employer/package.json
RUN pnpm install --frozen-lockfile --filter employer
COPY apps/employer apps/employer
RUN cd apps/employer && pnpm build

FROM nginx:alpine
COPY --from=build /app/apps/employer/dist /usr/share/nginx/html
COPY apps/employer/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
