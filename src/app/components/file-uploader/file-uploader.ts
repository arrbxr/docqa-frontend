import { Component, EventEmitter, Output, ViewChild, ElementRef } from '@angular/core';

// 🔥 FIX: Ab isme 'file' property hai jisme asli document save hoga
export interface UploadedFile {
  name: string;
  size: string;
  file: File; 
}

@Component({
  selector: 'app-file-uploader',
  standalone: true,
  imports: [],
  templateUrl: './file-uploader.html',
  styleUrl: './file-uploader.css',
})
export class FileUploader {
  
  // Asli HTML file input ka reference
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // 3 Fixed Slots
  slots: (UploadedFile | null)[] = [null, null, null];
  
  // Yaad rakhne ke liye ki kis dabbe par click hua tha
  activeSlotIndex: number = -1;

  @Output() onUploadStatusChange = new EventEmitter<boolean>();

  // Box par click karne par ab dummy naam nahi aayega, balki file explorer khulega
  triggerFileSelect(index: number) {
    this.activeSlotIndex = index;
    this.fileInput.nativeElement.click(); // File chunn-ne wala system dialog open karo
  }

  // Jab user system se file select kar lega, tab yeh chalega
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    
    if (input.files && input.files.length > 0) {
      const selectedFile = input.files[0];
      
      // File ka size calculate karo (MB mein)
      const sizeInMB = (selectedFile.size / (1024 * 1024)).toFixed(2);
      
      // Us slot mein asli file daal do
      this.slots[this.activeSlotIndex] = {
        name: selectedFile.name,
        size: `${sizeInMB} MB`,
        file: selectedFile // 🔥 Yeh Dashboard bhejega tumhare backend (Ingestion API) ko!
      };

      this.notifyDashboard();
    }
    
    // Input ko reset kar do taaki same file dubara bhi select ki ja sake
    input.value = '';
  }

  removeFile(index: number, event: Event) {
    event.stopPropagation();
    this.slots[index] = null;
    this.notifyDashboard();
  }

  get hasMinimumOneFile(): boolean {
    return this.slots.some(slot => slot !== null);
  }

  notifyDashboard() {
    this.onUploadStatusChange.emit(this.hasMinimumOneFile);
  }
}