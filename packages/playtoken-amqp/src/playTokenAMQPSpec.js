var amqp = require("amqplib");
var playTokenAMQP = require("../lib");
var PlayTokenAMQP = playTokenAMQP.PlayTokenAMQP;
var EventType = playTokenAMQP.EventType;

describe("PlayTokenAMQP", function () {
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 10 * 1000;

  var conn;
  var ch;

  beforeAll(function (done) {
    amqp
      .connect()
      .then(function (_conn) {
        conn = _conn;
        return conn.createChannel();
      })
      .then(function (_ch) {
        ch = _ch;
        return new PlayTokenAMQP(ch).assertExchange();
      })
      .then(done, done.fail);
  });

  afterAll(function (done) {
    ch.close()
      .then(function () {
        return conn.close();
      })
      .then(done, done.fail);
  });

  it("should publish/subscribe a message of revoke-event", function (done) {
    var playId = "100";
    var publisher = new PlayTokenAMQP(ch);
    var subscriber = new PlayTokenAMQP(ch);
    var consumerTag;

    subscriber
      .consume(function (err, type, token, ack) {
        expect(err).toBeFalsy();
        expect(type).toBe(EventType.Revoke);
        expect(token.id).toBe("1");
        expect(token.playId).toBeFalsy();
        expect(token.userId).toBeFalsy();
        ack();
        ch.cancel(consumerTag).then(done, done.fail);
      })
      .then(function (ok) {
        consumerTag = ok.consumerTag;
        publisher.publish(EventType.Revoke, { id: "1" });
      })
      .catch(done.fail);
  });

  it("should publish/subscribe a message of update-permission-event", function (done) {
    var playId = "100";
    var updatedPermission = {
      writeTick: false,
      readTick: true,
      subscribeTick: true,
      sendEvent: false,
      subscribeEvent: true,
      maxEventPriority: 3,
    };
    var publisher = new PlayTokenAMQP(ch);
    var subscriber = new PlayTokenAMQP(ch);
    var consumerTag;

    subscriber
      .consume(function (err, type, token, ack) {
        expect(err).toBeFalsy();
        expect(type).toBe(EventType.UpdatePermission);
        expect(token.id).toBeFalsy();
        expect(token.playId).toBe("1");
        expect(token.userId).toBe("2");
        expect(token.permission).toEqual(updatedPermission);
        ack();
        ch.cancel(consumerTag).then(done, done.fail);
      })
      .then(function (ok) {
        consumerTag = ok.consumerTag;
        publisher.publish(EventType.UpdatePermission, { playId: "1", userId: "2", permission: updatedPermission });
      })
      .catch(done.fail);
  });

  it("should publish/subscribe a raw message", function (done) {
    var playId = "100";
    var buf = new Buffer(JSON.stringify({ id: "1" }));
    var publisher = new PlayTokenAMQP(ch);
    var subscriber = new PlayTokenAMQP(ch);
    var consumerTag;

    subscriber
      .consumeRaw(function (type, content, ack) {
        expect(type).toBe(EventType.Revoke);
        expect(content.equals(buf)).toBe(true);
        ack();
        ch.cancel(consumerTag).then(done, done.fail);
      })
      .then(function (ok) {
        consumerTag = ok.consumerTag;
        publisher.publishRaw(EventType.Revoke, buf);
      })
      .catch(done.fail);
  });

  it("should consume all messages", function (done) {
    var playId = "100";
    var publisher = new PlayTokenAMQP(ch);
    var subscriber = new PlayTokenAMQP(ch);
    var consumerTag;
    var tokens = [
      { userId: "1" },
      { playId: "1" },
      { id: "2" },
      { userId: "1", playId: "1" },
      { id: "2", playId: "1" },
      { id: "2", userId: "1" },
      { id: "2", playId: "1", userId: "1" },
    ];
    var results = [];

    subscriber
      .consume(function (err, type, token, ack) {
        expect(err).toBeFalsy();
        results.push({ type: type, token: token });
        ack();

        if (results.length < tokens.length) return;

        results.forEach(function (r, i) {
          expect(r.type).toBe(EventType.Revoke);
          expect(r.token.id).toBe(tokens[i].id);
          expect(r.token.playId).toBe(tokens[i].playId);
          expect(r.token.userId).toBe(tokens[i].userId);
        });
        ch.cancel(consumerTag).then(done, done.fail);
      })
      .then(function (ok) {
        consumerTag = ok.consumerTag;
        tokens.forEach(function (token) {
          publisher.publish(EventType.Revoke, token);
        });
      })
      .catch(done.fail);
  });

  it("should subscribe a same message on multiple queues", function (done) {
    var playId = "100";
    var publisher = new PlayTokenAMQP(ch);
    var subscribers = [new PlayTokenAMQP(ch), new PlayTokenAMQP(ch), new PlayTokenAMQP(ch)];
    var i = 0;

    Promise.all(subscribers.map(consume))
      .then(function () {
        publisher.publish(EventType.Revoke, { id: "1" });
      })
      .catch(done.fail);

    function consume(subscriber) {
      var consumerTag;
      return subscriber
        .consume(function (err, type, token) {
          expect(err).toBeFalsy();
          expect(type).toBe(EventType.Revoke);
          expect(token.id).toBe("1");
          expect(token.playId).toBeFalsy();
          expect(token.userId).toBeFalsy();
          ch.cancel(consumerTag).then(callback, done.fail);
        })
        .then(function (ok) {
          consumerTag = ok.consumerTag;
        });
    }

    function callback() {
      if (++i === subscribers.length) done();
    }
  });

  it("should reconsume when error", function (done) {
    var playId = "100";
    var publisher = new PlayTokenAMQP(ch);
    var subscriber = new PlayTokenAMQP(ch);
    var consumerTag;
    var i = 0;

    subscriber
      .consume(function (err, type, token, ack) {
        expect(err).toBeFalsy();
        expect(type).toBe(EventType.Revoke);
        expect(token.id).toBe("1");
        expect(token.playId).toBeFalsy();
        expect(token.userId).toBeFalsy();
        if (i++ < 2) {
          ack(new Error());
          return;
        }

        ack();
        ch.cancel(consumerTag).then(done, done.fail);
      })
      .then(function (ok) {
        consumerTag = ok.consumerTag;
        publisher.publish(EventType.Revoke, { id: "1" });
      })
      .catch(done.fail);
  });
});
