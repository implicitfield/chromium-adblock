// Copyright (c) 2019 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

#ifndef BRAVE_COMPONENTS_BRAVE_SHIELDS_CORE_COMMON_BRAVE_SHIELD_CONSTANTS_H_
#define BRAVE_COMPONENTS_BRAVE_SHIELDS_CORE_COMMON_BRAVE_SHIELD_CONSTANTS_H_

#include "base/containers/fixed_flat_map.h"
#include "base/containers/fixed_flat_set.h"
#include "base/containers/map_util.h"
#include "base/files/file_path.h"
#include "components/content_settings/core/common/content_settings_types.h"

namespace brave_shields {

// Content/Web settings:
inline constexpr char kCosmeticFiltering[] = "cosmeticFilteringV2";
inline constexpr char kBraveShields[] = "Shields";

// Key for procedural and action filters in the UrlCosmeticResources struct from
// adblock-rust
inline constexpr char kCosmeticResourcesProceduralActions[] =
    "procedural_actions";

// Filename for cached text from a custom filter list subscription
const base::FilePath::CharType kCustomSubscriptionListText[] =
    FILE_PATH_LITERAL("list_text.txt");

inline constexpr char kDefaultAdblockFiltersListUuid[] = "default";

}  // namespace brave_shields

#endif  // BRAVE_COMPONENTS_BRAVE_SHIELDS_CORE_COMMON_BRAVE_SHIELD_CONSTANTS_H_
