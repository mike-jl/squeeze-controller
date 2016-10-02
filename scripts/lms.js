'use strict'
var LmsApi = angular.module('LmsApi', ['ngAnimate', 'ui.bootstrap', 'ngRoute', 'cfp.hotkeys', 'utf8-base64', 'angular.img', 'dndLists'])

LmsApi.config(function ($routeProvider) {
  $routeProvider
    .when('/', { templateUrl: 'home.html' })
    .when('/settings', { templateUrl: 'settings.html' })
    .otherwise({ redirectTo: '/' })
})

LmsApi.controller('LmsApiCtrl', function ($filter, $location, $scope, $http, $timeout, $log, hotkeys, localStorage) {
  $scope.TrackPosChange = 0
  $scope.VolChange = 0
  // Try to load maxitems from storage, if it's not set set it to the default value
  $scope.maxitems = localStorage.get('maxitems')
  if ($scope.maxitems === null) {
    console.log('Setting maxitems to their default value (50)')
    $scope.maxitems = 50
    localStorage.set('maxitems', 50)
  }
  // Try to load menuArtwork from storage, if it's not set set it to the default value
  $scope.menuArtwork = localStorage.get('menuArtwork')
  if ($scope.menuArtwork === null) {
    console.log('Setting menuArtwork to their default value (true)')
    $scope.menuArtwork = true
    localStorage.set('menuArtwork', true)
  }
  // Try to load playlistArtwork from storage, if it's not set set it to the default value
  $scope.playlistArtwork = localStorage.get('playlistArtwork')
  if ($scope.playlistArtwork === null) {
    console.log('Setting playlistArtwork to their default value (true)')
    $scope.maxitems = true
    localStorage.set('playlistArtwork', true)
  }
  // Try to load bubbletips from storage, if it's not set set it to the default value
  $scope.bubbletips = localStorage.get('bubbletips')
  if ($scope.bubbletips === null) {
    console.log('Setting bubbletips to their default value (true)')
    $scope.bubbletips = true
    localStorage.set('bubbletips', true)
  }
  // Try to load the URL and the Port from the storage
  var storagelmsurl = localStorage.get('lmsurl')
  var storagelmsport = localStorage.get('lmsport')
  // If the url or port settings are undefined; jump directly to the settings
  if (storagelmsurl === null || storagelmsport === null) {
    $location.path('/settings')
  }
  // build the lms url from the settings
  $scope.LmsUrl = 'http://' + storagelmsurl + ':' + storagelmsport + '/'
  // Try to load the last player from the storage
  var setPlayer = localStorage.get('player')
  // get the players
  $http.post($scope.LmsUrl + 'jsonrpc.js', '{"id":1,"method":"slim.request","params":["-",["players",0,99]]}').then(function (r) {
    $scope.players = r.data.result
    // If there is a player in the settings and it matches with the newly polled player; set it
    if (setPlayer && $scope.players.players_loop[setPlayer.playerindex] && setPlayer.playerid === $scope.players.players_loop[setPlayer.playerindex].playerid) {
      $scope.player = $scope.players.players_loop[setPlayer.playerindex]
    } else {
      // Else just set the first player of the response
      $scope.player = $scope.players.players_loop[0]
    }
    // Sace the selected player to the storage and to the setPlayer var
    localStorage.set('player', $scope.player)
    setPlayer = $scope.player
    // start polling from the server
    poller()
    // load the main menu from the server
    $scope.getmenu()
  })

  // Function to poll data from the server, calls ist self every 500ms
  var poller = function () {
    $http.post($scope.LmsUrl + 'jsonrpc.js', '{"id":1,"method":"slim.request","params":["' + $scope.player.playerid + '", ["status", "0", 999, "tags:alyK"]]}').then(function (r) {
      $scope.data = r.data.result
      // get the cover for the current song
      // if there are tracks in the playlist continue; else set to lms fallback cover (id=0)
      if ($scope.data.playlist_tracks !== 0) {
        // if artwork_url is defined, it is an remote cover; else its a local cover which means we can just build the url with the track id
        if ($scope.data.playlist_loop[$scope.data.playlist_cur_index].artwork_url) {
          // if the remote cover starts with http we can use it directly; else the url is a sufix for the lms url
          if ($scope.data.playlist_loop[$scope.data.playlist_cur_index].artwork_url.startsWith('http')) {
            $scope.CoverUrl = $scope.data.playlist_loop[$scope.data.playlist_cur_index].artwork_url
          } else {
            // we can define the size for the cover by adding '_200x200_p' befor the extension
            $scope.CoverUrl = $scope.LmsUrl + $scope.data.playlist_loop[$scope.data.playlist_cur_index].artwork_url.replace(/^\//, '')
            $scope.CoverUrl = $scope.CoverUrl.replace(/(\.[\w\d_-]+)$/i, '_200x200_p$1')
          }
        } else {
          $scope.CoverUrl = $scope.LmsUrl + 'music/' + $scope.data.playlist_loop[$scope.data.playlist_cur_index].id + '/cover_200x200_p.png'
        }
      } else {
        $scope.CoverUrl = $scope.LmsUrl + 'music/0/cover_200x200_p.png'
      }
      // Only refresh playlist if something changed to prevent flicker
      if (!angular.equals($scope.playlist, $scope.data.playlist_loop)) {
        $scope.playlist = $scope.data.playlist_loop
        console.log('update playlist')
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
      // Set title for the repeat button
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
      // Start this function again after 500ms
      $timeout(poller, 500)
    })
  }

  $scope.lmsPost = function (params, menuparams, page) {
    console.log('lmsPost: ' + params)
    if (menuparams && menuparams[0]) {
      $scope.menuLoading = true
    }
    return $http.post($scope.LmsUrl + 'jsonrpc.js', '{"id":1,"method":"slim.request","params":["' + $scope.player.playerid + '",' + angular.toJson(params) + ']}').then(function (r) {
      if (menuparams) {
        if (menuparams[0]) {
          if (r.data.result.base) {
            $scope.baseactions = r.data.result.base.actions
          } else {
            $scope.baseactions = 0
          }
          $scope.startFrom = 0
          $scope.menuPage = 1
          $scope.menu = r.data.result
          $scope.filterisEnable = menuparams[1]
          $scope.orderby = menuparams[2]
          $scope.breadCrumbs.push([menuparams[3], $scope.filterisEnable, $scope.orderby, $scope.baseactions, $scope.menu, params])
          $scope.lastParams = params
          $scope.menuFilter = ''
          $scope.menuLoading = false
        }
      } else if (page) {
        $scope.menu = r.data.result
      }
      return r.data.result
    })
  }
  // function for getting the main menu and setting all the required vars
  $scope.getmenu = function () {
    $scope.lmsPost(['menu', 0, 100, 'direct:1']).then(function (r) {
      $scope.startFrom = 0
      $scope.menuPage = 1
      $scope.filterisEnable = true
      $scope.nodefilter = 'home'
      $scope.menu = r
      $scope.orderby = 'weight'
      $scope.breadCrumbs = []
      $scope.menuFilter = ''
    })
  }
  // function to handle navigation in the menu
  $scope.menufunc = function (item) {
    console.log(angular.toJson(item))
    var params = []
    if (item.action === 'none') {
      return
    }
    if (item.isANode) {
      console.log('Node')
      $scope.nodefilter = item.id
      $scope.breadCrumbs.push([item, $scope.filterisEnable, $scope.orderby, $scope.baseactions, $scope.menu])
    } else if (item.actions && item.actions.do) {
      console.log('Action: do; without baseaction')
      params.push.apply(params, item.actions.do.cmd)
      $scope.lmsPost(params)
      $timeout($scope.getmenu, 600)
    } else if (item.actions && item.actions.go) {
      console.log('Action: go; without baseaction')
      var menuChange = true
      if (item.actions.go.nextWindow === 'parentNoRefresh' ||
          item.actions.go.nextWindow === 'parent' ||
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
        params.push(0, 9999)
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
    } else {
      var action = 'go'
      if (item.goAction) {
        action = item.goAction
      }
      console.log('Action: ' + action + '; with baseaction')
      if ($scope.baseactions === 0) {
        console.error('something went horribly wrong..')
        return
      }
      params = $scope.submenu(item, action, 0)
      $scope.lmsPost(params[0], [params[1], false, '$index', item])
    }
  }
  $scope.submenu = function (menuitem, action, context, nomenuChange) {
    var params = []
    var menuChange = true
    if ($scope.baseactions[action].nextWindow === 'parentNoRefresh' ||
        $scope.baseactions[action].nextWindow === 'nowPlaying' ||
        nomenuChange === true) {
      menuChange = false
    }
    var key
    var value
    for (key in $scope.baseactions[action].cmd) {
      value = $scope.baseactions[action].cmd[key]
      params.push(value)
    }
    if (menuChange) {
      params.push(0, 9999)
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
    params.push(0, 9999)
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

  $scope.iconUrl = function (item) {
    if (item.artwork_url) {
      if (item.artwork_url.startsWith('http')) {
        return item.artwork_url
      } else {
        return $scope.LmsUrl + item.artwork_url.replace(/^\//, '').replace(/(\.[\w\d_-]+)$/i, '_200x200_p$1')
      }
    } else {
      if (item.id) {
        return $scope.LmsUrl + 'music/' + item.id + '/cover_80x80_p'
      } else {
        if (item.icon) {
          if (item.icon.startsWith('http')) {
            return item.icon
          } else {
            var iconrep = item.icon.replace(/(\.[\w\d_-]+)$/i, '_200x200_p$1')
            if (item.icon === iconrep) {
              iconrep = item.icon + '_80x80_p'
            }
            return $scope.LmsUrl + iconrep
          }
        } else if (item.commonParams && item.commonParams.track_id) {
          return $scope.LmsUrl + 'music/' + item.commonParams.track_id + '/cover_80x80_p'
        } else {
          return
        }
      }
    }
  }

  $scope.breadCrumbfunc = function (index) {
    $scope.startFrom = 0
    $scope.menuPage = 1
    $scope.filterisEnable = $scope.breadCrumbs[index][1]
    $scope.orderby = $scope.breadCrumbs[index][2]
    $scope.baseactions = $scope.breadCrumbs[index][3]
    $scope.menu = $scope.breadCrumbs[index][4]
    $scope.lastParams = $scope.breadCrumbs[index][5]
    $scope.breadCrumbs.splice(index + 1, 99)
    $scope.menuFilter = ''
  }

  $scope.pagefunc = function () {
    $scope.startFrom = ($scope.menuPage - 1) * $scope.maxitems
  }

  $scope.dndPlaylistMove = function (type, item, to) {
    if (type === 'playlist') {
      // If we move a Item down we need correct the index bacause the item we are moving isen't there anymore..
      var __to
      if (item['playlist index'] < to) {
        __to = to - 1
      } else {
        __to = to
      }
      // Check if the Position even differs form the current position, so we don't move when it's not nessecary
      if (item['playlist index'] !== __to) {
        $scope.lmsPost(['playlist', 'move', item['playlist index'], __to])
        $scope.playlist.splice(item['playlist index'], 1)
        $scope.playlist.splice(__to, 0, item)
      }
    } else if (type === 'menu') {
      var params = $scope.submenu(item, 'add-hold', 0, true)
      $scope.lmsPost(params[0])
    }
    return true
  }

  // prevent default action of arrow and space keys; only in document.body (so they still work in an imput field)
  window.addEventListener('keydown', function (e) {
    if ([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1 && e.target === document.body) {
      e.preventDefault()
    }
  }, false)

  // define hotkeys
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

LmsApi.controller('SettingsCtrl', function ($scope, $log, localStorage, $location) {
  $scope.lmsurl = localStorage.get('lmsurl')
  $scope.lmsport = localStorage.get('lmsport')
  $scope.bubbletips = localStorage.get('bubbletips')
  $scope.maxitems = localStorage.get('maxitems')
  $scope.menuArtwork = localStorage.get('menuArtwork')
  $scope.playlistArtwork = localStorage.get('playlistArtwork')
  $scope.saveSettings = function (settings) {
    for (var key in settings) {
      var value = settings[key]
      localStorage.set(key, value)
    }
  }
  $scope.clearSettings = function () {
    localStorage.clear()
    $location.url('/')
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
  factory.remove = function (key) {
    $window.localStorage.removeItem(key)
    return
  }
  return factory
})

LmsApi.factory('authFactory', function ($injector, base64, localStorage) {
  var auth__ = localStorage.get('auth')
  var url__ = localStorage.get('lmsurl') + ':' + localStorage.get('lmsport')
  var factory = {}
  factory.set = function (key) {
    var $uibModal = $injector.get('$uibModal')
    var modal = $uibModal.open({
      template: '<div class="modal-header">' +
                ' <h3 class="modal-title">Login required</h3>' +
                '</div>' +
                '<form ng-submit="search(menuitem,searchInput)">' +
                '<div class="modal-body">' +
                '  <div class="form-group">' +
                '    <label for="usr">User:</label>' +
                '    <input id="usr" type="text" ng-model="user" class="form-control" autofocus>' +
                '  </div>' +
                '  <div class="form-group">' +
                '    <label for="password">Password:</label>' +
                '    <input id="password" type="password" ng-model="pwd" class="form-control">' +
                '  </div>' +
                '  <div class="checkbox">' +
                '    <label><input type="checkbox" ng-model="save" value="">Remember me</label>' +
                '  </div>' +
                '</div>' +
                '<div class="modal-footer">' +
                '  <button class="btn btn-default" ng-click="submit([user, pwd, save])" type="button submit">' +
                '    Submit' +
                '  </button>' +
                '</div>' +
                '</form>',
      controller: function ($scope, $uibModalInstance) {
        $scope.submit = function (auth) {
          $uibModalInstance.close(auth)
        }
      }
    })
    return modal.result.then(function (auth) {
      auth__ = base64.encode(auth[0] + ':' + auth[1])
      if (auth[2] === true) {
        localStorage.set('auth', auth__)
      } else {
        localStorage.remove('auth')
      }
    })
  }
  factory.get = function () {
    return auth__
  }
  factory.getUrl = function () {
    return url__
  }
  factory.reloadUrl = function () {
    url__ = localStorage.get('lmsurl') + ':' + localStorage.get('lmsport')
  }
  return factory
})

// On route change (when the user change from the settings page back to home) we need to reload the url from the settings
LmsApi.run(function ($rootScope, authFactory) {
  $rootScope.$on('$routeChangeStart', function (event, next, current) {
    authFactory.reloadUrl()
  })
})

// http interceptor to handle authentification on the logitech media server
LmsApi.config(function ($httpProvider) {
  $httpProvider.interceptors.push(function ($q, $injector, authFactory) {
    return {
      // function to execute on every request
      request: function (request) {
        // get the auth string from the local storage
        var auth = authFactory.get()
        // If there is a saved auth string and the url matches the saved lms url we set the auth header in the request
        if (typeof auth !== 'undefined' && request.url.indexOf(authFactory.getUrl()) !== -1) {
          request.headers.authorization = 'Basic ' + auth
        }
        return request
      },
      // function to execute if the server respone with an error
      responseError: function (rejection) {
        // If the rejection status is 401 (permission denied) and the url matches the saved lms url we open the login dialog and then try again
        if (rejection.status === 401 && rejection.config.url.indexOf(authFactory.getUrl()) !== -1) {
          return authFactory.set().then(function () {
            return $injector.get('$http')(rejection.config)
          })
        }
        return $q.reject(rejection)
      }
    }
  })
})

// filter that filters an oject based on a key with a specific value, also takes a switch to disable it
// Example: object:'name':'mike':true Only return objects where the key name is set to the value mike
LmsApi.filter('objectFilter', ['$filter', function ($filter) {
  return function (input, key, value, enable) {
    if (enable) {
      return $filter('filter')(input, {[key]: value})
    } else {
      return input
    }
  }
}])

// filter that takes a strings as input and returns an intiger
LmsApi.filter('num', function () {
  return function (input) {
    return parseInt(input, 10)
  }
})

// filter that takes seconds as input and returns formatted date
LmsApi.filter('secondsToDateTime', function () {
  return function (seconds) {
    return new Date(1970, 0, 1).setSeconds(seconds)
  }
})

// Simple filter that returns the type of the input
LmsApi.filter('typeof', function () {
  return function (input) {
    return typeof input
  }
})

LmsApi.filter('startFrom', function () {
  return function (input, start) {
    if (typeof start !== 'undefined') {
      start = +start
      return input.slice(start)
    } else {
      return input
    }
  }
})
