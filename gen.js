// The are taken from here:
// https://github.com/gorhill/uBlock/wiki/Resources-Library
const scriptlets = [
    "abort-current-script",
    "acs",
    "abort-current-inline-script",
    "acis",
    "abort-on-property-read",
    "aopr",
    "abort-on-property-write",
    "aopw",
    "abort-on-stack-trace",
    "aost",
    "addEventListener-defuser",
    "aeld",
    "prevent-addEventListener",
    "trusted-click-element",
    "set-constant",
    "set",
    "trusted-set-constant",
    "trusted-set",
    "trusted-suppress-native-method",
    "trusted-override-element-method",
    "trusted-prevent-dom-bypass",
    "set-cookie",
    "trusted-set-cookie",
    "remove-cookie",
    "cookie-remover",
    "set-local-storage-item",
    "set-session-storage-item",
    "trusted-set-local-storage-item",
    "trusted-set-session-storage-item",
    "remove-cache-storage-item",
    "call-nothrow",
    "prevent-setInterval",
    "no-setInterval-if",
    "nosiif",
    "setInterval-defuser",
    "prevent-setTimeout",
    "no-setTimeout-if",
    "nostif",
    "setTimeout-defuser",
    "adjust-setInterval",
    "nano-setInterval-booster",
    "nano-sib",
    "adjust-setTimeout",
    "nano-setTimeout-booster",
    "nano-stb",
    "trusted-create-HTML",
    "prevent-innerHTML",
    "prevent-xhr",
    "no-xhr-if",
    "trusted-prevent-xhr",
    "prevent-fetch",
    "no-fetch-if",
    "trusted-prevent-fetch",
    "trusted-replace-xhr-response",
    "trusted-replace-fetch-response",
    "trusted-rpfr",
    "trusted-replace-argument",
    "set-attr",
    "trusted-set-attr",
    "remove-attr",
    "ra",
    "remove-class",
    "rc",
    "remove-node-text",
    "rmnt",
    "trusted-replace-node-text",
    "trusted-rpnt",
    "replace-node-text",
    "rpnt",
    "trusted-replace-outbound-text",
    "trusted-rpot",
    "spoof-css",
    "prevent-canvas",
    "href-sanitizer",
    "disable-newtab-links",
    "close-window",
    "window-close-if",
    "prevent-window-open",
    "nowoif",
    "no-window-open-if",
    "window.open-defuser",
    "object-prune",
    "trusted-prune-inbound-object",
    "trusted-prune-outbound-object",
    "json-prune",
    "json-prune-fetch-response",
    "json-prune-xhr-response",
    "evaldata-prune",
    "xml-prune",
    "m3u-prune",
    "noeval",
    "noeval-silent",
    "noeval-if",
    "prevent-eval-if",
    "no-floc",
    "prevent-requestAnimationFrame",
    "no-requestAnimationFrame-if",
    "norafif",
    "nowebrtc",
    "webrtc-if",
    "window.name-defuser",
    "prevent-refresh",
    "refresh-defuser",
    "overlay-buster",
    "alert-buster",
];

// Scriptlets that should be equivalent but aren't internally mapped.
// This creates a bit of duplication, but all the scriptlets combined
// take up less than 1MB (unminified), so it's not a huge deal.
const remap = {
    // Trivial replacements
    "ra": "remove-attr",
    "rc": "remove-class",
    "rmnt": "remove-node-text",
    "acis": "abort-current-inline-script",
    "aopr": "abort-on-property-read",
    "aopw": "abort-on-property-write",
    "aost": "abort-on-stack-trace",
    "aeld": "prevent-addEventListener",
    "set": "set-constant",
    "trusted-rpfr": "trusted-replace-fetch-response",
    "trusted-rpnt": "trusted-replace-node-text",
    "trusted-rpot": "trusted-replace-outbound-text",

    //"abort-current-script": "abort-current-inline-script",
    //"acs": "abort-current-inline-script",
    "addEventListener-defuser": "prevent-addEventListener",
    "no-fetch-if": "prevent-fetch",
    "trusted-set": "trusted-set-constant",
    "cookie-remover": "remove-cookie",
    "no-setInterval-if": "prevent-setInterval",
    "nosiif": "prevent-setInterval",
    "no-setTimeout-if": "prevent-setTimeout",
    "nostif": "prevent-setTimeout",
    "setTimeout-defuser": "prevent-setTimeout",
    "setInterval-defuser": "prevent-setInterval",
    "nano-setInterval-booster": "adjust-setInterval",
    "nano-sib": "adjust-setInterval",
    "no-xhr-if": "prevent-xhr",
    "nano-setTimeout-booster": "adjust-setTimeout",
    "nano-stb": "adjust-setTimeout",
    "window-close-if": "close-window",
    "no-window-open-if": "prevent-window-open",
    "nowoif": "prevent-window-open",
    "window.open-defuser": "prevent-window-open",
    "no-requestAnimationFrame-if": "prevent-requestAnimationFrame",
    "norafif": "prevent-requestAnimationFrame",
};

let mod = await import("./index.js")
const fs = await import ("fs")

const regex = /function\s+(.*)\(/

var counter = 0;

function getSrc(scriptlet) {
    return mod.scriptlets.getScriptletFunction(scriptlet).toString()
}

for (let scriptlet of scriptlets) {
    try {
        var str = getSrc(scriptlet);
    } catch(e) {
        try {
            var str = getSrc(remap[scriptlet]);
        } catch(e2) {
            console.log("WARNING: Not implemented: " + scriptlet);
            continue;
        }
    }
    var func_name = str.split("\n")[0].match(regex)[1];
    var src = "var SRCOBJ = {name: \"" + scriptlet + "\", args: args, engine: \"corelibs\", version: \"1.0.0\"};\n";
    // The name of the function doesn't really matter. The engine just picks up
    // whatever that happens to be and it doesn't have to match the name of the scriptlet.
    var str = "function scriptlet" + counter + "(...args) {\n" + str + "\n" + src + func_name + "(SRCOBJ, args);\n}\n"
    fs.writeFileSync("scriptlets/" + scriptlet + ".js", str);
    ++counter;
}
