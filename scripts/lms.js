'use strict';
var LmsApi = angular.module('LmsApi', ['ngAnimate','ui.bootstrap','LocalStorageModule', 'ngRoute'])

LmsApi.config(function($routeProvider) {
  $routeProvider
    .when('/', { templateUrl: 'home.html' })
    .when('/settings', { templateUrl: 'settings.html' })
    .otherwise({ redirectTo: '/' });
})

LmsApi.controller('LmsApiCtrl', function($scope, $http, $timeout, $log, localStorageService){
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
    });
  };
  var poller = function() {
    $http.post($scope.LmsUrl + "jsonrpc.js", '{"id":1,"method":"slim.request","params":["' + $scope.player.playerid + '", ["status", "0", 999, "tags:aly"]]}').then(function(r) {
      $scope.data = r.data.result;
      if ($scope.data.playlist_tracks!=0) {
        $scope.CoverUrl = $scope.LmsUrl + "music/" + $scope.data.playlist_loop[$scope.data.playlist_cur_index].id + "/cover_300x300_p.png";
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
    var httpr = $http.post($scope.LmsUrl + "jsonrpc.js",'{"id":1,"method":"slim.request","params":["' + $scope.player.playerid + '",' + angular.toJson($scope.params) + ']}').then(function(r) {
      console.log("lmsPost: " + $scope.params);
      $scope.params.length = 0;
      return r.data.result;
    });
    return httpr;
  }
  $scope.menufunc = function(item) {
    console.log(item);
    if (item.actions) {
      if (item.actions.do) {
        console.log("do");
        $scope.params.push.apply($scope.params,item.actions.do.cmd);
        $scope.lmsPost();
        $scope.getmenu();
      } else if (item.actions.go) {
        console.log("go");
        Array.prototype.push.apply($scope.params,item.actions.go.cmd);
        $scope.params.push(0,999999);
        for(var keyName in item.actions.go.params){
          var key=keyName;
          var value=item.actions.go.params[keyName];
          $scope.params.push(key + ":" + value);
        }
        $scope.lmsPost().then(function(r) {
          $scope.menu=r;
          $scope.filterisEnable=false;
        })
      }
    } else {
      console.log("anders");
      if (item.isANode) {
        $scope.nodefilter = item.id;
      } else if (item.type == "playlist") {
        console.log("playlist");
        if (item.commonParams.album_id) {
          console.log("album");
          $scope.params.push('browselibrary','items',0,100,'mode:tracks','menu:1','album_id:' + item.commonParams.album_id);
          $scope.lmsPost().then(function(r) {
            $scope.menu=r;
            $scope.filterisEnable=false;
          })
        } else if (item.commonParams.artist_id) {
          console.log("artist");
          $scope.params.push('browselibrary','items',0,100,'mode:albums','menu:1','artist_id:' + item.commonParams.artist_id);
          $scope.lmsPost().then(function(r) {
            $scope.menu=r;
            $scope.filterisEnable=false;
          })
        } else if (item.commonParams.playlist_id) {
          console.log("playlist");
          $scope.params.push('browselibrary','items',0,100,'mode:tracks','menu:1','playlist_id:' + item.commonParams.playlist_id);
          $scope.lmsPost().then(function(r) {
            $scope.menu=r;
            $scope.filterisEnable=false;
          })
        }
      }
    }
  }
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
