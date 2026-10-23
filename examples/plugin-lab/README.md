# Plugin lab

A working example of the ten workflow and editor plugins. It imports their built ESM exports, so it also exercises the package layout consumed by a Vite application.

From the repository root:

```sh
npm ci
npm run build
npm ci --prefix examples/plugin-lab
npm start --prefix examples/plugin-lab
```

Open `http://127.0.0.1:9010`. After editing a package, rebuild that package and refresh the page.

To check the production bundle:

```sh
npm run build --prefix examples/plugin-lab
npm run preview --prefix examples/plugin-lab -- --port 9010
```

## Things to try

1. Change the profile name. Autosave records it, and the fetched HTML fragment updates its Aurelia binding. The example's save callback is an in-memory simulation; it does not send personal data anywhere.
2. Enable email updates to reveal the conditional email field. Submit with an invalid email to see validation and focus handling.
3. Save a checkpoint, edit again, save another, then Undo/Redo.
4. Request review and approve the publishing workflow. Its final state rejects more transitions.
5. Run a search. Repeated starts use the restart policy and abort the older simulated request.
6. Focus Projects and press Right to load its children, then use arrows and Enter to select one.
7. Focus a delivery stage and use Space, arrows, and Enter to reorder it. Escape cancels the preview. Native drag/drop is also supported.
8. Resize the workspace divider, use its arrow keys, then fit, pan, or zoom the canvas.

`public/welcome.html` is served as a trusted template from the same origin. Changing that file can execute Aurelia expressions with the application's privileges. It is application source, not user-authored content.

The Vite configuration deduplicates Aurelia packages so linked workspaces and the app share one runtime. No Node browser polyfills are required.
