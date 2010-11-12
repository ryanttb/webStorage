(function($) {
  var locationHostname = location.hostname;
  var webStorageId = locationHostname.replace(/\./g, '') + "_webStorage"; //< Used in userData, Gears & cookies
  var sessionWebStorage = null;
  var localWebStorage = null;

  $.webStorage = {
    session: function(options) {
      var settings = $.extend({
        allowWindowName: false // Never set to true unless you know you want it
      }, options);

      if (sessionWebStorage !== null) {
        return sessionWebStorage;
      }

      if ('sessionStorage' in window) {
        // Firefox 3.5, IE 8, Chrome 5
        sessionWebStorage = makeJsonStorage(window.sessionStorage, function() { return window.sessionStorage.length; });
        return sessionWebStorage;
      }

      (function() {
        // Cookies enabled
        if ('cookie' in document) {
          if (readCookie(webStorageId) === null) {
            createCookie(webStorageId, '{}');
          }

          if (readCookie(webStorageId) !== null) {
            function getCookieStorage() {
              try {
                return $.parseJSON(readCookie(webStorageId)) || {};
              } catch (ex) {
                return {};
              }
            }

            function getCookieStorageLength() {
              var cookieStorage = getCookieStorage();
              var cookieStorageLength = 0;
              for (var cookey in cookieStorage) {
                if (cookieStorage.hasOwnProperty(cookey)) {
                  cookieStorageLength++;
                }
              }
              return cookieStorageLength;
            }

            var cookieSessionStorage = {
              key: function(index) {
                var cookieStorage = getCookieStorage();
                var i = 0;
                for (var cookey in cookieStorage) {
                  if (cookieStorage.hasOwnProperty(cookey)) {
                    if (i++ === index) {
                      return cookey;
                    }
                  }
                }
                return null;
              },

              getItem: function(key) {
                return getCookieStorage()[key] || null;
              },

              setItem: function(key, data) {
                var cookieStorage = getCookieStorage();
                cookieStorage[key] = data;
                createCookie(webStorageId, stringify(cookieStorage));
              },

              removeItem: function(key) {
                var cookieStorage = getCookieStorage();
                delete cookieStorage[key];
                createCookie(webStorageId, stringify(cookieStorage));
              },

              clear: function() {
                eraseCookie(webStorageId);
              }
            };

            sessionWebStorage = makeJsonStorage(cookieSessionStorage, getCookieStorageLength);
          }
        }
      })();

      if (sessionWebStorage !== null) {
        return sessionWebStorage;
      }

      (function() {
        // Cookies disabled and we like to live dangerously (will not persist across windows)
        if (settings.allowWindowName) {
          function getWindowStorage() {
            try {
              return $.parseJSON(window.name) || {};
            } catch (ex) {
              return {};
            }
          }

          function getWindowStorageLength() {
            var windowStorage = getWindowStorage();
            var windowStorageLength = 0;
            for (var winkey in windowStorage) {
              if (windowStorage.hasOwnProperty(winkey)) {
                windowStorageLength++;
              }
            }
            return windowStorageLength;
          }

          var windowSessionStorage = {
            key: function(index) {
              var windowStorage = getWindowStorage();
              var i = 0;
              for (var winkey in windowStorage) {
                if (windowStorage.hasOwnProperty(winkey)) {
                  if (i++ === index) {
                    return winkey;
                  }
                }
              }
              return null;
            },

            getItem: function(key) {
              return getWindowStorage()[key] || null;
            },

            setItem: function(key, data) {
              var windowStorage = getWindowStorage();
              windowStorage[key] = data;
              window.name = stringify(windowStorage);
            },

            removeItem: function(key) {
              var windowStorage = getWindowStorage();
              delete windowStorage[key];
              window.name = stringify(windowStorage);
            },

            clear: function() {
              window.name = '{}';
            }
          };

          sessionWebStorage = makeJsonStorage(windowSessionStorage, getWindowStorageLength);
        }
      })();

      return sessionWebStorage;
    },

    local: function() {
      if (localWebStorage !== null) {
        return localWebStorage;
      }

      if ('localStorage' in window) {
        // Chrome 4, Firefox 3.5+, IE 8, Opera 10.5
        localWebStorage = makeJsonStorage(window.localStorage, function() { return window.localStorage.length; });
        return localWebStorage;
      }

      if (typeof globalStorage !== 'undefined') {
        // Firefox 2-3.5
        localWebStorage = makeJsonStorage(globalStorage[locationHostname], function() { return globalStorage[locationHostname].length; });
        return localWebStorage;
      }

      (function() {
        // IE 6-7
        var userData = document.createElement("div");
        userData.style.behavior = "url(#default#userdata)";
        document.getElementsByTagName("body")[0].appendChild(userData);

        if ('load' in userData && 'XMLDocument' in userData) {
          userData.load(locationHostname);

          function getUserDataAttr() {
            // We can't save a ref to XMLDoc...attr so this helps compress the file a little
            return userData.XMLDocument.childNodes[0].attributes;
          }

          function getUserDataStorageLength() {
            return getUserDataAttr().length;
          }

          var userDataLocalStorage = {
            key: function(index) {
              return getUserDataAttr()[index].nodeName;
            },

            getItem: function(key) {
              return userData.getAttribute(key);
            },

            setItem: function(key, data) {
              userData.setAttribute(key, data);
              userData.save(locationHostname);
            },

            removeItem: function(key) {
              userData.removeAttribute(key);
              userData.save(locationHostname);
            },

            clear: function() {
              var errorCount = 0;
              while (getUserDataAttr().length > errorCount) {
                var attr = getUserDataAttr()[errorCount];
                if (attr != null) {
                  userData.removeAttribute(attr.nodeName);
                } else {
                  errorCount++;
                }
              }
              userData.save(locationHostname);
            }
          };

          localWebStorage = makeJsonStorage(userDataLocalStorage, getUserDataStorageLength);
        }
      })();

      if (localWebStorage !== null) {
        return localWebStorage;
      }

      (function() {
        if (window.google && google.gears) {
          // Chrome 2-3
          var gearsDatabase = google.gears.factory.create("beta.database");
          gearsDatabase.open(webStorageId);
          gearsDatabase.execute("create table if not exists webStorage (ItemKey text, ItemValue text)");

          function getGearsDatabaseLength() {
            var gearsDataBaseLength = 0;
            var rs = gearsDatabase.execute("select count(*) from webStorage");
            if (rs.isValidRow()) {
              var gearsDataBaseLength = rs.field(0);
            }
            rs.close();
            return gearsDataBaseLength;
          }

          var gearsLocalStorage = {
            key: function(index) {
              var i = 0;
              var rs = gearsDatabase.execute("select ItemKey from webStorage");
              while (rs.isValidRow()) {
                if (i++ === index) {
                  return rs.field(0);
                }
                rs.next();
              }
              rs.close();
              return null;
            },

            getItem: function(key) {
              var value = null;
              var rs = gearsDatabase.execute("select ItemValue from webStorage where ItemKey = ?", [key]);
              if (rs.isValidRow()) {
                value = rs.field(0);
              }
              rs.close();
              return value;
            },

            setItem: function(key, data) {
              if (this.key(key) != null) {
                gearsDatabase.execute("update webStorage set ItemValue = ? where ItemKey = ?", [data, key]);
              } else {
                gearsDatabase.execute("insert into webStorage values (?, ?)", [key, data]);
              }
            },

            removeItem: function(key) {
              gearsDatabase.execute("delete from webStorage where ItemKey = ?", [key]);
            },

            clear: function() {
              gearsDatabase.execute("delete from webStorage");
            }
          };

          localWebStorage = makeJsonStorage(gearsLocalStorage, getGearsDatabaseLength);          
        }
      })();

      return localWebStorage;
    }
  };

  function makeJsonStorage(storageObj, getLengthMethod) {
    return {
      length: getLengthMethod(),

      key: function(index) {
        return storageObj.key(index);
      },

      getItem: function(key) {
        return $.parseJSON(storageObj.getItem(key));
      },

      setItem: function(key, data) {
        storageObj.setItem(key, stringify(data));
        this.length = getLengthMethod();
      },

      removeItem: function(key) {
        storageObj.removeItem(key);
        this.length = getLengthMethod();
      },

      clear: function() {
        storageObj.clear();
        this.length = 0;
      }
    };
  }

  /*
  Cookie functions from QuirksMode (minus expiration)
  
  http://www.quirksmode.org/js/cookies.html
  */

  function createCookie(name, value) {
    document.cookie = name + "=" + value + "; path=/";
  }

  function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) == ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  function eraseCookie(name) {
    document.cookie = name + "=; expires=-1; path=/";
  }

  /*
  The stringify method from json.org.
  This will remain until jQuery has a toJSON method.
  
  http://www.JSON.org/json2.js
  2010-03-20

  Public Domain.

  NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
  */

  function f(n) {
    return n < 10 ? '0' + n : n;
  }

  if (typeof Date.prototype.toJSON !== 'function') {
    Date.prototype.toJSON = function(key) {
      return isFinite(this.valueOf()) ? this.getUTCFullYear() + '-' + f(this.getUTCMonth() + 1) + '-' + f(this.getUTCDate()) + 'T' + f(this.getUTCHours()) + ':' + f(this.getUTCMinutes()) + ':' + f(this.getUTCSeconds()) + 'Z' : null;
    };

    String.prototype.toJSON = Number.prototype.toJSON = Boolean.prototype.toJSON = function(key) {
      return this.valueOf();
    };
  }

  var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        gap,
        indent,
        meta = {
          '\b': '\\b',
          '\t': '\\t',
          '\n': '\\n',
          '\f': '\\f',
          '\r': '\\r',
          '"': '\\"',
          '\\': '\\\\'
        },
        rep;

  function quote(string) {
    escapable.lastIndex = 0;
    return escapable.test(string) ? '"' + string.replace(escapable, function(a) {
      var c = meta[a];
      return typeof c === 'string' ? c : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
    }) + '"' : '"' + string + '"';
  }

  function str(key, holder) {
    var i, k, v, length, mind = gap, partial, value = holder[key];

    if (value && typeof value === 'object' && typeof value.toJSON === 'function') {
      value = value.toJSON(key);
    }

    if (typeof rep === 'function') {
      value = rep.call(holder, key, value);
    }

    switch (typeof value) {
      case 'string':
        return quote(value);

      case 'number':
        return isFinite(value) ? String(value) : 'null';

      case 'boolean':
      case 'null':
        return String(value);

      case 'object':
        if (!value) {
          return 'null';
        }

        gap += indent;
        partial = [];

        if (Object.prototype.toString.apply(value) === '[object Array]') {
          length = value.length;
          for (i = 0; i < length; i += 1) {
            partial[i] = str(i, value) || 'null';
          }

          v = partial.length === 0 ? '[]' : gap ? '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']' : '[' + partial.join(',') + ']';
          gap = mind;
          return v;
        }

        if (rep && typeof rep === 'object') {
          length = rep.length;
          for (i = 0; i < length; i += 1) {
            k = rep[i];
            if (typeof k === 'string') {
              v = str(k, value);
              if (v) {
                partial.push(quote(k) + (gap ? ': ' : ':') + v);
              }
            }
          }
        } else {
          for (k in value) {
            if (Object.hasOwnProperty.call(value, k)) {
              v = str(k, value);
              if (v) {
                partial.push(quote(k) + (gap ? ': ' : ':') + v);
              }
            }
          }
        }

        v = partial.length === 0 ? '{}' : gap ? '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}' : '{' + partial.join(',') + '}';
        gap = mind;
        return v;
    }
  }

  function stringify(value, replacer, space) {
    var i;
    gap = '';
    indent = '';
    if (typeof space === 'number') {
      for (i = 0; i < space; i += 1) {
        indent += ' ';
      }
    } else if (typeof space === 'string') {
      indent = space;
    }
    rep = replacer;
    if (replacer && typeof replacer !== 'function' && (typeof replacer !== 'object' || typeof replacer.length !== 'number')) {
      throw new Error('JSON.stringify');
    }
    return str('', { '': value });
  }
})(jQuery);
