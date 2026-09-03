import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import {
  ApiResponse,
  ApiResponsePaginated,
  Pagination,
} from '../../../../../core/dtos/api.response';
import { AddressPicked } from '../../../../../shared/components/address-autocomplete/address-autocomplete';
import { addressFingerprint } from '../../../../../shared/components/address-autocomplete/address-field-source';
import { AddressGeoPrecision } from '../../../../../shared/dtos/geocoding.dtos';
import { PartialMeterDTO, UpdateMeterAddressDTO } from '../../../../../shared/dtos/meter.dtos';
import { MeterService } from '../../../../../shared/services/meter.service';
import { ErrorMessageHandler } from '../../../../../shared/services-ui/error.message.handler';
import { MeterDataStatus } from '../../../../../shared/types/meter.types';
import { UnlocatedMeters } from './unlocated-meters';

function buildMeter(ean: string, street: string): PartialMeterDTO {
  return {
    EAN: ean,
    meter_number: `M-${ean.slice(-3)}`,
    address: {
      id: 1,
      street,
      number: '1',
      postcode: '1000',
      city: 'Bruxelles',
    },
    status: MeterDataStatus.ACTIVE,
  } as PartialMeterDTO;
}

describe('UnlocatedMeters', () => {
  let fixture: ComponentFixture<UnlocatedMeters>;
  let component: UnlocatedMeters;
  let meterServiceSpy: {
    getMetersList: ReturnType<typeof vi.fn>;
    updateMeterAddress: ReturnType<typeof vi.fn>;
  };
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleError: ReturnType<typeof vi.fn> };
  let dialogConfig: { data: { query: Record<string, unknown> } };

  const rows = [buildMeter('54100000001', 'Rue A'), buildMeter('54100000002', 'Rue B')];

  async function build(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [UnlocatedMeters, TranslateModule.forRoot()],
      providers: [
        { provide: MeterService, useValue: meterServiceSpy },
        { provide: DynamicDialogRef, useValue: dialogRefSpy },
        { provide: DynamicDialogConfig, useValue: dialogConfig },
        { provide: ErrorMessageHandler, useValue: errorHandlerSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      // Blank the template so PrimeNG never renders under jsdom.
      .overrideComponent(UnlocatedMeters, {
        set: {
          imports: [TranslateModule],
          template: '',
          providers: [{ provide: ErrorMessageHandler, useValue: errorHandlerSpy }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(UnlocatedMeters);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(() => {
    meterServiceSpy = {
      getMetersList: vi
        .fn()
        .mockReturnValue(of(new ApiResponsePaginated(rows, new Pagination(1, 50, 2, 1)))),
      updateMeterAddress: vi.fn().mockReturnValue(of(new ApiResponse('success', 0))),
    };
    dialogRefSpy = { close: vi.fn() };
    errorHandlerSpy = { handleError: vi.fn() };
    dialogConfig = { data: { query: { status: MeterDataStatus.ACTIVE } } };
  });

  it('asks for meters that are not USABLY on the map, not merely uncoordinated', async () => {
    // Wider than `latitude IS NULL` on purpose: a commune-centroid pin has a
    // coordinate and is still wrong, and on an existing database those are the
    // majority.
    await build();

    const query = meterServiceSpy.getMetersList.mock.calls[0][0] as Record<string, unknown>;
    expect(query['located']).toBe(false);
  });

  it("carries the map's own filters through", async () => {
    // `missing_coordinates` is computed over the active filters, so a dialog
    // that ignored them would fix meters that were never on screen and the
    // visible number would not move.
    await build();

    const query = meterServiceSpy.getMetersList.mock.calls[0][0] as Record<string, unknown>;
    expect(query['status']).toBe(MeterDataStatus.ACTIVE);
  });

  it('auto-selects the first row, which is what makes it one click from the map', async () => {
    await build();

    expect(component.selected()?.EAN).toBe('54100000001');
    expect(component.addressForm.getRawValue().address_street).toBe('Rue A');
  });

  it('saves the edited address for the selected meter and advances', async () => {
    await build();
    component.addressForm.patchValue({ address_street: 'Rue de la Loi', address_number: '16' });

    component.save();

    const payload = meterServiceSpy.updateMeterAddress.mock.calls[0][0] as UpdateMeterAddressDTO;
    expect(payload.EAN).toBe('54100000001');
    expect(payload.address.street).toBe('Rue de la Loi');
    // The repaired meter leaves the queue, and the next one is selected.
    expect(component.total()).toBe(1);
    expect(component.selected()?.EAN).toBe('54100000002');
    expect(component.repairedCount()).toBe(1);
  });

  it('sends a picked coordinate so the repair lands on the map immediately', async () => {
    await build();
    const fields = {
      street: 'Rue de la Loi',
      number: '16',
      supplement: '',
      postcode: '1000',
      city: 'Bruxelles',
    };
    const picked: AddressPicked = {
      suggestion: {
        id: 'best:1',
        kind: 'address',
        label: 'Rue de la Loi 16, 1000 Bruxelles',
        street: fields.street,
        number: fields.number,
        postcode: fields.postcode,
        city: fields.city,
        country: 'BE',
        latitude: 50.846169,
        longitude: 4.366538,
        precision: AddressGeoPrecision.ROOFTOP,
        best_address_id: 'best:1',
      },
      fields,
      fingerprint: addressFingerprint(fields),
    };
    (component as unknown as { onAddressPicked: (e: AddressPicked) => void }).onAddressPicked(
      picked,
    );

    component.save();

    const payload = meterServiceSpy.updateMeterAddress.mock.calls[0][0] as UpdateMeterAddressDTO;
    expect(payload.address).toMatchObject({ latitude: 50.846169, longitude: 4.366538 });
  });

  it('DROPS a picked coordinate that no longer matches the typed address', async () => {
    await build();
    const fields = {
      street: 'Rue de la Loi',
      number: '16',
      supplement: '',
      postcode: '1000',
      city: 'Bruxelles',
    };
    (component as unknown as { onAddressPicked: (e: AddressPicked) => void }).onAddressPicked({
      suggestion: {
        id: 'best:1',
        kind: 'address',
        label: 'x',
        street: fields.street,
        number: fields.number,
        postcode: fields.postcode,
        city: fields.city,
        country: 'BE',
        latitude: 50.846169,
        longitude: 4.366538,
      },
      fields,
      fingerprint: addressFingerprint(fields),
    });
    component.addressForm.patchValue({ address_number: '18' });

    component.save();

    const payload = meterServiceSpy.updateMeterAddress.mock.calls[0][0] as UpdateMeterAddressDTO;
    expect(payload.address).not.toHaveProperty('latitude');
  });

  it('does not save an incomplete address', async () => {
    await build();
    component.addressForm.patchValue({ address_street: '' });

    component.save();

    expect(meterServiceSpy.updateMeterAddress).not.toHaveBeenCalled();
  });

  it('keeps the row and reports the error when the save fails', async () => {
    await build();
    meterServiceSpy.updateMeterAddress.mockReturnValue(throwError(() => new Error('boom')));

    component.save();

    expect(errorHandlerSpy.handleError).toHaveBeenCalled();
    expect(component.total()).toBe(2);
    expect(component.repairedCount()).toBe(0);
  });

  it('skip moves on without writing anything', async () => {
    await build();

    component.skip();

    expect(meterServiceSpy.updateMeterAddress).not.toHaveBeenCalled();
    expect(component.selected()?.EAN).toBe('54100000002');
  });

  it('tells the caller whether anything changed, so the map only refetches when it must', async () => {
    await build();

    component.close();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(false);

    component.save();
    component.close();
    expect(dialogRefSpy.close).toHaveBeenLastCalledWith(true);
  });
});
