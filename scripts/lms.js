'use strict';
var LmsApi = angular.module('LmsApi', ['ngAnimate','ui.bootstrap','LocalStorageModule', 'ngRoute',  'cfp.hotkeys'])

LmsApi.config(function($routeProvider) {
  $routeProvider
    .when('/', { templateUrl: 'home.html' })
    .when('/settings', { templateUrl: 'settings.html' })
    .otherwise({ redirectTo: '/' });
})

LmsApi.controller('LmsApiCtrl', function($scope, $http, $timeout, $log, localStorageService, hotkeys, $q){
  $scope.home = 1;
  $scope.settings = 0;
  $scope.params = [];
  $scope.TrackPosChange = 0;
  $scope.VolChange = 0;
  $scope.LmsUrl = 'http://' + localStorageService.get('lmsurl') + ':' + localStorageService.get('lmsport') + '/';
  var setPlayer = localStorageService.get('player');
  $http.post($scope.LmsUrl + "jsonrpc.js",'{"id":1,"method":"slim.request","params":["-",["players",0,99]]}').then(function(r) {
    $scope.players = r.data.result;
    if (setPlayer) {
      if (setPlayer.playerid == $scope.players.players_loop[setPlayer.playerindex].playerid) {
        $scope.player = $scope.players.players_loop[setPlayer.playerindex]
      } else {
      $scope.player = $scope.players.players_loop[0];
      };
    } else {
      $scope.player = $scope.players.players_loop[0];
    }
    poller();
    $scope.getmenu();
  });
  $scope.getmenu = function() {
    $http.post($scope.LmsUrl + "jsonrpc.js",'{"id":1,"method":"slim.request","params":["' + $scope.player.playerid + '", ["menu", 0, 100, "direct:1"]]}').then(function(r) {
      $scope.filterisEnable = true;
      $scope.nodefilter = 'home'
      $scope.menu = r.data.result;
      $scope.filterisEnable = true;
      $scope.orderby = 'weight'
    });
  };
  var poller = function() {
    $http.post($scope.LmsUrl + "jsonrpc.js", '{"id":1,"method":"slim.request","params":["' + $scope.player.playerid + '", ["status", "0", 999, "tags:alyK"]]}').then(function(r) {
      $scope.data = r.data.result;
      if ($scope.data.playlist_tracks!=0) {
        if ($scope.data.playlist_loop[$scope.data.playlist_cur_index].artwork_url) {
          if ($scope.data.playlist_loop[$scope.data.playlist_cur_index].artwork_url.startsWith('http')) {
            $scope.CoverUrl = $scope.data.playlist_loop[$scope.data.playlist_cur_index].artwork_url;
          } else {
            $scope.CoverUrl = $scope.LmsUrl + $scope.data.playlist_loop[$scope.data.playlist_cur_index].artwork_url;
          }
        } else {
        $scope.CoverUrl = $scope.LmsUrl + "music/" + $scope.data.playlist_loop[$scope.data.playlist_cur_index].id + "/cover_300x300_p.png";
        };
      } else {
        $scope.CoverUrl = $scope.LmsUrl + "music/" + 0 + "/cover_300x300_p.png";
      };
      if ($scope.VolChange == 0) {
        $scope.volume = $scope.data['mixer volume']
      };
      if ($scope.TrackPosChange == 0) {
        if ($scope.data.time) {
          $scope.trackpos = $scope.data.time
        } else {
          $scope.trackpos = 0
        };
      };
      if (setPlayer) {
        if (setPlayer.playerid != $scope.player.playerid) {
          localStorageService.set('player',$scope.player);
          setPlayer = $scope.player;
        };
      } else {
        localStorageService.set('player',$scope.player);
        setPlayer = $scope.player;
      }
      $timeout(poller, 500);
    });
  };
  $scope.lmsPost = function() {
    var params = $scope.params.slice(0);
    $scope.params.length = 0;
    console.log("lmsPost: " + params);
    return $http.post($scope.LmsUrl + "jsonrpc.js",'{"id":1,"method":"slim.request","params":["' + $scope.player.playerid + '",' + angular.toJson(params) + ']}').then(function(r) {
      console.log(r.data.result);
      return r.data.result;
    });
  }
  $scope.menufunc = function(item) {
    console.log(item);
    if (item.action == 'none') { return }
    if (item.actions) {
      if (item.actions.do) {
        console.log("do");
        $scope.params.push.apply($scope.params,item.actions.do.cmd);
        $scope.lmsPost();
        $scope.getmenu();
      } else if (item.actions.go) {
        console.log("go");
        var menuChange = false;
        for(var key in item.actions.go.cmd){
          var value=item.actions.go.cmd[key];
          $scope.params.push(value);
          if (value == 'items') {
            $scope.params.push(0,100)
            menuChange = true;
          }
        }
        for(var key in item.actions.go.params){
          var value=item.actions.go.params[key];
          if (key == 'search') {
            console.log('this is a search item, use the search input');
            return;
          }
          $scope.params.push(key + ":" + value);
        }
        $scope.params.push('useContextMenu:1')
        $scope.lmsPost().then(function(r) {
          if (menuChange) {
            if (r.base) {
              $scope.baseactions=r.base.actions;
            } else {
              $scope.baseactions=0;
            }
            $scope.menu=r;
            $scope.filterisEnable=false;
            $scope.orderby = '$index';
          };
        })
      }
    } else if (item.isANode) {
      $scope.nodefilter = item.id;
    } else {
      if (item.goAction) {
        var action = item.goAction
      } else {
        var action = 'go'
      }
      console.log('Action:' + action);
      if ($scope.baseactions==0) {
        console.log('something went horribly wrong..');
        return;
      }
      var params = $scope.submenu(item,action,0);
      $scope.params = params[0]
      var menuChange = params[1]
      $scope.lmsPost().then(function(r) {
        if (menuChange) {
          if (r.base) {
            $scope.baseactions=r.base.actions;
          } else {
            $scope.baseactions=0;
          }
          $scope.menu=r;
          $scope.filterisEnable=false;
          $scope.orderby = '$index';
        };
      })
    };
  };
  $scope.ddClose = function() {
    $scope.contextMenu = {};
  }
  $scope.submenu = function(menuitem,action,context) {
    var menuChange = false;
    var params=[]
    for (var key in $scope.baseactions[action].cmd) {
      var value = $scope.baseactions[action].cmd[key];
      $scope.params.push(value)
      if (value == 'items') {
        $scope.params.push(0,100)
        menuChange = true;
      }
    }
    for (var key in $scope.baseactions[action].params) {
      var value = $scope.baseactions[action].params[key];
      $scope.params.push(key + ":" + value)
    }
    for (var key in menuitem[$scope.baseactions[action].itemsParams]) {
      var value = menuitem[$scope.baseactions[action].itemsParams][key];
      $scope.params.push(key + ":" + value)
    }
    for (var key in $scope.baseactions[action]) {
      if (key != 'cmd' &&
          key != 'params' &&
          key != 'itemsParams') {
        var value = $scope.baseactions[action][key]
        if (typeof $scope.baseactions[action][key] != 'object') {
            $scope.params.push(key + ":" + value)
        } else {
          if( Object.prototype.toString.call($scope.baseactions[action][key]) == '[object Array]' ) {
            for (var subkey in $scope.baseactions[action][key]) {
              var subvalue = $scope.baseactions[action][key][subkey]
              $scope.params.push(subvalue)
            }
          } else {
            for (var subkey in $scope.baseactions[action][key]) {
              var subvalue = $scope.baseactions[action][key][subkey]
              $scope.params.push(subkey + ":" + subvalue)
            }
          }
        }
      }
    }
    $scope.params.push('useContextMenu:1');
    if (context == 1) {
      $scope.params.push('xmlBrowseInterimCM:1');
      $scope.lmsPost().then(function(r) {
        $scope.contextMenu = r;
      })
    } else {
      return [params,menuChange]
    }
  }

  $scope.search = function(item,searchInput) {
    for(var key in item.actions.go.cmd){
      var value=item.actions.go.cmd[key];
      $scope.params.push(value);
      if (value == 'items') {
        $scope.params.push(0,100)
      }
    }
    for(var key in item.actions.go.params){
      var value=item.actions.go.params[key];
      if (value=='__TAGGEDINPUT__'){
        value=searchInput;
      };
      $scope.params.push(key + ":" + value);
    }
    $scope.params.push('useContextMenu:1');
    $scope.lmsPost().then(function(r) {
      $scope.menu=r;
      $scope.filterisEnable=false;
    })
  };

  window.addEventListener("keydown", function(e) {
    // space and arrow keys
    if([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1 && e.target == document.body) {
        e.preventDefault();
    }
  }, false);

  hotkeys.bindTo($scope)
    .add({
      combo: 'space',
      description: 'Play/Pause',
      callback: function() {
        $scope.params.push('pause');
        $scope.lmsPost()
      }
    })
    .add({
      combo: 'left',
      description: 'Previous Track',
      callback: function() {
        $scope.params.push('button','jump_rew');
        $scope.lmsPost()
      }
    })
    .add({
      combo: 'right',
      description: 'Next Track',
      callback: function() {
        $scope.params.push('button','jump_fwd');
        $scope.lmsPost()
      }
    })
    .add({
      combo: 'up',
      description: 'Volume Up',
      callback: function() {
        $scope.params.push('mixer','volume','+2');
        $scope.lmsPost()
      }
    })
    .add({
      combo: 'down',
      description: 'Volume Down',
      callback: function() {
        $scope.params.push('mixer','volume','-2');
        $scope.lmsPost()
      }
    })
});

LmsApi.controller('SettingsCtrl', function($scope, $log, localStorageService){
  $scope.lmsurl = localStorageService.get('lmsurl')
  $scope.lmsport = localStorageService.get('lmsport')
  $scope.saveSettings = function(settings) {
    for(var keyName in settings){
      var key=keyName;
      var value=settings[keyName];
      localStorageService.set(key, value);
    }
  }
  $scope.clearSettings = function() {
    localStorageService.clearAll();
  }
});

LmsApi.filter('menu_filter', ['$filter', function($filter) {
  return function(input, filter1, filter2, isEnable){
    if(isEnable) {
      return $filter('filter')(input,  { [filter1]:filter2 });
    } else {
      return input;
    };
  };
}])

LmsApi.filter('secondsToDateTime', [function() {
  return function(seconds) {
    return new Date(1970, 0, 1).setSeconds(seconds);
  };
}])
