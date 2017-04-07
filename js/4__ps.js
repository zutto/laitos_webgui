(function($, o) {

  o = $({});

  $.sub = function(e, h) {
    o.on.call(o, e, h);
  };

  $.unsub = function(e, h) {
    o.off.call(o, e, h);
  };

  $.pub = function(e, h) {
    o.trigger.call(o, e, h);
  };

}(jQuery));