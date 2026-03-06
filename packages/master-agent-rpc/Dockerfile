FROM node:20-slim

# install thrift on local
RUN apt-get update -y \
	&& apt-get install -y build-essential bison flex git libtool automake pkg-config curl

ADD . /home/master-agent-rpc
WORKDIR /home/master-agent-rpc

RUN /bin/bash setup.sh

# output thrift generated code to mounted volume
RUN mkdir /home/master-agent-rpc/output
VOLUME ["/home/master-agent-rpc/output"]
CMD ["sh", "-c", "thrift -out output --gen ts:node thrift/*"]
