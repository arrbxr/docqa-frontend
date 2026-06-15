import { Component, OnInit, inject, Output, EventEmitter } from '@angular/core';
import { WorkspaceService, Workspace } from '../../services/WorkspaceService';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  templateUrl: './sidebar.html',
})
export class Sidebar implements OnInit {
  
  recentWorkspaces: Workspace[] = [];
  workspaceService = inject(WorkspaceService);

  @Output() onMenuClick = new EventEmitter<void>();

  ngOnInit() {
    this.workspaceService.workspacesList$.subscribe(list => {
      this.recentWorkspaces = list;
    });
  }

  createNewWorkspace() {
    this.workspaceService.setCurrentWorkspace(null);
    this.onMenuClick.emit(); // Signal bhejo
  }

  selectWorkspace(ws: Workspace) {
    this.workspaceService.setCurrentWorkspace(ws);
    this.onMenuClick.emit(); // Signal bhejo
  }
}