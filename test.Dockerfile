FROM node:20.19.0 AS base
#USER app
WORKDIR /app
EXPOSE 3000
EXPOSE 8000
#Usa esta parte cuando se haga deploy en aws
#ENV NEXT_PUBLIC_API_BASE_URL "http://34.238.85.28:8080/api"
#ENV NEXT_PUBLIC_WS_URL "http://34.238.85.28:8080/ws/simulacion"

#Usa esta parte cuando pruebes localmente
ENV NEXT_PUBLIC_API_BASE_URL "http://bagcontrol-deploy-sboot-1:8080/api"
ENV NEXT_PUBLIC_WS_URL "http://bagcontrol-deploy-sboot-1:8080/ws/simulacion"

ADD . .
#RUN apt-get update && apt-get -y install chromium
RUN npm install
#RUN node node_modules/puppeteer/install.mjs
RUN npm run build
ENTRYPOINT ["npm","run","dev"]
#RUN cd /app
