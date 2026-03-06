var amtp = require("../lib");

var eio = require("engine.io-client");
var engine = eio("ws://localhost:8080");

// Buffer -> ArrayBuffer
function toArrayBuffer(buf) {
  var len = buf.length;
  var arr = new ArrayBuffer(len);
  var view = new Uint8Array(arr);
  for (var i = 0; i < len; i++) {
    view[i] = buf[i];
  }
  return arr;
}

// ArrayBuffer -> Buffer
function toBuffer(buf) {
  if (buf instanceof ArrayBuffer) {
    return new Buffer(new Uint8Array(buf));
  } else {
    return buf;
  }
}

engine.on("open", function open() {
  var recvCb = null;
  var errorCb = null;
  var socket = {
    send: function (data) {
      console.log("[socket] client send: ", data);
      engine.send(toArrayBuffer(data));
    },
    recv: function (callback) {
      recvCb = callback;
    },
  };
  var client = new amtp.Client(socket);
  client.open(function (err) {
    if (err) {
      console.log("error: ", err);
    }
    console.log("amtp client open");
    // 1個目のChannelを開く（プライマリ）
    client.createChannel({ label: "最初のchannel" }, function (err, ch) {
      ch.on("request-pipe", function (pipe) {
        console.log("peer request pipe created:", pipe.id, pipe.label);
      });
      ch.on("push-pipe", function (pipe) {
        console.log("peer push pipe created:", pipe.id, pipe.label);
        pipe.on("push", function (data) {
          console.log("peer push pipe receive:", data.toString());
        });
        pipe.on("close", function () {
          console.log("peer push pipe closed:", pipe.id);
        });
      });
      // リクエストパイプを開き、startリクエストを送る
      ch.createRequestPipe({ label: "client_first_request_pipe" }, function (err, pipe) {
        console.log("self request pipe created:", pipe.id);
        pipe.request(new Buffer("please!start!"), function (err, resdata) {
          console.log("received response for request 'please!start!' -> ", resdata.toString());
          // イベントを送るpush pipeを開く
          ch.createPushPipe({ label: "client_first_request_pipe" }, function (err, pipe) {
            console.log("push pipe created:", pipe.id);
            var i = 0;
            var interval = setInterval(function () {
              pipe.push(new Buffer("client event " + i));
              i++;
              // プライマリChannelを変更する
              if (i === 5) {
                client.createChannel(function (err, ch) {
                  console.log("channel created:", ch.id, ch.label);
                });
              }
              if (i > 10) {
                clearInterval(interval);
              }
            }, 1000);
          });
        });
      });
      console.log("channel created:", ch.id);
    });
  });
  engine.on("message", function (data, flags) {
    if (typeof data === "string") {
      throw new Error("socket received string data");
    }
    recvCb(toBuffer(data));
  });
  engine.on("error", function (error) {
    console.log("engine.io error", error);
  });
});
