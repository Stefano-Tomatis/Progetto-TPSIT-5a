import { TestBed } from '@angular/core/testing';

import { ServiceDatiService } from './service-dati.service';

describe('ServiceDatiService', () => {
  let service: ServiceDatiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ServiceDatiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
