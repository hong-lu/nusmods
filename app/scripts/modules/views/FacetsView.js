'use strict';

var $ = require('jquery');
var App = require('../../app');
var FacetView = require('./FacetView');
var Marionette = require('backbone.marionette');
var _ = require('underscore');
var localforage = require('localforage');

var config = require('../../common/config');
var moduleFinderNamespace = config.namespaces.moduleFinder + ':';

module.exports = Marionette.CollectionView.extend({
  childView: FacetView,
  childViewOptions: function (facet) {
    return {
      collection: facet.get('filters')
    };
  },

  onReset: function () {
    this.$window.off('scroll', this.onScroll).scroll(this.onScroll);
  },

  onScroll: function () {
    if (this.$window.scrollTop() + this.$window.height() + this.threshold >= this.$document.height()) {
      if (!this.collection.addNextPage()) {
        this.$window.off('scroll', this.onScroll);
      }
    }
  },
  onShow: function () {
    localforage.getItem(moduleFinderNamespace + 'facets', function(data) {
      if (data) {
        _.each(data, function (id) {
          var $panel = $('#' + id);
          $panel.addClass('in');
          $panel.parent().find('.nm-caret').addClass('nm-caret-down');
        });
      }
    });

    $('.collapse').on('shown.bs.collapse hidden.bs.collapse', function () {
      localforage.setItem(moduleFinderNamespace + 'facets', _.pluck($('.collapse.in'), 'id'));
    });
  },
  events: {
    'click': function () {
      var selectedFilters = {};
      _.each(this.collection.models, function (facet) {
        var filters = [];
        _.each(facet.get('filters').selected, function (filter) {
          filters.push(filter.get('label'));
        });
        if (filters.length) {
          selectedFilters[facet.get('label')] = filters;
        }
      });
      localforage.setItem(moduleFinderNamespace + 'filters', selectedFilters);
    }
  },

  onFilter: function(options) {
    var filteredCollection = this.collection.findWhere({key: options.type}).get('filters'); 
    var filteredModel = filteredCollection.findWhere({label: options.value});
    filteredModel.model.collection.selectNone();
    filteredModel.model.toggleSelected();
  },

  initialize: function (options) {
    _.bindAll(this, 'onScroll');

    this.$window = $(window);
    this.$document = $(document);
    this.threshold = options.threshold;

    this.listenTo(this.collection.filteredCollection, 'reset', this.onReset);
    App.vent.on('filterActivated', this.onFilter, this);
    this.collection.onSelect();
  }
});
