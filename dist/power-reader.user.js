// ==UserScript==
// @name       LW Power Reader
// @namespace  npm/vite-plugin-monkey
// @version    1.2.682
// @author     Wei Dai
// @match      https://www.lesswrong.com/*
// @match      https://forum.effectivealtruism.org/*
// @match      https://www.greaterwrong.com/*
// @match      https://aistudio.google.com/*
// @connect    lesswrong.com
// @connect    forum.effectivealtruism.org
// @connect    greaterwrong.com
// @grant      GM_addStyle
// @grant      GM_addValueChangeListener
// @grant      GM_deleteValue
// @grant      GM_getValue
// @grant      GM_log
// @grant      GM_openInTab
// @grant      GM_setValue
// @grant      GM_xmlhttpRequest
// @grant      window.close
// @grant      window.focus
// @run-at     document-start
// ==/UserScript==

(function () {
  'use strict';

  const PREFIX = "[LW Power Reader]";
  const Logger = {
reset: () => {
    },
    debug: (msg, ...args) => {
      console.debug(`${PREFIX} 🐛 ${msg}`, ...args);
    },
    info: (msg, ...args) => {
      console.info(`${PREFIX} ℹ️ ${msg}`, ...args);
    },
    warn: (msg, ...args) => {
      console.warn(`${PREFIX} ⚠️ ${msg}`, ...args);
    },
    error: (msg, ...args) => {
      console.error(`${PREFIX} ❌ ${msg}`, ...args);
    }
  };
  const {
    entries,
    setPrototypeOf,
    isFrozen,
    getPrototypeOf,
    getOwnPropertyDescriptor
  } = Object;
  let {
    freeze,
    seal,
    create
  } = Object;
  let {
    apply,
    construct
  } = typeof Reflect !== "undefined" && Reflect;
  if (!freeze) {
    freeze = function freeze2(x) {
      return x;
    };
  }
  if (!seal) {
    seal = function seal2(x) {
      return x;
    };
  }
  if (!apply) {
    apply = function apply2(func, thisArg) {
      for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
        args[_key - 2] = arguments[_key];
      }
      return func.apply(thisArg, args);
    };
  }
  if (!construct) {
    construct = function construct2(Func) {
      for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        args[_key2 - 1] = arguments[_key2];
      }
      return new Func(...args);
    };
  }
  const arrayForEach = unapply(Array.prototype.forEach);
  const arrayLastIndexOf = unapply(Array.prototype.lastIndexOf);
  const arrayPop = unapply(Array.prototype.pop);
  const arrayPush = unapply(Array.prototype.push);
  const arraySplice = unapply(Array.prototype.splice);
  const stringToLowerCase = unapply(String.prototype.toLowerCase);
  const stringToString = unapply(String.prototype.toString);
  const stringMatch = unapply(String.prototype.match);
  const stringReplace = unapply(String.prototype.replace);
  const stringIndexOf = unapply(String.prototype.indexOf);
  const stringTrim = unapply(String.prototype.trim);
  const objectHasOwnProperty = unapply(Object.prototype.hasOwnProperty);
  const regExpTest = unapply(RegExp.prototype.test);
  const typeErrorCreate = unconstruct(TypeError);
  function unapply(func) {
    return function(thisArg) {
      if (thisArg instanceof RegExp) {
        thisArg.lastIndex = 0;
      }
      for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
        args[_key3 - 1] = arguments[_key3];
      }
      return apply(func, thisArg, args);
    };
  }
  function unconstruct(Func) {
    return function() {
      for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
        args[_key4] = arguments[_key4];
      }
      return construct(Func, args);
    };
  }
  function addToSet(set, array) {
    let transformCaseFunc = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : stringToLowerCase;
    if (setPrototypeOf) {
      setPrototypeOf(set, null);
    }
    let l = array.length;
    while (l--) {
      let element = array[l];
      if (typeof element === "string") {
        const lcElement = transformCaseFunc(element);
        if (lcElement !== element) {
          if (!isFrozen(array)) {
            array[l] = lcElement;
          }
          element = lcElement;
        }
      }
      set[element] = true;
    }
    return set;
  }
  function cleanArray(array) {
    for (let index = 0; index < array.length; index++) {
      const isPropertyExist = objectHasOwnProperty(array, index);
      if (!isPropertyExist) {
        array[index] = null;
      }
    }
    return array;
  }
  function clone(object) {
    const newObject = create(null);
    for (const [property, value] of entries(object)) {
      const isPropertyExist = objectHasOwnProperty(object, property);
      if (isPropertyExist) {
        if (Array.isArray(value)) {
          newObject[property] = cleanArray(value);
        } else if (value && typeof value === "object" && value.constructor === Object) {
          newObject[property] = clone(value);
        } else {
          newObject[property] = value;
        }
      }
    }
    return newObject;
  }
  function lookupGetter(object, prop) {
    while (object !== null) {
      const desc = getOwnPropertyDescriptor(object, prop);
      if (desc) {
        if (desc.get) {
          return unapply(desc.get);
        }
        if (typeof desc.value === "function") {
          return unapply(desc.value);
        }
      }
      object = getPrototypeOf(object);
    }
    function fallbackValue() {
      return null;
    }
    return fallbackValue;
  }
  const html$1 = freeze(["a", "abbr", "acronym", "address", "area", "article", "aside", "audio", "b", "bdi", "bdo", "big", "blink", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "content", "data", "datalist", "dd", "decorator", "del", "details", "dfn", "dialog", "dir", "div", "dl", "dt", "element", "em", "fieldset", "figcaption", "figure", "font", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "img", "input", "ins", "kbd", "label", "legend", "li", "main", "map", "mark", "marquee", "menu", "menuitem", "meter", "nav", "nobr", "ol", "optgroup", "option", "output", "p", "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "search", "section", "select", "shadow", "slot", "small", "source", "spacer", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "tr", "track", "tt", "u", "ul", "var", "video", "wbr"]);
  const svg$1 = freeze(["svg", "a", "altglyph", "altglyphdef", "altglyphitem", "animatecolor", "animatemotion", "animatetransform", "circle", "clippath", "defs", "desc", "ellipse", "enterkeyhint", "exportparts", "filter", "font", "g", "glyph", "glyphref", "hkern", "image", "inputmode", "line", "lineargradient", "marker", "mask", "metadata", "mpath", "part", "path", "pattern", "polygon", "polyline", "radialgradient", "rect", "stop", "style", "switch", "symbol", "text", "textpath", "title", "tref", "tspan", "view", "vkern"]);
  const svgFilters = freeze(["feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feDropShadow", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage", "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence"]);
  const svgDisallowed = freeze(["animate", "color-profile", "cursor", "discard", "font-face", "font-face-format", "font-face-name", "font-face-src", "font-face-uri", "foreignobject", "hatch", "hatchpath", "mesh", "meshgradient", "meshpatch", "meshrow", "missing-glyph", "script", "set", "solidcolor", "unknown", "use"]);
  const mathMl$1 = freeze(["math", "menclose", "merror", "mfenced", "mfrac", "mglyph", "mi", "mlabeledtr", "mmultiscripts", "mn", "mo", "mover", "mpadded", "mphantom", "mroot", "mrow", "ms", "mspace", "msqrt", "mstyle", "msub", "msup", "msubsup", "mtable", "mtd", "mtext", "mtr", "munder", "munderover", "mprescripts"]);
  const mathMlDisallowed = freeze(["maction", "maligngroup", "malignmark", "mlongdiv", "mscarries", "mscarry", "msgroup", "mstack", "msline", "msrow", "semantics", "annotation", "annotation-xml", "mprescripts", "none"]);
  const text = freeze(["#text"]);
  const html = freeze(["accept", "action", "align", "alt", "autocapitalize", "autocomplete", "autopictureinpicture", "autoplay", "background", "bgcolor", "border", "capture", "cellpadding", "cellspacing", "checked", "cite", "class", "clear", "color", "cols", "colspan", "controls", "controlslist", "coords", "crossorigin", "datetime", "decoding", "default", "dir", "disabled", "disablepictureinpicture", "disableremoteplayback", "download", "draggable", "enctype", "enterkeyhint", "exportparts", "face", "for", "headers", "height", "hidden", "high", "href", "hreflang", "id", "inert", "inputmode", "integrity", "ismap", "kind", "label", "lang", "list", "loading", "loop", "low", "max", "maxlength", "media", "method", "min", "minlength", "multiple", "muted", "name", "nonce", "noshade", "novalidate", "nowrap", "open", "optimum", "part", "pattern", "placeholder", "playsinline", "popover", "popovertarget", "popovertargetaction", "poster", "preload", "pubdate", "radiogroup", "readonly", "rel", "required", "rev", "reversed", "role", "rows", "rowspan", "spellcheck", "scope", "selected", "shape", "size", "sizes", "slot", "span", "srclang", "start", "src", "srcset", "step", "style", "summary", "tabindex", "title", "translate", "type", "usemap", "valign", "value", "width", "wrap", "xmlns", "slot"]);
  const svg = freeze(["accent-height", "accumulate", "additive", "alignment-baseline", "amplitude", "ascent", "attributename", "attributetype", "azimuth", "basefrequency", "baseline-shift", "begin", "bias", "by", "class", "clip", "clippathunits", "clip-path", "clip-rule", "color", "color-interpolation", "color-interpolation-filters", "color-profile", "color-rendering", "cx", "cy", "d", "dx", "dy", "diffuseconstant", "direction", "display", "divisor", "dur", "edgemode", "elevation", "end", "exponent", "fill", "fill-opacity", "fill-rule", "filter", "filterunits", "flood-color", "flood-opacity", "font-family", "font-size", "font-size-adjust", "font-stretch", "font-style", "font-variant", "font-weight", "fx", "fy", "g1", "g2", "glyph-name", "glyphref", "gradientunits", "gradienttransform", "height", "href", "id", "image-rendering", "in", "in2", "intercept", "k", "k1", "k2", "k3", "k4", "kerning", "keypoints", "keysplines", "keytimes", "lang", "lengthadjust", "letter-spacing", "kernelmatrix", "kernelunitlength", "lighting-color", "local", "marker-end", "marker-mid", "marker-start", "markerheight", "markerunits", "markerwidth", "maskcontentunits", "maskunits", "max", "mask", "mask-type", "media", "method", "mode", "min", "name", "numoctaves", "offset", "operator", "opacity", "order", "orient", "orientation", "origin", "overflow", "paint-order", "path", "pathlength", "patterncontentunits", "patterntransform", "patternunits", "points", "preservealpha", "preserveaspectratio", "primitiveunits", "r", "rx", "ry", "radius", "refx", "refy", "repeatcount", "repeatdur", "restart", "result", "rotate", "scale", "seed", "shape-rendering", "slope", "specularconstant", "specularexponent", "spreadmethod", "startoffset", "stddeviation", "stitchtiles", "stop-color", "stop-opacity", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity", "stroke", "stroke-width", "style", "surfacescale", "systemlanguage", "tabindex", "tablevalues", "targetx", "targety", "transform", "transform-origin", "text-anchor", "text-decoration", "text-rendering", "textlength", "type", "u1", "u2", "unicode", "values", "viewbox", "visibility", "version", "vert-adv-y", "vert-origin-x", "vert-origin-y", "width", "word-spacing", "wrap", "writing-mode", "xchannelselector", "ychannelselector", "x", "x1", "x2", "xmlns", "y", "y1", "y2", "z", "zoomandpan"]);
  const mathMl = freeze(["accent", "accentunder", "align", "bevelled", "close", "columnsalign", "columnlines", "columnspan", "denomalign", "depth", "dir", "display", "displaystyle", "encoding", "fence", "frame", "height", "href", "id", "largeop", "length", "linethickness", "lspace", "lquote", "mathbackground", "mathcolor", "mathsize", "mathvariant", "maxsize", "minsize", "movablelimits", "notation", "numalign", "open", "rowalign", "rowlines", "rowspacing", "rowspan", "rspace", "rquote", "scriptlevel", "scriptminsize", "scriptsizemultiplier", "selection", "separator", "separators", "stretchy", "subscriptshift", "supscriptshift", "symmetric", "voffset", "width", "xmlns"]);
  const xml = freeze(["xlink:href", "xml:id", "xlink:title", "xml:space", "xmlns:xlink"]);
  const MUSTACHE_EXPR = seal(/\{\{[\w\W]*|[\w\W]*\}\}/gm);
  const ERB_EXPR = seal(/<%[\w\W]*|[\w\W]*%>/gm);
  const TMPLIT_EXPR = seal(/\$\{[\w\W]*/gm);
  const DATA_ATTR = seal(/^data-[\-\w.\u00B7-\uFFFF]+$/);
  const ARIA_ATTR = seal(/^aria-[\-\w]+$/);
  const IS_ALLOWED_URI = seal(
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
);
  const IS_SCRIPT_OR_DATA = seal(/^(?:\w+script|data):/i);
  const ATTR_WHITESPACE = seal(
    /[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g
);
  const DOCTYPE_NAME = seal(/^html$/i);
  const CUSTOM_ELEMENT = seal(/^[a-z][.\w]*(-[.\w]+)+$/i);
  var EXPRESSIONS = Object.freeze({
    __proto__: null,
    ARIA_ATTR,
    ATTR_WHITESPACE,
    CUSTOM_ELEMENT,
    DATA_ATTR,
    DOCTYPE_NAME,
    ERB_EXPR,
    IS_ALLOWED_URI,
    IS_SCRIPT_OR_DATA,
    MUSTACHE_EXPR,
    TMPLIT_EXPR
  });
  const NODE_TYPE = {
    element: 1,
    text: 3,
progressingInstruction: 7,
    comment: 8,
    document: 9
  };
  const getGlobal = function getGlobal2() {
    return typeof window === "undefined" ? null : window;
  };
  const _createTrustedTypesPolicy = function _createTrustedTypesPolicy2(trustedTypes, purifyHostElement) {
    if (typeof trustedTypes !== "object" || typeof trustedTypes.createPolicy !== "function") {
      return null;
    }
    let suffix = null;
    const ATTR_NAME = "data-tt-policy-suffix";
    if (purifyHostElement && purifyHostElement.hasAttribute(ATTR_NAME)) {
      suffix = purifyHostElement.getAttribute(ATTR_NAME);
    }
    const policyName = "dompurify" + (suffix ? "#" + suffix : "");
    try {
      return trustedTypes.createPolicy(policyName, {
        createHTML(html2) {
          return html2;
        },
        createScriptURL(scriptUrl) {
          return scriptUrl;
        }
      });
    } catch (_) {
      console.warn("TrustedTypes policy " + policyName + " could not be created.");
      return null;
    }
  };
  const _createHooksMap = function _createHooksMap2() {
    return {
      afterSanitizeAttributes: [],
      afterSanitizeElements: [],
      afterSanitizeShadowDOM: [],
      beforeSanitizeAttributes: [],
      beforeSanitizeElements: [],
      beforeSanitizeShadowDOM: [],
      uponSanitizeAttribute: [],
      uponSanitizeElement: [],
      uponSanitizeShadowNode: []
    };
  };
  function createDOMPurify() {
    let window2 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : getGlobal();
    const DOMPurify = (root) => createDOMPurify(root);
    DOMPurify.version = "3.3.1";
    DOMPurify.removed = [];
    if (!window2 || !window2.document || window2.document.nodeType !== NODE_TYPE.document || !window2.Element) {
      DOMPurify.isSupported = false;
      return DOMPurify;
    }
    let {
      document: document2
    } = window2;
    const originalDocument = document2;
    const currentScript = originalDocument.currentScript;
    const {
      DocumentFragment,
      HTMLTemplateElement,
      Node,
      Element: Element2,
      NodeFilter: NodeFilter2,
      NamedNodeMap = window2.NamedNodeMap || window2.MozNamedAttrMap,
      HTMLFormElement,
      DOMParser: DOMParser2,
      trustedTypes
    } = window2;
    const ElementPrototype = Element2.prototype;
    const cloneNode = lookupGetter(ElementPrototype, "cloneNode");
    const remove = lookupGetter(ElementPrototype, "remove");
    const getNextSibling = lookupGetter(ElementPrototype, "nextSibling");
    const getChildNodes = lookupGetter(ElementPrototype, "childNodes");
    const getParentNode = lookupGetter(ElementPrototype, "parentNode");
    if (typeof HTMLTemplateElement === "function") {
      const template = document2.createElement("template");
      if (template.content && template.content.ownerDocument) {
        document2 = template.content.ownerDocument;
      }
    }
    let trustedTypesPolicy;
    let emptyHTML = "";
    const {
      implementation,
      createNodeIterator,
      createDocumentFragment,
      getElementsByTagName
    } = document2;
    const {
      importNode
    } = originalDocument;
    let hooks = _createHooksMap();
    DOMPurify.isSupported = typeof entries === "function" && typeof getParentNode === "function" && implementation && implementation.createHTMLDocument !== void 0;
    const {
      MUSTACHE_EXPR: MUSTACHE_EXPR2,
      ERB_EXPR: ERB_EXPR2,
      TMPLIT_EXPR: TMPLIT_EXPR2,
      DATA_ATTR: DATA_ATTR2,
      ARIA_ATTR: ARIA_ATTR2,
      IS_SCRIPT_OR_DATA: IS_SCRIPT_OR_DATA2,
      ATTR_WHITESPACE: ATTR_WHITESPACE2,
      CUSTOM_ELEMENT: CUSTOM_ELEMENT2
    } = EXPRESSIONS;
    let {
      IS_ALLOWED_URI: IS_ALLOWED_URI$1
    } = EXPRESSIONS;
    let ALLOWED_TAGS = null;
    const DEFAULT_ALLOWED_TAGS = addToSet({}, [...html$1, ...svg$1, ...svgFilters, ...mathMl$1, ...text]);
    let ALLOWED_ATTR = null;
    const DEFAULT_ALLOWED_ATTR = addToSet({}, [...html, ...svg, ...mathMl, ...xml]);
    let CUSTOM_ELEMENT_HANDLING = Object.seal(create(null, {
      tagNameCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      },
      attributeNameCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      },
      allowCustomizedBuiltInElements: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: false
      }
    }));
    let FORBID_TAGS = null;
    let FORBID_ATTR = null;
    const EXTRA_ELEMENT_HANDLING = Object.seal(create(null, {
      tagCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      },
      attributeCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      }
    }));
    let ALLOW_ARIA_ATTR = true;
    let ALLOW_DATA_ATTR = true;
    let ALLOW_UNKNOWN_PROTOCOLS = false;
    let ALLOW_SELF_CLOSE_IN_ATTR = true;
    let SAFE_FOR_TEMPLATES = false;
    let SAFE_FOR_XML = true;
    let WHOLE_DOCUMENT = false;
    let SET_CONFIG = false;
    let FORCE_BODY = false;
    let RETURN_DOM = false;
    let RETURN_DOM_FRAGMENT = false;
    let RETURN_TRUSTED_TYPE = false;
    let SANITIZE_DOM = true;
    let SANITIZE_NAMED_PROPS = false;
    const SANITIZE_NAMED_PROPS_PREFIX = "user-content-";
    let KEEP_CONTENT = true;
    let IN_PLACE = false;
    let USE_PROFILES = {};
    let FORBID_CONTENTS = null;
    const DEFAULT_FORBID_CONTENTS = addToSet({}, ["annotation-xml", "audio", "colgroup", "desc", "foreignobject", "head", "iframe", "math", "mi", "mn", "mo", "ms", "mtext", "noembed", "noframes", "noscript", "plaintext", "script", "style", "svg", "template", "thead", "title", "video", "xmp"]);
    let DATA_URI_TAGS = null;
    const DEFAULT_DATA_URI_TAGS = addToSet({}, ["audio", "video", "img", "source", "image", "track"]);
    let URI_SAFE_ATTRIBUTES = null;
    const DEFAULT_URI_SAFE_ATTRIBUTES = addToSet({}, ["alt", "class", "for", "id", "label", "name", "pattern", "placeholder", "role", "summary", "title", "value", "style", "xmlns"]);
    const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
    const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
    const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
    let NAMESPACE = HTML_NAMESPACE;
    let IS_EMPTY_INPUT = false;
    let ALLOWED_NAMESPACES = null;
    const DEFAULT_ALLOWED_NAMESPACES = addToSet({}, [MATHML_NAMESPACE, SVG_NAMESPACE, HTML_NAMESPACE], stringToString);
    let MATHML_TEXT_INTEGRATION_POINTS = addToSet({}, ["mi", "mo", "mn", "ms", "mtext"]);
    let HTML_INTEGRATION_POINTS = addToSet({}, ["annotation-xml"]);
    const COMMON_SVG_AND_HTML_ELEMENTS = addToSet({}, ["title", "style", "font", "a", "script"]);
    let PARSER_MEDIA_TYPE = null;
    const SUPPORTED_PARSER_MEDIA_TYPES = ["application/xhtml+xml", "text/html"];
    const DEFAULT_PARSER_MEDIA_TYPE = "text/html";
    let transformCaseFunc = null;
    let CONFIG2 = null;
    const formElement = document2.createElement("form");
    const isRegexOrFunction = function isRegexOrFunction2(testValue) {
      return testValue instanceof RegExp || testValue instanceof Function;
    };
    const _parseConfig = function _parseConfig2() {
      let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
      if (CONFIG2 && CONFIG2 === cfg) {
        return;
      }
      if (!cfg || typeof cfg !== "object") {
        cfg = {};
      }
      cfg = clone(cfg);
      PARSER_MEDIA_TYPE =
SUPPORTED_PARSER_MEDIA_TYPES.indexOf(cfg.PARSER_MEDIA_TYPE) === -1 ? DEFAULT_PARSER_MEDIA_TYPE : cfg.PARSER_MEDIA_TYPE;
      transformCaseFunc = PARSER_MEDIA_TYPE === "application/xhtml+xml" ? stringToString : stringToLowerCase;
      ALLOWED_TAGS = objectHasOwnProperty(cfg, "ALLOWED_TAGS") ? addToSet({}, cfg.ALLOWED_TAGS, transformCaseFunc) : DEFAULT_ALLOWED_TAGS;
      ALLOWED_ATTR = objectHasOwnProperty(cfg, "ALLOWED_ATTR") ? addToSet({}, cfg.ALLOWED_ATTR, transformCaseFunc) : DEFAULT_ALLOWED_ATTR;
      ALLOWED_NAMESPACES = objectHasOwnProperty(cfg, "ALLOWED_NAMESPACES") ? addToSet({}, cfg.ALLOWED_NAMESPACES, stringToString) : DEFAULT_ALLOWED_NAMESPACES;
      URI_SAFE_ATTRIBUTES = objectHasOwnProperty(cfg, "ADD_URI_SAFE_ATTR") ? addToSet(clone(DEFAULT_URI_SAFE_ATTRIBUTES), cfg.ADD_URI_SAFE_ATTR, transformCaseFunc) : DEFAULT_URI_SAFE_ATTRIBUTES;
      DATA_URI_TAGS = objectHasOwnProperty(cfg, "ADD_DATA_URI_TAGS") ? addToSet(clone(DEFAULT_DATA_URI_TAGS), cfg.ADD_DATA_URI_TAGS, transformCaseFunc) : DEFAULT_DATA_URI_TAGS;
      FORBID_CONTENTS = objectHasOwnProperty(cfg, "FORBID_CONTENTS") ? addToSet({}, cfg.FORBID_CONTENTS, transformCaseFunc) : DEFAULT_FORBID_CONTENTS;
      FORBID_TAGS = objectHasOwnProperty(cfg, "FORBID_TAGS") ? addToSet({}, cfg.FORBID_TAGS, transformCaseFunc) : clone({});
      FORBID_ATTR = objectHasOwnProperty(cfg, "FORBID_ATTR") ? addToSet({}, cfg.FORBID_ATTR, transformCaseFunc) : clone({});
      USE_PROFILES = objectHasOwnProperty(cfg, "USE_PROFILES") ? cfg.USE_PROFILES : false;
      ALLOW_ARIA_ATTR = cfg.ALLOW_ARIA_ATTR !== false;
      ALLOW_DATA_ATTR = cfg.ALLOW_DATA_ATTR !== false;
      ALLOW_UNKNOWN_PROTOCOLS = cfg.ALLOW_UNKNOWN_PROTOCOLS || false;
      ALLOW_SELF_CLOSE_IN_ATTR = cfg.ALLOW_SELF_CLOSE_IN_ATTR !== false;
      SAFE_FOR_TEMPLATES = cfg.SAFE_FOR_TEMPLATES || false;
      SAFE_FOR_XML = cfg.SAFE_FOR_XML !== false;
      WHOLE_DOCUMENT = cfg.WHOLE_DOCUMENT || false;
      RETURN_DOM = cfg.RETURN_DOM || false;
      RETURN_DOM_FRAGMENT = cfg.RETURN_DOM_FRAGMENT || false;
      RETURN_TRUSTED_TYPE = cfg.RETURN_TRUSTED_TYPE || false;
      FORCE_BODY = cfg.FORCE_BODY || false;
      SANITIZE_DOM = cfg.SANITIZE_DOM !== false;
      SANITIZE_NAMED_PROPS = cfg.SANITIZE_NAMED_PROPS || false;
      KEEP_CONTENT = cfg.KEEP_CONTENT !== false;
      IN_PLACE = cfg.IN_PLACE || false;
      IS_ALLOWED_URI$1 = cfg.ALLOWED_URI_REGEXP || IS_ALLOWED_URI;
      NAMESPACE = cfg.NAMESPACE || HTML_NAMESPACE;
      MATHML_TEXT_INTEGRATION_POINTS = cfg.MATHML_TEXT_INTEGRATION_POINTS || MATHML_TEXT_INTEGRATION_POINTS;
      HTML_INTEGRATION_POINTS = cfg.HTML_INTEGRATION_POINTS || HTML_INTEGRATION_POINTS;
      CUSTOM_ELEMENT_HANDLING = cfg.CUSTOM_ELEMENT_HANDLING || {};
      if (cfg.CUSTOM_ELEMENT_HANDLING && isRegexOrFunction(cfg.CUSTOM_ELEMENT_HANDLING.tagNameCheck)) {
        CUSTOM_ELEMENT_HANDLING.tagNameCheck = cfg.CUSTOM_ELEMENT_HANDLING.tagNameCheck;
      }
      if (cfg.CUSTOM_ELEMENT_HANDLING && isRegexOrFunction(cfg.CUSTOM_ELEMENT_HANDLING.attributeNameCheck)) {
        CUSTOM_ELEMENT_HANDLING.attributeNameCheck = cfg.CUSTOM_ELEMENT_HANDLING.attributeNameCheck;
      }
      if (cfg.CUSTOM_ELEMENT_HANDLING && typeof cfg.CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements === "boolean") {
        CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements = cfg.CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements;
      }
      if (SAFE_FOR_TEMPLATES) {
        ALLOW_DATA_ATTR = false;
      }
      if (RETURN_DOM_FRAGMENT) {
        RETURN_DOM = true;
      }
      if (USE_PROFILES) {
        ALLOWED_TAGS = addToSet({}, text);
        ALLOWED_ATTR = [];
        if (USE_PROFILES.html === true) {
          addToSet(ALLOWED_TAGS, html$1);
          addToSet(ALLOWED_ATTR, html);
        }
        if (USE_PROFILES.svg === true) {
          addToSet(ALLOWED_TAGS, svg$1);
          addToSet(ALLOWED_ATTR, svg);
          addToSet(ALLOWED_ATTR, xml);
        }
        if (USE_PROFILES.svgFilters === true) {
          addToSet(ALLOWED_TAGS, svgFilters);
          addToSet(ALLOWED_ATTR, svg);
          addToSet(ALLOWED_ATTR, xml);
        }
        if (USE_PROFILES.mathMl === true) {
          addToSet(ALLOWED_TAGS, mathMl$1);
          addToSet(ALLOWED_ATTR, mathMl);
          addToSet(ALLOWED_ATTR, xml);
        }
      }
      if (cfg.ADD_TAGS) {
        if (typeof cfg.ADD_TAGS === "function") {
          EXTRA_ELEMENT_HANDLING.tagCheck = cfg.ADD_TAGS;
        } else {
          if (ALLOWED_TAGS === DEFAULT_ALLOWED_TAGS) {
            ALLOWED_TAGS = clone(ALLOWED_TAGS);
          }
          addToSet(ALLOWED_TAGS, cfg.ADD_TAGS, transformCaseFunc);
        }
      }
      if (cfg.ADD_ATTR) {
        if (typeof cfg.ADD_ATTR === "function") {
          EXTRA_ELEMENT_HANDLING.attributeCheck = cfg.ADD_ATTR;
        } else {
          if (ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) {
            ALLOWED_ATTR = clone(ALLOWED_ATTR);
          }
          addToSet(ALLOWED_ATTR, cfg.ADD_ATTR, transformCaseFunc);
        }
      }
      if (cfg.ADD_URI_SAFE_ATTR) {
        addToSet(URI_SAFE_ATTRIBUTES, cfg.ADD_URI_SAFE_ATTR, transformCaseFunc);
      }
      if (cfg.FORBID_CONTENTS) {
        if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) {
          FORBID_CONTENTS = clone(FORBID_CONTENTS);
        }
        addToSet(FORBID_CONTENTS, cfg.FORBID_CONTENTS, transformCaseFunc);
      }
      if (cfg.ADD_FORBID_CONTENTS) {
        if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) {
          FORBID_CONTENTS = clone(FORBID_CONTENTS);
        }
        addToSet(FORBID_CONTENTS, cfg.ADD_FORBID_CONTENTS, transformCaseFunc);
      }
      if (KEEP_CONTENT) {
        ALLOWED_TAGS["#text"] = true;
      }
      if (WHOLE_DOCUMENT) {
        addToSet(ALLOWED_TAGS, ["html", "head", "body"]);
      }
      if (ALLOWED_TAGS.table) {
        addToSet(ALLOWED_TAGS, ["tbody"]);
        delete FORBID_TAGS.tbody;
      }
      if (cfg.TRUSTED_TYPES_POLICY) {
        if (typeof cfg.TRUSTED_TYPES_POLICY.createHTML !== "function") {
          throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');
        }
        if (typeof cfg.TRUSTED_TYPES_POLICY.createScriptURL !== "function") {
          throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');
        }
        trustedTypesPolicy = cfg.TRUSTED_TYPES_POLICY;
        emptyHTML = trustedTypesPolicy.createHTML("");
      } else {
        if (trustedTypesPolicy === void 0) {
          trustedTypesPolicy = _createTrustedTypesPolicy(trustedTypes, currentScript);
        }
        if (trustedTypesPolicy !== null && typeof emptyHTML === "string") {
          emptyHTML = trustedTypesPolicy.createHTML("");
        }
      }
      if (freeze) {
        freeze(cfg);
      }
      CONFIG2 = cfg;
    };
    const ALL_SVG_TAGS = addToSet({}, [...svg$1, ...svgFilters, ...svgDisallowed]);
    const ALL_MATHML_TAGS = addToSet({}, [...mathMl$1, ...mathMlDisallowed]);
    const _checkValidNamespace = function _checkValidNamespace2(element) {
      let parent = getParentNode(element);
      if (!parent || !parent.tagName) {
        parent = {
          namespaceURI: NAMESPACE,
          tagName: "template"
        };
      }
      const tagName = stringToLowerCase(element.tagName);
      const parentTagName = stringToLowerCase(parent.tagName);
      if (!ALLOWED_NAMESPACES[element.namespaceURI]) {
        return false;
      }
      if (element.namespaceURI === SVG_NAMESPACE) {
        if (parent.namespaceURI === HTML_NAMESPACE) {
          return tagName === "svg";
        }
        if (parent.namespaceURI === MATHML_NAMESPACE) {
          return tagName === "svg" && (parentTagName === "annotation-xml" || MATHML_TEXT_INTEGRATION_POINTS[parentTagName]);
        }
        return Boolean(ALL_SVG_TAGS[tagName]);
      }
      if (element.namespaceURI === MATHML_NAMESPACE) {
        if (parent.namespaceURI === HTML_NAMESPACE) {
          return tagName === "math";
        }
        if (parent.namespaceURI === SVG_NAMESPACE) {
          return tagName === "math" && HTML_INTEGRATION_POINTS[parentTagName];
        }
        return Boolean(ALL_MATHML_TAGS[tagName]);
      }
      if (element.namespaceURI === HTML_NAMESPACE) {
        if (parent.namespaceURI === SVG_NAMESPACE && !HTML_INTEGRATION_POINTS[parentTagName]) {
          return false;
        }
        if (parent.namespaceURI === MATHML_NAMESPACE && !MATHML_TEXT_INTEGRATION_POINTS[parentTagName]) {
          return false;
        }
        return !ALL_MATHML_TAGS[tagName] && (COMMON_SVG_AND_HTML_ELEMENTS[tagName] || !ALL_SVG_TAGS[tagName]);
      }
      if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && ALLOWED_NAMESPACES[element.namespaceURI]) {
        return true;
      }
      return false;
    };
    const _forceRemove = function _forceRemove2(node) {
      arrayPush(DOMPurify.removed, {
        element: node
      });
      try {
        getParentNode(node).removeChild(node);
      } catch (_) {
        remove(node);
      }
    };
    const _removeAttribute = function _removeAttribute2(name, element) {
      try {
        arrayPush(DOMPurify.removed, {
          attribute: element.getAttributeNode(name),
          from: element
        });
      } catch (_) {
        arrayPush(DOMPurify.removed, {
          attribute: null,
          from: element
        });
      }
      element.removeAttribute(name);
      if (name === "is") {
        if (RETURN_DOM || RETURN_DOM_FRAGMENT) {
          try {
            _forceRemove(element);
          } catch (_) {
          }
        } else {
          try {
            element.setAttribute(name, "");
          } catch (_) {
          }
        }
      }
    };
    const _initDocument = function _initDocument2(dirty) {
      let doc = null;
      let leadingWhitespace = null;
      if (FORCE_BODY) {
        dirty = "<remove></remove>" + dirty;
      } else {
        const matches = stringMatch(dirty, /^[\r\n\t ]+/);
        leadingWhitespace = matches && matches[0];
      }
      if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && NAMESPACE === HTML_NAMESPACE) {
        dirty = '<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>' + dirty + "</body></html>";
      }
      const dirtyPayload = trustedTypesPolicy ? trustedTypesPolicy.createHTML(dirty) : dirty;
      if (NAMESPACE === HTML_NAMESPACE) {
        try {
          doc = new DOMParser2().parseFromString(dirtyPayload, PARSER_MEDIA_TYPE);
        } catch (_) {
        }
      }
      if (!doc || !doc.documentElement) {
        doc = implementation.createDocument(NAMESPACE, "template", null);
        try {
          doc.documentElement.innerHTML = IS_EMPTY_INPUT ? emptyHTML : dirtyPayload;
        } catch (_) {
        }
      }
      const body = doc.body || doc.documentElement;
      if (dirty && leadingWhitespace) {
        body.insertBefore(document2.createTextNode(leadingWhitespace), body.childNodes[0] || null);
      }
      if (NAMESPACE === HTML_NAMESPACE) {
        return getElementsByTagName.call(doc, WHOLE_DOCUMENT ? "html" : "body")[0];
      }
      return WHOLE_DOCUMENT ? doc.documentElement : body;
    };
    const _createNodeIterator = function _createNodeIterator2(root) {
      return createNodeIterator.call(
        root.ownerDocument || root,
        root,
NodeFilter2.SHOW_ELEMENT | NodeFilter2.SHOW_COMMENT | NodeFilter2.SHOW_TEXT | NodeFilter2.SHOW_PROCESSING_INSTRUCTION | NodeFilter2.SHOW_CDATA_SECTION,
        null
      );
    };
    const _isClobbered = function _isClobbered2(element) {
      return element instanceof HTMLFormElement && (typeof element.nodeName !== "string" || typeof element.textContent !== "string" || typeof element.removeChild !== "function" || !(element.attributes instanceof NamedNodeMap) || typeof element.removeAttribute !== "function" || typeof element.setAttribute !== "function" || typeof element.namespaceURI !== "string" || typeof element.insertBefore !== "function" || typeof element.hasChildNodes !== "function");
    };
    const _isNode = function _isNode2(value) {
      return typeof Node === "function" && value instanceof Node;
    };
    function _executeHooks(hooks2, currentNode, data) {
      arrayForEach(hooks2, (hook) => {
        hook.call(DOMPurify, currentNode, data, CONFIG2);
      });
    }
    const _sanitizeElements = function _sanitizeElements2(currentNode) {
      let content = null;
      _executeHooks(hooks.beforeSanitizeElements, currentNode, null);
      if (_isClobbered(currentNode)) {
        _forceRemove(currentNode);
        return true;
      }
      const tagName = transformCaseFunc(currentNode.nodeName);
      _executeHooks(hooks.uponSanitizeElement, currentNode, {
        tagName,
        allowedTags: ALLOWED_TAGS
      });
      if (SAFE_FOR_XML && currentNode.hasChildNodes() && !_isNode(currentNode.firstElementChild) && regExpTest(/<[/\w!]/g, currentNode.innerHTML) && regExpTest(/<[/\w!]/g, currentNode.textContent)) {
        _forceRemove(currentNode);
        return true;
      }
      if (currentNode.nodeType === NODE_TYPE.progressingInstruction) {
        _forceRemove(currentNode);
        return true;
      }
      if (SAFE_FOR_XML && currentNode.nodeType === NODE_TYPE.comment && regExpTest(/<[/\w]/g, currentNode.data)) {
        _forceRemove(currentNode);
        return true;
      }
      if (!(EXTRA_ELEMENT_HANDLING.tagCheck instanceof Function && EXTRA_ELEMENT_HANDLING.tagCheck(tagName)) && (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName])) {
        if (!FORBID_TAGS[tagName] && _isBasicCustomElement(tagName)) {
          if (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, tagName)) {
            return false;
          }
          if (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(tagName)) {
            return false;
          }
        }
        if (KEEP_CONTENT && !FORBID_CONTENTS[tagName]) {
          const parentNode = getParentNode(currentNode) || currentNode.parentNode;
          const childNodes = getChildNodes(currentNode) || currentNode.childNodes;
          if (childNodes && parentNode) {
            const childCount = childNodes.length;
            for (let i = childCount - 1; i >= 0; --i) {
              const childClone = cloneNode(childNodes[i], true);
              childClone.__removalCount = (currentNode.__removalCount || 0) + 1;
              parentNode.insertBefore(childClone, getNextSibling(currentNode));
            }
          }
        }
        _forceRemove(currentNode);
        return true;
      }
      if (currentNode instanceof Element2 && !_checkValidNamespace(currentNode)) {
        _forceRemove(currentNode);
        return true;
      }
      if ((tagName === "noscript" || tagName === "noembed" || tagName === "noframes") && regExpTest(/<\/no(script|embed|frames)/i, currentNode.innerHTML)) {
        _forceRemove(currentNode);
        return true;
      }
      if (SAFE_FOR_TEMPLATES && currentNode.nodeType === NODE_TYPE.text) {
        content = currentNode.textContent;
        arrayForEach([MUSTACHE_EXPR2, ERB_EXPR2, TMPLIT_EXPR2], (expr) => {
          content = stringReplace(content, expr, " ");
        });
        if (currentNode.textContent !== content) {
          arrayPush(DOMPurify.removed, {
            element: currentNode.cloneNode()
          });
          currentNode.textContent = content;
        }
      }
      _executeHooks(hooks.afterSanitizeElements, currentNode, null);
      return false;
    };
    const _isValidAttribute = function _isValidAttribute2(lcTag, lcName, value) {
      if (SANITIZE_DOM && (lcName === "id" || lcName === "name") && (value in document2 || value in formElement)) {
        return false;
      }
      if (ALLOW_DATA_ATTR && !FORBID_ATTR[lcName] && regExpTest(DATA_ATTR2, lcName)) ;
      else if (ALLOW_ARIA_ATTR && regExpTest(ARIA_ATTR2, lcName)) ;
      else if (EXTRA_ELEMENT_HANDLING.attributeCheck instanceof Function && EXTRA_ELEMENT_HANDLING.attributeCheck(lcName, lcTag)) ;
      else if (!ALLOWED_ATTR[lcName] || FORBID_ATTR[lcName]) {
        if (


_isBasicCustomElement(lcTag) && (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, lcTag) || CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(lcTag)) && (CUSTOM_ELEMENT_HANDLING.attributeNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.attributeNameCheck, lcName) || CUSTOM_ELEMENT_HANDLING.attributeNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.attributeNameCheck(lcName, lcTag)) ||

lcName === "is" && CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements && (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, value) || CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(value))
        ) ;
        else {
          return false;
        }
      } else if (URI_SAFE_ATTRIBUTES[lcName]) ;
      else if (regExpTest(IS_ALLOWED_URI$1, stringReplace(value, ATTR_WHITESPACE2, ""))) ;
      else if ((lcName === "src" || lcName === "xlink:href" || lcName === "href") && lcTag !== "script" && stringIndexOf(value, "data:") === 0 && DATA_URI_TAGS[lcTag]) ;
      else if (ALLOW_UNKNOWN_PROTOCOLS && !regExpTest(IS_SCRIPT_OR_DATA2, stringReplace(value, ATTR_WHITESPACE2, ""))) ;
      else if (value) {
        return false;
      } else ;
      return true;
    };
    const _isBasicCustomElement = function _isBasicCustomElement2(tagName) {
      return tagName !== "annotation-xml" && stringMatch(tagName, CUSTOM_ELEMENT2);
    };
    const _sanitizeAttributes = function _sanitizeAttributes2(currentNode) {
      _executeHooks(hooks.beforeSanitizeAttributes, currentNode, null);
      const {
        attributes
      } = currentNode;
      if (!attributes || _isClobbered(currentNode)) {
        return;
      }
      const hookEvent = {
        attrName: "",
        attrValue: "",
        keepAttr: true,
        allowedAttributes: ALLOWED_ATTR,
        forceKeepAttr: void 0
      };
      let l = attributes.length;
      while (l--) {
        const attr = attributes[l];
        const {
          name,
          namespaceURI,
          value: attrValue
        } = attr;
        const lcName = transformCaseFunc(name);
        const initValue = attrValue;
        let value = name === "value" ? initValue : stringTrim(initValue);
        hookEvent.attrName = lcName;
        hookEvent.attrValue = value;
        hookEvent.keepAttr = true;
        hookEvent.forceKeepAttr = void 0;
        _executeHooks(hooks.uponSanitizeAttribute, currentNode, hookEvent);
        value = hookEvent.attrValue;
        if (SANITIZE_NAMED_PROPS && (lcName === "id" || lcName === "name")) {
          _removeAttribute(name, currentNode);
          value = SANITIZE_NAMED_PROPS_PREFIX + value;
        }
        if (SAFE_FOR_XML && regExpTest(/((--!?|])>)|<\/(style|title|textarea)/i, value)) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (lcName === "attributename" && stringMatch(value, "href")) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (hookEvent.forceKeepAttr) {
          continue;
        }
        if (!hookEvent.keepAttr) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (!ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(/\/>/i, value)) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (SAFE_FOR_TEMPLATES) {
          arrayForEach([MUSTACHE_EXPR2, ERB_EXPR2, TMPLIT_EXPR2], (expr) => {
            value = stringReplace(value, expr, " ");
          });
        }
        const lcTag = transformCaseFunc(currentNode.nodeName);
        if (!_isValidAttribute(lcTag, lcName, value)) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (trustedTypesPolicy && typeof trustedTypes === "object" && typeof trustedTypes.getAttributeType === "function") {
          if (namespaceURI) ;
          else {
            switch (trustedTypes.getAttributeType(lcTag, lcName)) {
              case "TrustedHTML": {
                value = trustedTypesPolicy.createHTML(value);
                break;
              }
              case "TrustedScriptURL": {
                value = trustedTypesPolicy.createScriptURL(value);
                break;
              }
            }
          }
        }
        if (value !== initValue) {
          try {
            if (namespaceURI) {
              currentNode.setAttributeNS(namespaceURI, name, value);
            } else {
              currentNode.setAttribute(name, value);
            }
            if (_isClobbered(currentNode)) {
              _forceRemove(currentNode);
            } else {
              arrayPop(DOMPurify.removed);
            }
          } catch (_) {
            _removeAttribute(name, currentNode);
          }
        }
      }
      _executeHooks(hooks.afterSanitizeAttributes, currentNode, null);
    };
    const _sanitizeShadowDOM = function _sanitizeShadowDOM2(fragment) {
      let shadowNode = null;
      const shadowIterator = _createNodeIterator(fragment);
      _executeHooks(hooks.beforeSanitizeShadowDOM, fragment, null);
      while (shadowNode = shadowIterator.nextNode()) {
        _executeHooks(hooks.uponSanitizeShadowNode, shadowNode, null);
        _sanitizeElements(shadowNode);
        _sanitizeAttributes(shadowNode);
        if (shadowNode.content instanceof DocumentFragment) {
          _sanitizeShadowDOM2(shadowNode.content);
        }
      }
      _executeHooks(hooks.afterSanitizeShadowDOM, fragment, null);
    };
    DOMPurify.sanitize = function(dirty) {
      let cfg = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
      let body = null;
      let importedNode = null;
      let currentNode = null;
      let returnNode = null;
      IS_EMPTY_INPUT = !dirty;
      if (IS_EMPTY_INPUT) {
        dirty = "<!-->";
      }
      if (typeof dirty !== "string" && !_isNode(dirty)) {
        if (typeof dirty.toString === "function") {
          dirty = dirty.toString();
          if (typeof dirty !== "string") {
            throw typeErrorCreate("dirty is not a string, aborting");
          }
        } else {
          throw typeErrorCreate("toString is not a function");
        }
      }
      if (!DOMPurify.isSupported) {
        return dirty;
      }
      if (!SET_CONFIG) {
        _parseConfig(cfg);
      }
      DOMPurify.removed = [];
      if (typeof dirty === "string") {
        IN_PLACE = false;
      }
      if (IN_PLACE) {
        if (dirty.nodeName) {
          const tagName = transformCaseFunc(dirty.nodeName);
          if (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName]) {
            throw typeErrorCreate("root node is forbidden and cannot be sanitized in-place");
          }
        }
      } else if (dirty instanceof Node) {
        body = _initDocument("<!---->");
        importedNode = body.ownerDocument.importNode(dirty, true);
        if (importedNode.nodeType === NODE_TYPE.element && importedNode.nodeName === "BODY") {
          body = importedNode;
        } else if (importedNode.nodeName === "HTML") {
          body = importedNode;
        } else {
          body.appendChild(importedNode);
        }
      } else {
        if (!RETURN_DOM && !SAFE_FOR_TEMPLATES && !WHOLE_DOCUMENT &&
dirty.indexOf("<") === -1) {
          return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? trustedTypesPolicy.createHTML(dirty) : dirty;
        }
        body = _initDocument(dirty);
        if (!body) {
          return RETURN_DOM ? null : RETURN_TRUSTED_TYPE ? emptyHTML : "";
        }
      }
      if (body && FORCE_BODY) {
        _forceRemove(body.firstChild);
      }
      const nodeIterator = _createNodeIterator(IN_PLACE ? dirty : body);
      while (currentNode = nodeIterator.nextNode()) {
        _sanitizeElements(currentNode);
        _sanitizeAttributes(currentNode);
        if (currentNode.content instanceof DocumentFragment) {
          _sanitizeShadowDOM(currentNode.content);
        }
      }
      if (IN_PLACE) {
        return dirty;
      }
      if (RETURN_DOM) {
        if (RETURN_DOM_FRAGMENT) {
          returnNode = createDocumentFragment.call(body.ownerDocument);
          while (body.firstChild) {
            returnNode.appendChild(body.firstChild);
          }
        } else {
          returnNode = body;
        }
        if (ALLOWED_ATTR.shadowroot || ALLOWED_ATTR.shadowrootmode) {
          returnNode = importNode.call(originalDocument, returnNode, true);
        }
        return returnNode;
      }
      let serializedHTML = WHOLE_DOCUMENT ? body.outerHTML : body.innerHTML;
      if (WHOLE_DOCUMENT && ALLOWED_TAGS["!doctype"] && body.ownerDocument && body.ownerDocument.doctype && body.ownerDocument.doctype.name && regExpTest(DOCTYPE_NAME, body.ownerDocument.doctype.name)) {
        serializedHTML = "<!DOCTYPE " + body.ownerDocument.doctype.name + ">\n" + serializedHTML;
      }
      if (SAFE_FOR_TEMPLATES) {
        arrayForEach([MUSTACHE_EXPR2, ERB_EXPR2, TMPLIT_EXPR2], (expr) => {
          serializedHTML = stringReplace(serializedHTML, expr, " ");
        });
      }
      return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? trustedTypesPolicy.createHTML(serializedHTML) : serializedHTML;
    };
    DOMPurify.setConfig = function() {
      let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
      _parseConfig(cfg);
      SET_CONFIG = true;
    };
    DOMPurify.clearConfig = function() {
      CONFIG2 = null;
      SET_CONFIG = false;
    };
    DOMPurify.isValidAttribute = function(tag, attr, value) {
      if (!CONFIG2) {
        _parseConfig({});
      }
      const lcTag = transformCaseFunc(tag);
      const lcName = transformCaseFunc(attr);
      return _isValidAttribute(lcTag, lcName, value);
    };
    DOMPurify.addHook = function(entryPoint, hookFunction) {
      if (typeof hookFunction !== "function") {
        return;
      }
      arrayPush(hooks[entryPoint], hookFunction);
    };
    DOMPurify.removeHook = function(entryPoint, hookFunction) {
      if (hookFunction !== void 0) {
        const index = arrayLastIndexOf(hooks[entryPoint], hookFunction);
        return index === -1 ? void 0 : arraySplice(hooks[entryPoint], index, 1)[0];
      }
      return arrayPop(hooks[entryPoint]);
    };
    DOMPurify.removeHooks = function(entryPoint) {
      hooks[entryPoint] = [];
    };
    DOMPurify.removeAllHooks = function() {
      hooks = _createHooksMap();
    };
    return DOMPurify;
  }
  var purify = createDOMPurify();
  const sanitizeHtml = (html2) => {
    return purify.sanitize(html2, {
      USE_PROFILES: { html: true }
    });
  };
  const sleep$1 = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function handleAIStudio() {
    const payload = GM_getValue("ai_studio_prompt_payload");
    if (!payload) {
      Logger.debug("AI Studio: No payload found in GM storage, skipping automation.");
      return;
    }
    Logger.info("AI Studio: Automation triggered.");
    try {
      GM_setValue("ai_studio_status", "Configuring AI model...");
      await automateModelSelection();
      await automateDisableSearch();
      await automateEnableUrlContext();
      GM_setValue("ai_studio_status", "Injecting metadata thread...");
      const requestId = GM_getValue("ai_studio_request_id");
      await injectPrompt(payload);
      await sleep$1(500);
      GM_setValue("ai_studio_status", "Submitting prompt...");
      await automateRun();
      const responseText = await waitForResponse();
      GM_setValue("ai_studio_status", "Response received!");
      GM_setValue("ai_studio_response_payload", {
        text: responseText,
        requestId,
        includeDescendants: GM_getValue("ai_studio_include_descendants", false),
        timestamp: Date.now()
      });
      GM_deleteValue("ai_studio_prompt_payload");
      GM_deleteValue("ai_studio_request_id");
      GM_deleteValue("ai_studio_include_descendants");
      GM_deleteValue("ai_studio_status");
      Logger.info("AI Studio: Response sent. Tab will close in 5m if no interaction.");
      let hasInteracted = false;
      const markInteracted = () => {
        if (!hasInteracted) {
          hasInteracted = true;
          Logger.info("AI Studio: User returned to tab. Auto-close canceled.");
        }
      };
      window.addEventListener("blur", () => {
        window.addEventListener("mousedown", markInteracted, { once: true, capture: true });
        window.addEventListener("keydown", markInteracted, { once: true, capture: true });
        window.addEventListener("mousemove", markInteracted, { once: true, capture: true });
      }, { once: true });
      setTimeout(() => {
        if (!hasInteracted && document.visibilityState !== "visible") {
          Logger.info("AI Studio: Idle and backgrounded. Closing tab.");
          window.close();
        } else if (!hasInteracted) {
          Logger.info("AI Studio: 5m reached but tab is currently visible. Postponing close.");
        }
      }, 5 * 60 * 1e3);
    } catch (error) {
      Logger.error("AI Studio: Automation failed", error);
      GM_setValue("ai_studio_status", `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async function waitForElement(selector, timeout = 3e4) {
    return new Promise((resolve, reject) => {
      const check = () => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) return elements[0];
        return null;
      };
      const existing = check();
      if (existing) return resolve(existing);
      if (window.location.href.includes("accounts.google.com") || document.body?.innerText.includes("Sign in")) {
        return reject(new Error("Login Required"));
      }
      const observer = new MutationObserver((_, obs) => {
        const el = check();
        if (el) {
          obs.disconnect();
          resolve(el);
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for element: ${selector}`));
      }, timeout);
    });
  }
  async function automateModelSelection() {
    const modelCard = await waitForElement("button.model-selector-card");
    if (modelCard.innerText.includes("Flash 3") || modelCard.innerText.includes("Gemini 3 Flash")) {
      return;
    }
    modelCard.click();
    const flash3Btn = await waitForElement('button[id*="gemini-3-flash-preview"]');
    flash3Btn.click();
  }
  async function automateDisableSearch() {
    const searchToggle = await waitForElement("button[aria-label='Grounding with Google Search']");
    if (searchToggle.classList.contains("mdc-switch--checked")) {
      searchToggle.click();
    }
  }
  async function automateEnableUrlContext() {
    Logger.debug("AI Studio: Searching for URL context toggle...");
    const urlToggle = await waitForElement(
      "button[aria-label='URL context'], button[aria-label='URL Context'], button[aria-label='Browse the url context'], button[aria-label='URL tool'], button[aria-label='URL Tool']",
      5e3
    ).catch(() => null);
    if (urlToggle) {
      if (urlToggle.classList.contains("mdc-switch--unselected")) {
        Logger.info("AI Studio: Enabling URL context tool.");
        urlToggle.click();
      } else {
        Logger.debug("AI Studio: URL context tool already enabled.");
      }
    } else {
      Logger.warn("AI Studio: URL context toggle not found.");
    }
  }
  async function injectPrompt(payload) {
    const textarea = await waitForElement("textarea[aria-label='Enter a prompt']");
    textarea.value = payload;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
    textarea.setSelectionRange(0, 0);
  }
  async function automateRun() {
    const runBtn = await waitForElement("ms-run-button button");
    runBtn.focus();
    runBtn.click();
  }
  async function waitForResponse(timeoutMs = 18e4) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let generationStarted = false;
      let hasRetried = false;
      const checkCompletion = () => {
        const elapsed = Date.now() - startTime;
        if (elapsed > timeoutMs) return reject(new Error("Timeout"));
        const stopBtn = document.querySelector('button[aria-label="Stop generation"], .ms-button-spinner, mat-icon[data-icon-name="stop"], mat-icon[data-icon-name="progress_activity"]');
        const runBtn = document.querySelector("ms-run-button button");
        const hasResponseNodes = document.querySelector("ms-cmark-node") !== null;
        const hasError = document.querySelector(".model-error") !== null;
        if (stopBtn || hasResponseNodes || hasError) {
          if (!generationStarted) {
            generationStarted = true;
            GM_setValue("ai_studio_status", "AI is thinking...");
          }
        }
        if (generationStarted && !stopBtn && runBtn && runBtn.textContent?.includes("Run")) {
          const turnList = document.querySelectorAll("ms-chat-turn");
          const lastTurn = turnList[turnList.length - 1];
          if (!lastTurn) return setTimeout(checkCompletion, 1e3);
          const errorEl = lastTurn.querySelector(".model-error");
          if (errorEl) {
            if (!hasRetried) {
              const rerunBtn = document.querySelector('button[name="rerun-button"], .rerun-button');
              if (rerunBtn) {
                GM_setValue("ai_studio_status", "Retrying...");
                hasRetried = true;
                generationStarted = false;
                rerunBtn.click();
                return setTimeout(checkCompletion, 2e3);
              }
            }
            return resolve(`<div class="pr-ai-error">Error: ${errorEl.textContent}</div>`);
          }
          const editIcon = Array.from(lastTurn.querySelectorAll(".material-symbols-outlined")).find((el) => el.textContent?.trim() === "edit");
          if (!editIcon) return setTimeout(checkCompletion, 1e3);
          const container = lastTurn.querySelector("div.model-response-content, .message-content, .turn-content") || lastTurn;
          const cleanHtml = sanitizeHtml(container.innerHTML.replace(/<button[^>]*>.*?<\/button>/g, ""));
          const parsed = new DOMParser().parseFromString(cleanHtml, "text/html");
          const cleanText = (parsed.body.textContent || "").replace(/\s+/g, " ").trim();
          if (cleanText.length > 10) {
            return resolve(`<div class="pr-ai-text">${cleanHtml}</div>`);
          }
        }
        setTimeout(checkCompletion, 1e3);
      };
      checkCompletion();
    });
  }
  const getRoute = () => {
    const host = window.location.hostname;
    const pathname = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    if (host === "aistudio.google.com") {
      if (!pathname.startsWith("/prompts")) {
        Logger.debug(`AI Studio Router: Skipping non-prompt path: ${pathname}`);
        return { type: "skip" };
      }
      if (window.self !== window.top) {
        Logger.debug("AI Studio Router: Skipping iframe");
        return { type: "skip" };
      }
      return { type: "ai-studio" };
    }
    const isForumDomain = host.includes("lesswrong.com") || host.includes("forum.effectivealtruism.org") || host.includes("greaterwrong.com");
    if (!isForumDomain) {
      return { type: "skip" };
    }
    if (!pathname.startsWith("/reader")) {
      return { type: "forum-injection" };
    }
    if (params.get("view") === "archive") {
      const username = params.get("username");
      if (username) {
        return { type: "archive", username };
      }
    }
    if (pathname === "/reader/reset") {
      return { type: "reader", path: "reset" };
    }
    return { type: "reader", path: "main" };
  };
  const runAIStudioMode = async () => {
    Logger.info("AI Studio: Main domain detected, initializing automation...");
    await handleAIStudio();
  };
  const STYLES = `
  html, body {
    margin: 0;
    padding: 0;
    background: #FFFFFF;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #000;
    min-height: 100%;
    line-height: 1.35;
  }

  p {
    margin-block-start: .6em;
    margin-block-end: .6em;
  }

  #power-reader-root {
    margin: 0 auto;
    padding: 20px;
    position: relative;
    box-sizing: border-box;
  }

  /* Resize handles */
  .pr-resize-handle {
    position: fixed;
    top: 0;
    bottom: 0;
    width: 8px;
    cursor: ew-resize;
    z-index: 1000;
    opacity: 0;
    transition: opacity 0.2s;
    background: linear-gradient(to right, transparent, rgba(0,0,0,0.1), transparent);
  }

  .pr-resize-handle:hover,
  .pr-resize-handle.dragging {
    opacity: 1;
    background: linear-gradient(to right, transparent, rgba(0,120,255,0.3), transparent);
  }

  .pr-resize-handle.left {
    left: 0;
  }

  .pr-resize-handle.right {
    right: 0;
  }

  .pr-header {
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 1px solid #ddd;
  }

  .pr-header h1 {
    margin: 0 0 10px 0;
  }

  .pr-status {
    color: #666;
    font-size: 0.9em;
  }

  /* Sticky AI status indicator */
  .pr-sticky-ai-status {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(40, 167, 69, 0.9);
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 0.85em;
    font-weight: bold;
    z-index: 6000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    display: none; /* Hidden by default */
    pointer-events: none;
    transition: opacity 0.3s;
  }

  .pr-sticky-ai-status.visible {
    display: block;
  }

  @keyframes parentHighlight {
    0% { background-color: #ffe066; }
    100% { background-color: transparent; }
  }

  /* Navigation flash (animation) */
  .pr-highlight-parent {
    animation: parentHighlight 2s ease-out forwards;
  }
  .pr-post-header.pr-highlight-parent {
    background: #ffe066 !important;
    animation: parentHighlight 2s ease-out forwards;
  }



  /* Highlight for inline reactions */
  .pr-highlight {
    background-color: #fffacd;
    border-bottom: 2px solid #ffd700;
    cursor: help;
  }

  .pr-warning {
    background: #fff3cd;
    border: 1px solid #ffc107;
    color: #856404;
    padding: 12px 16px;
    border-radius: 4px;
    margin-bottom: 20px;
  }

  .pr-setup {
    max-width: 500px;
    margin: 40px auto;
    padding: 30px;
    background: #f9f9f9;
    border-radius: 8px;
    border: 1px solid #ddd;
  }

  .pr-setup p {
    margin: 0 0 20px 0;
    color: #444;
  }

  .pr-setup-form {
    margin-bottom: 20px;
  }

  .pr-setup-form label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
  }

  .pr-setup-form input[type="date"] {
    width: 100%;
    padding: 10px;
    font-size: 16px;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-sizing: border-box;
  }

  .pr-btn {
    display: inline-block;
    padding: 12px 24px;
    background: #0078ff;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .pr-btn:hover {
    background: #0056cc;
  }

  /* Animation for newly revealed context */
  @keyframes pr-fade-in-glow {
    0% { background-color: #fff3e0; } /* Material Orange 50 */
    100% { background-color: transparent; }
  }

  .pr-just-revealed {
    animation: pr-fade-in-glow 2s ease-out;
  }

  .pr-help {
    background: #f9f9f9;
    margin-bottom: 20px;
    border-radius: 4px;
    font-size: 0.85em;
    border: 1px solid #e0e0e0;
  }

  .pr-help summary {
    padding: 10px 15px;
    cursor: pointer;
    background: #f0f0f0;
    border-radius: 4px 4px 0 0;
    font-weight: bold;
    user-select: none;
  }

  .pr-help summary:hover {
    background: #e8e8e8;
  }

  /* When collapsed, keep bottom rounded */
  .pr-help:not([open]) summary {
    border-radius: 4px;
  }

  .pr-help-content {
    padding: 15px;
    border-top: 1px solid #e0e0e0;
  }

  .pr-help-columns {
    column-count: 3;
    column-gap: 20px;
  }

  @media (max-width: 1200px) {
    .pr-help-columns { column-count: 2; }
  }

  @media (max-width: 800px) {
    .pr-help-columns { column-count: 1; }
  }

  .pr-help-section {
    break-inside: avoid;
    margin-bottom: 8px;
  }


  .pr-help ul {
    margin: 0;
    padding-left: 20px;
  }

  .pr-help li {
    margin: 4px 0;
  }

  .pr-help h4 {
    margin: 12px 0 6px 0;
    font-size: 1em;
  }

  .pr-help h4:first-child {
    margin-top: 0;
  }

  /* Post containers */
  .pr-post {
    margin-bottom: 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #fafafa;
  }

  .pr-post-header {
    padding: 10px 15px;
    background: #f0f0f0;
    border-bottom: 1px solid #ddd;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .pr-post-header h2 {
    margin: 0;
    flex: 1;
    min-width: 0; /* Allow title to shrink if needed */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 1.2em;
  }

  .pr-post-meta {
    margin-bottom: 0 !important;
    gap: 8px !important;
    flex-shrink: 0; /* Keep metadata from shrinking */
  }

  .pr-post-header.header-clickable {
    cursor: pointer;
  }

  .pr-post-header.header-clickable:hover {
    background: #e8e8e8;
  }

  .pr-post-header h2 .pr-post-title {
    color: #000;
    text-decoration: none;
  }

  .pr-post-header h2 .pr-post-title:hover {
    text-decoration: underline;
  }

  .pr-post-actions {
    display: inline-flex;
    gap: 2px;
    margin-right: 6px;
  }

  /* Shared Text Button Style */
  .text-btn {
    cursor: pointer;
    opacity: 0.8;
    transition: opacity 0.2s;
    user-select: none;
    padding: 0 2px;
    font-size: 13px !important;
    font-family: monospace;
    color: #333;
  }

  .text-btn:hover:not(.disabled) {
    opacity: 1;
    color: #000;
  }

  .text-btn.disabled {
    opacity: 0.15 !important;
    cursor: not-allowed;
  }

  .pr-post-toggle {
    /* Styles now handled by .text-btn */
  }

  .pr-post-comments {
    padding: 10px;
  }

  .pr-post-comments.collapsed, .pr-post-content.collapsed, .pr-post-body-container.collapsed {
    display: none;
  }

  /* Post body (full content) */
  .pr-post-body-container {
    padding: 15px 20px;
    background: #fff;
    border-bottom: 1px solid #eee;
    font-family: serif;
    line-height: 1.3;
    overflow-wrap: break-word;
    position: relative;
  }

  .pr-post-body-container.truncated {
    overflow: hidden;
    /* max-height is set dynamically from CONFIG */
    padding-bottom: 50px; /* Space for overlay */
  }

  .pr-post-body {
  }

  .pr-post-body img {
    max-width: min(50vw, 100%);
    height: auto;
  }

  .pr-read-more-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 100px;
    background: linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 80%);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 15px;
    pointer-events: none;
  }

  .pr-read-more-btn {
    background: #0078ff;
    color: #fff;
    border: none;
    padding: 8px 24px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    pointer-events: auto;
    box-shadow: 0 2px 8px rgba(0,120,255,0.3);
  }

  .pr-read-more-btn:hover {
    background: #0056cc;
  }

  /* Shared pr-item class for read tracking */
  .pr-item.read .pr-post-header h2 .pr-post-title {
    color: #707070;
  }

  .pr-item.read .pr-post-body-container {
    opacity: 0.8;
  }

  /* Comment styling */
  .pr-comment {
    margin: 4px 0;
    padding: 0px 10px;
    border: 1px solid black;
    border-radius: 4px;
    background: #fff;
    position: relative; /* Context for absolute positioning */
  }

  .pr-comment.pr-missing-parent {
    min-height: 6px;
    padding-top: 2px;
    padding-bottom: 2px;
  }

  .pr-comment.reply-to-you {
    border: 2px solid #0F0;
  }

  .pr-comment.reply-to-you.read {
    border-width: 1px;
    border-color: #0F0; /* Override general .read border-color */
  }

  .pr-comment.being-summarized, .pr-post.being-summarized {
    border: 2px solid #007bff !important;
    box-shadow: 0 0 8px rgba(0,123,255,0.3);
  }

  .pr-comment.read > .pr-comment-body {
    color: #707070;
  }

  .pr-comment.read {
    border-color: #eee;
  }

  .pr-comment.rejected {
    border: 1px solid red;
  }

  .pr-comment-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    min-height: 24px;
  }

  .pr-author-controls {
    cursor: pointer;
    user-select: none;
    margin: 0 4px;
    display: inline-flex;
    align-items: center;
  }

  .pr-author-controls span {
    margin-right: 2px;
    padding: 0 4px;
    border-radius: 2px;
    font-size: 0.9em;
  }

  .pr-author-controls span:hover {
    background: #e0e0e0;
  }

  .pr-author-controls span.active-up {
    font-weight: bold;
    color: green !important;
  }

  .pr-author-controls span.active-down {
    font-weight: bold;
    color: red !important;
  }

  .pr-author {
    font-weight: bold;
    color: inherit;
    text-decoration: none;
  }

  .pr-author:hover {
    text-decoration: underline;
  }

  .pr-score {
    color: #666;
  }

  .pr-timestamp {
    color: #666;
  }

  .pr-timestamp a {
    color: #666;
    text-decoration: none;
  }

  .pr-timestamp a:hover {
    text-decoration: underline;
  }

  .pr-comment-controls {
    cursor: pointer;
    user-select: none;
    margin-left: auto;
  }

  .pr-comment-action {
    /* Styles now handled by .text-btn */
  }

  .pr-comment-controls span:hover {
    /* Hover color handled by .text-btn */
  }

  .pr-comment-body {
    margin: 4px 0;
    overflow-wrap: break-word;
    line-height: 1.3;
  }

  .pr-comment-body img {
    max-width: min(50vw, 100%);
    height: auto;
  }

  .pr-comment-body blockquote {
    border-left: solid 3px #e0e0e0;
    padding-left: 10px;
    margin: 8px 0 8px 10px;
    color: #555;
  }

  /* Inline Highlights */
  .pr-highlight {
    background-color: #fff9c4; /* Material Yellow 100 */
    cursor: pointer;
    border-bottom: 2px solid #fbc02d; /* Material Yellow 700 */
  }

  .pr-highlight:hover {
    background-color: #fff59d; /* Material Yellow 200 */
  }

  /* Floating Inline Reaction Button */
  .pr-inline-react-btn {
    position: absolute;
    z-index: 1000;
    background: #333;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transform: translateX(-50%);
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    pointer-events: auto;
  }

  .pr-inline-react-btn:hover {
    background: #000;
  }

  .pr-inline-react-btn::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: #333 transparent transparent transparent;
  }



  /* Nested comments */
  .pr-replies {
    margin-left: 20px;
    padding-left: 10px;
    position: relative;
  }

  /* [PR-NEST-05] Visual Indentation Line + 24px Hit Area */
  .pr-replies::before {
    content: '';
    position: absolute;
    left: -11px; /* Centered on the x=0 edge of the container */
    top: 0;
    bottom: 0;
    width: 24px;
    /* 2px solid visual line centered within the 24px hit area */
    background: linear-gradient(to right, transparent 11px, #eee 11px, #eee 13px, transparent 13px);
    cursor: pointer;
    transition: background 0.2s;
    z-index: 1; /* Below content but above container background */
  }

  .pr-replies::before:hover {
    /* Darken line and show subtle background highlight */
    background: linear-gradient(to right, rgba(0,0,0,0.03) 0, rgba(0,0,0,0.03) 11px, #bbb 11px, #bbb 13px, rgba(0,0,0,0.03) 13px, rgba(0,0,0,0.03) 24px);
  }

  /* Collapsed comment preview */
  .pr-comment.collapsed > .pr-comment-body,
  .pr-comment.collapsed > .pr-replies {
    display: none;
  }

  .pr-comment.collapsed > .pr-comment-meta .pr-expand {
    display: inline !important;
  }

  .pr-comment:not(.collapsed) > .pr-comment-meta .pr-expand {
    display: none !important;
  }

  .pr-comment:not(.collapsed) > .pr-comment-meta .pr-collapse {
    display: inline;
  }

  .pr-comment.collapsed > .pr-comment-meta .pr-collapse {
    display: none;
  }

  /* Parent highlight */
  .pr-comment.pr-highlight-parent > .pr-comment-body {
    background-color: yellow !important;
  }

  /* First-time setup */
  .pr-setup {
    max-width: 600px;
    margin: 50px auto;
    padding: 20px;
    background: #f9f9f9;
    border-radius: 8px;
  }

  .pr-setup input[type="text"] {
    width: 100%;
    padding: 8px;
    margin: 10px 0;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-sizing: border-box;
  }

  .pr-setup button {
    padding: 8px 16px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .pr-setup button:hover {
    background: #0056b3;
  }

  /* Loading state */
  .pr-loading {
    text-align: center;
    padding: 40px;
    color: #666;
  }

  /* Error state */
  .pr-error {
    color: red;
    padding: 20px;
    text-align: center;
  }

  /* Voting buttons */
  .pr-vote-controls {
    display: inline-flex;
    gap: 2px;
    margin-right: 8px;
    align-items: center;
  }

  .pr-vote-btn {
    cursor: pointer;
    padding: 0 4px;
    border-radius: 2px;
    user-select: none;
    font-size: 0.9em;
  }

  .pr-vote-btn:hover {
    background: #e0e0e0;
  }

  .pr-vote-btn.active-up {
    color: #0a0;
    font-weight: bold;
  }

  .pr-vote-btn.active-down {
    color: #a00;
    font-weight: bold;
  }

  .pr-vote-btn.agree-active {
    color: #090;
    font-weight: bold;
  }

  .pr-vote-btn.disagree-active {
    color: #900;
    font-weight: bold;
  }

  .pr-karma-score {
    font-weight: bold;
    margin: 0 2px;
    min-width: 1.2em;
    text-align: center;
  }

  .pr-agreement-score {
    color: #666;
    min-width: 1.2em;
    text-align: center;
  }

  /* Reactions */
  .pr-reactions-container {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
    vertical-align: middle;
  }

  .pr-reaction-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border: 1px solid #ddd;
    border-radius: 12px;
    background: #f8f8f8;
    font-size: 0.85em;
    cursor: pointer;
    user-select: none;
    transition: all 0.2s;
  }

  .pr-reaction-chip:hover {
    background: #eee;
    border-color: #ccc;
  }

  .pr-reaction-chip.voted {
    background: #e3f2fd;
    border-color: #2196f3;
  }

  .pr-reaction-icon {
    width: 1.1em;
    height: 1.1em;
    display: inline-block;
  }

  .pr-reaction-icon img {
    width: 100%;
    height: 100%;
    vertical-align: top;
  }

  .pr-add-reaction-btn {
    cursor: pointer;
    padding: 2px 6px;
    color: #888;
    font-size: 1.1em;
    line-height: 1;
    user-select: none;
    transition: color 0.2s;
  }

  .pr-add-reaction-btn:hover {
    color: #333;
  }

  .pr-add-reaction-btn svg {
    display: inline-block;
    vertical-align: middle;
    pointer-events: none; /* Let the click fall through to the button */
    width: 1em;
    height: 1em;
  }

  /* Reaction Picker */
  .pr-reaction-picker {
    position: absolute;
    z-index: 3000;
    background: white;
    border: 1px solid #ccc;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 0;
    width: fit-content;
    max-width: 95vw;
    height: auto;
    display: none;
    box-sizing: border-box;
    flex-direction: column;
    overflow: visible;
  }

  .pr-reaction-picker.visible {
    display: flex;
  }

  .pr-picker-header {
    padding: 8px 12px 0 12px;
    flex-shrink: 0;
  }

  .pr-picker-scroll-container {
    padding: 0 12px 12px 12px;
    overflow-y: auto;
    overflow-x: hidden;
    flex-grow: 1;
    scrollbar-width: thin;
  }

  .pr-reaction-picker * {
    box-sizing: border-box;
  }

  .pr-picker-search {
    margin-bottom: 8px;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .pr-picker-search input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  }

  .pr-picker-section-title {
    font-size: 0.75em;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 8px 0 4px 0;
    padding-bottom: 2px;
    border-bottom: 1px solid #eee;
  }
  
  .pr-picker-section-title:first-child {
    margin-top: 0;
  }

  .pr-picker-grid-separator {
    grid-column: 1 / -1;
    height: 1px;
    background: #bbb;
    margin: 8px 0;
  }

  .pr-reaction-picker-grid {
    display: grid;
    grid-template-columns: repeat(9, 38px);
    gap: 4px;
    width: 100%;
  }

  .pr-reaction-picker-item {
    width: 38px;
    height: 38px;
    padding: 0;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.1s;
    position: relative; /* CRITICAL for tooltips */
  }

  .pr-reaction-picker-item:hover {
    background: #f0f0f0;
  }
  
  .pr-reaction-picker-item.active {
    background: #e3f2fd;
    border: 1px solid #2196f3;
  }

  .pr-reaction-picker-item img {
    width: 24px;
    height: 24px;
  }

  .pr-tooltip-global {
    position: fixed;
    z-index: 9999;
    background: #222;
    color: white;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 11px;
    white-space: normal;
    min-width: 100px;
    max-width: 180px;
    text-align: left;
    pointer-events: none;
    line-height: 1.4;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    border: 1px solid #444;
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.1s;
  }

  .pr-tooltip-global strong {
    display: block;
    margin-bottom: 2px;
    font-size: 1.1em;
    color: #fff;
  }

  /* Hover preview */
  .pr-preview-overlay {
    position: fixed;
    z-index: 2000;
    background: #fff;
    border: 2px solid #333;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    max-height: 80vh;
    overflow-y: auto;
    padding: 16px;
    pointer-events: auto;
  }

  .pr-preview-overlay.post-preview {
    max-width: 80vw;
    width: 800px;
  }

  .pr-preview-overlay.comment-preview {
    max-width: 600px;
  }

  .pr-preview-overlay.author-preview {
    max-width: 500px;
    border-color: #0078ff;
  }

  .pr-preview-overlay .pr-preview-header {
    font-weight: bold;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #ddd;
  }

  .pr-preview-overlay .pr-preview-content {
    line-height: 1.6;
    font-family: serif;
  }

  .pr-preview-overlay .pr-preview-content img {
    max-width: 100%;
  }

  .pr-preview-loading {
    text-align: center;
    color: #666;
    padding: 20px;
  }

  /* Sticky post header */
  .pr-sticky-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1500;
    display: none;
  }

  .pr-sticky-header.visible {
    display: block;
  }

  .pr-sticky-header .pr-post-header {
    margin: 0 auto;
    border-bottom: 2px solid #333;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    cursor: pointer;
  }

  .pr-sticky-header .pr-post-header h2 .pr-post-title {
    cursor: pointer;
  }

  /* List View Styles */
  .pr-picker-view-toggle {
    float: right;
    cursor: pointer;
    color: #888;
    font-size: 18px;
    user-select: none;
    padding: 0 4px;
  }
  .pr-picker-view-toggle:hover {
    color: #333;
  }

  .pr-reaction-picker-list {
    display: flex;
    flex-wrap: wrap;
    width: 0;
    min-width: 100%;
  }

  /* List Item (Icon + Label) */
  .pr-reaction-list-item {
    width: 50%;
    max-width: 50%;
    height: 32px;
    box-sizing: border-box;
    padding: 2px 4px;
    display: flex;
    align-items: center;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.2s;
  }
  .pr-reaction-list-item:hover {
    background: #f0f0f0;
  }
  .pr-reaction-list-item.active {
    background: #e3f2fd;
    border: 1px solid #2196f3;
  }
  .pr-reaction-list-item img {
    width: 20px;
    height: 20px;
    margin-right: 8px;
    flex-shrink: 0;
  }
  .pr-reaction-list-item span {
    font-size: 13px;
    white-space: pre-wrap; /* Allows 
 to break lines */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .pr-reaction-list-item span.small {
    font-size: 11px;
  }

  .pr-debug-btn {
    padding: 6px 12px;
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9em;
    margin-right: 8px;
  }

  .pr-debug-btn:hover {
    background: #5a6268;
  }

  /* Bottom message */
  .pr-bottom-message {
    margin: 10px auto;
    padding: 15px 20px;
    text-align: center;
    border: 2px dashed #ccc;
    border-radius: 8px;
    color: #666;
    cursor: pointer;
    transition: all 0.2s;
    max-width: 600px;
  }

  .pr-bottom-message:hover {
    background: #f0f0f0;
    border-color: #999;
    color: #333;
  }

  .pr-bottom-message.has-more {
    background: #e3f2fd;
    border-color: #2196f3;
    color: #0d47a1;
    border-style: solid;
  }


  /* AI Studio Response Popup */
  .pr-ai-popup {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    max-width: 100%;
    max-height: 50vh;
    background: white;
    border-bottom: 2px solid #007bff;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 5000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .pr-ai-popup-header {
    background: #f0f7ff;
    padding: 6px 15px;
    border-bottom: 1px solid #cce5ff;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .pr-ai-popup-header h3 {
    margin: 0;
    font-size: 0.9em;
    color: #004085;
  }

  .pr-ai-popup-content {
    padding: 12px 15px;
    overflow-y: auto;
    font-family: inherit;
    font-size: 0.95em;
    line-height: 1.4;
    color: #333;
  }

  .pr-ai-popup-content p { margin-bottom: 0.5em; }
  .pr-ai-popup-content ul, .pr-ai-popup-content ol { margin-bottom: 0.5em; padding-left: 1.5em; }
  .pr-ai-popup-content li { margin-bottom: 0.3em; }
  
  .pr-ai-popup-content h1, 
  .pr-ai-popup-content h2, 
  .pr-ai-popup-content h3 {
    margin-top: 0.8em;
    margin-bottom: 0.3em;
    font-size: 1.1em;
    border-bottom: 1px solid #eee;
    color: #111;
  }

  .pr-ai-popup-content code {
    background: #f8f9fa;
    padding: 2px 4px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9em;
    border: 1px solid #ddd;
  }

  .pr-ai-popup-content pre {
    background: #f8f9fa;
    padding: 10px;
    border-radius: 6px;
    overflow-x: auto;
    border: 1px solid #ddd;
    margin-bottom: 0.6em;
  }

  /* Math/KaTeX Support from AI Studio */
  .pr-ai-popup-content .inline {
    display: inline-block;
    vertical-align: middle;
  }
  
  .pr-ai-popup-content .display {
    display: block;
    text-align: center;
    margin: 1em 0;
  }

  /* Reset pre styles when inside math containers or containing KaTeX to stay inline/clean */
  .pr-ai-popup-content .inline pre,
  .pr-ai-popup-content .display pre,
  .pr-ai-popup-content pre:has(.katex),
  .pr-ai-popup-content pre:has(.rendered) {
    display: inline-flex;
    flex-direction: column;
    background: transparent;
    padding: 0;
    margin: 0;
    border: none;
    border-radius: 0;
    overflow: visible;
    vertical-align: middle;
  }

  .pr-ai-popup-content blockquote {
    border-left: 4px solid #ddd;
    padding-left: 15px;
    margin: 1em 0;
    color: #666;
    font-style: italic;
  }

  /* Support for AI Studio's custom tags - must be inline to avoid breaking sentences */
  ms-cmark-node { display: inline; }

  .pr-ai-popup-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .pr-ai-popup-close, .pr-ai-popup-regen {
    color: white;
    border: none;
    padding: 4px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    font-size: 0.85em;
    transition: background 0.2s;
  }

  .pr-ai-popup-close {
    background: #6c757d;
  }

  .pr-ai-popup-close:hover {
    background: #5a6268;
  }

  .pr-ai-popup-regen {
    background: #28a745;
  }

  .pr-ai-popup-regen:hover {
    background: #218838;
  }

  .pr-ai-popup-content hr {
    border: 0;
    border-top: 1px solid #ccc;
    margin: 10px 0;
  }
  /* Footnote styling: force inline display */
  /* Footnote styling: force inline display */
  .footnote, .footnote-content {
    display: inline !important;
    margin-left: 4px;
  }
  .footnote p, .footnote-content p {
    display: inline !important;
    margin: 0 !important;
  }

  /* Recency highlight via CSS custom property (overridable by .pr-parent-hover) */
  .pr-comment[style*="--pr-recency-color"] {
    background-color: var(--pr-recency-color);
  }

  /* Hover state (static) - higher specificity to override recency */
  .pr-comment.pr-parent-hover,
  .pr-post-header.pr-parent-hover,
  .pr-post-body-container.pr-parent-hover {
    background-color: #ffe066 !important;
    outline: 2px solid orange !important;
    transition: background-color 0.2s;
  }

  /* Archive Mode */
  .pr-archive-item-body {
    padding: 10px 15px;
    background: white;
    border-top: 1px solid #eee;
  }
`;
  const createInitialState = () => ({
    currentUsername: null,
    currentUserId: null,
    currentUserPaletteStyle: null,
    comments: [],
    posts: [],
    commentById: new Map(),
    postById: new Map(),
    childrenByParentId: new Map(),
    subscribedAuthorIds: new Set(),
    moreCommentsAvailable: false,
    primaryPostsCount: 0,
    initialBatchNewestDate: null,
    currentSelection: null,
    lastMousePos: { x: 0, y: 0 },
    currentAIRequestId: null,
    activeAIPopup: null,
    sessionAICache: {},
    isArchiveMode: false,
    archiveUsername: null
  });
  const rebuildIndexes = (state2) => {
    state2.commentById.clear();
    state2.comments.forEach((c) => state2.commentById.set(c._id, c));
    state2.postById.clear();
    state2.posts.forEach((p) => state2.postById.set(p._id, p));
    state2.childrenByParentId.clear();
    state2.comments.forEach((c) => {
      const parentId = c.parentCommentId || "";
      if (!state2.childrenByParentId.has(parentId)) {
        state2.childrenByParentId.set(parentId, []);
      }
      state2.childrenByParentId.get(parentId).push(c);
    });
    state2.childrenByParentId.forEach((children) => {
      children.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
    });
  };
  const syncCommentInState = (state2, commentId, updates) => {
    const comment = state2.commentById.get(commentId);
    if (comment) {
      Object.assign(comment, updates);
    }
  };
  const syncPostInState = (state2, postId, updates) => {
    const post = state2.postById.get(postId);
    if (post) {
      Object.assign(post, updates);
    }
  };
  let globalState = null;
  const getState = () => {
    if (!globalState) {
      globalState = createInitialState();
    }
    return globalState;
  };
  const executeTakeover = () => {
    window.getState = getState;
    window.stop();
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = function(tagName, options) {
      if (tagName.toLowerCase() === "script") {
        Logger.warn("Blocking script creation attempt");
        return originalCreateElement("div");
      }
      return originalCreateElement(tagName, options);
    };
    const scriptObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLScriptElement) {
            node.remove();
          }
        });
      });
    });
    scriptObserver.observe(document.documentElement, { childList: true, subtree: true });
    Logger.info("Initializing...");
    const protectionObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          const root = document.getElementById("power-reader-root");
          if (document.body && !root && !document.querySelector(".pr-loading")) {
            Logger.warn("UI cleared by site code! Re-injecting...");
            rebuildDocument();
          }
        }
      }
    });
    protectionObserver.observe(document.documentElement, { childList: true, subtree: true });
  };
  const rebuildDocument = () => {
    const html2 = `
    <head>
      <meta charset="UTF-8">
      <title>Less Wrong: Power Reader v${"1.2.682"}</title>
      <style>${STYLES}</style>
    </head>
    <body>
      <div id="power-reader-root">
        <div class="pr-loading">Loading Power Reader...</div>
      </div>
      <div id="pr-sticky-header" class="pr-sticky-header"></div>
      <div id="lw-power-reader-ready-signal" style="display: none;"></div>
    </body>
  `;
    if (document.documentElement) {
      document.documentElement.innerHTML = html2;
    } else {
      Logger.warn("document.documentElement is missing, attempting fallback write");
      document.write(html2);
      document.close();
    }
  };
  const signalReady = () => {
    const signal = document.getElementById("lw-power-reader-ready-signal");
    if (signal) {
      signal.style.display = "block";
    }
    window.__LW_POWER_READER_READY__ = true;
  };
  const getRoot = () => {
    return document.getElementById("power-reader-root");
  };
  const LOG_PREFIX = "[GraphQL Client]";
  function isToleratedGraphQLError(err, patterns) {
    const message = typeof err?.message === "string" ? err.message : "";
    const pathText = Array.isArray(err?.path) ? err.path.join(".") : "";
    return patterns.some((pattern) => {
      if (typeof pattern === "string") {
        return message.includes(pattern) || pathText.includes(pattern);
      }
      return pattern.test(message) || pattern.test(pathText);
    });
  }
  function getGraphQLEndpoint() {
    const hostname = window.location.hostname;
    if (hostname === "forum.effectivealtruism.org") {
      return "https://forum.effectivealtruism.org/graphql";
    }
    return "https://www.lesswrong.com/graphql";
  }
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function makeRequest(url, data) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url,
        headers: { "Content-Type": "application/json" },
        data,
        timeout: 3e4,
        onload: (response) => resolve(response),
        onerror: (err) => reject(err),
        ontimeout: () => reject(new Error("Request timed out"))
      });
    });
  }
  async function queryGraphQL(query, variables = {}, options = {}) {
    const url = getGraphQLEndpoint();
    const data = JSON.stringify({ query, variables });
    const maxAttempts = 3;
    const delays = [1e3, 2e3];
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await makeRequest(url, data);
        if (response.status === 429 || response.status >= 500) {
          if (attempt < maxAttempts - 1) {
            await sleep(delays[attempt]);
            continue;
          }
          throw new Error(`HTTP ${response.status} after ${maxAttempts} attempts`);
        }
        let res;
        try {
          res = JSON.parse(response.responseText);
        } catch (parseError) {
          const error = parseError instanceof Error ? parseError : new Error("Failed to parse response JSON");
          console.error(LOG_PREFIX, "GraphQL response parse failed:", response.responseText);
          throw error;
        }
        if (res.errors) {
          const errors = Array.isArray(res.errors) ? res.errors : [res.errors];
          const label = options.operationName ? ` (${options.operationName})` : "";
          if (options.allowPartialData && res.data) {
            const patterns = options.toleratedErrorPatterns || [];
            const untolerated = errors.filter((err) => !isToleratedGraphQLError(err, patterns));
            if (untolerated.length === 0) {
              console.warn(LOG_PREFIX, `GraphQL partial data accepted${label}:`, errors);
              return res.data;
            }
            console.error(LOG_PREFIX, `GraphQL errors (partial data rejected)${label}:`, untolerated);
            throw new Error(untolerated[0]?.message || "GraphQL error");
          }
          console.error(LOG_PREFIX, `GraphQL errors${label}:`, errors);
          throw new Error(errors[0]?.message || "GraphQL error");
        }
        return res.data;
      } catch (err) {
        const isRetryable = err instanceof Error && (err.message === "Request timed out" || err.message.startsWith("HTTP "));
        if (isRetryable && attempt < maxAttempts - 1) {
          await sleep(delays[attempt]);
          continue;
        }
        if (err instanceof Error && err.message.startsWith("HTTP ")) {
          throw err;
        }
        if (attempt < maxAttempts - 1 && !(err instanceof Error)) {
          await sleep(delays[attempt]);
          continue;
        }
        throw err;
      }
    }
    throw new Error("Failed to execute GraphQL query");
  }
  const GET_CURRENT_USER = (
`
  query GetCurrentUser {
    currentUser {
      _id
      username
      slug
      karma
      reactPaletteStyle
    }
  }
`
  );
  const GET_SUBSCRIPTIONS = (
`
  query GetSubscriptions($userId: String!) {
    subscriptions(selector: { subscriptionState: { userId: $userId, collectionName: "Users" } }) {
      results {
        documentId
      }
    }
  }
`
  );
  const POST_FIELDS_LITE = (
`
  fragment PostFieldsLite on Post {
    _id
    title
    slug
    pageUrl
    postedAt
    baseScore
    voteCount
    commentCount
    wordCount
    user {
      _id
      username
      displayName
      slug
      karma
    }
    extendedScore
    afExtendedScore
    currentUserVote
    currentUserExtendedVote
  }
`
  );
  const POST_FIELDS_FULL = (
`
  fragment PostFieldsFull on Post {
    ...PostFieldsLite
    htmlBody
    contents { markdown }
  }
  ${POST_FIELDS_LITE}
`
  );
  const COMMENT_FIELDS_CORE = (
`
  fragment CommentFieldsCore on Comment {
    _id
    postedAt
    htmlBody
    baseScore
    voteCount
    descendentCount
    directChildrenCount
    pageUrl
    author
    rejected
    topLevelCommentId
    user {
      _id
      username
      displayName
      slug
      karma
      htmlBio
    }
    postId
    parentCommentId
    parentComment {
      _id
      postedAt
      baseScore
      afExtendedScore
      pageUrl
      parentCommentId
      parentComment {
        _id
        postedAt
        parentCommentId
        parentComment {
          _id
          postedAt
          parentCommentId
          parentComment {
            _id
            postedAt
            parentCommentId
            parentComment {
              _id
              postedAt
              parentCommentId
            }
          }
        }
      }
      user {
        _id
        username
        displayName
      }
    }
    extendedScore
    afExtendedScore
    currentUserVote
    currentUserExtendedVote
  }
`
  );
  const COMMENT_FIELDS_LITE = (
`
  fragment CommentFieldsLite on Comment {
    ...CommentFieldsCore
    post {
      ...PostFieldsLite
    }
  }
  ${COMMENT_FIELDS_CORE}
  ${POST_FIELDS_LITE}
`
  );
  const COMMENT_FIELDS = (
`
  fragment CommentFieldsFull on Comment {
    ...CommentFieldsCore
    contents { markdown }
    post {
      ...PostFieldsLite
    }
    latestChildren {
      _id
      postedAt
      htmlBody
      baseScore
      voteCount
      descendentCount
      directChildrenCount
      pageUrl
      author
      rejected
      topLevelCommentId
      postId
      parentCommentId
    }
  }
  ${COMMENT_FIELDS_CORE}
  ${POST_FIELDS_LITE}
`
  );
  const GET_ALL_RECENT_COMMENTS_LITE = (
`
  query GetAllRecentCommentsLite($limit: Int, $after: String, $before: String, $offset: Int, $sortBy: String) {
    comments(
      selector: {
        allRecentComments: {
          after: $after,
          before: $before,
          sortBy: $sortBy
        }
      },
      limit: $limit,
      offset: $offset
    ) {
      results {
        ...CommentFieldsLite
      }
    }
  }
  ${COMMENT_FIELDS_LITE}
`
  );
  const GET_ALL_RECENT_COMMENTS = (
`
  query GetAllRecentComments($limit: Int, $after: String, $before: String, $offset: Int, $sortBy: String) {
    comments(
      selector: {
        allRecentComments: {
          after: $after,
          before: $before,
          sortBy: $sortBy
        }
      },
      limit: $limit,
      offset: $offset
    ) {
      results {
        ...CommentFieldsFull
      }
    }
  }
  ${COMMENT_FIELDS}
`
  );
  const GET_COMMENTS_BY_IDS = (
`
  query GetCommentsByIds($commentIds: [String!]) {
    comments(
      selector: {
        default: {
          commentIds: $commentIds
        }
      }
    ) {
      results {
        ...CommentFieldsFull
      }
    }
  }
  ${COMMENT_FIELDS}
`
  );
  const VOTE_COMMENT_MUTATION = (
`
  mutation Vote($documentId: String!, $voteType: String!, $extendedVote: JSON) {
    performVoteComment(documentId: $documentId, voteType: $voteType, extendedVote: $extendedVote) {
      document {
        _id
        baseScore
        voteCount
        extendedScore
        afExtendedScore
        currentUserVote
        currentUserExtendedVote
        contents { markdown }
      }
    }
  }
`
  );
  const VOTE_POST_MUTATION = (
`
  mutation VotePost($documentId: String!, $voteType: String!, $extendedVote: JSON) {
    performVotePost(documentId: $documentId, voteType: $voteType, extendedVote: $extendedVote) {
      document {
        _id
        baseScore
        voteCount
        extendedScore
        afExtendedScore
        currentUserVote
        currentUserExtendedVote
        contents { markdown }
      }
    }
  }
`
  );
  const GET_POST = (
`
  query GetPost($id: String!) {
    post(selector: { _id: $id }) {
      result {
        ...PostFieldsFull
      }
    }
  }
  ${POST_FIELDS_FULL}
`
  );
  const GET_NEW_POSTS_FULL = (
`
  query GetNewPostsFull($limit: Int, $after: String, $before: String) {
    posts(
      selector: {
        new: {
          after: $after,
          before: $before
        }
      },
      limit: $limit
    ) {
      results {
        ...PostFieldsFull
      }
    }
  }
  ${POST_FIELDS_FULL}
`
  );
  const GET_POST_COMMENTS = (
`
  query GetPostComments($postId: String!, $limit: Int) {
    comments(
      selector: {
        postCommentsNew: {
          postId: $postId
        }
      },
      limit: $limit
    ) {
      results {
        ...CommentFieldsFull
      }
    }
  }
  ${COMMENT_FIELDS}
`
  );
  const GET_THREAD_COMMENTS = (
`
  query GetThreadComments($topLevelCommentId: String!, $limit: Int) {
    comments(
      selector: {
        repliesToCommentThreadIncludingRoot: {
          topLevelCommentId: $topLevelCommentId
        }
      },
      limit: $limit
    ) {
      results {
        ...CommentFieldsFull
      }
    }
  }
  ${COMMENT_FIELDS}
`
  );
  const GET_USER_POSTS = (
`
  query GetUserPosts($userId: String!, $limit: Int, $before: String) {
    posts(
      selector: {
        userPosts: {
          userId: $userId
          sortedBy: "newest"
          before: $before
        }
      },
      limit: $limit
    ) {
      results {
        ...PostFieldsFull
      }
    }
  }
  ${POST_FIELDS_FULL}
`
  );
  const GET_USER_COMMENTS = (
`
  query GetUserComments($userId: String!, $limit: Int, $before: String) {
    comments(
      selector: {
        allRecentComments: {
          userId: $userId
          before: $before
          sortBy: "newest"
        }
      },
      limit: $limit
    ) {
      results {
        ...CommentFieldsLite
      }
    }
  }
  ${COMMENT_FIELDS_LITE}
`
  );
  const GET_USER = (
`
  query GetUser($id: String!) {
    user(selector: { _id: $id }) {
      result {
        _id
        username
        displayName
        slug
        karma
        htmlBio
      }
    }
  }
`
  );
  const GET_USER_BY_SLUG = (
`
  query GetUserBySlug($slug: String!) {
    user: GetUserBySlug(slug: $slug) {
      _id
      username
      displayName
      slug
      karma
      htmlBio
    }
  }
`
  );
  const GET_POST_BY_ID = GET_POST;
  const GET_COMMENT = (
`
  query GetComment($id: String!) {
    comment(selector: { _id: $id }) {
      result {
        ...CommentFieldsFull
      }
    }
  }
  ${COMMENT_FIELDS}
`
  );
  const STORAGE_KEYS = {
    READ: "power-reader-read",
    READ_FROM: "power-reader-read-from",
    AUTHOR_PREFS: "power-reader-author-prefs",
    VIEW_WIDTH: "power-reader-view-width",
    AI_STUDIO_PREFIX: "power-reader-ai-studio-prefix"
  };
  function getKey(baseKey) {
    const hostname = window.location.hostname;
    if (hostname.includes("effectivealtruism.org")) {
      return `ea-${baseKey}`;
    }
    return baseKey;
  }
  let cachedReadState = null;
  let lastReadStateFetch = 0;
  let cachedLoadFrom = null;
  let lastLoadFromFetch = 0;
  if (typeof window !== "undefined" && window.__PR_TEST_MODE__) {
    cachedLoadFrom = null;
    lastLoadFromFetch = 0;
    cachedReadState = null;
    lastReadStateFetch = 0;
  }
  function getReadState() {
    const now = Date.now();
    if (cachedReadState && now - lastReadStateFetch < 100) {
      return cachedReadState;
    }
    try {
      const raw = GM_getValue(getKey(STORAGE_KEYS.READ), "{}");
      cachedReadState = JSON.parse(raw);
      lastReadStateFetch = now;
      return cachedReadState;
    } catch {
      return {};
    }
  }
  function setReadState(state2) {
    cachedReadState = state2;
    lastReadStateFetch = Date.now();
    GM_setValue(getKey(STORAGE_KEYS.READ), JSON.stringify(state2));
  }
  function isRead(id, state2, postedAt) {
    const readMap = state2 || getReadState();
    if (readMap[id] === 1) return true;
    if (postedAt) {
      const cutoff = getLoadFrom();
      if (cutoff && cutoff.includes("T")) {
        const postTime = new Date(postedAt).getTime();
        const cutoffTime = new Date(cutoff).getTime();
        if (!isNaN(postTime) && !isNaN(cutoffTime) && postTime < cutoffTime) {
          return true;
        }
      }
    }
    return false;
  }
  function markAsRead(target) {
    const state2 = getReadState();
    if (typeof target === "string") {
      state2[target] = 1;
    } else {
      Object.assign(state2, target);
    }
    setReadState(state2);
  }
  function getLoadFrom() {
    const now = Date.now();
    if (cachedLoadFrom && now - lastLoadFromFetch < 100) {
      return cachedLoadFrom;
    }
    const raw = GM_getValue(getKey(STORAGE_KEYS.READ_FROM), "");
    cachedLoadFrom = raw;
    lastLoadFromFetch = now;
    return raw;
  }
  function setLoadFrom(isoDatetime) {
    cachedLoadFrom = isoDatetime;
    lastLoadFromFetch = Date.now();
    GM_setValue(getKey(STORAGE_KEYS.READ_FROM), isoDatetime);
  }
  function getAuthorPreferences() {
    try {
      const raw = GM_getValue(getKey(STORAGE_KEYS.AUTHOR_PREFS), "{}");
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  function setAuthorPreferences(prefs) {
    GM_setValue(getKey(STORAGE_KEYS.AUTHOR_PREFS), JSON.stringify(prefs));
  }
  function toggleAuthorPreference(author, direction) {
    const prefs = getAuthorPreferences();
    const current = prefs[author] || 0;
    let newValue;
    if (direction === "up") {
      newValue = current > 0 ? 0 : 1;
    } else {
      newValue = current < 0 ? 0 : -1;
    }
    prefs[author] = newValue;
    setAuthorPreferences(prefs);
    return newValue;
  }
  function clearAllStorage() {
    GM_setValue(getKey(STORAGE_KEYS.READ), "{}");
    GM_setValue(getKey(STORAGE_KEYS.READ_FROM), "");
    GM_setValue(getKey(STORAGE_KEYS.AUTHOR_PREFS), "{}");
    GM_setValue(getKey(STORAGE_KEYS.VIEW_WIDTH), "0");
  }
  function getViewWidth() {
    const raw = GM_getValue(getKey(STORAGE_KEYS.VIEW_WIDTH), "0");
    return parseInt(raw, 10) || 0;
  }
  function setViewWidth(width) {
    GM_setValue(getKey(STORAGE_KEYS.VIEW_WIDTH), String(width));
  }
  function getAIStudioPrefix() {
    return GM_getValue(getKey(STORAGE_KEYS.AI_STUDIO_PREFIX), "");
  }
  function setAIStudioPrefix(prefix) {
    GM_setValue(getKey(STORAGE_KEYS.AI_STUDIO_PREFIX), prefix);
  }
  async function exportState() {
    const exportData = {};
    for (const key of Object.values(STORAGE_KEYS)) {
      const namespacedKey = getKey(key);
      exportData[namespacedKey] = GM_getValue(namespacedKey, "");
    }
    const json = JSON.stringify(exportData, null, 2);
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(json);
        alert("Power Reader state copied to clipboard!");
      } catch (e) {
        Logger.error("Clipboard write failed:", e);
        alert("Failed to write to clipboard. Check console.");
      }
    } else {
      Logger.info("Exported State:", json);
      alert("Clipboard API not available. State logged to console.");
    }
  }
  const CONFIG = {
    loadMax: window.PR_TEST_LIMIT || 800,
    highlightLastN: 33,
    scrollMarkDelay: window.PR_TEST_SCROLL_DELAY ?? 5e3,
hoverDelay: 300,
    maxPostHeight: "50vh"
  };
  const loadInitial = async () => {
    const injection = window.__PR_TEST_STATE_INJECTION__;
    if (injection) {
      Logger.info("Using injected test state");
      return {
        comments: injection.comments || [],
        posts: injection.posts || [],
        currentUsername: injection.currentUsername || null,
        currentUserId: injection.currentUserId || null,
        currentUserPaletteStyle: injection.currentUserPaletteStyle || null
      };
    }
    const loadFrom = getLoadFrom();
    const afterDate = loadFrom === "__LOAD_RECENT__" ? void 0 : loadFrom;
    Logger.info(`Initial fetch: after=${afterDate}`);
    const start = performance.now();
    const [userRes, commentsRes] = await Promise.all([
      queryGraphQL(GET_CURRENT_USER),
      queryGraphQL(GET_ALL_RECENT_COMMENTS_LITE, {
        after: afterDate,
        limit: CONFIG.loadMax,
        sortBy: afterDate ? "oldest" : "newest"
      })
    ]);
    const networkTime = performance.now() - start;
    Logger.info(`Initial fetch network request took ${networkTime.toFixed(2)}ms`);
    const comments = commentsRes?.comments?.results || [];
    let currentUsername = null;
    let currentUserId = null;
    let currentUserPaletteStyle = null;
    if (userRes?.currentUser) {
      currentUsername = userRes.currentUser.username || "";
      currentUserId = userRes.currentUser._id;
      currentUserPaletteStyle = userRes.currentUser.reactPaletteStyle || null;
    }
    const posts = [];
    const seenPostIds = new Set();
    comments.forEach((c) => {
      if (c && c.post) {
        const postId = c.post._id;
        if (!seenPostIds.has(postId)) {
          seenPostIds.add(postId);
          posts.push(c.post);
        }
      }
    });
    const result = {
      comments,
      posts,
      currentUsername,
      currentUserId,
      currentUserPaletteStyle,
      lastInitialCommentDate: comments.length > 0 ? comments[comments.length - 1].postedAt : void 0
    };
    const totalTime = performance.now() - start;
    Logger.info(`Initial load completed in ${totalTime.toFixed(2)}ms (processing: ${(totalTime - networkTime).toFixed(2)}ms)`);
    return result;
  };
  const fetchRepliesBatch = async (parentIds) => {
    const start = performance.now();
    if (parentIds.length === 0) return [];
    const CHUNK_SIZE = 30;
    const allResults = [];
    for (let i = 0; i < parentIds.length; i += CHUNK_SIZE) {
      const chunk = parentIds.slice(i, i + CHUNK_SIZE);
      const query = `
      query GetRepliesBatch(${chunk.map((_, j) => `$id${j}: String!`).join(", ")}) {
        ${chunk.map((_, j) => `
          r${j}: comments(selector: { commentReplies: { parentCommentId: $id${j} } }) {
            results {
              ${COMMENT_FIELDS}
            }
          }
        `).join("\n")}
      }
    `;
      const variables = {};
      chunk.forEach((id, j) => variables[`id${j}`] = id);
      try {
        const res = await queryGraphQL(query, variables);
        if (!res) continue;
        chunk.forEach((_, j) => {
          const results = res[`r${j}`]?.results || [];
          allResults.push(...results);
        });
      } catch (e) {
        Logger.error(`Batch reply fetch failed for chunk starting at ${i}`, e);
      }
    }
    Logger.info(`Batch reply fetch for ${parentIds.length} parents took ${(performance.now() - start).toFixed(2)}ms`);
    return allResults;
  };
  const fetchThreadsBatch = async (threadIds) => {
    const start = performance.now();
    if (threadIds.length === 0) return [];
    const CHUNK_SIZE = 15;
    const allResults = [];
    for (let i = 0; i < threadIds.length; i += CHUNK_SIZE) {
      const chunk = threadIds.slice(i, i + CHUNK_SIZE);
      const query = `
      query GetThreadsBatch(${chunk.map((_, j) => `$id${j}: String!`).join(", ")}) {
        ${chunk.map((_, j) => `
          t${j}: comments(selector: { repliesToCommentThreadIncludingRoot: { topLevelCommentId: $id${j} } }, limit: 100) {
            results {
              ${COMMENT_FIELDS}
            }
          }
        `).join("\n")}
      }
    `;
      const variables = {};
      chunk.forEach((id, j) => variables[`id${j}`] = id);
      try {
        const res = await queryGraphQL(query, variables);
        if (!res) continue;
        chunk.forEach((_, j) => {
          const results = res[`t${j}`]?.results || [];
          allResults.push(...results);
        });
      } catch (e) {
        Logger.error(`Batch thread fetch failed for chunk starting at ${i}`, e);
      }
    }
    Logger.info(`Batch thread fetch for ${threadIds.length} threads took ${(performance.now() - start).toFixed(2)}ms`);
    return allResults;
  };
  const enrichInBackground = async (state2) => {
    const start = performance.now();
    const injection = window.__PR_TEST_STATE_INJECTION__;
    if (injection && injection.posts) {
      return {
        posts: injection.posts,
        comments: injection.comments || state2.comments,
        subscribedAuthorIds: new Set(),
        moreCommentsAvailable: false,
        primaryPostsCount: injection.posts.length
      };
    }
    const currentUserId = state2.currentUserId;
    const allComments = [...state2.comments];
    const subsPromise = currentUserId ? queryGraphQL(GET_SUBSCRIPTIONS, { userId: currentUserId }) : Promise.resolve(null);
    const loadFrom = getLoadFrom();
    const isLoadRecent = loadFrom === "__LOAD_RECENT__";
    const afterDate = isLoadRecent ? void 0 : loadFrom;
    let startDate = afterDate;
    let endDate = void 0;
    if (allComments.length > 0) {
      const commentDates = allComments.map((c) => c && c.postedAt).filter((d) => !!d).sort();
      const oldestCommentDate = commentDates[0];
      const newestCommentDate = commentDates[commentDates.length - 1];
      if (isLoadRecent) {
        startDate = oldestCommentDate;
      } else if (allComments.length >= CONFIG.loadMax) {
        endDate = newestCommentDate;
      }
    }
    const [postsRes, subsRes] = await Promise.all([
      queryGraphQL(GET_NEW_POSTS_FULL, {
        after: startDate,
        before: endDate,
        limit: CONFIG.loadMax
      }),
      subsPromise
    ]);
    const fetchTime = performance.now() - start;
    Logger.info(`Enrichment posts/subs fetch took ${fetchTime.toFixed(2)}ms`);
    const batchPosts = postsRes?.posts?.results || [];
    const primaryPostsCount = batchPosts.length;
    const subscribedAuthorIds = new Set();
    if (subsRes?.subscriptions?.results) {
      subsRes.subscriptions.results.forEach((r) => {
        if (r.documentId) subscribedAuthorIds.add(r.documentId);
      });
    }
    const updatedPosts = [...batchPosts];
    const postIdSet = new Set(batchPosts.map((p) => p._id));
    allComments.forEach((c) => {
      if (c && c.post) {
        const postId = c.post._id;
        if (!postIdSet.has(postId)) {
          postIdSet.add(postId);
          updatedPosts.push(c.post);
        }
      }
    });
    const loadFromValue = getLoadFrom();
    const moreCommentsAvailable = loadFromValue !== "__LOAD_RECENT__" && allComments.length >= CONFIG.loadMax;
    const result = {
      posts: updatedPosts,
      comments: allComments,
      subscribedAuthorIds,
      moreCommentsAvailable,
      primaryPostsCount
    };
    Logger.info(`Enrichment completed in ${(performance.now() - start).toFixed(2)}ms`);
    return result;
  };
  const runSmartLoading = async (state2, readState) => {
    const allComments = [...state2.comments];
    const moreCommentsAvailable = state2.moreCommentsAvailable;
    const forceSmartLoading = window.PR_TEST_FORCE_SMART_LOADING === true;
    const unreadComments = allComments.filter((c) => !readState[c._id]);
    if (!moreCommentsAvailable && !forceSmartLoading || unreadComments.length === 0) {
      return null;
    }
    const start = performance.now();
    Logger.info(`Smart Loading: Processing ${unreadComments.length} unread comments...`);
    const commentMap = new Map();
    allComments.forEach((c) => commentMap.set(c._id, c));
    const unreadByThread = new Map();
    unreadComments.forEach((c) => {
      const threadId = c.topLevelCommentId || c.postId || c._id;
      if (!unreadByThread.has(threadId)) {
        unreadByThread.set(threadId, []);
      }
      unreadByThread.get(threadId).push(c);
    });
    const mergeComment = (comment) => {
      if (!commentMap.has(comment._id)) {
        allComments.push(comment);
        commentMap.set(comment._id, comment);
        return true;
      } else {
        const existing = commentMap.get(comment._id);
        if (existing.contextType === "missing") {
          const idx = allComments.findIndex((c) => c._id === comment._id);
          if (idx !== -1) {
            allComments[idx] = comment;
            commentMap.set(comment._id, comment);
            return true;
          }
        }
      }
      return false;
    };
    const threadIdsToFetchFull = new Set();
    const commentIdsToFetchReplies = new Set();
    const childrenByParent = state2.childrenByParentId;
    const hasMissingChildren = (commentId, directChildrenCount) => {
      if (directChildrenCount <= 0) return false;
      const loadedChildren = childrenByParent.get(commentId);
      return !loadedChildren || loadedChildren.length < directChildrenCount;
    };
    unreadByThread.forEach((threadUnread, threadId) => {
      const commentsWithMissingChildren = threadUnread.filter((c) => {
        const directCount = c.directChildrenCount ?? 0;
        return hasMissingChildren(c._id, directCount);
      });
      if (commentsWithMissingChildren.length >= 3) {
        threadIdsToFetchFull.add(threadId);
        return;
      }
      commentsWithMissingChildren.forEach((target) => {
        commentIdsToFetchReplies.add(target._id);
      });
    });
    const fetchPromises = [];
    if (threadIdsToFetchFull.size > 0) {
      Logger.info(`Smart Loading: Fetching ${threadIdsToFetchFull.size} full threads in batch...`);
      fetchPromises.push(
        fetchThreadsBatch(Array.from(threadIdsToFetchFull)).then((results) => {
          results.forEach(mergeComment);
        })
      );
    }
    if (commentIdsToFetchReplies.size > 0) {
      Logger.info(`Smart Loading: Fetching replies for ${commentIdsToFetchReplies.size} comments in batch...`);
      fetchPromises.push(
        fetchRepliesBatch(Array.from(commentIdsToFetchReplies)).then(async (replyResults) => {
          const newThreadIdsToFetch = new Set();
          const parentToChildrenCount = new Map();
          let anyNewData = false;
          replyResults.forEach((c) => {
            if (mergeComment(c)) anyNewData = true;
            if (c.parentCommentId) {
              parentToChildrenCount.set(c.parentCommentId, (parentToChildrenCount.get(c.parentCommentId) || 0) + 1);
            }
          });
          if (!anyNewData && replyResults.length > 0) return;
          parentToChildrenCount.forEach((count, parentId) => {
            if (count > 1) {
              const parent = commentMap.get(parentId);
              const threadId = parent?.topLevelCommentId || parent?.postId || parentId;
              if (!threadIdsToFetchFull.has(threadId)) {
                newThreadIdsToFetch.add(threadId);
              }
            }
          });
          if (newThreadIdsToFetch.size > 0) {
            Logger.info(`Smart Loading: Dynamic Switch triggered for ${newThreadIdsToFetch.size} threads`);
            const extraResults = await fetchThreadsBatch(Array.from(newThreadIdsToFetch));
            extraResults.forEach(mergeComment);
          }
        })
      );
    }
    await Promise.all(fetchPromises);
    const newCount = allComments.length - state2.comments.length;
    Logger.info(`Smart Loading completed in ${(performance.now() - start).toFixed(2)}ms (${newCount} new comments)`);
    return { comments: allComments };
  };
  const applyEnrichment = (state2, result) => {
    state2.posts = result.posts;
    state2.comments = result.comments;
    state2.subscribedAuthorIds = result.subscribedAuthorIds;
    state2.moreCommentsAvailable = result.moreCommentsAvailable;
    state2.primaryPostsCount = result.primaryPostsCount;
    rebuildIndexes(state2);
  };
  const applySmartLoad = (state2, result) => {
    state2.comments = result.comments;
    rebuildIndexes(state2);
  };
  const applyInitialLoad = (state2, result) => {
    state2.comments = result.comments;
    state2.posts = result.posts;
    state2.currentUsername = result.currentUsername;
    state2.currentUserId = result.currentUserId;
    state2.currentUserPaletteStyle = result.currentUserPaletteStyle;
    state2.primaryPostsCount = 0;
    rebuildIndexes(state2);
    if (state2.comments.length > 0) {
      const validComments = state2.comments.filter((c) => c.postedAt && !isNaN(new Date(c.postedAt).getTime()));
      if (validComments.length > 0) {
        const sorted = [...validComments].sort((a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime());
        const oldestDate = sorted[0].postedAt;
        setLoadFrom(oldestDate);
        Logger.info(`loader: Initial loadFrom snapshot set to ${oldestDate}`);
      }
    }
  };
  const AI_STUDIO_PROMPT_PREFIX = `* summarize the focal post or comment in this thread at 1/3 length or 5 sentences, whichever is shorter (required, no heading)
* explain any context for the focal post or comment not already explained in the summary (optional, heading: Context)
* explain obscure terms or references, inside jokes, etc., but assume familiarity with basic LessWrong/EA knowledge (optional, heading: Clarifications)
* what are the most serious potential errors in the focal post or comment? (optional, heading: Potential Errors)
* if there are 2 or more comments in the thread, summarize the whole thread and highlight the most interesting parts (optional, heading: Thread Summary)
* note that paragraphs prefixed by > are quotes from the previous comment
`;
  const state$1 = {
    isDragging: false,
    startX: 0,
    startWidth: 0,
    dragSide: null
  };
  let rootElement = null;
  function initResizeHandles() {
    rootElement = document.getElementById("power-reader-root");
    if (!rootElement) return;
    const leftHandle = document.createElement("div");
    leftHandle.className = "pr-resize-handle left";
    leftHandle.dataset.side = "left";
    const rightHandle = document.createElement("div");
    rightHandle.className = "pr-resize-handle right";
    rightHandle.dataset.side = "right";
    document.body.appendChild(leftHandle);
    document.body.appendChild(rightHandle);
    const savedWidth = getViewWidth();
    applyWidth(savedWidth);
    leftHandle.addEventListener("mousedown", startDrag);
    rightHandle.addEventListener("mousedown", startDrag);
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", endDrag);
    window.addEventListener("resize", () => {
      const currentWidth = getViewWidth();
      applyWidth(currentWidth);
    });
  }
  function startDrag(e) {
    const handle = e.target;
    state$1.isDragging = true;
    state$1.startX = e.clientX;
    state$1.dragSide = handle.dataset.side;
    state$1.startWidth = rootElement?.offsetWidth || window.innerWidth;
    handle.classList.add("dragging");
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  }
  function onDrag(e) {
    if (!state$1.isDragging || !rootElement) return;
    const deltaX = e.clientX - state$1.startX;
    let newWidth;
    if (state$1.dragSide === "left") {
      newWidth = state$1.startWidth - deltaX * 2;
    } else {
      newWidth = state$1.startWidth + deltaX * 2;
    }
    const minWidth = 400;
    const maxWidth = window.innerWidth;
    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    applyWidth(newWidth);
  }
  function endDrag() {
    if (!state$1.isDragging) return;
    state$1.isDragging = false;
    state$1.dragSide = null;
    document.querySelectorAll(".pr-resize-handle").forEach((h) => {
      h.classList.remove("dragging");
    });
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    if (rootElement) {
      const width = rootElement.offsetWidth;
      setViewWidth(width);
    }
  }
  function applyWidth(width) {
    if (!rootElement) return;
    if (width <= 0 || width >= window.innerWidth) {
      rootElement.style.maxWidth = "";
      rootElement.style.width = "100%";
    } else {
      rootElement.style.maxWidth = `${width}px`;
      rootElement.style.width = `${width}px`;
    }
    updateHandlePositions();
  }
  function updateHandlePositions() {
    if (!rootElement) return;
    const rect = rootElement.getBoundingClientRect();
    const leftHandle = document.querySelector(".pr-resize-handle.left");
    const rightHandle = document.querySelector(".pr-resize-handle.right");
    if (leftHandle) {
      leftHandle.style.left = `${Math.max(0, rect.left - 4)}px`;
    }
    if (rightHandle) {
      rightHandle.style.left = `${Math.min(window.innerWidth - 8, rect.right - 4)}px`;
    }
  }
  const HOVER_DELAY = 300;
  const state = {
    activePreview: null,
    triggerRect: null,
    hoverTimeout: null,
    currentTrigger: null
  };
  let lastScrollTime = 0;
  let lastMouseMoveTime = 0;
  let lastKnownMousePos = { x: -1, y: -1 };
  let listenersAdded = false;
  function initPreviewSystem() {
    if (listenersAdded) return;
    Logger.debug("initPreviewSystem: adding global listeners");
    document.addEventListener("mousemove", (e) => {
      trackMousePos(e);
      handleGlobalMouseMove(e);
    });
    document.addEventListener("click", handleGlobalClick, true);
    document.addEventListener("mousedown", () => dismissPreview(), true);
    window.addEventListener("scroll", () => {
      lastScrollTime = Date.now();
      dismissPreview();
    }, { passive: true });
    listenersAdded = true;
  }
  function trackMousePos(e) {
    if (e.clientX === lastKnownMousePos.x && e.clientY === lastKnownMousePos.y) return;
    lastKnownMousePos = { x: e.clientX, y: e.clientY };
    lastMouseMoveTime = Date.now();
  }
  function isIntentionalHover() {
    const now = Date.now();
    if (now - lastScrollTime < 300) {
      return false;
    }
    if (now - lastMouseMoveTime > 500) {
      return false;
    }
    if (lastScrollTime > lastMouseMoveTime) {
      return false;
    }
    return true;
  }
  function handleGlobalMouseMove(e) {
    if (!state.activePreview || !state.triggerRect) return;
    const inTrigger = isPointInRect(e.clientX, e.clientY, state.triggerRect);
    if (!inTrigger) {
      dismissPreview();
    }
  }
  function handleGlobalClick(e) {
    if (!state.activePreview || !state.triggerRect || !state.currentTrigger) return;
    const inTrigger = isPointInRect(e.clientX, e.clientY, state.triggerRect);
    if (inTrigger) {
      const isMiddleClick = e.button === 1;
      if (state.currentTrigger.dataset.action === "load-post") {
        dismissPreview();
        return;
      }
      const href = state.currentTrigger.getAttribute("href") || state.currentTrigger.dataset.href;
      const target = state.currentTrigger.getAttribute("target");
      if (href) {
        if (e.ctrlKey || e.metaKey || isMiddleClick || target === "_blank") {
          e.preventDefault();
          e.stopPropagation();
          openInNewTab(href);
        } else {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = href;
        }
        dismissPreview();
      }
    }
  }
  function isPointInRect(x, y, rect) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }
  function cancelHoverTimeout() {
    if (state.hoverTimeout) {
      Logger.debug("cancelHoverTimeout: clearing timeout", state.hoverTimeout);
      clearTimeout(state.hoverTimeout);
      state.hoverTimeout = null;
    }
  }
  function dismissPreview() {
    Logger.debug("dismissPreview called");
    cancelHoverTimeout();
    if (state.activePreview) {
      Logger.debug("dismissPreview: removing active preview");
      state.activePreview.remove();
      state.activePreview = null;
    }
    state.triggerRect = null;
    state.currentTrigger = null;
  }
  function setupHoverPreview(trigger, fetchContent, options) {
    if (trigger.dataset.previewAttached) return;
    trigger.dataset.previewAttached = "1";
    trigger.addEventListener("mouseenter", (e) => {
      trackMousePos(e);
      Logger.debug("Preview mouseenter: trigger=", trigger.tagName, trigger.className, "dataset=", JSON.stringify(trigger.dataset));
      if (!isIntentionalHover()) {
        return;
      }
      Logger.debug("setupHoverPreview: clearing pending timeout", state.hoverTimeout);
      if (options.targetGetter) {
        const result = options.targetGetter();
        if (result) {
          const targets = Array.isArray(result) ? result : [result];
          if (targets.length > 0) {
            console.info(`[setupHoverPreview] Adding pr-parent-hover to ${targets.length} targets`);
            targets.forEach((t) => t.classList.add("pr-parent-hover"));
            const removeHighlight = () => {
              console.info(`[setupHoverPreview] Removing pr-parent-hover from ${targets.length} targets`);
              targets.forEach((t) => t.classList.remove("pr-parent-hover"));
              trigger.removeEventListener("mouseleave", removeHighlight);
            };
            trigger.addEventListener("mouseleave", removeHighlight);
          }
          const allFullyVisible = targets.every((t) => {
            const isSticky = !!t.closest(".pr-sticky-header");
            if (isSticky) return false;
            return isElementFullyVisible(t);
          });
          if (allFullyVisible) {
            return;
          }
        }
      }
      state.hoverTimeout = window.setTimeout(async () => {
        state.hoverTimeout = null;
        Logger.debug("Preview timer triggered for", options.type);
        state.triggerRect = trigger.getBoundingClientRect();
        state.currentTrigger = trigger;
        if (options.href) {
          trigger.dataset.href = options.href;
        }
        try {
          const content = await fetchContent();
          if (state.currentTrigger !== trigger) {
            Logger.debug("Preview aborted: trigger changed during fetch");
            return;
          }
          Logger.debug("Preview content fetched", content.length);
          showPreview(content, options.type, options.position || "auto");
        } catch (e2) {
          Logger.error("Preview fetch failed:", e2);
        }
      }, HOVER_DELAY);
    });
    trigger.addEventListener("mouseleave", () => {
      Logger.debug("Preview mouseleave: trigger=", trigger.tagName, trigger.className);
      if (state.hoverTimeout) {
        clearTimeout(state.hoverTimeout);
        state.hoverTimeout = null;
      }
    });
  }
  function manualPreview(trigger, fetchContent, options) {
    if (!isIntentionalHover()) return;
    if (state.hoverTimeout) {
      clearTimeout(state.hoverTimeout);
    }
    state.hoverTimeout = window.setTimeout(async () => {
      state.hoverTimeout = null;
      Logger.debug("Manual Preview triggered");
      state.triggerRect = trigger.getBoundingClientRect();
      state.currentTrigger = trigger;
      if (options.href) {
        trigger.dataset.href = options.href;
      }
      try {
        const content = await fetchContent();
        if (state.currentTrigger !== trigger) {
          Logger.debug("Manual Preview aborted: trigger changed during fetch");
          return;
        }
        Logger.debug("Manual Preview content fetched", content.length);
        showPreview(content, options.type, options.position || "auto");
      } catch (e) {
        Logger.error("Preview fetch failed:", e);
      }
    }, HOVER_DELAY);
  }
  function showPreview(content, type, position) {
    Logger.debug("showPreview: start");
    const savedTriggerRect = state.triggerRect;
    const savedCurrentTrigger = state.currentTrigger;
    dismissPreview();
    state.triggerRect = savedTriggerRect;
    state.currentTrigger = savedCurrentTrigger;
    const preview = document.createElement("div");
    preview.className = `pr-preview-overlay ${type}-preview`;
    preview.innerHTML = content;
    document.body.appendChild(preview);
    state.activePreview = preview;
    positionPreview(preview, position);
    adaptPreviewWidth(preview, position);
    Logger.debug("showPreview: end, activePreview visible=", !!document.querySelector(".pr-preview-overlay"));
  }
  function adaptPreviewWidth(preview, position) {
    const maxWidth = window.innerWidth * 0.9;
    let currentWidth = preview.offsetWidth;
    for (let i = 0; i < 10; i++) {
      if (preview.scrollHeight <= preview.clientHeight + 2) {
        break;
      }
      currentWidth = Math.min(currentWidth + 150, maxWidth);
      preview.style.width = `${currentWidth}px`;
      preview.style.maxWidth = `${currentWidth}px`;
      positionPreview(preview, position);
      if (currentWidth >= maxWidth) {
        break;
      }
    }
  }
  function positionPreview(preview, position) {
    if (!state.triggerRect) return;
    const previewRect = preview.getBoundingClientRect();
    const h = previewRect.height;
    const w = previewRect.width;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const tr = state.triggerRect;
    let finalTop;
    let finalLeft;
    finalLeft = tr.left + tr.width / 2 - w / 2;
    finalLeft = Math.max(10, Math.min(finalLeft, vw - w - 10));
    let side = position;
    if (side === "auto") {
      const spaceAbove = tr.top;
      const spaceBelow = vh - tr.bottom;
      side = spaceAbove > spaceBelow ? "above" : "below";
    }
    if (side === "above") {
      finalTop = tr.top - h - 10;
      if (finalTop < 10) {
        finalTop = 10;
        if (finalTop + h > tr.top - 5) {
          const belowTop = tr.bottom + 10;
          if (belowTop + h < vh - 10) {
            finalTop = belowTop;
            side = "below";
          } else {
            if (vh - tr.bottom > tr.top) {
              finalTop = Math.max(10, vh - h - 10);
              side = "below";
            } else {
              finalTop = 10;
              side = "above";
            }
          }
        }
      }
    } else {
      finalTop = tr.bottom + 10;
      if (finalTop + h > vh - 10) {
        finalTop = Math.max(10, vh - h - 10);
        if (finalTop < tr.bottom + 5) {
          const aboveTop = tr.top - h - 10;
          if (aboveTop > 10) {
            finalTop = aboveTop;
            side = "above";
          } else {
            if (tr.top > vh - tr.bottom) {
              finalTop = 10;
              side = "above";
            }
          }
        }
      }
    }
    const verticalOverlap = finalTop < tr.bottom + 5 && finalTop + h > tr.top - 5;
    const horizontalOverlap = finalLeft < tr.right + 5 && finalLeft + w > tr.left - 5;
    const wasClamped = finalLeft <= 15 || finalLeft >= vw - w - 15;
    if (verticalOverlap && horizontalOverlap || wasClamped && horizontalOverlap) {
      if (tr.left > vw / 2) {
        finalLeft = tr.left - w - 20;
      } else {
        finalLeft = tr.right + 20;
      }
      finalLeft = Math.max(10, Math.min(finalLeft, vw - w - 10));
      if (finalLeft + w < tr.left || finalLeft > tr.right) {
        finalTop = tr.top + tr.height / 2 - h / 2;
        finalTop = Math.max(10, Math.min(finalTop, vh - h - 10));
      }
    }
    Logger.debug(`positionPreview: finalTop=${finalTop}, finalLeft=${finalLeft}, vw=${vw}, vh=${vh}`);
    preview.style.left = `${finalLeft}px`;
    preview.style.top = `${finalTop}px`;
  }
  function createPostPreviewFetcher(postId) {
    return async () => {
      const response = await queryGraphQL(GET_POST, { id: postId });
      const post = response.post?.result;
      if (!post) {
        return '<div class="pr-preview-loading">Post not found</div>';
      }
      return `
      <div class="pr-preview-header">
        <strong>${escapeHtml$1(post.title || "")}</strong>
        <span style="color: #666; margin-left: 10px;">
          by ${escapeHtml$1(post.user?.username || "Unknown")} · ${post.baseScore} points
        </span>
      </div>
      <div class="pr-preview-content">
        ${sanitizeHtml(post.htmlBody || "<i>(No content)</i>")}
      </div>
    `;
    };
  }
  function createCommentPreviewFetcher(commentId, localComments) {
    return async () => {
      const local = localComments.find((c) => c._id === commentId);
      if (local) {
        return formatCommentPreview(local);
      }
      const response = await queryGraphQL(GET_COMMENT, { id: commentId });
      const comment = response.comment?.result;
      if (!comment) {
        return '<div class="pr-preview-loading">Comment not found</div>';
      }
      return formatCommentPreview(comment);
    };
  }
  function formatCommentPreview(comment) {
    const date = new Date(comment.postedAt);
    const timeStr = date.toLocaleString().replace(/ ?GMT.*/, "");
    return `
    <div class="pr-preview-header">
      <strong>${escapeHtml$1(comment.user?.username || "Unknown")}</strong>
      <span style="color: #666; margin-left: 10px;">
        ${comment.baseScore} points · ${timeStr}
      </span>
    </div>
    <div class="pr-preview-content">
      ${sanitizeHtml(comment.htmlBody || "")}
    </div>
  `;
  }
  function isElementFullyVisible(el) {
    if (el.closest(".pr-sticky-header")) return false;
    if (el.classList.contains("pr-missing-parent") || el.dataset.placeholder === "1") return false;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const inViewport = rect.top >= 0 && rect.left >= 0 && rect.bottom <= vh && rect.right <= vw;
    if (!inViewport) return false;
    const points = [
      { x: rect.left + 2, y: rect.top + 2 },
      { x: rect.right - 2, y: rect.top + 2 },
      { x: rect.left + 2, y: rect.bottom - 2 },
      { x: rect.right - 2, y: rect.bottom - 2 }
    ];
    for (const p of points) {
      const found = document.elementFromPoint(p.x, p.y);
      if (!found || !(el === found || el.contains(found) || found.closest(".pr-preview-overlay"))) {
        Logger.debug(`isElementFullyVisible: obscured at (${p.x}, ${p.y}) by`, found);
        return false;
      }
    }
    return true;
  }
  function escapeHtml$1(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
  function openInNewTab(url) {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (opened) opened.opener = null;
  }
  function parseUrl(raw) {
    try {
      return new URL(raw, window.location.origin);
    } catch {
      return null;
    }
  }
  function isAllowedForumHostname(hostname) {
    const host = hostname.toLowerCase();
    return host === "lesswrong.com" || host.endsWith(".lesswrong.com") || host === "forum.effectivealtruism.org" || host.endsWith(".forum.effectivealtruism.org") || host === "greaterwrong.com" || host.endsWith(".greaterwrong.com");
  }
  function parseForumUrl(raw) {
    const u = parseUrl(raw);
    if (!u) return null;
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!isAllowedForumHostname(u.hostname)) return null;
    return u;
  }
  function extractCommentIdFromUrl(url) {
    const parsed = parseUrl(url);
    if (!parsed) return null;
    const queryId = parsed.searchParams.get("commentId");
    if (queryId && /^[a-zA-Z0-9_-]+$/.test(queryId)) return queryId;
    const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
    if (hash && /^[a-zA-Z0-9_-]+$/.test(hash)) return hash;
    return null;
  }
  function isCommentUrl(url) {
    const parsed = parseForumUrl(url);
    if (!parsed) return false;
    const hasCommentParam = parsed.searchParams.has("commentId");
    const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
    const hasCommentHash = /^[a-zA-Z0-9_-]{10,}$/.test(hash);
    return hasCommentParam || hasCommentHash;
  }
  function isPostUrl(url) {
    const parsed = parseForumUrl(url);
    if (!parsed) return false;
    const hasPostPath = /\/posts\/[a-zA-Z0-9_-]+(?:\/|$)/.test(parsed.pathname);
    if (!hasPostPath) return false;
    return !isCommentUrl(url);
  }
  function isWikiUrl(url) {
    const parsed = parseForumUrl(url);
    if (!parsed) return false;
    const hasWikiPath = /\/(tag|wiki)\/[a-zA-Z0-9-]+(?:\/|$)/.test(parsed.pathname);
    if (!hasWikiPath) return false;
    return true;
  }
  function isAuthorUrl(url) {
    const parsed = parseForumUrl(url);
    if (!parsed) return false;
    const hasUserPath = /\/users\/[a-zA-Z0-9_-]+(?:\/|$)/.test(parsed.pathname);
    if (!hasUserPath) return false;
    return true;
  }
  function extractPostIdFromUrl(url) {
    const parsed = parseUrl(url);
    if (!parsed) return null;
    const match = parsed.pathname.match(/\/posts\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }
  function extractAuthorSlugFromUrl(url) {
    const parsed = parseUrl(url);
    if (!parsed) return null;
    const match = parsed.pathname.match(/\/users\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }
  function extractWikiSlugFromUrl(url) {
    const parsed = parseUrl(url);
    if (!parsed) return null;
    const match = parsed.pathname.match(/\/(tag|wiki)\/([a-zA-Z0-9-]+)/);
    return match ? match[2] : null;
  }
  function createWikiPreviewFetcher(slug) {
    return async () => {
      const forumOrigin = parseForumUrl(window.location.href)?.origin || "https://www.lesswrong.com";
      const url = new URL(`/tag/${slug}`, forumOrigin).toString();
      try {
        const response = await fetch(url);
        const html2 = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html2, "text/html");
        const contentEl = doc.querySelector(".TagPage-description, .ContentStyles-base, .tagDescription");
        const titleEl = doc.querySelector("h1, .TagPage-title");
        const title = titleEl?.textContent || slug;
        const content = sanitizeHtml(contentEl?.innerHTML || "<i>(Unable to load wiki content)</i>");
        return `
        <div class="pr-preview-header">
          <strong>Wiki: ${escapeHtml$1(title)}</strong>
        </div>
        <div class="pr-preview-content">
          ${content}
        </div>
      `;
      } catch (e) {
        Logger.error("Wiki fetch failed:", e);
        return `<i>Failed to load wiki page for: ${escapeHtml$1(slug)}</i>`;
      }
    };
  }
  function createAuthorPreviewFetcher(userId) {
    return async () => {
      const response = await queryGraphQL(GET_USER, { id: userId });
      const user = response.user?.result;
      if (!user) {
        return '<div class="pr-preview-loading">User not found</div>';
      }
      return renderUserPreview(user);
    };
  }
  function createAuthorBySlugPreviewFetcher(slug) {
    return async () => {
      const response = await queryGraphQL(GET_USER_BY_SLUG, { slug });
      const user = response.user;
      if (!user) {
        return '<div class="pr-preview-loading">User not found</div>';
      }
      return renderUserPreview(user);
    };
  }
  function renderUserPreview(user) {
    const archiveTarget = user.slug || user.username || "";
    const archiveLink = `/reader?view=archive&username=${encodeURIComponent(archiveTarget)}`;
    const safeBio = sanitizeHtml(user.htmlBio || "<i>(No bio provided)</i>");
    return `
    <div class="pr-preview-header">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
        <div style="flex: 1;">
            <strong>${escapeHtml$1(user.displayName || user.username || "Unknown")}</strong>
            <div style="color: #666; font-size: 0.9em;">
                ${Math.round(user.karma)} karma · @${escapeHtml$1(user.username || "")}
            </div>
        </div>
        <a href="${archiveLink}" 
           class="pr-archive-link"
           style="background: var(--pr-bg-secondary); border: 1px solid var(--pr-border-color); border-radius: 4px; padding: 4px 8px; font-size: 0.8em; color: var(--pr-text-primary); text-decoration: none; white-space: nowrap;">
            📂 Archive
        </a>
      </div>
    </div>
    <div class="pr-preview-content">
      ${safeBio}
    </div>
  `;
  }
  const DEFAULT_FILTER = {
    opacity: 1,
    saturate: 1,
    scale: 1,
    translateX: 0,
    translateY: 0
  };
  const BOOTSTRAP_REACTIONS = [
{ name: "agree", label: "Agreed", svg: "https://www.lesswrong.com/reactionImages/nounproject/check.svg" },
    { name: "disagree", label: "Disagree", svg: "https://www.lesswrong.com/reactionImages/nounproject/x.svg" },
    { name: "important", label: "Important", svg: "https://www.lesswrong.com/reactionImages/nounproject/exclamation.svg" },
    { name: "dontUnderstand", label: "I don't understand", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-question-5771604.svg" },
    { name: "plus", label: "Plus One", svg: "https://www.lesswrong.com/reactionImages/nounproject/Plus.png" },
    { name: "shrug", label: "Shrug", svg: "https://www.lesswrong.com/reactionImages/nounproject/shrug.svg" },
    { name: "thumbs-up", label: "Thumbs Up", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-thumbs-up-1686284.svg" },
    { name: "thumbs-down", label: "Thumbs Down", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-thumbs-down-1686285.svg" },
    { name: "seen", label: "Seen", svg: "https://www.lesswrong.com/reactionImages/nounproject/eyes.svg" },
    { name: "smile", label: "Smile", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-smile-925549.svg" },
    { name: "laugh", label: "Haha!", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-laughing-761845.svg" },
    { name: "sad", label: "Sad", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-sad-1152961.svg" },
    { name: "disappointed", label: "Disappointed", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-sad-5760577.svg" },
    { name: "confused", label: "Confused", svg: "https://www.lesswrong.com/reactionImages/confused2.svg" },
    { name: "thinking", label: "Thinking", svg: "https://www.lesswrong.com/reactionImages/nounproject/thinking-nice-eyebrows.svg" },
    { name: "oops", label: "Oops!", svg: "https://www.lesswrong.com/reactionImages/nounproject/Oops!.png" },
    { name: "surprise", label: "Surprise", svg: "https://www.lesswrong.com/reactionImages/nounproject/surprise.svg" },
    { name: "excitement", label: "Exciting", svg: "https://www.lesswrong.com/reactionImages/nounproject/partypopper.svg" },
{ name: "changemind", label: "Changed My Mind", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-triangle-305128.svg" },
    { name: "strong-argument", label: "Strong Argument", svg: "https://www.lesswrong.com/reactionImages/nounproject/strong-argument2.svg" },
    { name: "crux", label: "Crux", svg: "https://www.lesswrong.com/reactionImages/nounproject/branchingpath.svg" },
    { name: "hitsTheMark", label: "Hits the Mark", svg: "https://www.lesswrong.com/reactionImages/nounproject/bullseye.svg" },
    { name: "clear", label: "Clearly Written", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-clear-sky-1958882.svg" },
    { name: "concrete", label: "Concrete", svg: "https://www.lesswrong.com/reactionImages/nounproject/concrete.svg" },
    { name: "scout", label: "Scout Mindset", svg: "https://www.lesswrong.com/reactionImages/nounproject/binoculars.svg" },
    { name: "moloch", label: "Moloch", svg: "https://www.lesswrong.com/reactionImages/nounproject/moloch-bw-2.svg" },
    { name: "soldier", label: "Soldier Mindset", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-brackets-1942334-updated.svg" },
    { name: "soldier-alt", label: "Soldier Mindset", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-soldier-5069240.svg" },
    { name: "changed-mind-on-point", label: "Changed Mind on Point", svg: "https://www.lesswrong.com/reactionImages/nounproject/changedmindonpoint.svg" },
    { name: "weak-argument", label: "Weak Argument", svg: "https://www.lesswrong.com/reactionImages/nounproject/weak-argument2.svg" },
    { name: "notacrux", label: "Not a Crux", svg: "https://www.lesswrong.com/reactionImages/nounproject/nonbranchingpath2.svg" },
    { name: "miss", label: "Missed the Point", svg: "https://www.lesswrong.com/reactionImages/nounproject/inaccurate.svg" },
    { name: "muddled", label: "Difficult to Parse", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-fog-1028590.svg" },
    { name: "examples", label: "Examples?", svg: "https://www.lesswrong.com/reactionImages/nounproject/shapes.svg" },
    { name: "paperclip", label: "Paperclip", svg: "https://www.lesswrong.com/reactionImages/nounproject/paperclip.svg" },
    { name: "resolved", label: "Question Answered", svg: "https://www.lesswrong.com/reactionImages/nounproject/resolved.svg" },
{ name: "heart", label: "Heart", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-heart-1212629.svg" },
    { name: "coveredAlready2", label: "Already Addressed", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-mail-checkmark-5316519.svg" },
    { name: "beautiful", label: "Beautiful!", svg: "https://res.cloudinary.com/lesswrong-2-0/image/upload/v1758861219/Beautiful_ynilb1.svg" },
    { name: "insightful", label: "Insightful", svg: "https://www.lesswrong.com/reactionImages/nounproject/lightbulb.svg" },
    { name: "strawman", label: "Misunderstands?", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-misunderstanding-4936548-updated.svg" },
    { name: "addc", label: "ADDC", svg: "https://www.lesswrong.com/reactionImages/nounproject/ADDC.svg" },
    { name: "llm-smell", label: "Smells like LLM", svg: "https://www.lesswrong.com/reactionImages/nounproject/llm-smell.svg" },
    { name: "scholarship", label: "Nice Scholarship!", svg: "https://www.lesswrong.com/reactionImages/nounproject/scholarship.svg" },
    { name: "unnecessarily-combative", label: "Too Combative?", svg: "https://www.lesswrong.com/reactionImages/nounproject/swords.svg" },
    { name: "thanks", label: "Thanks", svg: "https://www.lesswrong.com/reactionImages/nounproject/thankyou.svg" },
    { name: "hat", label: "Bowing Out", svg: "https://www.lesswrong.com/reactionImages/nounproject/HatInMotion.png" },
    { name: "nitpick", label: "Nitpick", svg: "https://www.lesswrong.com/reactionImages/nounproject/nitpick.svg" },
    { name: "offtopic", label: "Offtopic?", svg: "https://www.lesswrong.com/reactionImages/nounproject/mapandpin.svg" },
    { name: "facilitation", label: "Good Facilitation", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-dialog-2172.svg" },
    { name: "bowels", label: "Bowels", svg: "https://www.lesswrong.com/reactionImages/nounproject/bowels.svg" },
    { name: "typo", label: "Typo", svg: "https://www.lesswrong.com/reactionImages/nounproject/type-text.svg" },
    { name: "bet", label: "Let's Bet!", svg: "https://www.lesswrong.com/reactionImages/nounproject/bet.svg" },
    { name: "sneer", label: "Sneer", svg: "https://www.lesswrong.com/reactionImages/nounproject/NoSneeringThick.png" },
{ name: "1percent", label: "1%", svg: "https://www.lesswrong.com/reactionImages/1percent.svg" },
    { name: "10percent", label: "10%", svg: "https://www.lesswrong.com/reactionImages/10percent.svg" },
    { name: "25percent", label: "25%", svg: "https://www.lesswrong.com/reactionImages/25percent.svg" },
    { name: "40percent", label: "40%", svg: "https://www.lesswrong.com/reactionImages/40percent.svg" },
    { name: "50percent", label: "50%", svg: "https://www.lesswrong.com/reactionImages/50percent.svg" },
    { name: "60percent", label: "60%", svg: "https://www.lesswrong.com/reactionImages/60percent.svg" },
    { name: "75percent", label: "75%", svg: "https://www.lesswrong.com/reactionImages/75percent.svg" },
    { name: "90percent", label: "90%", svg: "https://www.lesswrong.com/reactionImages/90percent.svg" },
    { name: "99percent", label: "99%", svg: "https://www.lesswrong.com/reactionImages/99percent.svg" }
  ];
  const EA_FORUM_BOOTSTRAP_REACTIONS = [
    { name: "agree", label: "Agree", svg: "https://www.lesswrong.com/reactionImages/nounproject/check.svg" },
    { name: "disagree", label: "Disagree", svg: "https://www.lesswrong.com/reactionImages/nounproject/x.svg" },
    { name: "love", label: "Heart", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-heart-1212629.svg" },
    { name: "helpful", label: "Helpful", svg: "https://www.lesswrong.com/reactionImages/nounproject/handshake.svg" },
    { name: "insightful", label: "Insightful", svg: "https://www.lesswrong.com/reactionImages/nounproject/lightbulb.svg" },
    { name: "changed-mind", label: "Changed my mind", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-triangle-305128.svg" },
    { name: "laugh", label: "Made me laugh", svg: "https://www.lesswrong.com/reactionImages/nounproject/noun-laughing-761845.svg" }
  ];
  const SECTION_DEFINITIONS = {
gridPrimary: ["agree", "disagree", "important", "dontUnderstand", "plus", "shrug", "thumbs-up", "thumbs-down", "seen", "smile", "laugh", "sad", "disappointed", "confused", "thinking", "oops", "surprise", "excitement"],
    gridSectionB: [
      "changemind",
      "strong-argument",
      "crux",
      "hitsTheMark",
      "clear",
      "concrete",
      "scout",
      "moloch",
      "soldier",
      "changed-mind-on-point",
      "weak-argument",
      "notacrux",
      "miss",
      "muddled",
      "examples",
      "soldier-alt",
      "paperclip",
      "resolved"
    ],
    gridSectionC: [
      "heart",
      "coveredAlready2",
      "beautiful",
      "insightful",
      "strawman",
      "addc",
      "llm-smell",
      "scholarship",
      "unnecessarily-combative",
      "thanks",
      "hat",
      "nitpick",
      "offtopic",
      "facilitation",
      "bowels",
      "typo",
      "bet",
      "sneer"
    ],
    likelihoods: ["1percent", "10percent", "25percent", "40percent", "50percent", "60percent", "75percent", "90percent", "99percent"]
  };
  SECTION_DEFINITIONS.listPrimary = SECTION_DEFINITIONS.gridPrimary;
  SECTION_DEFINITIONS.listViewSectionB = SECTION_DEFINITIONS.gridSectionB;
  SECTION_DEFINITIONS.listViewSectionC = SECTION_DEFINITIONS.gridSectionC;
  const CACHE_KEY = "power-reader-scraped-reactions";
  const CACHE_TIME = 7 * 24 * 60 * 60 * 1e3;
  let reactionsCache = [];
  function getReactions() {
    const isEA = window.location.hostname.includes("effectivealtruism.org");
    let finalReactions = [...isEA ? EA_FORUM_BOOTSTRAP_REACTIONS : BOOTSTRAP_REACTIONS];
    const getCachedData = () => {
      try {
        const cached2 = JSON.parse(GM_getValue(getKey(CACHE_KEY), "null"));
        if (cached2 && cached2.timestamp && Date.now() - cached2.timestamp < CACHE_TIME) {
          return cached2;
        }
      } catch (e) {
        Logger.error("Error loading reactions from cache:", e);
      }
      return null;
    };
    const cached = getCachedData();
    const scraped = cached ? cached.reactions : reactionsCache.length > 0 ? reactionsCache : [];
    if (scraped.length > 0) {
      const map = new Map();
      finalReactions.forEach((r) => map.set(r.name, r));
      scraped.forEach((r) => map.set(r.name, r));
      finalReactions = Array.from(map.values());
    }
    return finalReactions;
  }
  const REACTION_REGEX = /{name:"([^"]+)",label:"([^"]+)",(?:searchTerms:\[(.*?)\],)?svg:"([^"]+)"(?:,description:(?:(["'])((?:(?=(\\?))\7.)*?)\5|(?:\([^)]+\)|[\w$]+)=>`[^`]*?(\w+[^`]+)`))?(?:,filter:({[^}]+}))?(?:,deprecated:(!0|!1|true|false))?/g;
  function parseReactionsFromCode(content) {
    const matches = [];
    let match;
    REACTION_REGEX.lastIndex = 0;
    while ((match = REACTION_REGEX.exec(content)) !== null) {
      const [_full, name, label, searchTermsRaw, svg2, _quoteChar, descContent, _bs, fnDescContent, filterRaw, deprecatedRaw] = match;
      const reaction = { name, label, svg: svg2 };
      if (searchTermsRaw) {
        reaction.searchTerms = searchTermsRaw.replace(/"/g, "").split(",").map((s) => s.trim());
      }
      if (descContent) {
        reaction.description = descContent;
      } else if (fnDescContent) {
        reaction.description = `This post/comment ${fnDescContent.trim()}`;
      }
      if (filterRaw) {
        try {
          let jsonFilter = filterRaw.replace(/(\w+):/g, '"$1":');
          jsonFilter = jsonFilter.replace(/:(\.\d+)/g, ":0$1");
          reaction.filter = JSON.parse(jsonFilter);
        } catch (e) {
        }
      }
      if (deprecatedRaw) {
        reaction.deprecated = deprecatedRaw === "!0" || deprecatedRaw === "true";
      }
      matches.push(reaction);
    }
    return matches;
  }
  function parseSectionsFromCode(content) {
    const sections = {};
    const sectionRegex = /(gridPrimary|gridEmotions|gridSectionB|gridSectionC|gridSectionD|listPrimary|listEmotions|listViewSectionB|listViewSectionC|listViewSectionD|likelihoods)[:=](\[[^\]]+\])/g;
    let match;
    while ((match = sectionRegex.exec(content)) !== null) {
      const [_, name, arrayRaw] = match;
      try {
        const array = JSON.parse(arrayRaw.replace(/'/g, '"').replace(/,\]/, "]"));
        sections[name] = array;
      } catch (e) {
      }
    }
    return sections;
  }
  async function initializeReactions() {
    try {
      const cached = JSON.parse(GM_getValue(getKey(CACHE_KEY), "null"));
      if (cached && cached.timestamp && Date.now() - cached.timestamp < CACHE_TIME) {
        Logger.info("Using cached reactions");
        reactionsCache = cached.reactions;
        if (cached.sectionDefinitions) {
          Object.assign(SECTION_DEFINITIONS, cached.sectionDefinitions);
        }
        return;
      }
    } catch (e) {
    }
    Logger.info("Reactions cache missing or expired. Starting scrape...");
    let scripts = Array.from(document.querySelectorAll("script[src]")).map((s) => s.src).filter((src) => src.includes("client") || src.includes("/_next/static/chunks/"));
    if (scripts.length === 0) {
      const origin = window.location.origin;
      scripts = Array.from(document.querySelectorAll("script[src]")).map((s) => s.src).filter((src) => src.startsWith(origin));
    }
    if (scripts.length === 0) {
      Logger.warn("No candidate scripts found for scraping. Using bootstrap fallback.");
      const isEA = window.location.hostname.includes("effectivealtruism.org");
      reactionsCache = isEA ? EA_FORUM_BOOTSTRAP_REACTIONS : BOOTSTRAP_REACTIONS;
      return;
    }
    let anySuccess = false;
    for (const src of scripts) {
      try {
        await new Promise((resolve) => {
          GM_xmlhttpRequest({
            method: "GET",
            url: src,
            onload: (response) => {
              const content = response.responseText;
              const matches = parseReactionsFromCode(content);
              const scrapedSections = parseSectionsFromCode(content);
              if (matches.length > 20) {
                Logger.info(`Successfully scraped ${matches.length} reactions from ${src}`);
                const unique = Array.from(new Map(matches.map((item) => [item.name, item])).values());
                if (unique.find((r) => r.name === "agree") && unique.find((r) => r.name === "insightful")) {
                  if (Object.keys(scrapedSections).length > 2) {
                    Logger.debug("Found sections in bundle", Object.keys(scrapedSections));
                    Object.assign(SECTION_DEFINITIONS, scrapedSections);
                  }
                  reactionsCache = unique;
                  GM_setValue(getKey(CACHE_KEY), JSON.stringify({
                    timestamp: Date.now(),
                    reactions: unique,
                    sectionDefinitions: SECTION_DEFINITIONS
}));
                  anySuccess = true;
                  resolve();
                  return;
                }
              }
              resolve();
            },
            onerror: () => resolve()
          });
        });
        if (anySuccess) break;
      } catch (e) {
        Logger.error("Error scraping script:", e);
      }
    }
    if (!anySuccess) {
      Logger.warn("FAILED to scrape reactions from any script bundle. Using bootstrap fallback.");
      const isEA = window.location.hostname.includes("effectivealtruism.org");
      reactionsCache = isEA ? EA_FORUM_BOOTSTRAP_REACTIONS : BOOTSTRAP_REACTIONS;
    }
  }
  function renderVoteButtons(itemId, karmaScore, currentKarmaVote, currentAgreement, agreementScore = 0, voteCount = 0, agreementVoteCount = 0, showAgreement = true, showButtons = true) {
    const isUpvoted = currentKarmaVote === "smallUpvote" || currentKarmaVote === "bigUpvote" || currentKarmaVote === 1;
    const isDownvoted = currentKarmaVote === "smallDownvote" || currentKarmaVote === "bigDownvote" || currentKarmaVote === -1;
    const agreeVote = currentAgreement?.agreement;
    const isAgreed = agreeVote === "smallUpvote" || agreeVote === "bigUpvote" || agreeVote === "agree";
    const isDisagreed = agreeVote === "smallDownvote" || agreeVote === "bigDownvote" || agreeVote === "disagree";
    const agreementHtml = showAgreement ? `
    <span class="pr-vote-controls">
      ${showButtons ? `
      <span class="pr-vote-btn ${isDisagreed ? "disagree-active" : ""} ${agreeVote === "bigDownvote" ? "strong-vote" : ""}" 
            data-action="disagree" 
            data-id="${itemId}"
            title="Disagree">✗</span>
      ` : ""}
      <span class="pr-agreement-score" title="Agreement votes: ${agreementVoteCount}">${agreementScore}</span>
      ${showButtons ? `
      <span class="pr-vote-btn ${isAgreed ? "agree-active" : ""} ${agreeVote === "bigUpvote" ? "strong-vote" : ""}" 
            data-action="agree" 
            data-id="${itemId}"
            title="Agree">✓</span>
      ` : ""}
    </span>` : "";
    return `
    <span class="pr-vote-controls">
      ${showButtons ? `
      <span class="pr-vote-btn ${isDownvoted ? "active-down" : ""} ${currentKarmaVote === "bigDownvote" ? "strong-vote" : ""}" 
            data-action="karma-down" 
            data-id="${itemId}"
            title="Downvote">▼</span>
      ` : ""}
      <span class="pr-karma-score" title="Total votes: ${voteCount}">${karmaScore}</span>
      ${showButtons ? `
      <span class="pr-vote-btn ${isUpvoted ? "active-up" : ""} ${currentKarmaVote === "bigUpvote" ? "strong-vote" : ""}" 
            data-action="karma-up" 
            data-id="${itemId}"
            title="Upvote">▲</span>
      ` : ""}
    </span>
    ${agreementHtml}
    <span class="pr-reactions-container" data-id="${itemId}">
      <!-- Reactions will be injected here during main render or update -->
    </span>
  `;
  }
  const renderReactions = (itemId, extendedScore, currentUserExtendedVote) => {
    let html2 = '<span class="pr-reactions-inner">';
    const reacts = extendedScore?.reacts || {};
    const userReacts = currentUserExtendedVote?.reacts || [];
    const allReactions = getReactions();
    const reactionCounts = {};
    Object.entries(reacts).forEach(([reactName, users]) => {
      let score = 0;
      users.forEach((u) => {
        if (u.reactType === "disagreed") score -= 1;
        else score += 1;
      });
      if (score > 0) {
        reactionCounts[reactName] = score;
      }
    });
    allReactions.forEach((reaction) => {
      const count = reactionCounts[reaction.name] || 0;
      const userVoted = userReacts.some((r) => r.react === reaction.name);
      if (count > 0 || userVoted) {
        const filter = reaction.filter || DEFAULT_FILTER;
        const opacity = filter.opacity ?? 1;
        const saturate = filter.saturate ?? 1;
        const scale = filter.scale ?? 1;
        const tx = filter.translateX ?? 0;
        const ty = filter.translateY ?? 0;
        const padding = filter.padding ?? 0;
        const imgStyle = `
        filter: opacity(${opacity}) saturate(${saturate});
        transform: scale(${scale}) translate(${tx}px, ${ty}px);
        padding: ${padding}px;
      `;
        const title = `${reaction.label}${reaction.description ? "\\n" + reaction.description : ""}`;
        html2 += `
        <span class="pr-reaction-chip ${userVoted ? "voted" : ""}" 
              data-action="reaction-vote" 
              data-id="${itemId}" 
              data-reaction-name="${reaction.name}"
              title="${escapeHtml(title)}">
          <span class="pr-reaction-icon" style="overflow:visible">
             <img src="${reaction.svg}" alt="${reaction.name}" style="${imgStyle}">
          </span>
          <span class="pr-reaction-count">${count > 0 ? count : ""}</span>
        </span>
      `;
      }
    });
    html2 += `
    <span class="pr-add-reaction-btn" data-action="open-picker" data-id="${itemId}" title="Add reaction">
      <svg height="16" viewBox="0 0 16 16" width="16"><g fill="currentColor"><path d="m13 7c0-3.31371-2.6863-6-6-6-3.31371 0-6 2.68629-6 6 0 3.3137 2.68629 6 6 6 .08516 0 .1699-.0018.25419-.0053-.11154-.3168-.18862-.6499-.22673-.9948l-.02746.0001c-2.76142 0-5-2.23858-5-5s2.23858-5 5-5 5 2.23858 5 5l-.0001.02746c.3449.03811.678.11519.9948.22673.0035-.08429.0053-.16903.0053-.25419z"></path><path d="m7.11191 10.4982c.08367-.368.21246-.71893.38025-1.04657-.15911.03174-.32368.04837-.49216.04837-.74037 0-1.40506-.3212-1.86354-.83346-.18417-.20576-.50026-.22327-.70603-.03911-.20576.18417-.22327.50026-.03911.70603.64016.71524 1.57205 1.16654 2.60868 1.16654.03744 0 .07475-.0006.11191-.0018z"></path><path d="m6 6c0 .41421-.33579.75-.75.75s-.75-.33579-.75-.75.33579-.75.75-.75.75.33579.75.75z"></path><path d="m8.75 6.75c.41421 0 .75-.33579.75-.75s-.33579-.75-.75-.75-.75.33579-.75.75.33579.75.75.75z"></path><path d="m15 11.5c0 1.933-1.567 3.5-3.5 3.5s-3.5-1.567-3.5-3.5 1.567-3.5 3.5-3.5 3.5 1.567 3.5 3.5zm-3-2c0-.27614-.2239-.5-.5-.5s-.5.22386-.5.5v1.5h-1.5c-.27614 0-.5.2239-.5.5s.22386.5.5.5h1.5v1.5c0 .2761.2239.5.5.5s.5-.2239.5-.5v-1.5h1.5c.2761 0 .5-.2239.5-.5s-.2239-.5-.5-.5h-1.5z"></path></g></svg>
    </span>
  `;
    html2 += "</span>";
    return html2;
  };
  const renderMetadata = (item, options = {}) => {
    const { state: state2, isFullPost = true, style = "", extraClass = "", children = "" } = options;
    const isPost2 = "title" in item;
    const authorHandle = item.user?.username || item.author || "Unknown Author";
    const authorName = item.user?.displayName || authorHandle;
    const authorId = item.user?._id || "";
    const voteButtonsHtml = renderVoteButtons(
      item._id,
      item.baseScore || 0,
      item.currentUserVote ?? null,
      item.currentUserExtendedVote ?? null,
      item.afExtendedScore?.agreement ?? 0,
      isPost2 ? item.voteCount || 0 : 0,
      0,
isPost2 ? window.location.hostname.includes("effectivealtruism.org") || window.location.hostname === "localhost" : true,
isFullPost
);
    const reactionsHtml = renderReactions(
      item._id,
      item.extendedScore,
      item.currentUserExtendedVote
    );
    const authorPrefs = getAuthorPreferences();
    let authorPref = authorPrefs[authorHandle];
    if (authorPref === void 0 && authorId && state2?.subscribedAuthorIds.has(authorId)) {
      authorPref = 1;
    }
    authorPref = authorPref || 0;
    const postedAt = item.postedAt || ( new Date()).toISOString();
    const date = new Date(postedAt);
    const timeStr = date.toLocaleString().replace(/ ?GMT.*/, "");
    const authorSlug = item.user?.slug;
    const authorLink = authorSlug ? `/users/${authorSlug}` : "#";
    let containerClass = isPost2 ? "pr-comment-meta pr-post-meta" : "pr-comment-meta";
    if (extraClass) containerClass += ` ${extraClass}`;
    return `
    <div class="${containerClass}" style="${style}">
      ${voteButtonsHtml}
      ${reactionsHtml}
      <span class="pr-author-controls">
        <span class="pr-author-down ${authorPref < 0 ? "active-down" : ""}" 
              data-action="author-down" 
              data-author="${escapeHtml(authorHandle)}"
              title="Mark author as disliked (auto-hide their future comments)">↓</span>
      </span>
      <a href="${authorLink}" target="_blank" class="pr-author" data-author-id="${authorId}">${escapeHtml(authorName)}</a>
      <span class="pr-author-controls">
        <span class="pr-author-up ${authorPref > 0 ? "active-up" : ""}" 
              data-action="author-up" 
              data-author="${escapeHtml(authorHandle)}"
              title="Mark author as preferred (highlight their future comments)">↑</span>
      </span>
      <span class="pr-timestamp">
        <a href="${item.pageUrl || "#"}" target="_blank">${timeStr}</a>
      </span>
      ${children}
    </div>
  `;
  };
  function hexToRgb(hex) {
    hex = hex.replace(/^#/, "");
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const num = parseInt(hex, 16);
    return [num >> 16 & 255, num >> 8 & 255, num & 255];
  }
  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map((x) => {
      const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }).join("");
  }
  function interpolateColors(color1, color2, weight1, weight2) {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    const total = weight1 + weight2;
    if (total === 0) return color1;
    const r = Math.round((weight1 * c1[0] + weight2 * c2[0]) / total);
    const g = Math.round((weight1 * c1[1] + weight2 * c2[1]) / total);
    const b = Math.round((weight1 * c1[2] + weight2 * c2[2]) / total);
    return rgbToHex(r, g, b);
  }
  function getScoreColor(normalized) {
    return interpolateColors("#FFFFFF", "#FFDDDD", 1 - normalized, normalized);
  }
  function getPostScoreColor(normalized) {
    return interpolateColors("#F0F0F0", "#E0D0FF", 1 - normalized, normalized);
  }
  function getRecencyColor(order, maxOrder) {
    if (order <= 0 || order > maxOrder) return "";
    return interpolateColors("#FFFFFE", "#FFFFE0", order, maxOrder - order);
  }
  function getAgeInHours(postedAt) {
    const posted = new Date(postedAt).getTime();
    const now = Date.now();
    return (now - posted) / (1e3 * 60 * 60);
  }
  function getExpectedPoints(ageHours, isPost2 = false) {
    const base = 5 + 2 * Math.sqrt(ageHours);
    return isPost2 ? base * 6.7 : base;
  }
  function getAuthorVotingPower(karma) {
    return karma >= 1e3 ? 2 : 1;
  }
  function calculateNormalizedScore(points, ageHours, authorName, authorKarma = 0, isPost2 = false) {
    const pub = getExpectedPoints(ageHours, isPost2);
    const plb = getAuthorVotingPower(authorKarma);
    const authorPrefs = getAuthorPreferences();
    let normalized = (points - plb) / (pub - plb);
    if (authorPrefs[authorName]) {
      normalized += authorPrefs[authorName] * 0.52;
    }
    return normalized;
  }
  function shouldAutoHide(normalizedScore) {
    return normalizedScore < -0.51;
  }
  function getFontSizePercent(points, isPost2 = false) {
    if (isPost2) {
      const cappedPoints = Math.min(points, 200);
      return Math.round((cappedPoints / 200 + 1) * 100);
    } else {
      const cappedPoints = Math.min(points, 20);
      return Math.round((cappedPoints / 40 + 1) * 100);
    }
  }
  function clampScore(normalized) {
    return Math.max(0, Math.min(1, normalized));
  }
  function calculateTreeKarma(id, baseScore, isRead2, children, readState, childrenByParentId, cutoffDate) {
    let hasUnread = !isRead2;
    const initialScore = Number(baseScore) || 0;
    let maxKarma = isRead2 ? -Infinity : initialScore;
    const queue = [...children];
    let queueIndex = 0;
    const visited = new Set([id]);
    while (queueIndex < queue.length) {
      const current = queue[queueIndex++];
      if (visited.has(current._id)) continue;
      visited.add(current._id);
      let currentIsRead = readState[current._id] === 1;
      if (!currentIsRead && cutoffDate && cutoffDate !== "__LOAD_RECENT__" && current.postedAt < cutoffDate) {
        currentIsRead = true;
      }
      if (!currentIsRead) {
        hasUnread = true;
        const score = Number(current.baseScore) || 0;
        if (score > maxKarma) {
          maxKarma = score;
        }
      }
      const descendants = childrenByParentId.get(current._id);
      if (descendants) {
        for (const d of descendants) {
          queue.push(d);
        }
      }
    }
    if (!hasUnread) {
      return -Infinity;
    }
    return maxKarma;
  }
  const escapeHtml = (unsafe) => {
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  };
  const calculatePostHeaderStyle = (post) => {
    if (!post.htmlBody) return "";
    const authorName = post.user?.username || "Unknown Author";
    const authorKarma = post.user?.karma || 0;
    const postedAt = post.postedAt || ( new Date()).toISOString();
    const ageHours = getAgeInHours(postedAt);
    const score = post.baseScore || 0;
    const normalized = calculateNormalizedScore(score, ageHours, authorName, authorKarma, true);
    const clampedScore = clampScore(normalized);
    const scoreColor = normalized > 0 ? getPostScoreColor(clampedScore) : "";
    const fontSize = getFontSizePercent(score, true);
    let style = "";
    if (scoreColor) style += `background-color: ${scoreColor};`;
    style += ` font-size: ${fontSize}%;`;
    return style;
  };
  const renderPostHeader = (post, options = {}) => {
    const { isSticky = false, isFullPost = false, state: state2 } = options;
    const metadataHtml = renderMetadata(post, { state: state2, isFullPost });
    const headerStyle = calculatePostHeaderStyle(post);
    const escapedTitle = escapeHtml(post.title);
    const classes = [
      "pr-post-header",
      !isFullPost ? "header-clickable" : "",
      isSticky ? "pr-sticky-header-content" : ""
].filter(Boolean).join(" ");
    const commentCount = post.commentCount || 0;
    let loadedCount = 0;
    let isLastPost = false;
    if (state2) {
      loadedCount = state2.comments.filter((c) => c.postId === post._id).length;
      isLastPost = state2.posts.length > 0 && state2.posts[state2.posts.length - 1]._id === post._id;
    }
    const eTooltip = isFullPost ? "Collapse post body" : "Expand/load post body";
    const aDisabled = commentCount === 0 || commentCount > 0 && loadedCount >= commentCount;
    const aTooltip = commentCount === 0 ? "No comments to load" : aDisabled ? `All ${commentCount} comments already loaded` : `Load all ${commentCount} comments for this post`;
    const cDisabled = commentCount === 0;
    const cTooltip = cDisabled ? "No comments to scroll to" : "Scroll to first comment";
    const nDisabled = isLastPost;
    const nTooltip = nDisabled ? "No more posts in current feed" : "Scroll to next post";
    return `
    <div class="${classes}" data-action="scroll-to-post-top" style="${headerStyle}" data-post-id="${post._id}">
      ${metadataHtml}
      <h2><span class="pr-post-title" data-post-id="${post._id}"${!isFullPost ? ' data-action="load-post"' : ""}>${escapedTitle}</span></h2>
      <span class="pr-post-actions">
        <span class="pr-post-action text-btn" data-action="send-to-ai-studio" title="Send thread to AI Studio (Shortkey: g, Shift-G to include descendants)">[g]</span>
        <span class="pr-post-action text-btn ${""}" data-action="toggle-post-body" title="${eTooltip}">[e]</span>
        <span class="pr-post-action text-btn ${aDisabled ? "disabled" : ""}" data-action="load-all-comments" title="${aTooltip}">[a]</span>
        <span class="pr-post-action text-btn ${cDisabled ? "disabled" : ""}" data-action="scroll-to-comments" title="${cTooltip}">[c]</span>
        <span class="pr-post-action text-btn ${nDisabled ? "disabled" : ""}" data-action="scroll-to-next-post" title="${nTooltip}">[n]</span>
      </span>
      <span class="pr-post-toggle text-btn" data-action="collapse" title="${isSticky ? "Collapse current threads" : "Collapse post and comments"}">[−]</span>
      <span class="pr-post-toggle text-btn" data-action="expand" style="display:none" title="${isSticky ? "Expand current threads" : "Expand post and comments"}">[+]</span>
    </div>
  `;
  };
  const highlightQuotes$1 = (html2, extendedScore) => {
    const safeHtml = sanitizeHtml(html2);
    if (!extendedScore || !extendedScore.reacts) return safeHtml;
    const quotesToHighlight = [];
    Object.values(extendedScore.reacts).forEach((users) => {
      users.forEach((u) => {
        if (u.quotes) {
          u.quotes.forEach((q) => {
            if (q.quote && q.quote.trim().length > 0) {
              quotesToHighlight.push(q.quote);
            }
          });
        }
      });
    });
    if (quotesToHighlight.length === 0) return safeHtml;
    const uniqueQuotes = [...new Set(quotesToHighlight)].sort((a, b) => b.length - a.length);
    const parser = new DOMParser();
    const doc = parser.parseFromString(safeHtml, "text/html");
    const replaceTextNode = (node, quote) => {
      const text2 = node.nodeValue || "";
      if (!text2.includes(quote)) return;
      const parts = text2.split(quote);
      if (parts.length <= 1) return;
      const fragment = doc.createDocumentFragment();
      parts.forEach((part, index) => {
        if (part) {
          fragment.appendChild(doc.createTextNode(part));
        }
        if (index < parts.length - 1) {
          const span = doc.createElement("span");
          span.className = "pr-highlight";
          span.title = "Reacted content";
          span.textContent = quote;
          fragment.appendChild(span);
        }
      });
      node.parentNode?.replaceChild(fragment, node);
    };
    uniqueQuotes.forEach((quote) => {
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let node = walker.nextNode();
      while (node) {
        const textNode = node;
        if (!textNode.parentElement?.classList.contains("pr-highlight")) {
          nodes.push(textNode);
        }
        node = walker.nextNode();
      }
      nodes.forEach((textNode) => replaceTextNode(textNode, quote));
    });
    return doc.body.innerHTML;
  };
  const renderBody = (html2, extendedScore) => {
    const content = html2 || "<i>(No content)</i>";
    return highlightQuotes$1(content, extendedScore);
  };
  const renderPostBody$1 = (html2, extendedScore, isTruncated) => {
    const bodyHtml = renderBody(html2, extendedScore);
    return `
    <div class="pr-post-body pr-post-body-container ${isTruncated ? "truncated" : ""}" 
         style="${isTruncated ? `max-height: ${CONFIG.maxPostHeight};` : ""}">
      <div class="pr-post-content">
        ${bodyHtml}
      </div>
      <div class="pr-read-more-overlay" style="${isTruncated ? "" : "display: none;"}">
        <button class="pr-read-more-btn pr-post-read-more" data-action="read-more" style="${isTruncated ? "" : "display: none;"}">Read More</button>
      </div>
    </div>
  `;
  };
  const highlightQuotes = (html2, extendedScore) => {
    const safeHtml = sanitizeHtml(html2);
    if (!extendedScore || !extendedScore.reacts) return safeHtml;
    const quotesToHighlight = [];
    Object.values(extendedScore.reacts).forEach((users) => {
      users.forEach((u) => {
        if (u.quotes) {
          u.quotes.forEach((q) => {
            if (q.quote && q.quote.trim().length > 0) {
              quotesToHighlight.push(q.quote);
            }
          });
        }
      });
    });
    if (quotesToHighlight.length === 0) return safeHtml;
    const uniqueQuotes = [...new Set(quotesToHighlight)].sort((a, b) => b.length - a.length);
    const parser = new DOMParser();
    const doc = parser.parseFromString(safeHtml, "text/html");
    const replaceTextNode = (node, quote) => {
      const text2 = node.nodeValue || "";
      if (!text2.includes(quote)) return;
      const parts = text2.split(quote);
      if (parts.length <= 1) return;
      const fragment = doc.createDocumentFragment();
      parts.forEach((part, index) => {
        if (part) {
          fragment.appendChild(doc.createTextNode(part));
        }
        if (index < parts.length - 1) {
          const span = doc.createElement("span");
          span.className = "pr-highlight";
          span.title = "Reacted content";
          span.textContent = quote;
          fragment.appendChild(span);
        }
      });
      node.parentNode?.replaceChild(fragment, node);
    };
    uniqueQuotes.forEach((quote) => {
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let node = walker.nextNode();
      while (node) {
        const textNode = node;
        if (!textNode.parentElement?.classList.contains("pr-highlight")) {
          nodes.push(textNode);
        }
        node = walker.nextNode();
      }
      nodes.forEach((textNode) => replaceTextNode(textNode, quote));
    });
    return doc.body.innerHTML;
  };
  const getContextType = (comment) => comment.contextType;
  const renderMissingParentPlaceholder = (comment, repliesHtml = "") => {
    const postId = comment.postId || "";
    return `
    <div class="pr-comment pr-item read pr-missing-parent"
         data-id="${comment._id}"
         data-post-id="${postId}"
         data-parent-id=""
         data-placeholder="1">${repliesHtml}</div>
  `;
  };
  const renderCommentTree = (comment, state2, allComments, allCommentIds, childrenByParentId) => {
    const idSet = allCommentIds ?? new Set(allComments.map((c) => c._id));
    const childrenIndex = childrenByParentId ?? state2.childrenByParentId;
    const replies = childrenIndex.get(comment._id) ?? [];
    const visibleReplies = replies.filter((r) => idSet.has(r._id));
    const cutoff = getLoadFrom();
    const isImplicitlyRead = (item) => {
      return !!(cutoff && cutoff !== "__LOAD_RECENT__" && cutoff.includes("T") && item.postedAt && item.postedAt < cutoff);
    };
    if (visibleReplies.length > 0) {
      const readState = getReadState();
      visibleReplies.forEach((r) => {
        const isItemRead = !state2.isArchiveMode && (readState[r._id] === 1 || isImplicitlyRead(r));
        r.treeKarma = calculateTreeKarma(
          r._id,
          r.baseScore || 0,
          isItemRead,
          childrenIndex.get(r._id) || [],
          readState,
          childrenIndex,
          cutoff
        );
      });
      visibleReplies.sort((a, b) => {
        const tkA = a.treeKarma || -Infinity;
        const tkB = b.treeKarma || -Infinity;
        if (tkA !== tkB) return tkB - tkA;
        return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
      });
    }
    const repliesHtml = visibleReplies.length > 0 ? `<div class="pr-replies">${visibleReplies.map((r) => renderCommentTree(r, state2, allComments, idSet, childrenIndex)).join("")}</div>` : "";
    return renderComment(comment, state2, repliesHtml);
  };
  const hasAllDescendantsLoaded = (commentId, state2) => {
    const stack = [commentId];
    while (stack.length > 0) {
      const id = stack.pop();
      const comment = state2.commentById.get(id);
      const directChildrenCount = comment ? comment.directChildrenCount || 0 : 0;
      if (directChildrenCount <= 0) continue;
      const loadedChildren = state2.childrenByParentId.get(id) || [];
      if (loadedChildren.length < directChildrenCount) return false;
      for (const child of loadedChildren) {
        stack.push(child._id);
      }
    }
    return true;
  };
  const getUnreadDescendantCount = (commentId, state2, readState) => {
    let count = 0;
    const stack = [commentId];
    while (stack.length > 0) {
      const currentId = stack.pop();
      const children = state2.childrenByParentId.get(currentId) || [];
      for (const child of children) {
        if (!isRead(child._id, readState, child.postedAt)) {
          count++;
        }
        stack.push(child._id);
      }
    }
    return count;
  };
  const renderContextPlaceholder = (comment, state2, repliesHtml = "") => {
    const metadataHtml = renderMetadata(comment, {
      state: state2,
      style: "font-size: 80%;",
      isFullPost: false
    });
    return `
    <div class="pr-comment pr-item context pr-context-placeholder"
         data-id="${comment._id}"
         data-parent-id="${comment.parentCommentId || ""}"
         data-post-id="${comment.postId}">
      ${metadataHtml}
      ${repliesHtml}
    </div>
  `;
  };
  const renderComment = (comment, state2, repliesHtml = "") => {
    const ct = getContextType(comment);
    if (ct === "missing") return renderMissingParentPlaceholder(comment, repliesHtml);
    if (ct === "stub") return renderContextPlaceholder(comment, state2, repliesHtml);
    const readState = getReadState();
    const isLocallyRead = !state2.isArchiveMode && isRead(comment._id, readState, comment.postedAt);
    const commentIsRead = ct === "fetched" || isLocallyRead;
    const unreadDescendantCount = getUnreadDescendantCount(comment._id, state2, readState);
    const showAsPlaceholder = isLocallyRead && unreadDescendantCount < 2 && !comment.forceVisible;
    if (showAsPlaceholder) {
      return `
      <div class="pr-comment pr-item read pr-comment-placeholder" 
           data-id="${comment._id}" 
           data-parent-id="${comment.parentCommentId || ""}"
           data-post-id="${comment.postId}">
        <div class="pr-placeholder-bar" title="Ancestor Context (Click to expand)" data-action="expand-placeholder"></div>
        <div class="pr-replies-placeholder"></div> 
        ${repliesHtml}
      </div>
    `;
    }
    const authorHandle = comment.user?.username || comment.author || "Unknown Author";
    const postedAt = comment.postedAt || ( new Date()).toISOString();
    const ageHours = getAgeInHours(postedAt);
    const score = comment.baseScore || 0;
    const authorKarma = comment.user?.karma || 0;
    const normalized = calculateNormalizedScore(score, ageHours, authorHandle, authorKarma, false);
    const order = comment._order || 0;
    const isContext = ct === "fetched";
    const isReplyToYou = !!(state2.currentUsername && comment.parentComment?.user?.username === state2.currentUsername);
    const autoHide = !state2.isArchiveMode && shouldAutoHide(normalized) && !commentIsRead && !isContext;
    const clampedScore = clampScore(normalized);
    const scoreColor = normalized > 0 ? getScoreColor(clampedScore) : "";
    const recencyColor = order > 0 ? getRecencyColor(order, CONFIG.highlightLastN) : "";
    const fontSize = getFontSizePercent(score, false);
    const classes = [
      "pr-comment",
      "pr-item",
      commentIsRead ? "read" : "",
      comment.rejected ? "rejected" : "",
      isContext ? "context" : "",
      isReplyToYou ? "reply-to-you" : "",
      autoHide || comment.rejected ? "collapsed" : "",
      comment.justRevealed ? "pr-just-revealed" : ""
    ].filter(Boolean).join(" ");
    const metaStyle = scoreColor ? `background-color: ${scoreColor};` : "";
    const bodyStyle = recencyColor ? `--pr-recency-color: ${recencyColor};` : "";
    const fontStyle = `font-size: ${fontSize}%;`;
    const hasParent = !!comment.parentCommentId;
    const totalChildren = comment.directChildrenCount || 0;
    let rDisabled;
    let rTooltip;
    if (totalChildren <= 0) {
      rDisabled = true;
      rTooltip = "No replies to load";
    } else if (hasAllDescendantsLoaded(comment._id, state2)) {
      rDisabled = true;
      rTooltip = "All replies already loaded in current feed";
    } else {
      rDisabled = false;
      rTooltip = "Load all replies from server (Shortkey: r)";
    }
    const tDisabled = !hasParent;
    const tTooltip = tDisabled ? "Already at top level" : "Load parents and scroll to root (Shortkey: t)";
    const controlsHtml = `
    <span class="pr-comment-controls">
      <span class="pr-comment-action text-btn" data-action="send-to-ai-studio" title="Send thread to AI Studio (Shortkey: g, Shift-G to include descendants)">[g]</span>
      <span class="pr-comment-action text-btn ${rDisabled ? "disabled" : ""}" data-action="load-descendants" title="${rTooltip}">[r]</span>
      <span class="pr-comment-action text-btn ${tDisabled ? "disabled" : ""}" data-action="load-parents-and-scroll" title="${tTooltip}">[t]</span>
      <span class="pr-find-parent text-btn" data-action="find-parent" title="Scroll to parent comment">[^]</span>
      <span class="pr-collapse text-btn" data-action="collapse" title="Collapse comment and its replies">[−]</span>
      <span class="pr-expand text-btn" data-action="expand" title="Expand comment">[+]</span>
    </span>
  `;
    const metadataHtml = renderMetadata(comment, {
      state: state2,
      style: `${metaStyle} ${fontStyle}`,
      extraClass: "pr-comment-meta-wrapper",
      children: controlsHtml
    });
    const bodyContent = renderBody(comment.htmlBody || "", comment.extendedScore);
    return `
    <div class="${classes}" 
         data-id="${comment._id}" 
         data-author="${escapeHtml(authorHandle)}"
         data-parent-id="${comment.parentCommentId || ""}"
         data-post-id="${comment.postId}"
         style="${bodyStyle}">
      ${metadataHtml}
      <div class="pr-comment-body">
        ${bodyContent}
      </div>
      ${repliesHtml}
    </div>
  `;
  };
  const createMissingParentPlaceholder = (parentId, child) => {
    const postedAt = child.postedAt || ( new Date()).toISOString();
    return {
      _id: parentId,
      postedAt,
      htmlBody: "",
      contents: { markdown: null },
      baseScore: 0,
      voteCount: 0,
      pageUrl: child.pageUrl || "",
      author: "",
      rejected: false,
      topLevelCommentId: child.topLevelCommentId || parentId,
      user: null,
      postId: child.postId,
      post: child.post ?? null,
      parentCommentId: null,
      parentComment: null,
      extendedScore: null,
      afExtendedScore: null,
      currentUserVote: null,
      currentUserExtendedVote: null,
      contextType: "missing"
    };
  };
  const extractParentChain = (comment) => {
    const chain = [];
    let current = comment.parentComment;
    while (current && current._id) {
      chain.push({ _id: current._id, parentCommentId: current.parentCommentId || null });
      current = current.parentComment;
    }
    return chain;
  };
  const withMissingParentPlaceholders = (comments, state2) => {
    if (comments.length === 0) return comments;
    const loadedIds = state2.commentById;
    const existingIds = new Set(comments.map((c) => c._id));
    const placeholdersToAdd = new Map();
    comments.forEach((comment) => {
      const parentId = comment.parentCommentId;
      if (!parentId) return;
      if (loadedIds.has(parentId) || existingIds.has(parentId) || placeholdersToAdd.has(parentId)) return;
      const chain = extractParentChain(comment);
      let childForPlaceholder = comment;
      for (const ancestor of chain) {
        if (loadedIds.has(ancestor._id) || existingIds.has(ancestor._id) || placeholdersToAdd.has(ancestor._id)) {
          break;
        }
        const placeholder = createMissingParentPlaceholder(ancestor._id, childForPlaceholder);
        placeholder.parentCommentId = ancestor.parentCommentId;
        placeholdersToAdd.set(ancestor._id, placeholder);
        childForPlaceholder = placeholder;
      }
      if (!placeholdersToAdd.has(parentId) && !loadedIds.has(parentId) && !existingIds.has(parentId)) {
        placeholdersToAdd.set(parentId, createMissingParentPlaceholder(parentId, comment));
      }
    });
    if (placeholdersToAdd.size === 0) return comments;
    return [...comments, ...placeholdersToAdd.values()];
  };
  const buildChildrenIndex = (comments) => {
    const childrenByParentId = new Map();
    comments.forEach((comment) => {
      const parentId = comment.parentCommentId || "";
      if (!childrenByParentId.has(parentId)) {
        childrenByParentId.set(parentId, []);
      }
      childrenByParentId.get(parentId).push(comment);
    });
    childrenByParentId.forEach((children) => {
      children.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
    });
    return childrenByParentId;
  };
  const renderPostBody = (post, isTruncated = true) => {
    return renderPostBody$1(
      post.htmlBody || "",
      post.extendedScore,
      isTruncated
    );
  };
  const renderPostGroup = (group, state2) => {
    const commentsWithPlaceholders = withMissingParentPlaceholders(group.comments, state2);
    const visibleChildrenByParentId = buildChildrenIndex(commentsWithPlaceholders);
    const readState = getReadState();
    const commentSet = new Set(commentsWithPlaceholders.map((c) => c._id));
    const rootComments = commentsWithPlaceholders.filter(
      (c) => !c.parentCommentId || !commentSet.has(c.parentCommentId)
    );
    const cutoff = getLoadFrom();
    const isImplicitlyRead = (item) => {
      return !!(cutoff && cutoff !== "__LOAD_RECENT__" && cutoff.includes("T") && item.postedAt && item.postedAt < cutoff);
    };
    rootComments.forEach((c) => {
      c.treeKarma = calculateTreeKarma(
        c._id,
        c.baseScore || 0,
        readState[c._id] === 1 || isImplicitlyRead(c),
        visibleChildrenByParentId.get(c._id) || [],
        readState,
        visibleChildrenByParentId,
        cutoff
      );
    });
    rootComments.sort((a, b) => {
      const tkA = a.treeKarma || -Infinity;
      const tkB = b.treeKarma || -Infinity;
      if (tkA !== tkB) return tkB - tkA;
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    });
    const commentsHtml = rootComments.map(
      (c) => renderCommentTree(c, state2, commentsWithPlaceholders, commentSet, visibleChildrenByParentId)
    ).join("");
    const isFullPost = !!(group.fullPost && group.fullPost.htmlBody);
    const postToRender = group.fullPost || {
      _id: group.postId,
      title: group.title,
      slug: "",
      pageUrl: `${window.location.origin}/posts/${group.postId}`,
      postedAt: cutoff || ( new Date()).toISOString(),
baseScore: 0,
      voteCount: 0,
      user: null,
      extendedScore: null,
      afExtendedScore: null,
      currentUserVote: null,
      currentUserExtendedVote: null,
      contents: { markdown: null },
      commentCount: 0,
      wordCount: 0
    };
    if (!group.fullPost) {
      Logger.warn(`renderPostGroup: fullPost missing for ${group.postId}, using fallback`);
    }
    const isReadPost = isRead(group.postId, readState, postToRender.postedAt);
    const existingEl = document.querySelector(`.pr-post[data-id="${group.postId}"]`);
    const currentlyTruncated = existingEl ? existingEl.querySelector(".pr-post-body-container")?.classList.contains("truncated") : true;
    const headerHtml = renderPostHeader(postToRender, {
      isFullPost,
      state: state2
    });
    const postBodyHtml = isFullPost ? renderPostBody(group.fullPost, currentlyTruncated !== false) : "";
    const authorHandle = postToRender.user?.username || "";
    return `
    <div class="pr-post pr-item ${isReadPost ? "read" : ""}" 
         data-post-id="${group.postId}" 
         data-id="${group.postId}"
         data-author="${escapeHtml(authorHandle)}">
      ${headerHtml}
      ${postBodyHtml}
      <div class="pr-post-comments">
        ${commentsHtml}
      </div>
    </div>
  `;
  };
  const setupLinkPreviews = (comments) => {
    const postHeaders = document.querySelectorAll(".pr-post-header");
    postHeaders.forEach((header) => {
      const postId = header.getAttribute("data-post-id");
      if (!postId) return;
      const titleH2 = header.querySelector("h2");
      if (titleH2) {
        setupHoverPreview(
          titleH2,
          createPostPreviewFetcher(postId),
          {
            type: "post",
            targetGetter: () => {
              const post = document.querySelector(`.pr-post[data-id="${postId}"]`);
              if (!post) return null;
              const body = post.querySelector(".pr-post-body-container");
              const collapsed = post.querySelector(".pr-post-body-container.collapsed");
              if (!body || collapsed) return null;
              if (isElementFullyVisible(post)) {
                return [post];
              }
              return null;
            }
          }
        );
      }
    });
    const authorLinks = document.querySelectorAll(".pr-author");
    authorLinks.forEach((link) => {
      const userId = link.getAttribute("data-author-id");
      if (userId) {
        setupHoverPreview(
          link,
          createAuthorPreviewFetcher(userId),
          { type: "author" }
        );
      }
    });
    const commentLinks = document.querySelectorAll(".pr-comment-body a");
    commentLinks.forEach((link) => {
      const href = link.getAttribute("href");
      if (!href) return;
      if (isCommentUrl(href)) {
        const commentId = extractCommentIdFromUrl(href);
        if (commentId) {
          setupHoverPreview(
            link,
            createCommentPreviewFetcher(commentId, comments),
            { type: "comment" }
          );
          return;
        }
      }
      if (isPostUrl(href)) {
        const postId = extractPostIdFromUrl(href);
        if (postId) {
          setupHoverPreview(
            link,
            createPostPreviewFetcher(postId),
            { type: "post" }
          );
          return;
        }
      }
      if (isAuthorUrl(href)) {
        const authorSlug = extractAuthorSlugFromUrl(href);
        if (authorSlug) {
          setupHoverPreview(
            link,
            createAuthorBySlugPreviewFetcher(authorSlug),
            { type: "author" }
          );
          return;
        }
      }
      if (isWikiUrl(href)) {
        const wikiSlug = extractWikiSlugFromUrl(href);
        if (wikiSlug) {
          setupHoverPreview(
            link,
            createWikiPreviewFetcher(wikiSlug),
            { type: "wiki" }
          );
        }
      }
    });
    const parentLinks = document.querySelectorAll(".pr-find-parent");
    parentLinks.forEach((link) => {
      const comment = link.closest(".pr-comment");
      const parentId = comment?.getAttribute("data-parent-id");
      if (parentId) {
        setupHoverPreview(
          link,
          createCommentPreviewFetcher(parentId, comments),
          {
            type: "comment",
            targetGetter: () => document.querySelector(`.pr-comment[data-id="${parentId}"]`)
          }
        );
      } else {
        const postId = comment?.getAttribute("data-post-id");
        if (postId) {
          setupHoverPreview(
            link,
            createPostPreviewFetcher(postId),
            {
              type: "post",
              targetGetter: () => {
                const post = document.querySelector(`.pr-post[data-id="${postId}"]`);
                if (!post) return null;
                const header = post.querySelector(".pr-post-header");
                const body = post.querySelector(".pr-post-body-container");
                const collapsed = post.querySelector(".pr-post-body-container.collapsed");
                const targets = [];
                if (header) targets.push(header);
                if (body && !collapsed) {
                  targets.push(body);
                }
                const stickyHeader2 = document.querySelector(`.pr-sticky-header.visible .pr-post-header[data-post-id="${postId}"]`);
                if (stickyHeader2) targets.push(stickyHeader2);
                return targets.length > 0 ? targets : null;
              }
            }
          );
        }
      }
      link.addEventListener("click", () => {
        cancelHoverTimeout();
      });
    });
    const expandButtons = document.querySelectorAll(".pr-expand");
    expandButtons.forEach((btn) => {
      const comment = btn.closest(".pr-comment");
      const commentId = comment?.getAttribute("data-id");
      if (commentId) {
        setupHoverPreview(
          btn,
          createCommentPreviewFetcher(commentId, comments),
          { type: "comment" }
        );
      }
    });
    const placeholderBars = document.querySelectorAll(".pr-placeholder-bar");
    placeholderBars.forEach((bar) => {
      const comment = bar.closest(".pr-comment");
      const commentId = comment?.getAttribute("data-id");
      if (commentId) {
        setupHoverPreview(
          bar,
          createCommentPreviewFetcher(commentId, comments),
          { type: "comment" }
        );
      }
    });
  };
  class StickyHeader {
    container = null;
    lastPostId = null;
    isVisible = false;
    constructor() {
      this.container = document.getElementById("pr-sticky-header");
    }
init() {
      if (!this.container) {
        console.warn("[StickyHeader] Container not found");
        return;
      }
      window.addEventListener("scroll", () => this.handleScroll(), { passive: true });
    }
refresh() {
      if (!this.container || !this.lastPostId || !this.isVisible) return;
      this.render(this.lastPostId, null);
    }
    handleScroll() {
      if (!this.container) return;
      const posts = document.querySelectorAll(".pr-post");
      let currentPost = null;
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        const rect = post.getBoundingClientRect();
        if (rect.top < 100 && rect.bottom > 100) {
          const header = post.querySelector(".pr-post-header");
          if (header) {
            const headerRect = header.getBoundingClientRect();
            if (headerRect.top < -1) {
              currentPost = post;
            }
          }
          break;
        }
      }
      if (currentPost) {
        this.updateHeaderContent(currentPost);
      } else {
        this.hide();
      }
    }
    updateHeaderContent(currentPost) {
      if (!this.container) return;
      const postId = currentPost.getAttribute("data-post-id") || "";
      if (postId !== this.lastPostId || !this.isVisible) {
        this.lastPostId = postId;
        this.render(postId, currentPost);
        this.show();
      }
    }
    render(postId, currentPost) {
      if (!this.container) return;
      const state2 = getState();
      const post = state2.postById.get(postId);
      if (!post) return;
      const isFullPost = !!post.htmlBody;
      this.container.innerHTML = renderPostHeader(post, {
        isSticky: true,
        isFullPost,
        state: state2
      });
      this.container.setAttribute("data-author", post.user?.username || "");
      const newHeader = this.container.querySelector(".pr-post-header");
      const titleH2 = newHeader.querySelector("h2");
      const authorLink = newHeader.querySelector(".pr-author");
      const postEl = currentPost || document.querySelector(`.pr-post[data-id="${postId}"]`);
      const isCollapsed = !!postEl?.querySelector(".pr-post-comments.collapsed, .pr-post-content.collapsed");
      if (newHeader) {
        const collapseBtn = newHeader.querySelector('[data-action="collapse"]');
        const expandBtn = newHeader.querySelector('[data-action="expand"]');
        if (collapseBtn) collapseBtn.style.display = isCollapsed ? "none" : "inline";
        if (expandBtn) expandBtn.style.display = isCollapsed ? "inline" : "none";
        const nBtn = newHeader.querySelector('[data-action="scroll-to-next-post"]');
        if (nBtn) {
          let nextPost = postEl ? postEl.nextElementSibling : null;
          while (nextPost && !nextPost.classList.contains("pr-post")) {
            nextPost = nextPost.nextElementSibling;
          }
          if (!nextPost) {
            nBtn.classList.add("disabled");
            nBtn.title = "No more posts in current feed";
          } else {
            nBtn.classList.remove("disabled");
            nBtn.title = "Scroll to next post";
          }
        }
      }
      if (titleH2 && postId) {
        setupHoverPreview(
          titleH2,
          createPostPreviewFetcher(postId),
          { type: "post" }
        );
      }
      if (authorLink) {
        const userId = authorLink.getAttribute("data-author-id");
        if (userId) {
          setupHoverPreview(
            authorLink,
            createAuthorPreviewFetcher(userId),
            { type: "author" }
          );
        }
      }
    }
    show() {
      if (this.container) {
        this.container.classList.add("visible");
        this.isVisible = true;
      }
    }
    hide() {
      if (this.container && this.isVisible) {
        this.lastPostId = null;
        this.container.classList.remove("visible");
        this.isVisible = false;
      }
    }
  }
  let stickyHeader = null;
  const setupStickyHeader = () => {
    if (stickyHeader) return;
    stickyHeader = new StickyHeader();
    stickyHeader.init();
  };
  const getStickyHeader = () => stickyHeader;
  const setupInlineReactions = (state2) => {
    document.addEventListener("selectionchange", () => {
      const selection = window.getSelection();
      const existingBtn = document.getElementById("pr-inline-react-btn");
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        if (existingBtn && !document.getElementById("pr-global-reaction-picker")?.classList.contains("visible")) {
          existingBtn.remove();
          state2.currentSelection = null;
        }
        return;
      }
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const commentBody = (container.nodeType === 3 ? container.parentElement : container)?.closest(".pr-comment-body");
      if (!commentBody) {
        if (existingBtn) existingBtn.remove();
        return;
      }
      const text2 = selection.toString().slice(0, 500);
      state2.currentSelection = { text: text2, range };
      if (!existingBtn) {
        const btn = document.createElement("div");
        btn.id = "pr-inline-react-btn";
        btn.className = "pr-inline-react-btn";
        btn.textContent = "React";
        btn.dataset.id = commentBody.closest(".pr-comment")?.getAttribute("data-id") || "";
        document.body.appendChild(btn);
        const rect = range.getBoundingClientRect();
        btn.style.top = `${rect.top - 30 + window.scrollY}px`;
        btn.style.left = `${rect.left + rect.width / 2}px`;
      } else {
        const rect = range.getBoundingClientRect();
        existingBtn.style.top = `${rect.top - 30 + window.scrollY}px`;
        existingBtn.style.left = `${rect.left + rect.width / 2}px`;
        existingBtn.dataset.id = commentBody.closest(".pr-comment")?.getAttribute("data-id") || "";
      }
    });
  };
  const setupExternalLinks = () => {
    document.addEventListener("click", (e) => {
      const target = e.target;
      const link = target.closest("a");
      if (!link) return;
      const hostname = link.hostname;
      const pathname = link.pathname;
      const isReaderLink = pathname.startsWith("/reader");
      const isAnchor = link.getAttribute("href")?.startsWith("#");
      if (isAnchor) return;
      if (hostname && (hostname !== window.location.hostname || !isReaderLink)) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
    }, { capture: true, passive: true });
  };
  class ReadTracker {
    static UNREAD_ITEM_SELECTOR = ".pr-item:not(.read):not(.context), .pr-comment:not(.read):not(.context), .pr-post:not(.read):not(.context)";
    static BOTTOM_MARGIN_PX = 50;
    scrollMarkDelay;
    commentsDataGetter;
    postsDataGetter;
    initialBatchNewestDateGetter;
    pendingReadTimeouts = {};
    scrollTimeout = null;
    scrollListenerAdded = false;
    isCheckingForMore = false;
    lastCheckedIso = null;
    recheckTimer = null;
    countdownSeconds = 0;
    hasAdvancedThisBatch = false;
    constructor(scrollMarkDelay, commentsDataGetter, postsDataGetter = () => [], initialBatchNewestDateGetter = () => null) {
      this.scrollMarkDelay = scrollMarkDelay;
      this.commentsDataGetter = commentsDataGetter;
      this.postsDataGetter = postsDataGetter;
      this.initialBatchNewestDateGetter = initialBatchNewestDateGetter;
    }
    init() {
      if (this.scrollListenerAdded) return;
      window.addEventListener("scroll", () => this.handleScroll(), { passive: true });
      this.scrollListenerAdded = true;
      this.hasAdvancedThisBatch = false;
      setTimeout(() => this.checkInitialState(), 1e3);
    }
    checkInitialState() {
      const unreadCountEl = document.getElementById("pr-unread-count");
      const unreadCount = parseInt(unreadCountEl?.textContent || "0", 10);
      if (unreadCount === 0) {
        const currentComments = this.commentsDataGetter();
        if (currentComments.length > 0) {
          this.advanceAndCheck(currentComments);
        }
      }
    }
    handleScroll() {
      if (this.scrollTimeout) {
        return;
      }
      this.scrollTimeout = window.setTimeout(() => {
        this.scrollTimeout = null;
        this.processScroll();
      }, 200);
    }
    processScroll() {
      const items = document.querySelectorAll(ReadTracker.UNREAD_ITEM_SELECTOR);
      const readThreshold = 0;
      const docHeight = Math.max(document.body.offsetHeight, document.documentElement.offsetHeight);
      const viewportHeight = window.innerHeight;
      const isAtBottom = viewportHeight + window.scrollY >= docHeight - ReadTracker.BOTTOM_MARGIN_PX;
      const unreadCountEl = document.getElementById("pr-unread-count");
      Logger.debug(`processScroll: items=${items.length}, isAtBottom=${isAtBottom}, scrollY=${window.scrollY}`);
      for (const el of items) {
        const id = el.getAttribute("data-id");
        if (!id) continue;
        const rect = el.getBoundingClientRect();
        let checkRect = rect;
        if (el.classList.contains("pr-post")) {
          const bodyContainer = el.querySelector(".pr-post-body-container");
          if (bodyContainer && !bodyContainer.classList.contains("collapsed")) {
            checkRect = bodyContainer.getBoundingClientRect();
          } else {
            const header = el.querySelector(".pr-post-header");
            if (header) checkRect = header.getBoundingClientRect();
          }
        } else if (el.classList.contains("pr-comment")) {
          const body = el.querySelector(".pr-comment-body");
          if (body && !el.classList.contains("collapsed")) {
            checkRect = body.getBoundingClientRect();
          } else {
            const meta = el.querySelector(".pr-comment-meta");
            if (meta) checkRect = meta.getBoundingClientRect();
          }
        }
        const isVisible = rect.top < viewportHeight && rect.bottom > 0;
        const shouldMark = checkRect.bottom < readThreshold || isAtBottom && isVisible;
        if (shouldMark) {
          if (!this.pendingReadTimeouts[id]) {
            const trackedElement = el;
            this.pendingReadTimeouts[id] = window.setTimeout(() => {
              delete this.pendingReadTimeouts[id];
              const currentEl = trackedElement.isConnected ? trackedElement : document.querySelector(`.pr-item[data-id="${id}"]`);
              if (!currentEl || currentEl.classList.contains("read")) {
                return;
              }
              markAsRead({ [id]: 1 });
              currentEl.classList.add("read");
              const liveUnreadCountEl = unreadCountEl?.isConnected ? unreadCountEl : document.getElementById("pr-unread-count");
              if (liveUnreadCountEl) {
                const parsedCount = Number.parseInt(liveUnreadCountEl.textContent || "", 10);
                const newCount = Number.isFinite(parsedCount) ? Math.max(0, parsedCount - 1) : document.querySelectorAll(ReadTracker.UNREAD_ITEM_SELECTOR).length;
                liveUnreadCountEl.textContent = newCount.toString();
                const liveDocHeight = Math.max(document.body.offsetHeight, document.documentElement.offsetHeight);
                const isNowAtBottom = window.innerHeight + window.scrollY >= liveDocHeight - 100;
                if (newCount === 0 && isNowAtBottom) {
                  this.checkInitialState();
                }
              }
            }, this.scrollMarkDelay);
          }
        } else {
          if (this.pendingReadTimeouts[id]) {
            window.clearTimeout(this.pendingReadTimeouts[id]);
            delete this.pendingReadTimeouts[id];
          }
        }
      }
      const currentComments = this.commentsDataGetter();
      if (isAtBottom && currentComments.length > 0) {
        Logger.debug("processScroll: at bottom, advancing");
        this.advanceAndCheck(currentComments);
      }
    }
    advanceAndCheck(currentComments) {
      if (this.hasAdvancedThisBatch) return;
      const initialNewest = this.initialBatchNewestDateGetter();
      let newestDateStr;
      if (initialNewest) {
        newestDateStr = initialNewest;
      } else {
        const newestComment = currentComments.reduce((prev, current) => {
          return new Date(current.postedAt) > new Date(prev.postedAt) ? current : prev;
        });
        newestDateStr = newestComment.postedAt;
      }
      const date = new Date(newestDateStr);
      date.setMilliseconds(date.getMilliseconds() + 1);
      const nextLoadFrom = date.toISOString();
      const currentLoadFrom = getLoadFrom();
      if (nextLoadFrom !== currentLoadFrom) {
        Logger.info(`Advancing session start to ${nextLoadFrom}`);
        setLoadFrom(nextLoadFrom);
        this.hasAdvancedThisBatch = true;
        const readState = getReadState();
        const dateByItemId = new Map();
        currentComments.forEach((c) => dateByItemId.set(c._id, c.postedAt));
        this.postsDataGetter().forEach((p) => dateByItemId.set(p._id, p.postedAt));
        const cleanupCutoffTime = new Date(currentLoadFrom).getTime();
        let removedCount = 0;
        for (const id of Object.keys(readState)) {
          if (dateByItemId.has(id)) continue;
          const postedAt = dateByItemId.get(id);
          if (!postedAt || new Date(postedAt).getTime() < cleanupCutoffTime) {
            delete readState[id];
            removedCount++;
          }
        }
        if (removedCount > 0) {
          setReadState(readState);
          Logger.info(`Cleaned up read state: removed ${removedCount} items older than ${nextLoadFrom}`);
        }
      }
      this.checkServerForMore(nextLoadFrom);
    }
    startRecheckTimer(afterIso) {
      if (this.recheckTimer) clearInterval(this.recheckTimer);
      this.countdownSeconds = 60;
      this.updateCountdownMessage(afterIso);
      this.recheckTimer = window.setInterval(() => {
        this.countdownSeconds--;
        if (this.countdownSeconds <= 0) {
          clearInterval(this.recheckTimer);
          this.recheckTimer = null;
          this.checkServerForMore(afterIso, true);
        } else {
          this.updateCountdownMessage(afterIso);
        }
      }, 1e3);
    }
    updateCountdownMessage(afterIso) {
      const msgEl = document.getElementById("pr-bottom-message");
      if (!msgEl) return;
      msgEl.style.display = "block";
      msgEl.textContent = `All comments have been marked read. No more comments on server. Waiting ${this.countdownSeconds}s for next check, or click here to check again.`;
      msgEl.onclick = () => {
        if (this.recheckTimer) clearInterval(this.recheckTimer);
        this.recheckTimer = null;
        this.checkServerForMore(afterIso, true);
      };
    }
    async checkServerForMore(afterIso, force = false) {
      if (this.isCheckingForMore && !force) return;
      if (this.lastCheckedIso === afterIso && !force) return;
      if (this.recheckTimer && !force) return;
      this.isCheckingForMore = true;
      this.lastCheckedIso = afterIso;
      const msgEl = document.getElementById("pr-bottom-message");
      if (!msgEl) return;
      msgEl.style.display = "block";
      msgEl.textContent = "Checking for more comments...";
      msgEl.className = "pr-bottom-message";
      msgEl.onclick = null;
      try {
        const res = await queryGraphQL(GET_ALL_RECENT_COMMENTS, {
          after: afterIso,
          limit: 1,
          sortBy: "oldest"
        });
        const hasMore = (res?.comments?.results?.length || 0) > 0;
        if (hasMore) {
          msgEl.textContent = "New comments available! Click here to reload.";
          msgEl.classList.add("has-more");
          msgEl.onclick = () => window.location.reload();
          if (this.recheckTimer) clearInterval(this.recheckTimer);
          this.recheckTimer = null;
        } else {
          this.startRecheckTimer(afterIso);
        }
      } catch (e) {
        Logger.error("Failed to check for more comments:", e);
        msgEl.textContent = "Failed to check server. Click to retry.";
        msgEl.onclick = () => this.checkServerForMore(afterIso, true);
      } finally {
        this.isCheckingForMore = false;
      }
    }
  }
  let readTracker = null;
  const setupScrollTracking = (commentsGetter, postsGetter, initialBatchNewestDateGetter = () => null) => {
    if (readTracker) {
      readTracker = null;
    }
    readTracker = new ReadTracker(CONFIG.scrollMarkDelay, commentsGetter, postsGetter, initialBatchNewestDateGetter);
    readTracker.init();
  };
  const smartScrollTo = (el, isPost2) => {
    const postContainer = el.closest(".pr-post");
    if (!postContainer) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const postHeader = postContainer.querySelector(".pr-post-header");
    const stickyHeader2 = document.getElementById("pr-sticky-header");
    const stickyHeight = stickyHeader2 && stickyHeader2.classList.contains("visible") ? stickyHeader2.offsetHeight : 0;
    const headerHeight = postHeader ? postHeader.offsetHeight : stickyHeight || 60;
    if (isPost2) {
      const headerTop = postHeader ? postHeader.getBoundingClientRect().top + window.pageYOffset : postContainer.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: headerTop,
        behavior: window.__PR_TEST_MODE__ ? "instant" : "smooth"
      });
    } else {
      const elementTop = el.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: elementTop - headerHeight - 10,
behavior: window.__PR_TEST_MODE__ ? "instant" : "smooth"
      });
    }
  };
  const refreshPostActionButtons = (postId) => {
    const selector = postId ? `.pr-post[data-id="${postId}"]` : ".pr-post";
    const posts = document.querySelectorAll(selector);
    const updateNextPostButton = (header, postEl) => {
      if (!header) return;
      const nBtn = header.querySelector('[data-action="scroll-to-next-post"]');
      if (!nBtn) return;
      let nextPost = postEl ? postEl.nextElementSibling : null;
      while (nextPost && !nextPost.classList.contains("pr-post")) {
        nextPost = nextPost.nextElementSibling;
      }
      if (!nextPost) {
        nBtn.classList.add("disabled");
        nBtn.title = "No more posts in current feed";
      } else {
        nBtn.classList.remove("disabled");
        nBtn.title = "Scroll to next post";
      }
    };
    posts.forEach((post) => {
      const container = post.querySelector(".pr-post-body-container");
      const eBtn = post.querySelector('[data-action="toggle-post-body"]');
      if (container && eBtn) {
        const isFullPost = container.classList.contains("pr-post-body");
        if (container.classList.contains("truncated")) {
          if (container.classList.contains("collapsed") || container.style.display === "none") {
            eBtn.classList.remove("disabled");
            eBtn.title = "Expand post body";
          } else {
            const isActuallyTruncated = container.scrollHeight > container.offsetHeight;
            if (!isActuallyTruncated) {
              const overlay = container.querySelector(".pr-read-more-overlay");
              if (overlay) overlay.style.display = "none";
              eBtn.classList.add("disabled");
              eBtn.title = "Post fits within viewport without truncation";
            } else {
              eBtn.classList.remove("disabled");
              eBtn.title = "Expand post body";
            }
          }
        } else if (isFullPost) {
          if (container.classList.contains("collapsed")) {
            eBtn.title = "Expand post body";
          } else {
            const isSmallContent = container.scrollHeight <= window.innerHeight * 0.5;
            if (isSmallContent) {
              eBtn.classList.add("disabled");
              eBtn.title = "Post body is small and doesn't need toggle";
              const overlay = container.querySelector(".pr-read-more-overlay");
              if (overlay) overlay.style.display = "none";
            } else {
              eBtn.title = "Collapse post body";
            }
          }
          if (!eBtn.title.includes("small")) {
            eBtn.classList.remove("disabled");
          }
        }
      }
      const header = post.querySelector(".pr-post-header");
      updateNextPostButton(header, post);
    });
    const stickyHeader2 = document.querySelector(".pr-sticky-header .pr-post-header");
    if (stickyHeader2) {
      const stickyPostId = stickyHeader2.getAttribute("data-post-id");
      const stickyPostEl = stickyPostId ? document.querySelector(`.pr-post[data-id="${stickyPostId}"]`) : null;
      updateNextPostButton(stickyHeader2, stickyPostEl);
    }
  };
  const formatStatusDate = (iso) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mon = months[d.getMonth()];
    const day = d.getDate();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${mon} ${day} ${hh}:${mm}`;
  };
  const buildPostGroups = (comments, posts, state2) => {
    const readState = getReadState();
    const sortedComments = [...comments].sort(
      (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
    );
    const unreadIds = new Set();
    const parentIds = new Set();
    const cutoff = getLoadFrom();
    const isImplicitlyRead = (item) => {
      return !!(cutoff && cutoff !== "__LOAD_RECENT__" && cutoff.includes("T") && item.postedAt && item.postedAt < cutoff);
    };
    sortedComments.forEach((c) => {
      const ct = c.contextType;
      const isContext = ct === "fetched" || ct === "stub";
      const isLocallyRead = isRead(c._id, readState, c.postedAt);
      const implicit = isImplicitlyRead(c);
      const commentIsRead = isLocallyRead || implicit;
      if (isContext || !commentIsRead) {
        if (!isContext) unreadIds.add(c._id);
        let currentId = c._id;
        const visited = new Set();
        while (currentId) {
          if (visited.has(currentId)) break;
          visited.add(currentId);
          parentIds.add(currentId);
          const currentComment = state2.commentById.get(currentId);
          currentId = currentComment?.parentCommentId || null;
        }
      }
    });
    const idsToShow = new Set([...unreadIds, ...parentIds]);
    const unreadPostIds = new Set();
    posts.forEach((p) => {
      const readStatus = isRead(p._id, readState, p.postedAt) || isImplicitlyRead(p);
      if (!readStatus) {
        unreadPostIds.add(p._id);
      }
    });
    const postGroups = new Map();
    posts.forEach((post) => {
      if (!post) return;
      if (!postGroups.has(post._id)) {
        postGroups.set(post._id, { title: post.title, postId: post._id, comments: [], fullPost: post });
      } else {
        postGroups.get(post._id).fullPost = post;
      }
    });
    sortedComments.forEach((comment, index) => {
      if (!idsToShow.has(comment._id) && !parentIds.has(comment._id)) return;
      const postId = comment.postId;
      if (!postId) return;
      if (!postGroups.has(postId)) {
        const postTitle = comment.post?.title || "Unknown Post";
        const fullerPost = state2.postById.get(postId) || comment.post;
        postGroups.set(postId, {
          title: postTitle,
          postId,
          comments: [],
          fullPost: fullerPost
        });
      }
      comment._order = index < CONFIG.highlightLastN ? index + 1 : 0;
      postGroups.get(postId).comments.push(comment);
    });
    let groupsList = Array.from(postGroups.values());
    groupsList.forEach((g) => {
      const postRecord = state2.postById.get(g.postId);
      const post = postRecord || g.fullPost || { _id: g.postId, baseScore: 0 };
      const isPostRead = isRead(g.postId, readState, post.postedAt) || isImplicitlyRead(post);
      const rootCommentsOfPost = g.comments.filter((c) => !c.parentCommentId || !state2.commentById.has(c.parentCommentId));
      g.treeKarma = calculateTreeKarma(
        g.postId,
        post.baseScore || 0,
        isPostRead,
        rootCommentsOfPost,
        readState,
        state2.childrenByParentId,
        cutoff
      );
      g.postedAt = post.postedAt || ( new Date()).toISOString();
      if (g.treeKarma === -Infinity) {
        Logger.warn(`Post group ${g.postId} has Tree-Karma -Infinity (no unread items found in its tree).`);
      }
    });
    const totalGroupsBeforeFilter = groupsList.length;
    groupsList = groupsList.filter((g) => g.treeKarma !== -Infinity);
    const hiddenPosts = totalGroupsBeforeFilter - groupsList.length;
    const visiblePostIds = new Set(groupsList.map((g) => g.postId));
    const finalUnreadPostIds = new Set([...unreadPostIds].filter((id) => visiblePostIds.has(id)));
    groupsList.sort((a, b) => {
      const tkA = a.treeKarma;
      const tkB = b.treeKarma;
      if (tkA !== tkB) return tkB - tkA;
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    });
    const sortedGroups = new Map();
    groupsList.forEach((g) => sortedGroups.set(g.postId, g));
    const batchCommentIds = new Set(comments.map((c) => c._id));
    const batchUnreadCount = Array.from(unreadIds).filter((id) => batchCommentIds.has(id)).length;
    const batchContextCount = Array.from(parentIds).filter((id) => batchCommentIds.has(id) && !unreadIds.has(id)).length;
    const batchHiddenCount = comments.length - batchUnreadCount - batchContextCount;
    const stats = {
      totalComments: comments.length,
      unreadComments: batchUnreadCount,
      contextComments: batchContextCount,
      hiddenComments: batchHiddenCount,
      totalPosts: posts.length,
      visiblePosts: groupsList.length,
      hiddenPosts
    };
    return {
      groups: sortedGroups,
      unreadItemCount: unreadIds.size + finalUnreadPostIds.size,
      stats
    };
  };
  const renderHelpSection = (showHelp) => {
    return `
    <details class="pr-help" ${showHelp ? "open" : ""} id="pr-help-section">
      <summary class="pr-help-header">
        <strong>📖 Power Reader Guide</strong>
      </summary>
      <div class="pr-help-content pr-help-columns">
        <div class="pr-help-section">
          <h4>🗳️ Voting & Reactions</h4>
          <ul>
            <li><strong>▲/▼</strong> Karma vote · <strong>✓/✗</strong> Agreement vote</li>
            <li>Select text → inline react to specific parts</li>
          </ul>
        </div>

        <div class="pr-help-section">
          <h4>👤 Authors</h4>
          <ul>
            <li><strong>[↑]/[↓]</strong> Favor/disfavor author</li>
            <li>Hover name for profile preview</li>
          </ul>
        </div>

        <div class="pr-help-section">
          <h4>🎨 Colors</h4>
          <ul>
            <li><strong>Pink</strong> High karma · <strong>Yellow</strong> Recent</li>
            <li><strong>Green border</strong> Reply to you · <strong>Grey</strong> Read</li>
          </ul>
        </div>

        <div class="pr-help-section">
          <h4>📦 Post Buttons (Hover + Key)</h4>
          <ul>
            <li><strong>[e]</strong> Expand/load body · <strong>[a]</strong> Load all comments</li>
            <li><strong>[c]</strong> Scroll to comments · <strong>[n]</strong> Scroll to next post</li>
            <li><strong>[−]/[+]</strong> Collapse/expand post + comments</li>
          </ul>
        </div>

        <div class="pr-help-section">
          <h4>💬 Comment Buttons (Hover + Key)</h4>
          <ul>
            <li><strong>[r]</strong> Load replies · <strong>[t]</strong> Trace to root (load parents)</li>
            <li><strong>[^]</strong> Find parent · <strong>[−]/[+]</strong> Collapse/expand comment</li>
            <li><strong>[↑]/[↓]</strong> Mark author as preferred/disliked</li>
            <li style="font-size: 0.9em; color: #888; margin-top: 4px;"><i>Note: Buttons show disabled with a tooltip when not applicable.</i></li>
          </ul>
        </div>

        <div class="pr-help-section">
          <h4>🔍 Previews & Navigation</h4>
          <ul>
            <li>Hover post titles or comment links for preview</li>
            <li>Click to navigate · Ctrl+click for new tab</li>
          </ul>
        </div>

        <div class="pr-help-section">
          <h4>📖 Read Tracking</h4>
          <ul>
            <li>Scrolled past → marked read (grey) · Refresh shows unread only</li>
            <li>Click timestamp for permalink</li>
          </ul>
        </div>

        <div class="pr-help-section">
          <h4>↔️ Layout · AI: <strong>g</strong> / <strong>⇧G</strong></h4>
          <ul>
            <li><strong>g</strong>: Thread to AI · <strong>⇧G</strong>: + Descendants</li>
            <li>Drag edges to resize · Width saved across sessions</li>
          </ul>
        </div>

        <h4>🤖 AI Studio Settings</h4>
        <div class="pr-settings-group">
          <label for="pr-ai-prefix-input"><strong>AI Studio Prompt Prefix:</strong></label>
          <p style="font-size: 0.8em; color: #888; margin-top: 5px;">This text is sent to AI Studio before the thread content. Leave blank to use the default.</p>
          <textarea id="pr-ai-prefix-input" class="pr-setting-textarea" rows="4" style="width: 100%; margin-top: 10px; font-family: monospace; font-size: 0.9em; padding: 5px; border: 1px solid #ccc; border-radius: 4px;"></textarea>
          <div style="margin-top: 5px;">
            <button id="pr-save-ai-prefix-btn" class="pr-debug-btn">Save Prefix</button>
            <button id="pr-reset-ai-prefix-btn" class="pr-debug-btn">Reset to Default</button>
          </div>
        </div>

        <h4>🛠 Debug</h4>
        <p>
          <button id="pr-export-state-btn" class="pr-debug-btn">Export State (Clipboard)</button>
          <button id="pr-reset-state-btn" class="pr-debug-btn">Reset State</button>
        </p>
      </div>
    </details>
  `;
  };
  const renderUI = (state2) => {
    const root = document.getElementById("power-reader-root");
    if (!root) return;
    const { groups: postGroups, unreadItemCount, stats } = buildPostGroups(
      state2.comments,
      state2.posts,
      state2
    );
    const helpCollapsed = GM_getValue("helpCollapsed", false);
    const showHelp = !helpCollapsed;
    const loadFrom = getLoadFrom();
    const startDate = loadFrom && loadFrom !== "__LOAD_RECENT__" ? formatStatusDate(loadFrom) : "?";
    const endDate = state2.initialBatchNewestDate ? formatStatusDate(state2.initialBatchNewestDate) : "now";
    const userLabel = state2.currentUsername ? `👤 ${state2.currentUsername}` : "👤 not logged in";
    let html2 = `
    <div class="pr-header">
      <h1>Less Wrong: Power Reader <small style="font-size: 0.6em; color: #888;">v${"1.2.682"}</small></h1>
      <div class="pr-status">
        📆 ${startDate} → ${endDate}
        · 🔴 <span id="pr-unread-count">${unreadItemCount}</span> unread
        · 💬 ${stats.totalComments} comments (${stats.unreadComments} new · ${stats.contextComments} context · ${stats.hiddenComments} hidden)
        · 📄 ${stats.visiblePosts} posts${stats.hiddenPosts > 0 ? ` (${stats.hiddenPosts} filtered)` : ""}
        · ${userLabel}
      </div>
    </div>
    ${renderHelpSection(showHelp)}
  `;
    if (state2.moreCommentsAvailable) {
      html2 += `
      <div class="pr-warning">
        There are more comments available. Please reload after reading current comments to continue.
      </div>
    `;
    }
    if (postGroups.size === 0) {
      html2 += `
      <div class="pr-info">
        No content found. 
        <div style="margin-top: 10px;">
          <button id="pr-check-now-btn" class="pr-btn">Check Server Again</button>
          <button id="pr-change-date-btn" class="pr-btn">Change Starting Date</button>
        </div>
        <p style="font-size: 0.8em; margin-top: 15px;">
          Alternatively, you can <a href="/reader/reset">Reset all storage</a> to start fresh.
        </p>
      </div>
    `;
    }
    postGroups.forEach((group) => {
      html2 += renderPostGroup(group, state2);
    });
    html2 += `
    <div class="pr-footer-space" style="height: 100px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 20px;">
      <div id="pr-bottom-message" class="pr-bottom-message" style="display: none;"></div>
    </div>
  `;
    root.innerHTML = html2;
    if (!document.querySelector(".pr-sticky-ai-status")) {
      const stickyStatus = document.createElement("div");
      stickyStatus.className = "pr-sticky-ai-status";
      stickyStatus.id = "pr-sticky-ai-status";
      document.body.appendChild(stickyStatus);
    }
    if (!document.querySelector(".pr-resize-handle")) {
      initResizeHandles();
    }
    initPreviewSystem();
    setupHelpToggle();
    setupDebugButtons();
    setupAISettings();
    setupScrollTracking(() => state2.comments, () => state2.posts, () => state2.initialBatchNewestDate);
    setupLinkPreviews(state2.comments);
    window.setupLinkPreviews = setupLinkPreviews;
    window.renderUI = renderUI;
    setupStickyHeader();
    const sticky = getStickyHeader();
    if (sticky) sticky.refresh();
    setupInlineReactions(state2);
    setupExternalLinks();
    refreshPostActionButtons();
    window.getState = () => state2;
    window.manualPreview = manualPreview;
    Logger.info("UI Rendered");
  };
  const setupHelpToggle = () => {
    const helpSection = document.getElementById("pr-help-section");
    const helpSummary = helpSection?.querySelector("summary");
    if (helpSection && helpSummary) {
      helpSummary.addEventListener("click", () => {
        const willBeOpen = !helpSection.open;
        Logger.debug(`Help will be open: ${willBeOpen}`);
        GM_setValue("helpCollapsed", !willBeOpen);
      });
    }
  };
  const setupDebugButtons = () => {
    const exportBtn = document.getElementById("pr-export-state-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        exportState();
      });
    }
    const resetBtn = document.getElementById("pr-reset-state-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm("Are you sure you want to reset all state (read status, author preferences)? This will reload the page.")) {
          clearAllStorage();
          window.location.href = "/reader";
        }
      });
    }
    const checkBtn = document.getElementById("pr-check-now-btn");
    if (checkBtn) {
      checkBtn.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.reload();
      });
    }
    const changeBtn = document.getElementById("pr-change-date-btn");
    if (changeBtn) {
      changeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        GM_setValue("power-reader-read-from", null);
        window.location.reload();
      });
    }
  };
  const setupAISettings = () => {
    const saveBtn = document.getElementById("pr-save-ai-prefix-btn");
    const resetBtn = document.getElementById("pr-reset-ai-prefix-btn");
    const input = document.getElementById("pr-ai-prefix-input");
    if (input) {
      input.value = getAIStudioPrefix() || AI_STUDIO_PROMPT_PREFIX;
    }
    if (saveBtn && input) {
      saveBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const val = input.value.trim();
        setAIStudioPrefix(val);
        alert("AI Studio prompt prefix saved!");
      });
    }
    if (resetBtn && input) {
      resetBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (confirm("Reset to default prompt?")) {
          setAIStudioPrefix("");
          input.value = AI_STUDIO_PROMPT_PREFIX;
          alert("Reset to default!");
        }
      });
    }
  };
  const showSetupUI = (onStart) => {
    const root = document.getElementById("power-reader-root");
    if (!root) return;
    root.innerHTML = `
    <div class="pr-header">
      <h1>Welcome to Power Reader! <small style="font-size: 0.6em; color: #888;">v${"1.2.682"}</small></h1>
    </div>
    <div class="pr-setup">
      <p>Select a starting date to load comments from, or leave blank to load the most recent ${CONFIG.loadMax} comments.</p>
      <div class="pr-setup-form">
        <label for="loadFromDate">Load comments after:</label>
        <input type="date" id="loadFromDate" />
      </div>
      <button id="startReading" class="pr-btn">Start Reading</button>
    </div>
  `;
    const startBtn = document.getElementById("startReading");
    const dateInput = document.getElementById("loadFromDate");
    startBtn?.addEventListener("click", async () => {
      const dateValue = dateInput?.value;
      if (dateValue) {
        const date = new Date(dateValue + "T00:00:00");
        await onStart(date.toISOString());
      } else {
        await onStart(null);
      }
    });
  };
  const LOGIN_URL = `${window.location.origin}/auth/auth0`;
  const openLoginPage = () => {
    const opened = window.open(LOGIN_URL, "_blank", "noopener,noreferrer");
    if (opened) opened.opener = null;
  };
  async function castKarmaVote(documentId, voteType, isLoggedIn, currentAgreement = null, documentType = "comment") {
    Logger.debug(`castKarmaVote: documentId=${documentId}, type=${documentType}, isLoggedIn=${isLoggedIn}`);
    if (!isLoggedIn) {
      Logger.info("Not logged in, opening auth page");
      openLoginPage();
      return null;
    }
    try {
      if (documentType === "post") {
        const response2 = await queryGraphQL(VOTE_POST_MUTATION, {
          documentId,
          voteType,
          extendedVote: currentAgreement
        });
        return response2;
      }
      const response = await queryGraphQL(VOTE_COMMENT_MUTATION, {
        documentId,
        voteType,
        extendedVote: currentAgreement
      });
      return response;
    } catch (e) {
      Logger.error("Vote failed:", e);
      return null;
    }
  }
  async function castAgreementVote(documentId, voteType, isLoggedIn, currentKarma = "neutral", documentType = "comment") {
    if (!isLoggedIn) {
      openLoginPage();
      return null;
    }
    const agreementValue = voteType === "agree" ? "smallUpvote" : voteType === "disagree" ? "smallDownvote" : "neutral";
    try {
      if (documentType === "post") {
        const response2 = await queryGraphQL(VOTE_POST_MUTATION, {
          documentId,
          voteType: currentKarma || "neutral",
          extendedVote: { agreement: agreementValue }
        });
        return response2;
      }
      const response = await queryGraphQL(VOTE_COMMENT_MUTATION, {
        documentId,
        voteType: currentKarma || "neutral",
        extendedVote: { agreement: agreementValue }
      });
      return response;
    } catch (e) {
      Logger.error("Agreement vote failed:", e);
      return null;
    }
  }
  async function castReactionVote(commentId, reactionName, isLoggedIn, currentKarma = "neutral", currentExtendedVote = {}, quote = null) {
    if (!isLoggedIn) {
      openLoginPage();
      return null;
    }
    const existingReacts = currentExtendedVote?.reacts || [];
    const newReacts = JSON.parse(JSON.stringify(existingReacts));
    const existingReactionIndex = newReacts.findIndex((r) => r.react === reactionName);
    if (existingReactionIndex >= 0) {
      const reaction = newReacts[existingReactionIndex];
      if (quote) {
        const quotes = reaction.quotes || [];
        if (quotes.includes(quote)) {
          reaction.quotes = quotes.filter((q) => q !== quote);
          if (reaction.quotes.length === 0) {
            newReacts.splice(existingReactionIndex, 1);
          }
        } else {
          reaction.quotes = [...quotes, quote];
        }
      } else {
        newReacts.splice(existingReactionIndex, 1);
      }
    } else {
      const newReaction = {
        react: reactionName,
        vote: "created"
};
      if (quote) {
        newReaction.quotes = [quote];
      }
      newReacts.push(newReaction);
    }
    const extendedVotePayload = {
      agreement: currentExtendedVote?.agreement,
      reacts: newReacts
    };
    try {
      const response = await queryGraphQL(VOTE_COMMENT_MUTATION, {
        documentId: commentId,
        voteType: currentKarma || "neutral",
extendedVote: extendedVotePayload
      });
      return response;
    } catch (e) {
      Logger.error("Reaction vote failed:", e);
      return null;
    }
  }
  function calculateNextVoteState(currentVote, direction, isHold) {
    const isUp = direction === "up" || direction === "agree";
    const small = isUp ? direction === "agree" ? "agree" : "smallUpvote" : direction === "disagree" ? "disagree" : "smallDownvote";
    const big = isUp ? "bigUpvote" : "bigDownvote";
    const neutral = "neutral";
    const currentIsBig = currentVote === big;
    const currentIsSmall = currentVote === small || direction === "agree" && currentVote === "smallUpvote" || direction === "disagree" && currentVote === "smallDownvote";
    if (isHold) {
      if (currentIsBig) return neutral;
      return big;
    } else {
      if (currentIsBig) return small;
      if (currentIsSmall) return neutral;
      return small;
    }
  }
  function updateVoteUI(documentId, response) {
    const isPostVote = !!response.performVotePost?.document;
    const targets = isPostVote ? Array.from(document.querySelectorAll(`.pr-post-header[data-post-id="${documentId}"]`)) : Array.from(document.querySelectorAll(`.pr-comment[data-id="${documentId}"]`));
    const doc = response.performVoteComment?.document ?? response.performVotePost?.document;
    if (!doc || targets.length === 0) return;
    targets.forEach((target) => {
      const scoreEl = target.querySelector(".pr-karma-score");
      if (scoreEl) {
        scoreEl.textContent = String(doc.baseScore);
      }
      const agreeScoreEl = target.querySelector(".pr-agreement-score");
      if (agreeScoreEl && doc.afExtendedScore?.agreement !== void 0) {
        agreeScoreEl.textContent = String(doc.afExtendedScore.agreement);
      }
      const upBtn = target.querySelector('[data-action="karma-up"]');
      const downBtn = target.querySelector('[data-action="karma-down"]');
      const vote = doc.currentUserVote;
      upBtn?.classList.toggle("active-up", vote === "smallUpvote" || vote === "bigUpvote");
      upBtn?.classList.toggle("strong-vote", vote === "bigUpvote");
      downBtn?.classList.toggle("active-down", vote === "smallDownvote" || vote === "bigDownvote");
      downBtn?.classList.toggle("strong-vote", vote === "bigDownvote");
      const agreeBtn = target.querySelector('[data-action="agree"]');
      const disagreeBtn = target.querySelector('[data-action="disagree"]');
      const extVote = doc.currentUserExtendedVote;
      const agreeState = extVote?.agreement;
      agreeBtn?.classList.toggle("agree-active", agreeState === "smallUpvote" || agreeState === "bigUpvote" || agreeState === "agree");
      agreeBtn?.classList.toggle("strong-vote", agreeState === "bigUpvote");
      disagreeBtn?.classList.toggle("disagree-active", agreeState === "smallDownvote" || agreeState === "bigDownvote" || agreeState === "disagree");
      disagreeBtn?.classList.toggle("strong-vote", agreeState === "bigDownvote");
    });
  }
  const ACTION_TO_VOTE = {
    "karma-up": { kind: "karma", dir: "up" },
    "karma-down": { kind: "karma", dir: "down" },
    "agree": { kind: "agreement", dir: "up" },
    "disagree": { kind: "agreement", dir: "down" }
  };
  const handleVoteInteraction = (target, action, state2) => {
    const config = ACTION_TO_VOTE[action];
    if (!config) return;
    const documentId = target.dataset.id;
    if (!documentId) return;
    const comment = state2.commentById.get(documentId);
    const post = state2.postById.get(documentId);
    const targetDoc = comment ?? post;
    if (!targetDoc) return;
    const currentVote = config.kind === "karma" ? targetDoc.currentUserVote || "neutral" : targetDoc.currentUserExtendedVote?.agreement || "neutral";
    const direction = config.kind === "karma" ? config.dir : config.dir === "up" ? "agree" : "disagree";
    const currentVoteStr = String(currentVote ?? "neutral");
    const clickTargetState = calculateNextVoteState(currentVoteStr, direction, false);
    const holdTargetState = calculateNextVoteState(currentVoteStr, direction, true);
    applyOptimisticVoteUI(target, currentVoteStr, config.dir);
    let committed = false;
    const cleanup = () => {
      target.removeEventListener("mouseup", mouseUpHandler);
      target.removeEventListener("mouseleave", mouseLeaveHandler);
    };
    const timer = window.setTimeout(async () => {
      committed = true;
      cleanup();
      if (holdTargetState.startsWith("big")) {
        target.classList.add("strong-vote");
      } else if (holdTargetState === "neutral") {
        clearVoteClasses(target);
      }
      const res = await executeVote(documentId, holdTargetState, config.kind, state2, targetDoc);
      if (res) {
        syncVoteToState(state2, documentId, res);
      }
    }, 500);
    const mouseUpHandler = async () => {
      if (committed) return;
      clearTimeout(timer);
      cleanup();
      clearVoteClasses(target);
      const res = await executeVote(documentId, clickTargetState, config.kind, state2, targetDoc);
      if (res) {
        syncVoteToState(state2, documentId, res);
      }
    };
    const mouseLeaveHandler = () => {
      if (committed) return;
      clearTimeout(timer);
      cleanup();
      clearVoteClasses(target);
    };
    target.addEventListener("mouseup", mouseUpHandler);
    target.addEventListener("mouseleave", mouseLeaveHandler);
  };
  const applyOptimisticVoteUI = (target, currentVote, dir) => {
    if (currentVote?.startsWith("big")) {
      target.classList.remove("strong-vote");
    } else {
      if (dir === "up") {
        target.classList.add("active-up");
        target.classList.add("agree-active");
      } else {
        target.classList.add("active-down");
        target.classList.add("disagree-active");
      }
    }
  };
  const clearVoteClasses = (target) => {
    target.classList.remove("active-up", "active-down", "agree-active", "disagree-active", "strong-vote");
  };
  const executeVote = async (documentId, targetState, kind, state2, document2) => {
    const isLoggedIn = !!state2.currentUserId;
    const documentType = state2.commentById.has(documentId) ? "comment" : "post";
    Logger.debug(`executeVote: type=${documentType}, kind=${kind}, targetState=${targetState}, id=${documentId}`);
    if (kind === "karma") {
      return castKarmaVote(
        documentId,
        targetState,
        isLoggedIn,
        document2.currentUserExtendedVote,
        documentType
      );
    } else {
      return castAgreementVote(
        documentId,
        targetState,
        isLoggedIn,
        document2.currentUserVote,
        documentType
      );
    }
  };
  const syncVoteToState = (state2, documentId, response) => {
    const comment = state2.commentById.get(documentId);
    const post = state2.postById.get(documentId);
    const doc = response.performVoteComment?.document ?? response.performVotePost?.document;
    if (doc) {
      if (comment) {
        syncCommentInState(state2, documentId, {
          baseScore: doc.baseScore ?? 0,
          voteCount: doc.voteCount ?? 0,
          currentUserVote: doc.currentUserVote,
          extendedScore: doc.extendedScore,
          afExtendedScore: doc.afExtendedScore,
          currentUserExtendedVote: doc.currentUserExtendedVote
        });
      }
      if (post) {
        syncPostInState(state2, documentId, {
          baseScore: doc.baseScore ?? 0,
          voteCount: doc.voteCount ?? 0,
          currentUserVote: doc.currentUserVote,
          extendedScore: doc.extendedScore,
          afExtendedScore: doc.afExtendedScore,
          currentUserExtendedVote: doc.currentUserExtendedVote
        });
      }
      updateVoteUI(documentId, response);
      refreshReactions(documentId, state2);
      refreshCommentBody(documentId, state2);
    }
  };
  const refreshCommentBody = (commentId, state2) => {
    const comment = state2.commentById.get(commentId);
    if (!comment) return;
    const el = document.querySelector(`.pr-comment[data-id="${commentId}"]`);
    if (!el) return;
    const bodyEl = el.querySelector(".pr-comment-body");
    if (bodyEl && comment.htmlBody) {
      bodyEl.innerHTML = highlightQuotes(
        comment.htmlBody,
        comment.extendedScore
      );
    }
  };
  const refreshReactions = (commentId, state2) => {
    const comment = state2.commentById.get(commentId);
    if (!comment) return;
    const el = document.querySelector(`.pr-comment[data-id="${commentId}"]`);
    if (!el) return;
    const container = el.querySelector(".pr-reactions-container");
    if (container) {
      container.innerHTML = renderReactions(
        comment._id,
        comment.extendedScore,
        comment.currentUserExtendedVote
      );
    }
  };
  class ReactionPicker {
    commentsGetter;
    currentUserPaletteStyle;
    currentSelection = null;
    activeTriggerButton = null;
    syncCallback;
    currentUserId;
currentCommentId = null;
    currentSearch = "";
    viewMode = "grid";
    tooltipElement = null;
    constructor(commentsGetter, paletteStyle, syncCallback, currentUserId) {
      this.commentsGetter = commentsGetter;
      this.currentUserPaletteStyle = paletteStyle;
      this.syncCallback = syncCallback;
      this.currentUserId = currentUserId;
    }
    setSelection(selection) {
      this.currentSelection = selection;
    }
    open(button, initialSearchText = "") {
      const commentId = button.dataset.id;
      if (!commentId) return;
      const existing = document.getElementById("pr-global-reaction-picker");
      if (existing && this.activeTriggerButton === button) {
        existing.remove();
        this.activeTriggerButton = null;
        return;
      }
      if (existing) existing.remove();
      this.activeTriggerButton = button;
      this.currentCommentId = commentId;
      this.currentSearch = initialSearchText;
      this.viewMode = GM_getValue("pickerViewMode", this.currentUserPaletteStyle || "grid");
      const picker = document.createElement("div");
      picker.id = "pr-global-reaction-picker";
      picker.className = "pr-reaction-picker";
      const root = document.getElementById("power-reader-root");
      if (root) {
        root.appendChild(picker);
      } else {
        document.body.appendChild(picker);
      }
      this._render();
      this._setupPickerInteractions(picker, button);
    }
    escapeHtml(unsafe) {
      return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    _render() {
      const picker = document.getElementById("pr-global-reaction-picker");
      if (!picker || !this.currentCommentId) return;
      const comment = this.commentsGetter().find((c) => c._id === this.currentCommentId);
      const userVotes = comment?.currentUserExtendedVote?.reacts || [];
      const allReactions = getReactions();
      const getReactionsFromList = (names) => {
        if (!names) return [];
        return names.map((name) => allReactions.find((r) => r.name === name)).filter((r) => r && !r.deprecated);
      };
      const renderSectionTitle = (title) => `<div class="pr-picker-section-title">${title}</div>`;
      const renderPickerItem = (reaction, mode) => {
        const voted = userVotes.some((v) => v.react === reaction.name);
        const filter = reaction.filter || DEFAULT_FILTER;
        const imgStyle = `
          filter: opacity(${filter.opacity ?? 1}) saturate(${filter.saturate ?? 1});
          transform: scale(${filter.scale ?? 1}) translate(${filter.translateX ?? 0}px, ${filter.translateY ?? 0}px);
      `;
        const labelAttr = `data-tooltip-label="${this.escapeHtml(reaction.label)}"`;
        const descAttr = `data-tooltip-description="${this.escapeHtml(reaction.description || "")}"`;
        if (mode === "list") {
          return `
            <div class="pr-reaction-list-item ${voted ? "active" : ""}" 
                 data-action="reaction-vote" 
                 data-id="${this.currentCommentId}" 
                 data-reaction-name="${reaction.name}"
                 ${labelAttr} ${descAttr}>
              <img src="${reaction.svg}" alt="${reaction.name}" style="${imgStyle}">
              <span class="${reaction.name === "addc" ? "small" : ""}">${this.escapeHtml(reaction.label).replace(/\\n/g, "<br/>")}</span>
            </div>
          `;
        }
        return `
        <div class="pr-reaction-picker-item ${voted ? "active" : ""}" 
             data-action="reaction-vote" 
             data-id="${this.currentCommentId}" 
             data-reaction-name="${reaction.name}"
             ${labelAttr} ${descAttr}>
          <img src="${reaction.svg}" alt="${reaction.name}" style="${imgStyle}">
        </div>
      `;
      };
      const normalizedSearch = this.currentSearch.toLowerCase();
      const filtered = allReactions.filter((r) => {
        if (!this.currentSearch) return !r.deprecated;
        return r.name.toLowerCase().includes(normalizedSearch) || r.label.toLowerCase().includes(normalizedSearch) || r.searchTerms?.some((t) => t.toLowerCase().includes(normalizedSearch));
      });
      const renderGridSection = (list) => {
        if (!list) return "";
        return getReactionsFromList(list).map((r) => renderPickerItem(r, "grid")).join("");
      };
      const header = `
            <div class="pr-picker-search">
               <span class="pr-picker-view-toggle" title="Switch View">${this.viewMode === "list" ? "▦" : "≣"}</span>
               <input type="text" placeholder="Search reactions..." value="${this.escapeHtml(this.currentSearch)}" id="pr-reaction-search-input">
            </div>
        `;
      let body = "";
      if (this.currentSearch) {
        body += `<div class="pr-reaction-picker-grid">`;
        filtered.forEach((r) => body += renderPickerItem(r, "grid"));
        body += `</div>`;
        if (filtered.length === 0) {
          body += `<div style="padding:10px; text-align:center; color:#888">No matching reactions</div>`;
        }
      } else {
        if (this.viewMode === "list") {
          body += `<div class="pr-reaction-picker-grid">`;
          body += renderGridSection(SECTION_DEFINITIONS.listPrimary);
          body += `</div>`;
          const sections = [
            { title: "Analysis & Agreement", list: SECTION_DEFINITIONS.listViewSectionB },
            { title: "Feedback & Meta", list: SECTION_DEFINITIONS.listViewSectionC }
          ];
          sections.forEach((s) => {
            if (s.list && s.list.length > 0) {
              body += renderSectionTitle(s.title);
              body += `<div class="pr-reaction-picker-list">`;
              body += getReactionsFromList(s.list).map((r) => renderPickerItem(r, "list")).join("");
              body += `</div>`;
            }
          });
          body += renderSectionTitle("Likelihoods");
          body += `<div class="pr-reaction-picker-grid">`;
          body += renderGridSection(SECTION_DEFINITIONS.likelihoods);
          body += `</div>`;
        } else {
          body += `<div class="pr-reaction-picker-grid">`;
          body += renderGridSection(SECTION_DEFINITIONS.gridPrimary);
          if (SECTION_DEFINITIONS.gridSectionB) {
            body += `<div class="pr-picker-grid-separator"></div>`;
            body += renderGridSection(SECTION_DEFINITIONS.gridSectionB);
          }
          if (SECTION_DEFINITIONS.gridSectionC) {
            body += `<div class="pr-picker-grid-separator"></div>`;
            body += renderGridSection(SECTION_DEFINITIONS.gridSectionC);
          }
          body += `<div class="pr-picker-grid-separator"></div>`;
          body += renderGridSection(SECTION_DEFINITIONS.likelihoods);
          body += `</div>`;
        }
      }
      const oldContainer = picker.querySelector(".pr-picker-scroll-container");
      const scrollPos = oldContainer ? oldContainer.scrollTop : 0;
      const searchInput = picker.querySelector("input");
      const selStart = searchInput?.selectionStart;
      const selEnd = searchInput?.selectionEnd;
      picker.innerHTML = `
            <div class="pr-picker-header">${header}</div>
            <div class="pr-picker-scroll-container">${body}</div>
        `;
      const newContainer = picker.querySelector(".pr-picker-scroll-container");
      if (newContainer) newContainer.scrollTop = scrollPos;
      const newInput = picker.querySelector("input");
      if (newInput) {
        newInput.focus();
        newInput.addEventListener("input", (e) => {
          this.currentSearch = e.target.value;
          this._render();
        });
        if (typeof selStart === "number") newInput.setSelectionRange(selStart, selEnd || selStart);
      }
      const toggle = picker.querySelector(".pr-picker-view-toggle");
      if (toggle) {
        toggle.addEventListener("click", (e) => {
          e.stopPropagation();
          this.viewMode = this.viewMode === "list" ? "grid" : "list";
          GM_setValue("pickerViewMode", this.viewMode);
          this._render();
        });
      }
    }
    _setupPickerInteractions(picker, button) {
      picker.addEventListener("mouseover", (e) => {
        const target = e.target.closest("[data-tooltip-label]");
        if (target) {
          this._showTooltip(target);
        }
      });
      picker.addEventListener("mouseout", (e) => {
        const target = e.target.closest("[data-tooltip-label]");
        if (target) {
          this._hideTooltip();
        }
      });
      picker.addEventListener("click", (e) => {
        e.stopPropagation();
        const target = e.target.closest('[data-action="reaction-vote"]');
        if (target) {
          const commentId = target.dataset.id;
          const reactionName = target.dataset.reactionName;
          if (commentId && reactionName) {
            Logger.info(`Picker: Clicked reaction ${reactionName} on comment ${commentId}`);
            this.handleReactionVote(commentId, reactionName);
          }
        }
      });
      picker.addEventListener("mousedown", (e) => e.stopPropagation());
      const rect = button.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      picker.style.visibility = "hidden";
      picker.style.display = "flex";
      const pickerHeight = picker.offsetHeight;
      const pickerWidth = picker.offsetWidth;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const margin = 10;
      const buttonTopDoc = rect.top + scrollY;
      const buttonBottomDoc = rect.bottom + scrollY;
      const buttonLeftDoc = rect.left + scrollX;
      const buttonRightDoc = rect.right + scrollX;
      let top = buttonBottomDoc + 5;
      let left = buttonLeftDoc;
      const pickerBottomViewport = rect.bottom + 5 + pickerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (pickerBottomViewport > viewportHeight - margin && spaceAbove > spaceBelow) {
        top = buttonTopDoc - pickerHeight - 5;
      }
      const minTop = scrollY + margin;
      const maxTop = scrollY + viewportHeight - pickerHeight - margin;
      top = Math.max(minTop, Math.min(top, maxTop));
      const pickerBottom = top + pickerHeight;
      const overlapsVertically = !(pickerBottom <= buttonTopDoc || top >= buttonBottomDoc);
      if (overlapsVertically) {
        const spaceOnRight = viewportWidth - rect.right;
        if (spaceOnRight >= pickerWidth + margin) {
          left = buttonRightDoc + 5;
        } else {
          const spaceOnLeft = rect.left;
          if (spaceOnLeft >= pickerWidth + margin) {
            left = buttonLeftDoc - pickerWidth - 5;
          }
        }
      }
      const pickerRightViewport = left - scrollX + pickerWidth;
      if (pickerRightViewport > viewportWidth - margin) {
        left = scrollX + viewportWidth - pickerWidth - margin;
      }
      left = Math.max(scrollX + margin, left);
      picker.style.top = `${top}px`;
      picker.style.left = `${left}px`;
      picker.style.visibility = "visible";
      picker.classList.add("visible");
      const input = picker.querySelector("input");
      if (input) input.focus();
      const closeHandler = (e) => {
        if (!button.contains(e.target)) {
          picker?.classList.remove("visible");
          if (picker) {
            picker.style.display = "none";
            picker.style.visibility = "hidden";
          }
          this._hideTooltip();
          document.removeEventListener("mousedown", closeHandler);
          this.currentSelection = null;
          this.activeTriggerButton = null;
          this.currentCommentId = null;
        }
      };
      setTimeout(() => {
        document.addEventListener("mousedown", closeHandler);
      }, 50);
    }
    _showTooltip(target) {
      if (!this.tooltipElement) {
        this.tooltipElement = document.createElement("div");
        this.tooltipElement.className = "pr-tooltip-global";
        document.body.appendChild(this.tooltipElement);
      }
      const label = target.dataset.tooltipLabel || "";
      const description = target.dataset.tooltipDescription || "";
      const cleanLabel = this.escapeHtml(label).replace(/\\n/g, "<br/>");
      const cleanDescription = this.escapeHtml(description).replace(/\\n/g, "<br/>");
      this.tooltipElement.innerHTML = `
            <strong>${cleanLabel}</strong>
            ${cleanDescription}
        `;
      this.tooltipElement.style.visibility = "hidden";
      this.tooltipElement.style.display = "block";
      this.tooltipElement.style.opacity = "0";
      const rect = target.getBoundingClientRect();
      const tooltipHeight = this.tooltipElement.offsetHeight;
      const tooltipWidth = this.tooltipElement.offsetWidth;
      let top = rect.top - tooltipHeight - 8;
      let left = rect.left + rect.width / 2 - tooltipWidth / 2;
      const margin = 10;
      const viewportWidth = window.innerWidth;
      if (left < margin) {
        left = margin;
      } else if (left + tooltipWidth > viewportWidth - margin) {
        left = viewportWidth - tooltipWidth - margin;
      }
      if (top < margin) {
        top = rect.bottom + 8;
      }
      this.tooltipElement.style.top = `${top}px`;
      this.tooltipElement.style.left = `${left}px`;
      this.tooltipElement.style.visibility = "visible";
      this.tooltipElement.style.opacity = "1";
    }
    _hideTooltip() {
      if (this.tooltipElement) {
        this.tooltipElement.style.visibility = "hidden";
        this.tooltipElement.style.opacity = "0";
      }
    }
    async handleReactionVote(commentId, reactionName) {
      Logger.info(`Handling reaction vote: ${reactionName} for ${commentId}`);
      const comment = this.commentsGetter().find((c) => c._id === commentId);
      if (!comment) return;
      let quote = null;
      if (this.currentSelection && this.currentSelection.range.commonAncestorContainer.parentElement?.closest(`[data-id="${commentId}"]`)) {
        quote = this.currentSelection.text;
      }
      const res = await castReactionVote(
        commentId,
        reactionName,
        !!this.currentUserId,
        comment.currentUserVote,
        comment.currentUserExtendedVote,
        quote
      );
      if (res) {
        updateVoteUI(commentId, res);
        this.syncCallback(commentId, res);
        window.getSelection()?.removeAllRanges();
        this.currentSelection = null;
        document.getElementById("pr-inline-react-btn")?.remove();
        this._render();
      }
    }
  }
  let reactionPicker = null;
  const initReactionPicker = (state2) => {
    reactionPicker = new ReactionPicker(
      () => state2.comments,
      state2.currentUserPaletteStyle,
      (commentId, response) => syncVoteToState(state2, commentId, response),
      state2.currentUserId
    );
  };
  const openReactionPicker = (button, state2, initialSearchText = "") => {
    if (!reactionPicker) initReactionPicker(state2);
    reactionPicker?.setSelection(state2.currentSelection);
    reactionPicker?.open(button, initialSearchText);
  };
  const handleReactionVote = async (commentId, reactionName, state2) => {
    Logger.info(`Handling reaction vote: ${reactionName} for ${commentId}`);
    const comment = state2.commentById.get(commentId);
    if (!comment) return;
    let quote = null;
    if (state2.currentSelection) {
      const container = state2.currentSelection.range.commonAncestorContainer;
      const parentEl = container.nodeType === 3 ? container.parentElement : container;
      if (parentEl?.closest(`[data-id="${commentId}"]`)) {
        quote = state2.currentSelection.text;
      }
    }
    const res = await castReactionVote(
      commentId,
      reactionName,
      !!state2.currentUserId,
      comment.currentUserVote,
      comment.currentUserExtendedVote,
      quote
    );
    if (res) {
      updateVoteUI(commentId, res);
      syncVoteToState(state2, commentId, res);
      window.getSelection()?.removeAllRanges();
      state2.currentSelection = null;
      document.getElementById("pr-inline-react-btn")?.remove();
      const picker = document.getElementById("pr-global-reaction-picker");
      if (picker) {
        picker.classList.remove("visible");
        setTimeout(() => picker.remove(), 300);
      }
    }
  };
  const attachHotkeyListeners = (state2, abortSignal) => {
    document.addEventListener("keydown", (e) => {
      const target = e.target;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable) {
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }
      const key = e.key.toLowerCase();
      const actionMap = {
        "a": "load-all-comments",
        "c": "scroll-to-comments",
        "n": "scroll-to-next-post",
        "r": "load-descendants",
        "t": "load-parents-and-scroll",
        "^": "find-parent",
        "-": "collapse",
        "+": "expand",
        "=": "expand",
"e": "toggle-post-body",
        "g": "send-to-ai-studio"
      };
      let action = actionMap[key];
      if (key === "+" || key === "=") {
        const elementUnderMouse2 = document.elementFromPoint(state2.lastMousePos.x, state2.lastMousePos.y);
        const comment = elementUnderMouse2?.closest(".pr-comment");
        if (comment) action = "expand";
      } else if (key === "-") {
        const elementUnderMouse2 = document.elementFromPoint(state2.lastMousePos.x, state2.lastMousePos.y);
        const comment = elementUnderMouse2?.closest(".pr-comment");
        if (comment) action = "collapse";
      }
      if (!action) return;
      const elementUnderMouse = document.elementFromPoint(state2.lastMousePos.x, state2.lastMousePos.y);
      if (!elementUnderMouse) return;
      const prItem = elementUnderMouse.closest(".pr-item");
      if (!prItem) return;
      let button = prItem.querySelector(`[data-action="${action}"]`);
      if (!button && prItem.classList.contains("pr-comment")) {
        if (action === "collapse" || action === "expand") {
          button = prItem.querySelector(`.pr-collapse, .pr-expand`);
        }
        if (!button) {
          const postId = prItem.dataset.postId;
          if (postId) {
            const postEl = document.querySelector(`.pr-post[data-id="${postId}"]`);
            if (postEl) {
              button = postEl.querySelector(`[data-action="${action}"]`);
            }
          }
        }
      }
      if (button) {
        if (button.classList.contains("disabled")) {
          Logger.debug(`Hotkey '${key}' triggered action '${action}' but button is disabled`);
          return;
        }
        Logger.info(`Hotkey '${key}' triggering action '${action}' on item ${prItem.dataset.id}`);
        e.preventDefault();
        e.stopPropagation();
        button.dispatchEvent(new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          shiftKey: e.shiftKey
        }));
        button.dispatchEvent(new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          shiftKey: e.shiftKey
        }));
        button.dispatchEvent(new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          shiftKey: e.shiftKey
        }));
      }
    }, { signal: abortSignal });
  };
  const collapsePost = (post) => {
    post.querySelector(".pr-post-comments")?.classList.add("collapsed");
    post.querySelector(".pr-post-body-container")?.classList.add("collapsed");
    post.querySelector(".pr-post-content")?.classList.add("collapsed");
    syncPostToggleButtons(post, true);
  };
  const expandPost = (post) => {
    post.querySelector(".pr-post-comments")?.classList.remove("collapsed");
    post.querySelector(".pr-post-body-container")?.classList.remove("collapsed");
    post.querySelector(".pr-post-content")?.classList.remove("collapsed");
    syncPostToggleButtons(post, false);
  };
  const syncPostToggleButtons = (post, isCollapsed) => {
    const postEl = post;
    const postId = postEl.getAttribute("data-post-id") || postEl.getAttribute("data-id");
    const headers = [];
    const mainHeader = postEl.querySelector(".pr-post-header");
    if (mainHeader) headers.push(mainHeader);
    if (postId) {
      const stickyHeader2 = document.querySelector(`.pr-sticky-header .pr-post-header[data-post-id="${postId}"]`);
      if (stickyHeader2) headers.push(stickyHeader2);
    }
    headers.forEach((header) => {
      const collapseBtn = header.querySelector('[data-action="collapse"]');
      const expandBtn = header.querySelector('[data-action="expand"]');
      if (collapseBtn) collapseBtn.style.display = isCollapsed ? "none" : "inline";
      if (expandBtn) expandBtn.style.display = isCollapsed ? "inline" : "none";
    });
  };
  const getPostIdFromTarget = (target) => {
    const post = target.closest(".pr-post");
    if (post) return post.dataset.postId || post.dataset.id || null;
    const header = target.closest(".pr-post-header");
    return header?.getAttribute("data-post-id") || null;
  };
  const getCommentIdFromTarget = (target) => {
    const comment = target.closest(".pr-comment");
    return comment?.getAttribute("data-id") || null;
  };
  const handlePostCollapse = (target) => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;
    const post = document.querySelector(`.pr-post[data-id="${postId}"]`);
    if (!post) return;
    const isFromSticky = !!target.closest(".pr-sticky-header");
    const postHeader = post.querySelector(".pr-post-header");
    collapsePost(post);
    if (isFromSticky && postHeader) {
      smartScrollTo(postHeader, true);
    }
  };
  const handlePostExpand = (target) => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;
    const post = document.querySelector(`.pr-post[data-id="${postId}"]`);
    if (!post) return;
    const isFromSticky = !!target.closest(".pr-sticky-header");
    expandPost(post);
    if (isFromSticky) {
      const postHeader = post.querySelector(".pr-post-header");
      if (postHeader) {
        smartScrollTo(postHeader, true);
      }
    }
  };
  const handleCommentCollapse = (target) => {
    const comment = target.closest(".pr-comment");
    comment?.classList.add("collapsed");
  };
  const handleCommentExpand = (target) => {
    const comment = target.closest(".pr-comment");
    comment?.classList.remove("collapsed");
  };
  const handleCommentCollapseToggle = (replies) => {
    const comment = replies.closest(".pr-comment");
    if (comment) {
      if (comment.classList.contains("collapsed")) {
        comment.classList.remove("collapsed");
      } else {
        comment.classList.add("collapsed");
      }
    }
  };
  const handleReadMore = (target) => {
    const container = target.closest(".pr-post-body-container");
    if (container) {
      container.classList.remove("truncated");
      container.style.maxHeight = "none";
      const overlay = container.querySelector(".pr-read-more-overlay");
      if (overlay) overlay.style.display = "none";
      const btn = container.querySelector(".pr-post-read-more");
      if (btn) btn.style.display = "none";
      const postEl = container.closest(".pr-post");
      if (postEl) {
        const postId = postEl.dataset.id;
        if (postId) refreshPostActionButtons(postId);
      }
    }
  };
  const handleScrollToComments = (target) => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;
    const postEl = document.querySelector(`.pr-post[data-id="${postId}"]`);
    if (!postEl) return;
    const firstComment = postEl.querySelector(".pr-comment");
    if (firstComment) smartScrollTo(firstComment, false);
  };
  const handleScrollToNextPost = (target) => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;
    const currentPost = document.querySelector(`.pr-post[data-id="${postId}"]`);
    if (!currentPost) return;
    const nextPost = currentPost.nextElementSibling;
    if (nextPost && nextPost.classList.contains("pr-post")) {
      const header = nextPost.querySelector(".pr-post-header");
      if (header) smartScrollTo(header, true);
    }
  };
  const handleScrollToPostTop = (target, _state) => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;
    const postHeader = document.querySelector(`.pr-post[data-id="${postId}"] .pr-post-header`);
    if (postHeader) {
      smartScrollTo(postHeader, true);
    }
  };
  const handleScrollToRoot = (target, topLevelId = null) => {
    if (topLevelId) {
      const rootEl = document.querySelector(`.pr-comment[data-id="${topLevelId}"]`);
      if (rootEl) {
        smartScrollTo(rootEl, false);
        rootEl.classList.add("pr-highlight-parent");
        setTimeout(() => rootEl.classList.remove("pr-highlight-parent"), 2e3);
        return;
      }
    }
    const commentId = getCommentIdFromTarget(target);
    if (!commentId && !topLevelId) return;
    const postId = getPostIdFromTarget(target);
    if (postId) {
      const postHeader = document.querySelector(`.pr-post[data-id="${postId}"] .pr-post-header`);
      if (postHeader) {
        smartScrollTo(postHeader, true);
        postHeader.classList.add("pr-highlight-parent");
        setTimeout(() => postHeader.classList.remove("pr-highlight-parent"), 2e3);
      }
    }
  };
  let activeHost = null;
  const setUIHost = (host) => {
    activeHost = host;
  };
  const getUIHost = () => {
    if (!activeHost) {
      throw new Error("No UI host registered. Ensure setUIHost is called during initialization.");
    }
    return activeHost;
  };
  const findTopLevelAncestorId = (commentId, state2) => {
    let current = state2.commentById.get(commentId);
    if (!current) return null;
    const visited = new Set();
    while (current) {
      if (visited.has(current._id)) break;
      visited.add(current._id);
      if (!current.parentCommentId) return current._id;
      const parent = state2.commentById.get(current.parentCommentId);
      if (!parent) return null;
      current = parent;
    }
    return null;
  };
  const markAncestorChainForceVisible = (commentId, state2) => {
    let currentId = commentId;
    const visited = new Set();
    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);
      const comment = state2.commentById.get(currentId);
      if (!comment) break;
      comment.forceVisible = true;
      comment.justRevealed = true;
      currentId = comment.parentCommentId || null;
    }
  };
  const handleExpandPlaceholder = (target, state2) => {
    const commentEl = target.closest(".pr-comment");
    if (!commentEl) return;
    const commentId = commentEl.getAttribute("data-id");
    const postId = commentEl.getAttribute("data-post-id");
    if (!commentId || !postId) return;
    const comment = state2.commentById.get(commentId);
    if (!comment) return;
    comment.forceVisible = true;
    comment.justRevealed = true;
    getUIHost().rerenderPostGroup(postId, commentId);
    setTimeout(() => {
      if (comment) comment.justRevealed = false;
    }, 2e3);
  };
  const handleFindParent = async (target, state2) => {
    const commentEl = target.closest(".pr-comment");
    const parentId = commentEl?.getAttribute("data-parent-id");
    const postId = commentEl?.getAttribute("data-post-id");
    if (!parentId) {
      if (!postId) return;
      const postEl = document.querySelector(`.pr-post[data-id="${postId}"]`);
      if (postEl) {
        const postHeader = postEl.querySelector(".pr-post-header");
        if (postHeader) smartScrollTo(postHeader, true);
        const stickyHeader2 = document.querySelector(`.pr-sticky-header .pr-post-header[data-post-id="${postId}"]`);
        const targets = [postHeader, postEl.querySelector(".pr-post-body-container"), stickyHeader2].filter(Boolean);
        targets.forEach((t) => t.classList.add("pr-highlight-parent"));
        setTimeout(() => targets.forEach((t) => t.classList.remove("pr-highlight-parent")), 2e3);
      }
      return;
    }
    const parentEl = document.querySelector(`.pr-comment[data-id="${parentId}"]`);
    const isReadPlaceholder = parentEl?.classList.contains("pr-comment-placeholder");
    const parentIsPlaceholder = !!parentEl?.dataset.placeholder || parentEl?.classList.contains("pr-missing-parent") || isReadPlaceholder;
    if (parentEl && !parentIsPlaceholder) {
      smartScrollTo(parentEl, false);
      parentEl.classList.add("pr-highlight-parent");
      setTimeout(() => parentEl.classList.remove("pr-highlight-parent"), 2e3);
      return;
    }
    if (parentEl && isReadPlaceholder) {
      if (postId) {
        markAncestorChainForceVisible(parentId, state2);
        getUIHost().rerenderPostGroup(postId, parentId);
        const newParentEl = document.querySelector(`.pr-comment[data-id="${parentId}"]`);
        if (newParentEl) {
          smartScrollTo(newParentEl, false);
          newParentEl.classList.add("pr-highlight-parent");
          setTimeout(() => newParentEl.classList.remove("pr-highlight-parent"), 2e3);
        }
      }
      return;
    }
    const originalText = target.textContent;
    target.textContent = "[...]";
    try {
      Logger.info(`Find Parent: Fetching missing parent ${parentId} from server...`);
      const res = await queryGraphQL(GET_COMMENT, { id: parentId });
      const parentComment = res?.comment?.result;
      if (parentComment) {
        if (!state2.commentById.has(parentComment._id)) {
          parentComment.justRevealed = true;
          parentComment.forceVisible = true;
          getUIHost().mergeComments([parentComment], true);
          if (parentComment.postId) {
            getUIHost().rerenderPostGroup(parentComment.postId, parentId);
            setTimeout(() => {
              const newParentEl = document.querySelector(`.pr-comment[data-id="${parentId}"]`);
              if (newParentEl) {
                smartScrollTo(newParentEl, false);
                newParentEl.classList.add("pr-highlight-parent");
                setTimeout(() => newParentEl.classList.remove("pr-highlight-parent"), 2e3);
              }
            }, 50);
          }
        }
      } else {
        alert("Parent comment could not be found on the server.");
      }
    } catch (err) {
      Logger.error("Failed to fetch parent comment", err);
      alert("Error fetching parent comment.");
    } finally {
      target.textContent = originalText;
    }
  };
  const handleAuthorUp = (target, _state) => {
    const item = target.closest(".pr-item");
    let author = item?.getAttribute("data-author");
    if (!author) {
      const sticky = target.closest(".pr-sticky-header");
      author = sticky?.getAttribute("data-author");
    }
    if (author) {
      toggleAuthorPreference(author, "up");
      getUIHost().rerenderAll();
    }
  };
  const handleAuthorDown = (target, _state) => {
    const item = target.closest(".pr-item");
    let author = item?.getAttribute("data-author");
    if (!author) {
      const sticky = target.closest(".pr-sticky-header");
      author = sticky?.getAttribute("data-author");
    }
    if (author) {
      toggleAuthorPreference(author, "down");
      getUIHost().rerenderAll();
    }
  };
  const fetchAndRenderPost = async (postId, _state) => {
    const res = await queryGraphQL(
      GET_POST_BY_ID,
      { id: postId }
    );
    const post = res?.post?.result;
    if (!post) return null;
    getUIHost().upsertPost(post);
    getUIHost().rerenderPostGroup(postId);
    return post;
  };
  const handleLoadPost = async (postId, titleLink, state2) => {
    const postContainer = titleLink.closest(".pr-post");
    if (!postContainer) return;
    let contentEl = postContainer.querySelector(".pr-post-content");
    if (!contentEl) {
      contentEl = document.createElement("div");
      contentEl.className = "pr-post-content";
      const header = postContainer.querySelector(".pr-post-header");
      if (header) {
        header.after(contentEl);
      } else {
        postContainer.prepend(contentEl);
      }
    }
    contentEl.innerHTML = '<div class="pr-info">Loading post content...</div>';
    try {
      const post = await fetchAndRenderPost(postId, state2);
      if (post) {
        titleLink.removeAttribute("data-action");
      } else {
        contentEl.innerHTML = '<div class="pr-info" style="color: red;">Failed to load post content.</div>';
      }
    } catch (err) {
      Logger.error("Failed to load post", err);
      contentEl.innerHTML = '<div class="pr-info" style="color: red;">Error loading post.</div>';
    }
  };
  const handleTogglePostBody = async (target, state2) => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;
    const postEl = document.querySelector(`.pr-post[data-id="${postId}"]`);
    if (!postEl) return;
    const eBtn = postEl.querySelector('[data-action="toggle-post-body"]');
    const isFromSticky = !!target.closest(".pr-sticky-header");
    const container = postEl.querySelector(".pr-post-body-container");
    if (!container) {
      if (eBtn) eBtn.textContent = "[...]";
      try {
        const post = await fetchAndRenderPost(postId, state2);
        if (!post || !post.htmlBody) {
          Logger.warn(`Post ${postId} has no body content`);
          if (eBtn) eBtn.textContent = "[e]";
          return;
        }
        const newContainer = document.querySelector(`.pr-post[data-id="${postId}"] .pr-post-body-container`);
        if (newContainer) {
          newContainer.classList.remove("truncated");
          newContainer.style.maxHeight = "none";
          const overlay = newContainer.querySelector(".pr-read-more-overlay");
          if (overlay) overlay.style.display = "none";
          const readMoreBtn = newContainer.querySelector(".pr-post-read-more");
          if (readMoreBtn) readMoreBtn.style.display = "none";
        }
        const newBtn = document.querySelector(`.pr-post[data-id="${postId}"] [data-action="toggle-post-body"]`);
        if (newBtn) {
          newBtn.textContent = "[e]";
          newBtn.title = "Collapse post body";
        }
        if (isFromSticky) {
          const freshPostEl = document.querySelector(`.pr-post[data-id="${postId}"]`);
          const postHeader = freshPostEl?.querySelector(".pr-post-header");
          if (postHeader) {
            const newHeaderTop = postHeader.getBoundingClientRect().top + window.pageYOffset;
            window.scrollTo({
              top: newHeaderTop,
              behavior: window.__PR_TEST_MODE__ ? "instant" : "smooth"
            });
          }
        }
        Logger.info(`Loaded and expanded post body for ${postId}`);
        return;
      } catch (err) {
        Logger.error(`Failed to load post body for ${postId}`, err);
        if (eBtn) eBtn.textContent = "[e]";
        return;
      }
    }
    if (container.classList.contains("truncated")) {
      container.classList.remove("truncated");
      container.style.maxHeight = "none";
      const overlay = container.querySelector(".pr-read-more-overlay");
      if (overlay) overlay.style.display = "none";
      const readMoreBtn = container.querySelector(".pr-post-read-more");
      if (readMoreBtn) readMoreBtn.style.display = "none";
      if (eBtn) eBtn.title = "Collapse post body";
    } else {
      container.classList.add("truncated");
      container.style.maxHeight = CONFIG.maxPostHeight;
      const overlay = container.querySelector(".pr-read-more-overlay");
      if (overlay) overlay.style.display = "flex";
      const readMoreBtn = container.querySelector(".pr-post-read-more");
      if (readMoreBtn) readMoreBtn.style.display = "block";
      if (eBtn) eBtn.title = "Expand post body";
    }
    if (isFromSticky) {
      const postHeader = postEl.querySelector(".pr-post-header");
      if (postHeader) {
        const newHeaderTop = postHeader.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({
          top: newHeaderTop,
          behavior: window.__PR_TEST_MODE__ ? "instant" : "smooth"
        });
      }
    }
  };
  const handleLoadAllComments = async (target, state2) => {
    const postId = getPostIdFromTarget(target);
    if (!postId) return;
    const originalText = target.textContent;
    target.textContent = "[...]";
    try {
      const res = await queryGraphQL(GET_POST_COMMENTS, {
        postId,
        limit: CONFIG.loadMax
      });
      const comments = res?.comments?.results || [];
      comments.forEach((c) => {
        c.forceVisible = true;
        c.justRevealed = true;
      });
      state2.comments.filter((c) => c.postId === postId).forEach((c) => {
        c.forceVisible = true;
        c.justRevealed = true;
      });
      const added = getUIHost().mergeComments(comments, false);
      Logger.info(`Load all comments for post ${postId}: ${comments.length} fetched, ${added} new`);
      setTimeout(() => {
        state2.comments.filter((c) => c.postId === postId).forEach((c) => {
          c.justRevealed = false;
        });
      }, 2e3);
      getUIHost().rerenderPostGroup(postId);
      if (added === 0) {
        Logger.info(`No new comments found for post ${postId}`);
      }
    } catch (err) {
      Logger.error("Failed to load all comments", err);
    } finally {
      target.textContent = originalText;
    }
  };
  const handleLoadThread = async (target, state2) => {
    const commentId = getCommentIdFromTarget(target);
    if (!commentId) return;
    const comment = state2.commentById.get(commentId);
    if (!comment) return;
    let topLevelId = findTopLevelAncestorId(commentId, state2);
    if (!topLevelId && comment.parentCommentId) {
      const originalText2 = target.textContent;
      target.textContent = "[...]";
      try {
        let currentParentId = comment.parentCommentId;
        const visited = new Set();
        while (currentParentId && !visited.has(currentParentId)) {
          visited.add(currentParentId);
          const existing = state2.commentById.get(currentParentId);
          if (existing) {
            currentParentId = existing.parentCommentId || null;
            continue;
          }
          const res = await queryGraphQL(GET_COMMENT, { id: currentParentId });
          const parent = res?.comment?.result;
          if (!parent) break;
          getUIHost().mergeComments([parent], true);
          currentParentId = parent.parentCommentId || null;
        }
        topLevelId = findTopLevelAncestorId(commentId, state2);
      } catch (err) {
        Logger.error("Failed to walk parent chain for thread load", err);
        target.textContent = originalText2;
        return;
      }
    }
    if (!topLevelId) {
      topLevelId = commentId;
    }
    const originalText = target.textContent;
    target.textContent = "[...]";
    try {
      const res = await queryGraphQL(GET_THREAD_COMMENTS, {
        topLevelCommentId: topLevelId,
        limit: CONFIG.loadMax
      });
      const comments = res?.comments?.results || [];
      const added = getUIHost().mergeComments(comments, true);
      Logger.info(`Load thread ${topLevelId}: ${comments.length} fetched, ${added} new`);
      if (added > 0 && comment.postId) {
        getUIHost().rerenderPostGroup(comment.postId, commentId);
      }
    } catch (err) {
      Logger.error("Failed to load thread", err);
    } finally {
      target.textContent = originalText;
    }
  };
  const handleLoadParents = async (target, state2) => {
    const commentId = getCommentIdFromTarget(target);
    if (!commentId) return;
    const comment = state2.commentById.get(commentId);
    if (!comment) return;
    const originalText = target.textContent;
    target.textContent = "[...]";
    try {
      const missingIds = [];
      let currentId = comment.parentCommentId || null;
      const visited = new Set();
      while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);
        const existing = state2.commentById.get(currentId);
        if (existing) {
          currentId = existing.parentCommentId || null;
          continue;
        }
        missingIds.push(currentId);
        currentId = null;
      }
      if (missingIds.length === 0) {
        target.textContent = originalText;
        return;
      }
      const fetched = [];
      while (missingIds.length > 0) {
        const batch = missingIds.splice(0, 50);
        const res = await queryGraphQL(GET_COMMENTS_BY_IDS, { commentIds: batch });
        const results = res?.comments?.results || [];
        fetched.push(...results);
        for (const r of results) {
          if (r.parentCommentId && !state2.commentById.has(r.parentCommentId) && !missingIds.includes(r.parentCommentId)) {
            missingIds.push(r.parentCommentId);
          }
        }
      }
      for (const f of fetched) {
        f.forceVisible = true;
        f.justRevealed = true;
      }
      const added = getUIHost().mergeComments(fetched, true);
      Logger.info(`Load parents for ${commentId}: ${fetched.length} fetched, ${added} new`);
      if (comment) {
        comment.forceVisible = true;
        comment.justRevealed = true;
      }
      if (added > 0 && comment.postId) {
        getUIHost().rerenderPostGroup(comment.postId, commentId);
      }
      setTimeout(() => {
        for (const f of fetched) f.justRevealed = false;
        if (comment) comment.justRevealed = false;
      }, 2e3);
    } catch (err) {
      Logger.error("Failed to load parents", err);
    } finally {
      target.textContent = originalText;
    }
  };
  const handleLoadDescendants = async (target, state2) => {
    const commentId = getCommentIdFromTarget(target);
    if (!commentId) return;
    const comment = state2.commentById.get(commentId);
    if (!comment) return;
    const originalText = target.textContent;
    target.textContent = "[...]";
    try {
      let topLevelId = findTopLevelAncestorId(commentId, state2);
      if (!topLevelId && comment.parentCommentId) {
        let currentParentId = comment.parentCommentId;
        const visited = new Set();
        while (currentParentId && !visited.has(currentParentId)) {
          visited.add(currentParentId);
          const existing = state2.commentById.get(currentParentId);
          if (existing) {
            currentParentId = existing.parentCommentId || null;
            continue;
          }
          const parentRes = await queryGraphQL(GET_COMMENT, { id: currentParentId });
          const parent = parentRes?.comment?.result;
          if (!parent) break;
          getUIHost().mergeComments([parent], true);
          currentParentId = parent.parentCommentId || null;
        }
        topLevelId = findTopLevelAncestorId(commentId, state2);
      }
      if (!topLevelId) topLevelId = commentId;
      const res = await queryGraphQL(GET_THREAD_COMMENTS, {
        topLevelCommentId: topLevelId,
        limit: CONFIG.loadMax
      });
      const fetchedComments = res?.comments?.results || [];
      const added = getUIHost().mergeComments(fetchedComments, true);
      fetchedComments.forEach((c) => {
        const inState = state2.commentById.get(c._id);
        if (inState) {
          inState.forceVisible = true;
          inState.justRevealed = true;
        }
      });
      Logger.info(`Load descendants for ${commentId}: ${fetchedComments.length} fetched, ${added} new`);
      if ((added > 0 || fetchedComments.length > 0) && comment.postId) {
        getUIHost().rerenderPostGroup(comment.postId, commentId);
      }
      setTimeout(() => {
        fetchedComments.forEach((c) => {
          const inState = state2.commentById.get(c._id);
          if (inState) inState.justRevealed = false;
        });
      }, 2e3);
    } catch (err) {
      Logger.error("Failed to load descendants", err);
    } finally {
      target.textContent = originalText;
    }
  };
  const handleLoadParentsAndScroll = async (target, state2) => {
    const commentId = getCommentIdFromTarget(target);
    if (!commentId) return;
    let topLevelId = findTopLevelAncestorId(commentId, state2);
    const alreadyLoaded = !!topLevelId;
    markAncestorChainForceVisible(commentId, state2);
    if (!alreadyLoaded) {
      await handleLoadParents(target, state2);
      topLevelId = findTopLevelAncestorId(commentId, state2);
    }
    if (topLevelId) {
      let rootEl = document.querySelector(`.pr-comment[data-id="${topLevelId}"]`);
      if (rootEl) {
        const comment = state2.commentById.get(commentId);
        if (comment?.postId) {
          getUIHost().rerenderPostGroup(comment.postId, commentId);
          rootEl = document.querySelector(`.pr-comment[data-id="${topLevelId}"]`);
        }
        if (!rootEl) return;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const isVisible = isElementFullyVisible(rootEl);
        if (!isVisible) {
          smartScrollTo(rootEl, false);
        } else {
          Logger.info(`Trace to Root: Root ${topLevelId} already visible, skipping scroll.`);
        }
        rootEl.classList.add("pr-highlight-parent");
        setTimeout(() => rootEl.classList.remove("pr-highlight-parent"), 2e3);
        return;
      }
    }
    handleScrollToRoot(target, topLevelId);
  };
  const setStatusMessage = (message, color) => {
    const statusEl = document.querySelector(".pr-status");
    if (!statusEl) return;
    statusEl.textContent = "";
    if (!color) {
      statusEl.textContent = message;
      return;
    }
    const span = document.createElement("span");
    span.style.color = color;
    span.textContent = message;
    statusEl.appendChild(span);
  };
  const escapeXmlText = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapeXmlAttr = (value) => escapeXmlText(value).replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  const handleSendToAIStudio = async (state2, includeDescendants = false) => {
    const target = document.elementFromPoint(state2.lastMousePos.x, state2.lastMousePos.y);
    if (!target) {
      Logger.warn("AI Studio: No element found under mouse.");
      return;
    }
    const itemEl = target.closest(".pr-comment, .pr-post");
    if (!itemEl) {
      Logger.warn("AI Studio: No comment or post found under mouse.");
      return;
    }
    document.querySelectorAll(".being-summarized").forEach((el) => el.classList.remove("being-summarized"));
    itemEl.classList.add("being-summarized");
    const id = itemEl.dataset.id;
    if (!id) {
      Logger.warn("AI Studio: Element has no ID.");
      return;
    }
    if (!includeDescendants && state2.sessionAICache[id] && !window.PR_FORCE_AI_REGEN) {
      Logger.info(`AI Studio: Using session-cached answer for ${id}`);
      displayAIPopup(state2.sessionAICache[id], state2);
      return;
    }
    window.PR_FORCE_AI_REGEN = false;
    const isPost2 = itemEl.classList.contains("pr-post");
    Logger.info(`AI Studio: Target identified - ${isPost2 ? "Post" : "Comment"} ${id} (Include descendants: ${includeDescendants})`);
    try {
      setStatusMessage("[AI Studio] Building conversation thread...", "#007bff");
      const requestId = Math.random().toString(36).substring(2, 10);
      const lineage = [];
      let currentId = id;
      let currentIsPost = isPost2;
      while (currentId && lineage.length < 8) {
        const item = await fetchItemMarkdown(currentId, currentIsPost, state2);
        if (!item) break;
        lineage.unshift(item);
        if (currentIsPost) {
          currentId = null;
        } else {
          if (item.parentCommentId) {
            currentId = item.parentCommentId;
            currentIsPost = false;
          } else if (item.postId) {
            currentId = item.postId;
            currentIsPost = true;
          } else {
            currentId = null;
          }
        }
      }
      let descendants = [];
      if (includeDescendants) {
        if (isPost2) {
          descendants = state2.comments.filter((c) => c.postId === id);
        } else {
          const found = new Set();
          const toCheck = [id];
          while (toCheck.length > 0) {
            const cid = toCheck.pop();
            const children = state2.comments.filter((c) => c.parentCommentId === cid);
            children.forEach((c) => {
              if (!found.has(c._id)) {
                found.add(c._id);
                descendants.push(c);
                toCheck.push(c._id);
              }
            });
          }
        }
        descendants.sort((a, b) => new Date(a.postedAt || "").getTime() - new Date(b.postedAt || "").getTime());
        descendants = descendants.filter((d) => d._id !== id);
      }
      const threadXml = lineage.length > 0 ? toXml(lineage, id, descendants) : "";
      const prefix = getAIStudioPrefix() || AI_STUDIO_PROMPT_PREFIX;
      const finalPayload = prefix + threadXml;
      Logger.info("AI Studio: Opening tab with deep threaded payload...");
      state2.currentAIRequestId = requestId;
      if (typeof GM_setValue === "function") {
        GM_setValue("ai_studio_request_id", requestId);
        GM_setValue("ai_studio_prompt_payload", finalPayload);
        GM_setValue("ai_studio_include_descendants", includeDescendants);
      }
      if (typeof GM_openInTab === "function") {
        GM_openInTab("https://aistudio.google.com/prompts/new_chat", { active: true });
      }
      setStatusMessage("[AI Studio] Opening AI Studio tab...", "#28a745");
    } catch (error) {
      Logger.error("AI Studio: Failed to prepare threaded payload", error);
      alert("Failed to send thread to AI Studio. Check console.");
    }
  };
  const fetchItemMarkdown = async (itemId, itemIsPost, state2) => {
    if (itemIsPost) {
      const p = state2.posts.find((p2) => p2._id === itemId);
      if (p?.contents?.markdown) return p;
    } else {
      const c = state2.comments.find((c2) => c2._id === itemId);
      if (c?.contents?.markdown) return c;
    }
    Logger.info(`AI Studio: Fetching ${itemId} source from server...`);
    if (itemIsPost) {
      const res = await queryGraphQL(GET_POST, { id: itemId });
      return res?.post?.result || null;
    } else {
      const res = await queryGraphQL(GET_COMMENT, { id: itemId });
      return res?.comment?.result || null;
    }
  };
  const toXml = (items, focalId, descendants = []) => {
    if (items.length === 0) return "";
    const item = items[0];
    const remaining = items.slice(1);
    const isFocal = item._id === focalId;
    const type = item.title ? "post" : "comment";
    const author = item.user?.username || item.author || "unknown";
    const md = item.contents?.markdown || item.htmlBody || "(no content)";
    let xml2 = `<${type} id="${escapeXmlAttr(item._id)}" author="${escapeXmlAttr(author)}"${isFocal ? ' is_focal="true"' : ""}>
`;
    xml2 += `<body_markdown>
${escapeXmlText(md)}
</body_markdown>
`;
    if (isFocal && descendants.length > 0) {
      xml2 += `<descendants>
`;
      xml2 += descendantsToXml(descendants, focalId).split("\n").map((line) => "  " + line).join("\n") + "\n";
      xml2 += `</descendants>
`;
    }
    if (remaining.length > 0) {
      xml2 += toXml(remaining, focalId, descendants).split("\n").map((line) => "  " + line).join("\n") + "\n";
    }
    xml2 += `</${type}>`;
    return xml2;
  };
  const descendantsToXml = (descendants, parentId) => {
    const children = descendants.filter((d) => d.parentCommentId === parentId || parentId === d.postId && !d.parentCommentId);
    if (children.length === 0) return "";
    return children.map((child) => {
      const author = child.user?.username || child.author || "unknown";
      const md = child.contents?.markdown || child.htmlBody || "(no content)";
      let xml2 = `<comment id="${escapeXmlAttr(child._id)}" author="${escapeXmlAttr(author)}">
`;
      xml2 += `  <body_markdown>
${escapeXmlText(md).split("\n").map((l) => "    " + l).join("\n")}
  </body_markdown>
`;
      const grandChildrenXml = descendantsToXml(descendants, child._id);
      if (grandChildrenXml) {
        xml2 += grandChildrenXml.split("\n").map((line) => "  " + line).join("\n") + "\n";
      }
      xml2 += `</comment>`;
      return xml2;
    }).join("\n");
  };
  const displayAIPopup = (text2, state2, includeDescendants = false) => {
    if (state2.activeAIPopup) {
      const content = state2.activeAIPopup.querySelector(".pr-ai-popup-content");
      if (content) content.innerHTML = sanitizeHtml(text2);
      state2.activeAIPopup.classList.toggle("pr-ai-include-descendants", includeDescendants);
      return;
    }
    const popup = document.createElement("div");
    popup.className = `pr-ai-popup${includeDescendants ? " pr-ai-include-descendants" : ""}`;
    popup.innerHTML = `
    <div class="pr-ai-popup-header">
      <h3>Summary and Potential Errors</h3>
      <div class="pr-ai-popup-actions">
        <button class="pr-ai-popup-regen">Regenerate</button>
        <button class="pr-ai-popup-close">Close</button>
      </div>
    </div>
    <div class="pr-ai-popup-content"></div>
  `;
    const popupContent = popup.querySelector(".pr-ai-popup-content");
    if (popupContent) popupContent.innerHTML = sanitizeHtml(text2);
    document.body.appendChild(popup);
    state2.activeAIPopup = popup;
    popup.querySelector(".pr-ai-popup-close")?.addEventListener("click", () => closeAIPopup(state2));
    popup.querySelector(".pr-ai-popup-regen")?.addEventListener("click", () => {
      window.PR_FORCE_AI_REGEN = true;
      const isShifted = popup.classList.contains("pr-ai-include-descendants");
      handleSendToAIStudio(state2, isShifted);
    });
  };
  const closeAIPopup = (state2) => {
    if (state2.activeAIPopup) {
      state2.activeAIPopup.remove();
      state2.activeAIPopup = null;
    }
    document.querySelectorAll(".being-summarized").forEach((el) => el.classList.remove("being-summarized"));
  };
  const initAIStudioListener = (state2) => {
    if (typeof GM_addValueChangeListener !== "function") {
      Logger.debug("AI Studio: GM_addValueChangeListener not available, skipping listener setup");
      return;
    }
    GM_addValueChangeListener("ai_studio_response_payload", (_key, _oldVal, newVal, remote) => {
      if (!newVal || !remote) return;
      const { text: text2, requestId, includeDescendants } = newVal;
      if (requestId === state2.currentAIRequestId) {
        Logger.info("AI Studio: Received matching response!");
        const target = document.querySelector(".being-summarized");
        if (target?.dataset.id) {
          state2.sessionAICache[target.dataset.id] = text2;
        }
        displayAIPopup(text2, state2, !!includeDescendants);
        setStatusMessage("AI Studio response received.");
        const stickyEl = document.getElementById("pr-sticky-ai-status");
        if (stickyEl) {
          stickyEl.classList.remove("visible");
          stickyEl.textContent = "";
        }
        window.focus();
      } else {
        Logger.debug("AI Studio: Received response for different request. Ignoring.");
      }
    });
    GM_addValueChangeListener("ai_studio_status", (_key, _oldVal, newVal, remote) => {
      if (!newVal || !remote) return;
      Logger.debug(`AI Studio Status: ${newVal}`);
      const statusEl = document.querySelector(".pr-status");
      if (statusEl) setStatusMessage(`[AI Studio] ${String(newVal)}`, "#28a745");
      const stickyEl = document.getElementById("pr-sticky-ai-status");
      if (stickyEl) {
        stickyEl.textContent = `AI: ${newVal}`;
        stickyEl.classList.add("visible");
        if (newVal === "Response received!" || newVal.startsWith("Error:")) {
          setTimeout(() => {
            if (stickyEl.textContent?.includes(newVal)) {
              stickyEl.classList.remove("visible");
            }
          }, 5e3);
        }
      }
    });
    let scrollThrottle = null;
    window.addEventListener("scroll", () => {
      if (scrollThrottle || !state2.activeAIPopup) return;
      scrollThrottle = window.setTimeout(() => {
        scrollThrottle = null;
        if (!state2.activeAIPopup) return;
        const target = document.querySelector(".being-summarized");
        if (target) {
          const rect = target.getBoundingClientRect();
          const isVisible = rect.bottom > 0 && rect.top < window.innerHeight;
          if (!isVisible) {
            Logger.info("AI Studio: Target scrolled off-screen. Auto-closing popup.");
            closeAIPopup(state2);
          }
        }
      }, 500);
    }, { passive: true });
  };
  const setupAIStudioKeyboard = (state2) => {
    document.addEventListener("keydown", (e) => {
      const target = e.target;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      const key = e.key;
      const lowerKey = key.toLowerCase();
      if (key === "Escape") {
        closeAIPopup(state2);
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }
      if (lowerKey === "g") {
        if (state2.activeAIPopup) {
          const elementUnderMouse = document.elementFromPoint(state2.lastMousePos.x, state2.lastMousePos.y);
          const isInPopup = !!elementUnderMouse?.closest(".pr-ai-popup");
          const isInFocalItem = !!elementUnderMouse?.closest(".being-summarized");
          if (isInPopup || isInFocalItem) {
            closeAIPopup(state2);
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return;
          }
        }
      }
    });
  };
  let eventsAbort = null;
  const attachEventListeners = (state2) => {
    if (eventsAbort) {
      eventsAbort.abort();
      Logger.debug("Aborted previous event listeners to re-attach.");
    }
    eventsAbort = new AbortController();
    const signal = eventsAbort.signal;
    const isHeaderInteractive = (el) => {
      return !!el.closest(
        ".pr-post-header a, .pr-author, .pr-vote-controls, .pr-reactions-container, .pr-reaction-chip, .pr-add-reaction-btn, .pr-vote-btn, .pr-author-controls, .pr-post-action"
      );
    };
    document.addEventListener("mousedown", (e) => {
      Logger.debug(`document.mousedown: target=${e.target.tagName}.${e.target.className}`);
      const target = e.target.closest("[data-action]");
      if (!target) return;
      const action = target.dataset.action;
      if (!action) return;
      if (target.classList.contains("disabled")) {
        Logger.debug(`action ${action} is disabled, ignoring`);
        return;
      }
      Logger.debug(`Event: mousedown, action=${action}`);
      if (action === "karma-up" || action === "karma-down" || action === "agree" || action === "disagree") {
        handleVoteInteraction(target, action, state2);
      } else if (action === "reaction-vote") {
        const commentId = target.dataset.id;
        const reactName = target.dataset.reactionName;
        if (commentId && reactName) {
          handleReactionVote(commentId, reactName, state2);
        }
      } else if (action === "open-picker") {
        e.stopPropagation();
        openReactionPicker(target, state2);
      }
    }, { signal });
    document.addEventListener("click", (e) => {
      const target = e.target;
      const replies = target.closest(".pr-replies");
      if (replies && target === replies) {
        e.stopPropagation();
        handleCommentCollapseToggle(replies);
        return;
      }
      const actionTarget = target.closest("[data-action]");
      if (!actionTarget) return;
      const action = actionTarget.dataset.action;
      if (actionTarget.classList.contains("disabled")) return;
      if (action === "collapse" && actionTarget.classList.contains("pr-post-toggle")) {
        e.stopPropagation();
        handlePostCollapse(actionTarget);
      } else if (action === "expand" && actionTarget.classList.contains("pr-post-toggle")) {
        e.stopPropagation();
        handlePostExpand(actionTarget);
      } else if (action === "author-up") {
        e.stopPropagation();
        handleAuthorUp(actionTarget);
      } else if (action === "author-down") {
        e.stopPropagation();
        handleAuthorDown(actionTarget);
      } else if (action === "read-more") {
        e.stopPropagation();
        handleReadMore(actionTarget);
      } else if (action === "load-post") {
        e.preventDefault();
        e.stopPropagation();
        const post = actionTarget.closest(".pr-post");
        const postId = post?.dataset.postId || actionTarget.closest(".pr-post-header")?.getAttribute("data-post-id");
        if (postId) {
          handleLoadPost(postId, actionTarget, state2);
        }
      } else if (action === "toggle-post-body") {
        e.stopPropagation();
        handleTogglePostBody(actionTarget, state2);
      } else if (action === "load-all-comments") {
        e.stopPropagation();
        handleLoadAllComments(actionTarget, state2);
      } else if (action === "scroll-to-post-top") {
        e.stopPropagation();
        const rawTarget = e.target;
        if (rawTarget instanceof Element && isHeaderInteractive(rawTarget)) return;
        const postId = actionTarget.closest(".pr-post-header")?.getAttribute("data-post-id") || actionTarget.closest(".pr-post")?.getAttribute("data-id");
        if (postId) {
          const postHeader = document.querySelector(`.pr-post[data-id="${postId}"] .pr-post-header`);
          if (postHeader) {
            const headerTop = postHeader.getBoundingClientRect().top + window.pageYOffset;
            const currentScroll = window.scrollY;
            if (Math.abs(headerTop - currentScroll) < 5) {
              const eBtn = postHeader.querySelector('[data-action="toggle-post-body"]');
              if (eBtn && !eBtn.classList.contains("disabled")) {
                handleTogglePostBody(eBtn, state2);
                return;
              }
            }
          }
        }
        handleScrollToPostTop(actionTarget);
      } else if (action === "scroll-to-comments") {
        e.stopPropagation();
        handleScrollToComments(actionTarget);
      } else if (action === "scroll-to-next-post") {
        e.stopPropagation();
        handleScrollToNextPost(actionTarget);
      } else if (action === "send-to-ai-studio") {
        e.stopPropagation();
        handleSendToAIStudio(state2, e.shiftKey);
      } else if (action === "collapse" && actionTarget.classList.contains("pr-collapse")) {
        handleCommentCollapse(actionTarget);
      } else if (action === "expand" && actionTarget.classList.contains("pr-expand")) {
        handleCommentExpand(actionTarget);
      } else if (action === "expand-placeholder") {
        e.preventDefault();
        e.stopPropagation();
        handleExpandPlaceholder(target, state2);
      } else if (action === "find-parent") {
        e.preventDefault();
        e.stopPropagation();
        handleFindParent(target, state2);
      } else if (action === "load-thread") {
        e.preventDefault();
        e.stopPropagation();
        handleLoadThread(target, state2);
      } else if (action === "load-parents") {
        e.preventDefault();
        e.stopPropagation();
        handleLoadParents(target, state2);
      } else if (action === "load-descendants") {
        e.preventDefault();
        e.stopPropagation();
        handleLoadDescendants(target, state2);
      } else if (action === "scroll-to-root") {
        e.preventDefault();
        e.stopPropagation();
        handleScrollToRoot(target);
      } else if (action === "load-parents-and-scroll") {
        e.preventDefault();
        e.stopPropagation();
        handleLoadParentsAndScroll(target, state2);
      }
    }, { signal });
    document.addEventListener("click", (e) => {
      const target = e.target;
      if (target.id === "pr-inline-react-btn") {
        if (state2.currentSelection) {
          openReactionPicker(target, state2, "");
        }
      }
    }, { signal });
    document.addEventListener("mousemove", (e) => {
      state2.lastMousePos.x = e.clientX;
      state2.lastMousePos.y = e.clientY;
    }, { passive: true, signal });
    attachHotkeyListeners(state2, signal);
  };
  class PowerReaderUIHost {
    state;
    constructor(state2) {
      this.state = state2;
    }
    rerenderAll() {
      renderUI(this.state);
    }
    rerenderPostGroup(postId, anchorCommentId) {
      const postContainer = document.querySelector(`.pr-post[data-id="${postId}"]`);
      if (!postContainer) {
        Logger.warn(`reRenderPostGroup: Container for post ${postId} not found`);
        return;
      }
      let beforeTop = null;
      if (anchorCommentId) {
        const anchorEl = postContainer.querySelector(`.pr-comment[data-id="${anchorCommentId}"]`);
        if (anchorEl) beforeTop = anchorEl.getBoundingClientRect().top;
      }
      const post = this.state.postById.get(postId);
      const postComments = this.state.comments.filter((c) => c.postId === postId);
      Logger.info(`reRenderPostGroup: p=${postId}, comments=${postComments.length}`);
      const bodyContainer = postContainer.querySelector(".pr-post-body-container");
      const wasExpanded = bodyContainer && !bodyContainer.classList.contains("truncated");
      const group = {
        postId,
        title: post?.title || postComments.find((c) => c.post?.title)?.post?.title || "Unknown Post",
        comments: postComments,
        fullPost: post
      };
      postContainer.outerHTML = renderPostGroup(group, this.state);
      const newPostContainer = document.querySelector(`.pr-post[data-id="${postId}"]`);
      if (wasExpanded && newPostContainer) {
        const newBody = newPostContainer.querySelector(".pr-post-body-container");
        if (newBody && newBody.classList.contains("truncated")) {
          newBody.classList.remove("truncated");
          newBody.style.maxHeight = "none";
          const overlay = newBody.querySelector(".pr-read-more-overlay");
          if (overlay) overlay.style.display = "none";
          const readMoreBtn = newBody.querySelector(".pr-post-read-more");
          if (readMoreBtn) readMoreBtn.style.display = "none";
        }
      }
      setupLinkPreviews(this.state.comments);
      refreshPostActionButtons(postId);
      if (anchorCommentId && beforeTop !== null) {
        const newAnchor = document.querySelector(`.pr-comment[data-id="${anchorCommentId}"]`);
        if (newAnchor) {
          const afterTop = newAnchor.getBoundingClientRect().top;
          const delta = afterTop - beforeTop;
          const oldScrollY = window.scrollY;
          Logger.info(`Viewport Preservation [${anchorCommentId}]: beforeTop=${beforeTop.toFixed(2)}, afterTop=${afterTop.toFixed(2)}, delta=${delta.toFixed(2)}, oldScrollY=${oldScrollY.toFixed(2)}`);
          window.scrollTo(0, Math.max(0, oldScrollY + delta));
        }
      }
    }
    mergeComments(newComments, markAsContext = true, postIdMap) {
      let added = 0;
      for (const c of newComments) {
        if (!this.state.commentById.has(c._id)) {
          if (markAsContext) c.contextType = "fetched";
          if (postIdMap && postIdMap.has(c._id)) {
            c.postId = postIdMap.get(c._id);
          }
          this.state.comments.push(c);
          added++;
        }
      }
      if (added > 0) rebuildIndexes(this.state);
      return added;
    }
    upsertPost(post) {
      if (!this.state.postById.has(post._id)) {
        this.state.posts.push(post);
      } else {
        const idx = this.state.posts.findIndex((p) => p._id === post._id);
        if (idx >= 0) this.state.posts[idx] = post;
      }
      this.state.postById.set(post._id, post);
    }
  }
  const getUsernameFromUrl = () => {
    const path = window.location.pathname;
    if (!path.startsWith("/users/")) return null;
    const parts = path.split("/");
    if (parts.length >= 4 && parts[3]) {
      return parts[3];
    }
    if (parts.length >= 3) {
      return parts[2];
    }
    return null;
  };
  const addSharedStyles = () => {
    if (document.getElementById("pr-header-injection-styles")) return;
    GM_addStyle(`
    #pr-header-links-container {
      display: inline-flex;
      align-items: center;
      margin-right: 12px;
    }
    #pr-header-links-container a {
      transition: opacity 0.2s !important;
      text-decoration: none !important;
    }
    #pr-header-links-container a:hover {
      opacity: 0.7 !important;
    }
    #pr-header-links-container .pr-header-chip {
      background: #111;
      color: #fff;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.75em;
      font-weight: 900;
      letter-spacing: 0.5px;
      line-height: 1;
      white-space: nowrap;
    }
    #pr-archive-link {
      margin-left: 8px;
    }
  `);
    const styleMarker = document.createElement("div");
    styleMarker.id = "pr-header-injection-styles";
    styleMarker.style.display = "none";
    document.head.appendChild(styleMarker);
  };
  const createReaderLink = () => {
    const link = document.createElement("a");
    link.id = "pr-reader-link";
    link.href = "/reader";
    link.className = "MuiButtonBase-root MuiButton-root MuiButton-text UsersMenu-userButtonRoot";
    link.style.color = "inherit";
    link.style.display = "inline-flex";
    link.style.alignItems = "center";
    link.innerHTML = `
    <span class="MuiButton-label">
      <span class="UsersMenu-userButtonContents">
        <span class="pr-header-chip">Power Reader</span>
      </span>
    </span>
  `;
    return link;
  };
  const createArchiveLink = (username) => {
    const link = document.createElement("a");
    link.id = "pr-archive-link";
    link.href = `/reader?view=archive&username=${encodeURIComponent(username)}`;
    link.className = "MuiButtonBase-root MuiButton-root MuiButton-text UsersMenu-userButtonRoot";
    link.style.color = "inherit";
    link.style.display = "inline-flex";
    link.style.alignItems = "center";
    link.innerHTML = `
    <span class="MuiButton-label">
      <span class="UsersMenu-userButtonContents">
        <span class="pr-header-chip">User Archive</span>
      </span>
    </span>
  `;
    return link;
  };
  const injectLinks = () => {
    const container = document.querySelector(".Header-rightHeaderItems");
    if (!container) return;
    let linksContainer = document.getElementById("pr-header-links-container");
    if (!linksContainer) {
      addSharedStyles();
      linksContainer = document.createElement("div");
      linksContainer.id = "pr-header-links-container";
      const searchBar = container.querySelector(".SearchBar-root");
      if (searchBar) {
        searchBar.after(linksContainer);
      } else {
        container.prepend(linksContainer);
      }
    }
    if (!document.getElementById("pr-reader-link")) {
      linksContainer.appendChild(createReaderLink());
    }
    const username = getUsernameFromUrl();
    const existingArchiveLink = document.getElementById("pr-archive-link");
    if (username) {
      if (!existingArchiveLink) {
        linksContainer.appendChild(createArchiveLink(username));
        Logger.debug(`Header Injection: Added Archive link for ${username}`);
      } else {
        const expectedHref = `/reader?view=archive&username=${encodeURIComponent(username)}`;
        if (existingArchiveLink.getAttribute("href") !== expectedHref) {
          existingArchiveLink.setAttribute("href", expectedHref);
        }
      }
    } else {
      if (existingArchiveLink) {
        existingArchiveLink.remove();
        Logger.debug("Header Injection: Removed Archive link");
      }
    }
  };
  const setupHeaderInjection = () => {
    let isHydrated = false;
    const detectHydration = () => {
      if (document.querySelector(".Header-rightHeaderItems")) {
        isHydrated = true;
        injectLinks();
      }
    };
    if (document.readyState === "complete") {
      detectHydration();
    } else {
      window.addEventListener("load", detectHydration);
    }
    const observer = new MutationObserver(() => {
      if (!isHydrated) {
        if (document.querySelector(".Header-rightHeaderItems")) {
          isHydrated = true;
          injectLinks();
        }
        return;
      }
      if (document.querySelector(".Header-rightHeaderItems")) {
        injectLinks();
      }
    });
    if (document.documentElement) {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } else {
      const earlyCheck = setInterval(() => {
        if (document.documentElement) {
          clearInterval(earlyCheck);
          observer.observe(document.documentElement, { childList: true, subtree: true });
        }
      }, 100);
    }
    window.addEventListener("beforeunload", () => observer.disconnect());
  };
  const isThreadMode = (mode) => mode === "thread-full" || mode === "thread-placeholder";
  const createInitialArchiveState = (username) => ({
    username,
    userId: null,
    items: [],
    itemById: new Map(),
    lastSyncDate: null,
    viewMode: "card",
    sortBy: "date",
    filters: {
      regex: "",
      minScore: null,
      startDate: null,
      endDate: null
    },
    isSyncing: false,
    syncProgress: {
      postsFetched: 0,
      commentsFetched: 0
    }
  });
  const DB_NAME = "PowerReaderArchive";
  const DB_VERSION = 2;
  const STORE_ITEMS = "items";
  const STORE_METADATA = "metadata";
  const STORE_CONTEXTUAL = "contextual_cache";
  const CONTEXT_MAX_ENTRIES_PER_USER = 8e3;
  const CONTEXT_MAX_AGE_MS = 1e3 * 60 * 60 * 24 * 60;
  const requestToPromise = (request) => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const transactionToPromise = (tx) => new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  const isPost = (item) => "title" in item;
  const contextCacheKey = (username, itemType, itemId) => `${username}:${itemType}:${itemId}`;
  const dedupeById = (items) => {
    const map = new Map();
    items.forEach((item) => map.set(item._id, item));
    return Array.from(map.values());
  };
  const mergeContextPayload = (existing, incoming) => {
    const merged = { ...existing, ...incoming };
    if (existing.contents || incoming.contents) {
      merged.contents = { ...existing.contents, ...incoming.contents };
    }
    if (existing.user || incoming.user) {
      merged.user = { ...existing.user, ...incoming.user };
    }
    if (existing.post || incoming.post) {
      merged.post = { ...existing.post, ...incoming.post };
    }
    const existingBody = existing.htmlBody;
    const incomingBody = incoming.htmlBody;
    if (typeof existingBody === "string" && existingBody.trim().length > 0 && (!incomingBody || typeof incomingBody === "string" && incomingBody.trim().length === 0)) {
      merged.htmlBody = existingBody;
    }
    const existingMarkdown = existing.contents?.markdown;
    const incomingMarkdown = incoming.contents?.markdown;
    if (existingMarkdown && !incomingMarkdown) {
      merged.contents = { ...merged.contents || {}, markdown: existingMarkdown };
    }
    const existingParent = existing.parentComment;
    const incomingParent = incoming.parentComment;
    if (existingParent && !incomingParent) {
      merged.parentComment = existingParent;
    }
    return merged;
  };
  const getCompletenessScore = (item) => {
    let score = 1;
    const body = item.htmlBody;
    const markdown = item.contents?.markdown;
    if (typeof body === "string" && body.trim().length > 0) score += 4;
    if (typeof markdown === "string" && markdown.trim().length > 0) score += 3;
    if (item.user) score += 1;
    if (isPost(item)) {
      if (item.title) score += 1;
    } else {
      if (item.parentComment) score += 1;
      if (item.post) score += 1;
      if (Array.isArray(item.latestChildren) && item.latestChildren.length > 0) score += 1;
    }
    return score;
  };
  const openDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_ITEMS)) {
          const itemStore = db.createObjectStore(STORE_ITEMS, { keyPath: "_id" });
          itemStore.createIndex("username", "username", { unique: false });
          itemStore.createIndex("postedAt", "postedAt", { unique: false });
          itemStore.createIndex("userId", "userId", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_METADATA)) {
          db.createObjectStore(STORE_METADATA, { keyPath: "username" });
        }
        if (!db.objectStoreNames.contains(STORE_CONTEXTUAL)) {
          const contextualStore = db.createObjectStore(STORE_CONTEXTUAL, { keyPath: "cacheKey" });
          contextualStore.createIndex("username", "username", { unique: false });
          contextualStore.createIndex("itemType", "itemType", { unique: false });
          contextualStore.createIndex("lastAccessedAt", "lastAccessedAt", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };
  const saveArchiveData = async (username, items, lastSyncDate) => {
    const db = await openDB();
    const tx = db.transaction([STORE_ITEMS, STORE_METADATA], "readwrite");
    const itemStore = tx.objectStore(STORE_ITEMS);
    const metadataStore = tx.objectStore(STORE_METADATA);
    items.forEach((item) => {
      const itemToSave = { ...item, username };
      itemStore.put(itemToSave);
    });
    metadataStore.put({ username, lastSyncDate });
    await transactionToPromise(tx);
  };
  const loadArchiveData = async (username) => {
    const db = await openDB();
    const metadata = await new Promise((resolve) => {
      const tx = db.transaction(STORE_METADATA, "readonly");
      const request = tx.objectStore(STORE_METADATA).get(username);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
    const items = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ITEMS, "readonly");
      const index = tx.objectStore(STORE_ITEMS).index("username");
      const request = index.getAll(IDBKeyRange.only(username));
      request.onsuccess = () => {
        const results = request.result;
        results.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
    return {
      items,
      lastSyncDate: metadata?.lastSyncDate || null
    };
  };
  const upsertContextualEntries = async (username, itemType, items) => {
    if (items.length === 0) return;
    const db = await openDB();
    const tx = db.transaction(STORE_CONTEXTUAL, "readwrite");
    const store = tx.objectStore(STORE_CONTEXTUAL);
    const now = Date.now();
    for (const item of dedupeById(items)) {
      const key = contextCacheKey(username, itemType, item._id);
      const existing = await requestToPromise(store.get(key));
      const payload = existing ? mergeContextPayload(existing.payload, item) : item;
      const completeness = Math.max(
        existing?.completeness || 0,
        getCompletenessScore(item),
        getCompletenessScore(payload)
      );
      const entry = {
        cacheKey: key,
        username,
        itemType,
        itemId: item._id,
        payload,
        completeness,
        updatedAt: now,
        lastAccessedAt: now
      };
      store.put(entry);
    }
    await transactionToPromise(tx);
  };
  const saveContextualItems = async (username, comments = [], posts = []) => {
    if (comments.length === 0 && posts.length === 0) return;
    await upsertContextualEntries(username, "comment", comments);
    await upsertContextualEntries(username, "post", posts);
    await pruneContextualCache(username);
  };
  const loadContextualCommentsByIds = async (username, commentIds) => {
    const ids = Array.from(new Set(commentIds.filter(Boolean)));
    if (ids.length === 0) return { comments: [], missingIds: [] };
    const db = await openDB();
    const tx = db.transaction(STORE_CONTEXTUAL, "readwrite");
    const store = tx.objectStore(STORE_CONTEXTUAL);
    const now = Date.now();
    const comments = [];
    const missingIds = [];
    for (const id of ids) {
      const key = contextCacheKey(username, "comment", id);
      const entry = await requestToPromise(store.get(key));
      const isExpired = !!entry && now - entry.updatedAt > CONTEXT_MAX_AGE_MS;
      if (!entry || entry.itemType !== "comment" || isExpired) {
        if (entry && isExpired) {
          store.delete(entry.cacheKey);
        }
        missingIds.push(id);
        continue;
      }
      entry.lastAccessedAt = now;
      store.put(entry);
      const comment = { ...entry.payload };
      if (!comment.post && comment.postId) {
        const postEntry = await requestToPromise(
          store.get(contextCacheKey(username, "post", comment.postId))
        );
        const postExpired = !!postEntry && now - postEntry.updatedAt > CONTEXT_MAX_AGE_MS;
        if (postEntry && postExpired) {
          store.delete(postEntry.cacheKey);
        } else if (postEntry && postEntry.itemType === "post") {
          postEntry.lastAccessedAt = now;
          store.put(postEntry);
          comment.post = postEntry.payload;
        }
      }
      comments.push(comment);
    }
    await transactionToPromise(tx);
    return { comments: dedupeById(comments), missingIds };
  };
  const loadAllContextualItems = async (username) => {
    const db = await openDB();
    const tx = db.transaction(STORE_CONTEXTUAL, "readonly");
    const store = tx.objectStore(STORE_CONTEXTUAL);
    const index = store.index("username");
    const entries2 = await requestToPromise(index.getAll(IDBKeyRange.only(username)));
    const now = Date.now();
    const comments = [];
    const posts = [];
    for (const entry of entries2) {
      if (now - entry.updatedAt > CONTEXT_MAX_AGE_MS) {
        continue;
      }
      if (entry.itemType === "comment") {
        comments.push(entry.payload);
      } else if (entry.itemType === "post") {
        posts.push(entry.payload);
      }
    }
    return {
      comments: dedupeById(comments),
      posts: dedupeById(posts)
    };
  };
  const pruneContextualCache = async (username) => {
    const db = await openDB();
    const tx = db.transaction(STORE_CONTEXTUAL, "readwrite");
    const store = tx.objectStore(STORE_CONTEXTUAL);
    const index = store.index("username");
    const entries2 = await requestToPromise(index.getAll(IDBKeyRange.only(username)));
    const now = Date.now();
    let removed = 0;
    const freshEntries = entries2.filter((entry) => {
      const isExpired = now - entry.updatedAt > CONTEXT_MAX_AGE_MS;
      if (isExpired) {
        store.delete(entry.cacheKey);
        removed++;
      }
      return !isExpired;
    });
    if (freshEntries.length > CONTEXT_MAX_ENTRIES_PER_USER) {
      const overflow = freshEntries.length - CONTEXT_MAX_ENTRIES_PER_USER;
      const toEvict = [...freshEntries].sort((a, b) => a.lastAccessedAt - b.lastAccessedAt).slice(0, overflow);
      toEvict.forEach((entry) => {
        store.delete(entry.cacheKey);
        removed++;
      });
    }
    await transactionToPromise(tx);
    if (removed > 0) {
      Logger.info(`Pruned ${removed} contextual cache records for ${username}`);
    }
  };
  const fetchUserId = async (username) => {
    try {
      const response = await queryGraphQL(GET_USER_BY_SLUG, { slug: username });
      return response.user?._id || null;
    } catch (e) {
      Logger.error(`Failed to fetch userId for ${username}:`, e);
      return null;
    }
  };
  const INITIAL_PAGE_SIZE = 100;
  const MIN_PAGE_SIZE = 50;
  const MAX_PAGE_SIZE = 1e3;
  const TARGET_FETCH_TIME_MS = 2500;
  const ARCHIVE_PARTIAL_QUERY_OPTIONS = {
    allowPartialData: true,
    toleratedErrorPatterns: [/Unable to find document/i, /commentGetPageUrl/i],
    operationName: "archive-sync"
  };
  const isValidArchiveItem = (item) => {
    return !!item && typeof item._id === "string" && item._id.length > 0 && typeof item.postedAt === "string" && item.postedAt.length > 0;
  };
  const getCursorTimestampFromBatch = (rawItems) => {
    for (let i = rawItems.length - 1; i >= 0; i--) {
      const item = rawItems[i];
      if (item && typeof item.postedAt === "string" && item.postedAt.length > 0) {
        return item.postedAt;
      }
    }
    return null;
  };
  async function fetchCollectionAdaptively(userId, query, key, onProgress, minDate) {
    let allItems = [];
    let hasMore = true;
    let currentLimit = INITIAL_PAGE_SIZE;
    let beforeCursor = null;
    while (hasMore) {
      const startTime = Date.now();
      try {
        const response = await queryGraphQL(query, {
          userId,
          limit: currentLimit,
          before: beforeCursor
        }, ARCHIVE_PARTIAL_QUERY_OPTIONS);
        const rawResults = response[key]?.results || [];
        const results = rawResults.filter(isValidArchiveItem);
        const duration = Date.now() - startTime;
        if (results.length !== rawResults.length) {
          Logger.warn(`Archive ${key}: dropped ${rawResults.length - results.length} invalid items from partial GraphQL response.`);
        }
        if (rawResults.length === 0) {
          hasMore = false;
          break;
        }
        const ratio = TARGET_FETCH_TIME_MS / Math.max(duration, 100);
        const clampedRatio = Math.min(Math.max(ratio, 0.5), 1.5);
        const nextLimit = Math.round(currentLimit * clampedRatio);
        const prevLimit = currentLimit;
        currentLimit = Math.min(Math.max(nextLimit, MIN_PAGE_SIZE), MAX_PAGE_SIZE);
        if (currentLimit !== prevLimit) {
          Logger.debug(`Adaptive batching: ${key} batch took ${duration}ms. Adjusting limit ${prevLimit} -> ${currentLimit}`);
        }
        let filteredResults = results;
        if (minDate) {
          const oldestInBatch = results[results.length - 1];
          if (oldestInBatch && new Date(oldestInBatch.postedAt) < minDate) {
            filteredResults = results.filter((item) => new Date(item.postedAt) >= minDate);
            hasMore = false;
          }
        }
        allItems = [...allItems, ...filteredResults];
        const uniqueItems = new Map();
        allItems.forEach((item) => uniqueItems.set(item._id, item));
        allItems = Array.from(uniqueItems.values());
        if (onProgress) onProgress(allItems.length);
        if (hasMore) {
          if (rawResults.length < prevLimit) {
            hasMore = false;
          } else {
            const nextCursor = getCursorTimestampFromBatch(rawResults);
            if (!nextCursor) {
              Logger.warn(`Archive ${key}: unable to derive next cursor from batch; stopping pagination to avoid loop.`);
              hasMore = false;
            } else {
              beforeCursor = nextCursor;
            }
          }
        }
      } catch (e) {
        Logger.error(`Error fetching ${key} with cursor ${beforeCursor}:`, e);
        throw e;
      }
    }
    return allItems;
  }
  const fetchUserPosts = (userId, onProgress, minDate) => {
    return fetchCollectionAdaptively(userId, GET_USER_POSTS, "posts", onProgress, minDate);
  };
  const fetchUserComments = (userId, onProgress, minDate) => {
    return fetchCollectionAdaptively(userId, GET_USER_COMMENTS, "comments", onProgress, minDate);
  };
  const extractPostsFromComments = (comments) => {
    const postMap = new Map();
    comments.forEach((comment) => {
      const post = comment.post;
      if (post?._id) {
        postMap.set(post._id, post);
      }
    });
    return Array.from(postMap.values());
  };
  const fetchCommentsByIds = async (commentIds, username) => {
    if (commentIds.length === 0) return [];
    const uniqueIds = Array.from(new Set(commentIds));
    let cachedComments = [];
    let missingIds = uniqueIds;
    if (username) {
      try {
        const cached = await loadContextualCommentsByIds(username, uniqueIds);
        cachedComments = cached.comments;
        missingIds = cached.missingIds;
        if (cachedComments.length > 0) {
          Logger.info(`Context cache hit: ${cachedComments.length} comments (${missingIds.length} misses)`);
        }
      } catch (e) {
        Logger.warn("Context cache lookup failed; falling back to network only.", e);
      }
    }
    const chunks = [];
    for (let i = 0; i < missingIds.length; i += 50) {
      chunks.push(missingIds.slice(i, i + 50));
    }
    let networkResults = [];
    for (const chunk of chunks) {
      try {
        const response = await queryGraphQL(
          GET_COMMENTS_BY_IDS,
          { commentIds: chunk },
          ARCHIVE_PARTIAL_QUERY_OPTIONS
        );
        if (response.comments?.results) {
          const valid = response.comments.results.filter(isValidArchiveItem);
          if (valid.length !== response.comments.results.length) {
            Logger.warn(`Context fetch: dropped ${response.comments.results.length - valid.length} invalid comments from partial GraphQL response.`);
          }
          networkResults = [...networkResults, ...valid];
        }
      } catch (e) {
        Logger.error("Failed to fetch context comments chunk:", e);
      }
    }
    if (username && networkResults.length > 0) {
      try {
        await saveContextualItems(username, networkResults, extractPostsFromComments(networkResults));
      } catch (e) {
        Logger.warn("Failed to persist contextual cache entries.", e);
      }
    }
    const mergedById = new Map();
    cachedComments.forEach((c) => mergedById.set(c._id, c));
    networkResults.forEach((c) => mergedById.set(c._id, c));
    return Array.from(mergedById.values());
  };
  let currentRenderLimit = window.__PR_RENDER_LIMIT_OVERRIDE || 5e3;
  const updateRenderLimit = (limit) => {
    currentRenderLimit = limit;
  };
  const resetRenderLimit = () => {
    currentRenderLimit = window.__PR_RENDER_LIMIT_OVERRIDE || 5e3;
  };
  const incrementRenderLimit = (delta) => {
    currentRenderLimit += delta;
  };
  const ensureContextForItems = async (items, state2) => {
    const missingIds = new Set();
    const commentPostIdMap = new Map();
    for (const item of items) {
      if ("title" in item) continue;
      const comment = item;
      const itemPostId = comment.postId;
      const immediateParentId = comment.parentCommentId || comment.parentComment?._id || null;
      if (immediateParentId && !state2.commentById.has(immediateParentId)) {
        missingIds.add(immediateParentId);
        if (!commentPostIdMap.has(immediateParentId)) {
          commentPostIdMap.set(immediateParentId, itemPostId);
        }
      }
      let current = comment.parentComment;
      let depth = 0;
      while (current && depth < 5) {
        const currentId = typeof current._id === "string" ? current._id : null;
        if (currentId && !state2.commentById.has(currentId)) {
          missingIds.add(currentId);
          if (!commentPostIdMap.has(currentId)) {
            commentPostIdMap.set(currentId, itemPostId);
          }
        }
        if (current.parentComment) {
          current = current.parentComment;
        } else {
          break;
        }
        depth++;
      }
    }
    if (missingIds.size > 0) {
      Logger.info(`Thread View: Fetching ${missingIds.size} missing context comments...`);
      const fetched = await fetchCommentsByIds(Array.from(missingIds), state2.archiveUsername || void 0);
      getUIHost().mergeComments(fetched, true, commentPostIdMap);
      ensurePlaceholderContext(items, state2);
    }
  };
  const ensurePlaceholderContext = (items, state2) => {
    const stubs = [];
    const seen = new Set();
    for (const item of items) {
      if ("title" in item) continue;
      const comment = item;
      let current = comment.parentComment;
      while (current?._id) {
        if (!state2.commentById.has(current._id) && !seen.has(current._id)) {
          seen.add(current._id);
          stubs.push(parentRefToStub(current, comment));
        }
        current = current.parentComment;
      }
    }
    if (stubs.length > 0) {
      getUIHost().mergeComments(stubs, true);
    }
  };
  const renderArchiveFeed = async (container, items, viewMode, state2, sortBy) => {
    if (items.length === 0) {
      container.innerHTML = '<div class="pr-status">No items found for this user.</div>';
      return;
    }
    const visibleItems = items.slice(0, currentRenderLimit);
    const loadMoreBtn = document.getElementById("archive-load-more");
    if (loadMoreBtn) {
      loadMoreBtn.style.display = items.length > currentRenderLimit ? "block" : "none";
      if (items.length > currentRenderLimit && loadMoreBtn.querySelector("button")) {
        loadMoreBtn.querySelector("button").textContent = `Load More (${items.length - currentRenderLimit} remaining)`;
      }
    }
    if (viewMode === "index") {
      container.innerHTML = visibleItems.map((item) => renderIndexItem(item)).join("");
    } else if (isThreadMode(viewMode)) {
      if (viewMode === "thread-full") {
        await ensureContextForItems(visibleItems, state2);
      } else {
        ensurePlaceholderContext(visibleItems, state2);
      }
      renderThreadView(container, visibleItems, state2, sortBy);
    } else {
      container.innerHTML = visibleItems.map((item) => renderCardItem(item, state2)).join("");
    }
  };
  const renderThreadView = (container, items, state2, sortBy) => {
    const visibleCommentIds = new Set();
    const inclusionCommentIds = new Set();
    items.forEach((item) => {
      if (!("title" in item)) {
        visibleCommentIds.add(item._id);
        inclusionCommentIds.add(item._id);
        const comment = item;
        let currentId = comment.parentCommentId || comment.parentComment?._id || null;
        let depth = 0;
        while (currentId && depth < 10) {
          if (state2.commentById.has(currentId)) {
            inclusionCommentIds.add(currentId);
            const parent = state2.commentById.get(currentId);
            currentId = parent.parentCommentId || parent.parentComment?._id || null;
          } else {
            break;
          }
          depth++;
        }
      }
    });
    const postGroups = new Map();
    const visiblePostIds = new Set();
    items.forEach((item) => {
      if ("title" in item) {
        visiblePostIds.add(item._id);
      }
    });
    inclusionCommentIds.forEach((commentId) => {
      const comment = state2.commentById.get(commentId);
      if (!comment) return;
      const postId = comment.postId;
      visiblePostIds.add(postId);
    });
    visiblePostIds.forEach((postId) => {
      const comments = [];
      let maxDate = new Date(0);
      let maxScore = Number.NEGATIVE_INFINITY;
      inclusionCommentIds.forEach((commentId) => {
        const comment = state2.commentById.get(commentId);
        if (comment && comment.postId === postId) {
          comments.push(comment);
          const commentDate = new Date(comment.postedAt);
          if (commentDate > maxDate) maxDate = commentDate;
          if (typeof comment.baseScore === "number" && comment.baseScore > maxScore) {
            maxScore = comment.baseScore;
          }
        }
      });
      const post = state2.postById.get(postId);
      if (post) {
        const postDate = new Date(post.postedAt);
        if (postDate > maxDate) maxDate = postDate;
        if (typeof post.baseScore === "number" && post.baseScore > maxScore) {
          maxScore = post.baseScore;
        }
      }
      postGroups.set(postId, {
        postId,
        comments,
        maxDate,
maxScore: maxScore === Number.NEGATIVE_INFINITY ? 0 : maxScore
      });
    });
    const sortedGroups = Array.from(postGroups.values());
    switch (sortBy) {
      case "date-asc":
      case "replyTo":
case "relevance":
        sortedGroups.sort((a, b) => a.maxDate.getTime() - b.maxDate.getTime());
        break;
      case "score":
        sortedGroups.sort((a, b) => b.maxScore - a.maxScore);
        break;
      case "score-asc":
        sortedGroups.sort((a, b) => a.maxScore - b.maxScore);
        break;
      case "date":
      default:
        sortedGroups.sort((a, b) => b.maxDate.getTime() - a.maxDate.getTime());
        break;
    }
    container.innerHTML = "";
    let html2 = "";
    sortedGroups.forEach((group) => {
      const post = state2.postById.get(group.postId);
      const postComments = group.comments;
      if (!post && postComments.length === 0) return;
      const postGroup = {
        postId: group.postId,
        title: post?.title || postComments.find((c) => c.post?.title)?.post?.title || "Unknown Post",
        comments: postComments,
        fullPost: post
      };
      html2 += renderPostGroup(postGroup, state2);
    });
    container.innerHTML = html2;
  };
  const parentRefToStub = (ref, sourceComment) => ({
    _id: ref._id,
    postedAt: ref.postedAt || "",
    parentCommentId: ref.parentCommentId || "",
    user: ref.user ? { ...ref.user, slug: "", karma: 0, htmlBio: "" } : null,
    postId: sourceComment.postId,
    post: sourceComment.post ?? null,
    htmlBody: "",
    baseScore: typeof ref.baseScore === "number" ? ref.baseScore : 0,
    voteCount: 0,
    pageUrl: ref.pageUrl || "",
    author: ref.user?.username || "",
    rejected: false,
    topLevelCommentId: sourceComment.topLevelCommentId || ref._id,
    parentComment: null,
    extendedScore: null,
    afExtendedScore: ref.afExtendedScore ?? null,
    currentUserVote: null,
    currentUserExtendedVote: null,
    contents: { markdown: null },
    descendentCount: 0,
    directChildrenCount: 0,
    contextType: "stub"
  });
  const renderCardItem = (item, state2) => {
    const isPost2 = "title" in item;
    if (isPost2) {
      const post = item;
      const headerHtml = renderPostHeader(post, { isFullPost: true, state: state2 });
      const bodyHtml = post.htmlBody ? renderPostBody(post, false) : "";
      return `
      <div class="pr-archive-item pr-post pr-item" data-id="${post._id}" data-post-id="${post._id}">
        ${headerHtml}
        ${bodyHtml}
      </div>
    `;
    }
    const comment = item;
    const immediateParentId = comment.parentCommentId || comment.parentComment?._id || null;
    const parentFromState = immediateParentId ? state2.commentById.get(immediateParentId) : null;
    const isContextParentFromState = !!parentFromState && !!parentFromState.contextType;
    const parentComment = isContextParentFromState ? parentFromState : comment.parentComment ? parentRefToStub(comment.parentComment, comment) : null;
    if (!parentComment || parentComment._id === comment._id) {
      return `<div class="pr-archive-item">${renderComment(comment, state2)}</div>`;
    }
    const nestedCommentHtml = `<div class="pr-replies">${renderComment(comment, state2)}</div>`;
    return `<div class="pr-archive-item">${renderComment(parentComment, state2, nestedCommentHtml)}</div>`;
  };
  const renderIndexItem = (item) => {
    const isPost2 = "title" in item;
    const title = isPost2 ? item.title : (item.htmlBody || "").replace(/<[^>]+>/g, "").slice(0, 100) + "...";
    const context = isPost2 ? "Post" : `Reply to ${getInterlocutorName(item)}`;
    const date = item.postedAt ? new Date(item.postedAt).toLocaleDateString() : "";
    return `
        <div class="pr-archive-index-item" data-id="${item._id}" data-action="expand-index-item" style="cursor: pointer;">
            <div class="pr-index-score" style="color: ${item.baseScore > 0 ? "var(--pr-highlight)" : "inherit"}">
                ${item.baseScore || 0}
            </div>
            <div class="pr-index-title">
                ${escapeHtml(title)}
            </div>
            <div class="pr-index-meta">
                ${context} • ${date}
            </div>
        </div>
    `;
  };
  const getInterlocutorName = (item) => {
    if ("title" in item) return " (Original Post)";
    const c = item;
    if (c.parentComment?.user?.displayName) return c.parentComment.user.displayName;
    if (c.post?.user?.displayName) return c.post.user.displayName;
    return "Unknown";
  };
  class ArchiveUIHost {
    archiveState;
    readerState;
    feedContainer = null;
    renderCallback = null;
    searchStateRevision = 0;
    canonicalStateRevision = 0;
    constructor(archiveState, feedContainer, renderCallback) {
      this.archiveState = archiveState;
      this.feedContainer = feedContainer;
      this.renderCallback = renderCallback || null;
      this.readerState = this.syncReaderState();
    }
    syncReaderState() {
      const state2 = createInitialState();
      state2.isArchiveMode = true;
      state2.archiveUsername = this.archiveState.username;
      const currentUser = window.LessWrong?.params?.currentUser;
      state2.currentUsername = currentUser?.username || null;
      state2.currentUserId = currentUser?._id || null;
      this.archiveState.items.forEach((item) => {
        if ("title" in item) {
          state2.posts.push(item);
          state2.postById.set(item._id, item);
        } else {
          state2.comments.push(item);
          state2.commentById.set(item._id, item);
        }
      });
      rebuildIndexes(state2);
      return state2;
    }
    getReaderState() {
      return this.readerState;
    }
    getSearchStateRevision() {
      return this.searchStateRevision;
    }
    getCanonicalStateRevision() {
      return this.canonicalStateRevision;
    }
    bumpSearchStateRevision() {
      this.searchStateRevision += 1;
    }
    bumpCanonicalStateRevision() {
      this.canonicalStateRevision += 1;
    }
setContainer(container) {
      this.feedContainer = container;
    }
syncItemToCanonical(item) {
      const id = item._id;
      const exists = this.archiveState.itemById.has(id);
      this.archiveState.itemById.set(id, item);
      if (exists) {
        const existingIndex = this.archiveState.items.findIndex((i) => i._id === id);
        if (existingIndex >= 0) {
          this.archiveState.items[existingIndex] = item;
        }
      } else {
        this.archiveState.items.push(item);
      }
      this.bumpCanonicalStateRevision();
    }
sortCanonicalItems() {
      this.archiveState.items.sort((a, b) => {
        return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
      });
    }
    upsertReaderComment(comment) {
      const idx = this.readerState.comments.findIndex((c) => c._id === comment._id);
      if (idx >= 0) {
        this.readerState.comments[idx] = comment;
      } else {
        this.readerState.comments.push(comment);
      }
      this.readerState.commentById.set(comment._id, comment);
    }
    shouldReplaceExistingComment(existing, incoming, markAsContext) {
      if (!markAsContext) return true;
      const existingType = existing.contextType;
      const incomingType = incoming.contextType;
      const existingIsStub = existingType === "stub" || existingType === "missing";
      const incomingIsStub = incomingType === "stub" || incomingType === "missing";
      const existingHasBody = typeof existing.htmlBody === "string" && existing.htmlBody.trim().length > 0;
      const incomingHasBody = typeof incoming.htmlBody === "string" && incoming.htmlBody.trim().length > 0;
      if (existingIsStub && !incomingIsStub) return true;
      if (!existingHasBody && incomingHasBody) return true;
      if (incomingType === "fetched" && existingType !== "fetched") return true;
      return false;
    }
    mergeComment(existing, incoming, markAsContext) {
      const merged = { ...existing, ...incoming };
      if (existing.forceVisible && !merged.forceVisible) {
        merged.forceVisible = true;
      }
      if (existing.justRevealed && !merged.justRevealed) {
        merged.justRevealed = true;
      }
      if (markAsContext) {
        const existingType = existing.contextType;
        const incomingType = incoming.contextType;
        if (incomingType === "stub" && existingType && existingType !== "stub") {
          merged.contextType = existingType;
        } else if (!incomingType) {
          merged.contextType = existingType || "fetched";
        }
      } else {
        delete merged.contextType;
      }
      return merged;
    }
    persistContextualData(comments = [], posts = []) {
      const username = this.archiveState.username;
      if (!username) return;
      const contextualComments = comments.filter((comment) => {
        const type = comment.contextType;
        if (type === "stub" || type === "missing") return false;
        return !this.archiveState.itemById.has(comment._id);
      });
      const contextualPosts = posts.filter((post) => !this.archiveState.itemById.has(post._id));
      if (contextualComments.length === 0 && contextualPosts.length === 0) return;
      void saveContextualItems(username, contextualComments, contextualPosts).catch((e) => {
        Logger.warn("Failed to persist contextual archive data.", e);
      });
    }
    rerenderAll() {
      if (!this.feedContainer) return;
      const existingContext = this.readerState.comments.filter((c) => !this.archiveState.itemById.has(c._id));
      const existingPosts = this.readerState.posts.filter((p) => !this.archiveState.itemById.has(p._id));
      this.readerState.comments.length = 0;
      this.readerState.posts.length = 0;
      this.readerState.commentById.clear();
      this.readerState.postById.clear();
      this.readerState.childrenByParentId.clear();
      this.archiveState.items.forEach((item) => {
        if ("title" in item) {
          this.readerState.posts.push(item);
          this.readerState.postById.set(item._id, item);
        } else {
          this.readerState.comments.push(item);
          this.readerState.commentById.set(item._id, item);
        }
      });
      existingContext.forEach((c) => {
        if (!this.readerState.commentById.has(c._id)) {
          this.readerState.comments.push(c);
          this.readerState.commentById.set(c._id, c);
        }
      });
      existingPosts.forEach((p) => {
        if (!this.readerState.postById.has(p._id)) {
          this.readerState.posts.push(p);
          this.readerState.postById.set(p._id, p);
        }
      });
      rebuildIndexes(this.readerState);
      this.bumpSearchStateRevision();
      if (this.renderCallback) {
        this.renderCallback();
      } else if (this.feedContainer) {
        renderArchiveFeed(this.feedContainer, this.archiveState.items, this.archiveState.viewMode, this.readerState, this.archiveState.sortBy);
      }
    }
    rerenderPostGroup(postId, anchorCommentId) {
      const postContainer = document.querySelector(`.pr-post[data-id="${postId}"]`);
      if (!postContainer) {
        Logger.warn(`ArchiveUIHost: Container for post ${postId} not found`);
        return;
      }
      let beforeTop = null;
      if (anchorCommentId) {
        const anchorEl = postContainer.querySelector(`.pr-comment[data-id="${anchorCommentId}"]`);
        if (anchorEl) beforeTop = anchorEl.getBoundingClientRect().top;
      }
      const post = this.readerState.postById.get(postId);
      const postComments = this.readerState.comments.filter((c) => c.postId === postId);
      const group = {
        postId,
        title: post?.title || postComments.find((c) => c.post?.title)?.post?.title || "Unknown Post",
        comments: postComments,
        fullPost: post
      };
      postContainer.outerHTML = renderPostGroup(group, this.readerState);
      setupLinkPreviews(this.readerState.comments);
      refreshPostActionButtons(postId);
      if (anchorCommentId && beforeTop !== null) {
        const newAnchor = document.querySelector(`.pr-comment[data-id="${anchorCommentId}"]`);
        if (newAnchor) {
          const afterTop = newAnchor.getBoundingClientRect().top;
          const delta = afterTop - beforeTop;
          const oldScrollY = window.scrollY;
          window.scrollTo(0, Math.max(0, oldScrollY + delta));
        }
      }
    }
    mergeComments(newComments, markAsContext = true, postIdMap) {
      let changed = 0;
      let canonicalTouched = false;
      const contextPosts = new Map();
      const contextCommentsToPersist = [];
      for (const incoming of newComments) {
        if (postIdMap && postIdMap.has(incoming._id)) {
          incoming.postId = postIdMap.get(incoming._id);
        }
        if (markAsContext && !incoming.contextType) {
          incoming.contextType = "fetched";
        }
        if (incoming.post?._id) {
          const rootPost = incoming.post;
          const isCanonicalRootPost = this.archiveState.itemById.has(rootPost._id);
          if (!markAsContext || !isCanonicalRootPost) {
            this.upsertPost(rootPost, false);
          }
          if (!isCanonicalRootPost) {
            contextPosts.set(rootPost._id, rootPost);
          }
        }
        const existing = this.readerState.commentById.get(incoming._id);
        if (!existing) {
          this.upsertReaderComment(incoming);
          changed++;
        } else if (this.shouldReplaceExistingComment(existing, incoming, markAsContext)) {
          const merged = this.mergeComment(existing, incoming, markAsContext);
          this.upsertReaderComment(merged);
          changed++;
        }
        if (!markAsContext) {
          const canonical = this.readerState.commentById.get(incoming._id) || incoming;
          this.syncItemToCanonical(canonical);
          canonicalTouched = true;
        } else if (incoming.contextType !== "stub" && incoming.contextType !== "missing") {
          const contextual = this.readerState.commentById.get(incoming._id) || incoming;
          contextCommentsToPersist.push(contextual);
        }
      }
      if (canonicalTouched) {
        this.sortCanonicalItems();
      }
      if (changed > 0) {
        rebuildIndexes(this.readerState);
      }
      if (changed > 0 || canonicalTouched) {
        this.bumpSearchStateRevision();
      }
      if (markAsContext && (contextCommentsToPersist.length > 0 || contextPosts.size > 0)) {
        this.persistContextualData(contextCommentsToPersist, Array.from(contextPosts.values()));
      }
      return changed;
    }
    upsertPost(post, persistContext = true) {
      const isCanonicalPost = this.archiveState.itemById.has(post._id);
      if (!this.readerState.postById.has(post._id)) {
        this.readerState.posts.push(post);
      } else {
        const idx = this.readerState.posts.findIndex((p) => p._id === post._id);
        if (idx >= 0) this.readerState.posts[idx] = post;
      }
      this.readerState.postById.set(post._id, post);
      if (isCanonicalPost) {
        this.syncItemToCanonical(post);
        this.sortCanonicalItems();
      } else {
        if (!post.contextType) post.contextType = "fetched";
        if (persistContext) {
          this.persistContextualData([], [post]);
        }
      }
      this.bumpSearchStateRevision();
    }
  }
  const isContentClause = (clause) => clause.kind === "term" || clause.kind === "phrase" || clause.kind === "regex" || clause.kind === "wildcard";
  const isPositiveContentClause = (clause) => isContentClause(clause) && !clause.negated;
  const isPositiveContentWithoutWildcard = (clause) => isPositiveContentClause(clause) && clause.kind !== "wildcard";
  const HTML_TAG_PATTERN = /<[^>]+>/g;
  const WHITESPACE_PATTERN = /\s+/g;
  const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;
  const MARKDOWN_IMAGE_PATTERN = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const MARKDOWN_FORMATTING_PATTERN = /(^|\s)[>#*_~`-]+(?=\s|$)/gm;
  const MARKDOWN_CODE_FENCE_PATTERN = /```/g;
  const MARKDOWN_INLINE_CODE_PATTERN = /`/g;
  const MARKDOWN_LATEX_PATTERN = /\$\$?/g;
  const PUNCT_FOLD_PATTERN = /[^\p{L}\p{N}\s]/gu;
  const APOSTROPHE_PATTERN = /['’]/g;
  const TOKEN_SPLIT_PATTERN = /\s+/g;
  const COMMON_ENTITIES = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
    "&#x27;": "'",
    "&#x2F;": "/"
  };
  const ENTITY_PATTERN = /&(?:#(?:x[0-9a-fA-F]+|\d+)|[a-z][a-z0-9]*);/gi;
  const decodeHtmlEntities = (html2) => {
    if (typeof document !== "undefined") {
      const textarea = document.createElement("textarea");
      textarea.innerHTML = html2;
      return textarea.value;
    }
    return html2.replace(ENTITY_PATTERN, (entity) => {
      const known = COMMON_ENTITIES[entity.toLowerCase()];
      if (known) return known;
      if (entity.startsWith("&#x")) {
        const code = parseInt(entity.slice(3, -1), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
      }
      if (entity.startsWith("&#")) {
        const code = parseInt(entity.slice(2, -1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
      }
      return entity;
    });
  };
  const collapseWhitespace = (value) => value.replace(WHITESPACE_PATTERN, " ").trim();
  const stripHtmlToText = (html2) => {
    const decoded = decodeHtmlEntities(html2);
    return collapseWhitespace(decoded.replace(HTML_TAG_PATTERN, " "));
  };
  const stripMarkdownFormatting = (markdown) => {
    let text2 = markdown;
    text2 = text2.replace(MARKDOWN_IMAGE_PATTERN, "$1");
    text2 = text2.replace(MARKDOWN_LINK_PATTERN, "$1");
    text2 = text2.replace(MARKDOWN_CODE_FENCE_PATTERN, " ");
    text2 = text2.replace(MARKDOWN_INLINE_CODE_PATTERN, "");
    text2 = text2.replace(MARKDOWN_LATEX_PATTERN, "");
    text2 = text2.replace(MARKDOWN_FORMATTING_PATTERN, "$1");
    return collapseWhitespace(text2);
  };
  const normalizeForSearch = (value) => {
    if (!value) return "";
    const nfkc = value.normalize("NFKC").toLowerCase();
    return collapseWhitespace(nfkc.replace(APOSTROPHE_PATTERN, "").replace(PUNCT_FOLD_PATTERN, " "));
  };
  const normalizeBody = (item) => {
    const markdown = item.contents?.markdown;
    if (typeof markdown === "string" && markdown.trim().length > 0) {
      return normalizeForSearch(stripMarkdownFormatting(markdown));
    }
    const htmlBody = typeof item.htmlBody === "string" ? item.htmlBody : "";
    return normalizeForSearch(stripHtmlToText(htmlBody));
  };
  const normalizeTitle = (item) => "title" in item && typeof item.title === "string" ? normalizeForSearch(item.title) : "";
  const getItemType = (item) => "title" in item ? "post" : "comment";
  const getAuthorDisplayName = (item) => {
    if (item.user?.displayName) return item.user.displayName;
    if (item.user?.username) return item.user.username;
    return "";
  };
  const getReplyToDisplayName = (item) => {
    if ("title" in item) return "";
    if (item.parentComment?.user?.displayName) return item.parentComment.user.displayName;
    if (item.post?.user?.displayName) return item.post.user.displayName;
    return "";
  };
  const buildArchiveSearchDoc = (item, source) => {
    const titleNorm = normalizeTitle(item);
    const bodyNorm = normalizeBody(item);
    return {
      id: item._id,
      itemType: getItemType(item),
      source,
      postedAtMs: Number.isFinite(new Date(item.postedAt).getTime()) ? new Date(item.postedAt).getTime() : 0,
      baseScore: typeof item.baseScore === "number" ? item.baseScore : 0,
      authorNameNorm: normalizeForSearch(getAuthorDisplayName(item)),
      replyToNorm: normalizeForSearch(getReplyToDisplayName(item)),
      titleNorm,
      bodyNorm
    };
  };
  const tokenizeForIndex = (normText) => {
    if (!normText) return [];
    const tokens = normText.split(TOKEN_SPLIT_PATTERN);
    const output = [];
    const seen = new Set();
    for (const token of tokens) {
      if (!token || token.length < 2) continue;
      if (seen.has(token)) continue;
      seen.add(token);
      output.push(token);
    }
    return output;
  };
  const MAX_REGEX_PATTERN_LENGTH = 512;
  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  const UTC_DAY_MS = 24 * 60 * 60 * 1e3;
  const tokenizeQuery = (query) => {
    const tokens = [];
    let i = 0;
    while (i < query.length) {
      while (i < query.length && /\s/.test(query[i])) i++;
      if (i >= query.length) break;
      const start = i;
      let cursor = i;
      let inQuote = false;
      const startsWithNegation = query[cursor] === "-";
      if (startsWithNegation) cursor++;
      const startsRegexLiteral = query[cursor] === "/";
      if (startsRegexLiteral) {
        cursor++;
        let escaped2 = false;
        while (cursor < query.length) {
          const ch = query[cursor];
          if (!escaped2 && ch === "/") {
            cursor++;
            while (cursor < query.length && /[a-z]/i.test(query[cursor])) {
              cursor++;
            }
            break;
          }
          if (!escaped2 && ch === "\\") {
            escaped2 = true;
          } else {
            escaped2 = false;
          }
          cursor++;
        }
        while (cursor < query.length && !/\s/.test(query[cursor])) {
          cursor++;
        }
        tokens.push(query.slice(start, cursor));
        i = cursor;
        continue;
      }
      let escaped = false;
      while (cursor < query.length) {
        const ch = query[cursor];
        if (!escaped && ch === '"') {
          inQuote = !inQuote;
          cursor++;
          continue;
        }
        if (!inQuote && /\s/.test(ch)) {
          break;
        }
        escaped = !escaped && ch === "\\";
        cursor++;
      }
      tokens.push(query.slice(start, cursor));
      i = cursor;
    }
    return tokens;
  };
  const parseRegexLiteral = (token) => {
    if (!token.startsWith("/")) return null;
    let i = 1;
    let escaped = false;
    while (i < token.length) {
      const ch = token[i];
      if (!escaped && ch === "/") {
        const pattern = token.slice(1, i);
        const flags = token.slice(i + 1);
        if (!/^[a-z]*$/i.test(flags)) return null;
        return { raw: token, pattern, flags };
      }
      if (!escaped && ch === "\\") {
        escaped = true;
      } else {
        escaped = false;
      }
      i++;
    }
    return null;
  };
  const addWarning = (warnings, type, token, message) => {
    warnings.push({ type, token, message });
  };
  const removeOuterQuotes = (value) => {
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    }
    return value;
  };
  const parseNumber = (value) => {
    if (!/^-?\d+$/.test(value.trim())) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  };
  const parseScoreClause = (value, negated) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith(">")) {
      const n = parseNumber(trimmed.slice(1));
      if (n === null) return null;
      return { kind: "score", negated, op: "gt", min: n, includeMin: false, includeMax: false };
    }
    if (trimmed.startsWith("<")) {
      const n = parseNumber(trimmed.slice(1));
      if (n === null) return null;
      return { kind: "score", negated, op: "lt", max: n, includeMin: false, includeMax: false };
    }
    if (trimmed.includes("..")) {
      const [minRaw, maxRaw] = trimmed.split("..");
      const min = parseNumber(minRaw);
      const max = parseNumber(maxRaw);
      if (min === null || max === null) return null;
      return { kind: "score", negated, op: "range", min, max, includeMin: true, includeMax: true };
    }
    const exact = parseNumber(trimmed);
    if (exact === null) return null;
    return { kind: "score", negated, op: "range", min: exact, max: exact, includeMin: true, includeMax: true };
  };
  const parseUtcDayBounds = (value) => {
    if (!DATE_PATTERN.test(value)) return null;
    const [yearRaw, monthRaw, dayRaw] = value.split("-");
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const startMs = Date.UTC(year, month - 1, day);
    const parsed = new Date(startMs);
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
      return null;
    }
    return {
      startMs,
      endMs: startMs + UTC_DAY_MS - 1
    };
  };
  const parseDateClause = (value, negated) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith(">")) {
      const bounds = parseUtcDayBounds(trimmed.slice(1));
      if (!bounds) return null;
      return { kind: "date", negated, op: "gt", minMs: bounds.endMs, includeMin: false, includeMax: false };
    }
    if (trimmed.startsWith("<")) {
      const bounds = parseUtcDayBounds(trimmed.slice(1));
      if (!bounds) return null;
      return { kind: "date", negated, op: "lt", maxMs: bounds.startMs, includeMin: false, includeMax: false };
    }
    if (trimmed.includes("..")) {
      const [startRaw, endRaw] = trimmed.split("..");
      const hasStart = startRaw.trim().length > 0;
      const hasEnd = endRaw.trim().length > 0;
      if (!hasStart && !hasEnd) return null;
      const startBounds = hasStart ? parseUtcDayBounds(startRaw) : null;
      const endBounds = hasEnd ? parseUtcDayBounds(endRaw) : null;
      if (hasStart && !startBounds || hasEnd && !endBounds) return null;
      return {
        kind: "date",
        negated,
        op: "range",
        minMs: startBounds?.startMs,
        maxMs: endBounds?.endMs,
        includeMin: true,
        includeMax: true
      };
    }
    const day = parseUtcDayBounds(trimmed);
    if (!day) return null;
    return {
      kind: "date",
      negated,
      op: "range",
      minMs: day.startMs,
      maxMs: day.endMs,
      includeMin: true,
      includeMax: true
    };
  };
  const maybeParseFieldClause = (token, negated, scopeDirectives, warnings, executableTokens) => {
    const colonIndex = token.indexOf(":");
    if (colonIndex <= 0) return { handled: false, clause: null };
    const operator = token.slice(0, colonIndex).toLowerCase();
    const valueRaw = token.slice(colonIndex + 1);
    const value = removeOuterQuotes(valueRaw);
    switch (operator) {
      case "type": {
        const normalized = value.toLowerCase();
        if (normalized !== "post" && normalized !== "comment") {
          addWarning(warnings, "invalid-type", token, `Unsupported type filter: ${value}`);
          return { handled: true, clause: null };
        }
        executableTokens.push(`${negated ? "-" : ""}type:${normalized}`);
        return { handled: true, clause: { kind: "type", negated, itemType: normalized } };
      }
      case "author": {
        const normalized = normalizeForSearch(value);
        if (!normalized) {
          addWarning(warnings, "invalid-query", token, "author filter requires a value");
          return { handled: true, clause: null };
        }
        executableTokens.push(`${negated ? "-" : ""}author:"${normalized}"`);
        return { handled: true, clause: { kind: "author", negated, valueNorm: normalized } };
      }
      case "replyto": {
        const normalized = normalizeForSearch(value);
        if (!normalized) {
          addWarning(warnings, "invalid-query", token, "replyto filter requires a value");
          return { handled: true, clause: null };
        }
        executableTokens.push(`${negated ? "-" : ""}replyto:"${normalized}"`);
        return { handled: true, clause: { kind: "replyto", negated, valueNorm: normalized } };
      }
      case "scope": {
        const normalized = value.toLowerCase();
        if (normalized === "authored" || normalized === "all") {
          scopeDirectives.push(normalized);
        } else {
          addWarning(warnings, "invalid-scope", token, `Unsupported scope value: ${value}`);
        }
        return { handled: true, clause: null };
      }
      case "score": {
        const parsed = parseScoreClause(valueRaw, negated);
        if (!parsed) {
          addWarning(warnings, "malformed-score", token, `Malformed score filter: ${valueRaw}`);
          return { handled: true, clause: null };
        }
        executableTokens.push(`${negated ? "-" : ""}score:${valueRaw}`);
        return { handled: true, clause: parsed };
      }
      case "date": {
        const parsed = parseDateClause(valueRaw, negated);
        if (!parsed) {
          addWarning(warnings, "malformed-date", token, `Malformed date filter: ${valueRaw}`);
          return { handled: true, clause: null };
        }
        executableTokens.push(`${negated ? "-" : ""}date:${valueRaw}`);
        return { handled: true, clause: parsed };
      }
      case "sort": {
        addWarning(warnings, "reserved-operator", token, "sort: is controlled by the sort dropdown");
        return { handled: true, clause: null };
      }
      default:
        return { handled: false, clause: null };
    }
  };
  const containsUnsafeRegexPattern = (pattern) => /(\([^)]*[+*][^)]*\)[+*])/.test(pattern) || /(\+|\*|\{[^}]+\})\s*(\+|\*|\{[^}]+\})/.test(pattern);
  const serializeNormalizedTermToken = (termNorm) => termNorm.includes(" ") ? termNorm.replace(/\s+/g, "-") : termNorm;
  const parseStructuredQuery = (query) => {
    const trimmed = query.trim();
    const warnings = [];
    const scopeDirectives = [];
    const clauses = [];
    const executableTokens = [];
    let wildcardSeen = false;
    if (!trimmed) {
      return {
        rawQuery: query,
        executableQuery: "",
        clauses,
        scopeDirectives,
        warnings
      };
    }
    const tokens = tokenizeQuery(trimmed);
    for (const rawToken of tokens) {
      if (!rawToken) continue;
      const negated = rawToken.startsWith("-");
      const token = negated ? rawToken.slice(1) : rawToken;
      if (!token) continue;
      const regexLiteral = parseRegexLiteral(token);
      if (regexLiteral) {
        if (regexLiteral.pattern.length > MAX_REGEX_PATTERN_LENGTH) {
          addWarning(warnings, "regex-too-long", rawToken, "Regex pattern exceeds the 512 character safety limit");
          continue;
        }
        if (containsUnsafeRegexPattern(regexLiteral.pattern)) {
          addWarning(warnings, "regex-unsafe", rawToken, "Regex pattern rejected by safety lint");
          continue;
        }
        try {
          const safeFlags = regexLiteral.flags.replace(/[gy]/g, "");
          const regex = new RegExp(regexLiteral.pattern, safeFlags);
          clauses.push({
            kind: "regex",
            negated,
            raw: rawToken,
            pattern: regexLiteral.pattern,
            flags: safeFlags,
            regex
          });
          executableTokens.push(rawToken);
          continue;
        } catch {
          addWarning(warnings, "invalid-regex", rawToken, "Invalid regex literal");
          continue;
        }
      }
      if (token.startsWith("/")) {
        addWarning(warnings, "invalid-regex", rawToken, "Invalid regex literal");
        continue;
      }
      const fieldResult = maybeParseFieldClause(token, negated, scopeDirectives, warnings, executableTokens);
      if (fieldResult.handled) {
        if (fieldResult.clause) {
          clauses.push(fieldResult.clause);
        }
        continue;
      }
      if (token.includes(":") && /^[a-z][a-z0-9_]*:/i.test(token)) {
        addWarning(warnings, "unknown-operator", rawToken, `Unsupported operator treated as plain term: ${token}`);
      }
      if (token === "*") {
        if (!wildcardSeen) {
          clauses.push({ kind: "wildcard", negated });
          executableTokens.push(rawToken);
          wildcardSeen = true;
        }
        continue;
      }
      if (token.startsWith('"') && token.endsWith('"') && token.length >= 2) {
        const phraseNorm = normalizeForSearch(removeOuterQuotes(token));
        if (phraseNorm) {
          clauses.push({ kind: "phrase", negated, valueNorm: phraseNorm });
          executableTokens.push(`${negated ? "-" : ""}"${phraseNorm}"`);
        }
        continue;
      }
      const termNorm = normalizeForSearch(token);
      if (termNorm) {
        clauses.push({ kind: "term", negated, valueNorm: termNorm });
        executableTokens.push(`${negated ? "-" : ""}${serializeNormalizedTermToken(termNorm)}`);
      }
    }
    const hasPositiveContentClause = clauses.some(isPositiveContentWithoutWildcard);
    const filteredClauses = clauses.filter((clause) => !(clause.kind === "wildcard" && hasPositiveContentClause));
    const hasNegatedClause = filteredClauses.some((clause) => clause.negated);
    const hasAnyPositiveClause = filteredClauses.some((clause) => !clause.negated);
    if (hasNegatedClause && !hasAnyPositiveClause) {
      addWarning(warnings, "negation-only", trimmed, "Queries containing only negations are not allowed");
    }
    return {
      rawQuery: query,
      executableQuery: executableTokens.join(" ").trim(),
      clauses: filteredClauses,
      scopeDirectives,
      warnings
    };
  };
  const buildExecutionPlan = (clauses) => {
    const stageA = [];
    const stageB = [];
    const negations = [];
    for (const clause of clauses) {
      if (clause.negated) {
        negations.push(clause);
        continue;
      }
      switch (clause.kind) {
        case "type":
        case "author":
        case "replyto":
        case "score":
        case "date":
          stageA.push(clause);
          break;
        case "term":
          if (clause.valueNorm.length >= 2) {
            stageA.push(clause);
          } else {
            stageB.push(clause);
          }
          break;
        case "phrase":
        case "regex":
        case "wildcard":
          stageB.push(clause);
          break;
        default:
          stageB.push(clause);
          break;
      }
    }
    return { stageA, stageB, negations };
  };
  const compareSourcePriority = (a, b) => {
    if (a.source === b.source) return 0;
    return a.source === "authored" ? -1 : 1;
  };
  const compareStableTail = (a, b) => {
    const sourceCmp = compareSourcePriority(a, b);
    if (sourceCmp !== 0) return sourceCmp;
    const dateCmp = b.postedAtMs - a.postedAtMs;
    if (dateCmp !== 0) return dateCmp;
    return a.id.localeCompare(b.id);
  };
  const compareReplyTo = (a, b) => {
    const aEmpty = a.replyToNorm.length === 0;
    const bEmpty = b.replyToNorm.length === 0;
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
    const nameCmp = a.replyToNorm.localeCompare(b.replyToNorm);
    if (nameCmp !== 0) return nameCmp;
    return compareStableTail(a, b);
  };
  const computeRelevanceScore = (signals) => {
    let score = 0;
    score += signals.tokenHits * 10;
    score += signals.phraseHits * 15;
    if (signals.authorHit) score += 8;
    if (signals.replyToHit) score += 6;
    return score;
  };
  const sortSearchDocs = (docs, sortMode, relevanceSignalsById) => {
    const sorted = [...docs];
    switch (sortMode) {
      case "date-asc":
        sorted.sort((a, b) => {
          const cmp = a.postedAtMs - b.postedAtMs;
          if (cmp !== 0) return cmp;
          return compareStableTail(a, b);
        });
        return sorted;
      case "score":
        sorted.sort((a, b) => {
          const cmp = b.baseScore - a.baseScore;
          if (cmp !== 0) return cmp;
          return compareStableTail(a, b);
        });
        return sorted;
      case "score-asc":
        sorted.sort((a, b) => {
          const cmp = a.baseScore - b.baseScore;
          if (cmp !== 0) return cmp;
          return compareStableTail(a, b);
        });
        return sorted;
      case "replyTo":
        sorted.sort(compareReplyTo);
        return sorted;
      case "relevance":
        sorted.sort((a, b) => {
          const aSignals = relevanceSignalsById.get(a.id) || {
            tokenHits: 0,
            phraseHits: 0,
            authorHit: false,
            replyToHit: false
          };
          const bSignals = relevanceSignalsById.get(b.id) || {
            tokenHits: 0,
            phraseHits: 0,
            authorHit: false,
            replyToHit: false
          };
          const scoreCmp = computeRelevanceScore(bSignals) - computeRelevanceScore(aSignals);
          if (scoreCmp !== 0) return scoreCmp;
          const dateCmp = b.postedAtMs - a.postedAtMs;
          if (dateCmp !== 0) return dateCmp;
          return a.id.localeCompare(b.id);
        });
        return sorted;
      case "date":
      default:
        sorted.sort((a, b) => {
          const cmp = b.postedAtMs - a.postedAtMs;
          if (cmp !== 0) return cmp;
          return compareStableTail(a, b);
        });
        return sorted;
    }
  };
  const addPosting = (index, token, ordinal) => {
    const postings = index.get(token);
    if (postings) {
      postings.push(ordinal);
      return;
    }
    index.set(token, [ordinal]);
  };
  const compactPostings = (mutable) => {
    const compact = new Map();
    mutable.forEach((postings, token) => {
      postings.sort((a, b) => a - b);
      compact.set(token, Uint32Array.from(postings));
    });
    return compact;
  };
  const appendPosting = (index, token, ordinal) => {
    const postings = index.get(token);
    if (!postings) {
      index.set(token, Uint32Array.of(ordinal));
      return;
    }
    const next = new Uint32Array(postings.length + 1);
    next.set(postings);
    next[postings.length] = ordinal;
    index.set(token, next);
  };
  const buildIndexes = (docs) => {
    const tokenMutable = new Map();
    const authorMutable = new Map();
    const replyToMutable = new Map();
    for (let ordinal = 0; ordinal < docs.length; ordinal++) {
      const doc = docs[ordinal];
      const seenContentTokens = new Set();
      for (const token of tokenizeForIndex(doc.titleNorm)) {
        if (seenContentTokens.has(token)) continue;
        seenContentTokens.add(token);
        addPosting(tokenMutable, token, ordinal);
      }
      for (const token of tokenizeForIndex(doc.bodyNorm)) {
        if (seenContentTokens.has(token)) continue;
        seenContentTokens.add(token);
        addPosting(tokenMutable, token, ordinal);
      }
      for (const token of tokenizeForIndex(doc.authorNameNorm)) {
        addPosting(authorMutable, token, ordinal);
      }
      for (const token of tokenizeForIndex(doc.replyToNorm)) {
        addPosting(replyToMutable, token, ordinal);
      }
    }
    return {
      tokenIndex: compactPostings(tokenMutable),
      authorIndex: compactPostings(authorMutable),
      replyToIndex: compactPostings(replyToMutable)
    };
  };
  const buildCorpusIndex = (source, items) => {
    const docs = items.map((item) => buildArchiveSearchDoc(item, source));
    const docOrdinalsById = new Map();
    const itemsById = new Map();
    docs.forEach((doc, ordinal) => {
      docOrdinalsById.set(doc.id, ordinal);
      itemsById.set(doc.id, items[ordinal]);
    });
    const indexes = buildIndexes(docs);
    return {
      source,
      docs,
      itemsById,
      docOrdinalsById,
      ...indexes
    };
  };
  const appendItemsToCorpusIndex = (index, source, upserts) => {
    if (upserts.length === 0) return;
    for (const item of upserts) {
      if (index.docOrdinalsById.has(item._id)) continue;
      const doc = buildArchiveSearchDoc(item, source);
      const ordinal = index.docs.length;
      index.docs.push(doc);
      index.docOrdinalsById.set(doc.id, ordinal);
      index.itemsById.set(doc.id, item);
      const seenContentTokens = new Set();
      for (const token of tokenizeForIndex(doc.titleNorm)) {
        if (seenContentTokens.has(token)) continue;
        seenContentTokens.add(token);
        appendPosting(index.tokenIndex, token, ordinal);
      }
      for (const token of tokenizeForIndex(doc.bodyNorm)) {
        if (seenContentTokens.has(token)) continue;
        seenContentTokens.add(token);
        appendPosting(index.tokenIndex, token, ordinal);
      }
      for (const token of tokenizeForIndex(doc.authorNameNorm)) {
        appendPosting(index.authorIndex, token, ordinal);
      }
      for (const token of tokenizeForIndex(doc.replyToNorm)) {
        appendPosting(index.replyToIndex, token, ordinal);
      }
    }
  };
  const DEFAULT_BUDGET_MS = 150;
  const createEmptySignals = () => ({
    tokenHits: 0,
    phraseHits: 0,
    authorHit: false,
    replyToHit: false
  });
  const upsertSignal = (signalMap, ordinal) => {
    const existing = signalMap.get(ordinal);
    if (existing) return existing;
    const created = createEmptySignals();
    signalMap.set(ordinal, created);
    return created;
  };
  const allOrdinalsSet = (docCount) => {
    const output = new Set();
    for (let i = 0; i < docCount; i++) output.add(i);
    return output;
  };
  const intersectSets = (a, b) => {
    const [small, large] = a.size < b.size ? [a, b] : [b, a];
    const out = new Set();
    small.forEach((value) => {
      if (large.has(value)) out.add(value);
    });
    return out;
  };
  const postingsToSet = (postings) => {
    const out = new Set();
    for (let i = 0; i < postings.length; i++) out.add(postings[i]);
    return out;
  };
  const maybeIntersectWithCandidate = (candidate, current) => {
    if (!candidate) return current;
    return intersectSets(candidate, current);
  };
  const getTokenPostingIntersection = (index, tokens, docCount) => {
    if (tokens.length === 0) return allOrdinalsSet(docCount);
    let result = null;
    for (const token of tokens) {
      const postings = index.get(token);
      if (!postings) return new Set();
      const postingSet = postingsToSet(postings);
      result = result ? intersectSets(result, postingSet) : postingSet;
      if (result.size === 0) return result;
    }
    return result || new Set();
  };
  const tryApplyAppendOnlyPatch = (index, source, items) => {
    if (items.length < index.docs.length) return false;
    const nextById = new Map();
    for (const item of items) {
      nextById.set(item._id, item);
    }
    for (const id of index.docOrdinalsById.keys()) {
      const nextItem = nextById.get(id);
      if (!nextItem) return false;
      if (index.itemsById.get(id) !== nextItem) return false;
    }
    const upserts = [];
    for (const item of items) {
      if (!index.docOrdinalsById.has(item._id)) {
        upserts.push(item);
      }
    }
    appendItemsToCorpusIndex(index, source, upserts);
    return true;
  };
  const matchesScoreClause = (doc, clause) => {
    const value = doc.baseScore;
    if (clause.op === "gt") {
      return clause.includeMin ? value >= (clause.min ?? Number.NEGATIVE_INFINITY) : value > (clause.min ?? Number.NEGATIVE_INFINITY);
    }
    if (clause.op === "lt") {
      return clause.includeMax ? value <= (clause.max ?? Number.POSITIVE_INFINITY) : value < (clause.max ?? Number.POSITIVE_INFINITY);
    }
    const minOk = clause.min === void 0 ? true : clause.includeMin ? value >= clause.min : value > clause.min;
    const maxOk = clause.max === void 0 ? true : clause.includeMax ? value <= clause.max : value < clause.max;
    return minOk && maxOk;
  };
  const matchesDateClause = (doc, clause) => {
    const value = doc.postedAtMs;
    if (clause.op === "gt") {
      return clause.includeMin ? value >= (clause.minMs ?? Number.NEGATIVE_INFINITY) : value > (clause.minMs ?? Number.NEGATIVE_INFINITY);
    }
    if (clause.op === "lt") {
      return clause.includeMax ? value <= (clause.maxMs ?? Number.POSITIVE_INFINITY) : value < (clause.maxMs ?? Number.POSITIVE_INFINITY);
    }
    const minOk = clause.minMs === void 0 ? true : clause.includeMin ? value >= clause.minMs : value > clause.minMs;
    const maxOk = clause.maxMs === void 0 ? true : clause.includeMax ? value <= clause.maxMs : value < clause.maxMs;
    return minOk && maxOk;
  };
  const matchesNormalizedText = (doc, valueNorm) => doc.titleNorm.includes(valueNorm) || doc.bodyNorm.includes(valueNorm);
  const matchesClause = (doc, clause) => {
    switch (clause.kind) {
      case "term":
        return matchesNormalizedText(doc, clause.valueNorm);
      case "phrase":
        return doc.titleNorm.includes(clause.valueNorm) || doc.bodyNorm.includes(clause.valueNorm);
      case "regex":
        clause.regex.lastIndex = 0;
        if (clause.regex.test(doc.titleNorm)) return true;
        clause.regex.lastIndex = 0;
        return clause.regex.test(doc.bodyNorm);
      case "wildcard":
        return true;
      case "type":
        return doc.itemType === clause.itemType;
      case "author":
        return doc.authorNameNorm.includes(clause.valueNorm);
      case "replyto":
        return doc.replyToNorm.includes(clause.valueNorm);
      case "score":
        return matchesScoreClause(doc, clause);
      case "date":
        return matchesDateClause(doc, clause);
      default:
        return false;
    }
  };
  const executeAgainstCorpus = (corpus, clauses, startMs, budgetMs) => {
    const plan = buildExecutionPlan(clauses);
    const docCount = corpus.docs.length;
    const relevanceSignalsByOrdinal = new Map();
    let partialResults = false;
    let stageBScanned = 0;
    const deferredStageAClauses = [];
    const budgetExceeded = () => budgetMs > 0 && Date.now() - startMs > budgetMs;
    let candidateOrdinals = null;
    for (const clause of plan.stageA) {
      if (budgetExceeded()) {
        partialResults = true;
        deferredStageAClauses.push(clause);
        continue;
      }
      let matched = new Set();
      switch (clause.kind) {
        case "term": {
          const termTokens = tokenizeForIndex(clause.valueNorm);
          if (termTokens.length === 0) {
            for (let ordinal = 0; ordinal < corpus.docs.length; ordinal++) {
              if (budgetExceeded()) {
                partialResults = true;
                break;
              }
              const doc = corpus.docs[ordinal];
              if (matchesNormalizedText(doc, clause.valueNorm)) {
                matched.add(ordinal);
              }
            }
          } else if (termTokens.length === 1 && termTokens[0] === clause.valueNorm) {
            const postings = corpus.tokenIndex.get(clause.valueNorm);
            matched = postings ? postingsToSet(postings) : new Set();
          } else {
            const accelerated = getTokenPostingIntersection(corpus.tokenIndex, termTokens, docCount);
            accelerated.forEach((ordinal) => {
              const doc = corpus.docs[ordinal];
              if (!matchesNormalizedText(doc, clause.valueNorm)) return;
              matched.add(ordinal);
            });
          }
          matched.forEach((ordinal) => {
            const signal = upsertSignal(relevanceSignalsByOrdinal, ordinal);
            signal.tokenHits += 1;
          });
          break;
        }
        case "author": {
          const nameTokens = tokenizeForIndex(clause.valueNorm);
          const accelerated = getTokenPostingIntersection(corpus.authorIndex, nameTokens, docCount);
          accelerated.forEach((ordinal) => {
            const doc = corpus.docs[ordinal];
            if (!doc.authorNameNorm.includes(clause.valueNorm)) return;
            matched.add(ordinal);
            const signal = upsertSignal(relevanceSignalsByOrdinal, ordinal);
            signal.authorHit = true;
          });
          break;
        }
        case "replyto": {
          const nameTokens = tokenizeForIndex(clause.valueNorm);
          const accelerated = getTokenPostingIntersection(corpus.replyToIndex, nameTokens, docCount);
          accelerated.forEach((ordinal) => {
            const doc = corpus.docs[ordinal];
            if (!doc.replyToNorm.includes(clause.valueNorm)) return;
            matched.add(ordinal);
            const signal = upsertSignal(relevanceSignalsByOrdinal, ordinal);
            signal.replyToHit = true;
          });
          break;
        }
        case "type":
        case "score":
        case "date": {
          for (let ordinal = 0; ordinal < corpus.docs.length; ordinal++) {
            if (budgetExceeded()) {
              partialResults = true;
              break;
            }
            const doc = corpus.docs[ordinal];
            if (matchesClause(doc, clause)) {
              matched.add(ordinal);
            }
          }
          break;
        }
      }
      candidateOrdinals = maybeIntersectWithCandidate(candidateOrdinals, matched);
      if (candidateOrdinals.size === 0) {
        break;
      }
    }
    const hasPositiveContent = clauses.some(isPositiveContentClause);
    const stageASeeded = candidateOrdinals !== null;
    if (!candidateOrdinals) {
      candidateOrdinals = allOrdinalsSet(docCount);
    }
    for (const clause of deferredStageAClauses) {
      const filtered = new Set();
      candidateOrdinals.forEach((ordinal) => {
        const doc = corpus.docs[ordinal];
        if (matchesClause(doc, clause)) {
          filtered.add(ordinal);
        }
      });
      candidateOrdinals = filtered;
      if (candidateOrdinals.size === 0) break;
    }
    if (hasPositiveContent) {
      const filtered = new Set();
      candidateOrdinals.forEach((ordinal) => {
        if (budgetExceeded()) {
          partialResults = true;
          return;
        }
        const doc = corpus.docs[ordinal];
        stageBScanned++;
        let stageBTokenHits = 0;
        let stageBPhraseHits = 0;
        let matched = true;
        for (const clause of plan.stageB) {
          if (!matchesClause(doc, clause)) {
            matched = false;
            break;
          }
          if (clause.kind === "phrase") {
            stageBPhraseHits += 1;
          }
          if (clause.kind === "term") {
            stageBTokenHits += 1;
          }
        }
        if (matched) {
          if (stageBPhraseHits > 0 || stageBTokenHits > 0) {
            const signal = upsertSignal(relevanceSignalsByOrdinal, ordinal);
            signal.phraseHits += stageBPhraseHits;
            signal.tokenHits += stageBTokenHits;
          }
          filtered.add(ordinal);
        }
      });
      candidateOrdinals = filtered;
    } else if (!stageASeeded && plan.stageB.length > 0) {
      const filtered = new Set();
      for (let ordinal = 0; ordinal < corpus.docs.length; ordinal++) {
        if (budgetExceeded()) {
          partialResults = true;
          break;
        }
        const doc = corpus.docs[ordinal];
        stageBScanned++;
        let stageBTokenHits = 0;
        let stageBPhraseHits = 0;
        let matched = true;
        for (const clause of plan.stageB) {
          if (!matchesClause(doc, clause)) {
            matched = false;
            break;
          }
          if (clause.kind === "phrase") stageBPhraseHits += 1;
          if (clause.kind === "term") stageBTokenHits += 1;
        }
        if (matched) {
          if (stageBPhraseHits > 0 || stageBTokenHits > 0) {
            const signal = upsertSignal(relevanceSignalsByOrdinal, ordinal);
            signal.phraseHits += stageBPhraseHits;
            signal.tokenHits += stageBTokenHits;
          }
          filtered.add(ordinal);
        }
      }
      candidateOrdinals = filtered;
    }
    if (plan.negations.length > 0) {
      const filtered = new Set();
      candidateOrdinals.forEach((ordinal) => {
        if (budgetExceeded()) {
          partialResults = true;
          return;
        }
        const doc = corpus.docs[ordinal];
        const excluded = plan.negations.some((clause) => matchesClause(doc, clause));
        if (!excluded) filtered.add(ordinal);
      });
      candidateOrdinals = filtered;
    }
    const docs = Array.from(candidateOrdinals.values()).map((ordinal) => corpus.docs[ordinal]);
    const relevanceSignalsById = new Map();
    const finalCandidateOrdinals = candidateOrdinals;
    relevanceSignalsByOrdinal.forEach((signals, ordinal) => {
      if (!finalCandidateOrdinals.has(ordinal)) return;
      const doc = corpus.docs[ordinal];
      relevanceSignalsById.set(doc.id, signals);
    });
    return {
      docs,
      relevanceSignalsById,
      stageACandidateCount: candidateOrdinals.size,
      stageBScanned,
      partialResults
    };
  };
  class ArchiveSearchRuntime {
    authoredIndex = buildCorpusIndex("authored", []);
    contextIndex = buildCorpusIndex("context", []);
    authoredItemsRef = null;
    authoredRevisionToken = 0;
    contextItemsRef = null;
    setAuthoredItems(items, revisionToken = 0) {
      if (this.authoredItemsRef === items && this.authoredRevisionToken === revisionToken) return;
      if (this.authoredItemsRef && this.authoredItemsRef !== items && tryApplyAppendOnlyPatch(this.authoredIndex, "authored", items)) {
        this.authoredItemsRef = items;
        this.authoredRevisionToken = revisionToken;
        return;
      }
      this.authoredItemsRef = items;
      this.authoredRevisionToken = revisionToken;
      this.authoredIndex = buildCorpusIndex("authored", items);
    }
    setContextItems(items) {
      if (this.contextItemsRef === items) return;
      if (this.contextItemsRef && tryApplyAppendOnlyPatch(this.contextIndex, "context", items)) {
        this.contextItemsRef = items;
        return;
      }
      this.contextItemsRef = items;
      this.contextIndex = buildCorpusIndex("context", items);
    }
    runSearch(request) {
      const startMs = Date.now();
      const budgetMs = request.budgetMs ?? DEFAULT_BUDGET_MS;
      const parsed = parseStructuredQuery(request.query);
      const warnings = [...parsed.warnings];
      let resolvedScope = request.scopeParam || "authored";
      if (!request.scopeParam && parsed.scopeDirectives.length > 0) {
        resolvedScope = parsed.scopeDirectives[parsed.scopeDirectives.length - 1];
      } else if (request.scopeParam && parsed.scopeDirectives.length > 0) {
        const parsedScope = parsed.scopeDirectives[parsed.scopeDirectives.length - 1];
        if (parsedScope !== request.scopeParam) {
          warnings.push({
            type: "invalid-scope",
            token: `scope:${parsedScope}`,
            message: "URL scope parameter takes precedence over in-query scope"
          });
        }
      }
      let isNegationOnly = warnings.some((w) => w.type === "negation-only");
      if (!isNegationOnly) {
        const hasNegation = parsed.clauses.some((clause) => clause.negated);
        const hasPositiveClause = parsed.clauses.some((clause) => !clause.negated);
        if (hasNegation && !hasPositiveClause) {
          isNegationOnly = true;
          warnings.push({
            type: "negation-only",
            token: parsed.rawQuery,
            message: 'Add a positive clause or use "*" before negations'
          });
        }
      }
      if (isNegationOnly) {
        const diagnostics2 = {
          warnings,
          parseState: "invalid",
          degradedMode: false,
          partialResults: false,
          tookMs: Date.now() - startMs,
          stageACandidateCount: 0,
          stageBScanned: 0,
          totalCandidatesBeforeLimit: 0,
          explain: ["Query rejected: negations require at least one positive clause"]
        };
        return {
          ids: [],
          total: 0,
          items: [],
          canonicalQuery: parsed.executableQuery,
          resolvedScope,
          diagnostics: diagnostics2
        };
      }
      const corpora = resolvedScope === "all" ? [this.authoredIndex, this.contextIndex] : [this.authoredIndex];
      let stageACandidateCount = 0;
      let stageBScanned = 0;
      let partialResults = false;
      const mergedWarnings = [...warnings];
      const mergedDocs = new Map();
      const mergedSignals = new Map();
      for (const corpus of corpora) {
        const result = executeAgainstCorpus(corpus, parsed.clauses, startMs, budgetMs);
        stageACandidateCount += result.stageACandidateCount;
        stageBScanned += result.stageBScanned;
        partialResults = partialResults || result.partialResults;
        result.docs.forEach((doc) => {
          const existing = mergedDocs.get(doc.id);
          if (!existing) {
            mergedDocs.set(doc.id, doc);
            const signal = result.relevanceSignalsById.get(doc.id);
            if (signal) mergedSignals.set(doc.id, signal);
            return;
          }
          if (existing.source === "authored") return;
          if (doc.source === "authored") {
            mergedDocs.set(doc.id, doc);
            const signal = result.relevanceSignalsById.get(doc.id);
            if (signal) mergedSignals.set(doc.id, signal);
          }
        });
      }
      const sortedDocs = sortSearchDocs(Array.from(mergedDocs.values()), request.sortMode, mergedSignals);
      const total = sortedDocs.length;
      const limitedDocs = sortedDocs.slice(0, request.limit);
      const getItemForDoc = (doc) => {
        if (doc.source === "authored") {
          return this.authoredIndex.itemsById.get(doc.id) || this.contextIndex.itemsById.get(doc.id) || null;
        }
        return this.contextIndex.itemsById.get(doc.id) || this.authoredIndex.itemsById.get(doc.id) || null;
      };
      const resolved = limitedDocs.map((doc) => ({ doc, item: getItemForDoc(doc) })).filter((entry) => Boolean(entry.item));
      const ids = resolved.map((entry) => entry.doc.id);
      const items = resolved.map((entry) => entry.item);
      const parseState = mergedWarnings.some((w) => w.type === "negation-only" || w.type === "invalid-query") ? "invalid" : mergedWarnings.length > 0 ? "warning" : "valid";
      const diagnostics = {
        warnings: mergedWarnings,
        parseState,
        degradedMode: partialResults || mergedWarnings.some((w) => w.type === "regex-unsafe" || w.type === "regex-too-long"),
        partialResults,
        tookMs: Date.now() - startMs,
        stageACandidateCount,
        stageBScanned,
        totalCandidatesBeforeLimit: total,
        explain: [
          `scope=${resolvedScope}`,
          `stageA_candidates=${stageACandidateCount}`,
          `stageB_scanned=${stageBScanned}`,
          `total=${total}`
        ]
      };
      return {
        ids,
        total,
        items,
        canonicalQuery: parsed.executableQuery,
        resolvedScope,
        diagnostics
      };
    }
  }
  const FALLBACK_TOTAL_BUDGET_MS = 150;
  const REGEX_LITERAL_GLOBAL = /-?\/(?:\\\/|[^/])+\/[a-z]*/gi;
  const REGEX_META_GLOBAL = /[.*+?^${}()|[\]\\]/g;
  const downgradeRegexTokenToLiteral = (token) => {
    const negated = token.startsWith("-");
    const literal = negated ? token.slice(1) : token;
    const endSlash = literal.lastIndexOf("/");
    if (!literal.startsWith("/") || endSlash <= 0) return token;
    const pattern = literal.slice(1, endSlash);
    const flags = literal.slice(endSlash + 1).replace(/[gy]/g, "");
    try {
      new RegExp(pattern, flags);
    } catch {
      return token;
    }
    const simplified = pattern.replace(REGEX_META_GLOBAL, " ").replace(/\s+/g, " ").trim();
    if (!simplified) return negated ? "-*" : "*";
    return negated ? `-${simplified}` : simplified;
  };
  const downgradeRegexInQuery = (query) => {
    let downgraded = false;
    const next = query.replace(REGEX_LITERAL_GLOBAL, (token) => {
      const replacement = downgradeRegexTokenToLiteral(token);
      if (replacement !== token) {
        downgraded = true;
      }
      return replacement;
    });
    return { query: next, downgraded };
  };
  const prependFallbackWarning = (result, warning) => ({
    ...result,
    diagnostics: {
      ...result.diagnostics,
      warnings: [warning, ...result.diagnostics.warnings],
      parseState: result.diagnostics.parseState === "valid" ? "warning" : result.diagnostics.parseState,
      degradedMode: true
    }
  });
  const executeFallbackQuery = (runtime, request) => {
    const normalizedBudget = request.budgetMs ?? FALLBACK_TOTAL_BUDGET_MS;
    const downgraded = downgradeRegexInQuery(request.query);
    const result = runtime.runSearch({
      ...request,
      query: downgraded.query,
      budgetMs: normalizedBudget
    });
    if (!downgraded.downgraded) return result;
    return prependFallbackWarning(result, {
      type: "regex-unsafe",
      token: request.query,
      message: "Fallback mode downgraded regex literals to plain-text contains checks"
    });
  };
  const executeFallbackQueryAsync = async (runtime, request) => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    return executeFallbackQuery(runtime, request);
  };
  const SEARCH_SCHEMA_VERSION = 1;
  const DEFAULT_INDEX_CHUNK_SIZE = 500;
  const randomId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const isQueryResult = (msg) => msg.kind === "query.result";
  const isIndexReady = (msg) => msg.kind === "index.ready";
  const isError = (msg) => msg.kind === "error";
  class SearchQueryCancelledError extends Error {
    requestId;
    constructor(requestId) {
      super(`Search query cancelled: ${requestId}`);
      this.name = "SearchQueryCancelledError";
      this.requestId = requestId;
    }
  }
  class SearchWorkerClient {
    worker;
    pendingQueries = new Map();
    pendingIndex = new Map();
    workerFailure = null;
    constructor(worker) {
      this.worker = worker;
      this.worker.addEventListener("message", (event) => {
        const msg = event.data;
        if (isQueryResult(msg)) {
          const pending = this.pendingQueries.get(msg.requestId);
          if (!pending) return;
          this.pendingQueries.delete(msg.requestId);
          pending.resolve(msg);
          return;
        }
        if (isIndexReady(msg)) {
          const key = msg.batchId || msg.patchId;
          if (!key) return;
          const pending = this.pendingIndex.get(key);
          if (!pending) return;
          this.pendingIndex.delete(key);
          pending.resolve(msg);
          return;
        }
        if (isError(msg)) {
          if (msg.requestId) {
            const queryPending = this.pendingQueries.get(msg.requestId);
            if (queryPending) {
              this.pendingQueries.delete(msg.requestId);
              queryPending.reject(new Error(msg.message));
            }
          }
          const key = msg.batchId || msg.patchId;
          if (key) {
            const indexPending = this.pendingIndex.get(key);
            if (indexPending) {
              this.pendingIndex.delete(key);
              indexPending.reject(new Error(msg.message));
            }
          }
          if (!msg.requestId && !key) {
            this.failWorker(new Error(msg.message));
          }
        }
      });
      this.worker.addEventListener("error", (event) => {
        const message = event.message?.trim();
        this.failWorker(new Error(message ? `Search worker crashed: ${message}` : "Search worker crashed"));
      });
      this.worker.addEventListener("messageerror", () => {
        this.failWorker(new Error("Search worker message deserialization failed"));
      });
    }
    failWorker(error) {
      if (!this.workerFailure) {
        this.workerFailure = error;
      }
      const rejectReason = this.workerFailure;
      this.pendingQueries.forEach((pending) => pending.reject(rejectReason));
      this.pendingQueries.clear();
      this.pendingIndex.forEach((pending) => pending.reject(rejectReason));
      this.pendingIndex.clear();
    }
    post(message) {
      if (this.workerFailure) {
        throw this.workerFailure;
      }
      this.worker.postMessage(message);
    }
    runQuery(message) {
      if (this.workerFailure) {
        return Promise.reject(this.workerFailure);
      }
      return new Promise((resolve, reject) => {
        this.pendingQueries.set(message.requestId, { resolve, reject });
        try {
          this.post(message);
        } catch (error) {
          this.pendingQueries.delete(message.requestId);
          reject(error);
        }
      });
    }
    cancelQuery(requestId) {
      const pending = this.pendingQueries.get(requestId);
      if (pending) {
        this.pendingQueries.delete(requestId);
        pending.reject(new SearchQueryCancelledError(requestId));
      }
      try {
        this.post({ kind: "query.cancel", requestId });
      } catch {
      }
    }
    indexFull(source, items, chunkSize = DEFAULT_INDEX_CHUNK_SIZE) {
      if (this.workerFailure) {
        return Promise.reject(this.workerFailure);
      }
      const batchId = randomId(`full-${source}`);
      const chunks = createChunkedIndexRequests(batchId, source, items, chunkSize);
      return new Promise((resolve, reject) => {
        this.pendingIndex.set(batchId, { resolve, reject });
        try {
          this.post({
            kind: "index.full.start",
            batchId,
            source,
            schemaVersion: SEARCH_SCHEMA_VERSION
          });
          for (const chunk of chunks) this.post(chunk);
          this.post({ kind: "index.full.commit", batchId, source });
        } catch (error) {
          this.pendingIndex.delete(batchId);
          reject(error);
        }
      });
    }
    indexPatch(source, upserts, deletes) {
      if (this.workerFailure) {
        return Promise.reject(this.workerFailure);
      }
      const patchId = randomId(`patch-${source}`);
      return new Promise((resolve, reject) => {
        this.pendingIndex.set(patchId, { resolve, reject });
        try {
          this.post({
            kind: "index.patch",
            patchId,
            source,
            upserts,
            deletes,
            schemaVersion: SEARCH_SCHEMA_VERSION
          });
        } catch (error) {
          this.pendingIndex.delete(patchId);
          reject(error);
        }
      });
    }
    terminate() {
      this.failWorker(new Error("Search worker terminated"));
      this.worker.terminate();
    }
  }
  const createChunkedIndexRequests = (batchId, source, items, chunkSize = DEFAULT_INDEX_CHUNK_SIZE) => {
    if (items.length === 0) {
      return [{
        kind: "index.full.chunk",
        batchId,
        source,
        chunkIndex: 0,
        totalChunks: 1,
        items: []
      }];
    }
    const chunks = [];
    const totalChunks = Math.ceil(items.length / chunkSize);
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * chunkSize;
      const end = start + chunkSize;
      chunks.push({
        kind: "index.full.chunk",
        batchId,
        source,
        chunkIndex,
        totalChunks,
        items: items.slice(start, end)
      });
    }
    return chunks;
  };
  const randomRequestId = () => `query-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const hasSameItemRefs = (a, b) => {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  };
  class ArchiveSearchManager {
    runtime = new ArchiveSearchRuntime();
    workerClient;
    workerEnabled = false;
    authoredItems = [];
    contextItems = [];
    itemsById = new Map();
    indexVersion = 0;
    docCount = 0;
    lastError = null;
    activeRequestId = null;
    fallbackMode = false;
    authoredIndexSync = null;
    contextIndexSync = null;
    authoredSyncToken = 0;
    contextSyncToken = 0;
    constructor(options = {}) {
      const useWorker = options.useWorker === true;
      if (options.workerClient) {
        this.workerClient = options.workerClient;
        this.workerEnabled = true;
        return;
      }
      if (useWorker) {
        this.lastError = "Worker mode requested but no workerClient provided; pass a SearchWorkerClient via options.workerClient. Using runtime mode";
      }
      this.workerClient = null;
    }
    setAuthoredItems(items, revisionToken = 0) {
      this.authoredItems = items;
      this.runtime.setAuthoredItems(items, revisionToken);
      this.rebuildItemsById();
      this.docCount = this.authoredItems.length + this.contextItems.length;
      if (!this.workerEnabled || !this.workerClient) return;
      const token = ++this.authoredSyncToken;
      const syncPromise = this.workerClient.indexFull("authored", this.authoredItems).then((ready) => {
        if (token !== this.authoredSyncToken) return;
        this.indexVersion = Math.max(this.indexVersion, ready.indexVersion);
      }).catch((error) => {
        if (token !== this.authoredSyncToken) return;
        this.lastError = error.message;
        this.workerEnabled = false;
      }).finally(() => {
        if (token === this.authoredSyncToken) {
          this.authoredIndexSync = null;
        }
      });
      this.authoredIndexSync = syncPromise;
    }
    setContextItems(items) {
      if (hasSameItemRefs(this.contextItems, items)) return;
      this.contextItems = items;
      this.runtime.setContextItems(items);
      this.rebuildItemsById();
      this.docCount = this.authoredItems.length + this.contextItems.length;
      if (!this.workerEnabled || !this.workerClient) return;
      const token = ++this.contextSyncToken;
      const syncPromise = this.workerClient.indexFull("context", this.contextItems).then((ready) => {
        if (token !== this.contextSyncToken) return;
        this.indexVersion = Math.max(this.indexVersion, ready.indexVersion);
      }).catch((error) => {
        if (token !== this.contextSyncToken) return;
        this.lastError = error.message;
        this.workerEnabled = false;
      }).finally(() => {
        if (token === this.contextSyncToken) {
          this.contextIndexSync = null;
        }
      });
      this.contextIndexSync = syncPromise;
    }
    async runSearch(request) {
      this.docCount = this.authoredItems.length + this.contextItems.length;
      if (!this.workerEnabled || !this.workerClient) {
        if (!this.fallbackMode) {
          return this.runtime.runSearch(request);
        }
        return executeFallbackQueryAsync(this.runtime, request);
      }
      const syncTasks = [];
      if (this.authoredIndexSync) syncTasks.push(this.authoredIndexSync);
      if (this.contextIndexSync) syncTasks.push(this.contextIndexSync);
      if (syncTasks.length > 0) {
        await Promise.all(syncTasks);
        if (!this.workerEnabled || !this.workerClient) {
          return this.runtime.runSearch(request);
        }
      }
      const requestId = randomRequestId();
      if (this.activeRequestId) {
        this.workerClient.cancelQuery(this.activeRequestId);
      }
      this.activeRequestId = requestId;
      try {
        const response = await this.workerClient.runQuery({
          kind: "query.run",
          requestId,
          query: request.query,
          limit: request.limit,
          sortMode: request.sortMode,
          scopeParam: request.scopeParam,
          budgetMs: request.budgetMs,
          expectedIndexVersion: this.indexVersion
        });
        if (response.indexVersion < this.indexVersion) {
          return this.runtime.runSearch(request);
        }
        this.indexVersion = response.indexVersion;
        const items = [];
        const ids = [];
        for (const id of response.ids) {
          const item = this.itemsById.get(id);
          if (!item) continue;
          ids.push(id);
          items.push(item);
        }
        const droppedIds = response.ids.length - ids.length;
        const total = Math.max(ids.length, response.total - droppedIds);
        return {
          ids,
          total,
          items,
          canonicalQuery: response.canonicalQuery,
          resolvedScope: response.resolvedScope,
          diagnostics: response.diagnostics
        };
      } catch (error) {
        if (error instanceof SearchQueryCancelledError) {
          return this.createCancelledResult(request);
        }
        this.lastError = error.message;
        this.workerEnabled = false;
        this.fallbackMode = true;
        return executeFallbackQueryAsync(this.runtime, request);
      } finally {
        if (this.activeRequestId === requestId) {
          this.activeRequestId = null;
        }
      }
    }
    getStatus() {
      return {
        mode: this.workerEnabled ? "worker" : this.fallbackMode ? "fallback" : "runtime",
        ready: true,
        indexVersion: this.indexVersion,
        docCount: this.docCount,
        lastError: this.lastError
      };
    }
    destroy() {
      if (this.workerClient) {
        this.workerClient.terminate();
      }
    }
    rebuildItemsById() {
      const map = new Map();
      for (const item of this.authoredItems) map.set(item._id, item);
      for (const item of this.contextItems) {
        if (map.has(item._id)) continue;
        map.set(item._id, item);
      }
      this.itemsById = map;
    }
    createCancelledResult(request) {
      return {
        ids: [],
        total: 0,
        items: [],
        canonicalQuery: request.query,
        resolvedScope: request.scopeParam ?? "authored",
        diagnostics: {
          warnings: [],
          parseState: "valid",
          degradedMode: false,
          partialResults: false,
          tookMs: 0,
          stageACandidateCount: 0,
          stageBScanned: 0,
          totalCandidatesBeforeLimit: 0,
          explain: ["cancelled-superseded"]
        }
      };
    }
  }
  const MAX_ENCODED_QUERY_LENGTH = 2e3;
  const QUERY_POINTER_PARAM = "qk";
  const QUERY_PARAM = "q";
  const SCOPE_PARAM = "scope";
  const SORT_PARAM = "sort";
  const SESSION_KEY_PREFIX = "pr-archive-search-query:";
  const VALID_SORTS = new Set([
    "relevance",
    "date",
    "date-asc",
    "score",
    "score-asc",
    "replyTo"
  ]);
  const VALID_SCOPES = new Set(["authored", "all"]);
  const canUseSessionStorage = () => {
    try {
      return typeof sessionStorage !== "undefined";
    } catch {
      return false;
    }
  };
  const readSessionQuery = (key) => {
    if (!canUseSessionStorage()) return null;
    try {
      return sessionStorage.getItem(`${SESSION_KEY_PREFIX}${key}`);
    } catch {
      return null;
    }
  };
  const MAX_SESSION_QUERY_ENTRIES = 20;
  const evictOldSessionQueries = () => {
    try {
      const keys = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(SESSION_KEY_PREFIX)) {
          keys.push(k);
        }
      }
      if (keys.length <= MAX_SESSION_QUERY_ENTRIES) return;
      keys.sort();
      const toRemove = keys.slice(0, keys.length - MAX_SESSION_QUERY_ENTRIES);
      for (const k of toRemove) {
        sessionStorage.removeItem(k);
      }
    } catch {
    }
  };
  const writeSessionQuery = (query) => {
    if (!canUseSessionStorage()) return null;
    try {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(`${SESSION_KEY_PREFIX}${key}`, query);
      evictOldSessionQueries();
      return key;
    } catch {
      return null;
    }
  };
  const sanitizeScope = (raw) => raw && VALID_SCOPES.has(raw) ? raw : "authored";
  const sanitizeSort = (raw) => raw && VALID_SORTS.has(raw) ? raw : "date";
  const sanitizeQuery = (raw) => typeof raw === "string" ? raw : "";
  const parseArchiveUrlState = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const scopeRaw = params.get(SCOPE_PARAM);
      const scopeFromUrl = typeof scopeRaw === "string" && scopeRaw.length > 0;
      const scope = sanitizeScope(scopeRaw);
      const sort = sanitizeSort(params.get(SORT_PARAM));
      let query = sanitizeQuery(params.get(QUERY_PARAM));
      const pointerKey = params.get(QUERY_POINTER_PARAM);
      if (pointerKey) {
        const pointerQuery = readSessionQuery(pointerKey);
        if (pointerQuery !== null) {
          query = pointerQuery;
        }
      }
      return { query, scope, sort, scopeFromUrl };
    } catch {
      return {
        query: "",
        scope: "authored",
        sort: "date",
        scopeFromUrl: false
      };
    }
  };
  const writeArchiveUrlState = (state2) => {
    const params = new URLSearchParams(window.location.search);
    const query = state2.query || "";
    if (query.length === 0) {
      params.delete(QUERY_PARAM);
      params.delete(QUERY_POINTER_PARAM);
    } else if (encodeURIComponent(query).length <= MAX_ENCODED_QUERY_LENGTH) {
      params.set(QUERY_PARAM, query);
      params.delete(QUERY_POINTER_PARAM);
    } else {
      const pointer = writeSessionQuery(query);
      if (pointer) {
        params.delete(QUERY_PARAM);
        params.set(QUERY_POINTER_PARAM, pointer);
      } else {
        params.set(QUERY_PARAM, query.slice(0, 400));
        params.delete(QUERY_POINTER_PARAM);
      }
    }
    if (state2.scope === "authored") {
      params.delete(SCOPE_PARAM);
    } else {
      params.set(SCOPE_PARAM, state2.scope);
    }
    params.set(SORT_PARAM, state2.sort);
    const next = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", next);
  };
  const jsContent = '(function() {\n  "use strict";\n  const isContentClause = (clause) => clause.kind === "term" || clause.kind === "phrase" || clause.kind === "regex" || clause.kind === "wildcard";\n  const isPositiveContentClause = (clause) => isContentClause(clause) && !clause.negated;\n  const isPositiveContentWithoutWildcard = (clause) => isPositiveContentClause(clause) && clause.kind !== "wildcard";\n  const HTML_TAG_PATTERN = /<[^>]+>/g;\n  const WHITESPACE_PATTERN = /\\s+/g;\n  const MARKDOWN_LINK_PATTERN = /\\[([^\\]]+)\\]\\(([^)]+)\\)/g;\n  const MARKDOWN_IMAGE_PATTERN = /!\\[([^\\]]*)\\]\\(([^)]+)\\)/g;\n  const MARKDOWN_FORMATTING_PATTERN = /(^|\\s)[>#*_~`-]+(?=\\s|$)/gm;\n  const MARKDOWN_CODE_FENCE_PATTERN = /```/g;\n  const MARKDOWN_INLINE_CODE_PATTERN = /`/g;\n  const MARKDOWN_LATEX_PATTERN = /\\$\\$?/g;\n  const PUNCT_FOLD_PATTERN = /[^\\p{L}\\p{N}\\s]/gu;\n  const APOSTROPHE_PATTERN = /[\'’]/g;\n  const TOKEN_SPLIT_PATTERN = /\\s+/g;\n  const COMMON_ENTITIES = {\n    "&amp;": "&",\n    "&lt;": "<",\n    "&gt;": ">",\n    "&quot;": \'"\',\n    "&#39;": "\'",\n    "&apos;": "\'",\n    "&nbsp;": " ",\n    "&#x27;": "\'",\n    "&#x2F;": "/"\n  };\n  const ENTITY_PATTERN = /&(?:#(?:x[0-9a-fA-F]+|\\d+)|[a-z][a-z0-9]*);/gi;\n  const decodeHtmlEntities = (html) => {\n    if (typeof document !== "undefined") {\n      const textarea = document.createElement("textarea");\n      textarea.innerHTML = html;\n      return textarea.value;\n    }\n    return html.replace(ENTITY_PATTERN, (entity) => {\n      const known = COMMON_ENTITIES[entity.toLowerCase()];\n      if (known) return known;\n      if (entity.startsWith("&#x")) {\n        const code = parseInt(entity.slice(3, -1), 16);\n        return Number.isFinite(code) ? String.fromCodePoint(code) : entity;\n      }\n      if (entity.startsWith("&#")) {\n        const code = parseInt(entity.slice(2, -1), 10);\n        return Number.isFinite(code) ? String.fromCodePoint(code) : entity;\n      }\n      return entity;\n    });\n  };\n  const collapseWhitespace = (value) => value.replace(WHITESPACE_PATTERN, " ").trim();\n  const stripHtmlToText = (html) => {\n    const decoded = decodeHtmlEntities(html);\n    return collapseWhitespace(decoded.replace(HTML_TAG_PATTERN, " "));\n  };\n  const stripMarkdownFormatting = (markdown) => {\n    let text = markdown;\n    text = text.replace(MARKDOWN_IMAGE_PATTERN, "$1");\n    text = text.replace(MARKDOWN_LINK_PATTERN, "$1");\n    text = text.replace(MARKDOWN_CODE_FENCE_PATTERN, " ");\n    text = text.replace(MARKDOWN_INLINE_CODE_PATTERN, "");\n    text = text.replace(MARKDOWN_LATEX_PATTERN, "");\n    text = text.replace(MARKDOWN_FORMATTING_PATTERN, "$1");\n    return collapseWhitespace(text);\n  };\n  const normalizeForSearch = (value) => {\n    if (!value) return "";\n    const nfkc = value.normalize("NFKC").toLowerCase();\n    return collapseWhitespace(nfkc.replace(APOSTROPHE_PATTERN, "").replace(PUNCT_FOLD_PATTERN, " "));\n  };\n  const normalizeBody = (item) => {\n    const markdown = item.contents?.markdown;\n    if (typeof markdown === "string" && markdown.trim().length > 0) {\n      return normalizeForSearch(stripMarkdownFormatting(markdown));\n    }\n    const htmlBody = typeof item.htmlBody === "string" ? item.htmlBody : "";\n    return normalizeForSearch(stripHtmlToText(htmlBody));\n  };\n  const normalizeTitle = (item) => "title" in item && typeof item.title === "string" ? normalizeForSearch(item.title) : "";\n  const getItemType = (item) => "title" in item ? "post" : "comment";\n  const getAuthorDisplayName = (item) => {\n    if (item.user?.displayName) return item.user.displayName;\n    if (item.user?.username) return item.user.username;\n    return "";\n  };\n  const getReplyToDisplayName = (item) => {\n    if ("title" in item) return "";\n    if (item.parentComment?.user?.displayName) return item.parentComment.user.displayName;\n    if (item.post?.user?.displayName) return item.post.user.displayName;\n    return "";\n  };\n  const buildArchiveSearchDoc = (item, source) => {\n    const titleNorm = normalizeTitle(item);\n    const bodyNorm = normalizeBody(item);\n    return {\n      id: item._id,\n      itemType: getItemType(item),\n      source,\n      postedAtMs: Number.isFinite(new Date(item.postedAt).getTime()) ? new Date(item.postedAt).getTime() : 0,\n      baseScore: typeof item.baseScore === "number" ? item.baseScore : 0,\n      authorNameNorm: normalizeForSearch(getAuthorDisplayName(item)),\n      replyToNorm: normalizeForSearch(getReplyToDisplayName(item)),\n      titleNorm,\n      bodyNorm\n    };\n  };\n  const tokenizeForIndex = (normText) => {\n    if (!normText) return [];\n    const tokens = normText.split(TOKEN_SPLIT_PATTERN);\n    const output = [];\n    const seen = /* @__PURE__ */ new Set();\n    for (const token of tokens) {\n      if (!token || token.length < 2) continue;\n      if (seen.has(token)) continue;\n      seen.add(token);\n      output.push(token);\n    }\n    return output;\n  };\n  const MAX_REGEX_PATTERN_LENGTH = 512;\n  const DATE_PATTERN = /^\\d{4}-\\d{2}-\\d{2}$/;\n  const UTC_DAY_MS = 24 * 60 * 60 * 1e3;\n  const tokenizeQuery = (query) => {\n    const tokens = [];\n    let i = 0;\n    while (i < query.length) {\n      while (i < query.length && /\\s/.test(query[i])) i++;\n      if (i >= query.length) break;\n      const start = i;\n      let cursor = i;\n      let inQuote = false;\n      const startsWithNegation = query[cursor] === "-";\n      if (startsWithNegation) cursor++;\n      const startsRegexLiteral = query[cursor] === "/";\n      if (startsRegexLiteral) {\n        cursor++;\n        let escaped2 = false;\n        while (cursor < query.length) {\n          const ch = query[cursor];\n          if (!escaped2 && ch === "/") {\n            cursor++;\n            while (cursor < query.length && /[a-z]/i.test(query[cursor])) {\n              cursor++;\n            }\n            break;\n          }\n          if (!escaped2 && ch === "\\\\") {\n            escaped2 = true;\n          } else {\n            escaped2 = false;\n          }\n          cursor++;\n        }\n        while (cursor < query.length && !/\\s/.test(query[cursor])) {\n          cursor++;\n        }\n        tokens.push(query.slice(start, cursor));\n        i = cursor;\n        continue;\n      }\n      let escaped = false;\n      while (cursor < query.length) {\n        const ch = query[cursor];\n        if (!escaped && ch === \'"\') {\n          inQuote = !inQuote;\n          cursor++;\n          continue;\n        }\n        if (!inQuote && /\\s/.test(ch)) {\n          break;\n        }\n        escaped = !escaped && ch === "\\\\";\n        cursor++;\n      }\n      tokens.push(query.slice(start, cursor));\n      i = cursor;\n    }\n    return tokens;\n  };\n  const parseRegexLiteral = (token) => {\n    if (!token.startsWith("/")) return null;\n    let i = 1;\n    let escaped = false;\n    while (i < token.length) {\n      const ch = token[i];\n      if (!escaped && ch === "/") {\n        const pattern = token.slice(1, i);\n        const flags = token.slice(i + 1);\n        if (!/^[a-z]*$/i.test(flags)) return null;\n        return { raw: token, pattern, flags };\n      }\n      if (!escaped && ch === "\\\\") {\n        escaped = true;\n      } else {\n        escaped = false;\n      }\n      i++;\n    }\n    return null;\n  };\n  const addWarning = (warnings, type, token, message) => {\n    warnings.push({ type, token, message });\n  };\n  const removeOuterQuotes = (value) => {\n    if (value.length >= 2 && value.startsWith(\'"\') && value.endsWith(\'"\')) {\n      return value.slice(1, -1);\n    }\n    return value;\n  };\n  const parseNumber = (value) => {\n    if (!/^-?\\d+$/.test(value.trim())) return null;\n    const parsed = Number(value);\n    if (!Number.isFinite(parsed)) return null;\n    return parsed;\n  };\n  const parseScoreClause = (value, negated) => {\n    const trimmed = value.trim();\n    if (!trimmed) return null;\n    if (trimmed.startsWith(">")) {\n      const n = parseNumber(trimmed.slice(1));\n      if (n === null) return null;\n      return { kind: "score", negated, op: "gt", min: n, includeMin: false, includeMax: false };\n    }\n    if (trimmed.startsWith("<")) {\n      const n = parseNumber(trimmed.slice(1));\n      if (n === null) return null;\n      return { kind: "score", negated, op: "lt", max: n, includeMin: false, includeMax: false };\n    }\n    if (trimmed.includes("..")) {\n      const [minRaw, maxRaw] = trimmed.split("..");\n      const min = parseNumber(minRaw);\n      const max = parseNumber(maxRaw);\n      if (min === null || max === null) return null;\n      return { kind: "score", negated, op: "range", min, max, includeMin: true, includeMax: true };\n    }\n    const exact = parseNumber(trimmed);\n    if (exact === null) return null;\n    return { kind: "score", negated, op: "range", min: exact, max: exact, includeMin: true, includeMax: true };\n  };\n  const parseUtcDayBounds = (value) => {\n    if (!DATE_PATTERN.test(value)) return null;\n    const [yearRaw, monthRaw, dayRaw] = value.split("-");\n    const year = Number(yearRaw);\n    const month = Number(monthRaw);\n    const day = Number(dayRaw);\n    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;\n    if (month < 1 || month > 12 || day < 1 || day > 31) return null;\n    const startMs = Date.UTC(year, month - 1, day);\n    const parsed = new Date(startMs);\n    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {\n      return null;\n    }\n    return {\n      startMs,\n      endMs: startMs + UTC_DAY_MS - 1\n    };\n  };\n  const parseDateClause = (value, negated) => {\n    const trimmed = value.trim();\n    if (!trimmed) return null;\n    if (trimmed.startsWith(">")) {\n      const bounds = parseUtcDayBounds(trimmed.slice(1));\n      if (!bounds) return null;\n      return { kind: "date", negated, op: "gt", minMs: bounds.endMs, includeMin: false, includeMax: false };\n    }\n    if (trimmed.startsWith("<")) {\n      const bounds = parseUtcDayBounds(trimmed.slice(1));\n      if (!bounds) return null;\n      return { kind: "date", negated, op: "lt", maxMs: bounds.startMs, includeMin: false, includeMax: false };\n    }\n    if (trimmed.includes("..")) {\n      const [startRaw, endRaw] = trimmed.split("..");\n      const hasStart = startRaw.trim().length > 0;\n      const hasEnd = endRaw.trim().length > 0;\n      if (!hasStart && !hasEnd) return null;\n      const startBounds = hasStart ? parseUtcDayBounds(startRaw) : null;\n      const endBounds = hasEnd ? parseUtcDayBounds(endRaw) : null;\n      if (hasStart && !startBounds || hasEnd && !endBounds) return null;\n      return {\n        kind: "date",\n        negated,\n        op: "range",\n        minMs: startBounds?.startMs,\n        maxMs: endBounds?.endMs,\n        includeMin: true,\n        includeMax: true\n      };\n    }\n    const day = parseUtcDayBounds(trimmed);\n    if (!day) return null;\n    return {\n      kind: "date",\n      negated,\n      op: "range",\n      minMs: day.startMs,\n      maxMs: day.endMs,\n      includeMin: true,\n      includeMax: true\n    };\n  };\n  const maybeParseFieldClause = (token, negated, scopeDirectives, warnings, executableTokens) => {\n    const colonIndex = token.indexOf(":");\n    if (colonIndex <= 0) return { handled: false, clause: null };\n    const operator = token.slice(0, colonIndex).toLowerCase();\n    const valueRaw = token.slice(colonIndex + 1);\n    const value = removeOuterQuotes(valueRaw);\n    switch (operator) {\n      case "type": {\n        const normalized = value.toLowerCase();\n        if (normalized !== "post" && normalized !== "comment") {\n          addWarning(warnings, "invalid-type", token, `Unsupported type filter: ${value}`);\n          return { handled: true, clause: null };\n        }\n        executableTokens.push(`${negated ? "-" : ""}type:${normalized}`);\n        return { handled: true, clause: { kind: "type", negated, itemType: normalized } };\n      }\n      case "author": {\n        const normalized = normalizeForSearch(value);\n        if (!normalized) {\n          addWarning(warnings, "invalid-query", token, "author filter requires a value");\n          return { handled: true, clause: null };\n        }\n        executableTokens.push(`${negated ? "-" : ""}author:"${normalized}"`);\n        return { handled: true, clause: { kind: "author", negated, valueNorm: normalized } };\n      }\n      case "replyto": {\n        const normalized = normalizeForSearch(value);\n        if (!normalized) {\n          addWarning(warnings, "invalid-query", token, "replyto filter requires a value");\n          return { handled: true, clause: null };\n        }\n        executableTokens.push(`${negated ? "-" : ""}replyto:"${normalized}"`);\n        return { handled: true, clause: { kind: "replyto", negated, valueNorm: normalized } };\n      }\n      case "scope": {\n        const normalized = value.toLowerCase();\n        if (normalized === "authored" || normalized === "all") {\n          scopeDirectives.push(normalized);\n        } else {\n          addWarning(warnings, "invalid-scope", token, `Unsupported scope value: ${value}`);\n        }\n        return { handled: true, clause: null };\n      }\n      case "score": {\n        const parsed = parseScoreClause(valueRaw, negated);\n        if (!parsed) {\n          addWarning(warnings, "malformed-score", token, `Malformed score filter: ${valueRaw}`);\n          return { handled: true, clause: null };\n        }\n        executableTokens.push(`${negated ? "-" : ""}score:${valueRaw}`);\n        return { handled: true, clause: parsed };\n      }\n      case "date": {\n        const parsed = parseDateClause(valueRaw, negated);\n        if (!parsed) {\n          addWarning(warnings, "malformed-date", token, `Malformed date filter: ${valueRaw}`);\n          return { handled: true, clause: null };\n        }\n        executableTokens.push(`${negated ? "-" : ""}date:${valueRaw}`);\n        return { handled: true, clause: parsed };\n      }\n      case "sort": {\n        addWarning(warnings, "reserved-operator", token, "sort: is controlled by the sort dropdown");\n        return { handled: true, clause: null };\n      }\n      default:\n        return { handled: false, clause: null };\n    }\n  };\n  const containsUnsafeRegexPattern = (pattern) => /(\\([^)]*[+*][^)]*\\)[+*])/.test(pattern) || /(\\+|\\*|\\{[^}]+\\})\\s*(\\+|\\*|\\{[^}]+\\})/.test(pattern);\n  const serializeNormalizedTermToken = (termNorm) => termNorm.includes(" ") ? termNorm.replace(/\\s+/g, "-") : termNorm;\n  const parseStructuredQuery = (query) => {\n    const trimmed = query.trim();\n    const warnings = [];\n    const scopeDirectives = [];\n    const clauses = [];\n    const executableTokens = [];\n    let wildcardSeen = false;\n    if (!trimmed) {\n      return {\n        rawQuery: query,\n        executableQuery: "",\n        clauses,\n        scopeDirectives,\n        warnings\n      };\n    }\n    const tokens = tokenizeQuery(trimmed);\n    for (const rawToken of tokens) {\n      if (!rawToken) continue;\n      const negated = rawToken.startsWith("-");\n      const token = negated ? rawToken.slice(1) : rawToken;\n      if (!token) continue;\n      const regexLiteral = parseRegexLiteral(token);\n      if (regexLiteral) {\n        if (regexLiteral.pattern.length > MAX_REGEX_PATTERN_LENGTH) {\n          addWarning(warnings, "regex-too-long", rawToken, "Regex pattern exceeds the 512 character safety limit");\n          continue;\n        }\n        if (containsUnsafeRegexPattern(regexLiteral.pattern)) {\n          addWarning(warnings, "regex-unsafe", rawToken, "Regex pattern rejected by safety lint");\n          continue;\n        }\n        try {\n          const safeFlags = regexLiteral.flags.replace(/[gy]/g, "");\n          const regex = new RegExp(regexLiteral.pattern, safeFlags);\n          clauses.push({\n            kind: "regex",\n            negated,\n            raw: rawToken,\n            pattern: regexLiteral.pattern,\n            flags: safeFlags,\n            regex\n          });\n          executableTokens.push(rawToken);\n          continue;\n        } catch {\n          addWarning(warnings, "invalid-regex", rawToken, "Invalid regex literal");\n          continue;\n        }\n      }\n      if (token.startsWith("/")) {\n        addWarning(warnings, "invalid-regex", rawToken, "Invalid regex literal");\n        continue;\n      }\n      const fieldResult = maybeParseFieldClause(token, negated, scopeDirectives, warnings, executableTokens);\n      if (fieldResult.handled) {\n        if (fieldResult.clause) {\n          clauses.push(fieldResult.clause);\n        }\n        continue;\n      }\n      if (token.includes(":") && /^[a-z][a-z0-9_]*:/i.test(token)) {\n        addWarning(warnings, "unknown-operator", rawToken, `Unsupported operator treated as plain term: ${token}`);\n      }\n      if (token === "*") {\n        if (!wildcardSeen) {\n          clauses.push({ kind: "wildcard", negated });\n          executableTokens.push(rawToken);\n          wildcardSeen = true;\n        }\n        continue;\n      }\n      if (token.startsWith(\'"\') && token.endsWith(\'"\') && token.length >= 2) {\n        const phraseNorm = normalizeForSearch(removeOuterQuotes(token));\n        if (phraseNorm) {\n          clauses.push({ kind: "phrase", negated, valueNorm: phraseNorm });\n          executableTokens.push(`${negated ? "-" : ""}"${phraseNorm}"`);\n        }\n        continue;\n      }\n      const termNorm = normalizeForSearch(token);\n      if (termNorm) {\n        clauses.push({ kind: "term", negated, valueNorm: termNorm });\n        executableTokens.push(`${negated ? "-" : ""}${serializeNormalizedTermToken(termNorm)}`);\n      }\n    }\n    const hasPositiveContentClause = clauses.some(isPositiveContentWithoutWildcard);\n    const filteredClauses = clauses.filter((clause) => !(clause.kind === "wildcard" && hasPositiveContentClause));\n    const hasNegatedClause = filteredClauses.some((clause) => clause.negated);\n    const hasAnyPositiveClause = filteredClauses.some((clause) => !clause.negated);\n    if (hasNegatedClause && !hasAnyPositiveClause) {\n      addWarning(warnings, "negation-only", trimmed, "Queries containing only negations are not allowed");\n    }\n    return {\n      rawQuery: query,\n      executableQuery: executableTokens.join(" ").trim(),\n      clauses: filteredClauses,\n      scopeDirectives,\n      warnings\n    };\n  };\n  const buildExecutionPlan = (clauses) => {\n    const stageA = [];\n    const stageB = [];\n    const negations = [];\n    for (const clause of clauses) {\n      if (clause.negated) {\n        negations.push(clause);\n        continue;\n      }\n      switch (clause.kind) {\n        case "type":\n        case "author":\n        case "replyto":\n        case "score":\n        case "date":\n          stageA.push(clause);\n          break;\n        case "term":\n          if (clause.valueNorm.length >= 2) {\n            stageA.push(clause);\n          } else {\n            stageB.push(clause);\n          }\n          break;\n        case "phrase":\n        case "regex":\n        case "wildcard":\n          stageB.push(clause);\n          break;\n        default:\n          stageB.push(clause);\n          break;\n      }\n    }\n    return { stageA, stageB, negations };\n  };\n  const compareSourcePriority = (a, b) => {\n    if (a.source === b.source) return 0;\n    return a.source === "authored" ? -1 : 1;\n  };\n  const compareStableTail = (a, b) => {\n    const sourceCmp = compareSourcePriority(a, b);\n    if (sourceCmp !== 0) return sourceCmp;\n    const dateCmp = b.postedAtMs - a.postedAtMs;\n    if (dateCmp !== 0) return dateCmp;\n    return a.id.localeCompare(b.id);\n  };\n  const compareReplyTo = (a, b) => {\n    const aEmpty = a.replyToNorm.length === 0;\n    const bEmpty = b.replyToNorm.length === 0;\n    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;\n    const nameCmp = a.replyToNorm.localeCompare(b.replyToNorm);\n    if (nameCmp !== 0) return nameCmp;\n    return compareStableTail(a, b);\n  };\n  const computeRelevanceScore = (signals) => {\n    let score = 0;\n    score += signals.tokenHits * 10;\n    score += signals.phraseHits * 15;\n    if (signals.authorHit) score += 8;\n    if (signals.replyToHit) score += 6;\n    return score;\n  };\n  const sortSearchDocs = (docs, sortMode, relevanceSignalsById) => {\n    const sorted = [...docs];\n    switch (sortMode) {\n      case "date-asc":\n        sorted.sort((a, b) => {\n          const cmp = a.postedAtMs - b.postedAtMs;\n          if (cmp !== 0) return cmp;\n          return compareStableTail(a, b);\n        });\n        return sorted;\n      case "score":\n        sorted.sort((a, b) => {\n          const cmp = b.baseScore - a.baseScore;\n          if (cmp !== 0) return cmp;\n          return compareStableTail(a, b);\n        });\n        return sorted;\n      case "score-asc":\n        sorted.sort((a, b) => {\n          const cmp = a.baseScore - b.baseScore;\n          if (cmp !== 0) return cmp;\n          return compareStableTail(a, b);\n        });\n        return sorted;\n      case "replyTo":\n        sorted.sort(compareReplyTo);\n        return sorted;\n      case "relevance":\n        sorted.sort((a, b) => {\n          const aSignals = relevanceSignalsById.get(a.id) || {\n            tokenHits: 0,\n            phraseHits: 0,\n            authorHit: false,\n            replyToHit: false\n          };\n          const bSignals = relevanceSignalsById.get(b.id) || {\n            tokenHits: 0,\n            phraseHits: 0,\n            authorHit: false,\n            replyToHit: false\n          };\n          const scoreCmp = computeRelevanceScore(bSignals) - computeRelevanceScore(aSignals);\n          if (scoreCmp !== 0) return scoreCmp;\n          const dateCmp = b.postedAtMs - a.postedAtMs;\n          if (dateCmp !== 0) return dateCmp;\n          return a.id.localeCompare(b.id);\n        });\n        return sorted;\n      case "date":\n      default:\n        sorted.sort((a, b) => {\n          const cmp = b.postedAtMs - a.postedAtMs;\n          if (cmp !== 0) return cmp;\n          return compareStableTail(a, b);\n        });\n        return sorted;\n    }\n  };\n  const addPosting = (index, token, ordinal) => {\n    const postings = index.get(token);\n    if (postings) {\n      postings.push(ordinal);\n      return;\n    }\n    index.set(token, [ordinal]);\n  };\n  const compactPostings = (mutable) => {\n    const compact = /* @__PURE__ */ new Map();\n    mutable.forEach((postings, token) => {\n      postings.sort((a, b) => a - b);\n      compact.set(token, Uint32Array.from(postings));\n    });\n    return compact;\n  };\n  const appendPosting = (index, token, ordinal) => {\n    const postings = index.get(token);\n    if (!postings) {\n      index.set(token, Uint32Array.of(ordinal));\n      return;\n    }\n    const next = new Uint32Array(postings.length + 1);\n    next.set(postings);\n    next[postings.length] = ordinal;\n    index.set(token, next);\n  };\n  const buildIndexes = (docs) => {\n    const tokenMutable = /* @__PURE__ */ new Map();\n    const authorMutable = /* @__PURE__ */ new Map();\n    const replyToMutable = /* @__PURE__ */ new Map();\n    for (let ordinal = 0; ordinal < docs.length; ordinal++) {\n      const doc = docs[ordinal];\n      const seenContentTokens = /* @__PURE__ */ new Set();\n      for (const token of tokenizeForIndex(doc.titleNorm)) {\n        if (seenContentTokens.has(token)) continue;\n        seenContentTokens.add(token);\n        addPosting(tokenMutable, token, ordinal);\n      }\n      for (const token of tokenizeForIndex(doc.bodyNorm)) {\n        if (seenContentTokens.has(token)) continue;\n        seenContentTokens.add(token);\n        addPosting(tokenMutable, token, ordinal);\n      }\n      for (const token of tokenizeForIndex(doc.authorNameNorm)) {\n        addPosting(authorMutable, token, ordinal);\n      }\n      for (const token of tokenizeForIndex(doc.replyToNorm)) {\n        addPosting(replyToMutable, token, ordinal);\n      }\n    }\n    return {\n      tokenIndex: compactPostings(tokenMutable),\n      authorIndex: compactPostings(authorMutable),\n      replyToIndex: compactPostings(replyToMutable)\n    };\n  };\n  const buildCorpusIndex = (source, items) => {\n    const docs = items.map((item) => buildArchiveSearchDoc(item, source));\n    const docOrdinalsById = /* @__PURE__ */ new Map();\n    const itemsById = /* @__PURE__ */ new Map();\n    docs.forEach((doc, ordinal) => {\n      docOrdinalsById.set(doc.id, ordinal);\n      itemsById.set(doc.id, items[ordinal]);\n    });\n    const indexes = buildIndexes(docs);\n    return {\n      source,\n      docs,\n      itemsById,\n      docOrdinalsById,\n      ...indexes\n    };\n  };\n  const appendItemsToCorpusIndex = (index, source, upserts) => {\n    if (upserts.length === 0) return;\n    for (const item of upserts) {\n      if (index.docOrdinalsById.has(item._id)) continue;\n      const doc = buildArchiveSearchDoc(item, source);\n      const ordinal = index.docs.length;\n      index.docs.push(doc);\n      index.docOrdinalsById.set(doc.id, ordinal);\n      index.itemsById.set(doc.id, item);\n      const seenContentTokens = /* @__PURE__ */ new Set();\n      for (const token of tokenizeForIndex(doc.titleNorm)) {\n        if (seenContentTokens.has(token)) continue;\n        seenContentTokens.add(token);\n        appendPosting(index.tokenIndex, token, ordinal);\n      }\n      for (const token of tokenizeForIndex(doc.bodyNorm)) {\n        if (seenContentTokens.has(token)) continue;\n        seenContentTokens.add(token);\n        appendPosting(index.tokenIndex, token, ordinal);\n      }\n      for (const token of tokenizeForIndex(doc.authorNameNorm)) {\n        appendPosting(index.authorIndex, token, ordinal);\n      }\n      for (const token of tokenizeForIndex(doc.replyToNorm)) {\n        appendPosting(index.replyToIndex, token, ordinal);\n      }\n    }\n  };\n  const DEFAULT_BUDGET_MS = 150;\n  const createEmptySignals = () => ({\n    tokenHits: 0,\n    phraseHits: 0,\n    authorHit: false,\n    replyToHit: false\n  });\n  const upsertSignal = (signalMap, ordinal) => {\n    const existing = signalMap.get(ordinal);\n    if (existing) return existing;\n    const created = createEmptySignals();\n    signalMap.set(ordinal, created);\n    return created;\n  };\n  const allOrdinalsSet = (docCount) => {\n    const output = /* @__PURE__ */ new Set();\n    for (let i = 0; i < docCount; i++) output.add(i);\n    return output;\n  };\n  const intersectSets = (a, b) => {\n    const [small, large] = a.size < b.size ? [a, b] : [b, a];\n    const out = /* @__PURE__ */ new Set();\n    small.forEach((value) => {\n      if (large.has(value)) out.add(value);\n    });\n    return out;\n  };\n  const postingsToSet = (postings) => {\n    const out = /* @__PURE__ */ new Set();\n    for (let i = 0; i < postings.length; i++) out.add(postings[i]);\n    return out;\n  };\n  const maybeIntersectWithCandidate = (candidate, current) => {\n    if (!candidate) return current;\n    return intersectSets(candidate, current);\n  };\n  const getTokenPostingIntersection = (index, tokens, docCount) => {\n    if (tokens.length === 0) return allOrdinalsSet(docCount);\n    let result = null;\n    for (const token of tokens) {\n      const postings = index.get(token);\n      if (!postings) return /* @__PURE__ */ new Set();\n      const postingSet = postingsToSet(postings);\n      result = result ? intersectSets(result, postingSet) : postingSet;\n      if (result.size === 0) return result;\n    }\n    return result || /* @__PURE__ */ new Set();\n  };\n  const tryApplyAppendOnlyPatch = (index, source, items) => {\n    if (items.length < index.docs.length) return false;\n    const nextById = /* @__PURE__ */ new Map();\n    for (const item of items) {\n      nextById.set(item._id, item);\n    }\n    for (const id of index.docOrdinalsById.keys()) {\n      const nextItem = nextById.get(id);\n      if (!nextItem) return false;\n      if (index.itemsById.get(id) !== nextItem) return false;\n    }\n    const upserts = [];\n    for (const item of items) {\n      if (!index.docOrdinalsById.has(item._id)) {\n        upserts.push(item);\n      }\n    }\n    appendItemsToCorpusIndex(index, source, upserts);\n    return true;\n  };\n  const matchesScoreClause = (doc, clause) => {\n    const value = doc.baseScore;\n    if (clause.op === "gt") {\n      return clause.includeMin ? value >= (clause.min ?? Number.NEGATIVE_INFINITY) : value > (clause.min ?? Number.NEGATIVE_INFINITY);\n    }\n    if (clause.op === "lt") {\n      return clause.includeMax ? value <= (clause.max ?? Number.POSITIVE_INFINITY) : value < (clause.max ?? Number.POSITIVE_INFINITY);\n    }\n    const minOk = clause.min === void 0 ? true : clause.includeMin ? value >= clause.min : value > clause.min;\n    const maxOk = clause.max === void 0 ? true : clause.includeMax ? value <= clause.max : value < clause.max;\n    return minOk && maxOk;\n  };\n  const matchesDateClause = (doc, clause) => {\n    const value = doc.postedAtMs;\n    if (clause.op === "gt") {\n      return clause.includeMin ? value >= (clause.minMs ?? Number.NEGATIVE_INFINITY) : value > (clause.minMs ?? Number.NEGATIVE_INFINITY);\n    }\n    if (clause.op === "lt") {\n      return clause.includeMax ? value <= (clause.maxMs ?? Number.POSITIVE_INFINITY) : value < (clause.maxMs ?? Number.POSITIVE_INFINITY);\n    }\n    const minOk = clause.minMs === void 0 ? true : clause.includeMin ? value >= clause.minMs : value > clause.minMs;\n    const maxOk = clause.maxMs === void 0 ? true : clause.includeMax ? value <= clause.maxMs : value < clause.maxMs;\n    return minOk && maxOk;\n  };\n  const matchesNormalizedText = (doc, valueNorm) => doc.titleNorm.includes(valueNorm) || doc.bodyNorm.includes(valueNorm);\n  const matchesClause = (doc, clause) => {\n    switch (clause.kind) {\n      case "term":\n        return matchesNormalizedText(doc, clause.valueNorm);\n      case "phrase":\n        return doc.titleNorm.includes(clause.valueNorm) || doc.bodyNorm.includes(clause.valueNorm);\n      case "regex":\n        clause.regex.lastIndex = 0;\n        if (clause.regex.test(doc.titleNorm)) return true;\n        clause.regex.lastIndex = 0;\n        return clause.regex.test(doc.bodyNorm);\n      case "wildcard":\n        return true;\n      case "type":\n        return doc.itemType === clause.itemType;\n      case "author":\n        return doc.authorNameNorm.includes(clause.valueNorm);\n      case "replyto":\n        return doc.replyToNorm.includes(clause.valueNorm);\n      case "score":\n        return matchesScoreClause(doc, clause);\n      case "date":\n        return matchesDateClause(doc, clause);\n      default:\n        return false;\n    }\n  };\n  const executeAgainstCorpus = (corpus, clauses, startMs, budgetMs) => {\n    const plan = buildExecutionPlan(clauses);\n    const docCount = corpus.docs.length;\n    const relevanceSignalsByOrdinal = /* @__PURE__ */ new Map();\n    let partialResults = false;\n    let stageBScanned = 0;\n    const deferredStageAClauses = [];\n    const budgetExceeded = () => budgetMs > 0 && Date.now() - startMs > budgetMs;\n    let candidateOrdinals = null;\n    for (const clause of plan.stageA) {\n      if (budgetExceeded()) {\n        partialResults = true;\n        deferredStageAClauses.push(clause);\n        continue;\n      }\n      let matched = /* @__PURE__ */ new Set();\n      switch (clause.kind) {\n        case "term": {\n          const termTokens = tokenizeForIndex(clause.valueNorm);\n          if (termTokens.length === 0) {\n            for (let ordinal = 0; ordinal < corpus.docs.length; ordinal++) {\n              if (budgetExceeded()) {\n                partialResults = true;\n                break;\n              }\n              const doc = corpus.docs[ordinal];\n              if (matchesNormalizedText(doc, clause.valueNorm)) {\n                matched.add(ordinal);\n              }\n            }\n          } else if (termTokens.length === 1 && termTokens[0] === clause.valueNorm) {\n            const postings = corpus.tokenIndex.get(clause.valueNorm);\n            matched = postings ? postingsToSet(postings) : /* @__PURE__ */ new Set();\n          } else {\n            const accelerated = getTokenPostingIntersection(corpus.tokenIndex, termTokens, docCount);\n            accelerated.forEach((ordinal) => {\n              const doc = corpus.docs[ordinal];\n              if (!matchesNormalizedText(doc, clause.valueNorm)) return;\n              matched.add(ordinal);\n            });\n          }\n          matched.forEach((ordinal) => {\n            const signal = upsertSignal(relevanceSignalsByOrdinal, ordinal);\n            signal.tokenHits += 1;\n          });\n          break;\n        }\n        case "author": {\n          const nameTokens = tokenizeForIndex(clause.valueNorm);\n          const accelerated = getTokenPostingIntersection(corpus.authorIndex, nameTokens, docCount);\n          accelerated.forEach((ordinal) => {\n            const doc = corpus.docs[ordinal];\n            if (!doc.authorNameNorm.includes(clause.valueNorm)) return;\n            matched.add(ordinal);\n            const signal = upsertSignal(relevanceSignalsByOrdinal, ordinal);\n            signal.authorHit = true;\n          });\n          break;\n        }\n        case "replyto": {\n          const nameTokens = tokenizeForIndex(clause.valueNorm);\n          const accelerated = getTokenPostingIntersection(corpus.replyToIndex, nameTokens, docCount);\n          accelerated.forEach((ordinal) => {\n            const doc = corpus.docs[ordinal];\n            if (!doc.replyToNorm.includes(clause.valueNorm)) return;\n            matched.add(ordinal);\n            const signal = upsertSignal(relevanceSignalsByOrdinal, ordinal);\n            signal.replyToHit = true;\n          });\n          break;\n        }\n        case "type":\n        case "score":\n        case "date": {\n          for (let ordinal = 0; ordinal < corpus.docs.length; ordinal++) {\n            if (budgetExceeded()) {\n              partialResults = true;\n              break;\n            }\n            const doc = corpus.docs[ordinal];\n            if (matchesClause(doc, clause)) {\n              matched.add(ordinal);\n            }\n          }\n          break;\n        }\n      }\n      candidateOrdinals = maybeIntersectWithCandidate(candidateOrdinals, matched);\n      if (candidateOrdinals.size === 0) {\n        break;\n      }\n    }\n    const hasPositiveContent = clauses.some(isPositiveContentClause);\n    const stageASeeded = candidateOrdinals !== null;\n    if (!candidateOrdinals) {\n      candidateOrdinals = allOrdinalsSet(docCount);\n    }\n    for (const clause of deferredStageAClauses) {\n      const filtered = /* @__PURE__ */ new Set();\n      candidateOrdinals.forEach((ordinal) => {\n        const doc = corpus.docs[ordinal];\n        if (matchesClause(doc, clause)) {\n          filtered.add(ordinal);\n        }\n      });\n      candidateOrdinals = filtered;\n      if (candidateOrdinals.size === 0) break;\n    }\n    if (hasPositiveContent) {\n      const filtered = /* @__PURE__ */ new Set();\n      candidateOrdinals.forEach((ordinal) => {\n        if (budgetExceeded()) {\n          partialResults = true;\n          return;\n        }\n        const doc = corpus.docs[ordinal];\n        stageBScanned++;\n        let stageBTokenHits = 0;\n        let stageBPhraseHits = 0;\n        let matched = true;\n        for (const clause of plan.stageB) {\n          if (!matchesClause(doc, clause)) {\n            matched = false;\n            break;\n          }\n          if (clause.kind === "phrase") {\n            stageBPhraseHits += 1;\n          }\n          if (clause.kind === "term") {\n            stageBTokenHits += 1;\n          }\n        }\n        if (matched) {\n          if (stageBPhraseHits > 0 || stageBTokenHits > 0) {\n            const signal = upsertSignal(relevanceSignalsByOrdinal, ordinal);\n            signal.phraseHits += stageBPhraseHits;\n            signal.tokenHits += stageBTokenHits;\n          }\n          filtered.add(ordinal);\n        }\n      });\n      candidateOrdinals = filtered;\n    } else if (!stageASeeded && plan.stageB.length > 0) {\n      const filtered = /* @__PURE__ */ new Set();\n      for (let ordinal = 0; ordinal < corpus.docs.length; ordinal++) {\n        if (budgetExceeded()) {\n          partialResults = true;\n          break;\n        }\n        const doc = corpus.docs[ordinal];\n        stageBScanned++;\n        let stageBTokenHits = 0;\n        let stageBPhraseHits = 0;\n        let matched = true;\n        for (const clause of plan.stageB) {\n          if (!matchesClause(doc, clause)) {\n            matched = false;\n            break;\n          }\n          if (clause.kind === "phrase") stageBPhraseHits += 1;\n          if (clause.kind === "term") stageBTokenHits += 1;\n        }\n        if (matched) {\n          if (stageBPhraseHits > 0 || stageBTokenHits > 0) {\n            const signal = upsertSignal(relevanceSignalsByOrdinal, ordinal);\n            signal.phraseHits += stageBPhraseHits;\n            signal.tokenHits += stageBTokenHits;\n          }\n          filtered.add(ordinal);\n        }\n      }\n      candidateOrdinals = filtered;\n    }\n    if (plan.negations.length > 0) {\n      const filtered = /* @__PURE__ */ new Set();\n      candidateOrdinals.forEach((ordinal) => {\n        if (budgetExceeded()) {\n          partialResults = true;\n          return;\n        }\n        const doc = corpus.docs[ordinal];\n        const excluded = plan.negations.some((clause) => matchesClause(doc, clause));\n        if (!excluded) filtered.add(ordinal);\n      });\n      candidateOrdinals = filtered;\n    }\n    const docs = Array.from(candidateOrdinals.values()).map((ordinal) => corpus.docs[ordinal]);\n    const relevanceSignalsById = /* @__PURE__ */ new Map();\n    const finalCandidateOrdinals = candidateOrdinals;\n    relevanceSignalsByOrdinal.forEach((signals, ordinal) => {\n      if (!finalCandidateOrdinals.has(ordinal)) return;\n      const doc = corpus.docs[ordinal];\n      relevanceSignalsById.set(doc.id, signals);\n    });\n    return {\n      docs,\n      relevanceSignalsById,\n      stageACandidateCount: candidateOrdinals.size,\n      stageBScanned,\n      partialResults\n    };\n  };\n  class ArchiveSearchRuntime {\n    authoredIndex = buildCorpusIndex("authored", []);\n    contextIndex = buildCorpusIndex("context", []);\n    authoredItemsRef = null;\n    authoredRevisionToken = 0;\n    contextItemsRef = null;\n    setAuthoredItems(items, revisionToken = 0) {\n      if (this.authoredItemsRef === items && this.authoredRevisionToken === revisionToken) return;\n      if (this.authoredItemsRef && this.authoredItemsRef !== items && tryApplyAppendOnlyPatch(this.authoredIndex, "authored", items)) {\n        this.authoredItemsRef = items;\n        this.authoredRevisionToken = revisionToken;\n        return;\n      }\n      this.authoredItemsRef = items;\n      this.authoredRevisionToken = revisionToken;\n      this.authoredIndex = buildCorpusIndex("authored", items);\n    }\n    setContextItems(items) {\n      if (this.contextItemsRef === items) return;\n      if (this.contextItemsRef && tryApplyAppendOnlyPatch(this.contextIndex, "context", items)) {\n        this.contextItemsRef = items;\n        return;\n      }\n      this.contextItemsRef = items;\n      this.contextIndex = buildCorpusIndex("context", items);\n    }\n    runSearch(request) {\n      const startMs = Date.now();\n      const budgetMs = request.budgetMs ?? DEFAULT_BUDGET_MS;\n      const parsed = parseStructuredQuery(request.query);\n      const warnings = [...parsed.warnings];\n      let resolvedScope = request.scopeParam || "authored";\n      if (!request.scopeParam && parsed.scopeDirectives.length > 0) {\n        resolvedScope = parsed.scopeDirectives[parsed.scopeDirectives.length - 1];\n      } else if (request.scopeParam && parsed.scopeDirectives.length > 0) {\n        const parsedScope = parsed.scopeDirectives[parsed.scopeDirectives.length - 1];\n        if (parsedScope !== request.scopeParam) {\n          warnings.push({\n            type: "invalid-scope",\n            token: `scope:${parsedScope}`,\n            message: "URL scope parameter takes precedence over in-query scope"\n          });\n        }\n      }\n      let isNegationOnly = warnings.some((w) => w.type === "negation-only");\n      if (!isNegationOnly) {\n        const hasNegation = parsed.clauses.some((clause) => clause.negated);\n        const hasPositiveClause = parsed.clauses.some((clause) => !clause.negated);\n        if (hasNegation && !hasPositiveClause) {\n          isNegationOnly = true;\n          warnings.push({\n            type: "negation-only",\n            token: parsed.rawQuery,\n            message: \'Add a positive clause or use "*" before negations\'\n          });\n        }\n      }\n      if (isNegationOnly) {\n        const diagnostics2 = {\n          warnings,\n          parseState: "invalid",\n          degradedMode: false,\n          partialResults: false,\n          tookMs: Date.now() - startMs,\n          stageACandidateCount: 0,\n          stageBScanned: 0,\n          totalCandidatesBeforeLimit: 0,\n          explain: ["Query rejected: negations require at least one positive clause"]\n        };\n        return {\n          ids: [],\n          total: 0,\n          items: [],\n          canonicalQuery: parsed.executableQuery,\n          resolvedScope,\n          diagnostics: diagnostics2\n        };\n      }\n      const corpora = resolvedScope === "all" ? [this.authoredIndex, this.contextIndex] : [this.authoredIndex];\n      let stageACandidateCount = 0;\n      let stageBScanned = 0;\n      let partialResults = false;\n      const mergedWarnings = [...warnings];\n      const mergedDocs = /* @__PURE__ */ new Map();\n      const mergedSignals = /* @__PURE__ */ new Map();\n      for (const corpus of corpora) {\n        const result = executeAgainstCorpus(corpus, parsed.clauses, startMs, budgetMs);\n        stageACandidateCount += result.stageACandidateCount;\n        stageBScanned += result.stageBScanned;\n        partialResults = partialResults || result.partialResults;\n        result.docs.forEach((doc) => {\n          const existing = mergedDocs.get(doc.id);\n          if (!existing) {\n            mergedDocs.set(doc.id, doc);\n            const signal = result.relevanceSignalsById.get(doc.id);\n            if (signal) mergedSignals.set(doc.id, signal);\n            return;\n          }\n          if (existing.source === "authored") return;\n          if (doc.source === "authored") {\n            mergedDocs.set(doc.id, doc);\n            const signal = result.relevanceSignalsById.get(doc.id);\n            if (signal) mergedSignals.set(doc.id, signal);\n          }\n        });\n      }\n      const sortedDocs = sortSearchDocs(Array.from(mergedDocs.values()), request.sortMode, mergedSignals);\n      const total = sortedDocs.length;\n      const limitedDocs = sortedDocs.slice(0, request.limit);\n      const getItemForDoc = (doc) => {\n        if (doc.source === "authored") {\n          return this.authoredIndex.itemsById.get(doc.id) || this.contextIndex.itemsById.get(doc.id) || null;\n        }\n        return this.contextIndex.itemsById.get(doc.id) || this.authoredIndex.itemsById.get(doc.id) || null;\n      };\n      const resolved = limitedDocs.map((doc) => ({ doc, item: getItemForDoc(doc) })).filter((entry) => Boolean(entry.item));\n      const ids = resolved.map((entry) => entry.doc.id);\n      const items = resolved.map((entry) => entry.item);\n      const parseState = mergedWarnings.some((w) => w.type === "negation-only" || w.type === "invalid-query") ? "invalid" : mergedWarnings.length > 0 ? "warning" : "valid";\n      const diagnostics = {\n        warnings: mergedWarnings,\n        parseState,\n        degradedMode: partialResults || mergedWarnings.some((w) => w.type === "regex-unsafe" || w.type === "regex-too-long"),\n        partialResults,\n        tookMs: Date.now() - startMs,\n        stageACandidateCount,\n        stageBScanned,\n        totalCandidatesBeforeLimit: total,\n        explain: [\n          `scope=${resolvedScope}`,\n          `stageA_candidates=${stageACandidateCount}`,\n          `stageB_scanned=${stageBScanned}`,\n          `total=${total}`\n        ]\n      };\n      return {\n        ids,\n        total,\n        items,\n        canonicalQuery: parsed.executableQuery,\n        resolvedScope,\n        diagnostics\n      };\n    }\n  }\n  const SEARCH_SCHEMA_VERSION = 1;\n  const runtime = new ArchiveSearchRuntime();\n  let indexVersion = 0;\n  const cancelledRequests = /* @__PURE__ */ new Map();\n  const CANCEL_MAX = 2e3;\n  const CANCEL_TTL_MS = 1e4;\n  const noteCancel = (id) => {\n    const now = Date.now();\n    cancelledRequests.set(id, now);\n    if (cancelledRequests.size > CANCEL_MAX) {\n      for (const [key, ts] of cancelledRequests) {\n        if (now - ts > CANCEL_TTL_MS) cancelledRequests.delete(key);\n      }\n      if (cancelledRequests.size > CANCEL_MAX) cancelledRequests.clear();\n    }\n  };\n  const consumeCancel = (id) => {\n    if (!cancelledRequests.has(id)) return false;\n    cancelledRequests.delete(id);\n    return true;\n  };\n  let fullBatch = null;\n  let authoredItems = [];\n  let contextItems = [];\n  const post = (message) => {\n    self.postMessage(message);\n  };\n  const emitSchemaError = (message, scope = {}) => {\n    if ("kind" in message && message.kind === "query.run") {\n      post({ kind: "error", requestId: message.requestId, message: `Schema mismatch: expected ${SEARCH_SCHEMA_VERSION}` });\n      return;\n    }\n    post({\n      kind: "error",\n      ...scope,\n      message: `Schema mismatch: expected ${SEARCH_SCHEMA_VERSION}`\n    });\n  };\n  const setCorpusItems = (source, items) => {\n    if (source === "authored") {\n      authoredItems = items;\n      runtime.setAuthoredItems(authoredItems, indexVersion);\n      return;\n    }\n    contextItems = items;\n    runtime.setContextItems(contextItems);\n  };\n  const applyPatch = (source, upserts, deletes) => {\n    const base = source === "authored" ? authoredItems : contextItems;\n    const byId = /* @__PURE__ */ new Map();\n    for (const item of base) byId.set(item._id, item);\n    for (const id of deletes) byId.delete(id);\n    for (const item of upserts) byId.set(item._id, item);\n    setCorpusItems(source, Array.from(byId.values()));\n  };\n  const handleFullStart = (message) => {\n    if (message.schemaVersion !== SEARCH_SCHEMA_VERSION) {\n      emitSchemaError(message, { batchId: message.batchId });\n      return;\n    }\n    fullBatch = {\n      batchId: message.batchId,\n      source: message.source,\n      totalChunks: 0,\n      nextChunkIndex: 0,\n      items: [],\n      startedAtMs: Date.now()\n    };\n  };\n  const handleFullChunk = (message) => {\n    if (!fullBatch || fullBatch.batchId !== message.batchId || fullBatch.source !== message.source) {\n      post({ kind: "error", batchId: message.batchId, message: "Unknown or inactive full index batch" });\n      return;\n    }\n    if (fullBatch.totalChunks === 0) {\n      fullBatch.totalChunks = message.totalChunks;\n    } else if (fullBatch.totalChunks !== message.totalChunks) {\n      post({ kind: "error", batchId: message.batchId, message: "Mismatched totalChunks for batch" });\n      return;\n    }\n    if (message.chunkIndex !== fullBatch.nextChunkIndex) {\n      post({ kind: "error", batchId: message.batchId, message: "Out-of-order chunk index for batch" });\n      return;\n    }\n    fullBatch.items.push(...message.items);\n    fullBatch.nextChunkIndex += 1;\n  };\n  const handleFullCommit = (message) => {\n    if (!fullBatch || fullBatch.batchId !== message.batchId || fullBatch.source !== message.source) {\n      post({ kind: "error", batchId: message.batchId, message: "Unknown or inactive full index batch commit" });\n      return;\n    }\n    if (fullBatch.totalChunks > 0 && fullBatch.nextChunkIndex !== fullBatch.totalChunks) {\n      post({ kind: "error", batchId: message.batchId, message: "Full index commit called before all chunks arrived" });\n      return;\n    }\n    setCorpusItems(fullBatch.source, fullBatch.items);\n    indexVersion += 1;\n    const docCount = fullBatch.source === "authored" ? authoredItems.length : contextItems.length;\n    post({\n      kind: "index.ready",\n      source: "full",\n      corpus: fullBatch.source,\n      batchId: fullBatch.batchId,\n      indexVersion,\n      docCount,\n      buildMs: Date.now() - fullBatch.startedAtMs\n    });\n    fullBatch = null;\n  };\n  const handlePatch = (message) => {\n    if (message.schemaVersion !== SEARCH_SCHEMA_VERSION) {\n      emitSchemaError(message, { patchId: message.patchId });\n      return;\n    }\n    const started = Date.now();\n    applyPatch(message.source, message.upserts, message.deletes);\n    indexVersion += 1;\n    post({\n      kind: "index.ready",\n      source: "patch",\n      corpus: message.source,\n      patchId: message.patchId,\n      indexVersion,\n      docCount: message.source === "authored" ? authoredItems.length : contextItems.length,\n      buildMs: Date.now() - started\n    });\n  };\n  const handleQuery = (message) => {\n    if (consumeCancel(message.requestId)) return;\n    const result = runtime.runSearch({\n      query: message.query,\n      limit: message.limit,\n      sortMode: message.sortMode,\n      scopeParam: message.scopeParam,\n      budgetMs: message.budgetMs\n    });\n    if (consumeCancel(message.requestId)) return;\n    post({\n      kind: "query.result",\n      requestId: message.requestId,\n      indexVersion,\n      ids: result.ids,\n      total: result.total,\n      canonicalQuery: result.canonicalQuery,\n      resolvedScope: result.resolvedScope,\n      diagnostics: result.diagnostics\n    });\n  };\n  self.addEventListener("message", (event) => {\n    const message = event.data;\n    switch (message.kind) {\n      case "index.full.start":\n        handleFullStart(message);\n        break;\n      case "index.full.chunk":\n        handleFullChunk(message);\n        break;\n      case "index.full.commit":\n        handleFullCommit(message);\n        break;\n      case "index.patch":\n        handlePatch(message);\n        break;\n      case "query.cancel":\n        noteCancel(message.requestId);\n        break;\n      case "query.run":\n        handleQuery(message);\n        break;\n      default:\n        post({ kind: "error", message: "Unsupported worker request kind" });\n    }\n  });\n})();\n';
  const blob = typeof self !== "undefined" && self.Blob && new Blob(["(self.URL || self.webkitURL).revokeObjectURL(self.location.href);", jsContent], { type: "text/javascript;charset=utf-8" });
  function WorkerWrapper(options) {
    let objURL;
    try {
      objURL = blob && (self.URL || self.webkitURL).createObjectURL(blob);
      if (!objURL) throw "";
      const worker = new Worker(objURL, {
        name: options?.name
      });
      worker.addEventListener("error", () => {
        (self.URL || self.webkitURL).revokeObjectURL(objURL);
      });
      return worker;
    } catch (e) {
      return new Worker(
        "data:text/javascript;charset=utf-8," + encodeURIComponent(jsContent),
        {
          name: options?.name
        }
      );
    }
  }
  const createSearchWorkerClient = () => new SearchWorkerClient(new WorkerWrapper());
  const AUTO_RETRY_KEY = "power-reader-archive-auto-retry";
  const MAX_AUTO_RETRIES = 50;
  const INITIAL_BACKOFF_MS = 2e3;
  const PAGE_SIZE = 1e4;
  const SEARCH_DEBOUNCE_MS = 180;
  const ARCHIVE_SEARCH_HELP_TEXT = 'Search tips: terms, "phrases", /regex/i, author:, replyto:, type:post|comment, score:>10, date:2025-01-01..2025-01-31, scope:all';
  const initArchive = async (username) => {
    Logger.info(`Initializing User Archive for: ${username}`);
    try {
      resetRenderLimit();
      executeTakeover();
      await initializeReactions();
      rebuildDocument();
      initPreviewSystem();
      const state2 = createInitialArchiveState(username);
      const root = document.getElementById("power-reader-root");
      if (!root) return;
      if (!document.getElementById("pr-archive-styles")) {
        const style = document.createElement("style");
        style.id = "pr-archive-styles";
        style.textContent = `
        .pr-archive-toolbar {
            display: flex;
            gap: 10px;
            margin: 10px 0;
            flex-wrap: wrap;
        }
        .pr-archive-toolbar select {
            padding: 8px;
            border-radius: 4px;
            border: 1px solid var(--pr-border-color);
            background: var(--pr-bg-secondary);
            color: var(--pr-text-primary);
        }
        .pr-archive-search-status {
            margin-top: 8px;
            font-size: 0.9em;
            color: var(--pr-text-secondary);
        }
        .pr-archive-search-status.warning {
            color: #f6c453;
        }
        .pr-archive-search-status.error {
            color: #ff6b6b;
        }
        .pr-search-retry-btn {
            margin-left: 8px;
            padding: 2px 8px;
            font-size: 0.85em;
            cursor: pointer;
            background: var(--pr-bg-secondary);
            border: 1px solid var(--pr-border-color);
            border-radius: 4px;
            color: var(--pr-text-primary);
        }
        .pr-search-retry-btn:hover {
            background: var(--pr-bg-hover, #333);
        }
        .pr-archive-index-item {
            display: flex;
            align-items: center;
            padding: 8px;
            border-bottom: 1px solid var(--pr-border-subtle);
            color: var(--pr-text-primary);
            text-decoration: none;
        }
        .pr-archive-index-item:hover {
            background: var(--pr-bg-secondary);
        }
        .pr-index-score {
            width: 50px;
            text-align: right;
            margin-right: 15px;
            font-weight: bold;
            color: var(--pr-text-secondary);
        }
        .pr-index-title {
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .pr-index-meta {
            font-size: 0.85em;
            color: var(--pr-text-tertiary);
            margin-left: 10px;
            min-width: 120px;
            text-align: right;
        }
        
        /* Thread View Styles - now handled mostly by PostGroup, but shell styles might remain useful */
        .pr-thread-wrapper {
             background: var(--pr-bg-primary);
        }
        
        .pr-status.status-error {
            color: #ff6b6b;
            font-weight: bold;
        }
        .pr-status.status-syncing::after {
            content: '...';
            display: inline-block;
            width: 12px;
            animation: pr-dots 1.5s steps(4, end) infinite;
        }
        @keyframes pr-dots {
            0%, 20% { content: ''; }
            40% { content: '.'; }
            60% { content: '..'; }
            80% { content: '...'; }
        }
        
        /* Error UI Styles */
        .pr-archive-error {
            background: var(--pr-bg-secondary);
            border: 1px solid #ff6b6b;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .pr-archive-error-title {
            color: #ff6b6b;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .pr-archive-error-message {
            color: var(--pr-text-secondary);
            margin-bottom: 15px;
            font-family: monospace;
            font-size: 0.9em;
        }
        .pr-archive-error-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-bottom: 15px;
        }
        .pr-archive-error-options {
            border-top: 1px solid var(--pr-border-subtle);
            padding-top: 15px;
            margin-top: 15px;
        }
        .pr-archive-error-options label {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            color: var(--pr-text-secondary);
        }
        .pr-archive-error-options input[type="checkbox"] {
            cursor: pointer;
        }
        .pr-archive-retry-indicator {
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--pr-text-secondary);
            font-size: 0.9em;
        }
        .pr-archive-retry-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid var(--pr-border-color);
            border-top-color: var(--pr-text-primary);
            border-radius: 50%;
            animation: pr-spin 1s linear infinite;
        }
        @keyframes pr-spin {
            to { transform: rotate(360deg); }
        }
        .pr-archive-cancel-btn {
            background: transparent;
            border: 1px solid var(--pr-border-color);
            color: var(--pr-text-secondary);
            padding: 4px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.85em;
        }
        .pr-archive-cancel-btn:hover {
            background: var(--pr-bg-secondary);
        }
        
        /* Performance optimization for large lists */
        .pr-archive-item {
            content-visibility: auto;
            contain-intrinsic-size: 0 300px;
        }
        
        .pr-context-placeholder {
            opacity: 0.7;
            border-left: 2px solid #555;
            padding-left: 8px;
        }
        
        /* Render limit dialog */
        .pr-archive-render-dialog {
            background: var(--pr-bg-secondary);
            border: 2px solid var(--pr-border-color);
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            max-width: 500px;
        }
        .pr-archive-render-dialog h3 {
            margin-top: 0;
            color: var(--pr-text-primary);
        }
        .pr-archive-render-dialog p {
            color: var(--pr-text-secondary);
            margin-bottom: 15px;
        }
        .pr-archive-render-dialog input[type="number"] {
            width: 120px;
            padding: 8px;
            border: 1px solid var(--pr-border-color);
            border-radius: 4px;
            background: var(--pr-bg-primary);
            color: var(--pr-text-primary);
            font-size: 1em;
        }
        .pr-archive-render-dialog .pr-dialog-actions {
            margin-top: 15px;
            display: flex;
            gap: 10px;
        }
    `;
        document.head.appendChild(style);
      }
      root.innerHTML = `
    <div class="pr-header">
      <h1>User Archive: ${escapeHtml(username)} <small style="font-size: 0.6em; color: #888;">v${"1.2.682"}</small></h1>
      <div class="pr-status" id="archive-status">Checking local database...</div>
    </div>
    
    <div class="pr-archive-container" style="padding: 10px; background: var(--pr-bg-secondary); border-radius: 8px;">
        <div class="pr-archive-toolbar">
            <input type="text" id="archive-search" placeholder='Search terms, "phrases", /regex/, author:, replyto:, type:, score:, date:, scope:' class="pr-input" style="flex: 2; min-width: 260px;">
            <select id="archive-scope">
                <option value="authored">Scope: Authored</option>
                <option value="all">Scope: Authored + Context</option>
            </select>
            <select id="archive-sort">
                <option value="relevance">Relevance</option>
                <option value="date">Date (Newest)</option>
                <option value="date-asc">Date (Oldest)</option>
                <option value="score">Karma (High-Low)</option>
                <option value="score-asc">Karma (Low-High)</option>
                <option value="replyTo">Reply To (Name)</option>
            </select>
             <select id="archive-view">
                <option value="card">Card View</option>
                <option value="index">Index View</option>
                <option value="thread-full">Thread View (Full Context)</option>
                <option value="thread-placeholder">Thread View (Placeholder)</option>
            </select>
            <button id="archive-resync" class="pr-button" title="Force re-download all data">Resync</button>
        </div>
        <div id="archive-search-status" class="pr-archive-search-status">${ARCHIVE_SEARCH_HELP_TEXT}</div>
    </div>

    <div id="archive-error-container" style="display: none;"></div>
    
    <div id="archive-dashboard" class="pr-setup" style="max-width: 800px; display: none;">
      Loading archive data...
    </div>
    <div id="archive-feed" style="margin-top: 20px"></div>
    <div id="archive-load-more" style="text-align: center; margin: 20px; display: none;">
        <button class="pr-button">Load More</button>
    </div>
  `;
      const statusEl = document.getElementById("archive-status");
      const dashboardEl = document.getElementById("archive-dashboard");
      const feedEl = document.getElementById("archive-feed");
      const loadMoreBtn = document.getElementById("archive-load-more");
      const searchInput = document.getElementById("archive-search");
      const scopeSelect = document.getElementById("archive-scope");
      const sortSelect = document.getElementById("archive-sort");
      const viewSelect = document.getElementById("archive-view");
      const resyncBtn = document.getElementById("archive-resync");
      const errorContainer = document.getElementById("archive-error-container");
      const searchStatusEl = document.getElementById("archive-search-status");
      if (searchInput) {
        searchInput.title = [
          "Archive search examples:",
          'author:"wei dai" type:comment score:>20',
          'date:2025-01-01..2025-01-31 "alignment"',
          "/mesa\\s+optimizer/i scope:all"
        ].join("\n");
      }
      let statusBaseMessage = "Checking local database...";
      let statusSearchResultCount = null;
      const renderTopStatusLine = () => {
        if (!statusEl) return;
        if (statusSearchResultCount === null) {
          statusEl.textContent = statusBaseMessage;
          return;
        }
        const resultLabel = `${statusSearchResultCount.toLocaleString()} search result${statusSearchResultCount === 1 ? "" : "s"}`;
        statusEl.textContent = statusBaseMessage ? `${statusBaseMessage} | ${resultLabel}` : resultLabel;
      };
      const setStatusBaseMessage = (msg, isError2 = false, isSyncing = false) => {
        statusBaseMessage = msg;
        if (!statusEl) return;
        statusEl.classList.toggle("status-error", isError2);
        statusEl.classList.toggle("status-syncing", isSyncing);
        renderTopStatusLine();
      };
      const setStatusSearchResultCount = (count) => {
        statusSearchResultCount = count;
        renderTopStatusLine();
      };
      renderTopStatusLine();
      let activeItems = state2.items;
      const workerPreference = window.__PR_ARCHIVE_SEARCH_USE_WORKER;
      const shouldUseSearchWorker = workerPreference !== false;
      let workerClient = null;
      if (shouldUseSearchWorker) {
        try {
          workerClient = createSearchWorkerClient();
        } catch (error) {
          Logger.warn("Archive search worker unavailable; falling back to runtime search.", error);
        }
      }
      const searchManager = new ArchiveSearchManager({
        useWorker: shouldUseSearchWorker,
        workerClient
      });
      const urlState = parseArchiveUrlState();
      let persistedContextItems = [];
      let useDedicatedScopeParam = urlState.scopeFromUrl;
      let searchDispatchTimer = null;
      let activeQueryRequestId = 0;
      let activeItemById = new Map();
      let authoredIndexItemsRef = null;
      let authoredIndexCanonicalRevision = -1;
      let authoredItemsVersion = 0;
      let contextSearchItemsCache = null;
      const LARGE_DATASET_THRESHOLD = window.__PR_ARCHIVE_LARGE_THRESHOLD || 1e4;
      let pendingRenderCount = null;
      searchInput.value = urlState.query;
      sortSelect.value = urlState.sort;
      if (!sortSelect.value) sortSelect.value = "date";
      scopeSelect.value = urlState.scope;
      if (!scopeSelect.value) scopeSelect.value = "authored";
      state2.sortBy = sortSelect.value;
      const runPostRenderHooks = () => {
        setupLinkPreviews(uiHost.getReaderState().comments);
        const posts = feedEl.querySelectorAll(".pr-post");
        posts.forEach((p) => {
          const pid = p.getAttribute("data-id") || p.getAttribute("data-post-id");
          if (pid) refreshPostActionButtons(pid);
        });
      };
      const syncAuthoredSearchIndex = () => {
        const canonicalRevision = uiHost.getCanonicalStateRevision();
        if (authoredIndexItemsRef === state2.items && authoredIndexCanonicalRevision === canonicalRevision) return;
        searchManager.setAuthoredItems(state2.items, canonicalRevision);
        authoredIndexItemsRef = state2.items;
        authoredIndexCanonicalRevision = canonicalRevision;
        authoredItemsVersion += 1;
        contextSearchItemsCache = null;
      };
      const collectContextSearchItems = () => {
        const readerRevision = uiHost.getSearchStateRevision();
        if (contextSearchItemsCache && contextSearchItemsCache.persistedRef === persistedContextItems && contextSearchItemsCache.authoredVersion === authoredItemsVersion && contextSearchItemsCache.readerRevision === readerRevision) {
          return contextSearchItemsCache.items;
        }
        const merged = new Map();
        for (const item of persistedContextItems) {
          if (state2.itemById.has(item._id)) continue;
          merged.set(item._id, item);
        }
        const readerState = uiHost.getReaderState();
        for (const post of readerState.posts) {
          if (state2.itemById.has(post._id)) continue;
          merged.set(post._id, post);
        }
        for (const comment of readerState.comments) {
          if (state2.itemById.has(comment._id)) continue;
          merged.set(comment._id, comment);
        }
        const items = Array.from(merged.values());
        contextSearchItemsCache = {
          persistedRef: persistedContextItems,
          authoredVersion: authoredItemsVersion,
          readerRevision,
          items
        };
        return items;
      };
      const updateSearchStatus = (diagnostics, resolvedScope, contextItemCount, sortMode) => {
        if (!searchStatusEl) return;
        const messages = [];
        if (resolvedScope === "all") {
          messages.push(`Searching authored + cached context (${contextItemCount} items)`);
          if (contextItemCount === 0) {
            messages.push("Context cache may be incomplete");
          }
          if (sortMode === "replyTo") {
            messages.push("replyTo ordering is computed over mixed authored/context semantics");
          }
        }
        if (diagnostics.partialResults) {
          messages.push(`Partial results (${diagnostics.tookMs}ms budget hit)`);
        }
        if (diagnostics.warnings.length > 0) {
          messages.push(diagnostics.warnings[0].message);
        }
        searchStatusEl.textContent = "";
        searchStatusEl.appendChild(document.createTextNode(messages.join(" | ") || ARCHIVE_SEARCH_HELP_TEXT));
        if (diagnostics.partialResults) {
          const retryBtn = document.createElement("button");
          retryBtn.className = "pr-search-retry-btn";
          retryBtn.textContent = "Run without time limit";
          retryBtn.addEventListener("click", () => {
            refreshView(0);
          });
          searchStatusEl.appendChild(retryBtn);
        }
        searchStatusEl.classList.remove("warning", "error");
        if (diagnostics.parseState === "invalid") {
          searchStatusEl.classList.add("error");
        } else if (diagnostics.parseState === "warning" || diagnostics.degradedMode || diagnostics.partialResults) {
          searchStatusEl.classList.add("warning");
        }
      };
      const ensureSearchResultContextLoaded = (items) => {
        const contextComments = [];
        const contextPosts = [];
        const readerState = uiHost.getReaderState();
        for (const item of items) {
          if (state2.itemById.has(item._id)) continue;
          if ("title" in item) {
            if (!readerState.postById.has(item._id)) {
              contextPosts.push(item);
            }
            continue;
          }
          if (!readerState.commentById.has(item._id)) {
            contextComments.push(item);
          }
        }
        if (contextComments.length > 0) {
          uiHost.mergeComments(contextComments, true);
        }
        if (contextPosts.length > 0) {
          for (const post of contextPosts) {
            uiHost.upsertPost(post, false);
          }
        }
      };
      const refreshView = async (budgetMs) => {
        const requestId = ++activeQueryRequestId;
        const sortMode = sortSelect.value;
        syncAuthoredSearchIndex();
        const contextItems = collectContextSearchItems();
        searchManager.setContextItems(contextItems);
        const scopeParam = useDedicatedScopeParam ? scopeSelect.value : void 0;
        const result = await searchManager.runSearch({
          query: searchInput.value,
          scopeParam,
          sortMode,
          limit: state2.items.length + contextItems.length + 5,
          ...budgetMs !== void 0 ? { budgetMs } : {}
        });
        if (requestId !== activeQueryRequestId) {
          return;
        }
        activeItems = result.items;
        activeItemById = new Map(activeItems.map((item) => [item._id, item]));
        ensureSearchResultContextLoaded(activeItems);
        if (!useDedicatedScopeParam && result.resolvedScope !== "authored") {
          useDedicatedScopeParam = true;
        }
        scopeSelect.value = result.resolvedScope;
        writeArchiveUrlState({
          query: result.canonicalQuery,
          scope: result.resolvedScope,
          sort: sortMode
        });
        setStatusSearchResultCount(result.total);
        updateSearchStatus(result.diagnostics, result.resolvedScope, contextItems.length, sortMode);
        const totalItems = activeItems.length;
        if (totalItems >= LARGE_DATASET_THRESHOLD && pendingRenderCount === null) {
          showRenderCountDialog(totalItems, async (count) => {
            pendingRenderCount = count;
            updateRenderLimit(count);
            await renderArchiveFeed(feedEl, activeItems, state2.viewMode, uiHost.getReaderState(), state2.sortBy);
            runPostRenderHooks();
          });
          return;
        }
        if (pendingRenderCount !== null) {
          updateRenderLimit(pendingRenderCount);
        }
        await renderArchiveFeed(feedEl, activeItems, state2.viewMode, uiHost.getReaderState(), state2.sortBy);
        runPostRenderHooks();
      };
      const uiHost = new ArchiveUIHost(state2, feedEl, refreshView);
      setUIHost(uiHost);
      attachEventListeners(uiHost.getReaderState());
      initAIStudioListener(uiHost.getReaderState());
      setupExternalLinks();
      setupInlineReactions(uiHost.getReaderState());
      const syncErrorState = {
        isRetrying: false,
        retryCount: 0,
        abortController: null
      };
      const updateItemMap = (items) => {
        items.forEach((i) => state2.itemById.set(i._id, i));
        syncAuthoredSearchIndex();
        contextSearchItemsCache = null;
        uiHost.rerenderAll();
      };
      const showRenderCountDialog = (totalCount, onConfirm) => {
        if (!feedEl) return;
        feedEl.innerHTML = `
        <div class="pr-archive-render-dialog">
          <h3>📊 Large Dataset Detected</h3>
          <p>This archive contains <strong>${totalCount.toLocaleString()}</strong> items. Rendering all at once may impact browser performance.</p>
          <p>How many items would you like to render initially?</p>
          <div>
            <input type="number" id="render-count-input" value="${Math.min(1e3, totalCount)}" 
                   min="1" max="${totalCount}" step="100">
            <span style="margin-left: 10px; color: var(--pr-text-secondary);">/ ${totalCount.toLocaleString()} total</span>
          </div>
          <div class="pr-dialog-actions">
            <button id="render-confirm-btn" class="pr-button">Render Selected</button>
            <button id="render-all-btn" class="pr-button">Render All (${totalCount.toLocaleString()})</button>
          </div>
          <p style="font-size: 0.85em; color: var(--pr-text-tertiary); margin-top: 10px;">
            💡 Tip: Use the "Load More" button to view additional items after initial render.
          </p>
        </div>
      `;
        const confirmBtn = document.getElementById("render-confirm-btn");
        const renderAllBtn = document.getElementById("render-all-btn");
        const input = document.getElementById("render-count-input");
        confirmBtn?.addEventListener("click", () => {
          const count = parseInt(input?.value || "1000", 10);
          onConfirm(Math.min(Math.max(1, count), totalCount));
        });
        renderAllBtn?.addEventListener("click", () => {
          onConfirm(totalCount);
        });
      };
      const scheduleSearchRefresh = () => {
        if (searchDispatchTimer) {
          window.clearTimeout(searchDispatchTimer);
        }
        searchDispatchTimer = window.setTimeout(() => {
          void refreshView();
        }, SEARCH_DEBOUNCE_MS);
      };
      searchInput?.addEventListener("input", () => {
        scheduleSearchRefresh();
      });
      searchInput?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          if (searchDispatchTimer) {
            window.clearTimeout(searchDispatchTimer);
            searchDispatchTimer = null;
          }
          void refreshView();
        }
      });
      scopeSelect?.addEventListener("change", () => {
        useDedicatedScopeParam = true;
        void refreshView();
      });
      sortSelect?.addEventListener("change", () => {
        state2.sortBy = sortSelect.value;
        void refreshView();
      });
      viewSelect?.addEventListener("change", () => {
        state2.viewMode = viewSelect.value;
        const replyToOption = sortSelect.querySelector('option[value="replyTo"]');
        const relevanceOption = sortSelect.querySelector('option[value="relevance"]');
        if (replyToOption) {
          if (isThreadMode(state2.viewMode)) {
            replyToOption.disabled = true;
            if (relevanceOption) relevanceOption.disabled = true;
            if (state2.sortBy === "replyTo" || state2.sortBy === "relevance") {
              state2.sortBy = "date";
              sortSelect.value = "date";
            }
          } else {
            replyToOption.disabled = false;
            if (relevanceOption) relevanceOption.disabled = false;
          }
        }
        void refreshView();
      });
      loadMoreBtn?.querySelector("button")?.addEventListener("click", async () => {
        incrementRenderLimit(PAGE_SIZE);
        await renderArchiveFeed(feedEl, activeItems, state2.viewMode, uiHost.getReaderState(), state2.sortBy);
        runPostRenderHooks();
      });
      feedEl?.addEventListener("click", (e) => {
        const target = e.target;
        const expandTarget = target.closest('[data-action="expand-index-item"]');
        if (expandTarget) {
          const id = expandTarget.getAttribute("data-id");
          const item = id ? activeItemById.get(id) || state2.itemById.get(id) : null;
          if (!item) return;
          const wrapper = document.createElement("div");
          wrapper.className = "pr-index-expanded";
          wrapper.setAttribute("data-id", id);
          wrapper.innerHTML = `
        <button class="pr-button pr-index-collapse-btn"
                data-action="collapse-index-item" data-id="${id}" style="margin-bottom: 8px;">▲ Collapse</button>
        ${renderCardItem(item, uiHost.getReaderState())}
      `;
          expandTarget.replaceWith(wrapper);
          runPostRenderHooks();
          return;
        }
        const collapseTarget = target.closest('[data-action="collapse-index-item"]');
        if (collapseTarget) {
          const id = collapseTarget.getAttribute("data-id");
          const item = id ? activeItemById.get(id) || state2.itemById.get(id) : null;
          if (!item) return;
          const expanded = collapseTarget.closest(".pr-index-expanded");
          if (expanded) {
            const tmp = document.createElement("div");
            tmp.innerHTML = renderIndexItem(item);
            const collapsedRow = tmp.firstElementChild;
            if (collapsedRow) {
              expanded.replaceWith(collapsedRow);
            }
          }
          return;
        }
      });
      const showErrorUI = (error, onRetry, onCancel) => {
        if (!errorContainer) return;
        const isAutoRetryEnabled = GM_getValue(AUTO_RETRY_KEY, false);
        const errorMessage = error.message || "Unknown error occurred";
        errorContainer.innerHTML = `
        <div class="pr-archive-error">
          <div class="pr-archive-error-title">⚠️ Sync Failed</div>
          <div class="pr-archive-error-message">${escapeHtml(errorMessage)}</div>
          <div class="pr-archive-error-actions">
            <button id="archive-retry-once" class="pr-button">Retry Once</button>
            <button id="archive-retry-auto" class="pr-button" style="display: ${isAutoRetryEnabled ? "none" : "inline-block"}">Auto-Retry with Backoff</button>
            <button id="archive-cancel" class="pr-archive-cancel-btn">Cancel</button>
          </div>
          <div class="pr-archive-error-options">
            <label>
              <input type="checkbox" id="archive-remember-auto-retry" ${isAutoRetryEnabled ? "checked" : ""}>
              <span>Remember this choice and auto-retry future errors</span>
            </label>
          </div>
        </div>
      `;
        errorContainer.style.display = "block";
        document.getElementById("archive-retry-once")?.addEventListener("click", () => {
          const remember = document.getElementById("archive-remember-auto-retry")?.checked;
          if (remember) GM_setValue(AUTO_RETRY_KEY, false);
          errorContainer.style.display = "none";
          onRetry(false);
        });
        document.getElementById("archive-retry-auto")?.addEventListener("click", () => {
          const remember = document.getElementById("archive-remember-auto-retry")?.checked;
          if (remember) GM_setValue(AUTO_RETRY_KEY, true);
          errorContainer.style.display = "none";
          onRetry(true);
        });
        document.getElementById("archive-cancel")?.addEventListener("click", () => {
          errorContainer.style.display = "none";
          onCancel();
        });
      };
      const showRetryProgress = (attempt, maxAttempts, nextRetryIn) => {
        if (!errorContainer || !statusEl) return;
        setStatusBaseMessage(`Sync failed. Retry ${attempt}/${maxAttempts}...`, true, false);
        errorContainer.innerHTML = `
        <div class="pr-archive-error">
          <div class="pr-archive-retry-indicator">
            <div class="pr-archive-retry-spinner"></div>
            <span>Retrying sync (attempt ${attempt} of ${maxAttempts})...</span>
            ${nextRetryIn ? `<span>Next retry in ${(nextRetryIn / 1e3).toFixed(1)}s</span>` : ""}
            <button id="archive-force-retry" class="pr-button" style="margin-left: 10px;">Retry Now</button>
            <button id="archive-cancel-retry" class="pr-archive-cancel-btn">Cancel</button>
          </div>
        </div>
      `;
        errorContainer.style.display = "block";
      };
      let isSyncInProgress = false;
      let pendingRetryCount = 0;
      const performSync = async (forceFull = false) => {
        if (isSyncInProgress) {
          Logger.debug("Sync already in progress, skipping duplicate request");
          return;
        }
        isSyncInProgress = true;
        pendingRetryCount = 0;
        const cached2 = await loadArchiveData(username);
        const setStatus = (msg, isError2 = false, isSyncing = false) => {
          setStatusBaseMessage(msg, isError2, isSyncing);
        };
        const attemptSync = async (useAutoRetry, attemptNumber = 1) => {
          syncErrorState.isRetrying = true;
          syncErrorState.retryCount = attemptNumber;
          syncErrorState.abortController = new AbortController();
          try {
            if (attemptNumber > 1) {
              setStatus(`Retrying sync (attempt ${attemptNumber})`, false, true);
            } else if (forceFull) {
              setStatus(`Starting full resync for ${username}`, false, true);
            } else if (cached2.items.length > 0) {
              setStatus(`Loaded ${cached2.items.length} items. Checking for updates`, false, true);
            } else {
              setStatus(`No local data. Fetching full history for ${username}`, false, true);
            }
            const lastSyncDate = forceFull ? null : cached2.lastSyncDate;
            await syncArchive(
              username,
              state2,
              lastSyncDate,
              (msg) => setStatus(msg, false, true),
              syncErrorState.abortController.signal
            );
            syncErrorState.isRetrying = false;
            syncErrorState.retryCount = 0;
            if (errorContainer) errorContainer.style.display = "none";
            setStatus(`Sync complete. ${state2.items.length} total items.`, false, false);
            updateItemMap(state2.items);
            if (pendingRetryCount === 0) {
              isSyncInProgress = false;
            }
          } catch (error) {
            syncErrorState.isRetrying = false;
            const errorMessage = error.message;
            const displayError = `Sync failed: ${errorMessage}`;
            setStatus(displayError, true, false);
            if (syncErrorState.abortController?.signal.aborted) {
              Logger.info("Sync was cancelled by user");
              setStatus(`Sync cancelled. Showing cached data (${cached2.items.length} items).`, false, false);
              pendingRetryCount = 0;
              isSyncInProgress = false;
              return;
            }
            const shouldAutoRetry = useAutoRetry || GM_getValue(AUTO_RETRY_KEY, false);
            if (shouldAutoRetry && attemptNumber < MAX_AUTO_RETRIES) {
              const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attemptNumber - 1);
              showRetryProgress(attemptNumber, MAX_AUTO_RETRIES, backoffMs);
              const forceRetryBtn = document.getElementById("archive-force-retry");
              const cancelRetryBtn = document.getElementById("archive-cancel-retry");
              let retryTimeout = null;
              pendingRetryCount++;
              const doRetry = () => {
                if (retryTimeout) clearTimeout(retryTimeout);
                pendingRetryCount--;
                attemptSync(true, attemptNumber + 1);
              };
              const doCancel = () => {
                if (retryTimeout) clearTimeout(retryTimeout);
                syncErrorState.abortController?.abort();
                if (errorContainer) errorContainer.style.display = "none";
                setStatus(`Sync cancelled. Showing cached data (${cached2.items.length} items).`, false, false);
                pendingRetryCount = 0;
                isSyncInProgress = false;
              };
              forceRetryBtn?.addEventListener("click", doRetry, { once: true });
              cancelRetryBtn?.addEventListener("click", doCancel, { once: true });
              retryTimeout = window.setTimeout(doRetry, backoffMs);
              return;
            } else {
              pendingRetryCount++;
              showErrorUI(error, (retryMode) => {
                pendingRetryCount--;
                attemptSync(retryMode, 1);
              }, () => {
                pendingRetryCount = 0;
                isSyncInProgress = false;
                setStatus(`Sync failed. Showing cached data (${cached2.items.length} items).`, true, false);
              });
            }
          }
        };
        const isAutoRetryEnabled = GM_getValue(AUTO_RETRY_KEY, false);
        try {
          await attemptSync(isAutoRetryEnabled);
        } finally {
          if (pendingRetryCount === 0) {
            isSyncInProgress = false;
          }
        }
      };
      resyncBtn?.addEventListener("click", () => {
        if (confirm("This will re-download the entire archive history. Continue?")) {
          performSync(true);
        }
      });
      const cached = await loadArchiveData(username);
      state2.items = cached.items;
      updateItemMap(state2.items);
      try {
        const cachedContext = await loadAllContextualItems(username);
        persistedContextItems = [...cachedContext.posts, ...cachedContext.comments];
        contextSearchItemsCache = null;
        if (persistedContextItems.length > 0 && (scopeSelect.value === "all" || searchInput.value.trim().length > 0)) {
          await refreshView();
        }
      } catch (e) {
        Logger.warn("Failed to load contextual cache for archive search scope:all", e);
        persistedContextItems = [];
        contextSearchItemsCache = null;
      }
      activeItems = state2.items;
      if (cached.items.length > 0) {
        setStatusBaseMessage(`Loaded ${cached.items.length} items from cache.`, false, false);
      } else {
        dashboardEl.style.display = "block";
        setStatusBaseMessage(`No local data. Fetching full history for ${username}...`, false, false);
      }
      await performSync();
      dashboardEl.style.display = "none";
      signalReady();
    } catch (err) {
      Logger.error("Failed to initialize archive:", err);
      const root = document.getElementById("power-reader-root");
      if (root) {
        const errorEl = document.createElement("div");
        errorEl.className = "pr-error";
        const message = err instanceof Error ? err.message : String(err);
        errorEl.textContent = `Failed to load archive: ${message}`;
        root.replaceChildren(errorEl);
      }
    }
  };
  const syncArchive = async (username, state2, lastSyncDate, onStatus, abortSignal) => {
    if (abortSignal?.aborted) {
      throw new Error("Sync aborted");
    }
    const syncStartTime = ( new Date()).toISOString();
    let userId = state2.userId;
    if (!userId) {
      const fetchedId = await fetchUserId(username);
      if (!fetchedId) throw new Error(`User ${username} not found`);
      state2.userId = fetchedId;
      userId = fetchedId;
    }
    if (abortSignal?.aborted) {
      throw new Error("Sync aborted");
    }
    const minDate = lastSyncDate ? new Date(lastSyncDate) : void 0;
    if (minDate) {
      onStatus(`Fetching items since ${minDate.toLocaleDateString()}...`);
    }
    const comments = await fetchUserComments(userId, (count) => {
      onStatus(`Fetching comments: ${count} new...`);
    }, minDate);
    if (abortSignal?.aborted) {
      throw new Error("Sync aborted");
    }
    const posts = await fetchUserPosts(userId, (count) => {
      onStatus(`Fetching posts: ${count} new...`);
    }, minDate);
    if (abortSignal?.aborted) {
      throw new Error("Sync aborted");
    }
    const newItems = [...posts, ...comments];
    if (abortSignal?.aborted) {
      throw new Error("Sync aborted");
    }
    if (newItems.length > 0) {
      onStatus(`Found ${newItems.length} new items. Merging...`);
      const existingIds = new Set(state2.items.map((i) => i._id));
      const uniqueNewItems = newItems.filter((i) => !existingIds.has(i._id));
      state2.items = [...uniqueNewItems, ...state2.items];
      state2.items.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
      await saveArchiveData(username, uniqueNewItems, syncStartTime);
      onStatus(`Sync complete. ${state2.items.length} total items.`);
    } else {
      const statusMsg = lastSyncDate ? `Up to date. (${state2.items.length} items)` : `No history found for ${username}.`;
      onStatus(statusMsg);
      await saveArchiveData(username, [], syncStartTime);
    }
  };
  const initReader = async () => {
    const route = getRoute();
    if (route.type === "skip") {
      return;
    }
    if (route.type === "forum-injection") {
      setupHeaderInjection();
      return;
    }
    if (route.type === "ai-studio") {
      await runAIStudioMode();
      return;
    }
    if (route.type === "archive") {
      await initArchive(route.username);
      return;
    }
    executeTakeover();
    setUIHost(new PowerReaderUIHost(getState()));
    try {
      await initializeReactions();
    } catch (e) {
      Logger.error("Reaction initialization failed:", e);
    }
    if (route.path === "reset") {
      Logger.info("Resetting storage...");
      clearAllStorage();
      window.location.href = "/reader";
      return;
    }
    rebuildDocument();
    const loadFrom = getLoadFrom();
    if (!loadFrom) {
      showSetupUI(handleStartReading);
      signalReady();
      return;
    }
    await loadAndRender();
  };
  const handleStartReading = async (loadFromDate) => {
    if (loadFromDate) {
      setLoadFrom(loadFromDate);
    } else {
      setLoadFrom("__LOAD_RECENT__");
    }
    await loadAndRender();
  };
  const loadAndRender = async () => {
    const root = getRoot();
    if (!root) return;
    const state2 = getState();
    root.innerHTML = `
    <div class="pr-header">
      <h1>Less Wrong: Power Reader <small style="font-size: 0.6em; color: #888;">v${"1.2.682"}</small></h1>
      <div class="pr-status">Fetching comments...</div>
    </div>
  `;
    const setStatus = (text2) => {
      const el = document.querySelector(".pr-status");
      if (el) el.textContent = text2;
    };
    try {
      Logger.info("Loading data...");
      const initialResult = await loadInitial();
      Logger.info("loadInitial complete");
      applyInitialLoad(state2, initialResult);
      if (state2.comments.length > 0) {
        state2.initialBatchNewestDate = state2.comments.reduce((newest, c) => {
          return new Date(c.postedAt) > new Date(newest) ? c.postedAt : newest;
        }, state2.comments[0].postedAt);
      }
      setStatus(`${state2.comments.length} comments — fetching posts & subscriptions...`);
      Logger.info("Enriching in background...");
      const enrichResult = await enrichInBackground(state2);
      Logger.info("enrichInBackground complete");
      applyEnrichment(state2, enrichResult);
      setStatus(`${state2.comments.length} comments & ${state2.primaryPostsCount} posts — loading replies...`);
      const readState = getReadState();
      const smartResult = await runSmartLoading(state2, readState);
      if (smartResult) {
        applySmartLoad(state2, smartResult);
        Logger.info(`Smart loaded: ${state2.comments.length} comments total`);
      }
      Logger.info(`Loaded ${state2.comments.length} comments and ${state2.posts.length} posts`);
      renderUI(state2);
      Logger.info("renderUI complete");
      signalReady();
      Logger.info("signalReady called");
      if (!root.dataset.listenersAttached) {
        initAIStudioListener(state2);
        setupAIStudioKeyboard(state2);
        attachEventListeners(state2);
        root.dataset.listenersAttached = "true";
      }
    } catch (e) {
      Logger.error("Page load failed:", e);
      root.innerHTML = `<div class="pr-error">Error loading reader. Check console.</div>`;
      signalReady();
    }
  };
  initReader();

})();