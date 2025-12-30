import { DI, IEventAggregator, ILogger, inject } from 'aurelia';

const deepMerge = function (target, ...sources) {
	if (!sources.length) {
		return target;
	}
		
	const source = sources.shift();

	if (source === undefined) {
		return target;
	}

	if (source !== Object(source)) {
		return target;
	}

	const isArray = Array.isArray(source);

	for (const key in source) {
		if (Object.prototype.hasOwnProperty.call(source, key)) {
			if (isArray)
				target = [...target];
			else
				target = { ...target };
			if (source[key] && typeof source[key] === 'object') {
				target[key] = deepMerge(target[key], source[key]);
			} else {
				target[key] = source[key];
			}
		}
	}

	return deepMerge(target, ...sources);
};

const criteria = {
	isElement: function (e) {
		return e instanceof HTMLElement;
	},
	hasClass: function (cls) {
		return function (e) {
			return criteria.isElement(e) && e.classList.contains(cls);
		}
	},
	hasTrackingInfo: function (e) {
		return criteria.isElement(e) &&
			e.hasAttribute('data-analytics-category') &&
			e.hasAttribute('data-analytics-action');
	},
	isOfType: function (e, type) {
		return criteria.isElement(e) && e.nodeName.toLowerCase() === type.toLowerCase();
	},
	isAnchor: function (e) {
		return criteria.isOfType(e, 'a');
	},
	isButton: function (e) {
		return criteria.isOfType(e, 'button');
	}
};

const defaultOptions = {
	useNativeGaScript: true,
	logging: {
		enabled: true
	},
	anonymizeIp: {
		enabled: false
	},
	pageTracking: {
		enabled: false,
		ignore: {
			fragments: [],
			routes: [],
			routeNames: []
		},
		getTitle: (payload) => {
			return payload.navigation.title;
		},
		getUrl: (payload) => {
			return payload.navigation.fragment;
		},
		customFnTrack: false,
	},
	clickTracking: {
		enabled: false,
		filter: (element) => {
			return criteria.isAnchor(element) || criteria.isButton(element);
		},
		customFnTrack: false,
	},
	exceptionTracking: {
		enabled: true,
		applicationName: undefined,
		applicationVersion: undefined,
		customFnTrack: false,
	}
};

const delegate = function (criteria, listener) {
	return function (evt) {
		let el = evt.target;
		do {
			if (criteria && !criteria(el))
				continue;
			evt.delegateTarget = el;
			listener.apply(this, arguments);
			return;
		} while ((el = el.parentNode));
	};
};

export const IGoogleAnalytics = DI.createInterface<IGoogleAnalytics>('IGoogleAnalytics', x => x.singleton(Analytics));
export interface IGoogleAnalytics extends Analytics {};

@inject(IEventAggregator, ILogger)
export class Analytics {
	_initialized = false;
	_options = defaultOptions;

	constructor(readonly eventAggregator: IEventAggregator, readonly logger: ILogger) {
		this.logger.scopeTo('aurelia2-google-analytics');
		
		this._trackClick = this._trackClick.bind(this);
		this._trackPage = this._trackPage.bind(this);
	}

	attach(options = defaultOptions) {
		this._options = deepMerge(defaultOptions, options);

		if (!this._options.useNativeGaScript) {
			this._initialized = true;
		}
		
		if (!this._initialized) {
			const errorMessage = "Analytics must be initialized before use.";
			this._log('error', errorMessage);
			throw new Error(errorMessage);
		}

		this._attachClickTracker();
		this._attachPageTracker();
		this._attachExceptionTracker();
	}

	init(id) {
		if (!this._options.useNativeGaScript) {
			return;
		}

		const script = document.createElement('script');
		script.text = "(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){" +
			"(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o)," +
			"m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)" +
			"})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');";
		document.querySelector('body').appendChild(script);

		this._initFnGa();
		ga.l = +new Date;

		// @ts-ignore
		this._sendFnGa('create', id, 'auto');

		this._initialized = true;
	}

	_initFnGa() {
		// @ts-ignore
		window.ga = window.ga || function () {
			(ga.q = ga.q || []).push(arguments)
		};
	}

	_sendFnGa() {
		this._initFnGa();
		window.ga.apply(window.ga, arguments);
	}

	_attachClickTracker() {
		if (!this._options.clickTracking.enabled) {
			return;
		}

		document.querySelector('body')
			.addEventListener('click', delegate(this._options.clickTracking.filter, this._trackClick));
	}

	_attachPageTracker() {
		if (!this._options.pageTracking.enabled) {
			return;
		}

		this.eventAggregator.subscribe('au:router:navigation-end',
			(payload: any) => {
				const activeComponent = payload?.navigation?.scope?.router?.activeComponents[0];

				if (
					// Ignore page fragments
					this._options.pageTracking.ignore.fragments.some((fragment) => payload.navigation.fragment.includes(fragment))
					// Ignore routes
					|| this._options.pageTracking.ignore.routes.some((route) => payload.navigation.instruction === route)
					// Ignore route names
					|| this._options.pageTracking.ignore.routeNames.some((routeName) => activeComponent.component.name === routeName)
					)
					return;

				this._trackPage(this._options.pageTracking.getUrl(payload), this._options.pageTracking.getTitle(payload))
			});
	}

	_attachExceptionTracker() {
		if (!this._options.exceptionTracking.enabled) {
			return;
		}

		let options = this._options;
		let existingWindowErrorCallback = window.onerror;

		window.onerror = function (errorMessage, url, lineNumber, columnNumber, errorObject) {
			// Send error details to Google Analytics, if library has loaded.
			if (typeof ga === 'function') {
				let exceptionDescription;
				if (errorObject != undefined && typeof errorObject.message != undefined) {
					exceptionDescription = errorObject.message;
				} else {
					exceptionDescription = errorMessage;
				}

				exceptionDescription += " @ " + url;
				// Include additional details if available.
				if (lineNumber != undefined && columnNumber != undefined) {
					exceptionDescription += ":" + lineNumber + ":" + columnNumber;
				}

				let exOptions = {
					exDescription: exceptionDescription,
					exFatal: false,
				};

				if (options.exceptionTracking.applicationName != undefined) {
					// @ts-ignore
					exOptions.appName = options.exceptionTracking.applicationName;
				}
				if (options.exceptionTracking.applicationVersion != undefined) {
					// @ts-ignore
					exOptions.appVersion = options.exceptionTracking.applicationVersion;
				}

				if (options.exceptionTracking.customFnTrack) {
					// @ts-ignore
					return options.exceptionTracking.customFnTrack(exOptions);
				}
				this._sendFnGa('send', 'exception', exOptions);
			}

			if (typeof existingWindowErrorCallback === 'function') {
				return existingWindowErrorCallback(errorMessage, url, lineNumber, columnNumber, errorObject);
			}

			// Otherwise continue with the error.
			return false;
		};
	}

	_log(level, message) {
		if (!this._options.logging.enabled) {
			return;
		}

		this.logger[level](message);
	}

	_trackClick(evt) {
		if (!this._initialized) {
			this._log('warn', "The component has not been initialized. Please call 'init()' before calling 'attach()'.");
			return;
		}
		if (!evt || !evt.delegateTarget || !criteria.hasTrackingInfo(evt.delegateTarget)) {
			return
		};

		const element = evt.delegateTarget;
		const tracking = {
			category: element.getAttribute('data-analytics-category'),
			action: element.getAttribute('data-analytics-action'),
			label: element.getAttribute('data-analytics-label'),
			value: element.getAttribute('data-analytics-value')
		};

		this._log('debug', `click: category '${tracking.category}', action '${tracking.action}', label '${tracking.label}', value '${tracking.value}'`);
		if (this._options.clickTracking.customFnTrack) {
			// @ts-ignore
			return this._options.clickTracking.customFnTrack(tracking);
		}

		// @ts-ignore
		this._sendFnGa('send', 'event', tracking.category, tracking.action, tracking.label, tracking.value);
	}

	_trackPage(path, title) {
		this._log('debug', `Tracking path = ${path}, title = ${title}`);
		if (!this._initialized) {
			this._log('warn', "Try calling 'init()' before calling 'attach()'.");
			return;
		}

		const props = {
			page: path,
			title: title,
			anonymizeIp: this._options.anonymizeIp.enabled
		};

		if (this._options.pageTracking.customFnTrack) {
			// @ts-ignore
			return this._options.pageTracking.customFnTrack(props);
		}

		// @ts-ignore
		this._sendFnGa('set', props);

		// @ts-ignore
		this._sendFnGa('send', 'pageview');
	}
}
