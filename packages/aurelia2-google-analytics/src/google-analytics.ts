import { DI, IEventAggregator, ILogger, inject } from 'aurelia';
import type { NavigationEndEvent } from '@aurelia/router';

interface PageEvent {
	navigation: {
		title: string;
		fragment: string;
		instruction: string;
		scope?: { router?: { activeComponents?: { component?: { name?: string } }[] } };
	};
}

type TrackingFunction = ((...args: unknown[]) => void) & { q?: unknown[][] };

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
			fragments: [] as string[],
			routes: [] as string[],
			routeNames: [] as string[]
		},
		getTitle: (payload: PageEvent): string => {
			return payload.navigation.title;
		},
		getUrl: (payload: PageEvent): string => {
			return payload.navigation.fragment;
		},
		customFnTrack: false as false | ((...args: unknown[]) => unknown),
	},
	clickTracking: {
		enabled: false,
		filter: (element: EventTarget | null): boolean => {
			return element instanceof HTMLElement && element.matches('a, button');
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

type Defaults = typeof defaultOptions;
type AnalyticsOptions = {
	useNativeGaScript?: boolean;
	logging?: Partial<Defaults['logging']>;
	anonymizeIp?: Partial<Defaults['anonymizeIp']>;
	pageTracking?: Partial<Omit<Defaults['pageTracking'], 'ignore'>> & {
		ignore?: Partial<Defaults['pageTracking']['ignore']>;
	};
	clickTracking?: Partial<Defaults['clickTracking']>;
	exceptionTracking?: Partial<Defaults['exceptionTracking']>;
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
	private readonly cleanups: (() => void)[] = [];

	constructor(readonly eventAggregator: IEventAggregator, readonly logger: ILogger) {
		this.logger.scopeTo('aurelia2-google-analytics');

		this._trackClick = this._trackClick.bind(this);
		this._trackPage = this._trackPage.bind(this);
	}

	detach(): void {
		for (const cleanup of this.cleanups.splice(0)) cleanup();
	}

	attach(options: AnalyticsOptions = {}) {
		this.detach();
		this._options = {
			useNativeGaScript: options.useNativeGaScript ?? defaultOptions.useNativeGaScript,
			logging: { ...defaultOptions.logging, ...options.logging },
			anonymizeIp: { ...defaultOptions.anonymizeIp, ...options.anonymizeIp },
			pageTracking: {
				...defaultOptions.pageTracking, ...options.pageTracking,
				ignore: { ...defaultOptions.pageTracking.ignore, ...options.pageTracking?.ignore },
			},
			clickTracking: { ...defaultOptions.clickTracking, ...options.clickTracking },
			exceptionTracking: { ...defaultOptions.exceptionTracking, ...options.exceptionTracking },
		};

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
			const queue: TrackingFunction = (...args) => (queue.q ??= []).push(args);
			Object.assign(window, { ga: queue });
		}
	}

	_sendFnGa(command: string, ...args: unknown[]) {
		this._initFnGa();
		if (typeof ga === 'function') ga(command, ...args);
	}

	_attachClickTracker() {
		if (!this._options.clickTracking.enabled) {
			return;
		}

		const body = document.querySelector('body');
		if (!body) {
			return;
		}

		const handler = delegate(this._options.clickTracking.filter, this._trackClick);
		body.addEventListener('click', handler);
		this.cleanups.push(() => body.removeEventListener('click', handler));
	}

	_attachPageTracker() {
		if (!this._options.pageTracking.enabled) {
			return;
		}

		const tracking = this._options.pageTracking;
		const subscription = this.eventAggregator.subscribe('au:router:navigation-end', (event: PageEvent | NavigationEndEvent) => {
			let payload: PageEvent;
			let routeName: string | undefined;
			if ('navigation' in event) {
				payload = event;
				routeName = event.navigation.scope?.router?.activeComponents?.[0]?.component?.name;
			} else {
				const tree = event.finalInstructions;
				const path = tree.toPath();
				const query = tree.queryParams.toString();
				const fragment = '/' + path + (query ? '?' + query : '') + (tree.fragment ? '#' + tree.fragment : '');
				payload = { ...event, navigation: { fragment, title: document.title, instruction: path } };
				const route = tree.children[0]?.recognizedRoute?.route.endpoint.route.handler;
				if (route && 'id' in route) routeName = route.id;
			}
			const { fragment, instruction } = payload.navigation;
			if (tracking.ignore.fragments.some(value => fragment.includes(value))
				|| tracking.ignore.routes.includes(instruction)
				|| (routeName && tracking.ignore.routeNames.includes(routeName))) return;
			this._trackPage(tracking.getUrl(payload), tracking.getTitle(payload));
		});
		this.cleanups.push(() => subscription.dispose());
	}

	_attachExceptionTracker() {
		if (!this._options.exceptionTracking.enabled) {
			return;
		}

		const options = this._options.exceptionTracking;
		const onError = (event: ErrorEvent) => {
			if (typeof ga !== 'function' && !options.customFnTrack) return;
			const message = event.error?.message ?? event.message;
			const details: ExceptionOptions = {
				exDescription: `${message} @ ${event.filename}:${event.lineno}:${event.colno}`,
				exFatal: false,
			};
			if (options.applicationName !== undefined) details.appName = options.applicationName;
			if (options.applicationVersion !== undefined) details.appVersion = options.applicationVersion;
			if (options.customFnTrack) {
				if (options.customFnTrack(details) === true) event.preventDefault();
			} else {
				this._sendFnGa('send', 'exception', details);
			}
		};
		window.addEventListener('error', onError);
		this.cleanups.push(() => window.removeEventListener('error', onError));
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
		const element = evt?.delegateTarget;
		if (!(element instanceof HTMLElement) || !element.hasAttribute('data-analytics-category') || !element.hasAttribute('data-analytics-action')) {
			return;
		}
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
