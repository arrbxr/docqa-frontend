import { TestBed } from '@angular/core/testing';

import { WorkspaceService } from './WorkspaceService';

describe('Workspace', () => {
  let service: Workspace;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WorkspaceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
