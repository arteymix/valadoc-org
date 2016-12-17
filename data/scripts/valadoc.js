/* globals $ */

// The old way. Please gracefully fall into oblivion
window.addEventListener('load', function() {
  if (
    location.hash.substr(2, 3) == 'api' ||
    location.hash.substr(2, 4) == 'wiki'
  ) {
    redirect_to = location.hash.split('=')
    location = '/' + redirect_to[1]
  }
})

var last_navi_content = ''
var navi_xhr = null
var content_xhr = null
var navi_data = null
var content_data = null
var RESULTS_BULK = 20

function clean_path () {
  return window.location.pathname.replace(/(index)?(.html|.htm)/, '')
}

function check_loaded (path) {
  if (navi_data !== null && content_data !== null) {

    $('#navigation-content').html(navi_data)
    var new_navi_content = $('#navigation-content').text()
    if (last_navi_content !== new_navi_content) {
      $('#navigation-content').scrollTop(0)
    }
    last_navi_content = new_navi_content

    $('#content').html(content_data)
    $('body').scrollTop(0)
  }
}

function replace_navigation (path) {
  navi_xhr = $.get(path, function (data) {
    navi_xhr = null
    navi_data = data
    check_loaded(path)
  })
}

function replace_content (path) {
  content_xhr = $.get(path, function (data) {
    content_xhr = null
    content_data = data
    check_loaded(path)
  })
}

function abort_loading () {
  if (navi_xhr) {
    navi_xhr.abort()
    navi_data = null
  }
  if (content_xhr) {
    content_xhr.abort()
    content_data = null
  }
}

function load_content (href, push) {
  if (push == null) push = true

  abort_loading()
  replace_navigation(href + '.navi.tpl')
  replace_content(href + '.content.tpl')

  // Standardize the href to a simple `glib-2.0/Glib.Envionment.get_home_dir` like string
  var title = href.replace(/(.html|.htm)/, '')
  if (title[0] === '/') title = title.substr(1)
  if (title.substr(-1) === '/') title = title.substr(0, title.length - 1)

  if (title.substr(-5) === 'index') { // An API index page
    title = title.substr(0, title.length - 6)
  } else if (title.split('/').length > 1) { // An API page
    title = title.split('/').reverse().join(' – ')
  }

  if (title == null || title === '') { // Any other page
    title = 'Valadoc.org – Stays crunchy. Even in milk.'
  }
  document.title = title

  if (push && history.pushState != null) {
    history.pushState(null, title, href)
  }
}

function load_link (pathname, hostname) {
  if (window.location.hostname !== hostname) {
    return true
  }

  load_content(pathname)
  close_tooltips()
}

function open_link (pathname, hostname) {
  if (window.location.hostname !== hostname) {
    return true
  }

  if (pathname.substr(-8) === '.tar.bz2') {
    return true
  }

  if (pathname.substr(-8) === '.catalog') {
    return true
  }

  // TODO: don't hardcode paths to ignore. It's unmaintable like the rest of this code
  var path = pathname.split('/')[1].replace(/(.html|.htm)/, '').toLowerCase()
  if (path === 'markup' || path === 'about') {
    return true
  }

  load_content(pathname)
  return false
}

function close_tooltips () {
  $('a, area').trigger('mouseleave')
}

function scroll_to_selected () {
  var sel = $('.search-selected')
  if (sel.length === 0) {
    return
  }
  var seltop = sel.position().top
  var selbottom = seltop + sel.outerHeight()
  var box = $('#search-results')
  var boxtop = box.position().top
  var boxbottom = boxtop + box.outerHeight()
  if (seltop < boxtop) {
    box.scrollTop(box.scrollTop() - (boxtop - seltop))
  } else if (selbottom > boxbottom) {
    box.scrollTop(box.scrollTop() + (selbottom - boxbottom))
  }
}

$(document).ready(function () {
  $(window).bind('popstate', function (event) {
    if (window.location.pathname === '' || window.location.pathname === '/') {
      load_content('index.htm', false)
    } else {
      load_content(window.location.pathname, false)
    }
  })

  $('#content').ajaxError(function (e, xhr, settings) {
    if (xhr.status === 0) {
      return
    }
    abort_loading()
    close_tooltips()
    var page = clean_path()
    $(this).html('Error ' + xhr.status + ': <strong>' + xhr.statusText + '</strong>. When loading <em>' + page + '</em>.<br>' +
    "<a href='/#!wiki=index'>Click here to go to the homepage</a>")
    $(this).scrollTop(0)
  })

  $(document).delegate('a, area', 'click', function () {
    if ($(this).parent('.search-result').length > 0) {
      $('.search-selected').removeClass('search-selected')
      $(this).parent().addClass('search-selected')
      scroll_to_selected()
    }
    return open_link(this.getAttribute('href'), this.hostname)
  })

  $(document).delegate('a, area', 'mouseenter', function (e) {
    if (!$(this).data('init')) {
      $(this).data('init', true)
      /* api only: */
      if (window.location.hostname !== this.hostname) {
        return
      }
      if (this.pathname.substr(-5) !== '.html') {
        return
      }
      var path = this.getAttribute('href').substr(1)
      var fullname = path.substring(0, path.length - 5)
      var self = $(this)
      var hovered = true
      self.hover(function () {
        hovered = true
      }, function () {
        hovered = false
      })
      self.attr('title', '') // hide browser-tooltips
      $.get('/tooltip?fullname=' + encodeURIComponent(fullname), function (data) {
        self.wTooltip({
          content: data,
          className: 'tooltip',
          offsetX: 15,
          offsetY: -10
        })
        if (hovered) {
          var je = $.Event('mousemove')
          je.clientX = e.clientX
          je.clientY = e.clientY
          self.trigger(je)
          self.trigger(e)
        }
      })
      return false
    }
  })

  var curtext = ''
  var curpost = null
  var curtimeout = null
  var scrolltimeout = null
  var scrollxhr = null
  var max_results_reached = false

  $('#search-box').css('display', 'inline-block');
  $('#search-field').bind('keydown change paste cut', function (e) {
    if (curtimeout !== null) {
      clearTimeout(curtimeout)
      curtimeout = null
    }
    var field = this
    curtimeout = setTimeout(function () {
      var cur = $('.search-selected')
      if (e.keyCode === 27) { // escape
        field.value = ''
        field.focus()
      } else if (e.keyCode === 40) { // down
        if (cur.length === 0) {
          $($('.search-result')[0]).addClass('search-selected')
        } else {
          var next = cur.next()
          if (next.length > 0) {
            next.addClass('search-selected')
            cur.removeClass('search-selected')
            scroll_to_selected()
          }
        }
      } else if (e.keyCode === 38) { // up
        if (cur.length > 0) {
          var prev = cur.prev()
          if (prev.length > 0) {
            prev.addClass('search-selected')
            cur.removeClass('search-selected')
            scroll_to_selected()
          }
        }
      } else if (e.keyCode === 13) { // enter
        if (cur.length > 0) {
          $('.search-selected a').trigger('click')
          scroll_to_selected()
        }
      }
      close_tooltips()
      var value = $.trim(field.value)
      if (value === '') {
        curtext = ''
        $('#search-results').hide().children().remove()
        $('#navigation-content').show()
        return
      }
      $('#search-results').show()
      $('#navigation-content').hide()

      if (value === curtext) {
        return
      }
      $('.search-selected').removeClass('search-selected')
      curtext = value
      if (curpost !== null) {
        curpost.abort()
        curpost = null
      }
      var curpkg = clean_path().split('/')[1]
      curpost = $.post('/search', { query: value, curpkg: curpkg }, function (data) {
        if (scrollxhr) {
          scrollxhr.abort()
          scrollxhr = null
        }
        curpost = null
        $('#search-results').html(data).scrollTop(0)
        max_results_reached = $('#search-results li').length < RESULTS_BULK
        if (!max_results_reached) {
          // last child might be already visible
          $('#search-results').triggerHandler('scroll')
        }
      }, 'text')
      curtimeout = null
    }, 1)
  }).trigger('change')

  var searchField = $('#search-field')

  $('#search-field-clear').click(function () {
    searchField.val('').trigger('change')
  })

  var ctrlDown = 0;
  $(document).keydown(function (e) {
    var c = String.fromCharCode(e.which)
    var focused = searchField.is(':focus')
    if (focused && e.keyCode === 27) { // escape
      searchField.val('').focus()
    } else if (e.keyCode === 27) { // escape
      searchField.val('')
      searchField.trigger ('change')
    } else if (e.keyCode === 17) {
      ctrlDown++;
    } else if (!focused && ctrlDown == 0 && ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '.' || c == '_')) {
      searchField.focus ()
      searchField.trigger ('change')
    }
  })
  $(document).keyup(function (e) {
    if (e.keyCode === 17) {
      ctrlDown--
    }
  })


  $('#search-results').scroll(function () {
    if (scrolltimeout) {
      clearTimeout(scrolltimeout)
      scrolltimeout = null
    }
    scrolltimeout = setTimeout(function () {
      scrolltimeout = null
      var sr = $('#search-results')
      var last = $('#search-results li:last-child')
      if (max_results_reached || scrollxhr || last.position().top > sr.position().top + sr.outerHeight()) {
        return
      }
      var value = $.trim($('#search-field').val())
      if (value === '') {
        return
      }
      var numresults = sr.children().length
      var curpkg = clean_path().split('/')[1]
        scrollxhr = $.post('/search', { query: value, curpkg: curpkg, offset: numresults }, function (data) {
        scrollxhr = null
        $('.search-more').remove()
        sr.append(data)
        max_results_reached = sr.children().length - numresults < RESULTS_BULK
      }, 'text')
    }, 1)
  })
})
