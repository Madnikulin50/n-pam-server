
(function () {
  /**
	 * Use for domain declaration
	 */
  Vnc = function () {
  }

  Vnc.prototype = {
    // shortcut
    $: function (id) {
      return document.getElementById(id)
    },

    /**
		 * Compute screen offset for a target element
		 * @param el {DOM element}
		 * @return {top : {integer}, left {integer}}
		 */
    elementOffset: function (el) {
		    var x = 0
		    var y = 0
		    while (el && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop)) {
		        x += el.offsetLeft - el.scrollLeft
		        y += el.offsetTop - el.scrollTop
		        el = el.offsetParent
		    }
		    return { top: y, left: x }
    },

    /**
		 * Try to detect browser
		 * @returns {String} [firefox|chrome|ie]
		 */
    browser: function () {
      if (typeof InstallTrigger !== 'undefined') {
        return 'firefox'
      }

      if (window.chrome) {
        return 'chrome'
      }

      if (document.docuemntMode) {
        return 'ie'
      }

      return null
    },

    /**
		 * Try to detect language
		 * @returns
		 */
    locale: function () {
      return window.navigator.userLanguage || window.navigator.language
    }
  }
})()

this.Vnc = new Vnc()
