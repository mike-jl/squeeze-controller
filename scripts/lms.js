'use strict'
var LmsApi = angular.module('LmsApi', ['ngAnimate', 'ui.bootstrap', 'ngRoute', 'cfp.hotkeys'])

LmsApi.config(function ($routeProvider) {
  $routeProvider
    .when('/', { templateUrl: 'home.html' })
    .when('/settings', { templateUrl: 'settings.html' })
    .otherwise({ redirectTo: '/' })
})

LmsApi.controller('LmsApiCtrl', function ($filter, $location, $scope, $http, $timeout, $log, hotkeys, localStorage) {
  $scope.TrackPosChange = 0
  $scope.VolChange = 0
  $scope.bubbletips = localStorage.get('bubbletips')
  if ($scope.bubbletips === null) {
    console.log('Settings bubbletips to their default value (true)')
    $scope.bubbletips = true
    localStorage.set('bubbletips', true)
  }
  var storagelmsurl = localStorage.get('lmsurl')
  var storagelmsport = localStorage.get('lmsport')
  // If the url or port settings are undefined; jump directly to the settings
  if (storagelmsurl === null || storagelmsport === null) {
    $location.path('/settings')
  }
  // build the lms url from the settings
  $scope.LmsUrl = 'http://' + storagelmsurl + ':' + storagelmsport + '/'
  var setPlayer = localStorage.get('player')
  // get the players
  $http.post($scope.LmsUrl + 'jsonrpc.js', '{"id":1,"method":"slim.request","params":["-",["players",0,99]]}').then(function (r) {
    $scope.players = r.data.result
    // If there is a player in the settings and it matches with the newly polled player; set it
    if (setPlayer) {
      if (setPlayer.playerid === $scope.players.players_loop[setPlayer.playerindex].playerid) {
        $scope.player = $scope.players.players_loop[setPlayer.playerindex]
      } else {
      // Else just set the first player of the response
        $scope.player = $scope.players.players_loop[0]
      }
    } else {
      $scope.player = $scope.players.players_loop[0]
    }
    localStorage.set('player', $scope.player)
    setPlayer = $scope.player
    poller()
    $scope.getmenu()
  })
  var poller = function () {
    $http.post($scope.LmsUrl + 'jsonrpc.js', '{"id":1,"method":"slim.request","params":["' + $scope.player.playerid + '", ["status", "0", 999, "tags:alyK"]]}').then(function (r) {
      $scope.data = r.data.result
      // get the cover for the current song
      // if there are tracks in the playlist continue; else set to lms backup cover (id=0)
      if ($scope.data.playlist_tracks !== 0) {
        // if artwork_url is defined, it is an remote cover; else its a local cover which means we can just build the url with the track id
        if ($scope.data.playlist_loop[$scope.data.playlist_cur_index].artwork_url) {
          // if the remote cover starts with http we can use it directly; else the url is a sufix for the lms url
          if ($scope.data.playlist_loop[$scope.data.playlist_cur_index].artwork_url.startsWith('http')) {
            $scope.CoverUrl = $scope.data.playlist_loop[$scope.data.playlist_cur_index].artwork_url
          } else {
            // we can define the size for the cover by adding '_200x200_p' befor the extension
            $scope.CoverUrl = $scope.LmsUrl + $scope.data.playlist_loop[$scope.data.playlist_cur_index].artwork_url
            $scope.CoverUrl = $scope.CoverUrl.replace(/(\.[\w\d_-]+)$/i, '_200x200_p$1')
          }
        } else {
          $scope.CoverUrl = $scope.LmsUrl + 'music/' + $scope.data.playlist_loop[$scope.data.playlist_cur_index].id + '/cover_200x200_p.png'
        }
      } else {
        $scope.CoverUrl = $scope.LmsUrl + 'music/0/cover_200x200_p.png'
      }
      // Don't set the volume while changing it
      if ($scope.VolChange === 0) {
        $scope.volume = $scope.data['mixer volume']
      }
      // Don't set the trackpos while changing it
      if ($scope.TrackPosChange === 0) {
        if ($scope.data.time) {
          $scope.trackpos = $scope.data.time
        } else {
          $scope.trackpos = 0
        }
      }
      // If the player in the settings differ from the current player, set the current one
      if (setPlayer.playerid !== $scope.player.playerid) {
        localStorage.set('player', $scope.player)
        setPlayer = $scope.player
      }
      // Set title for the repeate button
      if ($scope.data['playlist repeat'] === 0) {
        $scope.repeatText = 'Repeat Off'
      } else if ($scope.data['playlist repeat'] === 1) {
        $scope.repeatText = 'Repeat Current Title'
      } else if ($scope.data['playlist repeat'] === 2) {
        $scope.repeatText = 'Repeat Playlist'
      }
      // Set title for the shuffle button
      if ($scope.data['playlist shuffle'] === 0) {
        $scope.shuffleText = 'Shuffle Off'
      } else if ($scope.data['playlist shuffle'] === 1) {
        $scope.shuffleText = 'Shuffle by Song'
      } else if ($scope.data['playlist shuffle'] === 2) {
        $scope.shuffleText = 'Shuffle by Album'
      }
      $timeout(poller, 500)
    })
  }
  $scope.lmsPost = function (params, menuparams) {
    console.log('lmsPost: ' + params)
    return $http.post($scope.LmsUrl + 'jsonrpc.js', '{"id":1,"method":"slim.request","params":["' + $scope.player.playerid + '",' + angular.toJson(params) + ']}').then(function (r) {
      if (menuparams) {
        if (menuparams[0]) {
          if (r.data.result.base) {
            $scope.baseactions = r.data.result.base.actions
          } else {
            $scope.baseactions = 0
          }
          $scope.menu = r.data.result
          $scope.filterisEnable = menuparams[1]
          $scope.orderby = menuparams[2]
          $scope.breadCrumbs.push([menuparams[3], $scope.filterisEnable, $scope.orderby, $scope.baseactions, $scope.menu])
        }
      }
      return r.data.result
    })
  }
  // function for getting the main menu and setting all the required vars
  $scope.getmenu = function () {
    $scope.lmsPost(['menu', 0, 100, 'direct:1']).then(function (r) {
      $scope.filterisEnable = true
      $scope.nodefilter = 'home'
      $scope.menu = r
      $scope.filterisEnable = true
      $scope.orderby = 'weight'
      $scope.breadCrumbs = []
    })
  }
  // function to handle navigation in the menu
  $scope.menufunc = function (item) {
    console.log(item)
    var params = []
    if (item.action === 'none') {
      return
    }
    if (item.actions) {
      if (item.actions.do) {
        console.log('Action: do; without baseaction')
        params.push.apply(params, item.actions.do.cmd)
        $scope.lmsPost(params)
        $timeout($scope.getmenu, 600)
      } else if (item.actions.go) {
        console.log('Action: go; without baseaction')
        var menuChange = true
        if (item.actions.go.nextWindow === 'parentNoRefresh' ||
            item.actions.go.nextWindow === 'nowPlaying') {
          menuChange = false
        }
        var key
        var value
        for (key in item.actions.go.cmd) {
          value = item.actions.go.cmd[key]
          params.push(value)
        }
        if (menuChange) {
          params.push(0, 100)
        }
        for (key in item.actions.go.params) {
          value = item.actions.go.params[key]
          if (key === 'search') {
            console.log('this is a search item, use the search input')
            return
          }
          params.push(key + ':' + value)
        }
        params.push('useContextMenu:1')
        $scope.lmsPost(params, [menuChange, false, '$index', item])
      }
    } else if (item.isANode) {
      $scope.nodefilter = item.id
      $scope.breadCrumbs.push([item, $scope.filterisEnable, $scope.orderby, $scope.baseactions, $scope.menu])
    } else {
      var action = 'go'
      if (item.goAction) {
        action = item.goAction
      }
      console.log('Action: ' + action + '; wit baseaction')
      if ($scope.baseactions === 0) {
        console.error('something went horribly wrong..')
        return
      }
      var retparams = $scope.submenu(item, action, 0)
      params = retparams[0]
      menuChange = retparams[1]
      $scope.lmsPost(params, [menuChange, false, '$index', item])
    }
  }
  $scope.submenu = function (menuitem, action, context) {
    var params = []
    var menuChange = true
    if ($scope.baseactions[action].nextWindow === 'parentNoRefresh' ||
        $scope.baseactions[action].nextWindow === 'nowPlaying') {
      menuChange = false
    }
    var key
    var value
    for (key in $scope.baseactions[action].cmd) {
      value = $scope.baseactions[action].cmd[key]
      params.push(value)
    }
    if (menuChange) {
      params.push(0, 100)
    }
    for (key in $scope.baseactions[action].params) {
      value = $scope.baseactions[action].params[key]
      params.push(key + ':' + value)
    }
    for (key in menuitem[$scope.baseactions[action].itemsParams]) {
      value = menuitem[$scope.baseactions[action].itemsParams][key]
      params.push(key + ':' + value)
    }
    params.push('useContextMenu:1')
    if (context === 1) {
      params.push('xmlBrowseInterimCM:1')
      $scope.lmsPost(params).then(function (r) {
        $scope.contextMenu = r
      })
    } else {
      return [params, menuChange]
    }
  }

  // On dropdown close empty the contextMenu object. (so its clean when opened again)
  $scope.ddClose = function () {
    $scope.contextMenu = {}
  }

  // the search item is '__TAGGEDINPUT__'; so we replace that with the search input
  $scope.search = function (item, searchInput) {
    var params = []
    var key
    var value
    for (key in item.actions.go.cmd) {
      value = item.actions.go.cmd[key]
      params.push(value)
    }
    params.push(0, 100)
    for (key in item.actions.go.params) {
      value = item.actions.go.params[key]
      if (value === '__TAGGEDINPUT__') {
        value = searchInput
      }
      params.push(key + ':' + value)
    }
    params.push('useContextMenu:1')
    $scope.lmsPost(params, [true, false, '$index', item])
  }

  $scope.breadCrumbfunc = function (index) {
    $scope.filterisEnable = $scope.breadCrumbs[index][1]
    $scope.orderby = $scope.breadCrumbs[index][2]
    $scope.baseactions = $scope.breadCrumbs[index][3]
    $scope.menu = $scope.breadCrumbs[index][4]
    $scope.breadCrumbs.splice(index + 1, 99)
  }

  // prevent default action of arrow and space keys; only in document.body (so they still work in an imput field)
  window.addEventListener('keydown', function (e) {
    if ([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1 && e.target === document.body) {
      e.preventDefault()
    }
  }, false)

  // define kotkeys
  hotkeys.bindTo($scope)
    .add({
      combo: 'space',
      description: 'Play/Pause',
      callback: function () {
        $scope.lmsPost(['pause'])
      }
    })
    .add({
      combo: 'left',
      description: 'Previous Track',
      callback: function () {
        $scope.lmsPost(['button', 'jump_rew'])
      }
    })
    .add({
      combo: 'right',
      description: 'Next Track',
      callback: function () {
        $scope.lmsPost(['button', 'jump_fwd'])
      }
    })
    .add({
      combo: 'up',
      description: 'Volume Up',
      callback: function () {
        $scope.lmsPost(['mixer', 'volume', '+2'])
      }
    })
    .add({
      combo: 'down',
      description: 'Volume Down',
      callback: function () {
        $scope.lmsPost(['mixer', 'volume', '-2'])
      }
    })
})

LmsApi.controller('SettingsCtrl', function ($scope, $log, localStorage, $route) {
  $scope.lmsurl = localStorage.get('lmsurl')
  $scope.lmsport = localStorage.get('lmsport')
  $scope.bubbletips = localStorage.get('bubbletips')
  $scope.saveSettings = function (settings) {
    for (var key in settings) {
      var value = settings[key]
      localStorage.set(key, value)
    }
  }
  $scope.clearSettings = function () {
    localStorage.clear()
    $route.reload()
  }
})
LmsApi.factory('localStorage', function ($window) {
  var factory = {}
  factory.get = function (key) {
    var item = $window.localStorage.getItem(key)
    try {
      return angular.fromJson(item)
    } catch (e) {
      return
    }
  }
  factory.set = function (key, value) {
    $window.localStorage.setItem(key, angular.toJson(value))
    return
  }
  factory.clear = function () {
    $window.localStorage.clear()
    return
  }
  return factory
})

LmsApi.factory('sessionStorage', function ($window) {
  var factory = {}
  factory.get = function (key) {
    var item = $window.sessionStorage.getItem(key)
    try {
      return angular.fromJson(item)
    } catch (e) {
      return
    }
  }
  factory.set = function (key, value) {
    $window.sessionStorage.setItem(key, angular.toJson(value))
    return
  }
  factory.clear = function () {
    $window.sessionStorage.clear()
    return
  }
  return factory
})

LmsApi.filter('menu_filter', ['$filter', function ($filter) {
  return function (input, filter1, filter2, isEnable) {
    if (isEnable) {
      return $filter('filter')(input, {[filter1]: filter2})
    } else {
      return input
    }
  }
}])

LmsApi.filter('num', function () {
  return function (input) {
    return parseInt(input, 10)
  }
})

LmsApi.filter('secondsToDateTime', function () {
  return function (seconds) {
    return new Date(1970, 0, 1).setSeconds(seconds)
  }
})

LmsApi.filter('typeof', function () {
  return function (input) {
    return typeof input
  }
})
