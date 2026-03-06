const path = require("path");
const shell = require("shelljs");

shell.config.fatal = true;

shell.ls("./build/src/front/*.js").forEach(function (file) {
  const basename = path.basename(file);
  shell.exec(`browserify ${file} -o ./public/js/${basename} --standalone client --debug`);
});
