FROM node:22-alpine
RUN apk add --no-cache tzdata
WORKDIR /app
COPY . .
ENV PORT=3000 DATA_DIR=/data TZ=Asia/Tashkent
VOLUME /data
EXPOSE 3000
CMD ["node", "server.js"]
