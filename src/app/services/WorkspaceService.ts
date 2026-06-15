import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, forkJoin, tap } from 'rxjs';

import { environment } from '../../environments/environment.prod';

// 🔥 Chat message ka structure
export interface ChatMessage {
  text: string;
  isUser: boolean;
  time: string;
}

// 🔥 Workspace ka structure (Backend wale 'workspaceId' field ke sath)
export interface Workspace {
  workspaceId: string;
  name: string;
  createdAt?: string; // Backend se aayega
  messages?: ChatMessage[]; 
}

@Injectable({
  providedIn: 'root'
})
export class WorkspaceService {

  private http = inject(HttpClient);
  
  // 🔥 Tumhara API Gateway URL
  private API_GATEWAY_URL = environment.apiUrl;  

  // 1. Current Active Workspace
  private currentWorkspace = new BehaviorSubject<Workspace | null>(null);
  currentWorkspace$ = this.currentWorkspace.asObservable();

  // 2. Saare Workspaces ki List
  private workspacesList = new BehaviorSubject<Workspace[]>([]);
  workspacesList$ = this.workspacesList.asObservable();

  constructor() {
    // App start hote hi backend se data laao
    this.fetchWorkspacesFromBackend();
  }

  // ==========================================
  // 1. GET ALL WORKSPACES FROM BACKEND
  // ==========================================
  fetchWorkspacesFromBackend() {
    this.http.get<Workspace[]>(`${this.API_GATEWAY_URL}/workspaces`).subscribe({
      next: (workspaces) => {
        // Workspaces DB se aa gaye, ab browser ki memory se inki chat nikal lo
        const localChats = JSON.parse(localStorage.getItem('my_chats') || '{}');
        
        // Dono ko merge kar do
        const mergedWorkspaces = workspaces.map(ws => ({
          ...ws,
          messages: localChats[ws.workspaceId] || [] 
        }));

        // Naye workspaces upar dikhane ke liye reverse kar sakte hain
        const sortedWorkspaces = mergedWorkspaces.reverse();

        this.workspacesList.next(sortedWorkspaces);
        
        // 🔥 FIX: Yahan se auto-select wala code hata diya gaya hai.
        // Ab app refresh hone par hamesha Uploader wali screen aayegi.
      },
      error: (err) => console.error("Error fetching workspaces from backend", err)
    });
  }

  setCurrentWorkspace(ws: Workspace | null) {
    this.currentWorkspace.next(ws);
  }

  // ==========================================
  // 2. CREATE WORKSPACE (API CALL)
  // ==========================================
  createWorkspace(customName: string): Observable<Workspace> {
    const payload = { name: customName };
    
    return this.http.post<Workspace>(`${this.API_GATEWAY_URL}/workspaces`, payload).pipe(
      tap((newWorkspace: Workspace) => {
        newWorkspace.messages = []; // Chat history initialize karo
        
        const currentList = this.workspacesList.getValue();
        const updatedList = [newWorkspace, ...currentList]; 
        
        this.workspacesList.next(updatedList);
        this.setCurrentWorkspace(newWorkspace);
      })
    );
  }

  // ==========================================
  // 3. UPLOAD FILES (FORKJOIN SE PARALLEL)
  // ==========================================
  uploadFilesToWorkspace(workspaceId: string, files: File[]): Observable<any[]> {
    const uploadRequests = files.map(file => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspaceId', workspaceId);
      
      // Har file ke liye ek post request banegi
      return this.http.post(`${this.API_GATEWAY_URL}/documents/upload`, formData);
    });

    // forkJoin teeno files ko ek sath server par bhejega aur sabke upload hone ka wait karega
    return forkJoin(uploadRequests);
  }

  // ==========================================
  // 4. CHAT HISTORY (LOCAL STORAGE)
  // ==========================================
  updateWorkspaceMessages(workspaceId: string, newMessages: ChatMessage[]) {
    // 1. Storage update
    const localChats = JSON.parse(localStorage.getItem('my_chats') || '{}');
    localChats[workspaceId] = newMessages;
    localStorage.setItem('my_chats', JSON.stringify(localChats));

    // 2. Memory State update
    const currentList = this.workspacesList.getValue();
    const updatedList = currentList.map(ws => {
      if (ws.workspaceId === workspaceId) {
        return { ...ws, messages: newMessages };
      }
      return ws;
    });

    this.workspacesList.next(updatedList);
    
    // 3. Current active workspace ko bhi update karo
    const activeWs = this.currentWorkspace.getValue();
    if (activeWs && activeWs.workspaceId === workspaceId) {
        this.currentWorkspace.next({ ...activeWs, messages: newMessages });
    }
  }

  // API call to check document processing status
  checkWorkspaceStatus(workspaceId: string): Observable<any> {
    return this.http.get(`${this.API_GATEWAY_URL}/documents/status/${workspaceId}`);
  }
}