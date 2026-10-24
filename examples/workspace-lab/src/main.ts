import Aurelia, { customElement } from 'aurelia';
import { RouterConfiguration, route } from '@aurelia/router';
import { AureliaFilterBuilderConfiguration } from 'aurelia2-filter-builder';
import { AureliaMergeConfiguration } from 'aurelia2-merge';
import { AureliaMentionsConfiguration } from 'aurelia2-mentions';
import { AureliaTransferListConfiguration } from 'aurelia2-transfer-list';
import { AureliaUrlStateConfiguration } from 'aurelia2-url-state';
import { RouterUrlStateAdapter } from 'aurelia2-url-state/router';
import { WorkspacePage } from './workspace-page';
import './style.css';
@route({ routes: [{ path: '', component: WorkspacePage }] })
@customElement({ name: 'workspace-app', template: '<au-viewport></au-viewport>' })
class WorkspaceApp {}
Aurelia.register(
  RouterConfiguration,
  AureliaFilterBuilderConfiguration,
  AureliaMergeConfiguration,
  AureliaMentionsConfiguration,
  AureliaTransferListConfiguration,
  AureliaUrlStateConfiguration.configure({ adapter: RouterUrlStateAdapter }),
)
  .app(WorkspaceApp)
  .start();
