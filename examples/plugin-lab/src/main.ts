import Aurelia from 'aurelia';
import { AureliaRemoteTemplateConfiguration } from 'aurelia2-remote-template';
import { AureliaSchemaFormConfiguration } from 'aurelia2-schema-form';
import { AureliaUndoRedoConfiguration } from 'aurelia2-undo-redo';
import { AureliaStateMachineConfiguration } from 'aurelia2-state-machine';
import { AureliaAsyncTaskConfiguration } from 'aurelia2-async-task';
import { AureliaTreeConfiguration } from 'aurelia2-tree';
import { AureliaSortableConfiguration } from 'aurelia2-sortable';
import { AureliaAutosaveConfiguration } from 'aurelia2-autosave';
import { AureliaPanZoomConfiguration } from 'aurelia2-pan-zoom';
import { AureliaSplitPaneConfiguration } from 'aurelia2-split-pane';
import { PluginLab } from './plugin-lab';
import './style.css';

Aurelia.register(
  AureliaRemoteTemplateConfiguration.configure({ allowedOrigins: [location.origin] }),
  AureliaSchemaFormConfiguration,
  AureliaUndoRedoConfiguration,
  AureliaStateMachineConfiguration,
  AureliaAsyncTaskConfiguration,
  AureliaTreeConfiguration,
  AureliaSortableConfiguration,
  AureliaAutosaveConfiguration.configure({ delay: 300, maxWait: 1500 }),
  AureliaPanZoomConfiguration,
  AureliaSplitPaneConfiguration,
)
  .app({ host: document.querySelector('plugin-lab')!, component: PluginLab })
  .start();
