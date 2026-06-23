// Copyright 2026 The ungoogled-chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {sendWithPromise} from 'chrome://resources/js/cr.js';

function removeSubscription(element) {
  var td = element.parentNode;
  chrome.send("brave_adblock.deleteSubscription", [
    td.nextSibling.firstElementChild.value,
  ]);
}
function updateSubscription(element) {
  var tr = element.parentNode.parentNode;
  var td = tr.firstElementChild.nextSibling;
  chrome.send("brave_adblock.refreshSubscription", [
    td.firstElementChild.value,
  ]);
}
function removeScriptlet(element) {
  var url = element.parentNode.nextSibling.firstElementChild.value;
  sendWithPromise('brave_adblock.removeCustomScriptlet', url).then((code) => {
    console.log("removal status: " + code);
    if (code == 0) {
      var tr = element.parentNode.parentNode;
      tr.parentNode.removeChild(tr);
    }
  });
}
function addSubscription() {
  chrome.send("brave_adblock.submitNewSubscription", [
    document.getElementById("newSubscription").value,
  ]);
  document.getElementById("newSubscription").value = "";
}
function saveFilters() {
  chrome.send("brave_adblock.updateCustomFilters", [
    document.getElementById("customFilters").value,
  ]);
}
function addScriptletToTable(scriptlet) {
  var tr = document.createElement("tr");
  var td_button = tr.appendChild(document.createElement("td"));
  var td_name = tr.appendChild(document.createElement("td"));
  var td_base64 = tr.appendChild(document.createElement("td"));
  var button = td_button.appendChild(document.createElement("button"));
  button.addEventListener("click", (event) => {
      removeScriptlet(event.currentTarget);
  });
  button.classList = "remove"
  button.innerText = "X";
  var area_name = td_name.appendChild(document.createElement("textarea"));
  var area_base64 = td_base64.appendChild(document.createElement("textarea"));
  area_name.disabled = true;
  area_base64.disabled = true;
  var element = document.getElementById('customScriptlets').firstElementChild;
  element.insertBefore(tr, element.lastElementChild.nextSibling);

  area_name.value = scriptlet.name;
  area_base64.value = scriptlet.content;
}
// WARNING: Trying to do this in parallel breaks the import process.
// That's why this is a recursive function XD.
function importScriptlet(index) {
  const total = document.getElementById("files").files.length;
  if (index >= total)
    return;

  const file = document.getElementById("files").files[index];
  const name = file.name;
  const reader = new FileReader();
  reader.onload = function(e) {
    var dict = {
      name: name,
      kind: {
        mime: 'application/javascript'
      },
      content: btoa(e.target.result),
    };
    sendWithPromise("brave_adblock.addCustomScriptlet", dict).then((code) => {
      console.log("import status: " + code);
      if (code != 0)
        return;
      addScriptletToTable(dict);
      importScriptlet(index + 1);
    });
  }
  reader.readAsBinaryString(file);
}

function onGetCustomFilters(customFilters) {
  console.log("received custom filters");
  var element = document.getElementById('customFilters');
  element.value = customFilters;
}

function onGetListSubscriptions(listSubscriptions) {
  console.log("received subscriptions");
  var element = document.getElementById('subscriptions').firstElementChild;
  while (element.childElementCount > 1) {
    element.removeChild(element.lastChild);
  }
  for (const subscription of listSubscriptions) {
    var tr = document.createElement("tr");
    var td_button = tr.appendChild(document.createElement("td"));
    var td_url = tr.appendChild(document.createElement("td"));
    var td_att_upd = tr.appendChild(document.createElement("td"));
    var td_updated = tr.appendChild(document.createElement("td"));
    var td_controls = tr.appendChild(document.createElement("td"));

    var button = td_button.appendChild(document.createElement("button"));

    button.addEventListener("click", (event) => {
        removeSubscription(event.currentTarget);
    });
    button.classList = "remove"
    button.innerText = "X";

    var ar_url = td_url.appendChild(document.createElement("textarea"));
    var ar_att_upd = td_att_upd.appendChild(document.createElement("textarea"));
    var ar_updated = td_updated.appendChild(document.createElement("textarea"));
    ar_url.disabled = true;
    ar_att_upd.disabled = true;
    ar_updated.disabled = true;

    ar_url.value = subscription["subscription_url"];
    ar_att_upd.value = subscription["last_update_attempt"];
    ar_updated.value = subscription["last_successful_update_attempt"];

    var update_btn = td_controls.appendChild(document.createElement("button"));

    update_btn.addEventListener("click", (event) => {
        updateSubscription(event.currentTarget);
    });
    update_btn.classList = "remove"
    update_btn.innerText = "Update";

    element.insertBefore(tr, element.lastElementChild.nextSibling);
  }
}

document.getElementById("applySub").addEventListener("click", addSubscription);
document.getElementById("applyFilters").addEventListener("click", saveFilters);
document.getElementById("importButton").addEventListener("click", () => {
  importScriptlet(0);
  event.currentTarget.value = [];
});

window.brave_adblock = {
  onGetCustomFilters,
  onGetListSubscriptions,
};

// Calling these will eventually magically invoke the above functions.
chrome.send('brave_adblock.getCustomFilters');
chrome.send('brave_adblock.getListSubscriptions');

sendWithPromise('brave_adblock.getCustomScriptlets').then((scriptlets) => {
  console.log("received scriptlets");
  var element = document.getElementById('customScriptlets').firstElementChild;
  while (element.childElementCount > 1) {
    element.removeChild(element.lastChild);
  }
  for (const scriptlet of scriptlets) {
    addScriptletToTable(scriptlet);
  }
});
