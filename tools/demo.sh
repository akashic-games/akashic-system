#!/usr/bin/env bash
# 動作確認用ツール
#   これを実行することで Akashic System が動作するかどうかをブラウザを活用
#   して簡易的に確認することができます。

# 要件
# - bash 5 以上
# - jq 1.6 以上
# - python3
# - curl

# 使い方
# 1. Akashic System の導入を参考に niconico_snake (revision 0.1.0) のプレイが
#    できるように akashic-resources 下の準備をします。
#    https://akashic-games.github.io/akashic-system/introduction.html
#
# 2. `bash ./demo.sh` を実行します。
#    NOTE: 8001 番ポートを動作確認用で使用します。重複してしまう場合はその
#          サーバーを停止させるか、このスクリプトの DEMO_WEB_SERVER_PORT 値を
#          書き換えてください。
#
# 3. しばらくすると `OK` のログと共にブラウザが開きます。放送者用と参加者用で
#    ウィンドウ (もしくはタブ) が 2 つでき、プレーに参加した直後の状態になっ
#    ているはずです。
#    ブラウザが立ち上がらなかった場合は、OK の後に表示されている URL を直接
#    コピー & ペーストでブラウザに貼り付けてください。broadcaster_url と 
#    guest_url がその URL です。
#
# 4. 動作確認が終わりプレーを終了したい場合は、先ほどの demo.sh を実行している
#    ターミナル画面に戻り、`Enter` などの任意のキーを押します。

# 制限事項
#   簡易的なツールであるため、以下に対応していません。
#   - ブラウザの再読み込みボタン
#     - (参加用 URL は一度しか使えません)
#   - 3 人以上のプレイヤーの参加

# 引数について
# bash ./demo.sh
# - 引数を省略した場合は niconico_snake/0.1.0 が起動します。
#
# bash ./demo.sh game_code revision
# - game_code と revision を指定して任意のコンテンツを起動することもできます。

set -e

log() {
  echo "$@" >&2
}

error_log() {
  echo -en "\e[31mERROR: "
  echo "$@" >&2
  echo -en "\e[0m"
}

url_encode() {
  printf '%s' "$1" | python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.stdin.read().strip(), safe=''))"
}

# プレートークン生成して参加用 URL の断片を作る
join_player() {
  local user_id="$1"
  local player_name="$2"

  log "generating play token... (${user_id})"
  local result=$(curl -sS -X POST ${SYSTEM_API_BASE}v1.0/plays/${play_id}/tokens -H "Accept: application/json" -H "Content-type: application/json" -d '
    {
      "permission": {
        "writeTick": false,
        "readTick": true,
        "subscribeTick": true,
        "sendEvent": true,
        "subscribeEvent": false,
        "maxEventPriority": 0
      },
      "userId": "'$user_id'"
    }')
  local play_token=$(echo "$result" | jq -r .data.value)

  if [ -z "$play_token" -o "$play_token" = "null" ]; then
    error_log "failed to create play token!"
    echo "$result" | jq . >&2
  else
    # join event を送る
    log "sending join event..."
    local result=$(curl -sS -X POST ${SYSTEM_API_BASE}v1.0/plays/${play_id}/events -H "Accept: application/json" -H "Content-Type: application/json" -d '
    {
      "type": "JoinPlayer",
      "values": {
        "userId": "'$user_id'",
        "name": "'$player_name'"
      }
    }')
    if [ $(echo "$result" | jq .meta.status) != "200" ]; then
      error_log "failed to send join event!"
      echo "$result" | jq . >&2
      return 1
    fi

    echo "content_url=$(url_encode "$content_json_url")&playlog_server_url=$(url_encode "$PLAYLOG_SERVER_URL")&play_id=$play_id&user_id=$user_id&token=$play_token"
  fi
}

# 後始末
cleanup() {
  if [[ -n "$http_server_pid" ]]; then
    log "stopping demo http server..."
    kill "$http_server_pid" 2>/dev/null || true
    http_server_pid=""
  fi

  if [[ -n "$instance_id" && "$instance_id" != "null" ]]; then
    log -e "\ndeleting instance..."
    curl -sS -X DELETE "${SYSTEM_API_BASE}v1.0/instances/${instance_id}" || true
    instance_id=""
  fi

  sleep 0.5

  if [[ -n "$play_id" && "$play_id" != "null" ]]; then
    log -e "\n\ndeleting play..."
    curl -sS -X DELETE "${SYSTEM_API_BASE}v1.0/plays/${play_id}" || true
    play_id=""
  fi

  log -e "\n\n--finish--"
}


game_code=$1
revision=$2

SYSTEM_API_BASE="http://localhost:3100/"
RESOURCE_SERVER_BASE="http://localhost:2100/"
PLAYLOG_SERVER_URL="ws://localhost:4001"
BROADCASTER_USER_ID="broadcaster"
BROADCASTER_USER_NAME="broadcaster"
GUEST_USER_ID="guest"
GUEST_USER_NAME="guest"
DEMO_WEB_SERVER_PORT=8001

if [ -z "$game_code" ]; then
  game_code="niconico_snake"
  revision="0.1.0"
fi

if [ -z "$revision" ]; then
  content_id="$game_code"
else
  content_id="${game_code}/${revision}"
fi
content_json_url="${RESOURCE_SERVER_BASE}contents/${content_id}/content.json"

log "game_code/revision: $content_id"
log "content_json_url: $content_json_url"

trap cleanup EXIT INT TERM

while true; do
  # プレー作る
  log "creating play..."
  result=$(curl -sS -X POST ${SYSTEM_API_BASE}v1.0/plays -H "Accept: application/json" -H "Content-Type: application/json" -d '
    {
      "gameCode": "'$game_code'"
    }')

  play_id=$(echo "$result" | jq -r .data.id)
  if [ -z "$play_id" -o "$play_id" = "null" ]; then
    error_log "failed to create play!"
    echo "$result" | jq . >&2
    break
  fi
  log -e "\e[32m  play_id: ${play_id}\e[0m\n"

  # インスタンス作成
  log "creating instance..."
  result=$(curl -sS -X POST ${SYSTEM_API_BASE}v1.0/instances -H "Accept: application/json" -H "Content-type: application/json" -d '
    {
      "gameCode": "'$game_code'",
      "cost": 1,
      "entryPoint": "",
      "modules": [ 
        {
          "code": "dynamicPlaylogWorker",
          "values": {
            "playId": "'$play_id'",
            "executionMode": "active",
            "frameRateRatio": 1
          }
        }, 
        {
          "code": "akashicEngineParameters", 
          "values": {
            "contentJsonUrl": "'$content_json_url'",
            "externals": [ {  } ]
          }
        }
      ]
    }')
  instance_id=$(echo "$result" | jq -r .data.id)
  if [ -z "$instance_id" -o "$instance_id" = "null" ]; then
    error_log "failed to create instance!"
    echo "$result" | jq . >&2
    break
  fi
  log -e "\e[32m  instance_id: ${instance_id}\e[0m\n"

  # start event を送る
  log "sending start event..."
  result=$(curl -sS -X POST ${SYSTEM_API_BASE}v1.0/plays/${play_id}/events -H "Accept: application/json" -H "Content-Type: application/json" -d '
  {
    "type": "Message",
    "values": {
      "userId": ":akashic",
      "event": {
        "type": "start",
        "parameters": {
          "broadcasterId": "'$BROADCASTER_USER_ID'",
          "broadcasterName": "'$BROADCASTER_USER_NAME'"
        }
      }
    }
  }')
  if [ $(echo "$result" | jq .meta.status) != "200" ]; then
    error_log "failed to send start event!"
    echo "$result" | jq . >&2
    break
  fi

  # インスタンスの実行状態確認
  log "check instance status..."
  sleep 1
  result=$(curl -sS -X GET ${SYSTEM_API_BASE}v1.0/instances/${instance_id} -H "Accept: application/json")
  if [ $(echo "$result" | jq -r .data.status) != 'running' ]; then
    error_log "instance is not running!"
    echo "$result" | jq . >&2
    break
  fi
  log "OK"

  # プレイヤー参加させる
  broadcaster_url_fragment=$(join_player "$BROADCASTER_USER_ID" "$BROADCASTER_USER_NAME")
  sleep 2
  guest_url_fragment=$(join_player "$GUEST_USER_ID" "$GUEST_USER_NAME")
  
  if [ -z "$broadcaster_url_fragment" -o -z "$guest_url_fragment" ]; then
    break
  fi

  broadcaster_url="http://localhost:${DEMO_WEB_SERVER_PORT}/index.html?${broadcaster_url_fragment}"
  guest_url="http://localhost:${DEMO_WEB_SERVER_PORT}/index.html?${guest_url_fragment}"

  log -e "\n\e[32m-----"
  log "  broadcaster_url: $broadcaster_url"
  log
  log "  guest_url: $guest_url"
  log -e "-----\e[0m\n"

  log "opening browser windows..."
  
  # agvw を載せた index.html をブラウザで開けるように HTTP サーバー立ち上げ
  python3 -m http.server $DEMO_WEB_SERVER_PORT -b 127.0.0.1 --directory="$(dirname "$0")/demo_files" >/dev/null 2>&1 &
  http_server_pid=$!
  sleep 1
  if ! kill -0 "$http_server_pid" 2>/dev/null; then
    error_log "demo http server error!"
    http_server_pid=""
    break
  fi

  # ブラウザ起動
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$broadcaster_url" 2>/dev/null &
    sleep 0.5
    xdg-open "$guest_url" 2>/dev/null &
    log "browser windows opened"
  elif command -v open >/dev/null 2>&1; then
    open "$broadcaster_url" 2>/dev/null &
    sleep 0.5
    open "$guest_url" 2>/dev/null &
    log "browser windows opened"
  else
    log "automatic browser opening not supported!"
  fi

  log -e "\e[32m== press any key to exit ==\e[0m"
  read -rn 1 key
  break
done

