/* Copyright (c) 2019 The Brave Authors. All rights reserved.
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "chrome/browser/ui/webui/brave_adblock_ui.h"

#include <memory>
#include <string>
#include <utility>

#include "base/check.h"
#include "base/check_op.h"
#include "base/memory/weak_ptr.h"
#include "base/scoped_observation.h"
#include "base/values.h"
#include "build/build_config.h"
#include "chrome/browser/browser_process.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/common/webui_url_constants.h"
#include "chrome/grit/adblock_ui_resources.h"
#include "chrome/grit/adblock_ui_resources_map.h"
#include "components/brave_shields/content/browser/ad_block_custom_filters_provider.h"
#include "components/brave_shields/content/browser/ad_block_service.h"
#include "components/brave_shields/content/browser/ad_block_subscription_service_manager.h"
#include "components/brave_shields/content/browser/ad_block_subscription_service_manager_observer.h"
#include "components/brave_shields/core/browser/ad_block_custom_resource_provider.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_data_source.h"
#include "content/public/browser/web_ui_message_handler.h"
#include "ui/webui/webui_util.h"

#if BUILDFLAG(IS_ANDROID)
#include "chrome/browser/android/tab_web_contents_delegate_android.h"  // nogncheck crbug.com/40147906
#include "content/public/browser/web_contents.h"
#else
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_finder.h"
#include "chrome/browser/ui/navigator/browser_navigator_params.h"
#include "chrome/browser/ui/singleton_tabs.h"
#endif

namespace {

class AdblockDOMHandler
    : public content::WebUIMessageHandler,
      public brave_shields::AdBlockSubscriptionServiceManagerObserver {
 public:
  AdblockDOMHandler();
  AdblockDOMHandler(const AdblockDOMHandler&) = delete;
  AdblockDOMHandler& operator=(const AdblockDOMHandler&) = delete;
  ~AdblockDOMHandler() override;

  // WebUIMessageHandler implementation.
  void RegisterMessages() override;

  // brave_shields::AdblockSubscriptionServiceManagerObserver overrides:
  void OnServiceUpdateEvent() override;

  void OnJavascriptAllowed() override;
  void OnJavascriptDisallowed() override;

 private:
  void HandleGetCustomFilters(const base::ListValue& args);
  void HandleGetListSubscriptions(const base::ListValue& args);
  void HandleUpdateCustomFilters(const base::ListValue& args);
  void HandleSubmitNewSubscription(const base::ListValue& args);
  void HandleSetSubscriptionEnabled(const base::ListValue& args);
  void HandleDeleteSubscription(const base::ListValue& args);
  void HandleRefreshSubscription(const base::ListValue& args);
  void HandleViewSubscriptionSource(const base::ListValue& args);

  void OnGetCustomResources(const std::string& callback_id,
                             base::Value custom_resources);
  void OnResourceUpdateStatus(
      const std::string& callback_id,
      brave_shields::AdBlockCustomResourceProvider::ErrorCode error_code);

  void HandleGetCustomResources(const base::ListValue& args);
  void HandleGetCustomResourceKeys(const base::ListValue& args);
  void HandleAddCustomResource(const base::ListValue& args);
  void HandleUpdateCustomResource(const base::ListValue& args);
  void HandleRemoveCustomResource(const base::ListValue& args);
  void HandleRemoveCustomResourceKey(const base::ListValue& args);

  void RefreshSubscriptionsList();

  base::ScopedObservation<
      brave_shields::AdBlockSubscriptionServiceManager,
      brave_shields::AdBlockSubscriptionServiceManagerObserver>
      service_observer_{this};

  base::WeakPtrFactory<AdblockDOMHandler> weak_factory_{this};
};

AdblockDOMHandler::AdblockDOMHandler() = default;

AdblockDOMHandler::~AdblockDOMHandler() = default;

void AdblockDOMHandler::RegisterMessages() {
  web_ui()->RegisterMessageCallback(
      "brave_adblock.getCustomFilters",
      base::BindRepeating(&AdblockDOMHandler::HandleGetCustomFilters,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "brave_adblock.getListSubscriptions",
      base::BindRepeating(&AdblockDOMHandler::HandleGetListSubscriptions,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "brave_adblock.updateCustomFilters",
      base::BindRepeating(&AdblockDOMHandler::HandleUpdateCustomFilters,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "brave_adblock.submitNewSubscription",
      base::BindRepeating(&AdblockDOMHandler::HandleSubmitNewSubscription,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "brave_adblock.setSubscriptionEnabled",
      base::BindRepeating(&AdblockDOMHandler::HandleSetSubscriptionEnabled,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "brave_adblock.deleteSubscription",
      base::BindRepeating(&AdblockDOMHandler::HandleDeleteSubscription,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "brave_adblock.refreshSubscription",
      base::BindRepeating(&AdblockDOMHandler::HandleRefreshSubscription,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "brave_adblock.viewSubscriptionSource",
      base::BindRepeating(&AdblockDOMHandler::HandleViewSubscriptionSource,
                          base::Unretained(this)));

  web_ui()->RegisterMessageCallback(
      "brave_adblock.getCustomResources",
      base::BindRepeating(&AdblockDOMHandler::HandleGetCustomResources,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "brave_adblock.getCustomResourceKeys",
      base::BindRepeating(&AdblockDOMHandler::HandleGetCustomResourceKeys,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "brave_adblock.addCustomResource",
      base::BindRepeating(&AdblockDOMHandler::HandleAddCustomResource,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "brave_adblock.updateCustomResource",
      base::BindRepeating(&AdblockDOMHandler::HandleUpdateCustomResource,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "brave_adblock.removeCustomResource",
      base::BindRepeating(&AdblockDOMHandler::HandleRemoveCustomResource,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "brave_adblock.removeCustomResourceKey",
      base::BindRepeating(&AdblockDOMHandler::HandleRemoveCustomResourceKey,
                          base::Unretained(this)));
}

void AdblockDOMHandler::OnJavascriptAllowed() {
  service_observer_.Observe(
      g_browser_process->ad_block_service()->subscription_service_manager());
}

void AdblockDOMHandler::OnJavascriptDisallowed() {
  service_observer_.Reset();
}

void AdblockDOMHandler::OnServiceUpdateEvent() {
  if (!IsJavascriptAllowed()) {
    return;
  }
  RefreshSubscriptionsList();
}

void AdblockDOMHandler::HandleGetCustomFilters(const base::ListValue& args) {
  DCHECK_EQ(args.size(), 0U);
  AllowJavascript();
  const std::string custom_filters = g_browser_process->ad_block_service()
                                         ->custom_filters_provider()
                                         ->GetCustomFilters();
  CallJavascriptFunction("brave_adblock.onGetCustomFilters",
                         base::Value(custom_filters));
}

void AdblockDOMHandler::HandleGetListSubscriptions(
    const base::ListValue& args) {
  DCHECK_EQ(args.size(), 0U);
  AllowJavascript();
  RefreshSubscriptionsList();
}

void AdblockDOMHandler::HandleUpdateCustomFilters(const base::ListValue& args) {
  DCHECK_EQ(args.size(), 1U);
  if (!args[0].is_string()) {
    return;
  }

  std::string custom_filters = args[0].GetString();
  g_browser_process->ad_block_service()
      ->custom_filters_provider()
      ->UpdateCustomFilters(custom_filters);
}

void AdblockDOMHandler::HandleSubmitNewSubscription(
    const base::ListValue& args) {
  DCHECK_EQ(args.size(), 1U);
  AllowJavascript();
  if (!args[0].is_string()) {
    return;
  }

  std::string subscription_url_string = args[0].GetString();
  const GURL subscription_url = GURL(subscription_url_string);
  if (!subscription_url.is_valid()) {
    return;
  }

  g_browser_process->ad_block_service()
      ->subscription_service_manager()
      ->CreateSubscription(subscription_url);
  RefreshSubscriptionsList();
}

void AdblockDOMHandler::HandleSetSubscriptionEnabled(
    const base::ListValue& args) {
  DCHECK_EQ(args.size(), 2U);
  AllowJavascript();
  if (!args[0].is_string() || !args[1].is_bool()) {
    return;
  }

  std::string subscription_url_string = args[0].GetString();
  bool enabled = args[1].GetBool();
  const GURL subscription_url = GURL(subscription_url_string);
  if (!subscription_url.is_valid()) {
    return;
  }
  g_browser_process->ad_block_service()
      ->subscription_service_manager()
      ->EnableSubscription(subscription_url, enabled);
  RefreshSubscriptionsList();
}

void AdblockDOMHandler::HandleDeleteSubscription(const base::ListValue& args) {
  DCHECK_EQ(args.size(), 1U);
  AllowJavascript();
  if (!args[0].is_string()) {
    return;
  }

  std::string subscription_url_string = args[0].GetString();
  const GURL subscription_url = GURL(subscription_url_string);
  if (!subscription_url.is_valid()) {
    return;
  }
  g_browser_process->ad_block_service()
      ->subscription_service_manager()
      ->DeleteSubscription(subscription_url);
  RefreshSubscriptionsList();
}

void AdblockDOMHandler::HandleRefreshSubscription(const base::ListValue& args) {
  DCHECK_EQ(args.size(), 1U);
  // This handler does not call Javascript directly, but refreshing the
  // subscription will trigger the observer later, which will require it.
  AllowJavascript();
  if (!args[0].is_string()) {
    return;
  }

  std::string subscription_url_string = args[0].GetString();
  const GURL subscription_url = GURL(subscription_url_string);
  if (!subscription_url.is_valid()) {
    return;
  }
  g_browser_process->ad_block_service()
      ->subscription_service_manager()
      ->RefreshSubscription(subscription_url, true);
}

void AdblockDOMHandler::HandleViewSubscriptionSource(
    const base::ListValue& args) {
  DCHECK_EQ(args.size(), 1U);
  if (!args[0].is_string()) {
    return;
  }

  std::string subscription_url_string = args[0].GetString();
  const GURL subscription_url = GURL(subscription_url_string);
  if (!subscription_url.is_valid()) {
    return;
  }

  const GURL file_url = g_browser_process->ad_block_service()
                            ->subscription_service_manager()
                            ->GetListTextFileUrl(subscription_url);

#if BUILDFLAG(IS_ANDROID)
  web_ui()->GetWebContents()->GetDelegate()->OpenURLFromTab(
      web_ui()->GetWebContents(),
      content::OpenURLParams(file_url, content::Referrer(),
                             WindowOpenDisposition::NEW_FOREGROUND_TAB,
                             ui::PAGE_TRANSITION_AUTO_TOPLEVEL, false),
      /*navigation_handle_callback=*/{});
#else
  auto* browser = chrome::FindBrowserWithTab(web_ui()->GetWebContents());
  ShowSingletonTabOverwritingNTP(browser, file_url);
#endif
}

// Convenience method to push updated subscription information to the UI.
void AdblockDOMHandler::RefreshSubscriptionsList() {
  DCHECK(IsJavascriptAllowed());
  auto list_subscriptions = g_browser_process->ad_block_service()
                                ->subscription_service_manager()
                                ->GetSubscriptions();
  base::ListValue list_value;
  for (const auto& subscription : list_subscriptions) {
    base::DictValue dict;
    dict.Set("subscription_url", subscription.subscription_url.spec());
    dict.Set("enabled", subscription.enabled);
    dict.Set("last_update_attempt",
             subscription.last_update_attempt.InMillisecondsFSinceUnixEpoch());
    dict.Set("last_successful_update_attempt",
             subscription.last_successful_update_attempt
                 .InMillisecondsFSinceUnixEpoch());
    if (subscription.homepage) {
      dict.Set("homepage", *subscription.homepage);
    }
    if (subscription.title) {
      dict.Set("title", *subscription.title);
    }
    list_value.Append(std::move(dict));
  }
  CallJavascriptFunction("brave_adblock.onGetListSubscriptions", list_value);
}

void AdblockDOMHandler::OnGetCustomResources(const std::string& callback_id,
                                              base::Value custom_resources) {
  AllowJavascript();
  ResolveJavascriptCallback(callback_id, custom_resources);
}

void AdblockDOMHandler::OnResourceUpdateStatus(
    const std::string& callback_id,
    brave_shields::AdBlockCustomResourceProvider::ErrorCode error_code) {
  AllowJavascript();
  ResolveJavascriptCallback(callback_id,
                            base::Value(static_cast<int>(error_code)));
}

void AdblockDOMHandler::HandleGetCustomResources(const base::ListValue& args) {
  CHECK(args.size() == 2u && args[0].is_string() && args[1].is_string());

  g_browser_process->ad_block_service()
      ->custom_resource_provider()
      ->GetCustomResources(args[1].GetString(),
          base::BindOnce(&AdblockDOMHandler::OnGetCustomResources,
                         weak_factory_.GetWeakPtr(), args[0].GetString()));
}

void AdblockDOMHandler::HandleGetCustomResourceKeys(const base::ListValue& args) {
  CHECK(args.size() == 1u && args[0].is_string());

  g_browser_process->ad_block_service()
      ->custom_resource_provider()
      ->GetKeys(base::BindOnce(&AdblockDOMHandler::OnGetCustomResources,
                         weak_factory_.GetWeakPtr(), args[0].GetString()));
}

void AdblockDOMHandler::HandleAddCustomResource(const base::ListValue& args) {
  CHECK(args.size() == 3u && args[0].is_string() && args[1].is_string() &&
        args[2].is_dict());

  g_browser_process->ad_block_service()
      ->custom_resource_provider()
      ->AddResource(args[1].GetString(),
          Profile::FromWebUI(web_ui())->GetPrefs(), args[2],
          base::BindOnce(&AdblockDOMHandler::OnResourceUpdateStatus,
                         weak_factory_.GetWeakPtr(), args[0].GetString()));
}

void AdblockDOMHandler::HandleUpdateCustomResource(
    const base::ListValue& args) {
  CHECK(args.size() == 4u && args[0].is_string() && args[1].is_string() &&
        args[2].is_string() && args[3].is_dict());

  g_browser_process->ad_block_service()
      ->custom_resource_provider()
      ->UpdateResource(args[1].GetString(),
          Profile::FromWebUI(web_ui())->GetPrefs(), args[2].GetString(),
          args[3],
          base::BindOnce(&AdblockDOMHandler::OnResourceUpdateStatus,
                         weak_factory_.GetWeakPtr(), args[0].GetString()));
}

void AdblockDOMHandler::HandleRemoveCustomResource(
    const base::ListValue& args) {
  CHECK(args.size() == 3u && args[0].is_string() && args[1].is_string() &&
        args[2].is_string());

  g_browser_process->ad_block_service()
      ->custom_resource_provider()
      ->RemoveResource(args[1].GetString(),
          Profile::FromWebUI(web_ui())->GetPrefs(), args[2].GetString(),
          base::BindOnce(&AdblockDOMHandler::OnResourceUpdateStatus,
                         weak_factory_.GetWeakPtr(), args[0].GetString()));
}

void AdblockDOMHandler::HandleRemoveCustomResourceKey(
    const base::ListValue& args) {
  CHECK(args.size() == 2u && args[0].is_string() && args[1].is_string());

  g_browser_process->ad_block_service()
      ->custom_resource_provider()
      ->RemoveKey(args[1].GetString(),
          base::BindOnce(&AdblockDOMHandler::OnResourceUpdateStatus,
                         weak_factory_.GetWeakPtr(), args[0].GetString()));
}

}  // namespace

BraveAdblockUI::BraveAdblockUI(content::WebUI* web_ui)
    : WebUIController(web_ui) {
  content::WebUIDataSource* source = content::WebUIDataSource::CreateAndAdd(
      web_ui->GetWebContents()->GetBrowserContext(), chrome::kAdblockHost);

  webui::SetupWebUIDataSource(source, kAdblockUiResources,
                              IDR_ADBLOCK_UI_BRAVE_ADBLOCK_HTML);
  web_ui->AddMessageHandler(std::make_unique<AdblockDOMHandler>());
}

BraveAdblockUI::~BraveAdblockUI() = default;
