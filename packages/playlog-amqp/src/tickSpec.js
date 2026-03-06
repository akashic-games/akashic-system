var amqp = require("amqplib");
var playlog = require("@akashic/playlog");
var amflowMessage = require("@akashic/amflow-message");
var playlogAMQP = require("../lib");

describe("Tick", function () {
  var conn;
  var ch;
  var playId = "100";

  beforeAll(function (done) {
    amqp
      .connect()
      .then(function (_conn) {
        conn = _conn;
        return conn.createChannel();
      })
      .then(function (_ch) {
        ch = _ch;
        return new playlogAMQP.Tick(ch).assertExchange(playId);
      })
      .then(done, done.fail);
  });

  afterAll(function (done) {
    new playlogAMQP.Tick(ch)
      .deleteExchange(playId)
      .then(function () {
        return ch.close();
      })
      .then(function () {
        return conn.close();
      })
      .then(done, done.fail);
  });

  it("should publish/subscribe a message", function (done) {
    var playId = "100";
    var publisher = new playlogAMQP.Tick(ch);
    var subscriber = new playlogAMQP.Tick(ch);
    var consumerTag;

    subscriber
      .consume(playId, function (err, message) {
        expect(err).toBeFalsy();
        expect(message[0]).toBe(1);
        ch.cancel(consumerTag).then(done, done.fail);
      })
      .then(function (ok) {
        consumerTag = ok.consumerTag;
        publisher.publish(playId, [1]);
      })
      .catch(done.fail);
  });

  it("should publish/subscribe a raw message", function (done) {
    var playId = "100";
    var buf = amflowMessage.encodeTick([1]);
    var publisher = new playlogAMQP.Tick(ch);
    var subscriber = new playlogAMQP.Tick(ch);
    var consumerTag;

    subscriber
      .consumeRaw(playId, function (content) {
        expect(content.equals(buf)).toBe(true);
        ch.cancel(consumerTag).then(done, done.fail);
      })
      .then(function (ok) {
        consumerTag = ok.consumerTag;
        publisher.publishRaw(playId, buf);
      })
      .catch(done.fail);
  });

  it("should consume all messages", function (done) {
    var playId = "100";
    var publisher = new playlogAMQP.Tick(ch);
    var subscriber = new playlogAMQP.Tick(ch);
    var consumerTag;
    var i = 0;

    subscriber
      .consume(playId, function (err, message) {
        expect(err).toBeFalsy();
        expect(message[0]).toBe(i++);
        if (i === 3) {
          ch.cancel(consumerTag).then(done, done.fail);
        }
      })
      .then(function (ok) {
        consumerTag = ok.consumerTag;
        publisher.publish(playId, [0]);
        publisher.publish(playId, [1]);
        publisher.publish(playId, [2]);
      })
      .catch(done.fail);
  });

  it("should subscribe a same message on multiple queues", function (done) {
    var playId = "100";
    var publisher = new playlogAMQP.Tick(ch);
    var subscribers = [new playlogAMQP.Tick(ch), new playlogAMQP.Tick(ch), new playlogAMQP.Tick(ch)];
    var i = 0;

    Promise.all(subscribers.map(consume))
      .then(function () {
        publisher.publish(playId, [1]);
      })
      .catch(done.fail);

    function consume(subscriber) {
      var consumerTag;
      return subscriber
        .consume(playId, function (err, message) {
          expect(err).toBeFalsy();
          expect(message[0]).toBe(1);
          ch.cancel(consumerTag).then(callback, done.fail);
        })
        .then(function (ok) {
          consumerTag = ok.consumerTag;
        });
    }

    function callback() {
      if (i++ === subscribers.length - 1) done();
    }
  });

  it("should not subscribe different playId", function (done) {
    var publisher = new playlogAMQP.Tick(ch);
    var subscriber = new playlogAMQP.Tick(ch);

    subscriber
      .assertExchange("101")
      .then(function () {
        return subscriber.consume("101", done.fail);
      })
      .then(function (ok) {
        publisher.publish("100", [1]);

        // wait for possible callback call
        setTimeout(function () {
          publisher.deleteExchange("101").then(function () {
            ch.cancel(ok.consumerTag).then(done, done.fail);
          });
        }, 500);
      })
      .catch(done.fail);
  });

  it("check exchange and reattach channel", function (done) {
    var playId = "203";
    var publisher = new playlogAMQP.Tick(ch);
    var caught = false;
    ch.once("error", function (e) {
      conn.createChannel().then(function (_ch) {
        ch = _ch;
        publisher.attach(ch);
        publisher
          .assertExchange(playId)
          .then(function () {
            return publisher.checkExchange(playId);
          })
          .then(function () {
            return publisher.deleteExchange(playId);
          })
          .then(function () {
            expect(caught).toBe(true);
            done();
          })
          .catch(done.fail);
      });
    });
    publisher
      .checkExchange(playId)
      .then(done.fail)
      .catch(function () {
        caught = true;
      });
  });
});
