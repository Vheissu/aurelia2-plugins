import { createFixture } from '@aurelia/testing';
import { Modal, Offcanvas } from 'bootstrap';
import { AubsModalCustomAttribute } from '../src/modal/aubs-modal';
import { AubsOffcanvasCustomAttribute } from '../src/offcanvas/aubs-offcanvas';

describe('Bootstrap overlay teardown', () => {
  test('finishes an opening modal transition, hides the modal, and unlocks scrolling', async () => {
    const hidden = jest.fn();
    const fixture = await createFixture(
      `<div class="modal fade" aubs-modal="is-open.bind: true; on-hidden.bind: hidden">
        <div class="modal-dialog"><div class="modal-content"></div></div>
      </div>`,
      class { hidden = hidden; },
      [AubsModalCustomAttribute],
    ).started;
    const modal = fixture.appHost.querySelector<HTMLElement>('.modal')!;
    expect(Modal.getInstance(modal)).not.toBeNull();
    expect(document.body.classList.contains('modal-open')).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    await fixture.tearDown();

    expect(Modal.getInstance(modal)).toBeNull();
    expect(document.body.classList.contains('modal-open')).toBe(false);
    expect(document.body.style.overflow).toBe('');
    expect(document.body.querySelector('.modal-backdrop')).toBeNull();
    expect(hidden).not.toHaveBeenCalled();
  });

  test('finishes an offcanvas hide transition before disposing the instance', async () => {
    const fixture = await createFixture(
      '<div class="offcanvas" aubs-offcanvas="is-open.bind: true"></div>',
      class {},
      [AubsOffcanvasCustomAttribute],
    ).started;
    const offcanvas = fixture.appHost.querySelector<HTMLElement>('.offcanvas')!;
    expect(Offcanvas.getInstance(offcanvas)).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');

    await fixture.tearDown();

    expect(Offcanvas.getInstance(offcanvas)).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.body.querySelector('.offcanvas-backdrop')).toBeNull();
  });
});
