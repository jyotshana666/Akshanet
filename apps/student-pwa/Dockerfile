FROM node:18-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/student-pwa/package.json apps/student-pwa/package.json
RUN pnpm install --frozen-lockfile --filter student-pwa
COPY apps/student-pwa apps/student-pwa
RUN cd apps/student-pwa && pnpm build

FROM nginx:alpine
COPY --from=build /app/apps/student-pwa/dist /usr/share/nginx/html
COPY apps/student-pwa/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
