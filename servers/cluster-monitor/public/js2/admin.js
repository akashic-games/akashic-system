var api = function (method, url, result) {
  var xhr = new XMLHttpRequest();
  xhr.open(method, url, true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        if (result) {
          var data = JSON.parse(xhr.responseText).data.data;
          var blob = new Blob([data], { type: "text/plain" });
          if (window.navigator.msSaveBlob) {
            window.navigator.msSaveBlob(blob, "playlog.txt");
          } else {
            var a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.target = "_blank";
            a.download = "playlog.txt";
            a.click();
          }
          console.info(data);
        } else {
          location.reload();
        }
      } else {
        console.error(xhr.responseText);
        alert("error");
      }
    }
  };
  xhr.send(null);
};

instance_stop_onclick = function (id) {
  api("GET", "/api/delete/instances/" + id);
  return false;
};

play_stop_onclick = function (id) {
  api("GET", "/api/delete/plays/" + id);
  return false;
};

play_start_onclick = function (id) {
  api("GET", "/api/start/plays/" + id);
  return false;
};

play_playlog_onclick = function (id) {
  api("GET", "/api/playlog/" + id, true);
  return false;
};

add_exclude_playlog_onclick = function (trait, id) {
  api("POST", "/api/exclude/playlog/" + trait + "/" + encodeURIComponent(id));
  return false;
};

remove_exclude_playlog_onclick = function (trait, id) {
  api("DELETE", "/api/exclude/playlog/" + trait + "/" + encodeURIComponent(id));
  return false;
};

standby_process_onclick = function (processId) {
  api("POST", "/api/exclude/processes/" + encodeURIComponent(processId));
  return false;
};

start_process_onclick = function (processId) {
  api("DELETE", "/api/exclude/processes/" + encodeURIComponent(processId));
  return false;
};
