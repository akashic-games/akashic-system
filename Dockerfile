FROM node:24.14.0 AS build

LABEL description="Akashic System"

WORKDIR /app
ENV NODE_ENV development
ENV NODE_OPTIONS=--max_old_space_size=4096
# build
COPY . /app/
# build and compile
RUN yarn install --immutable --check-cache
RUN yarn build
#zookeeper のビルドをするのに node-gyp のツールチェインが必要で、 node:alpine だと npm install ができない。
#なので、本番環境でも、NODE_ENV=development で `npm ci` した node_modules を使う。

# 最終的に push されるイメージ ここから最後まで。
FROM node:24.14.0-alpine
ENV APP_HOME /home/akashic/app
ENV NODE_ENV production
#
## ユーザ作ったりするやつ
RUN mkdir -p $APP_HOME && \
    addgroup -S -g 30000 akashic && \
    adduser -S -D -h $APP_HOME -s /sbin/nologin -G akashic -u 30000 akashic && \
    chown -R akashic:akashic /home/akashic && \
    ls -alR /home
##
USER akashic
WORKDIR $APP_HOME
COPY --from=build --chown=akashic /app/ .
#
ENTRYPOINT ["npm"]
CMD ["start"]
