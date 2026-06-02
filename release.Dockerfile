FROM node:20.19.0 AS base
#USER app
WORKDIR /app
EXPOSE 3000
EXPOSE 8000
ENV NEXT_PUBLIC_API_BASE_URL "http://18.215.234.20:8080/api"
ENV NEXT_PUBLIC_WS_URL "http://18.215.234.20:8080/ws/simulacion"

ADD . .
#RUN apt-get update && apt-get -y install chromium
RUN npm install
#RUN node node_modules/puppeteer/install.mjs
RUN npm run build
ENTRYPOINT ["npm","run","dev"]
#RUN cd /app
