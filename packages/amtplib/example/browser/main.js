(function e(t, n, r) {
  function s(o, u) {
    if (!n[o]) {
      if (!t[o]) {
        var a = typeof require == "function" && require;
        if (!u && a) return a(o, !0);
        if (i) return i(o, !0);
        var f = new Error("Cannot find module '" + o + "'");
        throw ((f.code = "MODULE_NOT_FOUND"), f);
      }
      var l = (n[o] = { exports: {} });
      t[o][0].call(
        l.exports,
        function (e) {
          var n = t[o][1][e];
          return s(n ? n : e);
        },
        l,
        l.exports,
        e,
        t,
        n,
        r,
      );
    }
    return n[o].exports;
  }
  var i = typeof require == "function" && require;
  for (var o = 0; o < r.length; o++) s(r[o]);
  return s;
})(
  {
    1: [
      function (require, module, exports) {
        (function (Buffer) {
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
              client.createChannel(function (err, ch) {
                ch.on("request-pipe", function (pipe) {
                  console.log("peer request pipe created:", pipe.id);
                });
                ch.on("push-pipe", function (pipe) {
                  console.log("peer push pipe created:", pipe.id);
                  pipe.on("push", function (data) {
                    console.log("peer push pipe receive:", data.toString());
                  });
                  pipe.on("close", function () {
                    console.log("peer push pipe closed:", pipe.id);
                  });
                });
                // リクエストパイプを開き、startリクエストを送る
                ch.createRequestPipe(function (err, pipe) {
                  console.log("self request pipe created:", pipe.id);
                  pipe.request(new Buffer("please!start!"), function (err, resdata) {
                    console.log("received response for request 'please!start!' -> ", resdata.toString());
                    // イベントを送るpush pipeを開く
                    ch.createPushPipe(function (err, pipe) {
                      console.log("push pipe created:", pipe.id);
                      var i = 0;
                      var interval = setInterval(function () {
                        pipe.push(new Buffer("client event " + i));
                        i++;
                        // プライマリChannelを変更する
                        if (i === 5) {
                          client.createChannel(true, function (err, ch) {
                            console.log("channel created:", ch.id);
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
                throw new Error("socket recieved string data");
              }
              recvCb(toBuffer(data));
            });
            engine.on("error", function (error) {
              console.log("engine.io error", error);
            });
          });
        }).call(this, require("buffer").Buffer);
      },
      { "../lib": 13, buffer: 17, "engine.io-client": 26 },
    ],
    2: [
      function (require, module, exports) {
        var __extends =
          (this && this.__extends) ||
          function (d, b) {
            for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
            function __() {
              this.constructor = d;
            }
            d.prototype = b === null ? Object.create(b) : ((__.prototype = b.prototype), new __());
          };
        var assert = require("assert");
        var events_1 = require("events");
        var pipes = require("./Pipe");
        var PrimaryHolder_1 = require("./PrimaryHolder");
        var errors = require("./Error");
        var utils = require("./utils");
        var Channel = (function (_super) {
          __extends(Channel, _super);
          function Channel(id, isClientMode, session) {
            _super.call(this);
            this.id = id;
            this._isClientMode = isClientMode;
            this._session = session;
            this._pushPipes = {};
            this._incomingPushPipes = {};
            this._primaryPushPipe = null;
            this._primaryIncomingPushPipe = null;
            this._requestPipes = {};
            this._incomingRequestPipes = {};
            this._primaryRequestPipeHolder = new PrimaryHolder_1.PrimaryHolder();
            this._primaryIncomingRequestPipe = null;
            this._pushPipeIdx = 1;
            this._requestPipeIdx = 1;
          }
          Channel.prototype.createPushPipe = function (primary, callback) {
            var _this = this;
            if (typeof primary === "function") {
              callback = primary;
              primary = false;
            }
            if (primary) {
              this._primaryPushPipe = null;
            }
            this._session.createPipe(this.id, this._pushPipeIdx, primary, false, function (err, pipeId) {
              if (err) {
                callback(err, null);
                return;
              }
              var p = new pipes.PushPipe(_this, pipeId);
              _this._pushPipes[pipeId] = p;
              if (primary) {
                _this._primaryPushPipe = p;
              } else {
                if (!_this._primaryPushPipe) {
                  var pId = utils.detectOpenStatusMinimumId(_this._requestPipes);
                  _this._primaryPushPipe = _this._pushPipes[pId];
                }
              }
              callback(null, p);
            });
            this._pushPipeIdx++;
          };
          Channel.prototype.createRequestPipe = function (primary, callback) {
            var _this = this;
            if (typeof primary === "function") {
              callback = primary;
              primary = false;
            }
            if (primary) {
              this._primaryRequestPipeHolder.setSend(null);
            }
            this._session.createPipe(this.id, this._requestPipeIdx, primary, true, function (err, pipeId) {
              if (err) {
                callback(err, null);
                return;
              }
              var p = new pipes.RequestPipe(_this, pipeId);
              _this._requestPipes[pipeId] = p;
              if (primary) {
                _this._primaryRequestPipeHolder.set(p, p);
              } else {
                var pipeId_1 = utils.detectOpenStatusMinimumId(_this._requestPipes);
                var pp = _this._requestPipes[pipeId_1];
                assert(pp);
                if (!_this._primaryRequestPipeHolder.send) {
                  _this._primaryRequestPipeHolder.setSend(pp);
                }
                if (!_this._primaryRequestPipeHolder.recv) {
                  _this._primaryRequestPipeHolder.setRecv(pp);
                }
              }
              callback(null, p);
            });
            this._requestPipeIdx++;
          };
          Channel.prototype._closePushPipe = function (pipe, callback) {
            var _this = this;
            if (this._primaryPushPipe === pipe) {
              var pId = utils.detectOpenStatusMinimumId(this._pushPipes);
              if (pId === null) {
                this._primaryPushPipe = null;
              } else {
                this._primaryPushPipe = this._pushPipes[pId];
              }
            }
            this._session.closePipe(this.id, pipe.id, false, function (err) {
              if (err) {
                callback(new errors.ProtocolError("failed to close push pipe ( id: " + pipe.id + ", chId: " + _this.id + " )"));
              } else {
                delete _this._pushPipes[pipe.id];
                callback(null);
                pipe._destroy();
              }
            });
          };
          Channel.prototype._closeRequestPipe = function (pipe, callback) {
            var _this = this;
            if (this._primaryRequestPipeHolder.send === pipe) {
              var pId = utils.detectOpenStatusMinimumId(this._requestPipes);
              if (pId === null) {
                this._primaryRequestPipeHolder.send = null;
              } else {
                this._primaryRequestPipeHolder.send = this._requestPipes[pId];
              }
            }
            this._session.closePipe(this.id, pipe.id, true, function (err) {
              if (err) {
                callback(new errors.ProtocolError("failed to close request pipe ( id: " + pipe.id + ", chId: " + _this.id + " )"));
              } else {
                if (_this._primaryRequestPipeHolder.recv === pipe) {
                  var pId = utils.detectOpenStatusMinimumId(_this._requestPipes);
                  _this._primaryRequestPipeHolder.recv = _this._requestPipes[pId];
                }
                delete _this._requestPipes[pipe.id];
                callback(null);
                pipe._destroy();
              }
            });
          };
          Channel.prototype._createIncomingPushPipe = function (id, primary) {
            if (this._incomingPushPipes[id]) {
              throw new errors.InvalidStateError("push pipe " + id + " for incoming already exsits on channel " + this.id);
            }
            var p = new pipes.IncomingPushPipe(this, id);
            this._incomingPushPipes[id] = p;
            if (primary) {
              this._primaryIncomingPushPipe = p;
            } else {
              if (!this._primaryIncomingPushPipe) {
                var pId = utils.detectOpenStatusMinimumId(this._incomingPushPipes);
                assert(pId !== null, "primary push pipe id is null");
                this._primaryIncomingPushPipe = this._incomingPushPipes[pId];
              }
            }
            this.emit("push-pipe", p);
          };
          Channel.prototype._closeIncomingPushPipe = function (id) {
            var p = this._incomingPushPipes[id];
            assert(p, "incoming push pipe for close is null");
            delete this._incomingPushPipes[id];
            if (this._primaryIncomingPushPipe === p) {
              var pId = utils.detectOpenStatusMinimumId(this._incomingPushPipes);
              if (pId === null) {
                this._primaryIncomingPushPipe = null;
              } else {
                this._primaryIncomingPushPipe = this._incomingPushPipes[pId];
              }
            }
            p._onClose();
            p._destroy();
          };
          Channel.prototype._createIncomingRequestPipe = function (id, primary) {
            if (this._incomingRequestPipes[id]) {
              throw new errors.InvalidStateError("request pipe " + id + " for incoming already exsits on channel " + this.id);
            }
            var p = new pipes.IncomingRequestPipe(this, id);
            this._incomingRequestPipes[id] = p;
            if (primary) {
              this._primaryIncomingRequestPipe = p;
            } else {
              if (!this._primaryIncomingRequestPipe) {
                var pId = utils.detectOpenStatusMinimumId(this._incomingRequestPipes);
                assert(pId !== null, "primary request pipe id is null");
                this._primaryIncomingRequestPipe = this._incomingRequestPipes[pId];
              }
            }
            this.emit("request-pipe", p);
          };
          Channel.prototype._closeIncomingRequestPipe = function (id) {
            var p = this._incomingRequestPipes[id];
            assert(p, "incoming request pipe for close is null");
            delete this._incomingRequestPipes[id];
            if (this._primaryIncomingRequestPipe === p) {
              var pId = utils.detectOpenStatusMinimumId(this._incomingRequestPipes);
              if (pId === null) {
                this._primaryIncomingRequestPipe = null;
              } else {
                this._primaryIncomingRequestPipe = this._incomingRequestPipes[pId];
              }
            }
            p._onClose();
            p._destroy();
          };
          Channel.prototype._isPrimaryIncomingPushPipe = function (pipe) {
            return this._primaryIncomingPushPipe === pipe;
          };
          Channel.prototype._isPrimaryPushPipe = function (pipe) {
            return this._primaryPushPipe === pipe;
          };
          Channel.prototype._isPrimaryIncomingRequestPipe = function (pipe) {
            return this._primaryIncomingRequestPipe === pipe;
          };
          Channel.prototype._isPrimaryRequestPipe = function (pipe) {
            return this._primaryRequestPipeHolder.send === pipe;
          };
          return Channel;
        })(events_1.EventEmitter);
        exports.Channel = Channel;
      },
      { "./Error": 4, "./Pipe": 6, "./PrimaryHolder": 7, "./utils": 14, assert: 15, events: 21 },
    ],
    3: [
      function (require, module, exports) {
        var __extends =
          (this && this.__extends) ||
          function (d, b) {
            for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
            function __() {
              this.constructor = d;
            }
            d.prototype = b === null ? Object.create(b) : ((__.prototype = b.prototype), new __());
          };
        var events_1 = require("events");
        var Session_1 = require("./Session");
        var Client = (function (_super) {
          __extends(Client, _super);
          function Client(socket) {
            var _this = this;
            _super.call(this);
            this._session = new Session_1.ClientSession(socket);
            this._session.on("error", function (error) {
              _this._onError(error);
            });
          }
          Client.prototype.open = function (callback) {
            this._session.open(callback);
          };
          Client.prototype.createChannel = function (primary, callback) {
            if (typeof primary === "function") {
              callback = primary;
              primary = false;
            }
            this._session.createChannel(primary, callback);
          };
          Client.prototype._onError = function (error) {
            this.emit("error", error);
          };
          return Client;
        })(events_1.EventEmitter);
        exports.Client = Client;
      },
      { "./Session": 12, events: 21 },
    ],
    4: [
      function (require, module, exports) {
        var __extends =
          (this && this.__extends) ||
          function (d, b) {
            for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
            function __() {
              this.constructor = d;
            }
            d.prototype = b === null ? Object.create(b) : ((__.prototype = b.prototype), new __());
          };
        var ProtocolError = (function () {
          function ProtocolError(name, message, cause) {
            this.name = name;
            this.message = message;
            this.cause = cause;
          }
          return ProtocolError;
        })();
        exports.ProtocolError = ProtocolError;
        var PureVirtualError = (function (_super) {
          __extends(PureVirtualError, _super);
          function PureVirtualError() {
            _super.call(this, "PureVirtualError", "Sub class must implement");
          }
          return PureVirtualError;
        })(ProtocolError);
        exports.PureVirtualError = PureVirtualError;
        var RequestDeniedError = (function (_super) {
          __extends(RequestDeniedError, _super);
          function RequestDeniedError() {
            _super.call(this, "RequestDeniedError", "Request denied by peer");
          }
          return RequestDeniedError;
        })(ProtocolError);
        exports.RequestDeniedError = RequestDeniedError;
        var InvalidFrameError = (function (_super) {
          __extends(InvalidFrameError, _super);
          function InvalidFrameError(message) {
            _super.call(this, "InvalidFrameError", message);
          }
          return InvalidFrameError;
        })(ProtocolError);
        exports.InvalidFrameError = InvalidFrameError;
        var UnexpectedFrameError = (function (_super) {
          __extends(UnexpectedFrameError, _super);
          function UnexpectedFrameError(message) {
            _super.call(this, "UnexpectedFrameError", message);
          }
          return UnexpectedFrameError;
        })(ProtocolError);
        exports.UnexpectedFrameError = UnexpectedFrameError;
        var InvalidStateError = (function (_super) {
          __extends(InvalidStateError, _super);
          function InvalidStateError(message) {
            _super.call(this, "InvalidStateError", message);
          }
          return InvalidStateError;
        })(ProtocolError);
        exports.InvalidStateError = InvalidStateError;
        var SocketError = (function (_super) {
          __extends(SocketError, _super);
          function SocketError(cause) {
            _super.call(this, "SocketError", "Socket error occurred");
            this.cause = cause;
          }
          return SocketError;
        })(ProtocolError);
        exports.SocketError = SocketError;
      },
      {},
    ],
    5: [
      function (require, module, exports) {
        (function (FrameIdentifier) {
          FrameIdentifier[(FrameIdentifier["Control"] = 0)] = "Control";
          FrameIdentifier[(FrameIdentifier["Data"] = 1)] = "Data";
        })(exports.FrameIdentifier || (exports.FrameIdentifier = {}));
        var FrameIdentifier = exports.FrameIdentifier;
        (function (ControlFrameType) {
          ControlFrameType[(ControlFrameType["Accept"] = 1)] = "Accept";
          ControlFrameType[(ControlFrameType["Deny"] = 2)] = "Deny";
          ControlFrameType[(ControlFrameType["Open"] = 3)] = "Open";
          ControlFrameType[(ControlFrameType["Channel"] = 4)] = "Channel";
          ControlFrameType[(ControlFrameType["Pipe"] = 5)] = "Pipe";
          ControlFrameType[(ControlFrameType["Close"] = 6)] = "Close";
          ControlFrameType[(ControlFrameType["CloseChannel"] = 7)] = "CloseChannel";
          ControlFrameType[(ControlFrameType["ClosePipe"] = 8)] = "ClosePipe";
          ControlFrameType[(ControlFrameType["Error"] = 9)] = "Error";
        })(exports.ControlFrameType || (exports.ControlFrameType = {}));
        var ControlFrameType = exports.ControlFrameType;
        function createDenyControlFrame(id) {
          return {
            identifier: FrameIdentifier.Control,
            type: ControlFrameType.Deny,
            id: id,
          };
        }
        exports.createDenyControlFrame = createDenyControlFrame;
        function createAcceptControlFrame(id, data) {
          return {
            identifier: FrameIdentifier.Control,
            type: ControlFrameType.Accept,
            id: id,
            data: data,
          };
        }
        exports.createAcceptControlFrame = createAcceptControlFrame;
        function createPipeControlFrame(id, primary, request, channelId, pipeId) {
          return {
            identifier: FrameIdentifier.Control,
            type: ControlFrameType.Pipe,
            id: id,
            channelId: channelId,
            primary: primary,
            pipeId: pipeId,
            request: request,
          };
        }
        exports.createPipeControlFrame = createPipeControlFrame;
        function createPipeCloseFrame(id, channelId, pipeId, request) {
          return {
            identifier: FrameIdentifier.Control,
            type: ControlFrameType.ClosePipe,
            id: id,
            channelId: channelId,
            pipeId: pipeId,
            request: request,
          };
        }
        exports.createPipeCloseFrame = createPipeCloseFrame;
        function createChannelControlFrame(id, primary, channelId) {
          return {
            identifier: FrameIdentifier.Control,
            type: ControlFrameType.Channel,
            id: id,
            primary: primary,
            channelId: channelId,
          };
        }
        exports.createChannelControlFrame = createChannelControlFrame;
        function createChannelCloseFrame(id, channelId) {
          return {
            identifier: FrameIdentifier.Control,
            type: ControlFrameType.CloseChannel,
            id: id,
            channelId: channelId,
          };
        }
        exports.createChannelCloseFrame = createChannelCloseFrame;
        function createOpenControlFrame(id, random, version, identifier) {
          return {
            identifier: FrameIdentifier.Control,
            type: ControlFrameType.Open,
            id: id,
            protocolVersion: version,
            protocolIdentifier: identifier,
            random: random,
          };
        }
        exports.createOpenControlFrame = createOpenControlFrame;
      },
      {},
    ],
    6: [
      function (require, module, exports) {
        var __extends =
          (this && this.__extends) ||
          function (d, b) {
            for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
            function __() {
              this.constructor = d;
            }
            d.prototype = b === null ? Object.create(b) : ((__.prototype = b.prototype), new __());
          };
        var assert = require("assert");
        var events_1 = require("events");
        var errors = require("./Error");
        var ReadyState_1 = require("./ReadyState");
        var RequestPipeResponse = (function () {
          function RequestPipeResponse(requestId, pipe) {
            this._requestId = requestId;
            this._pipe = pipe;
          }
          RequestPipeResponse.prototype.end = function (data) {
            this._pipe._response(this._requestId, data);
            this._requestId = null;
            this._pipe = null;
          };
          return RequestPipeResponse;
        })();
        exports.RequestPipeResponse = RequestPipeResponse;
        var PipeImpl = (function () {
          function PipeImpl(channel, id) {
            this.channel = channel;
            this.id = id;
            this.readyState = ReadyState_1.ReadyState.Open;
          }
          PipeImpl.prototype.isPrimary = function () {
            throw new errors.PureVirtualError();
          };
          PipeImpl.prototype._destroy = function () {
            this.channel = null;
            this.id = null;
          };
          return PipeImpl;
        })();
        exports.PipeImpl = PipeImpl;
        var IncomingPipeImpl = (function (_super) {
          __extends(IncomingPipeImpl, _super);
          function IncomingPipeImpl(channel, id) {
            _super.call(this);
            this.channel = channel;
            this.id = id;
            this.readyState = ReadyState_1.ReadyState.Open;
          }
          IncomingPipeImpl.prototype.isPrimary = function () {
            throw new errors.PureVirtualError();
          };
          IncomingPipeImpl.prototype._destroy = function () {
            this.channel = null;
            this.id = null;
          };
          return IncomingPipeImpl;
        })(events_1.EventEmitter);
        exports.IncomingPipeImpl = IncomingPipeImpl;
        var PushPipe = (function (_super) {
          __extends(PushPipe, _super);
          function PushPipe() {
            _super.apply(this, arguments);
          }
          PushPipe.prototype.push = function (data) {
            if (this.readyState !== ReadyState_1.ReadyState.Open) {
              throw new errors.InvalidStateError("push pipe ( id: " + this.id + ", chId: " + this.channel.id + " ) is already closed.");
            }
            this.channel._session.sendPushPipeData(this.channel.id, this.id, data);
          };
          PushPipe.prototype.close = function (callback) {
            var _this = this;
            this.readyState = ReadyState_1.ReadyState.Closing;
            this.channel._closePushPipe(this, function (err) {
              _this.readyState = ReadyState_1.ReadyState.Closed;
              if (callback) callback(err);
            });
          };
          PushPipe.prototype.isPrimary = function () {
            return this.channel._isPrimaryPushPipe(this);
          };
          return PushPipe;
        })(PipeImpl);
        exports.PushPipe = PushPipe;
        var IncomingPushPipe = (function (_super) {
          __extends(IncomingPushPipe, _super);
          function IncomingPushPipe() {
            _super.apply(this, arguments);
          }
          IncomingPushPipe.prototype.on = function (event, listener) {
            return _super.prototype.on.apply(this, arguments);
          };
          IncomingPushPipe.prototype.isPrimary = function () {
            return this.channel._isPrimaryIncomingPushPipe(this);
          };
          IncomingPushPipe.prototype._onPush = function (data) {
            this.emit("push", data);
          };
          IncomingPushPipe.prototype._onClose = function () {
            this.emit("close");
          };
          IncomingPushPipe.prototype._destroy = function () {
            _super.prototype._destroy.call(this);
            this.removeAllListeners();
          };
          return IncomingPushPipe;
        })(IncomingPipeImpl);
        exports.IncomingPushPipe = IncomingPushPipe;
        var RequestPipe = (function (_super) {
          __extends(RequestPipe, _super);
          function RequestPipe(channel, id) {
            _super.call(this, channel, id);
            this._reqIdx = channel._isClientMode ? 1 : 2;
            this._handlers = {};
          }
          RequestPipe.prototype.request = function (data, callback) {
            assert(this.readyState === ReadyState_1.ReadyState.Open);
            this._handlers[this._reqIdx] = callback;
            this.channel._session.sendRequestPipeData(this.channel.id, this.id, this._reqIdx, data);
            this._reqIdx += 2;
          };
          RequestPipe.prototype.close = function (callback) {
            var _this = this;
            this.readyState = ReadyState_1.ReadyState.Closing;
            this.channel._closeRequestPipe(this, function (err) {
              _this.readyState = ReadyState_1.ReadyState.Closed;
              if (callback) callback(err);
            });
          };
          RequestPipe.prototype.isPrimary = function () {
            return this.channel._isPrimaryRequestPipe(this);
          };
          RequestPipe.prototype._onResponse = function (requestId, data) {
            assert(this.readyState === ReadyState_1.ReadyState.Open);
            var handler = this._handlers[requestId];
            this._handlers[requestId] = null;
            handler(null, data);
          };
          RequestPipe.prototype._destroy = function () {
            _super.prototype._destroy.call(this);
            this._reqIdx = null;
            this._handlers = null;
          };
          return RequestPipe;
        })(PipeImpl);
        exports.RequestPipe = RequestPipe;
        var IncomingRequestPipe = (function (_super) {
          __extends(IncomingRequestPipe, _super);
          function IncomingRequestPipe() {
            _super.apply(this, arguments);
          }
          IncomingRequestPipe.prototype.on = function (event, listener) {
            return _super.prototype.on.apply(this, arguments);
          };
          IncomingRequestPipe.prototype.isPrimary = function () {
            return this.channel._isPrimaryIncomingRequestPipe(this);
          };
          IncomingRequestPipe.prototype._response = function (requestId, data) {
            assert(this.readyState === ReadyState_1.ReadyState.Open);
            this.channel._session.sendIncomingRequestPipeData(this.channel.id, this.id, requestId, data);
          };
          IncomingRequestPipe.prototype._onRequest = function (requestId, data) {
            assert(this.readyState === ReadyState_1.ReadyState.Open);
            this.emit("request", data, new RequestPipeResponse(requestId, this));
          };
          IncomingRequestPipe.prototype._onClose = function () {
            this.readyState = ReadyState_1.ReadyState.Closed;
            this.emit("close");
          };
          IncomingRequestPipe.prototype._destroy = function () {
            _super.prototype._destroy.call(this);
            this.removeAllListeners();
          };
          return IncomingRequestPipe;
        })(IncomingPipeImpl);
        exports.IncomingRequestPipe = IncomingRequestPipe;
      },
      { "./Error": 4, "./ReadyState": 9, assert: 15, events: 21 },
    ],
    7: [
      function (require, module, exports) {
        /**
         * Holds the primary channel/pipes id send and receive.
         */
        var PrimaryHolder = (function () {
          function PrimaryHolder() {
            this.send = null;
            this.recv = null;
          }
          PrimaryHolder.prototype.set = function (send, recv) {
            this.send = send;
            this.recv = recv;
          };
          PrimaryHolder.prototype.setSend = function (p) {
            this.send = p;
          };
          PrimaryHolder.prototype.setRecv = function (p) {
            this.recv = p;
          };
          return PrimaryHolder;
        })();
        exports.PrimaryHolder = PrimaryHolder;
      },
      {},
    ],
    8: [
      function (require, module, exports) {
        exports.PROTOCOL_IDENTIFIER = 0x414d5450;
        exports.PROTOCOL_VERSION = 1;
      },
      {},
    ],
    9: [
      function (require, module, exports) {
        (function (ReadyState) {
          ReadyState[(ReadyState["Opening"] = 0)] = "Opening";
          ReadyState[(ReadyState["Open"] = 1)] = "Open";
          ReadyState[(ReadyState["Closing"] = 2)] = "Closing";
          ReadyState[(ReadyState["Closed"] = 3)] = "Closed";
        })(exports.ReadyState || (exports.ReadyState = {}));
        var ReadyState = exports.ReadyState;
      },
      {},
    ],
    10: [
      function (require, module, exports) {
        (function (Buffer) {
          var assert = require("assert");
          var fr = require("./Frame");
          // +---+-----------+
          // | F |    Type   |
          // |(1)|     (7)   |
          // +---------------------------------------------------------------+
          // |                           ID (32)                             |
          // +---------------------------------------------------------------+
          // |                          Accept Data                          |
          // +---------------------------------------------------------------+
          function serializeAcceptControlFrame(frame) {
            var buf = new Buffer(5);
            buf[0] = fr.ControlFrameType.Accept | 0x80;
            buf.writeUInt32BE(frame.id, 1);
            if (frame.data && frame.data.length) {
              return Buffer.concat([buf, frame.data], buf.length + frame.data.length);
            } else {
              return buf;
            }
          }
          function deserializeAcceptControlFrame(buf) {
            var f = {
              identifier: fr.FrameIdentifier.Control,
              type: fr.ControlFrameType.Accept,
              id: buf.readUInt32BE(1),
            };
            if (buf.length > 5) f.data = buf.slice(5);
            return f;
          }
          // +---+-----------+
          // | F |    Type   |
          // |(1)|     (7)   |
          // +---------------------------------------------------------------+
          // |                           ID (32)                             |
          // +---------------------------------------------------------------+
          // |                     Protocol Idenfier (32)                    |
          // +---------------+-----------------------------------------------+
          // |  Version (8)  |
          // +---------------+-----------------------------------------------+
          // |                        Random Bytes (32)                      |
          // +---------------------------------------------------------------+
          function serializeOpenControlFrame(frame) {
            assert(frame.protocolIdentifier <= 0xffffffff, "protocol identifier must be less than or equal to " + 0xffffffff);
            assert(frame.protocolVersion <= 0xff, "protocol version must be less than or equal to " + 0xff);
            assert(frame.random <= 0xffffffff, "random bytes must be less than or equal to " + 0xffffffff);
            var buf = new Buffer(14);
            buf[0] = frame.type | 0x80;
            buf.writeUInt32BE(frame.id, 1);
            buf.writeUInt32BE(frame.protocolIdentifier, 5);
            buf[9] = frame.protocolVersion;
            buf.writeUInt32BE(frame.random, 10);
            return buf;
          }
          function deserializeOpenControlFrame(buf) {
            return {
              identifier: fr.FrameIdentifier.Control,
              type: fr.ControlFrameType.Open,
              id: buf.readUInt32BE(1),
              protocolIdentifier: buf.readUInt32BE(5),
              protocolVersion: buf[9],
              random: buf.readUInt32BE(10),
            };
          }
          // +---+-----------+
          // | F |    Type   |
          // |(1)|     (7)   |
          // +---------------------------------------------------------------+
          // |                           ID (32)                             |
          // +---+-----------------------------------------------------------+
          // | P |                    Channel ID                             |
          // |(1)|                        (31)                               |
          // +---+-----------------------------------------------------------+
          function serializeChannelControlFrame(frame) {
            assert(frame.channelId <= 0x7fffffff, "channelId must be less than or equal to " + 0x7fffffff);
            var buf = new Buffer(9);
            buf[0] = frame.type | 0x80;
            buf.writeUInt32BE(frame.id, 1);
            buf.writeUInt32BE(frame.channelId, 5);
            if (frame.primary) {
              buf[5] |= 0x80;
            }
            return buf;
          }
          function deserializeChannelControlFrame(buf) {
            return {
              identifier: fr.FrameIdentifier.Control,
              type: fr.ControlFrameType.Channel,
              id: buf.readUInt32BE(1),
              primary: !!(buf[5] & 0x80),
              channelId: buf.readUInt32BE(5) & 0x7fffffff,
            };
          }
          // +---+-----------+
          // | F |    Type   |
          // |(1)|     (7)   |
          // +---------------------------------------------------------------+
          // |                           ID (32)                             |
          // +---+-----------------------------------------------------------+
          // | P |                      Channel ID                           |
          // |(1)|                        (31)                               |
          // +---+-----------------------------------------------------------+
          // | X |                       Pipe ID                             |
          // |(1)|                         (31)                              |
          // +---+-----------+-----------------------------------------------+
          // |    Type (8)   |
          // +---------------+
          function serializePipeControlFrame(frame) {
            assert(frame.channelId <= 0x7fffffff, "channelId must be less than or equal to " + 0x7fffffff);
            assert(frame.pipeId <= 0x7fffffff, "pipeId must be less than or equal to " + 0x7fffffff);
            var buf = new Buffer(14);
            buf[0] = frame.type | 0x80;
            buf.writeUInt32BE(frame.id, 1);
            buf.writeUInt32BE(frame.channelId, 5);
            if (frame.primary) {
              buf[5] |= 0x80;
            }
            buf.writeUInt32BE(frame.pipeId, 9);
            buf[13] = frame.request ? 0x1 : 0;
            return buf;
          }
          function deserializePipeControlFrame(buf) {
            return {
              identifier: fr.FrameIdentifier.Control,
              type: fr.ControlFrameType.Pipe,
              id: buf.readUInt32BE(1),
              primary: !!(buf[5] & 0x80),
              channelId: buf.readUInt32BE(5) & 0x7fffffff,
              request: !!buf[13],
              pipeId: buf.readUInt32BE(9) & 0x7fffffff,
            };
          }
          // +---+-----------+
          // | F |    Type   |
          // |(1)|     (7)   |
          // +---------------------------------------------------------------+
          // |                           ID (32)                             |
          // +---+-----------------------------------------------------------+
          // | X |                    Channel ID                             |
          // |(1)|                        (31)                               |
          // +---+-----------------------------------------------------------+
          function serializeCloseChannelControlFrame(frame) {
            assert(frame.channelId <= 0x7fffffff, "channelId must be less than or equal to " + 0x7fffffff);
            var buf = new Buffer(9);
            buf[0] = frame.type | 0x80;
            buf.writeUInt32BE(frame.id, 1);
            buf.writeUInt32BE(frame.channelId, 5);
            return buf;
          }
          function deserializeCloseChannelControlFrame(buf) {
            return {
              identifier: fr.FrameIdentifier.Control,
              type: fr.ControlFrameType.CloseChannel,
              id: buf.readUInt32BE(1),
              channelId: buf.readUInt32BE(5) & 0x7fffffff,
            };
          }
          // +---+-----------+
          // | F |    Type   |
          // |(1)|     (7)   |
          // +---------------------------------------------------------------+
          // |                           ID (32)                             |
          // +---+-----------------------------------------------------------+
          // | X |                    Channel ID                             |
          // |(1)|                        (31)                               |
          // +---+-----------------------------------------------------------+
          // | R |                      PipeID                               |
          // |(1)|                        (31)                               |
          // +---+-----------------------------------------------------------+
          function serializeClosePipeControlFrame(frame) {
            assert(frame.channelId <= 0x7fffffff, "channelId must be less than or equal to " + 0x7fffffff);
            assert(frame.pipeId <= 0x7fffffff, "pipeId must be less than or equal to " + 0x7fffffff);
            var buf = new Buffer(13);
            buf[0] = frame.type | 0x80;
            buf.writeUInt32BE(frame.id, 1);
            buf.writeUInt32BE(frame.channelId, 5);
            buf.writeUInt32BE(frame.pipeId, 9);
            if (frame.request) {
              buf[9] |= 0x80;
            }
            return buf;
          }
          function deserializeClosePipeControlFrame(buf) {
            return {
              identifier: fr.FrameIdentifier.Control,
              type: fr.ControlFrameType.ClosePipe,
              id: buf.readUInt32BE(1),
              channelId: buf.readUInt32BE(5) & 0x7fffffff,
              request: !!(buf[9] & 0x80),
              pipeId: buf.readUInt32BE(9) & 0x7fffffff,
            };
          }
          function serializeControlFrame(frame) {
            assert(frame.id > 0, "control frame id must be greater than 0");
            switch (frame.type) {
              case fr.ControlFrameType.Open:
                return serializeOpenControlFrame(frame);
              case fr.ControlFrameType.Channel:
                return serializeChannelControlFrame(frame);
              case fr.ControlFrameType.Pipe:
                return serializePipeControlFrame(frame);
              case fr.ControlFrameType.CloseChannel:
                return serializeCloseChannelControlFrame(frame);
              case fr.ControlFrameType.ClosePipe:
                return serializeClosePipeControlFrame(frame);
              case fr.ControlFrameType.Accept:
                return serializeAcceptControlFrame(frame);
              default:
                // TODO: others?
                var buf = new Buffer(5);
                buf[0] = frame.type | 0x80;
                buf.writeUInt32BE(frame.id, 1);
                return buf;
            }
          }
          function deserializeControlFrame(buf) {
            var type = buf[0] & 0x7f;
            switch (type) {
              case fr.ControlFrameType.Open:
                return deserializeOpenControlFrame(buf);
              case fr.ControlFrameType.Channel:
                return deserializeChannelControlFrame(buf);
              case fr.ControlFrameType.Pipe:
                return deserializePipeControlFrame(buf);
              case fr.ControlFrameType.CloseChannel:
                return deserializeCloseChannelControlFrame(buf);
              case fr.ControlFrameType.ClosePipe:
                return deserializeClosePipeControlFrame(buf);
              case fr.ControlFrameType.Accept:
                return deserializeAcceptControlFrame(buf);
              default:
                // TODO: others?
                return {
                  identifier: fr.FrameIdentifier.Control,
                  type: type,
                  id: buf.readUInt32BE(1),
                };
            }
          }
          // +---+---+---+---+---+
          // | F | C | P | R | X |
          // |(1)|(1)|(1)|(1)|(4)|
          // +---+---+---+---+---+-------------------------------------------+
          // | X |                        Channel ID                         |
          // |(1)|                           (31)                            |
          // +---+-----------------------------------------------------------+
          // | X |                         Pipe ID                           |
          // |(1)|                           (31)                            |
          // +---+-----------------------------------------------------------+
          // |                         Request ID (32)                       |
          // +---------------------------------------------------------------+
          // |                           Payload Data                        |
          // +---------------------------------------------------------------+
          function serializeDataFrame(frame) {
            var f = frame;
            var header = new Buffer(1 + (f.primaryChannel ? 0 : 4) + (f.primaryPipe ? 0 : 4) + (f.request ? 4 : 0));
            header[0] = (f.primaryChannel ? 0 : 0x40) | (f.primaryPipe ? 0 : 0x20) | (f.request ? 0x10 : 0);
            var offset = 1;
            if (!f.primaryChannel) {
              assert(f.channelId <= 0x7fffffff, "channelId must be less than or equal to " + 0x7fffffff);
              header.writeUInt32BE(f.channelId, offset);
              offset += 4;
            }
            if (!f.primaryPipe) {
              assert(f.pipeId <= 0x7fffffff, "pipeId must be less than or equal to " + 0x7fffffff);
              header.writeUInt32BE(f.pipeId, offset);
              offset += 4;
            }
            if (f.request) {
              assert(f.requestId <= 0xffffffff, "requestId must be less than or equal to " + 0xffffffff);
              header.writeUInt32BE(f.requestId, offset);
            }
            return Buffer.concat([header, f.payload], header.length + f.payload.length);
          }
          function deserializeDataFrame(buf) {
            var frame = {
              identifier: fr.FrameIdentifier.Data,
              primaryChannel: (buf[0] & 0x40) !== 0x40,
              primaryPipe: (buf[0] & 0x20) !== 0x20,
              request: (buf[0] & 0x10) === 0x10,
              payload: null,
            };
            var offset = 1;
            if (!frame.primaryChannel) {
              frame.channelId = buf.readUInt32BE(offset);
              offset += 4;
            }
            if (!frame.primaryPipe) {
              frame.pipeId = buf.readUInt32BE(offset);
              offset += 4;
            }
            if (frame.request) {
              frame.requestId = buf.readUInt32BE(offset);
              offset += 4;
            }
            frame.payload = buf.slice(offset);
            return frame;
          }
          function serialize(frame) {
            var header = null;
            var body = null;
            if (frame.identifier === fr.FrameIdentifier.Control) {
              return serializeControlFrame(frame);
            } else if (frame.identifier === fr.FrameIdentifier.Data) {
              return serializeDataFrame(frame);
            } else {
              throw new Error("Unknown frame identifier");
            }
          }
          exports.serialize = serialize;
          function deserialize(buf) {
            if ((buf[0] & 0x80) === 0x80) {
              return deserializeControlFrame(buf);
            } else {
              return deserializeDataFrame(buf);
            }
          }
          exports.deserialize = deserialize;
        }).call(this, require("buffer").Buffer);
      },
      { "./Frame": 5, assert: 15, buffer: 17 },
    ],
    11: [
      function (require, module, exports) {
        var __extends =
          (this && this.__extends) ||
          function (d, b) {
            for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
            function __() {
              this.constructor = d;
            }
            d.prototype = b === null ? Object.create(b) : ((__.prototype = b.prototype), new __());
          };
        var events_1 = require("events");
        var Session_1 = require("./Session");
        var Server = (function (_super) {
          __extends(Server, _super);
          function Server(socket) {
            var _this = this;
            _super.call(this);
            this._session = new Session_1.ServerSession(socket);
            this._session.on("open", function () {
              _this._onOpen();
            });
            this._session.on("channel", function (channel) {
              _this._onChannel(channel);
            });
            this._session.on("error", function (error) {
              _this._onError(error);
            });
          }
          Server.prototype._onOpen = function () {
            this.emit("open");
          };
          Server.prototype._onChannel = function (channel) {
            this.emit("channel", channel);
          };
          Server.prototype._onError = function (error) {
            this.emit("error", error);
          };
          return Server;
        })(events_1.EventEmitter);
        exports.Server = Server;
      },
      { "./Session": 12, events: 21 },
    ],
    12: [
      function (require, module, exports) {
        (function (Buffer) {
          var __extends =
            (this && this.__extends) ||
            function (d, b) {
              for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
              function __() {
                this.constructor = d;
              }
              d.prototype = b === null ? Object.create(b) : ((__.prototype = b.prototype), new __());
            };
          var events = require("events");
          var assert = require("assert");
          var fr = require("./Frame");
          var serializer = require("./Serializer");
          var PrimaryHolder_1 = require("./PrimaryHolder");
          var ReadyState_1 = require("./ReadyState");
          var errors = require("./Error");
          var ch = require("./Channel");
          var protocol = require("./Protocol");
          var ControlFrameRequest = (function () {
            function ControlFrameRequest(frame, handler) {
              this.frame = frame;
              this._handler = handler;
            }
            ControlFrameRequest.prototype.finish = function (acceptData) {
              this._handler(null, acceptData);
            };
            ControlFrameRequest.prototype.fail = function (err) {
              this._handler(err);
            };
            ControlFrameRequest.prototype.destroy = function () {
              this.frame = null;
              this._handler = null;
            };
            return ControlFrameRequest;
          })();
          exports.ControlFrameRequest = ControlFrameRequest;
          var Session = (function (_super) {
            __extends(Session, _super);
            function Session(socket, originFlag) {
              var _this = this;
              _super.call(this);
              this._readyState = ReadyState_1.ReadyState.Closed;
              this._channels = {};
              this._primaryChannelHolder = new PrimaryHolder_1.PrimaryHolder();
              this._originFlag = originFlag;
              this._waitingCFRequests = {};
              this._socket = socket;
              this._socket.recv(function (data) {
                _this._onRecv(data);
              });
            }
            Session.prototype.onControlFrameFromPeer = function (frame) {
              throw new errors.PureVirtualError();
            };
            Session.prototype.createPipe = function (channelId, pipeId, primary, request, callback) {
              var frame = fr.createPipeControlFrame(this._ctrlFrmIdx, primary, request, channelId, pipeId);
              var req = new ControlFrameRequest(frame, function (err) {
                if (err) {
                  callback(err);
                  return;
                }
                callback(null, pipeId);
              });
              this._waitingCFRequests[frame.id] = req;
              this._ctrlFrmIdx += 2;
              this._send(frame);
            };
            Session.prototype.closePipe = function (channelId, pipeId, request, callback) {
              var frame = fr.createPipeCloseFrame(this._ctrlFrmIdx, channelId, pipeId, request);
              var req = new ControlFrameRequest(frame, callback);
              this._waitingCFRequests[frame.id] = req;
              this._ctrlFrmIdx += 2;
              this._send(frame);
            };
            Session.prototype.onPipeCloseFrame = function (frame) {
              var ch = this._channels[frame.channelId];
              assert(ch, "channel is null");
              if (frame.request) {
                ch._closeIncomingRequestPipe(frame.pipeId);
              } else {
                ch._closeIncomingPushPipe(frame.pipeId);
              }
              this._send(fr.createAcceptControlFrame(frame.id));
            };
            Session.prototype.sendPushPipeData = function (channelId, pipeId, data) {
              var isPrimaryChannel = this._primaryChannelHolder.send.id === channelId;
              var isPrimaryPipe = this._channels[channelId]._primaryPushPipe.id === pipeId;
              if (isPrimaryChannel && isPrimaryPipe) {
                // Shortcut
                var firstByte = new Buffer(1);
                firstByte[0] = 0x0;
                this._socket.send(Buffer.concat([firstByte, data], data.length + 1));
                return;
              }
              var frame = {
                identifier: fr.FrameIdentifier.Data,
                primaryChannel: isPrimaryChannel,
                primaryPipe: isPrimaryPipe,
                request: false,
                channelId: isPrimaryChannel ? null : channelId,
                pipeId: isPrimaryPipe ? null : pipeId,
                payload: data,
              };
              this._send(frame);
            };
            Session.prototype.sendIncomingRequestPipeData = function (channelId, pipeId, requestId, data) {
              var isPrimaryChannel = this._primaryChannelHolder.send.id === channelId;
              var isPrimaryPipe = this._channels[channelId]._primaryIncomingRequestPipe.id === pipeId;
              var frame = {
                identifier: fr.FrameIdentifier.Data,
                primaryChannel: isPrimaryChannel,
                primaryPipe: isPrimaryPipe,
                request: true,
                requestId: requestId,
                channelId: isPrimaryChannel ? null : channelId,
                pipeId: isPrimaryPipe ? null : pipeId,
                payload: data,
              };
              this._send(frame);
            };
            Session.prototype.sendRequestPipeData = function (channelId, pipeId, requestId, data) {
              var isPrimaryChannel = this._primaryChannelHolder.send.id === channelId;
              var isPrimaryPipe = this._channels[channelId]._primaryRequestPipeHolder.send.id === pipeId;
              var frame = {
                identifier: fr.FrameIdentifier.Data,
                primaryChannel: isPrimaryChannel,
                primaryPipe: isPrimaryPipe,
                request: true,
                requestId: requestId,
                channelId: isPrimaryChannel ? null : channelId,
                pipeId: isPrimaryPipe ? null : pipeId,
                payload: data,
              };
              this._send(frame);
            };
            Session.prototype._send = function (frame) {
              this._socket.send(serializer.serialize(frame));
            };
            Session.prototype._onControlFrame = function (frame) {
              if (frame.id !== 0 && (frame.id & 0x1) ^ this._originFlag) {
                // self origin frame, thus it's a response to the waiting control frame
                var req = this._waitingCFRequests[frame.id];
                assert(req, "request is null");
                this._waitingCFRequests[frame.id] = null;
                switch (frame.type) {
                  case fr.ControlFrameType.Accept:
                    req.finish(frame.data);
                    break;
                  case fr.ControlFrameType.Deny:
                    req.fail(new errors.RequestDeniedError());
                    break;
                  default:
                    throw new errors.InvalidFrameError("Unknown ControlFrameType: " + frame.type);
                }
                req.destroy();
              } else {
                switch (frame.type) {
                  case fr.ControlFrameType.ClosePipe:
                    this.onPipeCloseFrame(frame);
                    break;
                  default:
                    this.onControlFrameFromPeer(frame);
                }
              }
            };
            Session.prototype._onDataFrame = function (frame) {
              var ch = null;
              if (frame.primaryChannel) {
                ch = this._primaryChannelHolder.recv;
              } else {
                ch = this._channels[frame.channelId];
              }
              assert(ch, "channel is null");
              if (frame.request) {
                if (frame.requestId & 0x1 & this._originFlag) {
                  // request from peer
                  var rp = null;
                  if (frame.primaryPipe) {
                    rp = ch._primaryIncomingRequestPipe;
                  } else {
                    rp = ch._incomingRequestPipes[frame.pipeId];
                  }
                  assert(rp, "incoming request pipe is null");
                  rp._onRequest(frame.requestId, frame.payload);
                } else {
                  // response from peer
                  var rp = null;
                  if (frame.primaryPipe) {
                    rp = ch._primaryRequestPipeHolder.recv;
                  } else {
                    rp = ch._requestPipes[frame.pipeId];
                  }
                  assert(rp, "request pipe is null");
                  rp._onResponse(frame.requestId, frame.payload);
                }
              } else {
                // push pipe
                var pp = null;
                if (frame.primaryPipe) {
                  pp = ch._primaryIncomingPushPipe;
                } else {
                  pp = ch._incomingPushPipes[frame.pipeId];
                }
                assert(pp, "incoming push pipe is null");
                pp._onPush(frame.payload);
              }
            };
            Session.prototype._onRecv = function (buf) {
              // Shortcut
              if (buf[0] === 0x0) {
                this._primaryChannelHolder.recv._primaryIncomingPushPipe._onPush(buf.slice(1));
                return;
              }
              var frm = serializer.deserialize(buf);
              if (frm.identifier === fr.FrameIdentifier.Control) {
                this._onControlFrame(frm);
              } else {
                this._onDataFrame(frm);
              }
            };
            return Session;
          })(events.EventEmitter);
          exports.Session = Session;
          // emits: error
          var ClientSession = (function (_super) {
            __extends(ClientSession, _super);
            function ClientSession(socket) {
              _super.call(this, socket, 0x0);
              this._ctrlFrmIdx = 1;
              this._chIdx = 1;
            }
            ClientSession.prototype.onPipeControlFrame = function (frame) {
              var channel = this._channels[frame.channelId];
              assert(channel, "channel is null");
              var et = null;
              if (frame.request) {
                channel._createIncomingRequestPipe(frame.pipeId, frame.primary);
              } else {
                channel._createIncomingPushPipe(frame.pipeId, frame.primary);
              }
              this._send(fr.createAcceptControlFrame(frame.id));
            };
            ClientSession.prototype.onControlFrameFromPeer = function (frame) {
              switch (frame.type) {
                case fr.ControlFrameType.Pipe:
                  this.onPipeControlFrame(frame);
                  break;
                default:
                  throw new errors.UnexpectedFrameError(
                    "Session received unexpected control frame (type: " + frame.type + ") from the peer.",
                  );
              }
            };
            ClientSession.prototype.open = function (callback) {
              var _this = this;
              if (this._readyState !== ReadyState_1.ReadyState.Closed) {
                callback(new errors.InvalidStateError("Session is not closed."));
              }
              var random = Math.floor(Math.random() * Math.pow(2, 32) - 1);
              var frame = fr.createOpenControlFrame(this._ctrlFrmIdx, random, protocol.PROTOCOL_VERSION, protocol.PROTOCOL_IDENTIFIER);
              var req = new ControlFrameRequest(frame, function (err, accept) {
                if (err) {
                  callback(err);
                  return;
                }
                if (_this._readyState !== ReadyState_1.ReadyState.Opening) {
                  callback(new errors.InvalidStateError("Session is not opening."));
                  return;
                }
                if (random === accept.readUInt32BE(0)) {
                  _this._readyState = ReadyState_1.ReadyState.Open;
                  callback(null);
                } else {
                  callback(new errors.ProtocolError("Failed to handshake with the server."));
                }
              });
              this._waitingCFRequests[frame.id] = req;
              this._send(frame);
              this._readyState = ReadyState_1.ReadyState.Opening;
              this._ctrlFrmIdx += 2;
            };
            ClientSession.prototype.createChannel = function (primary, callback) {
              var _this = this;
              if (this._readyState !== ReadyState_1.ReadyState.Open) {
                callback(new errors.InvalidStateError("Session is not opened."));
                return;
              }
              var frame = fr.createChannelControlFrame(this._ctrlFrmIdx, primary, this._chIdx++);
              if (primary) {
                // プライマリ指定されたとき、送信用プライマリチャネルは存在してはならない
                this._primaryChannelHolder.setSend(null);
              }
              var req = new ControlFrameRequest(frame, function (err) {
                if (err) {
                  callback(err);
                  return;
                }
                var channel = new ch.Channel(frame.channelId, true, _this);
                _this._channels[channel.id] = channel;
                if (primary) {
                  // acceptフレーム受信時に送受信両方更新する
                  _this._primaryChannelHolder.set(channel, channel);
                } else {
                  var chId = Math.min.apply(null, Object.keys(_this._channels));
                  if (!_this._primaryChannelHolder.send) {
                    _this._primaryChannelHolder.setSend(_this._channels[chId]);
                  }
                  if (!_this._primaryChannelHolder.recv) {
                    _this._primaryChannelHolder.setRecv(_this._channels[chId]);
                  }
                }
                callback(null, channel);
              });
              this._waitingCFRequests[frame.id] = req;
              this._ctrlFrmIdx += 2;
              this._send(frame);
            };
            return ClientSession;
          })(Session);
          exports.ClientSession = ClientSession;
          // emits: error, channel, open
          var ServerSession = (function (_super) {
            __extends(ServerSession, _super);
            function ServerSession(socket) {
              _super.call(this, socket, 0x1);
              this._ctrlFrmIdx = 2;
            }
            ServerSession.prototype.onControlFrameFromPeer = function (frame) {
              switch (frame.type) {
                case fr.ControlFrameType.Open:
                  this.onOpenControlFrame(frame);
                  break;
                case fr.ControlFrameType.Channel:
                  this.onChannelControlFrame(frame);
                  break;
                case fr.ControlFrameType.Pipe:
                  this.onPipeControlFrame(frame);
                  break;
                default:
                  throw new errors.ProtocolError("Unsupported ControlFrame: " + frame.type);
              }
            };
            ServerSession.prototype.onOpenControlFrame = function (frame) {
              if (frame.protocolIdentifier === protocol.PROTOCOL_IDENTIFIER && frame.protocolVersion === protocol.PROTOCOL_VERSION) {
                var random = new Buffer(4);
                random.writeUInt32BE(frame.random, 0);
                this._send(fr.createAcceptControlFrame(frame.id, random));
                this._readyState = ReadyState_1.ReadyState.Open;
                this.emit("open");
              } else {
                this._send(fr.createDenyControlFrame(frame.id));
              }
            };
            ServerSession.prototype.onPipeControlFrame = function (frame) {
              var channel = this._channels[frame.channelId];
              assert(channel, "channel is null");
              var et = null;
              if (frame.request) {
                channel._createIncomingRequestPipe(frame.pipeId, frame.primary);
              } else {
                channel._createIncomingPushPipe(frame.pipeId, frame.primary);
              }
              this._send(fr.createAcceptControlFrame(frame.id));
            };
            ServerSession.prototype.onChannelControlFrame = function (frame) {
              if (this._channels[frame.channelId]) {
                throw new errors.InvalidStateError("channel " + frame.channelId + " already exists");
              }
              var channel = new ch.Channel(frame.channelId, false, this);
              this._channels[frame.channelId] = channel;
              if (frame.primary) {
                this._primaryChannelHolder.set(channel, channel);
              } else {
                // ServerSessionのchannelのsendとrecvは必ず同じである。
                if (!this._primaryChannelHolder.send) {
                  var chId = Math.min.apply(null, Object.keys(this._channels));
                  var p = this._channels[chId];
                  this._primaryChannelHolder.set(p, p);
                }
              }
              this._send(fr.createAcceptControlFrame(frame.id));
              this.emit("channel", channel);
            };
            return ServerSession;
          })(Session);
          exports.ServerSession = ServerSession;
        }).call(this, require("buffer").Buffer);
      },
      {
        "./Channel": 2,
        "./Error": 4,
        "./Frame": 5,
        "./PrimaryHolder": 7,
        "./Protocol": 8,
        "./ReadyState": 9,
        "./Serializer": 10,
        assert: 15,
        buffer: 17,
        events: 21,
      },
    ],
    13: [
      function (require, module, exports) {
        var Server = require("./Server");
        var Client = require("./Client");
        var Error = require("./Error");
        var Channel = require("./Channel");
        var Pipe = require("./Pipe");
        exports.Server = Server.Server;
        exports.Client = Client.Client;
        exports.Channel = Channel.Channel;
        exports.PushPipe = Pipe.PushPipe;
        exports.RequestPipe = Pipe.RequestPipe;
        exports.RequestPipeResponse = Pipe.RequestPipeResponse;
        exports.IncomingPushPipe = Pipe.IncomingPushPipe;
        exports.IncomingRequestPipe = Pipe.IncomingRequestPipe;
        exports.ProtocolError = Error.ProtocolError;
      },
      { "./Channel": 2, "./Client": 3, "./Error": 4, "./Pipe": 6, "./Server": 11 },
    ],
    14: [
      function (require, module, exports) {
        var ReadyState_1 = require("./ReadyState");
        // bad name
        function detectOpenStatusMinimumId(targets) {
          var sorted = Object.keys(targets).sort(function (a, b) {
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
          });
          for (var i = 0; i < sorted.length; i++) {
            var id = Number(sorted[i]);
            if (targets[id].readyState === ReadyState_1.ReadyState.Open) {
              return id;
            }
          }
          return null;
        }
        exports.detectOpenStatusMinimumId = detectOpenStatusMinimumId;
      },
      { "./ReadyState": 9 },
    ],
    15: [
      function (require, module, exports) {
        // http://wiki.commonjs.org/wiki/Unit_Testing/1.0
        //
        // THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
        //
        // Originally from narwhal.js (http://narwhaljs.org)
        // Copyright (c) 2009 Thomas Robinson <280north.com>
        //
        // Permission is hereby granted, free of charge, to any person obtaining a copy
        // of this software and associated documentation files (the 'Software'), to
        // deal in the Software without restriction, including without limitation the
        // rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
        // sell copies of the Software, and to permit persons to whom the Software is
        // furnished to do so, subject to the following conditions:
        //
        // The above copyright notice and this permission notice shall be included in
        // all copies or substantial portions of the Software.
        //
        // THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
        // IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
        // FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
        // AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
        // ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
        // WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

        // when used in node, this will actually load the util module we depend on
        // versus loading the builtin util module as happens otherwise
        // this is a bug in node module loading as far as I am concerned
        var util = require("util/");

        var pSlice = Array.prototype.slice;
        var hasOwn = Object.prototype.hasOwnProperty;

        // 1. The assert module provides functions that throw
        // AssertionError's when particular conditions are not met. The
        // assert module must conform to the following interface.

        var assert = (module.exports = ok);

        // 2. The AssertionError is defined in assert.
        // new assert.AssertionError({ message: message,
        //                             actual: actual,
        //                             expected: expected })

        assert.AssertionError = function AssertionError(options) {
          this.name = "AssertionError";
          this.actual = options.actual;
          this.expected = options.expected;
          this.operator = options.operator;
          if (options.message) {
            this.message = options.message;
            this.generatedMessage = false;
          } else {
            this.message = getMessage(this);
            this.generatedMessage = true;
          }
          var stackStartFunction = options.stackStartFunction || fail;

          if (Error.captureStackTrace) {
            Error.captureStackTrace(this, stackStartFunction);
          } else {
            // non v8 browsers so we can have a stacktrace
            var err = new Error();
            if (err.stack) {
              var out = err.stack;

              // try to strip useless frames
              var fn_name = stackStartFunction.name;
              var idx = out.indexOf("\n" + fn_name);
              if (idx >= 0) {
                // once we have located the function frame
                // we need to strip out everything before it (and its line)
                var next_line = out.indexOf("\n", idx + 1);
                out = out.substring(next_line + 1);
              }

              this.stack = out;
            }
          }
        };

        // assert.AssertionError instanceof Error
        util.inherits(assert.AssertionError, Error);

        function replacer(key, value) {
          if (util.isUndefined(value)) {
            return "" + value;
          }
          if (util.isNumber(value) && !isFinite(value)) {
            return value.toString();
          }
          if (util.isFunction(value) || util.isRegExp(value)) {
            return value.toString();
          }
          return value;
        }

        function truncate(s, n) {
          if (util.isString(s)) {
            return s.length < n ? s : s.slice(0, n);
          } else {
            return s;
          }
        }

        function getMessage(self) {
          return (
            truncate(JSON.stringify(self.actual, replacer), 128) +
            " " +
            self.operator +
            " " +
            truncate(JSON.stringify(self.expected, replacer), 128)
          );
        }

        // At present only the three keys mentioned above are used and
        // understood by the spec. Implementations or sub modules can pass
        // other keys to the AssertionError's constructor - they will be
        // ignored.

        // 3. All of the following functions must throw an AssertionError
        // when a corresponding condition is not met, with a message that
        // may be undefined if not provided.  All assertion methods provide
        // both the actual and expected values to the assertion error for
        // display purposes.

        function fail(actual, expected, message, operator, stackStartFunction) {
          throw new assert.AssertionError({
            message: message,
            actual: actual,
            expected: expected,
            operator: operator,
            stackStartFunction: stackStartFunction,
          });
        }

        // EXTENSION! allows for well behaved errors defined elsewhere.
        assert.fail = fail;

        // 4. Pure assertion tests whether a value is truthy, as determined
        // by !!guard.
        // assert.ok(guard, message_opt);
        // This statement is equivalent to assert.equal(true, !!guard,
        // message_opt);. To test strictly for the value true, use
        // assert.strictEqual(true, guard, message_opt);.

        function ok(value, message) {
          if (!value) fail(value, true, message, "==", assert.ok);
        }
        assert.ok = ok;

        // 5. The equality assertion tests shallow, coercive equality with
        // ==.
        // assert.equal(actual, expected, message_opt);

        assert.equal = function equal(actual, expected, message) {
          if (actual != expected) fail(actual, expected, message, "==", assert.equal);
        };

        // 6. The non-equality assertion tests for whether two objects are not equal
        // with != assert.notEqual(actual, expected, message_opt);

        assert.notEqual = function notEqual(actual, expected, message) {
          if (actual == expected) {
            fail(actual, expected, message, "!=", assert.notEqual);
          }
        };

        // 7. The equivalence assertion tests a deep equality relation.
        // assert.deepEqual(actual, expected, message_opt);

        assert.deepEqual = function deepEqual(actual, expected, message) {
          if (!_deepEqual(actual, expected)) {
            fail(actual, expected, message, "deepEqual", assert.deepEqual);
          }
        };

        function _deepEqual(actual, expected) {
          // 7.1. All identical values are equivalent, as determined by ===.
          if (actual === expected) {
            return true;
          } else if (util.isBuffer(actual) && util.isBuffer(expected)) {
            if (actual.length != expected.length) return false;

            for (var i = 0; i < actual.length; i++) {
              if (actual[i] !== expected[i]) return false;
            }

            return true;

            // 7.2. If the expected value is a Date object, the actual value is
            // equivalent if it is also a Date object that refers to the same time.
          } else if (util.isDate(actual) && util.isDate(expected)) {
            return actual.getTime() === expected.getTime();

            // 7.3 If the expected value is a RegExp object, the actual value is
            // equivalent if it is also a RegExp object with the same source and
            // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
          } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
            return (
              actual.source === expected.source &&
              actual.global === expected.global &&
              actual.multiline === expected.multiline &&
              actual.lastIndex === expected.lastIndex &&
              actual.ignoreCase === expected.ignoreCase
            );

            // 7.4. Other pairs that do not both pass typeof value == 'object',
            // equivalence is determined by ==.
          } else if (!util.isObject(actual) && !util.isObject(expected)) {
            return actual == expected;

            // 7.5 For all other Object pairs, including Array objects, equivalence is
            // determined by having the same number of owned properties (as verified
            // with Object.prototype.hasOwnProperty.call), the same set of keys
            // (although not necessarily the same order), equivalent values for every
            // corresponding key, and an identical 'prototype' property. Note: this
            // accounts for both named and indexed properties on Arrays.
          } else {
            return objEquiv(actual, expected);
          }
        }

        function isArguments(object) {
          return Object.prototype.toString.call(object) == "[object Arguments]";
        }

        function objEquiv(a, b) {
          if (util.isNullOrUndefined(a) || util.isNullOrUndefined(b)) return false;
          // an identical 'prototype' property.
          if (a.prototype !== b.prototype) return false;
          // if one is a primitive, the other must be same
          if (util.isPrimitive(a) || util.isPrimitive(b)) {
            return a === b;
          }
          var aIsArgs = isArguments(a),
            bIsArgs = isArguments(b);
          if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs)) return false;
          if (aIsArgs) {
            a = pSlice.call(a);
            b = pSlice.call(b);
            return _deepEqual(a, b);
          }
          var ka = objectKeys(a),
            kb = objectKeys(b),
            key,
            i;
          // having the same number of owned properties (keys incorporates
          // hasOwnProperty)
          if (ka.length != kb.length) return false;
          //the same set of keys (although not necessarily the same order),
          ka.sort();
          kb.sort();
          //~~~cheap key test
          for (i = ka.length - 1; i >= 0; i--) {
            if (ka[i] != kb[i]) return false;
          }
          //equivalent values for every corresponding key, and
          //~~~possibly expensive deep test
          for (i = ka.length - 1; i >= 0; i--) {
            key = ka[i];
            if (!_deepEqual(a[key], b[key])) return false;
          }
          return true;
        }

        // 8. The non-equivalence assertion tests for any deep inequality.
        // assert.notDeepEqual(actual, expected, message_opt);

        assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
          if (_deepEqual(actual, expected)) {
            fail(actual, expected, message, "notDeepEqual", assert.notDeepEqual);
          }
        };

        // 9. The strict equality assertion tests strict equality, as determined by ===.
        // assert.strictEqual(actual, expected, message_opt);

        assert.strictEqual = function strictEqual(actual, expected, message) {
          if (actual !== expected) {
            fail(actual, expected, message, "===", assert.strictEqual);
          }
        };

        // 10. The strict non-equality assertion tests for strict inequality, as
        // determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

        assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
          if (actual === expected) {
            fail(actual, expected, message, "!==", assert.notStrictEqual);
          }
        };

        function expectedException(actual, expected) {
          if (!actual || !expected) {
            return false;
          }

          if (Object.prototype.toString.call(expected) == "[object RegExp]") {
            return expected.test(actual);
          } else if (actual instanceof expected) {
            return true;
          } else if (expected.call({}, actual) === true) {
            return true;
          }

          return false;
        }

        function _throws(shouldThrow, block, expected, message) {
          var actual;

          if (util.isString(expected)) {
            message = expected;
            expected = null;
          }

          try {
            block();
          } catch (e) {
            actual = e;
          }

          message = (expected && expected.name ? " (" + expected.name + ")." : ".") + (message ? " " + message : ".");

          if (shouldThrow && !actual) {
            fail(actual, expected, "Missing expected exception" + message);
          }

          if (!shouldThrow && expectedException(actual, expected)) {
            fail(actual, expected, "Got unwanted exception" + message);
          }

          if ((shouldThrow && actual && expected && !expectedException(actual, expected)) || (!shouldThrow && actual)) {
            throw actual;
          }
        }

        // 11. Expected to throw an error:
        // assert.throws(block, Error_opt, message_opt);

        assert.throws = function (block, /*optional*/ error, /*optional*/ message) {
          _throws.apply(this, [true].concat(pSlice.call(arguments)));
        };

        // EXTENSION! This is annoying to write outside this module.
        assert.doesNotThrow = function (block, /*optional*/ message) {
          _throws.apply(this, [false].concat(pSlice.call(arguments)));
        };

        assert.ifError = function (err) {
          if (err) {
            throw err;
          }
        };

        var objectKeys =
          Object.keys ||
          function (obj) {
            var keys = [];
            for (var key in obj) {
              if (hasOwn.call(obj, key)) keys.push(key);
            }
            return keys;
          };
      },
      { "util/": 25 },
    ],
    16: [function (require, module, exports) {}, {}],
    17: [
      function (require, module, exports) {
        (function (global) {
          /*!
           * The buffer module from node.js, for the browser.
           *
           * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
           * @license  MIT
           */
          /* eslint-disable no-proto */

          "use strict";

          var base64 = require("base64-js");
          var ieee754 = require("ieee754");
          var isArray = require("isarray");

          exports.Buffer = Buffer;
          exports.SlowBuffer = SlowBuffer;
          exports.INSPECT_MAX_BYTES = 50;
          Buffer.poolSize = 8192; // not used by this implementation

          var rootParent = {};

          /**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
          Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined ? global.TYPED_ARRAY_SUPPORT : typedArraySupport();

          function typedArraySupport() {
            try {
              var arr = new Uint8Array(1);
              arr.foo = function () {
                return 42;
              };
              return (
                arr.foo() === 42 && // typed array instances can be augmented
                typeof arr.subarray === "function" && // chrome 9-10 lack `subarray`
                arr.subarray(1, 1).byteLength === 0
              ); // ie10 has broken `subarray`
            } catch (e) {
              return false;
            }
          }

          function kMaxLength() {
            return Buffer.TYPED_ARRAY_SUPPORT ? 0x7fffffff : 0x3fffffff;
          }

          /**
           * The Buffer constructor returns instances of `Uint8Array` that have their
           * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
           * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
           * and the `Uint8Array` methods. Square bracket notation works as expected -- it
           * returns a single octet.
           *
           * The `Uint8Array` prototype remains unmodified.
           */
          function Buffer(arg) {
            if (!(this instanceof Buffer)) {
              // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
              if (arguments.length > 1) return new Buffer(arg, arguments[1]);
              return new Buffer(arg);
            }

            if (!Buffer.TYPED_ARRAY_SUPPORT) {
              this.length = 0;
              this.parent = undefined;
            }

            // Common case.
            if (typeof arg === "number") {
              return fromNumber(this, arg);
            }

            // Slightly less common case.
            if (typeof arg === "string") {
              return fromString(this, arg, arguments.length > 1 ? arguments[1] : "utf8");
            }

            // Unusual.
            return fromObject(this, arg);
          }

          // TODO: Legacy, not needed anymore. Remove in next major version.
          Buffer._augment = function (arr) {
            arr.__proto__ = Buffer.prototype;
            return arr;
          };

          function fromNumber(that, length) {
            that = allocate(that, length < 0 ? 0 : checked(length) | 0);
            if (!Buffer.TYPED_ARRAY_SUPPORT) {
              for (var i = 0; i < length; i++) {
                that[i] = 0;
              }
            }
            return that;
          }

          function fromString(that, string, encoding) {
            if (typeof encoding !== "string" || encoding === "") encoding = "utf8";

            // Assumption: byteLength() return value is always < kMaxLength.
            var length = byteLength(string, encoding) | 0;
            that = allocate(that, length);

            that.write(string, encoding);
            return that;
          }

          function fromObject(that, object) {
            if (Buffer.isBuffer(object)) return fromBuffer(that, object);

            if (isArray(object)) return fromArray(that, object);

            if (object == null) {
              throw new TypeError("must start with number, buffer, array or string");
            }

            if (typeof ArrayBuffer !== "undefined") {
              if (object.buffer instanceof ArrayBuffer) {
                return fromTypedArray(that, object);
              }
              if (object instanceof ArrayBuffer) {
                return fromArrayBuffer(that, object);
              }
            }

            if (object.length) return fromArrayLike(that, object);

            return fromJsonObject(that, object);
          }

          function fromBuffer(that, buffer) {
            var length = checked(buffer.length) | 0;
            that = allocate(that, length);
            buffer.copy(that, 0, 0, length);
            return that;
          }

          function fromArray(that, array) {
            var length = checked(array.length) | 0;
            that = allocate(that, length);
            for (var i = 0; i < length; i += 1) {
              that[i] = array[i] & 255;
            }
            return that;
          }

          // Duplicate of fromArray() to keep fromArray() monomorphic.
          function fromTypedArray(that, array) {
            var length = checked(array.length) | 0;
            that = allocate(that, length);
            // Truncating the elements is probably not what people expect from typed
            // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
            // of the old Buffer constructor.
            for (var i = 0; i < length; i += 1) {
              that[i] = array[i] & 255;
            }
            return that;
          }

          function fromArrayBuffer(that, array) {
            array.byteLength; // this throws if `array` is not a valid ArrayBuffer

            if (Buffer.TYPED_ARRAY_SUPPORT) {
              // Return an augmented `Uint8Array` instance, for best performance
              that = new Uint8Array(array);
              that.__proto__ = Buffer.prototype;
            } else {
              // Fallback: Return an object instance of the Buffer class
              that = fromTypedArray(that, new Uint8Array(array));
            }
            return that;
          }

          function fromArrayLike(that, array) {
            var length = checked(array.length) | 0;
            that = allocate(that, length);
            for (var i = 0; i < length; i += 1) {
              that[i] = array[i] & 255;
            }
            return that;
          }

          // Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
          // Returns a zero-length buffer for inputs that don't conform to the spec.
          function fromJsonObject(that, object) {
            var array;
            var length = 0;

            if (object.type === "Buffer" && isArray(object.data)) {
              array = object.data;
              length = checked(array.length) | 0;
            }
            that = allocate(that, length);

            for (var i = 0; i < length; i += 1) {
              that[i] = array[i] & 255;
            }
            return that;
          }

          if (Buffer.TYPED_ARRAY_SUPPORT) {
            Buffer.prototype.__proto__ = Uint8Array.prototype;
            Buffer.__proto__ = Uint8Array;
            if (typeof Symbol !== "undefined" && Symbol.species && Buffer[Symbol.species] === Buffer) {
              // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
              Object.defineProperty(Buffer, Symbol.species, {
                value: null,
                configurable: true,
              });
            }
          } else {
            // pre-set for values that may exist in the future
            Buffer.prototype.length = undefined;
            Buffer.prototype.parent = undefined;
          }

          function allocate(that, length) {
            if (Buffer.TYPED_ARRAY_SUPPORT) {
              // Return an augmented `Uint8Array` instance, for best performance
              that = new Uint8Array(length);
              that.__proto__ = Buffer.prototype;
            } else {
              // Fallback: Return an object instance of the Buffer class
              that.length = length;
            }

            var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1;
            if (fromPool) that.parent = rootParent;

            return that;
          }

          function checked(length) {
            // Note: cannot use `length < kMaxLength` here because that fails when
            // length is NaN (which is otherwise coerced to zero.)
            if (length >= kMaxLength()) {
              throw new RangeError("Attempt to allocate Buffer larger than maximum " + "size: 0x" + kMaxLength().toString(16) + " bytes");
            }
            return length | 0;
          }

          function SlowBuffer(subject, encoding) {
            if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding);

            var buf = new Buffer(subject, encoding);
            delete buf.parent;
            return buf;
          }

          Buffer.isBuffer = function isBuffer(b) {
            return !!(b != null && b._isBuffer);
          };

          Buffer.compare = function compare(a, b) {
            if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
              throw new TypeError("Arguments must be Buffers");
            }

            if (a === b) return 0;

            var x = a.length;
            var y = b.length;

            var i = 0;
            var len = Math.min(x, y);
            while (i < len) {
              if (a[i] !== b[i]) break;

              ++i;
            }

            if (i !== len) {
              x = a[i];
              y = b[i];
            }

            if (x < y) return -1;
            if (y < x) return 1;
            return 0;
          };

          Buffer.isEncoding = function isEncoding(encoding) {
            switch (String(encoding).toLowerCase()) {
              case "hex":
              case "utf8":
              case "utf-8":
              case "ascii":
              case "binary":
              case "base64":
              case "raw":
              case "ucs2":
              case "ucs-2":
              case "utf16le":
              case "utf-16le":
                return true;
              default:
                return false;
            }
          };

          Buffer.concat = function concat(list, length) {
            if (!isArray(list)) throw new TypeError("list argument must be an Array of Buffers.");

            if (list.length === 0) {
              return new Buffer(0);
            }

            var i;
            if (length === undefined) {
              length = 0;
              for (i = 0; i < list.length; i++) {
                length += list[i].length;
              }
            }

            var buf = new Buffer(length);
            var pos = 0;
            for (i = 0; i < list.length; i++) {
              var item = list[i];
              item.copy(buf, pos);
              pos += item.length;
            }
            return buf;
          };

          function byteLength(string, encoding) {
            if (typeof string !== "string") string = "" + string;

            var len = string.length;
            if (len === 0) return 0;

            // Use a for loop to avoid recursion
            var loweredCase = false;
            for (;;) {
              switch (encoding) {
                case "ascii":
                case "binary":
                // Deprecated
                case "raw":
                case "raws":
                  return len;
                case "utf8":
                case "utf-8":
                  return utf8ToBytes(string).length;
                case "ucs2":
                case "ucs-2":
                case "utf16le":
                case "utf-16le":
                  return len * 2;
                case "hex":
                  return len >>> 1;
                case "base64":
                  return base64ToBytes(string).length;
                default:
                  if (loweredCase) return utf8ToBytes(string).length; // assume utf8
                  encoding = ("" + encoding).toLowerCase();
                  loweredCase = true;
              }
            }
          }
          Buffer.byteLength = byteLength;

          function slowToString(encoding, start, end) {
            var loweredCase = false;

            start = start | 0;
            end = end === undefined || end === Infinity ? this.length : end | 0;

            if (!encoding) encoding = "utf8";
            if (start < 0) start = 0;
            if (end > this.length) end = this.length;
            if (end <= start) return "";

            while (true) {
              switch (encoding) {
                case "hex":
                  return hexSlice(this, start, end);

                case "utf8":
                case "utf-8":
                  return utf8Slice(this, start, end);

                case "ascii":
                  return asciiSlice(this, start, end);

                case "binary":
                  return binarySlice(this, start, end);

                case "base64":
                  return base64Slice(this, start, end);

                case "ucs2":
                case "ucs-2":
                case "utf16le":
                case "utf-16le":
                  return utf16leSlice(this, start, end);

                default:
                  if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
                  encoding = (encoding + "").toLowerCase();
                  loweredCase = true;
              }
            }
          }

          // The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
          // Buffer instances.
          Buffer.prototype._isBuffer = true;

          Buffer.prototype.toString = function toString() {
            var length = this.length | 0;
            if (length === 0) return "";
            if (arguments.length === 0) return utf8Slice(this, 0, length);
            return slowToString.apply(this, arguments);
          };

          Buffer.prototype.equals = function equals(b) {
            if (!Buffer.isBuffer(b)) throw new TypeError("Argument must be a Buffer");
            if (this === b) return true;
            return Buffer.compare(this, b) === 0;
          };

          Buffer.prototype.inspect = function inspect() {
            var str = "";
            var max = exports.INSPECT_MAX_BYTES;
            if (this.length > 0) {
              str = this.toString("hex", 0, max).match(/.{2}/g).join(" ");
              if (this.length > max) str += " ... ";
            }
            return "<Buffer " + str + ">";
          };

          Buffer.prototype.compare = function compare(b) {
            if (!Buffer.isBuffer(b)) throw new TypeError("Argument must be a Buffer");
            if (this === b) return 0;
            return Buffer.compare(this, b);
          };

          Buffer.prototype.indexOf = function indexOf(val, byteOffset) {
            if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff;
            else if (byteOffset < -0x80000000) byteOffset = -0x80000000;
            byteOffset >>= 0;

            if (this.length === 0) return -1;
            if (byteOffset >= this.length) return -1;

            // Negative offsets start from the end of the buffer
            if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0);

            if (typeof val === "string") {
              if (val.length === 0) return -1; // special case: looking for empty string always fails
              return String.prototype.indexOf.call(this, val, byteOffset);
            }
            if (Buffer.isBuffer(val)) {
              return arrayIndexOf(this, val, byteOffset);
            }
            if (typeof val === "number") {
              if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === "function") {
                return Uint8Array.prototype.indexOf.call(this, val, byteOffset);
              }
              return arrayIndexOf(this, [val], byteOffset);
            }

            function arrayIndexOf(arr, val, byteOffset) {
              var foundIndex = -1;
              for (var i = 0; byteOffset + i < arr.length; i++) {
                if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
                  if (foundIndex === -1) foundIndex = i;
                  if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex;
                } else {
                  foundIndex = -1;
                }
              }
              return -1;
            }

            throw new TypeError("val must be string, number or Buffer");
          };

          function hexWrite(buf, string, offset, length) {
            offset = Number(offset) || 0;
            var remaining = buf.length - offset;
            if (!length) {
              length = remaining;
            } else {
              length = Number(length);
              if (length > remaining) {
                length = remaining;
              }
            }

            // must be an even number of digits
            var strLen = string.length;
            if (strLen % 2 !== 0) throw new Error("Invalid hex string");

            if (length > strLen / 2) {
              length = strLen / 2;
            }
            for (var i = 0; i < length; i++) {
              var parsed = parseInt(string.substr(i * 2, 2), 16);
              if (isNaN(parsed)) throw new Error("Invalid hex string");
              buf[offset + i] = parsed;
            }
            return i;
          }

          function utf8Write(buf, string, offset, length) {
            return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
          }

          function asciiWrite(buf, string, offset, length) {
            return blitBuffer(asciiToBytes(string), buf, offset, length);
          }

          function binaryWrite(buf, string, offset, length) {
            return asciiWrite(buf, string, offset, length);
          }

          function base64Write(buf, string, offset, length) {
            return blitBuffer(base64ToBytes(string), buf, offset, length);
          }

          function ucs2Write(buf, string, offset, length) {
            return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
          }

          Buffer.prototype.write = function write(string, offset, length, encoding) {
            // Buffer#write(string)
            if (offset === undefined) {
              encoding = "utf8";
              length = this.length;
              offset = 0;
              // Buffer#write(string, encoding)
            } else if (length === undefined && typeof offset === "string") {
              encoding = offset;
              length = this.length;
              offset = 0;
              // Buffer#write(string, offset[, length][, encoding])
            } else if (isFinite(offset)) {
              offset = offset | 0;
              if (isFinite(length)) {
                length = length | 0;
                if (encoding === undefined) encoding = "utf8";
              } else {
                encoding = length;
                length = undefined;
              }
              // legacy write(string, encoding, offset, length) - remove in v0.13
            } else {
              var swap = encoding;
              encoding = offset;
              offset = length | 0;
              length = swap;
            }

            var remaining = this.length - offset;
            if (length === undefined || length > remaining) length = remaining;

            if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
              throw new RangeError("attempt to write outside buffer bounds");
            }

            if (!encoding) encoding = "utf8";

            var loweredCase = false;
            for (;;) {
              switch (encoding) {
                case "hex":
                  return hexWrite(this, string, offset, length);

                case "utf8":
                case "utf-8":
                  return utf8Write(this, string, offset, length);

                case "ascii":
                  return asciiWrite(this, string, offset, length);

                case "binary":
                  return binaryWrite(this, string, offset, length);

                case "base64":
                  // Warning: maxLength not taken into account in base64Write
                  return base64Write(this, string, offset, length);

                case "ucs2":
                case "ucs-2":
                case "utf16le":
                case "utf-16le":
                  return ucs2Write(this, string, offset, length);

                default:
                  if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
                  encoding = ("" + encoding).toLowerCase();
                  loweredCase = true;
              }
            }
          };

          Buffer.prototype.toJSON = function toJSON() {
            return {
              type: "Buffer",
              data: Array.prototype.slice.call(this._arr || this, 0),
            };
          };

          function base64Slice(buf, start, end) {
            if (start === 0 && end === buf.length) {
              return base64.fromByteArray(buf);
            } else {
              return base64.fromByteArray(buf.slice(start, end));
            }
          }

          function utf8Slice(buf, start, end) {
            end = Math.min(buf.length, end);
            var res = [];

            var i = start;
            while (i < end) {
              var firstByte = buf[i];
              var codePoint = null;
              var bytesPerSequence = firstByte > 0xef ? 4 : firstByte > 0xdf ? 3 : firstByte > 0xbf ? 2 : 1;

              if (i + bytesPerSequence <= end) {
                var secondByte, thirdByte, fourthByte, tempCodePoint;

                switch (bytesPerSequence) {
                  case 1:
                    if (firstByte < 0x80) {
                      codePoint = firstByte;
                    }
                    break;
                  case 2:
                    secondByte = buf[i + 1];
                    if ((secondByte & 0xc0) === 0x80) {
                      tempCodePoint = ((firstByte & 0x1f) << 0x6) | (secondByte & 0x3f);
                      if (tempCodePoint > 0x7f) {
                        codePoint = tempCodePoint;
                      }
                    }
                    break;
                  case 3:
                    secondByte = buf[i + 1];
                    thirdByte = buf[i + 2];
                    if ((secondByte & 0xc0) === 0x80 && (thirdByte & 0xc0) === 0x80) {
                      tempCodePoint = ((firstByte & 0xf) << 0xc) | ((secondByte & 0x3f) << 0x6) | (thirdByte & 0x3f);
                      if (tempCodePoint > 0x7ff && (tempCodePoint < 0xd800 || tempCodePoint > 0xdfff)) {
                        codePoint = tempCodePoint;
                      }
                    }
                    break;
                  case 4:
                    secondByte = buf[i + 1];
                    thirdByte = buf[i + 2];
                    fourthByte = buf[i + 3];
                    if ((secondByte & 0xc0) === 0x80 && (thirdByte & 0xc0) === 0x80 && (fourthByte & 0xc0) === 0x80) {
                      tempCodePoint =
                        ((firstByte & 0xf) << 0x12) | ((secondByte & 0x3f) << 0xc) | ((thirdByte & 0x3f) << 0x6) | (fourthByte & 0x3f);
                      if (tempCodePoint > 0xffff && tempCodePoint < 0x110000) {
                        codePoint = tempCodePoint;
                      }
                    }
                }
              }

              if (codePoint === null) {
                // we did not generate a valid codePoint so insert a
                // replacement char (U+FFFD) and advance only 1 byte
                codePoint = 0xfffd;
                bytesPerSequence = 1;
              } else if (codePoint > 0xffff) {
                // encode to utf16 (surrogate pair dance)
                codePoint -= 0x10000;
                res.push(((codePoint >>> 10) & 0x3ff) | 0xd800);
                codePoint = 0xdc00 | (codePoint & 0x3ff);
              }

              res.push(codePoint);
              i += bytesPerSequence;
            }

            return decodeCodePointsArray(res);
          }

          // Based on http://stackoverflow.com/a/22747272/680742, the browser with
          // the lowest limit is Chrome, with 0x10000 args.
          // We go 1 magnitude less, for safety
          var MAX_ARGUMENTS_LENGTH = 0x1000;

          function decodeCodePointsArray(codePoints) {
            var len = codePoints.length;
            if (len <= MAX_ARGUMENTS_LENGTH) {
              return String.fromCharCode.apply(String, codePoints); // avoid extra slice()
            }

            // Decode in chunks to avoid "call stack size exceeded".
            var res = "";
            var i = 0;
            while (i < len) {
              res += String.fromCharCode.apply(String, codePoints.slice(i, (i += MAX_ARGUMENTS_LENGTH)));
            }
            return res;
          }

          function asciiSlice(buf, start, end) {
            var ret = "";
            end = Math.min(buf.length, end);

            for (var i = start; i < end; i++) {
              ret += String.fromCharCode(buf[i] & 0x7f);
            }
            return ret;
          }

          function binarySlice(buf, start, end) {
            var ret = "";
            end = Math.min(buf.length, end);

            for (var i = start; i < end; i++) {
              ret += String.fromCharCode(buf[i]);
            }
            return ret;
          }

          function hexSlice(buf, start, end) {
            var len = buf.length;

            if (!start || start < 0) start = 0;
            if (!end || end < 0 || end > len) end = len;

            var out = "";
            for (var i = start; i < end; i++) {
              out += toHex(buf[i]);
            }
            return out;
          }

          function utf16leSlice(buf, start, end) {
            var bytes = buf.slice(start, end);
            var res = "";
            for (var i = 0; i < bytes.length; i += 2) {
              res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
            }
            return res;
          }

          Buffer.prototype.slice = function slice(start, end) {
            var len = this.length;
            start = ~~start;
            end = end === undefined ? len : ~~end;

            if (start < 0) {
              start += len;
              if (start < 0) start = 0;
            } else if (start > len) {
              start = len;
            }

            if (end < 0) {
              end += len;
              if (end < 0) end = 0;
            } else if (end > len) {
              end = len;
            }

            if (end < start) end = start;

            var newBuf;
            if (Buffer.TYPED_ARRAY_SUPPORT) {
              newBuf = this.subarray(start, end);
              newBuf.__proto__ = Buffer.prototype;
            } else {
              var sliceLen = end - start;
              newBuf = new Buffer(sliceLen, undefined);
              for (var i = 0; i < sliceLen; i++) {
                newBuf[i] = this[i + start];
              }
            }

            if (newBuf.length) newBuf.parent = this.parent || this;

            return newBuf;
          };

          /*
           * Need to make sure that buffer isn't trying to write out of bounds.
           */
          function checkOffset(offset, ext, length) {
            if (offset % 1 !== 0 || offset < 0) throw new RangeError("offset is not uint");
            if (offset + ext > length) throw new RangeError("Trying to access beyond buffer length");
          }

          Buffer.prototype.readUIntLE = function readUIntLE(offset, byteLength, noAssert) {
            offset = offset | 0;
            byteLength = byteLength | 0;
            if (!noAssert) checkOffset(offset, byteLength, this.length);

            var val = this[offset];
            var mul = 1;
            var i = 0;
            while (++i < byteLength && (mul *= 0x100)) {
              val += this[offset + i] * mul;
            }

            return val;
          };

          Buffer.prototype.readUIntBE = function readUIntBE(offset, byteLength, noAssert) {
            offset = offset | 0;
            byteLength = byteLength | 0;
            if (!noAssert) {
              checkOffset(offset, byteLength, this.length);
            }

            var val = this[offset + --byteLength];
            var mul = 1;
            while (byteLength > 0 && (mul *= 0x100)) {
              val += this[offset + --byteLength] * mul;
            }

            return val;
          };

          Buffer.prototype.readUInt8 = function readUInt8(offset, noAssert) {
            if (!noAssert) checkOffset(offset, 1, this.length);
            return this[offset];
          };

          Buffer.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
            if (!noAssert) checkOffset(offset, 2, this.length);
            return this[offset] | (this[offset + 1] << 8);
          };

          Buffer.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
            if (!noAssert) checkOffset(offset, 2, this.length);
            return (this[offset] << 8) | this[offset + 1];
          };

          Buffer.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
            if (!noAssert) checkOffset(offset, 4, this.length);

            return (this[offset] | (this[offset + 1] << 8) | (this[offset + 2] << 16)) + this[offset + 3] * 0x1000000;
          };

          Buffer.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
            if (!noAssert) checkOffset(offset, 4, this.length);

            return this[offset] * 0x1000000 + ((this[offset + 1] << 16) | (this[offset + 2] << 8) | this[offset + 3]);
          };

          Buffer.prototype.readIntLE = function readIntLE(offset, byteLength, noAssert) {
            offset = offset | 0;
            byteLength = byteLength | 0;
            if (!noAssert) checkOffset(offset, byteLength, this.length);

            var val = this[offset];
            var mul = 1;
            var i = 0;
            while (++i < byteLength && (mul *= 0x100)) {
              val += this[offset + i] * mul;
            }
            mul *= 0x80;

            if (val >= mul) val -= Math.pow(2, 8 * byteLength);

            return val;
          };

          Buffer.prototype.readIntBE = function readIntBE(offset, byteLength, noAssert) {
            offset = offset | 0;
            byteLength = byteLength | 0;
            if (!noAssert) checkOffset(offset, byteLength, this.length);

            var i = byteLength;
            var mul = 1;
            var val = this[offset + --i];
            while (i > 0 && (mul *= 0x100)) {
              val += this[offset + --i] * mul;
            }
            mul *= 0x80;

            if (val >= mul) val -= Math.pow(2, 8 * byteLength);

            return val;
          };

          Buffer.prototype.readInt8 = function readInt8(offset, noAssert) {
            if (!noAssert) checkOffset(offset, 1, this.length);
            if (!(this[offset] & 0x80)) return this[offset];
            return (0xff - this[offset] + 1) * -1;
          };

          Buffer.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
            if (!noAssert) checkOffset(offset, 2, this.length);
            var val = this[offset] | (this[offset + 1] << 8);
            return val & 0x8000 ? val | 0xffff0000 : val;
          };

          Buffer.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
            if (!noAssert) checkOffset(offset, 2, this.length);
            var val = this[offset + 1] | (this[offset] << 8);
            return val & 0x8000 ? val | 0xffff0000 : val;
          };

          Buffer.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
            if (!noAssert) checkOffset(offset, 4, this.length);

            return this[offset] | (this[offset + 1] << 8) | (this[offset + 2] << 16) | (this[offset + 3] << 24);
          };

          Buffer.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
            if (!noAssert) checkOffset(offset, 4, this.length);

            return (this[offset] << 24) | (this[offset + 1] << 16) | (this[offset + 2] << 8) | this[offset + 3];
          };

          Buffer.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
            if (!noAssert) checkOffset(offset, 4, this.length);
            return ieee754.read(this, offset, true, 23, 4);
          };

          Buffer.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
            if (!noAssert) checkOffset(offset, 4, this.length);
            return ieee754.read(this, offset, false, 23, 4);
          };

          Buffer.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
            if (!noAssert) checkOffset(offset, 8, this.length);
            return ieee754.read(this, offset, true, 52, 8);
          };

          Buffer.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
            if (!noAssert) checkOffset(offset, 8, this.length);
            return ieee754.read(this, offset, false, 52, 8);
          };

          function checkInt(buf, value, offset, ext, max, min) {
            if (!Buffer.isBuffer(buf)) throw new TypeError("buffer must be a Buffer instance");
            if (value > max || value < min) throw new RangeError("value is out of bounds");
            if (offset + ext > buf.length) throw new RangeError("index out of range");
          }

          Buffer.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength, noAssert) {
            value = +value;
            offset = offset | 0;
            byteLength = byteLength | 0;
            if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0);

            var mul = 1;
            var i = 0;
            this[offset] = value & 0xff;
            while (++i < byteLength && (mul *= 0x100)) {
              this[offset + i] = (value / mul) & 0xff;
            }

            return offset + byteLength;
          };

          Buffer.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength, noAssert) {
            value = +value;
            offset = offset | 0;
            byteLength = byteLength | 0;
            if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0);

            var i = byteLength - 1;
            var mul = 1;
            this[offset + i] = value & 0xff;
            while (--i >= 0 && (mul *= 0x100)) {
              this[offset + i] = (value / mul) & 0xff;
            }

            return offset + byteLength;
          };

          Buffer.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
            value = +value;
            offset = offset | 0;
            if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
            if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
            this[offset] = value & 0xff;
            return offset + 1;
          };

          function objectWriteUInt16(buf, value, offset, littleEndian) {
            if (value < 0) value = 0xffff + value + 1;
            for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
              buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>> ((littleEndian ? i : 1 - i) * 8);
            }
          }

          Buffer.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
            value = +value;
            offset = offset | 0;
            if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
            if (Buffer.TYPED_ARRAY_SUPPORT) {
              this[offset] = value & 0xff;
              this[offset + 1] = value >>> 8;
            } else {
              objectWriteUInt16(this, value, offset, true);
            }
            return offset + 2;
          };

          Buffer.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
            value = +value;
            offset = offset | 0;
            if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
            if (Buffer.TYPED_ARRAY_SUPPORT) {
              this[offset] = value >>> 8;
              this[offset + 1] = value & 0xff;
            } else {
              objectWriteUInt16(this, value, offset, false);
            }
            return offset + 2;
          };

          function objectWriteUInt32(buf, value, offset, littleEndian) {
            if (value < 0) value = 0xffffffff + value + 1;
            for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
              buf[offset + i] = (value >>> ((littleEndian ? i : 3 - i) * 8)) & 0xff;
            }
          }

          Buffer.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
            value = +value;
            offset = offset | 0;
            if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
            if (Buffer.TYPED_ARRAY_SUPPORT) {
              this[offset + 3] = value >>> 24;
              this[offset + 2] = value >>> 16;
              this[offset + 1] = value >>> 8;
              this[offset] = value & 0xff;
            } else {
              objectWriteUInt32(this, value, offset, true);
            }
            return offset + 4;
          };

          Buffer.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
            value = +value;
            offset = offset | 0;
            if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
            if (Buffer.TYPED_ARRAY_SUPPORT) {
              this[offset] = value >>> 24;
              this[offset + 1] = value >>> 16;
              this[offset + 2] = value >>> 8;
              this[offset + 3] = value & 0xff;
            } else {
              objectWriteUInt32(this, value, offset, false);
            }
            return offset + 4;
          };

          Buffer.prototype.writeIntLE = function writeIntLE(value, offset, byteLength, noAssert) {
            value = +value;
            offset = offset | 0;
            if (!noAssert) {
              var limit = Math.pow(2, 8 * byteLength - 1);

              checkInt(this, value, offset, byteLength, limit - 1, -limit);
            }

            var i = 0;
            var mul = 1;
            var sub = value < 0 ? 1 : 0;
            this[offset] = value & 0xff;
            while (++i < byteLength && (mul *= 0x100)) {
              this[offset + i] = (((value / mul) >> 0) - sub) & 0xff;
            }

            return offset + byteLength;
          };

          Buffer.prototype.writeIntBE = function writeIntBE(value, offset, byteLength, noAssert) {
            value = +value;
            offset = offset | 0;
            if (!noAssert) {
              var limit = Math.pow(2, 8 * byteLength - 1);

              checkInt(this, value, offset, byteLength, limit - 1, -limit);
            }

            var i = byteLength - 1;
            var mul = 1;
            var sub = value < 0 ? 1 : 0;
            this[offset + i] = value & 0xff;
            while (--i >= 0 && (mul *= 0x100)) {
              this[offset + i] = (((value / mul) >> 0) - sub) & 0xff;
            }

            return offset + byteLength;
          };

          Buffer.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
            value = +value;
            offset = offset | 0;
            if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
            if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
            if (value < 0) value = 0xff + value + 1;
            this[offset] = value & 0xff;
            return offset + 1;
          };

          Buffer.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
            value = +value;
            offset = offset | 0;
            if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
            if (Buffer.TYPED_ARRAY_SUPPORT) {
              this[offset] = value & 0xff;
              this[offset + 1] = value >>> 8;
            } else {
              objectWriteUInt16(this, value, offset, true);
            }
            return offset + 2;
          };

          Buffer.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
            value = +value;
            offset = offset | 0;
            if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
            if (Buffer.TYPED_ARRAY_SUPPORT) {
              this[offset] = value >>> 8;
              this[offset + 1] = value & 0xff;
            } else {
              objectWriteUInt16(this, value, offset, false);
            }
            return offset + 2;
          };

          Buffer.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
            value = +value;
            offset = offset | 0;
            if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
            if (Buffer.TYPED_ARRAY_SUPPORT) {
              this[offset] = value & 0xff;
              this[offset + 1] = value >>> 8;
              this[offset + 2] = value >>> 16;
              this[offset + 3] = value >>> 24;
            } else {
              objectWriteUInt32(this, value, offset, true);
            }
            return offset + 4;
          };

          Buffer.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
            value = +value;
            offset = offset | 0;
            if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
            if (value < 0) value = 0xffffffff + value + 1;
            if (Buffer.TYPED_ARRAY_SUPPORT) {
              this[offset] = value >>> 24;
              this[offset + 1] = value >>> 16;
              this[offset + 2] = value >>> 8;
              this[offset + 3] = value & 0xff;
            } else {
              objectWriteUInt32(this, value, offset, false);
            }
            return offset + 4;
          };

          function checkIEEE754(buf, value, offset, ext, max, min) {
            if (offset + ext > buf.length) throw new RangeError("index out of range");
            if (offset < 0) throw new RangeError("index out of range");
          }

          function writeFloat(buf, value, offset, littleEndian, noAssert) {
            if (!noAssert) {
              checkIEEE754(buf, value, offset, 4, 3.4028234663852886e38, -3.4028234663852886e38);
            }
            ieee754.write(buf, value, offset, littleEndian, 23, 4);
            return offset + 4;
          }

          Buffer.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
            return writeFloat(this, value, offset, true, noAssert);
          };

          Buffer.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
            return writeFloat(this, value, offset, false, noAssert);
          };

          function writeDouble(buf, value, offset, littleEndian, noAssert) {
            if (!noAssert) {
              checkIEEE754(buf, value, offset, 8, 1.7976931348623157e308, -1.7976931348623157e308);
            }
            ieee754.write(buf, value, offset, littleEndian, 52, 8);
            return offset + 8;
          }

          Buffer.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
            return writeDouble(this, value, offset, true, noAssert);
          };

          Buffer.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
            return writeDouble(this, value, offset, false, noAssert);
          };

          // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
          Buffer.prototype.copy = function copy(target, targetStart, start, end) {
            if (!start) start = 0;
            if (!end && end !== 0) end = this.length;
            if (targetStart >= target.length) targetStart = target.length;
            if (!targetStart) targetStart = 0;
            if (end > 0 && end < start) end = start;

            // Copy 0 bytes; we're done
            if (end === start) return 0;
            if (target.length === 0 || this.length === 0) return 0;

            // Fatal error conditions
            if (targetStart < 0) {
              throw new RangeError("targetStart out of bounds");
            }
            if (start < 0 || start >= this.length) throw new RangeError("sourceStart out of bounds");
            if (end < 0) throw new RangeError("sourceEnd out of bounds");

            // Are we oob?
            if (end > this.length) end = this.length;
            if (target.length - targetStart < end - start) {
              end = target.length - targetStart + start;
            }

            var len = end - start;
            var i;

            if (this === target && start < targetStart && targetStart < end) {
              // descending copy from end
              for (i = len - 1; i >= 0; i--) {
                target[i + targetStart] = this[i + start];
              }
            } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
              // ascending copy from start
              for (i = 0; i < len; i++) {
                target[i + targetStart] = this[i + start];
              }
            } else {
              Uint8Array.prototype.set.call(target, this.subarray(start, start + len), targetStart);
            }

            return len;
          };

          // fill(value, start=0, end=buffer.length)
          Buffer.prototype.fill = function fill(value, start, end) {
            if (!value) value = 0;
            if (!start) start = 0;
            if (!end) end = this.length;

            if (end < start) throw new RangeError("end < start");

            // Fill 0 bytes; we're done
            if (end === start) return;
            if (this.length === 0) return;

            if (start < 0 || start >= this.length) throw new RangeError("start out of bounds");
            if (end < 0 || end > this.length) throw new RangeError("end out of bounds");

            var i;
            if (typeof value === "number") {
              for (i = start; i < end; i++) {
                this[i] = value;
              }
            } else {
              var bytes = utf8ToBytes(value.toString());
              var len = bytes.length;
              for (i = start; i < end; i++) {
                this[i] = bytes[i % len];
              }
            }

            return this;
          };

          // HELPER FUNCTIONS
          // ================

          var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;

          function base64clean(str) {
            // Node strips out invalid characters like \n and \t from the string, base64-js does not
            str = stringtrim(str).replace(INVALID_BASE64_RE, "");
            // Node converts strings with length < 2 to ''
            if (str.length < 2) return "";
            // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
            while (str.length % 4 !== 0) {
              str = str + "=";
            }
            return str;
          }

          function stringtrim(str) {
            if (str.trim) return str.trim();
            return str.replace(/^\s+|\s+$/g, "");
          }

          function toHex(n) {
            if (n < 16) return "0" + n.toString(16);
            return n.toString(16);
          }

          function utf8ToBytes(string, units) {
            units = units || Infinity;
            var codePoint;
            var length = string.length;
            var leadSurrogate = null;
            var bytes = [];

            for (var i = 0; i < length; i++) {
              codePoint = string.charCodeAt(i);

              // is surrogate component
              if (codePoint > 0xd7ff && codePoint < 0xe000) {
                // last char was a lead
                if (!leadSurrogate) {
                  // no lead yet
                  if (codePoint > 0xdbff) {
                    // unexpected trail
                    if ((units -= 3) > -1) bytes.push(0xef, 0xbf, 0xbd);
                    continue;
                  } else if (i + 1 === length) {
                    // unpaired lead
                    if ((units -= 3) > -1) bytes.push(0xef, 0xbf, 0xbd);
                    continue;
                  }

                  // valid lead
                  leadSurrogate = codePoint;

                  continue;
                }

                // 2 leads in a row
                if (codePoint < 0xdc00) {
                  if ((units -= 3) > -1) bytes.push(0xef, 0xbf, 0xbd);
                  leadSurrogate = codePoint;
                  continue;
                }

                // valid surrogate pair
                codePoint = (((leadSurrogate - 0xd800) << 10) | (codePoint - 0xdc00)) + 0x10000;
              } else if (leadSurrogate) {
                // valid bmp char, but last char was a lead
                if ((units -= 3) > -1) bytes.push(0xef, 0xbf, 0xbd);
              }

              leadSurrogate = null;

              // encode utf8
              if (codePoint < 0x80) {
                if ((units -= 1) < 0) break;
                bytes.push(codePoint);
              } else if (codePoint < 0x800) {
                if ((units -= 2) < 0) break;
                bytes.push((codePoint >> 0x6) | 0xc0, (codePoint & 0x3f) | 0x80);
              } else if (codePoint < 0x10000) {
                if ((units -= 3) < 0) break;
                bytes.push((codePoint >> 0xc) | 0xe0, ((codePoint >> 0x6) & 0x3f) | 0x80, (codePoint & 0x3f) | 0x80);
              } else if (codePoint < 0x110000) {
                if ((units -= 4) < 0) break;
                bytes.push(
                  (codePoint >> 0x12) | 0xf0,
                  ((codePoint >> 0xc) & 0x3f) | 0x80,
                  ((codePoint >> 0x6) & 0x3f) | 0x80,
                  (codePoint & 0x3f) | 0x80,
                );
              } else {
                throw new Error("Invalid code point");
              }
            }

            return bytes;
          }

          function asciiToBytes(str) {
            var byteArray = [];
            for (var i = 0; i < str.length; i++) {
              // Node's code seems to be doing this and not & 0x7F..
              byteArray.push(str.charCodeAt(i) & 0xff);
            }
            return byteArray;
          }

          function utf16leToBytes(str, units) {
            var c, hi, lo;
            var byteArray = [];
            for (var i = 0; i < str.length; i++) {
              if ((units -= 2) < 0) break;

              c = str.charCodeAt(i);
              hi = c >> 8;
              lo = c % 256;
              byteArray.push(lo);
              byteArray.push(hi);
            }

            return byteArray;
          }

          function base64ToBytes(str) {
            return base64.toByteArray(base64clean(str));
          }

          function blitBuffer(src, dst, offset, length) {
            for (var i = 0; i < length; i++) {
              if (i + offset >= dst.length || i >= src.length) break;
              dst[i + offset] = src[i];
            }
            return i;
          }
        }).call(
          this,
          typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},
        );
      },
      { "base64-js": 18, ieee754: 19, isarray: 20 },
    ],
    18: [
      function (require, module, exports) {
        "use strict";

        exports.toByteArray = toByteArray;
        exports.fromByteArray = fromByteArray;

        var lookup = [];
        var revLookup = [];
        var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;

        function init() {
          var i;
          var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
          var len = code.length;

          for (i = 0; i < len; i++) {
            lookup[i] = code[i];
          }

          for (i = 0; i < len; ++i) {
            revLookup[code.charCodeAt(i)] = i;
          }
          revLookup["-".charCodeAt(0)] = 62;
          revLookup["_".charCodeAt(0)] = 63;
        }

        init();

        function toByteArray(b64) {
          var i, j, l, tmp, placeHolders, arr;
          var len = b64.length;

          if (len % 4 > 0) {
            throw new Error("Invalid string. Length must be a multiple of 4");
          }

          // the number of equal signs (place holders)
          // if there are two placeholders, than the two characters before it
          // represent one byte
          // if there is only one, then the three characters before it represent 2 bytes
          // this is just a cheap hack to not do indexOf twice
          placeHolders = b64[len - 2] === "=" ? 2 : b64[len - 1] === "=" ? 1 : 0;

          // base64 is 4/3 + up to two characters of the original data
          arr = new Arr((len * 3) / 4 - placeHolders);

          // if there are placeholders, only get up to the last complete 4 chars
          l = placeHolders > 0 ? len - 4 : len;

          var L = 0;

          for (i = 0, j = 0; i < l; i += 4, j += 3) {
            tmp =
              (revLookup[b64.charCodeAt(i)] << 18) |
              (revLookup[b64.charCodeAt(i + 1)] << 12) |
              (revLookup[b64.charCodeAt(i + 2)] << 6) |
              revLookup[b64.charCodeAt(i + 3)];
            arr[L++] = (tmp & 0xff0000) >> 16;
            arr[L++] = (tmp & 0xff00) >> 8;
            arr[L++] = tmp & 0xff;
          }

          if (placeHolders === 2) {
            tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4);
            arr[L++] = tmp & 0xff;
          } else if (placeHolders === 1) {
            tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2);
            arr[L++] = (tmp >> 8) & 0xff;
            arr[L++] = tmp & 0xff;
          }

          return arr;
        }

        function tripletToBase64(num) {
          return lookup[(num >> 18) & 0x3f] + lookup[(num >> 12) & 0x3f] + lookup[(num >> 6) & 0x3f] + lookup[num & 0x3f];
        }

        function encodeChunk(uint8, start, end) {
          var tmp;
          var output = [];
          for (var i = start; i < end; i += 3) {
            tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + uint8[i + 2];
            output.push(tripletToBase64(tmp));
          }
          return output.join("");
        }

        function fromByteArray(uint8) {
          var tmp;
          var len = uint8.length;
          var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
          var output = "";
          var parts = [];
          var maxChunkLength = 16383; // must be multiple of 3

          // go through the array every three bytes, we'll deal with trailing stuff later
          for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
            parts.push(encodeChunk(uint8, i, i + maxChunkLength > len2 ? len2 : i + maxChunkLength));
          }

          // pad the end with zeros, but make sure to not forget the extra bytes
          if (extraBytes === 1) {
            tmp = uint8[len - 1];
            output += lookup[tmp >> 2];
            output += lookup[(tmp << 4) & 0x3f];
            output += "==";
          } else if (extraBytes === 2) {
            tmp = (uint8[len - 2] << 8) + uint8[len - 1];
            output += lookup[tmp >> 10];
            output += lookup[(tmp >> 4) & 0x3f];
            output += lookup[(tmp << 2) & 0x3f];
            output += "=";
          }

          parts.push(output);

          return parts.join("");
        }
      },
      {},
    ],
    19: [
      function (require, module, exports) {
        exports.read = function (buffer, offset, isLE, mLen, nBytes) {
          var e, m;
          var eLen = nBytes * 8 - mLen - 1;
          var eMax = (1 << eLen) - 1;
          var eBias = eMax >> 1;
          var nBits = -7;
          var i = isLE ? nBytes - 1 : 0;
          var d = isLE ? -1 : 1;
          var s = buffer[offset + i];

          i += d;

          e = s & ((1 << -nBits) - 1);
          s >>= -nBits;
          nBits += eLen;
          for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

          m = e & ((1 << -nBits) - 1);
          e >>= -nBits;
          nBits += mLen;
          for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

          if (e === 0) {
            e = 1 - eBias;
          } else if (e === eMax) {
            return m ? NaN : (s ? -1 : 1) * Infinity;
          } else {
            m = m + Math.pow(2, mLen);
            e = e - eBias;
          }
          return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
        };

        exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
          var e, m, c;
          var eLen = nBytes * 8 - mLen - 1;
          var eMax = (1 << eLen) - 1;
          var eBias = eMax >> 1;
          var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
          var i = isLE ? 0 : nBytes - 1;
          var d = isLE ? 1 : -1;
          var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

          value = Math.abs(value);

          if (isNaN(value) || value === Infinity) {
            m = isNaN(value) ? 1 : 0;
            e = eMax;
          } else {
            e = Math.floor(Math.log(value) / Math.LN2);
            if (value * (c = Math.pow(2, -e)) < 1) {
              e--;
              c *= 2;
            }
            if (e + eBias >= 1) {
              value += rt / c;
            } else {
              value += rt * Math.pow(2, 1 - eBias);
            }
            if (value * c >= 2) {
              e++;
              c /= 2;
            }

            if (e + eBias >= eMax) {
              m = 0;
              e = eMax;
            } else if (e + eBias >= 1) {
              m = (value * c - 1) * Math.pow(2, mLen);
              e = e + eBias;
            } else {
              m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
              e = 0;
            }
          }

          for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

          e = (e << mLen) | m;
          eLen += mLen;
          for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

          buffer[offset + i - d] |= s * 128;
        };
      },
      {},
    ],
    20: [
      function (require, module, exports) {
        var toString = {}.toString;

        module.exports =
          Array.isArray ||
          function (arr) {
            return toString.call(arr) == "[object Array]";
          };
      },
      {},
    ],
    21: [
      function (require, module, exports) {
        // Copyright Joyent, Inc. and other Node contributors.
        //
        // Permission is hereby granted, free of charge, to any person obtaining a
        // copy of this software and associated documentation files (the
        // "Software"), to deal in the Software without restriction, including
        // without limitation the rights to use, copy, modify, merge, publish,
        // distribute, sublicense, and/or sell copies of the Software, and to permit
        // persons to whom the Software is furnished to do so, subject to the
        // following conditions:
        //
        // The above copyright notice and this permission notice shall be included
        // in all copies or substantial portions of the Software.
        //
        // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
        // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
        // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
        // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
        // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
        // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
        // USE OR OTHER DEALINGS IN THE SOFTWARE.

        function EventEmitter() {
          this._events = this._events || {};
          this._maxListeners = this._maxListeners || undefined;
        }
        module.exports = EventEmitter;

        // Backwards-compat with node 0.10.x
        EventEmitter.EventEmitter = EventEmitter;

        EventEmitter.prototype._events = undefined;
        EventEmitter.prototype._maxListeners = undefined;

        // By default EventEmitters will print a warning if more than 10 listeners are
        // added to it. This is a useful default which helps finding memory leaks.
        EventEmitter.defaultMaxListeners = 10;

        // Obviously not all Emitters should be limited to 10. This function allows
        // that to be increased. Set to zero for unlimited.
        EventEmitter.prototype.setMaxListeners = function (n) {
          if (!isNumber(n) || n < 0 || isNaN(n)) throw TypeError("n must be a positive number");
          this._maxListeners = n;
          return this;
        };

        EventEmitter.prototype.emit = function (type) {
          var er, handler, len, args, i, listeners;

          if (!this._events) this._events = {};

          // If there is no 'error' event listener then throw.
          if (type === "error") {
            if (!this._events.error || (isObject(this._events.error) && !this._events.error.length)) {
              er = arguments[1];
              if (er instanceof Error) {
                throw er; // Unhandled 'error' event
              }
              throw TypeError('Uncaught, unspecified "error" event.');
            }
          }

          handler = this._events[type];

          if (isUndefined(handler)) return false;

          if (isFunction(handler)) {
            switch (arguments.length) {
              // fast cases
              case 1:
                handler.call(this);
                break;
              case 2:
                handler.call(this, arguments[1]);
                break;
              case 3:
                handler.call(this, arguments[1], arguments[2]);
                break;
              // slower
              default:
                args = Array.prototype.slice.call(arguments, 1);
                handler.apply(this, args);
            }
          } else if (isObject(handler)) {
            args = Array.prototype.slice.call(arguments, 1);
            listeners = handler.slice();
            len = listeners.length;
            for (i = 0; i < len; i++) listeners[i].apply(this, args);
          }

          return true;
        };

        EventEmitter.prototype.addListener = function (type, listener) {
          var m;

          if (!isFunction(listener)) throw TypeError("listener must be a function");

          if (!this._events) this._events = {};

          // To avoid recursion in the case that type === "newListener"! Before
          // adding it to the listeners, first emit "newListener".
          if (this._events.newListener) this.emit("newListener", type, isFunction(listener.listener) ? listener.listener : listener);

          if (!this._events[type])
            // Optimize the case of one listener. Don't need the extra array object.
            this._events[type] = listener;
          else if (isObject(this._events[type]))
            // If we've already got an array, just append.
            this._events[type].push(listener);
          // Adding the second element, need to change to array.
          else this._events[type] = [this._events[type], listener];

          // Check for listener leak
          if (isObject(this._events[type]) && !this._events[type].warned) {
            if (!isUndefined(this._maxListeners)) {
              m = this._maxListeners;
            } else {
              m = EventEmitter.defaultMaxListeners;
            }

            if (m && m > 0 && this._events[type].length > m) {
              this._events[type].warned = true;
              console.error(
                "(node) warning: possible EventEmitter memory " +
                  "leak detected. %d listeners added. " +
                  "Use emitter.setMaxListeners() to increase limit.",
                this._events[type].length,
              );
              if (typeof console.trace === "function") {
                // not supported in IE 10
                console.trace();
              }
            }
          }

          return this;
        };

        EventEmitter.prototype.on = EventEmitter.prototype.addListener;

        EventEmitter.prototype.once = function (type, listener) {
          if (!isFunction(listener)) throw TypeError("listener must be a function");

          var fired = false;

          function g() {
            this.removeListener(type, g);

            if (!fired) {
              fired = true;
              listener.apply(this, arguments);
            }
          }

          g.listener = listener;
          this.on(type, g);

          return this;
        };

        // emits a 'removeListener' event iff the listener was removed
        EventEmitter.prototype.removeListener = function (type, listener) {
          var list, position, length, i;

          if (!isFunction(listener)) throw TypeError("listener must be a function");

          if (!this._events || !this._events[type]) return this;

          list = this._events[type];
          length = list.length;
          position = -1;

          if (list === listener || (isFunction(list.listener) && list.listener === listener)) {
            delete this._events[type];
            if (this._events.removeListener) this.emit("removeListener", type, listener);
          } else if (isObject(list)) {
            for (i = length; i-- > 0; ) {
              if (list[i] === listener || (list[i].listener && list[i].listener === listener)) {
                position = i;
                break;
              }
            }

            if (position < 0) return this;

            if (list.length === 1) {
              list.length = 0;
              delete this._events[type];
            } else {
              list.splice(position, 1);
            }

            if (this._events.removeListener) this.emit("removeListener", type, listener);
          }

          return this;
        };

        EventEmitter.prototype.removeAllListeners = function (type) {
          var key, listeners;

          if (!this._events) return this;

          // not listening for removeListener, no need to emit
          if (!this._events.removeListener) {
            if (arguments.length === 0) this._events = {};
            else if (this._events[type]) delete this._events[type];
            return this;
          }

          // emit removeListener for all listeners on all events
          if (arguments.length === 0) {
            for (key in this._events) {
              if (key === "removeListener") continue;
              this.removeAllListeners(key);
            }
            this.removeAllListeners("removeListener");
            this._events = {};
            return this;
          }

          listeners = this._events[type];

          if (isFunction(listeners)) {
            this.removeListener(type, listeners);
          } else if (listeners) {
            // LIFO order
            while (listeners.length) this.removeListener(type, listeners[listeners.length - 1]);
          }
          delete this._events[type];

          return this;
        };

        EventEmitter.prototype.listeners = function (type) {
          var ret;
          if (!this._events || !this._events[type]) ret = [];
          else if (isFunction(this._events[type])) ret = [this._events[type]];
          else ret = this._events[type].slice();
          return ret;
        };

        EventEmitter.prototype.listenerCount = function (type) {
          if (this._events) {
            var evlistener = this._events[type];

            if (isFunction(evlistener)) return 1;
            else if (evlistener) return evlistener.length;
          }
          return 0;
        };

        EventEmitter.listenerCount = function (emitter, type) {
          return emitter.listenerCount(type);
        };

        function isFunction(arg) {
          return typeof arg === "function";
        }

        function isNumber(arg) {
          return typeof arg === "number";
        }

        function isObject(arg) {
          return typeof arg === "object" && arg !== null;
        }

        function isUndefined(arg) {
          return arg === void 0;
        }
      },
      {},
    ],
    22: [
      function (require, module, exports) {
        if (typeof Object.create === "function") {
          // implementation from standard node.js 'util' module
          module.exports = function inherits(ctor, superCtor) {
            ctor.super_ = superCtor;
            ctor.prototype = Object.create(superCtor.prototype, {
              constructor: {
                value: ctor,
                enumerable: false,
                writable: true,
                configurable: true,
              },
            });
          };
        } else {
          // old school shim for old browsers
          module.exports = function inherits(ctor, superCtor) {
            ctor.super_ = superCtor;
            var TempCtor = function () {};
            TempCtor.prototype = superCtor.prototype;
            ctor.prototype = new TempCtor();
            ctor.prototype.constructor = ctor;
          };
        }
      },
      {},
    ],
    23: [
      function (require, module, exports) {
        // shim for using process in browser

        var process = (module.exports = {});
        var queue = [];
        var draining = false;
        var currentQueue;
        var queueIndex = -1;

        function cleanUpNextTick() {
          draining = false;
          if (currentQueue.length) {
            queue = currentQueue.concat(queue);
          } else {
            queueIndex = -1;
          }
          if (queue.length) {
            drainQueue();
          }
        }

        function drainQueue() {
          if (draining) {
            return;
          }
          var timeout = setTimeout(cleanUpNextTick);
          draining = true;

          var len = queue.length;
          while (len) {
            currentQueue = queue;
            queue = [];
            while (++queueIndex < len) {
              if (currentQueue) {
                currentQueue[queueIndex].run();
              }
            }
            queueIndex = -1;
            len = queue.length;
          }
          currentQueue = null;
          draining = false;
          clearTimeout(timeout);
        }

        process.nextTick = function (fun) {
          var args = new Array(arguments.length - 1);
          if (arguments.length > 1) {
            for (var i = 1; i < arguments.length; i++) {
              args[i - 1] = arguments[i];
            }
          }
          queue.push(new Item(fun, args));
          if (queue.length === 1 && !draining) {
            setTimeout(drainQueue, 0);
          }
        };

        // v8 likes predictible objects
        function Item(fun, array) {
          this.fun = fun;
          this.array = array;
        }
        Item.prototype.run = function () {
          this.fun.apply(null, this.array);
        };
        process.title = "browser";
        process.browser = true;
        process.env = {};
        process.argv = [];
        process.version = ""; // empty string to avoid regexp issues
        process.versions = {};

        function noop() {}

        process.on = noop;
        process.addListener = noop;
        process.once = noop;
        process.off = noop;
        process.removeListener = noop;
        process.removeAllListeners = noop;
        process.emit = noop;

        process.binding = function (name) {
          throw new Error("process.binding is not supported");
        };

        process.cwd = function () {
          return "/";
        };
        process.chdir = function (dir) {
          throw new Error("process.chdir is not supported");
        };
        process.umask = function () {
          return 0;
        };
      },
      {},
    ],
    24: [
      function (require, module, exports) {
        module.exports = function isBuffer(arg) {
          return (
            arg &&
            typeof arg === "object" &&
            typeof arg.copy === "function" &&
            typeof arg.fill === "function" &&
            typeof arg.readUInt8 === "function"
          );
        };
      },
      {},
    ],
    25: [
      function (require, module, exports) {
        (function (process, global) {
          // Copyright Joyent, Inc. and other Node contributors.
          //
          // Permission is hereby granted, free of charge, to any person obtaining a
          // copy of this software and associated documentation files (the
          // "Software"), to deal in the Software without restriction, including
          // without limitation the rights to use, copy, modify, merge, publish,
          // distribute, sublicense, and/or sell copies of the Software, and to permit
          // persons to whom the Software is furnished to do so, subject to the
          // following conditions:
          //
          // The above copyright notice and this permission notice shall be included
          // in all copies or substantial portions of the Software.
          //
          // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
          // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
          // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
          // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
          // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
          // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
          // USE OR OTHER DEALINGS IN THE SOFTWARE.

          var formatRegExp = /%[sdj%]/g;
          exports.format = function (f) {
            if (!isString(f)) {
              var objects = [];
              for (var i = 0; i < arguments.length; i++) {
                objects.push(inspect(arguments[i]));
              }
              return objects.join(" ");
            }

            var i = 1;
            var args = arguments;
            var len = args.length;
            var str = String(f).replace(formatRegExp, function (x) {
              if (x === "%%") return "%";
              if (i >= len) return x;
              switch (x) {
                case "%s":
                  return String(args[i++]);
                case "%d":
                  return Number(args[i++]);
                case "%j":
                  try {
                    return JSON.stringify(args[i++]);
                  } catch (_) {
                    return "[Circular]";
                  }
                default:
                  return x;
              }
            });
            for (var x = args[i]; i < len; x = args[++i]) {
              if (isNull(x) || !isObject(x)) {
                str += " " + x;
              } else {
                str += " " + inspect(x);
              }
            }
            return str;
          };

          // Mark that a method should not be used.
          // Returns a modified function which warns once by default.
          // If --no-deprecation is set, then it is a no-op.
          exports.deprecate = function (fn, msg) {
            // Allow for deprecating things in the process of starting up.
            if (isUndefined(global.process)) {
              return function () {
                return exports.deprecate(fn, msg).apply(this, arguments);
              };
            }

            if (process.noDeprecation === true) {
              return fn;
            }

            var warned = false;
            function deprecated() {
              if (!warned) {
                if (process.throwDeprecation) {
                  throw new Error(msg);
                } else if (process.traceDeprecation) {
                  console.trace(msg);
                } else {
                  console.error(msg);
                }
                warned = true;
              }
              return fn.apply(this, arguments);
            }

            return deprecated;
          };

          var debugs = {};
          var debugEnviron;
          exports.debuglog = function (set) {
            if (isUndefined(debugEnviron)) debugEnviron = process.env.NODE_DEBUG || "";
            set = set.toUpperCase();
            if (!debugs[set]) {
              if (new RegExp("\\b" + set + "\\b", "i").test(debugEnviron)) {
                var pid = process.pid;
                debugs[set] = function () {
                  var msg = exports.format.apply(exports, arguments);
                  console.error("%s %d: %s", set, pid, msg);
                };
              } else {
                debugs[set] = function () {};
              }
            }
            return debugs[set];
          };

          /**
           * Echos the value of a value. Trys to print the value out
           * in the best way possible given the different types.
           *
           * @param {Object} obj The object to print out.
           * @param {Object} opts Optional options object that alters the output.
           */
          /* legacy: obj, showHidden, depth, colors*/
          function inspect(obj, opts) {
            // default options
            var ctx = {
              seen: [],
              stylize: stylizeNoColor,
            };
            // legacy...
            if (arguments.length >= 3) ctx.depth = arguments[2];
            if (arguments.length >= 4) ctx.colors = arguments[3];
            if (isBoolean(opts)) {
              // legacy...
              ctx.showHidden = opts;
            } else if (opts) {
              // got an "options" object
              exports._extend(ctx, opts);
            }
            // set default options
            if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
            if (isUndefined(ctx.depth)) ctx.depth = 2;
            if (isUndefined(ctx.colors)) ctx.colors = false;
            if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
            if (ctx.colors) ctx.stylize = stylizeWithColor;
            return formatValue(ctx, obj, ctx.depth);
          }
          exports.inspect = inspect;

          // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
          inspect.colors = {
            bold: [1, 22],
            italic: [3, 23],
            underline: [4, 24],
            inverse: [7, 27],
            white: [37, 39],
            grey: [90, 39],
            black: [30, 39],
            blue: [34, 39],
            cyan: [36, 39],
            green: [32, 39],
            magenta: [35, 39],
            red: [31, 39],
            yellow: [33, 39],
          };

          // Don't use 'blue' not visible on cmd.exe
          inspect.styles = {
            special: "cyan",
            number: "yellow",
            boolean: "yellow",
            undefined: "grey",
            null: "bold",
            string: "green",
            date: "magenta",
            // "name": intentionally not styling
            regexp: "red",
          };

          function stylizeWithColor(str, styleType) {
            var style = inspect.styles[styleType];

            if (style) {
              return "\u001b[" + inspect.colors[style][0] + "m" + str + "\u001b[" + inspect.colors[style][1] + "m";
            } else {
              return str;
            }
          }

          function stylizeNoColor(str, styleType) {
            return str;
          }

          function arrayToHash(array) {
            var hash = {};

            array.forEach(function (val, idx) {
              hash[val] = true;
            });

            return hash;
          }

          function formatValue(ctx, value, recurseTimes) {
            // Provide a hook for user-specified inspect functions.
            // Check that value is an object with an inspect function on it
            if (
              ctx.customInspect &&
              value &&
              isFunction(value.inspect) &&
              // Filter out the util module, it's inspect function is special
              value.inspect !== exports.inspect &&
              // Also filter out any prototype objects using the circular check.
              !(value.constructor && value.constructor.prototype === value)
            ) {
              var ret = value.inspect(recurseTimes, ctx);
              if (!isString(ret)) {
                ret = formatValue(ctx, ret, recurseTimes);
              }
              return ret;
            }

            // Primitive types cannot have properties
            var primitive = formatPrimitive(ctx, value);
            if (primitive) {
              return primitive;
            }

            // Look up the keys of the object.
            var keys = Object.keys(value);
            var visibleKeys = arrayToHash(keys);

            if (ctx.showHidden) {
              keys = Object.getOwnPropertyNames(value);
            }

            // IE doesn't make error fields non-enumerable
            // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
            if (isError(value) && (keys.indexOf("message") >= 0 || keys.indexOf("description") >= 0)) {
              return formatError(value);
            }

            // Some type of object without properties can be shortcutted.
            if (keys.length === 0) {
              if (isFunction(value)) {
                var name = value.name ? ": " + value.name : "";
                return ctx.stylize("[Function" + name + "]", "special");
              }
              if (isRegExp(value)) {
                return ctx.stylize(RegExp.prototype.toString.call(value), "regexp");
              }
              if (isDate(value)) {
                return ctx.stylize(Date.prototype.toString.call(value), "date");
              }
              if (isError(value)) {
                return formatError(value);
              }
            }

            var base = "",
              array = false,
              braces = ["{", "}"];

            // Make Array say that they are Array
            if (isArray(value)) {
              array = true;
              braces = ["[", "]"];
            }

            // Make functions say that they are functions
            if (isFunction(value)) {
              var n = value.name ? ": " + value.name : "";
              base = " [Function" + n + "]";
            }

            // Make RegExps say that they are RegExps
            if (isRegExp(value)) {
              base = " " + RegExp.prototype.toString.call(value);
            }

            // Make dates with properties first say the date
            if (isDate(value)) {
              base = " " + Date.prototype.toUTCString.call(value);
            }

            // Make error with message first say the error
            if (isError(value)) {
              base = " " + formatError(value);
            }

            if (keys.length === 0 && (!array || value.length == 0)) {
              return braces[0] + base + braces[1];
            }

            if (recurseTimes < 0) {
              if (isRegExp(value)) {
                return ctx.stylize(RegExp.prototype.toString.call(value), "regexp");
              } else {
                return ctx.stylize("[Object]", "special");
              }
            }

            ctx.seen.push(value);

            var output;
            if (array) {
              output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
            } else {
              output = keys.map(function (key) {
                return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
              });
            }

            ctx.seen.pop();

            return reduceToSingleString(output, base, braces);
          }

          function formatPrimitive(ctx, value) {
            if (isUndefined(value)) return ctx.stylize("undefined", "undefined");
            if (isString(value)) {
              var simple = "'" + JSON.stringify(value).replace(/^"|"$/g, "").replace(/'/g, "\\'").replace(/\\"/g, '"') + "'";
              return ctx.stylize(simple, "string");
            }
            if (isNumber(value)) return ctx.stylize("" + value, "number");
            if (isBoolean(value)) return ctx.stylize("" + value, "boolean");
            // For some reason typeof null is "object", so special case here.
            if (isNull(value)) return ctx.stylize("null", "null");
          }

          function formatError(value) {
            return "[" + Error.prototype.toString.call(value) + "]";
          }

          function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
            var output = [];
            for (var i = 0, l = value.length; i < l; ++i) {
              if (hasOwnProperty(value, String(i))) {
                output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, String(i), true));
              } else {
                output.push("");
              }
            }
            keys.forEach(function (key) {
              if (!key.match(/^\d+$/)) {
                output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, key, true));
              }
            });
            return output;
          }

          function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
            var name, str, desc;
            desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
            if (desc.get) {
              if (desc.set) {
                str = ctx.stylize("[Getter/Setter]", "special");
              } else {
                str = ctx.stylize("[Getter]", "special");
              }
            } else {
              if (desc.set) {
                str = ctx.stylize("[Setter]", "special");
              }
            }
            if (!hasOwnProperty(visibleKeys, key)) {
              name = "[" + key + "]";
            }
            if (!str) {
              if (ctx.seen.indexOf(desc.value) < 0) {
                if (isNull(recurseTimes)) {
                  str = formatValue(ctx, desc.value, null);
                } else {
                  str = formatValue(ctx, desc.value, recurseTimes - 1);
                }
                if (str.indexOf("\n") > -1) {
                  if (array) {
                    str = str
                      .split("\n")
                      .map(function (line) {
                        return "  " + line;
                      })
                      .join("\n")
                      .substr(2);
                  } else {
                    str =
                      "\n" +
                      str
                        .split("\n")
                        .map(function (line) {
                          return "   " + line;
                        })
                        .join("\n");
                  }
                }
              } else {
                str = ctx.stylize("[Circular]", "special");
              }
            }
            if (isUndefined(name)) {
              if (array && key.match(/^\d+$/)) {
                return str;
              }
              name = JSON.stringify("" + key);
              if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
                name = name.substr(1, name.length - 2);
                name = ctx.stylize(name, "name");
              } else {
                name = name
                  .replace(/'/g, "\\'")
                  .replace(/\\"/g, '"')
                  .replace(/(^"|"$)/g, "'");
                name = ctx.stylize(name, "string");
              }
            }

            return name + ": " + str;
          }

          function reduceToSingleString(output, base, braces) {
            var numLinesEst = 0;
            var length = output.reduce(function (prev, cur) {
              numLinesEst++;
              if (cur.indexOf("\n") >= 0) numLinesEst++;
              return prev + cur.replace(/\u001b\[\d\d?m/g, "").length + 1;
            }, 0);

            if (length > 60) {
              return braces[0] + (base === "" ? "" : base + "\n ") + " " + output.join(",\n  ") + " " + braces[1];
            }

            return braces[0] + base + " " + output.join(", ") + " " + braces[1];
          }

          // NOTE: These type checking functions intentionally don't use `instanceof`
          // because it is fragile and can be easily faked with `Object.create()`.
          function isArray(ar) {
            return Array.isArray(ar);
          }
          exports.isArray = isArray;

          function isBoolean(arg) {
            return typeof arg === "boolean";
          }
          exports.isBoolean = isBoolean;

          function isNull(arg) {
            return arg === null;
          }
          exports.isNull = isNull;

          function isNullOrUndefined(arg) {
            return arg == null;
          }
          exports.isNullOrUndefined = isNullOrUndefined;

          function isNumber(arg) {
            return typeof arg === "number";
          }
          exports.isNumber = isNumber;

          function isString(arg) {
            return typeof arg === "string";
          }
          exports.isString = isString;

          function isSymbol(arg) {
            return typeof arg === "symbol";
          }
          exports.isSymbol = isSymbol;

          function isUndefined(arg) {
            return arg === void 0;
          }
          exports.isUndefined = isUndefined;

          function isRegExp(re) {
            return isObject(re) && objectToString(re) === "[object RegExp]";
          }
          exports.isRegExp = isRegExp;

          function isObject(arg) {
            return typeof arg === "object" && arg !== null;
          }
          exports.isObject = isObject;

          function isDate(d) {
            return isObject(d) && objectToString(d) === "[object Date]";
          }
          exports.isDate = isDate;

          function isError(e) {
            return isObject(e) && (objectToString(e) === "[object Error]" || e instanceof Error);
          }
          exports.isError = isError;

          function isFunction(arg) {
            return typeof arg === "function";
          }
          exports.isFunction = isFunction;

          function isPrimitive(arg) {
            return (
              arg === null ||
              typeof arg === "boolean" ||
              typeof arg === "number" ||
              typeof arg === "string" ||
              typeof arg === "symbol" || // ES6 symbol
              typeof arg === "undefined"
            );
          }
          exports.isPrimitive = isPrimitive;

          exports.isBuffer = require("./support/isBuffer");

          function objectToString(o) {
            return Object.prototype.toString.call(o);
          }

          function pad(n) {
            return n < 10 ? "0" + n.toString(10) : n.toString(10);
          }

          var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

          // 26 Feb 16:19:34
          function timestamp() {
            var d = new Date();
            var time = [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join(":");
            return [d.getDate(), months[d.getMonth()], time].join(" ");
          }

          // log is just a thin wrapper to console.log that prepends a timestamp
          exports.log = function () {
            console.log("%s - %s", timestamp(), exports.format.apply(exports, arguments));
          };

          /**
           * Inherit the prototype methods from one constructor into another.
           *
           * The Function.prototype.inherits from lang.js rewritten as a standalone
           * function (not on Function.prototype). NOTE: If this file is to be loaded
           * during bootstrapping this function needs to be rewritten using some native
           * functions as prototype setup using normal JavaScript does not work as
           * expected during bootstrapping (see mirror.js in r114903).
           *
           * @param {function} ctor Constructor function which needs to inherit the
           *     prototype.
           * @param {function} superCtor Constructor function to inherit prototype from.
           */
          exports.inherits = require("inherits");

          exports._extend = function (origin, add) {
            // Don't do anything if add isn't an object
            if (!add || !isObject(add)) return origin;

            var keys = Object.keys(add);
            var i = keys.length;
            while (i--) {
              origin[keys[i]] = add[keys[i]];
            }
            return origin;
          };

          function hasOwnProperty(obj, prop) {
            return Object.prototype.hasOwnProperty.call(obj, prop);
          }
        }).call(
          this,
          require("_process"),
          typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},
        );
      },
      { "./support/isBuffer": 24, _process: 23, inherits: 22 },
    ],
    26: [
      function (require, module, exports) {
        module.exports = require("./lib/");
      },
      { "./lib/": 27 },
    ],
    27: [
      function (require, module, exports) {
        module.exports = require("./socket");

        /**
         * Exports parser
         *
         * @api public
         *
         */
        module.exports.parser = require("engine.io-parser");
      },
      { "./socket": 28, "engine.io-parser": 41 },
    ],
    28: [
      function (require, module, exports) {
        (function (global) {
          /**
           * Module dependencies.
           */

          var transports = require("./transports");
          var Emitter = require("component-emitter");
          var debug = require("debug")("engine.io-client:socket");
          var index = require("indexof");
          var parser = require("engine.io-parser");
          var parseuri = require("parseuri");
          var parsejson = require("parsejson");
          var parseqs = require("parseqs");

          /**
           * Module exports.
           */

          module.exports = Socket;

          /**
           * Noop function.
           *
           * @api private
           */

          function noop() {}

          /**
           * Socket constructor.
           *
           * @param {String|Object} uri or options
           * @param {Object} options
           * @api public
           */

          function Socket(uri, opts) {
            if (!(this instanceof Socket)) return new Socket(uri, opts);

            opts = opts || {};

            if (uri && "object" == typeof uri) {
              opts = uri;
              uri = null;
            }

            if (uri) {
              uri = parseuri(uri);
              opts.hostname = uri.host;
              opts.secure = uri.protocol == "https" || uri.protocol == "wss";
              opts.port = uri.port;
              if (uri.query) opts.query = uri.query;
            } else if (opts.host) {
              opts.hostname = parseuri(opts.host).host;
            }

            this.secure = null != opts.secure ? opts.secure : global.location && "https:" == location.protocol;

            if (opts.hostname && !opts.port) {
              // if no port is specified manually, use the protocol default
              opts.port = this.secure ? "443" : "80";
            }

            this.agent = opts.agent || false;
            this.hostname = opts.hostname || (global.location ? location.hostname : "localhost");
            this.port = opts.port || (global.location && location.port ? location.port : this.secure ? 443 : 80);
            this.query = opts.query || {};
            if ("string" == typeof this.query) this.query = parseqs.decode(this.query);
            this.upgrade = false !== opts.upgrade;
            this.path = (opts.path || "/engine.io").replace(/\/$/, "") + "/";
            this.forceJSONP = !!opts.forceJSONP;
            this.jsonp = false !== opts.jsonp;
            this.forceBase64 = !!opts.forceBase64;
            this.enablesXDR = !!opts.enablesXDR;
            this.timestampParam = opts.timestampParam || "t";
            this.timestampRequests = opts.timestampRequests;
            this.transports = opts.transports || ["polling", "websocket"];
            this.readyState = "";
            this.writeBuffer = [];
            this.policyPort = opts.policyPort || 843;
            this.rememberUpgrade = opts.rememberUpgrade || false;
            this.binaryType = null;
            this.onlyBinaryUpgrades = opts.onlyBinaryUpgrades;
            this.perMessageDeflate = false !== opts.perMessageDeflate ? opts.perMessageDeflate || {} : false;

            if (true === this.perMessageDeflate) this.perMessageDeflate = {};
            if (this.perMessageDeflate && null == this.perMessageDeflate.threshold) {
              this.perMessageDeflate.threshold = 1024;
            }

            // SSL options for Node.js client
            this.pfx = opts.pfx || null;
            this.key = opts.key || null;
            this.passphrase = opts.passphrase || null;
            this.cert = opts.cert || null;
            this.ca = opts.ca || null;
            this.ciphers = opts.ciphers || null;
            this.rejectUnauthorized = opts.rejectUnauthorized === undefined ? null : opts.rejectUnauthorized;

            // other options for Node.js client
            var freeGlobal = typeof global == "object" && global;
            if (freeGlobal.global === freeGlobal) {
              if (opts.extraHeaders && Object.keys(opts.extraHeaders).length > 0) {
                this.extraHeaders = opts.extraHeaders;
              }
            }

            this.open();
          }

          Socket.priorWebsocketSuccess = false;

          /**
           * Mix in `Emitter`.
           */

          Emitter(Socket.prototype);

          /**
           * Protocol version.
           *
           * @api public
           */

          Socket.protocol = parser.protocol; // this is an int

          /**
           * Expose deps for legacy compatibility
           * and standalone browser access.
           */

          Socket.Socket = Socket;
          Socket.Transport = require("./transport");
          Socket.transports = require("./transports");
          Socket.parser = require("engine.io-parser");

          /**
           * Creates transport of the given type.
           *
           * @param {String} transport name
           * @return {Transport}
           * @api private
           */

          Socket.prototype.createTransport = function (name) {
            debug('creating transport "%s"', name);
            var query = clone(this.query);

            // append engine.io protocol identifier
            query.EIO = parser.protocol;

            // transport name
            query.transport = name;

            // session id if we already have one
            if (this.id) query.sid = this.id;

            var transport = new transports[name]({
              agent: this.agent,
              hostname: this.hostname,
              port: this.port,
              secure: this.secure,
              path: this.path,
              query: query,
              forceJSONP: this.forceJSONP,
              jsonp: this.jsonp,
              forceBase64: this.forceBase64,
              enablesXDR: this.enablesXDR,
              timestampRequests: this.timestampRequests,
              timestampParam: this.timestampParam,
              policyPort: this.policyPort,
              socket: this,
              pfx: this.pfx,
              key: this.key,
              passphrase: this.passphrase,
              cert: this.cert,
              ca: this.ca,
              ciphers: this.ciphers,
              rejectUnauthorized: this.rejectUnauthorized,
              perMessageDeflate: this.perMessageDeflate,
              extraHeaders: this.extraHeaders,
            });

            return transport;
          };

          function clone(obj) {
            var o = {};
            for (var i in obj) {
              if (obj.hasOwnProperty(i)) {
                o[i] = obj[i];
              }
            }
            return o;
          }

          /**
           * Initializes transport to use and starts probe.
           *
           * @api private
           */
          Socket.prototype.open = function () {
            var transport;
            if (this.rememberUpgrade && Socket.priorWebsocketSuccess && this.transports.indexOf("websocket") != -1) {
              transport = "websocket";
            } else if (0 === this.transports.length) {
              // Emit error on next tick so it can be listened to
              var self = this;
              setTimeout(function () {
                self.emit("error", "No transports available");
              }, 0);
              return;
            } else {
              transport = this.transports[0];
            }
            this.readyState = "opening";

            // Retry with the next transport if the transport is disabled (jsonp: false)
            try {
              transport = this.createTransport(transport);
            } catch (e) {
              this.transports.shift();
              this.open();
              return;
            }

            transport.open();
            this.setTransport(transport);
          };

          /**
           * Sets the current transport. Disables the existing one (if any).
           *
           * @api private
           */

          Socket.prototype.setTransport = function (transport) {
            debug("setting transport %s", transport.name);
            var self = this;

            if (this.transport) {
              debug("clearing existing transport %s", this.transport.name);
              this.transport.removeAllListeners();
            }

            // set up transport
            this.transport = transport;

            // set up transport listeners
            transport
              .on("drain", function () {
                self.onDrain();
              })
              .on("packet", function (packet) {
                self.onPacket(packet);
              })
              .on("error", function (e) {
                self.onError(e);
              })
              .on("close", function () {
                self.onClose("transport close");
              });
          };

          /**
           * Probes a transport.
           *
           * @param {String} transport name
           * @api private
           */

          Socket.prototype.probe = function (name) {
            debug('probing transport "%s"', name);
            var transport = this.createTransport(name, { probe: 1 }),
              failed = false,
              self = this;

            Socket.priorWebsocketSuccess = false;

            function onTransportOpen() {
              if (self.onlyBinaryUpgrades) {
                var upgradeLosesBinary = !this.supportsBinary && self.transport.supportsBinary;
                failed = failed || upgradeLosesBinary;
              }
              if (failed) return;

              debug('probe transport "%s" opened', name);
              transport.send([{ type: "ping", data: "probe" }]);
              transport.once("packet", function (msg) {
                if (failed) return;
                if ("pong" == msg.type && "probe" == msg.data) {
                  debug('probe transport "%s" pong', name);
                  self.upgrading = true;
                  self.emit("upgrading", transport);
                  if (!transport) return;
                  Socket.priorWebsocketSuccess = "websocket" == transport.name;

                  debug('pausing current transport "%s"', self.transport.name);
                  self.transport.pause(function () {
                    if (failed) return;
                    if ("closed" == self.readyState) return;
                    debug("changing transport and sending upgrade packet");

                    cleanup();

                    self.setTransport(transport);
                    transport.send([{ type: "upgrade" }]);
                    self.emit("upgrade", transport);
                    transport = null;
                    self.upgrading = false;
                    self.flush();
                  });
                } else {
                  debug('probe transport "%s" failed', name);
                  var err = new Error("probe error");
                  err.transport = transport.name;
                  self.emit("upgradeError", err);
                }
              });
            }

            function freezeTransport() {
              if (failed) return;

              // Any callback called by transport should be ignored since now
              failed = true;

              cleanup();

              transport.close();
              transport = null;
            }

            //Handle any error that happens while probing
            function onerror(err) {
              var error = new Error("probe error: " + err);
              error.transport = transport.name;

              freezeTransport();

              debug('probe transport "%s" failed because of error: %s', name, err);

              self.emit("upgradeError", error);
            }

            function onTransportClose() {
              onerror("transport closed");
            }

            //When the socket is closed while we're probing
            function onclose() {
              onerror("socket closed");
            }

            //When the socket is upgraded while we're probing
            function onupgrade(to) {
              if (transport && to.name != transport.name) {
                debug('"%s" works - aborting "%s"', to.name, transport.name);
                freezeTransport();
              }
            }

            //Remove all listeners on the transport and on self
            function cleanup() {
              transport.removeListener("open", onTransportOpen);
              transport.removeListener("error", onerror);
              transport.removeListener("close", onTransportClose);
              self.removeListener("close", onclose);
              self.removeListener("upgrading", onupgrade);
            }

            transport.once("open", onTransportOpen);
            transport.once("error", onerror);
            transport.once("close", onTransportClose);

            this.once("close", onclose);
            this.once("upgrading", onupgrade);

            transport.open();
          };

          /**
           * Called when connection is deemed open.
           *
           * @api public
           */

          Socket.prototype.onOpen = function () {
            debug("socket open");
            this.readyState = "open";
            Socket.priorWebsocketSuccess = "websocket" == this.transport.name;
            this.emit("open");
            this.flush();

            // we check for `readyState` in case an `open`
            // listener already closed the socket
            if ("open" == this.readyState && this.upgrade && this.transport.pause) {
              debug("starting upgrade probes");
              for (var i = 0, l = this.upgrades.length; i < l; i++) {
                this.probe(this.upgrades[i]);
              }
            }
          };

          /**
           * Handles a packet.
           *
           * @api private
           */

          Socket.prototype.onPacket = function (packet) {
            if ("opening" == this.readyState || "open" == this.readyState) {
              debug('socket receive: type "%s", data "%s"', packet.type, packet.data);

              this.emit("packet", packet);

              // Socket is live - any packet counts
              this.emit("heartbeat");

              switch (packet.type) {
                case "open":
                  this.onHandshake(parsejson(packet.data));
                  break;

                case "pong":
                  this.setPing();
                  this.emit("pong");
                  break;

                case "error":
                  var err = new Error("server error");
                  err.code = packet.data;
                  this.onError(err);
                  break;

                case "message":
                  this.emit("data", packet.data);
                  this.emit("message", packet.data);
                  break;
              }
            } else {
              debug('packet received with socket readyState "%s"', this.readyState);
            }
          };

          /**
           * Called upon handshake completion.
           *
           * @param {Object} handshake obj
           * @api private
           */

          Socket.prototype.onHandshake = function (data) {
            this.emit("handshake", data);
            this.id = data.sid;
            this.transport.query.sid = data.sid;
            this.upgrades = this.filterUpgrades(data.upgrades);
            this.pingInterval = data.pingInterval;
            this.pingTimeout = data.pingTimeout;
            this.onOpen();
            // In case open handler closes socket
            if ("closed" == this.readyState) return;
            this.setPing();

            // Prolong liveness of socket on heartbeat
            this.removeListener("heartbeat", this.onHeartbeat);
            this.on("heartbeat", this.onHeartbeat);
          };

          /**
           * Resets ping timeout.
           *
           * @api private
           */

          Socket.prototype.onHeartbeat = function (timeout) {
            clearTimeout(this.pingTimeoutTimer);
            var self = this;
            self.pingTimeoutTimer = setTimeout(
              function () {
                if ("closed" == self.readyState) return;
                self.onClose("ping timeout");
              },
              timeout || self.pingInterval + self.pingTimeout,
            );
          };

          /**
           * Pings server every `this.pingInterval` and expects response
           * within `this.pingTimeout` or closes connection.
           *
           * @api private
           */

          Socket.prototype.setPing = function () {
            var self = this;
            clearTimeout(self.pingIntervalTimer);
            self.pingIntervalTimer = setTimeout(function () {
              debug("writing ping packet - expecting pong within %sms", self.pingTimeout);
              self.ping();
              self.onHeartbeat(self.pingTimeout);
            }, self.pingInterval);
          };

          /**
           * Sends a ping packet.
           *
           * @api private
           */

          Socket.prototype.ping = function () {
            var self = this;
            this.sendPacket("ping", function () {
              self.emit("ping");
            });
          };

          /**
           * Called on `drain` event
           *
           * @api private
           */

          Socket.prototype.onDrain = function () {
            this.writeBuffer.splice(0, this.prevBufferLen);

            // setting prevBufferLen = 0 is very important
            // for example, when upgrading, upgrade packet is sent over,
            // and a nonzero prevBufferLen could cause problems on `drain`
            this.prevBufferLen = 0;

            if (0 === this.writeBuffer.length) {
              this.emit("drain");
            } else {
              this.flush();
            }
          };

          /**
           * Flush write buffers.
           *
           * @api private
           */

          Socket.prototype.flush = function () {
            if ("closed" != this.readyState && this.transport.writable && !this.upgrading && this.writeBuffer.length) {
              debug("flushing %d packets in socket", this.writeBuffer.length);
              this.transport.send(this.writeBuffer);
              // keep track of current length of writeBuffer
              // splice writeBuffer and callbackBuffer on `drain`
              this.prevBufferLen = this.writeBuffer.length;
              this.emit("flush");
            }
          };

          /**
           * Sends a message.
           *
           * @param {String} message.
           * @param {Function} callback function.
           * @param {Object} options.
           * @return {Socket} for chaining.
           * @api public
           */

          Socket.prototype.write = Socket.prototype.send = function (msg, options, fn) {
            this.sendPacket("message", msg, options, fn);
            return this;
          };

          /**
           * Sends a packet.
           *
           * @param {String} packet type.
           * @param {String} data.
           * @param {Object} options.
           * @param {Function} callback function.
           * @api private
           */

          Socket.prototype.sendPacket = function (type, data, options, fn) {
            if ("function" == typeof data) {
              fn = data;
              data = undefined;
            }

            if ("function" == typeof options) {
              fn = options;
              options = null;
            }

            if ("closing" == this.readyState || "closed" == this.readyState) {
              return;
            }

            options = options || {};
            options.compress = false !== options.compress;

            var packet = {
              type: type,
              data: data,
              options: options,
            };
            this.emit("packetCreate", packet);
            this.writeBuffer.push(packet);
            if (fn) this.once("flush", fn);
            this.flush();
          };

          /**
           * Closes the connection.
           *
           * @api private
           */

          Socket.prototype.close = function () {
            if ("opening" == this.readyState || "open" == this.readyState) {
              this.readyState = "closing";

              var self = this;

              if (this.writeBuffer.length) {
                this.once("drain", function () {
                  if (this.upgrading) {
                    waitForUpgrade();
                  } else {
                    close();
                  }
                });
              } else if (this.upgrading) {
                waitForUpgrade();
              } else {
                close();
              }
            }

            function close() {
              self.onClose("forced close");
              debug("socket closing - telling transport to close");
              self.transport.close();
            }

            function cleanupAndClose() {
              self.removeListener("upgrade", cleanupAndClose);
              self.removeListener("upgradeError", cleanupAndClose);
              close();
            }

            function waitForUpgrade() {
              // wait for upgrade to finish since we can't send packets while pausing a transport
              self.once("upgrade", cleanupAndClose);
              self.once("upgradeError", cleanupAndClose);
            }

            return this;
          };

          /**
           * Called upon transport error
           *
           * @api private
           */

          Socket.prototype.onError = function (err) {
            debug("socket error %j", err);
            Socket.priorWebsocketSuccess = false;
            this.emit("error", err);
            this.onClose("transport error", err);
          };

          /**
           * Called upon transport close.
           *
           * @api private
           */

          Socket.prototype.onClose = function (reason, desc) {
            if ("opening" == this.readyState || "open" == this.readyState || "closing" == this.readyState) {
              debug('socket close with reason: "%s"', reason);
              var self = this;

              // clear timers
              clearTimeout(this.pingIntervalTimer);
              clearTimeout(this.pingTimeoutTimer);

              // stop event from firing again for transport
              this.transport.removeAllListeners("close");

              // ensure transport won't stay open
              this.transport.close();

              // ignore further transport communication
              this.transport.removeAllListeners();

              // set ready state
              this.readyState = "closed";

              // clear session id
              this.id = null;

              // emit close event
              this.emit("close", reason, desc);

              // clean buffers after, so users can still
              // grab the buffers on `close` event
              self.writeBuffer = [];
              self.prevBufferLen = 0;
            }
          };

          /**
           * Filters upgrades, returning only those matching client transports.
           *
           * @param {Array} server upgrades
           * @api private
           *
           */

          Socket.prototype.filterUpgrades = function (upgrades) {
            var filteredUpgrades = [];
            for (var i = 0, j = upgrades.length; i < j; i++) {
              if (~index(this.transports, upgrades[i])) filteredUpgrades.push(upgrades[i]);
            }
            return filteredUpgrades;
          };
        }).call(
          this,
          typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},
        );
      },
      {
        "./transport": 29,
        "./transports": 30,
        "component-emitter": 36,
        debug: 38,
        "engine.io-parser": 41,
        indexof: 51,
        parsejson: 52,
        parseqs: 53,
        parseuri: 54,
      },
    ],
    29: [
      function (require, module, exports) {
        /**
         * Module dependencies.
         */

        var parser = require("engine.io-parser");
        var Emitter = require("component-emitter");

        /**
         * Module exports.
         */

        module.exports = Transport;

        /**
         * Transport abstract constructor.
         *
         * @param {Object} options.
         * @api private
         */

        function Transport(opts) {
          this.path = opts.path;
          this.hostname = opts.hostname;
          this.port = opts.port;
          this.secure = opts.secure;
          this.query = opts.query;
          this.timestampParam = opts.timestampParam;
          this.timestampRequests = opts.timestampRequests;
          this.readyState = "";
          this.agent = opts.agent || false;
          this.socket = opts.socket;
          this.enablesXDR = opts.enablesXDR;

          // SSL options for Node.js client
          this.pfx = opts.pfx;
          this.key = opts.key;
          this.passphrase = opts.passphrase;
          this.cert = opts.cert;
          this.ca = opts.ca;
          this.ciphers = opts.ciphers;
          this.rejectUnauthorized = opts.rejectUnauthorized;

          // other options for Node.js client
          this.extraHeaders = opts.extraHeaders;
        }

        /**
         * Mix in `Emitter`.
         */

        Emitter(Transport.prototype);

        /**
         * Emits an error.
         *
         * @param {String} str
         * @return {Transport} for chaining
         * @api public
         */

        Transport.prototype.onError = function (msg, desc) {
          var err = new Error(msg);
          err.type = "TransportError";
          err.description = desc;
          this.emit("error", err);
          return this;
        };

        /**
         * Opens the transport.
         *
         * @api public
         */

        Transport.prototype.open = function () {
          if ("closed" == this.readyState || "" == this.readyState) {
            this.readyState = "opening";
            this.doOpen();
          }

          return this;
        };

        /**
         * Closes the transport.
         *
         * @api private
         */

        Transport.prototype.close = function () {
          if ("opening" == this.readyState || "open" == this.readyState) {
            this.doClose();
            this.onClose();
          }

          return this;
        };

        /**
         * Sends multiple packets.
         *
         * @param {Array} packets
         * @api private
         */

        Transport.prototype.send = function (packets) {
          if ("open" == this.readyState) {
            this.write(packets);
          } else {
            throw new Error("Transport not open");
          }
        };

        /**
         * Called upon open
         *
         * @api private
         */

        Transport.prototype.onOpen = function () {
          this.readyState = "open";
          this.writable = true;
          this.emit("open");
        };

        /**
         * Called with data.
         *
         * @param {String} data
         * @api private
         */

        Transport.prototype.onData = function (data) {
          var packet = parser.decodePacket(data, this.socket.binaryType);
          this.onPacket(packet);
        };

        /**
         * Called with a decoded packet.
         */

        Transport.prototype.onPacket = function (packet) {
          this.emit("packet", packet);
        };

        /**
         * Called upon close.
         *
         * @api private
         */

        Transport.prototype.onClose = function () {
          this.readyState = "closed";
          this.emit("close");
        };
      },
      { "component-emitter": 36, "engine.io-parser": 41 },
    ],
    30: [
      function (require, module, exports) {
        (function (global) {
          /**
           * Module dependencies
           */

          var XMLHttpRequest = require("xmlhttprequest-ssl");
          var XHR = require("./polling-xhr");
          var JSONP = require("./polling-jsonp");
          var websocket = require("./websocket");

          /**
           * Export transports.
           */

          exports.polling = polling;
          exports.websocket = websocket;

          /**
           * Polling transport polymorphic constructor.
           * Decides on xhr vs jsonp based on feature detection.
           *
           * @api private
           */

          function polling(opts) {
            var xhr;
            var xd = false;
            var xs = false;
            var jsonp = false !== opts.jsonp;

            if (global.location) {
              var isSSL = "https:" == location.protocol;
              var port = location.port;

              // some user agents have empty `location.port`
              if (!port) {
                port = isSSL ? 443 : 80;
              }

              xd = opts.hostname != location.hostname || port != opts.port;
              xs = opts.secure != isSSL;
            }

            opts.xdomain = xd;
            opts.xscheme = xs;
            xhr = new XMLHttpRequest(opts);

            if ("open" in xhr && !opts.forceJSONP) {
              return new XHR(opts);
            } else {
              if (!jsonp) throw new Error("JSONP disabled");
              return new JSONP(opts);
            }
          }
        }).call(
          this,
          typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},
        );
      },
      { "./polling-jsonp": 31, "./polling-xhr": 32, "./websocket": 34, "xmlhttprequest-ssl": 35 },
    ],
    31: [
      function (require, module, exports) {
        (function (global) {
          /**
           * Module requirements.
           */

          var Polling = require("./polling");
          var inherit = require("component-inherit");

          /**
           * Module exports.
           */

          module.exports = JSONPPolling;

          /**
           * Cached regular expressions.
           */

          var rNewline = /\n/g;
          var rEscapedNewline = /\\n/g;

          /**
           * Global JSONP callbacks.
           */

          var callbacks;

          /**
           * Callbacks count.
           */

          var index = 0;

          /**
           * Noop.
           */

          function empty() {}

          /**
           * JSONP Polling constructor.
           *
           * @param {Object} opts.
           * @api public
           */

          function JSONPPolling(opts) {
            Polling.call(this, opts);

            this.query = this.query || {};

            // define global callbacks array if not present
            // we do this here (lazily) to avoid unneeded global pollution
            if (!callbacks) {
              // we need to consider multiple engines in the same page
              if (!global.___eio) global.___eio = [];
              callbacks = global.___eio;
            }

            // callback identifier
            this.index = callbacks.length;

            // add callback to jsonp global
            var self = this;
            callbacks.push(function (msg) {
              self.onData(msg);
            });

            // append to query string
            this.query.j = this.index;

            // prevent spurious errors from being emitted when the window is unloaded
            if (global.document && global.addEventListener) {
              global.addEventListener(
                "beforeunload",
                function () {
                  if (self.script) self.script.onerror = empty;
                },
                false,
              );
            }
          }

          /**
           * Inherits from Polling.
           */

          inherit(JSONPPolling, Polling);

          /*
           * JSONP only supports binary as base64 encoded strings
           */

          JSONPPolling.prototype.supportsBinary = false;

          /**
           * Closes the socket.
           *
           * @api private
           */

          JSONPPolling.prototype.doClose = function () {
            if (this.script) {
              this.script.parentNode.removeChild(this.script);
              this.script = null;
            }

            if (this.form) {
              this.form.parentNode.removeChild(this.form);
              this.form = null;
              this.iframe = null;
            }

            Polling.prototype.doClose.call(this);
          };

          /**
           * Starts a poll cycle.
           *
           * @api private
           */

          JSONPPolling.prototype.doPoll = function () {
            var self = this;
            var script = document.createElement("script");

            if (this.script) {
              this.script.parentNode.removeChild(this.script);
              this.script = null;
            }

            script.async = true;
            script.src = this.uri();
            script.onerror = function (e) {
              self.onError("jsonp poll error", e);
            };

            var insertAt = document.getElementsByTagName("script")[0];
            if (insertAt) {
              insertAt.parentNode.insertBefore(script, insertAt);
            } else {
              (document.head || document.body).appendChild(script);
            }
            this.script = script;

            var isUAgecko = "undefined" != typeof navigator && /gecko/i.test(navigator.userAgent);

            if (isUAgecko) {
              setTimeout(function () {
                var iframe = document.createElement("iframe");
                document.body.appendChild(iframe);
                document.body.removeChild(iframe);
              }, 100);
            }
          };

          /**
           * Writes with a hidden iframe.
           *
           * @param {String} data to send
           * @param {Function} called upon flush.
           * @api private
           */

          JSONPPolling.prototype.doWrite = function (data, fn) {
            var self = this;

            if (!this.form) {
              var form = document.createElement("form");
              var area = document.createElement("textarea");
              var id = (this.iframeId = "eio_iframe_" + this.index);
              var iframe;

              form.className = "socketio";
              form.style.position = "absolute";
              form.style.top = "-1000px";
              form.style.left = "-1000px";
              form.target = id;
              form.method = "POST";
              form.setAttribute("accept-charset", "utf-8");
              area.name = "d";
              form.appendChild(area);
              document.body.appendChild(form);

              this.form = form;
              this.area = area;
            }

            this.form.action = this.uri();

            function complete() {
              initIframe();
              fn();
            }

            function initIframe() {
              if (self.iframe) {
                try {
                  self.form.removeChild(self.iframe);
                } catch (e) {
                  self.onError("jsonp polling iframe removal error", e);
                }
              }

              try {
                // ie6 dynamic iframes with target="" support (thanks Chris Lambacher)
                var html = '<iframe src="javascript:0" name="' + self.iframeId + '">';
                iframe = document.createElement(html);
              } catch (e) {
                iframe = document.createElement("iframe");
                iframe.name = self.iframeId;
                iframe.src = "javascript:0";
              }

              iframe.id = self.iframeId;

              self.form.appendChild(iframe);
              self.iframe = iframe;
            }

            initIframe();

            // escape \n to prevent it from being converted into \r\n by some UAs
            // double escaping is required for escaped new lines because unescaping of new lines can be done safely on server-side
            data = data.replace(rEscapedNewline, "\\\n");
            this.area.value = data.replace(rNewline, "\\n");

            try {
              this.form.submit();
            } catch (e) {}

            if (this.iframe.attachEvent) {
              this.iframe.onreadystatechange = function () {
                if (self.iframe.readyState == "complete") {
                  complete();
                }
              };
            } else {
              this.iframe.onload = complete;
            }
          };
        }).call(
          this,
          typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},
        );
      },
      { "./polling": 33, "component-inherit": 37 },
    ],
    32: [
      function (require, module, exports) {
        (function (global) {
          /**
           * Module requirements.
           */

          var XMLHttpRequest = require("xmlhttprequest-ssl");
          var Polling = require("./polling");
          var Emitter = require("component-emitter");
          var inherit = require("component-inherit");
          var debug = require("debug")("engine.io-client:polling-xhr");

          /**
           * Module exports.
           */

          module.exports = XHR;
          module.exports.Request = Request;

          /**
           * Empty function
           */

          function empty() {}

          /**
           * XHR Polling constructor.
           *
           * @param {Object} opts
           * @api public
           */

          function XHR(opts) {
            Polling.call(this, opts);

            if (global.location) {
              var isSSL = "https:" == location.protocol;
              var port = location.port;

              // some user agents have empty `location.port`
              if (!port) {
                port = isSSL ? 443 : 80;
              }

              this.xd = opts.hostname != global.location.hostname || port != opts.port;
              this.xs = opts.secure != isSSL;
            } else {
              this.extraHeaders = opts.extraHeaders;
            }
          }

          /**
           * Inherits from Polling.
           */

          inherit(XHR, Polling);

          /**
           * XHR supports binary
           */

          XHR.prototype.supportsBinary = true;

          /**
           * Creates a request.
           *
           * @param {String} method
           * @api private
           */

          XHR.prototype.request = function (opts) {
            opts = opts || {};
            opts.uri = this.uri();
            opts.xd = this.xd;
            opts.xs = this.xs;
            opts.agent = this.agent || false;
            opts.supportsBinary = this.supportsBinary;
            opts.enablesXDR = this.enablesXDR;

            // SSL options for Node.js client
            opts.pfx = this.pfx;
            opts.key = this.key;
            opts.passphrase = this.passphrase;
            opts.cert = this.cert;
            opts.ca = this.ca;
            opts.ciphers = this.ciphers;
            opts.rejectUnauthorized = this.rejectUnauthorized;

            // other options for Node.js client
            opts.extraHeaders = this.extraHeaders;

            return new Request(opts);
          };

          /**
           * Sends data.
           *
           * @param {String} data to send.
           * @param {Function} called upon flush.
           * @api private
           */

          XHR.prototype.doWrite = function (data, fn) {
            var isBinary = typeof data !== "string" && data !== undefined;
            var req = this.request({ method: "POST", data: data, isBinary: isBinary });
            var self = this;
            req.on("success", fn);
            req.on("error", function (err) {
              self.onError("xhr post error", err);
            });
            this.sendXhr = req;
          };

          /**
           * Starts a poll cycle.
           *
           * @api private
           */

          XHR.prototype.doPoll = function () {
            debug("xhr poll");
            var req = this.request();
            var self = this;
            req.on("data", function (data) {
              self.onData(data);
            });
            req.on("error", function (err) {
              self.onError("xhr poll error", err);
            });
            this.pollXhr = req;
          };

          /**
           * Request constructor
           *
           * @param {Object} options
           * @api public
           */

          function Request(opts) {
            this.method = opts.method || "GET";
            this.uri = opts.uri;
            this.xd = !!opts.xd;
            this.xs = !!opts.xs;
            this.async = false !== opts.async;
            this.data = undefined != opts.data ? opts.data : null;
            this.agent = opts.agent;
            this.isBinary = opts.isBinary;
            this.supportsBinary = opts.supportsBinary;
            this.enablesXDR = opts.enablesXDR;

            // SSL options for Node.js client
            this.pfx = opts.pfx;
            this.key = opts.key;
            this.passphrase = opts.passphrase;
            this.cert = opts.cert;
            this.ca = opts.ca;
            this.ciphers = opts.ciphers;
            this.rejectUnauthorized = opts.rejectUnauthorized;

            // other options for Node.js client
            this.extraHeaders = opts.extraHeaders;

            this.create();
          }

          /**
           * Mix in `Emitter`.
           */

          Emitter(Request.prototype);

          /**
           * Creates the XHR object and sends the request.
           *
           * @api private
           */

          Request.prototype.create = function () {
            var opts = { agent: this.agent, xdomain: this.xd, xscheme: this.xs, enablesXDR: this.enablesXDR };

            // SSL options for Node.js client
            opts.pfx = this.pfx;
            opts.key = this.key;
            opts.passphrase = this.passphrase;
            opts.cert = this.cert;
            opts.ca = this.ca;
            opts.ciphers = this.ciphers;
            opts.rejectUnauthorized = this.rejectUnauthorized;

            var xhr = (this.xhr = new XMLHttpRequest(opts));
            var self = this;

            try {
              debug("xhr open %s: %s", this.method, this.uri);
              xhr.open(this.method, this.uri, this.async);
              try {
                if (this.extraHeaders) {
                  xhr.setDisableHeaderCheck(true);
                  for (var i in this.extraHeaders) {
                    if (this.extraHeaders.hasOwnProperty(i)) {
                      xhr.setRequestHeader(i, this.extraHeaders[i]);
                    }
                  }
                }
              } catch (e) {}
              if (this.supportsBinary) {
                // This has to be done after open because Firefox is stupid
                // http://stackoverflow.com/questions/13216903/get-binary-data-with-xmlhttprequest-in-a-firefox-extension
                xhr.responseType = "arraybuffer";
              }

              if ("POST" == this.method) {
                try {
                  if (this.isBinary) {
                    xhr.setRequestHeader("Content-type", "application/octet-stream");
                  } else {
                    xhr.setRequestHeader("Content-type", "text/plain;charset=UTF-8");
                  }
                } catch (e) {}
              }

              // ie6 check
              if ("withCredentials" in xhr) {
                xhr.withCredentials = true;
              }

              if (this.hasXDR()) {
                xhr.onload = function () {
                  self.onLoad();
                };
                xhr.onerror = function () {
                  self.onError(xhr.responseText);
                };
              } else {
                xhr.onreadystatechange = function () {
                  if (4 != xhr.readyState) return;
                  if (200 == xhr.status || 1223 == xhr.status) {
                    self.onLoad();
                  } else {
                    // make sure the `error` event handler that's user-set
                    // does not throw in the same tick and gets caught here
                    setTimeout(function () {
                      self.onError(xhr.status);
                    }, 0);
                  }
                };
              }

              debug("xhr data %s", this.data);
              xhr.send(this.data);
            } catch (e) {
              // Need to defer since .create() is called directly fhrom the constructor
              // and thus the 'error' event can only be only bound *after* this exception
              // occurs.  Therefore, also, we cannot throw here at all.
              setTimeout(function () {
                self.onError(e);
              }, 0);
              return;
            }

            if (global.document) {
              this.index = Request.requestsCount++;
              Request.requests[this.index] = this;
            }
          };

          /**
           * Called upon successful response.
           *
           * @api private
           */

          Request.prototype.onSuccess = function () {
            this.emit("success");
            this.cleanup();
          };

          /**
           * Called if we have data.
           *
           * @api private
           */

          Request.prototype.onData = function (data) {
            this.emit("data", data);
            this.onSuccess();
          };

          /**
           * Called upon error.
           *
           * @api private
           */

          Request.prototype.onError = function (err) {
            this.emit("error", err);
            this.cleanup(true);
          };

          /**
           * Cleans up house.
           *
           * @api private
           */

          Request.prototype.cleanup = function (fromError) {
            if ("undefined" == typeof this.xhr || null === this.xhr) {
              return;
            }
            // xmlhttprequest
            if (this.hasXDR()) {
              this.xhr.onload = this.xhr.onerror = empty;
            } else {
              this.xhr.onreadystatechange = empty;
            }

            if (fromError) {
              try {
                this.xhr.abort();
              } catch (e) {}
            }

            if (global.document) {
              delete Request.requests[this.index];
            }

            this.xhr = null;
          };

          /**
           * Called upon load.
           *
           * @api private
           */

          Request.prototype.onLoad = function () {
            var data;
            try {
              var contentType;
              try {
                contentType = this.xhr.getResponseHeader("Content-Type").split(";")[0];
              } catch (e) {}
              if (contentType === "application/octet-stream") {
                data = this.xhr.response;
              } else {
                if (!this.supportsBinary) {
                  data = this.xhr.responseText;
                } else {
                  try {
                    data = String.fromCharCode.apply(null, new Uint8Array(this.xhr.response));
                  } catch (e) {
                    var ui8Arr = new Uint8Array(this.xhr.response);
                    var dataArray = [];
                    for (var idx = 0, length = ui8Arr.length; idx < length; idx++) {
                      dataArray.push(ui8Arr[idx]);
                    }

                    data = String.fromCharCode.apply(null, dataArray);
                  }
                }
              }
            } catch (e) {
              this.onError(e);
            }
            if (null != data) {
              this.onData(data);
            }
          };

          /**
           * Check if it has XDomainRequest.
           *
           * @api private
           */

          Request.prototype.hasXDR = function () {
            return "undefined" !== typeof global.XDomainRequest && !this.xs && this.enablesXDR;
          };

          /**
           * Aborts the request.
           *
           * @api public
           */

          Request.prototype.abort = function () {
            this.cleanup();
          };

          /**
           * Aborts pending requests when unloading the window. This is needed to prevent
           * memory leaks (e.g. when using IE) and to ensure that no spurious error is
           * emitted.
           */

          if (global.document) {
            Request.requestsCount = 0;
            Request.requests = {};
            if (global.attachEvent) {
              global.attachEvent("onunload", unloadHandler);
            } else if (global.addEventListener) {
              global.addEventListener("beforeunload", unloadHandler, false);
            }
          }

          function unloadHandler() {
            for (var i in Request.requests) {
              if (Request.requests.hasOwnProperty(i)) {
                Request.requests[i].abort();
              }
            }
          }
        }).call(
          this,
          typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},
        );
      },
      { "./polling": 33, "component-emitter": 36, "component-inherit": 37, debug: 38, "xmlhttprequest-ssl": 35 },
    ],
    33: [
      function (require, module, exports) {
        /**
         * Module dependencies.
         */

        var Transport = require("../transport");
        var parseqs = require("parseqs");
        var parser = require("engine.io-parser");
        var inherit = require("component-inherit");
        var yeast = require("yeast");
        var debug = require("debug")("engine.io-client:polling");

        /**
         * Module exports.
         */

        module.exports = Polling;

        /**
         * Is XHR2 supported?
         */

        var hasXHR2 = (function () {
          var XMLHttpRequest = require("xmlhttprequest-ssl");
          var xhr = new XMLHttpRequest({ xdomain: false });
          return null != xhr.responseType;
        })();

        /**
         * Polling interface.
         *
         * @param {Object} opts
         * @api private
         */

        function Polling(opts) {
          var forceBase64 = opts && opts.forceBase64;
          if (!hasXHR2 || forceBase64) {
            this.supportsBinary = false;
          }
          Transport.call(this, opts);
        }

        /**
         * Inherits from Transport.
         */

        inherit(Polling, Transport);

        /**
         * Transport name.
         */

        Polling.prototype.name = "polling";

        /**
         * Opens the socket (triggers polling). We write a PING message to determine
         * when the transport is open.
         *
         * @api private
         */

        Polling.prototype.doOpen = function () {
          this.poll();
        };

        /**
         * Pauses polling.
         *
         * @param {Function} callback upon buffers are flushed and transport is paused
         * @api private
         */

        Polling.prototype.pause = function (onPause) {
          var pending = 0;
          var self = this;

          this.readyState = "pausing";

          function pause() {
            debug("paused");
            self.readyState = "paused";
            onPause();
          }

          if (this.polling || !this.writable) {
            var total = 0;

            if (this.polling) {
              debug("we are currently polling - waiting to pause");
              total++;
              this.once("pollComplete", function () {
                debug("pre-pause polling complete");
                --total || pause();
              });
            }

            if (!this.writable) {
              debug("we are currently writing - waiting to pause");
              total++;
              this.once("drain", function () {
                debug("pre-pause writing complete");
                --total || pause();
              });
            }
          } else {
            pause();
          }
        };

        /**
         * Starts polling cycle.
         *
         * @api public
         */

        Polling.prototype.poll = function () {
          debug("polling");
          this.polling = true;
          this.doPoll();
          this.emit("poll");
        };

        /**
         * Overloads onData to detect payloads.
         *
         * @api private
         */

        Polling.prototype.onData = function (data) {
          var self = this;
          debug("polling got data %s", data);
          var callback = function (packet, index, total) {
            // if its the first message we consider the transport open
            if ("opening" == self.readyState) {
              self.onOpen();
            }

            // if its a close packet, we close the ongoing requests
            if ("close" == packet.type) {
              self.onClose();
              return false;
            }

            // otherwise bypass onData and handle the message
            self.onPacket(packet);
          };

          // decode payload
          parser.decodePayload(data, this.socket.binaryType, callback);

          // if an event did not trigger closing
          if ("closed" != this.readyState) {
            // if we got data we're not polling
            this.polling = false;
            this.emit("pollComplete");

            if ("open" == this.readyState) {
              this.poll();
            } else {
              debug('ignoring poll - transport state "%s"', this.readyState);
            }
          }
        };

        /**
         * For polling, send a close packet.
         *
         * @api private
         */

        Polling.prototype.doClose = function () {
          var self = this;

          function close() {
            debug("writing close packet");
            self.write([{ type: "close" }]);
          }

          if ("open" == this.readyState) {
            debug("transport open - closing");
            close();
          } else {
            // in case we're trying to close while
            // handshaking is in progress (GH-164)
            debug("transport not open - deferring close");
            this.once("open", close);
          }
        };

        /**
         * Writes a packets payload.
         *
         * @param {Array} data packets
         * @param {Function} drain callback
         * @api private
         */

        Polling.prototype.write = function (packets) {
          var self = this;
          this.writable = false;
          var callbackfn = function () {
            self.writable = true;
            self.emit("drain");
          };

          var self = this;
          parser.encodePayload(packets, this.supportsBinary, function (data) {
            self.doWrite(data, callbackfn);
          });
        };

        /**
         * Generates uri for connection.
         *
         * @api private
         */

        Polling.prototype.uri = function () {
          var query = this.query || {};
          var schema = this.secure ? "https" : "http";
          var port = "";

          // cache busting is forced
          if (false !== this.timestampRequests) {
            query[this.timestampParam] = yeast();
          }

          if (!this.supportsBinary && !query.sid) {
            query.b64 = 1;
          }

          query = parseqs.encode(query);

          // avoid port if default for schema
          if (this.port && (("https" == schema && this.port != 443) || ("http" == schema && this.port != 80))) {
            port = ":" + this.port;
          }

          // prepend ? to query
          if (query.length) {
            query = "?" + query;
          }

          var ipv6 = this.hostname.indexOf(":") !== -1;
          return schema + "://" + (ipv6 ? "[" + this.hostname + "]" : this.hostname) + port + this.path + query;
        };
      },
      { "../transport": 29, "component-inherit": 37, debug: 38, "engine.io-parser": 41, parseqs: 53, "xmlhttprequest-ssl": 35, yeast: 55 },
    ],
    34: [
      function (require, module, exports) {
        (function (global) {
          /**
           * Module dependencies.
           */

          var Transport = require("../transport");
          var parser = require("engine.io-parser");
          var parseqs = require("parseqs");
          var inherit = require("component-inherit");
          var yeast = require("yeast");
          var debug = require("debug")("engine.io-client:websocket");
          var BrowserWebSocket = global.WebSocket || global.MozWebSocket;

          /**
           * Get either the `WebSocket` or `MozWebSocket` globals
           * in the browser or try to resolve WebSocket-compatible
           * interface exposed by `ws` for Node-like environment.
           */

          var WebSocket = BrowserWebSocket;
          if (!WebSocket && typeof window === "undefined") {
            try {
              WebSocket = require("ws");
            } catch (e) {}
          }

          /**
           * Module exports.
           */

          module.exports = WS;

          /**
           * WebSocket transport constructor.
           *
           * @api {Object} connection options
           * @api public
           */

          function WS(opts) {
            var forceBase64 = opts && opts.forceBase64;
            if (forceBase64) {
              this.supportsBinary = false;
            }
            this.perMessageDeflate = opts.perMessageDeflate;
            Transport.call(this, opts);
          }

          /**
           * Inherits from Transport.
           */

          inherit(WS, Transport);

          /**
           * Transport name.
           *
           * @api public
           */

          WS.prototype.name = "websocket";

          /*
           * WebSockets support binary
           */

          WS.prototype.supportsBinary = true;

          /**
           * Opens socket.
           *
           * @api private
           */

          WS.prototype.doOpen = function () {
            if (!this.check()) {
              // let probe timeout
              return;
            }

            var self = this;
            var uri = this.uri();
            var protocols = void 0;
            var opts = {
              agent: this.agent,
              perMessageDeflate: this.perMessageDeflate,
            };

            // SSL options for Node.js client
            opts.pfx = this.pfx;
            opts.key = this.key;
            opts.passphrase = this.passphrase;
            opts.cert = this.cert;
            opts.ca = this.ca;
            opts.ciphers = this.ciphers;
            opts.rejectUnauthorized = this.rejectUnauthorized;
            if (this.extraHeaders) {
              opts.headers = this.extraHeaders;
            }

            this.ws = BrowserWebSocket ? new WebSocket(uri) : new WebSocket(uri, protocols, opts);

            if (this.ws.binaryType === undefined) {
              this.supportsBinary = false;
            }

            if (this.ws.supports && this.ws.supports.binary) {
              this.supportsBinary = true;
              this.ws.binaryType = "buffer";
            } else {
              this.ws.binaryType = "arraybuffer";
            }

            this.addEventListeners();
          };

          /**
           * Adds event listeners to the socket
           *
           * @api private
           */

          WS.prototype.addEventListeners = function () {
            var self = this;

            this.ws.onopen = function () {
              self.onOpen();
            };
            this.ws.onclose = function () {
              self.onClose();
            };
            this.ws.onmessage = function (ev) {
              self.onData(ev.data);
            };
            this.ws.onerror = function (e) {
              self.onError("websocket error", e);
            };
          };

          /**
           * Override `onData` to use a timer on iOS.
           * See: https://gist.github.com/mloughran/2052006
           *
           * @api private
           */

          if ("undefined" != typeof navigator && /iPad|iPhone|iPod/i.test(navigator.userAgent)) {
            WS.prototype.onData = function (data) {
              var self = this;
              setTimeout(function () {
                Transport.prototype.onData.call(self, data);
              }, 0);
            };
          }

          /**
           * Writes data to socket.
           *
           * @param {Array} array of packets.
           * @api private
           */

          WS.prototype.write = function (packets) {
            var self = this;
            this.writable = false;

            // encodePacket efficient as it uses WS framing
            // no need for encodePayload
            var total = packets.length;
            for (var i = 0, l = total; i < l; i++) {
              (function (packet) {
                parser.encodePacket(packet, self.supportsBinary, function (data) {
                  if (!BrowserWebSocket) {
                    // always create a new object (GH-437)
                    var opts = {};
                    if (packet.options) {
                      opts.compress = packet.options.compress;
                    }

                    if (self.perMessageDeflate) {
                      var len = "string" == typeof data ? global.Buffer.byteLength(data) : data.length;
                      if (len < self.perMessageDeflate.threshold) {
                        opts.compress = false;
                      }
                    }
                  }

                  //Sometimes the websocket has already been closed but the browser didn't
                  //have a chance of informing us about it yet, in that case send will
                  //throw an error
                  try {
                    if (BrowserWebSocket) {
                      // TypeError is thrown when passing the second argument on Safari
                      self.ws.send(data);
                    } else {
                      self.ws.send(data, opts);
                    }
                  } catch (e) {
                    debug("websocket closed before onclose event");
                  }

                  --total || done();
                });
              })(packets[i]);
            }

            function done() {
              self.emit("flush");

              // fake drain
              // defer to next tick to allow Socket to clear writeBuffer
              setTimeout(function () {
                self.writable = true;
                self.emit("drain");
              }, 0);
            }
          };

          /**
           * Called upon close
           *
           * @api private
           */

          WS.prototype.onClose = function () {
            Transport.prototype.onClose.call(this);
          };

          /**
           * Closes socket.
           *
           * @api private
           */

          WS.prototype.doClose = function () {
            if (typeof this.ws !== "undefined") {
              this.ws.close();
            }
          };

          /**
           * Generates uri for connection.
           *
           * @api private
           */

          WS.prototype.uri = function () {
            var query = this.query || {};
            var schema = this.secure ? "wss" : "ws";
            var port = "";

            // avoid port if default for schema
            if (this.port && (("wss" == schema && this.port != 443) || ("ws" == schema && this.port != 80))) {
              port = ":" + this.port;
            }

            // append timestamp to URI
            if (this.timestampRequests) {
              query[this.timestampParam] = yeast();
            }

            // communicate binary support capabilities
            if (!this.supportsBinary) {
              query.b64 = 1;
            }

            query = parseqs.encode(query);

            // prepend ? to query
            if (query.length) {
              query = "?" + query;
            }

            var ipv6 = this.hostname.indexOf(":") !== -1;
            return schema + "://" + (ipv6 ? "[" + this.hostname + "]" : this.hostname) + port + this.path + query;
          };

          /**
           * Feature detection for WebSocket.
           *
           * @return {Boolean} whether this transport is available.
           * @api public
           */

          WS.prototype.check = function () {
            return !!WebSocket && !("__initialize" in WebSocket && this.name === WS.prototype.name);
          };
        }).call(
          this,
          typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},
        );
      },
      { "../transport": 29, "component-inherit": 37, debug: 38, "engine.io-parser": 41, parseqs: 53, ws: 16, yeast: 55 },
    ],
    35: [
      function (require, module, exports) {
        // browser shim for xmlhttprequest module
        var hasCORS = require("has-cors");

        module.exports = function (opts) {
          var xdomain = opts.xdomain;

          // scheme must be same when usign XDomainRequest
          // http://blogs.msdn.com/b/ieinternals/archive/2010/05/13/xdomainrequest-restrictions-limitations-and-workarounds.aspx
          var xscheme = opts.xscheme;

          // XDomainRequest has a flow of not sending cookie, therefore it should be disabled as a default.
          // https://github.com/Automattic/engine.io-client/pull/217
          var enablesXDR = opts.enablesXDR;

          // XMLHttpRequest can be disabled on IE
          try {
            if ("undefined" != typeof XMLHttpRequest && (!xdomain || hasCORS)) {
              return new XMLHttpRequest();
            }
          } catch (e) {}

          // Use XDomainRequest for IE8 if enablesXDR is true
          // because loading bar keeps flashing when using jsonp-polling
          // https://github.com/yujiosaka/socke.io-ie8-loading-example
          try {
            if ("undefined" != typeof XDomainRequest && !xscheme && enablesXDR) {
              return new XDomainRequest();
            }
          } catch (e) {}

          if (!xdomain) {
            try {
              return new ActiveXObject("Microsoft.XMLHTTP");
            } catch (e) {}
          }
        };
      },
      { "has-cors": 50 },
    ],
    36: [
      function (require, module, exports) {
        /**
         * Expose `Emitter`.
         */

        module.exports = Emitter;

        /**
         * Initialize a new `Emitter`.
         *
         * @api public
         */

        function Emitter(obj) {
          if (obj) return mixin(obj);
        }

        /**
         * Mixin the emitter properties.
         *
         * @param {Object} obj
         * @return {Object}
         * @api private
         */

        function mixin(obj) {
          for (var key in Emitter.prototype) {
            obj[key] = Emitter.prototype[key];
          }
          return obj;
        }

        /**
         * Listen on the given `event` with `fn`.
         *
         * @param {String} event
         * @param {Function} fn
         * @return {Emitter}
         * @api public
         */

        Emitter.prototype.on = Emitter.prototype.addEventListener = function (event, fn) {
          this._callbacks = this._callbacks || {};
          (this._callbacks[event] = this._callbacks[event] || []).push(fn);
          return this;
        };

        /**
         * Adds an `event` listener that will be invoked a single
         * time then automatically removed.
         *
         * @param {String} event
         * @param {Function} fn
         * @return {Emitter}
         * @api public
         */

        Emitter.prototype.once = function (event, fn) {
          var self = this;
          this._callbacks = this._callbacks || {};

          function on() {
            self.off(event, on);
            fn.apply(this, arguments);
          }

          on.fn = fn;
          this.on(event, on);
          return this;
        };

        /**
         * Remove the given callback for `event` or all
         * registered callbacks.
         *
         * @param {String} event
         * @param {Function} fn
         * @return {Emitter}
         * @api public
         */

        Emitter.prototype.off =
          Emitter.prototype.removeListener =
          Emitter.prototype.removeAllListeners =
          Emitter.prototype.removeEventListener =
            function (event, fn) {
              this._callbacks = this._callbacks || {};

              // all
              if (0 == arguments.length) {
                this._callbacks = {};
                return this;
              }

              // specific event
              var callbacks = this._callbacks[event];
              if (!callbacks) return this;

              // remove all handlers
              if (1 == arguments.length) {
                delete this._callbacks[event];
                return this;
              }

              // remove specific handler
              var cb;
              for (var i = 0; i < callbacks.length; i++) {
                cb = callbacks[i];
                if (cb === fn || cb.fn === fn) {
                  callbacks.splice(i, 1);
                  break;
                }
              }
              return this;
            };

        /**
         * Emit `event` with the given args.
         *
         * @param {String} event
         * @param {Mixed} ...
         * @return {Emitter}
         */

        Emitter.prototype.emit = function (event) {
          this._callbacks = this._callbacks || {};
          var args = [].slice.call(arguments, 1),
            callbacks = this._callbacks[event];

          if (callbacks) {
            callbacks = callbacks.slice(0);
            for (var i = 0, len = callbacks.length; i < len; ++i) {
              callbacks[i].apply(this, args);
            }
          }

          return this;
        };

        /**
         * Return array of callbacks for `event`.
         *
         * @param {String} event
         * @return {Array}
         * @api public
         */

        Emitter.prototype.listeners = function (event) {
          this._callbacks = this._callbacks || {};
          return this._callbacks[event] || [];
        };

        /**
         * Check if this emitter has `event` handlers.
         *
         * @param {String} event
         * @return {Boolean}
         * @api public
         */

        Emitter.prototype.hasListeners = function (event) {
          return !!this.listeners(event).length;
        };
      },
      {},
    ],
    37: [
      function (require, module, exports) {
        module.exports = function (a, b) {
          var fn = function () {};
          fn.prototype = b.prototype;
          a.prototype = new fn();
          a.prototype.constructor = a;
        };
      },
      {},
    ],
    38: [
      function (require, module, exports) {
        /**
         * This is the web browser implementation of `debug()`.
         *
         * Expose `debug()` as the module.
         */

        exports = module.exports = require("./debug");
        exports.log = log;
        exports.formatArgs = formatArgs;
        exports.save = save;
        exports.load = load;
        exports.useColors = useColors;
        exports.storage = "undefined" != typeof chrome && "undefined" != typeof chrome.storage ? chrome.storage.local : localstorage();

        /**
         * Colors.
         */

        exports.colors = ["lightseagreen", "forestgreen", "goldenrod", "dodgerblue", "darkorchid", "crimson"];

        /**
         * Currently only WebKit-based Web Inspectors, Firefox >= v31,
         * and the Firebug extension (any Firefox version) are known
         * to support "%c" CSS customizations.
         *
         * TODO: add a `localStorage` variable to explicitly enable/disable colors
         */

        function useColors() {
          // is webkit? http://stackoverflow.com/a/16459606/376773
          return (
            "WebkitAppearance" in document.documentElement.style ||
            // is firebug? http://stackoverflow.com/a/398120/376773
            (window.console && (console.firebug || (console.exception && console.table))) ||
            // is firefox >= v31?
            // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
            (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31)
          );
        }

        /**
         * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
         */

        exports.formatters.j = function (v) {
          return JSON.stringify(v);
        };

        /**
         * Colorize log arguments if enabled.
         *
         * @api public
         */

        function formatArgs() {
          var args = arguments;
          var useColors = this.useColors;

          args[0] =
            (useColors ? "%c" : "") +
            this.namespace +
            (useColors ? " %c" : " ") +
            args[0] +
            (useColors ? "%c " : " ") +
            "+" +
            exports.humanize(this.diff);

          if (!useColors) return args;

          var c = "color: " + this.color;
          args = [args[0], c, "color: inherit"].concat(Array.prototype.slice.call(args, 1));

          // the final "%c" is somewhat tricky, because there could be other
          // arguments passed either before or after the %c, so we need to
          // figure out the correct index to insert the CSS into
          var index = 0;
          var lastC = 0;
          args[0].replace(/%[a-z%]/g, function (match) {
            if ("%%" === match) return;
            index++;
            if ("%c" === match) {
              // we only are interested in the *last* %c
              // (the user may have provided their own)
              lastC = index;
            }
          });

          args.splice(lastC, 0, c);
          return args;
        }

        /**
         * Invokes `console.log()` when available.
         * No-op when `console.log` is not a "function".
         *
         * @api public
         */

        function log() {
          // this hackery is required for IE8/9, where
          // the `console.log` function doesn't have 'apply'
          return "object" === typeof console && console.log && Function.prototype.apply.call(console.log, console, arguments);
        }

        /**
         * Save `namespaces`.
         *
         * @param {String} namespaces
         * @api private
         */

        function save(namespaces) {
          try {
            if (null == namespaces) {
              exports.storage.removeItem("debug");
            } else {
              exports.storage.debug = namespaces;
            }
          } catch (e) {}
        }

        /**
         * Load `namespaces`.
         *
         * @return {String} returns the previously persisted debug modes
         * @api private
         */

        function load() {
          var r;
          try {
            r = exports.storage.debug;
          } catch (e) {}
          return r;
        }

        /**
         * Enable namespaces listed in `localStorage.debug` initially.
         */

        exports.enable(load());

        /**
         * Localstorage attempts to return the localstorage.
         *
         * This is necessary because safari throws
         * when a user disables cookies/localstorage
         * and you attempt to access it.
         *
         * @return {LocalStorage}
         * @api private
         */

        function localstorage() {
          try {
            return window.localStorage;
          } catch (e) {}
        }
      },
      { "./debug": 39 },
    ],
    39: [
      function (require, module, exports) {
        /**
         * This is the common logic for both the Node.js and web browser
         * implementations of `debug()`.
         *
         * Expose `debug()` as the module.
         */

        exports = module.exports = debug;
        exports.coerce = coerce;
        exports.disable = disable;
        exports.enable = enable;
        exports.enabled = enabled;
        exports.humanize = require("ms");

        /**
         * The currently active debug mode names, and names to skip.
         */

        exports.names = [];
        exports.skips = [];

        /**
         * Map of special "%n" handling functions, for the debug "format" argument.
         *
         * Valid key names are a single, lowercased letter, i.e. "n".
         */

        exports.formatters = {};

        /**
         * Previously assigned color.
         */

        var prevColor = 0;

        /**
         * Previous log timestamp.
         */

        var prevTime;

        /**
         * Select a color.
         *
         * @return {Number}
         * @api private
         */

        function selectColor() {
          return exports.colors[prevColor++ % exports.colors.length];
        }

        /**
         * Create a debugger with the given `namespace`.
         *
         * @param {String} namespace
         * @return {Function}
         * @api public
         */

        function debug(namespace) {
          // define the `disabled` version
          function disabled() {}
          disabled.enabled = false;

          // define the `enabled` version
          function enabled() {
            var self = enabled;

            // set `diff` timestamp
            var curr = +new Date();
            var ms = curr - (prevTime || curr);
            self.diff = ms;
            self.prev = prevTime;
            self.curr = curr;
            prevTime = curr;

            // add the `color` if not set
            if (null == self.useColors) self.useColors = exports.useColors();
            if (null == self.color && self.useColors) self.color = selectColor();

            var args = Array.prototype.slice.call(arguments);

            args[0] = exports.coerce(args[0]);

            if ("string" !== typeof args[0]) {
              // anything else let's inspect with %o
              args = ["%o"].concat(args);
            }

            // apply any `formatters` transformations
            var index = 0;
            args[0] = args[0].replace(/%([a-z%])/g, function (match, format) {
              // if we encounter an escaped % then don't increase the array index
              if (match === "%%") return match;
              index++;
              var formatter = exports.formatters[format];
              if ("function" === typeof formatter) {
                var val = args[index];
                match = formatter.call(self, val);

                // now we need to remove `args[index]` since it's inlined in the `format`
                args.splice(index, 1);
                index--;
              }
              return match;
            });

            if ("function" === typeof exports.formatArgs) {
              args = exports.formatArgs.apply(self, args);
            }
            var logFn = enabled.log || exports.log || console.log.bind(console);
            logFn.apply(self, args);
          }
          enabled.enabled = true;

          var fn = exports.enabled(namespace) ? enabled : disabled;

          fn.namespace = namespace;

          return fn;
        }

        /**
         * Enables a debug mode by namespaces. This can include modes
         * separated by a colon and wildcards.
         *
         * @param {String} namespaces
         * @api public
         */

        function enable(namespaces) {
          exports.save(namespaces);

          var split = (namespaces || "").split(/[\s,]+/);
          var len = split.length;

          for (var i = 0; i < len; i++) {
            if (!split[i]) continue; // ignore empty strings
            namespaces = split[i].replace(/\*/g, ".*?");
            if (namespaces[0] === "-") {
              exports.skips.push(new RegExp("^" + namespaces.substr(1) + "$"));
            } else {
              exports.names.push(new RegExp("^" + namespaces + "$"));
            }
          }
        }

        /**
         * Disable debug output.
         *
         * @api public
         */

        function disable() {
          exports.enable("");
        }

        /**
         * Returns true if the given mode name is enabled, false otherwise.
         *
         * @param {String} name
         * @return {Boolean}
         * @api public
         */

        function enabled(name) {
          var i, len;
          for (i = 0, len = exports.skips.length; i < len; i++) {
            if (exports.skips[i].test(name)) {
              return false;
            }
          }
          for (i = 0, len = exports.names.length; i < len; i++) {
            if (exports.names[i].test(name)) {
              return true;
            }
          }
          return false;
        }

        /**
         * Coerce `val`.
         *
         * @param {Mixed} val
         * @return {Mixed}
         * @api private
         */

        function coerce(val) {
          if (val instanceof Error) return val.stack || val.message;
          return val;
        }
      },
      { ms: 40 },
    ],
    40: [
      function (require, module, exports) {
        /**
         * Helpers.
         */

        var s = 1000;
        var m = s * 60;
        var h = m * 60;
        var d = h * 24;
        var y = d * 365.25;

        /**
         * Parse or format the given `val`.
         *
         * Options:
         *
         *  - `long` verbose formatting [false]
         *
         * @param {String|Number} val
         * @param {Object} options
         * @return {String|Number}
         * @api public
         */

        module.exports = function (val, options) {
          options = options || {};
          if ("string" == typeof val) return parse(val);
          return options.long ? long(val) : short(val);
        };

        /**
         * Parse the given `str` and return milliseconds.
         *
         * @param {String} str
         * @return {Number}
         * @api private
         */

        function parse(str) {
          str = "" + str;
          if (str.length > 10000) return;
          var match =
            /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
              str,
            );
          if (!match) return;
          var n = parseFloat(match[1]);
          var type = (match[2] || "ms").toLowerCase();
          switch (type) {
            case "years":
            case "year":
            case "yrs":
            case "yr":
            case "y":
              return n * y;
            case "days":
            case "day":
            case "d":
              return n * d;
            case "hours":
            case "hour":
            case "hrs":
            case "hr":
            case "h":
              return n * h;
            case "minutes":
            case "minute":
            case "mins":
            case "min":
            case "m":
              return n * m;
            case "seconds":
            case "second":
            case "secs":
            case "sec":
            case "s":
              return n * s;
            case "milliseconds":
            case "millisecond":
            case "msecs":
            case "msec":
            case "ms":
              return n;
          }
        }

        /**
         * Short format for `ms`.
         *
         * @param {Number} ms
         * @return {String}
         * @api private
         */

        function short(ms) {
          if (ms >= d) return Math.round(ms / d) + "d";
          if (ms >= h) return Math.round(ms / h) + "h";
          if (ms >= m) return Math.round(ms / m) + "m";
          if (ms >= s) return Math.round(ms / s) + "s";
          return ms + "ms";
        }

        /**
         * Long format for `ms`.
         *
         * @param {Number} ms
         * @return {String}
         * @api private
         */

        function long(ms) {
          return plural(ms, d, "day") || plural(ms, h, "hour") || plural(ms, m, "minute") || plural(ms, s, "second") || ms + " ms";
        }

        /**
         * Pluralization helper.
         */

        function plural(ms, n, name) {
          if (ms < n) return;
          if (ms < n * 1.5) return Math.floor(ms / n) + " " + name;
          return Math.ceil(ms / n) + " " + name + "s";
        }
      },
      {},
    ],
    41: [
      function (require, module, exports) {
        (function (global) {
          /**
           * Module dependencies.
           */

          var keys = require("./keys");
          var hasBinary = require("has-binary");
          var sliceBuffer = require("arraybuffer.slice");
          var base64encoder = require("base64-arraybuffer");
          var after = require("after");
          var utf8 = require("utf8");

          /**
           * Check if we are running an android browser. That requires us to use
           * ArrayBuffer with polling transports...
           *
           * http://ghinda.net/jpeg-blob-ajax-android/
           */

          var isAndroid = navigator.userAgent.match(/Android/i);

          /**
           * Check if we are running in PhantomJS.
           * Uploading a Blob with PhantomJS does not work correctly, as reported here:
           * https://github.com/ariya/phantomjs/issues/11395
           * @type boolean
           */
          var isPhantomJS = /PhantomJS/i.test(navigator.userAgent);

          /**
           * When true, avoids using Blobs to encode payloads.
           * @type boolean
           */
          var dontSendBlobs = isAndroid || isPhantomJS;

          /**
           * Current protocol version.
           */

          exports.protocol = 3;

          /**
           * Packet types.
           */

          var packets = (exports.packets = {
            open: 0, // non-ws
            close: 1, // non-ws
            ping: 2,
            pong: 3,
            message: 4,
            upgrade: 5,
            noop: 6,
          });

          var packetslist = keys(packets);

          /**
           * Premade error packet.
           */

          var err = { type: "error", data: "parser error" };

          /**
           * Create a blob api even for blob builder when vendor prefixes exist
           */

          var Blob = require("blob");

          /**
           * Encodes a packet.
           *
           *     <packet type id> [ <data> ]
           *
           * Example:
           *
           *     5hello world
           *     3
           *     4
           *
           * Binary is encoded in an identical principle
           *
           * @api private
           */

          exports.encodePacket = function (packet, supportsBinary, utf8encode, callback) {
            if ("function" == typeof supportsBinary) {
              callback = supportsBinary;
              supportsBinary = false;
            }

            if ("function" == typeof utf8encode) {
              callback = utf8encode;
              utf8encode = null;
            }

            var data = packet.data === undefined ? undefined : packet.data.buffer || packet.data;

            if (global.ArrayBuffer && data instanceof ArrayBuffer) {
              return encodeArrayBuffer(packet, supportsBinary, callback);
            } else if (Blob && data instanceof global.Blob) {
              return encodeBlob(packet, supportsBinary, callback);
            }

            // might be an object with { base64: true, data: dataAsBase64String }
            if (data && data.base64) {
              return encodeBase64Object(packet, callback);
            }

            // Sending data as a utf-8 string
            var encoded = packets[packet.type];

            // data fragment is optional
            if (undefined !== packet.data) {
              encoded += utf8encode ? utf8.encode(String(packet.data)) : String(packet.data);
            }

            return callback("" + encoded);
          };

          function encodeBase64Object(packet, callback) {
            // packet data is an object { base64: true, data: dataAsBase64String }
            var message = "b" + exports.packets[packet.type] + packet.data.data;
            return callback(message);
          }

          /**
           * Encode packet helpers for binary types
           */

          function encodeArrayBuffer(packet, supportsBinary, callback) {
            if (!supportsBinary) {
              return exports.encodeBase64Packet(packet, callback);
            }

            var data = packet.data;
            var contentArray = new Uint8Array(data);
            var resultBuffer = new Uint8Array(1 + data.byteLength);

            resultBuffer[0] = packets[packet.type];
            for (var i = 0; i < contentArray.length; i++) {
              resultBuffer[i + 1] = contentArray[i];
            }

            return callback(resultBuffer.buffer);
          }

          function encodeBlobAsArrayBuffer(packet, supportsBinary, callback) {
            if (!supportsBinary) {
              return exports.encodeBase64Packet(packet, callback);
            }

            var fr = new FileReader();
            fr.onload = function () {
              packet.data = fr.result;
              exports.encodePacket(packet, supportsBinary, true, callback);
            };
            return fr.readAsArrayBuffer(packet.data);
          }

          function encodeBlob(packet, supportsBinary, callback) {
            if (!supportsBinary) {
              return exports.encodeBase64Packet(packet, callback);
            }

            if (dontSendBlobs) {
              return encodeBlobAsArrayBuffer(packet, supportsBinary, callback);
            }

            var length = new Uint8Array(1);
            length[0] = packets[packet.type];
            var blob = new Blob([length.buffer, packet.data]);

            return callback(blob);
          }

          /**
           * Encodes a packet with binary data in a base64 string
           *
           * @param {Object} packet, has `type` and `data`
           * @return {String} base64 encoded message
           */

          exports.encodeBase64Packet = function (packet, callback) {
            var message = "b" + exports.packets[packet.type];
            if (Blob && packet.data instanceof global.Blob) {
              var fr = new FileReader();
              fr.onload = function () {
                var b64 = fr.result.split(",")[1];
                callback(message + b64);
              };
              return fr.readAsDataURL(packet.data);
            }

            var b64data;
            try {
              b64data = String.fromCharCode.apply(null, new Uint8Array(packet.data));
            } catch (e) {
              // iPhone Safari doesn't let you apply with typed arrays
              var typed = new Uint8Array(packet.data);
              var basic = new Array(typed.length);
              for (var i = 0; i < typed.length; i++) {
                basic[i] = typed[i];
              }
              b64data = String.fromCharCode.apply(null, basic);
            }
            message += global.btoa(b64data);
            return callback(message);
          };

          /**
           * Decodes a packet. Changes format to Blob if requested.
           *
           * @return {Object} with `type` and `data` (if any)
           * @api private
           */

          exports.decodePacket = function (data, binaryType, utf8decode) {
            // String data
            if (typeof data == "string" || data === undefined) {
              if (data.charAt(0) == "b") {
                return exports.decodeBase64Packet(data.substr(1), binaryType);
              }

              if (utf8decode) {
                try {
                  data = utf8.decode(data);
                } catch (e) {
                  return err;
                }
              }
              var type = data.charAt(0);

              if (Number(type) != type || !packetslist[type]) {
                return err;
              }

              if (data.length > 1) {
                return { type: packetslist[type], data: data.substring(1) };
              } else {
                return { type: packetslist[type] };
              }
            }

            var asArray = new Uint8Array(data);
            var type = asArray[0];
            var rest = sliceBuffer(data, 1);
            if (Blob && binaryType === "blob") {
              rest = new Blob([rest]);
            }
            return { type: packetslist[type], data: rest };
          };

          /**
           * Decodes a packet encoded in a base64 string
           *
           * @param {String} base64 encoded message
           * @return {Object} with `type` and `data` (if any)
           */

          exports.decodeBase64Packet = function (msg, binaryType) {
            var type = packetslist[msg.charAt(0)];
            if (!global.ArrayBuffer) {
              return { type: type, data: { base64: true, data: msg.substr(1) } };
            }

            var data = base64encoder.decode(msg.substr(1));

            if (binaryType === "blob" && Blob) {
              data = new Blob([data]);
            }

            return { type: type, data: data };
          };

          /**
           * Encodes multiple messages (payload).
           *
           *     <length>:data
           *
           * Example:
           *
           *     11:hello world2:hi
           *
           * If any contents are binary, they will be encoded as base64 strings. Base64
           * encoded strings are marked with a b before the length specifier
           *
           * @param {Array} packets
           * @api private
           */

          exports.encodePayload = function (packets, supportsBinary, callback) {
            if (typeof supportsBinary == "function") {
              callback = supportsBinary;
              supportsBinary = null;
            }

            var isBinary = hasBinary(packets);

            if (supportsBinary && isBinary) {
              if (Blob && !dontSendBlobs) {
                return exports.encodePayloadAsBlob(packets, callback);
              }

              return exports.encodePayloadAsArrayBuffer(packets, callback);
            }

            if (!packets.length) {
              return callback("0:");
            }

            function setLengthHeader(message) {
              return message.length + ":" + message;
            }

            function encodeOne(packet, doneCallback) {
              exports.encodePacket(packet, !isBinary ? false : supportsBinary, true, function (message) {
                doneCallback(null, setLengthHeader(message));
              });
            }

            map(packets, encodeOne, function (err, results) {
              return callback(results.join(""));
            });
          };

          /**
           * Async array map using after
           */

          function map(ary, each, done) {
            var result = new Array(ary.length);
            var next = after(ary.length, done);

            var eachWithIndex = function (i, el, cb) {
              each(el, function (error, msg) {
                result[i] = msg;
                cb(error, result);
              });
            };

            for (var i = 0; i < ary.length; i++) {
              eachWithIndex(i, ary[i], next);
            }
          }

          /*
           * Decodes data when a payload is maybe expected. Possible binary contents are
           * decoded from their base64 representation
           *
           * @param {String} data, callback method
           * @api public
           */

          exports.decodePayload = function (data, binaryType, callback) {
            if (typeof data != "string") {
              return exports.decodePayloadAsBinary(data, binaryType, callback);
            }

            if (typeof binaryType === "function") {
              callback = binaryType;
              binaryType = null;
            }

            var packet;
            if (data == "") {
              // parser error - ignoring payload
              return callback(err, 0, 1);
            }

            var length = "",
              n,
              msg;

            for (var i = 0, l = data.length; i < l; i++) {
              var chr = data.charAt(i);

              if (":" != chr) {
                length += chr;
              } else {
                if ("" == length || length != (n = Number(length))) {
                  // parser error - ignoring payload
                  return callback(err, 0, 1);
                }

                msg = data.substr(i + 1, n);

                if (length != msg.length) {
                  // parser error - ignoring payload
                  return callback(err, 0, 1);
                }

                if (msg.length) {
                  packet = exports.decodePacket(msg, binaryType, true);

                  if (err.type == packet.type && err.data == packet.data) {
                    // parser error in individual packet - ignoring payload
                    return callback(err, 0, 1);
                  }

                  var ret = callback(packet, i + n, l);
                  if (false === ret) return;
                }

                // advance cursor
                i += n;
                length = "";
              }
            }

            if (length != "") {
              // parser error - ignoring payload
              return callback(err, 0, 1);
            }
          };

          /**
           * Encodes multiple messages (payload) as binary.
           *
           * <1 = binary, 0 = string><number from 0-9><number from 0-9>[...]<number
           * 255><data>
           *
           * Example:
           * 1 3 255 1 2 3, if the binary contents are interpreted as 8 bit integers
           *
           * @param {Array} packets
           * @return {ArrayBuffer} encoded payload
           * @api private
           */

          exports.encodePayloadAsArrayBuffer = function (packets, callback) {
            if (!packets.length) {
              return callback(new ArrayBuffer(0));
            }

            function encodeOne(packet, doneCallback) {
              exports.encodePacket(packet, true, true, function (data) {
                return doneCallback(null, data);
              });
            }

            map(packets, encodeOne, function (err, encodedPackets) {
              var totalLength = encodedPackets.reduce(function (acc, p) {
                var len;
                if (typeof p === "string") {
                  len = p.length;
                } else {
                  len = p.byteLength;
                }
                return acc + len.toString().length + len + 2; // string/binary identifier + separator = 2
              }, 0);

              var resultArray = new Uint8Array(totalLength);

              var bufferIndex = 0;
              encodedPackets.forEach(function (p) {
                var isString = typeof p === "string";
                var ab = p;
                if (isString) {
                  var view = new Uint8Array(p.length);
                  for (var i = 0; i < p.length; i++) {
                    view[i] = p.charCodeAt(i);
                  }
                  ab = view.buffer;
                }

                if (isString) {
                  // not true binary
                  resultArray[bufferIndex++] = 0;
                } else {
                  // true binary
                  resultArray[bufferIndex++] = 1;
                }

                var lenStr = ab.byteLength.toString();
                for (var i = 0; i < lenStr.length; i++) {
                  resultArray[bufferIndex++] = parseInt(lenStr[i]);
                }
                resultArray[bufferIndex++] = 255;

                var view = new Uint8Array(ab);
                for (var i = 0; i < view.length; i++) {
                  resultArray[bufferIndex++] = view[i];
                }
              });

              return callback(resultArray.buffer);
            });
          };

          /**
           * Encode as Blob
           */

          exports.encodePayloadAsBlob = function (packets, callback) {
            function encodeOne(packet, doneCallback) {
              exports.encodePacket(packet, true, true, function (encoded) {
                var binaryIdentifier = new Uint8Array(1);
                binaryIdentifier[0] = 1;
                if (typeof encoded === "string") {
                  var view = new Uint8Array(encoded.length);
                  for (var i = 0; i < encoded.length; i++) {
                    view[i] = encoded.charCodeAt(i);
                  }
                  encoded = view.buffer;
                  binaryIdentifier[0] = 0;
                }

                var len = encoded instanceof ArrayBuffer ? encoded.byteLength : encoded.size;

                var lenStr = len.toString();
                var lengthAry = new Uint8Array(lenStr.length + 1);
                for (var i = 0; i < lenStr.length; i++) {
                  lengthAry[i] = parseInt(lenStr[i]);
                }
                lengthAry[lenStr.length] = 255;

                if (Blob) {
                  var blob = new Blob([binaryIdentifier.buffer, lengthAry.buffer, encoded]);
                  doneCallback(null, blob);
                }
              });
            }

            map(packets, encodeOne, function (err, results) {
              return callback(new Blob(results));
            });
          };

          /*
           * Decodes data when a payload is maybe expected. Strings are decoded by
           * interpreting each byte as a key code for entries marked to start with 0. See
           * description of encodePayloadAsBinary
           *
           * @param {ArrayBuffer} data, callback method
           * @api public
           */

          exports.decodePayloadAsBinary = function (data, binaryType, callback) {
            if (typeof binaryType === "function") {
              callback = binaryType;
              binaryType = null;
            }

            var bufferTail = data;
            var buffers = [];

            var numberTooLong = false;
            while (bufferTail.byteLength > 0) {
              var tailArray = new Uint8Array(bufferTail);
              var isString = tailArray[0] === 0;
              var msgLength = "";

              for (var i = 1; ; i++) {
                if (tailArray[i] == 255) break;

                if (msgLength.length > 310) {
                  numberTooLong = true;
                  break;
                }

                msgLength += tailArray[i];
              }

              if (numberTooLong) return callback(err, 0, 1);

              bufferTail = sliceBuffer(bufferTail, 2 + msgLength.length);
              msgLength = parseInt(msgLength);

              var msg = sliceBuffer(bufferTail, 0, msgLength);
              if (isString) {
                try {
                  msg = String.fromCharCode.apply(null, new Uint8Array(msg));
                } catch (e) {
                  // iPhone Safari doesn't let you apply to typed arrays
                  var typed = new Uint8Array(msg);
                  msg = "";
                  for (var i = 0; i < typed.length; i++) {
                    msg += String.fromCharCode(typed[i]);
                  }
                }
              }

              buffers.push(msg);
              bufferTail = sliceBuffer(bufferTail, msgLength);
            }

            var total = buffers.length;
            buffers.forEach(function (buffer, i) {
              callback(exports.decodePacket(buffer, binaryType, true), i, total);
            });
          };
        }).call(
          this,
          typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},
        );
      },
      { "./keys": 42, after: 43, "arraybuffer.slice": 44, "base64-arraybuffer": 45, blob: 46, "has-binary": 47, utf8: 49 },
    ],
    42: [
      function (require, module, exports) {
        /**
         * Gets the keys for an object.
         *
         * @return {Array} keys
         * @api private
         */

        module.exports =
          Object.keys ||
          function keys(obj) {
            var arr = [];
            var has = Object.prototype.hasOwnProperty;

            for (var i in obj) {
              if (has.call(obj, i)) {
                arr.push(i);
              }
            }
            return arr;
          };
      },
      {},
    ],
    43: [
      function (require, module, exports) {
        module.exports = after;

        function after(count, callback, err_cb) {
          var bail = false;
          err_cb = err_cb || noop;
          proxy.count = count;

          return count === 0 ? callback() : proxy;

          function proxy(err, result) {
            if (proxy.count <= 0) {
              throw new Error("after called too many times");
            }
            --proxy.count;

            // after first error, rest are passed to err_cb
            if (err) {
              bail = true;
              callback(err);
              // future error callbacks will go to error handler
              callback = err_cb;
            } else if (proxy.count === 0 && !bail) {
              callback(null, result);
            }
          }
        }

        function noop() {}
      },
      {},
    ],
    44: [
      function (require, module, exports) {
        /**
         * An abstraction for slicing an arraybuffer even when
         * ArrayBuffer.prototype.slice is not supported
         *
         * @api public
         */

        module.exports = function (arraybuffer, start, end) {
          var bytes = arraybuffer.byteLength;
          start = start || 0;
          end = end || bytes;

          if (arraybuffer.slice) {
            return arraybuffer.slice(start, end);
          }

          if (start < 0) {
            start += bytes;
          }
          if (end < 0) {
            end += bytes;
          }
          if (end > bytes) {
            end = bytes;
          }

          if (start >= bytes || start >= end || bytes === 0) {
            return new ArrayBuffer(0);
          }

          var abv = new Uint8Array(arraybuffer);
          var result = new Uint8Array(end - start);
          for (var i = start, ii = 0; i < end; i++, ii++) {
            result[ii] = abv[i];
          }
          return result.buffer;
        };
      },
      {},
    ],
    45: [
      function (require, module, exports) {
        /*
         * base64-arraybuffer
         * https://github.com/niklasvh/base64-arraybuffer
         *
         * Copyright (c) 2012 Niklas von Hertzen
         * Licensed under the MIT license.
         */
        (function (chars) {
          exports.encode = function (arraybuffer) {
            var bytes = new Uint8Array(arraybuffer),
              i,
              len = bytes.length,
              base64 = "";

            for (i = 0; i < len; i += 3) {
              base64 += chars[bytes[i] >> 2];
              base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
              base64 += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
              base64 += chars[bytes[i + 2] & 63];
            }

            if (len % 3 === 2) {
              base64 = base64.substring(0, base64.length - 1) + "=";
            } else if (len % 3 === 1) {
              base64 = base64.substring(0, base64.length - 2) + "==";
            }

            return base64;
          };

          exports.decode = function (base64) {
            var bufferLength = base64.length * 0.75,
              len = base64.length,
              i,
              p = 0,
              encoded1,
              encoded2,
              encoded3,
              encoded4;

            if (base64[base64.length - 1] === "=") {
              bufferLength--;
              if (base64[base64.length - 2] === "=") {
                bufferLength--;
              }
            }

            var arraybuffer = new ArrayBuffer(bufferLength),
              bytes = new Uint8Array(arraybuffer);

            for (i = 0; i < len; i += 4) {
              encoded1 = chars.indexOf(base64[i]);
              encoded2 = chars.indexOf(base64[i + 1]);
              encoded3 = chars.indexOf(base64[i + 2]);
              encoded4 = chars.indexOf(base64[i + 3]);

              bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
              bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
              bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
            }

            return arraybuffer;
          };
        })("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");
      },
      {},
    ],
    46: [
      function (require, module, exports) {
        (function (global) {
          /**
           * Create a blob builder even when vendor prefixes exist
           */

          var BlobBuilder = global.BlobBuilder || global.WebKitBlobBuilder || global.MSBlobBuilder || global.MozBlobBuilder;

          /**
           * Check if Blob constructor is supported
           */

          var blobSupported = (function () {
            try {
              var a = new Blob(["hi"]);
              return a.size === 2;
            } catch (e) {
              return false;
            }
          })();

          /**
           * Check if Blob constructor supports ArrayBufferViews
           * Fails in Safari 6, so we need to map to ArrayBuffers there.
           */

          var blobSupportsArrayBufferView =
            blobSupported &&
            (function () {
              try {
                var b = new Blob([new Uint8Array([1, 2])]);
                return b.size === 2;
              } catch (e) {
                return false;
              }
            })();

          /**
           * Check if BlobBuilder is supported
           */

          var blobBuilderSupported = BlobBuilder && BlobBuilder.prototype.append && BlobBuilder.prototype.getBlob;

          /**
           * Helper function that maps ArrayBufferViews to ArrayBuffers
           * Used by BlobBuilder constructor and old browsers that didn't
           * support it in the Blob constructor.
           */

          function mapArrayBufferViews(ary) {
            for (var i = 0; i < ary.length; i++) {
              var chunk = ary[i];
              if (chunk.buffer instanceof ArrayBuffer) {
                var buf = chunk.buffer;

                // if this is a subarray, make a copy so we only
                // include the subarray region from the underlying buffer
                if (chunk.byteLength !== buf.byteLength) {
                  var copy = new Uint8Array(chunk.byteLength);
                  copy.set(new Uint8Array(buf, chunk.byteOffset, chunk.byteLength));
                  buf = copy.buffer;
                }

                ary[i] = buf;
              }
            }
          }

          function BlobBuilderConstructor(ary, options) {
            options = options || {};

            var bb = new BlobBuilder();
            mapArrayBufferViews(ary);

            for (var i = 0; i < ary.length; i++) {
              bb.append(ary[i]);
            }

            return options.type ? bb.getBlob(options.type) : bb.getBlob();
          }

          function BlobConstructor(ary, options) {
            mapArrayBufferViews(ary);
            return new Blob(ary, options || {});
          }

          module.exports = (function () {
            if (blobSupported) {
              return blobSupportsArrayBufferView ? global.Blob : BlobConstructor;
            } else if (blobBuilderSupported) {
              return BlobBuilderConstructor;
            } else {
              return undefined;
            }
          })();
        }).call(
          this,
          typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},
        );
      },
      {},
    ],
    47: [
      function (require, module, exports) {
        (function (global) {
          /*
           * Module requirements.
           */

          var isArray = require("isarray");

          /**
           * Module exports.
           */

          module.exports = hasBinary;

          /**
           * Checks for binary data.
           *
           * Right now only Buffer and ArrayBuffer are supported..
           *
           * @param {Object} anything
           * @api public
           */

          function hasBinary(data) {
            function _hasBinary(obj) {
              if (!obj) return false;

              if (
                (global.Buffer && global.Buffer.isBuffer(obj)) ||
                (global.ArrayBuffer && obj instanceof ArrayBuffer) ||
                (global.Blob && obj instanceof Blob) ||
                (global.File && obj instanceof File)
              ) {
                return true;
              }

              if (isArray(obj)) {
                for (var i = 0; i < obj.length; i++) {
                  if (_hasBinary(obj[i])) {
                    return true;
                  }
                }
              } else if (obj && "object" == typeof obj) {
                if (obj.toJSON) {
                  obj = obj.toJSON();
                }

                for (var key in obj) {
                  if (Object.prototype.hasOwnProperty.call(obj, key) && _hasBinary(obj[key])) {
                    return true;
                  }
                }
              }

              return false;
            }

            return _hasBinary(data);
          }
        }).call(
          this,
          typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},
        );
      },
      { isarray: 48 },
    ],
    48: [
      function (require, module, exports) {
        module.exports =
          Array.isArray ||
          function (arr) {
            return Object.prototype.toString.call(arr) == "[object Array]";
          };
      },
      {},
    ],
    49: [
      function (require, module, exports) {
        (function (global) {
          /*! https://mths.be/utf8js v2.0.0 by @mathias */
          (function (root) {
            // Detect free variables `exports`
            var freeExports = typeof exports == "object" && exports;

            // Detect free variable `module`
            var freeModule = typeof module == "object" && module && module.exports == freeExports && module;

            // Detect free variable `global`, from Node.js or Browserified code,
            // and use it as `root`
            var freeGlobal = typeof global == "object" && global;
            if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
              root = freeGlobal;
            }

            /*--------------------------------------------------------------------------*/

            var stringFromCharCode = String.fromCharCode;

            // Taken from https://mths.be/punycode
            function ucs2decode(string) {
              var output = [];
              var counter = 0;
              var length = string.length;
              var value;
              var extra;
              while (counter < length) {
                value = string.charCodeAt(counter++);
                if (value >= 0xd800 && value <= 0xdbff && counter < length) {
                  // high surrogate, and there is a next character
                  extra = string.charCodeAt(counter++);
                  if ((extra & 0xfc00) == 0xdc00) {
                    // low surrogate
                    output.push(((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000);
                  } else {
                    // unmatched surrogate; only append this code unit, in case the next
                    // code unit is the high surrogate of a surrogate pair
                    output.push(value);
                    counter--;
                  }
                } else {
                  output.push(value);
                }
              }
              return output;
            }

            // Taken from https://mths.be/punycode
            function ucs2encode(array) {
              var length = array.length;
              var index = -1;
              var value;
              var output = "";
              while (++index < length) {
                value = array[index];
                if (value > 0xffff) {
                  value -= 0x10000;
                  output += stringFromCharCode(((value >>> 10) & 0x3ff) | 0xd800);
                  value = 0xdc00 | (value & 0x3ff);
                }
                output += stringFromCharCode(value);
              }
              return output;
            }

            function checkScalarValue(codePoint) {
              if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
                throw Error("Lone surrogate U+" + codePoint.toString(16).toUpperCase() + " is not a scalar value");
              }
            }
            /*--------------------------------------------------------------------------*/

            function createByte(codePoint, shift) {
              return stringFromCharCode(((codePoint >> shift) & 0x3f) | 0x80);
            }

            function encodeCodePoint(codePoint) {
              if ((codePoint & 0xffffff80) == 0) {
                // 1-byte sequence
                return stringFromCharCode(codePoint);
              }
              var symbol = "";
              if ((codePoint & 0xfffff800) == 0) {
                // 2-byte sequence
                symbol = stringFromCharCode(((codePoint >> 6) & 0x1f) | 0xc0);
              } else if ((codePoint & 0xffff0000) == 0) {
                // 3-byte sequence
                checkScalarValue(codePoint);
                symbol = stringFromCharCode(((codePoint >> 12) & 0x0f) | 0xe0);
                symbol += createByte(codePoint, 6);
              } else if ((codePoint & 0xffe00000) == 0) {
                // 4-byte sequence
                symbol = stringFromCharCode(((codePoint >> 18) & 0x07) | 0xf0);
                symbol += createByte(codePoint, 12);
                symbol += createByte(codePoint, 6);
              }
              symbol += stringFromCharCode((codePoint & 0x3f) | 0x80);
              return symbol;
            }

            function utf8encode(string) {
              var codePoints = ucs2decode(string);
              var length = codePoints.length;
              var index = -1;
              var codePoint;
              var byteString = "";
              while (++index < length) {
                codePoint = codePoints[index];
                byteString += encodeCodePoint(codePoint);
              }
              return byteString;
            }

            /*--------------------------------------------------------------------------*/

            function readContinuationByte() {
              if (byteIndex >= byteCount) {
                throw Error("Invalid byte index");
              }

              var continuationByte = byteArray[byteIndex] & 0xff;
              byteIndex++;

              if ((continuationByte & 0xc0) == 0x80) {
                return continuationByte & 0x3f;
              }

              // If we end up here, it’s not a continuation byte
              throw Error("Invalid continuation byte");
            }

            function decodeSymbol() {
              var byte1;
              var byte2;
              var byte3;
              var byte4;
              var codePoint;

              if (byteIndex > byteCount) {
                throw Error("Invalid byte index");
              }

              if (byteIndex == byteCount) {
                return false;
              }

              // Read first byte
              byte1 = byteArray[byteIndex] & 0xff;
              byteIndex++;

              // 1-byte sequence (no continuation bytes)
              if ((byte1 & 0x80) == 0) {
                return byte1;
              }

              // 2-byte sequence
              if ((byte1 & 0xe0) == 0xc0) {
                var byte2 = readContinuationByte();
                codePoint = ((byte1 & 0x1f) << 6) | byte2;
                if (codePoint >= 0x80) {
                  return codePoint;
                } else {
                  throw Error("Invalid continuation byte");
                }
              }

              // 3-byte sequence (may include unpaired surrogates)
              if ((byte1 & 0xf0) == 0xe0) {
                byte2 = readContinuationByte();
                byte3 = readContinuationByte();
                codePoint = ((byte1 & 0x0f) << 12) | (byte2 << 6) | byte3;
                if (codePoint >= 0x0800) {
                  checkScalarValue(codePoint);
                  return codePoint;
                } else {
                  throw Error("Invalid continuation byte");
                }
              }

              // 4-byte sequence
              if ((byte1 & 0xf8) == 0xf0) {
                byte2 = readContinuationByte();
                byte3 = readContinuationByte();
                byte4 = readContinuationByte();
                codePoint = ((byte1 & 0x0f) << 0x12) | (byte2 << 0x0c) | (byte3 << 0x06) | byte4;
                if (codePoint >= 0x010000 && codePoint <= 0x10ffff) {
                  return codePoint;
                }
              }

              throw Error("Invalid UTF-8 detected");
            }

            var byteArray;
            var byteCount;
            var byteIndex;
            function utf8decode(byteString) {
              byteArray = ucs2decode(byteString);
              byteCount = byteArray.length;
              byteIndex = 0;
              var codePoints = [];
              var tmp;
              while ((tmp = decodeSymbol()) !== false) {
                codePoints.push(tmp);
              }
              return ucs2encode(codePoints);
            }

            /*--------------------------------------------------------------------------*/

            var utf8 = {
              version: "2.0.0",
              encode: utf8encode,
              decode: utf8decode,
            };

            // Some AMD build optimizers, like r.js, check for specific condition patterns
            // like the following:
            if (typeof define == "function" && typeof define.amd == "object" && define.amd) {
              define(function () {
                return utf8;
              });
            } else if (freeExports && !freeExports.nodeType) {
              if (freeModule) {
                // in Node.js or RingoJS v0.8.0+
                freeModule.exports = utf8;
              } else {
                // in Narwhal or RingoJS v0.7.0-
                var object = {};
                var hasOwnProperty = object.hasOwnProperty;
                for (var key in utf8) {
                  hasOwnProperty.call(utf8, key) && (freeExports[key] = utf8[key]);
                }
              }
            } else {
              // in Rhino or a web browser
              root.utf8 = utf8;
            }
          })(this);
        }).call(
          this,
          typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},
        );
      },
      {},
    ],
    50: [
      function (require, module, exports) {
        /**
         * Module exports.
         *
         * Logic borrowed from Modernizr:
         *
         *   - https://github.com/Modernizr/Modernizr/blob/master/feature-detects/cors.js
         */

        try {
          module.exports = typeof XMLHttpRequest !== "undefined" && "withCredentials" in new XMLHttpRequest();
        } catch (err) {
          // if XMLHttp support is disabled in IE then it will throw
          // when trying to create
          module.exports = false;
        }
      },
      {},
    ],
    51: [
      function (require, module, exports) {
        var indexOf = [].indexOf;

        module.exports = function (arr, obj) {
          if (indexOf) return arr.indexOf(obj);
          for (var i = 0; i < arr.length; ++i) {
            if (arr[i] === obj) return i;
          }
          return -1;
        };
      },
      {},
    ],
    52: [
      function (require, module, exports) {
        (function (global) {
          /**
           * JSON parse.
           *
           * @see Based on jQuery#parseJSON (MIT) and JSON2
           * @api private
           */

          var rvalidchars = /^[\],:{}\s]*$/;
          var rvalidescape = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g;
          var rvalidtokens = /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g;
          var rvalidbraces = /(?:^|:|,)(?:\s*\[)+/g;
          var rtrimLeft = /^\s+/;
          var rtrimRight = /\s+$/;

          module.exports = function parsejson(data) {
            if ("string" != typeof data || !data) {
              return null;
            }

            data = data.replace(rtrimLeft, "").replace(rtrimRight, "");

            // Attempt to parse using the native JSON parser first
            if (global.JSON && JSON.parse) {
              return JSON.parse(data);
            }

            if (rvalidchars.test(data.replace(rvalidescape, "@").replace(rvalidtokens, "]").replace(rvalidbraces, ""))) {
              return new Function("return " + data)();
            }
          };
        }).call(
          this,
          typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},
        );
      },
      {},
    ],
    53: [
      function (require, module, exports) {
        /**
         * Compiles a querystring
         * Returns string representation of the object
         *
         * @param {Object}
         * @api private
         */

        exports.encode = function (obj) {
          var str = "";

          for (var i in obj) {
            if (obj.hasOwnProperty(i)) {
              if (str.length) str += "&";
              str += encodeURIComponent(i) + "=" + encodeURIComponent(obj[i]);
            }
          }

          return str;
        };

        /**
         * Parses a simple querystring into an object
         *
         * @param {String} qs
         * @api private
         */

        exports.decode = function (qs) {
          var qry = {};
          var pairs = qs.split("&");
          for (var i = 0, l = pairs.length; i < l; i++) {
            var pair = pairs[i].split("=");
            qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
          }
          return qry;
        };
      },
      {},
    ],
    54: [
      function (require, module, exports) {
        /**
         * Parses an URI
         *
         * @author Steven Levithan <stevenlevithan.com> (MIT license)
         * @api private
         */

        var re =
          /^(?:(?![^:@]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;

        var parts = [
          "source",
          "protocol",
          "authority",
          "userInfo",
          "user",
          "password",
          "host",
          "port",
          "relative",
          "path",
          "directory",
          "file",
          "query",
          "anchor",
        ];

        module.exports = function parseuri(str) {
          var src = str,
            b = str.indexOf("["),
            e = str.indexOf("]");

          if (b != -1 && e != -1) {
            str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ";") + str.substring(e, str.length);
          }

          var m = re.exec(str || ""),
            uri = {},
            i = 14;

          while (i--) {
            uri[parts[i]] = m[i] || "";
          }

          if (b != -1 && e != -1) {
            uri.source = src;
            uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ":");
            uri.authority = uri.authority.replace("[", "").replace("]", "").replace(/;/g, ":");
            uri.ipv6uri = true;
          }

          return uri;
        };
      },
      {},
    ],
    55: [
      function (require, module, exports) {
        "use strict";

        var alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_".split(""),
          length = 64,
          map = {},
          seed = 0,
          i = 0,
          prev;

        /**
         * Return a string representing the specified number.
         *
         * @param {Number} num The number to convert.
         * @returns {String} The string representation of the number.
         * @api public
         */
        function encode(num) {
          var encoded = "";

          do {
            encoded = alphabet[num % length] + encoded;
            num = Math.floor(num / length);
          } while (num > 0);

          return encoded;
        }

        /**
         * Return the integer value specified by the given string.
         *
         * @param {String} str The string to convert.
         * @returns {Number} The integer value represented by the string.
         * @api public
         */
        function decode(str) {
          var decoded = 0;

          for (i = 0; i < str.length; i++) {
            decoded = decoded * length + map[str.charAt(i)];
          }

          return decoded;
        }

        /**
         * Yeast: A tiny growing id generator.
         *
         * @returns {String} A unique id.
         * @api public
         */
        function yeast() {
          var now = encode(+new Date());

          if (now !== prev) return ((seed = 0), (prev = now));
          return now + "." + encode(seed++);
        }

        //
        // Map each character to its index.
        //
        for (; i < length; i++) map[alphabet[i]] = i;

        //
        // Expose the `yeast`, `encode` and `decode` functions.
        //
        yeast.encode = encode;
        yeast.decode = decode;
        module.exports = yeast;
      },
      {},
    ],
  },
  {},
  [1],
);
