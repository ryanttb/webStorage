(function($) {
  var locationHostname = location.hostname;
  var webStorageId = locationHostname.replace(/\./g, '') + "_webStorage"; //< Used in userData & Gears
  var sessionWebStorage = null;
  var localWebStorage = null;

  $.webStorage = {
    session: function() {
      if (sessionWebStorage !== null) {
        return sessionWebStorage;
      }

      if ('sessionStorage' in window) {
        // Firefox 3.5, IE 8
        sessionWebStorage = window.sessionStorage;
        return sessionWebStorage;
      }

      return sessionWebStorage;
    },

    local: function() {
      if (localWebStorage !== null) {
        return localWebStorage;
      }

      if ('localStorage' in window) {
        // Chrome 4, Firefox 3.5+, IE 8, Opera 10.5
        localWebStorage = window.localStorage;
        return localWebStorage;
      }

      if (globalStorage != null) {
        // Firefox 2-3.5
        localWebStorage = globalStorage[locationHostname];
        return localWebStorage;
      }

      (function() {
        // IE 6-7
        var $userData = $('<div id="' + webStorageId + '" style="behavior: url(#default#userdata); display: none;" />').appendTo($("body"));
        var userData = $userData[0];
        if ('load' in userData && 'XMLDocument' in userData) {
          userData.load(locationHostname);

          localWebStorage = {
            length: userData.XMLDocument.childNodes[0].attributes.length,

            key: function(index) {
              return userData.XMLDocument.childNodes[0].attributes[index].nodeName;
            },

            getItem: function(key) {
              return $.parseJSON(userData.getAttribute(key));
            },

            setItem: function(key, data) {
              userData.setAttribute(key, stringify(data));
              this.length = userData.XMLDocument.childNodes[0].attributes.length;
              userData.save(locationHostname);
            },

            removeItem: function(key) {
              userData.removeAttribute(key);
              this.length = userData.XMLDocument.childNodes[0].attributes.length;
              userData.save(locationHostname);
            },

            clear: function() {
              var errorCount = 0;
              while (userData.XMLDocument.childNodes[0].attributes.length > errorCount) {
                var attr = userData.XMLDocument.childNodes[0].attributes[errorCount];
                if (attr != null) {
                  userData.removeAttribute(attr.nodeName);
                } else {
                  errorCount++;
                }
              }
              this.length = 0;
              userData.save(locationHostname);
            }
          }
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

          localWebStorage = {
            length: getGearsDatabaseLength(),

            key: function(index) {
              var i = 0;
              var rs = gearsDatabase.execute("select ItemKey from webStorage");
              while (rs.isValidRow()) {
                if (i++ == index) {
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
                value = $.parseJSON(rs.field(0));
              }
              rs.close();
              return value;
            },

            setItem: function(key, data) {
              if (this.key(key) != null) {
                gearsDatabase.execute("update webStorage set ItemValue = ? where ItemKey = ?", [stringify(data), key]);
              } else {
                gearsDatabase.execute("insert into webStorage values (?, ?)", [key, stringify(data)]);
              }
              this.length = getGearsDatabaseLength();
            },

            removeItem: function(key) {
              gearsDatabase.execute("delete from webStorage where ItemKey = ?", [key]);
              this.length = getGearsDatabaseLength();
            },

            clear: function() {
              gearsDatabase.execute("delete from webStorage");
              this.length = 0;
            }
          }
        }
      })();

      return localWebStorage;
    }
  };


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
