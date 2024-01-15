import { IHydratedController, watch } from '@aurelia/runtime-html';
import { customElement, bindable, INode, ICustomElementViewModel } from 'aurelia';
import { IFroalaConfig } from './froala-editor-config';

// Import Froala Editor
import FroalaEditor from 'froala-editor';

@customElement('froala-editor')
export class FroalaEditor implements ICustomElementViewModel {
	@bindable value;
	@bindable config: any = {};
	@bindable eventHandlers: any = {};
	@bindable editor;

	parent;

	constructor (@INode readonly element: HTMLElement, @IFroalaConfig config: IFroalaConfig) {
		this.element = element;
		this.config = config.options();
	}

	bound(initiator: IHydratedController, parent: IHydratedController): void | Promise<void> {
		this.parent = parent.viewModel;
	}

    valueChanged(newValue, oldValue) {
        if (this.editor && this.editor.html.get() != newValue) {
            this.editor.html.set(newValue);
        }
    }

	// Setup
	attached() {
		// Get element.
		const editorSelector = this.config.iframe ? 'textarea' : 'div';
		let editor = this
		
		// Check if editor isn't already initialized.
		if (this.editor != null) { 
            return; 
        }

		// Will be registered when editor is initialized.
		this.config.events = {
			contentChanged: function contentChanged(e) {
			        return editor.value = this.html.get();
			},
			blur: function blur(e) {
			        return editor.value = this.html.get();
			}
		};

		// Initialize editor.
		this.editor = new FroalaEditor(this.element, Object.assign({}, this.config));

		// Set initial HTML value.
		this.editor.html.set(this.value);

		// Set Events
		if (this.eventHandlers && this.eventHandlers.length != 0) {
			for(let eventHandlerName in this.eventHandlers) {
				let handler = this.eventHandlers[eventHandlerName];
				if (eventHandlerName === 'initialized') {
					handler.apply(this.parent);
				} else {
					this.editor.events.on(`${eventHandlerName}`, (...args) => {
						return handler.apply(this.parent, args);
					});
				}
			}
		}

        // Change callback needs to be fired on attached to set initial value
        this.valueChanged(this.value, undefined);
	}

	// Destroy
	detached () {
		if (this.editor != null) {
			this.editor.destroy();
			this.editor = null;
		}
	}
}