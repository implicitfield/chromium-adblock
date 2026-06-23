// Copyright (c) 2020 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

// This is a combination of various files from brave-core, including
// global.d.ts, chromel.d.ts, procedural_filters.ts.

// brave seems to have a much more lax compilation setup for typescript
// files, so lots of "!" operators and misc hacks have been added in various
// places.

// This script is executed from
// components/cosmetic_filters/content/renderer/cosmetic_filters_js_handler.cc
// several times:
// - for cosmetic filters work with CSS and stylesheet. That work itself
//   could call the script several times.

type CSSSelector = string
type CSSInstruction = string
type CSSValue = string

type OperatorType = string

type StyleAction = {
  type: 'style'
  arg: string
}
type RemoveAction = {
  type: 'remove'
}
type RemoveAttrAction = {
  type: 'remove-attr'
  arg: string
}
type RemoveClassAction = {
  type: 'remove-class'
  arg: string
}

type CosmeticFilterAction = StyleAction | RemoveAction | RemoveAttrAction | RemoveClassAction;

interface ProceduralOperator {
  type: OperatorType
  arg: string
}
type ProceduralSelector = ProceduralOperator[];
type ProceduralActionFilter = {
  selector: ProceduralSelector
  action?: CosmeticFilterAction
}

interface Window {
  alreadyInserted: boolean
  content_cosmetic: {
    cosmeticStyleSheet: CSSStyleSheet
    allSelectorsToRules: Map<string, number>
    observingHasStarted: boolean
    generichide: boolean
    firstRunQueue: Set<string>
    secondRunQueue: Set<string>
    finalRunQueue: Set<string>
    allQueues: Set<string>[]
    numQueues: any
    alreadyUnhiddenSelectors: Set<string>
    _hasDelayOcurred: boolean
    _startCheckingId: number | undefined
    firstSelectorsPollingDelayMs: number | undefined
    switchToSelectorsPollingThreshold : number | undefined
    fetchNewClassIdRulesThrottlingMs : number | undefined
    tryScheduleQueuePump: (() => void)
    proceduralActionFilters?: ProceduralActionFilter[]
    hasProceduralActions: boolean
  }
}

type OperatorArg = CSSSelector | ProceduralSelector | string
type OperatorResult = HTMLElement[]

type UnboundStringFunc = (arg: string, element: HTMLElement) => OperatorResult
type UnboundChildRuleOrStringFunc = (
  arg: string | ProceduralSelector,
  element: HTMLElement,
) => OperatorResult
type UnboundOperatorFunc = UnboundStringFunc | UnboundChildRuleOrStringFunc
type OperatorFunc = (element: HTMLElement) => OperatorResult

/* post-processed for convenient usage in JS */
interface CompiledProceduralOperator {
  type: OperatorType
  func: OperatorFunc
  args: OperatorArg[]
}
type CompiledProceduralSelector = CompiledProceduralOperator[]

type NeedlePosition = number
type TextMatchRule = (targetText: string, exact?: boolean) => boolean
type KeyValueMatchRules = [
  keyMatchRule: TextMatchRule,
  valueMatchRule: TextMatchRule | undefined,
]

/**
 *
 * src/main.ts
 *
 */

const W = window

const _asHTMLElement = (node: Node): HTMLElement | null => {
  return node instanceof HTMLElement ? node : null
}

const _compileRegEx = (regexText: string): RegExp => {
  const regexParts = regexText.split('/')
  const regexPattern = regexParts[1]
  const regexArgs = regexParts[2]
  const regex = new W.RegExp(regexPattern!, regexArgs)
  return regex
}

// Check to see if the string `value` either
// contains the the string `test` (if `test` does
// not start with `/`) or if the string
// value matches the regex `test`.
// We assume if test isn't a string, its a regex object.
//
// Rules:
//   - if `test` starts with `/` we treat it as a regex
//     literal
//   - if `text` is an empty string, we treat it as
//     matching any case where value is only whitespace
//   - otherwise, check to see if value contains the
//     string `test`
//
// If `exact` is true, then the string case it tested
// for an exact match (the regex case is not affected).
const _testMatches = (
  test: string,
  value: string,
  exact: boolean = false,
): boolean => {
  if (test[0] === '/') {
    return value.match(_compileRegEx(test)) !== null
  }
  if (test === '') {
    return value.trim() === ''
  }
  if (exact) {
    return value === test
  }
  return value.includes(test)
}

/**
 * Returns the key part of the `key=value` pair and the index of the start of
 * the value part, or just the key with `undefined` if there is no value part
 */
const _extractKeyFromStr = (text: string): [string, number?] => {
  const quotedTerminator = '"='
  const unquotedTerminator = '='
  const isQuotedCase = text[0] === '"'

  const [terminator, needlePosition] = isQuotedCase
    ? [quotedTerminator, 1]
    : [unquotedTerminator, 0]

  const indexOfTerminator = text.indexOf(terminator, needlePosition)
  if (indexOfTerminator === -1) {
    // No key/value separator found, attempt to extract plain key instead
    let key = text
    if (isQuotedCase) {
      if (!text.endsWith('"')) {
        throw new Error(`Quoted value '${text}' does not terminate with quote`)
      }
      key = text.slice(1, text.length - 1)
    }
    return [key, undefined]
  }

  const testCaseStr = text.slice(needlePosition, indexOfTerminator)
  const finalNeedlePosition = indexOfTerminator + terminator.length

  return [testCaseStr, finalNeedlePosition]
}

const _extractValueMatchRuleFromStr = (
  text: string,
  uriEncode = false,
  needlePosition = 0,
): TextMatchRule => {
  const testCaseStr = _extractValueFromStr(text, uriEncode, needlePosition)
  const testCaseFunc = _testMatches.bind(undefined, testCaseStr)
  return testCaseFunc
}

const _extractValueFromStr = (
  text: string,
  uriEncode = false,
  needlePosition = 0,
): string => {
  const isQuotedCase = text[needlePosition] === '"'
  let endIndex: number

  if (isQuotedCase) {
    if (text.at(-1) !== '"') {
      throw new Error(
        `Unable to parse value rule from ${text}. Value rule starts with `
          + '" but doesn\'t end with "',
      )
    }
    needlePosition += 1
    endIndex = text.length - 1
  } else {
    endIndex = text.length
  }

  let testCaseStr = text.slice(needlePosition, endIndex)
  if (uriEncode) {
    testCaseStr = testCaseStr.replace(/\P{ASCII}/gu, (c) =>
      encodeURIComponent(c),
    )
  }

  return testCaseStr
}

// Parse an argument like `"abc"="xyz"` into
// a test for the key, and a test for the value.
// This will return two functions then, that you
// should use for checking the key and values
// in your test case.
//
// const key = ..., value = ...
// const [keyTestFunc, valueTestFunc] = _parseKeyValueMatchArg(arg)
//
// if (keyTestFunc(key))) {
//   // key matches the test condition
// }
const _parseKeyValueMatchRules = (arg: string): KeyValueMatchRules => {
  const [key, needlePos] = _extractKeyFromStr(arg)
  const keyMatchRule = (arg: string) => _testMatches(key, arg, true)
  let valueMatchRule: TextMatchRule | undefined
  if (needlePos !== undefined) {
    const value = _extractValueFromStr(arg, false, needlePos)
    valueMatchRule = (arg: string) => _testMatches(value, arg, true)
  }
  return [keyMatchRule, valueMatchRule]
}

const _parseCSSInstruction = (arg: string): [CSSInstruction, CSSValue] => {
  const rs = arg.split(':')
  if (rs.length !== 2) {
    throw Error(`Unexpected format for a CSS rule: ${arg}`)
  }
  return [rs[0]!.trim(), rs[1]!.trim()]
}

const _allOtherSiblings = (element: HTMLElement): HTMLElement[] => {
  if (!element.parentNode) {
    return []
  }
  const siblings = Array.from(element.parentNode.children)
  const otherHTMLElements = []
  for (const sib of siblings) {
    if (sib === element) {
      continue
    }
    const siblingHTMLElement = _asHTMLElement(sib)
    if (siblingHTMLElement !== null) {
      otherHTMLElements.push(siblingHTMLElement)
    }
  }
  return otherHTMLElements
}

const _nextSiblingElement = (element: HTMLElement): HTMLElement | null => {
  if (!element.parentNode) {
    return null
  }
  const siblings = W.Array.from(element.parentNode.children)
  const indexOfElm = siblings.indexOf(element)
  const nextSibling = siblings[indexOfElm + 1]
  if (nextSibling === undefined) {
    return null
  }
  return _asHTMLElement(nextSibling)
}

const _allChildren = (element: HTMLElement): HTMLElement[] => {
  return W.Array.from(element.children)
    .map((e) => _asHTMLElement(e))
    .filter((e) => e !== null)
}

const _allChildrenRecursive = (element: HTMLElement): HTMLElement[] => {
  return W.Array.from(element.querySelectorAll(':scope *'))
    .map((e) => _asHTMLElement(e))
    .filter((e) => e !== null)
}

const _stripCssOperator = (operator: string, selector: string) => {
  if (selector[0] !== operator) {
    throw new Error(
      `Expected to find ${operator} in initial position of "${selector}`,
    )
  }
  return selector.replace(operator, '').trimStart()
}

// Implementation of ":css-selector" rule
const operatorCssSelector = (
  selector: CSSSelector,
  element: HTMLElement,
): OperatorResult => {
  const trimmedSelector = selector.trimStart()
  if (trimmedSelector.startsWith('+')) {
    const subOperator = _stripCssOperator('+', trimmedSelector)
    if (subOperator === null) {
      return []
    }
    const nextSibNode = _nextSiblingElement(element)
    if (nextSibNode === null) {
      return []
    }
    return nextSibNode.matches(subOperator) ? [nextSibNode] : []
  } else if (trimmedSelector.startsWith('~')) {
    const subOperator = _stripCssOperator('~', trimmedSelector)
    if (subOperator === null) {
      return []
    }
    const allSiblingNodes = _allOtherSiblings(element)
    return allSiblingNodes.filter((x) => x.matches(subOperator))
  } else if (trimmedSelector.startsWith('>')) {
    const subOperator = _stripCssOperator('>', trimmedSelector)
    if (subOperator === null) {
      return []
    }
    const allChildNodes = _allChildren(element)
    return allChildNodes.filter((x) => x.matches(subOperator))
  } else if (selector.startsWith(' ')) {
    return Array.from(element.querySelectorAll(':scope ' + trimmedSelector))
  }

  if (element.matches(selector)) {
    return [element]
  }
  return []
}

const _hasPlainSelectorCase = (
  selector: CSSSelector,
  element: HTMLElement,
): OperatorResult => {
  return element.matches(selector) ? [element] : []
}

const _hasProceduralSelectorCase = (
  selector: ProceduralSelector,
  element: HTMLElement,
): OperatorResult => {
  const shouldBeGreedy = selector[0]?.type !== 'css-selector'
  const initElements = shouldBeGreedy
    ? _allChildrenRecursive(element)
    : [element]
  const matches = compileAndApplyProceduralSelector(selector, initElements)
  return matches.length === 0 ? [] : [element]
}

// Implementation of ":has" rule
const operatorHas = (
  instruction: CSSSelector | ProceduralSelector,
  element: HTMLElement,
): OperatorResult => {
  if (W.Array.isArray(instruction)) {
    return _hasProceduralSelectorCase(instruction, element)
  } else {
    return _hasPlainSelectorCase(instruction, element)
  }
}

// Implementation of ":has-text" rule
const operatorHasText = (
  instruction: string,
  element: HTMLElement,
): OperatorResult => {
  const text = element.innerText
  const valueTest = _extractValueMatchRuleFromStr(instruction)
  return valueTest(text) ? [element] : []
}

const _notPlainSelectorCase = (
  selector: CSSSelector,
  element: HTMLElement,
): OperatorResult => {
  return element.matches(selector) ? [] : [element]
}

const _notProceduralSelectorCase = (
  selector: ProceduralSelector,
  element: HTMLElement,
): OperatorResult => {
  const matches = compileAndApplyProceduralSelector(selector, [element])
  return matches.length === 0 ? [element] : []
}

// Implementation of ":not" rule
const operatorNot = (
  instruction: CSSSelector | ProceduralSelector,
  element: HTMLElement,
): OperatorResult => {
  if (Array.isArray(instruction)) {
    return _notProceduralSelectorCase(instruction, element)
  } else {
    return _notPlainSelectorCase(instruction, element)
  }
}

// Implementation of ":matches-property" rule
const operatorMatchesProperty = (
  instruction: string,
  element: HTMLElement,
): OperatorResult => {
  const [keyTest, valueTest] = _parseKeyValueMatchRules(instruction)
  for (const [propName, propValue] of Object.entries(element)) {
    if (!keyTest(propName)) {
      continue
    }
    if (valueTest !== undefined && !valueTest(propValue)) {
      continue
    }
    return [element]
  }
  return []
}

// Implementation of ":min-text-length" rule
const operatorMinTextLength = (
  instruction: string,
  element: HTMLElement,
): OperatorResult => {
  const minLength = +instruction
  if (minLength === W.NaN) {
    throw new Error(`min-text-length: Invalid arg, ${instruction}`)
  }
  return element.innerText.trim().length >= minLength ? [element] : []
}

// Implementation of ":matches-attr" rule
const operatorMatchesAttr = (
  instruction: string,
  element: HTMLElement,
): OperatorResult => {
  const [keyTest, valueTest] = _parseKeyValueMatchRules(instruction)
  for (const attrName of element.getAttributeNames()) {
    if (!keyTest(attrName)) {
      continue
    }
    const attrValue = element.getAttribute(attrName)
    if (
      attrValue === null
      || (valueTest !== undefined && !valueTest(attrValue))
    ) {
      continue
    }
    return [element]
  }
  return []
}

// Implementation of ":matches-css-*" rules
const operatorMatchesCSS = (
  beforeOrAfter: string | null,
  cssInstruction: string,
  element: HTMLElement,
): OperatorResult => {
  const [cssKey, expectedVal] = _parseCSSInstruction(cssInstruction)
  const elmStyle = W.getComputedStyle(element, beforeOrAfter)
  const styleValue = elmStyle.getPropertyValue(cssKey)
  if (styleValue === undefined) {
    // We're querying for a style property that doesn't exist, which
    // trivially doesn't match then.
    return []
  }
  let matched
  if (expectedVal.startsWith('/') && expectedVal.endsWith('/')) {
    matched = styleValue.match(_compileRegEx(expectedVal)) !== null
  } else {
    matched = expectedVal === styleValue
  }
  return matched ? [element] : []
}

// Implementation of ":matches-media" rule
const operatorMatchesMedia = (
  instruction: string,
  element: HTMLElement,
): OperatorResult => {
  return W.matchMedia(instruction).matches ? [element] : []
}

// Implementation of ":matches-path" rule
const operatorMatchesPath = (
  instruction: string,
  element: HTMLElement,
): OperatorResult => {
  const pathAndQuery = W.location.pathname + W.location.search
  const matchRule = _extractValueMatchRuleFromStr(instruction, true)
  return matchRule(pathAndQuery) ? [element] : []
}

const _upwardIntCase = (
  intNeedle: NeedlePosition,
  element: HTMLElement,
): OperatorResult => {
  if (intNeedle < 1 || intNeedle >= 256) {
    throw new Error(`upward: invalid arg, ${intNeedle}`)
  }
  let currentElement: HTMLElement | ParentNode | null = element
  while (currentElement !== null && intNeedle > 0) {
    currentElement = currentElement.parentNode
    intNeedle -= 1
  }
  if (currentElement === null) {
    return []
  } else {
    const htmlElement = _asHTMLElement(currentElement)
    return htmlElement === null ? [] : [htmlElement]
  }
}

const _upwardProceduralSelectorCase = (
  selector: ProceduralSelector,
  element: HTMLElement,
): OperatorResult => {
  const childFilter = compileProceduralSelector(selector)
  let needle: ParentNode | HTMLElement | null = element
  while (needle !== null) {
    const currentElement = _asHTMLElement(needle)
    if (currentElement === null) {
      break
    }
    const matches = applyCompiledSelector(childFilter, [currentElement])
    if (matches.length !== 0) {
      return [currentElement]
    }
    needle = currentElement.parentNode
  }
  return []
}

const _upwardPlainSelectorCase = (
  selector: CSSSelector,
  element: HTMLElement,
): OperatorResult => {
  let needle: ParentNode | HTMLDocument | null = element
  while (needle !== null) {
    const currentElement = _asHTMLElement(needle)
    if (currentElement === null) {
      break
    }
    if (currentElement.matches(selector)) {
      return [currentElement]
    }
    needle = currentElement.parentNode
  }
  return []
}

// Implementation of ":upward" rule
const operatorUpward = (
  instruction: string | ProceduralSelector,
  element: HTMLElement,
): OperatorResult => {
  if (W.Number.isInteger(+instruction)) {
    return _upwardIntCase(+instruction, element)
  } else if (W.Array.isArray(instruction)) {
    return _upwardProceduralSelectorCase(instruction, element)
  } else {
    return _upwardPlainSelectorCase(instruction, element)
  }
}

// Implementation of ":xpath" rule
const operatorXPath = (
  instruction: string,
  element: HTMLElement,
): HTMLElement[] => {
  const result = W.document.evaluate(
    instruction,
    element,
    null,
    W.XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
    null,
  )
  const matches: HTMLElement[] = []
  let currentNode: Node | null
  while ((currentNode = result.iterateNext())) {
    const currentElement = _asHTMLElement(currentNode)
    if (currentElement !== null) {
      matches.push(currentElement)
    }
  }
  return matches
}

const ruleTypeToFuncMap: Record<OperatorType, UnboundOperatorFunc> = {
  'contains': operatorHasText,
  'css-selector': operatorCssSelector,
  'has': operatorHas,
  'has-text': operatorHasText,
  'matches-attr': operatorMatchesAttr,
  'matches-css': operatorMatchesCSS.bind(undefined, null),
  'matches-css-after': operatorMatchesCSS.bind(undefined, '::after'),
  'matches-css-before': operatorMatchesCSS.bind(undefined, '::before'),
  'matches-media': operatorMatchesMedia,
  'matches-path': operatorMatchesPath,
  'matches-property': operatorMatchesProperty,
  'min-text-length': operatorMinTextLength,
  'not': operatorNot,
  'upward': operatorUpward,
  'xpath': operatorXPath,
}

const compileProceduralSelector = (
  operators: ProceduralSelector,
): CompiledProceduralSelector => {
  const outputOperatorList = []
  for (const operator of operators) {
    const anOperatorFunc = ruleTypeToFuncMap[operator.type]
    const args = [operator.arg]
    if (anOperatorFunc === undefined) {
      throw new Error(
        `Not sure what to do with operator of type ${operator.type}`,
      )
    }

    outputOperatorList.push({
      type: operator.type,
      func: anOperatorFunc.bind(undefined, ...args),
      args,
    })
  }

  return outputOperatorList
}

// List of operator types that will be either globally true or false
// independent of the passed element. We use this list to optimize
// applying each operator (i.e., we just check the first element, and then
// accept or reject all elements in the consideration set accordingly).
const fastPathOperatorTypes: OperatorType[] = ['matches-media', 'matches-path']

const _determineInitNodesAndIndex = (
  selector: CompiledProceduralSelector,
  initNodes?: HTMLElement[],
): [number, HTMLElement[]] => {
  let nodesToConsider: HTMLElement[] = []
  let index = 0

  // A couple of special cases to consider.
  //
  // Case one: we're applying the procedural filter on a set of nodes (instead
  // of the entire document)  In this case, we already know which nodes to
  // consider, easy case.
  const firstOperator = selector[0]
  const firstOperatorType = firstOperator!.type
  const firstArg = firstOperator!.args[0]

  if (initNodes !== undefined) {
    nodesToConsider = W.Array.from(initNodes)
  } else if (firstOperatorType === 'css-selector') {
    const selector = firstArg as CSSSelector
    // Case two: we're considering the entire document, and the first operator
    // is a 'css-selector'. Here, we just special case using querySelectorAll
    // instead of starting with the full set of possible nodes.
    nodesToConsider = W.Array.from(W.document.querySelectorAll(selector))
    index += 1
  } else if (firstOperatorType === 'xpath') {
    const xpath = firstArg as string
    nodesToConsider = operatorXPath(xpath, W.document.documentElement)
    index += 1
  } else {
    // Case three: we gotta apply the first operator to the entire document.
    // Yuck but un-avoidable.
    const allNodes = W.Array.from(W.document.all)
    nodesToConsider = allNodes.filter(_asHTMLElement) as HTMLElement[]
  }
  return [index, nodesToConsider]
}

const applyCompiledSelector = (
  selector: CompiledProceduralSelector,
  initNodes?: HTMLElement[],
): HTMLElement[] => {
  const initState = _determineInitNodesAndIndex(selector, initNodes)
  let [index, nodesToConsider] = initState
  const numOperators = selector.length
  for (index; nodesToConsider.length > 0 && index < numOperators; ++index) {
    const operator = selector[index]
    const operatorFunc = operator!.func
    const operatorType = operator!.type

    // Note that we special case the :matches-path case here, since if
    // if it passes for one element, then it will pass for all elements.
    if (fastPathOperatorTypes.includes(operatorType)) {
      const firstNode = nodesToConsider[0]
      if (operatorFunc(firstNode!).length === 0) {
        nodesToConsider = []
      }
      // Note that unless we've taken the if-true branch above, then
      // the nodesToConsider array will still have all the elements
      // it started with.
      continue
    }

    let newNodesToConsider: HTMLElement[] = []
    for (const aNode of nodesToConsider) {
      const result = operatorFunc(aNode)
      newNodesToConsider = newNodesToConsider.concat(result)
    }
    nodesToConsider = newNodesToConsider
  }

  return nodesToConsider
}

const compileAndApplyProceduralSelector = (
  selector: ProceduralSelector,
  initElements: HTMLElement[],
): HTMLElement[] => {
  const compiled = compileProceduralSelector(selector)
  return applyCompiledSelector(compiled, initElements)
}

declare namespace cf_worker {
  const addSiteCosmeticFilter: (selector: string) => void
  const manageCustomFilters: () => void
  const getElementPickerThemeInfo: () =>
    Promise<{isDarkModeEnabled: boolean; bgcolor: number}>
  const getLocalizedTexts: () =>
    Promise<{btnCreateDisabledText: string;
        btnCreateEnabledText: string;
        btnManageText: string;
        btnShowRulesBoxText: string;
        btnHideRulesBoxText: string;
        btnQuitText: string}>
  const getPlatform: () => string
}

/**
 *
 * content_cosmetic.ts
 *
 */

// Start looking for things to unhide before at most this long after
// the backend script is up and connected (eg backgroundReady = true),
// or sooner if the thread is idle.
const maxTimeMSBeforeStart = 2500

const returnToMutationObserverIntervalMs = 10000

const selectorsPollingIntervalMs = 500
let selectorsPollingIntervalId: number | undefined

// The number of potentially new selectors that are processed during the last
// |scoreCalcIntervalMs|.
let currentMutationScore = 0
// The time frame used to calc |currentMutationScore|.
const scoreCalcIntervalMs = 1000
// The begin of the time frame to calc |currentMutationScore|.
let currentMutationStartTime = performance.now()

// The next allowed time to call FetchNewClassIdRules() if it's throttled.
let nextFetchNewClassIdRulesCall = 0
let fetchNewClassIdRulesTimeoutId: number | undefined

// Generate a random string between [a000000000, zzzzzzzzzz] (base 36)
const generateRandomAttr = () => {
  const min = Number.parseInt('a000000000', 36)
  const max = Number.parseInt('zzzzzzzzzz', 36)
  return Math.floor(Math.random() * (max - min) + min).toString(36)
}

const globalStyleAttr = generateRandomAttr()
const styleAttrMap = new Map<string, string>()

const queriedIds = new Set<string>()
const queriedClasses = new Set<string>()

const notYetQueriedElements: Array<Element[] | NodeListOf<Element>> = []

const classIdWithoutHtmlOrBody =
  '[id]:not(html):not(body),[class]:not(html):not(body)'

// Each of these get setup once the mutation observer starts running.
let notYetQueriedClasses: string[] = []
let notYetQueriedIds: string[] = []

window.content_cosmetic = window.content_cosmetic || {}
const CC = window.content_cosmetic

CC.cosmeticStyleSheet = CC.cosmeticStyleSheet || new CSSStyleSheet()
CC.allSelectorsToRules = CC.allSelectorsToRules || new Map<string, number>()
CC.observingHasStarted = CC.observingHasStarted || false
// All new selectors go in `firstRunQueue`
CC.firstRunQueue = CC.firstRunQueue || new Set<string>()
// Third party matches go in the second and third queues.
CC.secondRunQueue = CC.secondRunQueue || new Set<string>()
// Once a selector gets in to this queue, it's only evaluated for 1p content one
// more time.
CC.finalRunQueue = CC.finalRunQueue || new Set<string>()
CC.allQueues = CC.allQueues || [
  CC.firstRunQueue,
  CC.secondRunQueue,
  CC.finalRunQueue,
]
CC.numQueues = CC.numQueues || CC.allQueues.length
CC.alreadyUnhiddenSelectors = CC.alreadyUnhiddenSelectors || new Set<string>()
CC._hasDelayOcurred = CC._hasDelayOcurred || false
CC._startCheckingId = CC._startCheckingId || undefined

CC.firstSelectorsPollingDelayMs = CC.firstSelectorsPollingDelayMs || undefined
CC.switchToSelectorsPollingThreshold =
  CC.switchToSelectorsPollingThreshold || undefined
CC.fetchNewClassIdRulesThrottlingMs =
  CC.fetchNewClassIdRulesThrottlingMs || undefined

/**
 * Provides a new function which can only be scheduled once at a time.
 *
 * @param onIdle function to run when the thread is less busy
 * @param timeout max time to wait. at or after this time the function will be run regardless of thread noise
 */
const idleize = (onIdle: Function, timeout: number) => {
  let idleId: number | undefined
  return function WillRunOnIdle() {
    if (idleId !== undefined) {
      return
    }
    idleId = requestIdleCallback(
      () => {
        idleId = undefined
        onIdle()
      },
      { timeout },
    )
  }
}

const isRelativeUrl = (url: string): boolean => {
  return (
    !url.startsWith('//')
    && !url.startsWith('http://')
    && !url.startsWith('https://')
  )
}

const isElement = (node: Node): boolean => {
  return node.nodeType === 1
}

const asElement = (node: Node): Element | null => {
  return isElement(node) ? (node as Element) : null
}

const isHTMLElement = (node: Node): boolean => {
  return 'innerText' in node
}

// The fetchNewClassIdRules() can be called of each MutationObserver event.
// Under the hood it makes a lot of work: call to C++ => IPC to the browser
// process => request to the rust CS engine and back.
// So limit the number of calls to one per fetchNewClassIdRulesThrottlingMs.
const ShouldThrottleFetchNewClassIdsRules = (): boolean => {
  if (CC.fetchNewClassIdRulesThrottlingMs === undefined) {
    return false // the feature is disabled.
  }

  if (fetchNewClassIdRulesTimeoutId) {
    return true // The function has already scheduled and called later.
  }

  const now = performance.now()
  const msToWait = nextFetchNewClassIdRulesCall - now
  if (msToWait > 0) {
    // Schedule the call in |msToWait| ms and return.
    fetchNewClassIdRulesTimeoutId = window.setTimeout(() => {
      fetchNewClassIdRulesTimeoutId = undefined
      fetchNewClassIdRules()
    }, msToWait)
    return true
  }

  nextFetchNewClassIdRulesCall = now + CC.fetchNewClassIdRulesThrottlingMs
  return false
}

const queueElementIdAndClasses = (element: Element) => {
  const id = element.id
  if (id && !queriedIds.has(id)) {
    notYetQueriedIds.push(id)
    queriedIds.add(id)
  }
  for (const className of element.classList.values()) {
    if (className && !queriedClasses.has(className)) {
      notYetQueriedClasses.push(className)
      queriedClasses.add(className)
    }
  }
}

const fetchNewClassIdRules = () => {
  for (const elements of notYetQueriedElements) {
    for (const element of elements) {
      queueElementIdAndClasses(element)
    }
  }
  notYetQueriedElements.length = 0
  if (
    (!notYetQueriedClasses || notYetQueriedClasses.length === 0)
    && (!notYetQueriedIds || notYetQueriedIds.length === 0)
  ) {
    return
  }
  // Callback to c++ renderer process
  // @ts-expect-error
  cf_worker.hiddenClassIdSelectors(
    JSON.stringify({
      classes: notYetQueriedClasses,
      ids: notYetQueriedIds,
    }),
  )
  notYetQueriedClasses = []
  notYetQueriedIds = []
}

const useMutationObserver = () => {
  if (selectorsPollingIntervalId) {
    clearInterval(selectorsPollingIntervalId)
    selectorsPollingIntervalId = undefined
  }

  const observer = new MutationObserver(onMutations as MutationCallback)
  const observerConfig = {
    subtree: true,
    childList: true,
    attributeFilter: ['id', 'class'],
  }
  observer.observe(document.documentElement, observerConfig)
}

const usePolling = (observer?: MutationObserver) => {
  if (observer) {
    observer.disconnect()
    notYetQueriedElements.length = 0
  }

  const futureTimeMs = window.Date.now() + returnToMutationObserverIntervalMs
  const queryAttrsFromDocumentBound = queryAttrsFromDocument.bind(
    undefined,
    futureTimeMs,
  )

  selectorsPollingIntervalId = window.setInterval(
    queryAttrsFromDocumentBound,
    selectorsPollingIntervalMs,
  )
}

const queueAttrsFromMutations = (mutations: MutationRecord[]): number => {
  let mutationScore = 0
  for (const aMutation of mutations) {
    if (aMutation.type === 'attributes') {
      // Since we're filtering for attribute modifications, we can be certain
      // that the targets are always HTMLElements, and never TextNode.
      const changedElm = aMutation.target as Element
      switch (aMutation.attributeName) {
        case 'class':
          mutationScore += changedElm.classList.length
          for (const aClassName of changedElm.classList.values()) {
            if (!queriedClasses.has(aClassName)) {
              notYetQueriedClasses.push(aClassName)
              queriedClasses.add(aClassName)
            }
          }
          break

        case 'id':
          const mutatedId = changedElm.id
          mutationScore++
          if (!queriedIds.has(mutatedId)) {
            notYetQueriedIds.push(mutatedId)
            queriedIds.add(mutatedId)
          }
          break
      }
    } else if (aMutation.addedNodes.length > 0) {
      for (const node of aMutation.addedNodes) {
        const element = asElement(node)
        if (!element) {
          continue
        }
        notYetQueriedElements.push([element])
        mutationScore += 1
        if (element.firstElementChild !== null) {
          const nodeList = element.querySelectorAll(classIdWithoutHtmlOrBody)
          notYetQueriedElements.push(nodeList)
          mutationScore += nodeList.length
        }
      }
    }
  }
  return mutationScore
}

const onMutations = (
  mutations: MutationRecord[],
  observer: MutationObserver,
) => {
  // Callback to c++ renderer process
  // @ts-expect-error
  const eventId: number | undefined = cf_worker.onHandleMutationsBegin?.()
  const mutationScore = queueAttrsFromMutations(mutations)

  // Check the conditions to switch to the alternative strategy
  // to get selectors.
  if (CC.switchToSelectorsPollingThreshold !== undefined) {
    const now = performance.now()

    if (now > currentMutationStartTime + scoreCalcIntervalMs) {
      // Start the next time frame.
      currentMutationStartTime = now
      currentMutationScore = 0
    }

    currentMutationScore += mutationScore
    if (currentMutationScore > CC.switchToSelectorsPollingThreshold) {
      usePolling(observer)
    }
  }

  if (!CC.generichide && !ShouldThrottleFetchNewClassIdsRules()) {
    fetchNewClassIdRules()
  }

  if (CC.hasProceduralActions) {
    const addedElements: Element[] = []
    mutations.forEach(
      (mutation) =>
        mutation.addedNodes.length !== 0
        && mutation.addedNodes.forEach((n) => {
          if (n.nodeType === Node.ELEMENT_NODE) {
            addedElements.push(n as Element)
            const childNodes = (n as Element).querySelectorAll('*')
            childNodes.length !== 0
              && childNodes.forEach((c) => {
                c.nodeType === Node.ELEMENT_NODE && addedElements.push(c)
              })
          }
        }),
    )
    if (addedElements.length !== 0) {
      executeProceduralActions(addedElements)
    }
  }

  if (eventId) {
    // Callback to c++ renderer process
    // @ts-expect-error
    cf_worker.onHandleMutationsEnd(eventId)
  }
}

const unhideSelectors = (selectors: Set<string>) => {
  if (selectors.size === 0) {
    return
  }
  // Find selectors we have a rule index for
  const rulesToRemove = Array.from(selectors)
    .map((selector) => CC.allSelectorsToRules.get(selector))
    .filter((i) => i !== undefined)
    .sort()
    .reverse()
  // Delete the rules
  let lastIdx: number = CC.allSelectorsToRules.size - 1
  for (const ruleIdx of rulesToRemove) {
    // Safe to asset ruleIdx is a number because we've already filtered out
    // any `undefined` instances with the filter call above.
    CC.cosmeticStyleSheet.deleteRule(ruleIdx)
  }
  // Re-sync the indexes
  // TODO: Sync is hard, just re-build by iterating through the StyleSheet rules.
  const ruleLookup = Array.from(CC.allSelectorsToRules.entries())
  let countAtLastHighest = rulesToRemove.length
  for (let i = lastIdx; i > 0; i--) {
    const [selector, oldIdx] = ruleLookup[i]!
    // Is this one we removed?
    if (rulesToRemove.includes(i)) {
      CC.allSelectorsToRules.delete(selector)
      countAtLastHighest--
      if (countAtLastHighest === 0) {
        break
      }
      continue
    }
    if (oldIdx !== i) {
      // Probably out of sync
      console.error('Cosmetic Filters: old index did not match lookup index', {
        selector,
        oldIdx,
        i,
      })
    }
    CC.allSelectorsToRules.set(selector, oldIdx - countAtLastHighest)
  }
}

const queryAttrsFromDocument = (switchToMutationObserverAtTime?: number) => {
  // Callback to c++ renderer process
  // @ts-expect-error
  const eventId: number | undefined = cf_worker.onQuerySelectorsBegin?.()

  if (!CC.generichide) {
    const elmWithClassOrId = document.querySelectorAll(classIdWithoutHtmlOrBody)
    for (const elm of elmWithClassOrId) {
      queueElementIdAndClasses(elm)
    }

    fetchNewClassIdRules()
  }

  if (CC.hasProceduralActions) executeProceduralActions()

  if (eventId) {
    // Callback to c++ renderer process
    // @ts-expect-error
    cf_worker.onQuerySelectorsEnd(eventId)
  }

  if (
    switchToMutationObserverAtTime !== undefined
    && window.Date.now() >= switchToMutationObserverAtTime
  ) {
    useMutationObserver()
  }
}

const startObserving = () => {
  // First queue up any classes and ids that exist before the mutation observer
  // starts running.
  queryAttrsFromDocument()

  // Second, set up a mutation observer to handle any new ids or classes
  // that are added to the document.
  useMutationObserver()
}

const scheduleQueuePump = (genericHide: boolean) => {
  // Three states possible here.  First, the delay has already occurred.
  if (CC._hasDelayOcurred) {
    return
  }
  // Second possibility is that we're already waiting for the delay to pass /
  // occur.  In this case, do nothing.
  if (CC._startCheckingId !== undefined) {
    return
  }
  // Third / final possibility, this is this the first time this has been
  // called, in which case set up a timer and quit
  CC._startCheckingId = requestIdleCallback(
    (_) => {
      CC._hasDelayOcurred = true
      if (!genericHide || CC.hasProceduralActions) {
        if (CC.firstSelectorsPollingDelayMs === undefined) {
          startObserving()
        } else {
          window.setTimeout(startObserving, CC.firstSelectorsPollingDelayMs)
        }
      }
    },
    { timeout: maxTimeMSBeforeStart },
  )
}

const tryScheduleQueuePump = () => {
  if (!CC.observingHasStarted) {
    CC.observingHasStarted = true
    scheduleQueuePump(CC.generichide)
  } else {
    scheduleQueuePump(false)
  }
}

CC.tryScheduleQueuePump = CC.tryScheduleQueuePump || tryScheduleQueuePump

tryScheduleQueuePump()

const executeProceduralActions = (added?: Element[]) => {
  // If passed a list of added elements, do not query the entire document
  if (CC.proceduralActionFilters === undefined) {
    return
  }

  const getStyleAttr = (style: string): string => {
    let styleAttr = styleAttrMap.get(style)
    if (styleAttr === undefined) {
      styleAttr = generateRandomAttr()
      styleAttrMap.set(style, styleAttr)
      const css = `[${globalStyleAttr}][${styleAttr}]{${style}}`
      // @ts-expect-error
      cf_worker.injectStylesheet(css)
    }
    return styleAttr
  }

  const performAction = (element: any, action: any) => {
    if (action === undefined) {
      const attr = getStyleAttr('display: none !important')
      element.setAttribute(globalStyleAttr, '')
      element.setAttribute(attr, '')
    } else if (action.type === 'style') {
      const attr = getStyleAttr(action.arg)
      element.setAttribute(globalStyleAttr, '')
      element.setAttribute(attr, '')
    } else if (action.type === 'remove') {
      element.remove()
    } else if (action.type === 'remove-attr') {
      // We can remove attributes without checking if they exist
      element.removeAttribute(action.arg)
    } else if (action.type === 'remove-class') {
      // Check if the element has any classes to remove because
      // classList.remove(tokens...) always triggers another mutation
      // even if nothing was removed.
      if (element.classList.contains(action.arg)) {
        element.classList.remove(action.arg)
      }
    }
  }
  for (const { selector, action } of CC.proceduralActionFilters) {
    try {
      let matchingElements: Element[] | NodeListOf<any>
      let startOperator: number

      if (selector[0]!.type === 'css-selector' && added === undefined) {
        matchingElements = document.querySelectorAll(selector[0]!.arg)
        startOperator = 1
      } else if (added === undefined) {
        matchingElements = document.querySelectorAll('*')
        startOperator = 0
      } else {
        matchingElements = added
        startOperator = 0
      }

      if (startOperator === selector.length) {
        // First `css-selector` was already handled, and no more elements remain
        matchingElements.forEach((elem) => performAction(elem, action))
      } else {
        const filter = compileProceduralSelector(selector.slice(startOperator))
        applyCompiledSelector(
          filter,
          matchingElements as HTMLElement[],
        ).forEach((elem) => performAction(elem, action))
      }
    } catch (e: any) {
      console.error(
        'Failed to apply filter '
          + JSON.stringify(selector)
          + ' '
          + JSON.stringify(action)
          + ': ',
      )
      console.error(e.message)
      console.error(e.stack)
    }
  }
}

if (CC.hasProceduralActions) executeProceduralActions()
