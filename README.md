# chromium-adblock

Yet another set of sources and patches for integrating adblock functionality in Chromium.

## About

This is just a demonstration at this point, may contain bugs, vulnerabilities, etc.

Most of this is sourced from `brave-core`, though much of this has been heavily modified.
This means:
- No exemptions for first-party content
- No limitations on the naming of custom scriptlets
- Cname uncloaking is always enabled
- No builtin filters or scriptlets
- No additional connections are made by default

This currently targets version `149.0.7827.155` of Chromium.

## License

MPL-2.0

## Building

First, copy all the new files into your Chromium source tree:

```sh
$ cd src
## use coreutils cp, which is probably just cp instead on most Linux distributions
$ find . -type f -exec gcp --parents {} /path/to/source/tree \;
```

Then apply `core.patch`:
```sh
$ patch -p1 -d /path/to/source/tree < core.patch
```

Then get new creates and reconfigure old ones. Note that this requires connecting to `crates.io`:
```sh
## this file is missing for some reason
$ echo '{"files":{}}' > third_party/rust/chromium_crates_io/vendor/hex-v0_4/.cargo-checksum.json
## this only contains partial sources? re-vendor it
rm -rf third_party/rust/chromium_crates_io/vendor/semver-v1
## you likely also need to provide --rust-sysroot if you use an unbundled rust toolchain
RUST_BOOTSTRAP=1 python3 ./tools/crates/run_gnrt.py vendor
# run this with gn in the path, also add --rust-sysroot here if needed
RUST_BOOTSTRAP=1 PATH=$PATH:$PWD/out/Default python3 ./tools/crates/run_gnrt.py gen
```

Then build as usual.

### Dev notes

NOTE: if the `adblock` create's `BUILD.gn` contains `testonly = true`, then you'll need to find
at least one relevant dependency in `third_party/rust/chromium_crates_io/gnrt_config.toml`
that has `group = 'test'`. Remove those group specifiers from relevant dependencies,
and `gnrt gen` should no longer mark the create as `testonly`.

This is currently handled in `core.patch`, but might be useful information when updating this.

For other problems, `docs/rust/build_errors_guide.md` in the Chromium source tree is quite useful.

Also fixes might have already been made in `brave-core`, so check against that
repository's versions of `gnrt_config.toml` and `Cargo.toml`.

## Configuring the adblocker

Custom filters, subscriptions and scriptlets can be configured at `chrome://adblock`.
I'd recommend adding at least the following subscriptions (one-by-one, also note that the last two rely on scriptlets):
```
https://easylist.to/easylist/easylist.txt
https://github.com/uBlockOrigin/uAssets/raw/refs/heads/master/filters/filters.txt
https://github.com/uBlockOrigin/uAssets/raw/refs/heads/master/filters/quick-fixes.txt
```

## Sourcing the scriptlets

The scriptlets need to either be IIFEs, or functions of the form:
```
function someName(arg1, arg2, arg3, etc)
(crucially, this also works):
function someName(...args)
```

AFAIK no existing library comes distributed like this out of the box, so the `gen.js` script is provided to adapt adguard's scriptlets into the above form.
You can either build those yourself from `https://github.com/AdguardTeam/Scriptlets`, or you can get the built bundle from any random CDN:
```sh
$ curl -O 'https://cdn.jsdelivr.net/npm/@adguard/scriptlets@2.4.2/dist/scriptlets/index.js'
$ sha512sum index.js
201e75525f423c25bbafa74327b258f4dc347cbf8f20e4df679153d939358bc58e33230e458de59bd80dc7708efba067b7a714954f4a109f47d4dd7724141ed6  index.js
```

Then run `gen.js` like so (in the same directory as `index.js`):
```sh
mkdir scriptlets
node gen.js
```

Then you can import the `scriptlets` folder via the file selector in `chrome://adblock` (it only supports adding directories due to limitations with `<input type="file">`).

## Exporting sources back to this repository

First, makes sure that you've committed everything both here and in your Chromium tree.
Then do this:

```sh
## (here) represents this repository, (chromium) is the Chromium tree
$ (chromium) git diff --diff-filter=A (root commit) HEAD > (here)/new.patch
$ (chromium) git diff --diff-filter=M (root commit) HEAD | sed '/^diff --git/d' | sed '/^index /d' > (here)/core.patch
# remove everything under src so that the patch'll apply
$ rm -rf (here)src/*
$ patch -p1 -d (here)/src < (here)/new.patch
$ rm (here)/new.patch
```
