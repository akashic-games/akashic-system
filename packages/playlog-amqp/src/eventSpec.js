var amqp = require("amqplib");
var playlog = require("@akashic/playlog");
var amflowMessage = require("@akashic/amflow-message");
var playlogAMQP = require("../lib");

describe("Event", function () {
  var conn;
  var ch;

  function createDataEvent(priority, data) {
    return [0x20, priority, "tom", data];
  }

  function assertExchangeAndQueue(playId) {
    var client = new playlogAMQP.Event(ch);
    return client.assertExchange(playId).then(function () {
      return client.assertQueue(playId);
    });
  }

  function deleteExchangeAndQueue(playId) {
    var client = new playlogAMQP.Event(ch);
    return client.deleteQueue(playId).then(function () {
      return client.deleteExchange(playId);
    });
  }

  beforeAll(function (done) {
    amqp
      .connect()
      .then(function (_conn) {
        conn = _conn;
        return conn.createChannel();
      })
      .then(function (_ch) {
        ch = _ch;
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

  it("should publish/subscribe an event", function (done) {
    var playId = "100";
    var publisher = new playlogAMQP.Event(ch);
    var subscriber = new playlogAMQP.Event(ch);
    var consumerTag;

    assertExchangeAndQueue(playId)
      .then(function () {
        return subscriber.consume(playId, function (err, ev, ack) {
          expect(err).toBeFalsy();
          expect(ev[3]).toBe("foo");
          ack();
          deleteExchangeAndQueue(playId)
            .then(function () {
              return ch.cancel(consumerTag);
            })
            .then(done, done.fail);
        });
      })
      .then(function (ok) {
        consumerTag = ok.consumerTag;
        publisher.publish(playId, createDataEvent(3, "foo")); // DataEvent
      })
      .catch(done.fail);
  });

  it("should publish/subscribe a raw data", function (done) {
    var playId = "100";
    var buf = amflowMessage.encodeEvent(createDataEvent(3, "foo"));
    var publisher = new playlogAMQP.Event(ch);
    var subscriber = new playlogAMQP.Event(ch);
    var consumerTag;

    assertExchangeAndQueue(playId)
      .then(function () {
        return subscriber.consumeRaw(playId, function (content, ack) {
          expect(content.equals(buf)).toBe(true);
          ack();
          deleteExchangeAndQueue(playId)
            .then(function () {
              return ch.cancel(consumerTag);
            })
            .then(done, done.fail);
        });
      })
      .then(function (ok) {
        consumerTag = ok.consumerTag;
        publisher.publishRaw(playId, buf);
      })
      .catch(done.fail);
  });

  it("should consume all events", function (done) {
    var playId = "100";
    var publisher = new playlogAMQP.Event(ch);
    var subscriber = new playlogAMQP.Event(ch);
    var consumerTag;
    var i = 0;

    assertExchangeAndQueue(playId)
      .then(function () {
        return subscriber.consume(playId, function (err, ev, ack) {
          expect(err).toBeFalsy();
          expect(ev[3]).toBe(i);
          ack();
          var isLast = i === 2;
          if (isLast) {
            deleteExchangeAndQueue(playId)
              .then(function () {
                return ch.cancel(consumerTag);
              })
              .then(done, done.fail);
          }
          i++;
        });
      })
      .then(function (ok) {
        consumerTag = ok.consumerTag;
        publisher.publish(playId, createDataEvent(3, 0));
        publisher.publish(playId, createDataEvent(3, 1));
        publisher.publish(playId, createDataEvent(3, 2));
      })
      .catch(done.fail);
  });

  it("should subscribe a same event on multiple queues in round-robin", function (done) {
    var playId = "100";
    var publisher = new playlogAMQP.Event(ch);
    var subscribers = [new playlogAMQP.Event(ch), new playlogAMQP.Event(ch), new playlogAMQP.Event(ch)];
    var i = 0;

    assertExchangeAndQueue(playId)
      .then(function () {
        return Promise.all(subscribers.map(consume));
      })
      .then(function () {
        for (var j = 0; j < subscribers.length; j++) {
          publisher.publish(playId, createDataEvent(3, "foo"));
        }
      })
      .catch(done.fail);

    function consume(subscriber) {
      var consumerTag;
      return subscriber
        .consume(playId, function (err, ev, ack) {
          expect(err).toBeFalsy();
          expect(ev[3]).toBe("foo");
          ack();
          ch.cancel(consumerTag).then(callback).catch(done.fail);
        })
        .then(function (ok) {
          consumerTag = ok.consumerTag;
        });
    }

    function callback() {
      if (i++ === subscribers.length - 1) {
        deleteExchangeAndQueue(playId).then(done, done.fail);
      }
    }
  });

  it("should not subscribe different playId", function (done) {
    var publisher = new playlogAMQP.Event(ch);
    var subscriber = new playlogAMQP.Event(ch);
    var consumerTag;

    assertExchangeAndQueue("101")
      .then(function () {
        return subscriber.consume("101", done.fail);
      })
      .then(function (ok) {
        consumerTag = ok.consumerTag;
        return assertExchangeAndQueue("100");
      })
      .then(function () {
        return publisher.publish("100", createDataEvent(3, "foo"));
      })
      .then(function () {
        // wait for possible callback call
        setTimeout(function () {
          deleteExchangeAndQueue("100")
            .then(function () {
              return deleteExchangeAndQueue("101");
            })
            .then(function () {
              return ch.cancel(consumerTag);
            })
            .then(done, done.fail);
        }, 500);
      })
      .catch(done.fail);
  });

  it("should not consume expired events", function (done) {
    var playId = "100";
    var publisher = new playlogAMQP.Event(ch);
    var subscriber = new playlogAMQP.Event(ch);
    var consumerTag;

    assertExchangeAndQueue(playId)
      .then(function () {
        publisher.publish(playId, createDataEvent(0, 0));
        publisher.publish(playId, createDataEvent(1, 1));
        publisher.publish(playId, createDataEvent(2, 2));
        publisher.publish(playId, createDataEvent(3, 3));
        setTimeout(function () {
          subscriber
            .consume(playId, function (err, ev, ack) {
              expect(err).toBeFalsy();
              expect(ev[3]).toBe(3);
              ack();
              deleteExchangeAndQueue(playId)
                .then(function () {
                  return ch.cancel(consumerTag);
                })
                .then(done, done.fail);
            })
            .then(function (ok) {
              consumerTag = ok.consumerTag;
            });
        }, 1200);
      })
      .catch(done.fail);
  });

  it("should consume high-priority events prior to low-priority events", function (done) {
    var playId = "100";
    var publisher = new playlogAMQP.Event(ch);
    var subscriber = new playlogAMQP.Event(ch);
    var consumerTag;
    var i = 3;

    assertExchangeAndQueue(playId)
      .then(function () {
        publisher.publish(playId, createDataEvent(0, 0));
        publisher.publish(playId, createDataEvent(1, 1));
        publisher.publish(playId, createDataEvent(2, 2));
        publisher.publish(playId, createDataEvent(3, 3));
        setTimeout(function () {
          subscriber
            .consume(playId, function (err, ev, ack) {
              expect(err).toBeFalsy();
              expect(ev[3]).toBe(i);
              ack();
              var isLast = i === 0;
              if (isLast) {
                deleteExchangeAndQueue(playId)
                  .then(function () {
                    return ch.cancel(consumerTag);
                  })
                  .then(done, done.fail);
              }
              i--;
            })
            .then(function (ok) {
              consumerTag = ok.consumerTag;
            });
        }, 200);
      })
      .catch(done.fail);
  });

  it("delete exchange and queue", function (done) {
    var playId = "202";
    var publisher = new playlogAMQP.Event(ch);
    var eName = publisher._createExchangeName(playId);
    var qName = publisher._createQueueName(playId);
    publisher
      .assertExchange(playId)
      .then(function () {
        return publisher.assertQueue(playId);
      })
      .then(function () {
        return ch.checkQueue(qName);
      })
      .then(function (res) {
        expect(res.queue).toBe(qName);
        return ch.checkExchange(eName);
      })
      .then(function (res) {
        return publisher.deleteExchange(playId);
      })
      .then(function () {
        return publisher.deleteQueue(playId);
      })
      .then(function () {
        // ch.on("error")した上でch.checkQueueで例外が飛ぶことを確認したいが、ch.on("error")してると何故かテストが終わらないのでチェックしない
        done();
      })
      .catch(done.fail);
  });

  it("check exchange and reattach channel", function (done) {
    var playId = "203";
    var publisher = new playlogAMQP.Event(ch);
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

  it("check queue and reattach channel", function (done) {
    var playId = "203";
    var publisher = new playlogAMQP.Event(ch);
    var caught = false;
    ch.once("error", function (e) {
      conn.createChannel().then(function (_ch) {
        ch = _ch;
        publisher.attach(ch);
        publisher
          .assertQueue(playId)
          .then(function () {
            return publisher.checkQueue(playId);
          })
          .then(function () {
            return publisher.deleteQueue(playId);
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
      .assertExchange(playId)
      .then(function () {
        return publisher.checkQueue(playId);
      })
      .then(function () {
        return publisher.deleteExchange(playId);
      })
      .then(done.fail)
      .catch(function () {
        caught = true;
      });
  });
});
