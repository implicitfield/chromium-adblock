// Copyright (c) 2020 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

#include "components/brave_shields/core/browser/brave_shields_utils.h"

#include <optional>
#include <string>
#include <utility>

#include "base/debug/dump_without_crashing.h"
#include "base/hash/hash.h"
#include "base/logging.h"
#include "base/strings/strcat.h"
#include "components/brave_shields/core/common/features.h"
#include "components/brave_shields/core/common/pref_names.h"
#include "components/content_settings/core/browser/host_content_settings_map.h"
#include "components/content_settings/core/common/content_settings.h"
#include "components/content_settings/core/common/content_settings_enums.mojom-data-view.h"
#include "components/content_settings/core/common/content_settings_pattern.h"
#include "components/content_settings/core/common/content_settings_utils.h"
#include "components/content_settings/core/common/pref_names.h"
#include "components/prefs/pref_service.h"
#include "net/base/features.h"
#include "url/gurl.h"

namespace brave_shields {

std::string ControlTypeToString(ControlType type) {
  switch (type) {
    case ControlType::ALLOW:
      return "allow";
    case ControlType::BLOCK:
      return "block";
    case ControlType::BLOCK_THIRD_PARTY:
      return "block_third_party";
    case ControlType::DEFAULT:
      return "default";
  }
  NOTREACHED() << "Unexpected value for ControlType: "
               << std::to_underlying(type);
}

ControlType ControlTypeFromString(const std::string& string) {
  if (string == "allow") {
    return ControlType::ALLOW;
  } else if (string == "block") {
    return ControlType::BLOCK;
  } else if (string == "block_third_party") {
    return ControlType::BLOCK_THIRD_PARTY;
  } else if (string == "default") {
    return ControlType::DEFAULT;
  }
  NOTREACHED();
}

DomainBlockingType GetDomainBlockingType(HostContentSettingsMap* map,
                                         const GURL& url) {
  // Don't block if feature is disabled
  if (!base::FeatureList::IsEnabled(
          brave_shields::features::kBraveDomainBlock)) {
    return DomainBlockingType::kNone;
  }

  return DomainBlockingType::kAggressive;
}

bool IsDeveloperModeEnabled(PrefService*) {
  return true;
}

}  // namespace brave_shields
