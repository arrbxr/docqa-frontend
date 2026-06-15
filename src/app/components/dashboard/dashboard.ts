import { Component, inject, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { timer, switchMap, takeWhile } from 'rxjs'; // 🔥 NAYA IMPORT FOR POLLING

import { FileUploader } from '../file-uploader/file-uploader';
import { WorkspaceService, Workspace } from '../../services/WorkspaceService';
import { ChatWindow } from '../chat-window/chat-window';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FileUploader, ChatWindow, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  
  @ViewChild('uploaderRef', { static: false }) uploader!: FileUploader;
  workspaceService = inject(WorkspaceService);
  cdr = inject(ChangeDetectorRef);

  activeWorkspace: Workspace | null = null;
  isModalOpen = false;
  isChatUnlocked = false;
  
  isUploading = false; 
  uploadingText = 'Start Chat'; // 🔥 Button par alag-alag text dikhane ke liye

  ngOnInit() {
    this.workspaceService.currentWorkspace$.subscribe(ws => {
      this.activeWorkspace = ws;
      if (!ws) this.isChatUnlocked = false;
    });
  }

  handleStatusChange(status: boolean) {
    this.isChatUnlocked = status;
  }

  openWorkspaceModal() {
    this.uploadingText = 'Start Chat';
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.isUploading = false;
    this.uploadingText = 'Start Chat';
    this.cdr.detectChanges(); 
  }

  createWorkspaceAndUpload(workspaceName: string) {
    if (!workspaceName.trim()) {
      alert("Please enter a valid workspace name!");
      return;
    }

    if (!this.uploader || !this.uploader.slots) return;

    const filesToUpload = this.uploader.slots
      .filter((slot): slot is any => slot !== null) 
      .map(slot => slot.file as File);

    if (filesToUpload.length === 0) return;

    this.isUploading = true;
    this.uploadingText = 'Uploading files...';
    this.cdr.detectChanges();

    // 1. Workspace Banao
    this.workspaceService.createWorkspace(workspaceName).subscribe({
      next: (newWorkspace) => {
        
        // 2. Upload Files
        this.workspaceService.uploadFilesToWorkspace(newWorkspace.workspaceId, filesToUpload).subscribe({
          next: () => {
            console.log("Documents uploaded to MinIO. Waiting for vectorization...");
            
            // 🔥 3. POLLING MAGIC: UI text badlo aur status check karo
            this.uploadingText = 'Vectorizing documents...';
            this.cdr.detectChanges();

            // Har 2000ms (2 second) mein status puchega
            timer(0, 2000).pipe(
              switchMap(() => this.workspaceService.checkWorkspaceStatus(newWorkspace.workspaceId)),
              // Jab tak status 'PROCESSING' hai tab tak loop chalne do
              takeWhile(response => response.status === 'PROCESSING', true) 
            ).subscribe({
              next: (pollResponse) => {
                if (pollResponse.status === 'COMPLETED') {
                  console.log("Vectorization Complete! Opening Chat...");
                  this.closeModal(); // Jab COMPLETED aayega, tabhi chat khulegi
                }
              },
              error: (pollErr) => {
                console.error("Polling error", pollErr);
                this.closeModal(); // Error par bhi unlock kar do
              }
            });
            
          },
          error: (uploadErr) => {
            alert("Document upload failed!");
            this.closeModal();
          }
        });
      },
      error: (err: HttpErrorResponse) => {
        this.isUploading = false;
        if (err.status === 409) alert("Workspace name already exists!");
        this.cdr.detectChanges(); 
      }
    });
  }
}