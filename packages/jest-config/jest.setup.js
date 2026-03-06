// mongodbのドライバ内部でperformanceを使用しており、jestではperformanceを使えないので、performanceを使えるようにするスクリプト
global.performance = require("perf_hooks").performance;
