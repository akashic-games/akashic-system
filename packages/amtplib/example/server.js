var amtp = require("../lib");
var engine = require("engine.io");

var server = engine.listen(8080);

server.on("connection", function (con) {
  var recvCb = null;
  var errorCb = null;
  var socket = {
    send: function (data) {
      console.log("[socket] server send: ", data);
      con.send(data, { binary: true });
    },
    recv: function (callback) {
      recvCb = callback;
    },
  };
  con.on("message", function (message) {
    recvCb(message);
  });
  con.on("error", function (error) {
    console.log("connection error");
  });

  var server = new amtp.Server(socket);
  server.on("open", function () {
    console.log("amtp server open");
  });
  var testPipe = null;
  server.on("channel", function (ch) {
    console.log("channel created:", ch.id, ch.label);
    ch.on("request-pipe", function (pipe) {
      console.log("peer request pipe created, id: " + pipe.id + ", primary: " + pipe.isPrimary() + ", label: " + pipe.label);
      // リクエストを受け取った
      pipe.on("request", function (requestData, res) {
        var reqtxt = requestData.toString();
        console.log("peer request received:", reqtxt, res._requestId);
        if (reqtxt === "please!start!") {
          res.end(new Buffer("ok! start to push playlog!"));
          // プライマリpushパイプ
          ch.createPushPipe({ primary: true, label: "server_firstpushpipe" }, function (err, pipe) {
            console.log("self push pipe created, id: " + pipe.id + ", primary: " + pipe.isPrimary());
            var i = 0;
            var interval = setInterval(function () {
              pipe.push(new Buffer("server tick " + i));
              i++;
              // if (i > 10) {
              // 	pipe.close();
              // 	clearInterval(interval);
              // 	setTimeout(function() {
              // 		testPipe.push(new Buffer("pipe should be primary"));
              // 	}, 1000);
              // }
            }, 1000);
          });
          ch.createPushPipe({ label: "server_secondpushpipe" }, function (err, pipe) {
            console.log("second push pipe created, id: " + pipe.id + ", primary: " + pipe.isPrimary());
            testPipe = pipe;
            pipe.push(new Buffer("pipe should be not primary"));
          });
        }
      });
    });
    ch.on("push-pipe", function (pipe) {
      console.log("peer push pipe created, id: " + pipe.id + ", primary: " + pipe.isPrimary() + ", label: " + pipe.label);
      pipe.on("push", function (data) {
        console.log("peer push pipe receive:", data.toString());
      });
    });
  });
});
