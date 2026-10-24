import { customElement, resolve } from 'aurelia';
import { type SchemaField } from 'aurelia2-schema-form';
import { HistoryFactory } from 'aurelia2-undo-redo';
import { MachineFactory } from 'aurelia2-state-machine';
import { TaskFactory } from 'aurelia2-async-task';
import { type AutosaveSession } from 'aurelia2-autosave';
import { type TreeNode } from 'aurelia2-tree';
import { type AuPanZoom } from 'aurelia2-pan-zoom';
import template from './plugin-lab.html?raw';

type Draft = { name: string; email: string; newsletter: boolean };
@customElement({ name: 'plugin-lab', template })
export class PluginLab {
  draft: Draft = { name: 'Ada', email: 'ada@example.test', newsletter: false };
  schema: SchemaField[] = [
    { key: 'name', type: 'text', label: 'Name', required: true },
    { key: 'newsletter', type: 'checkbox', label: 'Email updates' },
    {
      key: 'email',
      type: 'email',
      label: 'Email',
      required: true,
      visible: (model) => model.newsletter === true,
    },
  ];
  remote = {
    draft: this.draft,
    greeting: '',
    greet: () => {
      this.remote.greeting = `Hello ${this.draft.name}`;
    },
  };
  history = resolve(HistoryFactory).create(this.draft, {
    clone: (value) => ({ ...value }),
    equals: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });
  machine = resolve(MachineFactory).create({
    initial: 'draft',
    context: { approved: 0 },
    states: {
      draft: { on: { REVIEW: { target: 'review' } } },
      review: {
        on: {
          APPROVE: {
            target: 'published',
            reduce: (context) => ({ approved: context.approved + 1 }),
          },
          EDIT: { target: 'draft' },
        },
      },
      published: { final: true },
    },
  });
  reviewEvent = { type: 'REVIEW' };
  approveEvent = { type: 'APPROVE' };
  editEvent = { type: 'EDIT' };
  task = resolve(TaskFactory).create(
    async (query: string, signal) => {
      await this.wait(350, signal);
      return `Results for ${query}`;
    },
    { policy: 'restart' },
  );
  query = 'Aurelia';
  nodes: TreeNode[] = [
    { id: 'projects', label: 'Projects', hasChildren: true },
    { id: 'archive', label: 'Archive' },
  ];
  selected: string | null = null;
  loadChildren = async (_node: TreeNode, signal: AbortSignal): Promise<TreeNode[]> => {
    await this.wait(150, signal);
    return [
      { id: 'website', label: 'Website' },
      { id: 'app', label: 'Application' },
    ];
  };
  stages = ['Research', 'Design', 'Build', 'Review'];
  autosave?: AutosaveSession<object>;
  saved = 'No edits yet';
  saveCount = 0;
  save = async (value: object, signal: AbortSignal) => {
    await this.wait(100, signal);
    this.saved = JSON.stringify(value);
    this.saveCount++;
  };
  submitted = '';
  pan!: AuPanZoom;
  transform = { x: 0, y: 0, scale: 1 };
  ratio = 0.5;
  applyHistory = (value: unknown) => {
    Object.assign(this.draft, value);
  };
  checkpoint(): void {
    this.history.record(this.draft, 'Edit profile');
  }
  undo(): void {
    this.applyHistory(this.history.undo());
  }
  redo(): void {
    this.applyHistory(this.history.redo());
  }
  private wait(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      signal.throwIfAborted();
      const abort = () => {
        clearTimeout(timer);
        reject(signal.reason);
      };
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', abort);
        resolve();
      }, ms);
      signal.addEventListener('abort', abort, { once: true });
    });
  }
  unbinding(): void {
    this.task.cancel();
  }
  dispose(): void {
    this.task.dispose();
  }
}
