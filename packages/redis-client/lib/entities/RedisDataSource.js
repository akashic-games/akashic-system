"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function isRedisDataSource(obj) {
    return obj.host && obj.port;
}
exports.isRedisDataSource = isRedisDataSource;
function isRedisClusterDataSource(obj) {
    return obj.hasOwnProperty("hosts") && Array.isArray(obj.hosts);
}
exports.isRedisClusterDataSource = isRedisClusterDataSource;
