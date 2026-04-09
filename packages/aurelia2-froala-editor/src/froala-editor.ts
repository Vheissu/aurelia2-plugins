import { IHydratedController } from '@aurelia/runtime-html';
import { customElement, bindable, INode, ICustomElementViewModel, inject } from 'aurelia';
import { IFroalaConfig, FroalaOptions } from './froala-editor-config';

// Import Froala Editor
import FroalaEditorLib from 'froala-editor';

interface FroalaEditorInstance {
	html: { get(): string; set(html: string): void };
	events: { on(name: string, callback: (...args: unknown[]) => unknown): void };
	destroy(): void;
}

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

	bound(_initiator: IHydratedController, parent: IHydratedController): void | Promise<void> {
		this.parent = parent.viewModel;
	}

    valueChanged(newValue: string, _oldValue: string | undefined): void {
        if (this.editor?.html.get() != newValue) {
            this.editor?.html.set(newValue);
        }
    }

	// Setup
	attached(): void {
		// Merge default config from DI with bindable config overrides
		const mergedConfig: FroalaOptions = { ...this.defaultConfig, ...this.config };
		const self = this;

		// Check if editor isn't already initialized.
		if (this.editor != null) {
            return;
        }

		// Will be registered when editor is initialized.
		mergedConfig.events = {
			contentChanged: function contentChanged(this: FroalaEditorInstance['html'] & { html: FroalaEditorInstance['html'] }) {
			        self.value = this.html.get();
			},
			blur: function blur(this: FroalaEditorInstance['html'] & { html: FroalaEditorInstance['html'] }) {
			        self.value = this.html.get();
			}
		};

		// Initialize editor.
		this.editor = new FroalaEditorLib(this.element, Object.assign({}, mergedConfig)) as unknown as FroalaEditorInstance;

		// Set initial HTML value.
		this.editor.html.set(this.value);

		// Set Events
		if (this.eventHandlers && Object.keys(this.eventHandlers).length !== 0) {
			for(const eventHandlerName in this.eventHandlers) {
				const handler = this.eventHandlers[eventHandlerName];
				if (eventHandlerName === 'initialized') {
					handler.apply(this.parent);
				} else {
					this.editor.events.on(`${eventHandlerName}`, (...args: unknown[]) => {
						return handler.apply(this.parent, args);
					});
				}
			}
		}

        // Change callback needs to be fired on attached to set initial value
        this.valueChanged(this.value, undefined);
	}

	// Destroy
	detached(): void {
		if (this.editor != null) {
			this.editor.destroy();
			this.editor = null;
		}
	}
}
