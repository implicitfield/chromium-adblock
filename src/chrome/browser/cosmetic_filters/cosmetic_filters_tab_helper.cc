// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

#include "chrome/browser/cosmetic_filters/cosmetic_filters_tab_helper.h"

#include <string_view>
#include <utility>

#include "base/check.h"
#include "base/strings/string_util.h"
#include "base/strings/utf_string_conversions.h"
#include "chrome/browser/browser_process.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"  // nogncheck
#include "chrome/browser/ui/color/chrome_color_id.h"
#include "components/brave_shields/content/browser/ad_block_service.h"
#include "components/strings/grit/components_strings.h"
#include "components/tabs/public/tab_interface.h"
#include "content/public/browser/browser_context.h"
#include "content/public/browser/web_contents.h"
#include "third_party/blink/public/common/associated_interfaces/associated_interface_provider.h"
#include "ui/base/l10n/l10n_util.h"
#include "ui/color/color_provider.h"

namespace cosmetic_filters {

namespace {

bool IsValidFilterText(std::string_view selector) {
  if (!base::IsStringUTF8(selector)) {
    return false;
  }

  // The rules are parsed by adblock-rust via lines() method.
  // The method checks a newline byte (the 0xA byte) or CRLF (0xD, 0xA bytes).
  // https://doc.rust-lang.org/stable/std/io/trait.BufRead.html#method.lines
  if (selector.contains('\n')) {
    return false;
  }

  return true;
}
}  // namespace

// static
void CosmeticFiltersTabHelper::LaunchContentPicker(
    content::WebContents* web_contents) {
  CosmeticFiltersTabHelper::CreateForWebContents(web_contents);
  if (auto* main_rfh = web_contents->GetPrimaryMainFrame()) {
    mojo::AssociatedRemote<mojom::CosmeticFiltersAgent> cosmetic_filter_agent;
    main_rfh->GetRemoteAssociatedInterfaces()->GetInterface(
        &cosmetic_filter_agent);
    cosmetic_filter_agent->LaunchContentPicker();
  }
}

// static
void CosmeticFiltersTabHelper::BindCosmeticFiltersHandler(
    content::RenderFrameHost* rfh,
    mojo::PendingAssociatedReceiver<mojom::CosmeticFiltersHandler> receiver) {
  auto* web_contents = content::WebContents::FromRenderFrameHost(rfh);
  if (!web_contents) {
    return;
  }
  CosmeticFiltersTabHelper::CreateForWebContents(web_contents);
  if (auto* tab_helper =
          CosmeticFiltersTabHelper::FromWebContents(web_contents)) {
    tab_helper->receivers_.Bind(rfh, std::move(receiver));
  }
}

void CosmeticFiltersTabHelper::AddSiteCosmeticFilter(
    const std::string& filter) {
  // `filter` doesn't have a host, because we don't trust a renderer process.
  // Instead, we calculate and add the host explicitly here.
  const auto* sender_rfh = receivers_.GetCurrentTargetFrame();
  CHECK(sender_rfh);
  if (IsValidFilterText(filter)) {
    const auto host = sender_rfh->GetLastCommittedOrigin().host();
    g_browser_process->ad_block_service()->AddUserCosmeticFilter(host + "##" +
                                                                 filter);
  }
}

void CosmeticFiltersTabHelper::GetElementPickerThemeInfo(
    GetElementPickerThemeInfoCallback callback) {
  auto& color_provider = GetWebContents().GetColorProvider();
  std::move(callback).Run(
      GetWebContents().GetColorMode() == ui::ColorProviderKey::ColorMode::kDark,
      color_provider.GetColor(kColorSidePanelBadgeBackground));
}

void CosmeticFiltersTabHelper::GetElementPickerLocalizedTexts(
    GetElementPickerLocalizedTextsCallback callback) {
  auto localization_data = mojom::ElementPickerLocalization::New(
      base::UTF16ToUTF8(l10n_util::GetStringUTF16(
          IDS_BRAVE_ELEMENT_PICKER_CREATE_BTN_ENABLED_LABEL)),
      base::UTF16ToUTF8(l10n_util::GetStringUTF16(
          IDS_BRAVE_ELEMENT_PICKER_CREATE_BTN_DISABLED_LABEL)),
      base::UTF16ToUTF8(l10n_util::GetStringUTF16(
          IDS_BRAVE_ELEMENT_PICKER_SHOW_RULES_BTN_LABEL)),
      base::UTF16ToUTF8(l10n_util::GetStringUTF16(
          IDS_BRAVE_ELEMENT_PICKER_HIDE_RULES_BTN_LABEL)),
      base::UTF16ToUTF8(
          l10n_util::GetStringUTF16(IDS_BRAVE_ELEMENT_PICKER_QUIT_BTN_LABEL)));
  std::move(callback).Run(std::move(localization_data));
}

CosmeticFiltersTabHelper::CosmeticFiltersTabHelper(
    content::WebContents* web_contents)
    : content::WebContentsUserData<CosmeticFiltersTabHelper>(*web_contents),
      receivers_(web_contents, this) {}

CosmeticFiltersTabHelper::~CosmeticFiltersTabHelper() = default;

WEB_CONTENTS_USER_DATA_KEY_IMPL(CosmeticFiltersTabHelper);
}  // namespace cosmetic_filters
