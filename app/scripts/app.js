define([
  'underscore',
  'backbone',
  'backbone.marionette',
  'common/collections/NavigationCollection',
  'common/controllers/SelectedModulesController',
  'common/views/NavigationView',
  'localforage',
  'nusmods',
  'common/config',
  'backbone.analytics',
  'qtip2'
], function (_, Backbone, Marionette, NavigationCollection,
             SelectedModulesController, NavigationView,
             localforage, NUSMods, config) {
  'use strict';

  var App = new Marionette.Application();

  App.addRegions({
    mainRegion: '.content',
    navigationRegion: 'nav',
    selectRegion: '.navbar-form'
  });

  var navigationCollection = new NavigationCollection();
  var navigationView = new NavigationView({collection: navigationCollection});
  App.navigationRegion.show(navigationView);

  App.reqres.setHandler('addNavigationItem', function (navigationItem) {
    return navigationCollection.add(navigationItem);
  });

  NUSMods.setConfig(config);
  NUSMods.generateModuleCodes();

  var selectedModulesController = new SelectedModulesController();
  App.reqres.setHandler('selectedModules', function () {
    return selectedModulesController.selectedModules;
  });
  App.reqres.setHandler('addModule', function (id, options) {
    return NUSMods.getMod(id).then(function (mod) {
      return selectedModulesController.selectedModules.add(mod, options);
    });
  });
  App.reqres.setHandler('removeModule', function (id) {
    var selectedModules = selectedModulesController.selectedModules;
    return selectedModules.remove(selectedModules.get(id));
  });
  App.reqres.setHandler('isModuleSelected', function (id) {
    return !!selectedModulesController.selectedModules.get(id);
  });
  App.reqres.setHandler('displayLessons', function (id, display) {
    _.each(selectedModulesController.timetable.where({
      ModuleCode: id
    }), function (lesson) {
      lesson.set('display', display);
    });
  });

  App.on('start', function () {
    require([
      'common/views/AppView',
      'common/collections/TimetableModuleCollection',
      // 'ivle',
      'modules',
      'timetable',
      'preferences',
      'help',
      'about',
      'support'
    ], function (AppView, TimetableModuleCollection) {
      localforage.getItem(config.semTimetableFragment +
        ':selectedModulesQueryString').then(function (selectedModulesQueryString) {
        // Needed to transform legacy JSON format to query string.
        // TODO: remove after a sufficient transition period has passed.
        if (!selectedModulesQueryString) {
          return localforage.getItem('selectedModules')
            .then(TimetableModuleCollection.fromJSONtoQueryString);
        }
        return selectedModulesQueryString;
      }).then(function (selectedModulesQueryString) {
        if ('/' + config.semTimetableFragment === window.location.pathname) {
          var queryString = window.location.search.slice(1);
          if (queryString) {
            if (selectedModulesQueryString !== queryString) {
              // If initial query string does not match saved query string,
              // timetable is shared.
              selectedModulesController.selectedModules.shared = true;
            }
            // If there is a query string for timetable, return so that it will
            // be used instead of saved query string.
            return;
          }
        }
        var selectedModules = TimetableModuleCollection.fromQueryStringToJSON(selectedModulesQueryString);
        return $.when.apply($, _.map(selectedModules, function (module) {
          return App.request('addModule', module.ModuleCode, module).promise;
        }));
      }).then(function () {
        new AppView();

        // Backbone.history.start returns false if no defined route matches
        // the current URL, so navigate to timetable by default.
        if (!Backbone.history.start({pushState: true})) {
          Backbone.history.navigate('timetable', {trigger: true, replace: true});
        }
      });
    });

    var $body = $('body');
    ['theme', 'mode'].forEach(function (property) {
      localforage.getItem(property, function (value) {
        if (!value) {
          value = 'default';
          localforage.setItem(property, value);
        }
        $body.addClass(property + '-' + value);
        $body.attr('data-' + property, value);
        if (property === 'mode' && value !== 'default') {
          $('#mode').attr('href', '/styles/' + value + '.min.css');
        }
      });
    });
  });

  return App;
});
