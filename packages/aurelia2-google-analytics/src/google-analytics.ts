import { DI, IEventAggregator, ILogger, inject } from 'aurelia';

const deepMerge = function (target: Record<string, unknown>, ...sources: Record<string, unknown>[]): Record<string, unknown> {
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
				target = [...(Object.values(target))] as unknown as Record<string, unknown>;
			else
				target = { ...target };
			if (source[key] && typeof source[key] === 'object') {
				target[key] = deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
			} else {
				target[key] = source[key];
			}
		}
	}

	return deepMerge(target, ...sources);
};

const criteria = {
	isElement: function (e: EventTarget | null): e is HTMLElement {
		return e instanceof HTMLElement;
	},
	hasClass: function (cls: string) {
		return function (e: EventTarget | null): boolean {
			return criteria.isElement(e) && e.classList.contains(cls);
		}
	},
	hasTrackingInfo: function (e: EventTarget | null): boolean {
		return criteria.isElement(e) &&
			e.hasAttribute('data-analytics-category') &&
			e.hasAttribute('data-analytics-action');
	},
	isOfType: function (e: EventTarget | null, type: string): boolean {
		return criteria.isElement(e) && e.nodeName.toLowerCase() === type.toLowerCase();
	},
	isAnchor: function (e: EventTarget | null): boolean {
		return criteria.isOfType(e, 'a');
	},
	isButton: function (e: EventTarget | null): boolean {
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
		getTitle: (payload: any): string => {
			return payload.navigation.title;
		},
		getUrl: (payload: any): string => {
			return payload.navigation.fragment;
		},
		customFnTrack: false as false | ((...args: unknown[]) => unknown),
	},
	clickTracking: {
		enabled: false,
		filter: (element: EventTarget | null): boolean => {
			return criteria.isAnchor(element) || criteria.isButton(element);
		},
		customFnTrack: false as false | ((...args: unknown[]) => unknown),
	},
	exceptionTracking: {
		enabled: true,
		applicationName: undefined as string | undefined,
		applicationVersion: undefined as string | undefined,
		customFnTrack: false as false | ((...args: unknown[]) => unknown),
	}
};

interface DelegatedEvent extends Event {
	delegateTarget?: EventTarget | null;
}

const delegate = function (criteria: ((e: EventTarget | null) => boolean) | undefined, listener: (evt: DelegatedEvent) => void) {
	return function (this: unknown, evt: DelegatedEvent) {
		let el: EventTarget | null = evt.target;
		do {
			if (criteria && !criteria(el))
				continue;
			evt.delegateTarget = el;
			listener.call(this, evt);
			return;
		} while ((el = (el as Node).parentNode));
	};
};

export const IGoogleAnalytics = DI.createInterface<IGoogleAnalytics>('IGoogleAnalytics', x => x.singleton(Analytics));
export interface IGoogleAnalytics extends Analytics {}

interface ExceptionOptions {
	exDescription: string | Event;
	exFatal: boolean;
	appName?: string;
	appVersion?: string;
}

interface TrackingInfo {
	category: string | null;
	action: string | null;
	label: string | null;
	value: string | null;
}

interface PageProps {
	page: string;
	title: string;
	anonymizeIp: boolean;
}

@inject(IEventAggregator, ILogger)
export class Analytics {
	_initialized = false;
	_options: typeof defaultOptions = defaultOptions;
	private _clickDelegateHandler: ((evt: Event) => void) | null = null;

	constructor(readonly eventAggregator: IEventAggregator, readonly logger: ILogger) {
		this.logger.scopeTo('aurelia2-google-analytics');

		this._trackClick = this._trackClick.bind(this);
		this._trackPage = this._trackPage.bind(this);
	}

	attach(options: Partial<typeof defaultOptions> = defaultOptions) {
		this._options = deepMerge(defaultOptions, options as Record<string, unknown>) as unknown as typeof defaultOptions;

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

	init(id: string) {
		if (!this._options.useNativeGaScript) {
			return;
		}

		const script = document.createElement('script');
		script.text = "(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){" +
			"(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o)," +
			"m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)" +
			"})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');";
		const body = document.querySelector('body');
		if (body) {
			body.appendChild(script);
		}

		this._initFnGa();
		if (typeof ga !== 'undefined') {
			ga.l = +new Date();
		}

		this._sendFnGa('create', id, 'auto');

		this._initialized = true;
	}

	_initFnGa() {
		if (typeof ga === 'undefined') {
			(window as any).ga = function (...args: any[]) {
				const fn = (window as any).ga;
				(fn.q = fn.q || []).push(args);
			};
		}
	}

	_sendFnGa(...args: any[]) {
		this._initFnGa();
		if (typeof ga === 'function') {
			(ga as Function).apply(null, args);
		}
	}

	_attachClickTracker() {
		if (!this._options.clickTracking.enabled) {
			return;
		}

		const body = document.querySelector('body');
		if (!body) {
			return;
		}

		this._clickDelegateHandler = delegate(this._options.clickTracking.filter, this._trackClick);
		body.addEventListener('click', this._clickDelegateHandler);
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
					this._options.pageTracking.ignore.fragments.some((fragment: string) => payload.navigation.fragment.includes(fragment))
					// Ignore routes
					|| this._options.pageTracking.ignore.routes.some((route: string) => payload.navigation.instruction === route)
					// Ignore route names
					|| this._options.pageTracking.ignore.routeNames.some((routeName: string) => activeComponent?.component?.name === routeName)
					)
					return;

				this._trackPage(this._options.pageTracking.getUrl(payload), this._options.pageTracking.getTitle(payload))
			});
	}

	_attachExceptionTracker() {
		if (!this._options.exceptionTracking.enabled) {
			return;
		}

		const options = this._options;
		const sendGa = (...args: unknown[]) => this._sendFnGa(...args);
		const existingWindowErrorCallback = window.onerror;

		window.onerror = (errorMessage, url, lineNumber, columnNumber, errorObject) => {
			// Send error details to Google Analytics, if library has loaded.
			if (typeof ga === 'function') {
				let exceptionDescription: string | Event;
				if (errorObject !== undefined && typeof errorObject.message !== 'undefined') {
					exceptionDescription = errorObject.message;
				} else {
					exceptionDescription = errorMessage as string | Event;
				}

				exceptionDescription += " @ " + url;
				// Include additional details if available.
				if (lineNumber !== undefined && columnNumber !== undefined) {
					exceptionDescription += ":" + lineNumber + ":" + columnNumber;
				}

				const exOptions: ExceptionOptions = {
					exDescription: exceptionDescription,
					exFatal: false,
				};

				if (options.exceptionTracking.applicationName !== undefined) {
					exOptions.appName = options.exceptionTracking.applicationName;
				}
				if (options.exceptionTracking.applicationVersion !== undefined) {
					exOptions.appVersion = options.exceptionTracking.applicationVersion;
				}

				if (typeof options.exceptionTracking.customFnTrack === 'function') {
					return options.exceptionTracking.customFnTrack(exOptions);
				}
				sendGa('send', 'exception', exOptions);
			}

			if (typeof existingWindowErrorCallback === 'function') {
				return existingWindowErrorCallback(errorMessage, url, lineNumber, columnNumber, errorObject);
			}

			// Otherwise continue with the error.
			return false;
		};
	}

	_log(level: 'debug' | 'info' | 'warn' | 'error', message: string) {
		if (!this._options.logging.enabled) {
			return;
		}

		this.logger[level](message);
	}

	_trackClick(evt: DelegatedEvent) {
		if (!this._initialized) {
			this._log('warn', "The component has not been initialized. Please call 'init()' before calling 'attach()'.");
			return;
		}
		if (!evt || !evt.delegateTarget || !criteria.hasTrackingInfo(evt.delegateTarget)) {
			return
		}

		const element = evt.delegateTarget as HTMLElement;
		const tracking: TrackingInfo = {
			category: element.getAttribute('data-analytics-category'),
			action: element.getAttribute('data-analytics-action'),
			label: element.getAttribute('data-analytics-label'),
			value: element.getAttribute('data-analytics-value')
		};

		this._log('debug', `click: category '${tracking.category}', action '${tracking.action}', label '${tracking.label}', value '${tracking.value}'`);
		if (typeof this._options.clickTracking.customFnTrack === 'function') {
			return this._options.clickTracking.customFnTrack(tracking);
		}

		this._sendFnGa('send', 'event', tracking.category, tracking.action, tracking.label, tracking.value);
	}

	_trackPage(path: string, title: string) {
		this._log('debug', `Tracking path = ${path}, title = ${title}`);
		if (!this._initialized) {
			this._log('warn', "Try calling 'init()' before calling 'attach()'.");
			return;
		}

		const props: PageProps = {
			page: path,
			title: title,
			anonymizeIp: this._options.anonymizeIp.enabled
		};

		if (typeof this._options.pageTracking.customFnTrack === 'function') {
			return this._options.pageTracking.customFnTrack(props);
		}

		this._sendFnGa('set', props);
		this._sendFnGa('send', 'pageview');
	}
}
