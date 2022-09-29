let slice = [].slice;

function setHashKey(obj, h) {
  if (h) {
    obj.$$hashKey = h;
  } else {
    delete obj.$$hashKey;
  }
}

function baseExtend(dst, objs, deep) {
  let h = dst.$$hashKey;

  for (let i = 0, ii = objs.length; i < ii; ++i) {
    let obj = objs[i];
    if (!isObject(obj) && !isFunction(obj)) continue;
    let keys = Object.keys(obj);
    for (let j = 0, jj = keys.length; j < jj; j++) {
      let key = keys[j];
      let src = obj[key];

      if (deep && isObject(src)) {
        if (!isObject(dst[key])) dst[key] = Array.isArray(src) ? [] : {};
        baseExtend(dst[key], [src], true);
      } else {
        dst[key] = src;
      }
    }
  }

  setHashKey(dst, h);
  return dst;
}

export function status(response) {
  if (response.status >= 200 && response.status < 400) {
    return response.json().catch((error) => null);
  }

  throw response;
}

export function isDefined(value) {
  return typeof value !== "undefined";
}

export function camelCase(name) {
  return name.replace(
    /([\:\-\_]+(.))/g,
    function (_, separator, letter, offset) {
      return offset ? letter.toUpperCase() : letter;
    }
  );
}

export function parseQueryString(keyValue) {
  let key;
  let value;
  let obj = {};

  // @ts-expect-error
  forEach((keyValue || "").split("&"), function (kv) {
    if (kv) {
      value = kv.split("=");
      key = decodeURIComponent(value[0]);
      obj[key] = isDefined(value[1]) ? decodeURIComponent(value[1]) : true;
    }
  });

  return obj;
}

export function isString(value) {
  return typeof value === "string";
}

export function isObject(value) {
  return value !== null && typeof value === "object";
}

export function isFunction(value) {
  return typeof value === "function";
}

export function joinUrl(baseUrl, url) {
  if (/^(?:[a-z]+:)?\/\//i.test(url)) {
    return url;
  }

  let joined = [baseUrl, url].join("/");
  let normalize = function (str) {
    return str
      .replace(/[\/]+/g, "/")
      .replace(/\/\?/g, "?")
      .replace(/\/\#/g, "#")
      .replace(/\:\//g, "://");
  };

  return normalize(joined);
}

export function isBlankObject(value) {
  return (
    value !== null && typeof value === "object" && !Object.getPrototypeOf(value)
  );
}

export function isArrayLike(obj) {
  if (obj === null || isWindow(obj)) {
    return false;
  }
}

export function isWindow(obj) {
  return obj && obj.window === obj;
}

export function extend(dst, tgt) {
  return baseExtend(dst, tgt, false);
}

export function merge(dst, tgt) {
  return baseExtend(dst, tgt, true);
}

export function forEach(obj, iterator, context) {
  let key;
  let length;
  if (obj) {
    if (isFunction(obj)) {
      for (key in obj) {
        // Need to check if hasOwnProperty exists,
        // as on IE8 the result of querySelectorAll is an object without a hasOwnProperty function
        if (
          key !== "prototype" &&
          key !== "length" &&
          key !== "name" &&
          (!obj.hasOwnProperty || obj.hasOwnProperty(key))
        ) {
          iterator.call(context, obj[key], key, obj);
        }
      }
    } else if (Array.isArray(obj) || isArrayLike(obj)) {
      let isPrimitive = typeof obj !== "object";
      for (key = 0, length = obj.length; key < length; key++) {
        if (isPrimitive || key in obj) {
          iterator.call(context, obj[key], key, obj);
        }
      }
    } else if (obj.forEach && obj.forEach !== forEach) {
      obj.forEach(iterator, context, obj);
    } else if (isBlankObject(obj)) {
      // createMap() fast path --- Safe to avoid hasOwnProperty check because prototype chain is empty
      for (key in obj) {
        iterator.call(context, obj[key], key, obj);
      }
    } else if (typeof obj.hasOwnProperty === "function") {
      // Slow path for objects inheriting Object.prototype, hasOwnProperty check needed
      for (key in obj) {
        if (obj.hasOwnProperty(key)) {
          iterator.call(context, obj[key], key, obj);
        }
      }
    } else {
      // Slow path for objects which do not have a method `hasOwnProperty`
      for (key in obj) {
        // @ts-expect-error
        if (hasOwnProperty.call(obj, key)) {
          iterator.call(context, obj[key], key, obj);
        }
      }
    }
  }
  return obj;
}
