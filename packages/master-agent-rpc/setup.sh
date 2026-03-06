#!/bin/bash

set -eux

echo "start build thrift"

pushd ext_libs/thrift
./bootstrap.sh
./configure --disable-libs --disable-tests --disable-tutorial
make
make install
popd
echo "finish build thrift"
