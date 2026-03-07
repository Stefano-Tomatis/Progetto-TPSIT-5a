import { TestBed } from '@angular/core/testing';

import { ModuloHttpService } from './modulo-http.service';

describe('ModuloHttpService', () => {
  let service: ModuloHttpService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ModuloHttpService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
