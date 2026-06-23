// Copyright (c) 2021 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

#include "components/brave_shields/content/browser/domain_block_tab_storage.h"

#include <utility>

#include "base/check.h"
#include "base/containers/flat_map.h"
#include "base/memory/ptr_util.h"
#include "base/no_destructor.h"
#include "content/public/browser/web_contents.h"

namespace brave_shields {

// Arbitrary but unique key required for SupportsUserData.
// Upstream does this too.
const void* const kDomainBlockTabStorageKey = &kDomainBlockTabStorageKey;

DomainBlockTabStorage::DomainBlockTabStorage(content::WebContents* contents)
    : content::WebContentsUserData<DomainBlockTabStorage>(*contents) {}

DomainBlockTabStorage::~DomainBlockTabStorage() = default;

// static
DomainBlockTabStorage* DomainBlockTabStorage::GetOrCreate(
    content::WebContents* web_contents) {
  DomainBlockTabStorage* storage = FromWebContents(web_contents);
  if (!storage) {
    CreateForWebContents(web_contents);
    storage = FromWebContents(web_contents);
  }
  return storage;
}

WEB_CONTENTS_USER_DATA_KEY_IMPL(DomainBlockTabStorage);

}  // namespace brave_shields
