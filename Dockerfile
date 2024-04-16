# Dockerfile

FROM node:18.19.0-alpine
RUN mkdir -p /opt/app
WORKDIR /opt/app
COPY ./package-lock.json ./
COPY ./package.json ./
RUN npm install
COPY . .
EXPOSE 80
EXPOSE 443
EXPOSE 9003
CMD [ "npm", "start"]
