/* Copyright (c) 2019 The Brave Authors. All rights reserved.
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "chrome/browser/net/brave_request_handler.h"

#include <algorithm>
#include <memory>
#include <utility>

#include "base/check.h"
#include "base/feature_list.h"
#include "base/memory/scoped_refptr.h"
#include "base/memory/weak_ptr.h"
#include "chrome/browser/browser_process.h"
#include "chrome/browser/net/brave_ad_block_csp_network_delegate_helper.h"
#include "chrome/browser/net/brave_ad_block_tp_network_delegate_helper.h"
#include "chrome/browser/net/url_context.h"
#include "components/brave_shields/core/common/features.h"
#include "content/public/browser/browser_task_traits.h"
#include "content/public/browser/browser_thread.h"
#include "content/public/common/url_constants.h"
#include "extensions/buildflags/buildflags.h"
#include "extensions/common/constants.h"
#include "net/base/features.h"
#include "net/base/net_errors.h"
#include "third_party/blink/public/common/features.h"

template <template <typename> class T>
static bool IsInternalScheme(T<brave::BraveRequestInfo> ctx) {
  DCHECK(ctx);
#if BUILDFLAG(ENABLE_EXTENSIONS)
  if (ctx->request_url().SchemeIs(extensions::kExtensionScheme)) {
    return true;
  }
#endif
  return ctx->request_url().SchemeIs(content::kChromeUIScheme);
}

template <template <typename> class T>
BraveRequestHandler<T>::BraveRequestHandler() {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
  SetupCallbacks();
}

template <template <typename> class T>
BraveRequestHandler<T>::~BraveRequestHandler() = default;

template <template <typename> class T>
void BraveRequestHandler<T>::SetupCallbacks() {
  brave::OnBeforeURLRequestCallback callback =
      base::BindRepeating(brave::OnBeforeURLRequest_AdBlockTPPreWork<T>);
  before_url_request_callbacks_.push_back(callback);

  if (base::FeatureList::IsEnabled(
          ::brave_shields::features::kBraveAdblockCspRules)) {
    brave::OnHeadersReceivedCallback headers_received_callback2 =
        base::BindRepeating(brave::OnHeadersReceived_AdBlockCspWork<T>);
    headers_received_callbacks_.push_back(headers_received_callback2);
  }
}

template <template <typename> class T>
bool BraveRequestHandler<T>::IsRequestIdentifierValid(
    uint64_t request_identifier) {
  return callbacks_.contains(request_identifier);
}

template <template <typename> class T>
int BraveRequestHandler<T>::OnBeforeURLRequest(
    T<brave::BraveRequestInfo> ctx,
    net::CompletionOnceCallback callback,
    GURL* new_url) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
  if (!ctx || before_url_request_callbacks_.empty() || IsInternalScheme(ctx)) {
    return net::OK;
  }
  ctx->set_new_url(new_url);
  ctx->set_event_type(brave::kOnBeforeRequest);
  callbacks_[ctx->request_identifier()] = std::move(callback);
  RunNextCallback(ctx);
  return net::ERR_IO_PENDING;
}

template <template <typename> class T>
int BraveRequestHandler<T>::OnBeforeStartTransaction(
    T<brave::BraveRequestInfo> ctx,
    net::CompletionOnceCallback callback,
    net::HttpRequestHeaders* headers) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
  if (!ctx || before_start_transaction_callbacks_.empty() ||
      IsInternalScheme(ctx)) {
    return net::OK;
  }
  ctx->set_event_type(brave::kOnBeforeStartTransaction);
  ctx->set_headers(headers);
  callbacks_[ctx->request_identifier()] = std::move(callback);
  RunNextCallback(ctx);
  return net::ERR_IO_PENDING;
}

template <template <typename> class T>
int BraveRequestHandler<T>::OnHeadersReceived(
    T<brave::BraveRequestInfo> ctx,
    net::CompletionOnceCallback callback,
    const net::HttpResponseHeaders* original_response_headers,
    scoped_refptr<net::HttpResponseHeaders>* override_response_headers,
    GURL* allowed_unsafe_redirect_url) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
  if (!ctx) {
    return net::OK;
  }

  if (headers_received_callbacks_.empty() &&
      !ctx->request_url().SchemeIs(content::kChromeUIScheme)) {
    // TODO(bsclifton): can this be removed?
    // Extension scheme not excluded since brave_webtorrent needs it.
    return net::OK;
  }

  callbacks_[ctx->request_identifier()] = std::move(callback);
  ctx->set_event_type(brave::kOnHeadersReceived);
  ctx->set_original_response_headers(original_response_headers);
  ctx->set_override_response_headers(override_response_headers);
  ctx->set_allowed_unsafe_redirect_url(allowed_unsafe_redirect_url);

  RunNextCallback(ctx);
  return net::ERR_IO_PENDING;
}

template <template <typename> class T>
void BraveRequestHandler<T>::OnURLRequestDestroyed(
    T<brave::BraveRequestInfo> ctx) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
  DCHECK(ctx);
  auto it = callbacks_.find(ctx->request_identifier());
  if (it != callbacks_.end()) {
    callbacks_.erase(it);
  }
}

template <template <typename> class T>
void BraveRequestHandler<T>::RunCallbackForRequestIdentifier(
    uint64_t request_identifier,
    int rv) {
  std::map<uint64_t, net::CompletionOnceCallback>::iterator it =
      callbacks_.find(request_identifier);
  // We intentionally do the async call to maintain the proper flow
  // of URLLoader callbacks.
  content::GetUIThreadTaskRunner({})->PostTask(
      FROM_HERE, base::BindOnce(std::move(it->second), rv));
}

// TODO(iefremov): Merge all callback containers into one and run only one loop
// instead of many (issues/5574).
template <template <typename> class T>
void BraveRequestHandler<T>::RunNextCallback(T<brave::BraveRequestInfo> ctx) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
  if (!ctx) {
    return;
  }

  if (!callbacks_.contains(ctx->request_identifier())) {
    return;
  }

  if (ctx->pending_error().has_value()) {
    RunCallbackForRequestIdentifier(ctx->request_identifier(),
                                    ctx->pending_error().value());
    return;
  }

  // Continue processing callbacks until we hit one that returns PENDING
  int rv = net::OK;

  if (ctx->event_type() == brave::kOnBeforeRequest) {
    while (before_url_request_callbacks_.size() !=
           ctx->next_url_request_index()) {
      const size_t index = ctx->next_url_request_index();
      ctx->set_next_url_request_index(index + 1);
      brave::OnBeforeURLRequestCallback callback =
          before_url_request_callbacks_[index];
      brave::ResponseCallback next_callback =
          base::BindRepeating(&BraveRequestHandler::RunNextCallback,
                              weak_factory_.GetWeakPtr(), ctx);
      rv = callback.Run(next_callback, ctx);
      if (rv == net::ERR_IO_PENDING) {
        return;
      }
      if (rv != net::OK) {
        break;
      }
    }
  } else if (ctx->event_type() == brave::kOnBeforeStartTransaction) {
    while (before_start_transaction_callbacks_.size() !=
           ctx->next_url_request_index()) {
      const size_t index = ctx->next_url_request_index();
      ctx->set_next_url_request_index(index + 1);
      brave::OnBeforeStartTransactionCallback callback =
          before_start_transaction_callbacks_[index];
      brave::ResponseCallback next_callback =
          base::BindRepeating(&BraveRequestHandler::RunNextCallback,
                              weak_factory_.GetWeakPtr(), ctx);
      rv = callback.Run(ctx->headers(), next_callback, ctx);
      if (rv == net::ERR_IO_PENDING) {
        return;
      }
      if (rv != net::OK) {
        break;
      }
    }
  } else if (ctx->event_type() == brave::kOnHeadersReceived) {
    while (headers_received_callbacks_.size() !=
           ctx->next_url_request_index()) {
      const size_t index = ctx->next_url_request_index();
      ctx->set_next_url_request_index(index + 1);
      brave::OnHeadersReceivedCallback callback =
          headers_received_callbacks_[index];
      brave::ResponseCallback next_callback =
          base::BindRepeating(&BraveRequestHandler::RunNextCallback,
                              weak_factory_.GetWeakPtr(), ctx);
      rv = callback.Run(ctx->original_response_headers(),
                        ctx->override_response_headers(),
                        ctx->allowed_unsafe_redirect_url(), next_callback, ctx);
      if (rv == net::ERR_IO_PENDING) {
        return;
      }
      if (rv != net::OK) {
        break;
      }
    }
  }

  if (rv != net::OK) {
    RunCallbackForRequestIdentifier(ctx->request_identifier(), rv);
    return;
  }

  if (ctx->event_type() == brave::kOnBeforeRequest) {
    if (!ctx->new_url_spec().empty() &&
        (ctx->new_url_spec() != ctx->request_url().spec()) &&
        IsRequestIdentifierValid(ctx->request_identifier())) {
      *ctx->new_url() = GURL(ctx->new_url_spec());
    }
    if (ctx->blocked_by() == brave::kAdBlocked ||
        ctx->blocked_by() == brave::kOtherBlocked) {
      if (!ctx->ShouldMockRequest()) {
        RunCallbackForRequestIdentifier(ctx->request_identifier(),
                                        net::ERR_BLOCKED_BY_CLIENT);
        return;
      }
    }
  }
  RunCallbackForRequestIdentifier(ctx->request_identifier(), rv);
}

template class BraveRequestHandler<std::shared_ptr>;
template class BraveRequestHandler<base::WeakPtr>;
