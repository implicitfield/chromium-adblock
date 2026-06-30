// Copyright (c) 2020 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

#include "components/brave_shields/core/common/features.h"

#include "base/feature_list.h"

namespace brave_shields::features {

BASE_FEATURE(kAdBlockDefaultResourceUpdateInterval,
             base::FEATURE_ENABLED_BY_DEFAULT);
// When enabled, Brave will issue DNS queries for requests that the adblock
// engine has not blocked, then check them again with the original hostname
// substituted for any canonical name found.
BASE_FEATURE(kBraveAdblockCnameUncloaking, base::FEATURE_ENABLED_BY_DEFAULT);
// When enabled, Brave will apply HTML element collapsing to all images and
// iframes that initiate a blocked network request.
BASE_FEATURE(kBraveAdblockCollapseBlockedElements,
             base::FEATURE_ENABLED_BY_DEFAULT);
BASE_FEATURE(kBraveAdblockCosmeticFiltering, base::FEATURE_ENABLED_BY_DEFAULT);
// Brave will apply cosmetic filters with procedural operators like
// `:has-text(...)` and `:upward(...)`.
BASE_FEATURE(kBraveAdblockProceduralFiltering,
             base::FEATURE_ENABLED_BY_DEFAULT);
BASE_FEATURE(kBraveAdblockCspRules, base::FEATURE_ENABLED_BY_DEFAULT);
// When enabled, Brave will block domains listed in the user's selected adblock
// filters and present a security interstitial with choice to proceed and
// optionally whitelist the domain.
// Domain block filters look like this:
// ||ads.example.com^
BASE_FEATURE(kBraveDomainBlock, base::FEATURE_ENABLED_BY_DEFAULT);
// When enabled, network requests initiated by extensions will be checked and
// potentially blocked by Brave Shields.
BASE_FEATURE(kBraveExtensionNetworkBlocking, base::FEATURE_DISABLED_BY_DEFAULT);
// load the cosmetic filter rules using sync ipc
BASE_FEATURE(kCosmeticFilteringSyncLoad,
             "CosmeticFilterSyncLoad",
             base::FEATURE_ENABLED_BY_DEFAULT);
// when enabled, allow to select and block HTML elements
BASE_FEATURE(kBraveShieldsElementPicker, base::FEATURE_ENABLED_BY_DEFAULT);

// Enables extra TRACE_EVENTs in content filter js. The feature is
// primary designed for local debugging.
BASE_FEATURE(kCosmeticFilteringExtraPerfMetrics,
             base::FEATURE_DISABLED_BY_DEFAULT);

BASE_FEATURE(kCosmeticFilteringJsPerformance, base::FEATURE_ENABLED_BY_DEFAULT);

constexpr base::FeatureParam<std::string>
    kCosmeticFilteringSubFrameFirstSelectorsPollingDelayMs{
        &kCosmeticFilteringJsPerformance, "subframes_first_query_delay_ms",
        "1000"};

constexpr base::FeatureParam<std::string>
    kCosmeticFilteringswitchToSelectorsPollingThreshold{
        &kCosmeticFilteringJsPerformance, "switch_to_polling_threshold",
        "1000"};

constexpr base::FeatureParam<std::string>
    kCosmeticFilteringFetchNewClassIdRulesThrottlingMs{
        &kCosmeticFilteringJsPerformance, "fetch_throttling_ms", "100"};

BASE_FEATURE(kAdblockOverrideRegexDiscardPolicy,
             base::FEATURE_DISABLED_BY_DEFAULT);

constexpr base::FeatureParam<int>
    kAdblockOverrideRegexDiscardPolicyCleanupIntervalSec{
        &kAdblockOverrideRegexDiscardPolicy, "cleanup_interval_sec", 0};

constexpr base::FeatureParam<int>
    kAdblockOverrideRegexDiscardPolicyDiscardUnusedSec{
        &kAdblockOverrideRegexDiscardPolicy, "discard_unused_sec", 180};

// When enabled, adblock engines are serialized to DAT files on disk after
// filter set loading. On subsequent startups, the cached DAT is loaded
// instead of reprocessing filter lists, improving startup time.
BASE_FEATURE(kAdblockDATCache, base::FEATURE_DISABLED_BY_DEFAULT);

}  // namespace brave_shields::features
