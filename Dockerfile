FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts --prefer-offline 2>/dev/null || npm install --ignore-scripts --prefer-offline
COPY frontend/package*.json ./frontend/
RUN cd frontend && (npm ci --ignore-scripts --prefer-offline 2>/dev/null || npm install --ignore-scripts --prefer-offline)
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

FROM node:20-alpine
RUN apk add --no-cache bash
WORKDIR /app
COPY --from=build /app/frontend/dist ./frontend/dist
COPY backend/ ./backend/
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
RUN mkdir -p /app/backend/data/pdfs /app/backend/data/images
EXPOSE 8080
ENV NODE_ENV=production
CMD ["npm", "start"]
