# Redis Client for Typescript

## Overview

Redis にアクセスするクライアントおよびユーティリティを提供する。

## Usage

```javascript
import { RedisRepository } from "@akashic/redis-client";

const key = "redis_repository_key";
const repos = new RedisRepository({ host: "localhost", port: 6379, auth: "" });

Promise.all([
  repos.zIncrBy(key, 100, "member1"),
  repos.zIncrBy(key, 101, "member2"),
  repos.zIncrBy(key, 102, "member3"),
  repos.zIncrBy(key, 103, "member4"),
  repos.zIncrBy(key, 104, "member5"),
])
  .then(() => {
    return repos.zRevRangeByScore(key, { min: 101, max: 102 });
  })
  .then((score) => {
    console.log(score);
  })
  .catch((err) => {
    console.error(err);
  });
```

## ビルド方法

```sh
npm install
```

## テスト方法

1. [TSLint](https://github.com/palantir/tslint "TSLint")を使ったLint
2. [Jasmine](http://jasmine.github.io "Jasmine")を使ったテスト

がそれぞれ実行されます。

```sh
npm test
```

## ライセンス

本リポジトリは MIT License の元で公開されています。
詳しくは [LICENSE](./LICENSE) をご覧ください。
