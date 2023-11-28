FROM node:19-alpine AS appbuild
COPY ./code/package.json /
RUN npm install
RUN npm -v
RUN npm install @influxdata/influxdb-client @nivo/line 
RUN npm install react-datepicker
COPY ./code /
RUN npm run build

FROM nginx
COPY --from=appbuild /build /usr/share/nginx/html
COPY ./config/nginx/nginx.conf /etc/nginx/nginx.conf
COPY ./config/nginx/default.conf /etc/nginx/conf.d/default.conf
