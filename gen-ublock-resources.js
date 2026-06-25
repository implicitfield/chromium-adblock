import path from 'path/posix'
import * as fs from 'fs'

const uBlockLocalRoot = process.argv[2];
const output = process.argv[3];

const uBlockWebAccessibleResources = path.join(uBlockLocalRoot, 'src/web_accessible_resources')
const uBlockRedirectEngine = path.join(uBlockLocalRoot, 'src/js/redirect-resources.js')
const uBlockScriptlets = path.join(uBlockLocalRoot, 'src/js/resources/scriptlets.js')

const { builtinScriptlets } = await import(uBlockScriptlets)
const redirectResources = await import(uBlockRedirectEngine)

const generateResources = () => {
  // Confirm all required dependencies exist
  const dependencyMap = builtinScriptlets.reduce((map, entry) => {
    map.set(entry.name, entry)
    return map
  }, new Map())
  for (const [depName, entry] of dependencyMap.entries()) {
    for (const recursiveDep of entry.dependencies ?? []) {
      if (!dependencyMap.has(recursiveDep)) {
        const warning = `uBO scriptlet ${depName} is missing dependency ${recursiveDep.name}`
        console.log(warning)
        process.exit(1);
      }
    }
  }

  const transformedUboBuiltins = builtinScriptlets.map(s => {
    const dependencies = s.dependencies ?? []
    const content = Buffer.from(s.fn.toString()).toString('base64')
    return {
      name: s.name,
      aliases: s.aliases ?? [],
      kind: { mime: 'application/javascript' },
      content,
      dependencies
    }
  })

  let transformedRedirectResources = [];
  for (let [key, value] of redirectResources.default) {
    const extension = key.split('.').pop();
    var mime;
    switch (extension) {
      case 'css':
        mime = "text/css"
        break;
      case 'empty':
        // FIXME: Should this be "text/plain", since it's data type
        // in uBlockRedirectEngine is "text"? This is currently
        // like this because this matches adblock-rust's bundler.
        mime = "application/octet-stream";
        break;
      case 'gif':
        mime = "image/gif"
        break;
      case 'html':
        mime = "text/html"
        break;
      case 'js':
        mime = "application/javascript"
        break;
      case 'mp3':
        mime = "audio/mp3"
        break;
      case 'mp4':
        mime = "video/mp4"
        break;
      case 'png':
        mime = "image/png"
        break;
      case 'json':
        mime = "application/json";
        break;
      case 'txt':
        mime = "text/plain";
        break;
      case 'xml':
        mime = "text/xml";
        break;
      default:
        console.log("ERROR: Unknown extension: " + extension + " (" + key + ")");
        process.exit(1);
    }
    const resourcePath = path.join(uBlockWebAccessibleResources, key);
    var content;
    // This list matches the one in build_resource_from_file_contents
    // in adblock-rust.
    if (mime == "text/html" || mime == "application/javascript" || mime == "text/plain") {
      content = Buffer.from(fs.readFileSync(resourcePath, "utf8").replace("\r", "")).toString('base64');
    } else {
      content = fs.readFileSync(resourcePath).toString('base64');
    }
    transformedRedirectResources.push({
        name: key,
        aliases: value.aliases ?? [],
        kind: { mime: mime },
        content,
        dependecies: [],
    });
  }

  return JSON.stringify(transformedUboBuiltins.concat(transformedRedirectResources))
}

fs.writeFileSync(output, generateResources(), 'utf8');
