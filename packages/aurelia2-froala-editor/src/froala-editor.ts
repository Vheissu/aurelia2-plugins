import { customElement, bindable, INode, type ICustomElementViewModel, inject } from 'aurelia';
import FroalaEditorLib from 'froala-editor';
import { IFroalaConfig, type FroalaOptions } from './froala-editor-config';

interface FroalaEditorInstance {
	html: { get(): string; set(html: string): void };
	events: { on(name: string, callback: (...args: unknown[]) => unknown): void };
	destroy(): void;
}

type BoundHookArgs = Parameters<NonNullable<ICustomElementViewModel['bound']>>;

@customElement('froala-editor')
@inject(INode, IFroalaConfig)
export class FroalaEditor implements ICustomElementViewModel {
	@bindable public value: string = '';
	@bindable public config: FroalaOptions = {};
	@bindable public eventHandlers: Record<string, (...args: unknown[]) => unknown> = {};
	@bindable public editor: FroalaEditorInstance | null = null;

	private parent: unknown = null;
	private readonly defaultConfig: FroalaOptions;

	constructor (readonly element: HTMLElement, froalaConfig: IFroalaConfig) {
		this.defaultConfig = froalaConfig.options() ?? {};
	}

	bound(_initiator: BoundHookArgs[0], parent: BoundHookArgs[1]): void {
		while (parent && parent.vmKind !== 'customElement') {
			parent = parent.parent;
		}
		this.parent = parent?.viewModel;
	}

	valueChanged(value: string): void {
		if (this.editor && this.editor.html.get() !== value) {
			this.editor.html.set(value);
		}
	}

	attached(): void {
		if (this.editor) return;

		const events = { ...this.defaultConfig.events, ...this.config?.events };
		const updateValue = (html: string): void => { this.value = html; };
		const syncValue = (handler?: (...args: unknown[]) => unknown) => {
			return function (this: FroalaEditorInstance, ...args: unknown[]) {
				updateValue(this.html.get());
				return handler?.apply(this, args);
			};
		};

		const config: FroalaOptions = {
			...this.defaultConfig,
			...this.config,
			events: {
				...events,
				contentChanged: syncValue(events.contentChanged),
				blur: syncValue(events.blur),
			},
		};

		this.editor = new FroalaEditorLib(this.element, config) as unknown as FroalaEditorInstance;
		this.editor.html.set(this.value);
		for (const [name, handler] of Object.entries(this.eventHandlers ?? {})) {
			if (name === 'initialized') {
				handler.apply(this.parent);
			} else {
				this.editor.events.on(name, (...args) => handler.apply(this.parent, args));
			}
		}
	}

	detaching(): void {
		this.editor?.destroy();
		this.editor = null;
	}

	unbinding(): void {
		this.parent = null;
	}
}
