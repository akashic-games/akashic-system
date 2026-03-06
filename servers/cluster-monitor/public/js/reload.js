"use strict";

const reload = () => {
  location.reload();
  setTimeout(reload, 1000 * 60);
};
setTimeout(reload, 1000 * 60);
