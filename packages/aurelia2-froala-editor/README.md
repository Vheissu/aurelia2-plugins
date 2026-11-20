# aurelia2-froala-editor

Register `FroalaConfiguration` to use the Froala rich-text editor in an Aurelia template.

```ts
import { FroalaConfiguration } from 'aurelia2-froala-editor';

Aurelia.register(FroalaConfiguration);
```

Bind the HTML value two ways to keep the view model in sync as the user edits.

```html
<froala-editor value.two-way="articleHtml" config.bind="editorOptions"></froala-editor>
```
