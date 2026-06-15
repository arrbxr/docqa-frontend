import { Component, ElementRef, ViewChild, AfterViewChecked, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { marked } from 'marked';

import { WorkspaceService, Workspace, ChatMessage } from '../../services/WorkspaceService';

// Extend local interface to support the temporary thinking flag safely
export interface ExtendedChatMessage extends ChatMessage {
  isThinking?: boolean;
}

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chat-window.html',
  styleUrl: './chat-window.css',
})
export class ChatWindow implements OnInit, AfterViewChecked {
  
  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  workspaceService = inject(WorkspaceService);
  cdr = inject(ChangeDetectorRef); 

  activeWorkspace: Workspace | null = null;
  newMessage: string = '';
  messages: ExtendedChatMessage[] = [];

  ngOnInit() {
    this.workspaceService.currentWorkspace$.subscribe(ws => {
      this.activeWorkspace = ws;
      
      if (ws) {
        if (ws.messages && ws.messages.length > 0) {
          this.messages = [...ws.messages];
        } else {
          this.messages = [
            { text: 'Hello! I have indexed your documents. Ask me anything about them.', isUser: false, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
          ];
          this.workspaceService.updateWorkspaceMessages(ws.workspaceId, this.messages);
        }
      }
    });
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.activeWorkspace) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userQuery = this.newMessage;

    // 1. User Message Push
    this.messages.push({
      text: userQuery,
      isUser: true,
      time: currentTime
    });

    this.newMessage = ''; 
    const wsId = this.activeWorkspace.workspaceId; 

    this.workspaceService.updateWorkspaceMessages(wsId, this.messages);

    // 2. Temporary "Thinking..." Indicator Display
    const thinkingMessage: ExtendedChatMessage = { 
      text: '', 
      isUser: false, 
      time: '...',
      isThinking: true 
    };
    this.messages.push(thinkingMessage);

    // 3. SSE Connection Init
    const url = `http://localhost:8080/api/v1/qa/ask?workspaceId=${wsId}&question=${encodeURIComponent(userQuery)}`;
    const eventSource = new EventSource(url);

    let isFirstChunk = true;

    eventSource.onmessage = (event) => {
      try {
        const dataMap = JSON.parse(event.data);
        const chunkText = Object.values(dataMap)[0] as string; 

        if (isFirstChunk) {
          // Remove the temporary thinking indicator payload
          this.messages = this.messages.filter(msg => !msg.isThinking);
          
          // Push actual blank AI message receptacle
          this.messages.push({ 
            text: '', 
            isUser: false, 
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
          });
          
          isFirstChunk = false;
        }
        
        const activeAiMessage = this.messages[this.messages.length - 1];
        activeAiMessage.text += chunkText; 
        
        this.cdr.detectChanges(); 
        this.scrollToBottom();
      } catch (e) {
        console.error("Error parsing SSE chunk", e);
      }
    };

    eventSource.onerror = (error) => {
      console.log("Stream complete or connection closed.");
      eventSource.close(); 
      this.workspaceService.updateWorkspaceMessages(wsId, this.messages);
    };
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch(err) { }
  }

  formatMarkdown(text: string): string {
    if (!text) return '';
    return marked.parse(text) as string;
  }
}