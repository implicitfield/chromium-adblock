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
- Support for importing arbitrary resources

This currently targets version `149.0.7827.200` of Chromium.

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

Then get new crates and reconfigure old ones. Note that this requires connecting to `crates.io`:
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

NOTE: if the `adblock` crate's `BUILD.gn` contains `testonly = true`, then you'll need to find
at least one relevant dependency in `third_party/rust/chromium_crates_io/gnrt_config.toml`
that has `group = 'test'`. Remove those group specifiers from relevant dependencies,
and `gnrt gen` should no longer mark the crate as `testonly`.

This is currently handled in `core.patch`, but might be useful information when updating this.

For other problems, `docs/rust/build_errors_guide.md` in the Chromium source tree is quite useful.

Also fixes might have already been made in `brave-core`, so check against that
repository's versions of `gnrt_config.toml` and `Cargo.toml`.

## Configuring the adblocker

Custom filters, subscriptions and scriptlets can be configured at `chrome://adblock`.
I'd recommend adding at least the following subscriptions (one-by-one, also note that the last two rely on scriptlets):
```
https://easylist.to/easylist/easylist.txt
https://easylist.to/easylist/easyprivacy.txt
https://github.com/uBlockOrigin/uAssets/raw/refs/heads/master/filters/filters.txt
https://github.com/uBlockOrigin/uAssets/raw/refs/heads/master/filters/quick-fixes.txt
```

## Sourcing resources

To bundle resources from uBlock Origin in a suitable form, you can use the `gen-ublock-resources.js` script like so:
```sh
node gen-ublock-resources.js /path/to/uBO/repository uBlockResources.json
```

Then you can import that JSON file as a resource bundle via the first file selector in `chrome://adblock`.

## Exporting sources back to this repository

First, makes sure that you've committed everything both here and in your Chromium tree.
Then do this:

```sh
## (here) represents this repository, (chromium) is the Chromium tree
$ (chromium) git diff --diff-filter=A (root commit) HEAD > (here)/new.patch
$ (chromium) git diff --diff-filter=M (root commit) HEAD | sed '/^diff --git/d' | sed '/^index /d' > (here)/core.patch
# remove everything under src so that the patch'll apply
$ rm -rf (here)/src/*
$ patch -p1 -d (here)/src < (here)/new.patch
$ rm (here)/new.patch
```
