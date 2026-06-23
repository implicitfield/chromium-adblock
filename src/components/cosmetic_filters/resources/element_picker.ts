// Copyright (c) 2021 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

declare namespace cf_worker {
  const addSiteCosmeticFilter: (selector: string) => void
  const getElementPickerThemeInfo: () =>
    Promise<{isDarkModeEnabled: boolean; bgcolor: number}>
  const getLocalizedTexts: () =>
    Promise<{btnCreateDisabledText: string;
        btnCreateEnabledText: string;
        btnShowRulesBoxText: string;
        btnHideRulesBoxText: string;
        btnQuitText: string}>
  const getPlatform: () => string
}

(function() {
  var pickerHTML = `<style>
  :host {
    background: transparent;
    color: black;
    font: 14px 'Inter Variable', 'Inter', sans-serif;
    height: 100%;
    width: 100%;
    margin: 0;
    overflow: hidden;
    --text-color: #1b1b1f;
    --dynamic-bg-color: color-mix(in srgb, var(--dynamic-color-rgb), var(--text-color) 10%);
    --dynamic-secondary-btn-bg-color: color-mix(in srgb, var(--dynamic-color-rgb), var(--text-color) 3%);

    --primary: #3E37D4;
    --title-bar: #f0f0f4;
    --block-btn-bg-disabled: #46464a33;
    --block-btn-color-disabled: #21272a80;
    --button-text: white;
    --text-area-bg-color: white;
  }

  @media (prefers-color-scheme: dark) {
    :host {
      --text-color: #e3e3e8;

      --primary: #C1C4FF;
      --title-bar: #303034;
      --block-btn-bg-disabled: #ebeef033;
      --block-btn-color-disabled: #ebeef080;
      --button-text: #251491;
      --text-area-bg-color: var(--dynamic-bg-color);
    }
  }

  #rules-box {
    height: 8em;
    margin-bottom: 5px;
    background-color: #fff;
    border-radius: .1em;
    display: none;
  }

  .desktop.minimized>#rules-box {
    display: none !important;
  }

  #rules-box>textarea {
    box-sizing: border-box;
    height: 100%;
    width: 100%;
    resize: none;
    border: none;
    padding: 5px;
    overflow: auto;
    overflow-wrap: break-word;
    background-color: var(--text-area-bg-color);
    color: var(--text-color);
  }

  #main-section {
    background-color: var(--theme-background-color);
    border-radius: 16px;
    color-scheme: light only;
    bottom: 4px;
    left: unset;
    right: 4px;
    width: min(360px, calc(100vw - 32px));
    box-sizing: border-box;
    padding-top: 56px;
    padding-right: 16px;
    padding-left: 16px;
    position: fixed;
    opacity: 1;
    height: auto;
  }

  #main-section.minimized.desktop {
    width: 56px;
    padding: 0px;
    height: 56px;
    min-width: auto;
    border-radius: 12px;
    background-color: var(--primary);
  }

  #main-section.minimized:not(.desktop) {
    width: 30px;
    padding: 0px;
    height: 30px;
    margin-inline: auto;
    margin-bottom: 24px;
    margin-right: 24px;
    border-radius: 28px;
    background-color: var(--dynamic-color-rgb);
  }

  #main-section.minimized .card-header {
    display: none;
  }

  #main-section.minimized .minimized-icon {
    display: block;
    height: 18px;
    width: 18px;
    cursor: pointer;
    margin: 6px;
  }

  #main-section.minimized .minimized-icon path {
    fill: var(--primary);
  }

  #main-section.minimized.desktop .minimized-icon {
    height: 25px;
    width: 25px;
    margin: 15px;
  }

  #main-section.minimized.desktop .minimized-icon path {
    fill: var(--dynamic-color-rgb);
  }

  #main-section.minimized.desktop #slider-container,
  #main-section.minimized #buttons {
    display: none;
  }

  @media (orientation: portrait) {
    #main-section:not(.desktop) {
      bottom: 0;
      right: 0;
      left: 0;
      border-radius: 28px 28px 0 0;
      padding-top: 41px;
      border: none;
      width: 100%;
    }
  }

  @media (orientation: landscape) {
    #main-section:not(.desktop) {
      padding-top: 36px;
    }
  }


  .card-header {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 28px;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 16px 16px 0 0;
  }

  .desktop .card-header {
    height: 48px;
    justify-content: right;
    background-color: var(--dynamic-bg-color);
    color: var(--text-color);
  }

  .collapse-button {
    width: 30px;
    height: 30px;
    background-color: var(--dynamic-color-rgb);
    border-radius: 15px;
    margin-bottom: 28px;
    border: 1px solid var(--primary);
  }

  .desktop .collapse-button {
      display: none;
  }

  #title {
    display: none;
  }

  .desktop #title {
    display: block;
    flex-grow: 1;
    text-align: left;
    padding-left: 16px;
    padding-right: 16px;
    font-size: 16px;
    font-weight: 400;
    color: var(--text-color);
  }

  .desktop #btn-quit,
  .minimize-dlg-btn,
  .close-dlg-btn {
    display: none;
  }

  .desktop .minimize-dlg-btn,
  .desktop .close-dlg-btn {
    display: block;
  }

  .title-control-btn svg {
    width: 25px;
    height: 25px;
    margin-right: 20px;
    cursor: pointer;
    position: unset;
  }

  .minimized-icon {
    display: none;
  }

  #main-section input {
    width: calc(100% - 4px);
  }

  #buttons {
    display: flex;
    justify-content: space-between;
    flex-direction: column;
  }

  .buttons-line {
    display: flex;
    justify-content: space-between;
    flex-direction: row;
    padding-bottom: 16px;
  }

  .button {
    min-height: 36px;
    justify-content: center;
    align-items: center;
    border-radius: 16px;
    font-size: 12px;
    font-weight: 600;
    flex-grow: 1;
    border-width: 0px;
    margin: 3px;
  }

  .block-button {
    background-color: var(--primary);
    color: var(--button-text);
  }

  .block-button.disabled {
    background: var(--block-btn-bg-disabled);
    color: var(--block-btn-color-disabled);
  }

  .secondary-button {
    background-color: var(--dynamic-secondary-btn-bg-color);
    cursor: pointer;
    padding: 4px 6px;
    flex-grow: 1;
    border-width: 0px;
    color: var(--primary);
  }

  .secondary-button-bordered {
    border-width: 1px;
    border-color: #4036d3;
  }

  svg {
    cursor: crosshair;
    box-sizing: border-box;
    height: 100%;
    width: 100%;
    top: 0;
    left: 0;
    position: absolute;
  }

  .collapse-button svg {
    position: static;
  }
  .collapse-button svg path{
    fill: var(--primary);
  }

  #darken {
    fill: rgba(0, 0, 0, 0.5);
  }

  #slider-container {
    padding-bottom: 10px;
    padding-top: 10px;
    padding-left: 4px;
    padding-right: 6px;
  }

  .target {
    stroke: #3d39c8;
    stroke-width: 2px;
    fill: rgba(121, 116, 224, 0.25);
  }

  input[type="range"] {
    appearance: none;
    width: 100%;
    height: 10px;
    background: transparent;
    margin: 10px 0;
    cursor: pointer;
  }

  input[type="range"]::-webkit-slider-runnable-track {
    width: 100%;
    height: 10px;
    border-radius: 5px;
    transition: background-image 0.2s ease-in-out;
    background-image:
        linear-gradient(to right,
            transparent calc(100%/3 - 1px), var(--theme-background-color) calc(100%/3 - 1px), var(--theme-background-color) calc(100%/3 + 1px), transparent calc(100%/3 + 1px),
            transparent calc(200%/3 - 1px), var(--theme-background-color) calc(200%/3 - 1px), var(--theme-background-color) calc(200%/3 + 1px), transparent calc(200%/3 + 1px)
        ),
        linear-gradient(to right, var(--primary) 0%, var(--primary) var(--value, 0%), transparent var(--value, 0%), transparent 100%);
    background-size: 100% 100%, 100% 100%;
    background-position: center, center;
    background-repeat: no-repeat, no-repeat;
    background-color: var(--dynamic-bg-color);
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    border: 2px solid var(--primary);
    height: 24px;
    width: 24px;
    border-radius: 50%;
    background: var(--primary);
    margin-top: -7px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    transition: background 0.2s ease-in-out, border-color 0.2s ease-in-out;
  }
</style>
<svg xmlns="http://www.w3.org/2000/svg" id="picker-ui">
  <defs>
    <mask id="highlight-mask">
      <rect x="0" y="0" width="100%" height="100%" fill="white">
      </rect>
    </mask>
  </defs>
  <rect id="darken" x="0" y="0" width="100%" height="100vh" mask="url(#highlight-mask)">
  </rect>
</svg>
<section id="main-section">
  <div id="card-header" class="card-header">
    <div id="title">Block Element</div>
    <div class="collapse-button">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none">
        <path fill="currentColor" fill-rule="evenodd" d="M18.4714 20.7634C18.2111 21.0237 17.7889 21.0237 17.5286 20.7634L12.9453 16.1801C12.6849 15.9197 12.6849 15.4976 12.9453 15.2373C13.2056 14.9769 13.6277 14.9769 13.8881 15.2373L18 19.3492L22.1119 15.2373C22.3723 14.9769 22.7944 14.9769 23.0547 15.2373C23.3151 15.4976 23.3151 15.9197 23.0547 16.1801L18.4714 20.7634Z">
      </svg>
    </div>
    <div id="minimize-dlg-btn" class="title-control-btn minimize-dlg-btn">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <path fill="currentColor" fill-rule="evenodd"
          d="M10.566 11.357a.8.8 0 0 0 .8-.8V5.12a.8.8 0 0 0-1.6 0v3.515l-5.4-5.4a.8.8 0 0 0-1.132 1.13l5.392 5.392H5.18a.8.8 0 0 0 0 1.6zm2.868 1.286a.8.8 0 0 0-.8.8v5.437a.8.8 0 1 0 1.6 0v-3.515l5.4 5.4a.8.8 0 0 0 1.132-1.13l-5.392-5.392h3.446a.8.8 0 0 0 0-1.6z"
          clip-rule="evenodd">
        </path>
      </svg>
    </div>
    <div id="close-btn" class="title-control-btn close-dlg-btn">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <path fill="currentColor"
          d="M5.287 5.287a.85.85 0 0 0 0 1.202L10.797 12l-5.51 5.511a.85.85 0 0 0 1.202 1.202L12 13.203l5.51 5.51a.85.85 0 0 0 1.202-1.203L13.202 12l5.51-5.51a.85.85 0 0 0-1.202-1.202L12 10.798 6.489 5.287a.85.85 0 0 0-1.202 0">
        </path>
      </svg>
    </div>
  </div>
  <div id="rules-box">
    <textarea></textarea>
  </div>
  <div>
    <div id="slider-container">
      <input id="custom-slider" class="slider" type="range" min="1" max="4" value="4">
    </div>
    <div id="buttons">
      <div class="buttons-line">
        <button id="btn-create" class="button block-button disabled">Select element you want to
          block</button>
      </div>
      <div class="buttons-line">
        <button id="btn-quit"
          class="button secondary-button disabled secondary-button-bordered">Cancel</button>
        <button id="btn-show-rules-box" class="button secondary-button disabled">Show rules</button>
      </div>
    </div>
  </div>
  <div id="desktop-min-icon-container">
    <svg xmlns="http://www.w3.org/2000/svg" class="minimized-icon" fill="none" viewBox="0 0 24 24">
      <path fill="currentColor" fill-rule="evenodd"
        d="M4.8 4a.8.8 0 0 0-.8.8v5.437a.8.8 0 0 0 1.6 0V6.722l4.4 4.4a.8.8 0 1 0 1.132-1.13L6.74 5.6h3.446a.8.8 0 0 0 0-1.6zm14.4 16a.8.8 0 0 0 .8-.8v-5.437a.8.8 0 0 0-1.6 0v3.515l-4.4-4.4a.8.8 0 1 0-1.132 1.13L17.26 18.4h-3.446a.8.8 0 0 0 0 1.6z"
        clip-rule="evenodd">
      </path>
    </svg>
  </div>
</section>`

  const NSSVG = 'http://www.w3.org/2000/svg'

  let pickerDiv: HTMLDivElement | null
  let shadowRoot: ShadowRoot | null
  let isAndroid: boolean | null
  let btnCreateEnabledText: string
  let btnCreateDisabledText: string
  let btnShowRulesBoxText: string
  let btnHideRulesBoxText: string

  const api = {
    cosmeticFilterCreate: (selector: string) => {
      cf_worker.addSiteCosmeticFilter(selector)
    },
    getElementPickerThemeInfo: (
      callback: (isDarkModeEnabled: boolean, bgcolor: number) => void,
    ) => {
      cf_worker
        .getElementPickerThemeInfo()
        .then((val: { isDarkModeEnabled: boolean; bgcolor: number }) => {
          callback(val.isDarkModeEnabled, val.bgcolor)
        })
    },
    getLocalizedTexts: (
      callback: (
        btnCreateDisabledText: string,
        btnCreateEnabledText: string,
        btnShowRulesBoxText: string,
        btnHideRulesBoxText: string,
        btnQuitText: string,
      ) => void,
    ) => {
      cf_worker
        .getLocalizedTexts()
        .then(
          (val: {
            btnCreateDisabledText: string
            btnCreateEnabledText: string
            btnShowRulesBoxText: string
            btnHideRulesBoxText: string
            btnQuitText: string
          }) => {
            callback(
              val.btnCreateDisabledText,
              val.btnCreateEnabledText,
              val.btnShowRulesBoxText,
              val.btnHideRulesBoxText,
              val.btnQuitText,
            )
          },
        )
    },
    getPlatform: (): string => {
      return cf_worker.getPlatform()
    },
  }

  // When the picker is activated, it eats all pointer events and takes up the
  // entire screen. All calls to document.elementFromPoint(..) will return the
  // frame. We disable pointer events for the duration of the query to get
  // around this.
  const elementFromFrameCoords = (x: number, y: number): Element | null => {
    if (!pickerDiv) {
      return null
    }
    pickerDiv.style.setProperty('pointer-events', 'none', 'important')
    const elem = document.elementFromPoint(x, y)
    pickerDiv.style.setProperty('pointer-events', 'auto', 'important')
    return elem
  }

  enum SpecificityFlags {
    Id = 1 << 0,
    Hierarchy = 1 << 1,
    Attributes = 1 << 2,
    Class = 1 << 3,
    NthOfType = 1 << 4,
  }

  const mostSpecificMask = 0b11111

  enum Selector {
    Id,
    Class,
    Attributes,
    NthOfType,
  }

  interface Rule {
    type: Selector
    value: any
  }

  class ElementSelectorBuilder {
    public hasId: boolean
    private readonly elem: Element
    private readonly rules: Rule[]
    private tag: string

    constructor(elem: Element) {
      this.rules = []
      this.tag = ''
      this.elem = elem
      this.hasId = false
    }

    addRule(rule: Rule): void {
      if (rule.type < Selector.Id || rule.type > Selector.NthOfType) {
        console.log(`Unexpected selector: ${rule.type}`)
        return
      }
      if (Array.isArray(rule.value) && rule.value.length === 0) {
        return
      }
      if (rule.type === Selector.Id) {
        this.hasId = true
      }
      this.rules.push(rule)
    }

    addTag(tag: string): void {
      this.tag = tag
    }

    size(): number {
      return this.rules.length
    }

    toString(mask: number = mostSpecificMask): string {
      let selector = this.tag + ''
      for (const rule of this.rules) {
        if (!(mask & SpecificityFlags.Id) && rule.type === Selector.Id) {
          continue
        }
        if (!(mask & SpecificityFlags.Class) && rule.type === Selector.Class) {
          continue
        }
        if (
          !(mask & SpecificityFlags.Attributes)
          && rule.type === Selector.Attributes
        ) {
          continue
        }
        if (
          !(mask & SpecificityFlags.NthOfType)
          && rule.type === Selector.NthOfType
        ) {
          continue
        }
        if (
          this.hasId
          && mask & SpecificityFlags.Id
          && rule.type === Selector.Class
        ) {
          continue
        }

        switch (rule.type) {
          case Selector.Id: {
            selector += '#' + rule.value
            break
          }
          case Selector.Class: {
            selector += '.' + rule.value.join('.')
            break
          }
          case Selector.Attributes: {
            for (const attribute of rule.value) {
              const sourceAttr = this.elem.getAttribute(attribute.attr)
              let op = '*='
              if (attribute.attr === sourceAttr) {
                op = '='
              } else if (attribute.attr.startsWith(sourceAttr)) {
                op = '^='
              }
              // Escape attribute and its values for CSS selector
              selector +=
                `[${CSS.escape(attribute.attr)}${op}`
                + `"${CSS.escape(attribute.value)}"]`
            }
            break
          }
          case Selector.NthOfType: {
            // NOTE: this selector is not valid without calling addTag(..)
            selector += `:nth-of-type(${rule.value})`
            break
          }
          default: {
            /* Unreachable */
          }
        }
      }
      return selector
    }
  }

  // We search for a CSS selector for the target element. We want the most
  // specific identifiers.
  const cssSelectorFromElement = (elem: Element): ElementSelectorBuilder => {
    const builder = new ElementSelectorBuilder(elem)

    // ID
    if (
      elem.id.length > 0
      // Ensure the escaped ID is unique in the document
      // to avoid ambiguous selectors
      && document.querySelectorAll(`#${CSS.escape(elem.id)}`).length === 1
    ) {
      builder.addRule({
        type: Selector.Id,
        value: CSS.escape(elem.id),
      })
    }

    // Class names
    if (elem.classList.length > 0) {
      builder.addRule({
        type: Selector.Class,
        value: Array.from(elem.classList).map((c: string) => CSS.escape(c)),
      })
    }

    const tag = CSS.escape(elem.localName)

    // Attributes. Only try these if we have no matches.
    if (builder.size() === 0) {
      const attributes = []
      switch (tag) {
        case 'a': {
          // Get URL, removing query parameters and hash
          const url = elem.getAttribute('href')?.trim().split(/[?#]/)[0]
          if (url !== undefined && url.length > 0) {
            attributes.push({
              attr: 'href',
              value: url,
            })
          }
          break
        }
        case 'iframe': {
          const url = elem.getAttribute('src')?.trim()
          if (url !== undefined && url.length > 0) {
            attributes.push({
              attr: 'src',
              value: url.slice(0, 256),
            })
          }
          break
        }
        case 'img': {
          let data = elem.getAttribute('src')?.trim()
          if (data !== undefined && data.length > 0) {
            // https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs
            if (data.startsWith('data:')) {
              data = data.split(',')[1]!.slice(0, 256)
            }
          }
          if (data === undefined || data.length === 0) {
            const alttext = elem.getAttribute('alt')?.trim()
            if (alttext !== undefined && alttext.length > 0) {
              attributes.push({
                attr: 'alt',
                value: alttext,
              })
            }
          } else {
            attributes.push({
              attr: 'src',
              value: data,
            })
          }
          break
        }
        default: {
          break
        }
      }
      if (attributes.length > 0) {
        builder.addRule({
          type: Selector.Attributes,
          value: attributes,
        })
      }
    }

    const querySelectorNoExcept = (
      node: Element | null,
      selector: string,
    ): Element[] => {
      if (node !== null) {
        try {
          const r = node.querySelectorAll(selector)
          return Array.from(r)
        } catch {
          /* Deliberately left empty */
        }
      }
      return []
    }

    if (
      builder.size() === 0
      || querySelectorNoExcept(elem.parentElement, builder.toString()).length > 1
    ) {
      builder.addTag(tag)
      if (
        querySelectorNoExcept(elem.parentElement, builder.toString()).length > 1
      ) {
        let index = 1
        let sibling: Element | null = elem.previousElementSibling
        while (sibling !== null) {
          if (sibling.localName === tag) {
            index++
          }
          sibling = sibling.previousElementSibling
        }
        builder.addRule({
          type: Selector.NthOfType,
          value: index,
        })
      }
    }
    return builder
  }

  const elementPickerOnKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      event.preventDefault()
      quitElementPicker()
    }
  }

  const elementPickerViewportChanged = () => {
    recalculateAndSendTargets(null)
  }

  const quitElementPicker = () => {
    if (pickerDiv !== null) {
      document.documentElement.removeChild(pickerDiv)
    }

    // Tear down element picker listeners
    document.removeEventListener('keydown', elementPickerOnKeydown, true)
    document.removeEventListener('resize', elementPickerViewportChanged)
    document.removeEventListener('scroll', elementPickerViewportChanged)
  }

  const attachElementPicker = () => {
    // "src" is a web accessible resource since the URI is chrome-extension://.
    // This ensures a malicious page cannot modify the iframe contents.
    pickerDiv = document.createElement('div')
    pickerDiv.id = 'brave-element-picker'
    shadowRoot = pickerDiv.attachShadow({ mode: 'closed' })

    // This is trusted content so it's safe to use innerHTML.
    shadowRoot.innerHTML = pickerHTML

    const pickerCSSStyle: string = [
      'background: transparent',
      'border: 0',
      'border-radius: 0',
      'box-shadow: none',
      'color-scheme: light dark',
      'display: block',
      'height: 100lvh',
      'left: 0',
      'margin: 0',
      'max-height: none',
      'max-width: none',
      'opacity: 1',
      'outline: 0',
      'padding: 0',
      'pointer-events: auto',
      'position: fixed',
      'top: 0',
      'visibility: visible',
      'width: 100%',
      'z-index: 2147483647',
      '--dynamic-color-rgb: rgb(0, 0, 0)',
      '',
    ].join(' !important;')

    pickerDiv.setAttribute('style', pickerCSSStyle)
    document.documentElement.appendChild(pickerDiv)

    // Setup listeners to assist element picker
    document.addEventListener('keydown', elementPickerOnKeydown, true)
    window.addEventListener('resize', elementPickerViewportChanged)
    window.addEventListener('scroll', elementPickerViewportChanged)

    return shadowRoot
  }

  interface TargetRect {
    x: number
    y: number
    width: number
    height: number
  }

  class Target {
    element: Element
    rectElem!: Element
    coord: TargetRect

    constructor(elem: Element) {
      this.element = elem
      this.coord = targetRectFromElement(this.element)
    }

    forceRecalcCoords() {
      this.coord = targetRectFromElement(this.element)
    }
  }

  class TargetsCollection {
    targets: Target[] = []
    togglePicker: ((val: boolean) => void) | null = null
    reset(elems: Element[]) {
      this.targets.length = 0
      elems.forEach((elem: Element) => {
        this.targets.push(new Target(elem))
      })
    }

    forceRecalcCoords() {
      this.targets.forEach((t) => t.forceRecalcCoords())
      // for case when element no longer in the DOM
      this.targets = this.targets.filter(
        (item) => item.coord.height !== 0 && item.coord.width !== 0,
      )
      if (this.targets.length === 0 && this.togglePicker) {
        this.togglePicker(false)
      }
    }

    size() {
      return this.targets.length
    }
  }

  const targetRectFromElement = (elem: Element): TargetRect => {
    const rect = elem.getBoundingClientRect()
    return {
      x: rect.left,
      y: rect.top,
      width: rect.right - rect.left,
      height: rect.bottom - rect.top,
    }
  }

  let lastHoveredElem: HTMLElement | null = null
  const targetedElems = new TargetsCollection()

  const recalculateAndSendTargets = (elems: Element[] | null) => {
    if (elems) {
      targetedElems.reset(elems)
    } else {
      targetedElems.forceRecalcCoords()
    }

    highlightElements()
  }

  const hideByCssSelector = (selector: string) => {
    const styleId = 'brave-content-picker-style'
    let style = document.getElementById(styleId)
    if (!style) {
      style = document.createElement('style')
      style.id = styleId
      document.head.appendChild(style)
    }
    style.innerText += `${selector} {display: none !important;}`
  }

  interface SliderOptions {
    onChange?: (value: number) => void
  }

  interface SliderAPI {
    getValue: () => number
    min: number
    max: number
  }

  const onTargetSelected = (selected: Element | null, index: number): string => {
    if (lastHoveredElem === null) {
      return ''
    }

    let elem: Element | null = selected
    const selectorBuilders = []
    const specificityMasks = [
      0b01101, // No DOM hierarchy, no nth-of-type
      0b11101, // No DOM hierarchy
      0b01011, // No nth-of-type, no attributes
      0b10011, // No attributes, no class names
      0b11111, // All selector rules (default)
    ]
    const mask: number = specificityMasks[index]!

    if (mask & SpecificityFlags.Hierarchy) {
      while (elem !== null && elem !== document.body) {
        selectorBuilders.push(cssSelectorFromElement(elem))
        elem = elem.parentElement
      }
    } else {
      selectorBuilders.push(cssSelectorFromElement(selected!))
    }
    // TODO: insert the body if using nth-type-of

    let i = 0
    for (; i < selectorBuilders.length; i++) {
      const b = selectorBuilders[i]
      try {
        if (
          (mask & SpecificityFlags.Id && b!.hasId)
          || document.querySelectorAll(b!.toString(mask)).length === 1
        ) {
          break
        }
      } catch {
        continue
      }
    }
    const selector = selectorBuilders
      .slice(0, i + 1)
      .reverse()
      .map((b) => b.toString(mask))
      .join(' > ')
    return selector
  }

  const elementPickerHoverCoordsChanged = (x: number, y: number) => {
    const elem = elementFromFrameCoords(x, y)
    if (elem instanceof HTMLElement && elem !== lastHoveredElem) {
      recalculateAndSendTargets([elem])
      lastHoveredElem = elem
    }
  }

  const getElementBySelector = (selector: string) => {
    let elements: Element[] | null
    const nodeList = document.querySelectorAll(selector)
    elements = nodeList.length > 0 ? Array.from(nodeList) : null
    return elements
  }

  const elementPickerUserSelectedTarget = (specificity: number) => {
    if (lastHoveredElem instanceof HTMLElement) {
      const selector = onTargetSelected(lastHoveredElem, specificity)
      if (selector !== '') {
        try {
          recalculateAndSendTargets(getElementBySelector(selector))
        } catch {}
      }
      return {
        isValid: selector !== '',
        selector: selector.trim(),
      }
    }
    return {
      isValid: false,
      selector: '',
    }
  }

  const elementPickerUserModifiedRule = (selector: string) => {
    if (selector.length > 0) {
      try {
        recalculateAndSendTargets(Array.from(document.querySelectorAll(selector)))
      } catch {}
    }
  }

  const setShowRulesHiddenBtnState = (
    showRulesButton: HTMLElement | null,
    show: boolean,
  ) => {
    if (!showRulesButton) return
    showRulesButton.textContent = show ? btnHideRulesBoxText : btnShowRulesBoxText
  }

  const setMinimizeState = (minimized: boolean) => {
    if (!shadowRoot) {
      return
    }
    const mainSection = shadowRoot.getElementById('main-section')
    if (mainSection) {
      mainSection.classList.toggle('minimized', minimized)
    }
  }

  function initSlider(
    element: HTMLElement | null,
    options: SliderOptions = {},
  ): SliderAPI | undefined {
    if (!element) return

    const inputElement = element as HTMLInputElement
    if (!inputElement) return

    const min = parseInt(inputElement.min ?? '1', 10)
    const max = parseInt(inputElement.max ?? '4', 10)
    const initialValue = 4

    inputElement.tabIndex = 0

    let currentValue = initialValue

    const updateSlider = (fireEvent: boolean): number => {
      const value = parseFloat(inputElement.value)
      const currMin = parseFloat(inputElement.min)
      const currMax = parseFloat(inputElement.max)

      const percentage = ((value - currMin) / (currMax - currMin)) * 100

      inputElement.style.setProperty('--value', `${percentage}%`)

      currentValue = value

      if (fireEvent && options.onChange) {
        options.onChange(currentValue)
      }
      return value
    }

    inputElement.addEventListener('input', () => updateSlider(true))

    // Initial update
    updateSlider(false)
    // Return API for external control
    return {
      getValue: () => currentValue,
      min,
      max,
    }
  }

  const launchElementPicker = (root: ShadowRoot) => {
    let hasSelectedTarget = false

    const btnShowRulesBox = root.getElementById('btn-show-rules-box')
    if (isAndroid && btnShowRulesBox) {
      btnShowRulesBox.style.display = 'none'
    }

    if (isAndroid) {
      const minimizeButton = root.getElementById('card-header')!
      minimizeButton.addEventListener('click', () => {
        setMinimizeState(true)
      })
    } else {
      const closeButton = root.getElementById('close-btn')!
      closeButton.addEventListener('click', () => {
        quitElementPicker()
      })
      const minimizeButton = root.getElementById('minimize-dlg-btn')!
      minimizeButton.addEventListener('click', () => {
        setMinimizeState(true)
      })
    }
    const maximizeButton = root.getElementById('desktop-min-icon-container')!
    maximizeButton.addEventListener('click', () => {
      setMinimizeState(false)
    })

    const sliderElement = root.getElementById('custom-slider')
    const slider = initSlider(sliderElement, {
      onChange: () => {
        dispatchSelect()
      },
    })

    root.addEventListener(
      'keydown',
      (event) => {
        if ((event as KeyboardEvent).key === 'Escape') {
          event.stopPropagation()
          event.preventDefault()
          quitElementPicker()
        }
      }
    )

    const svg = root.getElementById('picker-ui')!
    if (
      window.matchMedia('(pointer: fine)').matches
      && window.matchMedia('(hover: hover)').matches
    ) {
      svg.addEventListener(
        'mousemove',
        (event) => {
          if (!hasSelectedTarget) {
            elementPickerHoverCoordsChanged(event.clientX, event.clientY)
          }
          event.stopPropagation()
        },
        true,
      )
    }

    const rulesTextArea: HTMLInputElement = root.querySelector(
      '#rules-box > textarea',
    )!
    let textInputTimer: any = null
    rulesTextArea.addEventListener('input', () => {
      clearTimeout(textInputTimer)
      textInputTimer = setTimeout(() => {
        const selector = rulesTextArea.value.trim()
        if (selector.length > 0) {
          elementPickerUserModifiedRule(selector)
        }
      }, 700)
    })
    rulesTextArea.addEventListener('focus', () => {
      hasSelectedTarget = true
      togglePopup(true)
    })

    const section = root.getElementById('main-section')!
    const enableButtons = (isDisabled: boolean) => {
      const elements = root.querySelectorAll('.button')
      elements.forEach((element) => {
        if (isDisabled) {
          element.classList.add('disabled')
        } else {
          element.classList.remove('disabled')
        }
      })
    }

    if (!isAndroid) {
      section.classList.add('desktop')
    }

    const togglePopup = (show: boolean) => {
      enableButtons(!show)
      if (show) {
        createButton.textContent = btnCreateEnabledText
      } else {
        createButton.textContent = btnCreateDisabledText
      }
      if (!isAndroid) {
        section.style.setProperty('opacity', show ? '1' : '0.2')
      }
    }
    targetedElems.togglePicker = togglePopup

    if (isAndroid) {
      const sc = root.getElementById('slider-container') as HTMLInputElement
      sc.style.display = 'none'
    }
    const setTitleBarColor = (bgcolor: number) => {
      const section = root.host as HTMLElement
      if (section) {
        const r = (bgcolor >> 16) & 0xff
        const g = (bgcolor >> 8) & 0xff
        const b = bgcolor & 0xff
        section.style.setProperty('--dynamic-color-rgb', `rgb(${r}, ${g}, ${b})`)
      }
    }
    const retrieveTheme = () => {
      api.getElementPickerThemeInfo(
        // @ts-ignore Unread value
        (isDarkModeEnabled: boolean, bgcolor: number) => {
          const bgcolorMaskOut = bgcolor & 0xffffff
          const colorHex = `#${bgcolorMaskOut.toString(16).padStart(6, '0')}`
          section.style.setProperty('--theme-background-color', colorHex)
          setTitleBarColor(bgcolor)
          dispatchSelect()
        },
      )
    }
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)')
    const handleColorSchemeChange = () => {
      retrieveTheme()
    }
    prefersDarkScheme.addEventListener('change', handleColorSchemeChange)
    retrieveTheme()

    const dispatchSelect = () => {
      const { isValid, selector } = elementPickerUserSelectedTarget(
        slider?.getValue() ?? 4,
      )

      hasSelectedTarget = isValid
      togglePopup(isValid)
      rulesTextArea.value = selector
    }

    const oneClickEventHandler = (event: MouseEvent | TouchEvent) => {
      let elem: Element | null = null

      setMinimizeState(false)

      if (event instanceof MouseEvent) {
        elem = elementFromFrameCoords(event.clientX, event.clientY)
      } else if (event instanceof TouchEvent) {
        const touch = event.touches[0]!
        elem = elementFromFrameCoords(touch.clientX, touch.clientY)
      }

      if (elem) {
        recalculateAndSendTargets([elem])
        lastHoveredElem = elem as HTMLElement
      }

      dispatchSelect()
    }

    svg.addEventListener('click', oneClickEventHandler)

    const createButton = root.getElementById('btn-create')!
    createButton.addEventListener('click', () => {
      if (createButton.classList.contains('block-button-disabled')) {
        return
      }
      const selector = rulesTextArea.value.trim()
      if (selector.length > 0) {
        api.cosmeticFilterCreate(selector)
        hideByCssSelector(selector)
        quitElementPicker()
      }
    })

    const quitButton = root.getElementById('btn-quit')!
    quitButton.addEventListener('click', () => {
      quitElementPicker()
    })

    const toggleDisplay = (
      target: HTMLElement | null,
      trigger: HTMLElement | null,
    ) => {
      if (!target || !trigger) {
        return
      }
      trigger.addEventListener('click', () => {
        if (target.style.display !== 'block') {
          target.style.display = 'block'
          setShowRulesHiddenBtnState(trigger, true)
        } else {
          target.style.display = 'none'
          setShowRulesHiddenBtnState(trigger, false)
        }
      })
    }
    const rulesBox = root.getElementById('rules-box')!
    const showRulesButton = root.getElementById('btn-show-rules-box')!
    toggleDisplay(rulesBox, showRulesButton)
  }

  const highlightElements = () => {
    if (!shadowRoot) return
    const svg = shadowRoot.getElementById('picker-ui')!
    const svgMask = shadowRoot.getElementById('highlight-mask')!

    svg.querySelectorAll('.mask').forEach((el) => el.remove())

    const svgMaskFragment = document.createDocumentFragment()
    const svgFragment = document.createDocumentFragment()

    const createMaskElement = (): SVGRectElement => {
      const mask = document.createElementNS(NSSVG, 'rect')
      mask.classList.add('mask')
      mask.rx.baseVal.value = 10
      mask.setAttribute('px', '10px')
      mask.setAttribute('stroke-linejoin', 'round')
      return mask
    }

    for (const target of targetedElems.targets) {
      // Add the mask to the SVG definition so the dark background is removed
      const mask = createMaskElement()
      mask.x.baseVal.value = target.coord.x
      mask.y.baseVal.value = target.coord.y
      mask.width.baseVal.value = target.coord.width
      mask.height.baseVal.value = target.coord.height
      mask.rx.baseVal.value = 10
      svgMaskFragment.appendChild(mask)

      // Use the same element, but add the target class which turns the
      // target rectangle orange
      const targetingArea = mask.cloneNode(false) as SVGRectElement
      targetingArea.classList.add('target')
      target.rectElem = targetingArea

      svgFragment.appendChild(targetingArea)
    }
    svgMask.appendChild(svgMaskFragment)
    svg.appendChild(svgFragment)
  }

  const localizeTextData = (
    root: ShadowRoot,
    btnCrDisText: string,
    btnCrEnblText: string,
    btnShowRulesText: string,
    btnHideRulesText: string,
    btnQuitText: string,
  ) => {
    btnCreateDisabledText = btnCrDisText
    btnCreateEnabledText = btnCrEnblText
    btnShowRulesBoxText = btnShowRulesText
    btnHideRulesBoxText = btnHideRulesText
    const btnCreate = root.getElementById('btn-create')
    if (btnCreate) {
      btnCreate.textContent = btnCreateDisabledText
    }
    const btnShowRulesBox = root.getElementById('btn-show-rules-box')
    if (btnShowRulesBox) {
      btnShowRulesBox.textContent = btnShowRulesBoxText
    }
    const btnQuit = root.getElementById('btn-quit')
    if (btnQuit) {
      btnQuit.textContent = btnQuitText
    }
  }

  const active = document.getElementById('brave-element-picker')
  if (!active) {
    isAndroid = api.getPlatform() === 'android'
    const root = attachElementPicker()
    api.getLocalizedTexts(
      (
        btnCreateDisabledText: string,
        btnCreateEnabledText: string,
        btnShowRulesBoxText: string,
        btnHideRulesBoxText: string,
        btnQuitText: string,
      ) => {
        localizeTextData(
          root,
          btnCreateDisabledText,
          btnCreateEnabledText,
          btnShowRulesBoxText,
          btnHideRulesBoxText,
          btnQuitText,
        )
        launchElementPicker(root)
      },
    )
  } else {
    // Re-opening existing picker
    setMinimizeState(false)
  }
})();
