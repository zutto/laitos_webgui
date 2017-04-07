(function ( jQuery ) {

	jQuery.shload = function(options, rebind) {
		var xhr_l = [];
		var storage;
		var start = Date.now();
		var qr;
		var rebind;
		var scrollState = null;
		var scrollTimeOut = 100;
		var unloaded = {};
		var ckloaded = {};
		window.first = false;
		var o = jQuery.extend({
			qtype: "AJAX",
			headers: {}, //additional headers
			title: 'Titles.. Everywhere!', //goal is to be lightweight, no parsing of the html for title.
			loadBegin: undefined, //delay in milliseconds before starting to crawl for data. set undefined for none.
			parent: undefined, //if you wish to be paginating with this, parent id goes here.
			parentKey: undefined,
			linkKey: "preload", //attribute that will be looked for.
			cache: 1*60*1000, // 15*60*1000, //cache in milliseconds.. undefined == forever
			cacheKey: "cache",
			reInitKey: "init", //if the a href has this attribute, this lib will rebind the links.
			reHeader: function(obj, oh) { return oh; }, //if you want to modify headers before sending
			reLink: function(obj, link) { return link; }, //if you want to modify link before doing the request..
			beforeLoad: function(obj, link) { return link; }, //before loading, you can do your own hacks.
			afterLoad: function(obj, data) {}, //after load is complete, do something with the data?
			onError: function(obj) {}, //if request fails, do something?
			progress: function(link, data) {},
			afterClick: function() {},
			lazyLoader: false, 
			lazyloadTreshold: 100,
			cacheClearCookie: 'shload_clear',
			scrollTimeOut: 100,
		}, options );

		var init = function() {
			if(!window.shload_bound || rebind){
				if(window.sessionStorage)
				{
					storage = window.sessionStorage;
				}else if(window.localStorage)
				{
					storage = window.localStorage;
				}else
				{
					storage = [];
				}
				binds();
				var c = 0;
				vLoader(jQuery("["+o.linkKey+"]"));
			}
		}

		var vLoader = function(links)
		{
			qr.each(function() {
				var hr = jQuery(this).attr("href");
				var c = 0;
				if(o.cacheKey){
					var ck = parseInt(jQuery(this).attr(o.cacheKey));
				}else
				{
					var ck = undefined;
				}

				var link = o.beforeLoad(this, hr);
				ckloaded[link] = ck;
				if(!o.loadBegin || typeof o.loadBegin === "undefined") {
					o.loadBegin = 1;
				}
				if(o.lazyLoader){
					unloaded[link] = jQuery(this);
				}else{
					if(!isCached(hr)){
						window.setTimeout(jQuery.proxy(function() { fetch(jQuery(this), link);}, this), o.loadBegin+(c));
						c++;
					}
				}

			});
			if(o.lazyLoader)
			{
				triggerLoads();
			}
		};


		var isCached = function(link)
		{

			var gg = false;
			var ge = get(link);
			if(ge){
				if(ge.loaded){
					if(o.cache && isInteger(o.cache))
					{
						if((Date.now() - ge.timeStamp) >= o.cache){
							gg = false;
						}else
						{
							gg = true;
						}

					}else if(ck) {
						if((Date.now() - ge.timeStamp) >= ckloaded[link]){
							gg = false;
						}else
						{
							gg = true;
						}
					}
				}
			}
			return gg;
		}

		var triggerLoads = function()
		{
			scrollState = null;
			var c = 0;
			for(var k in unloaded)
			{
				if(!isCached(k)){
					if (unloaded.hasOwnProperty(k)){
						var go = true;
						if(o.lazyLoader && !visible(unloaded[k]))
						{
							go = false;
						}
						if(go){
							window.setTimeout(fetch(jQuery(unloaded[k]), k), o.loadBegin+(c));
							/*window.setTimeout(jQuery.proxy(function() { fetch(jQuery(unloaded[k]), k);}, unloaded), o.loadBegin+(c));*/
							c++;
						}
					}
				}
			}
		}

		var vw =  jQuery(window);
		var visible = function(e)
		{
			return !(((window.innerHeight ? window.innerHeight : vw.height()) + vw.scrollTop()) <= e.offset().top - o.lazyloadTreshold) && !(vw.scrollTop() >= e.offset().top + o.lazyloadTreshold);
		}

		jQuery(window).on("popstate", function(evt){
			if(evt){
				evt = evt.originalEvent.state;
				if(evt){

					return spawn(evt.sel, evt.link, evt.data, true);
				}else
				{
					return true;
				}
			}else
			{
				return false;
			}
		});

		var binds = function()
		{
			if(!window.shload_bound || rebind){



				qr = jQuery("["+o.linkKey+"]").off("click").on("click", linkClick);
				if(o.lazyLoader)
				{
					var type = "scroll";
					if(/Mobi/.test(navigator.userAgent))
					{
						type = "touchmove";
					}else
					{
						type = "scroll";
					}
					jQuery(window).off(type).on(type, (function()
					{
						if(scrollState === null)
						{
						}else
						{
							window.clearTimeout(scrollState);
						}
						scrollState = window.setTimeout(triggerLoads, o.scrollTimeOut);
					}));
				}
			}
			window.shload_bound = true;
			rebind = undefined;
		};


		var linkClick = function(event) {
			event.preventDefault();
			var e = jQuery(this);
			if(o.cacheKey){
				var ck = parseInt(e.attr(o.cacheKey));
			}else
			{
				var ck = undefined;
			}
			var xh = e.attr("href");
			if(xh){
				var x = get(xh);
				if(x){
					if(x.loaded){
						if(o.cache && isInteger(o.cache)){
							if((Date.now() - x.timeStamp) >= o.cache)
							{
								return noex(xh); //old.
							}else
							{
								return goex(this, xh);
							}
						}
						if(ck){
							if((Date.now() - x.timeStamp) >= ck)
							{
								return noex(xh);
							}else
							{
								return goex(this, xh);
							}
						}
					}
				}
			}
			return noex(xh); //??

		}

		var isInteger = function(x)
		{
			return Math.floor(x) === x;
		}

		var fetch = function(obj, link)
		{
			crawl(obj, link);
		}

		var crawl = function(obj, link)
		{
			var options = {};
			jQuery.ajax({
				url: o.reLink(obj, link),
				type: o.qtype,
				headers: o.reHeader(obj, o.headers),
				success: function(data) {
					set(link, {
						timeStamp: Date.now(),
						"data": data,
						loaded: true,
					});
					o.afterLoad(obj, data);
				},
				error: function(data) {
					o.onError(obj, data)
				},
				xhr: function(){
					var xhr = jQuery.ajaxSettings.xhr();
					if  (!(xhr && ('upload' in xhr))) {
						return xhr;
					}
					xhr_l[link] = {loaded: false, progress: 0};

					var genericeend = function(){ }; 

					xhr.upload.onload = genericeend;
					xhr.upload.onerror = genericeend;
					xhr.upload.ontimeout = genericeend;
					xhr.upload.onabort = genericeend;


					xhr.onprogress = function(evt){
						if(o.progress) {
							o.progress(link, evt.loaded/evt.total*100);
						}
					};
					return xhr ;
				}
			});
			
		}

		var noex = function(link) 
		{
			del(link);
			window.location.href = link;
			return true;
		}

		var goex = function(obj, link) 
		{
			var xa =jQuery(obj).attr("parent");
			if(!xa)
			{	
				rebind = true;
				xa = o.parent;
				init();
			}
			if(!window.first[xa])
			{
				window.history.replaceState({sel: xa, "link": window.location.href, data: jQuery(xa).html()}, "juttu", window.location.href);
				o.afterClick();
				window.first = true;
			}
			if(!spawn(xa, link)){
				rebind = true;
				window.history.pushState({sel: xa, "link": link, data: jQuery(xa).html()}, "juttu", link);
				o.afterClick();
				init();
			}
			return false;
		}

		var spawn = function(sel, link, data, reinit)
		{	
			if(data)
			{
				jQuery(sel).html(data);
			}else
			{
				var g = get(link);
				jQuery(sel).html(g.data);
			}
			if(reinit === true)
			{
				rebind = true;
				init();
			}
			return false;
		}

		var get = function(e) {
			var s = storage[e];
			try {
				s = JSON.parse(s);
			}catch(e) {
				return undefined;
			}
			return s;
		}

		var set = function(e, val) {
			storage[e] = JSON.stringify(val);
		}

		var del = function(e) {
			storage[e] = null;
		}

		init();
	};
}(jQuery));